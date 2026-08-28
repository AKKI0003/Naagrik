import { motion, AnimatePresence } from 'framer-motion';
import { NAV_ITEMS, type TabKey } from './navItems';
import { ActivePill } from '../ui/effects';

interface Props {
  active: TabKey;
  onChange: (tab: TabKey) => void;
  pendingCount?: number;
  isModerator?: boolean;
}

/**
 * Mobile navigation styled as an iOS "Dynamic Island": a floating,
 * pill-shaped capsule that hugs the bottom of the screen instead of a
 * full-width bar. The capsule morphs its width based on how many tabs
 * are visible (layout animation), the active tab gets a sliding
 * highlight pill (shared layoutId, react-bits "AnimatedTabs" pattern),
 * and a small label pops in next to the active icon. Pure presentation
 * — same NAV_ITEMS, same onChange contract as the old bottom nav.
 */
export function DynamicIslandNav({ active, onChange, pendingCount = 0, isModerator = false }: Props) {
  const visibleItems = NAV_ITEMS.filter((item) => item.key !== 'moderate' || isModerator);

  return (
    <motion.nav
      layout
      className="glass-panel fixed inset-x-0 bottom-3 z-[1000] mx-auto flex w-fit items-center gap-1 rounded-full border border-cyanDark/30 px-2 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.45)] md:hidden"
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
    >
      {visibleItems.map((item) => {
        const isActive = active === item.key;
        const color = isActive ? '#0B0F14' : '#8B96AC';
        return (
          <motion.button
            key={item.key}
            layout
            onClick={() => onChange(item.key)}
            whileTap={{ scale: 0.92 }}
            className="relative flex items-center gap-1.5 rounded-full px-3 py-2"
          >
            {isActive && <ActivePill layoutId="dynamic-island-pill" className="rounded-full bg-cyan" />}
            <span className="relative z-10 flex items-center gap-1.5">
              {item.icon(color)}
              <AnimatePresence initial={false}>
                {isActive && (
                  <motion.span
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 'auto', opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden whitespace-nowrap text-[11px] font-bold"
                    style={{ color }}
                  >
                    {item.label === 'My Reports' ? 'Reports' : item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </span>
            {item.key === 'moderate' && pendingCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 z-20 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-gold px-1 text-[8px] font-bold text-bg">
                {pendingCount}
              </span>
            )}
          </motion.button>
        );
      })}
    </motion.nav>
  );
}
