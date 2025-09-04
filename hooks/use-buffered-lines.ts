import { useRef } from 'react';
import { BUFFER_CAP } from '@/components/terminal/constants';
import type { MessageSource, PendingNode, SerializableLine, SerializableSegment } from '@/components/terminal/types';

type PendingItem = { source: MessageSource; node: PendingNode };

export function useBufferedLines(
  lines: SerializableLine[],
  setLines: React.Dispatch<React.SetStateAction<SerializableLine[]>>,
  totalCharsRef: React.MutableRefObject<number>
) {
  const pendingItemsRef = useRef<PendingItem[]>([]);
  const raf = useRef<number | null>(null);

  const flush = () => {
    if (raf.current != null) return;
    raf.current = requestAnimationFrame(doFlush);
  };

  const doFlush = () => {
    const pending = pendingItemsRef.current;
    pendingItemsRef.current = [];

    setLines(currentLines => {
      const newLines = [...currentLines];
      let currentLine: SerializableLine | undefined = newLines[newLines.length - 1];
      let isLineCloned = false; // Add a flag to prevent multiple clones of the same line

      for (const item of pending) {
        const { source, node } = item;

        if (node.type === 'prefix') {
          // Prefix always starts a new AI line
          currentLine = { source: 'ai', segments: [{ type: 'prefix' }] };
          newLines.push(currentLine);
          isLineCloned = true;
        } else if (node.type === 'text') {
          // If source changed or no current line, start a new one
          if (!currentLine || currentLine.source !== source) {
            currentLine = { source, segments: [] };
            newLines.push(currentLine);
            isLineCloned = true; // New lines don't need cloning
          } else if (!isLineCloned) {
            // Before mutating the last line, create a deep copy of it
            currentLine = { ...currentLine, segments: [...currentLine.segments] };
            newLines[newLines.length - 1] = currentLine;
            isLineCloned = true; // Mark as cloned for this flush cycle
          }

          const parts = node.value.split('\n');
          if (parts[0]) {
            currentLine.segments.push(parts[0]);
            totalCharsRef.current += parts[0].length;
          }
          for (let i = 1; i < parts.length; i++) {
            currentLine = { source, segments: [] };
            newLines.push(currentLine);
            isLineCloned = true; // New lines don't need cloning
            if (parts[i]) {
              currentLine.segments.push(parts[i]);
              totalCharsRef.current += parts[i].length;
            }
          }
        } else if (node.type === 'newline') {
          // console.log('[BUFFER] FLUSH newline before push');

             // Push a truly blank line …
             newLines.push({ source, segments: [] });
             // … and forget it so that the next text token starts its own line.
             currentLine = undefined;
             isLineCloned = false;
           }
      }

      // (Debug) Uncomment the line below to inspect buffered lines
      // console.log('[BUFFER] lines after flush:', newLines.map(l => ({ txt: l.segments.join(''), segments: l.segments })));

      while (totalCharsRef.current > BUFFER_CAP && newLines.length > 1) {
        const removedLine = newLines.shift()!;
        const removedChars = removedLine.segments.reduce((count: number, segment: SerializableSegment) => {
          return count + (typeof segment === 'string' ? segment.length : 0);
        }, 0);
        totalCharsRef.current -= removedChars;
      }
      return newLines;
    });

    raf.current = null;
  };

  const append = (source: MessageSource, node: PendingNode) => {
    // console.log('[BUFFER] queued:', node);

    pendingItemsRef.current.push({ source, node });
    flush();
  };
  
  const appendText = (source: MessageSource, text: string) => append(source, { type: 'text', value: text });
  // Prefix nodes are removed from rendering; keep API for compatibility but no-op
  const appendPrefix = () => {};
  const appendNewline = (source: MessageSource) => append(source, { type: 'newline' });
  const clear = () => {
    setLines([]);
    totalCharsRef.current = 0;
  };

  return { appendText, appendPrefix, appendNewline, clear } as const;
}


