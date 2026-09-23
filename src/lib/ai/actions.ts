import { z } from 'zod';

import { AIError } from './types';

/**
 * Extended AI action framework (Phase 7). Every action is Mock-backed, returns
 * a strictly-validated, source-grounded suggestion, and is applied only on
 * explicit user approval. Nothing here calls a real API or stores secrets.
 */

export const AiActionKind = z.enum([
  'summarize_source',
  'extract_key_ideas',
  'suggest_project_links',
  'suggest_next_action',
  'generate_review_questions',
  'generate_flashcards',
  'generate_mindmap',
  'generate_opportunity_hypotheses',
  'generate_content_angles',
  'generate_project_breakdown',
]);
export type AiActionKind = z.infer<typeof AiActionKind>;

export const EntityType = z.enum(['project', 'idea', 'source', 'task', 'content_item']);
export const Grounding = z.enum(['extracted', 'inference', 'suggestion', 'needs_verification']);
export const RelationType = z.enum(['معرفة', 'فرصة', 'خطر', 'تحسين', 'دخل محتمل']);
export const OppLayer = z.enum(['confirmed', 'potential', 'missed']);

export const SourceRef = z.object({
  entityType: EntityType,
  entityId: z.string(),
  quote: z.string().max(400).nullable(),
});

const meta = {
  confidence: z.number().min(0).max(1),
  explanation: z.string().min(1).max(600),
  grounding: Grounding,
  sourceRefs: z.array(SourceRef),
};

// ---- mind map (Zod mirror of src/lib/mindmap.ts types) --------------------
const MindMapNodeZ = z.object({
  id: z.string(),
  label: z.string().min(1),
  kind: z.enum(['root', 'concept', 'idea', 'project', 'task', 'source', 'opportunity']),
  parentId: z.string().optional(),
  entityId: z.string().optional(),
  status: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});
const MindMapEdgeZ = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  relation: z.enum(['supports', 'depends_on', 'derived_from', 'blocks', 'creates', 'related']),
});

export const AiActionResult = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('summarize_source'), summary: z.string().min(1).max(2000), ...meta }),
  z.object({
    kind: z.literal('extract_key_ideas'),
    ideas: z.array(z.object({ title: z.string().min(1).max(300), note: z.string().max(2000).nullable() })).min(1),
    ...meta,
  }),
  z.object({
    kind: z.literal('suggest_project_links'),
    links: z
      .array(
        z.object({
          projectId: z.string().nullable(),
          projectHint: z.string().min(1).max(200),
          reason: z.string().min(1).max(400),
          relationType: RelationType,
          relevance: z.number().min(0).max(1),
          opportunity: z.string().max(400).nullable(),
        }),
      )
      .min(1),
    ...meta,
  }),
  z.object({ kind: z.literal('suggest_next_action'), nextAction: z.string().min(1).max(300), ...meta }),
  z.object({
    kind: z.literal('generate_review_questions'),
    questions: z.array(z.object({ q: z.string().min(1).max(400), a: z.string().max(800).nullable() })).min(1),
    ...meta,
  }),
  z.object({
    kind: z.literal('generate_flashcards'),
    cards: z.array(z.object({ front: z.string().min(1).max(300), back: z.string().min(1).max(600) })).min(1),
    ...meta,
  }),
  z.object({
    kind: z.literal('generate_mindmap'),
    map: z.object({ nodes: z.array(MindMapNodeZ).min(1), edges: z.array(MindMapEdgeZ) }),
    ...meta,
  }),
  z.object({
    kind: z.literal('generate_opportunity_hypotheses'),
    opportunities: z
      .array(
        z.object({
          title: z.string().min(1).max(200),
          hypothesis: z.string().min(1).max(400),
          layer: OppLayer,
          impact: z.string().min(1).max(200),
          effort: z.string().min(1).max(120),
          testStep: z.string().min(1).max(300),
        }),
      )
      .min(1),
    ...meta,
  }),
  z.object({
    kind: z.literal('generate_content_angles'),
    angles: z
      .array(
        z.object({
          hook: z.string().min(1).max(300),
          angle: z.string().min(1).max(300),
          contentType: z.enum(['hook', 'script', 'post', 'summary']),
        }),
      )
      .min(1),
    ...meta,
  }),
  z.object({
    kind: z.literal('generate_project_breakdown'),
    phases: z
      .array(z.object({ name: z.string().min(1).max(160), tasks: z.array(z.string().min(1).max(200)).min(1) }))
      .min(1),
    ...meta,
  }),
]);
export type AiActionResult = z.infer<typeof AiActionResult>;

export type AiActionInput = {
  entityType: z.infer<typeof EntityType>;
  entityId: string;
  title: string;
  text: string;
  projects: { id: string; title: string }[];
};

/** Which DB ai_runs.kind (constrained enum) to log a given action under. */
export function dbKindFor(kind: AiActionKind, entityType: string): 'organize_idea' | 'summarize_source' | 'generate_content' {
  if (kind === 'generate_content_angles') return 'generate_content';
  if (entityType === 'source') return 'summarize_source';
  return 'organize_idea';
}

function clampText(t: string, n: number): string {
  const s = t.replace(/\s+/g, ' ').trim();
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}

/**
 * Deterministic Mock action runner. Produces a schema-valid, grounded result
 * for each kind from the entity text. No API, no key, no cost.
 */
