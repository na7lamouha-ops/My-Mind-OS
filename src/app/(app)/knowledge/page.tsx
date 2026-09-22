import { Card, EmptyState, PageHeader, Pill } from '@/components/ui';
import { SourceForm } from './source-form';
import { listIdeas, listProjects, listSources } from '@/lib/data';
import { sourceKindLabel } from '@/lib/labels';

export const metadata = { title: 'المعرفة — My Mind OS' };
export const dynamic = 'force-dynamic';

export default async function KnowledgePage() {
  const [sources, projects, ideas] = await Promise.all([
    listSources(),
    listProjects(),
    listIdeas(),
  ]);
  const projectName = new Map(projects.map((p) => [p.id, p.title]));

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <div>
        <PageHeader title="المعرفة" subtitle="احفظ مصادرك وملخصاتها واربطها بمشاريعك." />
        <Card title="مصدر جديد">
          <SourceForm
            projects={projects.map((p) => ({ id: p.id, title: p.title }))}
            ideas={ideas.map((i) => ({ id: i.id, title: i.title }))}
          />
        </Card>
      </div>

      <div>
        {sources.length === 0 ? (
          <EmptyState label="لا مصادر بعد — أضِف أول مصدر." />
        ) : (
          <ul className="space-y-3">
            {sources.map((s) => (
              <li key={s.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{s.title}</p>
                    {s.url && /^https?:\/\//i.test(s.url) && (
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        dir="ltr"
                        className="mt-0.5 block truncate text-xs text-link hover:underline"
                      >
                        {s.url}
                      </a>
                    )}
                    {s.summary && (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{s.summary}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Pill value="low" label={sourceKindLabel[s.kind]} />
                    {s.project_id && (
                      <span className="text-xs text-muted">{projectName.get(s.project_id) ?? '—'}</span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
