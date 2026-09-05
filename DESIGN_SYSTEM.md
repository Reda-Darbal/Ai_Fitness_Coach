# Design System

Premium, athletic, calm, high-contrast, mobile-first. Reference quality: WHOOP × Linear — used as a bar, not copied. Source of truth: `src/app/globals.css` (Tailwind v4 `@theme` tokens); live reference: `/design`.

## Principles

1. **Built for a tired lifter holding a phone in one hand.** Every interactive control ≥ 44px (`Button size="xl"`, 48px set rows, 64px bottom nav). Log a set in seconds; no deep navigation, no dense tables, no unnecessary modals.
2. **Numbers are the interface.** Weight, reps, timer, body weight use the display scale with `tabular-nums`, readable from arm's length (`StatNumber`).
3. **One accent, spent carefully.** Electric lime marks the primary action, the active nav item, and key metrics — ≤ 3% of any viewport. Hover fills are graphite (`--accent`), never lime.
4. **Elevation by surface, not shadow.** Dark UIs read shadows poorly: higher surfaces are lighter (`background → card → popover`) with hairline borders.
5. **Empty states are coaching moments.** Say what will appear and what fills it. Never fabricate data — missing values render as "—".
6. **Banned:** purple, decorative gradients, glassmorphism/backdrop-blur cards, giant rounded containers everywhere, accent as large fill, italic headings, invented metrics.

## Color tokens (OKLCH, dark-only)

Anchor hue ≈ 255 (cool graphite); accent hue 127 (lime). Defined on `:root`; `<html class="dark">` activates shadcn dark variants. A future light theme = one new block.

| Token | Value | Role |
|---|---|---|
| `--background` | `oklch(0.16 0.01 255)` | app ground (graphite ≈ #0f1216) |
| `--card` / `--sidebar` | `oklch(0.19 0.011 255)` | cards, nav surfaces |
| `--popover` | `oklch(0.22 0.012 255)` | sheets, dialogs, menus (elevated) |
| `--muted` | `oklch(0.21 0.011 255)` | muted fills |
| `--secondary` / `--accent` | `oklch(0.24 0.012 255)` | secondary buttons, hover/active fills |
| `--border` | `oklch(0.27 0.012 255)` | hairlines |
| `--input` | `oklch(0.31 0.012 255)` | input borders/fills |
| `--foreground` | `oklch(0.95 0.007 255)` | primary text (near-white, never #fff) |
| `--muted-foreground` | `oklch(0.7 0.015 255)` | secondary text |
| `--primary` / `--ring` | `oklch(0.91 0.22 127)` | electric lime (≈ #b7ff3c): primary CTA, active nav, focus, key metric |
| `--primary-foreground` | `oklch(0.2 0.04 130)` | text on lime |
| `--destructive` | `oklch(0.7 0.19 25)` | danger, pain flag |
| `--success` | `oklch(0.75 0.15 160)` | PRs, completed |
| `--warning` | `oklch(0.8 0.14 80)` | caution, deload |
| `--chart-1…5` | lime · sky · amber · green · slate | charts (no purple) |

Contrast: fg/bg ≈ 14:1, muted-fg/bg ≈ 5.5:1, lime/bg ≈ 10:1 — all above WCAG AA for their roles.

## Typography

- **Faces:** Geist (display + body) + Geist Mono (data labels/code only — ≤ 2 roles). No third family.
- **UI scale:** 12px caps-label (tracking 0.08–0.14em) · 14px secondary · 16px body · 24px page title (semibold, tight tracking).
- **Display scale** (gym numerals, `tabular-nums`, weight 600):
  - `text-display-sm` 36px — screen stats
  - `text-display` 48px — hero stats
  - `text-display-lg` 64px — live workout numbers
  - `text-display-xl` clamp(72–104px) — rest timer
- Body line-height 1.5+; display 1.0–1.1 with −0.02…−0.03em tracking. Headings always roman.

## Spacing, radius, motion

- 4px grid (Tailwind default). Screen padding 16px mobile / 32px desktop; content max-width 64rem in-app.
- Radius base `--radius: 0.75rem` (cards `xl`, controls `lg`, chips full). 
- Shadows ≈ none; surface steps + borders instead.
- Motion: 150ms ease-out micro-interactions, 200–250ms sheets/dialogs; animate transform/opacity only; global `prefers-reduced-motion` kill switch in `globals.css`.

## Component rules

- shadcn/ui (`radix-nova`) is the primitive layer; theme flows entirely through tokens. Deliberate extensions only — e.g. Button `xl`/`icon-xl` (44px) for gym surfaces; default small sizes are desktop-only.
- Inputs on gym/mobile flows: `h-11`, numeric fields use `inputMode="decimal"` + `tabular-nums` + large text.
- Domain components wrap primitives (never raw Cards everywhere): `StatNumber`, `MetricCard`, `SetRow`, `EmptyState` now; `WorkoutCard`, `ExerciseCard`, `ExerciseVideo`, `RestTimer`, `WeightInput`, `RepInput`, `CoachMessage`, `PhotoComparison`, etc. as their phases land.
- Every interactive component ships all states: default, hover, focus-visible (instant lime ring), active, disabled, loading, error, success.

## Responsive strategy

- **Mobile (< lg):** fixed bottom nav (5 items, 64px + `env(safe-area-inset-bottom)`, `viewport-fit=cover`), single-column content, thumb-reach primary actions near the bottom.
- **Desktop (≥ lg):** fixed 240px sidebar (nav + settings + account), content column max-w-5xl. Same pages, denser layout allowed.
- Focused flows (onboarding, live workout) drop the shell chrome entirely.
- Verified at 320 / 375 / 414 / 768: no horizontal scroll, no two-line buttons, grids use `minmax(0,1fr)` semantics via Tailwind grid utilities.
