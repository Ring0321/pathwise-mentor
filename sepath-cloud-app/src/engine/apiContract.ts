import type { AppState } from "../domain/types";
import { evidenceCoverage } from "./evidence";
import type { PilotReadinessReport } from "./pilotReadiness";
import type { PrivacyGuardReport } from "./privacyGuard";

export type ApiContractStatus = "ready" | "configured" | "manual";

export interface ApiEndpointContract {
  id: string;
  method: "GET" | "POST" | "PATCH";
  path: string;
  purpose: string;
  authScope: string;
  idempotency: string;
  requestShape: string[];
  responseShape: string[];
  status: ApiContractStatus;
}

export interface WebhookContract {
  id: string;
  source: string;
  eventName: string;
  retryPolicy: string;
  idempotencyKey: string;
  evidenceMapping: string;
  protectedFields: string[];
  status: ApiContractStatus;
}

export interface ProvisioningStep {
  id: string;
  label: string;
  owner: "team" | "teacher" | "school" | "ops";
  status: ApiContractStatus;
  evidence: string;
  nextAction: string;
}

export interface ApiMetric {
  id: string;
  label: string;
  value: string;
  target: string;
}

export interface ApiContractReport {
  score: number;
  mode: string;
  gate: string;
  readyCount: number;
  configuredCount: number;
  manualCount: number;
  endpoints: ApiEndpointContract[];
  webhooks: WebhookContract[];
  provisioning: ProvisioningStep[];
  environmentVariables: string[];
  dataResidencyRules: string[];
  openApiSpecPath: string;
  openApiValidationReportPath: string;
  openApiValidationCommand: string;
  openApiOperationCount: number;
  openApiManifest: string;
  samplePayload: string;
  metrics: ApiMetric[];
  migrationPlan: string[];
}

function statusWeight(status: ApiContractStatus): number {
  if (status === "ready") return 1;
  if (status === "configured") return 0.72;
  return 0.42;
}

function hasEvent(state: AppState, type: string): boolean {
  return state.events.some((event) => event.type === type);
}

