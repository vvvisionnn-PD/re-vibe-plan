/**
 * 검산(檢算) 모듈.
 *
 * 수지표가 스스로를 검증한다. 여기서 정의한 항등식은
 *  1) 앱의 "검산" 탭에 그대로 표시되고,
 *  2) `src/lib/__tests__/audit.test.ts` 에서 동일하게 단언된다.
 *
 * 항등식(identity)이 하나라도 깨지면 계산 엔진의 버그다.
 * 개연성 점검(sanity)은 입력값이 비현실적일 때의 경고이며 실패해도 엔진 버그는 아니다.
 */

import { breakEvenSalesRate, withPatch } from "./analysis";
import { computeFeasibility } from "./feasibility";
import type { FeasibilityResult } from "./feasibility";
import type { ProjectInput } from "./types";
import { m2ToPyeong, pct } from "./units";

export type CheckKind = "identity" | "sanity";

export interface AuditCheck {
  id: string;
  kind: CheckKind;
  label: string;
  /** 기대값 */
  expected: number;
  /** 실제값 */
  actual: number;
  /** |기대 − 실제| */
  diff: number;
  /** 허용오차 (절대값) */
  tolerance: number;
  passed: boolean;
  /** 표시용 단위: 만원 / ㎡ / % / 배 */
  unit: "만원" | "㎡" | "%" | "";
  note?: string;
}

export interface AuditReport {
  checks: AuditCheck[];
  identityFailures: AuditCheck[];
  sanityFailures: AuditCheck[];
  /** 항등식이 모두 통과하면 true */
  ok: boolean;
}

/**
 * 상대오차 기반 허용치. 금액이 커질수록 부동소수 오차도 커지므로
 * 규모에 비례한 허용오차를 쓴다. 최소 1e-6 만원(= 0.01원).
 */
function toleranceFor(magnitude: number): number {
  return Math.max(1e-6, Math.abs(magnitude) * 1e-9);
}

function check(
  id: string,
  kind: CheckKind,
  label: string,
  expected: number,
  actual: number,
  unit: AuditCheck["unit"],
  tolerance = toleranceFor(Math.max(Math.abs(expected), Math.abs(actual))),
  note?: string,
): AuditCheck {
  const diff = Math.abs(expected - actual);
  return {
    id,
    kind,
    label,
    expected,
    actual,
    diff,
    tolerance,
    passed: diff <= tolerance,
    unit,
    note,
  };
}

/**
 * 등식이 아닌 조건(부등식·불리언)을 검산 항목으로 만든다.
 * 등식용 `check()` 로 부등식을 흉내내면 "성립하는데도 실패"하는 항목이 생긴다.
 */
function assertThat(
  id: string,
  kind: CheckKind,
  label: string,
  ok: boolean,
  note?: string,
): AuditCheck {
  return {
    id,
    kind,
    label,
    expected: 1,
    actual: ok ? 1 : 0,
    diff: ok ? 0 : 1,
    tolerance: 0,
    passed: ok,
    unit: "",
    note,
  };
}

