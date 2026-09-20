import type { NextRequest } from "next/server";
import { isNoParam, parseAreaParam, type DetailResponse } from "@/lib/market";
import { errorResponse, fetchSubscriptionDetail } from "@/lib/server/datagokr";

/**
 * GET /api/market/subscription/detail?area=시도 시군구&id=주택관리번호&pblanc=공고번호
 * 청약홈 — 공고 하나의 주택형별 분양가(분양최고금액)와 1 · 2순위 경쟁률.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const params = request.nextUrl.searchParams;
  const area = parseAreaParam(params.get("area"));
  const id = params.get("id");
  const pblanc = params.get("pblanc");
  if (area === null) return Response.json({ error: "area: 시도 · 시군구 전체 이름이 필요합니다" }, { status: 400 });
  if (!isNoParam(id) || !isNoParam(pblanc)) {
    return Response.json({ error: "id · pblanc: 숫자여야 합니다" }, { status: 400 });
  }
  try {
    const { fetchedAt, ...detail } = await fetchSubscriptionDetail(id, pblanc);
    const body: DetailResponse = { area, ...detail, asOf: fetchedAt };
    return Response.json(body);
  } catch (e) {
    return errorResponse(e);
  }
}
