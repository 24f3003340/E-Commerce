'use client';

import { useCallback, useEffect, useState } from 'react';

const KEY = 'sk_pincode';
const EVENT = 'sk:pincode';

/** Delivery pincode chosen by the shopper, shared between the header and product pages. */
export function usePincode() {
  const [pincode, setState] = useState<string | null>(null);

  useEffect(() => {
    const read = () => {
      try {
        setState(window.localStorage.getItem(KEY));
      } catch {
        setState(null);
      }
    };
    read();
    window.addEventListener(EVENT, read);
    return () => window.removeEventListener(EVENT, read);
  }, []);

  const setPincode = useCallback((value: string) => {
    try {
      window.localStorage.setItem(KEY, value);
    } catch {
      // ignore
    }
    setState(value);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { pincode, setPincode };
}
