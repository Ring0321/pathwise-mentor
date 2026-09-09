import type { AppState, CompetencyId, EvidenceEvent, RiskLevel } from "../domain/types";
import type { ApiContractReport } from "./apiContract";
import type { PrivacyGuardReport } from "./privacyGuard";

export type IntegrationSource = "git" | "ci" | "lms" | "feishu";
export type IntegrationGateStatus = "pass" | "watch" | "block";

export interface IntegrationWebhookSample {
  id: string;
  source: IntegrationSource;
  label: string;
  eventName: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  protectedFields: string[];
}

export interface IntegrationCheck {
  id: string;
  label: string;
  status: IntegrationGateStatus;
  evidence: string;
}

export interface IntegrationMappingResult {
  sampleId: string;
  source: IntegrationSource;
  eventName: string;
  idempotencyKey: string;
  qualityGate: IntegrationGateStatus;
  checks: IntegrationCheck[];
  events: EvidenceEvent[];
  deadLetterReason: string | null;
  sanitizedPayload: string;
  summary: string;
}

export interface IntegrationSandboxReport {
  score: number;
  mode: string;
  gate: string;
  samples: IntegrationWebhookSample[];
  dryRuns: IntegrationMappingResult[];
  sourceCoverage: { label: string; value: string; status: IntegrationGateStatus }[];
  operatingRules: string[];
  apiScore: number;
  privacyGate: PrivacyGuardReport["gate"];
}

const baseTimestamp = "2026-08-09T14:20:00+08:00";

export const integrationWebhookSamples: IntegrationWebhookSample[] = [
  {
    id: "sample-git-pr-opened",
    source: "git",
    label: "Git PR 打开",
    eventName: "pull_request.opened",
    idempotencyKey: "repo-order-api:pr-18:opened:2026-08-09T14:20:00+08:00",
    protectedFields: ["accessToken", "rawDiff", "privateEmail"],
    payload: {
      tenantId: "tenant-se-course-2026",
      courseId: "software-engineering-project",
      learnerHash: "stu_hash_8f2a",
      repositoryId: "repo-order-api",
      pullRequestId: 18,
      action: "opened",
      title: "补齐库存不足错误处理",
      summary: "学生打开 PR，声明先补测试再做最小修复。",
      competencies: ["implementation", "collaboration"],
    },
  },
  {
    id: "sample-ci-failed",
    source: "ci",
    label: "CI 失败",
    eventName: "check_suite.completed",
    idempotencyKey: "workflow-241901:run-77:failure",
    protectedFields: ["runnerSecret", "rawLog", "artifactUrl"],
    payload: {
      tenantId: "tenant-se-course-2026",
      courseId: "software-engineering-project",
      learnerHash: "stu_hash_8f2a",
      workflowRunId: "run_241901",
      conclusion: "failure",
      failedTest: "inventory_depleted_should_return_409",
      expectedStatus: 409,
      actualStatus: 500,
      summary: "库存不足边界用例失败，服务仍返回 500。",
      competencies: ["testing", "implementation"],
    },
  },
  {
    id: "sample-lms-rubric",
    source: "lms",
    label: "LMS Rubric 更新",
    eventName: "assignment.rubric.updated",
    idempotencyKey: "software-engineering-project:task-api-error:rubric-v1.4",
    protectedFields: ["studentRealName", "scoreSheetRaw"],
    payload: {
      tenantId: "tenant-se-course-2026",
      courseId: "software-engineering-project",
      assignmentId: "task-api-error",
      rubricVersion: "v1.4",
      summary: "教师补充 409/500 错误码边界和 PR 回滚说明评分项。",
      competencies: ["requirements", "testing", "collaboration"],
    },
  },
  {
    id: "sample-feishu-review",
    source: "feishu",
    label: "飞书教师复核",
    eventName: "card.action.teacher_reviewed",
    idempotencyKey: "ticket-current:teacher_hash_02:approved:2026-08-09T14:36:00+08:00",
    protectedFields: ["teacherMobile", "chatOpenId"],
    payload: {
      tenantId: "tenant-se-course-2026",
      courseId: "software-engineering-project",
      ticketId: "ticket-current",
      operatorHash: "teacher_hash_02",
      action: "approved",
      summary: "教师确认系统未替写代码，允许推送异常路径 mini lab。",
      competencies: ["testing", "reflection"],
    },
  },
];

