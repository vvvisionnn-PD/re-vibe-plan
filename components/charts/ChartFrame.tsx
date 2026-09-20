"use client";

import { useState, type ReactNode } from "react";

/**
 * 차트 공통 틀 — 제목 · 단위 · 건수 · 조회일 · 출처를 차트 아래에 붙이고,
 * [표로 보기] 토글로 같은 숫자를 표로 보여준다.
 * 숫자는 모두 lib/calc · lib/market에서 계산된 것을 받는다 (차트에서 계산 금지).
 */

/** 차트 색 — 프로젝트 토큰만 쓴다 */
export const CHART_COLORS = {
  /** 계획가 · 우리 숫자 강조 */
  plan: "var(--accent)",
  /** 시장 자료 */
  market: "var(--muted)",
  /** 상환 가능 */
  good: "var(--good)",
  /** 상환 불가 · 음수 */
  bad: "var(--bad)",
  /** 축 · 눈금선 */
  axis: "var(--border)",
  /** 글자 */
  text: "var(--foreground)",
} as const;

/** 차트 아래에 붙는 설명 */
export interface ChartMeta {
  title: string;
  /** 단위 (예: 만원/평) */
  unit: string;
  /** 자료 건수 */
  count: number | null;
  /** 공공데이터 조회일 (입력값 기반 차트는 생략) */
  asOf?: string | null;
  /** 출처 */
  source: string;
  /** 덧붙일 설명 */
  note?: string;
}

const numberText = (n: number) => n.toLocaleString("ko-KR", { maximumFractionDigits: 0 });

export default function ChartFrame({
  meta,
  empty,
  table,
  children,
}: {
  meta: ChartMeta;
  /** 자료가 없으면 빈 축 대신 "자료 없음"을 보여준다 */
  empty?: boolean;
  /** [표로 보기]에서 펼칠 표 */
  table?: ReactNode;
  children: ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <figure className="m-0 flex break-inside-avoid flex-col gap-2 rounded-lg border border-line p-3">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-semibold">{meta.title}</h4>
        {table && (
          <button
            type="button"
            className="rounded-md border border-line px-2 py-0.5 text-xs whitespace-nowrap hover:bg-accent-soft print:hidden"
            aria-expanded={showTable}
            onClick={() => setShowTable((v) => !v)}
          >
            {showTable ? "차트만 보기" : "표로 보기"}
          </button>
        )}
      </div>

      {empty ? (
        <p className="rounded-md border border-dashed border-line p-4 text-center text-sm text-muted">자료 없음</p>
      ) : (
        <div className="w-full overflow-x-auto">{children}</div>
      )}

      {showTable && table && <div className="overflow-x-auto text-xs">{table}</div>}

      <figcaption className="text-xs text-muted">
        {meta.title} · 단위 {meta.unit} · 건수 {meta.count === null ? "–" : numberText(meta.count)}
        {meta.asOf !== undefined && ` · 조회일 ${meta.asOf || "–"}`} · 출처 {meta.source}
        {meta.note && <span className="block">{meta.note}</span>}
      </figcaption>
    </figure>
  );
}
