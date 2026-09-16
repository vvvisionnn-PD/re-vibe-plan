/**
 * 파생 분석: 손익분기점(BEP), 민감도, 사업비 구성.
 * `feasibility.ts` 와 마찬가지로 순수 함수만 둔다.
 */

import { computeFeasibility } from "./feasibility";
import type { FeasibilityResult } from "./feasibility";
import type { ProjectInput } from "./types";

/** 입력의 일부 필드만 바꾼 사본. 깊은 복사 없이 섹션 단위로만 교체한다. */
export function withPatch<S extends keyof ProjectInput>(
  input: ProjectInput,
  section: S,
  patch: Partial<ProjectInput[S]>,
): ProjectInput {
  return { ...input, [section]: { ...input[section], ...patch } };
}

export interface BisectionResult {
  /** 해(解). 구간 내에 없으면 null */
  value: number | null;
  /** 해에서의 사업이익(만원). 0 에 수렴해야 한다. */
  residual: number;
  iterations: number;
}

/**
 * f(x) = 0 을 만족하는 x 를 이분법으로 찾는다.
 * profit(x) 는 구간별 선형이며 단조이므로 이분법이 안정적으로 수렴한다.
 *
 * 종료 조건은 두 가지다.
 *  - |f(mid)| ≤ fTolerance  (원하는 정밀도 도달)
 *  - 구간 폭이 배정밀도 한계에 도달  (더 좁힐 수 없음)
 *
 * 구간 폭을 절대값(예: 1e-7)으로 끊으면 f 의 기울기가 클 때 잔차가 커진다.
 * (분양률 1% 변화가 수천만원을 움직이므로) 반드시 기계 정밀도까지 좁힌다.
 */
function bisect(
  f: (x: number) => number,
  lo: number,
  hi: number,
  fTolerance = 1e-9,
  maxIterations = 200,
): BisectionResult {
  let flo = f(lo);
  let fhi = f(hi);

  if (flo === 0) return { value: lo, residual: 0, iterations: 0 };
  if (fhi === 0) return { value: hi, residual: 0, iterations: 0 };
  if (flo > 0 === fhi > 0) {
    // 구간 내 부호 변화가 없다 → 해 없음
    return { value: null, residual: NaN, iterations: 0 };
  }

  let a = lo;
  let b = hi;
  let i = 0;
  let mid = (a + b) / 2;
  let fmid = f(mid);

  for (; i < maxIterations; i++) {
    mid = (a + b) / 2;
    fmid = f(mid);
    const xResolution = Math.max(Number.EPSILON * Math.abs(mid), 1e-15);
    if (Math.abs(fmid) <= fTolerance || b - a <= xResolution) break;
    if (fmid > 0 === flo > 0) {
      a = mid;
      flo = fmid;
    } else {
      b = mid;
      fhi = fmid;
    }
  }

  return { value: mid, residual: fmid, iterations: i };
}

/** 사업이익이 0 이 되는 분양률(%). 구간 [0, 400] 에서 탐색. */
export function breakEvenSalesRate(input: ProjectInput): BisectionResult {
  return bisect(
    (rate) =>
      computeFeasibility(withPatch(input, "revenue", { salesRate: rate }))
        .profit.profit,
    0,
    400,
  );
}

/** 사업이익이 0 이 되는 분양단가(만원/평). 구간 [0, 현재단가 × 5] 에서 탐색. */
export function breakEvenUnitPrice(input: ProjectInput): BisectionResult {
  const current = Math.max(1, input.revenue.unitPricePerPyeong);
  return bisect(
    (price) =>
      computeFeasibility(
        withPatch(input, "revenue", { unitPricePerPyeong: price }),
      ).profit.profit,
    0,
    current * 5,
  );
}

/** 사업이익이 0 이 되는 지상 공사단가(만원/평). */
export function breakEvenConstructionCost(
  input: ProjectInput,
): BisectionResult {
  const current = Math.max(1, input.construction.unitCostAbovePerPyeong);
  return bisect(
    (unit) =>
      computeFeasibility(
        withPatch(input, "construction", { unitCostAbovePerPyeong: unit }),
      ).profit.profit,
    0,
    current * 5,
  );
}

export interface SensitivityCell {
  /** 분양가 변동률(%) */
  priceDelta: number;
  /** 공사비 변동률(%) */
  costDelta: number;
  /** 사업이익(만원) */
  profit: number;
  /** 매출액 대비 이익률(비율) */
  margin: number;
}

export interface SensitivityMatrix {
  priceDeltas: number[];
  costDeltas: number[];
  /** rows = 분양가 변동, cols = 공사비 변동 */
  rows: SensitivityCell[][];
}

export const DEFAULT_DELTAS = [-10, -5, 0, 5, 10];

/**
 * 분양가 × 공사비 2변량 민감도.
 * 공사비 변동은 지상·지하 단가에 동일 비율로 적용한다.
 */
export function sensitivityMatrix(
  input: ProjectInput,
  priceDeltas: number[] = DEFAULT_DELTAS,
  costDeltas: number[] = DEFAULT_DELTAS,
): SensitivityMatrix {
  const rows = priceDeltas.map((priceDelta) =>
    costDeltas.map((costDelta) => {
      const patched = withPatch(
        withPatch(input, "revenue", {
          unitPricePerPyeong:
            input.revenue.unitPricePerPyeong * (1 + priceDelta / 100),
        }),
        "construction",
        {
          unitCostAbovePerPyeong:
            input.construction.unitCostAbovePerPyeong * (1 + costDelta / 100),
          unitCostBasementPerPyeong:
            input.construction.unitCostBasementPerPyeong *
            (1 + costDelta / 100),
        },
      );
      const result = computeFeasibility(patched);
      return {
        priceDelta,
        costDelta,
        profit: result.profit.profit,
        margin: result.profit.marginOnRevenue,
      };
    }),
  );

  return { priceDeltas, costDeltas, rows };
}

export interface CostShare {
  label: string;
  amount: number;
  /** 총사업비 대비 비중(비율) */
  share: number;
}

/** 총사업비 구성 (4대 항목). */
export function costComposition(result: FeasibilityResult): CostShare[] {
  const total = result.cost.total;
  const entries: [string, number][] = [
    ["토지비", result.cost.land.subtotal],
    ["공사비", result.cost.construction.subtotal],
    ["간접비", result.cost.indirect.subtotal],
    ["금융비", result.cost.finance.subtotal],
  ];
  return entries.map(([label, amount]) => ({
    label,
    amount,
    share: total > 0 ? amount / total : 0,
  }));
}