function payloadText(payload: Record<string, unknown>): string {
  return JSON.stringify(payload, null, 2);
}

function hasSensitiveValue(payload: Record<string, unknown>): boolean {
  const text = payloadText(payload);
  return /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text) || /1[3-9]\d{9}/.test(text) || /sk-[A-Za-z0-9]{12,}/.test(text);
}

function sanitizePayload(sample: IntegrationWebhookSample): string {
  const clone = JSON.parse(JSON.stringify(sample.payload)) as Record<string, unknown>;
  for (const field of sample.protectedFields) {
    if (field in clone) {
      clone[field] = "[REDACTED]";
    }
  }
  return JSON.stringify(clone, null, 2);
}

function competenciesFromPayload(payload: Record<string, unknown>): CompetencyId[] {
  const raw = payload.competencies;
  if (!Array.isArray(raw)) return ["testing"];
  return raw.filter((item): item is CompetencyId =>
    ["requirements", "architecture", "implementation", "testing", "collaboration", "reflection"].includes(String(item)),
  );
}

function impactsFor(competencies: CompetencyId[], source: IntegrationSource, isPositive: boolean): Partial<Record<CompetencyId, number>> {
  const impact = source === "ci" && !isPositive ? -5 : 4;
  return competencies.reduce<Partial<Record<CompetencyId, number>>>((acc, competency) => {
    acc[competency] = impact;
    return acc;
  }, {});
}

function eventForSample(sample: IntegrationWebhookSample): EvidenceEvent {
  const payload = sample.payload;
  const competencies = competenciesFromPayload(payload);
  const summary = String(payload.summary ?? sample.label);
  const traceId = `trace-integration-${sample.id}`;

  if (sample.source === "git") {
    return {
      id: `evt-int-${sample.id}`,
      type: "pr_opened",
      timestamp: baseTimestamp,
      actor: "student",
      source: "git",
      title: `集成回放：${sample.label}`,
      detail: `Webhook ${sample.eventName}: ${summary}`,
      competencyImpacts: impactsFor(competencies, sample.source, true),
      confidence: 0.87,
      risk: "low",
      traceId,
    };
  }

  if (sample.source === "ci") {
    const failed = payload.conclusion === "failure";
    return {
      id: `evt-int-${sample.id}`,
      type: failed ? "ci_failed" : "ci_passed",
      timestamp: baseTimestamp,
      actor: "tool",
      source: "ci",
      title: `集成回放：${sample.label}`,
      detail: `Webhook ${sample.eventName}: ${summary}`,
      competencyImpacts: impactsFor(competencies, sample.source, !failed),
      confidence: 0.91,
      risk: failed ? "medium" : "low",
      traceId,
    };
  }

  if (sample.source === "feishu") {
    return {
      id: `evt-int-${sample.id}`,
      type: "teacher_reviewed",
      timestamp: baseTimestamp,
      actor: "teacher",
      source: "teacher",
      title: `集成回放：${sample.label}`,
      detail: `Webhook ${sample.eventName}: ${summary}`,
      competencyImpacts: impactsFor(competencies, sample.source, true),
      confidence: 0.9,
      risk: "low",
      traceId,
    };
  }

  return {
    id: `evt-int-${sample.id}`,
    type: "task_started",
    timestamp: baseTimestamp,
    actor: "teacher",
    source: "teacher",
    title: `集成回放：${sample.label}`,
    detail: `Webhook ${sample.eventName}: ${summary}`,
    competencyImpacts: impactsFor(competencies, sample.source, true),
    confidence: 0.82,
    risk: "low",
    traceId,
  };
}

