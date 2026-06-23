'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketContextProps {
  socket: Socket | null;
  isConnected: boolean;
  connect: (queryProps: Record<string, string | number>) => void;
  disconnect: () => void;
  emit: (event: string, payload: any) => void;
}

const SocketContext = createContext<SocketContextProps | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const connect = useCallback((queryProps: Record<string, string | number>) => {
    // Disconnect if already connected
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_IO_SERVER_URL || 'http://127.0.0.1:9007';
    console.log('Connecting to Socket server:', socketUrl, 'with query:', queryProps);

    const newSocket = io(socketUrl, {
      transports: ['websocket'],
      query: queryProps,
    });

    newSocket.on('connect', () => {
      console.log('Socket connected successfully, ID:', newSocket.id);
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      setIsConnected(false);
    });

    socketRef.current = newSocket;
    setSocket(newSocket); // triggers re-render so consumers receive the live socket
  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
      console.log('Socket connection explicitly closed');
    }
  }, []);

  const emit = useCallback((event: string, payload: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, payload);
    } else {
      console.warn('Cannot emit event. Socket is not connected:', event);
    }
  }, []);

  // Auto-connect when user data is available
  useEffect(() => {
    // Read user from localStorage (set by admin layout on login)
    try {
      const storedUserStr = typeof window !== 'undefined' ? localStorage.getItem('currentUser') : null;
      if (storedUserStr) {
        const storedUser = JSON.parse(storedUserStr);
        const orgId = storedUser?.organization?.id;
        if (orgId && !socketRef.current) {
          connect({ orgId: String(orgId), source: 'admin-portal' });
        }
      }
    } catch {
      // Silently fail — socket is optional
    }
  }, [connect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected, connect, disconnect, emit }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocketContext = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocketContext must be used within a SocketProvider');
  }
  return context;
};

