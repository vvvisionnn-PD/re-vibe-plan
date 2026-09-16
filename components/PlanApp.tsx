"use client";

/**
 * 오피스 개발사업 사업계획서 — 입력 화면.
 *
 * 현재 단계에서는 [입력]과 [임시 값 채우기]까지만 구현한다.
 * 1~8장 본문(사업 개요 / 임대시장 분석 / 사업수지 / 자금조달과 상환 /
 * 캡레이트 민감도 / 임대율·임대료 민감도 / 리스크 / 확인하지 못한 것)은
 * 다음 단계에서 붙인다.
 *
 * 계산은 전부 lib/calc.ts 의 순수 함수에 있다. 이 파일에서 수식을 다시 쓰지 말 것.
 */

import { useMemo, useState } from "react";

import {
  사업성계산,
  임대공간집계하기,
  임대료민감도표,
  임대료열만들기,
  캡레이트민감도표,
  캡레이트변동_자산가치변화율,
  한계임대율,
  한계캡레이트,
  한계평당월임대료,
} from "../lib/calc";
import type {
  민감도표,
  사업계획입력,
  임대공간행,
  임대료단차방식,
} from "../lib/calc";
import {
  getMarketBenchmark,
  시장기준치표시가능,
  자료없음문구,
} from "../lib/marketData";
import { 대상지전체이름, 시군구목록, 시도목록 } from "../lib/regions";
import { MarketSection } from "./MarketSection";
import { WaterfallChart } from "./charts/WaterfallChart";
import { 수지폭포단계 } from "../lib/market";
import type { 시도 } from "../lib/regions";

/* ─── 표시 도우미 ──────────────────────────────────────────── */

const 숫자포맷 = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 });

/** 천단위 콤마. 값이 없으면 자료 없음 표시용으로 null 을 그대로 흘린다. */
function 콤마(값: number | null, 소수자리 = 2): string {
  if (값 === null || !Number.isFinite(값)) return "-";
  return new Intl.NumberFormat("ko-KR", {
    minimumFractionDigits: 소수자리,
    maximumFractionDigits: 소수자리,
  }).format(값);
}

/** 음수는 빨간색으로 표시한다 */
function Amount({
  값,
  단위 = "",
  소수자리 = 2,
}: {
  값: number | null;
  단위?: string;
  소수자리?: number;
}) {
  const 음수 = 값 !== null && 값 < 0;
  return (
    <span
      className={`tnum font-medium ${음수 ? "text-negative" : "text-foreground"}`}
    >
      {콤마(값, 소수자리)}
      {값 === null ? "" : 단위}
    </span>
  );
}

/* ─── 입력 컨트롤 ──────────────────────────────────────────── */

const 입력칸 =
  "w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm text-foreground " +
  "outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25";

function Field({
  라벨,
  설명,
  가정치 = false,
  children,
}: {
  라벨: string;
  설명?: string;
  가정치?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium leading-snug text-muted">
        {라벨}
        {가정치 ? (
          <span className="ml-1 text-warning">
            (가정치 — 근거 확인 필요, 조정 가능)
          </span>
        ) : null}
      </span>
      {children}
      {설명 ? <span className="text-[11px] text-muted/80">{설명}</span> : null}
    </label>
  );
}

/** 숫자 입력. 빈 칸은 0 으로 본다. */
function NumberInput({
  값,
  변경,
  단위,
  최소 = 0,
}: {
  값: number;
  변경: (다음: number) => void;
  단위?: string;
  최소?: number;
}) {
  const [초안, 설정초안] = useState<string | null>(null);
  const 표시 = 초안 ?? (Number.isFinite(값) ? 숫자포맷.format(값) : "");
  return (
    <span className="relative block">
      <input
        type="text"
        inputMode="decimal"
        className={`${입력칸} tnum text-right ${단위 ? "pr-16" : ""}`}
        value={표시}
        onFocus={(e) => {
          설정초안(String(값)); // 편집 중에는 구분기호를 뺀 원시 숫자를 보여준다
          e.currentTarget.select();
        }}
        onBlur={() => 설정초안(null)}
        onChange={(e) => {
          설정초안(e.target.value);
          const 정리 = e.target.value.replace(/[,\s]/g, "");
          if (정리 === "" || 정리 === "-") return 변경(0);
          const n = Number(정리);
          if (Number.isFinite(n)) 변경(Math.max(최소, n));
        }}
      />
      {단위 ? (
        <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[11px] text-muted">
          {단위}
        </span>
      ) : null}
    </span>
  );
}

/**
 * 값이 없을 수 있는 숫자 입력 (시장 기준치용).
 * 빈 칸은 0 이 아니라 null 이다 — 0 으로 두면 "공실률 0%" 같은
 * 근거 없는 확정 사실이 되어 버린다.
 */
