import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Card, EmptyState, PageHeader } from '@/components/ui';
import { getGraph } from '@/lib/data';
import { entityTypeLabel, hrefFor } from '@/lib/entity-href';
import { nodeKey, type EntityType, type Graph } from '@/lib/graph';

export const metadata = { title: 'الرسم البياني — My Mind OS' };
export const dynamic = 'force-dynamic';

export default async function GraphPage() {
  const graph: Graph = await getGraph();
  const byKey = new Map(graph.nodes.map((n) => [nodeKey(n.type, n.id), n]));

  const counts = graph.nodes.reduce<Record<string, number>>((acc, n) => {
    acc[n.type] = (acc[n.type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        title="الرسم البياني"
        subtitle="روابط عقلك: كيف ترتبط الأفكار والمصادر والمهام بالمشاريع. عرض قائمة الآن، ورسم بصري لاحقًا."
      />

      <div className="mb-5 flex flex-wrap gap-2 text-xs text-muted">
        {(['project', 'idea', 'source', 'task', 'content_item'] as EntityType[]).map((t) => (
          <span key={t} className="rounded-full border border-border bg-surface px-2.5 py-1">
            {entityTypeLabel[t]}: <span className="ltr-num">{counts[t] ?? 0}</span>
          </span>
        ))}
        <span className="rounded-full border border-border bg-surface px-2.5 py-1">
          روابط: <span className="ltr-num">{graph.edges.length}</span>
        </span>
      </div>

      {graph.edges.length === 0 ? (
        <EmptyState label="لا روابط بعد. اربط فكرة بمشروع، أو حوّل فكرة إلى مهمة، لتظهر العلاقات هنا." />
      ) : (
        <Card title="العلاقات">
          <ul className="divide-y divide-border">
            {graph.edges.map((e, i) => {
              const from = byKey.get(e.from);
              const to = byKey.get(e.to);
              if (!from || !to) return null;
              return (
                <li key={i} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                  <Link
                    href={hrefFor(from.type, from.id)}
                    className="rounded-md border border-border bg-bg px-2 py-0.5 hover:border-border-strong hover:text-link"
                  >
                    {from.title || '—'}
                  </Link>
                  <span className="inline-flex items-center gap-1 text-xs text-muted">
                    <ArrowLeft size={12} aria-hidden /> {e.kind}
                  </span>
                  <Link
                    href={hrefFor(to.type, to.id)}
                    className="rounded-md border border-border bg-bg px-2 py-0.5 hover:border-border-strong hover:text-link"
                  >
                    {to.title || '—'}
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