export function runActionMock(kind: AiActionKind, input: AiActionInput): AiActionResult {
  const ref = [{ entityType: input.entityType, entityId: input.entityId, quote: null }];
  const body = `${input.title}\n${input.text}`.trim();
  const base = {
    confidence: 0.55,
    explanation: `اقتراح تجريبي (Mock) مبنيّ على نص «${clampText(input.title, 40)}» — يحتاج تحققًا بشريًا.`,
    grounding: 'suggestion' as const,
    sourceRefs: ref,
  };

  switch (kind) {
    case 'summarize_source':
      return { kind, summary: clampText(body, 400) || input.title, ...base, grounding: 'extracted' };
    case 'extract_key_ideas':
      return {
        kind,
        ideas: [
          { title: clampText(`فكرة من: ${input.title}`, 120), note: null },
          { title: 'تطبيق عملي واحد لهذا المصدر', note: null },
        ],
        ...base,
        grounding: 'inference',
      };
    case 'suggest_project_links':
      return {
        kind,
        links: (input.projects.length ? input.projects : [{ id: '', title: 'مشروع جديد مقترح' }])
          .slice(0, 3)
          .map((p, i) => ({
            projectId: p.id || null,
            projectHint: p.title,
            reason: 'تشابه في الموضوع/الكلمات المفتاحية مع هذا العنصر.',
            relationType: (['معرفة', 'فرصة', 'تحسين'] as const)[i % 3]!,
            relevance: 0.6 - i * 0.1,
            opportunity: i === 1 ? 'قد يفتح زاوية دخل غير مختبرة — يحتاج تحققًا.' : null,
          })),
        ...base,
      };
    case 'suggest_next_action':
      return { kind, nextAction: 'حدّد أصغر خطوة قابلة للتنفيذ خلال ٢٥ دقيقة لتطبيق هذا.', ...base };
    case 'generate_review_questions':
      return {
        kind,
        questions: [
          { q: `ما الفكرة الأساسية في «${clampText(input.title, 40)}»؟`, a: null },
          { q: 'أين يمكن تطبيق هذه المعرفة في مشروع نشط؟', a: null },
        ],
        ...base,
        grounding: 'inference',
      };
    case 'generate_flashcards':
      return {
        kind,
        cards: [
          { front: `المفهوم في: ${clampText(input.title, 60)}`, back: clampText(body, 200) || 'الملخّص' },
          { front: 'متى أستخدمه؟', back: 'اربطه بالمشروع النشط وخطوته التالية.' },
        ],
        ...base,
        grounding: 'inference',
      };
    case 'generate_mindmap': {
      const root = `root:${input.entityId}`;
      return {
        kind,
        map: {
          nodes: [
            { id: root, label: clampText(input.title, 60), kind: 'root', entityId: input.entityId },
            { id: `c1:${input.entityId}`, label: 'مفهوم رئيسي', kind: 'concept', parentId: root },
            { id: `c2:${input.entityId}`, label: 'تطبيق عملي', kind: 'concept', parentId: root },
            { id: `o1:${input.entityId}`, label: 'فرصة محتملة', kind: 'opportunity', parentId: root },
          ],
          edges: [
            { id: 'm1', source: `c1:${input.entityId}`, target: root, relation: 'supports' },
            { id: 'm2', source: `c2:${input.entityId}`, target: root, relation: 'derived_from' },
            { id: 'm3', source: `o1:${input.entityId}`, target: root, relation: 'creates' },
          ],
        },
        ...base,
      };
    }
    case 'generate_opportunity_hypotheses':
      return {
        kind,
        opportunities: [
          {
            title: 'زاوية دخل غير مختبرة',
            hypothesis: 'يمكن تحويل هذه المعرفة إلى منتج/خدمة صغيرة.',
            layer: 'potential',
            impact: 'دخل محتمل غير مؤكّد',
            effort: 'منخفض',
            testStep: 'اعرض الفكرة على ٣ أشخاص من الجمهور المستهدف.',
          },
        ],
        ...base,
        grounding: 'needs_verification',
      };
    case 'generate_content_angles':
      return {
        kind,
        angles: [
          { hook: `٣ دروس من «${clampText(input.title, 40)}»`, angle: 'درس شخصي مطبّق', contentType: 'post' },
          { hook: 'الخطأ الذي يقع فيه الجميع', angle: 'تفنيد شائع', contentType: 'script' },
        ],
        ...base,
      };
    case 'generate_project_breakdown':
      return {
        kind,
        phases: [
          { name: 'التحقّق', tasks: ['تعريف النتيجة المطلوبة', 'أصغر اختبار ممكن'] },
          { name: 'البناء', tasks: ['أول نسخة قابلة للاستخدام'] },
          { name: 'القياس', tasks: ['جمع أول تغذية راجعة'] },
        ],
        ...base,
        grounding: 'inference',
      };
    default:
      throw new AIError('نوع إجراء غير مدعوم.');
  }
}

/** Timeout + single retry around the (sync) mock, returning a validated result. */
export async function runAction(kind: AiActionKind, input: AiActionInput): Promise<AiActionResult> {
  const attempt = () => AiActionResult.parse(runActionMock(kind, input));
  try {
    return attempt();
  } catch {
    try {
      return attempt();
    } catch (err) {
      throw new AIError(err instanceof Error ? err.message : 'فشل توليد الاقتراح.');
    }
  }
}
