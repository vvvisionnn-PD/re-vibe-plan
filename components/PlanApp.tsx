"use client";

import { useRef, useState, type ReactNode } from "react";
import {
  cashBreakdown,
  cashWaterfall,
  dscr,
  emptyHousingType,
  emptyInput,
  FORMULAS,
  ltv,
  missingInputs,
  parseNumberInput,
  priceThreshold,
  repaySentence,
  riskMetrics,
  rowSupplyPyeong,
  salesRateThreshold,
  sensitivityTable,
  summarizeHousing,
  type HousingType,
  type Num,
  type PlanInput,
  type Requirement,
  type Threshold,
} from "@/lib/calc";
import { formatNumber, isNegative } from "@/lib/format";
import { applyPreset, PRESETS } from "@/lib/presets";
import { isFullSidoName, isFullSigunguName } from "@/lib/region";
import {
  AREA84_MAX,
  AREA84_MIN,
  MARKET_NO_DATA,
  areaName,
  asOfDate,
  jeonseRatio,
  marketMargin,
  mergePresale,
  mergeRent,
  newSupply84,
  presalePremium,
  recentMonths,
  remainderSummary,
  undersubscription,
  type Announcement,
  type DetailResponse,
  type PresaleResponse,
  type RegionResponse,
  type RentResponse,
  type SubscriptionResponse,
  type TableMeta,
} from "@/lib/market";
import { CANCELLED, createQueue, type Queue } from "@/lib/queue";
import CashWaterfallChart from "./charts/CashWaterfallChart";
import MarketMarginChart from "./charts/MarketMarginChart";

