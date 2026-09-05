# AI Gym Coach

A personal AI gym coach: onboarding → AI-generated weekly programs → live
workout logging → progressive overload → weight & progress tracking → weekly
check-ins → coach chat with photo and meal analysis. Trilingual (English,
Arabic with full RTL, French).

## Stack

- **Next.js 16** (App Router, Turbopack) + TypeScript strict + Tailwind v4 + shadcn/Radix
- **Clerk** — authentication
- **Neon Postgres** — data (`@neondatabase/serverless`); authorization lives in
  the repository layer (`src/lib/db/session.ts`), every query filters by user id
- **Neon Object Storage** — private progress/meal photos via presigned URLs
- **Together AI** — program generation, coach chat, vision (models set by env)
- **Zod** — every AI response and user input is parsed, never trusted

## Setup

1. Copy `.env.example` to `.env.local` and fill in Clerk, Neon, Together AI
   and storage credentials.
2. `npm install`
3. `node --env-file=.env.local scripts/migrate.mjs` — apply SQL migrations
4. `npm run seed:exercises` — seed the 1,332-exercise catalogue
5. `npm run dev`

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | dev server |
| `npm run build` / `npm start` | production build / serve |
| `npm run lint` / `npm run typecheck` | ESLint / `tsc --noEmit` |
| `npm test` | Vitest (migrations run against in-memory Postgres) |
| `npm run build:gif-map` | regenerate the exercise→GIF id map |

## Architecture notes

See `ARCHITECTURE.md`, `DESIGN_SYSTEM.md` and `PHASES.md`. Two rules the code
enforces everywhere: the AI can never invent an exercise (ids are validated
against the catalogue), and all math (progression, stats, nutrition targets)
is deterministic code — AI only explains and selects.