export function buildApiContractReport(
  state: AppState,
  pilotReadiness: PilotReadinessReport,
  privacyGuard: PrivacyGuardReport,
): ApiContractReport {
  const coverage = evidenceCoverage(state.events);
  const hasGitEvidence = hasEvent(state, "pr_opened") || hasEvent(state, "commit_pushed");
  const hasCiEvidence = hasEvent(state, "ci_failed") || hasEvent(state, "ci_passed");
  const hasTeacherReview = hasEvent(state, "teacher_reviewed");
  const hasReflection = hasEvent(state, "reflection_submitted");
  const privacyReady = privacyGuard.gate === "pass";

  const endpoints: ApiEndpointContract[] = [
    {
      id: "evidence-create",
      method: "POST",
      path: "/api/evidence/events",
      purpose: "接收 Git、CI、LMS、教师复核和学生反思事件，统一写入 EvidenceEvent 账本。",
      authScope: "course:evidence.write",
      idempotency: "tenantId + source + externalId + eventType",
      requestShape: ["tenantId", "courseId", "learnerHash", "source", "eventType", "externalId", "payload"],
      responseShape: ["eventId", "traceId", "deduped", "qualityGate", "stored", "storageMode"],
      status: hasGitEvidence || hasCiEvidence ? "ready" : "configured",
    },
    {
      id: "evidence-readback",
      method: "GET",
      path: "/api/evidence/events",
      purpose: "按租户、课程和 learnerHash 读取已写入的脱敏 EvidenceEvent，支持评审现场写入后读回验收。",
      authScope: "course:evidence.read",
      idempotency: "read-only",
      requestShape: ["tenantId", "courseId", "learnerHash", "limit"],
      responseShape: ["count", "events[]", "storageMode"],
      status: hasGitEvidence || hasCiEvidence ? "ready" : "configured",
    },
    {
      id: "diagnosis-read",
      method: "GET",
      path: "/api/learners/{learnerHash}/diagnosis",
      purpose: "读取脱敏学生的诊断卡、证据覆盖率和当前阻塞原因。",
      authScope: "course:diagnosis.read",
      idempotency: "read-only",
      requestShape: ["tenantId", "courseId", "learnerHash"],
      responseShape: ["diagnosisId", "blocker", "confidence", "evidenceEventIds"],
      status: coverage >= 0.6 ? "ready" : "configured",
    },
    {
      id: "intervention-rank",
      method: "POST",
      path: "/api/interventions/rank",
      purpose: "根据 SafeVOI 对脚手架、补证据、mini lab 和教师复核候选行动排序。",
      authScope: "course:intervention.rank",
      idempotency: "traceId + strategyVersion",
      requestShape: ["tenantId", "learnerHash", "diagnosisId", "strategyVersion", "candidateActions"],
      responseShape: ["rankedActions", "blockedActions", "teacherReviewRequired"],
      status: "ready",
    },
    {
      id: "review-ticket",
      method: "POST",
      path: "/api/review/tickets",
      purpose: "创建教师发布门工单，防止高风险建议或替写答案自动发布。",
      authScope: "course:review.write",
      idempotency: "diagnosisId + blockedActionId",
      requestShape: ["tenantId", "courseId", "learnerHash", "severity", "reasonCodes"],
      responseShape: ["ticketId", "status", "requiredActions"],
      status: hasTeacherReview ? "ready" : "configured",
    },
    {
      id: "review-ticket-readback",
      method: "GET",
      path: "/api/review/tickets",
      purpose: "读取教师发布门工单列表，验证高风险建议不会消失在前端状态里，而是进入可复核队列。",
      authScope: "course:review.read",
      idempotency: "read-only",
      requestShape: ["tenantId", "courseId", "learnerHash", "status", "limit"],
      responseShape: ["count", "tickets[]", "storageMode"],
      status: hasTeacherReview ? "ready" : "configured",
    },
    {
      id: "ledger-import",
      method: "POST",
      path: "/api/ledgers/import",
      purpose: "导入外部 JSON 证据账本，校验事件结构并按 ID 去重合并。",
      authScope: "course:ledger.import",
      idempotency: "ledgerSha256 + tenantId",
      requestShape: ["tenantId", "ledgerSha256", "events[]"],
      responseShape: ["importedEvents", "duplicateEvents", "invalidEvents", "mergeStatus"],
      status: "ready",
    },
    {
      id: "privacy-audit",
      method: "GET",
      path: "/api/privacy/audit",
      purpose: "读取角色权限、数据分级、敏感字段扫描和越权拦截摘要。",
      authScope: "course:privacy.read",
      idempotency: "read-only",
      requestShape: ["tenantId", "courseId", "role"],
      responseShape: ["gate", "piiFindings", "blockedRequests", "auditEvents"],
      status: privacyReady ? "ready" : "manual",
    },
    {
      id: "ai-generate-scaffold",
      method: "POST",
      path: "/api/ai/generate-scaffold",
      purpose: "通过后端 LLM Gateway 生成受控脚手架提示，支持真实模型和无 Key 确定性 fallback 两条路径。",
      authScope: "course:ai.generate",
      idempotency: "traceId + promptVersion",
      requestShape: [
        "tenantId",
        "courseId",
        "learnerHash",
        "traceId",
        "evidenceEventIds",
        "knowledgeSourceIds",
        "guardrails",
        "requestedOutputSchema",
      ],
      responseShape: [
        "runtime",
        "contractVersion",
        "mode",
        "fallback",
        "refusal",
        "checklist",
        "miniLab",
        "evidenceToSubmit",
        "citations",
        "teacherReviewRequired",
      ],
      status: privacyReady ? "ready" : "manual",
    },
  ];

  const webhooks: WebhookContract[] = [
    {
      id: "git-pr",
      source: "GitHub / GitLab / Gitee",
      eventName: "pull_request.opened",
      retryPolicy: "3 次指数退避，失败后进入 dead-letter 影子队列。",
      idempotencyKey: "repositoryId + pullRequestId + action + updatedAt",
      evidenceMapping: "pr_opened -> implementation / collaboration EvidenceEvent",
      protectedFields: ["accessToken", "rawDiff", "privateEmail"],
      status: hasGitEvidence ? "ready" : "configured",
    },
    {
      id: "ci-check",
      source: "CI/CD",
      eventName: "check_suite.completed",
      retryPolicy: "仅保存摘要；大日志转对象存储并设 7 天过期。",
      idempotencyKey: "workflowRunId + conclusion",
      evidenceMapping: "ci_failed / ci_passed -> testing EvidenceEvent",
      protectedFields: ["runnerSecret", "rawLog", "artifactUrl"],
      status: hasCiEvidence ? "ready" : "configured",
    },
    {
      id: "lms-rubric",
      source: "LMS / 课程平台",
      eventName: "assignment.rubric.updated",
      retryPolicy: "Rubric 版本变更后重算知识边界，不自动覆盖教师评分。",
      idempotencyKey: "courseId + assignmentId + rubricVersion",
      evidenceMapping: "rubric -> KnowledgeSource boundary",
      protectedFields: ["studentRealName", "scoreSheetRaw"],
      status: "configured",
    },
    {
      id: "feishu-action",
      source: "飞书 / 教师群",
      eventName: "card.action.teacher_reviewed",
      retryPolicy: "教师操作必须回写 ticket 状态，失败则保留人工待办。",
      idempotencyKey: "ticketId + operatorId + actionAt",
      evidenceMapping: "teacher_reviewed -> review gate EvidenceEvent",
      protectedFields: ["teacherMobile", "chatOpenId"],
      status: hasTeacherReview ? "ready" : "configured",
    },
  ];

  const provisioning: ProvisioningStep[] = [
    {
      id: "tenant",
      label: "课程租户初始化",
      owner: "ops",
      status: "ready",
      evidence: "当前 Demo 已按 course_isolated 形态展示工作空间配置。",
      nextAction: "生产环境生成 tenantId、courseId、strategyVersion 和默认权限策略。",
    },
    {
      id: "roster",
      label: "脱敏名册映射",
      owner: "teacher",
      status: pilotReadiness.readyCount >= 3 ? "ready" : "configured",
      evidence: "课程试点工作台已展示班级名册、分组和脱敏学生 ID 边界。",
      nextAction: "真实试点导入 learnerHash，不在模型上下文中传递姓名和手机号。",
    },
    {
      id: "webhook-secret",
      label: "Webhook 密钥与签名",
      owner: "team",
      status: "configured",
      evidence: "契约中心已定义 idempotencyKey、protectedFields 和 retryPolicy。",
      nextAction: "上线时配置 GIT_WEBHOOK_SECRET、CI_WEBHOOK_SECRET 和 FEISHU_APP_SECRET。",
    },
    {
      id: "reviewers",
      label: "教师复核人配置",
      owner: "school",
      status: hasTeacherReview ? "ready" : "configured",
      evidence: hasTeacherReview ? "教师复核事件已回写证据账本。" : "高风险建议已能创建复核工单。",
      nextAction: "生产环境按课程配置 primaryReviewer 与 backupReviewer。",
    },
    {
      id: "public-access",
      label: "公开试用访问策略",
      owner: "ops",
      status: "manual",
      evidence: "当前 Sites 仍为 owner-only，公开只读包可另行部署。",
      nextAction: "按主办方要求选择 owner-only、公开只读或演示账号。",
    },
  ];

  const allStatuses = [...endpoints, ...webhooks, ...provisioning].map((item) => item.status);
  const readyCount = allStatuses.filter((status) => status === "ready").length;
  const configuredCount = allStatuses.filter((status) => status === "configured").length;
  const manualCount = allStatuses.filter((status) => status === "manual").length;
  const score = Math.round((allStatuses.reduce((total, status) => total + statusWeight(status), 0) / allStatuses.length) * 100);

  return {
    score,
    mode: manualCount > 0 ? "API Ready / 人工发布门保留" : "API Ready / 可小班试点",
    gate: manualCount > 0
      ? "接口契约、Webhook、幂等和隐私边界已产品化；公开访问策略仍需人工确认。"
      : "接口契约已具备进入小班试点的上线条件。",
    readyCount,
    configuredCount,
    manualCount,
    endpoints,
    webhooks,
    provisioning,
    environmentVariables: [
      "SEPATH_TENANT_ID",
      "SEPATH_COURSE_ID",
      "SEPATH_AUTH_SECRET",
      "DATABASE_URL",
      "GIT_WEBHOOK_SECRET",
      "CI_WEBHOOK_SECRET",
      "FEISHU_APP_ID",
      "FEISHU_APP_SECRET",
      "OPENAI_API_KEY",
      "LLM_BASE_URL",
      "LLM_API_KEY",
      "LLM_MODEL",
      "SEPATH_PRIVACY_MODE=pseudonymous",
    ],
    dataResidencyRules: [
      "tenantId/courseId 作为所有事件、诊断、复核和导出的一级隔离键。",
      "learnerHash 替代姓名、学号、手机号和邮箱进入模型上下文。",
      "原始仓库密钥、CI 日志和飞书 openId 不进入 EvidenceEvent，只保留摘要与 traceId。",
      "所有导入、导出和教师复核动作写入 auditEvents，支持课程结束后删除个人事件。",
    ],
    samplePayload: JSON.stringify(
      {
        tenantId: "tenant-se-course-2026",
        courseId: "software-engineering-project",
        learnerHash: "stu_hash_8f2a",
        source: "ci",
        eventType: "ci_failed",
        externalId: "run_241901",
        idempotencyKey: "run_241901:ci_failed",
        payload: {
          title: "CI failed: boundary tests",
          competencies: ["testing", "implementation"],
          risk: "medium",
        },
      },
      null,
      2,
    ),
    openApiSpecPath: "sepath-cloud-app/cloud/openapi.sepath.json",
    openApiValidationReportPath: "sepath-cloud-app/qa/openapi-contract-validation.json",
    openApiValidationCommand: "python scripts/validate_openapi_contract.py",
    openApiOperationCount: endpoints.length + 1,
    openApiManifest: JSON.stringify(
      {
        runtime: "sepath-openapi-contract.v1",
        spec: "sepath-cloud-app/cloud/openapi.sepath.json",
        report: "sepath-cloud-app/qa/openapi-contract-validation.json",
        command: "python scripts/validate_openapi_contract.py",
        operationCount: 10,
        publicSecretBoundary: "front-end package contains no API key; LLM_API_KEY only lives in Worker/server secret storage",
      },
      null,
      2,
    ),
    metrics: [
      {
        id: "endpoint-count",
        label: "核心 API",
        value: `${endpoints.length} 个`,
        target: "覆盖证据、诊断、干预、复核、账本、隐私审计和 LLM Gateway",
      },
      {
        id: "openapi-contract",
        label: "OpenAPI 机器契约",
        value: "10 operations",
        target: "由 validate_openapi_contract.py 校验接口、Schema、鉴权与隐私边界",
      },
      {
        id: "webhook-count",
        label: "Webhook",
        value: `${webhooks.length} 类`,
        target: "覆盖 Git、CI、LMS 和飞书教师操作",
      },
      {
        id: "contract-score",
        label: "契约就绪度",
        value: `${score}`,
        target: ">=80 可进入影子运行",
      },
      {
        id: "reflection",
        label: "反思回写",
        value: hasReflection ? "已闭环" : "待补齐",
        target: "每轮干预后都有反思或教师复核证据",
      },
    ],
    migrationPlan: [
      "P0：保持静态前端 Demo，导出账本中附带 apiContract 报告供评委复核。",
      "P1：增加轻量 API 服务，先接收 Git/CI Webhook 并写入脱敏 EvidenceEvent。",
      "P2：把 SafeVOI、知识边界和教师复核迁移为后端策略服务，前端只读展示和提交教师操作。",
      "P3：接入课程平台、飞书和 Postgres，按 tenantId 隔离课程工作空间。",
      "P4：加入 OpenTelemetry trace、dead-letter 队列、权限审计和课程结束删除流程。",
    ],
  };
}
