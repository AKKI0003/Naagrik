import { useEffect } from 'react';
import Lenis from 'lenis';

/**
 * Global smooth/inertia scrolling via studio-freight's Lenis
 * (https://github.com/darkroomengineering/lenis) — the library
 * behind the buttery scroll feel on most modern marketing sites.
 * Mount once near the app root; it hijacks the native scroll of
 * `document` and drives it with its own RAF-based easing, then
 * cleans itself up on unmount.
 */
export function useLenis() {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.1,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    function raf(time: number) {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    }
    let frame = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, []);
}
