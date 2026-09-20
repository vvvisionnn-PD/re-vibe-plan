// 2장 시장 분석 검산 — 실행: npm test (node --test)
// 테스트 자료는 손계산용 가상 값이다 (실제 사업장 · 실제 거래 아님).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  AREA84_MAX,
  asOfDate,
  combineDetail,
  exclusiveFromHouseTy,
  filterPresale,
  filterRent,
  is84,
  isNoParam,
  isYm,
  jeonseRatio,
  marketMargin,
  median,
  mergePresale,
  mergeRent,
  newSupply84,
  normalizeName,
  our84UnitPrice,
  parseAreaParam,
  parseOdcloud,
  parseStanReginJson,
  parseXmlItems,
  pickRegion,
  presalePremium,
  recentMonths,
  regionCandidates,
  remainderSummary,
  rtmsStatus,
  toNumber,
  undersubscription,
  yearsAgo,
  type Announcement,
} from "./market.ts";
import { createQueue, CANCELLED } from "./queue.ts";
import { applyPreset, PRESETS } from "./presets.ts";

/** 두 수가 오차 tol 안에서 같은지 */
function close(actual: number | null, expected: number, tol = 1e-9) {
  assert.notEqual(actual, null);
  assert.ok(Math.abs(actual! - expected) <= tol, `기대 ${expected}, 실제 ${actual}`);
}

let seq = 0;
const A = applyPreset(PRESETS[0].values!, () => `r${seq++}`);

describe("기본 도우미", () => {
  it("숫자 · 주택형 · 84㎡ 판정", () => {
    assert.equal(toNumber("95,815"), 95815);
    assert.equal(toNumber(" 59.87 "), 59.87);
    assert.equal(toNumber("-"), null);
    assert.equal(toNumber(""), null);
    assert.equal(exclusiveFromHouseTy("084.9543T"), 84.9543);
    assert.equal(exclusiveFromHouseTy("059.8000 "), 59.8);
    assert.equal(is84(84), true);
    assert.equal(is84(84.9999), true);
    assert.equal(is84(AREA84_MAX), false);
    assert.equal(is84(83.99), false);
    assert.equal(is84(null), false);
  });

  it("중앙값", () => {
    assert.equal(median([3, 1, 2]), 2);
    assert.equal(median([4, 1, 3, 2]), 2.5);
    assert.equal(median([]), null);
  });

  it("최근 12개월은 이번 달을 빼고 오래된 달부터", () => {
    const m = recentMonths(new Date(2026, 8, 18));
    assert.equal(m.length, 12);
    assert.equal(m[0], "202509");
    assert.equal(m[11], "202608");
    const jan = recentMonths(new Date(2026, 0, 5));
    assert.equal(jan[0], "202501");
    assert.equal(jan[11], "202512");
  });

  it("최근 3년 기준일 · 조회일(한국 시간)", () => {
    assert.equal(yearsAgo(new Date(2026, 8, 18)), "2023-09-18");
    assert.equal(asOfDate(["2026-09-18T15:30:00Z", "2026-09-17T01:00:00Z"]), "2026-09-17");
    // UTC 16:00 = 한국 다음날 01:00
    assert.equal(asOfDate(["2026-09-17T16:00:00Z"]), "2026-09-18");
    assert.equal(asOfDate([]), null);
  });

  it("요청 파라미터 확인", () => {
    assert.equal(parseAreaParam("경기도 수원시 영통구"), "경기도 수원시 영통구");
    assert.equal(parseAreaParam("  부산광역시   해운대구 "), "부산광역시 해운대구");
    assert.equal(parseAreaParam("부산 해운대구"), null);
    assert.equal(parseAreaParam("부산광역시"), null);
    assert.equal(parseAreaParam(null), null);
    assert.equal(isYm("202509"), true);
    assert.equal(isYm("202513"), false);
    assert.equal(isYm("20259"), false);
    assert.equal(isNoParam("2022000248"), true);
    assert.equal(isNoParam("12a"), false);
  });

  it("이름 정리", () => {
    assert.equal(normalizeName("가상 센트럴 아파트(1단지)"), "가상센트럴");
  });
});

