create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  role text default 'user',
  created_at timestamptz not null default now()
);

create table if not exists public.sets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text default '',
  visibility text not null default 'private' check (visibility in ('private', 'unlisted', 'public')),
  tags text[] default '{}',
  soft_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  canvas_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.sets (id) on delete cascade,
  title text not null,
  canvas_json jsonb not null,
  template_id uuid references public.templates (id) on delete set null,
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards (id) on delete cascade,
  type text not null check (type in ('freeform', 'mcq', 'cloze', 'dropdown', 'multiselect')),
  schema_json jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.play_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  set_id uuid not null references public.sets (id) on delete cascade,
  mode text not null default 'practice',
  settings_json jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.play_sessions (id) on delete cascade,
  card_id uuid not null references public.cards (id) on delete cascade,
  response_json jsonb not null default '{}'::jsonb,
  correct boolean not null,
  score_delta int not null default 0,
  elapsed_ms int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  bucket text not null default 'card-assets',
  path text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create index if not exists sets_owner_id_idx on public.sets (owner_id);
create index if not exists sets_created_at_idx on public.sets (created_at desc);
create index if not exists sets_tags_gin_idx on public.sets using gin (tags);
create index if not exists cards_set_id_idx on public.cards (set_id);
create index if not exists cards_created_at_idx on public.cards (created_at desc);
create index if not exists templates_owner_id_idx on public.templates (owner_id);
create index if not exists answers_card_id_idx on public.answers (card_id);
create index if not exists answers_schema_json_gin_idx on public.answers using gin (schema_json);
create index if not exists play_sessions_user_id_idx on public.play_sessions (user_id);
create index if not exists play_sessions_set_id_idx on public.play_sessions (set_id);
create index if not exists attempts_session_id_idx on public.attempts (session_id);
create index if not exists attempts_card_id_idx on public.attempts (card_id);
create index if not exists attempts_response_json_gin_idx on public.attempts using gin (response_json);
create index if not exists assets_owner_id_idx on public.assets (owner_id);

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sets_updated_at_trigger on public.sets;
create trigger sets_updated_at_trigger
before update on public.sets
for each row execute function public.handle_updated_at();

drop trigger if exists cards_updated_at_trigger on public.cards;
create trigger cards_updated_at_trigger
before update on public.cards
for each row execute function public.handle_updated_at();

drop trigger if exists templates_updated_at_trigger on public.templates;
create trigger templates_updated_at_trigger
before update on public.templates
for each row execute function public.handle_updated_at();

alter table public.profiles enable row level security;
alter table public.sets enable row level security;
alter table public.cards enable row level security;
alter table public.templates enable row level security;
alter table public.answers enable row level security;
alter table public.play_sessions enable row level security;
alter table public.attempts enable row level security;
alter table public.assets enable row level security;

create policy "profiles_select_own"
on public.profiles for select
using (auth.uid() = id);

create policy "profiles_update_own"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "profiles_insert_own"
on public.profiles for insert
with check (auth.uid() = id);

create policy "sets_owner_crud"
on public.sets for all
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "sets_public_read"
on public.sets for select
using ((visibility in ('public', 'unlisted')) and soft_deleted = false);

create policy "cards_owner_crud"
on public.cards for all
using (exists (
  select 1 from public.sets s where s.id = set_id and s.owner_id = auth.uid()
))
with check (exists (
  select 1 from public.sets s where s.id = set_id and s.owner_id = auth.uid()
));

create policy "cards_public_read"
on public.cards for select
using (exists (
  select 1 from public.sets s
  where s.id = set_id and s.visibility in ('public', 'unlisted') and s.soft_deleted = false
));

create policy "templates_owner_crud"
on public.templates for all
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "answers_owner_crud"
on public.answers for all
using (exists (
  select 1 from public.cards c
  join public.sets s on s.id = c.set_id
  where c.id = card_id and s.owner_id = auth.uid()
))
with check (exists (
  select 1 from public.cards c
  join public.sets s on s.id = c.set_id
  where c.id = card_id and s.owner_id = auth.uid()
));

create policy "answers_public_read"
on public.answers for select
using (exists (
  select 1 from public.cards c
  join public.sets s on s.id = c.set_id
  where c.id = card_id and s.visibility in ('public', 'unlisted') and s.soft_deleted = false
));

create policy "play_sessions_own_crud"
on public.play_sessions for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "attempts_own_crud"
on public.attempts for all
using (exists (
  select 1 from public.play_sessions ps where ps.id = session_id and ps.user_id = auth.uid()
))
with check (exists (
  select 1 from public.play_sessions ps where ps.id = session_id and ps.user_id = auth.uid()
));

create policy "assets_owner_crud"
on public.assets for all
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('card-assets', 'card-assets', false, 10485760, '{image/png,image/jpeg,image/webp,image/gif}')
on conflict (id) do nothing;

create policy "storage_read_own_card_assets"
on storage.objects for select
using (
  bucket_id = 'card-assets'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "storage_insert_own_card_assets"
on storage.objects for insert
with check (
  bucket_id = 'card-assets'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "storage_update_own_card_assets"
on storage.objects for update
using (
  bucket_id = 'card-assets'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'card-assets'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "storage_delete_own_card_assets"
on storage.objects for delete
using (
  bucket_id = 'card-assets'
  and auth.uid()::text = (storage.foldername(name))[1]
);
