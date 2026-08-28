import { useEffect, useState } from 'react';
import { ACTIVITY_META, CATEGORY_META, type ActivityEvent } from '../../types/report';
import type { ReportsRepository } from '../../services/reportsRepository';

interface Props {
  repository: ReportsRepository;
}

/** New: a live feed of what's happening across the map — new reports,
 * confirmations, flags, moderation outcomes. This is both a genuinely
 * useful transparency feature (per the request) and does real work for
 * the "the app feels empty" problem: an app with visible activity
 * feels alive in a way a static map with a few pins doesn't. */
export function ActivityScreen({ repository }: Props) {
  const [events, setEvents] = useState<ActivityEvent[] | null>(null);

  useEffect(() => repository.watchActivity(setEvents), [repository]);

  const groups = groupByDay(events ?? []);

  return (
    <div className="h-full overflow-y-auto px-4 pb-24 pt-5 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-extrabold text-white">Activity</h1>
        <p className="mt-1 text-[13px] text-muted">What's happening across the map, as it happens.</p>

        <div className="mt-5 flex flex-col gap-6">
          {events === null ? (
            Array.from({ length: 4 }).map((_, i) => <div key={i} className="nagrik-skeleton h-14 rounded-xl" />)
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-cyanDark/40 py-16 text-center">
              <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#4DD9E8" strokeWidth="1.4">
                <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
              </svg>
              <p className="text-[16px] font-bold text-white">No activity yet</p>
              <p className="max-w-xs text-[13px] text-muted">Reports, confirmations, and moderator actions will show up here as they happen.</p>
            </div>
          ) : (
            groups.map(([day, dayEvents]) => (
              <div key={day}>
                <div className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-muted">{day}</div>
                <div className="flex flex-col gap-2">
                  {dayEvents.map((e) => (
                    <EventRow key={e.id} event={e} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function EventRow({ event }: { event: ActivityEvent }) {
  const meta = ACTIVITY_META[event.type];
  const cat = CATEGORY_META[event.category];
  const time = new Date(event.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  return (
    <div className="nagrik-fade-in flex items-center gap-3 rounded-xl border border-cyanDark/25 bg-panel px-3.5 py-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${meta.hex}22` }}>
        <ActivityIcon type={event.type} color={meta.hex} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] text-white">
          <span className="font-semibold" style={{ color: cat.hex }}>{cat.label}</span> report {meta.verb}
        </span>
        {event.meta && <span className="block text-[11px] text-muted">{event.meta}</span>}
      </span>
      <span className="shrink-0 text-[11px] text-muted">{time}</span>
    </div>
  );
}

function ActivityIcon({ type, color }: { type: ActivityEvent['type']; color: string }) {
  const common = { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 2 } as const;
  switch (type) {
    case 'created':
      return <svg {...common}><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>;
    case 'confirmed':
      return <svg {...common}><path d="M5 12l4 4 10-10" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    case 'flagged':
      return <svg {...common}><path d="M6 3v18M6 4h11l-2 4 2 4H6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    case 'pending_review':
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" strokeLinecap="round" /></svg>;
    case 'resolved':
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    case 'removed':
      return <svg {...common}><path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-8 0v12a1 1 0 001 1h6a1 1 0 001-1V7" strokeLinecap="round" /></svg>;
    case 'restored':
      return <svg {...common}><path d="M3 12a9 9 0 109-9M3 12l3-3M3 12l3 3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  }
}

function groupByDay(events: ActivityEvent[]): [string, ActivityEvent[]][] {
  const map = new Map<string, ActivityEvent[]>();
  for (const e of events) {
    const key = new Date(e.at).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  return Array.from(map.entries());
}
