import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  AGE_META,
  ageFromDays,
  CATEGORY_META,
  reportAgeInDays,
  withinTimeFilter,
  type ReportCategory,
  type ReportModel,
  type TimeFilter,
} from '../../types/report';
import { FilterRail } from './FilterRail';
import { NewReportSheet } from '../reports/NewReportSheet';
import { ReportDetailViewer } from '../reports/ReportDetailViewer';
import { useLocation, FALLBACK_CENTER } from '../../hooks/useLocation';
import type { ReportsRepository } from '../../services/reportsRepository';
import type { ClassificationService } from '../../services/classificationService';

interface Props {
  repository: ReportsRepository;
  classificationService: ClassificationService;
  uid: string;
}

// Free, no-API-key vector basemap — see openfreemap.org. Swapping the
// old Esri *raster* tiles for a MapLibre GL *vector* style is the
// single biggest driver of the "someone actually built this map"
// feeling: vector tiles render labels/roads crisply at any zoom and
// rotation instead of blurry upscaled PNG squares, and they let us
// theme roads/water/land directly instead of fighting a raster tile's
// baked-in colors with an overlay.
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/dark';

function categoryMarkerEl(category: ReportCategory, ageDays: number): HTMLDivElement {
  const cat = CATEGORY_META[category];
  const age = AGE_META[ageFromDays(ageDays)];
  const ringWidth = ageDays <= 3 ? 2 : ageDays <= 14 ? 2.5 : ageDays <= 45 ? 3.5 : 4.5;
  const el = document.createElement('div');
  el.style.cssText = 'width:38px;height:38px;display:flex;align-items:center;justify-content:center;cursor:pointer;';
  el.innerHTML = `<div style="
      width:34px;height:34px;border-radius:50%;
      background:radial-gradient(circle at 32% 28%, ${cat.hex}, ${cat.hex}cc);
      border:${ringWidth}px solid ${age.hex};
      box-shadow:0 0 10px ${age.hex}99, 0 2px 6px rgba(0,0,0,0.5);
      display:flex;align-items:center;justify-content:center;
      font:800 9px Inter,sans-serif;color:#0A1420;
      transition:transform 0.15s ease;
      ">${cat.icon}</div>`;
  el.onmouseenter = () => { (el.firstElementChild as HTMLElement).style.transform = 'scale(1.12)'; };
  el.onmouseleave = () => { (el.firstElementChild as HTMLElement).style.transform = 'scale(1)'; };
  return el;
}

function meMarkerEl(isIpFallback: boolean): HTMLDivElement {
  const color = isIpFallback ? '#D9AF52' : '#4DD9E8';
  const label = isIpFallback ? 'IP location (approx)' : 'GPS location';
  const el = document.createElement('div');
  el.title = label;
  el.style.cssText = 'position:relative;width:26px;height:26px;display:flex;align-items:center;justify-content:center;';
  el.innerHTML = `
      <div class="nagrik-pulse-ring" style="position:absolute;width:22px;height:22px;border-radius:50%;background:${color};"></div>
      <div style="position:relative;width:18px;height:18px;border-radius:50%;background:${color};border:3px solid #ffffff;box-shadow:0 0 12px ${color}e6, 0 2px 6px rgba(0,0,0,0.5);"></div>`;
  return el;
}

