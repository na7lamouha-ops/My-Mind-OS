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

/**
 * Project → WBS mind map from a breakdown (phases + tasks). Pure; produces a
 * single root with one branch per phase and a leaf per task. No IDs are
 * fabricated for real entities — task/phase nodes carry synthetic ids only.
 */
export function breakdownToMindMap(
  project: { id: string; title: string },
  phases: { name: string; tasks: string[] }[],
): MindMap {
  const root = `root:${project.id}`;
  const nodes: MindMapNode[] = [
    { id: root, label: project.title, kind: 'root', entityId: project.id },
  ];
  const edges: MindMapEdge[] = [];
  phases.forEach((ph, pi) => {
    const phaseId = `phase:${project.id}:${pi}`;
    nodes.push({ id: phaseId, label: ph.name, kind: 'concept', parentId: root });
    edges.push({ id: `e-${phaseId}`, source: phaseId, target: root, relation: 'depends_on' });
    ph.tasks.forEach((t, ti) => {
      const taskId = `task:${project.id}:${pi}:${ti}`;
      nodes.push({ id: taskId, label: t, kind: 'task', parentId: phaseId });
      edges.push({ id: `e-${taskId}`, source: taskId, target: phaseId, relation: 'derived_from' });
    });
  });
  return { nodes, edges };
}

/** All ids in the subtree rooted at nodeId (inclusive), following the tree. */
export function collectSubtreeIds(map: MindMap, nodeId: string): Set<string> {
  const roots = toTree(map);
  const found = new Set<string>();
  const walk = (n: MindMapTreeNode) => {
    found.add(n.id);
    n.children.forEach(walk);
  };
  const stack = [...roots];
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur.id === nodeId) {
      walk(cur);
      break;
    }
    stack.push(...cur.children);
  }
  return found;
}

/** Remove a node and its whole subtree (accept/reject a branch). Pure. */
export function pruneBranch(map: MindMap, nodeId: string): MindMap {
  const remove = collectSubtreeIds(map, nodeId);
  if (remove.size === 0) return map;
  return {
    nodes: map.nodes.filter((n) => !remove.has(n.id)),
    edges: map.edges.filter((e) => !remove.has(e.source) && !remove.has(e.target)),
  };
}
