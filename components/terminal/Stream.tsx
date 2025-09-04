import type React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm'; // new
import type { SerializableLine } from './types';

type Props = {
  lines: SerializableLine[];
};

export default function Stream({ lines }: Props) {
  // Group consecutive lines by source, preserving blank lines for Markdown
  const groups: { source: SerializableLine['source']; text: string; systemType?: string }[] = [];
  let current: { source: SerializableLine['source']; text: string; systemType?: string } | null = null;

  for (const line of lines) {

    // console.log('[STREAM] raw line:', line);


    const cleanedSegments = line.source === 'user'
      ? line.segments.map(segment => (typeof segment === 'string' ? segment.replace(/^>\s*/, '') : segment))
      : line.segments;

    const lineText = cleanedSegments.filter(seg => typeof seg === 'string').join('');

    let systemType = '';
    if (line.source === 'system') {
      const firstStr = cleanedSegments.find(seg => typeof seg === 'string') as string | undefined;
      if (firstStr) {
        if (firstStr.startsWith('[Error:')) systemType = 'error';
        else if (firstStr.startsWith('[Stream timeout:')) systemType = 'timeout';
        else if (firstStr.startsWith('[Backend service unavailable:')) systemType = 'service-error';
        else if (firstStr.startsWith('[END_OF_STREAM]')) systemType = 'end-stream';
      }
    }

    const canGroup = line.source !== 'system';

    if (canGroup && current && current.source === line.source) {
      // The stream sends an empty or whitespace-only line to signal a paragraph break.
      if (lineText.trim() === '') {
        current.text += '\n\n';
      } else {
        // Heuristic: Re-add spaces between word tokens, but not before punctuation.
        const isListMarker = lineText.trim() === '-';
        const isPunctuationOrMarker = isListMarker || /^[.,:;!?\)**]+$/.test(lineText.trim());
        // If we are about to add a list marker but the current text does not already end
        // with a paragraph break, force one so Markdown recognises the list.
        if (isListMarker && !/\n\n$/.test(current.text)) {
          current.text += '\n\n';
        }
        const needsSpace = current.text && !/\s$/.test(current.text) && !isPunctuationOrMarker;
        
        if (needsSpace) {
          current.text += ' ';
        }
        current.text += lineText;
      }
    } else {
      current = { source: line.source, text: lineText, systemType };
      groups.push(current);
    }

    // After we have current.text and lineText
    const isBareDash = lineText.trim() === '-';
    if (isBareDash) {
      // If current.text ends with punctuation but not double-newline,
      // insert a forced break.
      if (!/\n\n$/.test(current.text)) {
        current.text = current.text.replace(/\s*$/, ''); // trim trailing space
        current.text += '\n\n';
      }
    }
  }

  // console.log('[STREAM] final groups:', groups.map(g => ({ src:g.source, text:g.text.slice(0,80) })));

  return (
    <div className="stream" aria-live="polite">
      {groups.map((g, idx) => {
        const cssClasses = ['message-bubble', g.source, g.systemType && `system-${g.systemType}`].filter(Boolean).join(' ');
        return (
          <div key={idx} className={cssClasses} data-message-type={g.source}>
            <div className="message-content">
              {g.source === 'user' ? (
                <span>{g.text}</span>
              ) : (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    a: ({ node, ...props }) => (
                      <a {...props} target="_blank" rel="noopener noreferrer" />
                    ),
                  }}
                >
                  {g.text}
                </ReactMarkdown>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}