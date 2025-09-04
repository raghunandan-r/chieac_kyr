'use client';
import { useEffect, useState } from 'react';
import Titlebar from './Titlebar';
import Intro from './Intro';
import Stream from './Stream';
import InputBar from './Input';
import { spinnerFrames, loadingTexts } from './constants';
import { useThreadId } from '@/hooks/use-thread-id';
import { useTerminalHistory } from '@/hooks/use-terminal-history';
import { useBufferedLines } from '@/hooks/use-buffered-lines';
import { useSpinnerStatus } from '@/hooks/use-spinner-status';
import { useChatStream } from '@/hooks/use-chat-stream';
import { useScrollToBottom } from '@/hooks/use-scroll-to-bottom';
import { useInputHistory } from '@/hooks/use-input-history';
import { useLayoutEffect, useRef } from 'react';


export default function Terminal() {
  
  const [input, setInput] = useState('');
  const [spinnerChar, setSpinnerChar] = useState(spinnerFrames[0]);

  const threadIdRef = useThreadId();
  const { lines, setLines, totalCharsRef } = useTerminalHistory();
  // ↓ reference changes every time because we *always* create a new array:
  const safeLines = [...lines];           // one-liner guarantee
  const containerRef = useScrollToBottom<HTMLDivElement>(safeLines);

  const { appendText, appendNewline } = useBufferedLines(lines, setLines, totalCharsRef);
  const [busyForSpinner, setBusyForSpinner] = useState(false);
  const spinner = useSpinnerStatus(busyForSpinner, loadingTexts);
  // Native input caret only; caret-selection overlay removed
  const { busy, send } = useChatStream({
    appendText,
    appendNewline,
    setStartedStreaming: spinner.setStartedStreaming,
    threadIdRef,
  });
  const inputHistoryApi = useInputHistory();

  // Keep spinner hook in sync with busy state
  useEffect(() => {
    setBusyForSpinner(busy);
  }, [busy]);
  
  // Spinner animation effect
  useEffect(() => {
    if (busy) {
      const interval = setInterval(() => {
        setSpinnerChar(prev => spinnerFrames[(spinnerFrames.indexOf(prev) + 1) % spinnerFrames.length]);
      }, 80);
      return () => clearInterval(interval);
    }
  }, [busy]);

  // Input component manages focus itself when not busy

  return (
    <div className="shell">
      <div className="window">
        <Titlebar />
        <div className="term" ref={containerRef}>
          <div className="term-bg" aria-hidden="true" />
          <Intro />
          <Stream lines={safeLines} />
        </div>
        <InputBar
          input={input}
          setInput={setInput}
          busy={busy}
          spinnerChar={spinnerChar}
          statusText={spinner.statusText}
          startedStreaming={spinner.startedStreaming}
          onSubmit={send}
          inputHistoryApi={inputHistoryApi}
        />
      </div>
    </div>
  );
}


