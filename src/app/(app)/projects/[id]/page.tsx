import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Card, EmptyState, Pill } from '@/components/ui';
import { EditProjectForm } from '../edit-form';
import { QuickTaskForm } from '@/app/(app)/tasks/quick-task-form';
import { TaskRow } from '@/app/(app)/tasks/task-row';
import { getProject, listIdeas, listSources, listTasksForProject } from '@/lib/data';
import { ideaStatusLabel, priorityLabel, projectStatusLabel, sourceKindLabel } from '@/lib/labels';

export const dynamic = 'force-dynamic';

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const project = await getProject(params.id);
  if (!project) notFound();

  const [tasks, allIdeas, allSources] = await Promise.all([
    listTasksForProject(project.id),
    listIdeas(),
    listSources(),
  ]);
  const ideas = allIdeas.filter((i) => i.project_id === project.id);
  const sources = allSources.filter((s) => s.project_id === project.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href="/projects" className="text-sm text-muted hover:text-text">
            ← المشاريع
          </Link>
          <h1 className="text-2xl font-bold">{project.title}</h1>
        </div>
        <div className="flex gap-1">
          {project.is_active && <Pill value="active" label="نشط" />}
          <Pill value={project.status} label={projectStatusLabel[project.status]} />
          <Pill value={project.priority} label={priorityLabel[project.priority]} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="تعديل المشروع">
          <EditProjectForm project={project} />
        </Card>

        <Card title="المهام" hint={`${tasks.filter((t) => t.status === 'done').length}/${tasks.length} منجزة`}>
          <div className="mb-3">
            <QuickTaskForm projectId={project.id} />
          </div>
          {tasks.length === 0 ? (
            <EmptyState label="لا مهام بعد." />
          ) : (
            <ul className="space-y-2">
              {tasks.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </ul>
          )}
        </Card>

        <Card title="الأفكار المرتبطة">
          {ideas.length === 0 ? (
            <EmptyState label="لا أفكار مرتبطة." />
          ) : (
            <ul className="space-y-2">
              {ideas.map((i) => (
                <li
                  key={i.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-bg px-3 py-2 text-sm"
                >
                  <span>{i.title}</span>
                  <Pill value={i.status} label={ideaStatusLabel[i.status]} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="المصادر المرتبطة">
          {sources.length === 0 ? (
            <EmptyState label="لا مصادر مرتبطة." />
          ) : (
            <ul className="space-y-2">
              {sources.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-bg px-3 py-2 text-sm"
                >
                  <span>{s.title}</span>
                  <Pill value="low" label={sourceKindLabel[s.kind]} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
