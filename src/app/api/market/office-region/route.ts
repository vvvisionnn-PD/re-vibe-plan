/**
 * GET /api/market/office-region?area=서울특별시 강남구[&cls=510004]
 *
 * 네 통계표 각각에 SttsApiTblItm.do(ITM_TAG=분류)를 호출해 상권 목록을 받고,
 * 사업대상지 시군구명과 **부분일치 우선순위**로 후보 3~5개를 추린다.
 * 같은 시도의 권역·상권 전체 목록도 함께 준다 — 자동 추림이 비어도 고를 수 있어야 한다.
 * 최종 확정은 화면에서 사람이 한다. `cls` 를 주면 그 상권을 적용한 결과를 돌려준다.
 *
 * 목록은 코드성 데이터라 30일 캐시된다 (publicData.분류목록조회).
 *
 * [확인 필요] 2024년 3분기 상권 재구획으로 상권명이 예전과 달라졌을 수 있다.
 * 반드시 "2024년3분기~" 시리즈 응답의 상권명만 쓸 것 — 구 시리즈(2022년~)와 혼용 금지.
 */

import { 상권구획도 } from "~/lib/market";
import type { 지역해석, 지표종류 } from "~/lib/market";
import { 오류문구, 조회일, 지역해석하기, 통계표ID } from "~/lib/server/office";

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const area = sp.get("area")?.trim() ?? "";
  const cls = sp.get("cls")?.trim() || null;

  if (!area) {
    return Response.json(
      { ok: false, 통계표별: {}, 조회일: 조회일(), 오류: "area 가 비어 있다" },
      { status: 400 },
    );
  }

  const 지표들 = Object.keys(통계표ID) as 지표종류[];
  const 결과: Record<string, 지역해석 | { 오류: string }> = {};
  let 성공 = 0;

  await Promise.all(
    지표들.map(async (지표) => {
      try {
        결과[지표] = await 지역해석하기(통계표ID[지표], area, cls);
        성공 += 1;
      } catch (e) {
        결과[지표] = { 오류: 오류문구(e) };
      }
    }),
  );

  // 네 통계표의 상권 목록이 같은지 확인한다. 다르면 지표마다 다른 상권을 보게 된다.
  const 경고: string[] = [];
  const 해석들 = 지표들
    .map((k) => 결과[k])
    .filter((v): v is 지역해석 => !("오류" in v));
  const 목록지문 = new Set(
    해석들.map((h) => h.시도목록.map((c) => c.CLS_ID).join(",")),
  );
  if (목록지문.size > 1) {
    경고.push(
      "네 통계표의 상권 목록이 서로 다르다. 지표별로 상권을 따로 확정해야 한다. [확인 필요]",
    );
  }

  const 대표 = 해석들[0] ?? null;

  return Response.json(
    {
      ok: 성공 > 0,
      area,
      조회일: 조회일(),
      출처: "R-ONE",
      출처상세: "한국부동산원 R-ONE · SttsApiTblItm.do (ITM_TAG=분류)",
      구획도: 상권구획도,
      // 목록이 모두 같을 때만 대표값을 쓴다 (화면 드롭다운용)
      공통: 목록지문.size === 1 && 대표 ? 대표 : null,
      통계표별: 결과,
      경고,
      오류: 성공 === 0 ? "모든 통계표의 상권 목록 조회에 실패했다" : null,
    },
    { status: 성공 > 0 ? 200 : 502 },
  );
}
