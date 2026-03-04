import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Input } from '@/components/Common/Input';
import { Select } from '@/components/Common/Select';

async function createSetAction(formData: FormData) {
  'use server';

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const title = String(formData.get('title') ?? 'Untitled set').trim();
  const description = String(formData.get('description') ?? '').trim();
  const visibility = String(formData.get('visibility') ?? 'private');

  const { error: profileError } = await supabase.from('profiles').upsert(
    {
      id: user.id,
      email: user.email ?? null,
      display_name:
        (user.user_metadata?.display_name as string | undefined) ??
        (user.user_metadata?.full_name as string | undefined) ??
        null
    },
    { onConflict: 'id' }
  );

  if (profileError) {
    throw new Error(profileError.message);
  }

  const { data, error } = await supabase
    .from('sets')
    .insert({ owner_id: user.id, title, description, visibility })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to create set');
  }

  redirect(`/sets/${data.id}/design`);
}

export default function NewSetPage() {
  return (
    <form action={createSetAction} className="mx-auto max-w-2xl space-y-3 rounded-md border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <h1 className="text-xl font-semibold">Create New Set</h1>
      <div>
        <label className="mb-1 block text-sm">Title</label>
        <Input name="title" required />
      </div>
      <div>
        <label className="mb-1 block text-sm">Description</label>
        <Input name="description" />
      </div>
      <div>
        <label className="mb-1 block text-sm">Visibility</label>
        <Select defaultValue="private" name="visibility">
          <option value="private">Private</option>
          <option value="unlisted">Unlisted</option>
          <option value="public">Public</option>
        </Select>
      </div>
      <button className="focus-ring rounded-md bg-blue-600 px-3 py-2 text-sm text-white" type="submit">
        Create set
      </button>
    </form>
  );
}
