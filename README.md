# 부동산 개발사업 사업계획서

사업대상지 조건을 입력하면 수지분석과 사업계획서가 즉시 산출되는 도구.

## 현재 구현 범위 (1단계)

- **입력 폼** — 사업개요 · 토지비 · 건축규모 · 분양수입 · 공사비 · 간접비 · 자금조달 7개 섹션, 사업유형별 프리셋 7종
- **수지 계산기** — 면적 산정부터 총사업비 · 사업이익 · ROE · 손익분기점 · 2변량 민감도까지
- **검산 테스트** — 항등식 16건을 화면과 테스트에서 동일하게 검증

다음 단계는 (2) 공공데이터 시장분석, (3) Vercel 배포다. 작업 규칙은 [CLAUDE.md](CLAUDE.md) 참고.

## 실행

```bash
npm run dev
```

http://localhost:3000 에서 확인한다.

```bash
npm run verify
```

타입체크 · 린트 · 테스트를 한 번에 돌린다.

## 단위 규칙

| 대상 | 단위 |
| --- | --- |
| 금액 | 만원 |
| 면적 | ㎡ |
| 단가 | 만원/평 |
| 비율 | 백분율 숫자 (`4.6` = 4.6%) |
| 기간 | 개월 |

억원 · 평 환산은 표시할 때만 한다. 자세한 내용은 [CLAUDE.md](CLAUDE.md) 의 단위 규칙 참고.

## 구조

```
src/
  lib/                     계산 엔진 — 순수 함수만
    types.ts               입력 스키마
    units.ts               단위 환산 · 표시 포맷
    defaults.ts            사업유형별 프리셋
    feasibility.ts         수지분석 본체
    analysis.ts            손익분기점 · 민감도 · 사업비 구성
    audit.ts               검산 항등식
    projectStore.ts        입력 저장 (useSyncExternalStore)
    __tests__/             검산 테스트 119건
  components/
    Workbench.tsx          탭 · 상태 · 저장/불러오기/인쇄
    InputForm.tsx          입력 폼
    ReportView.tsx         사업계획서 (인쇄 대응)
    SensitivityView.tsx    민감도 분석
    AuditView.tsx          검산 결과
```

## 주의

산출 결과는 입력값에 근거한 개략 검토 자료다. 프리셋의 단가는 출발점일 뿐 실제 시장가가 아니며,
실제 인허가 조건 · 시공 견적 · 금융 조건에 따라 결과가 달라진다.
