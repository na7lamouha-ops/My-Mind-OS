import type { ReactNode } from 'react';

// ---- layout ---------------------------------------------------------------

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-bold">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
    </header>
  );
}

export function Card({
  title,
  hint,
  children,
}: {
  title?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      {title && (
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-text">{title}</h2>
          {hint && <span className="text-xs text-muted">{hint}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({ label }: { label: string }) {
  return (
    <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted">
      {label}
    </p>
  );
}

// ---- form field primitives (server-safe) ---------------------------------

const inputBase =
  'w-full rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none placeholder:text-muted focus:border-accent';

export function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block space-y-1.5">
      <span className="block text-sm text-muted">{label}</span>
      {children}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputBase} ${props.className ?? ''}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputBase} min-h-24 ${props.className ?? ''}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputBase} ${props.className ?? ''}`} />;
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
    >
      {message}
    </p>
  );
}

// ---- status pill ----------------------------------------------------------

const pillTones: Record<string, string> = {
  active: 'border-success/40 bg-success/10 text-success',
  todo: 'border-border bg-bg text-muted',
  doing: 'border-warning/40 bg-warning/10 text-warning',
  done: 'border-success/40 bg-success/10 text-success',
  inbox: 'border-accent/40 bg-accent/10 text-accent',
  organized: 'border-success/40 bg-success/10 text-success',
  snoozed: 'border-warning/40 bg-warning/10 text-warning',
  archived: 'border-border bg-bg text-muted',
  paused: 'border-warning/40 bg-warning/10 text-warning',
  high: 'border-danger/40 bg-danger/10 text-danger',
  medium: 'border-warning/40 bg-warning/10 text-warning',
  low: 'border-border bg-bg text-muted',
};

export function Pill({ value, label }: { value: string; label?: string }) {
  const tone = pillTones[value] ?? 'border-border bg-bg text-muted';
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs ${tone}`}>
      {label ?? value}
    </span>
  );
}
