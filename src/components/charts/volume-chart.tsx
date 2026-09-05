"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { compactKg, formatDate } from "@/lib/format";
import type { WeeklyVolumePoint } from "@/lib/workouts/history";

const W = 640;
const H = 200;
const PAD = { top: 20, right: 8, bottom: 24, left: 8 };

/**
 * Weekly training volume as baseline-anchored bars: lime fill, 4px rounded
 * data-end (top only — the baseline stays flat), 2px gaps between bars, the
 * peak week direct-labeled, per-bar tooltip with a 2px surface hover ring.
 * Zero weeks keep their slot so a skipped week is visibly a gap in the story.
 */
export function VolumeChart({ points }: { points: WeeklyVolumePoint[] }) {
  const { dict, locale } = useI18n();
  const [hover, setHover] = useState<number | null>(null);

  if (points.length === 0) return null;

  const max = Math.max(...points.map((p) => p.volumeKg), 1);
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const band = innerW / points.length;
  const barW = Math.min(band * 0.7, 56);
  const peak = points.reduce(
    (best, p, i) => (p.volumeKg > points[best].volumeKg ? i : best),
    0,
  );

  const bar = (i: number, v: number) => {
    const h = (v / max) * innerH;
    const x = PAD.left + i * band + (band - barW) / 2;
    const y = H - PAD.bottom - h;
    const r = Math.min(4, h / 2, barW / 2);
    if (h <= 0) return null;
    // Rounded top corners only; flat baseline.
    return `M${x},${y + r}
            a${r},${r} 0 0 1 ${r},-${r}
            h${barW - 2 * r}
            a${r},${r} 0 0 1 ${r},${r}
            v${h - r}
            h${-barW}
            z`;
  };

  const hovered = hover !== null ? points[hover] : null;

  return (
    <div dir="ltr" className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-none select-none"
        role="img"
        aria-label={dict.progress.volumeChartTitle}
        onPointerLeave={() => setHover(null)}
      >
        {/* baseline */}
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={H - PAD.bottom}
          y2={H - PAD.bottom}
          className="stroke-border"
          strokeWidth={1}
        />

        {points.map((p, i) => {
          const d = bar(i, p.volumeKg);
          const x = PAD.left + i * band;
          return (
            <g key={p.weekStart}>
              {/* full-band hit target, larger than the mark */}
              <rect
                x={x}
                y={PAD.top}
                width={band}
                height={innerH}
                fill="transparent"
                onPointerEnter={() => setHover(i)}
              />
              {d ? (
                <path
                  d={d}
                  className="fill-chart-1"
                  stroke={hover === i ? "var(--card)" : "none"}
                  strokeWidth={hover === i ? 2 : 0}
                  opacity={hover === null || hover === i ? 1 : 0.55}
                />
              ) : null}
              {/* direct label on the peak week only */}
              {i === peak && p.volumeKg > 0 ? (
                <text
                  x={x + band / 2}
                  y={H - PAD.bottom - (p.volumeKg / max) * innerH - 6}
                  textAnchor="middle"
                  className="fill-foreground text-[12px] font-semibold tabular-nums"
                >
                  {compactKg(p.volumeKg)}
                </text>
              ) : null}
            </g>
          );
        })}

        <text x={PAD.left} y={H - 6} className="fill-muted-foreground text-[11px]">
          {formatDate(points[0].weekStart, locale)}
        </text>
        <text
          x={W - PAD.right}
          y={H - 6}
          textAnchor="end"
          className="fill-muted-foreground text-[11px]"
        >
          {formatDate(points[points.length - 1].weekStart, locale)}
        </text>
      </svg>

      {hovered && hover !== null ? (
        <div
          className="pointer-events-none absolute -top-1 rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs"
          style={{
            left: `${((PAD.left + hover * band + band / 2) / W) * 100}%`,
            transform: "translateX(-50%)",
          }}
        >
          <span className="font-semibold text-foreground tabular-nums">
            {compactKg(hovered.volumeKg)} {dict.common.kg}
          </span>{" "}
          <span className="text-muted-foreground">
            · {hovered.workouts}× · {formatDate(hovered.weekStart, locale)}
          </span>
        </div>
      ) : null}

      <table className="sr-only">
        <caption>{dict.progress.volumeChartTitle}</caption>
        <tbody>
          {points.map((p) => (
            <tr key={p.weekStart}>
              <td>{p.weekStart}</td>
              <td>
                {p.volumeKg} {dict.common.kg}
              </td>
              <td>{p.workouts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
