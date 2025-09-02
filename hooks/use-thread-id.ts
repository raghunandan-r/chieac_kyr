import { useEffect, useRef } from 'react';
import { LOCALSTORAGE_KEYS } from '@/components/terminal/constants';

export function useThreadId() {
  const threadIdRef = useRef<string | null>(null);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(LOCALSTORAGE_KEYS.threadId) : null;
    if (stored) {
      threadIdRef.current = stored;
      return;
    }
    const newId = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);
    threadIdRef.current = newId;
    try {
      localStorage.setItem(LOCALSTORAGE_KEYS.threadId, newId);
    } catch {
      // ignore storage errors
    }
  }, []);

  return threadIdRef;
}


