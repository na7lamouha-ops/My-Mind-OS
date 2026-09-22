import { createClient } from '@/lib/supabase/server';
import type { ContentItem, Idea, Project, Source, Task } from '@/schemas';

type IdeaStatusT = Idea['status'];
type ProjectStatusT = Project['status'];
type TaskStatusT = Task['status'];

/**
 * Server-only data access for My Mind OS. Every function is scoped to the
 * authenticated owner; RLS enforces isolation at the database, and we also
 * stamp/filter owner_id defensively. Reads are cast to the schema row types;
 * user input is validated with Zod in the server actions before it gets here.
 */

export class DataError extends Error {}

async function ctx() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new DataError('غير مُصادَق عليه.');
  return { supabase, uid: user.id };
}

function ok<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new DataError(error.message);
  return data as T;
}

// ---- projects -------------------------------------------------------------

export async function listProjects(): Promise<Project[]> {
  const { supabase, uid } = await ctx();
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('owner_id', uid)
    .is('deleted_at', null)
    .order('is_active', { ascending: false })
    .order('created_at', { ascending: false });
  return ok(data, error);
}

export async function getActiveProject(): Promise<Project | null> {
  const { supabase, uid } = await ctx();
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('owner_id', uid)
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle();
  return ok(data, error);
}

export async function getProject(id: string): Promise<Project | null> {
  const { supabase, uid } = await ctx();
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('owner_id', uid)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  return ok(data, error);
}

export async function createProject(input: {
  title: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high';
  next_action: string | null;
}): Promise<Project> {
  const { supabase, uid } = await ctx();
  // New projects are never auto-activated (single-active rule stays explicit).
  const { data, error } = await supabase
    .from('projects')
    .insert({ ...input, owner_id: uid, is_active: false, status: 'active' })
    .select('*')
    .single();
  return ok(data, error);
}

export async function updateProject(
  id: string,
  patch: Partial<{
    title: string;
    description: string | null;
    priority: 'low' | 'medium' | 'high';
    status: ProjectStatusT;
    next_action: string | null;
  }>,
): Promise<Project> {
  const { supabase, uid } = await ctx();
  const { data, error } = await supabase
    .from('projects')
    .update(patch)
    .eq('id', id)
    .eq('owner_id', uid)
    .select('*')
    .single();
  return ok(data, error);
}

/** Enforce exactly-one-active: clear the current active, then set this one. */
export async function setActiveProject(id: string): Promise<void> {
  const { supabase, uid } = await ctx();
  const clear = await supabase
    .from('projects')
    .update({ is_active: false })
    .eq('owner_id', uid)
    .eq('is_active', true);
  if (clear.error) throw new DataError(clear.error.message);
  const set = await supabase
    .from('projects')
    .update({ is_active: true, status: 'active' })
    .eq('id', id)
    .eq('owner_id', uid);
  if (set.error) throw new DataError(set.error.message);
}

export async function archiveProject(id: string): Promise<void> {
  const { supabase, uid } = await ctx();
  const { error } = await supabase
    .from('projects')
    .update({ status: 'archived', is_active: false })
    .eq('id', id)
    .eq('owner_id', uid);
  if (error) throw new DataError(error.message);
}

// ---- ideas ----------------------------------------------------------------

export async function listIdeas(status?: IdeaStatusT): Promise<Idea[]> {
  const { supabase, uid } = await ctx();
  let q = supabase
    .from('ideas')
    .select('*')
    .eq('owner_id', uid)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  return ok(data, error);
}

export async function getIdea(id: string): Promise<Idea | null> {
  const { supabase, uid } = await ctx();
  const { data, error } = await supabase
    .from('ideas')
    .select('*')
    .eq('owner_id', uid)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  return ok(data, error);
}

export async function createIdea(input: {
  title: string;
  note: string | null;
  project_id: string | null;
}): Promise<Idea> {
  const { supabase, uid } = await ctx();
  const { data, error } = await supabase
    .from('ideas')
    .insert({ ...input, owner_id: uid, status: 'inbox' })
    .select('*')
    .single();
  return ok(data, error);
}

export async function updateIdea(
  id: string,
  patch: Partial<{ title: string; note: string | null; status: IdeaStatusT; project_id: string | null }>,
): Promise<Idea> {
  const { supabase, uid } = await ctx();
  const { data, error } = await supabase
    .from('ideas')
    .update(patch)
    .eq('id', id)
    .eq('owner_id', uid)
    .select('*')
    .single();
  return ok(data, error);
}

export async function softDeleteIdea(id: string): Promise<void> {
  const { supabase, uid } = await ctx();
  const { error } = await supabase
    .from('ideas')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('owner_id', uid);
  if (error) throw new DataError(error.message);
}

// ---- tasks ----------------------------------------------------------------

export async function listTasksForProject(projectId: string): Promise<Task[]> {
  const { supabase, uid } = await ctx();
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('owner_id', uid)
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('is_next_action', { ascending: false })
    .order('created_at', { ascending: false });
  return ok(data, error);
}

export async function listAllTasks(): Promise<Task[]> {
  const { supabase, uid } = await ctx();
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('owner_id', uid)
    .is('deleted_at', null)
    .order('status', { ascending: true })
    .order('is_next_action', { ascending: false })
    .order('created_at', { ascending: false });
  return ok(data, error);
}

export async function createTask(input: {
  title: string;
  project_id: string;
  is_next_action: boolean;
}): Promise<Task> {
  const { supabase, uid } = await ctx();
  const { data, error } = await supabase
    .from('tasks')
    .insert({ ...input, owner_id: uid, status: 'todo' })
    .select('*')
    .single();
  return ok(data, error);
}

