// 공유 링크 검산 — 실행: npm test (node --test)
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { decodePlan, encodePlan, planFromHash, shareUrl, SHARE_KEY } from "./share.ts";
import { emptyInput } from "./calc.ts";
import { applyPreset, PRESETS } from "./presets.ts";

let seq = 0;
const A = applyPreset(PRESETS[0].values!, () => `s${seq++}`);

describe("공유 링크", () => {
  it("입력값을 담았다 꺼내면 그대로다 (한글 포함)", () => {
    assert.deepEqual(decodePlan(encodePlan(A)), A);
    const empty = emptyInput();
    assert.deepEqual(decodePlan(encodePlan(empty)), empty);
  });

  it("링크는 해시(#plan=)에 담는다 — 해시는 서버로 전송되지 않는다", () => {
    const url = shareUrl("https://example.com/path?q=1", A);
    assert.ok(url.startsWith(`https://example.com/path?q=1#${SHARE_KEY}=`));
    assert.deepEqual(planFromHash(new URL(url).hash), A);
  });

  it("기존 해시는 덮어쓴다", () => {
    const url = shareUrl("https://example.com/#plan=old", A);
    assert.equal(url.split("#").length, 2);
    assert.deepEqual(planFromHash(new URL(url).hash), A);
  });

  it("주택형 id가 없으면 새로 붙인다", () => {
    const noId = encodePlan({ ...A, housingTypes: A.housingTypes.map((h) => ({ ...h, id: "" })) });
    const back = decodePlan(noId)!;
    assert.equal(back.housingTypes.length, A.housingTypes.length);
    assert.equal(new Set(back.housingTypes.map((h) => h.id)).size, A.housingTypes.length);
  });

  it("깨진 링크 · 모양이 다른 값은 null", () => {
    assert.equal(decodePlan("!!!"), null);
    assert.equal(decodePlan(""), null);
    assert.equal(decodePlan(Buffer.from("{").toString("base64url")), null);
    assert.equal(decodePlan(Buffer.from(JSON.stringify({ projectName: "x" })).toString("base64url")), null);
    // 숫자 칸에 글자가 들어온 경우
    assert.equal(decodePlan(encodePlan({ ...A, fixedCost: "3514" as unknown as number })), null);
    // 주택형 행의 모양이 다른 경우
    assert.equal(decodePlan(encodePlan({ ...A, housingTypes: [{ id: "1" } as never] })), null);
    assert.equal(planFromHash("#other=1"), null);
    assert.equal(planFromHash(""), null);
  });
});
