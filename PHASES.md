# Phases

Each phase ends with: lint + typecheck + build green, a UI audit for UI phases, a summary — then **stop** for review. **All MVP phases (1–15) are code-complete as of 2026-09-05**, plus full app i18n (en/ar/fr with RTL). Remaining: human end-to-end testing, Phase 16 design notes, Vercel deploy.

## Phase 0 — Architecture & design ✅
`ARCHITECTURE.md`, `DESIGN_SYSTEM.md`, `PHASES.md`. Repo/dataset/Together AI/Clerk verified.

## Phase 1 — Foundation & design system ✅
Tailwind v4 tokens, shadcn/ui (radix-nova) + Button xl, app shell (bottom nav / sidebar), Clerk auth (proxy + resource-level checks, sign-in/up), env validation, database client scaffold, `ExerciseProvider` + vendored dataset, `AIProvider` scaffold, page skeletons (`/`, onboarding, dashboard, workout, exercises, progress, coach, settings), loading/error/empty states, `/design` preview.
**DoD:** all routes render in shell; signed-out `/dashboard` → `/sign-in`; lint/typecheck/build green; design audit issues fixed.

## Phase 2 — Profile & onboarding ✅
6-step onboarding (basics → goal → experience → schedule → equipment → preferences/coach language), per-step Zod validation, server actions with their own `await auth()` checks. Migrations `0001_profiles` + `0002_exercise_catalogue`; `npm run db:migrate` + `npm run seed:exercises`. Onboarding gate in `(app)/layout`; settings editable; dashboard reads the real profile. Vitest added — 29 tests (profile schemas + migrations executed against real Postgres via PGlite).
**DoD:** code complete and green (lint/typecheck/build/test); migrations proven to apply. ⚠️ Still to verify against a live Neon database: run migrate + seed, and complete onboarding end-to-end.

## Phase 3 — Exercise library ✅
`/exercises` URL-driven search + filters (body part, equipment, difficulty), paged 24 at a time; `/exercises/[id]` detail: steps, form cues, common mistakes, breathing, muscles worked, similar-exercise substitutions.
**Media:** the vendored dataset's own host (third-party R2 bucket) died — 401 on every object as of 2026-09-05. Replaced with animated GIFs from `omercotkd/exercises-gifs` (MIT mirror of the Kaggle animations set) over the jsDelivr CDN. Our ExerciseDB-style ids match the filenames, giving **246/317 (78%)** coverage; `npm run build:gif-map` regenerates `src/data/exercise-gifs.json`. Provenance caveat in `src/lib/exercises/media.ts` — review rights before commercial use.
**DoD:** 317 exercises browsable and filterable on mobile ✅; 78% have demo animations ✅.

## Phase 4 — Program generation ✅
Deterministic candidate filtering (`candidates.ts`: equipment ∩ level, dislikes excluded, cardio out, machines/cables ranked first for beginners, balanced across body parts, capped at 90) → Together AI structured JSON → Zod (`schema.ts`) → business rules (`validate.ts`) → `programs`/`program_days`/`program_exercises`, every attempt logged to `ai_generations`. Migration `0003_programs`. Dashboard generate/regenerate; `/workout` shows today's session with per-exercise sets, reps, rest and a link to the demo.
**Exercise-id enforcement:** an id outside the offered candidate set throws and the whole generation is rejected — never silently dropped. Softer issues are repaired and reported (duplicate exercise, non-training day, reversed rep range, session over the time budget).
**DoD:** 12 validation tests incl. hallucinated-id rejection ✅; live end-to-end run produced a valid 3-day program with 0 repairs ✅; persisted and rendered ✅.

## Phase 5 — Live workout mode ✅
`/workout/[sessionId]`: one exercise at a time with demo, target sets/reps, **previous performance**, big +/- steppers for weight (2.5kg) and reps, logged-set list, and a rest timer that starts automatically on Complete Set. Actions: too easy · too hard · pain · skip · undo last set · view form · finish. Migration `0004_workouts`.
**Safety:** flagging pain disables further logging on that exercise and shows a stop-and-see-a-professional notice, per the spec's safety rules.
**Built for the gym:** resumes at the first unfinished exercise, one open session per user enforced by a partial unique index (not just the UI), rest timer runs off a wall-clock deadline so backgrounding the phone cannot stall it, ≥44px controls throughout.
**DoD:** 45 tests incl. 4 workout-schema tests ✅; live end-to-end run against Neon — start → copy prescription → log 3 sets → finish → previous performance resolves → feedback/skip ✅. Not yet exercised by a human in a gym.

**Deferred from this phase:** *Replace exercise* mid-workout (needs the substitution picker; the exercise detail page already computes similar exercises). Suggested starting weight is "what you did last time" — the deterministic progression that adjusts it is Phase 7.

