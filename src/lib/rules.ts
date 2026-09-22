import type { Task } from '@/schemas';

/**
 * Pure, side-effect-free business rules. Kept separate from the data layer so
 * they can be unit-tested without a database.
 */

type TaskStatus = Task['status'];

// Allowed task status transitions (todo <-> doing -> done -> todo).
const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  todo: ['doing', 'done'],
  doing: ['todo', 'done'],
  done: ['todo'],
};

export function isValidTaskTransition(from: TaskStatus, to: TaskStatus): boolean {
  if (from === to) return false;
  return (TASK_TRANSITIONS[from] ?? []).includes(to);
}

export function progressPct(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((Math.min(done, total) / total) * 100);
}

export function summarizeProgress(tasks: { status: TaskStatus }[]): {
  total: number;
  done: number;
  pct: number;
} {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'done').length;
  return { total, done, pct: progressPct(done, total) };
}

/** Invariant: at most one active project per owner. */
export function activeProjectCount(projects: { is_active: boolean; deleted_at: string | null }[]): number {
  return projects.filter((p) => p.is_active && p.deleted_at === null).length;
}

export function violatesSingleActive(
  projects: { is_active: boolean; deleted_at: string | null }[],
): boolean {
  return activeProjectCount(projects) > 1;
}
