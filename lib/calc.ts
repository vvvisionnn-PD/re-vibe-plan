/**
 * 사업계획서 계산 — 순수 함수만 둔다. (React · Next · 브라우저 API 의존 금지)
 *
 * 단위 규칙
 * - 금액: 억원
 * - 평당가: 만원/평 (공급면적 기준)
 * - 면적: 전용은 ㎡, 공급은 평
 *
 * 빈 칸은 0이 아니라 null로 둔다. null이 섞인 지표는 "자료 없음"으로 표시한다.
 */

/** 입력 숫자. 비어 있으면 null */
export type Num = number | null;

/** 주택형 표의 한 행 */
export interface HousingType {
  /** 행 식별자 (화면에서 추가·삭제용) */
  id: string;
  /** 주택형 이름 (예: 84A) */
  name: string;
  /** 전용면적 (㎡) */
  exclusiveM2: Num;
  /** 세대당 공급면적 (평) */
  supplyPyeong: Num;
  /** 세대수 */
  units: Num;
}

/** 사업계획서 입력값 전체 */
export interface PlanInput {
  /** 사업명 */
  projectName: string;
  /** 사업대상지 시도 — 전체 이름 (예: 서울특별시) */
  sido: string;
  /** 사업대상지 시군구 — 전체 이름 (예: 수원시 영통구) */
  sigungu: string;
  /** 주택형 표 */
  housingTypes: HousingType[];
  /** 평당 분양가 (만원/평, 공급기준) */
  pricePerPyeong: Num;
  /** 상가 분양수입 (억원) */
  retail: Num;
  /** 기타유입 (억원) */
  otherInflow: Num;
  /** 고정비 (억원) */
  fixedCost: Num;
  /** 본PF 대출 (억원) */
  seniorPf: Num;
  /** 본PF 금융비용 (억원) */
  seniorPfFinanceCost: Num;
  /** 후순위 대출 (억원) */
  subordinated: Num;
}

/** 화면에 지표와 함께 보여줄 계산식 */
export const FORMULAS = {
  totalSupplyPyeong: "Σ(세대당 공급평 × 세대수)",
  totalUnits: "Σ 세대수",
  salesRevenue: "(공급면적 × 평당가 ÷ 10,000 + 상가) × 분양률",
  endingCash: "분양수입 × 0.992 − 세대수 × 분양률 × 0.03 + 기타유입 − 고정비",
  dscr: "1 + (기말현금 + 후순위) ÷ (본PF + 본PF 금융비용)",
  ltv: "본PF ÷ 분양수입(분양률 100%)",
  breakEven: "기말현금 = 0 이 되는 값 (이분법)",
  repayLimit: "기말현금 = −후순위 (DSCR 1.0) 이 되는 값 (이분법)",
  sensitivityCell: "기말현금 (분양률 · 평당가만 바꿔 다시 계산)",
  salesRateMargin: "100% − 상환 한계 분양률",
  priceMargin: "계획 평당가 − 상환 한계 평당가",
  priceMarginPct: "평당가 여유 ÷ 계획 평당가",
  costCushion: "기말현금 + 후순위",
} as const;

/** 분양수입 중 기말현금으로 남는 비율 (분양수입 × 0.992) */
export const SALES_CASH_RATIO = 0.992;
/** 분양 세대당 차감 비용 (억원/세대) */
export const COST_PER_SOLD_UNIT = 0.03;
/** 평당가(만원) × 평 → 억원 환산 나눗수 */
export const MAN_PER_EOK = 10_000;

/** 빈 주택형 행을 만든다. id는 호출하는 쪽에서 넘긴다. */
export function emptyHousingType(id: string): HousingType {
  return { id, name: "", exclusiveM2: null, supplyPyeong: null, units: null };
}

/** 처음 화면에 쓰는 빈 입력값을 만든다. 모든 숫자는 null이다. */
export function emptyInput(): PlanInput {
  return {
    projectName: "",
    sido: "",
    sigungu: "",
    housingTypes: [],
    pricePerPyeong: null,
    retail: null,
    otherInflow: null,
    fixedCost: null,
    seniorPf: null,
    seniorPfFinanceCost: null,
    subordinated: null,
  };
}