function NullableNumberInput({
  값,
  변경,
  단위,
}: {
  값: number | null;
  변경: (다음: number | null) => void;
  단위?: string;
}) {
  const [초안, 설정초안] = useState<string | null>(null);
  const 표시 = 초안 ?? (값 === null ? "" : 숫자포맷.format(값));
  return (
    <span className="relative block">
      <input
        type="text"
        inputMode="decimal"
        placeholder="미확보"
        className={`${입력칸} tnum text-right ${단위 ? "pr-16" : ""}`}
        value={표시}
        onFocus={(e) => {
          설정초안(값 === null ? "" : String(값));
          e.currentTarget.select();
        }}
        onBlur={() => 설정초안(null)}
        onChange={(e) => {
          설정초안(e.target.value);
          const 정리 = e.target.value.replace(/[,\s]/g, "");
          if (정리 === "") return 변경(null);
          const n = Number(정리);
          if (Number.isFinite(n)) 변경(n);
        }}
      />
      {단위 ? (
        <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[11px] text-muted">
          {단위}
        </span>
      ) : null}
    </span>
  );
}

function Section({
  번호,
  제목,
  설명,
  children,
}: {
  번호: string;
  제목: string;
  설명?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-line bg-surface print-block">
      <header className="border-b border-line px-4 py-2.5">
        <h2 className="text-sm font-semibold text-foreground">
          <span className="mr-1.5 text-muted">{번호}</span>
          {제목}
        </h2>
        {설명 ? (
          <p className="mt-0.5 text-[11px] text-muted">{설명}</p>
        ) : null}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

/** 산출값 한 줄 — 값 옆에 계산에 쓴 수식을 함께 보여준다 */
function Derived({
  이름,
  값,
  단위,
  수식,
  소수자리 = 2,
}: {
  이름: string;
  값: number | null;
  단위?: string;
  수식: string;
  소수자리?: number;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-line/60 py-1.5 last:border-b-0">
      <span className="text-xs text-muted">{이름}</span>
      <span className="order-3 w-full text-[11px] text-muted/80 sm:order-2 sm:w-auto sm:flex-1 sm:text-right">
        {수식}
      </span>
      <span className="order-2 text-sm sm:order-3 sm:ml-3">
        {값 === null ? (
          <span className="text-xs text-warning">자료 없음</span>
        ) : (
          <Amount 값={값} 단위={단위} 소수자리={소수자리} />
        )}
      </span>
    </div>
  );
}

/* ─── 초기값 · 임시값 ──────────────────────────────────────── */

/** 빈 임대공간 행 하나 */
function 새행(): 임대공간행 {
  return {
    id: `row-${Math.random().toString(36).slice(2, 9)}`,
    구분명: "",
    전용면적m2: 0,
    공급면적평: 0,
    층수: 0,
  };
}

/** 아무 값도 채우지 않은 초기 입력 */
function 빈입력(): 사업계획입력 {
  return {
    사업명: "",
    시도: "",
    시군구: "",
    임대공간: [새행()],
    평당월임대료: 0,
    운영경비율: 30, // 사양 기본값. 가정치이므로 화면에 (가정치) 표기를 병기한다.
    상가연임대수입: 0,
    기타유입: 0,
    고정비: 0,
    캡레이트: 0,
    매각수수료율: 0,
    본PF: 0,
    본PF금융비용: 0,
    후순위: 0,
    시장기준치: {
      지역명: "",
      기준분기: "",
      평당임대료: null,
      공실률: null,
      소득수익률: null,
      출처명: "",
    },
  };
}

/**
 * 임시 값 — 화면 동작을 확인하기 위한 예시 수치다.
 *
 * 시장 자료가 아니고 특정 사업장과도 무관하다. 그래서
 *  · 사업대상지(시도·시군구)는 채우지 않는다. 사용자가 직접 고를 값이다.
 *  · 시장 기준치도 채우지 않는다. 출처 없는 시장 수치를 넣는 순간
 *    근거 없는 숫자가 확정 사실처럼 표에 실리기 때문이다.
 */
function 임시값(): 사업계획입력 {
  return {
    ...빈입력(),
    사업명: "(임시) 오피스 개발사업",
    임대공간: [
      {
        id: "tmp-office",
        구분명: "기준층 오피스",
        전용면적m2: 30000,
        공급면적평: 13000,
        층수: 15,
      },
      {
        id: "tmp-retail",
        구분명: "저층부 리테일",
        전용면적m2: 3000,
        공급면적평: 1300,
        층수: 3,
      },
    ],
    평당월임대료: 12,
    운영경비율: 30,
    상가연임대수입: 25,
    기타유입: 12,
    고정비: 30,
    캡레이트: 4.8,
    매각수수료율: 1,
    본PF: 1700,
    본PF금융비용: 200,
    후순위: 300,
  };
}

/**
 * 입력이 모자라 계산할 수 없는 장에 표시한다.
 * 빈 표를 0 으로 채우면 근거 없는 숫자가 확정 사실처럼 실린다.
 */
function NoData({ 사유 }: { 사유: string[] }) {
  return (
    <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2">
      <p className="text-xs font-medium text-foreground">자료 없음</p>
      <ul className="mt-1 list-disc pl-4 text-[11px] text-muted">
        {사유.map((항목) => (
          <li key={항목}>{항목} 입력 필요</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * 민감도 표.
 * 셀 값은 본PF 상환 후 잔액(억원)이다. 잔액 ≥ 0 이면 본PF 상환 가능(초록),
 * 음수면 불가(빨강)이며, 음수 중 후순위 한도 안에서 흡수되는 칸은 테두리로 구분한다.
 */
function SensitivityTable({
  표,
  모서리라벨,
  열단위,
  열소수자리,
}: {
  표: 민감도표;
  모서리라벨: string;
  열단위: string;
  열소수자리: number;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] border-collapse text-sm">
        <thead className="bg-surface-alt text-[11px] text-muted">
          <tr>
            <th className="whitespace-nowrap border-b border-line px-2 py-1.5 text-left font-medium">
              {모서리라벨}
            </th>
            {표.열.map((열값, i) => (
              <th
                key={`${열값}-${i}`}
                className="whitespace-nowrap border-b border-line px-2 py-1.5 text-right font-medium"
              >
                {콤마(열값, 열소수자리)}
                {열단위}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {표.셀.map((행, i) => (
            <tr key={표.행[i]}>
              <th
                scope="row"
                className="whitespace-nowrap border-b border-line/60 px-2 py-1.5 text-left text-xs font-semibold text-foreground"
              >
                {표.행[i]}%
              </th>
              {행.map((칸, j) => (
                <td
                  key={`${칸.열값}-${j}`}
                  className={`tnum whitespace-nowrap border-b border-line/60 px-2 py-1.5 text-right font-medium ${
                    칸.잔액 === null
                      ? "text-muted"
                      : 칸.본PF상환가능
                        ? "bg-positive/12 text-positive"
                        : "bg-negative/12 text-negative"
                  } ${
                    칸.잔액 !== null && !칸.본PF상환가능 && 칸.후순위내흡수
                      ? "outline outline-1 -outline-offset-1 outline-warning/70"
                      : ""
                  }`}
                >
                  {칸.잔액 === null ? "자료 없음" : 콤마(칸.잔액, 0)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * 변화율을 "4.95% 감소" 처럼 읽히게 쓴다.
 * 부호만 붙인 "-4.95%" 는 문장 안에서 방향이 바로 읽히지 않는다.
 */
function ChangePct({ 값 }: { 값: number | null }) {
  if (값 === null) return <span className="text-warning">자료 없음</span>;
  const 감소 = 값 < 0;
  return (
    <strong className={감소 ? "text-negative" : "text-positive"}>
      {콤마(Math.abs(값))}% {감소 ? "감소" : "증가"}
    </strong>
  );
}

/** 민감도 표 아래 범례 */
function Legend() {
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
      <span className="inline-flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded-sm bg-positive/30" />
        본PF 상환 가능 (잔액 ≥ 0)
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded-sm bg-negative/30" />
        상환 불가 (잔액 &lt; 0)
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded-sm outline outline-1 -outline-offset-1 outline-warning/70" />
        손실이 후순위 한도 안에서 흡수 (DSCR ≥ 1)
      </span>
      <span>단위 억원</span>
    </p>
  );
}

/* ─── 화면 ─────────────────────────────────────────────────── */

export function PlanApp() {
  const [입력, 설정입력] = useState<사업계획입력>(빈입력);

  /** 섹션 단위 부분 수정 */
  function 수정(변경: Partial<사업계획입력>) {
    설정입력((이전) => ({ ...이전, ...변경 }));
  }

  function 행수정(id: string, 변경: Partial<임대공간행>) {
    설정입력((이전) => ({
      ...이전,
      임대공간: 이전.임대공간.map((행) =>
        행.id === id ? { ...행, ...변경 } : 행,
      ),
    }));
  }

  const 집계 = useMemo(() => 임대공간집계하기(입력.임대공간), [입력.임대공간]);

  const 대상지 = 대상지전체이름(입력.시도, 입력.시군구);

  // 공공데이터 연동 전까지는 수동 입력값을 그대로 돌려주는 더미다.
  const 기준치 = useMemo(
    () => getMarketBenchmark(대상지, 입력.시장기준치),
    [대상지, 입력.시장기준치],
  );
  const 기준치표시 = 시장기준치표시가능(기준치);

  // ── 산출 ────────────────────────────────────────────────
  // 임대율 100%(완전임대)를 기준 시나리오로 본다. 사양의 입력 목록에 임대율이
  // 없고 LTV 도 완전임대 기준이므로, 다른 임대율은 Ⅵ장 민감도에서 본다.
  const 결과 = useMemo(() => 사업성계산(입력, 1), [입력]);

  // 계산에 필요한 입력이 갖춰졌는지. 모자라면 해당 장은 "자료 없음"으로 둔다.
  const 부족한입력 = useMemo(() => {
    const 목록: string[] = [];
    if (집계.공급면적평합계 <= 0) 목록.push("임대공간 구성표의 임대(공급)면적");
    if (입력.캡레이트 <= 0) 목록.push("캡레이트");
    if (입력.평당월임대료 <= 0 && 입력.상가연임대수입 <= 0) {
      목록.push("평당 월임대료 또는 상가 연임대수입");
    }
    return 목록;
  }, [집계.공급면적평합계, 입력.캡레이트, 입력.평당월임대료, 입력.상가연임대수입]);
  const 산출가능 = 부족한입력.length === 0;

  // Ⅴ. 캡레이트 민감도
  const 캡표 = useMemo(() => 캡레이트민감도표(입력), [입력]);
  const 한계캡 = useMemo(
    () => 한계캡레이트(입력, "본PF상환", 1).값,
    [입력],
  );
  const 캡변화 = useMemo(() => {
    const 열 = 캡표.열;
    return {
      상승: 캡레이트변동_자산가치변화율(입력.캡레이트, 0.25),
      하락: 캡레이트변동_자산가치변화율(입력.캡레이트, -0.25),
      최저캡: 열[0],
      최고캡: 열[열.length - 1],
      최저캡상승: 캡레이트변동_자산가치변화율(열[0], 0.25),
      최고캡상승: 캡레이트변동_자산가치변화율(열[열.length - 1], 0.25),
    };
  }, [캡표.열, 입력.캡레이트]);

  // Ⅵ. 임대율 · 임대료 민감도 — 열 단차 방식이 아직 미정이라 화면에서 고른다.
  const [단차방식, 설정단차방식] = useState<임대료단차방식>("비율");
  const [단차폭, 설정단차폭] = useState(10);
  const [단차기준, 설정단차기준] = useState<"가정치" | "시장">("가정치");

  // 시장 기준치를 단차 기준으로 쓰려면 출처명·기준분기가 함께 있어야 한다.
  const 시장기준사용가능 = 기준치표시 && 기준치.평당임대료 !== null;
  const 단차기준값 =
    단차기준 === "시장" && 시장기준사용가능
      ? 기준치.평당임대료!
      : 입력.평당월임대료;

  const 임대료열 = useMemo(
    () => 임대료열만들기(단차기준값, 단차방식, 단차폭, 2),
    [단차기준값, 단차방식, 단차폭],
  );
  const 임대료표 = useMemo(
    () => 임대료민감도표(입력, 임대료열),
    [입력, 임대료열],
  );
  const 한계임대료 = useMemo(
    () => 한계평당월임대료(입력, "본PF상환", 1).값,
    [입력],
  );
  const 한계율 = useMemo(() => 한계임대율(입력, "본PF상환").값, [입력]);
  const 한계율흡수 = useMemo(() => 한계임대율(입력, "후순위흡수").값, [입력]);

  const 시군구후보 =
    입력.시도 && 입력.시도 in 시군구목록
      ? 시군구목록[입력.시도 as 시도]
      : [];

  const 버튼 =
    "rounded-md border border-line bg-surface px-3 py-1.5 text-xs font-medium " +
    "text-foreground transition hover:border-line-strong hover:bg-surface-alt " +
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-5 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-muted">
            시행사 → 대주단 제출용
          </p>
          <h1 className="mt-0.5 text-lg font-semibold text-foreground">
            오피스 개발사업 사업계획서
          </h1>
          <p className="mt-0.5 text-xs text-muted">
            입력 단위 — 금액 억원 · 면적 평/㎡ · 평당 월임대료만 만원
          </p>
        </div>
        <div className="no-print flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            className={버튼}
            onClick={() => 설정입력(임시값())}
          >
            임시 값 채우기
          </button>
          <button
            type="button"
            className={버튼}
            onClick={() => 설정입력(빈입력())}
          >
            비우기
          </button>
        </div>
      </header>

      <p className="no-print rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-[11px] leading-relaxed text-foreground">
        <strong>임시 값</strong>은 화면 동작 확인용 예시 수치이며 시장 자료가
        아니다. 사업대상지와 시장 기준치는 임시 값으로 채우지 않는다 — 출처 없는
        수치를 넣으면 근거 없는 숫자가 확정 사실처럼 표에 실리기 때문이다.
      </p>

      <Section
        번호="1"
        제목="사업 개요"
        설명="사업대상지는 시도와 시군구 전체 이름으로 적는다"
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field 라벨="사업명">
            <input
              type="text"
              className={입력칸}
              value={입력.사업명}
              placeholder="예: ○○동 업무시설 신축사업"
              onChange={(e) => 수정({ 사업명: e.target.value })}
            />
          </Field>
          <Field 라벨="시도">
            <select
              className={입력칸}
              value={입력.시도}
              onChange={(e) => 수정({ 시도: e.target.value, 시군구: "" })}
            >
              <option value="">선택</option>
              {시도목록.map((시도명) => (
                <option key={시도명} value={시도명}>
                  {시도명}
                </option>
              ))}
            </select>
          </Field>
          <Field
            라벨="시군구"
            설명="목록은 참고용이다. 없는 행정구역은 직접 입력할 수 있다. [확인 필요] 목록 기준일 미확인"
          >
            <input
              type="text"
              list="시군구후보"
              className={입력칸}
              value={입력.시군구}
              placeholder={입력.시도 ? "예: 강남구" : "시도를 먼저 고를 것"}
              onChange={(e) => 수정({ 시군구: e.target.value })}
            />
            <datalist id="시군구후보">
              {시군구후보.map((이름) => (
                <option key={이름} value={이름} />
              ))}
            </datalist>
          </Field>
          <Field 라벨="사업대상지 (전체 이름)">
            <div className="rounded-md border border-line bg-surface-alt px-2.5 py-1.5 text-sm">
              {대상지 || (
                <span className="text-xs text-warning">자료 없음</span>
              )}
            </div>
          </Field>
        </div>
      </Section>

      <Section
        번호="2"
        제목="임대공간 구성표"
        설명="구분별 전용면적·임대(공급)면적·층수를 적으면 합계가 자동 산출된다"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead className="bg-surface-alt text-[11px] text-muted">
              <tr>
                <th className="border-b border-line px-2 py-1.5 text-left font-medium">
                  구분명
                </th>
                <th className="border-b border-line px-2 py-1.5 text-right font-medium">
                  전용 (㎡)
                </th>
                <th className="border-b border-line px-2 py-1.5 text-right font-medium">
                  임대(공급) (평)
                </th>
                <th className="border-b border-line px-2 py-1.5 text-right font-medium">
                  층수
                </th>
                <th className="no-print w-16 border-b border-line px-2 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {입력.임대공간.map((행) => (
                <tr key={행.id}>
                  <td className="border-b border-line/60 px-2 py-1.5">
                    <input
                      type="text"
                      className={입력칸}
                      value={행.구분명}
                      placeholder="예: 기준층 오피스"
                      onChange={(e) =>
                        행수정(행.id, { 구분명: e.target.value })
                      }
                    />
                  </td>
                  <td className="border-b border-line/60 px-2 py-1.5">
                    <NumberInput
                      값={행.전용면적m2}
                      변경={(v) => 행수정(행.id, { 전용면적m2: v })}
                    />
                  </td>
                  <td className="border-b border-line/60 px-2 py-1.5">
                    <NumberInput
                      값={행.공급면적평}
                      변경={(v) => 행수정(행.id, { 공급면적평: v })}
                    />
                  </td>
                  <td className="border-b border-line/60 px-2 py-1.5">
                    <NumberInput
                      값={행.층수}
                      변경={(v) => 행수정(행.id, { 층수: v })}
                    />
                  </td>
                  <td className="no-print border-b border-line/60 px-2 py-1.5">
                    <button
                      type="button"
                      className="whitespace-nowrap rounded px-2 py-1 text-xs text-muted transition hover:bg-surface-alt hover:text-negative disabled:opacity-40"
                      disabled={입력.임대공간.length <= 1}
                      onClick={() =>
                        수정({
                          임대공간: 입력.임대공간.filter((r) => r.id !== 행.id),
                        })
                      }
                      aria-label={`${행.구분명 || "이름 없는"} 행 삭제`}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button
          type="button"
          className={`${버튼} no-print mt-3`}
          onClick={() => 수정({ 임대공간: [...입력.임대공간, 새행()] })}
        >
          + 행 추가
        </button>

        <div className="mt-3 rounded-md bg-surface-alt px-3 py-2">
          <p className="mb-1 text-[11px] font-semibold text-muted">산출값</p>
          <Derived
            이름="임대(공급)면적 합계"
            값={집계.공급면적평합계}
            단위="평"
            수식="Σ 각 행 임대(공급)면적"
          />
          <Derived
            이름="전용면적 합계"
            값={집계.전용면적m2합계}
            단위="㎡"
            수식="Σ 각 행 전용면적"
          />
          <Derived
            이름="전용면적 합계 (평)"
            값={집계.전용면적평합계}
            단위="평"
            수식="전용면적(㎡) ÷ (400/121)"
          />
          <Derived
            이름="층수 합계"
            값={집계.층수합계}
            단위="개 층"
            수식="Σ 각 행 층수"
            소수자리={0}
          />
          <Derived
            이름="전용률"
            값={집계.전용률}
            단위="%"
            수식="전용면적(평) ÷ 임대(공급)면적(평) × 100"
          />
        </div>
      </Section>

      <Section 번호="3" 제목="임대 · 운영 가정">
        <div className="grid gap-3 md:grid-cols-2">
          <Field
            라벨="평당 월임대료 (공급 기준)"
            설명="임대(공급)면적 1평당 월 임대료"
          >
            <NumberInput
              값={입력.평당월임대료}
              변경={(v) => 수정({ 평당월임대료: v })}
              단위="만원/평·월"
            />
          </Field>
          <Field
            라벨="운영경비율"
            가정치
            설명="기본값 30%는 사용자 지정 가정치다. 공공데이터·업계 자료로 검증된 값이 아니다."
          >
            <NumberInput
              값={입력.운영경비율}
              변경={(v) => 수정({ 운영경비율: v })}
              단위="%"
            />
          </Field>
          <Field 라벨="상가(리테일) 연임대수입">
            <NumberInput
              값={입력.상가연임대수입}
              변경={(v) => 수정({ 상가연임대수입: v })}
              단위="억원"
            />
          </Field>
          <Field 라벨="기타유입 (주차 등)">
            <NumberInput
              값={입력.기타유입}
              변경={(v) => 수정({ 기타유입: v })}
              단위="억원"
            />
          </Field>
          <Field 라벨="고정비">
            <NumberInput
              값={입력.고정비}
              변경={(v) => 수정({ 고정비: v })}
              단위="억원"
            />
          </Field>
        </div>
      </Section>

      <Section
        번호="4"
        제목="자산가치 · 매각"
        설명="자산가치 = NOI ÷ 캡레이트 · 매각정산액 = 자산가치 × (1 − 매각수수료율)"
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field 라벨="캡레이트 (시장 캡레이트)">
            <NumberInput
              값={입력.캡레이트}
              변경={(v) => 수정({ 캡레이트: v })}
              단위="%"
            />
          </Field>
          <Field 라벨="매각수수료율">
            <NumberInput
              값={입력.매각수수료율}
              변경={(v) => 수정({ 매각수수료율: v })}
              단위="%"
            />
          </Field>
        </div>
      </Section>

      <Section 번호="5" 제목="자금조달">
        <div className="grid gap-3 md:grid-cols-3">
          <Field 라벨="본PF">
            <NumberInput
              값={입력.본PF}
              변경={(v) => 수정({ 본PF: v })}
              단위="억원"
            />
          </Field>
          <Field 라벨="본PF 금융비용" 설명="총액 기준">
            <NumberInput
              값={입력.본PF금융비용}
              변경={(v) => 수정({ 본PF금융비용: v })}
              단위="억원"
            />
          </Field>
          <Field 라벨="후순위">
            <NumberInput
              값={입력.후순위}
              변경={(v) => 수정({ 후순위: v })}
              단위="억원"
            />
          </Field>
        </div>
      </Section>

      <Section
        번호="6"
        제목="시장 기준치 (공공데이터)"
        설명="지금은 수동 입력이다. 인증키 발급 후 lib/marketData.ts 의 getMarketBenchmark() 를 API 호출로 교체한다."
      >
        {!기준치표시 ? (
          <p className="mb-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground">
            {자료없음문구}
            <span className="mt-1 block text-[11px] text-muted">
              수치가 있어도 출처명과 기준분기가 비어 있으면 표시하지 않는다.
              출처 없는 시장 수치는 확정 사실이 될 수 없다.
            </span>
          </p>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          <Field 라벨="지역명" 설명="비워 두면 사업대상지 이름을 쓴다">
            <input
              type="text"
              className={입력칸}
              value={입력.시장기준치.지역명}
              placeholder={대상지 || "예: 서울 도심권"}
              onChange={(e) =>
                수정({
                  시장기준치: { ...입력.시장기준치, 지역명: e.target.value },
                })
              }
            />
          </Field>
          <Field 라벨="기준분기" 설명="예: 2025년 2분기">
            <input
              type="text"
              className={입력칸}
              value={입력.시장기준치.기준분기}
              placeholder="예: 2025년 2분기"
              onChange={(e) =>
                수정({
                  시장기준치: { ...입력.시장기준치, 기준분기: e.target.value },
                })
              }
            />
          </Field>
          <Field 라벨="평당 임대료 (시장)">
            <NullableNumberInput
              값={입력.시장기준치.평당임대료}
              변경={(v) =>
                수정({ 시장기준치: { ...입력.시장기준치, 평당임대료: v } })
              }
              단위="만원/평·월"
            />
          </Field>
          <Field 라벨="공실률 (시장)">
            <NullableNumberInput
              값={입력.시장기준치.공실률}
              변경={(v) =>
                수정({ 시장기준치: { ...입력.시장기준치, 공실률: v } })
              }
              단위="%"
            />
          </Field>
          <Field
            라벨="참고용 소득수익률"
            설명="[확인 필요] 이 값이 거래사례 기반 캡레이트와 같은 개념인지 확인되지 않았다. 캡레이트로 자동 대체하지 않는다."
          >
            <NullableNumberInput
              값={입력.시장기준치.소득수익률}
              변경={(v) =>
                수정({ 시장기준치: { ...입력.시장기준치, 소득수익률: v } })
              }
              단위="%"
            />
          </Field>
          <Field
            라벨="출처명"
            설명="예: 한국부동산원 상업용부동산 임대동향조사"
          >
            <input
              type="text"
              className={입력칸}
              value={입력.시장기준치.출처명}
              placeholder="출처 없이 수치만 표시하지 않는다"
              onChange={(e) =>
                수정({
                  시장기준치: { ...입력.시장기준치, 출처명: e.target.value },
                })
              }
            />
          </Field>
        </div>

        {기준치표시 ? (
          <div className="mt-3 rounded-md bg-surface-alt px-3 py-2">
            <p className="mb-1 text-[11px] font-semibold text-muted">
              {기준치.지역명} · {기준치.기준분기} · 출처 {기준치.출처명}
            </p>
            <Derived
              이름="시장 평당 임대료"
              값={기준치.평당임대료}
              단위="만원/평·월"
              수식={`사업계획 가정치 ${숫자포맷.format(입력.평당월임대료)} 만원/평·월`}
            />
            <Derived
              이름="시장 공실률"
              값={기준치.공실률}
              단위="%"
              수식="임대율 가정과 비교할 것 (자동 대체하지 않음)"
            />
            <Derived
              이름="참고용 소득수익률"
              값={기준치.소득수익률}
              단위="%"
              수식={`사업계획 캡레이트 가정 ${숫자포맷.format(입력.캡레이트)}%`}
            />
          </div>
        ) : null}
      </Section>

      <div className="mt-2 border-t border-line pt-4 print-page-break">
        <p className="text-[11px] uppercase tracking-widest text-muted">
          산출 — 사업계획서 본문
        </p>
      </div>

      <MarketSection 입력={입력} />

      <Section
        번호="Ⅲ"
        제목="사업수지"
        설명="임대율 100%(완전임대) 기준 · 금액 단위 억원 — 다른 임대율은 Ⅵ장 민감도 참조"
      >
        {!산출가능 ? (
          <NoData 사유={부족한입력} />
        ) : (
          <div className="rounded-md bg-surface-alt px-3 py-2">
            <Derived
              이름="연임대수입 (GPI)"
              값={결과.noi.임대수입}
              단위="억원"
              수식={`(${콤마(집계.공급면적평합계)}평 × ${콤마(입력.평당월임대료)}만원 × 12 ÷ 10,000 + ${콤마(입력.상가연임대수입)}) × 100%`}
            />
            <Derived
              이름="기타수입"
              값={결과.noi.기타수입}
              단위="억원"
              수식="주차 등 입력값"
            />
            <Derived
              이름="대손충당금"
              값={결과.noi.대손충당금}
              단위="억원"
              수식="(임대수입 + 기타수입) × 1%"
            />
            <Derived
              이름="유효조소득"
              값={결과.noi.유효조소득}
              단위="억원"
              수식="임대수입 + 기타수입 − 대손충당금"
            />
            <Derived
              이름="운영경비 (가정치)"
              값={결과.noi.운영경비}
              단위="억원"
              수식={`유효조소득 × ${콤마(입력.운영경비율)}% — 가정치, 근거 확인 필요`}
            />
            <Derived
              이름="고정비"
              값={결과.noi.고정비}
              단위="억원"
              수식="입력값"
            />
            <Derived
              이름="NOI (순영업소득)"
              값={결과.noi.NOI}
              단위="억원"
              수식={`유효조소득 × (1 − ${콤마(입력.운영경비율)}%) − 고정비`}
            />
            <Derived
              이름="자산가치"
              값={결과.자산가치}
              단위="억원"
              수식={`NOI ÷ ${콤마(입력.캡레이트)}%`}
            />
            <Derived
              이름="매각정산액 (상환 전)"
              값={결과.매각정산액}
              단위="억원"
              수식={`자산가치 × (1 − ${콤마(입력.매각수수료율)}%)`}
            />
            <Derived
              이름="본PF 상환 후 잔액"
              값={결과.본PF상환후잔액}
              단위="억원"
              수식={`매각정산액 − (본PF ${콤마(입력.본PF, 0)} + 금융비용 ${콤마(입력.본PF금융비용, 0)})`}
            />
            <Derived
              이름="만기 누적 DSCR"
              값={결과.만기누적DSCR}
              단위="배"
              수식="1 + (본PF 상환 후 잔액 + 후순위) ÷ (본PF + 금융비용) = 상환재원 ÷ 상환의무"
            />
            <Derived
              이름="LTV"
              값={결과.LTV}
              단위="%"
              수식="본PF ÷ 완전임대 자산가치 × 100"
            />
          </div>
        )}

        {산출가능 ? (
          <div className="mt-3">
            <WaterfallChart 단계={수지폭포단계(입력)} />
          </div>
        ) : null}

        {산출가능 ? (
          <div className="mt-3 rounded-md bg-surface-alt px-3 py-2">
            <p className="mb-1 text-[11px] font-semibold text-muted">
              한계선 (이분법) — 이 아래로 가면 본PF 원리금을 못 갚는다
            </p>
            <Derived
              이름="한계 임대율 (본PF 상환)"
              값={한계율}
              단위="%"
              수식="본PF 상환 후 잔액 = 0 이 되는 임대율"
            />
            <Derived
              이름="한계 임대율 (후순위 흡수)"
              값={한계율흡수}
              단위="%"
              수식="본PF 상환 후 잔액 = −후순위 가 되는 임대율"
            />
            <Derived
              이름="한계 평당 월임대료"
              값={한계임대료}
              단위="만원/평·월"
              수식="임대율 100% 기준, 잔액 = 0 이 되는 임대료"
            />
            <Derived
              이름="한계 캡레이트"
              값={한계캡}
              단위="%"
              수식="임대율 100% 기준, 잔액 = 0 이 되는 캡레이트"
            />
          </div>
        ) : null}
      </Section>

      <Section
        번호="Ⅴ"
        제목="캡레이트 민감도"
        설명="사업성의 핵심 변수 · 셀 값은 본PF 상환 후 잔액(억원)"
      >
        {!산출가능 ? (
          <NoData 사유={부족한입력} />
        ) : (
          <>
            <SensitivityTable
              표={캡표}
              모서리라벨="임대율 \ 캡레이트"
              열단위="%"
              열소수자리={2}
            />
            <Legend />

            <div className="mt-3 flex flex-col gap-1.5 text-xs leading-relaxed text-foreground">
              <p>
                ① 캡레이트가 <strong>0.25%p 상승</strong>하면 자산가치는 약{" "}
                <ChangePct 값={캡변화.상승} />
                하고, <strong>0.25%p 하락</strong>하면 약{" "}
                <ChangePct 값={캡변화.하락} />
                한다. 자산가치 = NOI ÷ 캡레이트 이므로 같은 0.25%p 상승이라도
                캡레이트가 낮을수록 변화폭이 크다 — 표 왼쪽 끝{" "}
                {콤마(캡변화.최저캡)}%에서는 <ChangePct 값={캡변화.최저캡상승} />
                , 오른쪽 끝 {콤마(캡변화.최고캡)}%에서는{" "}
                <ChangePct 값={캡변화.최고캡상승} />.
              </p>
              <p>
                ②{" "}
                {한계캡 === null ? (
                  <span className="text-warning">
                    현재 조건에서는 어떤 캡레이트에서도 본PF를 상환할 수 없다.
                  </span>
                ) : (
                  <>
                    상환 가능한 최대 캡레이트는 <strong>{콤마(한계캡)}%</strong>
                    로, 현재 시장 캡레이트 {콤마(입력.캡레이트)}% 대비{" "}
                    <strong
                      className={
                        한계캡 - 입력.캡레이트 < 0
                          ? "text-negative"
                          : "text-positive"
                      }
                    >
                      {콤마(한계캡 - 입력.캡레이트)}%p
                    </strong>{" "}
                    여유가 있다.
                  </>
                )}
              </p>
            </div>

            <p className="mt-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-[11px] leading-relaxed text-muted">
              [확인 필요] 열 구간 ±1.0%p · 0.25%p 단위는 임의로 잡은 값이다.
              실제 최근 분기 캡레이트 변동폭(분기당 0.2%p 내외 변동 사례 등)을
              확인해 구간을 다시 정할지 검토가 필요하다.
            </p>
          </>
        )}
      </Section>

      <Section
        번호="Ⅵ"
        제목="임대율 · 임대료 민감도"
        설명="셀 값은 본PF 상환 후 잔액(억원)"
      >
        {!산출가능 ? (
          <NoData 사유={부족한입력} />
        ) : (
          <>
            <div className="no-print mb-3 grid gap-3 sm:grid-cols-3">
              <Field 라벨="열 단차 방식">
                <select
                  className={입력칸}
                  value={단차방식}
                  onChange={(e) =>
                    설정단차방식(e.target.value as 임대료단차방식)
                  }
                >
                  <option value="비율">기준값의 ±비율</option>
                  <option value="금액">기준값에서 ±고정 금액</option>
                </select>
              </Field>
              <Field
                라벨={
                  단차방식 === "비율" ? "한 칸 단차 (%)" : "한 칸 단차 (만원)"
                }
              >
                <NumberInput 값={단차폭} 변경={설정단차폭} />
              </Field>
              <Field
                라벨="가운데 열 기준"
                설명={
                  시장기준사용가능
                    ? undefined
                    : "시장 기준치는 출처명·기준분기가 있어야 고를 수 있다"
                }
              >
                <select
                  className={입력칸}
                  value={단차기준}
                  onChange={(e) =>
                    설정단차기준(e.target.value as "가정치" | "시장")
                  }
                >
                  <option value="가정치">사업계획 가정치</option>
                  <option value="시장" disabled={!시장기준사용가능}>
                    시장 기준치
                  </option>
                </select>
              </Field>
            </div>

            <SensitivityTable
              표={임대료표}
              모서리라벨="임대율 \ 평당 월임대료"
              열단위="만원"
              열소수자리={2}
            />
            <Legend />

            <p className="mt-3 text-xs text-foreground">
              임대율 100% 기준 한계 평당 월임대료는{" "}
              {한계임대료 === null ? (
                <span className="text-warning">자료 없음</span>
              ) : (
                <strong>{콤마(한계임대료)}만원/평·월</strong>
              )}{" "}
              이다 (현재 가정치 {콤마(입력.평당월임대료)}만원).
            </p>

            <p className="mt-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-[11px] leading-relaxed text-muted">
              [확인 필요] 열 단차를 기준값의 ±비율로 잡을지 고정 금액으로 잡을지
              아직 정해지지 않았다. 한쪽을 코드에 박지 않고 위에서 고르게 두었다.
            </p>
          </>
        )}
      </Section>

      <section className="no-print rounded-lg border border-line bg-surface-alt px-4 py-3 text-[11px] leading-relaxed text-muted">
        <p className="font-semibold text-foreground">다음 단계</p>
        <p className="mt-1">
          붙인 장 — 2 임대시장 분석 · 3 사업수지 · 5 캡레이트 민감도 ·
          6 임대율·임대료 민감도. 남은 장 — 1 사업 개요 · 4 자금조달과 상환 ·
          7 리스크와 완화 방안 · 8 확인하지 못한 것.
        </p>
        <p className="mt-1">
          월별 자금수지 · IRR · 공공데이터 API 자동조회(추후 반영)는 이 앱의 범위
          밖이다.
        </p>
      </section>
    </div>
  );
}
