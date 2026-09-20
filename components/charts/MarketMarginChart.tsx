"use client";

import { linearScale, niceDomain, ticks } from "@/lib/chart";
import type { Num } from "@/lib/calc";
import type { NewSupplyRow } from "@/lib/market";
import ChartFrame, { CHART_COLORS, type ChartMeta } from "./ChartFrame";

/**
 * 시장 대비 여유 — 인근 신규 84㎡ 공급평당가 점 분포에
 * 계획가 선(강조색)과 상환 한계 평당가 선(빨강)을 겹쳐 본다.
 * 숫자는 lib/market의 newSupply84 · marketMargin 결과를 그대로 받는다.
 */

const W = 720;
const H = 230;
const PAD = { top: 46, right: 16, bottom: 38, left: 16 };
const DOT_R = 4.5;
/** 점이 겹치지 않도록 같은 칸에 들어온 점을 위로 쌓는 간격 */
const BIN_W = 11;
const STACK_H = 10;

const text = (n: number) => n.toLocaleString("ko-KR", { maximumFractionDigits: 0 });

export default function MarketMarginChart({
  rows,
  median,
  planPrice,
  repayPrice,
  meta,
  table,
}: {
  rows: NewSupplyRow[];
  /** 인근 공급평당가 중앙값 */
  median: number | null;
  /** 계획 평당가 */
  planPrice: Num;
  /** 상환 한계 평당가 */
  repayPrice: number | null;
  meta: ChartMeta;
  table?: React.ReactNode;
}) {
  const prices = rows.map((r) => r.pricePerPyeong);
  const marks = [...prices, planPrice, repayPrice, median].filter((v): v is number => v !== null);
  const empty = rows.length === 0 || marks.length === 0;

  let body = null;
  if (!empty) {
    const [d0, d1] = niceDomain(Math.min(...marks), Math.max(...marks), 6);
    const x = linearScale([d0, d1], [PAD.left, W - PAD.right]);
    const baseY = H - PAD.bottom;

    // 같은 칸에 들어온 점은 위로 쌓는다 (값이 아니라 그리는 위치만 정한다)
    const stacked = new Map<number, number>();
    const dots = rows.map((r) => {
      const px = x(r.pricePerPyeong);
      const bin = Math.round(px / BIN_W);
      const level = stacked.get(bin) ?? 0;
      stacked.set(bin, level + 1);
      return { row: r, cx: px, cy: baseY - 8 - level * STACK_H };
    });

    const guide = (value: number, color: string, label: string, dash: string | undefined, labelY: number) => (
      <g key={label}>
        <line x1={x(value)} y1={PAD.top - 12} x2={x(value)} y2={baseY} stroke={color} strokeWidth={2} strokeDasharray={dash} />
        <text x={x(value)} y={labelY} textAnchor="middle" fontSize={14} fontWeight={600} fill={color}>
          {label} {text(value)}
        </text>
      </g>
    );

    body = (
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full min-w-[520px]"
        role="img"
        aria-label={`인근 신규 84㎡ 공급평당가 ${rows.length}건 분포와 계획가 · 상환 한계 평당가`}
      >
        {/* 축 */}
        <line x1={PAD.left} y1={baseY} x2={W - PAD.right} y2={baseY} stroke={CHART_COLORS.axis} strokeWidth={1} />
        {ticks(d0, d1, 6).map((t) => (
          <g key={t}>
            <line x1={x(t)} y1={baseY} x2={x(t)} y2={baseY + 5} stroke={CHART_COLORS.axis} />
            <text x={x(t)} y={baseY + 19} textAnchor="middle" fontSize={13} fill={CHART_COLORS.market}>
              {text(t)}
            </text>
          </g>
        ))}

        {/* 상환 한계 ~ 계획가 사이를 여유 구간으로 표시 */}
        {repayPrice !== null && median !== null && (
          <rect
            x={Math.min(x(repayPrice), x(median))}
            y={PAD.top - 12}
            width={Math.abs(x(median) - x(repayPrice))}
            height={baseY - PAD.top + 12}
            fill={CHART_COLORS.good}
            opacity={0.08}
          />
        )}

        {/* 인근 신규 분양 주택형 (시장 회색) */}
        {dots.map((d, i) => (
          <circle key={`${d.row.name}-${d.row.houseTy}-${i}`} cx={d.cx} cy={d.cy} r={DOT_R} fill={CHART_COLORS.market} opacity={0.75}>
            <title>{`${d.row.name} ${d.row.houseTy} · ${text(d.row.pricePerPyeong)}만원/평`}</title>
          </circle>
        ))}

        {median !== null && guide(median, CHART_COLORS.market, "인근 중앙값", "5 4", PAD.top - 20)}
        {repayPrice !== null && guide(repayPrice, CHART_COLORS.bad, "상환 한계", "5 4", PAD.top - 2)}
        {planPrice !== null && guide(planPrice, CHART_COLORS.plan, "계획가", undefined, 16)}
      </svg>
    );
  }

  return (
    <ChartFrame meta={meta} empty={empty} table={table}>
      {body}
    </ChartFrame>
  );
}
