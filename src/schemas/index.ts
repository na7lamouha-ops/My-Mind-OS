import { z } from 'zod';

/**
 * Zod schemas for the eight MVP entities. These are the single source of truth
 * shared by the UI, the server routes and (mirrored by) the SQL migrations.
 * Every insert/update crossing a trust boundary must be parsed here first.
 */

// ---- Shared primitives --------------------------------------------------

export const uuid = z.string().uuid();
export const isoDate = z.string().datetime({ offset: true });

const baseRow = {
  id: uuid,
  owner_id: uuid,
  created_at: isoDate,
  updated_at: isoDate,
  deleted_at: isoDate.nullable(),
};

// ---- Enums (must match the CHECK constraints in migrations) --------------

export const ProjectStatus = z.enum(['active', 'paused', 'done', 'archived']);
export const Priority = z.enum(['low', 'medium', 'high']);
export const IdeaStatus = z.enum(['inbox', 'organized', 'snoozed', 'archived']);
export const SourceKind = z.enum(['book', 'podcast', 'video', 'article', 'link', 'note']);
export const TaskStatus = z.enum(['todo', 'doing', 'done']);
export const ContentKind = z.enum(['hook', 'script', 'post', 'summary']);
export const ContentStatus = z.enum(['draft', 'review', 'approved']);
export const LinkEntity = z.enum(['project', 'idea', 'source', 'task', 'content_item']);
export const AiRunKind = z.enum(['organize_idea', 'summarize_source', 'generate_content']);
export const AiRunStatus = z.enum(['pending', 'proposed', 'approved', 'rejected', 'failed']);

// ---- users --------------------------------------------------------------

export const User = z.object({
  ...baseRow,
  email: z.string().email(),
  display_name: z.string().min(1).max(120).nullable(),
  locale: z.enum(['ar', 'en']).default('ar'),
});
export type User = z.infer<typeof User>;

// ---- projects -----------------------------------------------------------

export const Project = z.object({
  ...baseRow,
  title: z.string().min(1).max(200),
  description: z.string().max(4000).nullable(),
  status: ProjectStatus,
  priority: Priority,
  is_active: z.boolean(),
  next_action: z.string().max(500).nullable(),
});
export type Project = z.infer<typeof Project>;

export const ProjectInsert = Project.pick({
  title: true,
  description: true,
  status: true,
  priority: true,
  is_active: true,
  next_action: true,
}).partial({ description: true, status: true, priority: true, is_active: true, next_action: true });
export type ProjectInsert = z.infer<typeof ProjectInsert>;

// ---- ideas --------------------------------------------------------------

export const Idea = z.object({
  ...baseRow,
  title: z.string().min(1).max(300),
  note: z.string().max(8000).nullable(),
  status: IdeaStatus,
  project_id: uuid.nullable(),
});
export type Idea = z.infer<typeof Idea>;

export const IdeaInsert = Idea.pick({
  title: true,
  note: true,
  status: true,
  project_id: true,
}).partial({ note: true, status: true, project_id: true });
export type IdeaInsert = z.infer<typeof IdeaInsert>;

// ---- sources ------------------------------------------------------------

export const Source = z.object({
  ...baseRow,
  kind: SourceKind,
  title: z.string().min(1).max(300),
  url: z.string().url().nullable(),
  summary: z.string().max(8000).nullable(),
  project_id: uuid.nullable(),
  idea_id: uuid.nullable(),
});
export type Source = z.infer<typeof Source>;

export const SourceInsert = Source.pick({
  kind: true,
  title: true,
  url: true,
  summary: true,
  project_id: true,
  idea_id: true,
}).partial({ url: true, summary: true, project_id: true, idea_id: true });
export type SourceInsert = z.infer<typeof SourceInsert>;

// ---- tasks --------------------------------------------------------------

export const Task = z.object({
  ...baseRow,
  title: z.string().min(1).max(300),
  status: TaskStatus,
  is_next_action: z.boolean(),
  project_id: uuid, // tasks always belong to a project
});
export type Task = z.infer<typeof Task>;

export const TaskInsert = Task.pick({
  title: true,
  status: true,
  is_next_action: true,
  project_id: true,
}).partial({ status: true, is_next_action: true });
export type TaskInsert = z.infer<typeof TaskInsert>;

// ---- content_items ------------------------------------------------------

export const ContentItem = z.object({
  ...baseRow,
  kind: ContentKind,
  body: z.string().min(1).max(20000),
  status: ContentStatus,
  idea_id: uuid.nullable(),
  source_id: uuid.nullable(),
});
export type ContentItem = z.infer<typeof ContentItem>;

export const ContentItemInsert = ContentItem.pick({
  kind: true,
  body: true,
  status: true,
  idea_id: true,
  source_id: true,
}).partial({ status: true, idea_id: true, source_id: true });
export type ContentItemInsert = z.infer<typeof ContentItemInsert>;

// ---- links (generic relations between entities) -------------------------

export const Link = z.object({
  ...baseRow,
  from_type: LinkEntity,
  from_id: uuid,
  to_type: LinkEntity,
  to_id: uuid,
});
export type Link = z.infer<typeof Link>;

export const LinkInsert = Link.pick({
  from_type: true,
  from_id: true,
  to_type: true,
  to_id: true,
});
export type LinkInsert = z.infer<typeof LinkInsert>;

// ---- ai_runs ------------------------------------------------------------

export const AiRun = z.object({
  ...baseRow,
  kind: AiRunKind,
  status: AiRunStatus,
  input: z.record(z.unknown()),
  output: z.record(z.unknown()).nullable(),
  entity_type: LinkEntity.nullable(),
  entity_id: uuid.nullable(),
});
export type AiRun = z.infer<typeof AiRun>;

export const AiRunInsert = AiRun.pick({
  kind: true,
  input: true,
  entity_type: true,
  entity_id: true,
}).partial({ entity_type: true, entity_id: true });
export type AiRunInsert = z.infer<typeof AiRunInsert>;
