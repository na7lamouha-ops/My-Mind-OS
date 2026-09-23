'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import {
  createAiRun,
  createContentItem,
  createIdea,
  createLink,
  createTask,
  getActiveProject,
  getSource,
  listProjects,
  updateAiRun,
  updateSource,
} from '@/lib/data';
import { AIError } from '@/lib/ai/types';
import {
  AiActionKind,
  AiActionResult,
  dbKindFor,
  runAction,
  type AiActionInput,
} from '@/lib/ai/actions';

/**
 * Server actions for the Phase 7 Studio (Source Notebook). Every action is
 * Mock-backed, logged in ai_runs as a proposal, and applied ONLY on an explicit
 * user click. Nothing here fabricates financial numbers, calls a real API, or
 * mutates the source's own text without approval.
 */

const uuid = z.string().uuid();

function revalidateAll() {
  for (const p of ['/knowledge', '/ideas', '/projects', '/tasks', '/content', '/dashboard', '/graph']) {
    revalidatePath(p);
  }
}

export type RunActionResult =
  | { ok: true; runId: string; result: AiActionResult }
  | { ok: false; error: string };

/**
 * Generate a source-grounded suggestion for one action kind. Never mutates the
 * source; records the run (proposed / failed) in ai_runs.
 */
export async function runAiActionAction(
  kindRaw: string,
  sourceId: string,
): Promise<RunActionResult> {
  let kind: z.infer<typeof AiActionKind>;
  try {
    kind = AiActionKind.parse(kindRaw);
    uuid.parse(sourceId);
  } catch {
    return { ok: false, error: 'مدخل غير صالح.' };
  }

  const source = await getSource(sourceId);
  if (!source) return { ok: false, error: 'المصدر غير موجود.' };

  const projects = await listProjects();
  const input: AiActionInput = {
    entityType: 'source',
    entityId: sourceId,
    title: source.title,
    text: source.summary ?? '',
    projects: projects.map((p) => ({ id: p.id, title: p.title })),
  };
  const logKind = dbKindFor(kind, 'source');

  try {
    const result = await runAction(kind, input);
    const run = await createAiRun({
      kind: logKind,
      status: 'proposed',
      input: { action: kind, title: source.title, entityType: 'source' },
      output: result as unknown as Record<string, unknown>,
      entity_type: 'source',
      entity_id: sourceId,
    });
    return { ok: true, runId: run.id, result };
  } catch (err) {
    const message = err instanceof AIError ? err.message : 'فشل توليد الاقتراح.';
    try {
      await createAiRun({
        kind: logKind,
        status: 'failed',
        input: { action: kind, title: source.title, entityType: 'source' },
        output: { error: message },
        entity_type: 'source',
        entity_id: sourceId,
      });
    } catch {
      /* best-effort log */
    }
    return { ok: false, error: message };
  }
}

const ApplyInput = z.object({
  runId: uuid,
  sourceId: uuid,
  result: AiActionResult,
});

export type ApplyActionResult = { ok: true; note: string } | { ok: false; error: string };

/** Serialize a result into a readable Arabic note when there is no dedicated table. */
function resultToNote(result: AiActionResult): string {
  switch (result.kind) {
    case 'generate_review_questions':
      return ['أسئلة مراجعة:', ...result.questions.map((q, i) => `${i + 1}. ${q.q}${q.a ? `\n   ← ${q.a}` : ''}`)].join(
        '\n',
      );
    case 'generate_flashcards':
      return ['بطاقات مراجعة:', ...result.cards.map((c, i) => `${i + 1}. ${c.front}\n   → ${c.back}`)].join('\n');
    case 'generate_mindmap':
      return [
        'خريطة ذهنية مقترحة:',
        ...result.map.nodes.map((n) => `${n.parentId ? '  — ' : '• '}${n.label} (${n.kind})`),
      ].join('\n');
    case 'generate_opportunity_hypotheses':
      return [
        'فرضيات فرص (تحتاج تحققًا — ليست أرقامًا مؤكّدة):',
        ...result.opportunities.map(
          (o) => `• ${o.title} — ${o.hypothesis}\n   الأثر: ${o.impact} · الجهد: ${o.effort}\n   اختبار: ${o.testStep}`,
        ),
      ].join('\n');
    case 'generate_project_breakdown':
      return [
        'تفكيك إلى مراحل:',
        ...result.phases.map((ph) => `• ${ph.name}\n${ph.tasks.map((t) => `   - ${t}`).join('\n')}`),
      ].join('\n');
    default:
      return '';
  }
}

