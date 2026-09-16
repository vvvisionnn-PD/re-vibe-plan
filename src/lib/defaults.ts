/**
 * 사업유형별 초기 입력 프리셋.
 *
 * 여기의 숫자는 **출발점일 뿐 실제 시장가가 아니다.** 실제 검토 시에는
 * 사업지 조건에 맞는 값으로 반드시 교체해야 한다.
 * (2) 단계에서 공공데이터로 일부 항목을 자동 보정할 예정이다.
 */

import type { ProjectInput, UseType } from "./types";

export const BASE_INPUT: ProjectInput = {
  meta: {
    projectName: "신규 개발사업",
    address: "",
    useType: "공동주택",
    landUseZone: "제3종일반주거지역",
    developer: "",
    totalMonths: 42,
    constructionMonths: 30,
  },
  land: {
    siteAreaM2: 5000,
    unitPricePerPyeong: 2000,
    acquisitionTaxRate: 4.6,
    incidentalRate: 2,
  },
  zoning: {
    buildingCoverageRatio: 50,
    floorAreaRatio: 250,
  },
  building: {
    aboveGroundAreaOverrideM2: 0,
    basementAreaM2: 6000,
    saleableAreaRatio: 100,
    exclusiveRatio: 72,
    floorsAbove: 20,
    floorsBelow: 2,
    parkingCount: 180,
  },
  revenue: {
    unitPricePerPyeong: 2700,
    salesRate: 100,
    otherRevenue: 0,
  },
  construction: {
    unitCostAbovePerPyeong: 750,
    unitCostBasementPerPyeong: 600,
    designSupervisionRate: 5,
    demolitionAndOther: 100000,
  },
  indirect: {
    salesAgencyRate: 1.5,
    advertisingRate: 1.5,
    trustFeeRate: 1,
    pmFeeRate: 1,
    registrationRate: 0.8,
    licensingAndOther: 200000,
    contingencyRate: 2,
  },
  finance: {
    equity: 1000000,
    bridgeLtv: 70,
    bridgeRate: 8,
    bridgeFeeRate: 2,
    bridgeMonths: 12,
    pfRate: 7,
    pfFeeRate: 2,
    pfMonths: 30,
    pfAvgDrawRate: 65,
    salesCollectionRate: 50,
  },
};

type Preset = {
  label: UseType;
  description: string;
  patch: {
    meta?: Partial<ProjectInput["meta"]>;
    land?: Partial<ProjectInput["land"]>;
    zoning?: Partial<ProjectInput["zoning"]>;
    building?: Partial<ProjectInput["building"]>;
    revenue?: Partial<ProjectInput["revenue"]>;
    construction?: Partial<ProjectInput["construction"]>;
    indirect?: Partial<ProjectInput["indirect"]>;
    finance?: Partial<ProjectInput["finance"]>;
  };
};

