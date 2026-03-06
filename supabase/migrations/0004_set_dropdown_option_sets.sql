create table if not exists public.set_dropdown_option_sets (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.sets (id) on delete cascade,
  name text not null,
  options_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists set_dropdown_option_sets_set_id_idx on public.set_dropdown_option_sets (set_id);
create index if not exists set_dropdown_option_sets_created_at_idx on public.set_dropdown_option_sets (created_at desc);

alter table public.set_dropdown_option_sets enable row level security;

drop trigger if exists set_dropdown_option_sets_updated_at_trigger on public.set_dropdown_option_sets;
create trigger set_dropdown_option_sets_updated_at_trigger
before update on public.set_dropdown_option_sets
for each row execute function public.handle_updated_at();

drop policy if exists "set_dropdown_option_sets_owner_crud" on public.set_dropdown_option_sets;
create policy "set_dropdown_option_sets_owner_crud"
on public.set_dropdown_option_sets for all
using (exists (
  select 1 from public.sets s
  where s.id = set_id and s.owner_id = auth.uid()
))
with check (exists (
  select 1 from public.sets s
  where s.id = set_id and s.owner_id = auth.uid()
));