/** 주택형 행이 합계 계산에 필요한 값(공급평 · 세대수)을 모두 갖췄는지 */
export function isHousingRowComplete(row: HousingType): boolean {
  return row.supplyPyeong !== null && row.units !== null;
}

/** 주택형 행 하나의 공급면적 소계 (평) = 세대당 공급평 × 세대수. 둘 중 하나라도 비면 null */
export function rowSupplyPyeong(row: HousingType): Num {
  return isHousingRowComplete(row) ? row.supplyPyeong! * row.units! : null;
}

/** 주택형 표를 집계한 결과 */
export interface HousingSummary {
  /** 공급면적 합계 (평). 완성된 행이 없으면 null */
  totalSupplyPyeong: Num;
  /** 세대수 합계. 완성된 행이 없으면 null */
  totalUnits: Num;
  /** 공급평 · 세대수가 모두 채워진 행 수 */
  completeRows: number;
  /** 일부만 채워져 합계에서 빠진 행 수 */
  incompleteRows: number;
}

/**
 * 주택형 표를 집계한다.
 * 공급면적 합계 = Σ(세대당 공급평 × 세대수), 세대수 합계 = Σ 세대수.
 * 공급평이나 세대수가 빈 행은 합계에서 빼고 incompleteRows로 센다.
 * 두 값 모두 빈 행(아직 손대지 않은 행)은 어느 쪽에도 세지 않는다.
 */
export function summarizeHousing(rows: HousingType[]): HousingSummary {
  let supply = 0;
  let units = 0;
  let completeRows = 0;
  let incompleteRows = 0;
  for (const row of rows) {
    if (isHousingRowComplete(row)) {
      supply += row.supplyPyeong! * row.units!;
      units += row.units!;
      completeRows += 1;
    } else if (row.supplyPyeong !== null || row.units !== null || row.exclusiveM2 !== null) {
      incompleteRows += 1;
    }
  }
  return {
    totalSupplyPyeong: completeRows > 0 ? supply : null,
    totalUnits: completeRows > 0 ? units : null,
    completeRows,
    incompleteRows,
  };
}

/** 숫자 입력칸 문자열을 해석한 결과 */
export type ParsedNumber =
  | { ok: true; value: Num }
  | { ok: false; reason: string };

/**
 * 숫자 입력칸의 문자열을 숫자로 바꾼다.
 * - 빈 문자열(공백 포함) → null (빈 칸)
 * - 천단위 콤마는 무시한다 ("1,234.5" → 1234.5)
 * - 숫자가 아니거나 음수이면 실패로 돌려준다 (입력값은 모두 0 이상)
 * - integer가 true이면 소수를 거부한다 (세대수용)
 */
export function parseNumberInput(text: string, integer = false): ParsedNumber {
  const cleaned = text.replace(/,/g, "").trim();
  if (cleaned === "") return { ok: true, value: null };
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(cleaned)) return { ok: false, reason: "숫자만 입력하세요" };
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return { ok: false, reason: "숫자만 입력하세요" };
  if (n < 0) return { ok: false, reason: "0 이상이어야 합니다" };
  if (integer && !Number.isInteger(n)) return { ok: false, reason: "정수로 입력하세요" };
  return { ok: true, value: n };
}

// ─────────────────────────────────────────────
// 사업수지 계산
// r = 분양률 (0~1, 1 = 100%), p = 평당가 (만원/평)
// 필요한 입력이 하나라도 비어 있으면 null("자료 없음")을 돌려준다.
// ─────────────────────────────────────────────

/** 값이 모두 채워졌으면 true */
function filled(...values: Num[]): boolean {
  return values.every((v) => v !== null);
}

/**
 * 주택형 표에서 계산에 쓸 공급면적 합계 · 세대수 합계를 꺼낸다.
 * 주택형이 없거나, 일부만 채운 행이 있으면 null — 틀린 합계로 계산하지 않기 위해서다.
 */
