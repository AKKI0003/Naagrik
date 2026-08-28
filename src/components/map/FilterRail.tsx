import { useState } from 'react';
import {
  CATEGORY_META,
  SELECTABLE_CATEGORIES,
  TIME_FILTER_META,
  type ReportCategory,
  type TimeFilter,
} from '../../types/report';

interface Props {
  hiddenCategories: Set<ReportCategory>;
  onToggleCategory: (category: ReportCategory) => void;
  timeFilter: TimeFilter;
  onTimeFilterChange: (filter: TimeFilter) => void;
  visibleCount: number;
}

const TIME_OPTIONS: TimeFilter[] = ['all', '24h', '7d', '30d'];

/**
 * Same "collapsed icon expands into a panel" idea carried through from
 * spidertrack's PinFilterRail, now covering both category (as before)
 * and time range (new) in one panel, with a live result count so the
 * filter has visible feedback instead of being a silent toggle.
 */
export function FilterRail({
  hiddenCategories,
  onToggleCategory,
  timeFilter,
  onTimeFilterChange,
  visibleCount,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const activeFilterCount = hiddenCategories.size + (timeFilter !== 'all' ? 1 : 0);

  return (
    <div className="flex flex-col items-end">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="glass-panel relative flex h-11 w-11 items-center justify-center rounded-xl border shadow-panel transition-shadow"
        style={{ borderColor: expanded ? '#D9AF52' : '#4DD9E8' }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={expanded ? '#D9AF52' : '#4DD9E8'} strokeWidth="2">
          <line x1="4" y1="6" x2="20" y2="6" strokeLinecap="round" />
          <circle cx="9" cy="6" r="2" fill={expanded ? '#D9AF52' : '#4DD9E8'} stroke="none" />
          <line x1="4" y1="12" x2="20" y2="12" strokeLinecap="round" />
          <circle cx="15" cy="12" r="2" fill={expanded ? '#D9AF52' : '#4DD9E8'} stroke="none" />
          <line x1="4" y1="18" x2="20" y2="18" strokeLinecap="round" />
          <circle cx="11" cy="18" r="2" fill={expanded ? '#D9AF52' : '#4DD9E8'} stroke="none" />
        </svg>
        {activeFilterCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[9px] font-bold text-bg">
            {activeFilterCount}
          </span>
        )}
      </button>

      {expanded && (
        <div className="glass-panel nagrik-fade-in mt-2 w-64 rounded-xl border p-3 shadow-panel" style={{ borderColor: '#2E93A6' }}>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wide text-muted">Time range</span>
          </div>
          <div className="mb-3 grid grid-cols-4 gap-1 rounded-lg bg-bg/60 p-1">
            {TIME_OPTIONS.map((opt) => (
              <button
                key={opt}
                onClick={() => onTimeFilterChange(opt)}
                className="rounded-md py-1.5 text-[10.5px] font-semibold transition-colors"
                style={{
                  backgroundColor: timeFilter === opt ? '#4DD9E8' : 'transparent',
                  color: timeFilter === opt ? '#0A1420' : '#8B96AC',
                }}
              >
                {TIME_FILTER_META[opt].label.replace('Last ', '')}
              </button>
            ))}
          </div>

          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wide text-muted">Issue type</span>
            {hiddenCategories.size > 0 && (
              <button
                onClick={() => SELECTABLE_CATEGORIES.forEach((c) => hiddenCategories.has(c) && onToggleCategory(c))}
                className="text-[10.5px] font-medium text-cyan"
              >
                Show all
              </button>
            )}
          </div>
          <div className="flex flex-col gap-0.5">
            {SELECTABLE_CATEGORIES.map((cat) => {
              const meta = CATEGORY_META[cat];
              const visible = !hiddenCategories.has(cat);
              return (
                <button
                  key={cat}
                  onClick={() => onToggleCategory(cat)}
                  className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-opacity hover:bg-white/5"
                  style={{ opacity: visible ? 1 : 0.4 }}
                >
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-bg"
                    style={{ backgroundColor: meta.hex }}
                  >
                    {meta.icon}
                  </span>
                  <span className="flex-1 text-[12.5px] font-medium text-white">{meta.label}</span>
                  <span
                    className="h-4 w-4 shrink-0 rounded border"
                    style={{
                      borderColor: visible ? meta.hex : '#5C6884',
                      backgroundColor: visible ? meta.hex : 'transparent',
                    }}
                  />
                </button>
              );
            })}
          </div>

          <div className="mt-3 border-t border-cyanDark/25 pt-2.5 text-center text-[11px] text-muted">
            Showing <span className="font-bold text-cyan">{visibleCount}</span> report{visibleCount === 1 ? '' : 's'}
          </div>
        </div>
      )}
    </div>
  );
}
