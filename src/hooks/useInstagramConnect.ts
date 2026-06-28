'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cmsApi } from '@/lib/api';
import {
  INSTAGRAM_CONNECT,
  INSTAGRAM_STATUS,
  INSTAGRAM_DISCONNECT,
} from '@/lib/apiPaths';

/**
 * Encapsulates the Instagram OAuth handshake + connection lifecycle.
 *
 * The backend exposes four endpoints (see apiPaths.ts):
 *   GET    /instagram/status     → { connected, username }
 *   GET    /instagram/connect    → { authorizeUrl }
 *   DELETE /instagram/disconnect
 *
 * /instagram-callback (this app's own page) posts a message back to the
 * opener with `{ type: 'INSTAGRAM_OAUTH', status }` after the OAuth provider
 * redirects the user back.
 *
 * Usage:
 *   const ig = useInstagramConnect();
 *   await ig.connect();           // resolves with { success: true } on OAuth success
 *   await ig.checkStatus();
 *   {ig.connected && <button onClick={ig.disconnect}>Disconnect</button>}
 */
export function useInstagramConnect() {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [username, setUsername] = useState<string>('');
  const [error, setError] = useState<string>('');
  const popupRef = useRef<Window | null>(null);
  // Resolver queue: each in-flight connect() promise waits for the next
  // INSTAGRAM_OAUTH postMessage to resolve.
  const pendingResolvers = useRef<Array<(r: { success: boolean }) => void>>([]);

  const checkStatus = useCallback(async () => {
    try {
      const { data } = await cmsApi.get(INSTAGRAM_STATUS);
      setConnected(!!data?.connected);
      if (data?.username) setUsername(data.username);
      return !!data?.connected;
    } catch {
      // status check failing is non-fatal — leave the previous state alone
      return false;
    }
  }, []);

  const connect = useCallback(async (): Promise<{ success: boolean }> => {
    setConnecting(true);
    setError('');
    // Queue a resolver so the message listener can settle this promise.
    const settled = new Promise<{ success: boolean }>((resolve) => {
      pendingResolvers.current.push(resolve);
    });
    try {
      const { data } = await cmsApi.get(INSTAGRAM_CONNECT);
      const { authorizeUrl } = data;
      if (!authorizeUrl) {
        setError('Backend did not return an authorize URL.');
        setConnecting(false);
        // Reject any queued resolver (none yet, but be defensive)
        pendingResolvers.current.shift()?.({ success: false });
        return { success: false };
      }
      const popup = window.open(
        authorizeUrl,
        'ig_oauth',
        'width=600,height=700,left=200,top=100'
      );
      popupRef.current = popup;
      // Poll for popup close in case the postMessage handshake doesn't fire
      // (e.g. user closed the popup manually before completing OAuth).
      const timer = setInterval(() => {
        if (popup?.closed) {
          clearInterval(timer);
          setConnecting(false);
          // If the message listener hasn't fired, treat as a soft cancel.
          if (pendingResolvers.current.length > 0) {
            pendingResolvers.current.shift()?.({ success: false });
          }
        }
      }, 1000);
    } catch {
      setError('Could not start Instagram connection. Check backend config.');
      setConnecting(false);
      pendingResolvers.current.shift()?.({ success: false });
      return { success: false };
    }
    return settled;
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await cmsApi.delete(INSTAGRAM_DISCONNECT);
    } catch {
      // Even if the backend call fails, clear local state so the UI is honest.
    }
    setConnected(false);
    setUsername('');
  }, []);

  // Listen for postMessage from /instagram-callback
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data?.type !== 'INSTAGRAM_OAUTH') return;
      popupRef.current?.close();
      popupRef.current = null;
      setConnecting(false);
      const success = e.data.status === 'success';
      if (success) {
        checkStatus();
      } else {
        setError('Instagram connection failed. Please try again.');
      }
      // Resolve any in-flight connect() promise.
      pendingResolvers.current.shift()?.({ success });
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [checkStatus]);

  return { connected, connecting, username, error, connect, disconnect, checkStatus };
}
