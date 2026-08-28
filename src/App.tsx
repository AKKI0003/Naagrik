import { useEffect, useMemo, useState } from 'react';
import AOS from 'aos';
import 'aos/dist/aos.css';
import { MapScreen } from './components/map/MapScreen';
import { MyReportsScreen } from './components/reports/MyReportsScreen';
import { ActivityScreen } from './components/activity/ActivityScreen';
import { ModerationScreen } from './components/moderation/ModerationScreen';
import { SettingsScreen } from './components/settings/SettingsScreen';
import { AccountScreen } from './components/account/AccountScreen';
import { LoginScreen } from './components/auth/LoginScreen';
import { RegisterScreen } from './components/auth/RegisterScreen';
import { AppShell } from './components/layout/AppShell';
import type { TabKey } from './components/layout/navItems';
import { DialogProvider, ToastProvider } from './components/ui/Dialog';
import { AuroraBackground } from './components/ui/AuroraBackground';
import { Spotlight } from './components/ui/Spotlight';
import { createReportsRepository } from './services/reportsRepository';
import { createClassificationService } from './services/classificationService';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { useLenis } from './hooks/useLenis';
import type { ReportModel } from './types/report';

function AppContent() {
  useLenis();
  useEffect(() => {
    AOS.init({ duration: 500, once: true, offset: 20, easing: 'ease-out-cubic' });
  }, []);

  const { user, loading, token } = useAuth();
  const [tab, setTab] = useState<TabKey>('map');
  const [pendingCount, setPendingCount] = useState(0);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  // Recreated whenever auth state changes (not just once) so the
  // offline/local repository always knows the current account id —
  // it needs that to enforce "1 confirm + 1 flag per account" itself.
  const repository = useMemo(() => createReportsRepository(token ?? undefined, user?.id), [token, user?.id]);
  const classificationService = createClassificationService();

  // Surfaced in the nav badge regardless of which tab is active, so a
  // moderator notices new review items without having to keep the
  // Moderate tab open.
  useEffect(() => {
    return repository.watchPendingReview((reports: ReportModel[]) => setPendingCount(reports.length));
  }, [repository]);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-bg p-4">
        <AuroraBackground />
        <div className="relative z-10 w-full max-w-md">
          {/* Brand mark — the auth screen previously dropped straight
              into a form with no identity above it, the single
              biggest "this could be anyone's app" tell. A wordmark
              plus a small motion pulse on the pin is enough to read
              as a deliberate landing moment, not a bare form. */}
          <div data-aos="fade-down" className="mb-7 flex flex-col items-center gap-2.5">
            <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan/12 ring-1 ring-cyan/30">
              <span className="absolute h-11 w-11 animate-ping rounded-2xl bg-cyan/10" style={{ animationDuration: '2.4s' }} />
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4DD9E8" strokeWidth="2">
                <path d="M12 22s7-7.58 7-12.5A7 7 0 0 0 5 9.5C5 14.42 12 22 12 22z" strokeLinejoin="round" />
                <circle cx="12" cy="9.5" r="2.4" />
              </svg>
            </div>
            <span className="text-[15px] font-extrabold tracking-[0.14em] text-white">NAGRIK</span>
          </div>
          <Spotlight className="rounded-2xl">
            {authMode === 'login' ? (
              <LoginScreen onSwitchToRegister={() => setAuthMode('register')} />
            ) : (
              <RegisterScreen onSwitchToLogin={() => setAuthMode('login')} />
            )}
          </Spotlight>
        </div>
      </div>
    );
  }

  const isModerator = user.isModerator;

  return (
    <div className="fixed inset-0 bg-bg">
      <AppShell active={tab} onChange={setTab} pendingCount={pendingCount} isModerator={isModerator}>
        <div className={tab === 'map' ? 'h-full' : 'hidden'}>
          <MapScreen repository={repository} classificationService={classificationService} uid={user.id} />
        </div>
        {tab === 'reports' && <MyReportsScreen repository={repository} uid={user.id} />}
        {tab === 'activity' && <ActivityScreen repository={repository} />}
        {isModerator && tab === 'moderate' && <ModerationScreen repository={repository} />}
        {tab === 'account' && <AccountScreen />}
        {tab === 'settings' && <SettingsScreen />}
      </AppShell>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <DialogProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </DialogProvider>
    </ToastProvider>
  );
}
