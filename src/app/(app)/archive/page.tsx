import Link from 'next/link';

import { Card, EmptyState, PageHeader, Pill } from '@/components/ui';
import { listArchivedIdeas, listProjects } from '@/lib/data';
import { ideaStatusLabel, projectStatusLabel } from '@/lib/labels';

export const metadata = { title: 'الأرشيف — My Mind OS' };
export const dynamic = 'force-dynamic';

export default async function ArchivePage() {
  const [archivedIdeas, projects] = await Promise.all([listArchivedIdeas(), listProjects()]);
  const archivedProjects = projects.filter((p) => p.status === 'archived');

  return (
    <div>
      <PageHeader
        title="الأرشيف"
        subtitle="الأفكار المؤجّلة/المؤرشفة والمشاريع المؤرشفة — محفوظة لا محذوفة."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="أفكار مؤجّلة / مؤرشفة" hint={`${archivedIdeas.length}`}>
          {archivedIdeas.length === 0 ? (
            <EmptyState label="لا أفكار مؤرشفة." />
          ) : (
            <ul className="space-y-2">
              {archivedIdeas.map((i) => (
                <li
                  key={i.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border bg-bg px-3 py-2 text-sm"
                >
                  <span className="truncate">{i.title}</span>
                  <Pill value={i.status} label={ideaStatusLabel[i.status]} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="مشاريع مؤرشفة" hint={`${archivedProjects.length}`}>
          {archivedProjects.length === 0 ? (
            <EmptyState label="لا مشاريع مؤرشفة." />
          ) : (
            <ul className="space-y-2">
              {archivedProjects.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border bg-bg px-3 py-2 text-sm"
                >
                  <Link href={`/projects/${p.id}`} className="truncate hover:text-link">
                    {p.title}
                  </Link>
                  <Pill value={p.status} label={projectStatusLabel[p.status]} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
