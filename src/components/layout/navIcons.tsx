import type { IconType } from 'react-icons';
import { LuMap, LuFileText, LuActivity, LuShieldCheck, LuUserRound, LuSettings } from 'react-icons/lu';
import type { TabKey } from './navItems';

/** react-icons (Lucide set) equivalents of NAV_ITEMS, keyed by tab —
 * used only by DesktopSidebar, which needs a component reference
 * rather than the inline-SVG-drawing function NAV_ITEMS ships with. */
export const NAV_ICONS: Record<TabKey, IconType> = {
  map: LuMap,
  reports: LuFileText,
  activity: LuActivity,
  moderate: LuShieldCheck,
  account: LuUserRound,
  settings: LuSettings,
};
