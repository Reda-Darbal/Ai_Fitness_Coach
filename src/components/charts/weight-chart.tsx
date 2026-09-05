"use client";

import { useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { formatDate } from "@/lib/format";
import type { WeightPoint } from "@/lib/weight/queries";

const W = 640;
const H = 220;
const PAD = { top: 16, right: 52, bottom: 24, left: 8 };

/**
 * Single-series body-weight line. Dataviz rules applied: 2px line, recessive
 * grid, muted text tokens for every label, direct label on the latest value
 * only, crosshair + tooltip on hover, and an sr-only table so the data is
 * readable without the picture. Geometry stays LTR even in RTL locales —
 * time on a chart flows left to right.
 */
export function WeightChart({ points }: { points: WeightPoint[] }) {
  const { dict, locale } = useI18n();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const geometry = useMemo(() => {
    if (points.length === 0) return null;
    const values = points.map((p) => p.weightKg);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = Math.max(max - min, 1);
    const lo = min - span * 0.15;
    const hi = max + span * 0.15;

    const x = (i: number) =>
      points.length === 1
        ? (PAD.left + (W - PAD.right)) / 2
        : PAD.left + (i / (points.length - 1)) * (W - PAD.left - PAD.right);
    const y = (v: number) =>
      PAD.top + (1 - (v - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom);

    const path = points
      .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.weightKg).toFixed(1)}`)
      .join(" ");

    const ticks = [lo + (hi - lo) * 0.15, (lo + hi) / 2, hi - (hi - lo) * 0.15].map(
      (v) => ({ v: Math.round(v * 10) / 10, y: y(v) }),
    );

    return { x, y, path, ticks };
  }, [points]);

  if (!geometry || points.length === 0) return null;

  const last = points[points.length - 1];
  const hovered = hover !== null ? points[hover] : null;

  function onMove(event: React.PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < points.length; i += 1) {
      const d = Math.abs(geometry!.x(i) - px);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    setHover(best);
  }

  return (
    <div ref={wrapRef} dir="ltr" className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-none select-none"
        role="img"
        aria-label={dict.progress.weightChartTitle}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {/* recessive grid */}
        {geometry.ticks.map((t) => (
          <g key={t.v}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={t.y}
              y2={t.y}
              className="stroke-border"
              strokeWidth={1}
            />
            <text
              x={W - PAD.right + 6}
              y={t.y + 3.5}
              className="fill-muted-foreground text-[11px] tabular-nums"
            >
              {t.v}
            </text>
          </g>
        ))}

        {/* the series */}
        <path
          d={geometry.path}
          fill="none"
          className="stroke-chart-2"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* crosshair + hover marker */}
        {hovered && hover !== null ? (
          <g>
            <line
              x1={geometry.x(hover)}
              x2={geometry.x(hover)}
              y1={PAD.top}
              y2={H - PAD.bottom}
              className="stroke-muted-foreground/40"
              strokeWidth={1}
            />
            <circle
              cx={geometry.x(hover)}
              cy={geometry.y(hovered.weightKg)}
              r={5}
              className="fill-chart-2 stroke-card"
              strokeWidth={2}
            />
          </g>
        ) : (
          <circle
            cx={geometry.x(points.length - 1)}
            cy={geometry.y(last.weightKg)}
            r={4}
            className="fill-chart-2 stroke-card"
            strokeWidth={2}
          />
        )}

        {/* direct label: latest value only */}
        <text
          x={geometry.x(points.length - 1)}
          y={geometry.y(last.weightKg) - 10}
          textAnchor="end"
          className="fill-foreground text-[12px] font-semibold tabular-nums"
        >
          {last.weightKg}
        </text>

        {/* x extent labels */}
        <text
          x={PAD.left}
          y={H - 6}
          className="fill-muted-foreground text-[11px]"
        >
          {formatDate(points[0].date, locale)}
        </text>
        <text
          x={W - PAD.right}
          y={H - 6}
          textAnchor="end"
          className="fill-muted-foreground text-[11px]"
        >
          {formatDate(last.date, locale)}
        </text>
      </svg>

      {hovered ? (
        <div
          className="pointer-events-none absolute -top-1 rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs shadow-none"
          style={{
            left: `${(geometry.x(hover!) / W) * 100}%`,
            transform: "translateX(-50%)",
          }}
        >
          <span className="font-semibold text-foreground tabular-nums">
            {hovered.weightKg} {dict.common.kg}
          </span>{" "}
          <span className="text-muted-foreground">
            {formatDate(hovered.date, locale)}
          </span>
        </div>
      ) : null}

      {/* the same data, readable without the picture */}
      <table className="sr-only">
        <caption>{dict.progress.weightChartTitle}</caption>
        <tbody>
          {points.map((p) => (
            <tr key={p.date}>
              <td>{p.date}</td>
              <td>
                {p.weightKg} {dict.common.kg}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
