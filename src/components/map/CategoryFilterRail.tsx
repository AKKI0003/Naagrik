import { useState } from 'react';
import { CATEGORY_META, SELECTABLE_CATEGORIES, type ReportCategory } from '../../types/report';

interface Props {
  hiddenCategories: Set<ReportCategory>;
  onToggle: (category: ReportCategory) => void;
}

/** Same collapsed-icon-expands-into-toggle-list idea as spidertrack's
 * PinFilterRail (already simplified once for the Flutter version) —
 * ported to React with the same behavior: tap a category to hide/show
 * its pins on the map. */
export function CategoryFilterRail({ hiddenCategories, onToggle }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex flex-col items-end">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex h-[42px] w-[42px] items-center justify-center rounded-[10px] border shadow-lg"
        style={{ borderColor: expanded ? '#D9AF52' : '#4DD9E8', backgroundColor: '#0D1B2A' }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={expanded ? '#D9AF52' : '#4DD9E8'} strokeWidth="2">
          <line x1="4" y1="7" x2="20" y2="7" strokeLinecap="round" />
          <circle cx="9" cy="7" r="2" fill={expanded ? '#D9AF52' : '#4DD9E8'} stroke="none" />
          <line x1="4" y1="17" x2="20" y2="17" strokeLinecap="round" />
          <circle cx="16" cy="17" r="2" fill={expanded ? '#D9AF52' : '#4DD9E8'} stroke="none" />
        </svg>
      </button>

      {expanded && (
        <div className="mt-2 rounded-[10px] border px-1 py-1.5" style={{ borderColor: '#2E93A6', backgroundColor: '#0D1B2A' }}>
          {SELECTABLE_CATEGORIES.map((cat) => {
            const meta = CATEGORY_META[cat];
            const visible = !hiddenCategories.has(cat);
            return (
              <button
                key={cat}
                onClick={() => onToggle(cat)}
                className="flex w-full items-center justify-end gap-2 px-2.5 py-1.5 transition-opacity"
                style={{ opacity: visible ? 1 : 0.35 }}
              >
                <span className="text-[12.5px] font-medium text-white">{meta.label}</span>
                <span
                  className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-bg"
                  style={{ backgroundColor: meta.hex }}
                >
                  {meta.icon}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
