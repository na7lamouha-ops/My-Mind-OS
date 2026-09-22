'use client';

import { useState, useTransition } from 'react';
import { Sparkles } from 'lucide-react';

import { Pill } from '@/components/ui';
import {
  analyzeEntityAction,
  applySuggestionAction,
  rejectSuggestionAction,
} from '@/app/(app)/ai/actions';
import type { AISuggestion, AiOutcome } from '@/lib/ai/types';
import { priorityLabel } from '@/lib/labels';

const typeLabel: Record<string, string> = {
  idea: 'فكرة',
  source: 'مصدر',
  task: 'مهمة',
  content: 'محتوى',
  decision: 'قرار',
  archive: 'أرشفة',
};
const outcomeLabel: Record<AiOutcome, string> = {
  project: 'تحويل إلى مشروع',
  task: 'إنشاء مهمة',
  content: 'تحويل إلى محتوى',
};

type View =
  | { s: 'idle' }
  | { s: 'loading' }
  | { s: 'error'; message: string }
  | { s: 'proposed'; runId: string; suggestion: AISuggestion; outcome: AiOutcome; editing: boolean }
  | { s: 'done'; message: string };

export function AiOrganizer({
  entityType,
  entityId,
}: {
  entityType: 'idea' | 'source';
  entityId: string;
}) {
  const [view, setView] = useState<View>({ s: 'idle' });
  const [pending, start] = useTransition();

  function analyze() {
    setView({ s: 'loading' });
    start(async () => {
      const res = await analyzeEntityAction(entityType, entityId);
      if (!res.ok) return setView({ s: 'error', message: res.error });
      setView({
        s: 'proposed',
        runId: res.runId,
        suggestion: res.suggestion,
        outcome: res.suggestion.outcomes[0] ?? 'task',
        editing: false,
      });
    });
  }

  function patch(p: Partial<AISuggestion>) {
    setView((v) => (v.s === 'proposed' ? { ...v, suggestion: { ...v.suggestion, ...p } } : v));
  }

  function apply() {
    if (view.s !== 'proposed') return;
    const { runId, suggestion, outcome } = view;
    start(async () => {
      const res = await applySuggestionAction({ runId, entityType, entityId, outcome, suggestion });
      setView(res.ok ? { s: 'done', message: 'تم تطبيق الاقتراح ✓' } : { s: 'error', message: res.error });
    });
  }

  function reject() {
    if (view.s !== 'proposed') return;
    const { runId } = view;
    start(async () => {
      await rejectSuggestionAction(runId);
      setView({ s: 'done', message: 'رُفِض الاقتراح.' });
    });
  }

  if (view.s === 'idle' || view.s === 'loading') {
    return (
      <button
        type="button"
        onClick={analyze}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-medium text-link transition hover:bg-accent/20 disabled:opacity-60"
      >
        <Sparkles size={14} aria-hidden />
        {view.s === 'loading' ? 'جارٍ التحليل…' : 'حلّل ونظّم بالـAI'}
      </button>
    );
  }

  if (view.s === 'error') {
    return (
      <div className="mt-2 space-y-2">
        <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
          {view.message}
        </p>
        <button type="button" onClick={analyze} className="text-xs text-link hover:underline">
          إعادة المحاولة
        </button>
      </div>
    );
  }

  if (view.s === 'done') {
    return <p className="mt-2 text-xs text-success">{view.message}</p>;
  }

  // proposed
  const { suggestion, outcome, editing } = view;
  return (
    <div className="mt-3 space-y-3 rounded-xl border border-accent/30 bg-accent/5 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Pill value="inbox" label={typeLabel[suggestion.type] ?? suggestion.type} />
        <Pill value={suggestion.priority} label={priorityLabel[suggestion.priority]} />
        <span className="text-xs text-muted">{suggestion.category}</span>
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea
            value={suggestion.summary}
            onChange={(e) => patch({ summary: e.target.value })}
            className="w-full rounded-lg border border-border bg-bg px-2.5 py-1.5 text-sm text-text outline-none focus:border-accent"
            rows={2}
          />
          <input
            value={suggestion.nextAction}
            onChange={(e) => patch({ nextAction: e.target.value })}
            placeholder="الخطوة التالية"
            className="w-full rounded-lg border border-border bg-bg px-2.5 py-1.5 text-sm text-text outline-none focus:border-accent"
          />
          <input
            value={suggestion.suggestedProjectTitle ?? ''}
            onChange={(e) => patch({ suggestedProjectTitle: e.target.value || null })}
            placeholder="اسم المشروع المقترح (اختياري)"
            className="w-full rounded-lg border border-border bg-bg px-2.5 py-1.5 text-sm text-text outline-none focus:border-accent"
          />
        </div>
      ) : (
        <div className="space-y-1 text-sm">
          <p>{suggestion.summary}</p>
          <p className="text-muted">
            <span className="text-text">الخطوة التالية: </span>
            {suggestion.nextAction}
          </p>
          {suggestion.suggestedProjectTitle && (
            <p className="text-muted">مشروع مقترح: {suggestion.suggestedProjectTitle}</p>
          )}
          <p className="text-xs text-muted">السبب: {suggestion.reason}</p>
        </div>
      )}

      <div className="space-y-1.5">
        <p className="text-xs text-muted">اختر الإجراء:</p>
        <div className="flex flex-wrap gap-2">
          {suggestion.outcomes.map((o) => (
            <label
              key={o}
              className={`cursor-pointer rounded-lg border px-2.5 py-1 text-xs transition ${
                outcome === o
                  ? 'border-accent bg-accent/15 text-link'
                  : 'border-border text-muted hover:bg-elevated'
              }`}
            >
              <input
                type="radio"
                name={`outcome-${entityId}`}
                className="sr-only"
                checked={outcome === o}
                onChange={() => setView((v) => (v.s === 'proposed' ? { ...v, outcome: o } : v))}
              />
              {outcomeLabel[o]}
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={apply}
          disabled={pending}
          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-accent-soft disabled:opacity-60"
        >
          {pending ? '…' : 'تطبيق'}
        </button>
        <button
          type="button"
          onClick={() => setView((v) => (v.s === 'proposed' ? { ...v, editing: !v.editing } : v))}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text transition hover:bg-elevated"
        >
          {editing ? 'تم' : 'تعديل'}
        </button>
        <button
          type="button"
          onClick={reject}
          disabled={pending}
          className="rounded-lg border border-danger/40 px-3 py-1.5 text-xs font-medium text-danger transition hover:bg-danger/10 disabled:opacity-60"
        >
          رفض
        </button>
      </div>
    </div>
  );
}
