import { describe, expect, it } from 'vitest';

import {
  AiActionKind,
  AiActionResult,
  dbKindFor,
  runActionMock,
  type AiActionInput,
} from '@/lib/ai/actions';

const input: AiActionInput = {
  entityType: 'source',
  entityId: '11111111-1111-1111-1111-111111111111',
  title: 'مصدر تجريبي عن التسويق',
  text: 'محتوى المصدر: أفكار حول اكتساب العملاء وخفض التكلفة.',
  projects: [{ id: '22222222-2222-2222-2222-222222222222', title: 'مشروع المتجر' }],
};

describe('runActionMock', () => {
  const kinds = AiActionKind.options;

  it('produces a schema-valid, grounded result for every action kind', () => {
    for (const kind of kinds) {
      const result = runActionMock(kind, input);
      // must parse against the strict discriminated union
      expect(() => AiActionResult.parse(result)).not.toThrow();
      expect(result.kind).toBe(kind);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.sourceRefs.length).toBeGreaterThan(0);
      // every inference must point back at the source it came from
      expect(result.sourceRefs[0]?.entityId).toBe(input.entityId);
    }
  });

  it('never fabricates a project link id when no project matches', () => {
    const noProjects = { ...input, projects: [] };
    const result = runActionMock('suggest_project_links', noProjects);
    if (result.kind !== 'suggest_project_links') throw new Error('wrong kind');
    for (const l of result.links) expect(l.projectId).toBeNull();
  });

  it('marks opportunity hypotheses as needing verification (no confirmed numbers)', () => {
    const result = runActionMock('generate_opportunity_hypotheses', input);
    if (result.kind !== 'generate_opportunity_hypotheses') throw new Error('wrong kind');
    expect(result.grounding).toBe('needs_verification');
    expect(result.opportunities.length).toBeGreaterThan(0);
  });

  it('generates a mind map with a single root and grounded children', () => {
    const result = runActionMock('generate_mindmap', input);
    if (result.kind !== 'generate_mindmap') throw new Error('wrong kind');
    const roots = result.map.nodes.filter((n) => n.kind === 'root');
    expect(roots).toHaveLength(1);
    expect(roots[0]?.entityId).toBe(input.entityId);
  });
});

describe('dbKindFor', () => {
  it('maps content angles to generate_content', () => {
    expect(dbKindFor('generate_content_angles', 'source')).toBe('generate_content');
  });

  it('maps source-scoped actions to summarize_source', () => {
    expect(dbKindFor('summarize_source', 'source')).toBe('summarize_source');
    expect(dbKindFor('extract_key_ideas', 'source')).toBe('summarize_source');
  });

  it('maps non-source entities to organize_idea', () => {
    expect(dbKindFor('extract_key_ideas', 'idea')).toBe('organize_idea');
  });
});
