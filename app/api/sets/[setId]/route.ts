import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type RouteContext = {
  params: {
    setId: string;
  };
};

export async function DELETE(_request: Request, { params }: RouteContext) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const setId = params.setId;

  const { data, error } = await supabase
    .from('sets')
    .update({ soft_deleted: true })
    .eq('id', setId)
    .eq('owner_id', user.id)
    .eq('soft_deleted', false)
    .select('id')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!data) {
    return NextResponse.json({ error: 'Set not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
