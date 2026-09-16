/**
 * GET /api/market/office-yield?area=서울특별시 강남구&ym=202502
 *
 * area(사업대상지 이름)만 받아 서버에서 CLS_ID 를 확인한 뒤 R-ONE 을 호출한다.
 * ym 을 주면 그 시점만, 없으면 최근 구간에서 값이 있는 가장 최근 시점을 쓴다.
 * cls 를 주면 사용자가 확정한 상권(CLS_ID)을 쓴다.
 * DTACYCLE_CD 는 SttsApiTbl.do 로 확인해 쓰고 추정하지 않는다.
 */

import { 지표조회 } from "~/lib/server/office";

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const area = sp.get("area")?.trim() ?? "";
  const ym = sp.get("ym")?.trim() || null;
  // 사용자가 화면 드롭다운에서 확정한 상권. 없으면 서버가 자동 추린 1순위를 쓴다.
  const cls = sp.get("cls")?.trim() || null;

  if (!area) {
    return Response.json(
      { ok: false, 오류: "area 가 비어 있다" },
      { status: 400 },
    );
  }

  const 결과 = await 지표조회("수익률", area, ym, cls);
  return Response.json(결과, { status: 결과.ok ? 200 : 502 });
}
