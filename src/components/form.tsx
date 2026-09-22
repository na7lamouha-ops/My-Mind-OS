'use client';

import { useFormStatus } from 'react-dom';

const variants = {
  primary: 'bg-accent text-white shadow-card hover:bg-accent-soft',
  ghost: 'border border-border text-text hover:border-border-strong hover:bg-elevated',
  danger: 'border border-danger/40 text-danger hover:bg-danger/10',
} as const;

export function SubmitButton({
  children,
  variant = 'primary',
  pendingLabel,
  size = 'md',
  className = '',
}: {
  children: React.ReactNode;
  variant?: keyof typeof variants;
  pendingLabel?: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const { pending } = useFormStatus();
  const pad = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm min-h-[2.75rem]';
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${pad} ${className}`}
    >
      {pending ? (pendingLabel ?? '…') : children}
    </button>
  );
}
