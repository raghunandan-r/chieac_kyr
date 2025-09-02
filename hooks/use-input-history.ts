import { useRef } from 'react';

export function useInputHistory() {
  const historyRef = useRef<string[]>([]);
  const histIdxRef = useRef<number>(-1);

  const pushEntry = (text: string) => {
    historyRef.current.unshift(text);
    histIdxRef.current = -1;
  };

  const applyPrev = (): string | null => {
    if (historyRef.current.length === 0) return null;
    histIdxRef.current = Math.min(histIdxRef.current + 1, historyRef.current.length - 1);
    return historyRef.current[histIdxRef.current] ?? null;
  };

  const applyNext = (): string | null => {
    if (histIdxRef.current > 0) {
      histIdxRef.current -= 1;
      return historyRef.current[histIdxRef.current] ?? '';
    }
    histIdxRef.current = -1;
    return '';
  };

  const clearInput = () => '';

  return { historyRef, histIdxRef, pushEntry, applyPrev, applyNext, clearInput } as const;
}


