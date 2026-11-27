-- Fix the circular RLS checks between documents and document_collaborators.
-- Run this once in Supabase Dashboard → SQL Editor for an existing project.

begin;

create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.is_document_collaborator(p_document_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.document_collaborators as dc
    where dc.document_id = p_document_id
      and dc.user_id = (select auth.uid())
  );
$$;

create or replace function private.is_document_editor(p_document_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.document_collaborators as dc
    where dc.document_id = p_document_id
      and dc.user_id = (select auth.uid())
      and dc.role = 'editor'
  );
$$;

create or replace function private.is_document_owner(p_document_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.documents as d
    where d.id = p_document_id
      and d.owner_id = (select auth.uid())
  );
$$;

revoke all on function private.is_document_collaborator(uuid) from public, anon;
revoke all on function private.is_document_editor(uuid) from public, anon;
revoke all on function private.is_document_owner(uuid) from public, anon;
grant execute on function private.is_document_collaborator(uuid) to authenticated;
grant execute on function private.is_document_editor(uuid) to authenticated;
grant execute on function private.is_document_owner(uuid) to authenticated;

drop policy if exists "Read own or shared documents" on public.documents;
create policy "Read own or shared documents"
  on public.documents for select to authenticated
  using (
    (select auth.uid()) = owner_id
    or (select private.is_document_collaborator(id))
  );

drop policy if exists "Owner inserts documents" on public.documents;
create policy "Owner inserts documents"
  on public.documents for insert to authenticated
  with check ((select auth.uid()) = owner_id);

drop policy if exists "Owner and editors update documents" on public.documents;
create policy "Owner and editors update documents"
  on public.documents for update to authenticated
  using (
    (select auth.uid()) = owner_id
    or (select private.is_document_editor(id))
  )
  with check (
    (select auth.uid()) = owner_id
    or (select private.is_document_editor(id))
  );

drop policy if exists "Owner deletes documents" on public.documents;
create policy "Owner deletes documents"
  on public.documents for delete to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "Read collaborators of accessible documents" on public.document_collaborators;
create policy "Read collaborators of accessible documents"
  on public.document_collaborators for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.is_document_owner(document_id))
  );

drop policy if exists "Owner manages collaborators" on public.document_collaborators;
create policy "Owner manages collaborators"
  on public.document_collaborators for all to authenticated
  using ((select private.is_document_owner(document_id)))
  with check ((select private.is_document_owner(document_id)));

-- Table privileges are needed in addition to RLS policies. RLS continues
-- to restrict the rows each signed-in user can access.
grant select, insert, update, delete on public.documents to authenticated;
grant select, insert, update, delete on public.document_collaborators to authenticated;
grant select, update on public.profiles to authenticated;

commit;
