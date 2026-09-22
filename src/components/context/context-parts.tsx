import Link from 'next/link';

import { EmptyState } from '@/components/ui';
import { entityTypeLabel, hrefFor } from '@/lib/entity-href';
import type { Neighbor } from '@/lib/graph';

/** A list of related/backlinked entities, each a working link. */
export function EntityLinkList({ items, empty }: { items: Neighbor[]; empty: string }) {
  if (items.length === 0) return <EmptyState label={empty} />;
  return (
    <ul className="space-y-1.5">
      {items.map(({ node, kind }, i) => (
        <li key={`${node.type}:${node.id}:${i}`}>
          <Link
            href={hrefFor(node.type, node.id)}
            className="flex items-center justify-between gap-2 rounded-lg border border-border bg-bg px-2.5 py-1.5 text-sm transition hover:border-border-strong hover:bg-elevated"
          >
            <span className="truncate">{node.title || '—'}</span>
            <span className="shrink-0 text-[11px] text-muted">
              {entityTypeLabel[node.type]} · {kind}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** A compact key/value property block. */
export function EntityProperties({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <dl className="space-y-1.5 text-sm">
      {rows.map((r) => (
        <div key={r.label} className="flex items-baseline justify-between gap-2">
          <dt className="text-muted">{r.label}</dt>
          <dd className="truncate text-text">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
