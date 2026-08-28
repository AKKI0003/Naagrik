import { useState } from 'react';
import { Sidebar, Menu, MenuItem } from 'react-pro-sidebar';
import { motion, AnimatePresence } from 'framer-motion';
import { NAV_ITEMS, type TabKey } from './navItems';
import { NAV_ICONS } from './navIcons';

interface Props {
  active: TabKey;
  onChange: (tab: TabKey) => void;
  pendingCount?: number;
  isModerator?: boolean;
}

const NAGRIK_MARK = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4DD9E8" strokeWidth="2">
    <path d="M12 2L3 7v6c0 5 3.8 8.7 9 9 5.2-.3 9-4 9-9V7l-9-5z" strokeLinejoin="round" />
  </svg>
);

/**
 * Desktop-only navigation rail built on react-pro-sidebar
 * (https://github.com/azouaoui-med/react-pro-sidebar), themed to match
 * the app's glass-panel look. Rather than an inline collapse chevron,
 * the whole rail is toggled by a fixed floating NAGRIK badge pinned to
 * the top-left of the viewport (position: fixed, survives the sidebar
 * being fully closed) — clicking it slides the sidebar open/shut via
 * framer-motion's width animation instead of react-pro-sidebar's own
 * collapsed (icon-rail) mode, so "closed" means fully off-canvas.
 */
export function DesktopSidebar({ active, onChange, pendingCount = 0, isModerator = false }: Props) {
  const [open, setOpen] = useState(true);
  const visibleItems = NAV_ITEMS.filter((item) => item.key !== 'moderate' || isModerator);

  return (
    <>
      {/* Fixed floating toggle — always on top, always in the same spot,
          whether the sidebar is open or fully collapsed. */}
      <motion.button
        onClick={() => setOpen((o) => !o)}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        className="fixed left-4 top-4 z-[1200] hidden h-10 w-10 items-center justify-center rounded-full border border-cyanDark/40 bg-panel/80 shadow-[0_4px_20px_rgba(0,0,0,0.45)] backdrop-blur-xl md:flex"
        aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
        aria-expanded={open}
      >
        <motion.span animate={{ rotate: open ? 0 : 180 }} transition={{ type: 'spring', stiffness: 260, damping: 22 }}>
          {NAGRIK_MARK}
        </motion.span>
      </motion.button>

      <motion.div
        initial={false}
        animate={{ width: open ? 240 : 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 30 }}
        className="hidden shrink-0 overflow-hidden md:block"
      >
        <Sidebar
          width="240px"
          backgroundColor="transparent"
          rootStyles={{ border: 'none', height: '100%' }}
          className="!h-full !border-r !border-cyanDark/20 !bg-panel/50 backdrop-blur-xl"
        >
          <div className="flex h-full flex-col">
            {/* Left blank to clear the floating toggle badge above it */}
            <div className="h-16 shrink-0" />

            <Menu
              menuItemStyles={{
                button: ({ active: isActive }) => ({
                  borderRadius: 12,
                  margin: '2px 12px',
                  padding: '10px 12px',
                  color: isActive ? '#fff' : '#8B96AC',
                  background: isActive
                    ? 'linear-gradient(90deg, rgba(77,217,232,0.16), rgba(77,217,232,0.02))'
                    : 'transparent',
                  transition: 'all .18s ease',
                  '&:hover': {
                    background: 'rgba(77,217,232,0.08)',
                    color: '#fff',
                  },
                }),
              }}
            >
              {visibleItems.map((item) => {
                const Icon = NAV_ICONS[item.key];
                const isActive = active === item.key;
                return (
                  <MenuItem
                    key={item.key}
                    active={isActive}
                    onClick={() => onChange(item.key)}
                    icon={
                      <div className="relative">
                        <Icon size={19} color={isActive ? '#4DD9E8' : '#8B96AC'} />
                        {isActive && (
                          <motion.div
                            layoutId="desktop-sidebar-glow"
                            className="absolute -inset-2 -z-10 rounded-full bg-cyan/25 blur-md"
                            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                          />
                        )}
                      </div>
                    }
                    suffix={
                      item.key === 'moderate' && pendingCount > 0 ? (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1.5 text-[10px] font-bold text-bg">
                          {pendingCount}
                        </span>
                      ) : undefined
                    }
                  >
                    <span className="whitespace-nowrap text-[13.5px] font-semibold">{item.label}</span>
                  </MenuItem>
                );
              })}
            </Menu>

            <AnimatePresence>
              {open && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mt-auto whitespace-nowrap px-5 py-4 text-[11px] text-mutedDark"
                >
                  Track 04 · Social Impact
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Sidebar>
      </motion.div>
    </>
  );
}
