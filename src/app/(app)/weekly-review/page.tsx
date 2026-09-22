import Link from 'next/link';

import { Card, EmptyState, PageHeader } from '@/components/ui';
import { getActiveProject, listAllTasks, listIdeas } from '@/lib/data';

export const metadata = { title: 'المراجعة الأسبوعية — My Mind OS' };
export const dynamic = 'force-dynamic';

export default async function WeeklyReviewPage() {
  const [active, tasks, ideas] = await Promise.all([
    getActiveProject(),
    listAllTasks(),
    listIdeas(),
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

      <div className="grid gap-4 lg:grid-cols-2">
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
