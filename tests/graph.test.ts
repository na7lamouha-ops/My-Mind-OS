import { describe, expect, it } from 'vitest';

import { neighborsOf, nodeKey, type Graph } from '@/lib/graph';

const graph: Graph = {
  nodes: [
    { type: 'project', id: 'p1', title: 'متجر' },
    { type: 'idea', id: 'i1', title: 'فكرة' },
    { type: 'source', id: 's1', title: 'مصدر' },
    { type: 'task', id: 't1', title: 'مهمة' },
  ],
  edges: [
    { from: nodeKey('idea', 'i1'), to: nodeKey('project', 'p1'), kind: 'في المشروع' },
    { from: nodeKey('source', 's1'), to: nodeKey('idea', 'i1'), kind: 'يخص الفكرة' },
    { from: nodeKey('task', 't1'), to: nodeKey('project', 'p1'), kind: 'مهمة المشروع' },
  ],
};

describe('neighborsOf', () => {
  it('returns backlinks (incoming) for a project', () => {
    const { related, backlinks } = neighborsOf(graph, 'project', 'p1');
    expect(related).toHaveLength(0);
    const ids = backlinks.map((b) => b.node.id).sort();
    expect(ids).toEqual(['i1', 't1']);
  });

  it('splits related (outgoing) and backlinks (incoming) for an idea', () => {
    const { related, backlinks } = neighborsOf(graph, 'idea', 'i1');
    expect(related.map((r) => r.node.id)).toEqual(['p1']);
    expect(backlinks.map((b) => b.node.id)).toEqual(['s1']);
  });

  it('resolves neighbour titles (links lead to real entities)', () => {
    const { related } = neighborsOf(graph, 'source', 's1');
    expect(related[0]?.node.title).toBe('فكرة');
  });

  it('returns empty for an isolated node', () => {
    const { related, backlinks } = neighborsOf(graph, 'project', 'missing');
    expect(related).toHaveLength(0);
    expect(backlinks).toHaveLength(0);
  });
});
