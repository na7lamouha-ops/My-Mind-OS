import Link from 'next/link';

import { SubmitButton } from '@/components/form';
import { Card, EmptyState, PageHeader, Pill } from '@/components/ui';
import { archiveCmd, setActiveCmd } from './actions';
import { CreateProjectForm } from './create-form';
import { listProjects } from '@/lib/data';
import { priorityLabel, projectStatusLabel } from '@/lib/labels';

export const metadata = { title: 'المشاريع — My Mind OS' };
export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  const projects = await listProjects();

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <div>
        <PageHeader title="المشاريع" subtitle="مشروع نشط واحد فقط في كل مرة." />
        <Card title="مشروع جديد">
          <CreateProjectForm />
        </Card>
      </div>

      <div>
        {projects.length === 0 ? (
          <EmptyState label="لا مشاريع بعد — أنشئ أول مشروع." />
        ) : (
          <ul className="space-y-3">
            {projects.map((p) => (
              <li
                key={p.id}
                className={`rounded-xl border bg-surface p-4 ${
                  p.is_active ? 'border-accent' : 'border-border'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link href={`/projects/${p.id}`} className="font-medium hover:text-accent">
                      {p.title}
                    </Link>
                    {p.next_action && (
                      <p className="mt-1 text-sm text-muted">الخطوة التالية: {p.next_action}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {p.is_active && <Pill value="active" label="نشط" />}
                    <Pill value={p.status} label={projectStatusLabel[p.status]} />
                    <Pill value={p.priority} label={priorityLabel[p.priority]} />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {!p.is_active && p.status !== 'archived' && (
                    <form action={setActiveCmd}>
                      <input type="hidden" name="id" value={p.id} />
                      <SubmitButton size="sm" variant="primary">
                        اجعله النشط
                      </SubmitButton>
                    </form>
                  )}
                  <Link
                    href={`/projects/${p.id}`}
                    className="rounded-lg border border-border px-2.5 py-1 text-xs hover:bg-bg"
                  >
                    التفاصيل
                  </Link>
                  {p.status !== 'archived' && (
                    <form action={archiveCmd}>
                      <input type="hidden" name="id" value={p.id} />
                      <SubmitButton size="sm" variant="ghost">
                        أرشِف
                      </SubmitButton>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
