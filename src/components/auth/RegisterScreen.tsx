import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Dialog';

interface Props {
  onSwitchToLogin: () => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function RegisterScreen({ onSwitchToLogin }: Props) {
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean; confirmPassword?: boolean }>({});
  const toast = useToast();

  const emailError = touched.email && !email.trim()
    ? 'Email is required'
    : touched.email && !EMAIL_RE.test(email.trim())
    ? 'Enter a valid email address'
    : null;
  const passwordError = touched.password && !password
    ? 'Password is required'
    : touched.password && password.length < 8
    ? 'Must be at least 8 characters'
    : null;
  const confirmError = touched.confirmPassword && confirmPassword !== password
    ? 'Passwords do not match'
    : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ email: true, password: true, confirmPassword: true });
    if (!email.trim() || !EMAIL_RE.test(email.trim()) || !password || !confirmPassword) return;
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      await register(email.trim(), password, displayName.trim() || undefined);
      toast.success('Account created!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-panel rounded-2xl border border-cyanDark/30 p-6 sm:p-8 transition-shadow focus-within:border-cyan focus-within:shadow-[0_0_0_3px_rgba(77,217,232,0.15)]">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-extrabold text-white">Create account</h1>
        <p className="mt-1 text-muted text-[13px]">Join to report issues and track your reports</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-[12px] font-medium text-muted mb-1.5">Display name (optional)</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            className="w-full rounded-lg border border-cyanDark/40 bg-panelAlt px-3 py-2.5 text-white placeholder:text-mutedDark outline-none focus:border-cyan"
            autoComplete="name"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-[12px] font-medium text-muted mb-1.5">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            placeholder="you@example.com"
            className={`w-full rounded-lg border bg-panelAlt px-3 py-2.5 text-white placeholder:text-mutedDark outline-none transition-colors ${
              emailError ? 'border-red-500 focus:border-red-500' : 'border-cyanDark/40 focus:border-cyan'
            }`}
            autoComplete="email"
            aria-invalid={!!emailError}
            required
            disabled={loading}
          />
          {emailError && <p className="mt-1 text-[12px] text-red-400">{emailError}</p>}
        </div>

        <div>
          <label className="block text-[12px] font-medium text-muted mb-1.5">Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, password: true }))}
              placeholder="At least 8 characters"
              className={`w-full rounded-lg border bg-panelAlt px-3 py-2.5 text-white placeholder:text-mutedDark outline-none transition-colors pr-10 ${
                passwordError ? 'border-red-500 focus:border-red-500' : 'border-cyanDark/40 focus:border-cyan'
              }`}
              autoComplete="new-password"
              aria-invalid={!!passwordError}
              required
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white"
            >
              {showPassword ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 114.24 4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
          {passwordError && <p className="mt-1 text-[12px] text-red-400">{passwordError}</p>}
        </div>

        <div>
          <label className="block text-[12px] font-medium text-muted mb-1.5">Confirm password</label>
          <input
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, confirmPassword: true }))}
            placeholder="••••••••"
            className={`w-full rounded-lg border bg-panelAlt px-3 py-2.5 text-white placeholder:text-mutedDark outline-none transition-colors ${
              confirmError ? 'border-red-500 focus:border-red-500' : 'border-cyanDark/40 focus:border-cyan'
            }`}
            autoComplete="new-password"
            aria-invalid={!!confirmError}
            required
            disabled={loading}
          />
          {confirmError && <p className="mt-1 text-[12px] text-red-400">{confirmError}</p>}
        </div>

        <Button label="Create account" fullWidth loading={loading} onClick={handleSubmit} />

        <p className="text-center text-[13px] text-muted">
          Already have an account?{' '}
          <button onClick={onSwitchToLogin} className="font-semibold text-cyan hover:underline">
            Sign in
          </button>
        </p>
      </form>
    </div>
  );
}