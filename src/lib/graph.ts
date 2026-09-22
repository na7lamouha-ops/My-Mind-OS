/**
 * Pure graph model over the EXISTING relations (FKs + the links table). No new
 * tables, no data duplication — this is a read-only projection used by the
 * Graph route and the context panel (backlinks / related items).
 */

export type EntityType = 'project' | 'idea' | 'source' | 'task' | 'content_item';

export type GraphNode = { type: EntityType; id: string; title: string };
export type GraphEdge = { from: string; to: string; kind: string };
export type Graph = { nodes: GraphNode[]; edges: GraphEdge[] };

/** Stable key for a node. */
export function nodeKey(type: EntityType, id: string): string {
  return `${type}:${id}`;
}

export type Neighbor = { node: GraphNode; kind: string; direction: 'out' | 'in' };

/**
 * Neighbours of a node, split by direction:
 * - related (out): edges where this node is the `from` (it points at others).
 * - backlinks (in): edges where this node is the `to` (others point at it).
 */
export function neighborsOf(
  graph: Graph,
  type: EntityType,
  id: string,
): { related: Neighbor[]; backlinks: Neighbor[] } {
  const key = nodeKey(type, id);
  const byKey = new Map(graph.nodes.map((n) => [nodeKey(n.type, n.id), n]));
  const related: Neighbor[] = [];
  const backlinks: Neighbor[] = [];

  for (const e of graph.edges) {
    if (e.from === key) {
      const node = byKey.get(e.to);
      if (node) related.push({ node, kind: e.kind, direction: 'out' });
    } else if (e.to === key) {
      const node = byKey.get(e.from);
      if (node) backlinks.push({ node, kind: e.kind, direction: 'in' });
    }
  }
  return { related, backlinks };
}
