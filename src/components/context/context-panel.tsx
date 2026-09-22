'use client';

import { useState } from 'react';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';

export function ContextPanel({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted transition hover:bg-elevated hover:text-text"
      >
        <PanelRightOpen size={14} /> إظهار السياق
      </button>
    );
  }

  return (
    <aside className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted">السياق</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="إخفاء السياق"
          className="rounded-lg p-1 text-muted transition hover:bg-elevated hover:text-text"
        >
          <PanelRightClose size={16} />
        </button>
      </div>
      {children}
    </aside>
  );
}

export function ContextSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted/80">{title}</h3>
      {children}
    </section>
  );
}
