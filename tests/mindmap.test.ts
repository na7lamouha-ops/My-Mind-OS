import { describe, expect, it } from 'vitest';

import type { Graph } from '@/lib/graph';
import { nodeKey } from '@/lib/graph';
import { graphToMindMap, mindMapStats, toTree } from '@/lib/mindmap';

const graph: Graph = {
  nodes: [
    { type: 'project', id: 'p1', title: 'متجر' },
    { type: 'idea', id: 'i1', title: 'فكرة' },
    { type: 'source', id: 's1', title: 'مصدر' },
  ],
  edges: [
    { from: nodeKey('idea', 'i1'), to: nodeKey('project', 'p1'), kind: 'في المشروع' },
    { from: nodeKey('source', 's1'), to: nodeKey('idea', 'i1'), kind: 'يخص الفكرة' },
  ],
};

describe('graphToMindMap', () => {
  it('projects every graph node and edge, mapping kinds', () => {
    const map = graphToMindMap(graph);
    expect(mindMapStats(map)).toEqual({ nodes: 3, edges: 2 });
    const project = map.nodes.find((n) => n.entityId === 'p1');
    expect(project?.kind).toBe('project');
    const source = map.nodes.find((n) => n.entityId === 's1');
    expect(source?.kind).toBe('source');
    expect(map.edges.every((e) => e.relation === 'related')).toBe(true);
  });
});

describe('toTree', () => {
  it('builds a parent/child tree from edges when no explicit parentId', () => {
    const map = graphToMindMap(graph);
    const roots = toTree(map);
    // source → idea → project chain: the ultimate parent (project) is the root
    const rootIds = roots.map((r) => r.id);
    expect(rootIds).toContain('project:p1');
    const project = roots.find((r) => r.id === 'project:p1');
    expect(project?.children.map((c) => c.id)).toContain('idea:i1');
  });

  it('respects explicit parentId over edges', () => {
    const roots = toTree({
      nodes: [
        { id: 'r', label: 'root', kind: 'root' },
        { id: 'a', label: 'child', kind: 'concept', parentId: 'r' },
      ],
      edges: [],
    });
    expect(roots).toHaveLength(1);
    expect(roots[0]?.children[0]?.id).toBe('a');
  });
});
