import type { EntityType, Graph } from '@/lib/graph';

/**
 * Mind-map abstraction (Phase 7C). A provider- and renderer-agnostic model that
 * can be produced from the existing relation graph or proposed by Mock AI. No
 * database table — this is an in-memory projection / suggestion only.
 */

export type MindMapKind =
  | 'root'
  | 'concept'
  | 'idea'
  | 'project'
  | 'task'
  | 'source'
  | 'opportunity';

export type MindMapRelation =
  | 'supports'
  | 'depends_on'
  | 'derived_from'
  | 'blocks'
  | 'creates'
  | 'related';

export type MindMapNode = {
  id: string;
  label: string;
  kind: MindMapKind;
  parentId?: string;
  entityId?: string;
  status?: string;
  confidence?: number;
};

export type MindMapEdge = {
  id: string;
  source: string;
  target: string;
  relation: MindMapRelation;
};

export type MindMap = { nodes: MindMapNode[]; edges: MindMapEdge[] };

const KIND_OF: Record<EntityType, MindMapKind> = {
  project: 'project',
  idea: 'idea',
  source: 'source',
  task: 'task',
  content_item: 'concept',
};

/** Project the existing relation graph into a mind map (lossless-ish). */
export function graphToMindMap(graph: Graph): MindMap {
  const nodes: MindMapNode[] = graph.nodes.map((n) => ({
    id: `${n.type}:${n.id}`,
    label: n.title,
    kind: KIND_OF[n.type],
    entityId: n.id,
  }));
  const edges: MindMapEdge[] = graph.edges.map((e, i) => ({
    id: `e${i}`,
    source: e.from,
    target: e.to,
    relation: 'related',
  }));
  return { nodes, edges };
}

export type MindMapTreeNode = MindMapNode & { children: MindMapTreeNode[] };

/**
 * Build a parent/child tree from a mind map for a simple tree renderer. Uses
 * explicit parentId when present, else the first edge that targets the node.
 */
export function toTree(map: MindMap): MindMapTreeNode[] {
  const byId = new Map<string, MindMapTreeNode>(
    map.nodes.map((n) => [n.id, { ...n, children: [] }]),
  );
  const parentOf = new Map<string, string>();
  for (const n of map.nodes) if (n.parentId) parentOf.set(n.id, n.parentId);
  for (const e of map.edges) if (!parentOf.has(e.source)) parentOf.set(e.source, e.target);

  const roots: MindMapTreeNode[] = [];
  for (const node of byId.values()) {
    const parentId = parentOf.get(node.id);
    const parent = parentId ? byId.get(parentId) : undefined;
    if (parent && parent.id !== node.id) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

export function mindMapStats(map: MindMap): { nodes: number; edges: number } {
  return { nodes: map.nodes.length, edges: map.edges.length };
}
