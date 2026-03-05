create table if not exists public.set_assets (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.sets (id) on delete cascade,
  name text not null,
  node_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists set_assets_set_id_idx on public.set_assets (set_id);
create index if not exists set_assets_created_at_idx on public.set_assets (created_at desc);

alter table public.set_assets enable row level security;

drop trigger if exists set_assets_updated_at_trigger on public.set_assets;
create trigger set_assets_updated_at_trigger
before update on public.set_assets
for each row execute function public.handle_updated_at();

drop policy if exists "set_assets_owner_crud" on public.set_assets;
create policy "set_assets_owner_crud"
on public.set_assets for all
using (exists (
  select 1 from public.sets s
  where s.id = set_id and s.owner_id = auth.uid()
))
with check (exists (
  select 1 from public.sets s
  where s.id = set_id and s.owner_id = auth.uid()
));
