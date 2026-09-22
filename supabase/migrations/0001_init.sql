-- ===========================================================================
-- My Mind OS — Milestone 1 schema
-- 8 MVP tables, soft delete, shared owner_id, updated_at triggers, indexes,
-- and the "one active project" guard. RLS lives in 0002_rls.sql.
-- ===========================================================================

create extension if not exists pgcrypto;

-- --- shared helper: keep updated_at fresh -------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- users — mirror of auth.users (owner_id = id for uniform RLS)
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id           uuid primary key references auth.users (id) on delete cascade,
  owner_id     uuid not null,
  email        text not null,
  display_name text,
  locale       text not null default 'ar' check (locale in ('ar', 'en')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

-- Auto-provision a public.users row whenever an auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, owner_id, email, display_name)
  values (new.id, new.id, new.email, new.raw_user_meta_data ->> 'display_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 200),
  description text,
  status      text not null default 'active'
                check (status in ('active', 'paused', 'done', 'archived')),
  priority    text not null default 'medium'
                check (priority in ('low', 'medium', 'high')),
  is_active   boolean not null default false,
  next_action text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- One active project per owner (anti-distraction rule).
create unique index if not exists projects_one_active_per_owner
  on public.projects (owner_id)
  where is_active and deleted_at is null;

create index if not exists projects_owner_idx on public.projects (owner_id) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- ideas
-- ---------------------------------------------------------------------------
create table if not exists public.ideas (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 300),
  note       text,
  status     text not null default 'inbox'
               check (status in ('inbox', 'organized', 'snoozed', 'archived')),
  project_id uuid references public.projects (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists ideas_owner_idx on public.ideas (owner_id) where deleted_at is null;
create index if not exists ideas_status_idx on public.ideas (owner_id, status) where deleted_at is null;
create index if not exists ideas_project_idx on public.ideas (project_id);

-- ---------------------------------------------------------------------------
-- sources
-- ---------------------------------------------------------------------------
create table if not exists public.sources (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  kind       text not null
               check (kind in ('book', 'podcast', 'video', 'article', 'link', 'note')),
  title      text not null check (char_length(title) between 1 and 300),
  url        text,
  summary    text,
  project_id uuid references public.projects (id) on delete set null,
  idea_id    uuid references public.ideas (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists sources_owner_idx on public.sources (owner_id) where deleted_at is null;
create index if not exists sources_project_idx on public.sources (project_id);
create index if not exists sources_idea_idx on public.sources (idea_id);

-- ---------------------------------------------------------------------------
-- tasks (always belong to a project)
-- ---------------------------------------------------------------------------
create table if not exists public.tasks (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users (id) on delete cascade,
  title          text not null check (char_length(title) between 1 and 300),
  status         text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  is_next_action boolean not null default false,
  project_id     uuid not null references public.projects (id) on delete cascade,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

create index if not exists tasks_owner_idx on public.tasks (owner_id) where deleted_at is null;
create index if not exists tasks_project_idx on public.tasks (project_id) where deleted_at is null;
create index if not exists tasks_next_action_idx
  on public.tasks (project_id) where is_next_action and deleted_at is null;

-- ---------------------------------------------------------------------------
-- content_items (springs from an idea or a source)
-- ---------------------------------------------------------------------------
create table if not exists public.content_items (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  kind       text not null check (kind in ('hook', 'script', 'post', 'summary')),
  body       text not null check (char_length(body) between 1 and 20000),
  status     text not null default 'draft' check (status in ('draft', 'review', 'approved')),
  idea_id    uuid references public.ideas (id) on delete set null,
  source_id  uuid references public.sources (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists content_owner_idx on public.content_items (owner_id) where deleted_at is null;
create index if not exists content_idea_idx on public.content_items (idea_id);
create index if not exists content_source_idx on public.content_items (source_id);

-- ---------------------------------------------------------------------------
-- links (generic relations between any two entities)
-- ---------------------------------------------------------------------------
create table if not exists public.links (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  from_type  text not null
               check (from_type in ('project', 'idea', 'source', 'task', 'content_item')),
  from_id    uuid not null,
  to_type    text not null
               check (to_type in ('project', 'idea', 'source', 'task', 'content_item')),
  to_id      uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint links_no_self check (not (from_type = to_type and from_id = to_id))
);

create index if not exists links_owner_idx on public.links (owner_id) where deleted_at is null;
create index if not exists links_from_idx on public.links (from_type, from_id);
create index if not exists links_to_idx on public.links (to_type, to_id);
create unique index if not exists links_unique_pair
  on public.links (owner_id, from_type, from_id, to_type, to_id)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- ai_runs (every AI proposal, pending human approval)
-- ---------------------------------------------------------------------------
create table if not exists public.ai_runs (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  kind        text not null
                check (kind in ('organize_idea', 'summarize_source', 'generate_content')),
  status      text not null default 'pending'
                check (status in ('pending', 'proposed', 'approved', 'rejected', 'failed')),
  input       jsonb not null default '{}'::jsonb,
  output      jsonb,
  entity_type text check (entity_type in ('project', 'idea', 'source', 'task', 'content_item')),
  entity_id   uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index if not exists ai_runs_owner_idx on public.ai_runs (owner_id) where deleted_at is null;
create index if not exists ai_runs_status_idx on public.ai_runs (owner_id, status);

-- ---------------------------------------------------------------------------
-- updated_at triggers for every table
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'users', 'projects', 'ideas', 'sources', 'tasks', 'content_items', 'links', 'ai_runs'
  ]
  loop
    execute format('drop trigger if exists set_updated_at on public.%I;', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at();', t);
  end loop;
end;
$$;
