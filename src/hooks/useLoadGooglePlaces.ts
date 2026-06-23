import { useState, useEffect } from 'react';

export const useLoadGooglePlaces = () => {
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if script is already present
    if (typeof window === 'undefined') return;
    if ((window as any).google?.maps?.places) {
      setIsLoaded(true);
      return;
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
    if (!apiKey) {
      setError('Google Maps API key is missing');
      return;
    }

    // Check if script element already exists in document
    const scriptId = 'google-maps-places-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement;

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;

      script.onload = () => {
        setIsLoaded(true);
      };

      script.onerror = () => {
        setError('Failed to load Google Maps Places script');
      };

      document.body.appendChild(script);
    } else {
      // Script is already in DOM, wait for onload
      const checkLoaded = setInterval(() => {
        if ((window as any).google?.maps?.places) {
          setIsLoaded(true);
          clearInterval(checkLoaded);
        }
      }, 100);

      // Timeout safety
      setTimeout(() => {
        clearInterval(checkLoaded);
        if (!(window as any).google?.maps?.places) {
          setError('Timeout loading Google Maps Places script');
        }
      }, 10000);
    }
  }, []);

  return { isLoaded, error };
};
export default useLoadGooglePlaces;
