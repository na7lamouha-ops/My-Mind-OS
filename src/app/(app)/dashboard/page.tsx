import Link from 'next/link';

import { Card, EmptyState, PageHeader, Pill } from '@/components/ui';
import { TaskRow } from '@/app/(app)/tasks/task-row';
import { getDashboard } from '@/lib/data';
import { priorityLabel, projectStatusLabel, sourceKindLabel } from '@/lib/labels';

export const metadata = { title: 'اللوحة — My Mind OS' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { activeProject, activeTasks, inboxCount, recentSources, progress } = await getDashboard();

  return (
    <div>
      <PageHeader title="اللوحة" subtitle="هل نقترب من الهدف؟ مشروعك النشط وخطوتك التالية." />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="المشروع النشط" hint="واحد فقط">
            {activeProject ? (
              <div>
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/projects/${activeProject.id}`} className="text-lg font-semibold hover:text-link">
                    {activeProject.title}
                  </Link>
                  <Pill value={activeProject.priority} label={priorityLabel[activeProject.priority]} />
                </div>
                <p className="mt-2 text-sm">
                  <span className="text-muted">الخطوة التالية: </span>
                  {activeProject.next_action || <span className="text-muted">— لم تُحدَّد —</span>}
                </p>
              </div>
            ) : (
              <EmptyState label="لا مشروع نشط. فعّل مشروعًا من صفحة المشاريع." />
            )}
          </Card>

          <Card title="مهام المشروع النشط" hint={activeProject ? `${activeTasks.length} مفتوحة` : ''}>
            {activeTasks.length === 0 ? (
              <EmptyState label="لا مهام مفتوحة للمشروع النشط." />
            ) : (
              <ul className="space-y-2">
                {activeTasks.map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="الوارد">
            {inboxCount > 0 ? (
              <Link href="/inbox" className="flex items-center justify-between text-sm hover:text-link">
                <span>أفكار بانتظار التنظيم</span>
                <span className="rounded-full bg-accent/15 px-2 py-0.5 font-semibold text-link ltr-num">
                  {inboxCount}
                </span>
              </Link>
            ) : (
              <EmptyState label="الوارد فارغ ✓" />
            )}
          </Card>

          <Card title="مصادر جديدة">
            {recentSources.length === 0 ? (
              <EmptyState label="لا مصادر بعد." />
            ) : (
              <ul className="space-y-2">
                {recentSources.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">{s.title}</span>
                    <Pill value="low" label={sourceKindLabel[s.kind]} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="تقدّم المشاريع">
            {progress.length === 0 ? (
              <EmptyState label="لا مشاريع بعد." />
            ) : (
              <ul className="space-y-3">
                {progress.map(({ project, total, done }) => {
                  const pct = total ? Math.round((done / total) * 100) : 0;
                  return (
                    <li key={project.id}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="truncate">{project.title}</span>
                        <span className="text-muted">
                          <span className="ltr-num">
                            {done}/{total}
                          </span>{' '}
                          · {projectStatusLabel[project.status]}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-bg">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
