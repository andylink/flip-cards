import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DesignClient } from './ui';

export default async function DesignPage({ params }: { params: { setId: string } }) {
  const supabase = await createClient();
  const { setId } = params;

  const { data: setData } = await supabase
    .from('sets')
    .select('id,title,owner_id,visibility,soft_deleted')
    .eq('id', setId)
    .single();

  if (!setData || setData.soft_deleted) notFound();

  const { data: cards } = await supabase
    .from('cards')
    .select('id,set_id,title,canvas_json,order_index')
    .eq('set_id', setId)
    .order('order_index', { ascending: true });

  return <DesignClient setId={setId} setTitle={setData.title} initialCards={cards ?? []} />;
}
