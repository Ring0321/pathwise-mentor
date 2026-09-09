import type { CompetencyId, EventType, EvidenceEvent, RiskLevel } from "../domain/types";

export type RepositorySignalKind =
  | "issue"
  | "pull_request"
  | "ci_run"
  | "review_comment"
  | "reflection";

export interface RepositorySignal {
  id: string;
  kind: RepositorySignalKind;
  provider: "github" | "gitee" | "gitlab" | "local";
  repository: string;
  timestamp: string;
  title: string;
  detail: string;
  competencyImpacts: Partial<Record<CompetencyId, number>>;
  confidence: number;
  risk: RiskLevel;
  result?: "opened" | "failed" | "passed" | "commented" | "submitted";
}

export interface ImportQualityCheck {
  id: string;
  label: string;
  status: "pass" | "watch" | "block";
  evidence: string;
}

export interface RepositoryIngestionResult {
  events: EvidenceEvent[];
  checks: ImportQualityCheck[];
  summary: string;
}

function eventTypeFor(signal: RepositorySignal): EventType {
  if (signal.kind === "issue") return "issue_created";
  if (signal.kind === "pull_request") return "pr_opened";
  if (signal.kind === "ci_run") return signal.result === "passed" ? "ci_passed" : "ci_failed";
  if (signal.kind === "review_comment") return "teacher_reviewed";
  return "reflection_submitted";
}

function sourceFor(signal: RepositorySignal): EvidenceEvent["source"] {
  if (signal.kind === "ci_run") return "ci";
  if (signal.kind === "issue" || signal.kind === "pull_request") return "git";
  if (signal.kind === "review_comment") return "teacher";
  return "reflection";
}

function actorFor(signal: RepositorySignal): EvidenceEvent["actor"] {
  if (signal.kind === "ci_run") return "tool";
  if (signal.kind === "review_comment") return "teacher";
  if (signal.kind === "reflection") return "student";
  return "student";
}

function hasPersonalData(text: string): boolean {
  return /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text) || /1[3-9]\d{9}/.test(text);
}

function buildChecks(signals: RepositorySignal[], events: EvidenceEvent[]): ImportQualityCheck[] {
  const schemaValid = signals.every(
    (signal) =>
      signal.id &&
      signal.kind &&
      signal.provider &&
      signal.repository &&
      signal.timestamp &&
      signal.title &&
      signal.detail &&
      Object.keys(signal.competencyImpacts).length > 0,
  );
  const sources = new Set(events.map((event) => event.source));
  const hasEngineeringEvidence = sources.has("git") && sources.has("ci");
  const hasHumanEvidence = sources.has("teacher") || sources.has("reflection");
  const privacyHits = signals.filter((signal) => hasPersonalData(`${signal.title} ${signal.detail}`));
  const hasPassAndFail =
    events.some((event) => event.type === "ci_failed") && events.some((event) => event.type === "ci_passed");

  return [
    {
      id: "schema",
      label: "事件结构",
      status: schemaValid ? "pass" : "block",
      evidence: schemaValid ? `${signals.length} 条仓库信号字段完整` : "存在缺少必要字段的仓库信号",
    },
    {
      id: "engineering",
      label: "工程证据",
      status: hasEngineeringEvidence ? "pass" : "watch",
      evidence: hasEngineeringEvidence ? "同时包含 Git 与 CI 证据" : "建议至少包含 PR 与 CI 事件",
    },
    {
      id: "human",
      label: "人类反馈",
      status: hasHumanEvidence ? "pass" : "watch",
      evidence: hasHumanEvidence ? "包含教师复核或学生反思" : "建议补充教师 Review 或反思",
    },
    {
      id: "privacy",
      label: "隐私脱敏",
      status: privacyHits.length === 0 ? "pass" : "block",
      evidence: privacyHits.length === 0 ? "未发现邮箱或手机号" : `${privacyHits.length} 条疑似隐私字段`,
    },
    {
      id: "learning-loop",
      label: "失败到修复闭环",
      status: hasPassAndFail ? "pass" : "watch",
      evidence: hasPassAndFail ? "包含 CI 失败与后续通过" : "建议补充修复后的 CI 通过事件",
    },
  ];
}

export function normalizeRepositorySignals(signals: RepositorySignal[]): RepositoryIngestionResult {
  const events = signals.map<EvidenceEvent>((signal) => ({
    id: `evt-repo-${signal.id}`,
    type: eventTypeFor(signal),
    timestamp: signal.timestamp,
    actor: actorFor(signal),
    source: sourceFor(signal),
    title: signal.title,
    detail: `${signal.provider}/${signal.repository}: ${signal.detail}`,
    competencyImpacts: signal.competencyImpacts,
    confidence: signal.confidence,
    risk: signal.risk,
    traceId: `trace-repo-${signal.id}`,
  }));
  const checks = buildChecks(signals, events);
  const blocked = checks.filter((check) => check.status === "block").length;
  const watched = checks.filter((check) => check.status === "watch").length;
  return {
    events,
    checks,
    summary:
      blocked > 0
        ? "当前仓库信号需要先处理阻断项，再进入学习诊断。"
        : watched > 0
          ? "当前仓库信号可导入，但建议继续补充人类反馈或修复闭环。"
          : "当前仓库信号已满足演示级导入质量门，可直接写入证据账本。",
  };
}

export function mergeEvidenceEvents(existing: EvidenceEvent[], incoming: EvidenceEvent[]): EvidenceEvent[] {
  const seen = new Set(existing.map((event) => event.id));
  const merged = [...existing];
  for (const event of incoming) {
    if (!seen.has(event.id)) {
      merged.push(event);
      seen.add(event.id);
    }
  }
  return merged;
}

