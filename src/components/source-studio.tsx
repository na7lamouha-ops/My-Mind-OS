'use client';

import { useState, useTransition } from 'react';
import {
  BookOpen,
  Boxes,
  FileText,
  Layers,
  Lightbulb,
  ListChecks,
  Map as MapIcon,
  Sparkles,
  Target,
} from 'lucide-react';

import {
  applyAiActionAction,
  rejectAiActionAction,
  runAiActionAction,
} from '@/app/(app)/ai/action-actions';
import type { AiActionKind, AiActionResult } from '@/lib/ai/actions';

/** Studio (NotebookLM-style) actions, grounded and approval-gated. */
const ACTIONS: { kind: AiActionKind; label: string; icon: typeof Sparkles }[] = [
  { kind: 'summarize_source', label: 'تلخيص', icon: FileText },
  { kind: 'extract_key_ideas', label: 'أفكار مفتاحية', icon: Lightbulb },
  { kind: 'suggest_project_links', label: 'ربط بمشروع', icon: Boxes },
  { kind: 'suggest_next_action', label: 'الخطوة التالية', icon: ListChecks },
  { kind: 'generate_review_questions', label: 'أسئلة مراجعة', icon: BookOpen },
  { kind: 'generate_flashcards', label: 'بطاقات', icon: Layers },
  { kind: 'generate_mindmap', label: 'خريطة ذهنية', icon: MapIcon },
  { kind: 'generate_opportunity_hypotheses', label: 'فرص محتملة', icon: Target },
  { kind: 'generate_content_angles', label: 'زوايا محتوى', icon: Sparkles },
  { kind: 'generate_project_breakdown', label: 'تفكيك لمراحل', icon: Layers },
];

const groundingLabel: Record<string, string> = {
  extracted: 'مُستخرَج من النص',
  inference: 'استنتاج',
  suggestion: 'اقتراح',
  needs_verification: 'يحتاج تحقّقًا',
};

type View =
  | { s: 'idle' }
  | { s: 'loading'; kind: AiActionKind }
  | { s: 'error'; message: string }
  | { s: 'proposed'; runId: string; result: AiActionResult; editing: boolean }
  | { s: 'done'; message: string };

