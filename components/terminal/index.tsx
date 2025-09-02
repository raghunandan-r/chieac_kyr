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
import { useCaretSelection } from '@/hooks/use-caret-selection';
import { useChatStream } from '@/hooks/use-chat-stream';
import { useScrollToBottom } from '@/hooks/use-scroll-to-bottom';
import { useInputHistory } from '@/hooks/use-input-history';

export default function Terminal() {
  const [messagesContainerRef, messagesEndRef] = useScrollToBottom<HTMLDivElement>();
  const [input, setInput] = useState('');
  const [spinnerChar, setSpinnerChar] = useState(spinnerFrames[0]);

  const threadIdRef = useThreadId();
  const { lines, setLines, totalCharsRef } = useTerminalHistory();
  const { appendText, appendPrefix, appendNewline } = useBufferedLines(lines, setLines, totalCharsRef);
  const [busyForSpinner, setBusyForSpinner] = useState(false);
  const spinner = useSpinnerStatus(busyForSpinner, loadingTexts);
  const caret = useCaretSelection();
  const { busy, send } = useChatStream({
    appendText,
    appendPrefix,
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

  // Ensure focus returns to input after streaming completes
  useEffect(() => {
    if (!busy) requestAnimationFrame(() => caret.inputRef.current?.focus());
  }, [busy, caret.inputRef]);

  return (
    <div className="shell">
      <div className="window">
        <Titlebar />
        <div className="term">
          <Intro />
          <Stream lines={lines} messagesContainerRef={messagesContainerRef} messagesEndRef={messagesEndRef} />
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
          refsFromCaretHook={caret}
          updateCaretAndSelection={caret.updateCaretAndSelection}
        />
      </div>
    </div>
  );
}


