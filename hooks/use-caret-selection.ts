import { useCallback, useRef } from 'react';

export function useCaretSelection() {
  const inputRef = useRef<HTMLInputElement>(null);
  const measureStartRef = useRef<HTMLSpanElement>(null);
  const measureEndRef = useRef<HTMLSpanElement>(null);
  const caretRef = useRef<HTMLSpanElement>(null);
  const selectionRef = useRef<HTMLSpanElement>(null);

  const updateCaretAndSelection = useCallback(() => {
    const inputEl = inputRef.current;
    if (!inputEl) return;
    const selStart = inputEl.selectionStart ?? inputEl.value.length;
    const selEnd = inputEl.selectionEnd ?? selStart;
    const baseLeftPx = 25; // retained as-is; optional step later can make this a CSS var
    const scrollLeft = inputEl.scrollLeft || 0;

    if (measureStartRef.current) {
      measureStartRef.current.textContent = inputEl.value.slice(0, selStart);
    }
    if (measureEndRef.current) {
      measureEndRef.current.textContent = inputEl.value.slice(0, selEnd);
    }

    const startWidth = measureStartRef.current?.offsetWidth ?? 0;
    const endWidth = measureEndRef.current?.offsetWidth ?? startWidth;

    if (caretRef.current) {
      caretRef.current.style.left = `${baseLeftPx + startWidth - scrollLeft}px`;
    }
    if (selectionRef.current) {
      const left = baseLeftPx + startWidth - scrollLeft;
      const width = Math.max(0, endWidth - startWidth);
      selectionRef.current.style.left = `${left}px`;
      selectionRef.current.style.width = `${width}px`;
      selectionRef.current.style.opacity = width > 0 ? '1' : '0';
    }
  }, []);

  return {
    inputRef,
    measureStartRef,
    measureEndRef,
    caretRef,
    selectionRef,
    updateCaretAndSelection,
  } as const;
}


