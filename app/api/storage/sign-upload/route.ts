import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const fileName = String(body.fileName ?? 'upload.bin');
  const contentType = String(body.contentType ?? 'application/octet-stream');
  const path = `${user.id}/${Date.now()}-${fileName}`;

  const admin = createAdminClient();
  const { data, error } = await admin.storage.from('card-assets').createSignedUploadUrl(path, {
    upsert: false
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await admin.from('assets').insert({
    owner_id: user.id,
    bucket: 'card-assets',
    path,
    mime_type: contentType
  });

  return NextResponse.json({ path, token: data.token });
}
