"use client";

/**
 * 차트 공통 도구 — SVG 로 직접 그린다. 차트 라이브러리를 설치하지 않는다.
 *
 * 규칙
 *  - 숫자는 lib/calc · lib/market 결과만 받는다. 여기서 다시 계산하지 않는다.
 *  - 차트 아래에 제목 · 단위 · 건수 · 조회일 · 출처를 반드시 단다.
 *  - 값이 없으면 빈 축을 그리지 말고 "자료 없음"을 낸다.
 *  - 모바일에서 세로 1열, 인쇄하면 A4 에 들어가야 한다.
 */

import { useId, useState } from "react";

import type { 표메타 } from "../../lib/market";

/* ─── 색 (고정) ────────────────────────────────────────────── */

/**
 * 차트 색은 이 표에서만 가져온다. 의미가 색에 묶여 있어야 여러 차트를 나란히 놓고
 * 읽을 수 있다. globals.css 의 토큰을 그대로 쓴다.
 */
export const 색 = {
  /** 계획값 — 강조 */
  계획: "var(--accent)",
  /** 시장값 — 회색 */
  시장: "var(--muted)",
  /** 상환 가능 */
  가능: "var(--positive)",
  /** 상환 불가 */
  불가: "var(--negative)",
  /** 경계·주의 */
  경계: "var(--warning)",
  축: "var(--border-strong)",
  눈금: "var(--border)",
  글자: "var(--foreground)",
  흐린글자: "var(--muted)",
} as const;

/* ─── 눈금 ─────────────────────────────────────────────────── */

/** 사람이 읽기 좋은 눈금 간격 (1·2·5 × 10^n) */
export function 눈금간격(범위: number, 목표개수 = 5): number {
  if (!Number.isFinite(범위) || 범위 <= 0) return 1;
  const 대략 = 범위 / Math.max(1, 목표개수);
  const 자리 = Math.pow(10, Math.floor(Math.log10(대략)));
  const 몫 = 대략 / 자리;
  const 배수 = 몫 <= 1 ? 1 : 몫 <= 2 ? 2 : 몫 <= 5 ? 5 : 10;
  return 배수 * 자리;
}

/** [최소, 최대] 를 덮는 눈금 값 목록 */
export function 눈금목록(최소: number, 최대: number, 목표개수 = 5): number[] {
  const 간격 = 눈금간격(최대 - 최소, 목표개수);
  const 시작 = Math.floor(최소 / 간격) * 간격;
  const 끝 = Math.ceil(최대 / 간격) * 간격;
  const 결과: number[] = [];
  for (let v = 시작; v <= 끝 + 간격 * 1e-9; v += 간격) {
    결과.push(Math.abs(v) < 간격 * 1e-9 ? 0 : v);
  }
  return 결과;
}

/** 숫자 → 천단위 콤마 */
export function 콤마(값: number | null, 자리 = 0): string {
  if (값 === null || !Number.isFinite(값)) return "-";
  return 값.toLocaleString("ko-KR", {
    minimumFractionDigits: 자리,
    maximumFractionDigits: 자리,
  });
}

/* ─── 껍데기 ───────────────────────────────────────────────── */

export interface 차트꼬리표 {
  제목: string;
  단위: string;
  건수: number | null;
  조회일: string;
  출처: string;
}

/** 표메타에서 꼬리표를 만든다 */
export function 꼬리표만들기(
  제목: string,
  단위: string,
  메타: 표메타 | null,
  건수?: number | null,
): 차트꼬리표 {
  return {
    제목,
    단위,
    건수: 건수 ?? 메타?.건수 ?? null,
    조회일: 메타?.조회일 ?? "",
    출처: 메타 ? `${메타.출처} (${메타.출처상세})` : "앱 자체 계산",
  };
}

/**
 * 차트 한 개의 껍데기 — 제목·[표로 보기] 토글·SVG·꼬리표를 담는다.
 * 표 내용은 `표` 로 넘긴다. 자료가 없으면 `자료없음사유` 를 주면 축 대신 문구가 나온다.
 */
export function ChartFrame({
  꼬리표,
  설명,
  자료없음사유,
  표,
  children,
}: {
  꼬리표: 차트꼬리표;
  설명?: string;
  자료없음사유?: string | null;
  표: React.ReactNode;
  children: React.ReactNode;
}) {
  const [표보기, 설정표보기] = useState(false);
  const id = useId();

  return (
    <figure className="m-0 rounded-lg border border-line bg-surface p-3 print-block">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-xs font-semibold text-foreground">{꼬리표.제목}</h4>
        <button
          type="button"
          aria-expanded={표보기}
          aria-controls={id}
          onClick={() => 설정표보기((v) => !v)}
          className="no-print rounded border border-line px-2 py-0.5 text-[11px] text-foreground transition hover:bg-surface-alt"
        >
          {표보기 ? "차트로 보기" : "표로 보기"}
        </button>
      </div>

      {설명 ? (
        <p className="mt-1 text-[11px] leading-relaxed text-muted">{설명}</p>
      ) : null}

      <div id={id} className="mt-2">
        {자료없음사유 ? (
          <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-4 text-center text-xs text-foreground">
            자료 없음 — {자료없음사유}
          </p>
        ) : 표보기 ? (
          <div className="overflow-x-auto">{표}</div>
        ) : (
          children
        )}
      </div>

      <figcaption className="mt-2 text-[11px] leading-relaxed text-muted">
        {꼬리표.제목} · 단위 {꼬리표.단위}
        {꼬리표.건수 !== null ? ` · 건수 ${콤마(꼬리표.건수)}` : ""}
        {꼬리표.조회일 ? ` · 조회일 ${꼬리표.조회일}` : ""} · 출처 {꼬리표.출처}
      </figcaption>
    </figure>
  );
}

/** 차트 범례 한 칸 */
export function Legend({
  항목,
}: {
  항목: { 색: string; 이름: string; 모양?: "선" | "점" | "면" }[];
}) {
  return (
    <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
      {항목.map((x) => (
        <span key={x.이름} className="inline-flex items-center gap-1">
          {x.모양 === "선" ? (
            <span
              className="inline-block h-0.5 w-4"
              style={{ background: x.색 }}
            />
          ) : x.모양 === "점" ? (
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: x.색 }}
            />
          ) : (
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ background: x.색, opacity: 0.85 }}
            />
          )}
          {x.이름}
        </span>
      ))}
    </p>
  );
}

/** 차트 안 표에 쓰는 공통 표 틀 */
export function ValueTable({
  머리,
  행들,
}: {
  머리: string[];
  행들: (string | number)[][];
}) {
  return (
    <table className="w-full min-w-[320px] border-collapse text-xs">
      <thead className="bg-surface-alt text-[11px] text-muted">
        <tr>
          {머리.map((h, i) => (
            <th
              key={h}
              className="border-b border-line px-2 py-1 font-medium"
              style={{ textAlign: i === 0 ? "left" : "right" }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {행들.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (
              <td
                key={j}
                className="tnum border-b border-line/60 px-2 py-1"
                style={{ textAlign: j === 0 ? "left" : "right" }}
              >
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