export function runIntegrationWebhookDryRun(
  sample: IntegrationWebhookSample,
  state: AppState,
  apiContract: ApiContractReport,
  privacyGate: PrivacyGuardReport["gate"],
): IntegrationMappingResult {
  const event = eventForSample(sample);
  const duplicate = state.events.some((existing) => existing.id === event.id);
  const sensitive = hasSensitiveValue(sample.payload);
  const knownWebhook = apiContract.webhooks.some((webhook) => webhook.eventName === sample.eventName);
  const hasTenant = Boolean(sample.payload.tenantId && sample.payload.courseId);
  const hasIdempotency = sample.idempotencyKey.length >= 12;

  const checks: IntegrationCheck[] = [
    {
      id: "schema",
      label: "载荷结构",
      status: hasTenant ? "pass" : "block",
      evidence: hasTenant ? "tenantId/courseId 已提供" : "缺少租户或课程隔离字段",
    },
    {
      id: "idempotency",
      label: "幂等键",
      status: hasIdempotency && !duplicate ? "pass" : duplicate ? "watch" : "block",
      evidence: duplicate ? "当前事件已存在，将按 ID 去重" : sample.idempotencyKey,
    },
    {
      id: "privacy",
      label: "隐私扫描",
      status: sensitive || privacyGate === "block" ? "block" : "pass",
      evidence: sensitive ? "发现邮箱、手机号或密钥形态字段" : `privacy gate: ${privacyGate}`,
    },
    {
      id: "contract",
      label: "契约匹配",
      status: knownWebhook ? "pass" : "watch",
      evidence: knownWebhook ? "命中 API 契约中心 Webhook" : "契约中心尚未声明该事件名",
    },
    {
      id: "mapping",
      label: "EvidenceEvent 映射",
      status: Object.keys(event.competencyImpacts).length > 0 ? "pass" : "block",
      evidence: `${event.type} -> ${Object.keys(event.competencyImpacts).join(", ")}`,
    },
  ];

  const hasBlock = checks.some((check) => check.status === "block");
  const hasWatch = checks.some((check) => check.status === "watch");
  const qualityGate: IntegrationGateStatus = hasBlock ? "block" : hasWatch ? "watch" : "pass";

  return {
    sampleId: sample.id,
    source: sample.source,
    eventName: sample.eventName,
    idempotencyKey: sample.idempotencyKey,
    qualityGate,
    checks,
    events: qualityGate === "block" ? [] : [event],
    deadLetterReason: hasBlock ? checks.filter((check) => check.status === "block").map((check) => check.label).join(" / ") : null,
    sanitizedPayload: sanitizePayload(sample),
    summary:
      qualityGate === "block"
        ? "当前载荷进入 dead-letter 队列，需先处理阻断项。"
        : qualityGate === "watch"
          ? "当前载荷可进入影子写入，重复事件会按 ID 去重。"
          : "当前载荷可映射为 EvidenceEvent，并进入学习诊断闭环。",
  };
}

export function buildIntegrationSandboxReport(
  state: AppState,
  apiContract: ApiContractReport,
  privacyGuard: PrivacyGuardReport,
): IntegrationSandboxReport {
  const dryRuns = integrationWebhookSamples.map((sample) =>
    runIntegrationWebhookDryRun(sample, state, apiContract, privacyGuard.gate),
  );
  const passCount = dryRuns.filter((run) => run.qualityGate === "pass").length;
  const watchCount = dryRuns.filter((run) => run.qualityGate === "watch").length;
  const blockCount = dryRuns.filter((run) => run.qualityGate === "block").length;
  const score = Math.round(((passCount + watchCount * 0.72) / dryRuns.length) * 100);
  const sources = [
    { source: "git", label: "Git" },
    { source: "ci", label: "CI" },
    { source: "lms", label: "LMS" },
    { source: "feishu", label: "飞书" },
  ] as const;

  return {
    score,
    mode: blockCount > 0 ? "Webhook Replay / 阻断项待处理" : watchCount > 0 ? "Webhook Replay / 影子写入" : "Webhook Replay / 可写入账本",
    gate:
      blockCount > 0
        ? "存在隐私、租户或映射阻断项，不能自动进入学习诊断。"
        : "样例 Webhook 已能完成脱敏、幂等、契约匹配和 EvidenceEvent 映射。",
    samples: integrationWebhookSamples,
    dryRuns,
    sourceCoverage: sources.map((item) => {
      const run = dryRuns.find((candidate) => candidate.source === item.source);
      return {
        label: item.label,
        value: run ? run.eventName : "missing",
        status: run?.qualityGate ?? "block",
      };
    }),
    operatingRules: [
      "所有外部载荷必须包含 tenantId、courseId 和幂等键，避免跨课程串写。",
      "Webhook 只写入摘要、能力影响、风险和 traceId，原始密钥、手机号、邮箱和大日志不进 EvidenceEvent。",
      "重复事件按 EvidenceEvent ID 去重，失败载荷进入 dead-letter 影子队列。",
      "CI、Git、LMS 和飞书事件写入同一账本后，会影响诊断、路径、教师周报和导出材料。",
    ],
    apiScore: apiContract.score,
    privacyGate: privacyGuard.gate,
  };
}
