import type { NextRequest } from "next/server";
import { isYm, parseAreaParam, type PresaleResponse } from "@/lib/market";
import { errorResponse, fetchPresaleMonth, resolveArea } from "@/lib/server/datagokr";

/**
 * GET /api/market/presale?area=시도 시군구&ym=YYYYMM
 * 아파트 분양권 전매 한 달치 — 입주권 · 해제 거래 제외.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const params = request.nextUrl.searchParams;
  const area = parseAreaParam(params.get("area"));
  const ym = params.get("ym");
  if (area === null) return Response.json({ error: "area: 시도 · 시군구 전체 이름이 필요합니다" }, { status: 400 });
  if (!isYm(ym)) return Response.json({ error: "ym: YYYYMM 형식이어야 합니다" }, { status: 400 });
  try {
    const region = await resolveArea(area);
    const { fetchedAt, ...month } = await fetchPresaleMonth(region.code, ym);
    const body: PresaleResponse = { area, ...month, asOf: fetchedAt };
    return Response.json(body);
  } catch (e) {
    return errorResponse(e);
  }
}
