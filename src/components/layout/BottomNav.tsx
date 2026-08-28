interface Props {
  active: 'map' | 'reports';
  onChange: (tab: 'map' | 'reports') => void;
}

/** 2-tab shell — Map and My Reports only. Deliberately no chat/party/
 * pairing tabs; those spidertrack features solve a different
 * (social/multiplayer) problem than civic reporting. */
export function BottomNav({ active, onChange }: Props) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-[1000] flex border-t" style={{ borderColor: '#0D1B2A', backgroundColor: '#0D1B2A' }}>
      <NavButton
        label="Map"
        isActive={active === 'map'}
        onClick={() => onChange('map')}
        icon={
          <path d="M9 4l6 2 5-2v14l-5 2-6-2-5 2V6l5-2zm0 0v14m6-12v14" strokeLinecap="round" strokeLinejoin="round" />
        }
      />
      <NavButton
        label="My Reports"
        isActive={active === 'reports'}
        onClick={() => onChange('reports')}
        icon={
          <>
            <rect x="4" y="3" width="16" height="18" rx="2" />
            <path d="M8 8h8M8 12h8M8 16h5" strokeLinecap="round" />
          </>
        }
      />
    </nav>
  );
}

function NavButton({ label, isActive, onClick, icon }: { label: string; isActive: boolean; onClick: () => void; icon: React.ReactNode }) {
  const color = isActive ? '#4DD9E8' : '#8B96AC';
  return (
    <button onClick={onClick} className="flex flex-1 flex-col items-center gap-1 py-2.5">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8">
        {icon}
      </svg>
      <span className="text-[11px] font-medium" style={{ color }}>
        {label}
      </span>
    </button>
  );
}
