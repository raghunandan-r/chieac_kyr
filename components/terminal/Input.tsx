import React, { useEffect, useRef } from 'react';

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
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Return focus to input when not busy
  useEffect(() => {
    if (!busy) inputRef.current?.focus();
  }, [busy]);

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
      </div>
    </form>
  );
}


