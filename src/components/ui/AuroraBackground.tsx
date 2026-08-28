import { motion } from 'framer-motion';

/**
 * Layered mesh-gradient + film-grain background — the same family of
 * effect as the Igloo / Salomon Ligthelm references (moody radial
 * light pools, faint noise texture over dark backgrounds), built with
 * only what's already in package.json (framer-motion + Tailwind), so
 * it doesn't add a dependency.
 *
 * Three ingredients that separate this from a "flat gradient div":
 *  1. Multiple overlapping blurred shapes at different sizes/speeds
 *     (parallax-by-timing, not by scroll) instead of one big blob.
 *  2. A film-grain overlay (inline SVG feTurbulence, no image asset)
 *     — this is the single biggest "someone designed this" cue; flat
 *     gradients read as AI-generated, grain reads as intentional.
 *  3. A vignette to pull focus back to center content.
 */
export function AuroraBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 hidden overflow-hidden md:block">
      <motion.div
        className="absolute -left-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-cyan/12 blur-[110px]"
        animate={{ x: [0, 60, -20, 0], y: [0, 40, -30, 0], scale: [1, 1.08, 0.96, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-52 -right-32 h-[36rem] w-[36rem] rounded-full bg-gold/10 blur-[120px]"
        animate={{ x: [0, -50, 30, 0], y: [0, -30, 40, 0], scale: [1, 0.94, 1.05, 1] }}
        transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute left-1/3 top-1/4 h-[24rem] w-[24rem] rounded-full bg-cyanDark/10 blur-[100px]"
        animate={{ x: [0, 30, -40, 0], y: [0, -20, 20, 0] }}
        transition={{ duration: 30, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* A fourth, smaller/faster point of light — without it the
          composition reads as two big soft blobs sitting in corners,
          which is the exact "default aurora template" look. This one
          drifts on a shorter, less symmetric path. */}
      <motion.div
        className="absolute right-1/4 top-1/2 h-[16rem] w-[16rem] rounded-full bg-white/[0.04] blur-[90px]"
        animate={{ x: [0, -25, 15, 0], y: [0, 25, -15, 0], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Film grain — inline SVG turbulence filter, tiled via CSS.
          Rendered once, cheap to keep static (no per-frame re-generation,
          that would tank perf) — the grain texture alone reads as
          "designed," it doesn't need to animate to do its job. */}
      <svg className="absolute inset-0 h-0 w-0">
        <filter id="nagrik-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.02 0" />
        </filter>
      </svg>
      <div
        className="absolute inset-0 mix-blend-overlay"
        style={{ filter: 'url(#nagrik-grain)', opacity: 0.35 }}
      />

      {/* Vignette — pulls the eye back to center content instead of
          the light pools competing with the UI on top of them. */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent,rgba(11,15,20,0.65))]" />
    </div>
  );
}