function housingTotals(input: PlanInput): { supply: number; units: number } | null {
  const s = summarizeHousing(input.housingTypes);
  if (s.incompleteRows > 0 || s.totalSupplyPyeong === null || s.totalUnits === null) return null;
  return { supply: s.totalSupplyPyeong, units: s.totalUnits };
}

/**
 * 분양수입 (억원) = (공급면적 × p ÷ 10,000 + 상가) × r
 * p를 생략하면 입력한 평당가를 쓴다.
 */
export function salesRevenue(input: PlanInput, r: number, p: Num = input.pricePerPyeong): Num {
  const h = housingTotals(input);
  if (h === null || p === null || input.retail === null) return null;
  return ((h.supply * p) / MAN_PER_EOK + input.retail) * r;
}

/**
 * 기말현금 (억원) = 분양수입 × 0.992 − 세대수 × r × 0.03 + 기타유입 − 고정비
 * p를 생략하면 입력한 평당가를 쓴다.
 */
export function endingCash(input: PlanInput, r: number, p: Num = input.pricePerPyeong): Num {
  const h = housingTotals(input);
  const revenue = salesRevenue(input, r, p);
  if (h === null || revenue === null || !filled(input.otherInflow, input.fixedCost)) return null;
  return revenue * SALES_CASH_RATIO - h.units * r * COST_PER_SOLD_UNIT + input.otherInflow! - input.fixedCost!;
}

/**
 * 만기 누적 DSCR = 1 + (기말현금 + 후순위) ÷ (본PF + 본PF 금융비용)
 * 분모(본PF + 금융비용)가 0이면 정의되지 않으므로 null.
 */
export function dscr(input: PlanInput, r: number, p: Num = input.pricePerPyeong): Num {
  const cash = endingCash(input, r, p);
  if (cash === null || !filled(input.subordinated, input.seniorPf, input.seniorPfFinanceCost)) return null;
  const debt = input.seniorPf! + input.seniorPfFinanceCost!;
  if (debt <= 0) return null;
  return 1 + (cash + input.subordinated!) / debt;
}

/**
 * LTV = 본PF ÷ 분양수입(r = 1). 비율(0~1)로 돌려준다.
 * 분양수입이 0 이하이면 null.
 */
export function ltv(input: PlanInput): Num {
  const revenue = salesRevenue(input, 1);
  if (revenue === null || input.seniorPf === null || revenue <= 0) return null;
  return input.seniorPf / revenue;
}

/**
 * 상환 가능 여부: 기말현금 ≥ −후순위 (= 만기 누적 DSCR ≥ 1).
 * 후순위까지 잃더라도 본PF와 금융비용은 갚을 수 있는 상태를 뜻한다.
 */
export function isRepayable(cash: number, subordinated: number): boolean {
  return cash >= -subordinated;
}

/**
 * 이분법으로 f(x) = target 이 되는 x를 [lo, hi]에서 찾는다.
 * f(lo)와 f(hi)가 target을 사이에 두고 있어야 한다. 폭이 tol보다 작아지면 멈춘다.
 */
export function bisect(f: (x: number) => number, target: number, lo: number, hi: number, tol = 1e-9): number {
  let a = lo;
  let b = hi;
  const aBelow = f(a) < target;
  for (let i = 0; i < 200 && b - a > tol; i++) {
    const mid = (a + b) / 2;
    if (f(mid) < target === aBelow) a = mid;
    else b = mid;
  }
  return (a + b) / 2;
}

/** 한계선 결과 */
export type Threshold =
  /** 입력이 비어 계산할 수 없음 */
  | { kind: "none" }
  /** 탐색 범위 안에서는 목표에 닿지 못함 (예: 분양률 100%로도 부족) */
  | { kind: "unreachable" }
  /** 목표에 닿는 값 */
  | { kind: "value"; value: number };

