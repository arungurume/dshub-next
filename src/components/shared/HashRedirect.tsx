'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export const HashRedirect: React.FC = () => {
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      // Clean up the leading # and #/
      const hashPath = window.location.hash.replace(/^#\/?/, '/');
      console.log('Legacy Angular hash route detected:', window.location.hash, 'redirecting to:', hashPath);
      
      // Perform immediate replace redirection
      router.replace(hashPath);
    }
  }, [router]);

  return null;
};
export default HashRedirect;