describe("법정동코드", () => {
  // 기술문서 구조: { StanReginCd: [ { head: [..., { RESULT }] }, { row: [...] } ] }
  const json = {
    StanReginCd: [
      { head: [{ totalCount: 3 }, { numOfRows: "1000", pageNo: "1", type: "JSON" }, { RESULT: { resultCode: "INFO-0", resultMsg: "NOMAL SERVICE" } }] },
      {
        row: [
          { region_cd: "2600000000", sgg_cd: "000", umd_cd: "000", ri_cd: "00", locatadd_nm: "부산광역시" },
          { region_cd: "2635000000", sgg_cd: "350", umd_cd: "000", ri_cd: "00", locatadd_nm: "부산광역시 해운대구" },
          { region_cd: "2635010100", sgg_cd: "350", umd_cd: "101", ri_cd: "00", locatadd_nm: "부산광역시 해운대구 우동" },
        ],
      },
    ],
  };

  it("시군구 단위 행만 후보로, 앞 5자리가 코드", () => {
    const { rows, message } = parseStanReginJson(json);
    assert.equal(message, null);
    assert.deepEqual(regionCandidates(rows), [{ code: "26350", name: "부산광역시 해운대구" }]);
  });

  it("이름이 정확히 같은 후보 하나를 고른다", () => {
    const c = regionCandidates(parseStanReginJson(json).rows);
    assert.deepEqual(pickRegion(c, "부산광역시 해운대구"), { ok: true, region: { code: "26350", name: "부산광역시 해운대구" } });
    assert.equal(pickRegion(c, "부산광역시 수영구").ok, false);
  });

  it("데이터 없음 · 형식 오류", () => {
    const none = { StanReginCd: [{ head: [{ RESULT: { resultCode: "INFO-200", resultMsg: "해당하는 데이터가 없습니다." } }] }] };
    assert.equal(parseStanReginJson(none).message, "해당하는 데이터가 없습니다.");
    assert.equal(parseStanReginJson({ RESULT: { resultMsg: "인증키 오류" } }).message, "인증키 오류");
  });
});

