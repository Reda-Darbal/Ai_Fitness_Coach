# Architecture

AI personal gym coach for beginners. The AI is the coach; the exercise database is the factual catalogue; deterministic code does the math; Postgres RLS is the security boundary.

## System overview

```
Browser (mobile-first)
  │
  ▼
Next.js 16 App Router (Vercel) ── src/proxy.ts (clerkMiddleware → request context only)
  │            │
  │            ├── Clerk (auth: sessions, sign-in/up UI, user management)
  │            │
  │            ├── Neon Postgres  ← via repository layer; every query filters user_id
  │            ├── (Phase 11) object storage for progress photos — host TBD
  │            │
  │            └── Together AI (behind AIProvider) — coaching, program JSON, photo review
  │
  └── ExerciseProvider (vendored free-exercise-db-with-videos snapshot, 317 exercises)
```

**Stack:** Next.js 16.3.4 (App Router, Turbopack), React 19, TypeScript strict, Tailwind CSS v4 (CSS-first tokens), shadcn/ui on Radix (`radix-nova` style), Clerk, Neon Postgres (`@neondatabase/serverless` HTTP driver in the app, `pg` in local scripts), Together AI (`together-ai` SDK), Zod 4.

**Next 16 notes (differ from older Next.js):** `proxy.ts` replaces `middleware.ts` (Node runtime only); `params`/`searchParams` are async with global `PageProps<'/route'>`/`LayoutProps<'/route'>` types; `next lint` is removed (`npm run lint` + `npm run typecheck` instead); `revalidateTag` needs a profile argument — use `updateTag` in server actions for read-your-own-writes; `images.remotePatterns` configured for the exercise R2 bucket (the progress-photo host is added in Phase 11). `cacheComponents` is intentionally **off**: nearly everything is per-user and dynamic; defaults are correct. Bundled docs: `node_modules/next/dist/docs/`.

## Auth architecture (Clerk) + authorization

- Clerk owns sessions and auth UI. `src/proxy.ts` runs `clerkMiddleware()` to establish request context — it protects nothing by itself.
- **Every** protected resource checks auth at the resource level: layouts (`(app)/layout.tsx`, `onboarding/layout.tsx`) and, from Phase 2 on, **every server action and route handler** starts with `const { userId } = await auth()` and rejects when null. This is mandatory: proxy matchers do not cover Server Function calls, and Clerk v7 deprecates `createRouteMatcher` in favor of exactly this pattern.
- The app's user id everywhere is the **Clerk `sub` claim, stored as `TEXT`** (e.g. `user_2abc…`), never a UUID.
- **Authorization lives in the application, not the database.** Neon has no RLS-with-JWT story we trust (`pg_session_jwt` needs per-session JWK setup, its docs are in flux, and its fallback mode lets any database user forge claims), so per-user isolation is enforced by a repository layer instead — see `src/lib/db/session.ts`:
  1. No page, action or component queries the database directly; they call a repository function in `src/lib/db/`.
  2. Every repository function touching user data takes `userId` as its **first** parameter and filters on it.
  3. The only way to obtain that id is `requireUserId()`, which fails closed.
- Every table keeps its `user_id` column, so Postgres RLS can be layered on later — on Neon or anywhere else — without migrating data.
- The browser never talks to Postgres. All data access is server-side (Server Components, Server Actions), which also keeps the connection string off the client.

## Data-access rules

