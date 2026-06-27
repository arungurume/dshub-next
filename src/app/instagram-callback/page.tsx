'use client';
import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function InstagramCallbackInner() {
  const searchParams = useSearchParams();
  const status = searchParams.get('status');

  useEffect(() => {
    if (typeof window !== 'undefined' && window.opener) {
      window.opener.postMessage(
        { type: 'INSTAGRAM_OAUTH', status: status === 'success' ? 'success' : 'error' },
        window.location.origin
      );
      window.close();
    }
  }, [status]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: 'sans-serif' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>📸</div>
      {status === 'success' ? (
        <>
          <p style={{ fontSize: 18, fontWeight: 600 }}>Instagram connected!</p>
          <p style={{ color: '#aaa', marginTop: 8 }}>This window will close automatically...</p>
        </>
      ) : (
        <>
          <p style={{ fontSize: 18, fontWeight: 600, color: '#e74c3c' }}>Connection failed.</p>
          <p style={{ color: '#aaa', marginTop: 8 }}>Please close this window and try again.</p>
        </>
      )}
    </div>
  );
}

export default function InstagramCallbackPage() {
  return (
    <Suspense>
      <InstagramCallbackInner />
    </Suspense>
  );
}
