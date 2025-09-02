import { useEffect, useRef, useState } from 'react';

export function useSpinnerStatus(busy: boolean, loadingTexts: string[]) {
  const [statusText, setStatusText] = useState('');
  const [startedStreaming, setStartedStreaming] = useState(false);
  const textIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (busy && !startedStreaming) {
      setStatusText(loadingTexts[0]);
      let textIdx = 0;
      textIntervalRef.current = window.setInterval(() => {
        textIdx = (textIdx + 1) % loadingTexts.length;
        setStatusText(loadingTexts[textIdx]);
      }, 1000);
    } else {
      if (textIntervalRef.current) {
        clearInterval(textIntervalRef.current);
        textIntervalRef.current = null;
      }
      setStatusText('');
    }

    return () => {
      if (textIntervalRef.current) {
        clearInterval(textIntervalRef.current);
        textIntervalRef.current = null;
      }
    };
  }, [busy, startedStreaming, loadingTexts]);

  return { statusText, startedStreaming, setStartedStreaming } as const;
}


