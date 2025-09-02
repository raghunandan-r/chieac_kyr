import { useRef, useState } from 'react';
import type { MessageSource } from '@/components/terminal/types';

const STREAM_TIMEOUT_MS = 15000; // 15 seconds

type SendDeps = {
  appendText: (source: MessageSource, t: string) => void;
  appendPrefix: () => void;
  appendNewline: (source: MessageSource) => void;
  setStartedStreaming: (v: boolean) => void;
  threadIdRef: React.MutableRefObject<string | null>;
};

export function useChatStream({ appendText, appendPrefix, appendNewline, setStartedStreaming, threadIdRef }: SendDeps) {
  const [busy, setBusy] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const streamIdRef = useRef<string | null>(null); // To store the unique ID for recovery

  /**
   * Resets the inactivity watchdog timeout.
   */
  function resetTimeout() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => {
      if (controllerRef.current) {
        console.log(`Client timeout: No data received for ${STREAM_TIMEOUT_MS}ms.`);
        controllerRef.current.abort('timeout');
      }
    }, STREAM_TIMEOUT_MS);
  }

  /**
   * A reusable function to read from a ReadableStream and process the SSE chunks.
   * This logic is used for both the initial request and any recovery attempts.
   * @param reader The stream reader to pull data from.
   * @param isRecovery A flag to indicate if this is a recovery attempt, to prevent re-printing the prefix.
   */
  async function readStream(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    isRecovery = false
  ) {
    const decoder = new TextDecoder();
    let buf = '';
    let streamStarted = false;

    for (;;) {
      const { done, value } = await reader.read();

      // This block detects the first chunk of data has arrived.
      if (!streamStarted && value) {
        streamStarted = true;
        setStartedStreaming(true);
        // Only add the prompt prefix on the initial message, not on recovery.
        if (!isRecovery) {
          appendPrefix();
        }
      }

      if (done) {
        // Handle any remaining partial chunk
        // console.log('STREAM_DONE at ', Date.now());
        const remaining = decoder.decode(undefined, { stream: false });
        if (remaining) appendText('ai', remaining);
        // console.log('CALLING setBusy(false) at ', Date.now());
        setBusy(false);
        // console.log('setBusy FALSE at ', Date.now());
        break;
      }

      // Decode the chunk and process it line-by-line for SSE messages.
      buf += decoder.decode(value, { stream: true });
      for (;;) {
        const i = buf.indexOf('\n');
        if (i < 0) break;
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line) continue;
        if (line.startsWith('data:')) {
          try {
            const chunk = String(line.slice(6));
            if (chunk) {
              // Add graceful error handling here
              if (chunk.startsWith('[Error:')) {
                // Handle backend validation errors (e.g., malicious content)
                appendText('system', chunk);
                appendNewline('system');
                setBusy(false);
                return; // End the stream gracefully
              } else if (chunk.startsWith('[Stream timeout:')) {
                // Handle backend timeout gracefully
                appendText('system', chunk);
                appendNewline('system');
                setBusy(false);
                return; // End the stream gracefully
              } else if (chunk.startsWith('[Backend service unavailable:')) {
                // Handle backend service issues gracefully
                appendText('system', chunk);
                appendNewline('system');
                setBusy(false);
                return; // End the stream gracefully
              } else if (chunk === '[END_OF_STREAM]') {
                // Normal end of stream
                setBusy(false);
                return; // End the stream gracefully
              } else {
                // Regular content - display normally
                appendText('ai', chunk);
              }
            }      
          } catch {
            // ignore bad chunk
          }
        }
      }
    }
  }

  /**
   * This function is called when a timeout is detected. It attempts to reconnect
   * to the stream using the `/api/recover` endpoint.
   * @param threadId The ID of the chat thread to recover.
   */
  async function recoverStream(streamId: string) {
    appendText('system', '\n... ');
    
    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      // Call the new GET endpoint for recovery using the unique stream_id.
      const res = await fetch(`/api/recover/${streamId}`, {
        method: 'GET',
        headers: { 'Accept': 'text/event-stream' },
        signal: controller.signal,
        cache: 'no-store',
      });

      if (!res.ok || !res.body) {
        throw new Error(`Recovery failed: ${res.status}`);
      }
      
      // appendText('[recovery successful, resuming stream...]\n');
      const reader = res.body.getReader();
      // Reuse the same stream reading logic.
      await readStream(reader, true);
      appendNewline('ai');

    } catch (err) {
      appendText('system', '[recovery failed.]');
      appendNewline('system');
      throw err; // Re-throw to be caught by the final handler
    }
  }


  async function send(msg: string) {
    setBusy(true);
    setStartedStreaming(false);
    appendNewline('user');
    appendText('user', `> ${msg}`);
    appendNewline('ai');

    const controller = new AbortController();
    controllerRef.current = controller;

    // Start the watchdog timer. It will be reset each time data arrives.
    resetTimeout();

    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
        
    try {
      const res = await fetch('/api/chat?protocol=data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
        body: JSON.stringify({
          content: msg,
          thread_id: threadIdRef.current
        }),
        signal: controller.signal,
        cache: 'no-store',
      });

      // After fetch, before reading body, get the unique stream ID from the header.
      const streamId = res.headers.get('X-Stream-Id');
      if (streamId) {
        streamIdRef.current = streamId;
        // console.log(`Received unique stream ID for this request: ${streamId}`);
      } else {
        console.warn('Did not receive a stream ID from the server. Recovery may fail.');
      }

      if (!res.ok || !res.body) {
        const errorText = await res.text();
        throw new Error(`Server error: ${res.status} ${res.statusText}${errorText ? ` - ${errorText}` : ''}`);
      }
      
      reader = res.body.getReader();

      // This is the watchdog implementation. We create a proxy reader that resets
      // the timeout on every read, without modifying the original readStream function.
      const watchdogReader: ReadableStreamDefaultReader<Uint8Array> = {
        read: async () => {
          resetTimeout(); // Reset timer before waiting for the next chunk.
          return reader!.read();
        },
        cancel: () => reader!.cancel(),
        closed: reader!.closed,
        releaseLock: () => reader!.releaseLock(),
      };

      await readStream(watchdogReader);
      
      appendNewline('ai');
    } catch (err: any) {
      // console.log('🔍 STREAM ERROR at', Date.now(), 'error:', err);

      // Check if the error was a timeout and if we have a unique stream_id to recover.
      const isTimeout = err?.name === 'AbortError' && controllerRef.current?.signal.reason === 'timeout';
      
      if (isTimeout && streamIdRef.current) {
        // console.log('🔍 FRONTEND TIMEOUT TRIGGERED - attempting recovery.');
        try {
          // Attempt to recover the stream using the correct stream_id.
          await recoverStream(streamIdRef.current);
          setBusy(false); // Recovery was successful, so we are no longer busy.
          return; // Exit here, preventing the generic error message.
        } catch (recoveryErr) {
          // console.log('🔍 RECOVERY FAILED:', recoveryErr);
          // If recovery fails, we fall through to the generic error handling below.
        }
      }
      
      setBusy(false);

      if (err?.name === 'AbortError') {
        // Timeout is handled by recoverStream now, this is for user cancellation.
        appendText('system', '^C');
        appendNewline('system');
      } else {
        appendNewline('system');
        appendText('system', err?.message || '[error connecting to chieac\'s ai]');
        appendNewline('system');
      }

    } finally {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      if (reader) {
        try {
          await reader.cancel();
        } catch {
          // Ignore reader cleanup errors
        }
      }
      
      controllerRef.current = null;
    }
  }

  return { busy, send } as const;  
}


