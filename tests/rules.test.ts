import { describe, expect, it } from 'vitest';

import {
  activeProjectCount,
  isValidTaskTransition,
  progressPct,
  summarizeProgress,
  violatesSingleActive,
} from '@/lib/rules';

describe('task transitions', () => {
  it('allows todo → doing and todo → done', () => {
    expect(isValidTaskTransition('todo', 'doing')).toBe(true);
    expect(isValidTaskTransition('todo', 'done')).toBe(true);
  });
  it('allows reopening done → todo', () => {
    expect(isValidTaskTransition('done', 'todo')).toBe(true);
  });
  it('rejects no-op and done → doing', () => {
    expect(isValidTaskTransition('todo', 'todo')).toBe(false);
    expect(isValidTaskTransition('done', 'doing')).toBe(false);
  });
});

describe('progress', () => {
  it('is 0 with no tasks', () => {
    expect(progressPct(0, 0)).toBe(0);
    expect(summarizeProgress([])).toEqual({ total: 0, done: 0, pct: 0 });
  });
  it('computes percentage and clamps', () => {
    expect(progressPct(1, 4)).toBe(25);
    expect(progressPct(5, 4)).toBe(100);
  });
  it('summarizes a mixed list', () => {
    const s = summarizeProgress([{ status: 'done' }, { status: 'todo' }, { status: 'doing' }]);
    expect(s).toEqual({ total: 3, done: 1, pct: 33 });
  });
});

describe('single active project rule', () => {
  const P = (is_active: boolean, deleted = false) => ({
    is_active,
    deleted_at: deleted ? '2026-01-01T00:00:00Z' : null,
  });
  it('counts only non-deleted active projects', () => {
    expect(activeProjectCount([P(true), P(false), P(true, true)])).toBe(1);
  });
  it('flags a violation when two are active', () => {
    expect(violatesSingleActive([P(true), P(true)])).toBe(true);
    expect(violatesSingleActive([P(true), P(false)])).toBe(false);
  });
});