export function SourceStudio({ sourceId }: { sourceId: string }) {
  const [view, setView] = useState<View>({ s: 'idle' });
  const [pending, start] = useTransition();

  function run(kind: AiActionKind) {
    setView({ s: 'loading', kind });
    start(async () => {
      const res = await runAiActionAction(kind, sourceId);
      if (!res.ok) return setView({ s: 'error', message: res.error });
      setView({ s: 'proposed', runId: res.runId, result: res.result, editing: false });
    });
  }

  function apply() {
    if (view.s !== 'proposed') return;
    const { runId, result } = view;
    start(async () => {
      const res = await applyAiActionAction({ runId, sourceId, result });
      setView(res.ok ? { s: 'done', message: res.note } : { s: 'error', message: res.error });
    });
  }

  function reject() {
    if (view.s !== 'proposed') return;
    const { runId } = view;
    start(async () => {
      const res = await rejectAiActionAction(runId);
      setView({ s: 'done', message: res.ok ? res.note : 'رُفِض.' });
    });
  }

  function patchSummary(v: string) {
    setView((cur) =>
      cur.s === 'proposed' && cur.result.kind === 'summarize_source'
        ? { ...cur, result: { ...cur.result, summary: v } }
        : cur,
    );
  }
  function patchNext(v: string) {
    setView((cur) =>
      cur.s === 'proposed' && cur.result.kind === 'suggest_next_action'
        ? { ...cur, result: { ...cur.result, nextAction: v } }
        : cur,
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1.5">
        {ACTIONS.map(({ kind, label, icon: Icon }) => {
          const isLoading = view.s === 'loading' && view.kind === kind;
          return (
            <button
              key={kind}
              type="button"
              onClick={() => run(kind)}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1.5 text-xs font-medium text-link transition hover:bg-accent/20 disabled:opacity-60"
            >
              <Icon size={14} aria-hidden />
              {isLoading ? '…' : label}
            </button>
          );
        })}
      </div>

      {view.s === 'error' && (
        <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
          {view.message}
        </p>
      )}

      {view.s === 'done' && <p className="text-xs text-success">{view.message}</p>}

      {view.s === 'proposed' && (
        <div className="space-y-3 rounded-xl border border-accent/30 bg-accent/5 p-3">
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded-md bg-elevated px-2 py-0.5 text-muted">
              {groundingLabel[view.result.grounding] ?? view.result.grounding}
            </span>
            <span className="text-muted">ثقة: {Math.round(view.result.confidence * 100)}%</span>
          </div>

          <ResultBody result={view.result} editing={view.editing} onSummary={patchSummary} onNext={patchNext} />

          <p className="text-[11px] text-muted">{view.result.explanation}</p>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={apply}
              disabled={pending}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-accent-soft disabled:opacity-60"
            >
              {pending ? '…' : 'تطبيق'}
            </button>
            {(view.result.kind === 'summarize_source' || view.result.kind === 'suggest_next_action') && (
              <button
                type="button"
                onClick={() => setView((cur) => (cur.s === 'proposed' ? { ...cur, editing: !cur.editing } : cur))}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text transition hover:bg-elevated"
              >
                {view.editing ? 'تم' : 'تعديل'}
              </button>
            )}
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
      )}
    </div>
  );
}

function ResultBody({
  result,
  editing,
  onSummary,
  onNext,
}: {
  result: AiActionResult;
  editing: boolean;
  onSummary: (v: string) => void;
  onNext: (v: string) => void;
}) {
  const box = 'w-full rounded-lg border border-border bg-bg px-2.5 py-1.5 text-sm text-text outline-none focus:border-accent';
  switch (result.kind) {
    case 'summarize_source':
      return editing ? (
        <textarea className={box} rows={4} value={result.summary} onChange={(e) => onSummary(e.target.value)} />
      ) : (
        <p className="whitespace-pre-wrap text-sm">{result.summary}</p>
      );
    case 'extract_key_ideas':
      return (
        <ul className="list-disc space-y-1 pr-5 text-sm">
          {result.ideas.map((i, k) => (
            <li key={k}>
              {i.title}
              {i.note && <span className="text-muted"> — {i.note}</span>}
            </li>
          ))}
        </ul>
      );
    case 'suggest_project_links':
      return (
        <ul className="space-y-1.5 text-sm">
          {result.links.map((l, k) => (
            <li key={k} className="rounded-lg border border-border bg-bg px-2.5 py-1.5">
              <span className="font-medium">{l.projectHint}</span>
              <span className="text-[11px] text-muted"> · {l.relationType}</span>
              {!l.projectId && <span className="text-[11px] text-warning"> · مشروع جديد مقترح (لن يُنشأ تلقائيًا)</span>}
              <p className="text-xs text-muted">{l.reason}</p>
              {l.opportunity && <p className="text-xs text-warning">فرصة: {l.opportunity}</p>}
            </li>
          ))}
        </ul>
      );
    case 'suggest_next_action':
      return editing ? (
        <input className={box} value={result.nextAction} onChange={(e) => onNext(e.target.value)} />
      ) : (
        <p className="text-sm">
          <span className="text-muted">الخطوة التالية: </span>
          {result.nextAction}
        </p>
      );
    case 'generate_review_questions':
      return (
        <ol className="list-decimal space-y-1 pr-5 text-sm">
          {result.questions.map((q, k) => (
            <li key={k}>{q.q}</li>
          ))}
        </ol>
      );
    case 'generate_flashcards':
      return (
        <ul className="space-y-1.5 text-sm">
          {result.cards.map((c, k) => (
            <li key={k} className="rounded-lg border border-border bg-bg px-2.5 py-1.5">
              <p className="font-medium">{c.front}</p>
              <p className="text-xs text-muted">{c.back}</p>
            </li>
          ))}
        </ul>
      );
    case 'generate_mindmap':
      return (
        <ul className="space-y-1 text-sm">
          {result.map.nodes.map((n) => (
            <li key={n.id} className={n.parentId ? 'pr-4 text-muted' : 'font-medium'}>
              {n.parentId ? '— ' : '• '}
              {n.label} <span className="text-[11px] text-muted">({n.kind})</span>
            </li>
          ))}
        </ul>
      );
    case 'generate_opportunity_hypotheses':
      return (
        <ul className="space-y-1.5 text-sm">
          {result.opportunities.map((o, k) => (
            <li key={k} className="rounded-lg border border-border bg-bg px-2.5 py-1.5">
              <p className="font-medium">{o.title}</p>
              <p className="text-xs text-muted">{o.hypothesis}</p>
              <p className="text-[11px] text-muted">
                الأثر: {o.impact} · الجهد: {o.effort}
              </p>
              <p className="text-[11px] text-warning">اختبار: {o.testStep}</p>
            </li>
          ))}
        </ul>
      );
    case 'generate_content_angles':
      return (
        <ul className="space-y-1.5 text-sm">
          {result.angles.map((a, k) => (
            <li key={k} className="rounded-lg border border-border bg-bg px-2.5 py-1.5">
              <p className="font-medium">{a.hook}</p>
              <p className="text-xs text-muted">
                {a.angle} · {a.contentType}
              </p>
            </li>
          ))}
        </ul>
      );
    case 'generate_project_breakdown':
      return (
        <ul className="space-y-1.5 text-sm">
          {result.phases.map((ph, k) => (
            <li key={k}>
              <p className="font-medium">{ph.name}</p>
              <ul className="list-disc pr-5 text-xs text-muted">
                {ph.tasks.map((t, j) => (
                  <li key={j}>{t}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      );
    default:
      return null;
  }
}
