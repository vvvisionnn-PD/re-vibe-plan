import type { NextRequest } from "next/server";
import { parseAreaParam, yearsAgo, type SubscriptionResponse } from "@/lib/market";
import { errorResponse, fetchSubscriptions } from "@/lib/server/datagokr";

/**
 * GET /api/market/subscription?area=시도 시군구
 * 청약홈 — 공급위치 LIKE 지역명 · 최근 3년 APT 분양 공고와 잔여세대 공고.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const area = parseAreaParam(request.nextUrl.searchParams.get("area"));
  if (area === null) return Response.json({ error: "area: 시도 · 시군구 전체 이름이 필요합니다" }, { status: 400 });
  try {
    const since = yearsAgo(new Date());
    const { announcements, remainders, fetchedAt } = await fetchSubscriptions(area, since);
    const body: SubscriptionResponse = { area, since, announcements, remainders, asOf: fetchedAt };
    return Response.json(body);
  } catch (e) {
    return errorResponse(e);
  }
}
