import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { Button } from './Button';

/* ---------------- Confirm dialog ---------------- */

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: string;
}

interface DialogState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

const DialogContext = createContext<((opts: ConfirmOptions) => Promise<boolean>) | null>(null);

/**
 * Gates the app's destructive/consequential actions (remove a report,
 * restore, delete) — the highest-value place for real dialog
 * semantics rather than a hand-rolled `fixed inset-0` div. Swapping
 * to Radix's Dialog primitive (via @radix-ui/react-dialog) gets this
 * for free, correctly, instead of hand-implemented and easy to get
 * subtly wrong:
 *   - focus is trapped inside while open and restored to the trigger on close
 *   - Escape closes it; clicking the overlay closes it
 *   - background content gets aria-hidden and scroll-locked
 *   - proper role="alertdialog" semantics for screen readers
 * The public API (`useConfirmDialog`) is unchanged, so nothing that
 * calls it needed to change.
 */
export function DialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DialogState | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => setState({ ...opts, resolve }));
  }, []);

  const close = (value: boolean) => {
    state?.resolve(value);
    setState(null);
  };

  return (
    <DialogContext.Provider value={confirm}>
      {children}
      <RadixDialog.Root open={!!state} onOpenChange={(isOpen) => !isOpen && close(false)}>
        <RadixDialog.Portal>
          <RadixDialog.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-[nagrik-fade-in_0.15s_ease-out]" />
          <RadixDialog.Content
            role="alertdialog"
            className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-3rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-cyanDark bg-panel p-5 outline-none data-[state=open]:animate-[nagrik-fade-in_0.18s_ease-out]"
          >
            <RadixDialog.Title className="text-[17px] font-bold text-white">{state?.title}</RadixDialog.Title>
            <RadixDialog.Description className="mt-2 text-sm leading-relaxed text-muted">
              {state?.message}
            </RadixDialog.Description>
            <div className="mt-5 flex justify-end gap-3">
              <RadixDialog.Close asChild>
                <button className="px-3 py-2 text-sm text-muted">{state?.cancelLabel ?? 'Cancel'}</button>
              </RadixDialog.Close>
              <Button
                label={state?.confirmLabel ?? 'Confirm'}
                color={state?.confirmColor ?? '#4DD9E8'}
                onClick={() => close(true)}
              />
            </div>
          </RadixDialog.Content>
        </RadixDialog.Portal>
      </RadixDialog.Root>
    </DialogContext.Provider>
  );
}

export function useConfirmDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useConfirmDialog must be used within DialogProvider');
  return ctx;
}

/* ---------------- Toast / snackbar ---------------- */

interface ToastMsg {
  id: number;
  message: string;
  accent: string;
}

const ToastContext = createContext<{
  show: (message: string, accent?: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
} | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  const show = useCallback((message: string, accent = '#4DD9E8') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, accent }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const value = {
    show,
    success: (message: string) => show(message, '#6FCF97'),
    error: (message: string) => show(message, '#E85D5D'),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto w-full max-w-sm rounded-[10px] border bg-panel px-4 py-3 text-sm text-white shadow-lg"
            style={{ borderColor: `${t.accent}80` }}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