export function auditFeasibility(
  input: ProjectInput,
  result: FeasibilityResult = computeFeasibility(input),
): AuditReport {
  const { area, revenue, cost, profit, funding } = result;
  const checks: AuditCheck[] = [];

  // ── 면적 항등식 ─────────────────────────────────────────────
  checks.push(
    check(
      "area.building",
      "identity",
      "건축면적 = 대지면적 × 건폐율",
      area.siteAreaM2 * pct(input.zoning.buildingCoverageRatio),
      area.buildingAreaM2,
      "㎡",
    ),
  );
  checks.push(
    check(
      "area.total",
      "identity",
      "총 연면적 = 지상 연면적 + 지하 연면적",
      area.aboveGroundAreaM2 + area.basementAreaM2,
      area.totalFloorAreaM2,
      "㎡",
    ),
  );
  checks.push(
    check(
      "area.saleable",
      "identity",
      "분양면적 = 지상 연면적 × 분양면적비율",
      area.aboveGroundAreaM2 * pct(input.building.saleableAreaRatio),
      area.saleableAreaM2,
      "㎡",
    ),
  );
  checks.push(
    check(
      "area.exclusive",
      "identity",
      "전용면적 = 분양면적 × 전용률",
      area.saleableAreaM2 * pct(input.building.exclusiveRatio),
      area.exclusiveAreaM2,
      "㎡",
    ),
  );

  // ── 매출 항등식 ─────────────────────────────────────────────
  checks.push(
    check(
      "revenue.sales",
      "identity",
      "분양수입 = 분양면적(평) × 분양단가 × 분양률",
      m2ToPyeong(area.saleableAreaM2) *
        input.revenue.unitPricePerPyeong *
        pct(input.revenue.salesRate),
      revenue.sales,
      "만원",
    ),
  );
  checks.push(
    check(
      "revenue.total",
      "identity",
      "총매출 = 분양수입 + 기타수입",
      revenue.sales + revenue.other,
      revenue.total,
      "만원",
    ),
  );

  // ── 원가 소계 항등식 ────────────────────────────────────────
  checks.push(
    check(
      "cost.land",
      "identity",
      "토지비계 = 매입비 + 취득세등 + 부대비",
      cost.land.purchase + cost.land.acquisitionTax + cost.land.incidental,
      cost.land.subtotal,
      "만원",
    ),
  );
  checks.push(
    check(
      "cost.construction",
      "identity",
      "공사비계 = 도급공사비 + 설계·감리비 + 기타공사비",
      cost.construction.contract +
        cost.construction.designSupervision +
        cost.construction.demolitionAndOther,
      cost.construction.subtotal,
      "만원",
    ),
  );
  checks.push(
    check(
      "cost.indirect",
      "identity",
      "간접비계 = 개별 간접비 합계 + 예비비",
      cost.indirect.salesAgency +
        cost.indirect.advertising +
        cost.indirect.trustFee +
        cost.indirect.pmFee +
        cost.indirect.registration +
        cost.indirect.licensingAndOther +
        cost.indirect.contingency,
      cost.indirect.subtotal,
      "만원",
    ),
  );
  checks.push(
    check(
      "cost.finance",
      "identity",
      "금융비계 = 브릿지(이자+수수료) + 본PF(이자+수수료)",
      cost.finance.bridgeInterest +
        cost.finance.bridgeFee +
        cost.finance.pfInterest +
        cost.finance.pfFee,
      cost.finance.subtotal,
      "만원",
    ),
  );
  checks.push(
    check(
      "cost.total",
      "identity",
      "총사업비 = 토지비 + 공사비 + 간접비 + 금융비",
      cost.land.subtotal +
        cost.construction.subtotal +
        cost.indirect.subtotal +
        cost.finance.subtotal,
      cost.total,
      "만원",
    ),
  );

  // ── 손익·자금수지 항등식 ────────────────────────────────────
  checks.push(
    check(
      "profit.definition",
      "identity",
      "사업이익 = 총매출 − 총사업비",
      revenue.total - cost.total,
      profit.profit,
      "만원",
    ),
  );
  checks.push(
    check(
      "profit.margin",
      "identity",
      "매출이익률 × 총매출 = 사업이익",
      profit.marginOnRevenue * revenue.total,
      revenue.total > 0 ? profit.profit : 0,
      "만원",
    ),
  );
  // 자금수지. 본PF를 실제로 인출하는 경우에만 조달 = 소요 가 성립한다.
  // 자기자본과 기중 회수만으로 사업비가 충당되면 PF 소요액이 0 으로 고정되고
  // 그만큼 잉여자금이 남으므로, 그때는 "조달 ≥ 소요" 가 옳은 명제다.
  if (cost.finance.pfPrincipal > 0) {
    checks.push(
      check(
        "funding.balance",
        "identity",
        "자금조달(자기자본+본PF+기중회수) = 자금소요(총사업비)",
        funding.totalSource,
        funding.totalUse,
        "만원",
        toleranceFor(Math.max(funding.totalSource, funding.totalUse)),
        "브릿지론 원금은 본PF로 상환되어 상계되므로 순계에서 제외",
      ),
    );
  } else {
    checks.push(
      assertThat(
        "funding.balance",
        "identity",
        "본PF 미인출 시 자금조달 ≥ 자금소요",
        funding.gap >= -toleranceFor(funding.totalUse),
        `잉여자금 ${funding.gap.toFixed(0)}만원 — 자기자본·분양대금만으로 사업비 충당`,
      ),
    );
  }

  // 본PF 고정점 해: P × (1 − k) = base
  const base =
    cost.land.subtotal +
    cost.construction.subtotal +
    cost.indirect.subtotal +
    cost.finance.bridgeInterest +
    cost.finance.bridgeFee -
    funding.equity -
    funding.salesCollected;
  checks.push(
    check(
      "finance.fixedPoint",
      "identity",
      "본PF 순환참조 해: PF원금 × (1 − 비용계수) = 소요액",
      Math.max(0, base),
      cost.finance.pfPrincipal * (1 - cost.finance.pfCostCoefficient),
      "만원",
      toleranceFor(Math.max(Math.abs(base), cost.finance.pfPrincipal)),
      cost.finance.diverged
        ? "비용계수 ≥ 1 — PF 소요액이 발산한다. 금리·기간·수수료를 확인할 것"
        : undefined,
    ),
  );

  // BEP 분양률 역산: 해당 분양률로 다시 계산하면 이익이 0 이어야 한다.
  const bep = breakEvenSalesRate(input);
  if (bep.value !== null) {
    const atBep = computeFeasibility(
      withPatch(input, "revenue", { salesRate: bep.value }),
    );
    checks.push(
      check(
        "bep.roundtrip",
        "identity",
        "BEP 분양률로 재계산한 사업이익 = 0",
        0,
        atBep.profit.profit,
        "만원",
        // 허용오차는 매출이 아니라 사업 규모(총사업비)에 연동한다.
        // 분양률 0% 시나리오에서는 매출이 0 이라 매출 연동 허용오차가 무의미하다.
        Math.max(1e-3, cost.total * 1e-9),
        `BEP 분양률 ${bep.value.toFixed(4)}%`,
      ),
    );
  }

  // ── 개연성 점검 (실패해도 엔진 버그는 아니다. 입력 경고) ────
  checks.push(
    assertThat(
      "sanity.bcr",
      "sanity",
      "건축면적 ≤ 대지면적 (건폐율 ≤ 100%)",
      area.buildingAreaM2 <= area.siteAreaM2 + toleranceFor(area.siteAreaM2),
      `적용 건폐율 ${input.zoning.buildingCoverageRatio}%`,
    ),
  );
  checks.push(
    assertThat(
      "sanity.exclusive",
      "sanity",
      "전용면적 ≤ 분양면적 (전용률 ≤ 100%)",
      area.exclusiveAreaM2 <=
        area.saleableAreaM2 + toleranceFor(area.saleableAreaM2),
      `전용률 ${input.building.exclusiveRatio}%`,
    ),
  );
  checks.push(
    assertThat(
      "sanity.equity",
      "sanity",
      "자기자본 > 0",
      funding.equity > 0,
      "자기자본이 0 이면 ROE를 산출할 수 없다",
    ),
  );
  checks.push(
    assertThat(
      "sanity.pfCoefficient",
      "sanity",
      "본PF 비용계수 < 1",
      cost.finance.pfCostCoefficient < 1,
      `현재 계수 ${(cost.finance.pfCostCoefficient * 100).toFixed(2)}% — 1 이상이면 소요 PF가 발산한다`,
    ),
  );
  checks.push(
    assertThat(
      "sanity.fundingGap",
      "sanity",
      "자금조달 부족액 없음 (조달 ≥ 소요)",
      funding.gap >= -toleranceFor(funding.totalUse),
      `조달 − 소요 = ${funding.gap.toFixed(0)}만원`,
    ),
  );
  checks.push(
    assertThat(
      "sanity.profit",
      "sanity",
      "사업이익 > 0",
      profit.profit > 0,
      `현재 매출이익률 ${(profit.marginOnRevenue * 100).toFixed(2)}%`,
    ),
  );

  const identityFailures = checks.filter(
    (c) => c.kind === "identity" && !c.passed,
  );
  const sanityFailures = checks.filter((c) => c.kind === "sanity" && !c.passed);

  return {
    checks,
    identityFailures,
    sanityFailures,
    ok: identityFailures.length === 0,
  };
}
