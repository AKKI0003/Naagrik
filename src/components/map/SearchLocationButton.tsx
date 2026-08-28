import { useEffect, useRef, useState } from 'react';

interface PlaceSuggestion {
  lat: number;
  lng: number;
  primary: string;
  secondary: string;
}

interface Props {
  onLocationFound: (lat: number, lng: number, label: string) => void;
  biasCenter?: { lat: number; lng: number } | null;
}

/**
 * Directly ported from spidertrack's SearchLocationButton (via the
 * Flutter version already built) — same free OpenStreetMap Nominatim
 * geocoding, same debounced live-suggestion UX, same soft bias toward
 * the user's current area rather than blindly jumping to the single
 * top global result. Only the rendering layer changed (React + CSS
 * instead of Flutter widgets); the search logic itself was already
 * correct and didn't need reinventing a third time.
 */
export function SearchLocationButton({ onLocationFound, biasCenter }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (expanded) setTimeout(() => inputRef.current?.focus(), 50);
  }, [expanded]);

  function toggle() {
    setExpanded((e) => {
      const next = !e;
      if (!next) {
        setSuggestions([]);
        setQuery('');
        setError(null);
      }
      return next;
    });
  }

  function onTextChanged(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setSuggestions([]);
      setError(null);
      setIsSearching(false);
      return;
    }
    debounceRef.current = setTimeout(() => fetchSuggestions(value.trim()), 400);
  }

  async function fetchSuggestions(q: string) {
    const thisRequest = ++requestIdRef.current;
    setIsSearching(true);
    setError(null);
    try {
      const params = new URLSearchParams({ q, format: 'json', limit: '5', addressdetails: '1' });
      if (biasCenter) {
        const span = 2.0;
        params.set(
          'viewbox',
          `${biasCenter.lng - span},${biasCenter.lat + span},${biasCenter.lng + span},${biasCenter.lat - span}`,
        );
      }
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
        headers: { 'Accept-Language': 'en' },
      });
      if (thisRequest !== requestIdRef.current) return;
      if (!res.ok) throw new Error('Search failed');
      const results = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
      const parsed: PlaceSuggestion[] = results.map((r) => {
        const parts = r.display_name.split(',').map((p) => p.trim());
        return {
          lat: parseFloat(r.lat),
          lng: parseFloat(r.lon),
          primary: parts[0] ?? r.display_name,
          secondary: parts.slice(1, 4).join(', '),
        };
      });
      setIsSearching(false);
      setSuggestions(parsed);
      setError(parsed.length === 0 ? 'No results found' : null);
    } catch {
      if (thisRequest !== requestIdRef.current) return;
      setIsSearching(false);
      setError('Search failed — try again');
    }
  }

  function select(s: PlaceSuggestion) {
    onLocationFound(s.lat, s.lng, s.primary);
    setIsSearching(false);
    setExpanded(false);
    setSuggestions([]);
    setQuery('');
  }

  return (
    <div className="flex flex-col items-end">
      <button
        onClick={toggle}
        className="glass-panel flex h-11 w-11 items-center justify-center rounded-xl border shadow-panel"
        style={{ borderColor: expanded ? '#D9AF52' : '#4DD9E8' }}
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
          <circle cx="10" cy="10" r="6" stroke={expanded ? '#D9AF52' : '#4DD9E8'} strokeWidth="2" />
          <line x1="15" y1="15" x2="20" y2="20" stroke={expanded ? '#D9AF52' : '#4DD9E8'} strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      {expanded && (
        <div
          className="glass-panel nagrik-fade-in mt-2 max-h-[300px] w-[260px] overflow-y-auto rounded-xl border p-2.5 shadow-panel"
          style={{ borderColor: '#4DD9E8' }}
        >
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => onTextChanged(e.target.value)}
              placeholder="Search an address or area…"
              className="w-full bg-transparent text-sm text-white placeholder:text-muted outline-none"
            />
            {isSearching && (
              <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-cyan border-t-transparent" />
            )}
          </div>
          {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
          {suggestions.length > 0 && (
            <ul className="mt-2 divide-y divide-cyanDark/25">
              {suggestions.map((s, i) => (
                <li key={i}>
                  <button
                    onClick={() => select(s)}
                    className="flex w-full items-start gap-2 py-2 text-left"
                  >
                    <span className="mt-0.5 text-cyan">•</span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] font-semibold text-white">{s.primary}</span>
                      {s.secondary && (
                        <span className="block truncate text-[11.5px] text-muted">{s.secondary}</span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