describe("실거래 XML", () => {
  const xml = `<response><header><resultCode>000</resultCode><resultMsg>OK</resultMsg></header><body><items>
    <item><aptNm>가상 센트럴</aptNm><cdealType> </cdealType><dealAmount>70,000</dealAmount><dealDay>9</dealDay><dealMonth>3</dealMonth><dealYear>2026</dealYear><excluUseAr>84.9</excluUseAr><ownershipGbn>분</ownershipGbn><umdNm>가상동</umdNm></item>
    <item><aptNm>가상 센트럴</aptNm><cdealType>O</cdealType><dealAmount>71,000</dealAmount><dealDay>10</dealDay><dealMonth>3</dealMonth><dealYear>2026</dealYear><excluUseAr>84.9</excluUseAr><ownershipGbn>분</ownershipGbn><umdNm>가상동</umdNm></item>
    <item><aptNm>가상 센트럴</aptNm><cdealType/><dealAmount>90,000</dealAmount><dealDay>11</dealDay><dealMonth>3</dealMonth><dealYear>2026</dealYear><excluUseAr>84.9</excluUseAr><ownershipGbn>입</ownershipGbn><umdNm>가상동</umdNm></item>
    <item><aptNm>가상 &amp; 파크</aptNm><dealAmount></dealAmount><dealDay>12</dealDay><dealMonth>3</dealMonth><dealYear>2026</dealYear><excluUseAr>59.9</excluUseAr><ownershipGbn>분</ownershipGbn></item>
    <item><aptNm>가상 파크</aptNm><cdealType> </cdealType><dealAmount>55,500</dealAmount><dealDay>13</dealDay><dealMonth>3</dealMonth><dealYear>2026</dealYear><excluUseAr>59.9</excluUseAr><ownershipGbn> </ownershipGbn></item>
    </items><numOfRows>1000</numOfRows><pageNo>1</pageNo><totalCount>5</totalCount></body></response>`;

  it("item 파싱 · 엔티티 · 빈 태그", () => {
    const items = parseXmlItems(xml);
    assert.equal(items.length, 5);
    assert.equal(items[0].dealAmount, "70,000");
    assert.equal(items[2].cdealType, "");
    assert.equal(items[3].aptNm, "가상 & 파크");
    assert.deepEqual(rtmsStatus(xml), { ok: true, totalCount: 5 });
  });

  it("오류 응답", () => {
    const err = "<OpenAPI_ServiceResponse><cmmMsgHeader><returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg></cmmMsgHeader></OpenAPI_ServiceResponse>";
    assert.equal(rtmsStatus(err).ok, false);
    assert.equal(rtmsStatus("<response><header><resultCode>03</resultCode><resultMsg>NO DATA</resultMsg></header></response>").ok, false);
  });

  // 실제 응답에서 분양권 거래는 구분 값이 비어 있고 입주권만 "입"이다 → 빈 값도 분양권으로 남긴다
  it("분양권: 입주권(입) · 해제 · 금액 오류를 빼고, 구분이 빈 거래는 남긴다", () => {
    const m = filterPresale("202603", parseXmlItems(xml));
    assert.deepEqual(m.stats, { total: 5, rightsExcluded: 1, cancelledExcluded: 1, invalidExcluded: 1 });
    assert.deepEqual(m.ownership, { 분: 3, 입: 1, "(빈 값)": 1 });
    assert.deepEqual(m.trades, [
      { aptNm: "가상 센트럴", umdNm: "가상동", exclusiveM2: 84.9, amount: 70000, date: "2026-03-09" },
      { aptNm: "가상 파크", umdNm: "", exclusiveM2: 59.9, amount: 55500, date: "2026-03-13" },
    ]);
  });

  it("전월세: 84㎡ 신규 전세만", () => {
    const rent = [
      { aptNm: "가", excluUseAr: "84.5", deposit: "50,000", monthlyRent: "0", contractType: "신규", dealYear: "2026", dealMonth: "1", dealDay: "2" },
      { aptNm: "나", excluUseAr: "84.5", deposit: "20,000", monthlyRent: "100", contractType: "신규", dealYear: "2026", dealMonth: "1", dealDay: "3" },
      { aptNm: "다", excluUseAr: "59.9", deposit: "40,000", monthlyRent: "0", contractType: "신규", dealYear: "2026", dealMonth: "1", dealDay: "4" },
      { aptNm: "라", excluUseAr: "84.9", deposit: "45,000", monthlyRent: "0", contractType: "갱신", dealYear: "2026", dealMonth: "1", dealDay: "5" },
      { aptNm: "마", excluUseAr: "84.9", deposit: "45,000", monthlyRent: "0", contractType: "", dealYear: "2026", dealMonth: "1", dealDay: "6" },
    ];
    const m = filterRent("202601", rent);
    assert.deepEqual(m.stats, { total: 5, monthlyExcluded: 1, sizeExcluded: 1, notNewExcluded: 2, invalidExcluded: 0 });
    assert.equal(m.contracts.length, 1);
    assert.equal(m.contracts[0].deposit, 50000);
  });

  it("여러 달 합치기", () => {
    const a = filterPresale("202603", parseXmlItems(xml));
    const merged = mergePresale([a, a]);
    assert.equal(merged.trades.length, 4);
    assert.equal(merged.stats.total, 10);
    const r = mergeRent([filterRent("202601", []), filterRent("202602", [])]);
    assert.equal(r.stats.total, 0);
  });
});

