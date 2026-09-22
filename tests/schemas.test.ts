import { describe, expect, it } from 'vitest';

import {
  AiRunInsert,
  IdeaInsert,
  LinkInsert,
  ProjectInsert,
  SourceInsert,
  TaskInsert,
  ContentItemInsert,
} from '@/schemas';

const UUID = '00000000-0000-4000-8000-000000000000';

describe('ProjectInsert', () => {
  it('accepts a minimal valid project', () => {
    const parsed = ProjectInsert.parse({ title: 'متجر إلكتروني' });
    expect(parsed.title).toBe('متجر إلكتروني');
  });

  it('rejects an empty title', () => {
    expect(() => ProjectInsert.parse({ title: '' })).toThrow();
  });

  it('rejects an unknown priority', () => {
    expect(() => ProjectInsert.parse({ title: 'x', priority: 'urgent' })).toThrow();
  });
});

describe('IdeaInsert', () => {
  it('accepts an idea linked to a project', () => {
    const parsed = IdeaInsert.parse({ title: 'فكرة وكيل AI', project_id: UUID });
    expect(parsed.project_id).toBe(UUID);
  });

  it('rejects a non-uuid project_id', () => {
    expect(() => IdeaInsert.parse({ title: 'x', project_id: 'nope' })).toThrow();
  });
});

describe('SourceInsert', () => {
  it('accepts a video source with a url', () => {
    const parsed = SourceInsert.parse({
      kind: 'video',
      title: 'بودكاست',
      url: 'https://example.com/v',
    });
    expect(parsed.kind).toBe('video');
  });

  it('rejects an invalid url', () => {
    expect(() => SourceInsert.parse({ kind: 'link', title: 'x', url: 'not-a-url' })).toThrow();
  });

  it('rejects an unknown kind', () => {
    expect(() => SourceInsert.parse({ kind: 'tweet', title: 'x' })).toThrow();
  });
});

describe('TaskInsert', () => {
  it('requires a project_id', () => {
    expect(() => TaskInsert.parse({ title: 'خطوة تالية' })).toThrow();
  });

  it('accepts a task with a project_id', () => {
    const parsed = TaskInsert.parse({ title: 'خطوة تالية', project_id: UUID });
    expect(parsed.project_id).toBe(UUID);
  });
});

describe('ContentItemInsert', () => {
  it('accepts a draft hook', () => {
    const parsed = ContentItemInsert.parse({ kind: 'hook', body: 'افتتاحية قوية' });
    expect(parsed.kind).toBe('hook');
  });

  it('rejects an empty body', () => {
    expect(() => ContentItemInsert.parse({ kind: 'post', body: '' })).toThrow();
  });
});

describe('LinkInsert', () => {
  it('accepts a link between two entities', () => {
    const parsed = LinkInsert.parse({
      from_type: 'idea',
      from_id: UUID,
      to_type: 'source',
      to_id: UUID,
    });
    expect(parsed.from_type).toBe('idea');
  });

  it('rejects an unknown entity type', () => {
    expect(() =>
      LinkInsert.parse({ from_type: 'comment', from_id: UUID, to_type: 'idea', to_id: UUID }),
    ).toThrow();
  });
});

describe('AiRunInsert', () => {
  it('accepts a run with an input record', () => {
    const parsed = AiRunInsert.parse({ kind: 'organize_idea', input: { text: 'رتّب هذه الفكرة' } });
    expect(parsed.kind).toBe('organize_idea');
  });

  it('rejects an unknown kind', () => {
    expect(() => AiRunInsert.parse({ kind: 'delete_all', input: {} })).toThrow();
  });
});
