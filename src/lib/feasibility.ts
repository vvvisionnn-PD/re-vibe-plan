/**
 * 수지분석(사업성 분석) 계산 엔진.
 *
 * 이 모듈은 **순수 함수**만 포함한다. React·브라우저 API·네트워크 호출 금지.
 * 모든 계산식은 `docs/formulas` 주석과 `src/lib/__tests__/feasibility.test.ts` 의
 * 검산 테스트로 고정되어 있다.
 *
 * 단위: 금액 만원 / 면적 ㎡ / 단가 만원·평 / 비율 % / 기간 개월
 */

import type { ProjectInput } from "./types";
import { m2ToPyeong, pct, safeNumber } from "./units";

export interface AreaResult {
  /** 대지면적(㎡) */
  siteAreaM2: number;
  /** 건축면적(㎡) = 대지면적 × 건폐율 */
  buildingAreaM2: number;
  /** 지상 연면적(㎡) */
  aboveGroundAreaM2: number;
  /** 지하 연면적(㎡) */
  basementAreaM2: number;
  /** 총 연면적(㎡) = 지상 + 지하 */
  totalFloorAreaM2: number;
  /** 분양(계약)면적(㎡) = 지상 연면적 × 분양면적비율 */
  saleableAreaM2: number;
  /** 전용면적(㎡) = 분양면적 × 전용률 */
  exclusiveAreaM2: number;
  /** 실제 용적률(%) = 지상 연면적 ÷ 대지면적 */
  effectiveFar: number;
  /** 실제 건폐율(%) */
  effectiveBcr: number;
  /** 연면적 기준 지상 비중(%) */
  aboveGroundShare: number;
}

export interface RevenueResult {
  /** 분양수입(만원) */
  sales: number;
  /** 기타수입(만원) */
  other: number;
  /** 총매출(만원) */
  total: number;
  /** 분양면적 평당 실현단가(만원/평) */
  realizedUnitPricePerPyeong: number;
}

export interface LandCostResult {
  purchase: number;
  acquisitionTax: number;
  incidental: number;
  subtotal: number;
}

export interface ConstructionCostResult {
  above: number;
  basement: number;
  /** 도급공사비 = 지상 + 지하 */
  contract: number;
  designSupervision: number;
  demolitionAndOther: number;
  subtotal: number;
}

export interface IndirectCostResult {
  salesAgency: number;
  advertising: number;
  trustFee: number;
  pmFee: number;
  registration: number;
  licensingAndOther: number;
  /** 예비비 산정 기준액 (토지비계 + 공사비계 + 예비비 제외 간접비 소계) */
  contingencyBase: number;
  contingency: number;
  subtotal: number;
}

export interface FinanceCostResult {
  bridgePrincipal: number;
  bridgeInterest: number;
  bridgeFee: number;
  pfPrincipal: number;
  pfInterest: number;
  pfFee: number;
  subtotal: number;
  /** 본PF 비용계수 k = 금리×평균인출률×기간/12 + 수수료율 */
  pfCostCoefficient: number;
  /** k ≥ 1 이면 소요 PF가 발산한다. 입력 오류 신호. */
  diverged: boolean;
}

export interface CostResult {
  land: LandCostResult;
  construction: ConstructionCostResult;
  indirect: IndirectCostResult;
  finance: FinanceCostResult;
  /** 총사업비(만원) */
  total: number;
  /** 총 연면적 평당 사업비(만원/평) */
  perPyeong: number;
}

export interface ProfitResult {
  /** 사업이익(만원) = 총매출 − 총사업비 */
  profit: number;
  /** 매출액 대비 이익률(비율, 0.15 = 15%) */
  marginOnRevenue: number;
  /** 총사업비 대비 이익률 */
  marginOnCost: number;
  /** 자기자본 수익률(ROE) */
  roe: number;
  /** 연환산 자기자본 수익률 — ROE ÷ (총 사업기간/12) */
  annualizedRoe: number;
}

