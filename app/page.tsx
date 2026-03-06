import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="pointer-events-none absolute -left-24 top-[-100px] h-80 w-80 rounded-full bg-amber-200/70 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 top-16 h-72 w-72 rounded-full bg-sky-200/80 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-120px] left-1/3 h-80 w-80 rounded-full bg-emerald-200/70 blur-3xl" />

      <section className="relative z-10 px-6 pb-16 pt-12 md:px-12 md:pt-16">
        <p className="inline-flex rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white">
          Study Faster
        </p>
        <h1 className="mt-5 max-w-4xl text-4xl font-black leading-tight text-slate-900 md:text-6xl">
          Build flashcards that feel like your brain made them.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-slate-700 md:text-lg">
          FlipForge helps you design rich card sets, test yourself with multiple answer modes, and keep momentum with
          clear scoring and session feedback.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          {user ? (
            <>
              <Link
                className="focus-ring rounded-md bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                href="/dashboard"
              >
                Go to Dashboard
              </Link>
              <Link
                className="focus-ring rounded-md bg-white px-5 py-3 text-sm font-semibold text-slate-900 ring-1 ring-slate-300 transition hover:bg-slate-100"
                href="/sets/new"
              >
                Create a New Set
              </Link>
            </>
          ) : (
            <>
              <Link
                className="focus-ring rounded-md bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                href="/login"
              >
                Log In
              </Link>
              <Link
                className="focus-ring rounded-md bg-amber-300 px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-amber-200"
                href="/login?mode=signup"
              >
                Register Free
              </Link>
            </>
          )}
        </div>
      </section>

      <section className="relative z-10 grid gap-4 px-6 pb-6 md:grid-cols-3 md:px-12 md:pb-12">
        <article className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Design Studio</p>
          <h2 className="mt-2 text-xl font-bold text-slate-900">Flexible Card Building</h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            Mix free form, cloze deletion, dropdown prompts, and MCQs in one set without friction.
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Play Modes</p>
          <h2 className="mt-2 text-xl font-bold text-slate-900">Answer How You Think</h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            Move through prompts with instant checking, clear correctness cues, and lightweight session flow.
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Review Loop</p>
          <h2 className="mt-2 text-xl font-bold text-slate-900">See Progress Immediately</h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            Session summaries make weak spots obvious so you know exactly what to revisit next.
          </p>
        </article>
      </section>
    </div>
  );
}
