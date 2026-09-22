'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import {
  createAiRun,
  createContentItem,
  createProject,
  createTask,
  getActiveProject,
  getIdea,
  getSource,
  linkEntities,
  updateAiRun,
  updateIdea,
} from '@/lib/data';
import { AIError, AISuggestion, AiOutcome, getProvider, runOrganizer } from '@/lib/ai';

export type AnalyzeResult =
  | { ok: true; runId: string; suggestion: AISuggestion }
  | { ok: false; error: string };

const EntityType = z.enum(['idea', 'source']);

function revalidateAll() {
  for (const p of ['/inbox', '/ideas', '/knowledge', '/projects', '/tasks', '/dashboard']) {
    revalidatePath(p);
  }
}

/**
 * Generate an AI suggestion for an idea/source. Never mutates the entity; logs
 * the run in ai_runs (proposed / failed). The user's original text is untouched.
 */
export async function analyzeEntityAction(
  entityTypeRaw: string,
  entityId: string,
): Promise<AnalyzeResult> {
  let entityType: 'idea' | 'source';
  try {
    entityType = EntityType.parse(entityTypeRaw);
    z.string().uuid().parse(entityId);
  } catch {
    return { ok: false, error: 'مدخل غير صالح.' };
  }

  const entity =
    entityType === 'idea' ? await getIdea(entityId) : await getSource(entityId);
  if (!entity) return { ok: false, error: 'العنصر غير موجود.' };

  const title = entity.title;
  const text = entityType === 'idea' ? (entity as { note: string | null }).note ?? '' : (entity as { summary: string | null }).summary ?? '';
  const kind = entityType === 'idea' ? 'organize_idea' : 'summarize_source';

  try {
    const suggestion = await runOrganizer(getProvider(), { title, text });
    const run = await createAiRun({
      kind,
      status: 'proposed',
      input: { title, entityType },
      output: suggestion,
      entity_type: entityType,
      entity_id: entityId,
    });
    return { ok: true, runId: run.id, suggestion };
  } catch (err) {
    const message = err instanceof AIError ? err.message : 'فشل التحليل بالذكاء الاصطناعي.';
    // Best-effort failure log; ignore logging errors so we still show the message.
    try {
      await createAiRun({
        kind,
        status: 'failed',
        input: { title, entityType },
        output: { error: message },
        entity_type: entityType,
        entity_id: entityId,
      });
    } catch {
      /* noop */
    }
    return { ok: false, error: message };
  }
}

const ApplyInput = z.object({
  runId: z.string().uuid(),
  entityType: EntityType,
  entityId: z.string().uuid(),
  outcome: AiOutcome,
  suggestion: AISuggestion,
});

export type ApplyResult = { ok: true } | { ok: false; error: string };

/**
 * Apply the user-approved (possibly edited) suggestion. Only ever runs on an
 * explicit user action — never automatically. Never deletes; project creation
 * happens only here, on approval, and never auto-activates.
 */
export async function applySuggestionAction(payloadRaw: unknown): Promise<ApplyResult> {
  let payload: z.infer<typeof ApplyInput>;
  try {
    payload = ApplyInput.parse(payloadRaw);
  } catch {
    return { ok: false, error: 'اقتراح غير صالح — رُفض.' };
  }
  const { runId, entityType, entityId, outcome, suggestion } = payload;

  try {
    const entity =
      entityType === 'idea' ? await getIdea(entityId) : await getSource(entityId);
    if (!entity) return { ok: false, error: 'العنصر غير موجود.' };

    if (outcome === 'project') {
      await createProject({
        title: suggestion.suggestedProjectTitle ?? entity.title,
        description: suggestion.summary,
        priority: suggestion.priority,
        next_action: suggestion.nextAction,
      });
    } else if (outcome === 'task') {
      let projectId =
        entityType === 'idea' ? (entity as { project_id: string | null }).project_id : null;
      if (!projectId) {
        const active = await getActiveProject();
        if (!active) {
          return {
            ok: false,
            error: 'لا يوجد مشروع نشط أو مرتبط. فعّل مشروعًا أو اربط العنصر بمشروع أولًا.',
          };
        }
        projectId = active.id;
      }
      const task = await createTask({
        title: entity.title,
        project_id: projectId,
        is_next_action: false,
      });
      if (entityType === 'idea') {
        await linkEntities({ from_type: 'idea', from_id: entityId, to_type: 'task', to_id: task.id });
        await updateIdea(entityId, { status: 'organized', project_id: projectId });
      }
    } else {
      // outcome === 'content'
      await createContentItem({
        kind: 'summary',
        body: suggestion.summary,
        status: 'draft',
        idea_id: entityType === 'idea' ? entityId : null,
        source_id: entityType === 'source' ? entityId : null,
      });
      if (entityType === 'idea') await updateIdea(entityId, { status: 'organized' });
    }

    await updateAiRun(runId, { status: 'approved', output: { ...suggestion, appliedOutcome: outcome } });
    revalidateAll();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'تعذّر تطبيق الاقتراح.' };
  }
}

export async function rejectSuggestionAction(runId: string): Promise<ApplyResult> {
  try {
    z.string().uuid().parse(runId);
    await updateAiRun(runId, { status: 'rejected' });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'تعذّر الرفض.' };
  }
}
