import type { NextRequest } from "next/server";
import { isYm, parseAreaParam, type RentResponse } from "@/lib/market";
import { errorResponse, fetchRentMonth, resolveArea } from "@/lib/server/datagokr";

/**
 * GET /api/market/rent?area=시도 시군구&ym=YYYYMM
 * 아파트 전월세 한 달치 — 84㎡ 신규 전세만 남긴다 (기술문서에 해제여부 항목 없음).
 */
export async function GET(request: NextRequest): Promise<Response> {
  const params = request.nextUrl.searchParams;
  const area = parseAreaParam(params.get("area"));
  const ym = params.get("ym");
  if (area === null) return Response.json({ error: "area: 시도 · 시군구 전체 이름이 필요합니다" }, { status: 400 });
  if (!isYm(ym)) return Response.json({ error: "ym: YYYYMM 형식이어야 합니다" }, { status: 400 });
  try {
    const region = await resolveArea(area);
    const { fetchedAt, ...month } = await fetchRentMonth(region.code, ym);
    const body: RentResponse = { area, ...month, asOf: fetchedAt };
    return Response.json(body);
  } catch (e) {
    return errorResponse(e);
  }
}
