/**
 * GET /api/region?q=서울특별시
 *
 * 법정동코드 API 로 시군구 후보를 돌려준다.
 * 브라우저는 지역 이름만 보내고, 코드 조회는 서버에서만 한다 (조회에도 인증키가 필요하다).
 */

import { 지역코드5 } from "~/lib/marketParse";
import { 시군구후보조회 } from "~/lib/server/publicData";
import { 오류문구, 조회일 } from "~/lib/server/office";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return Response.json(
      { ok: false, 후보: [], 조회일: 조회일(), 오류: "q 가 비어 있다" },
      { status: 400 },
    );
  }

  try {
    const rows = await 시군구후보조회(q);
    return Response.json({
      ok: true,
      질의: q,
      조회일: 조회일(),
      출처: "공공데이터포털",
      출처상세: "행정안전부 행정표준코드 법정동코드",
      후보: rows.map((r) => ({
        전체이름: r.locatadd_nm ?? "",
        시군구: r.locallow_nm ?? "",
        법정동코드: r.region_cd ?? "",
        지역코드5: 지역코드5(r.region_cd ?? ""),
      })),
      오류: null,
    });
  } catch (e) {
    return Response.json(
      { ok: false, 질의: q, 후보: [], 조회일: 조회일(), 오류: 오류문구(e) },
      { status: 502 },
    );
  }
}
