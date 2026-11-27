-- =================================================================
-- CloudSync Database Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- =================================================================

-- ── Enable required extensions ────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Profiles (extends auth.users) ─────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on new signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Documents ──────────────────────────────────────────────────────
create table if not exists public.documents (
  id          uuid primary key default uuid_generate_v4(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  title       text not null default 'Untitled Document',
  -- Yjs binary snapshot stored as bytea for fast load
  yjs_state   bytea,
  -- Plain-text snapshot for search / preview
  content_text text default '',
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);

alter table public.documents enable row level security;

-- ── Document Collaborators ─────────────────────────────────────────
create table if not exists public.document_collaborators (
  id          uuid primary key default uuid_generate_v4(),
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role        text not null check (role in ('viewer', 'editor', 'owner')) default 'editor',
  created_at  timestamptz default now() not null,
  unique(document_id, user_id)
);

alter table public.document_collaborators enable row level security;

-- ── RLS helper functions ────────────────────────────────────────────
-- These SECURITY DEFINER functions read the related table without
-- re-entering its RLS policy, which breaks the documents/collaborators cycle.
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

-- ── RLS: Documents ─────────────────────────────────────────────────
-- Owners and collaborators can read
create policy "Read own or shared documents"
  on public.documents for select to authenticated
  using (
    (select auth.uid()) = owner_id
    or (select private.is_document_collaborator(id))
  );

-- Only owner can insert
create policy "Owner inserts documents"
  on public.documents for insert to authenticated
  with check ((select auth.uid()) = owner_id);

-- Owner + editors can update
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

-- Only owner can delete
create policy "Owner deletes documents"
  on public.documents for delete to authenticated
  using ((select auth.uid()) = owner_id);

-- ── RLS: Collaborators ─────────────────────────────────────────────
create policy "Read collaborators of accessible documents"
  on public.document_collaborators for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.is_document_owner(document_id))
  );

create policy "Owner manages collaborators"
  on public.document_collaborators for all to authenticated
  using ((select private.is_document_owner(document_id)))
  with check ((select private.is_document_owner(document_id)));

-- Table privileges are required in addition to RLS policies. These grants
-- let signed-in users attempt the operations above; RLS still limits rows.
grant select, insert, update, delete on public.documents to authenticated;
grant select, insert, update, delete on public.document_collaborators to authenticated;
grant select, update on public.profiles to authenticated;

-- ── Auto-update updated_at ──────────────────────────────────────────
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger documents_updated_at
  before update on public.documents
  for each row execute function public.update_updated_at();

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at();
