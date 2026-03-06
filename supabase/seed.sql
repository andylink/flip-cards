insert into public.profiles (id, email, display_name, role)
values ('00000000-0000-0000-0000-000000000001', 'demo@flipforge.app', 'Demo User', 'user')
on conflict (id) do nothing;

insert into public.sets (id, owner_id, title, description, visibility, tags)
values (
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'Biology Basics',
  'Starter set for FlipForge demo.',
  'public',
  array['biology', 'basics']
)
on conflict (id) do nothing;

insert into public.cards (id, set_id, title, question_text, canvas_json, order_index)
values
(
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'Cell Organelle',
  'What organelle is the powerhouse of the cell?',
  '{"width":1024,"height":576,"nodes":[{"id":"n1","type":"text","x":120,"y":110,"text":"What organelle is the powerhouse of the cell?","fontSize":40,"fill":"#0f172a"}]}'::jsonb,
  0
),
(
  '20000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  'DNA Expansion',
  'DNA stands for what?',
  '{"width":1024,"height":576,"nodes":[{"id":"n2","type":"text","x":140,"y":120,"text":"DNA stands for _____.","fontSize":44,"fill":"#0f172a"}]}'::jsonb,
  1
),
(
  '20000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000001',
  'Cell Type',
  'Plants have what type of walls?',
  '{"width":1024,"height":576,"nodes":[{"id":"n3","type":"text","x":130,"y":100,"text":"Plants have _____ walls.","fontSize":44,"fill":"#0f172a"}]}'::jsonb,
  2
)
on conflict (id) do nothing;

insert into public.answers (card_id, type, schema_json)
values
(
  '20000000-0000-0000-0000-000000000001',
  'freeform',
  '{"accepted":["mitochondria","mitochondrion"],"trim":true,"caseSensitive":false}'::jsonb
),
(
  '20000000-0000-0000-0000-000000000002',
  'cloze',
  '{"template":"DNA stands for {{blank}}.","blanks":[{"accepted":["deoxyribonucleic acid"]}]}'::jsonb
),
(
  '20000000-0000-0000-0000-000000000003',
  'dropdown',
  '{"template":"Plants have {{blank}} walls.","blanks":[{"options":["cell","membrane","nuclear"],"correctIndex":0}]}'::jsonb
)
on conflict do nothing;
