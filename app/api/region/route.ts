import type { NextRequest } from "next/server";
import { parseAreaParam, pickRegion, type RegionResponse } from "@/lib/market";
import { errorResponse, findRegions } from "@/lib/server/datagokr";

/**
 * GET /api/region?q=시도 시군구
 * 법정동코드 API로 시군구 후보를 찾아 돌려준다. 이름이 정확히 같은 후보가 하나면 region에 담는다.
 * 브라우저는 이름만 보내고, 코드는 서버가 확인한다.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const area = parseAreaParam(request.nextUrl.searchParams.get("q"));
  if (area === null) return Response.json({ error: "q: 시도 · 시군구 전체 이름이 필요합니다" }, { status: 400 });
  try {
    const { candidates, fetchedAt } = await findRegions(area);
    const picked = pickRegion(candidates, area);
    const body: RegionResponse = {
      area,
      region: picked.ok ? picked.region : null,
      candidates,
      reason: picked.ok ? null : picked.reason,
      asOf: fetchedAt,
    };
    return Response.json(body);
  } catch (e) {
    return errorResponse(e);
  }
}
