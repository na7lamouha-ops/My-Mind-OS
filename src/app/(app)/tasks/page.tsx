import { Card, EmptyState, PageHeader } from '@/components/ui';
import { QuickTaskForm } from './quick-task-form';
import { TaskRow } from './task-row';
import { getActiveProject, listAllTasks, listProjects } from '@/lib/data';

export const metadata = { title: 'المهام — My Mind OS' };
export const dynamic = 'force-dynamic';

export default async function TasksPage() {
  const [tasks, projects, active] = await Promise.all([
    listAllTasks(),
    listProjects(),
    getActiveProject(),
  ]);
  const projectName = new Map(projects.map((p) => [p.id, p.title]));
  const open = tasks.filter((t) => t.status !== 'done');
  const done = tasks.filter((t) => t.status === 'done');

  return (
    <div className="space-y-6">
      <PageHeader title="المهام" subtitle="كل المهام عبر المشاريع، مع إبراز الخطوة التالية." />

      {active ? (
        <Card title={`إضافة مهمة إلى المشروع النشط: ${active.title}`}>
          <QuickTaskForm projectId={active.id} />
        </Card>
      ) : (
        <Card title="إضافة مهمة">
          <EmptyState label="فعّل مشروعًا نشطًا من صفحة المشاريع لإضافة مهام سريعة." />
        </Card>
      )}

      <Card title="مهام مفتوحة" hint={`${open.length}`}>
        {open.length === 0 ? (
          <EmptyState label="لا مهام مفتوحة." />
        ) : (
          <ul className="space-y-2">
            {open.map((t) => (
              <TaskRow key={t.id} task={t} projectName={projectName.get(t.project_id)} />
            ))}
          </ul>
        )}
      </Card>

      {done.length > 0 && (
        <Card title="مهام منجزة" hint={`${done.length}`}>
          <ul className="space-y-2">
            {done.map((t) => (
              <TaskRow key={t.id} task={t} projectName={projectName.get(t.project_id)} />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
