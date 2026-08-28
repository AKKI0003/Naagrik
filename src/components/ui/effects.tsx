import { useRef, type ReactNode } from 'react';
import { motion, useMotionTemplate, useMotionValue, type Variants } from 'framer-motion';

/**
 * Scroll-reveal wrapper — the "cards fade/slide in as they enter the
 * viewport" effect used throughout react-bits and Aceternity UI demos.
 * Wrap any element; it animates once, the first time it's scrolled
 * into view, and never again (so re-renders don't re-trigger it).
 */
export function Reveal({
  children,
  delay = 0,
  className = '',
  y = 14,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  y?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Stagger container: pair with <Reveal> children (or motion children
 * using `staggerItem` below) to cascade a list in one by one instead
 * of all at once — the same "list reveal" pattern react-bits' AnimatedList
 * and Aceternity's staggered grids use. */
export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06 },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

/**
 * Hover-spotlight card — a soft radial highlight that follows the
 * cursor, plus a subtle lift/scale, using CSS custom properties driven
 * by framer-motion's useMotionValue (the same technique behind
 * Aceternity's "Card Spotlight" and Magic UI's "Magic Card"). Purely a
 * visual wrapper — pass your existing card markup as `children` and
 * every click handler / prop on it keeps working exactly as before.
 */
export function SpotlightCard({
  children,
  className = '',
  style,
  spotlightColor = 'rgba(77, 217, 232, 0.16)',
  onClick,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  spotlightColor?: string;
  onClick?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(50);
  const mouseY = useMotionValue(50);
  const background = useMotionTemplate`radial-gradient(220px circle at ${mouseX}% ${mouseY}%, ${spotlightColor}, transparent 75%)`;

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set(((e.clientX - rect.left) / rect.width) * 100);
    mouseY.set(((e.clientY - rect.top) / rect.height) * 100);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onClick={onClick}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      whileTap={onClick ? { scale: 0.985 } : undefined}
      className={`relative overflow-hidden ${className}`}
      style={style}
    >
      <motion.div className="pointer-events-none absolute inset-0 z-0" style={{ background }} />
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}

/**
 * Magnetic hover — button/icon subtly follows the cursor within its
 * bounds and snaps back on leave (the "magnetic button" pattern from
 * react-bits / Cuberto-style agency sites). Wrap any clickable element;
 * onClick and all other props pass straight through untouched.
 */
export function Magnetic({
  children,
  className = '',
  strength = 14,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  strength?: number;
  onClick?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const relX = e.clientX - (rect.left + rect.width / 2);
    const relY = e.clientY - (rect.top + rect.height / 2);
    x.set((relX / rect.width) * strength);
    y.set((relY / rect.height) * strength);
  }

  function handleMouseLeave() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{ x, y }}
      transition={{ type: 'spring', stiffness: 150, damping: 12, mass: 0.2 }}
      className={`inline-flex ${className}`}
    >
      {children}
    </motion.div>
  );
}

/**
 * Animated active-tab pill — draws one shared pill that glides between
 * whichever nav item is active using framer-motion's shared layoutId,
 * instead of each item independently fading in a background. This is
 * the mechanic behind the "dynamic island" nav bar in DynamicIslandNav.
 * Drop it as an absolutely-positioned sibling behind the active item's
 * content inside a `position: relative` container.
 */
export function ActivePill({ layoutId, className = '' }: { layoutId: string; className?: string }) {
  return (
    <motion.div
      layoutId={layoutId}
      className={`absolute inset-0 -z-0 ${className}`}
      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
    />
  );
}