/** 한계선의 목표 기말현금: 0(기말현금 0) 또는 −후순위(상환 한계) */
export type ThresholdTarget = "zero" | "repay";

/** 목표 기말현금 값을 구한다. 상환 한계는 −후순위이므로 후순위가 비면 null */
function targetCash(input: PlanInput, target: ThresholdTarget): Num {
  if (target === "zero") return 0;
  return input.subordinated === null ? null : -input.subordinated;
}

/**
 * 분양률 기준 한계선 — 입력한 평당가에서 기말현금이 목표가 되는 분양률(0~1).
 * 분양률 0%에서 이미 목표 이상이면 0, 100%로도 못 미치면 unreachable.
 */
export function salesRateThreshold(input: PlanInput, target: ThresholdTarget): Threshold {
  const goal = targetCash(input, target);
  const at0 = endingCash(input, 0);
  const at1 = endingCash(input, 1);
  if (goal === null || at0 === null || at1 === null) return { kind: "none" };
  if (at0 >= goal) return { kind: "value", value: 0 };
  if (at1 < goal) return { kind: "unreachable" };
  return { kind: "value", value: bisect((r) => endingCash(input, r)!, goal, 0, 1) };
}

/** 평당가 탐색 상한 (만원/평). 이보다 비싸야 한다면 unreachable로 본다. */
const PRICE_SEARCH_LIMIT = 1_000_000;

/**
 * 평당가 기준 한계선 — 분양률 r(기본 100%)에서 기말현금이 목표가 되는 평당가(만원/평).
 * 평당가 0에서 이미 목표 이상이면 0, 탐색 상한까지 올려도 못 미치면 unreachable.
 */
export function priceThreshold(input: PlanInput, target: ThresholdTarget, r = 1): Threshold {
  const goal = targetCash(input, target);
  const at0 = endingCash(input, r, 0);
  if (goal === null || at0 === null) return { kind: "none" };
  if (at0 >= goal) return { kind: "value", value: 0 };
  // 목표를 넘는 평당가가 나올 때까지 상한을 두 배씩 늘린다
  let hi = Math.max(input.pricePerPyeong ?? 0, 100);
  while (endingCash(input, r, hi)! < goal) {
    hi *= 2;
    if (hi > PRICE_SEARCH_LIMIT) return { kind: "unreachable" };
  }
  return { kind: "value", value: bisect((p) => endingCash(input, r, p)!, goal, 0, hi) };
}

/** 민감도 표의 행: 분양률 75~100% (5%p 간격) */
export const SENSITIVITY_RATES = [0.75, 0.8, 0.85, 0.9, 0.95, 1] as const;
/** 민감도 표의 열: 계획 평당가 대비 −500~+100만원 (100만원 간격) */
export const SENSITIVITY_PRICE_OFFSETS = [-500, -400, -300, -200, -100, 0, 100] as const;

/** 민감도 표의 칸 하나 */
export interface SensitivityCell {
  /** 분양률 (0~1) */
  rate: number;
  /** 평당가 (만원/평) */
  price: number;
  /** 계획 평당가 대비 차이 (만원/평) */
  offset: number;
  /** 기말현금 (억원) */
  endingCash: number;
  /** 상환 가능 여부 (기말현금 ≥ −후순위) */
  repayable: boolean;
}

/**
 * 민감도 표 — 행 = 분양률, 열 = 계획 평당가 + 차이. 칸 = 기말현금과 상환 가능 여부.
 * 기말현금이나 후순위를 계산할 수 없으면 null.
 */
export function sensitivityTable(input: PlanInput): SensitivityCell[][] | null {
  const plan = input.pricePerPyeong;
  if (plan === null || input.subordinated === null || endingCash(input, 1) === null) return null;
  const sub = input.subordinated;
  return SENSITIVITY_RATES.map((rate) =>
    SENSITIVITY_PRICE_OFFSETS.map((offset) => {
      const price = plan + offset;
      const cash = endingCash(input, rate, price)!;
      return { rate, price, offset, endingCash: cash, repayable: isRepayable(cash, sub) };
    }),
  );
}

