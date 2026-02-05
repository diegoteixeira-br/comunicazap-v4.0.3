import { useEffect, useCallback, useState } from 'react';

const RECAPTCHA_SITE_KEY = '6LfBq2EsAAAAAN2PivNUXH6XVDgyDowRWYJZO8B7';

declare global {
  interface Window {
    grecaptcha: {
      enterprise: {
        ready: (callback: () => void) => void;
        execute: (siteKey: string, options: { action: string }) => Promise<string>;
      };
    };
  }
}

export const useRecaptcha = () => {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Check if script is already loaded
    if (window.grecaptcha?.enterprise) {
      setIsLoaded(true);
      return;
    }

    // Check if script is already in DOM
    const existingScript = document.querySelector(
      `script[src*="recaptcha/enterprise.js"]`
    );
    
    if (existingScript) {
      window.grecaptcha?.enterprise?.ready(() => {
        setIsLoaded(true);
      });
      return;
    }

    // Load the script
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/enterprise.js?render=${RECAPTCHA_SITE_KEY}`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      window.grecaptcha.enterprise.ready(() => {
        setIsLoaded(true);
      });
    };

    document.head.appendChild(script);

    return () => {
      // Cleanup is optional - script stays loaded
    };
  }, []);

  const executeRecaptcha = useCallback(async (action: string): Promise<string | null> => {
    if (!window.grecaptcha?.enterprise) {
      console.error('reCAPTCHA not loaded');
      return null;
    }

    try {
      const token = await window.grecaptcha.enterprise.execute(RECAPTCHA_SITE_KEY, { action });
      return token;
    } catch (error) {
      console.error('Error executing reCAPTCHA:', error);
      return null;
    }
  }, []);

  return { executeRecaptcha, isLoaded };
};