/** 주택형 행 id를 만든다 */
const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `row-${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * 숫자 입력칸. 빈 칸은 null로 올려보낸다.
 * 입력 중에는 친 그대로 보여주고, 칸을 벗어나면 천단위 콤마로 표시한다.
 * 잘못된 값은 반영하지 않고 칸 아래에 이유를 보여준다.
 */
function NumInput({
  label,
  value,
  onChange,
  unit,
  integer = false,
  hideLabel = false,
}: {
  label: string;
  value: Num;
  onChange: (v: Num) => void;
  unit: string;
  integer?: boolean;
  hideLabel?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const parsed = draft === null ? null : parseNumberInput(draft, integer);
  const error = parsed && !parsed.ok ? parsed.reason : null;
  const shown = draft ?? (value === null ? "" : formatNumber(value, 4));

  return (
    <label className="flex min-w-0 flex-col gap-1 text-sm">
      <span className={hideLabel ? "sm:sr-only text-xs text-muted" : "text-muted"}>{label}</span>
      <span
        className={`flex items-center rounded-md border bg-card focus-within:ring-2 focus-within:ring-accent/40 ${
          error ? "border-bad" : "border-line"
        }`}
      >
        <input
          aria-label={`${label} (${unit})`}
          inputMode="decimal"
          aria-invalid={error !== null}
          placeholder="입력"
          className={`w-full min-w-0 bg-transparent px-2 py-1.5 text-right tabular-nums outline-none placeholder:text-muted/60 ${
            isNegative(value) ? "text-bad" : ""
          }`}
          value={shown}
          onFocus={() => setDraft(value === null ? "" : String(value))}
          onChange={(e) => {
            setDraft(e.target.value);
            const r = parseNumberInput(e.target.value, integer);
            if (r.ok) onChange(r.value);
          }}
          onBlur={() => {
            // 올바른 값이면 콤마 표시로 돌아가고, 틀린 값이면 고칠 수 있게 남겨둔다
            if (draft === null || parseNumberInput(draft, integer).ok) setDraft(null);
          }}
        />
        <span className="shrink-0 pr-2 text-xs whitespace-nowrap text-muted">{unit}</span>
      </span>
      {error && <span className="text-xs text-bad">{error}</span>}
    </label>
  );
}

/** 글자 입력칸 */
function TextInput({
  label,
  value,
  onChange,
  placeholder,
  warning,
  hideLabel = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  warning?: string | null;
  hideLabel?: boolean;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-sm">
      <span className={hideLabel ? "sm:sr-only text-xs text-muted" : "text-muted"}>{label}</span>
      <input
        aria-label={label}
        className={`w-full min-w-0 rounded-md border bg-card px-2 py-1.5 outline-none focus:ring-2 focus:ring-accent/40 placeholder:text-muted/60 ${
          warning ? "border-bad" : "border-line"
        }`}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {warning && <span className="text-xs text-bad">{warning}</span>}
    </label>
  );
}

/** 입력 묶음 카드 */
function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-card p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/**
 * 계산된 값 한 줄 — 값 옆에 계산식을 함께 보여준다.
 * text를 넘기면 숫자 대신 그 문구를 표시한다(한계선의 "도달 불가" 등).
 */
function Derived({
  label,
  value,
  unit,
  formula,
  digits = 2,
  text,
}: {
  label: string;
  value: Num;
  unit: string;
  formula: string;
  digits?: number;
  text?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 text-sm sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
      <span className="text-muted">{label}</span>
      <span className="flex flex-col items-start gap-0.5 sm:items-end">
        <span className={`font-semibold tabular-nums ${isNegative(value) ? "text-bad" : ""}`}>
          {text ?? formatNumber(value, digits, true)}
          {text === undefined && value !== null && (
            <span className="ml-0.5 text-xs font-normal text-muted">{unit}</span>
          )}
        </span>
        <span className="text-xs text-muted">= {formula}</span>
      </span>
    </div>
  );
}

/** 한계선 결과를 표시용 숫자 · 문구로 바꾼다 (scale: 분양률은 100을 곱해 %로) */
function thresholdView(t: Threshold, scale: number): { value: Num; text?: string } {
  if (t.kind === "none") return { value: null };
  if (t.kind === "unreachable") return { value: null, text: "도달 불가" };
  return { value: t.value * scale };
}

const buttonClass = "rounded-md border border-line bg-card px-3 py-1.5 text-sm hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40";

// ─────────────────────────────────────────────
// 사업계획서 (결과 화면) — 숫자는 모두 lib/calc.ts에서 받아 표시만 한다
// ─────────────────────────────────────────────

const cell = "border border-line px-2 py-1.5";
const headCell = `${cell} bg-accent-soft/60 text-left font-medium`;
const numCell = `${cell} text-right tabular-nums`;

/** 숫자 표시 — 천단위 콤마, 음수 빨강, 빈 값은 "자료 없음" */
function Val({ value, digits = 1, fixed = true }: { value: Num; digits?: number; fixed?: boolean }) {
  return <span className={isNegative(value) ? "text-bad" : ""}>{formatNumber(value, digits, fixed)}</span>;
}

/** 억원 금액 표시 (소수 1자리 고정, 음수 빨강) */
function Eok({ value }: { value: Num }) {
  return <Val value={value} digits={1} />;
}

/** 문장 속 계산식 표시 */
function F({ children }: { children: ReactNode }) {
  return <span className="text-xs text-muted"> (= {children})</span>;
}

// ─────────────────────────────────────────────
// 2장 시장 분석 — 공공데이터 조회 상태와 표
// ─────────────────────────────────────────────

/** 호출 하나의 상태 */
type Task<T> = { status: "pending" } | { status: "ok"; data: T } | { status: "error"; error: string };

/** [사업계획서 만들기] 한 번의 조회 */
interface MarketRun {
  id: number;
  area: string;
  months: string[];
  region: Task<RegionResponse>;
  presale: Record<string, Task<PresaleResponse>>;
  rent: Record<string, Task<RentResponse>>;
  subscription: Task<SubscriptionResponse> | null;
  details: Record<string, Task<DetailResponse>>;
}

/** 다시 시도할 대상 */
type RetryTarget =
  | { kind: "region" }
  | { kind: "subscription" }
  | { kind: "presale" | "rent"; ym: string }
  | { kind: "detail"; announcement: Announcement };

/** 공고 키 (주택관리번호|공고번호) */
const detailKey = (a: { id: string; pblanc: string }) => `${a.id}|${a.pblanc}`;

/** 끝난(성공 · 실패) 호출인지 */
const settled = <T,>(t: Task<T> | undefined | null): boolean => !!t && t.status !== "pending";

/** 성공한 호출의 데이터만 모은다 */
function okData<T>(tasks: (Task<T> | undefined | null)[]): T[] {
  const out: T[] = [];
  for (const t of tasks) if (t && t.status === "ok") out.push(t.data);
  return out;
}

/** 실패한 호출 수 */
const failedCount = <T,>(tasks: (Task<T> | undefined | null)[]) => tasks.filter((t) => t?.status === "error").length;

/** "YYYYMM" → "YYYY.MM" */
const ymText = (ym: string) => `${ym.slice(0, 4)}.${ym.slice(4)}`;

/**
 * 조회 상태에서 표 5개와 결론을 만든다. 계산은 lib/market.ts가 하고, 여기서는 끝난 호출만 모아 넘긴다.
 * 표는 필요한 호출이 모두 끝났을 때만 만든다 (끝난 표부터 렌더링).
 */
function deriveMarket(run: MarketRun, input: PlanInput) {
  const region = run.region.status === "ok" ? run.region.data.region : null;
  const areaLabel = region ? `${run.area} (법정동 ${region.code})` : run.area;
  const sub = run.subscription?.status === "ok" ? run.subscription.data : null;
  const announcements = sub?.announcements ?? [];
  const detailTasks = announcements.map((a) => run.details[detailKey(a)]);
  const detailsDone = sub !== null && detailTasks.every(settled);
  const details = okData(detailTasks);
  const detailFails = failedCount(detailTasks);
  const presaleTasks = run.months.map((m) => run.presale[m]);
  const rentTasks = run.months.map((m) => run.rent[m]);
  const presaleDone = region !== null && presaleTasks.every(settled);
  const rentDone = region !== null && rentTasks.every(settled);
  const subAsOf = sub ? [sub.asOf] : [];
  const detailAsOf = details.map((d) => d.asOf);
  const since = sub?.since ?? "";
  const subScope = `모집공고일 ${since} 이후 · 공급위치에 "${run.area}" 포함`;
  const failNote = (n: number, unit: string) => (n > 0 ? [`조회 실패 ${n}${unit} 제외 (다시 시도 가능)`] : []);

  const newSupply = detailsDone ? newSupply84(announcements, details, input.pricePerPyeong) : null;
  const newSupplyMeta: TableMeta | null = newSupply && {
    area: areaLabel,
    count: newSupply.rows.length,
    exclusions: [
      `청약홈 APT 분양 공고 ${announcements.length}곳 (${subScope})`,
      `전용 ${AREA84_MIN}.00㎡ 이상 ${AREA84_MAX}.00㎡ 미만 주택형만`,
      ...(newSupply.noPrice > 0 ? [`분양가 · 공급면적 없는 주택형 ${newSupply.noPrice}개 제외`] : []),
      "분양가 = 주택형별 분양최고금액",
      ...failNote(detailFails, "곳"),
    ],
    asOf: asOfDate([...subAsOf, ...detailAsOf]) ?? "",
  };

  const presaleMonths = okData(presaleTasks);
  const presaleMerged = presaleDone ? mergePresale(presaleMonths) : null;
  const premium = presaleMerged && detailsDone ? presalePremium(presaleMerged.trades, announcements, details) : null;
  const premiumMeta: TableMeta | null = premium && presaleMerged && {
    area: areaLabel,
    count: premium.rows.length,
    exclusions: [
      `분양권 전매 ${ymText(run.months[0])}~${ymText(run.months[run.months.length - 1])} 원자료 ${presaleMerged.stats.total}건`,
      `입주권 ${presaleMerged.stats.rightsExcluded}건 · 해제 ${presaleMerged.stats.cancelledExcluded}건 제외`,
      ...(presaleMerged.stats.invalidExcluded > 0 ? [`금액 · 면적 오류 ${presaleMerged.stats.invalidExcluded}건 제외`] : []),
      `청약홈 공고와 단지명 · 전용면적(±0.5㎡)을 맞추지 못한 ${premium.unmatched}건 제외`,
      `같은 전용면적에 분양가가 다른 주택형이 있어 타입을 알 수 없는 ${premium.ambiguous}건 제외`,
      "분양가 = 맞춘 주택형의 분양최고금액",
      ...failNote(failedCount(presaleTasks), "개월"),
      ...failNote(detailFails, "곳(청약홈)"),
    ],
    asOf: asOfDate([...presaleMonths.map((m) => m.asOf), ...detailAsOf]) ?? "",
  };

  const under = detailsDone ? undersubscription(announcements, details) : null;
  const underMeta: TableMeta | null = under && {
    area: areaLabel,
    count: under.rows.length,
    exclusions: [
      `청약홈 APT 분양 공고 (${subScope})`,
      "미달 = 1순위 + 2순위 접수건수(모든 거주지역) < 일반공급 세대수",
      ...(under.noRate > 0 ? [`경쟁률 자료 없는 주택형 ${under.noRate}개 제외`] : []),
      ...failNote(detailFails, "곳"),
    ],
    asOf: asOfDate([...subAsOf, ...detailAsOf]) ?? "",
  };

  const remain = sub ? remainderSummary(sub.remainders) : null;
  const remainMeta: TableMeta | null = remain && {
    area: areaLabel,
    count: remain.rows.length,
    exclusions: [`청약홈 APT 잔여세대 공고 (${subScope})`, "세대수 = 공고의 공급규모"],
    asOf: asOfDate(subAsOf) ?? "",
  };

  const rentMonths = okData(rentTasks);
  const rentMerged = rentDone ? mergeRent(rentMonths) : null;
  const jeonse = rentMerged ? jeonseRatio(rentMerged.contracts, input) : null;
  const jeonseMeta: TableMeta | null = jeonse && rentMerged && {
    area: areaLabel,
    count: rentMerged.contracts.length,
    exclusions: [
      `전월세 ${ymText(run.months[0])}~${ymText(run.months[run.months.length - 1])} 원자료 ${rentMerged.stats.total}건`,
      `월세 ${rentMerged.stats.monthlyExcluded}건 · 84㎡ 외 ${rentMerged.stats.sizeExcluded}건 · 갱신 · 계약구분 미기재 ${rentMerged.stats.notNewExcluded}건 제외`,
      ...(rentMerged.stats.invalidExcluded > 0 ? [`금액 · 면적 오류 ${rentMerged.stats.invalidExcluded}건 제외`] : []),
      "전월세 기술문서에 해제여부 항목이 없어 해제 거래는 거르지 못함",
      ...failNote(failedCount(rentTasks), "개월"),
    ],
    asOf: asOfDate(rentMonths.map((m) => m.asOf)) ?? "",
  };

  const margin = newSupply ? marketMargin(input, newSupply.median) : null;

  return {
    region,
    progress: {
      presale: presaleTasks.filter(settled).length,
      rent: rentTasks.filter(settled).length,
      months: run.months.length,
      details: detailTasks.filter(settled).length,
      announcements: sub ? announcements.length : null,
    },
    newSupply: newSupply && newSupplyMeta ? { ...newSupply, meta: newSupplyMeta } : null,
    premium: premium && premiumMeta ? { ...premium, meta: premiumMeta } : null,
    under: under && underMeta ? { ...under, meta: underMeta } : null,
    remain: remain && remainMeta ? { ...remain, meta: remainMeta } : null,
    jeonse: jeonse && jeonseMeta ? { ...jeonse, meta: jeonseMeta } : null,
    margin,
  };
}

type MarketDerived = ReturnType<typeof deriveMarket>;

/** 표 머리말: 지역 · 건수 · 제외 기준 · 조회일 */
function MetaLine({ meta }: { meta: TableMeta }) {
  return (
    <div className="rounded-md bg-accent-soft/50 px-3 py-2 text-xs text-muted">
      <div>
        지역 {meta.area} · 건수 {formatNumber(meta.count, 0)} · 조회일 {meta.asOf || "–"}
      </div>
      <ul className="mt-1 list-disc pl-4">
        {meta.exclusions.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>
    </div>
  );
}

/** 표 제목 + 머리말 + 내용 */
function MarketTable({ title, meta, children }: { title: string; meta: TableMeta; children: ReactNode }) {
  return (
    <div className="mt-2 flex flex-col gap-2">
      <div className="break-inside-avoid break-after-avoid">
        <h3 className="mb-2 font-semibold">{title}</h3>
        <MetaLine meta={meta} />
      </div>
      {children}
    </div>
  );
}

/** 표가 아직 준비되지 않았을 때 — 화면에는 진행 상태, 인쇄에는 "자료 없음" */
function Waiting({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-md border border-dashed border-line p-3 text-muted">
      <b className="text-foreground">{title}</b> — <span className="print:hidden">{text}</span>
      <span className="hidden print:inline">{MARKET_NO_DATA}</span>
    </div>
  );
}

/** 표를 기다리는 문구: 앞 단계가 실패했으면 다시 시도 안내 */
function waitingText(run: MarketRun, needs: "subscription" | "months" | "both", label: string): string {
  const failed = "조회하지 못함 — 위 오류에서 [다시 시도]";
  if (run.region.status === "error") return failed;
  if ((needs === "subscription" || needs === "both") && run.subscription?.status === "error") return failed;
  return `${label} 조회 중`;
}

/** 긴 표는 최근 n줄만 보여준다 */
const ROW_LIMIT = 15;

/** 조회 진행 · 실패 항목 (화면 전용, 인쇄 안 함) */
function MarketProgress({ run, view, onRetry }: { run: MarketRun; view: MarketDerived; onRetry: (t: RetryTarget) => void }) {
  const failures: { label: string; error: string; target: RetryTarget }[] = [];
  if (run.region.status === "error") failures.push({ label: "지역 확인", error: run.region.error, target: { kind: "region" } });
  if (run.subscription?.status === "error") failures.push({ label: "청약홈 공고 목록", error: run.subscription.error, target: { kind: "subscription" } });
  for (const ym of run.months) {
    const p = run.presale[ym];
    if (p?.status === "error") failures.push({ label: `분양권 ${ymText(ym)}`, error: p.error, target: { kind: "presale", ym } });
    const r = run.rent[ym];
    if (r?.status === "error") failures.push({ label: `전월세 ${ymText(ym)}`, error: r.error, target: { kind: "rent", ym } });
  }
  const sub = run.subscription?.status === "ok" ? run.subscription.data : null;
  for (const a of sub?.announcements ?? []) {
    const d = run.details[detailKey(a)];
    if (d?.status === "error") failures.push({ label: `청약홈 ${a.name}`, error: d.error, target: { kind: "detail", announcement: a } });
  }
  const p = view.progress;
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line p-3 text-xs print:hidden">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <span>
          지역 확인:{" "}
          {run.region.status === "pending" ? "확인 중…" : view.region ? `${view.region.name} (${view.region.code})` : "실패"}
        </span>
        <span>
          분양권 {p.presale}/{p.months}개월
        </span>
        <span>
          전월세 {p.rent}/{p.months}개월
        </span>
        <span>
          청약홈 {p.details}/{p.announcements ?? "?"}곳
        </span>
      </div>
      {failures.length > 0 && (
        <ul className="flex flex-col gap-1">
          {failures.map((f) => (
            <li key={f.label} className="flex flex-wrap items-center gap-2 text-bad">
              <span>
                {f.label}: {f.error}
              </span>
              <button type="button" className={`${buttonClass} py-0.5 text-xs text-foreground`} onClick={() => onRetry(f.target)}>
                다시 시도
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** 2장 시장 분석 본문 */
function MarketChapter({
  input,
  run,
  view,
  onRetry,
}: {
  input: PlanInput;
  run: MarketRun | null;
  view: MarketDerived | null;
  onRetry: (t: RetryTarget) => void;
}) {
  const area = areaName(input.sido, input.sigungu);
  if (run === null || view === null) {
    return (
      <>
        <p className="rounded-md border border-dashed border-line p-3 text-muted">{MARKET_NO_DATA}</p>
        <p className="text-xs text-muted print:hidden">
          {area === null
            ? "사업대상지(시도 · 시군구 전체 이름)를 입력한 뒤 [사업계획서 만들기]를 누르면 공공데이터를 조회합니다."
            : `[사업계획서 만들기]를 누르면 ${area} 기준으로 공공데이터를 조회합니다.`}
        </p>
      </>
    );
  }
  if (area !== run.area) {
    return (
      <p className="rounded-md border border-dashed border-line p-3 text-muted">
        {MARKET_NO_DATA} — 사업대상지가 바뀌었습니다({run.area} → {area ?? "미입력"}). [사업계획서 만들기]를 다시 누르세요.
      </p>
    );
  }
  const { newSupply, premium, under, remain, jeonse, margin } = view;
  return (
    <>
      <MarketProgress run={run} view={view} onRetry={onRetry} />

      {margin && margin.margin !== null && (
        <div className="rounded-lg border-2 border-foreground p-3">
          <p className="font-semibold">
            결론 — 시장 대비 여유 평당 <Val value={margin.margin} digits={0} />만원 (<Val value={margin.marginPct} />%)
          </p>
          <p className="text-xs text-muted">
            = 인근 신규 84㎡ 공급평당 중앙값 {formatNumber(margin.nearbyMedian, 0)}만원 − 상환 한계 평당가{" "}
            {formatNumber(margin.repayPrice, 0)}만원. 양수면 인근 신규 분양가가 상환 한계보다 그만큼 높다.
          </p>
        </div>
      )}

      {newSupply ? (
        <MarketTable title="① 인근 신규 84㎡ 공급평당 분양가 vs 계획가" meta={newSupply.meta}>
          {newSupply.rows.length === 0 ? (
            <p className="text-muted">{MARKET_NO_DATA} — 조건에 맞는 84㎡ 주택형이 없습니다.</p>
          ) : (
            <>
              <div className="flex flex-col gap-1.5 rounded-lg border border-line p-3">
                <Derived label="인근 공급평당 중앙값" value={newSupply.median} unit="만원" digits={0} formula="분양최고금액 ÷ (공급면적㎡ × 0.3025)의 중앙값" />
                <Derived label="계획 평당가" value={input.pricePerPyeong} unit="만원" digits={0} formula="입력값" />
                <Derived label="계획가 − 인근 중앙값" value={newSupply.planMinusMedian} unit="만원" digits={0} formula="계획 평당가 − 인근 중앙값" />
              </div>
              <MarketMarginChart
                rows={newSupply.rows}
                median={newSupply.median}
                planPrice={input.pricePerPyeong}
                repayPrice={margin?.repayPrice ?? null}
                meta={{
                  title: "시장 대비 여유 — 인근 신규 84㎡ 공급평당가 분포",
                  unit: "만원/평",
                  count: newSupply.rows.length,
                  asOf: newSupply.meta.asOf,
                  source: "청약홈 분양정보 (주택형별 분양최고금액)",
                  note: "회색 점 = 인근 신규 84㎡ 주택형 · 파란 선 = 계획가 · 빨간 선 = 상환 한계 평당가 · 초록 구간 = 상환 한계와 인근 중앙값 사이",
                }}
                table={
                  <>
                    <table className="w-full border-collapse text-xs sm:text-sm">
                      <thead>
                        <tr>
                          <th className={headCell}>단지 · 공고일</th>
                          <th className={headCell}>주택형</th>
                          <th className={`${headCell} text-right`}>공급(평)</th>
                          <th className={`${headCell} text-right`}>분양최고금액(만원)</th>
                          <th className={`${headCell} text-right`}>공급평당(만원)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {newSupply.rows.slice(0, ROW_LIMIT).map((r) => (
                          <tr key={`${r.name}-${r.houseTy}-${r.date}`}>
                            <td className={cell}>
                              {r.name}
                              <div className="text-xs text-muted">{r.date}</div>
                            </td>
                            <td className={cell}>{r.houseTy}</td>
                            <td className={numCell}>{formatNumber(r.supplyPyeong, 1, true)}</td>
                            <td className={numCell}>{formatNumber(r.topAmount, 0)}</td>
                            <td className={numCell}>{formatNumber(r.pricePerPyeong, 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {newSupply.rows.length > ROW_LIMIT && (
                      <p className="text-xs text-muted">최근 {ROW_LIMIT}개만 표시 · 전체 {newSupply.rows.length}개는 중앙값에 반영</p>
                    )}
                  </>
                }
              />
            </>
          )}
        </MarketTable>
      ) : (
        <Waiting title="① 인근 신규 84㎡ vs 계획가" text={waitingText(run, "subscription", "청약홈")} />
      )}

      {premium ? (
        <MarketTable title="② 분양권 웃돈 (입주권 제외)" meta={premium.meta}>
          {premium.rows.length === 0 ? (
            <p className="text-muted">{MARKET_NO_DATA} — 분양가와 맞출 수 있는 분양권 거래가 없습니다.</p>
          ) : (
            <>
              <Derived label="웃돈 중앙값" value={premium.medianPremium} unit="만원" digits={0} formula="거래금액 − 분양가(분양최고금액)의 중앙값" />
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr>
                      <th className={headCell}>단지 · 계약일</th>
                      <th className={`${headCell} text-right`}>전용(㎡)</th>
                      <th className={`${headCell} text-right`}>거래금액</th>
                      <th className={`${headCell} text-right`}>분양가</th>
                      <th className={`${headCell} text-right`}>웃돈(만원)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {premium.rows.slice(0, ROW_LIMIT).map((r, i) => (
                      <tr key={`${r.aptNm}-${r.date}-${i}`}>
                        <td className={cell}>
                          {r.aptNm}
                          <div className="text-xs text-muted">{r.date}</div>
                        </td>
                        <td className={numCell}>{formatNumber(r.exclusiveM2, 2)}</td>
                        <td className={numCell}>{formatNumber(r.amount, 0)}</td>
                        <td className={numCell}>{formatNumber(r.salePrice, 0)}</td>
                        <td className={numCell}>
                          <Val value={r.premium} digits={0} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {premium.rows.length > ROW_LIMIT && <p className="text-xs text-muted">최근 {ROW_LIMIT}건만 표시 · 전체 {premium.rows.length}건은 중앙값에 반영</p>}
              </div>
            </>
          )}
        </MarketTable>
      ) : (
        <Waiting title="② 분양권 웃돈" text={waitingText(run, "both", "분양권 · 청약홈")} />
      )}

      {under ? (
        <MarketTable title="③ 1 · 2순위 미달" meta={under.meta}>
          {under.rows.length === 0 ? (
            <p className="text-muted">{MARKET_NO_DATA} — 경쟁률 자료가 있는 공고가 없습니다.</p>
          ) : (
            <>
              <p>
                미달 단지 {formatNumber(under.shortComplexes, 0)}곳 / {formatNumber(under.rows.length, 0)}곳 · 미달 세대{" "}
                {formatNumber(under.totalShortUnits, 0)}세대
                <F>Σ max(0, 일반공급 − 1순위 접수 − 2순위 접수)</F>
              </p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr>
                      <th className={headCell}>단지 · 공고일</th>
                      <th className={`${headCell} text-right`}>주택형</th>
                      <th className={`${headCell} text-right`}>미달 주택형</th>
                      <th className={`${headCell} text-right`}>미달 세대</th>
                    </tr>
                  </thead>
                  <tbody>
                    {under.rows.slice(0, ROW_LIMIT).map((r) => (
                      <tr key={`${r.name}-${r.date}`}>
                        <td className={cell}>
                          {r.name}
                          <div className="text-xs text-muted">{r.date}</div>
                        </td>
                        <td className={numCell}>{r.types}</td>
                        <td className={`${numCell} ${r.shortTypes > 0 ? "text-bad" : ""}`}>{r.shortTypes}</td>
                        <td className={numCell}>{formatNumber(r.shortUnits, 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </MarketTable>
      ) : (
        <Waiting title="③ 1 · 2순위 미달" text={waitingText(run, "subscription", "청약홈")} />
      )}

      {remain ? (
        <MarketTable title="④ 잔여세대" meta={remain.meta}>
          {remain.rows.length === 0 ? (
            <p className="text-muted">{MARKET_NO_DATA} — 잔여세대 공고가 없습니다.</p>
          ) : (
            <>
              <p>
                잔여세대 공고 {formatNumber(remain.rows.length, 0)}건 · 공급규모 합계 {formatNumber(remain.totalUnits, 0)}세대
                <F>Σ 공고별 공급규모</F>
              </p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr>
                      <th className={headCell}>단지 · 공고일</th>
                      <th className={headCell}>구분</th>
                      <th className={`${headCell} text-right`}>세대</th>
                    </tr>
                  </thead>
                  <tbody>
                    {remain.rows.slice(0, ROW_LIMIT).map((r) => (
                      <tr key={`${r.id}-${r.pblanc}`}>
                        <td className={cell}>
                          {r.name}
                          <div className="text-xs text-muted">{r.date}</div>
                        </td>
                        <td className={cell}>{r.kind || "–"}</td>
                        <td className={numCell}>{formatNumber(r.units, 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </MarketTable>
      ) : (
        <Waiting title="④ 잔여세대" text={waitingText(run, "subscription", "청약홈")} />
      )}

      {jeonse ? (
        <MarketTable title="⑤ 84㎡ 신규 전세 ÷ 우리 84㎡ 세대당 분양가" meta={jeonse.meta}>
          <div className="flex flex-col gap-1.5 rounded-lg border border-line p-3">
            <Derived label="84㎡ 신규 전세 보증금 중앙값" value={jeonse.medianDeposit} unit="만원" digits={0} formula="신규 전세 보증금의 중앙값" />
            <Derived label="우리 84㎡ 세대당 분양가" value={jeonse.ourPrice} unit="만원" digits={0} formula="84㎡ 주택형 공급평 × 계획 평당가 (여럿이면 세대수 가중평균)" />
            <Derived
              label="전세 ÷ 분양가"
              value={jeonse.ratio === null ? null : jeonse.ratio * 100}
              unit="%"
              digits={1}
              formula="전세 중앙값 ÷ 우리 84㎡ 세대당 분양가"
            />
          </div>
          {jeonse.ourPrice === null && <p className="text-xs text-muted">우리 주택형에 전용 84㎡(84.00~84.99㎡)가 없거나 평당가가 비어 비율을 계산할 수 없습니다.</p>}
        </MarketTable>
      ) : (
        <Waiting title="⑤ 84㎡ 신규 전세 ÷ 분양가" text={waitingText(run, "months", "전월세")} />
      )}
    </>
  );
}

/** 사업계획서의 장 */
function Chapter({ no, title, children }: { no: number; title: string; children: ReactNode }) {
  return (
    <section className="mt-8 first:mt-0">
      <h2 className="mb-3 border-b-2 border-foreground pb-1 text-lg font-bold break-after-avoid">
        {no}. {title}
      </h2>
      <div className="flex flex-col gap-3 text-sm">{children}</div>
    </section>
  );
}

/** 입력이 비어 있을 때 장 대신 보여주는 안내 */
function NoData({ input, need }: { input: PlanInput; need: Requirement }) {
  const missing = missingInputs(input, need);
  return (
    <p className="rounded-md border border-dashed border-line p-3 text-muted">
      자료 없음{missing.length > 0 && ` — 필요한 입력: ${missing.join(", ")}`}
    </p>
  );
}

/** 한계선 값을 문장용 텍스트로 (예: "80.6%", "1,934만원", "도달 불가") */
function thresholdText(t: Threshold, kind: "rate" | "price"): string {
  const v = thresholdView(t, kind === "rate" ? 100 : 1);
  if (v.text) return v.text;
  return kind === "rate" ? `${formatNumber(v.value, 1, true)}%` : `${formatNumber(v.value, 0)}만원`;
}

/** 사업계획서 본문 */
function Report({
  input,
  run,
  onRetry,
}: {
  input: PlanInput;
  run: MarketRun | null;
  onRetry: (t: RetryTarget) => void;
}) {
  const view = run ? deriveMarket(run, input) : null;
  const housing = summarizeHousing(input.housingTypes);
  const breakdown = cashBreakdown(input);
  const waterfall = cashWaterfall(input);
  const debtReady = missingInputs(input, "debt").length === 0 && dscr(input, 1) !== null;
  const table = sensitivityTable(input);
  const risk = riskMetrics(input);
  const ltvValue = ltv(input);
  const t = {
    rateZero: salesRateThreshold(input, "zero"),
    priceZero: priceThreshold(input, "zero"),
    rateRepay: salesRateThreshold(input, "repay"),
    priceRepay: priceThreshold(input, "repay"),
  };
  const site = [input.sido.trim(), input.sigungu.trim()].filter(Boolean).join(" ");

  return (
    <article className="rounded-xl border border-line bg-card p-5 [print-color-adjust:exact] sm:p-8 print:rounded-none print:border-0 print:p-0">
      <header className="mb-8 border-b-4 border-foreground pb-4 text-center">
        <p className="text-sm text-muted">대주단 제출용</p>
        <h1 className="mt-1 text-2xl font-bold">{input.projectName.trim() || "사업명 자료 없음"}</h1>
        <p className="mt-1 text-lg font-semibold tracking-[0.3em]">사업계획서</p>
        <p className="mt-2 text-sm text-muted">{site || "사업대상지 자료 없음"}</p>
      </header>

      <Chapter no={1} title="사업 개요">
        <table className="w-full border-collapse">
          <tbody>
            <tr>
              <th className={`${headCell} w-32`}>사업명</th>
              <td className={cell}>{input.projectName.trim() || "자료 없음"}</td>
            </tr>
            <tr>
              <th className={headCell}>사업대상지</th>
              <td className={cell}>{site || "자료 없음"}</td>
            </tr>
            <tr>
              <th className={headCell}>계획 평당가</th>
              <td className={cell}>
                {input.pricePerPyeong === null ? "자료 없음" : `${formatNumber(input.pricePerPyeong, 0)}만원/평 (공급기준)`}
              </td>
            </tr>
          </tbody>
        </table>
        {housing.completeRows === 0 ? (
          <NoData input={input} need="cash" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={headCell}>주택형</th>
                  <th className={`${headCell} text-right`}>전용(㎡)</th>
                  <th className={`${headCell} text-right`}>공급(평)</th>
                  <th className={`${headCell} text-right`}>세대수</th>
                  <th className={`${headCell} text-right`}>공급면적(평)</th>
                </tr>
              </thead>
              <tbody>
                {input.housingTypes.map((h) => (
                  <tr key={h.id}>
                    <td className={cell}>{h.name || "–"}</td>
                    <td className={numCell}>{formatNumber(h.exclusiveM2, 1)}</td>
                    <td className={numCell}>{formatNumber(h.supplyPyeong, 1)}</td>
                    <td className={numCell}>{formatNumber(h.units, 0)}</td>
                    <td className={numCell}>{formatNumber(rowSupplyPyeong(h), 1, true)}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className={cell} colSpan={3}>
                    합계
                  </td>
                  <td className={numCell}>{formatNumber(housing.totalUnits, 0)}</td>
                  <td className={numCell}>{formatNumber(housing.totalSupplyPyeong, 1, true)}</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-1 text-xs text-muted">
              공급면적 = {FORMULAS.totalSupplyPyeong} · 세대수 = {FORMULAS.totalUnits}
            </p>
          </div>
        )}
      </Chapter>

      <Chapter no={2} title="시장 분석 · 분양가 근거">
        {/* 실습 7: app/api/market/route.ts가 사업대상지 기준 공공데이터를 돌려주면 여기에 표로 나온다 */}
        <MarketChapter input={input} run={run} view={view} onRetry={onRetry} />
      </Chapter>

      <Chapter no={3} title="사업수지">
        {breakdown === null ? (
          <NoData input={input} need="cash" />
        ) : (
          <>
            <p className="text-xs text-muted">분양률 100% · 계획 평당가 기준, 단위 억원</p>
            {waterfall && (
              <CashWaterfallChart
                steps={waterfall.steps}
                min={waterfall.min}
                max={waterfall.max}
                meta={{
                  title: "사업수지 폭포 — 분양수입에서 기말현금까지",
                  unit: "억원",
                  count: waterfall.steps.length,
                  source: "입력값 (분양률 100% · 계획 평당가)",
                  note: "파랑 = 분양수입 · 기타유입 · 회색 = 차감 · 초록/빨강 = 기말현금",
                }}
                table={
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className={headCell}>단계</th>
                        <th className={`${headCell} text-right`}>금액(억원)</th>
                        <th className={`${headCell} text-right`}>누적(억원)</th>
                        <th className={headCell}>계산식</th>
                      </tr>
                    </thead>
                    <tbody>
                      {waterfall.steps.map((s) => (
                        <tr key={s.label}>
                          <td className={cell}>{s.label}</td>
                          <td className={numCell}>
                            <Eok value={s.amount} />
                          </td>
                          <td className={numCell}>
                            <Eok value={s.to} />
                          </td>
                          <td className={`${cell} text-xs text-muted`}>{s.formula}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                }
              />
            )}
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={headCell}>항목</th>
                  <th className={`${headCell} text-right`}>금액(억원)</th>
                  <th className={headCell}>계산식</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={cell}>분양수입</td>
                  <td className={numCell}>
                    <Eok value={breakdown.salesRevenue} />
                  </td>
                  <td className={`${cell} text-xs text-muted`}>{FORMULAS.salesRevenue}</td>
                </tr>
                {breakdown.lines.map((l) => (
                  <tr key={l.label}>
                    <td className={cell}>{l.label}</td>
                    <td className={numCell}>
                      <Eok value={l.amount} />
                    </td>
                    <td className={`${cell} text-xs text-muted`}>{l.formula}</td>
                  </tr>
                ))}
                <tr className="font-bold">
                  <td className={cell}>기말현금</td>
                  <td className={numCell}>
                    <Eok value={breakdown.endingCash} />
                  </td>
                  <td className={`${cell} text-xs font-normal text-muted`}>{FORMULAS.endingCash}</td>
                </tr>
              </tbody>
            </table>
          </>
        )}
      </Chapter>

      <Chapter no={4} title="자금조달과 상환">
        {!debtReady ? (
          <NoData input={input} need="debt" />
        ) : (
          <>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={headCell}>조달</th>
                  <th className={`${headCell} text-right`}>금액(억원)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={cell}>본PF</td>
                  <td className={numCell}>
                    <Eok value={input.seniorPf} />
                  </td>
                </tr>
                <tr>
                  <td className={cell}>본PF 금융비용</td>
                  <td className={numCell}>
                    <Eok value={input.seniorPfFinanceCost} />
                  </td>
                </tr>
                <tr>
                  <td className={cell}>후순위</td>
                  <td className={numCell}>
                    <Eok value={input.subordinated} />
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="flex flex-col gap-2 rounded-lg border border-line p-3">
              <Derived label="만기 누적 DSCR" value={dscr(input, 1)} unit="배" formula={FORMULAS.dscr} />
              <Derived
                label="LTV"
                value={ltvValue === null ? null : ltvValue * 100}
                unit="%"
                digits={1}
                formula={FORMULAS.ltv}
              />
            </div>
            <p>
              상환 기준: 기말현금이 −후순위 이상(DSCR 1.0 이상)이면 본PF와 금융비용을 상환할 수 있다. 기말현금이 0보다
              작아지면 후순위 원금부터 손실이 난다.
            </p>
            <div className="flex flex-col gap-2 rounded-lg border border-line p-3">
              <Derived label="기말현금 0 — 분양률" unit="%" digits={1} formula={FORMULAS.breakEven} {...thresholdView(t.rateZero, 100)} />
              <Derived label="기말현금 0 — 평당가" unit="만원" digits={0} formula={FORMULAS.breakEven} {...thresholdView(t.priceZero, 1)} />
              <Derived label="상환 한계 — 분양률" unit="%" digits={1} formula={FORMULAS.repayLimit} {...thresholdView(t.rateRepay, 100)} />
              <Derived label="상환 한계 — 평당가" unit="만원" digits={0} formula={FORMULAS.repayLimit} {...thresholdView(t.priceRepay, 1)} />
            </div>
            <p className="text-xs text-muted">분양률 한계선은 계획 평당가, 평당가 한계선은 분양률 100% 기준.</p>
          </>
        )}
      </Chapter>

      <Chapter no={5} title="민감도">
        {table === null ? (
          <NoData input={input} need="debt" />
        ) : (
          <>
            <p className="text-xs text-muted">
              칸 = {FORMULAS.sensitivityCell} = {FORMULAS.endingCash}, 단위 억원.
            </p>
            <p className="text-xs text-muted">
              <span className="rounded bg-good/15 px-1 text-good">초록</span> 상환 가능 ·{" "}
              <span className="rounded bg-bad/15 px-1 text-bad">빨강</span> 상환 불가 (기준: 기말현금 ≥ −후순위)
            </p>
            <div className="overflow-x-auto break-inside-avoid">
              <table className="w-full border-collapse text-xs sm:text-sm">
                <thead>
                  <tr>
                    <th className={headCell}>분양률 \ 평당가</th>
                    {table[0].map((c) => (
                      <th key={c.offset} className={`${headCell} text-right whitespace-nowrap`}>
                        {formatNumber(c.price, 0)}
                        <div className="text-[10px] font-normal text-muted">
                          {c.offset === 0 ? "계획" : `${c.offset > 0 ? "+" : ""}${c.offset}`}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.map((row) => (
                    <tr key={row[0].rate}>
                      <th className={`${headCell} whitespace-nowrap`}>{formatNumber(row[0].rate * 100, 0)}%</th>
                      {row.map((c) => (
                        <td
                          key={c.offset}
                          className={`${numCell} ${c.repayable ? "bg-good/15" : "bg-bad/15"} ${
                            c.rate === 1 && c.offset === 0 ? "font-bold" : ""
                          }`}
                          title={c.repayable ? "상환 가능" : "상환 불가"}
                        >
                          <Eok value={c.endingCash} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="rounded-md bg-accent-soft px-3 py-2 font-semibold">
              {repaySentence(input)}
              {view?.margin && view.margin.margin !== null && (
                <span className="block text-sm font-normal">
                  시장 대비 여유 평당 <Val value={view.margin.margin} digits={0} />만원
                  <F>인근 신규 84㎡ 공급평당 중앙값 {formatNumber(view.margin.nearbyMedian, 0)} − 상환 한계 {formatNumber(view.margin.repayPrice, 0)}</F>
                </span>
              )}
            </p>
            <p className="text-xs text-muted">
              평당가는 분양률 100%, 분양률은 계획 평당가 기준의 상환 한계({thresholdText(t.priceRepay, "price")} ·{" "}
              {thresholdText(t.rateRepay, "rate")})를 &quot;이상이면 상환 가능&quot;이 성립하도록 올림한 값이다.
            </p>
          </>
        )}
      </Chapter>

      <Chapter no={6} title="리스크와 완화 방안">
        {!debtReady ? (
          <NoData input={input} need="debt" />
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={`${headCell} w-1/2`}>리스크</th>
                <th className={headCell}>완화 방안</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={cell}>
                  <b>분양률 하락</b> — 계획 평당가에서 분양률이 {thresholdText(t.rateRepay, "rate")} 아래로 내려가면 본PF 상환
                  불가. 100% 대비 여유 <Val value={risk.salesRateMarginPt} />%p
                  <F>{FORMULAS.salesRateMargin}</F>.
                </td>
                <td className={cell}>상환 한계 분양률({thresholdText(t.rateRepay, "rate")})을 분양 점검 기준으로 두고, 그 근처에서 대주단과 대응을 협의한다.</td>
              </tr>
              <tr>
                <td className={cell}>
                  <b>분양가 하락</b> — 분양률 100%라도 평당가가 {thresholdText(t.priceRepay, "price")} 아래면 상환 불가. 계획 대비
                  여유 평당 <Val value={risk.priceMargin} digits={0} />만원
                  <F>{FORMULAS.priceMargin}</F>, 여유율 <Val value={risk.priceMarginPct} />%
                  <F>{FORMULAS.priceMarginPct}</F>.
                </td>
                <td className={cell}>
                  {isNegative(risk.priceMargin)
                    ? "계획 평당가가 이미 상환 한계 아래다. 분양가 또는 사업구조 재검토가 필요하다."
                    : `할인분양은 평당 ${formatNumber(risk.priceMargin, 0)}만원 여유 안에서만 검토한다(분양률 100% 가정).`}
                </td>
              </tr>
              <tr>
                <td className={cell}>
                  <b>비용 증가</b> — 고정비가 <Eok value={risk.costCushion} />억원
                  <F>{FORMULAS.costCushion}</F> 넘게 늘면 DSCR이 1 아래로 내려간다.
                </td>
                <td className={cell}>이 범위를 넘는 비용 증가는 대주단 사전 협의 대상으로 둔다.</td>
              </tr>
              <tr>
                <td className={cell}>
                  <b>후순위 손실</b> — 분양률 {thresholdText(t.rateZero, "rate")} 또는 평당가 {thresholdText(t.priceZero, "price")}{" "}
                  아래에서는 기말현금이 음수가 되어 후순위 원금 손실이 시작된다.
                </td>
                <td className={cell}>후순위 대주에게 손실이 시작되는 구간을 명시한다.</td>
              </tr>
            </tbody>
          </table>
        )}
      </Chapter>

      <Chapter no={7} title="확인하지 못한 것">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>월별 자금수지 · IRR은 이 앱의 범위 밖</b>이다. 이 계획서는 만기 시점의 누적 현금만 본다.
          </li>
          <li>
            시장 분석(2장)은 [사업계획서 만들기] 시점의 공공데이터다. 분양가는 주택형별 분양최고금액이라 층 · 향 할인은
            반영하지 않는다.
          </li>
          <li>분양권 거래와 청약 공고는 단지명 · 전용면적으로 맞춘 것이라 이름이 다른 단지는 빠질 수 있다.</li>
          <li>전월세 자료에는 해제여부 항목이 없어 해제된 계약이 섞여 있을 수 있다.</li>
          <li>평당가 · 고정비 · 대출 조건 등 입력값의 근거 자료는 이 앱에서 검증하지 않는다.</li>
          <li>전용면적은 표시만 하며 계산에는 쓰지 않는다.</li>
        </ul>
      </Chapter>
    </article>
  );
}

/** 우리 서버 API를 부르고 JSON을 돌려준다. 실패하면 서버가 준 오류 문구로 예외 */
async function fetchJson<T>(path: string, params: Record<string, string>): Promise<T> {
  const res = await fetch(`${path}?${new URLSearchParams(params)}`);
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new Error(`응답 형식 오류 (HTTP ${res.status})`);
  }
  if (!res.ok) {
    const msg = (body as { error?: unknown })?.error;
    throw new Error(typeof msg === "string" ? msg : `HTTP ${res.status}`);
  }
  return body as T;
}

/**
 * [사업계획서 만들기] 조회 흐름.
 * 1. 지역 확인(/api/region) — 브라우저는 이름만 보내고 코드는 서버가 확인한다.
 * 2. 분양권 · 전월세 12개월, 청약홈 공고 목록 → 공고별 상세를 동시에 최대 4개씩 호출한다.
 * 결과는 도착하는 대로 상태에 넣고, 실패한 호출은 retry로 다시 부른다.
 * 새로 시작하면 이전 조회의 결과는 버린다(id로 구분).
 */
function useMarketRun() {
  const [run, setRun] = useState<MarketRun | null>(null);
  const queueRef = useRef<Queue | null>(null);
  const runIdRef = useRef(0);

  /** 대기열 (처음 쓸 때 만든다) */
  const queue = () => (queueRef.current ??= createQueue(4));

  /** 현재 조회(id)일 때만 상태를 바꾼다 */
  const update = (id: number, fn: (r: MarketRun) => MarketRun) =>
    setRun((prev) => (prev && prev.id === id ? fn(prev) : prev));

  /** 대기열에 호출을 넣고, 끝나면 done으로 결과를 넘긴다 (취소된 호출은 무시) */
  function schedule<T>(id: number, job: () => Promise<T>, done: (t: Task<T>) => void) {
    queue()
      .add(job)
      .then(
        (data) => {
          if (runIdRef.current === id) done({ status: "ok", data });
        },
        (e: unknown) => {
          const msg = e instanceof Error ? e.message : "알 수 없는 오류";
          if (runIdRef.current === id && msg !== CANCELLED) done({ status: "error", error: msg });
        },
      );
  }

  /** 청약홈 공고 하나의 주택형별 분양가 · 경쟁률 */
  function loadDetail(id: number, area: string, a: Announcement) {
    const key = detailKey(a);
    update(id, (r) => ({ ...r, details: { ...r.details, [key]: { status: "pending" } } }));
    schedule(
      id,
      () => fetchJson<DetailResponse>("/api/market/subscription/detail", { area, id: a.id, pblanc: a.pblanc }),
      (t) => update(id, (r) => ({ ...r, details: { ...r.details, [key]: t } })),
    );
  }

  /** 청약홈 공고 목록 → 끝나면 공고별 상세를 대기열에 넣는다 */
  function loadSubscription(id: number, area: string) {
    update(id, (r) => ({ ...r, subscription: { status: "pending" } }));
    schedule(
      id,
      () => fetchJson<SubscriptionResponse>("/api/market/subscription", { area }),
      (t) => {
        update(id, (r) => ({ ...r, subscription: t }));
        if (t.status === "ok") for (const a of t.data.announcements) loadDetail(id, area, a);
      },
    );
  }

  /** 분양권 또는 전월세 한 달치 */
  function loadMonth(id: number, area: string, kind: "presale" | "rent", ym: string) {
    update(id, (r) => ({ ...r, [kind]: { ...r[kind], [ym]: { status: "pending" } } }));
    schedule(
      id,
      () => fetchJson<PresaleResponse | RentResponse>(`/api/market/${kind}`, { area, ym }),
      (t) => update(id, (r) => ({ ...r, [kind]: { ...r[kind], [ym]: t } })),
    );
  }

  /** 지역 확인 → 성공하면 나머지 호출을 모두 대기열에 넣는다 */
  function loadRegion(id: number, area: string, months: string[]) {
    update(id, (r) => ({ ...r, region: { status: "pending" } }));
    schedule(
      id,
      () => fetchJson<RegionResponse>("/api/region", { q: area }),
      (t) => {
        const result: Task<RegionResponse> =
          t.status === "ok" && t.data.region === null ? { status: "error", error: t.data.reason ?? "지역을 확인하지 못했습니다" } : t;
        update(id, (r) => ({ ...r, region: result }));
        if (result.status !== "ok") return;
        loadSubscription(id, area);
        for (const ym of [...months].reverse()) {
          loadMonth(id, area, "presale", ym);
          loadMonth(id, area, "rent", ym);
        }
      },
    );
  }

  /** 새 조회를 시작한다 (이전 조회의 대기 중 호출은 취소) */
  function start(area: string) {
    const id = ++runIdRef.current;
    queue().clear();
    const months = recentMonths(new Date());
    setRun({ id, area, months, region: { status: "pending" }, presale: {}, rent: {}, subscription: null, details: {} });
    loadRegion(id, area, months);
  }

  /** 실패한 호출 하나를 다시 부른다 */
  function retry(target: RetryTarget) {
    if (!run) return;
    const { id, area } = run;
    if (target.kind === "region") loadRegion(id, area, run.months);
    else if (target.kind === "subscription") loadSubscription(id, area);
    else if (target.kind === "detail") loadDetail(id, area, target.announcement);
    else loadMonth(id, area, target.kind, target.ym);
  }

  return { run, start, retry };
}


/** 입력 · 결과 화면 */
export default function PlanApp() {
  const [input, setInput] = useState<PlanInput>(emptyInput);
  // 임시 값 적용 · 초기화 때 입력칸 내부 상태를 새로 만들기 위한 키
  const [formKey, setFormKey] = useState(0);

  /** 입력값 일부를 바꾼다 */
  const patch = (p: Partial<PlanInput>) => setInput((prev) => ({ ...prev, ...p }));

  /** 주택형 행 하나를 바꾼다 */
  const patchRow = (id: string, p: Partial<HousingType>) =>
    setInput((prev) => ({
      ...prev,
      housingTypes: prev.housingTypes.map((r) => (r.id === id ? { ...r, ...p } : r)),
    }));

  const housing = summarizeHousing(input.housingTypes);
  const market = useMarketRun();
  const area = areaName(input.sido, input.sigungu);

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-line bg-card print:hidden">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <h1 className="text-base font-bold">대주단 제출용 사업계획서</h1>
          <div className="ml-auto flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                className={buttonClass}
                disabled={p.values === null}
                title={p.values === null ? "lib/presets.ts에 앞 장 표의 값이 아직 없습니다" : `${p.label}으로 채우기`}
                onClick={() => {
                  if (p.values === null) return;
                  setInput(applyPreset(p.values, newId));
                  setFormKey((k) => k + 1);
                }}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              className={`${buttonClass} border-accent bg-accent text-white hover:bg-accent/90`}
              disabled={area === null}
              title={area === null ? "사업대상지(시도 · 시군구 전체 이름)를 입력하세요" : `${area} 기준으로 공공데이터를 조회합니다`}
              onClick={() => area && market.start(area)}
            >
              사업계획서 만들기
            </button>
            <button type="button" className={buttonClass} onClick={() => window.print()}>
              인쇄 · PDF
            </button>
            <button
              type="button"
              className={buttonClass}
              onClick={() => {
                if (!confirm("입력한 값을 모두 지울까요?")) return;
                setInput(emptyInput());
                setFormKey((k) => k + 1);
              }}
            >
              비우기
            </button>
          </div>
        </div>
      </header>

      <main key={formKey} className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 print:hidden">
        <Section title="사업 개요">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <TextInput label="사업명" value={input.projectName} onChange={(projectName) => patch({ projectName })} />
            </div>
            <TextInput
              label="사업대상지 — 시도 (전체 이름)"
              value={input.sido}
              placeholder="예: 서울특별시"
              onChange={(sido) => patch({ sido })}
              warning={isFullSidoName(input.sido) ? null : "약칭 말고 전체 이름으로 입력하세요 (예: 서울 → 서울특별시)"}
            />
            <TextInput
              label="사업대상지 — 시군구 (전체 이름)"
              value={input.sigungu}
              placeholder="예: 수원시 영통구"
              onChange={(sigungu) => patch({ sigungu })}
              warning={isFullSigunguName(input.sigungu) ? null : "시·군·구까지 전체 이름으로 입력하세요"}
            />
          </div>
        </Section>

        <Section
          title="주택형"
          aside={
            <button
              type="button"
              className={buttonClass}
              onClick={() => patch({ housingTypes: [...input.housingTypes, emptyHousingType(newId())] })}
            >
              + 주택형 추가
            </button>
          }
        >
          {input.housingTypes.length === 0 ? (
            <p className="rounded-md border border-dashed border-line p-4 text-center text-sm text-muted">
              자료 없음 — 주택형을 추가하세요
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="hidden grid-cols-[1.4fr_1fr_1fr_1fr_auto] gap-2 px-1 text-xs text-muted sm:grid">
                <span>이름</span>
                <span>전용면적</span>
                <span>세대당 공급면적</span>
                <span>세대수</span>
                <span className="w-12" />
              </div>
              {input.housingTypes.map((row, i) => (
                <div
                  key={row.id}
                  className="grid grid-cols-2 gap-2 rounded-lg border border-line p-3 sm:grid-cols-[1.4fr_1fr_1fr_1fr_auto] sm:items-start sm:border-0 sm:p-0"
                >
                  <div className="col-span-2 sm:col-span-1">
                    <TextInput
                      hideLabel
                      label={`주택형 ${i + 1} 이름`}
                      value={row.name}
                      placeholder="예: 84A"
                      onChange={(name) => patchRow(row.id, { name })}
                    />
                  </div>
                  <NumInput
                    hideLabel
                    label="전용면적"
                    unit="㎡"
                    value={row.exclusiveM2}
                    onChange={(exclusiveM2) => patchRow(row.id, { exclusiveM2 })}
                  />
                  <NumInput
                    hideLabel
                    label="세대당 공급면적"
                    unit="평"
                    value={row.supplyPyeong}
                    onChange={(supplyPyeong) => patchRow(row.id, { supplyPyeong })}
                  />
                  <NumInput
                    hideLabel
                    integer
                    label="세대수"
                    unit="세대"
                    value={row.units}
                    onChange={(units) => patchRow(row.id, { units })}
                  />
                  <button
                    type="button"
                    aria-label={`주택형 ${i + 1} 삭제`}
                    className="self-end rounded-md border border-line px-2.5 py-1.5 text-sm text-bad hover:bg-accent-soft sm:self-start sm:w-12"
                    onClick={() => patch({ housingTypes: input.housingTypes.filter((r) => r.id !== row.id) })}
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-col gap-1.5 border-t border-line pt-3">
            <Derived label="공급면적 합계" value={housing.totalSupplyPyeong} unit="평" formula={FORMULAS.totalSupplyPyeong} />
            <Derived label="세대수 합계" value={housing.totalUnits} unit="세대" digits={0} formula={FORMULAS.totalUnits} />
            {housing.incompleteRows > 0 && (
              <p className="text-xs text-bad">
                공급면적이나 세대수가 빈 주택형 {housing.incompleteRows}개는 합계에서 빠졌습니다.
              </p>
            )}
          </div>
        </Section>

        <Section title="분양가 · 수입">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <NumInput
              label="평당가 (공급기준)"
              unit="만원/평"
              value={input.pricePerPyeong}
              onChange={(pricePerPyeong) => patch({ pricePerPyeong })}
            />
            <NumInput label="상가" unit="억원" value={input.retail} onChange={(retail) => patch({ retail })} />
            <NumInput
              label="기타유입"
              unit="억원"
              value={input.otherInflow}
              onChange={(otherInflow) => patch({ otherInflow })}
            />
          </div>
        </Section>

        <Section title="비용 · 자금조달">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <NumInput label="고정비" unit="억원" value={input.fixedCost} onChange={(fixedCost) => patch({ fixedCost })} />
            <NumInput label="본PF" unit="억원" value={input.seniorPf} onChange={(seniorPf) => patch({ seniorPf })} />
            <NumInput
              label="본PF 금융비용"
              unit="억원"
              value={input.seniorPfFinanceCost}
              onChange={(seniorPfFinanceCost) => patch({ seniorPfFinanceCost })}
            />
            <NumInput
              label="후순위"
              unit="억원"
              value={input.subordinated}
              onChange={(subordinated) => patch({ subordinated })}
            />
          </div>
        </Section>

      </main>

      <div className="mx-auto w-full max-w-3xl px-4 pb-10 print:max-w-none print:p-0">
        <Report input={input} run={market.run} onRetry={market.retry} />
      </div>
    </div>
  );
}