export async function updateTask(
  id: string,
  patch: Partial<{ title: string; status: TaskStatusT; is_next_action: boolean }>,
): Promise<Task> {
  const { supabase, uid } = await ctx();
  const { data, error } = await supabase
    .from('tasks')
    .update(patch)
    .eq('id', id)
    .eq('owner_id', uid)
    .select('*')
    .single();
  return ok(data, error);
}

export async function softDeleteTask(id: string): Promise<void> {
  const { supabase, uid } = await ctx();
  const { error } = await supabase
    .from('tasks')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('owner_id', uid);
  if (error) throw new DataError(error.message);
}

// ---- sources --------------------------------------------------------------

export async function getSource(id: string): Promise<Source | null> {
  const { supabase, uid } = await ctx();
  const { data, error } = await supabase
    .from('sources')
    .select('*')
    .eq('owner_id', uid)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  return ok(data, error);
}

export async function listSources(): Promise<Source[]> {
  const { supabase, uid } = await ctx();
  const { data, error } = await supabase
    .from('sources')
    .select('*')
    .eq('owner_id', uid)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  return ok(data, error);
}

export async function createSource(input: {
  kind: Source['kind'];
  title: string;
  url: string | null;
  summary: string | null;
  project_id: string | null;
  idea_id: string | null;
}): Promise<Source> {
  const { supabase, uid } = await ctx();
  const { data, error } = await supabase
    .from('sources')
    .insert({ ...input, owner_id: uid })
    .select('*')
    .single();
  return ok(data, error);
}

// ---- links (generic: used here for idea <-> task) -------------------------

export async function linkEntities(input: {
  from_type: 'idea';
  from_id: string;
  to_type: 'task';
  to_id: string;
}): Promise<void> {
  const { supabase, uid } = await ctx();
  const { error } = await supabase
    .from('links')
    .insert({ ...input, owner_id: uid })
    .select('id')
    .single();
  // Unique-pair violations are benign (already linked): ignore only that.
  if (error && !/duplicate key|unique/i.test(error.message)) {
    throw new DataError(error.message);
  }
}

// ---- dashboard aggregate --------------------------------------------------

export type ProjectProgress = { project: Project; total: number; done: number };

export type DashboardData = {
  activeProject: Project | null;
  activeTasks: Task[];
  inboxCount: number;
  recentSources: Source[];
  progress: ProjectProgress[];
};

export async function getDashboard(): Promise<DashboardData> {
  const { supabase, uid } = await ctx();

  const [projectsRes, tasksRes, ideasRes, sourcesRes] = await Promise.all([
    supabase.from('projects').select('*').eq('owner_id', uid).is('deleted_at', null),
    supabase.from('tasks').select('*').eq('owner_id', uid).is('deleted_at', null),
    supabase
      .from('ideas')
      .select('id')
      .eq('owner_id', uid)
      .eq('status', 'inbox')
      .is('deleted_at', null),
    supabase
      .from('sources')
      .select('*')
      .eq('owner_id', uid)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const projects = ok<Project[]>(projectsRes.data, projectsRes.error);
  const tasks = ok<Task[]>(tasksRes.data, tasksRes.error);
  const inboxIds = ok<{ id: string }[]>(ideasRes.data, ideasRes.error);
  const recentSources = ok<Source[]>(sourcesRes.data, sourcesRes.error);

  const activeProject = projects.find((p) => p.is_active) ?? null;
  const activeTasks = activeProject
    ? tasks
        .filter((t) => t.project_id === activeProject.id && t.status !== 'done')
        .sort((a, b) => Number(b.is_next_action) - Number(a.is_next_action))
    : [];

  const progress: ProjectProgress[] = projects
    .filter((p) => p.status !== 'archived')
    .map((project) => {
      const own = tasks.filter((t) => t.project_id === project.id);
      return { project, total: own.length, done: own.filter((t) => t.status === 'done').length };
    });

  return {
    activeProject,
    activeTasks,
    inboxCount: inboxIds.length,
    recentSources,
    progress,
  };
}

// ---- content_items --------------------------------------------------------

export async function createContentItem(input: {
  kind: ContentItem['kind'];
  body: string;
  status?: ContentItem['status'];
  idea_id: string | null;
  source_id: string | null;
}): Promise<ContentItem> {
  const { supabase, uid } = await ctx();
  const { data, error } = await supabase
    .from('content_items')
    .insert({
      owner_id: uid,
      kind: input.kind,
      body: input.body,
      status: input.status ?? 'draft',
      idea_id: input.idea_id,
      source_id: input.source_id,
    })
    .select('*')
    .single();
  return ok(data, error);
}

// ---- ai_runs (proposal log; no secrets ever stored) -----------------------

export type AiRunStatusT = 'pending' | 'proposed' | 'approved' | 'rejected' | 'failed';
export type AiRunKindT = 'organize_idea' | 'summarize_source' | 'generate_content';
export type AiEntityT = 'project' | 'idea' | 'source' | 'task' | 'content_item';

export async function createAiRun(input: {
  kind: AiRunKindT;
  status: AiRunStatusT;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  entity_type: AiEntityT;
  entity_id: string;
}): Promise<{ id: string }> {
  const { supabase, uid } = await ctx();
  const { data, error } = await supabase
    .from('ai_runs')
    .insert({ ...input, owner_id: uid })
    .select('id')
    .single();
  return ok(data, error);
}

export async function updateAiRun(
  id: string,
  patch: { status: AiRunStatusT; output?: Record<string, unknown> | null },
): Promise<void> {
  const { supabase, uid } = await ctx();
  const { error } = await supabase.from('ai_runs').update(patch).eq('id', id).eq('owner_id', uid);
  if (error) throw new DataError(error.message);
}