// ─────────────────────────────────────────────
// 사업계획서 표시용 계산
// ─────────────────────────────────────────────

/** 사업수지 내역 한 줄 (억원) */
export interface CashLine {
  /** 항목 이름 */
  label: string;
  /** 금액 (억원). 기말현금에서 빼는 항목은 음수 */
  amount: number;
  /** 계산식 */
  formula: string;
}

/**
 * 사업수지 내역 — 기말현금을 항목별로 나눈다. 항목을 모두 더하면 기말현금과 같다.
 * 분양률 r(기본 100%), 평당가 p(기본 입력값) 기준. 계산할 수 없으면 null.
 */
export function cashBreakdown(input: PlanInput, r = 1, p: Num = input.pricePerPyeong): { lines: CashLine[]; salesRevenue: number; endingCash: number } | null {
  const h = housingTotals(input);
  const revenue = salesRevenue(input, r, p);
  const cash = endingCash(input, r, p);
  if (h === null || p === null || revenue === null || cash === null) return null;
  const lines: CashLine[] = [
    { label: "분양수입 반영액", amount: revenue * SALES_CASH_RATIO, formula: "분양수입 × 0.992" },
    { label: "세대당 비용", amount: -h.units * r * COST_PER_SOLD_UNIT, formula: "− 세대수 × 분양률 × 0.03" },
    { label: "기타유입", amount: input.otherInflow!, formula: "+ 기타유입" },
    { label: "고정비", amount: -input.fixedCost!, formula: "− 고정비" },
  ];
  return { lines, salesRevenue: revenue, endingCash: cash };
}

/** 장별로 필요한 입력 묶음 */
export type Requirement = "cash" | "debt";

/**
 * 계산에 필요한데 비어 있는 입력의 이름 목록.
 * cash = 사업수지(기말현금)까지, debt = 자금조달·상환(DSCR · 상환 한계)까지.
 */
export function missingInputs(input: PlanInput, need: Requirement): string[] {
  const missing: string[] = [];
  const s = summarizeHousing(input.housingTypes);
  if (s.completeRows === 0) missing.push("주택형(공급면적 · 세대수)");
  if (s.incompleteRows > 0) missing.push(`일부만 채운 주택형 ${s.incompleteRows}개`);
  const fields: [Num, string][] = [
    [input.pricePerPyeong, "평당가"],
    [input.retail, "상가"],
    [input.otherInflow, "기타유입"],
    [input.fixedCost, "고정비"],
  ];
  if (need === "debt") {
    fields.push([input.seniorPf, "본PF"], [input.seniorPfFinanceCost, "본PF 금융비용"], [input.subordinated, "후순위"]);
  }
  for (const [v, name] of fields) if (v === null) missing.push(name);
  return missing;
}

/** 리스크 판단에 쓰는 여유 지표 */
export interface RiskMetrics {
  /** 분양률 여유 (%p) = 100% − 상환 한계 분양률 */
  salesRateMarginPt: Num;
  /** 평당가 여유 (만원/평) = 계획 평당가 − 상환 한계 평당가 (분양률 100%) */
  priceMargin: Num;
  /** 평당가 여유율 (%) = 평당가 여유 ÷ 계획 평당가 × 100 */
  priceMarginPct: Num;
  /** 고정비 증가 여유 (억원) = 기말현금 + 후순위 — 고정비가 이만큼 늘면 DSCR이 1이 된다 */
  costCushion: Num;
}

/**
 * 상환 한계까지의 여유를 구한다 (분양률 100% · 계획 평당가 기준).
 * 한계선이 값이 아니면(자료 없음·도달 불가) 해당 여유는 null.
 */
