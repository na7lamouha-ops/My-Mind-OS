import { describe, expect, it } from 'vitest';

import type { Graph } from '@/lib/graph';
import { nodeKey } from '@/lib/graph';
import {
  breakdownToMindMap,
  collectSubtreeIds,
  graphToMindMap,
  mindMapStats,
  pruneBranch,
  toTree,
} from '@/lib/mindmap';

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

describe('breakdownToMindMap', () => {
  it('builds a root → phases → tasks WBS with the project as the entity root', () => {
    const map = breakdownToMindMap({ id: 'p1', title: 'مشروع' }, [
      { name: 'التحقّق', tasks: ['خطوة أ', 'خطوة ب'] },
      { name: 'البناء', tasks: ['نسخة أولى'] },
    ]);
    const root = map.nodes.find((n) => n.kind === 'root');
    expect(root?.entityId).toBe('p1');
    expect(map.nodes.filter((n) => n.kind === 'concept')).toHaveLength(2);
    expect(map.nodes.filter((n) => n.kind === 'task')).toHaveLength(3);
    const roots = toTree(map);
    expect(roots).toHaveLength(1);
    expect(roots[0]?.children).toHaveLength(2);
  });
});

describe('pruneBranch / collectSubtreeIds', () => {
  const map = breakdownToMindMap({ id: 'p1', title: 'مشروع' }, [
    { name: 'مرحلة', tasks: ['أ', 'ب'] },
  ]);

  it('collects a node and all its descendants', () => {
    const phaseId = map.nodes.find((n) => n.kind === 'concept')!.id;
    const ids = collectSubtreeIds(map, phaseId);
    // phase + its 2 tasks
    expect(ids.size).toBe(3);
  });

  it('removes a whole branch and its edges', () => {
    const phaseId = map.nodes.find((n) => n.kind === 'concept')!.id;
    const next = pruneBranch(map, phaseId);
    expect(next.nodes.some((n) => n.id === phaseId)).toBe(false);
    expect(next.nodes.filter((n) => n.kind === 'task')).toHaveLength(0);
    // only the root survives
    expect(next.nodes).toHaveLength(1);
    expect(next.edges).toHaveLength(0);
  });

  it('returns the map unchanged for an unknown node', () => {
    expect(pruneBranch(map, 'nope')).toBe(map);
  });
});
