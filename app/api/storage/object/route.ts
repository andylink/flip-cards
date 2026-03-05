import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path')?.trim();

  if (!path) {
    return NextResponse.json({ error: 'Missing image path.' }, { status: 400 });
  }

  if (!path.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await supabase.storage.from('card-assets').download(path);
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Unable to load image.' }, { status: 404 });
  }

  return new NextResponse(data, {
    headers: {
      'Content-Type': data.type || 'application/octet-stream',
      'Cache-Control': 'private, max-age=300'
    }
  });
}