## Phase 6 — Workout history ✅
`/history` list (date, exercises, sets, volume, duration) and `/history/[sessionId]` detail showing every set plus skipped/feedback badges. **Your history** section on each exercise page — past sessions with sets and best weight, answering "what did I use last time?" outside the gym too. Dashboard metrics are now real (workouts this week, weekly volume, week streak) with the three most recent sessions.
All aggregation is SQL (`history.ts`), never AI: warm-up sets are excluded from volume, skipped exercises from counts. Week-streak logic is a pure function (`streak.ts`, 8 tests) — notably, not having trained *yet this week* does not break a streak, since the week is still running.
History sits in the desktop sidebar and on `/progress`; the mobile bottom nav stays at five items so every target keeps its 44px.
**DoD:** 53 tests ✅; live run against Neon verified aggregation (warm-ups excluded, 52-min duration), weekly counts, distinct training weeks and per-exercise history across sessions ✅.

## Phase 7 — Progressive overload (deterministic) ✅
`progression.ts`: pure rules (12 tests, incl. the spec's own examples) — top-of-range → +1 increment (equipment-aware: dumbbell 2kg, machines 2.5), below floor → hold, too-hard → drop, pain → −10%, bodyweight → progress reps. Fixed a cross-session mixing bug in the previous-performance query (CTE resolves THE last session first). Recommendation seeds the weight stepper and shows a translated hint line; the coach chat explains the same rule, never overrides it.

## Phase 8 — Body weight tracking ✅
Migration `0005`; one row per day (same-day upsert, verified live). Quick-add dialog with 0.1kg stepper; profile weight kept in sync; trend = 7-day average vs prior 7 (never single-day deltas).

## Phase 9 — Progress dashboard ✅
`/progress`: stat row, hand-rolled SVG charts per the dataviz procedure (weight line with crosshair+tooltip+direct last-value label; weekly volume bars, rounded data-ends, zero weeks keep their slot; both with sr-only tables, LTR geometry in RTL locales), PR board (top working-set weight per exercise). Palette validated with the dataviz script — chart-5 chroma fixed; NOTE: the 5-slot categorical set is NOT validated for >2 simultaneous series (re-run validator before any multi-series chart).

## Phase 10 — Weekly check-in ✅
Migration `0006`; `/checkin` (30-second flow: workouts-done shown as a computed fact, weight, energy/sleep/soreness/difficulty chips, liked/disliked). Compact English `summary` built at save; program generation reads the latest check-in (fresh dislikes also join the hard candidate filter). Dashboard nudge appears when due (trained recently + none this week).

## Phase 11 — Progress photos ✅
Neon Object Storage (S3-compatible, bucket `coach` — created + verified: presigned works, **unsigned access 403**). Migration `0007` stores object keys only, namespaced `progress/{userId}/…`; every action asserts that prefix. Browser uploads via presigned PUT (no big bodies through server actions), confirmed with HeadObject + 15MB cap; views are per-request presigned GETs; delete removes row + object.
**DoD:** cross-user access impossible by key-prefix assertion + private bucket ✅; no public URLs stored ✅.

## Phase 12 — Before/after comparison ✅
Compare tab on `/photos`: two date pickers (default oldest vs newest), front/side/back pairs side-by-side with weights.

## Phase 13 — AI photo review ✅
`reviewPhotos` runs ONLY on the user's explicit compare selection: presigned URLs go to `TOGETHER_VISION_MODEL` with a system prompt that forces conservative observations, requires naming a limitation (lighting/pose/distance/…), and bans body-fat %/mass/medical claims. Replies in coach_language; logged to `ai_generations` (kind photo_review). ⚠️ Not yet exercised with a real photo — verify once the user uploads one.

## Phase 14 — Coach chat ✅
Migration `0008`. `/coach`: today-strip, quick actions, optimistic bubbles, non-streaming server action. Context (`context.ts`) is a compact English bundle: profile facts, TODAY's session with deterministic weight recommendations, weight trend, latest check-in, PRs, memories — plus question-scoped retrieval (an exercise named in the question pulls its recent sets). System prompt: reply in coach_language, concise by default, numbers only from context, never invent exercises, safety stop on pain/red-flags. Every call logged to `ai_generations` (kind chat).

## Phase 15 — Coach memory ✅ (management UI deferred)
`coach_memory`: ≤2 durable facts extracted per user message (strict JSON schema, upsert by key; most memory stays structural in the workout/weight tables). `coach_summaries`: past 40 messages, the older ones are compressed into a rolling summary and only the last 20 + summary enter prompts. Deferred: a settings screen to view/delete memories.

## Phase 16 — Form video analysis (design only — not built)
Future: short clip → pose estimation (MediaPipe/MoveNet) → landmarks → rep detection → movement rules → AI explanation. No LLM-watches-video biomechanics claims without pose data.

## Deferred (not MVP)
Subscriptions/payments, social/community, meal scanning, wearables, Apple Health / Google Fit, automatic rep counting, RTL app chrome (coach *replies* in Arabic are in-scope; full RTL UI is a later pass).
