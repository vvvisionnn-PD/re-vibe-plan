import { describe, expect, it } from "vitest";

import {
  DEFAULT_DELTAS,
  breakEvenConstructionCost,
  breakEvenSalesRate,
  breakEvenUnitPrice,
  costComposition,
  sensitivityMatrix,
  withPatch,
} from "../analysis";
import { BASE_INPUT, PRESETS, buildPreset } from "../defaults";
import { computeFeasibility } from "../feasibility";

const base = BASE_INPUT;

describe("withPatch", () => {
  it("해당 섹션만 교체하고 원본은 그대로 둔다", () => {
    const patched = withPatch(base, "revenue", { salesRate: 50 });
    expect(patched.revenue.salesRate).toBe(50);
    expect(base.revenue.salesRate).toBe(100);
    expect(patched.land).toBe(base.land);
  });
});

describe("손익분기점 (BEP)", () => {
  it("BEP 분양률로 재계산하면 사업이익이 0 이다", () => {
    const bep = breakEvenSalesRate(base);
    expect(bep.value).not.toBeNull();
    const atBep = computeFeasibility(
      withPatch(base, "revenue", { salesRate: bep.value! }),
    );
    expect(Math.abs(atBep.profit.profit)).toBeLessThan(1); // 1만원 미만
  });

  it("BEP 분양률은 현재 분양률보다 낮다 (흑자 사업이므로)", () => {
    const r = computeFeasibility(base);
    expect(r.profit.profit).toBeGreaterThan(0);
    const bep = breakEvenSalesRate(base);
    expect(bep.value!).toBeLessThan(base.revenue.salesRate);
    expect(bep.value!).toBeGreaterThan(0);
  });

  it("BEP 분양단가로 재계산하면 사업이익이 0 이다", () => {
    const bep = breakEvenUnitPrice(base);
    expect(bep.value).not.toBeNull();
    const atBep = computeFeasibility(
      withPatch(base, "revenue", { unitPricePerPyeong: bep.value! }),
    );
    expect(Math.abs(atBep.profit.profit)).toBeLessThan(1);
    expect(bep.value!).toBeLessThan(base.revenue.unitPricePerPyeong);
  });

  it("BEP 공사단가로 재계산하면 사업이익이 0 이다", () => {
    const bep = breakEvenConstructionCost(base);
    expect(bep.value).not.toBeNull();
    const atBep = computeFeasibility(
      withPatch(base, "construction", { unitCostAbovePerPyeong: bep.value! }),
    );
    expect(Math.abs(atBep.profit.profit)).toBeLessThan(1);
    expect(bep.value!).toBeGreaterThan(
      base.construction.unitCostAbovePerPyeong,
    );
  });

  it("탐색구간 안에 해가 없으면 null 을 돌려준다", () => {
    // 분양수입이 0 이면 어떤 분양률에서도 흑자가 될 수 없다
    const hopeless = withPatch(base, "revenue", { unitPricePerPyeong: 0 });
    expect(breakEvenSalesRate(hopeless).value).toBeNull();
  });
});

describe("민감도 분석", () => {
  const matrix = sensitivityMatrix(base);

  it("행·열 크기가 변동률 배열과 일치한다", () => {
    expect(matrix.rows).toHaveLength(DEFAULT_DELTAS.length);
    for (const row of matrix.rows) {
      expect(row).toHaveLength(DEFAULT_DELTAS.length);
    }
  });

  it("중앙 셀(0%, 0%)은 기준 시나리오와 같다", () => {
    const mid = DEFAULT_DELTAS.indexOf(0);
    const cell = matrix.rows[mid][mid];
    const baseResult = computeFeasibility(base);
    expect(cell.profit).toBeCloseTo(baseResult.profit.profit, 6);
    expect(cell.margin).toBeCloseTo(baseResult.profit.marginOnRevenue, 12);
  });

  it("한 행 안에서 공사비가 오를수록 이익이 줄어든다", () => {
    for (const row of matrix.rows) {
      for (let i = 1; i < row.length; i++) {
        expect(row[i].profit).toBeLessThan(row[i - 1].profit);
      }
    }
  });

  it("한 열 안에서 분양가가 오를수록 이익이 늘어난다", () => {
    for (let col = 0; col < DEFAULT_DELTAS.length; col++) {
      for (let row = 1; row < matrix.rows.length; row++) {
        expect(matrix.rows[row][col].profit).toBeGreaterThan(
          matrix.rows[row - 1][col].profit,
        );
      }
    }
  });

  it("사용자 지정 변동폭을 그대로 사용한다", () => {
    const custom = sensitivityMatrix(base, [-20, 0], [0, 20, 40]);
    expect(custom.rows).toHaveLength(2);
    expect(custom.rows[0]).toHaveLength(3);
    expect(custom.rows[0][2].costDelta).toBe(40);
  });
});

describe("사업비 구성", () => {
  it("4대 항목의 비중 합은 1 이다", () => {
    const shares = costComposition(computeFeasibility(base));
    expect(shares).toHaveLength(4);
    const sum = shares.reduce((acc, s) => acc + s.share, 0);
    expect(sum).toBeCloseTo(1, 12);
  });

  it("금액 합계는 총사업비와 같다", () => {
    const result = computeFeasibility(base);
    const sum = costComposition(result).reduce((acc, s) => acc + s.amount, 0);
    expect(sum).toBeCloseTo(result.cost.total, 6);
  });

  it("모든 프리셋에서 비중이 유한하다", () => {
    for (const preset of PRESETS) {
      const shares = costComposition(computeFeasibility(buildPreset(preset.label)));
      for (const s of shares) {
        expect(Number.isFinite(s.share)).toBe(true);
        expect(s.share).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
