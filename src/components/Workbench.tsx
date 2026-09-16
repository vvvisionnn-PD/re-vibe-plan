"use client";

import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { auditFeasibility } from "@/lib/audit";
import { PRESETS, buildPreset } from "@/lib/defaults";
import { computeFeasibility } from "@/lib/feasibility";
import {
  getServerSnapshot,
  getSnapshot,
  mergeWithBase,
  setProjectInput,
  subscribe,
} from "@/lib/projectStore";
import type { UseType } from "@/lib/types";

import { AuditView } from "./AuditView";
import { InputForm } from "./InputForm";
import type { PatchFn } from "./InputForm";
import { KpiBar } from "./KpiBar";
import { ReportView } from "./ReportView";
import { SensitivityView } from "./SensitivityView";

const TABS = [
  { id: "input", label: "입력" },
  { id: "report", label: "사업계획서" },
  { id: "sensitivity", label: "민감도" },
  { id: "audit", label: "검산" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const buttonBase =
  "inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1.5 " +
  "text-xs font-medium text-foreground transition hover:border-line-strong hover:bg-surface-alt " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function Workbench() {
  const input = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [tab, setTab] = useState<TabId>("input");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const patch = useCallback<PatchFn>((section, value) => {
    setProjectInput((prev) => ({
      ...prev,
      [section]: { ...prev[section], ...value },
    }));
  }, []);

  const result = useMemo(() => computeFeasibility(input), [input]);
  const report = useMemo(
    () => auditFeasibility(input, result),
    [input, result],
  );

  /** 프리셋을 적용하되 사용자가 직접 적은 식별 정보는 보존한다. */
  function applyPreset(useType: UseType) {
    setProjectInput((prev) => {
      const preset = buildPreset(useType);
      return {
        ...preset,
        meta: {
          ...preset.meta,
          projectName: prev.meta.projectName,
          address: prev.meta.address,
          developer: prev.meta.developer,
        },
      };
    });
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(input, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${input.meta.projectName || "사업계획서"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importJson(file: File) {
    try {
      setProjectInput(mergeWithBase(JSON.parse(await file.text())));
    } catch {
      window.alert("JSON 파일을 읽지 못했다. 이 앱에서 내보낸 파일인지 확인할 것.");
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-5 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            부동산 개발사업 사업계획서
          </h1>
          <p className="mt-0.5 text-xs text-muted">
            사업대상지 조건을 입력하면 수지분석과 사업계획서가 즉시 산출된다 ·
            금액 단위 만원 · 단가 만원/평
          </p>
        </div>

        <div className="no-print flex flex-wrap items-center gap-1.5">
          <label className="sr-only" htmlFor="preset">
            사업유형 프리셋
          </label>
          <select
            id="preset"
            className={`${buttonBase} pr-1.5`}
            value={input.meta.useType}
            onChange={(e) => applyPreset(e.target.value as UseType)}
          >
            {PRESETS.map((preset) => (
              <option key={preset.label} value={preset.label}>
                {preset.label} — {preset.description}
              </option>
            ))}
          </select>
          <button type="button" className={buttonBase} onClick={exportJson}>
            JSON 저장
          </button>
          <button
            type="button"
            className={buttonBase}
            onClick={() => fileInputRef.current?.click()}
          >
            불러오기
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importJson(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            className={buttonBase}
            onClick={() => window.print()}
          >
            인쇄 / PDF
          </button>
        </div>
      </header>

      <KpiBar input={input} result={result} />

      {!report.ok ? (
        <div className="rounded-lg border border-negative/40 bg-negative/10 px-4 py-2.5 text-xs text-foreground">
          검산 항등식 {report.identityFailures.length}건이 실패했다. 계산 결과를
          신뢰할 수 없다 —{" "}
          <button
            type="button"
            className="font-semibold underline underline-offset-2"
            onClick={() => setTab("audit")}
          >
            검산 탭에서 확인
          </button>
          .
        </div>
      ) : null}

      <nav className="no-print flex gap-1 border-b border-line">
        {TABS.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              aria-current={active ? "page" : undefined}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
                active
                  ? "border-accent text-accent"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {item.label}
              {item.id === "audit" && report.sanityFailures.length > 0 ? (
                <span className="ml-1.5 text-warning">●</span>
              ) : null}
            </button>
          );
        })}
      </nav>

      <main>
        {tab === "input" ? (
          <InputForm input={input} patch={patch} result={result} />
        ) : null}
        {tab === "report" ? (
          <ReportView input={input} result={result} />
        ) : null}
        {tab === "sensitivity" ? <SensitivityView input={input} /> : null}
        {tab === "audit" ? <AuditView input={input} result={result} /> : null}
      </main>
    </div>
  );
}
