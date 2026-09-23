import type { Idea, Project, Source, Task } from '@/schemas';
import type { Graph } from '@/lib/graph';
import { neighborsOf } from '@/lib/graph';

/**
 * Opportunity Radar + MANQUE À GAGNER (Phase 7B). A PURE, deterministic engine
 * that derives opportunities from the user's EXISTING data only. It never
 * invents financial numbers — the only quantities it uses are real counts of
 * real records. Three layers:
 *   - confirmed: a real asset already in hand (fact, not a guess).
 *   - potential: a hypothesis that needs a small test before you trust it.
 *   - missed  : value that leaked away, with a cause and a recovery test
 *               (MANQUE À GAGNER). Descriptive only — no fabricated amounts.
 */

export type OpportunityLayer = 'confirmed' | 'potential' | 'missed';

export type RadarItem = {
  id: string;
  layer: OpportunityLayer;
  title: string;
  detail: string;
  cause: string | null;
  projectId: string | null;
  projectTitle: string | null;
  preventiveAction: string | null;
  recoveryTest: string | null;
  /** Computed default; real persistence is proposed in Phase 7E. */
  status: 'open';
};

export type RadarInput = {
  projects: Project[];
  ideas: Idea[];
  sources: Source[];
  tasks: Task[];
  graph: Graph;
};

const DAY = 24 * 60 * 60 * 1000;
const STALE_INBOX_DAYS = 14;
const FORGOTTEN_SOURCE_DAYS = 21;

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / DAY);
}

function base(id: string, layer: OpportunityLayer, title: string, detail: string): RadarItem {
  return {
    id,
    layer,
    title,
    detail,
    cause: null,
    projectId: null,
    projectTitle: null,
    preventiveAction: null,
    recoveryTest: null,
    status: 'open',
  };
}

export type RadarSummary = { confirmed: number; potential: number; missed: number };

export function radarSummary(items: RadarItem[]): RadarSummary {
  return {
    confirmed: items.filter((i) => i.layer === 'confirmed').length,
    potential: items.filter((i) => i.layer === 'potential').length,
    missed: items.filter((i) => i.layer === 'missed').length,
  };
}