export interface FundingResult {
  equity: number;
  bridge: number;
  pf: number;
  /** 사업기간 중 회수한 분양대금(만원) */
  salesCollected: number;
  /** 조달 합계(브릿지는 본PF로 상환되므로 순증 기준에서 제외) */
  totalSource: number;
  /** 소요 합계 = 총사업비 − 브릿지 원금 상환분(순계 기준) */
  totalUse: number;
  /** 조달 − 소요. 0 이어야 한다. */
  gap: number;
}

export interface FeasibilityResult {
  area: AreaResult;
  revenue: RevenueResult;
  cost: CostResult;
  profit: ProfitResult;
  funding: FundingResult;
}

/** 부동소수 비교 허용오차(만원). 총사업비가 수천억이어도 1원 미만 수준. */
export const TOLERANCE = 1e-6;

/**
 * 면적 산정.
 *
 *   건축면적   = 대지면적 × 건폐율
 *   지상 연면적 = 대지면적 × 용적률   (직접입력이 있으면 그 값을 우선)
 *   총 연면적   = 지상 연면적 + 지하 연면적
 *   분양면적   = 지상 연면적 × 분양면적비율
 *   전용면적   = 분양면적 × 전용률
 */
export function computeArea(input: ProjectInput): AreaResult {
  const siteAreaM2 = Math.max(0, safeNumber(input.land.siteAreaM2));
  const buildingAreaM2 = siteAreaM2 * pct(input.zoning.buildingCoverageRatio);

  const override = Math.max(
    0,
    safeNumber(input.building.aboveGroundAreaOverrideM2),
  );
  const aboveGroundAreaM2 =
    override > 0 ? override : siteAreaM2 * pct(input.zoning.floorAreaRatio);

  const basementAreaM2 = Math.max(0, safeNumber(input.building.basementAreaM2));
  const totalFloorAreaM2 = aboveGroundAreaM2 + basementAreaM2;
  const saleableAreaM2 =
    aboveGroundAreaM2 * pct(input.building.saleableAreaRatio);
  const exclusiveAreaM2 = saleableAreaM2 * pct(input.building.exclusiveRatio);

  return {
    siteAreaM2,
    buildingAreaM2,
    aboveGroundAreaM2,
    basementAreaM2,
    totalFloorAreaM2,
    saleableAreaM2,
    exclusiveAreaM2,
    effectiveFar: siteAreaM2 > 0 ? (aboveGroundAreaM2 / siteAreaM2) * 100 : 0,
    effectiveBcr: siteAreaM2 > 0 ? (buildingAreaM2 / siteAreaM2) * 100 : 0,
    aboveGroundShare:
      totalFloorAreaM2 > 0 ? (aboveGroundAreaM2 / totalFloorAreaM2) * 100 : 0,
  };
}

/**
 * 매출 산정.
 *
 *   분양수입 = 분양면적(평) × 분양단가(만원/평) × 분양률
 *   총매출   = 분양수입 + 기타수입
 */
export function computeRevenue(
  input: ProjectInput,
  area: AreaResult,
): RevenueResult {
  const saleablePyeong = m2ToPyeong(area.saleableAreaM2);
  const unitPrice = Math.max(0, safeNumber(input.revenue.unitPricePerPyeong));
  const salesRate = pct(input.revenue.salesRate);

  const sales = saleablePyeong * unitPrice * salesRate;
  const other = safeNumber(input.revenue.otherRevenue);

  return {
    sales,
    other,
    total: sales + other,
    realizedUnitPricePerPyeong: saleablePyeong > 0 ? sales / saleablePyeong : 0,
  };
}

/**
 * 토지비.
 *
 *   토지 매입비 = 대지면적(평) × 매입단가(만원/평)
 *   취득세등    = 토지 매입비 × 취득세율
 *   부대비      = 토지 매입비 × 부대비율
 */
