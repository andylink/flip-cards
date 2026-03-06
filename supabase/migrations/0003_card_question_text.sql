alter table public.cards
add column if not exists question_text text not null default '';
