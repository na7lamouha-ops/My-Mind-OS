import { describe, expect, it } from 'vitest';

import type { Graph } from '@/lib/graph';
import { nodeKey } from '@/lib/graph';
import { computeRadar, radarSummary, type RadarInput } from '@/lib/opportunity';
import type { Idea, Project, Source, Task } from '@/schemas';

const now = new Date().toISOString();
const old = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();

function project(over: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    owner_id: 'u',
    created_at: now,
    updated_at: now,
    deleted_at: null,
    title: 'مشروع',
    description: null,
    status: 'active',
    priority: 'medium',
    is_active: true,
    next_action: 'خطوة',
    ...over,
  };
}
function idea(over: Partial<Idea> = {}): Idea {
  return {
    id: 'i1',
    owner_id: 'u',
    created_at: now,
    updated_at: now,
    deleted_at: null,
    title: 'فكرة',
    note: null,
    status: 'inbox',
    project_id: null,
    ...over,
  };
}
function source(over: Partial<Source> = {}): Source {
  return {
    id: 's1',
    owner_id: 'u',
    created_at: now,
    updated_at: now,
    deleted_at: null,
    kind: 'article',
    title: 'مصدر',
    url: null,
    summary: 'ملخّص',
    project_id: null,
    idea_id: null,
    ...over,
  };
}
function task(over: Partial<Task> = {}): Task {
  return {
    id: 't1',
    owner_id: 'u',
    created_at: now,
    updated_at: now,
    deleted_at: null,
    title: 'مهمة',
    status: 'todo',
    is_next_action: false,
    project_id: 'p1',
    ...over,
  };
}

const emptyGraph: Graph = { nodes: [], edges: [] };

function input(over: Partial<RadarInput> = {}): RadarInput {
  return { projects: [], ideas: [], sources: [], tasks: [], graph: emptyGraph, ...over };
}

describe('computeRadar', () => {
  it('never invents financial numbers — details carry no currency', () => {
    const items = computeRadar(
      input({
        sources: [source({ id: 's1', summary: null }), source({ id: 's2' })],
        ideas: [idea({ id: 'i1', status: 'archived' })],
        projects: [project({ status: 'paused', next_action: null })],
        tasks: [task({ id: 't1', project_id: 'p1', status: 'todo' })],
      }),
    );
    for (const it of items) {
      expect(it.detail).not.toMatch(/دج|DA|DZD|\$|€/);
    }
  });

  it('flags an unlinked source as a potential (unused knowledge)', () => {
    const items = computeRadar(input({ sources: [source({ id: 's1' })] }));
    const found = items.find((x) => x.id === 'potential:unused-source:s1');
    expect(found?.layer).toBe('potential');
    expect(found?.recoveryTest).toBeTruthy();
  });

  it('counts a linked source as confirmed knowledge', () => {
    const graph: Graph = {
      nodes: [
        { type: 'source', id: 's1', title: 'مصدر' },
        { type: 'project', id: 'p1', title: 'مشروع' },
      ],
      edges: [{ from: nodeKey('source', 's1'), to: nodeKey('project', 'p1'), kind: 'رابط' }],
    };
    const items = computeRadar(input({ sources: [source({ id: 's1' })], projects: [project()], graph }));
    expect(items.some((x) => x.id === 'confirmed:linked-sources')).toBe(true);
    expect(items.some((x) => x.id.startsWith('potential:unused-source'))).toBe(false);
  });

  it('reports a dropped idea as MANQUE À GAGNER with cause + recovery', () => {
    const items = computeRadar(input({ ideas: [idea({ id: 'i1', status: 'archived', project_id: null })] }));
    const missed = items.find((x) => x.id === 'missed:dropped-idea:i1');
    expect(missed?.layer).toBe('missed');
    expect(missed?.cause).toBeTruthy();
    expect(missed?.preventiveAction).toBeTruthy();
    expect(missed?.recoveryTest).toBeTruthy();
  });

  it('flags a forgotten (old, unlinked) source as missed', () => {
    const items = computeRadar(input({ sources: [source({ id: 's1', created_at: old, summary: null })] }));
    expect(items.some((x) => x.id === 'missed:forgotten-sources')).toBe(true);
  });

  it('flags a paused project with open tasks as missed value', () => {
    const items = computeRadar(
      input({
        projects: [project({ id: 'p1', status: 'paused', is_active: false })],
        tasks: [task({ id: 't1', project_id: 'p1', status: 'todo' })],
      }),
    );
    const missed = items.find((x) => x.id === 'missed:paused-project:p1');
    expect(missed?.projectId).toBe('p1');
  });

  it('flags an active project without a next action as potential', () => {
    const items = computeRadar(input({ projects: [project({ is_active: true, next_action: null })] }));
    expect(items.some((x) => x.id === 'potential:no-next:p1')).toBe(true);
  });

  it('summarizes counts per layer', () => {
    const items = computeRadar(input({ sources: [source({ id: 's1' })] }));
    const s = radarSummary(items);
    expect(s.confirmed + s.potential + s.missed).toBe(items.length);
  });
});