export function MapScreen({ repository, classificationService, uid }: Props) {
  const [reports, setReports] = useState<ReportModel[]>([]);
  const [hiddenCategories, setHiddenCategories] = useState<Set<ReportCategory>>(new Set());
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const {
    location: myLocation,
    status: locationStatus,
    accuracy,
    lowConfidence,
    isIpFallback,
    refresh,
    fetchIpFallback,
  } = useLocation();
  const [hasCenteredOnce, setHasCenteredOnce] = useState(false);
  const [reportSheetOpen, setReportSheetOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ReportModel | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const meMarkerRef = useRef<maplibregl.Marker | null>(null);
  const reportMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());

  useEffect(() => repository.watchOpenReports(setReports), [repository]);

  const reportLocation = myLocation ?? FALLBACK_CENTER;

  // --- Map init (once) ---------------------------------------------
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: [reportLocation[1], reportLocation[0]],
      zoom: 14,
      attributionControl: false,
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
    map.on('load', () => setMapReady(true));
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init once; recentering is handled separately below
  }, []);

  // --- Fly to my location the first time it's known -----------------
  useEffect(() => {
    if (myLocation && !hasCenteredOnce && mapRef.current) {
      mapRef.current.flyTo({ center: [myLocation[1], myLocation[0]], zoom: 16, duration: 700 });
      setHasCenteredOnce(true);
    }
  }, [myLocation, hasCenteredOnce]);

  // --- "Me" marker ----------------------------------------------------
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    if (meMarkerRef.current) {
      meMarkerRef.current.remove();
      meMarkerRef.current = null;
    }
    if (myLocation) {
      meMarkerRef.current = new maplibregl.Marker({ element: meMarkerEl(isIpFallback) })
        .setLngLat([myLocation[1], myLocation[0]])
        .addTo(mapRef.current);
    }
  }, [myLocation, isIpFallback, mapReady]);

  // --- Report markers, kept in sync with the visible set -------------
  const visibleReports = reports.filter(
    (r) => !hiddenCategories.has(r.category) && withinTimeFilter(r.createdAt, timeFilter),
  );

  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    const map = mapRef.current;
    const current = reportMarkersRef.current;
    const nextIds = new Set(visibleReports.map((r) => r.id));

    // Remove markers for reports no longer visible (filtered out, resolved, etc.)
    for (const [id, marker] of current) {
      if (!nextIds.has(id)) {
        marker.remove();
        current.delete(id);
      }
    }

    // Add/update markers for the current visible set
    for (const r of visibleReports) {
      const existing = current.get(r.id);
      if (existing) {
        existing.setLngLat([r.lng, r.lat]);
        continue;
      }
      const el = categoryMarkerEl(r.category, reportAgeInDays(r.createdAt));
      el.addEventListener('click', () => setSelectedReport(r));
      const marker = new maplibregl.Marker({ element: el }).setLngLat([r.lng, r.lat]).addTo(map);
      current.set(r.id, marker);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- visibleReports is derived fresh each render; comparing by id set above is what actually matters
  }, [visibleReports, mapReady]);

  function toggleCategory(cat: ReportCategory) {
    setHiddenCategories((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }

  function handleRecenter() {
    refresh();
    if (myLocation && mapRef.current) {
      mapRef.current.flyTo({ center: [myLocation[1], myLocation[0]], zoom: 16, duration: 700 });
    }
  }

  const showLowAccuracyHint = lowConfidence && !isIpFallback;
  const showDeniedBanner = locationStatus === 'denied' || locationStatus === 'unavailable' || locationStatus === 'timeout';
  const showIpFallbackBanner = isIpFallback && myLocation;

  return (
    <div className="relative h-full w-full">
      <div ref={mapContainerRef} className="h-full w-full" style={{ background: '#0A1420' }} />

      <div
        className="pointer-events-none absolute inset-0 z-[500]"
        style={{ boxShadow: 'inset 0 0 120px 40px rgba(10,20,32,0.55)' }}
      />

      {/* Stats chip, top-left */}
      <div className="glass-panel absolute left-4 top-4 z-[1000] rounded-xl border border-cyanDark/50 px-3.5 py-2 shadow-panel">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan shadow-glowCyan" />
          <span className="text-[12.5px] font-semibold text-white">{visibleReports.length}</span>
          <span className="text-[11.5px] text-muted">open near you</span>
        </div>
      </div>

      {/* IP fallback active banner */}
      {showIpFallbackBanner && (
        <div className="glass-panel absolute left-4 top-16 z-[1000] max-w-[280px] rounded-xl border border-gold/50 px-3.5 py-2.5 shadow-panel">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
            <p className="text-[11.5px] font-semibold text-gold">
              Using approximate location (IP-based) — GPS unavailable
            </p>
          </div>
          <div className="mt-1.5 flex gap-3">
            <button onClick={fetchIpFallback} className="text-[11px] font-bold text-cyan">
              Refresh IP location
            </button>
            <button onClick={handleRecenter} className="text-[11px] font-bold text-white">
              Retry GPS
            </button>
          </div>
        </div>
      )}

      {/* Denied/unavailable GPS banner */}
      {showDeniedBanner && !isIpFallback && (
        <div className="glass-panel absolute left-4 top-16 z-[1000] max-w-[260px] rounded-xl border border-gold/50 px-3.5 py-2.5 shadow-panel">
          <p className="text-[11.5px] leading-snug text-gold">
            {locationStatus === 'denied'
              ? "Location access is blocked for this site."
              : locationStatus === 'timeout'
                ? 'Location is taking a while to respond.'
                : "This browser can't provide location."}
          </p>
          <div className="mt-1.5 flex gap-3">
            {locationStatus !== 'unavailable' && (
              <button onClick={handleRecenter} className="text-[11px] font-bold text-cyan">
                Retry GPS
              </button>
            )}
            <button onClick={fetchIpFallback} className="text-[11px] font-bold text-white">
              Use approximate location
            </button>
          </div>
        </div>
      )}

      {/* Low-accuracy nudge — GPS accuracy is poor (>2km), likely network positioning */}
      {showLowAccuracyHint && (
        <div className="glass-panel absolute left-4 top-16 z-[1000] max-w-[270px] rounded-xl border border-gold/50 px-3.5 py-2.5 shadow-panel">
          <p className="text-[11.5px] leading-snug text-gold">
            Location accuracy is low (~{Math.round((accuracy ?? 0) / 1000)}km) — this browser is likely using
            network-based positioning, not GPS.
          </p>
          <button onClick={fetchIpFallback} className="mt-1.5 text-[11.5px] font-bold text-cyan">
            Use approximate location instead →
          </button>
        </div>
      )}

      {/* Filter rail, top-right */}
      <div className="absolute right-4 top-4 z-[1000] flex flex-col items-end gap-2.5">
        <FilterRail
          hiddenCategories={hiddenCategories}
          onToggleCategory={toggleCategory}
          timeFilter={timeFilter}
          onTimeFilterChange={setTimeFilter}
          visibleCount={visibleReports.length}
        />
      </div>

      {/* Recenter-on-me button */}
      <button
        onClick={handleRecenter}
        className="glass-panel absolute bottom-24 right-4 z-[1000] flex h-11 w-11 items-center justify-center rounded-full border shadow-panel"
        style={{ borderColor: '#2E93A6' }}
        title={accuracy ? `Accurate to ~${Math.round(accuracy)}m` : undefined}
      >
        {locationStatus === 'locating' ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-cyan border-t-transparent" />
        ) : (
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#4DD9E8" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {/* Report FAB */}
      <button
        onClick={() => setReportSheetOpen(true)}
        className="absolute bottom-6 right-4 z-[1000] flex items-center gap-2 rounded-full bg-cyan px-5 py-3.5 font-bold text-bg shadow-glowCyan transition-transform active:scale-95"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0A1420" strokeWidth="2.4">
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
        Report
      </button>

      {reportSheetOpen && (
        <NewReportSheet
          initialLocation={{ lat: reportLocation[0], lng: reportLocation[1] }}
          repository={repository}
          classificationService={classificationService}
          uid={uid}
          onClose={() => setReportSheetOpen(false)}
        />
      )}

      {selectedReport && (
        <ReportDetailViewer
          report={selectedReport}
          repository={repository}
          onClose={() => setSelectedReport(null)}
          currentUid={uid}
        />
      )}
    </div>
  );
}