export function computeLandCost(
  input: ProjectInput,
  area: AreaResult,
): LandCostResult {
  const purchase =
    m2ToPyeong(area.siteAreaM2) *
    Math.max(0, safeNumber(input.land.unitPricePerPyeong));
  const acquisitionTax = purchase * pct(input.land.acquisitionTaxRate);
  const incidental = purchase * pct(input.land.incidentalRate);

  return {
    purchase,
    acquisitionTax,
    incidental,
    subtotal: purchase + acquisitionTax + incidental,
  };
}

/**
 * 공사비.
 *
 *   지상 공사비 = 지상 연면적(평) × 지상 단가
 *   지하 공사비 = 지하 연면적(평) × 지하 단가
 *   도급공사비  = 지상 + 지하
 *   설계·감리비 = 도급공사비 × 요율
 */
export function computeConstructionCost(
  input: ProjectInput,
  area: AreaResult,
): ConstructionCostResult {
  const above =
    m2ToPyeong(area.aboveGroundAreaM2) *
    Math.max(0, safeNumber(input.construction.unitCostAbovePerPyeong));
  const basement =
    m2ToPyeong(area.basementAreaM2) *
    Math.max(0, safeNumber(input.construction.unitCostBasementPerPyeong));
  const contract = above + basement;
  const designSupervision =
    contract * pct(input.construction.designSupervisionRate);
  const demolitionAndOther = safeNumber(
    input.construction.demolitionAndOther,
  );

  return {
    above,
    basement,
    contract,
    designSupervision,
    demolitionAndOther,
    subtotal: contract + designSupervision + demolitionAndOther,
  };
}

/**
 * 간접비(판매관리비).
 *
 * 분양수입 연동 항목(대행수수료·광고비·신탁수수료)과 공사비 연동 항목
 * (PM비·보존등기비)을 분리한다. 예비비는 나머지 전부를 기준으로 한다.
 */
export function computeIndirectCost(
  input: ProjectInput,
  revenue: RevenueResult,
  land: LandCostResult,
  construction: ConstructionCostResult,
): IndirectCostResult {
  const salesAgency = revenue.sales * pct(input.indirect.salesAgencyRate);
  const advertising = revenue.sales * pct(input.indirect.advertisingRate);
  const trustFee = revenue.sales * pct(input.indirect.trustFeeRate);
  const pmFee = construction.contract * pct(input.indirect.pmFeeRate);
  const registration =
    construction.contract * pct(input.indirect.registrationRate);
  const licensingAndOther = safeNumber(input.indirect.licensingAndOther);

  const beforeContingency =
    salesAgency +
    advertising +
    trustFee +
    pmFee +
    registration +
    licensingAndOther;

  const contingencyBase =
    land.subtotal + construction.subtotal + beforeContingency;
  const contingency = contingencyBase * pct(input.indirect.contingencyRate);

  return {
    salesAgency,
    advertising,
    trustFee,
    pmFee,
    registration,
    licensingAndOther,
    contingencyBase,
    contingency,
    subtotal: beforeContingency + contingency,
  };
}

/**
 * 금융비.
 *
 * 브릿지론은 토지비를 담보로 조달하고 본PF 기표 시 상환된다. 따라서 원금은
 * 조달·상환이 상계되어 **순비용은 이자와 수수료만** 남는다.
 *
 *   브릿지 원금 = 토지비계 × LTV
 *   브릿지 비용 = 원금 × (금리 × 기간/12 + 수수료율)
 *
 * 본PF 소요액은 순환참조를 갖는다. (PF 원금 → 금융비 → 총사업비 → PF 원금)
 * 금융비가 원금에 선형이므로 닫힌 해가 존재한다.
 *
 *   base = 금융비 제외 총사업비 + 브릿지 비용 − 자기자본 − 기중 분양대금 회수액
 *   k    = PF금리 × 평균인출률 × 기간/12 + PF수수료율
 *   P    = base + k·P        ⟹  P = base / (1 − k)
 *
 * k ≥ 1 이면 발산하므로 `diverged` 로 표시하고 원금을 0으로 둔다(입력 오류).
 */
