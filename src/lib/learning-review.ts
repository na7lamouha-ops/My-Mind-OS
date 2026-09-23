import type { ContentItem, Idea, Source, Task } from '@/schemas';
import type { Graph } from '@/lib/graph';
import { neighborsOf } from '@/lib/graph';

/**
 * Weekly Learning Review + Content repurposing (Phase 7D). Pure and computed
 * from existing data — every number is a real count, none are stored or
 * fabricated. It answers one question: did learning turn into action this week?
 */

const DAY = 24 * 60 * 60 * 1000;

export type LearningReview = {
  windowDays: number;
  sourcesAdded: number;
  sourcesLinked: number;
  ideasCaptured: number;
  draftsCreated: number;
  resultsProduced: number;
  /** Sources added in the window that are still unlinked — act before they fade. */
  unusedRecent: { id: string; title: string }[];
  /** knowledge → action conversion: linked ÷ total sources, 0..1 (null if none). */
  conversion: number | null;
};

export type LearningReviewInput = {
  sources: Source[];
  ideas: Idea[];
  content: ContentItem[];
  tasks: Task[];
  graph: Graph;
  windowDays?: number;
};

function within(iso: string, windowMs: number): boolean {
  return Date.now() - new Date(iso).getTime() <= windowMs;
}

export function computeLearningReview(input: LearningReviewInput): LearningReview {
  const { sources, ideas, content, tasks, graph, windowDays = 7 } = input;
  const win = windowDays * DAY;

  const isLinked = (id: string): boolean => {
    const { related, backlinks } = neighborsOf(graph, 'source', id);
    return related.length + backlinks.length > 0;
  };

  const recent = sources.filter((s) => within(s.created_at, win));
  const linkedSources = sources.filter((s) => isLinked(s.id));
  const unusedRecent = recent
    .filter((s) => !isLinked(s.id))
    .map((s) => ({ id: s.id, title: s.title }));

  return {
    windowDays,
    sourcesAdded: recent.length,
    sourcesLinked: linkedSources.length,
    ideasCaptured: ideas.filter((i) => within(i.created_at, win)).length,
    draftsCreated: content.filter((c) => within(c.created_at, win)).length,
    resultsProduced: tasks.filter((t) => t.status === 'done' && within(t.updated_at, win)).length,
    unusedRecent,
    conversion: sources.length ? linkedSources.length / sources.length : null,
  };
}

// ---- content repurposing ladder ------------------------------------------

export type RepurposeStage = {
  key: string;
  label: string;
  hint: string;
  done: boolean;
  /** The action to take when this is the first unfinished stage. */
  nextAction: string | null;
};

export type RepurposeState = {
  hasSummary: boolean;
  keyIdeaCount: number;
  linkedProjectCount: number;
  draftCount: number;
  resultCount: number;
};

/**
 * Source → Key idea → interpretation → relevance → angle → draft → result/lesson.
 * Each stage's `done` is derived from existing data; the first unfinished stage
 * gets a concrete next action so the pipeline never stalls silently.
 */
export function repurposeLadder(state: RepurposeState): RepurposeStage[] {
  const stages: Omit<RepurposeStage, 'nextAction'>[] = [
    { key: 'source', label: 'المصدر', hint: 'المصدر محفوظ', done: true },
    { key: 'key_idea', label: 'فكرة مفتاحية', hint: 'استُخرجت فكرة', done: state.keyIdeaCount > 0 },
    { key: 'interpretation', label: 'تفسير', hint: 'يوجد ملخّص/تفسير', done: state.hasSummary },
    { key: 'relevance', label: 'صلة بمشروع', hint: 'مرتبط بمشروع', done: state.linkedProjectCount > 0 },
    { key: 'angle', label: 'زاوية', hint: 'زاوية محتوى', done: state.draftCount > 0 },
    { key: 'draft', label: 'مسودّة', hint: 'مسودّة محتوى', done: state.draftCount > 0 },
    { key: 'result', label: 'نتيجة / درس', hint: 'نتيجة أو درس', done: state.resultCount > 0 },
  ];

  const actionFor: Record<string, string> = {
    key_idea: 'استخدم «أفكار مفتاحية» في الاستوديو واستخرج فكرة.',
    interpretation: 'استخدم «تلخيص» واعتمد تفسيرًا قصيرًا.',
    relevance: 'استخدم «ربط بمشروع» لربط المصدر بمشروع نشط.',
    angle: 'استخدم «زوايا محتوى» لتوليد زاوية.',
    draft: 'اعتمد زاوية لتصبح مسودّة محتوى.',
    result: 'أنشئ خطوة تالية أو سجّل الدرس المستفاد.',
  };

  let firstOpen = true;
  return stages.map((s) => {
    const isFirstOpen = !s.done && firstOpen;
    if (isFirstOpen) firstOpen = false;
    return { ...s, nextAction: isFirstOpen ? actionFor[s.key] ?? null : null };
  });
}
