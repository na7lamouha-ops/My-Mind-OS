'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronLeft, EyeOff, RotateCcw, Link2 } from 'lucide-react';

import {
  pruneBranch,
  toTree,
  type MindMap,
  type MindMapKind,
  type MindMapTreeNode,
} from '@/lib/mindmap';
import { hrefFor } from '@/lib/entity-href';
import type { EntityType } from '@/lib/graph';

/** Mind-map node kind → the entity route it links to (when it is a real entity). */
const ENTITY_OF: Partial<Record<MindMapKind, EntityType>> = {
  project: 'project',
  idea: 'idea',
  source: 'source',
  task: 'task',
  concept: 'content_item',
};

const kindLabel: Record<MindMapKind, string> = {
  root: 'جذر',
  concept: 'مفهوم',
  idea: 'فكرة',
  project: 'مشروع',
  task: 'مهمة',
  source: 'مصدر',
  opportunity: 'فرصة',
};

const kindTone: Record<MindMapKind, string> = {
  root: 'text-text',
  concept: 'text-muted',
  idea: 'text-warning',
  project: 'text-link',
  task: 'text-success',
  source: 'text-link',
  opportunity: 'text-warning',
};

export function MindMapView({ initial }: { initial: MindMap }) {
  const [map, setMap] = useState<MindMap>(initial);
  const roots = useMemo(() => toTree(map), [map]);
  const pruned = map.nodes.length < initial.nodes.length;

  if (initial.nodes.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-3 py-8 text-center text-sm text-muted">
        لا عناصر بعد — أضِف مشاريع وأفكارًا ومصادر وسيُبنى الخريطة تلقائيًا من روابطك.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {pruned && (
        <button
          type="button"
          onClick={() => setMap(initial)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs text-muted transition hover:bg-elevated hover:text-text"
        >
          <RotateCcw size={13} aria-hidden /> استعادة كل الفروع
        </button>
      )}
      <ul className="space-y-1">
        {roots.map((n) => (
          <TreeNode key={n.id} node={n} depth={0} onHide={(id) => setMap((m) => pruneBranch(m, id))} />
        ))}
      </ul>
    </div>
  );
}

function TreeNode({
  node,
  depth,
  onHide,
}: {
  node: MindMapTreeNode;
  depth: number;
  onHide: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children.length > 0;
  const entity = ENTITY_OF[node.kind];

  return (
    <li>
      <div
        className="group flex items-center gap-1.5 rounded-lg px-1.5 py-1 hover:bg-elevated"
        style={{ marginInlineStart: depth * 16 }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'طيّ' : 'فتح'}
            className="rounded p-0.5 text-muted hover:text-text"
          >
            {open ? <ChevronDown size={14} /> : <ChevronLeft size={14} />}
          </button>
        ) : (
          <span className="inline-block w-[18px]" />
        )}

        <span className={`text-[10px] ${kindTone[node.kind]}`}>{kindLabel[node.kind]}</span>

        {entity && node.entityId ? (
          <Link href={hrefFor(entity, node.entityId)} className="flex-1 truncate text-sm hover:text-link">
            {node.label}
          </Link>
        ) : (
          <span className="flex-1 truncate text-sm">{node.label}</span>
        )}

        {entity && node.entityId && (
          <Link
            href={hrefFor(entity, node.entityId)}
            aria-label="فتح العنصر المرتبط"
            className="rounded p-0.5 text-muted opacity-0 transition group-hover:opacity-100 hover:text-link"
          >
            <Link2 size={13} />
          </Link>
        )}

        <button
          type="button"
          onClick={() => onHide(node.id)}
          aria-label="إخفاء هذا الفرع"
          className="rounded p-0.5 text-muted opacity-0 transition group-hover:opacity-100 hover:text-danger"
        >
          <EyeOff size={13} />
        </button>
      </div>

      {hasChildren && open && (
        <ul className="space-y-1">
          {node.children.map((c) => (
            <TreeNode key={c.id} node={c} depth={depth + 1} onHide={onHide} />
          ))}
        </ul>
      )}
    </li>
  );
}
