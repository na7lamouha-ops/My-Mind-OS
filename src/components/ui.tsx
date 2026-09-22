import type { ReactNode } from 'react';

// ---- layout ---------------------------------------------------------------

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-7 animate-fade-up">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
      {subtitle && <p className="mt-1.5 text-sm leading-6 text-muted">{subtitle}</p>}
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
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-card">
      {title && (
        <div className="mb-4 flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-text">{title}</h2>
          {hint && <span className="text-xs text-muted">{hint}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({ label, icon }: { label: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-3 py-8 text-center">
      {icon && <span className="text-muted/70">{icon}</span>}
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}

// ---- form field primitives (server-safe) ---------------------------------

const inputBase =
  'w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-text outline-none transition placeholder:text-muted/70 hover:border-border-strong focus:border-accent focus:ring-2 focus:ring-accent/30';

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
      <span className="block text-sm font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputBase} ${props.className ?? ''}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputBase} min-h-24 leading-6 ${props.className ?? ''}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputBase} cursor-pointer ${props.className ?? ''}`} />;
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
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
  inbox: 'border-accent/40 bg-accent/10 text-link',
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
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${tone}`}
    >
      {label ?? value}
    </span>
  );
}
