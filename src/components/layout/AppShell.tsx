import type { ReactNode } from 'react';
import type { TabKey } from './navItems';
import { DesktopSidebar } from './DesktopSidebar';
import { DynamicIslandNav } from './DynamicIslandNav';
import { AuroraBackground } from '../ui/AuroraBackground';

interface Props {
  active: TabKey;
  onChange: (tab: TabKey) => void;
  pendingCount?: number;
  isModerator?: boolean;
  children: ReactNode;
}

/**
 * Responsive by breakpoint, not by squeezing one layout: below `md`,
 * a fixed bottom nav (thumb-reachable, standard mobile pattern);
 * `md` and up, a persistent left sidebar with labels (a bottom nav
 * stretched across a desktop window looks exactly like an unconverted
 * mobile app, which is the "optimize for all devices" ask). Both read
 * from the same NAV_ITEMS config so they can't drift out of sync.
 */
export function AppShell({ active, onChange, pendingCount = 0, isModerator = false, children }: Props) {
  return (
    <div className="flex h-full w-full flex-col md:flex-row">
      {/* Desktop sidebar — react-pro-sidebar based, collapsible */}
      <DesktopSidebar active={active} onChange={onChange} pendingCount={pendingCount} isModerator={isModerator} />

      {/* Main content, with an ambient animated aurora backdrop on desktop */}
      <main className="relative min-h-0 flex-1 overflow-hidden pb-16 md:pb-0">
        <AuroraBackground />
        {children}
      </main>

      {/* Mobile bottom nav — floating "Dynamic Island" style capsule */}
      <DynamicIslandNav active={active} onChange={onChange} pendingCount={pendingCount} isModerator={isModerator} />
    </div>
  );
}
