/**
 * 사업계획서 입력 스키마.
 *
 * 단위 규칙 (엄수)
 * - 금액: 만원
 * - 면적: ㎡
 * - 단가: 만원/평
 * - 비율: 백분율 숫자 (예: 4.6 은 4.6%)
 * - 기간: 개월
 */

export const USE_TYPES = [
  "공동주택",
  "오피스텔",
  "지식산업센터",
  "물류센터",
  "생활숙박시설",
  "업무시설",
  "근린생활시설",
] as const;

export type UseType = (typeof USE_TYPES)[number];

export const LAND_USE_ZONES = [
  "제1종일반주거지역",
  "제2종일반주거지역",
  "제3종일반주거지역",
  "준주거지역",
  "일반상업지역",
  "중심상업지역",
  "근린상업지역",
  "준공업지역",
  "일반공업지역",
  "계획관리지역",
] as const;

export type LandUseZone = (typeof LAND_USE_ZONES)[number];

export interface ProjectMeta {
  /** 사업명 */
  projectName: string;
  /** 사업대상지 주소 */
  address: string;
  /** 사업 유형 */
  useType: UseType;
  /** 용도지역 */
  landUseZone: LandUseZone;
  /** 사업 시행자 */
  developer: string;
  /** 총 사업기간(개월) — 토지매입 ~ 정산 */
  totalMonths: number;
  /** 공사기간(개월) */
  constructionMonths: number;
}

export interface LandInput {
  /** 대지면적(㎡) */
  siteAreaM2: number;
  /** 토지 매입단가(만원/평) */
  unitPricePerPyeong: number;
  /** 취득세등 요율(%) — 토지 매입비 대비. 통상 4.6% */
  acquisitionTaxRate: number;
  /** 토지 부대비 요율(%) — 중개·법무·명도·측량 등. 토지 매입비 대비 */
  incidentalRate: number;
}

export interface ZoningInput {
  /** 적용 건폐율(%) */
  buildingCoverageRatio: number;
  /** 적용 용적률(%) */
  floorAreaRatio: number;
}

export interface BuildingInput {
  /**
   * 지상 연면적 직접입력(㎡). 0 이면 `대지면적 × 용적률` 로 자동 산정한다.
   * (발코니 확장·다락 등 용적률 산정에서 제외되는 면적을 반영하려면 직접 입력)
   */
  aboveGroundAreaOverrideM2: number;
  /** 지하 연면적(㎡) */
  basementAreaM2: number;
  /** 분양(계약)면적 비율(%) — 지상 연면적 대비 */
  saleableAreaRatio: number;
  /** 전용률(%) — 분양(계약)면적 대비 전용면적 */
  exclusiveRatio: number;
  /** 지상 층수 */
  floorsAbove: number;
  /** 지하 층수 */
  floorsBelow: number;
  /** 주차대수(참고) */
  parkingCount: number;
}

export interface RevenueInput {
  /** 분양단가(만원/평) — 분양(계약)면적 기준 */
  unitPricePerPyeong: number;
  /** 분양률(%) */
  salesRate: number;
  /** 기타수입(만원) — 상가 임대보증금, 광고수입 등 */
  otherRevenue: number;
}

export interface ConstructionInput {
  /** 지상 공사단가(만원/평) */
  unitCostAbovePerPyeong: number;
  /** 지하 공사단가(만원/평) */
  unitCostBasementPerPyeong: number;
  /** 설계·감리비 요율(%) — 도급공사비 대비 */
  designSupervisionRate: number;
  /** 철거·토목·인입 등 기타 공사비(만원) */
  demolitionAndOther: number;
}

export interface IndirectInput {
  /** 분양대행 수수료 요율(%) — 분양수입 대비 */
  salesAgencyRate: number;
  /** 광고·홍보비 요율(%) — 분양수입 대비 */
  advertisingRate: number;
  /** 신탁 수수료 요율(%) — 분양수입 대비 */
  trustFeeRate: number;
  /** PM·일반관리비 요율(%) — 도급공사비 대비 */
  pmFeeRate: number;
  /** 보존등기비 요율(%) — 도급공사비 대비 */
  registrationRate: number;
  /** 인허가·용역비 등(만원) */
  licensingAndOther: number;
  /** 예비비 요율(%) — (토지비 + 공사비 + 간접비소계) 대비 */
  contingencyRate: number;
}

export interface FinanceInput {
  /** 자기자본(만원) */
  equity: number;
  /** 브릿지론 LTV(%) — 토지비계 대비 */
  bridgeLtv: number;
  /** 브릿지론 금리(%, 연) */
  bridgeRate: number;
  /** 브릿지론 수수료 요율(%) */
  bridgeFeeRate: number;
  /** 브릿지론 기간(개월) */
  bridgeMonths: number;
  /** 본PF 금리(%, 연) */
  pfRate: number;
  /** 본PF 수수료 요율(%) */
  pfFeeRate: number;
  /** 본PF 기간(개월) */
  pfMonths: number;
  /** 본PF 평균 인출률(%) — 기간 중 평균 잔액 비중. 이자 산정에 사용 */
  pfAvgDrawRate: number;
  /** 사업기간 중 분양대금 회수율(%) — 준공 전 유입되어 PF 소요액을 줄이는 비중 */
  salesCollectionRate: number;
}

export interface ProjectInput {
  meta: ProjectMeta;
  land: LandInput;
  zoning: ZoningInput;
  building: BuildingInput;
  revenue: RevenueInput;
  construction: ConstructionInput;
  indirect: IndirectInput;
  finance: FinanceInput;
}

export type SectionKey = keyof ProjectInput;
