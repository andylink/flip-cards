import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { HoldToDeleteSetButton } from './HoldToDeleteSetButton';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: sets, error } = await supabase
    .from('sets')
    .select('id,title,description,visibility,updated_at')
    .eq('owner_id', user.id)
    .eq('soft_deleted', false)
    .order('updated_at', { ascending: false });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your Sets</h1>
        <Link className="focus-ring rounded-md bg-blue-600 px-3 py-2 text-sm text-white" href="/sets/new">
          Create Set
        </Link>
      </div>
      {error ? <p className="text-rose-600">Failed to load sets: {error.message}</p> : null}
      <ul className="grid gap-3 md:grid-cols-2">
        {(sets ?? []).map((set) => (
          <li className="rounded-md border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900" key={set.id}>
            <p className="text-lg font-semibold">{set.title}</p>
            <p className="text-sm text-slate-600 dark:text-slate-300">{set.description}</p>
            <div className="mt-3 flex gap-2 text-sm">
              <Link className="focus-ring rounded bg-slate-200 px-2 py-1 dark:bg-slate-700" href={`/sets/${set.id}/design`}>
                Design
              </Link>
              <Link className="focus-ring rounded bg-slate-200 px-2 py-1 dark:bg-slate-700" href={`/sets/${set.id}/play`}>
                Play
              </Link>
              <HoldToDeleteSetButton setId={set.id} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
