import type React from 'react';
import type { SerializableLine } from './types';
import Prefix from './Prefix';

type Props = {
  lines: SerializableLine[];
  messagesContainerRef: React.RefObject<HTMLDivElement>;
  messagesEndRef: React.RefObject<HTMLDivElement>;
};

export default function Stream({ lines, messagesContainerRef, messagesEndRef }: Props) {
  return (
    <div ref={messagesContainerRef} className="stream" aria-live="polite">
      {lines.map((line, lineIndex) => {
        // --- Sanitize segments for rendering ----------------------------------
        // Remove the ">" prefix from user messages, which is now handled by styling
        const cleanedSegments = line.source === 'user'
          ? line.segments.map(segment =>
              typeof segment === 'string' ? segment.replace(/^>\s*/, '') : segment
            )
          : line.segments;

        // Skip rendering empty lines
        if (cleanedSegments.every(seg => typeof seg === 'string' && seg.trim() === '')) {
          return null;
        }
        
        // --- Determine CSS classes for styling ------------------------------
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

        const messageType = line.source;
        const cssClasses = ['message-bubble', messageType, systemType && `system-${systemType}`].filter(Boolean).join(' ');

        return (
          <div key={lineIndex} className={cssClasses} data-message-type={messageType}>
            <div className="message-content">
              {cleanedSegments.map((segment, segmentIndex) => (
                typeof segment === 'string' ? (
                  <span key={segmentIndex}>{segment}</span>
                ) : (
                  <Prefix key={segmentIndex} />
                )
              ))}
            </div>
          </div>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
}


