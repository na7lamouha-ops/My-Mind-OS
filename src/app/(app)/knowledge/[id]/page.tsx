import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowUpRight, Sparkles } from 'lucide-react';

import { Card, EmptyState, Pill } from '@/components/ui';
import { ContextPanel, ContextSection } from '@/components/context/context-panel';
import { EntityLinkList, EntityProperties } from '@/components/context/context-parts';
import { RepurposeLadder } from '@/components/repurpose-ladder';
import { SourceStudio } from '@/components/source-studio';
import { getGraph, getSource, listContentItems, listProjects } from '@/lib/data';
import { neighborsOf } from '@/lib/graph';
import { repurposeLadder } from '@/lib/learning-review';
import { sourceKindLabel } from '@/lib/labels';

export const dynamic = 'force-dynamic';

export default async function SourceNotebookPage({ params }: { params: { id: string } }) {
  const source = await getSource(params.id);
  if (!source) notFound();

  const [graph, projects, content] = await Promise.all([getGraph(), listProjects(), listContentItems()]);
  const { related, backlinks } = neighborsOf(graph, 'source', source.id);
  const all = [...related, ...backlinks];
  const linkedProjects = all.filter((n) => n.node.type === 'project');
  const linkedIdeas = all.filter((n) => n.node.type === 'idea');
  const linkedTasks = all.filter((n) => n.node.type === 'task');
  const notes = content.filter((c) => c.source_id === source.id);

  const activeProject = projects.find((p) => p.is_active) ?? null;

  const ladder = repurposeLadder({
    hasSummary: Boolean(source.summary),
    keyIdeaCount: linkedIdeas.length,
    linkedProjectCount: linkedProjects.length,
    draftCount: notes.length,
    resultCount: linkedTasks.length,
  });

  const properties = [
    { label: 'النوع', value: sourceKindLabel[source.kind] ?? source.kind },
    { label: 'مشاريع مرتبطة', value: String(linkedProjects.length) },
    { label: 'أفكار مستخرجة', value: String(linkedIdeas.length) },
    { label: 'ملاحظات محفوظة', value: String(notes.length) },
    { label: 'أُضيف', value: new Date(source.created_at).toLocaleDateString('ar') },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href="/knowledge" className="text-sm text-muted hover:text-text">
            ← المعرفة
          </Link>
          <h1 className="text-2xl font-bold">{source.title}</h1>
        </div>
        <Pill value="low" label={sourceKindLabel[source.kind]} />
      </div>

      {/* 3-column Notebook: relations | summary & notes | Studio */}
      <div className="grid gap-6 lg:grid-cols-[300px_1fr_320px]">
        {/* Left — relations + learning-to-project bridge */}
        <ContextPanel>
          <ContextSection title="الخصائص">
            <EntityProperties rows={properties} />
          </ContextSection>

          <ContextSection title="كيف يخدم هذا مشاريعي؟">
            {linkedProjects.length > 0 ? (
              <EntityLinkList items={linkedProjects} empty="لا مشاريع مرتبطة بعد." />
            ) : activeProject ? (
              <p className="text-xs text-muted">
                غير مرتبط بأي مشروع بعد. مشروعك النشط الآن:{' '}
                <Link href={`/projects/${activeProject.id}`} className="text-link hover:underline">
                  {activeProject.title}
                </Link>
                . استخدم «ربط بمشروع» أو «الخطوة التالية» في الاستوديو لتحويل هذه المعرفة إلى تنفيذ.
              </p>
            ) : (
              <p className="text-xs text-muted">
                لا مشروع نشط. فعّل مشروعًا ثم اربط هذا المصدر به حتى لا تبقى المعرفة معزولة عن التنفيذ.
              </p>
            )}
          </ContextSection>

          <ContextSection title="عناصر مرتبطة">
            <EntityLinkList items={all} empty="لا روابط بعد — استخدم الاستوديو لاستخراج أفكار وربطها." />
          </ContextSection>
        </ContextPanel>

        {/* Middle — summary, notes, don't-forget */}
        <div className="space-y-6">
          <Card title="الملخّص والملاحظات">
            {source.url && /^https?:\/\//i.test(source.url) && (
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                dir="ltr"
                className="mb-3 inline-flex items-center gap-1 truncate text-xs text-link hover:underline"
              >
                {source.url} <ArrowUpRight size={12} />
              </a>
            )}
            {source.summary ? (
              <p className="whitespace-pre-wrap text-sm leading-7 text-text">{source.summary}</p>
            ) : (
              <EmptyState label="لا ملخّص بعد — استخدم «تلخيص» في الاستوديو ثم راجعه واعتمده." />
            )}
          </Card>

          <Card title="سلّم إعادة التوظيف" hint="من المصدر إلى النتيجة">
            <RepurposeLadder stages={ladder} />
          </Card>

          <Card title="لا تنس هذا" hint="ما يجب أن يبقى حاضرًا من هذا المصدر">
            {linkedIdeas.length === 0 && linkedTasks.length === 0 && notes.length === 0 ? (
              <EmptyState label="لا شيء محفوظ بعد. استخرج أفكارًا أو أنشئ خطوة تالية من الاستوديو." />
            ) : (
              <div className="space-y-3">
                {linkedIdeas.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-semibold text-muted">أفكار مفتاحية</p>
                    <EntityLinkList items={linkedIdeas} empty="—" />
                  </div>
                )}
                {linkedTasks.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-semibold text-muted">خطوات تنفيذ</p>
                    <EntityLinkList items={linkedTasks} empty="—" />
                  </div>
                )}
                {notes.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-semibold text-muted">ملاحظات مراجعة محفوظة</p>
                    <ul className="space-y-1.5">
                      {notes.map((n) => (
                        <li
                          key={n.id}
                          className="whitespace-pre-wrap rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs text-muted"
                        >
                          {n.body.length > 220 ? `${n.body.slice(0, 220)}…` : n.body}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Right — Studio */}
        <aside className="space-y-3">
          <div className="flex items-center gap-1.5">
            <Sparkles size={16} className="text-link" aria-hidden />
            <h2 className="text-sm font-semibold">الاستوديو</h2>
          </div>
          <p className="text-xs text-muted">
            كل إجراء مبني على هذا المصدر ويحتاج اعتمادك. لا يُطبَّق شيء تلقائيًا، ولا تُختلق أرقام.
          </p>
          <SourceStudio sourceId={source.id} />
        </aside>
      </div>
    </div>
  );
}
