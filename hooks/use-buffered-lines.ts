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

      for (const item of pending) {
        const { source, node } = item;

        if (node.type === 'prefix') {
          // Prefix always starts a new AI line
          currentLine = { source: 'ai', segments: [{ type: 'prefix' }] };
          newLines.push(currentLine);
        } else if (node.type === 'text') {
          // If source changed or no current line, start a new one
          if (!currentLine || currentLine.source !== source) {
            currentLine = { source, segments: [] };
            newLines.push(currentLine);
          }

          const parts = node.value.split('\n');
          if (parts[0]) {
            currentLine.segments.push(parts[0]);
            totalCharsRef.current += parts[0].length;
          }
          for (let i = 1; i < parts.length; i++) {
            currentLine = { source, segments: [] };
            newLines.push(currentLine);
            if (parts[i]) {
              currentLine.segments.push(parts[i]);
              totalCharsRef.current += parts[i].length;
            }
          }
        } else if (node.type === 'newline') {
          currentLine = { source, segments: [] };
          newLines.push(currentLine);
        }
      }

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
    pendingItemsRef.current.push({ source, node });
    flush();
  };
  
  const appendText = (source: MessageSource, text: string) => append(source, { type: 'text', value: text });
  const appendPrefix = () => append('ai', { type: 'prefix' });
  const appendNewline = (source: MessageSource) => append(source, { type: 'newline' });
  const clear = () => {
    setLines([]);
    totalCharsRef.current = 0;
  };

  return { appendText, appendPrefix, appendNewline, clear } as const;
}