export function riskMetrics(input: PlanInput): RiskMetrics {
  const rate = salesRateThreshold(input, "repay");
  const price = priceThreshold(input, "repay");
  const cash = endingCash(input, 1);
  const plan = input.pricePerPyeong;
  const priceMargin = price.kind === "value" && plan !== null ? plan - price.value : null;
  return {
    salesRateMarginPt: rate.kind === "value" ? (1 - rate.value) * 100 : null,
    priceMargin,
    priceMarginPct: priceMargin !== null && plan !== null && plan > 0 ? (priceMargin / plan) * 100 : null,
    costCushion: cash !== null && input.subordinated !== null ? cash + input.subordinated : null,
  };
}

/**
 * 민감도 표 아래 자동 문장: "평당 OOO만원 / 분양률 OO% 이상이면 상환 가능".
 * 평당가는 분양률 100% 기준, 분양률은 계획 평당가 기준의 상환 한계다.
 * "이상이면 상환 가능"이 참이 되도록 평당가는 만원 단위, 분양률은 0.1%p 단위로 올림한다.
 * 한계선을 구할 수 없으면 그 사정을 문장으로 돌려준다.
 */
export function repaySentence(input: PlanInput): string {
  const price = priceThreshold(input, "repay");
  const rate = salesRateThreshold(input, "repay");
  if (price.kind === "none" || rate.kind === "none") return "자료 없음";
  const priceText =
    price.kind === "unreachable"
      ? "평당가를 올려도 상환 불가"
      : `평당 ${Math.ceil(price.value - 1e-9).toLocaleString("ko-KR")}만원`;
  const rateText =
    rate.kind === "unreachable"
      ? "계획 평당가로는 분양률 100%로도 상환 불가"
      : `분양률 ${(Math.ceil(rate.value * 1000 - 1e-6) / 10).toFixed(1)}%`;
  if (price.kind === "unreachable" || rate.kind === "unreachable") return `${priceText} / ${rateText}`;
  return `${priceText} / ${rateText} 이상이면 상환 가능`;
}

/** 폭포 차트의 막대 하나 */
export interface WaterfallStep {
  label: string;
  formula: string;
  /** 막대의 크기 (증가는 양수, 차감은 음수) */
  amount: number;
  /** 막대의 아래끝 · 위끝 (억원) */
  from: number;
  to: number;
  /** start = 분양수입, down = 차감, up = 유입, total = 기말현금 */
  kind: "start" | "up" | "down" | "total";
}

/**
 * 사업수지 폭포 — 분양수입에서 차감 · 유입을 거쳐 기말현금까지의 단계.
 * 순서: 분양수입 → 분양수입 차감(0.8%) → 세대당 비용 → 고정비 → 기타유입 → 기말현금.
 * 각 단계의 from · to는 누적값이라 차트는 그리기만 하면 된다. 계산할 수 없으면 null.
 */
export function cashWaterfall(input: PlanInput, r = 1, p: Num = input.pricePerPyeong) {
  const h = housingTotals(input);
  const revenue = salesRevenue(input, r, p);
  const cash = endingCash(input, r, p);
  if (h === null || revenue === null || cash === null) return null;

  const steps: WaterfallStep[] = [];
  let cursor = revenue;
  steps.push({ label: "분양수입", formula: FORMULAS.salesRevenue, amount: revenue, from: 0, to: revenue, kind: "start" });
  const add = (label: string, formula: string, amount: number) => {
    const from = cursor;
    cursor += amount;
    steps.push({ label, formula, amount, from, to: cursor, kind: amount < 0 ? "down" : "up" });
  };
  add("분양수입 차감", `분양수입 × ${((1 - SALES_CASH_RATIO) * 100).toFixed(1)}%`, -revenue * (1 - SALES_CASH_RATIO));
  add("세대당 비용", "− 세대수 × 분양률 × 0.03", -h.units * r * COST_PER_SOLD_UNIT);
  add("고정비", "− 고정비", -input.fixedCost!);
  add("기타유입", "+ 기타유입", input.otherInflow!);
  steps.push({ label: "기말현금", formula: FORMULAS.endingCash, amount: cash, from: 0, to: cash, kind: "total" });

  const values = steps.flatMap((s) => [s.from, s.to]);
  return { steps, min: Math.min(0, ...values), max: Math.max(0, ...values) };
}
