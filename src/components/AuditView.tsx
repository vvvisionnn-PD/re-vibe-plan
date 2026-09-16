"use client";

import { useMemo } from "react";

import type { AuditCheck } from "@/lib/audit";
import { auditFeasibility } from "@/lib/audit";
import type { FeasibilityResult } from "@/lib/feasibility";
import type { ProjectInput } from "@/lib/types";

import { Badge, Card, Table, Td, Th } from "./ui";

const numberFormat = new Intl.NumberFormat("ko-KR", {
  maximumFractionDigits: 4,
});

function formatValue(check: AuditCheck, value: number): string {
  if (check.unit === "") return value === 1 ? "충족" : "미충족";
  return `${numberFormat.format(value)}${check.unit === "만원" ? "" : check.unit}`;
}

function formatDiff(diff: number): string {
  if (diff === 0) return "0";
  if (diff < 1e-6) return diff.toExponential(2);
  return numberFormat.format(diff);
}

function CheckTable({ checks }: { checks: AuditCheck[] }) {
  return (
    <Table
      head={
        <tr>
          <Th align="center">결과</Th>
          <Th align="left">검산 항목</Th>
          <Th>기대값</Th>
          <Th>실제값</Th>
          <Th>차이</Th>
        </tr>
      }
    >
      {checks.map((check) => (
        <tr key={check.id}>
          <Td align="center">
            {check.passed ? (
              <span className="text-positive" aria-label="통과">
                ✓
              </span>
            ) : (
              <span className="text-negative" aria-label="실패">
                ✕
              </span>
            )}
          </Td>
          <Td align="left">
            <span className="text-foreground">{check.label}</span>
            {check.note ? (
              <span className="mt-0.5 block text-[11px] text-muted">
                {check.note}
              </span>
            ) : null}
          </Td>
          <Td className="text-muted">{formatValue(check, check.expected)}</Td>
          <Td className="text-muted">{formatValue(check, check.actual)}</Td>
          <Td className={check.passed ? "text-muted" : "text-negative"}>
            {check.unit === "" ? "-" : formatDiff(check.diff)}
          </Td>
        </tr>
      ))}
    </Table>
  );
}

export function AuditView({
  input,
  result,
}: {
  input: ProjectInput;
  result: FeasibilityResult;
}) {
  const report = useMemo(
    () => auditFeasibility(input, result),
    [input, result],
  );

  const identities = report.checks.filter((c) => c.kind === "identity");
  const sanities = report.checks.filter((c) => c.kind === "sanity");

  return (
    <div className="flex flex-col gap-4">
      <div
        className={`rounded-lg border px-4 py-3 ${
          report.ok
            ? "border-positive/40 bg-positive/10"
            : "border-negative/40 bg-negative/10"
        }`}
      >
        <p className="text-sm font-semibold text-foreground">
          {report.ok
            ? `항등식 ${identities.length}건 전부 통과 — 수지표의 내부 정합성이 확인되었다`
            : `항등식 ${report.identityFailures.length}건 실패 — 계산 엔진 버그다`}
        </p>
        <p className="mt-1 text-[11px] text-muted">
          항등식은 정의상 반드시 성립해야 하는 관계다. 하나라도 깨지면 입력이
          아니라 코드를 고쳐야 한다. 개연성 점검은 입력값에 대한 경고이며 실패해도
          엔진 버그는 아니다.
        </p>
        {report.sanityFailures.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {report.sanityFailures.map((c) => (
              <Badge key={c.id} tone="warning">
                {c.label}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>

      <Card
        title="항등식 검산"
        subtitle="정의상 반드시 성립해야 하는 관계 — 실패 시 코드 결함"
        action={
          <Badge tone={report.ok ? "positive" : "negative"}>
            {identities.filter((c) => c.passed).length} / {identities.length}
          </Badge>
        }
      >
        <CheckTable checks={identities} />
      </Card>

      <Card
        title="개연성 점검"
        subtitle="입력값이 현실적인지에 대한 경고 — 실패해도 계산은 정상"
        action={
          <Badge
            tone={report.sanityFailures.length === 0 ? "positive" : "warning"}
          >
            {sanities.filter((c) => c.passed).length} / {sanities.length}
          </Badge>
        }
      >
        <CheckTable checks={sanities} />
      </Card>

      <p className="px-1 text-[11px] leading-relaxed text-muted">
        여기 표시되는 항목은 <code className="font-mono">src/lib/audit.ts</code>{" "}
        에 정의되어 있고, 같은 항목이{" "}
        <code className="font-mono">src/lib/__tests__/audit.test.ts</code> 에서
        모든 프리셋과 극단 입력에 대해 단언된다. 화면의 검산과 CI 의 검산은 같은
        코드다.
      </p>
    </div>
  );
}