// ─────────────────────────────────────────────
// 청약홈 손계산 자료
//   공고 1 "가상센트럴 아파트" (2025-05-01)
//     84.9543T: 공급 112㎡ = 33.88평, 분양최고 67,760만원 → 67,760 ÷ 33.88 = 2,000만원/평
//               일반공급 10, 1순위 3(해당)+2(기타) = 5, 2순위 1 → 6 < 10 → 미달 4세대
//     059.8000 : 일반공급 5, 1순위 20 → 미달 아님
//   공고 2 "가상파크" (2024-02-01)
//     084.1000 : 공급 110㎡ = 33.275평, 분양최고 73,205만원 → 73,205 ÷ 33.275 = 2,200만원/평
//     084.5000 : 분양가 없음 → 제외(noPrice)
//   인근 84㎡ 중앙값 = (2,000 + 2,200) ÷ 2 = 2,100 · 계획 2,420 − 2,100 = 320
// ─────────────────────────────────────────────
const ann: Announcement[] = [
  { id: "1", pblanc: "1", name: "가상센트럴 아파트", date: "2025-05-01", address: "가상시 가상구", totalUnits: 15, url: "" },
  { id: "2", pblanc: "2", name: "가상파크", date: "2024-02-01", address: "가상시 가상구", totalUnits: 30, url: "" },
];
const d1 = combineDetail(
  "1",
  "1",
  [
    { HOUSE_TY: "084.9543T", SUPLY_AR: "112.0000", LTTOT_TOP_AMOUNT: "67760", SUPLY_HSHLDCO: 10 },
    { HOUSE_TY: "059.8000 ", SUPLY_AR: "80.0000", LTTOT_TOP_AMOUNT: "50000", SUPLY_HSHLDCO: 5 },
  ],
  [
    { HOUSE_TY: "084.9543T", SUBSCRPT_RANK_CODE: 1, RESIDE_SECD: "01", REQ_CNT: "3", SUPLY_HSHLDCO: 10 },
    { HOUSE_TY: "084.9543T", SUBSCRPT_RANK_CODE: 1, RESIDE_SECD: "03", REQ_CNT: "2", SUPLY_HSHLDCO: 10 },
    { HOUSE_TY: "084.9543T", SUBSCRPT_RANK_CODE: 2, RESIDE_SECD: "01", REQ_CNT: "1", SUPLY_HSHLDCO: 10 },
    { HOUSE_TY: "059.8000", SUBSCRPT_RANK_CODE: 1, RESIDE_SECD: "01", REQ_CNT: "20", SUPLY_HSHLDCO: 5 },
    { HOUSE_TY: "059.8000", SUBSCRPT_RANK_CODE: 2, RESIDE_SECD: "01", REQ_CNT: "0", SUPLY_HSHLDCO: 5 },
  ],
);
const d2 = combineDetail(
  "2",
  "2",
  [
    { HOUSE_TY: "084.1000", SUPLY_AR: "110.0000", LTTOT_TOP_AMOUNT: "73205" },
    { HOUSE_TY: "084.5000", SUPLY_AR: "111.0000", LTTOT_TOP_AMOUNT: "-" },
  ],
  [],
);

describe("청약홈 응답", () => {
  it("odcloud 목록 · 오류", () => {
    assert.deepEqual(parseOdcloud({ currentCount: 0, data: [], totalCount: 0 }), { data: [], totalCount: 0, message: null });
    assert.equal(parseOdcloud({ code: -4, msg: "등록되지 않은 인증키 입니다." }).message, "등록되지 않은 인증키 입니다.");
  });

  it("주택형별 분양가와 경쟁률을 합친다 (접수건수는 거주지역 합)", () => {
    assert.deepEqual(d1.types[0], {
      houseTy: "084.9543T",
      exclusiveM2: 84.9543,
      supplyM2: 112,
      topAmount: 67760,
      generalUnits: 10,
      rank1Req: 5,
      rank2Req: 1,
    });
    assert.equal(d1.types[1].houseTy, "059.8000");
    assert.equal(d1.types[1].rank1Req, 20);
    assert.equal(d2.types[0].rank1Req, null);
  });
});

