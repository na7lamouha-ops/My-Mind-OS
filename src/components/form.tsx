'use client';

import { useFormStatus } from 'react-dom';

const variants = {
  primary: 'bg-accent text-white hover:bg-accent-soft',
  ghost: 'border border-border text-text hover:bg-surface',
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
  const pad = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-4 py-2 text-sm';
  return (
    <button
      type="submit"
      disabled={pending}
      className={`rounded-lg font-medium transition disabled:opacity-60 ${variants[variant]} ${pad} ${className}`}
    >
      {pending ? (pendingLabel ?? '…') : children}
    </button>
  );
}
