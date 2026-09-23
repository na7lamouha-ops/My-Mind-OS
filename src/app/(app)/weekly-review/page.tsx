import Link from 'next/link';

import { Card, EmptyState, PageHeader } from '@/components/ui';
import { getActiveProject, getLearningReview, listAllTasks, listIdeas } from '@/lib/data';

export const metadata = { title: 'المراجعة الأسبوعية — My Mind OS' };
export const dynamic = 'force-dynamic';

export default async function WeeklyReviewPage() {
  const [active, tasks, ideas, learning] = await Promise.all([
    getActiveProject(),
    listAllTasks(),
    listIdeas(),
    getLearningReview(),
  ]);

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const doneThisWeek = tasks.filter(
    (t) => t.status === 'done' && new Date(t.updated_at).getTime() >= weekAgo,
  );
  const inProgress = tasks.filter((t) => t.status === 'doing');
  const inbox = ideas.filter((i) => i.status === 'inbox');
  const snoozed = ideas.filter((i) => i.status === 'snoozed');

  const List = ({ items }: { items: { id: string; title: string }[] }) =>
    items.length === 0 ? (
      <EmptyState label="لا شيء." />
    ) : (
      <ul className="space-y-1.5 text-sm">
        {items.map((x) => (
          <li key={x.id} className="rounded-lg border border-border bg-bg px-3 py-1.5">
            {x.title}
          </li>
        ))}
      </ul>
    );

  return (
    <div>
      <PageHeader
        title="المراجعة الأسبوعية"
        subtitle="لقطة حيّة لأسبوعك — تُحسب من بياناتك الآن (الحفظ التاريخي يأتي لاحقًا)."
      />

      {/* Learning review — did learning turn into action this week? */}
      <Card title="مراجعة التعلّم" hint={`آخر ${learning.windowDays} أيام`}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            { label: 'مصادر أُضيفت', value: learning.sourcesAdded },
            { label: 'مصادر مرتبطة', value: learning.sourcesLinked },
            { label: 'أفكار التُقطت', value: learning.ideasCaptured },
            { label: 'مسودّات', value: learning.draftsCreated },
            { label: 'نتائج', value: learning.resultsProduced },
          ].map((m) => (
            <div key={m.label} className="rounded-xl border border-border bg-bg p-3 text-center">
              <p className="text-xl font-bold ltr-num">{m.value}</p>
              <p className="text-[11px] text-muted">{m.label}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-muted">تحويل المعرفة إلى عمل (مصادر مرتبطة):</span>
          <span className="font-semibold text-link ltr-num">
            {learning.conversion === null ? '—' : `${Math.round(learning.conversion * 100)}%`}
          </span>
        </div>
        {learning.unusedRecent.length > 0 && (
          <div className="mt-3">
            <p className="mb-1 text-xs font-semibold text-warning">
              مصادر حديثة بلا ربط — تصرّف قبل أن تُنسى:
            </p>
            <ul className="space-y-1.5 text-sm">
              {learning.unusedRecent.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/knowledge/${s.id}`}
                    className="block truncate rounded-lg border border-border bg-bg px-3 py-1.5 hover:text-link"
                  >
                    {s.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="ماذا أنجزت؟" hint={`${doneThisWeek.length} هذا الأسبوع`}>
          <List items={doneThisWeek} />
        </Card>

        <Card title="ماذا تعطّل؟" hint={`${inProgress.length} قيد التنفيذ`}>
          <List items={inProgress} />
        </Card>

        <Card title="المشروع النشط والخطوة التالية">
          {active ? (
            <div className="text-sm">
              <Link href={`/projects/${active.id}`} className="font-semibold hover:text-link">
                {active.title}
              </Link>
              <p className="mt-1 text-muted">
                الخطوة التالية: {active.next_action || '— لم تُحدَّد —'}
              </p>
            </div>
          ) : (
            <EmptyState label="لا مشروع نشط. فعّل واحدًا من المشاريع." />
          )}
        </Card>

        <Card title="ما يحتاج قرارًا / تنظيمًا" hint={`${inbox.length} وارد`}>
          <List items={inbox} />
        </Card>

        <Card title="ما يُؤجَّل (مؤجّل)" hint={`${snoozed.length}`}>
          <List items={snoozed} />
        </Card>
      </div>
    </div>
  );
}
