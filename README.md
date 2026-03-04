# FlipForge

FlipForge is a Next.js 14 (App Router, TypeScript) flip-card learning tool with two modes:

- Design View: canvas editor + answer schema builder
- Play View: randomized practice, scoring, streaks, and attempts tracking

## Tech Stack

- Next.js 14 + TypeScript + App Router
- Tailwind CSS
- Zustand
- react-konva
- Supabase (`auth`, `Postgres`, `storage`) with RLS
- Vitest + Testing Library

## Quick Start

1. Install dependencies:

	```bash
	npm install
	```

2. Copy env file and fill values:

	```bash
	cp .env.example .env.local
	```

3. Create a Supabase project and set:

	- `NEXT_PUBLIC_SUPABASE_URL`
	- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
	- `SUPABASE_URL`
	- `SUPABASE_ANON_KEY`
	- `SUPABASE_SERVICE_ROLE_KEY`

4. Run migration + seed (Supabase CLI):

	```bash
	supabase db reset
	```

	Or run SQL manually:

	- `supabase/migrations/0001_init.sql`
	- `supabase/seed.sql`

5. Start development server:

	```bash
	npm run dev
	```

## Scripts

- `npm run dev` – local dev
- `npm run build` – production build
- `npm run start` – start prod server
- `npm run typecheck` – TS type checks
- `npm run lint` – Next lint
- `npm test` – Vitest suite

## App Routes

- `/login` – email magic link + GitHub OAuth
- `/` – dashboard (user sets)
- `/sets/new` – create set
- `/sets/[setId]/design` – design mode
- `/sets/[setId]/play` – play mode
- `/api/storage/sign-upload` – signed upload URL for `card-assets`

## Supabase

- SQL schema: `supabase/migrations/0001_init.sql`
- Seed data: `supabase/seed.sql`
- Storage bucket: `card-assets` (private)

## Testing

Current suite includes:

- answer evaluation unit tests
- cloze parsing tests
- AnswerWidget component tests
- CanvasStage interaction baseline test

## CI

GitHub Actions workflow: `.github/workflows/ci.yml`

- runs `typecheck`, `lint`, `test` on push + PR

## Deployment (Vercel)

- Configure env vars in Vercel project settings.
- `vercel.json` is included for framework detection.

## Notes / TODO

- Design View includes baseline editor behavior and autosave, with clear TODO hooks for advanced grouping/crop/transformer behaviors.
- Answer Builder editors are scaffolded and schema-driven, and can be connected to full per-card persistence workflows next.