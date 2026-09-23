import { describe, expect, it } from 'vitest';

import type { Graph } from '@/lib/graph';
import { nodeKey } from '@/lib/graph';
import {
  computeLearningReview,
  repurposeLadder,
  type LearningReviewInput,
} from '@/lib/learning-review';
import type { ContentItem, Idea, Source, Task } from '@/schemas';

const now = new Date().toISOString();
const old = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

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
    summary: null,
    project_id: null,
    idea_id: null,
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
function content(over: Partial<ContentItem> = {}): ContentItem {
  return {
    id: 'c1',
    owner_id: 'u',
    created_at: now,
    updated_at: now,
    deleted_at: null,
    kind: 'summary',
    body: 'x',
    status: 'draft',
    idea_id: null,
    source_id: 's1',
    ...over,
  } as ContentItem;
}
function task(over: Partial<Task> = {}): Task {
  return {
    id: 't1',
    owner_id: 'u',
    created_at: now,
    updated_at: now,
    deleted_at: null,
    title: 'مهمة',
    status: 'done',
    is_next_action: false,
    project_id: 'p1',
    ...over,
  };
}

function input(over: Partial<LearningReviewInput> = {}): LearningReviewInput {
  return {
    sources: [],
    ideas: [],
    content: [],
    tasks: [],
    graph: { nodes: [], edges: [] },
    ...over,
  };
}

describe('computeLearningReview', () => {
  it('counts recent activity within the window', () => {
    const r = computeLearningReview(
      input({
        sources: [source({ id: 's1' }), source({ id: 's2', created_at: old })],
        ideas: [idea({ id: 'i1' })],
        content: [content({ id: 'c1' })],
        tasks: [task({ id: 't1', status: 'done' })],
      }),
    );
    expect(r.sourcesAdded).toBe(1); // s2 is old
    expect(r.ideasCaptured).toBe(1);
    expect(r.draftsCreated).toBe(1);
    expect(r.resultsProduced).toBe(1);
  });

  it('computes conversion and surfaces unlinked recent sources', () => {
    const graph: Graph = {
      nodes: [
        { type: 'source', id: 's1', title: 'A' },
        { type: 'project', id: 'p1', title: 'P' },
      ],
      edges: [{ from: nodeKey('source', 's1'), to: nodeKey('project', 'p1'), kind: 'رابط' }],
    };
    const r = computeLearningReview(
      input({ sources: [source({ id: 's1' }), source({ id: 's2' })], graph }),
    );
    expect(r.sourcesLinked).toBe(1);
    expect(r.conversion).toBeCloseTo(0.5);
    expect(r.unusedRecent.map((u) => u.id)).toEqual(['s2']);
  });

  it('returns null conversion when there are no sources', () => {
    expect(computeLearningReview(input()).conversion).toBeNull();
  });
});

describe('repurposeladder', () => {
  it('marks stages done from state and gives the first open stage a next action', () => {
    const stages = repurposeLadder({
      hasSummary: false,
      keyIdeaCount: 0,
      linkedProjectCount: 0,
      draftCount: 0,
      resultCount: 0,
    });
    expect(stages[0]?.done).toBe(true); // source always exists
    const open = stages.filter((s) => s.nextAction);
    expect(open).toHaveLength(1); // only the first unfinished stage
    expect(open[0]?.key).toBe('key_idea');
  });

  it('advances the next action as earlier stages complete', () => {
    const stages = repurposeLadder({
      hasSummary: true,
      keyIdeaCount: 2,
      linkedProjectCount: 0,
      draftCount: 0,
      resultCount: 0,
    });
    const open = stages.find((s) => s.nextAction);
    expect(open?.key).toBe('relevance');
  });

  it('has no next action when the whole ladder is complete', () => {
    const stages = repurposeLadder({
      hasSummary: true,
      keyIdeaCount: 1,
      linkedProjectCount: 1,
      draftCount: 1,
      resultCount: 1,
    });
    expect(stages.every((s) => s.done)).toBe(true);
    expect(stages.some((s) => s.nextAction)).toBe(false);
  });
});
