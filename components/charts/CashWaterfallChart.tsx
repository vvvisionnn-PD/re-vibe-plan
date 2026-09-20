"use client";

import type { WaterfallStep } from "@/lib/calc";
import { linearScale, niceDomain, ticks } from "@/lib/chart";
import ChartFrame, { CHART_COLORS, type ChartMeta } from "./ChartFrame";

/**
 * 사업수지 폭포 — 분양수입 → 분양수입 차감 → 세대당 비용 → 고정비 → 기타유입 → 기말현금.
 * 각 막대의 from · to(누적)는 lib/calc의 cashWaterfall이 계산한 값을 그대로 쓴다.
 */

const W = 720;
const H = 300;
const PAD = { top: 26, right: 16, bottom: 52, left: 62 };
const GAP = 18;

const text = (n: number) => n.toLocaleString("ko-KR", { maximumFractionDigits: 0 });

/** 막대 색: 유입 · 분양수입은 강조색, 차감은 회색, 기말현금은 양수 초록 · 음수 빨강 */
function barColor(step: WaterfallStep): string {
  if (step.kind === "total") return step.amount >= 0 ? CHART_COLORS.good : CHART_COLORS.bad;
  if (step.kind === "down") return CHART_COLORS.market;
  return CHART_COLORS.plan;
}

export default function CashWaterfallChart({
  steps,
  min,
  max,
  meta,
  table,
}: {
  steps: WaterfallStep[];
  min: number;
  max: number;
  meta: ChartMeta;
  table?: React.ReactNode;
}) {
  const empty = steps.length === 0;
  let body = null;

  if (!empty) {
    const [d0, d1] = niceDomain(min, max, 5);
    const y = linearScale([d0, d1], [H - PAD.bottom, PAD.top]);
    const plotW = W - PAD.left - PAD.right;
    const bandW = plotW / steps.length;
    const barW = Math.max(18, bandW - GAP);
    const centerX = (i: number) => PAD.left + bandW * i + bandW / 2;

    body = (
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[520px]" role="img" aria-label="분양수입에서 기말현금까지의 사업수지 폭포 차트">
        {/* 눈금선 */}
        {ticks(d0, d1, 5).map((t) => (
          <g key={t}>
            <line x1={PAD.left} y1={y(t)} x2={W - PAD.right} y2={y(t)} stroke={CHART_COLORS.axis} strokeWidth={t === 0 ? 1.5 : 1} />
            <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize={13} fill={CHART_COLORS.market}>
              {text(t)}
            </text>
          </g>
        ))}

        {steps.map((s, i) => {
          const top = Math.min(y(s.from), y(s.to));
          const height = Math.max(2, Math.abs(y(s.to) - y(s.from)));
          const x = centerX(i) - barW / 2;
          return (
            <g key={s.label}>
              {/* 앞 막대와 이어주는 선 */}
              {i > 0 && s.kind !== "total" && (
                <line
                  x1={centerX(i - 1) + barW / 2}
                  y1={y(s.from)}
                  x2={x}
                  y2={y(s.from)}
                  stroke={CHART_COLORS.axis}
                  strokeDasharray="4 3"
                />
              )}
              <rect x={x} y={top} width={barW} height={height} fill={barColor(s)} opacity={s.kind === "down" ? 0.55 : 0.9}>
                <title>{`${s.label} ${text(s.amount)}억원 — ${s.formula}`}</title>
              </rect>
              {/* 값은 항상 막대 위에 — 아래에 두면 x축 이름과 겹친다 */}
              <text
                x={centerX(i)}
                y={top - 6}
                textAnchor="middle"
                fontSize={14}
                fontWeight={s.kind === "total" ? 700 : 500}
                fill={s.amount < 0 ? CHART_COLORS.bad : CHART_COLORS.text}
              >
                {text(s.amount)}
              </text>
              <text x={centerX(i)} y={H - PAD.bottom + 18} textAnchor="middle" fontSize={13} fill={CHART_COLORS.text}>
                {s.label}
              </text>
            </g>
          );
        })}
      </svg>
    );
  }

  return (
    <ChartFrame meta={meta} empty={empty} table={table}>
      {body}
    </ChartFrame>
  );
}