describe("표 1 · 인근 신규 84㎡ vs 계획가 (손계산)", () => {
  const t = newSupply84(ann, [d1, d2], 2420);
  it("공급평당 = 분양최고금액 ÷ (공급면적 × 0.3025)", () => {
    assert.equal(t.rows.length, 2);
    close(t.rows[0].pricePerPyeong, 2000, 1e-9);
    close(t.rows[1].pricePerPyeong, 2200, 1e-9);
    assert.equal(t.noPrice, 1);
  });
  it("중앙값 2,100 · 계획가 − 중앙값 320", () => {
    close(t.median, 2100, 1e-9);
    close(t.planMinusMedian, 320, 1e-9);
  });
  it("상세가 없는 공고는 건너뛴다", () => {
    assert.equal(newSupply84(ann, [], 2420).median, null);
  });
});

describe("표 2 · 분양권 웃돈 (손계산)", () => {
  // 거래 "가상센트럴" 84.9㎡ 70,000 → 84.9543T(차 0.0543㎡)의 67,760 → 웃돈 2,240
  // 거래 "가상센트럴" 70.0㎡ → ±0.5㎡ 안 주택형 없음 → 제외 · "다른단지" → 제외
  const trades = [
    { aptNm: "가상센트럴", umdNm: "", exclusiveM2: 84.9, amount: 70000, date: "2026-03-09" },
    { aptNm: "가상센트럴", umdNm: "", exclusiveM2: 70, amount: 50000, date: "2026-03-10" },
    { aptNm: "다른단지", umdNm: "", exclusiveM2: 84.9, amount: 80000, date: "2026-03-11" },
  ];
  it("단지명 · 전용면적으로 분양가를 맞추고 웃돈 = 거래금액 − 분양가", () => {
    const p = presalePremium(trades, ann, [d1, d2]);
    assert.equal(p.rows.length, 1);
    assert.equal(p.rows[0].salePrice, 67760);
    assert.equal(p.rows[0].premium, 2240);
    assert.equal(p.medianPremium, 2240);
    assert.equal(p.unmatched, 2);
    assert.equal(p.ambiguous, 0);
  });

  // 같은 전용 125.8735㎡에 A형 267,600 · D형 241,000 → 타입을 알 수 없어 제외
  // 같은 전용 104.6983㎡에 분양가가 같은 두 타입 → 분양가가 하나로 정해지므로 포함
  it("가장 가까운 전용면적에 분양가가 다른 주택형이 여럿이면 제외", () => {
    const d3 = combineDetail(
      "3",
      "3",
      [
        { HOUSE_TY: "125.8735A", SUPLY_AR: "170", LTTOT_TOP_AMOUNT: "267600" },
        { HOUSE_TY: "125.8735D", SUPLY_AR: "170", LTTOT_TOP_AMOUNT: "241000" },
        { HOUSE_TY: "104.6983B", SUPLY_AR: "140", LTTOT_TOP_AMOUNT: "180500" },
        { HOUSE_TY: "104.6983C", SUPLY_AR: "140", LTTOT_TOP_AMOUNT: "180500" },
      ],
      [],
    );
    const a3: Announcement = { id: "3", pblanc: "3", name: "가상리버", date: "2025-07-11", address: "", totalUnits: 1, url: "" };
    const p = presalePremium(
      [
        { aptNm: "가상리버", umdNm: "", exclusiveM2: 125.87, amount: 224895, date: "2026-08-26" },
        { aptNm: "가상리버", umdNm: "", exclusiveM2: 104.7, amount: 181000, date: "2026-08-15" },
      ],
      [a3],
      [d3],
    );
    assert.equal(p.ambiguous, 1);
    assert.equal(p.rows.length, 1);
    assert.equal(p.rows[0].premium, 181000 - 180500);
  });
});

describe("표 3 · 1·2순위 미달 (손계산)", () => {
  it("84.9543T만 미달 4세대, 경쟁률 없는 주택형은 제외", () => {
    const u = undersubscription(ann, [d1, d2]);
    assert.equal(u.rows.length, 1);
    assert.deepEqual(u.rows[0], { name: "가상센트럴 아파트", date: "2025-05-01", types: 2, shortTypes: 1, shortUnits: 4 });
    assert.equal(u.shortComplexes, 1);
    assert.equal(u.totalShortUnits, 4);
    assert.equal(u.noRate, 2);
  });
});