/**
 * Apply the user-approved (possibly edited) suggestion. Runs ONLY on an explicit
 * user click. Never deletes, never auto-activates a project, never fabricates
 * numbers. Kinds without a dedicated table are saved as a grounded content note
 * so nothing is lost (full persistence is proposed in Phase 7E).
 */
export async function applyAiActionAction(payloadRaw: unknown): Promise<ApplyActionResult> {
  let payload: z.infer<typeof ApplyInput>;
  try {
    payload = ApplyInput.parse(payloadRaw);
  } catch {
    return { ok: false, error: 'اقتراح غير صالح — رُفض.' };
  }
  const { runId, sourceId, result } = payload;

  try {
    const source = await getSource(sourceId);
    if (!source) return { ok: false, error: 'المصدر غير موجود.' };

    let note = 'تم الحفظ ✓';

    switch (result.kind) {
      case 'summarize_source': {
        await updateSource(sourceId, { summary: result.summary });
        note = 'حُدِّث ملخّص المصدر ✓';
        break;
      }
      case 'extract_key_ideas': {
        for (const idea of result.ideas) {
          const created = await createIdea({
            title: idea.title,
            note: idea.note,
            project_id: source.project_id,
          });
          await createLink('source', sourceId, 'idea', created.id);
        }
        note = `أُضيفت ${result.ideas.length} فكرة وربُطت بالمصدر ✓`;
        break;
      }
      case 'suggest_project_links': {
        const applied = result.links.filter((l) => l.projectId);
        if (applied.length === 0) {
          return { ok: false, error: 'لا مشروع محدّد للربط. اختر مشروعًا موجودًا أولًا.' };
        }
        for (const l of applied) {
          await createLink('source', sourceId, 'project', l.projectId!);
        }
        note = `رُبِط المصدر بـ ${applied.length} مشروع ✓`;
        break;
      }
      case 'suggest_next_action': {
        const projectId = source.project_id ?? (await getActiveProject())?.id ?? null;
        if (!projectId) {
          return {
            ok: false,
            error: 'لا مشروع نشط أو مرتبط. فعّل مشروعًا أو اربط المصدر بمشروع أولًا.',
          };
        }
        const task = await createTask({ title: result.nextAction, project_id: projectId, is_next_action: false });
        await createLink('source', sourceId, 'task', task.id);
        note = 'أُنشئت مهمة الخطوة التالية وربُطت بالمصدر ✓';
        break;
      }
      case 'generate_content_angles': {
        for (const a of result.angles) {
          await createContentItem({
            kind: a.contentType === 'summary' ? 'summary' : a.contentType,
            body: `${a.hook}\n\n${a.angle}`,
            status: 'draft',
            idea_id: null,
            source_id: sourceId,
          });
        }
        note = `أُنشئت ${result.angles.length} مسودّة محتوى من المصدر ✓`;
        break;
      }
      default: {
        // review questions / flashcards / mindmap / opportunities / breakdown:
        // no dedicated table yet — persist as a grounded content note (7E proposes tables).
        const body = resultToNote(result);
        if (!body) return { ok: false, error: 'لا شيء لحفظه.' };
        await createContentItem({ kind: 'summary', body, status: 'draft', idea_id: null, source_id: sourceId });
        note = 'حُفِظ كملاحظة مرتبطة بالمصدر ✓';
        break;
      }
    }

    await updateAiRun(runId, {
      status: 'approved',
      output: { ...(result as unknown as Record<string, unknown>), applied: true },
    });
    revalidateAll();
    return { ok: true, note };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'تعذّر تطبيق الاقتراح.' };
  }
}

export async function rejectAiActionAction(runId: string): Promise<ApplyActionResult> {
  try {
    uuid.parse(runId);
    await updateAiRun(runId, { status: 'rejected' });
    return { ok: true, note: 'رُفِض الاقتراح.' };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'تعذّر الرفض.' };
  }
}
