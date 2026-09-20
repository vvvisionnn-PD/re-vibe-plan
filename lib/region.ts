/**
 * 사업대상지(시도 · 시군구) 이름 점검.
 * 공공데이터 조회에 쓰려면 약칭("서울", "경기")이 아니라 전체 이름이 필요하다.
 * 행정구역 목록을 앱에 박아두지 않고, 이름의 끝 글자만 본다.
 */

/**
 * 시도 이름이 전체 이름 형태인지 확인한다.
 * 특별시 · 광역시 · 특별자치시 · 도 · 특별자치도는 모두 "시" 또는 "도"로 끝난다.
 * 비어 있으면 점검하지 않는다(true).
 */
export function isFullSidoName(name: string): boolean {
  const v = name.trim();
  return v === "" || /(시|도)$/.test(v);
}

/**
 * 시군구 이름이 전체 이름 형태인지 확인한다.
 * "시" · "군" · "구"로 끝나야 한다 (예: "강남구", "수원시 영통구", "양평군").
 * 비어 있으면 점검하지 않는다(true).
 */
export function isFullSigunguName(name: string): boolean {
  const v = name.trim();
  return v === "" || /(시|군|구)$/.test(v);
}
