-- ===========================================================================
-- My Mind OS — Row Level Security
-- Every table is private to its owner. A user sees and mutates only rows where
-- owner_id = auth.uid(). The users table keys on id (which equals owner_id).
-- ===========================================================================

-- Enable RLS on all tables.
alter table public.users         enable row level security;
alter table public.projects      enable row level security;
alter table public.ideas         enable row level security;
alter table public.sources       enable row level security;
alter table public.tasks         enable row level security;
alter table public.content_items enable row level security;
alter table public.links         enable row level security;
alter table public.ai_runs       enable row level security;

-- --- users -----------------------------------------------------------------
drop policy if exists users_select on public.users;
create policy users_select on public.users
  for select using (id = auth.uid());

drop policy if exists users_update on public.users;
create policy users_update on public.users
  for update using (id = auth.uid()) with check (id = auth.uid());

-- (insert handled by the security-definer trigger; no delete — soft delete only)

-- --- generic owner policies for the remaining seven tables -----------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'projects', 'ideas', 'sources', 'tasks', 'content_items', 'links', 'ai_runs'
  ]
  loop
    execute format('drop policy if exists %I_select on public.%I;', t, t);
    execute format(
      'create policy %I_select on public.%I
         for select using (owner_id = auth.uid());', t, t);

    execute format('drop policy if exists %I_insert on public.%I;', t, t);
    execute format(
      'create policy %I_insert on public.%I
         for insert with check (owner_id = auth.uid());', t, t);

    execute format('drop policy if exists %I_update on public.%I;', t, t);
    execute format(
      'create policy %I_update on public.%I
         for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());', t, t);

    execute format('drop policy if exists %I_delete on public.%I;', t, t);
    execute format(
      'create policy %I_delete on public.%I
         for delete using (owner_id = auth.uid());', t, t);
  end loop;
end;
$$;
