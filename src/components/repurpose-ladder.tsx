import { Check, Circle } from 'lucide-react';

import type { RepurposeStage } from '@/lib/learning-review';

/**
 * The content repurposing pipeline as a vertical ladder:
 * Source → Key idea → interpretation → relevance → angle → draft → result/lesson.
 * Stage state is computed; the first open stage shows its next action so the
 * pipeline never stalls silently. Server component (no interactivity).
 */
export function RepurposeLadder({ stages }: { stages: RepurposeStage[] }) {
  return (
    <ol className="space-y-2">
      {stages.map((s, i) => (
        <li key={s.key} className="flex items-start gap-2.5">
          <span
            className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${
              s.done ? 'border-success/50 bg-success/15 text-success' : 'border-border text-muted'
            }`}
            aria-hidden
          >
            {s.done ? <Check size={12} /> : <Circle size={8} />}
          </span>
          <div className="min-w-0 flex-1">
            <p className={`text-sm ${s.done ? 'text-text' : 'text-muted'}`}>
              <span className="ltr-num text-[11px] text-muted">{i + 1}. </span>
              {s.label}
              <span className="text-[11px] text-muted"> — {s.hint}</span>
            </p>
            {s.nextAction && (
              <p className="mt-0.5 text-xs text-link">
                <span className="text-muted">التالي: </span>
                {s.nextAction}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
