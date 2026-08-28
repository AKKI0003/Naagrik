import { useRef, useState } from 'react';

/**
 * Cursor-following radial glow behind card content — the "Spotlight"
 * pattern from Aceternity UI, reimplemented directly (no copy-pasted
 * code, just the same idea) with plain CSS custom properties instead
 * of a canvas: a radial-gradient positioned at the pointer's x/y via
 * --x/--y, updated on pointer move. Cheap (no re-render — the values
 * are written straight to the DOM node's style, not React state), and
 * degrades gracefully to a static centered glow on touch devices
 * (no pointermove events firing).
 */
export function Spotlight({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  function handleMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--spotlight-x', `${e.clientX - rect.left}px`);
    el.style.setProperty('--spotlight-y', `${e.clientY - rect.top}px`);
  }

  return (
    <div
      ref={ref}
      onPointerMove={handleMove}
      onPointerEnter={() => setActive(true)}
      onPointerLeave={() => setActive(false)}
      className={`relative ${className}`}
      style={{ '--spotlight-x': '50%', '--spotlight-y': '30%' } as React.CSSProperties}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] transition-opacity duration-300"
        style={{
          opacity: active ? 1 : 0.55,
          background:
            'radial-gradient(600px circle at var(--spotlight-x) var(--spotlight-y), rgba(77,217,232,0.14), transparent 60%)',
        }}
      />
      {children}
    </div>
  );
}