export const PRESETS: Preset[] = [
  {
    label: "공동주택",
    description: "제3종일반주거 · 용적률 250% · 전용률 72%",
    patch: {},
  },
  {
    label: "오피스텔",
    description: "준주거 · 용적률 400% · 전용률 50%",
    patch: {
      meta: { landUseZone: "준주거지역", totalMonths: 36, constructionMonths: 26 },
      zoning: { buildingCoverageRatio: 60, floorAreaRatio: 400 },
      building: { exclusiveRatio: 50, floorsAbove: 15, floorsBelow: 3 },
      revenue: { unitPricePerPyeong: 2200 },
      construction: {
        unitCostAbovePerPyeong: 720,
        unitCostBasementPerPyeong: 620,
      },
    },
  },
  {
    label: "지식산업센터",
    description: "준공업 · 용적률 400% · 전용률 50%",
    patch: {
      meta: { landUseZone: "준공업지역", totalMonths: 36, constructionMonths: 24 },
      zoning: { buildingCoverageRatio: 60, floorAreaRatio: 400 },
      building: { exclusiveRatio: 50, floorsAbove: 12, floorsBelow: 3 },
      revenue: { unitPricePerPyeong: 1300, salesRate: 85 },
      construction: {
        unitCostAbovePerPyeong: 680,
        unitCostBasementPerPyeong: 600,
      },
      land: { unitPricePerPyeong: 1200 },
    },
  },
  {
    label: "물류센터",
    description: "계획관리 · 용적률 100% · 저층 대형",
    patch: {
      meta: { landUseZone: "계획관리지역", totalMonths: 30, constructionMonths: 20 },
      land: { siteAreaM2: 30000, unitPricePerPyeong: 250 },
      zoning: { buildingCoverageRatio: 40, floorAreaRatio: 100 },
      building: {
        basementAreaM2: 0,
        exclusiveRatio: 90,
        floorsAbove: 4,
        floorsBelow: 0,
        parkingCount: 120,
      },
      revenue: { unitPricePerPyeong: 700, salesRate: 100 },
      construction: {
        unitCostAbovePerPyeong: 420,
        unitCostBasementPerPyeong: 0,
      },
    },
  },
  {
    label: "생활숙박시설",
    description: "일반상업 · 용적률 600%",
    patch: {
      meta: { landUseZone: "일반상업지역", totalMonths: 40, constructionMonths: 28 },
      land: { siteAreaM2: 3000, unitPricePerPyeong: 3500 },
      zoning: { buildingCoverageRatio: 60, floorAreaRatio: 600 },
      building: { basementAreaM2: 4500, exclusiveRatio: 45, floorsAbove: 20, floorsBelow: 3 },
      revenue: { unitPricePerPyeong: 2600, salesRate: 90 },
      construction: {
        unitCostAbovePerPyeong: 800,
        unitCostBasementPerPyeong: 650,
      },
    },
  },
  {
    label: "업무시설",
    description: "일반상업 · 용적률 800% · 임대형",
    patch: {
      meta: { landUseZone: "일반상업지역", totalMonths: 44, constructionMonths: 30 },
      land: { siteAreaM2: 4000, unitPricePerPyeong: 4000 },
      zoning: { buildingCoverageRatio: 60, floorAreaRatio: 800 },
      building: { basementAreaM2: 12000, exclusiveRatio: 48, floorsAbove: 25, floorsBelow: 5 },
      revenue: { unitPricePerPyeong: 3200, salesRate: 95 },
      construction: {
        unitCostAbovePerPyeong: 900,
        unitCostBasementPerPyeong: 700,
      },
    },
  },
  {
    label: "근린생활시설",
    description: "근린상업 · 용적률 400%",
    patch: {
      meta: { landUseZone: "근린상업지역", totalMonths: 28, constructionMonths: 18 },
      land: { siteAreaM2: 1500, unitPricePerPyeong: 3000 },
      zoning: { buildingCoverageRatio: 60, floorAreaRatio: 400 },
      building: { basementAreaM2: 1500, exclusiveRatio: 55, floorsAbove: 8, floorsBelow: 1 },
      revenue: { unitPricePerPyeong: 2400, salesRate: 80 },
      construction: {
        unitCostAbovePerPyeong: 700,
        unitCostBasementPerPyeong: 600,
      },
    },
  },
];

/** 프리셋을 기준 입력에 덮어써 완전한 ProjectInput 을 만든다. */
export function buildPreset(useType: UseType): ProjectInput {
  const preset = PRESETS.find((p) => p.label === useType) ?? PRESETS[0];
  const base = BASE_INPUT;
  return {
    meta: { ...base.meta, ...preset.patch.meta, useType },
    land: { ...base.land, ...preset.patch.land },
    zoning: { ...base.zoning, ...preset.patch.zoning },
    building: { ...base.building, ...preset.patch.building },
    revenue: { ...base.revenue, ...preset.patch.revenue },
    construction: { ...base.construction, ...preset.patch.construction },
    indirect: { ...base.indirect, ...preset.patch.indirect },
    finance: { ...base.finance, ...preset.patch.finance },
  };
}

/** 용도지역별 법정 상한 (건폐율 %, 용적률 %). 개략 검토용 참고값. */
export const ZONE_LIMITS: Record<string, { bcr: number; far: number }> = {
  제1종일반주거지역: { bcr: 60, far: 200 },
  제2종일반주거지역: { bcr: 60, far: 250 },
  제3종일반주거지역: { bcr: 50, far: 300 },
  준주거지역: { bcr: 70, far: 500 },
  일반상업지역: { bcr: 80, far: 1300 },
  중심상업지역: { bcr: 90, far: 1500 },
  근린상업지역: { bcr: 70, far: 900 },
  준공업지역: { bcr: 70, far: 400 },
  일반공업지역: { bcr: 70, far: 350 },
  계획관리지역: { bcr: 40, far: 100 },
};