/** Derive the radar from existing data. Deterministic; no numbers are invented. */
export function computeRadar(input: RadarInput): RadarItem[] {
  const { projects, ideas, sources, tasks, graph } = input;
  const items: RadarItem[] = [];

  const isSourceLinked = (id: string): boolean => {
    const { related, backlinks } = neighborsOf(graph, 'source', id);
    return [...related, ...backlinks].some((n) => n.node.type === 'project' || n.node.type === 'idea' || n.node.type === 'task');
  };

  // ---- confirmed: assets already in hand (real counts) --------------------
  const linkedSources = sources.filter((s) => isSourceLinked(s.id));
  if (linkedSources.length > 0) {
    items.push({
      ...base(
        'confirmed:linked-sources',
        'confirmed',
        'معرفة مُستثمَرة فعليًا',
        `${linkedSources.length} مصدر مرتبط بمشروع أو فكرة — معرفة تحوّلت إلى مسار عمل.`,
      ),
    });
  }
  const organizedIdeas = ideas.filter((i) => i.status === 'organized');
  if (organizedIdeas.length > 0) {
    items.push(
      base(
        'confirmed:organized-ideas',
        'confirmed',
        'أفكار وصلت إلى التنفيذ',
        `${organizedIdeas.length} فكرة نُظّمت وربُطت بمسار عمل بدل أن تتبخّر.`,
      ),
    );
  }
  const doneTasks = tasks.filter((t) => t.status === 'done');
  if (doneTasks.length > 0) {
    items.push(
      base(
        'confirmed:done-tasks',
        'confirmed',
        'نتائج منجزة',
        `${doneTasks.length} مهمة منجزة — تقدّم حقيقي نحو الأهداف.`,
      ),
    );
  }

  // ---- potential: hypotheses that need a small test -----------------------
  for (const s of sources) {
    if (!isSourceLinked(s.id)) {
      const it = base(
        `potential:unused-source:${s.id}`,
        'potential',
        `مصدر غير مستثمَر: ${s.title}`,
        'معرفة محفوظة لكنها غير مرتبطة بأي مشروع أو فكرة بعد.',
      );
      it.recoveryTest = 'افتح دفتر المصدر واستخرج فكرة واحدة أو اربطه بمشروع نشط خلال ٢٥ دقيقة.';
      items.push(it);
    } else if (!s.summary) {
      const it = base(
        `potential:undistilled-source:${s.id}`,
        'potential',
        `معرفة غير مُقطّرة: ${s.title}`,
        'المصدر مرتبط لكن بلا ملخّص — قد تُنسى خلاصته.',
      );
      it.recoveryTest = 'استخدم «تلخيص» في الاستوديو واعتمد ملخّصًا قصيرًا.';
      items.push(it);
    }
  }
  const activeNoNext = projects.filter((p) => p.is_active && !p.next_action);
  for (const p of activeNoNext) {
    const it = base(
      `potential:no-next:${p.id}`,
      'potential',
      `مشروع نشط بلا خطوة تالية: ${p.title}`,
      'المشروع نشط لكن لا خطوة تالية محدّدة — خطر فقدان الزخم.',
    );
    it.projectId = p.id;
    it.projectTitle = p.title;
    it.recoveryTest = 'حدّد أصغر خطوة قابلة للتنفيذ الآن كخطوة تالية.';
    items.push(it);
  }

  // ---- missed: value that leaked (MANQUE À GAGNER) ------------------------
  for (const i of ideas) {
    if ((i.status === 'archived' || i.status === 'snoozed') && !i.project_id) {
      const it = base(
        `missed:dropped-idea:${i.id}`,
        'missed',
        `فكرة سقطت دون تنفيذ: ${i.title}`,
        'فكرة أُرشفت أو أُجّلت ولم تتحوّل إلى مشروع أو مهمة.',
      );
      it.cause = 'لم تُربط بمشروع ولم تُحوَّل إلى خطوة قبل تأجيلها.';
      it.preventiveAction = 'قبل تأجيل أي فكرة، اربطها بمشروع أو حوّلها إلى مهمة صغيرة.';
      it.recoveryTest = 'أعد تقييمها: هل تخدم هدفًا نشطًا؟ إن نعم، حوّلها إلى مشروع أو مهمة.';
      items.push(it);
    }
  }
  const stalledInbox = ideas.filter(
    (i) => i.status === 'inbox' && daysSince(i.created_at) >= STALE_INBOX_DAYS,
  );
  if (stalledInbox.length > 0) {
    const it = base(
      'missed:stalled-inbox',
      'missed',
      'أفكار عالقة في الوارد',
      `${stalledInbox.length} فكرة في الوارد منذ أكثر من ${STALE_INBOX_DAYS} يومًا دون قرار.`,
    );
    it.cause = 'تراكم في الالتقاط دون مراجعة دورية.';
    it.preventiveAction = 'راجعة أسبوعية ثابتة تُفرّغ الوارد إلى قرار أو مشروع أو أرشفة واعية.';
    it.recoveryTest = 'خصّص ١٥ دقيقة لتصنيف كل فكرة عالقة الآن.';
    items.push(it);
  }
  const forgottenSources = sources.filter(
    (s) => !isSourceLinked(s.id) && daysSince(s.created_at) >= FORGOTTEN_SOURCE_DAYS,
  );
  if (forgottenSources.length > 0) {
    const it = base(
      'missed:forgotten-sources',
      'missed',
      'مصادر منسيّة',
      `${forgottenSources.length} مصدر مضى عليه أكثر من ${FORGOTTEN_SOURCE_DAYS} يومًا دون ربط أو خلاصة.`,
    );
    it.cause = 'حُفظت المصادر دون خطوة استخلاص أو ربط.';
    it.preventiveAction = 'لكل مصدر جديد: استخرج فكرة واحدة أو اربطه بمشروع في نفس الجلسة.';
    it.recoveryTest = 'اختر أقدم مصدر وطبّق عليه إجراء استوديو واحدًا اليوم.';
    items.push(it);
  }
  for (const p of projects) {
    if (p.status !== 'paused') continue;
    const own = tasks.filter((t) => t.project_id === p.id);
    const openTasks = own.filter((t) => t.status !== 'done');
    if (openTasks.length > 0) {
      const it = base(
        `missed:paused-project:${p.id}`,
        'missed',
        `مشروع متوقف بمهام مفتوحة: ${p.title}`,
        `${openTasks.length} مهمة غير منجزة في مشروع متوقّف — قيمة معلّقة.`,
      );
      it.cause = 'أُوقف المشروع دون إغلاق أو إعادة جدولة لمهامه.';
      it.preventiveAction = 'عند إيقاف مشروع، أغلق مهامه أو انقلها إلى مشروع آخر بوعي.';
      it.recoveryTest = 'قرّر: استئناف، أو إغلاق المهام، أو نقلها — لا تتركها معلّقة.';
      it.projectId = p.id;
      it.projectTitle = p.title;
      items.push(it);
    }
  }

  return items;
}
