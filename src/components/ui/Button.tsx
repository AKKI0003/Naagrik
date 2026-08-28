import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon?: ReactNode;
  color?: string; // hex
  outlined?: boolean;
  fullWidth?: boolean;
  loading?: boolean;
}

/** One consistent tappable surface used everywhere, same role as the
 * Flutter version's NagrikButton (which itself mirrored spidertrack's
 * PixelButton) — reskinned to plain web styling, no framework-specific
 * decoration left over from either prior version. */
export function Button({
  label,
  icon,
  color = '#4DD9E8',
  outlined = false,
  fullWidth = false,
  loading = false,
  disabled,
  className = '',
  ...rest
}: Props) {
  const isDisabled = disabled || loading;
  return (
    <button
      disabled={isDisabled}
      className={`inline-flex items-center justify-center gap-2 rounded-[10px] px-5 py-3 font-bold text-sm tracking-wide transition-opacity ${
        fullWidth ? 'w-full' : ''
      } ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'active:opacity-80'} ${className}`}
      style={{
        backgroundColor: outlined ? 'transparent' : color,
        color: outlined ? color : '#0A1420',
        border: outlined ? `1.4px solid ${color}` : 'none',
      }}
      {...rest}
    >
      {loading ? (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"
          style={{ borderColor: outlined ? color : '#0A1420', borderTopColor: 'transparent' }}
        />
      ) : (
        <>
          {icon}
          <span>{label}</span>
        </>
      )}
    </button>
  );
}
