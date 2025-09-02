import React, { useEffect } from 'react';

type CaretRefs = {
  inputRef: React.RefObject<HTMLInputElement>;
  measureStartRef: React.RefObject<HTMLSpanElement>;
  measureEndRef: React.RefObject<HTMLSpanElement>;
  caretRef: React.RefObject<HTMLSpanElement>;
  selectionRef: React.RefObject<HTMLSpanElement>;
};

type InputHistoryApi = {
  pushEntry: (text: string) => void;
  applyPrev: () => string | null;
  applyNext: () => string | null;
  clearInput: () => string;
};

type Props = {
  input: string;
  setInput: (v: string) => void;
  busy: boolean;
  spinnerChar: string;
  statusText: string;
  startedStreaming: boolean;
  onSubmit: (text: string) => void;
  inputHistoryApi: InputHistoryApi;
  refsFromCaretHook: CaretRefs;
  updateCaretAndSelection: () => void;
};

export default function InputBar({
  input,
  setInput,
  busy,
  spinnerChar,
  statusText,
  startedStreaming,
  onSubmit,
  inputHistoryApi,
  refsFromCaretHook,
  updateCaretAndSelection,
}: Props) {
  const { inputRef, measureStartRef, measureEndRef, caretRef, selectionRef } = refsFromCaretHook;

  // Ensure caret is positioned correctly on mount before any user interaction
  useEffect(() => {
    updateCaretAndSelection();
  }, [updateCaretAndSelection]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || busy) return;
    inputHistoryApi.pushEntry(input);
    const toSend = input;
    setInput('');
    onSubmit(toSend);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="row"
    >
      <div className="box">
        {busy ? (
          <span className="braille" aria-hidden>{spinnerChar || '⠋'}</span>
        ) : null}
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
          }}
          enterKeyHint="send"
          onKeyDown={(e) => {
            // update caret on navigation keys before React updates value
            requestAnimationFrame(updateCaretAndSelection);
            if (e.key === 'Enter') {
              e.preventDefault();
              if (!busy && input.trim()) {
                inputHistoryApi.pushEntry(input);
                const toSend = input;
                setInput('');
                onSubmit(toSend);
              }
              return;
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              const prev = inputHistoryApi.applyPrev();
              if (prev !== null) setInput(prev);
              return;
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              const next = inputHistoryApi.applyNext();
              if (next !== null) setInput(next);
              return;
            }
            if (e.ctrlKey && e.key.toLowerCase() === 'u') {
              e.preventDefault();
              setInput(inputHistoryApi.clearInput());
              return;
            }
          }}
          onClick={updateCaretAndSelection}
          onKeyUp={updateCaretAndSelection}
          onFocus={updateCaretAndSelection}
          className="inp"
          placeholder={busy && !startedStreaming && statusText ? statusText : 'How can I help?'}
          autoFocus
          disabled={busy}
          spellCheck={false}
        />
        <button
          type="submit"
          disabled={!input.trim() || busy}
          className="send-button"
          aria-label="Send message"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
        <span ref={measureStartRef} className="measure measure-start" aria-hidden>{input}</span>
        <span ref={measureEndRef} className="measure measure-end" aria-hidden>{input}</span>
        {!busy ? (
          <span ref={caretRef} className="fat-caret" />
        ) : (
          <span ref={caretRef} className="ghost-caret" />
        )}
        <span ref={selectionRef} className="sel" />
      </div>
    </form>
  );
}


