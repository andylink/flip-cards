import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const ALLOWED_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

const getExtension = (fileName: string) => {
  const lastDot = fileName.lastIndexOf('.');
  return lastDot >= 0 ? fileName.slice(lastDot).toLowerCase() : '';
};

const sanitizeFileName = (fileName: string) => {
  const normalized = fileName.trim().replace(/\s+/g, '-');
  const sanitized = normalized.replace(/[^a-zA-Z0-9._-]/g, '');
  return sanitized || `upload-${Date.now()}.bin`;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const fileName = sanitizeFileName(String(body.fileName ?? 'upload.bin'));
  const contentType = String(body.contentType ?? 'application/octet-stream');
  const extension = getExtension(fileName);

  if (!ALLOWED_IMAGE_MIME_TYPES.has(contentType) || !ALLOWED_IMAGE_EXTENSIONS.has(extension)) {
    return NextResponse.json(
      {
        error: 'Unsupported file type. Allowed formats: PNG, JPEG, WEBP, GIF.'
      },
      { status: 400 }
    );
  }

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
