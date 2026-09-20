import type { HousingType, PlanInput } from "./calc.ts";

/**
 * 임시 값 버튼 3개 — 값은 앞 장 표(A · B · C)를 그대로 옮긴 것이다.
 * 표에 없는 숫자는 채우지 않는다.
 *
 * 표와의 대응
 * - 사업대상지: 표의 약칭을 전체 이름으로 적었다 (부산 → 부산광역시, 경기 → 경기도, 대전 → 대전광역시).
 * - 주택형: 표의 "59㎡ 200 · 84㎡ 320"은 이름·세대수, 각주의 전용면적·공급면적(평)을 행마다 넣었다.
 * - 상가 · 기타유입, 본PF · 금융비용은 표의 "앞 · 뒤" 순서 그대로다. 금액 단위는 억원.
 *
 * 표에 적힌 검산 기준값 (분양률 100%, 계획 평당가)
 * - A 기말현금 +380.3억 · B +450.0억 · C +210.0억
 */

/** 임시 값에 들어가는 항목 (주택형 행 id는 불러올 때 새로 붙인다) */
export type PresetValues = Omit<PlanInput, "housingTypes"> & {
  housingTypes: Omit<HousingType, "id">[];
};

/** 임시 값 버튼 하나 */
export interface Preset {
  /** 버튼 이름 */
  label: string;
  /** 앞 장 표의 값. 아직 옮기지 않았으면 null */
  values: PresetValues | null;
}

export const PRESETS: [Preset, Preset, Preset] = [
  {
    label: "A 해운대 그린테라스",
    values: {
      projectName: "해운대 그린테라스",
      sido: "부산광역시",
      sigungu: "해운대구",
      housingTypes: [
        { name: "59㎡", exclusiveM2: 59.9, supplyPyeong: 25.6, units: 200 },
        { name: "84㎡", exclusiveM2: 84.9, supplyPyeong: 34.6, units: 320 },
      ],
      pricePerPyeong: 2420,
      retail: 150,
      otherInflow: 175,
      fixedCost: 3815.0,
      seniorPf: 2450,
      seniorPfFinanceCost: 480,
      subordinated: 400,
    },
  },
  {
    label: "B 영통 센트럴파크",
    values: {
      projectName: "영통 센트럴파크",
      sido: "경기도",
      sigungu: "수원시 영통구",
      housingTypes: [
        { name: "59㎡", exclusiveM2: 59.8, supplyPyeong: 25.4, units: 300 },
        { name: "84㎡", exclusiveM2: 84.9, supplyPyeong: 34.3, units: 480 },
      ],
      pricePerPyeong: 2650,
      retail: 180,
      otherInflow: 260,
      fixedCost: 6296.4,
      seniorPf: 4100,
      seniorPfFinanceCost: 820,
      subordinated: 600,
    },
  },
  {
    label: "C 유성 리버뷰",
    values: {
      projectName: "유성 리버뷰",
      sido: "대전광역시",
      sigungu: "유성구",
      housingTypes: [
        { name: "74㎡", exclusiveM2: 74.6, supplyPyeong: 30.8, units: 140 },
        { name: "84㎡", exclusiveM2: 84.9, supplyPyeong: 34.5, units: 240 },
      ],
      pricePerPyeong: 1980,
      retail: 90,
      otherInflow: 120,
      fixedCost: 2461.2,
      seniorPf: 1650,
      seniorPfFinanceCost: 330,
      subordinated: 260,
    },
  },
];

/**
 * 임시 값을 입력값으로 바꾼다. 현재 입력은 모두 덮어쓴다.
 * makeId는 주택형 행 id를 만드는 함수다.
 */
export function applyPreset(values: PresetValues, makeId: () => string): PlanInput {
  return {
    ...values,
    housingTypes: values.housingTypes.map((row) => ({ ...row, id: makeId() })),
  };
}
