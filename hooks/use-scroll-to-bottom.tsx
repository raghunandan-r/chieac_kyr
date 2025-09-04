import { useLayoutEffect, useRef, useEffect } from 'react';

export function useScrollToBottom<T extends HTMLElement>(
  dependency: any
): React.RefObject<T> {
  const containerRef = useRef<T>(null);
  const isScrolledToBottomRef = useRef(true);
  const lastStickStateRef = useRef<boolean | null>(null);
  const lastDependencyRef = useRef(dependency);

  // Track scroll position
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (container) {
      const handleScroll = () => {
        const { scrollTop, scrollHeight, clientHeight } = container;
        const atBottom = scrollHeight - scrollTop - clientHeight <= 1;
        if (lastStickStateRef.current !== atBottom) {
          // console.log(`[ScrollHook] user ${atBottom ? 'reached' : 'left'} bottom`);
          lastStickStateRef.current = atBottom;
        }
        isScrolledToBottomRef.current = atBottom;
      };
      container.addEventListener('scroll', handleScroll);
      handleScroll(); // Initial check on mount
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);

  // Auto-scroll when dependency changes
  useEffect(() => {
    if (dependency === lastDependencyRef.current) return;
    lastDependencyRef.current = dependency;

    const container = containerRef.current;
    if (!isScrolledToBottomRef.current || !container) return;

    // Wait one frame for paint
    requestAnimationFrame(() => {
      if (isScrolledToBottomRef.current && container) {
        const size = Array.isArray(dependency) ? dependency.length : undefined;
        // console.log('[ScrollHook] auto-scroll after update', size !== undefined ? `lines: ${size}` : '');
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      }
    });
  }, [dependency]);

  return containerRef;
}