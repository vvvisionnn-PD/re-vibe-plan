import { describe, expect, it } from "vitest";

import { withPatch } from "../analysis";
import { BASE_INPUT, PRESETS, buildPreset } from "../defaults";
import { computeFeasibility } from "../feasibility";
import type { ProjectInput } from "../types";
import { m2ToPyeong, pct } from "../units";

const base = BASE_INPUT;

/** 상대오차 기준 근사 비교 (금액 규모가 커도 안정적) */
function expectClose(actual: number, expected: number, rel = 1e-9) {
  const tolerance = Math.max(1e-6, Math.abs(expected) * rel);
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

describe("면적 산정", () => {
  const r = computeFeasibility(base);

  it("건축면적 = 대지면적 × 건폐율", () => {
    expectClose(r.area.buildingAreaM2, 5000 * 0.5);
  });

  it("지상 연면적 = 대지면적 × 용적률", () => {
    expectClose(r.area.aboveGroundAreaM2, 5000 * 2.5);
  });

  it("지상 연면적 직접입력이 용적률 자동산정보다 우선한다", () => {
    const patched = withPatch(base, "building", {
      aboveGroundAreaOverrideM2: 9999,
    });
    expect(computeFeasibility(patched).area.aboveGroundAreaM2).toBe(9999);
  });

  it("총 연면적 = 지상 + 지하", () => {
    expectClose(
      r.area.totalFloorAreaM2,
      r.area.aboveGroundAreaM2 + r.area.basementAreaM2,
    );
  });

  it("전용면적 = 분양면적 × 전용률", () => {
    expectClose(
      r.area.exclusiveAreaM2,
      r.area.saleableAreaM2 * pct(base.building.exclusiveRatio),
    );
  });

  it("실제 용적률·건폐율이 입력값과 일치한다", () => {
    expectClose(r.area.effectiveFar, base.zoning.floorAreaRatio);
    expectClose(r.area.effectiveBcr, base.zoning.buildingCoverageRatio);
  });
});

describe("매출 산정", () => {
  it("분양수입 = 분양면적(평) × 단가 × 분양률", () => {
    const r = computeFeasibility(base);
    expectClose(
      r.revenue.sales,
      m2ToPyeong(r.area.saleableAreaM2) *
        base.revenue.unitPricePerPyeong *
        pct(base.revenue.salesRate),
    );
  });

  it("분양률 0% 이면 분양수입도 0, 총매출은 기타수입뿐", () => {
    const patched = withPatch(base, "revenue", {
      salesRate: 0,
      otherRevenue: 5000,
    });
    const r = computeFeasibility(patched);
    expect(r.revenue.sales).toBe(0);
    expect(r.revenue.total).toBe(5000);
  });

  it("분양률 100% 일 때 실현단가 = 입력단가", () => {
    const r = computeFeasibility(
      withPatch(base, "revenue", { salesRate: 100 }),
    );
    expectClose(
      r.revenue.realizedUnitPricePerPyeong,
      base.revenue.unitPricePerPyeong,
    );
  });
});

describe("원가 산정", () => {
  const r = computeFeasibility(base);

  it("토지 매입비 = 대지면적(평) × 매입단가", () => {
    expectClose(
      r.cost.land.purchase,
      m2ToPyeong(base.land.siteAreaM2) * base.land.unitPricePerPyeong,
    );
  });

  it("취득세등 = 토지 매입비 × 4.6%", () => {
    expectClose(r.cost.land.acquisitionTax, r.cost.land.purchase * 0.046);
  });

  it("도급공사비 = 지상 + 지하 공사비", () => {
    expectClose(
      r.cost.construction.contract,
      r.cost.construction.above + r.cost.construction.basement,
    );
  });

  it("예비비 = (토지비계 + 공사비계 + 예비비 전 간접비) × 요율", () => {
    expectClose(
      r.cost.indirect.contingency,
      r.cost.indirect.contingencyBase * pct(base.indirect.contingencyRate),
    );
    expectClose(
      r.cost.indirect.contingencyBase,
      r.cost.land.subtotal +
        r.cost.construction.subtotal +
        (r.cost.indirect.subtotal - r.cost.indirect.contingency),
    );
  });

  it("총사업비 = 토지비 + 공사비 + 간접비 + 금융비", () => {
    expectClose(
      r.cost.total,
      r.cost.land.subtotal +
        r.cost.construction.subtotal +
        r.cost.indirect.subtotal +
        r.cost.finance.subtotal,
    );
  });

  it("연면적 평당 사업비 × 총 연면적(평) = 총사업비", () => {
    expectClose(
      r.cost.perPyeong * m2ToPyeong(r.area.totalFloorAreaM2),
      r.cost.total,
    );
  });
});

describe("금융비 — 본PF 순환참조 해", () => {
  const r = computeFeasibility(base);

  it("브릿지 이자 = 원금 × 금리 × 기간/12", () => {
    expectClose(
      r.cost.finance.bridgeInterest,
      r.cost.finance.bridgePrincipal *
        pct(base.finance.bridgeRate) *
        (base.finance.bridgeMonths / 12),
    );
  });

  it("브릿지 원금 = 토지비계 × LTV", () => {
    expectClose(
      r.cost.finance.bridgePrincipal,
      r.cost.land.subtotal * pct(base.finance.bridgeLtv),
    );
  });

  it("PF 비용계수 k = 금리 × 평균인출률 × 기간/12 + 수수료율", () => {
    expectClose(
      r.cost.finance.pfCostCoefficient,
      pct(base.finance.pfRate) *
        pct(base.finance.pfAvgDrawRate) *
        (base.finance.pfMonths / 12) +
        pct(base.finance.pfFeeRate),
    );
  });

  it("고정점을 만족한다: P = base + k·P", () => {
    const f = r.cost.finance;
    const baseAmount =
      r.cost.land.subtotal +
      r.cost.construction.subtotal +
      r.cost.indirect.subtotal +
      f.bridgeInterest +
      f.bridgeFee -
      r.funding.equity -
      r.funding.salesCollected;
    expectClose(f.pfPrincipal, baseAmount + f.pfInterest + f.pfFee);
  });

  it("반복 대입으로 수렴시킨 값과 닫힌 해가 일치한다", () => {
    const f = r.cost.finance;
    const baseAmount =
      r.cost.land.subtotal +
      r.cost.construction.subtotal +
      r.cost.indirect.subtotal +
      f.bridgeInterest +
      f.bridgeFee -
      r.funding.equity -
      r.funding.salesCollected;

    let p = 0;
    for (let i = 0; i < 500; i++) {
      p = Math.max(0, baseAmount + f.pfCostCoefficient * p);
    }
    expectClose(f.pfPrincipal, p, 1e-6);
  });

  it("자기자본이 충분하면 PF 소요액은 0", () => {
    const patched = withPatch(base, "finance", { equity: 100_000_000 });
    expect(computeFeasibility(patched).cost.finance.pfPrincipal).toBe(0);
  });

  it("비용계수가 1 이상이면 발산으로 표시하고 원금을 0으로 둔다", () => {
    const patched = withPatch(base, "finance", {
      pfRate: 60,
      pfAvgDrawRate: 100,
      pfMonths: 60,
    });
    const f = computeFeasibility(patched).cost.finance;
    expect(f.pfCostCoefficient).toBeGreaterThanOrEqual(1);
    expect(f.diverged).toBe(true);
    expect(f.pfPrincipal).toBe(0);
  });
});

describe("손익 및 자금수지", () => {
  const r = computeFeasibility(base);

  it("사업이익 = 총매출 − 총사업비", () => {
    expectClose(r.profit.profit, r.revenue.total - r.cost.total);
  });

  it("매출이익률 = 사업이익 ÷ 총매출", () => {
    expectClose(r.profit.marginOnRevenue, r.profit.profit / r.revenue.total);
  });

  it("ROE = 사업이익 ÷ 자기자본", () => {
    expectClose(r.profit.roe, r.profit.profit / base.finance.equity);
  });

  it("연환산 ROE × (사업기간/12) = ROE", () => {
    expectClose(
      r.profit.annualizedRoe * (base.meta.totalMonths / 12),
      r.profit.roe,
    );
  });

  it("자금조달과 자금소요가 일치한다", () => {
    expectClose(r.funding.gap, 0, 1e-9);
  });

  it("기중 회수액 = 분양수입 × 회수율", () => {
    expectClose(
      r.funding.salesCollected,
      r.revenue.sales * pct(base.finance.salesCollectionRate),
    );
  });
});

describe("단조성 (부호 검증)", () => {
  const profitOf = (input: ProjectInput) =>
    computeFeasibility(input).profit.profit;

  it("분양단가가 오르면 사업이익이 커진다", () => {
    const up = withPatch(base, "revenue", {
      unitPricePerPyeong: base.revenue.unitPricePerPyeong * 1.1,
    });
    expect(profitOf(up)).toBeGreaterThan(profitOf(base));
  });

  it("공사단가가 오르면 사업이익이 줄어든다", () => {
    const up = withPatch(base, "construction", {
      unitCostAbovePerPyeong: base.construction.unitCostAbovePerPyeong * 1.1,
    });
    expect(profitOf(up)).toBeLessThan(profitOf(base));
  });

  it("토지 매입단가가 오르면 사업이익이 줄어든다", () => {
    const up = withPatch(base, "land", {
      unitPricePerPyeong: base.land.unitPricePerPyeong * 1.1,
    });
    expect(profitOf(up)).toBeLessThan(profitOf(base));
  });

  it("분양률이 오르면 사업이익이 커진다", () => {
    const lo = withPatch(base, "revenue", { salesRate: 60 });
    const hi = withPatch(base, "revenue", { salesRate: 95 });
    expect(profitOf(hi)).toBeGreaterThan(profitOf(lo));
  });

  it("PF 금리가 오르면 사업이익이 줄어든다", () => {
    const up = withPatch(base, "finance", {
      pfRate: base.finance.pfRate + 3,
    });
    expect(profitOf(up)).toBeLessThan(profitOf(base));
  });

  it("자기자본을 늘리면 금융비가 줄어 사업이익이 커진다", () => {
    const up = withPatch(base, "finance", {
      equity: base.finance.equity * 2,
    });
    expect(profitOf(up)).toBeGreaterThan(profitOf(base));
  });
});

describe("경계값 방어", () => {
  it("모든 입력이 0 이어도 NaN 이 생기지 않는다", () => {
    const zero: ProjectInput = {
      meta: { ...base.meta, totalMonths: 0, constructionMonths: 0 },
      land: {
        siteAreaM2: 0,
        unitPricePerPyeong: 0,
        acquisitionTaxRate: 0,
        incidentalRate: 0,
      },
      zoning: { buildingCoverageRatio: 0, floorAreaRatio: 0 },
      building: {
        aboveGroundAreaOverrideM2: 0,
        basementAreaM2: 0,
        saleableAreaRatio: 0,
        exclusiveRatio: 0,
        floorsAbove: 0,
        floorsBelow: 0,
        parkingCount: 0,
      },
      revenue: { unitPricePerPyeong: 0, salesRate: 0, otherRevenue: 0 },
      construction: {
        unitCostAbovePerPyeong: 0,
        unitCostBasementPerPyeong: 0,
        designSupervisionRate: 0,
        demolitionAndOther: 0,
      },
      indirect: {
        salesAgencyRate: 0,
        advertisingRate: 0,
        trustFeeRate: 0,
        pmFeeRate: 0,
        registrationRate: 0,
        licensingAndOther: 0,
        contingencyRate: 0,
      },
      finance: {
        equity: 0,
        bridgeLtv: 0,
        bridgeRate: 0,
        bridgeFeeRate: 0,
        bridgeMonths: 0,
        pfRate: 0,
        pfFeeRate: 0,
        pfMonths: 0,
        pfAvgDrawRate: 0,
        salesCollectionRate: 0,
      },
    };

    const r = computeFeasibility(zero);
    const numbers = JSON.stringify(r).match(/-?\d+(\.\d+)?([eE][-+]?\d+)?/g);
    expect(numbers).not.toBeNull();
    expect(JSON.stringify(r)).not.toContain("null"); // NaN 은 JSON 에서 null 이 된다
    expect(r.cost.total).toBe(0);
    expect(r.profit.profit).toBe(0);
    expect(r.profit.roe).toBe(0);
  });

  it("음수 면적·단가는 0 으로 처리한다", () => {
    const patched = withPatch(
      withPatch(base, "land", { siteAreaM2: -1000, unitPricePerPyeong: -50 }),
      "building",
      { basementAreaM2: -500 },
    );
    const r = computeFeasibility(patched);
    expect(r.area.siteAreaM2).toBe(0);
    expect(r.area.basementAreaM2).toBe(0);
    expect(r.cost.land.purchase).toBe(0);
  });

  it("NaN 입력이 결과를 오염시키지 않는다", () => {
    const patched = withPatch(base, "revenue", {
      unitPricePerPyeong: Number.NaN,
    });
    const r = computeFeasibility(patched);
    expect(Number.isFinite(r.revenue.sales)).toBe(true);
    expect(Number.isFinite(r.cost.total)).toBe(true);
    expect(Number.isFinite(r.profit.profit)).toBe(true);
  });
});

describe("순수성", () => {
  it("같은 입력은 항상 같은 결과를 낸다", () => {
    expect(computeFeasibility(base)).toEqual(computeFeasibility(base));
  });

  it("계산이 입력 객체를 변형하지 않는다", () => {
    const snapshot = JSON.stringify(base);
    computeFeasibility(base);
    expect(JSON.stringify(base)).toBe(snapshot);
  });
});

describe("프리셋", () => {
  it.each(PRESETS.map((p) => p.label))(
    "%s 프리셋이 유한한 결과를 낸다",
    (useType) => {
      const r = computeFeasibility(buildPreset(useType));
      expect(Number.isFinite(r.cost.total)).toBe(true);
      expect(Number.isFinite(r.profit.profit)).toBe(true);
      expect(r.cost.total).toBeGreaterThan(0);
      expect(r.revenue.total).toBeGreaterThan(0);
      expect(r.cost.finance.diverged).toBe(false);
    },
  );

  it("프리셋 선택이 사업유형을 함께 반영한다", () => {
    expect(buildPreset("물류센터").meta.useType).toBe("물류센터");
    expect(buildPreset("물류센터").meta.landUseZone).toBe("계획관리지역");
  });
});