describe("표 4 · 잔여세대", () => {
  it("공급규모 합계 · 최근 순", () => {
    const r = remainderSummary([
      { id: "1", pblanc: "1", name: "가", date: "2024-01-01", address: "", units: 16, kind: "무순위" },
      { id: "2", pblanc: "2", name: "나", date: "2025-01-01", address: "", units: null, kind: "무순위" },
    ]);
    assert.equal(r.totalUnits, 16);
    assert.equal(r.rows[0].name, "나");
  });
});

describe("표 5 · 84㎡ 신규 전세 ÷ 우리 84㎡ 세대당 분양가 (샘플 A 손계산)", () => {
  // 샘플 A 84㎡: 공급 34.6평 × 2,420만원 = 83,732만원
  // 전세 중앙값 = median(50,000 · 60,000 · 70,000) = 60,000 → 60,000 ÷ 83,732 = 0.71657…
  it("세대당 분양가와 비율", () => {
    close(our84UnitPrice(A), 83732, 1e-6);
    const c = [50000, 60000, 70000].map((deposit) => ({ aptNm: "", umdNm: "", exclusiveM2: 84.5, deposit, date: "" }));
    const j = jeonseRatio(c, A);
    assert.equal(j.medianDeposit, 60000);
    close(j.ratio, 60000 / 83732, 1e-12);
  });

  it("84㎡ 주택형이 여럿이면 세대수 가중평균, 없으면 null", () => {
    const two = {
      ...A,
      housingTypes: [
        { id: "x", name: "84A", exclusiveM2: 84.9, supplyPyeong: 34, units: 100 },
        { id: "y", name: "84B", exclusiveM2: 84.5, supplyPyeong: 35, units: 300 },
      ],
    };
    // (34 × 2,420 × 100 + 35 × 2,420 × 300) ÷ 400 = 2,420 × 34.75 = 84,095
    close(our84UnitPrice(two), 84095, 1e-6);
    assert.equal(our84UnitPrice({ ...A, housingTypes: [] }), null);
  });
});

describe("결론 · 시장 대비 여유 (샘플 A 손계산)", () => {
  // 상환 한계 평당가 = 3,106.8 ÷ 1.6062464 = 1,934.2… (calc.test.ts 참고)
  // 인근 중앙값 2,500 → 여유 = 2,500 − 1,934.2… = 565.77…
  it("여유 = 인근 신규 84㎡ 공급평당 중앙값 − 상환 한계 평당가", () => {
    const m = marketMargin(A, 2500);
    close(m.repayPrice, 3106.8 / 1.6062464, 1e-6);
    close(m.margin, 2500 - 3106.8 / 1.6062464, 1e-6);
    close(m.marginPct, ((2500 - 3106.8 / 1.6062464) / 2500) * 100, 1e-6);
    assert.equal(marketMargin(A, null).margin, null);
  });
});

describe("동시 호출 제한 대기열", () => {
  it("동시에 4개까지만 실행하고 넣은 순서대로 시작한다", async () => {
    const q = createQueue(4);
    let active = 0;
    let peak = 0;
    const started: number[] = [];
    const jobs = Array.from({ length: 10 }, (_, i) =>
      q.add(async () => {
        started.push(i);
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 5));
        active -= 1;
        return i;
      }),
    );
    assert.deepEqual(await Promise.all(jobs), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    assert.equal(peak, 4);
    assert.deepEqual(started, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("실패해도 다음 작업은 계속된다", async () => {
    const q = createQueue(1);
    const a = q.add(() => Promise.reject(new Error("x")));
    const b = q.add(async () => "ok");
    await assert.rejects(a, /x/);
    assert.equal(await b, "ok");
  });

  it("clear()는 기다리는 작업을 취소로 끝낸다", async () => {
    const q = createQueue(1);
    let release!: () => void;
    const first = q.add(() => new Promise<string>((r) => (release = () => r("first"))));
    const second = q.add(async () => "second");
    q.clear();
    await assert.rejects(second, new RegExp(CANCELLED));
    release();
    assert.equal(await first, "first");
    assert.equal(q.waiting(), 0);
  });
});
