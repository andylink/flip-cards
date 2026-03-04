import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PlayClient } from './ui';

export default async function PlayPage({ params }: { params: { setId: string } }) {
  const supabase = await createClient();
  const { setId } = params;

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const { data: setData } = await supabase
    .from('sets')
    .select('id,title,owner_id,visibility,soft_deleted')
    .eq('id', setId)
    .single();

  if (!setData || setData.soft_deleted) notFound();

  if (setData.visibility === 'private' && setData.owner_id !== user?.id) {
    redirect('/login');
  }

  const { data: cards } = await supabase
    .from('cards')
    .select('id,title,canvas_json,order_index,answers(type,schema_json)')
    .eq('set_id', setId);

  return <PlayClient setId={setId} setTitle={setData.title} initialCards={cards ?? []} userId={user?.id ?? null} />;
}
