import { useEffect, useRef, type ReactNode } from 'react';
import Lenis from 'lenis';

/**
 * Same Lenis engine as useLenis, but scoped to one scrollable panel
 * instead of the whole document — Lenis's documented "custom
 * scroll container" mode (wrapper/content options), used for the
 * app's internal scroll panels (Account, My Reports, etc.) which
 * scroll independently inside the shell rather than the page itself.
 */
export function SmoothScrollArea({ children, className = '' }: { children: ReactNode; className?: string }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!wrapperRef.current || !contentRef.current) return;

    const lenis = new Lenis({
      wrapper: wrapperRef.current,
      content: contentRef.current,
      duration: 1,
      smoothWheel: true,
    });

    let frame: number;
    function raf(time: number) {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    }
    frame = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, []);

  return (
    <div ref={wrapperRef} className={className}>
      <div ref={contentRef}>{children}</div>
    </div>
  );
}
