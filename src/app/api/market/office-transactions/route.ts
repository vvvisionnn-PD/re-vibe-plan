/**
 * GET /api/market/office-transactions?area=서울특별시 강남구&ym=202502
 *
 * 인근 상업업무용 매매 실거래 — 최근 1년, 업무시설 용도만.
 * 실거래가 API 는 한 달씩만 조회되므로 12번 부른다(하루 캐시, 동시 4개).
 * 해제된 거래와 면적·금액이 빈 건은 사유별로 세어 함께 돌려준다.
 */

import { 실거래조회하기 } from "~/lib/server/office";

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const area = sp.get("area")?.trim() ?? "";
  const ym = sp.get("ym")?.trim() || null;

  if (!area) {
    return Response.json(
      { ok: false, 오류: "area 가 비어 있다" },
      { status: 400 },
    );
  }

  const 결과 = await 실거래조회하기(area, ym);
  return Response.json(결과, { status: 결과.ok ? 200 : 502 });
}
