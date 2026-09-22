import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Card, EmptyState, Pill } from '@/components/ui';
import { ContextPanel, ContextSection } from '@/components/context/context-panel';
import { EntityLinkList, EntityProperties } from '@/components/context/context-parts';
import { EditProjectForm } from '../edit-form';
import { QuickTaskForm } from '@/app/(app)/tasks/quick-task-form';
import { TaskRow } from '@/app/(app)/tasks/task-row';
import { getGraph, getProject, listTasksForProject } from '@/lib/data';
import { neighborsOf } from '@/lib/graph';
import { priorityLabel, projectStatusLabel } from '@/lib/labels';

export const dynamic = 'force-dynamic';

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const project = await getProject(params.id);
  if (!project) notFound();

  const [tasks, graph] = await Promise.all([listTasksForProject(project.id), getGraph()]);
  const { backlinks } = neighborsOf(graph, 'project', project.id);
  const related = backlinks.filter((b) => b.kind !== 'رابط' && b.node.type !== 'task');
  const linked = backlinks.filter((b) => b.kind === 'رابط');

  const properties = [
    { label: 'الحالة', value: projectStatusLabel[project.status] ?? project.status },
    { label: 'الأولوية', value: priorityLabel[project.priority] ?? project.priority },
    { label: 'نشط', value: project.is_active ? 'نعم' : 'لا' },
    { label: 'الخطوة التالية', value: project.next_action || '—' },
    { label: 'أُنشئ', value: new Date(project.created_at).toLocaleDateString('ar') },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
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

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card title="تعديل المشروع">
            <EditProjectForm project={project} />
          </Card>

          <Card
            title="المهام"
            hint={`${tasks.filter((t) => t.status === 'done').length}/${tasks.length} منجزة`}
          >
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
        </div>

        <ContextPanel>
          <ContextSection title="الخصائص">
            <EntityProperties rows={properties} />
          </ContextSection>
          <ContextSection title="عناصر مرتبطة">
            <EntityLinkList items={related} empty="لا أفكار أو مصادر مرتبطة." />
          </ContextSection>
          <ContextSection title="روابط خلفية">
            <EntityLinkList items={linked} empty="لا روابط مباشرة بعد." />
          </ContextSection>
        </ContextPanel>
      </div>
    </div>
  );
}