1. Queries are parameterised tagged templates. Never concatenate SQL. The one place that builds SQL dynamically (`updateProfile`'s SET clause) takes column names from a fixed allow-list, never from user input.
2. `user_id TEXT` is denormalized onto **every** user-owned table, children included, so no query needs a join just to prove ownership.
3. Because the database does not enforce isolation, the repository layer is the boundary — a missing `where user_id` is a data leak. Putting userId first in every signature is what makes an omission visible.
4. Migrations are validated against a real Postgres engine in the test suite (PGlite, in-process WASM) — `src/lib/db/migrations.test.ts`.

## Exercise architecture

- Source: vendored snapshot of `free-exercise-db-with-videos` (317 exercises, MIT) at `src/data/exercises.json`. The original repo (`amiinwani/...`) vanished from GitHub; we build from the committed snapshot, not the network. Verified: all 19 fields present on all records; `videos.male`/`videos.female` individually optional (27/14 gaps); IDs are strings (numeric + slug forms); `muscleGroup` is unreliable and unmodeled — use `target` + `secondaryMuscles`.
- Abstraction: `ExerciseProvider` (`src/lib/exercises/provider.ts`) with `FreeExerciseDbProvider` implementation (`free-exercise-db.ts`, `server-only`, Zod-validated, cached in-process). The app talks to the interface only, so the dataset is swappable (future: exerciseapi.dev).
- Phase 2+ seeds the snapshot into `exercise_cache` + `exercise_media` so workouts get FK integrity and media URLs stay replaceable. Media currently hotlinks a third-party R2 bucket (`pub-585d42eb1aa64a67aedf483ec328d3fe.r2.dev`, slug-based paths = kebab-case name) — **mirror to our own object storage before any commercial use**; licensing of the videos needs review at that point too.

## AI architecture

- Abstraction: `AIProvider` (`src/lib/ai/provider.ts`) with `TogetherAIProvider` (`together.ts`): `chat()` for coaching, `generateJson()` for schema-constrained output (Zod schema → JSON Schema via `z.toJSONSchema` → Together `response_format: json_schema` → parse back through the same Zod schema).
- Models are env-configured only (`TOGETHER_MODEL`, `TOGETHER_VISION_MODEL`) — Together retires serverless models aggressively with no redirects. Current candidates: text/JSON `deepseek-ai/DeepSeek-V4-Flash-0731` or `openai/gpt-oss-120b`; vision `Qwen/Qwen3.5-9B` (cheap) or `moonshotai/Kimi-K3` (strong). Verify vision support before enabling photo review (Phase 13).
- **The AI never invents exercises.** Program generation: profile + goal + schedule + equipment + preferences + recent history → deterministic filtering builds a candidate list from the ExerciseProvider → only those candidates go to the model → response validated with Zod → every exercise ID verified to exist → invalid IDs rejected → safety rules applied → saved. Every generation is recorded in `ai_generations` (model, prompt, response, status, latency) for audit and cost control.
- Deterministic code, not AI, computes: volume, trends, totals, completion, rest timing, progressive overload, filtering, dates, PRs. AI does coaching, interpretation, composition, and conservative photo observations only.
- Coach replies obey `profiles.coach_language` (`ar`/`en`/`fr`) and default to concise.

## Coach memory & context retrieval

- `coach_memory`: durable structured facts, one row per `(user_id, key)` — preferences, dislikes, stable observations.
- `coach_summaries`: rolling conversation compression so old chats never re-enter prompts wholesale.
- Retrieval is question-scoped: "what weight for chest press?" pulls that exercise, its last few sessions, the rep target, and the latest progression recommendation — never unrelated history. Chat context = profile facts + relevant workout data + relevant memory + summary, all compact.

## Progress & photos

- `body_weight_logs` (one per user per day) → trends computed in SQL/TS (weekly averages; single-day fluctuations are never presented as progress).
- Progressive overload is a deterministic TS module (Phase 7): e.g. hit top of 8–12 range on all sets with acceptable effort → recommend small increase; falling reps → hold or reduce. The AI only explains the recommendation.
- Progress photos: object storage is chosen in Phase 11 (Cloudflare R2 free tier, Vercel Blob or similar — Neon has no storage product). Requirements unchanged: **private** bucket, paths keyed `{user_id}/…`, access through short-lived signed URLs only, never public. AI photo review (Phase 13) runs only on photos the user explicitly selects, with conservative language and stated limitations (lighting, pose, distance) — never body-fat %, exact mass, or diagnosis.
- Safety: reports of sharp pain, chest pain, dizziness, injury → coach drops workout guidance and points to professional medical evaluation.

## Database schema (outline — migrations in `db/migrations/`)

Conventions: `id uuid primary key default gen_random_uuid()` (unless noted), `user_id text not null` (Clerk `sub`) on every user-owned table, `created_at`/`updated_at timestamptz not null default now()`, FKs indexed.

| Table | Key columns |
|---|---|
| `profiles` | `user_id` PK, display_name, locale, coach_language (`ar/en/fr`), concise_replies bool, sex, birth_year, height_cm, starting_weight_kg, target_weight_kg, goal, experience_level, training_days text[], preferred_time, session_minutes, equipment jsonb, injuries text[], liked_exercises text[], disliked_exercises text[], notes, onboarding_completed_at |
| `exercise_cache` | `id text` PK (provider id), provider, name, body_part, target, secondary_muscles jsonb, equipment, difficulty, compound, unilateral, instructions, steps jsonb, form_cues jsonb, common_mistakes jsonb, breathing, aliases jsonb — global reference data, no user_id; written only by the seed script |
| `exercise_media` | PK (exercise_id FK, kind `video/thumbnail`, sex `male/female`), url, provider — media URLs stay swappable without touching exercise rows |
| `programs` | user_id, title, status (`draft/active/archived`), goal, weeks, meta jsonb, generation_id FK → ai_generations |
| `program_days` | user_id, program_id FK, day_index, name, focus, notes |
| `program_exercises` | user_id, program_day_id FK, exercise_id FK → exercise_cache, order_index, sets, rep_min, rep_max, rest_sec, rpe_target, progression jsonb, notes |
| `workout_sessions` | user_id, program_day_id FK nullable, started_at, completed_at, feeling, notes |
| `workout_exercises` | user_id, session_id FK, exercise_id FK, order_index, was_substituted bool, skipped bool, feedback (`too_easy/too_hard/pain/ok`), notes |
| `workout_sets` | user_id, workout_exercise_id FK, set_index, weight_kg numeric(6,2), reps int, rpe numeric(3,1), is_warmup bool, completed_at |
| `body_weight_logs` | user_id, logged_on date, weight_kg numeric(5,2), notes — unique(user_id, logged_on) |
| `weekly_checkins` | user_id, week_start date, weight_kg, workouts_done int, energy, sleep, soreness, difficulty, liked text[], disliked text[], notes, summary jsonb — unique(user_id, week_start) |
| `progress_photos` | user_id, taken_on date, pose (`front/side/back`), storage_path, weight_kg, notes |
| `coach_conversations` | user_id, title, last_message_at |
| `coach_messages` | user_id, conversation_id FK, role (`user/assistant/system`), content, tokens int |
| `coach_memory` | user_id, key, value jsonb, source, updated_at — unique(user_id, key) |
| `coach_summaries` | user_id, conversation_id FK, up_to_message_id, summary |
| `ai_generations` | user_id, kind (`program/checkin/photo_review/chat`), model, prompt jsonb, response jsonb, status, error, latency_ms |

## Directory map

```
src/
├── proxy.ts                    Clerk request context (Next 16 proxy convention)
├── data/exercises.json         vendored exercise snapshot (+ exercises.meta.json)
├── app/
│   ├── (auth)/                 public: sign-in, sign-up (Clerk catch-all routes)
│   ├── onboarding/             authed, chrome-free flow (Phase 2)
│   ├── (app)/                  authed + AppShell: dashboard, workout, exercises, progress, coach, settings
│   └── design/                 internal design-system preview
├── components/
│   ├── ui/                     shadcn (theme via tokens; only deliberate edits, e.g. Button xl size)
│   ├── layout/                 app-shell, bottom-nav, sidebar-nav, page-header
│   └── fitness/                stat-number, metric-card, set-row, empty-state (+ future workout components)
└── lib/
    ├── env.ts / env.server.ts  Zod-validated env (client eager, server lazy)
    ├── nav.ts                  single nav config
    ├── db/                     Neon client + requireUserId (the authorization boundary)
    ├── ai/                     AIProvider + TogetherAIProvider
    ├── profile/                constants, Zod schemas (+ tests), queries, server actions
    └── exercises/              types (Zod), ExerciseProvider, FreeExerciseDbProvider
db/migrations/                  0001_profiles.sql, 0002_exercise_catalogue.sql
scripts/migrate.mjs             applies pending migrations (npm run db:migrate)
scripts/seed-exercises.mjs      seeds the catalogue (npm run seed:exercises)
```

## Environment & external setup

Variables (see `.env.example`): Clerk publishable/secret + route URLs, `DATABASE_URL` (Neon pooled connection string), `TOGETHER_API_KEY`, `TOGETHER_MODEL`, `TOGETHER_VISION_MODEL`.

One-time setup (manual):
1. Create a Clerk application → copy both keys into `.env.local`.
2. Create a Neon project (console.neon.tech — free, no credit card) → copy the **pooled** connection string into `DATABASE_URL`.
3. `npm run db:migrate`, then `npm run seed:exercises`.
4. On Vercel: set the same env vars for all environments.

**Why Neon rather than Supabase:** chosen by the project owner, who cannot use Supabase. Trade-offs accepted: (a) authorization moves from database RLS into the repository layer, and (b) no bundled object storage, so progress photos need a separate host in Phase 11. Neon's free plan is 0.5 GB per project across 100 projects, no credit card, and it auto-resumes from idle rather than needing a manual unpause.

## Applying migrations

Migrations are plain SQL in `db/migrations/`, applied in filename order by
`npm run db:migrate`. Applied migrations are recorded in a `_migrations` table
with a checksum, so each runs once and a file edited after being applied is
reported rather than silently skipped. `npm run db:migrate -- --list` shows
status without applying anything. Then load the 317 exercises and their media:

```
npm run seed:exercises
```

Both scripts use `pg` over TCP, because migration files contain multiple
statements and function bodies that the HTTP driver will not accept. The seed
is idempotent (upsert on primary key), so re-running refreshes rows.

## Testing

Vitest (`npm test`), Node environment, no DOM. Two kinds of test:

- **Pure logic** — the profile schemas today, the progressive-overload rules
  from Phase 7.
- **Migrations** — `src/lib/db/migrations.test.ts` executes every file in
  `db/migrations/` against PGlite (real Postgres compiled to WASM, in-process)
  and asserts the constraints, trigger and cascade behaviour. Schema mistakes
  fail here instead of on a live database.

Route and component tests are not worth their weight yet.