export interface FinanceArgs {
  input: ProjectInput;
  /** 토지비계(만원) — 브릿지론 한도 산정 기준 */
  landSubtotal: number;
  /** 금융비를 제외한 총사업비(만원) */
  costExFinance: number;
  /** 사업기간 중 회수한 분양대금(만원) */
  salesCollected: number;
}

export function computeFinanceCost({
  input,
  landSubtotal,
  costExFinance,
  salesCollected,
}: FinanceArgs): FinanceCostResult {
  const f = input.finance;

  const bridgePrincipal = landSubtotal * pct(f.bridgeLtv);
  const bridgeInterest =
    bridgePrincipal * pct(f.bridgeRate) * (Math.max(0, safeNumber(f.bridgeMonths)) / 12);
  const bridgeFee = bridgePrincipal * pct(f.bridgeFeeRate);
  const bridgeCost = bridgeInterest + bridgeFee;

  const pfCostCoefficient =
    pct(f.pfRate) *
      pct(f.pfAvgDrawRate) *
      (Math.max(0, safeNumber(f.pfMonths)) / 12) +
    pct(f.pfFeeRate);

  const base =
    costExFinance + bridgeCost - Math.max(0, safeNumber(f.equity)) - salesCollected;

  const diverged = pfCostCoefficient >= 1;
  const pfPrincipal =
    diverged || base <= 0 ? 0 : base / (1 - pfCostCoefficient);

  const pfInterest =
    pfPrincipal *
    pct(f.pfRate) *
    pct(f.pfAvgDrawRate) *
    (Math.max(0, safeNumber(f.pfMonths)) / 12);
  const pfFee = pfPrincipal * pct(f.pfFeeRate);

  return {
    bridgePrincipal,
    bridgeInterest,
    bridgeFee,
    pfPrincipal,
    pfInterest,
    pfFee,
    subtotal: bridgeInterest + bridgeFee + pfInterest + pfFee,
    pfCostCoefficient,
    diverged,
  };
}

/** 전체 수지분석. 입력만으로 결정되는 순수 함수. */
export function computeFeasibility(input: ProjectInput): FeasibilityResult {
  const area = computeArea(input);
  const revenue = computeRevenue(input, area);
  const land = computeLandCost(input, area);
  const construction = computeConstructionCost(input, area);
  const indirect = computeIndirectCost(input, revenue, land, construction);

  const costExFinance =
    land.subtotal + construction.subtotal + indirect.subtotal;

  const salesCollected =
    revenue.sales * pct(input.finance.salesCollectionRate);

  const finance = computeFinanceCost({
    input,
    landSubtotal: land.subtotal,
    costExFinance,
    salesCollected,
  });

  const total = costExFinance + finance.subtotal;
  const profit = revenue.total - total;
  const equity = Math.max(0, safeNumber(input.finance.equity));
  const totalMonths = Math.max(1, safeNumber(input.meta.totalMonths, 1));

  const marginOnRevenue = revenue.total > 0 ? profit / revenue.total : 0;
  const marginOnCost = total > 0 ? profit / total : 0;
  const roe = equity > 0 ? profit / equity : 0;

  const totalSource = equity + finance.pfPrincipal + salesCollected;
  const totalUse = costExFinance + finance.subtotal;

  return {
    area,
    revenue,
    cost: {
      land,
      construction,
      indirect,
      finance,
      total,
      perPyeong:
        area.totalFloorAreaM2 > 0
          ? total / m2ToPyeong(area.totalFloorAreaM2)
          : 0,
    },
    profit: {
      profit,
      marginOnRevenue,
      marginOnCost,
      roe,
      annualizedRoe: roe / (totalMonths / 12),
    },
    funding: {
      equity,
      bridge: finance.bridgePrincipal,
      pf: finance.pfPrincipal,
      salesCollected,
      totalSource,
      totalUse,
      gap: totalSource - totalUse,
    },
  };
}
