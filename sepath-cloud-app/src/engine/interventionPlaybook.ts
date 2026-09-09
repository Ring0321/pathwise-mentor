import type { AppState, DiagnosisCard, ReviewTicket, ScaffoldMessage, TaskDecision } from "../domain/types";
import type { ApiContractReport } from "./apiContract";
import { evidenceCoverage } from "./evidence";
import type { ModelOpsReport } from "./modelOps";
import type { PrivacyGuardReport } from "./privacyGuard";
import type { TeacherReport } from "./teacherReport";
import type { ValueUpliftReport } from "./valueUplift";

export type InterventionPlaybookStatus = "ready" | "review" | "manual" | "blocked";
export type InterventionAudience = "student" | "teacher" | "cohort" | "ops";

export interface InterventionPackage {
  id: string;
  title: string;
  audience: InterventionAudience;
  trigger: string;
  safeVoiRank: string;
  publishState: string;
  teacherCopy: string;
  studentCopy: string;
  channels: string[];
  evidence: string[];
  telemetry: string[];
  rollback: string;
  owner: string;
  apiRoute: string;
  status: InterventionPlaybookStatus;
}

export interface InterventionQueueItem {
  id: string;
  label: string;
  owner: "teacher" | "assistant" | "school" | "ops";
  sla: string;
  evidence: string;
  nextAction: string;
  status: InterventionPlaybookStatus;
}

export interface InterventionChannel {
  id: string;
  label: string;
  path: string;
  payload: string[];
  ack: string;
  status: InterventionPlaybookStatus;
}

export interface InterventionGuardrail {
  id: string;
  label: string;
  rule: string;
  evidence: string;
  status: InterventionPlaybookStatus;
}

export interface InterventionMetric {
  id: string;
  label: string;
  value: string;
  target: string;
  status: InterventionPlaybookStatus;
}

export interface InterventionPlaybookReport {
  score: number;
  mode: string;
  summary: string;
  releaseManifest: string;
  readyCount: number;
  reviewCount: number;
  manualCount: number;
  blockedCount: number;
  metrics: InterventionMetric[];
  packages: InterventionPackage[];
  queue: InterventionQueueItem[];
  channels: InterventionChannel[];
  guardrails: InterventionGuardrail[];
  teacherScript: string[];
  telemetryPlan: string[];
}

function statusWeight(status: InterventionPlaybookStatus): number {
  if (status === "ready") return 1;
  if (status === "review") return 0.76;
  if (status === "manual") return 0.48;
  return 0.12;
}

function countStatus<T extends { status: InterventionPlaybookStatus }>(
  rows: T[],
  status: InterventionPlaybookStatus,
): number {
  return rows.filter((row) => row.status === status).length;
}

function safeRank(decision: TaskDecision | undefined): string {
  if (!decision) return "候选缺失";
  return decision.rank ? `#${decision.rank}` : decision.gate === "BLOCK" ? "需教师复核" : "未排序";
}

function routeStatus(apiContract: ApiContractReport, path: string): InterventionPlaybookStatus {
  const hit = apiContract.endpoints.find((endpoint) => endpoint.path === path);
  if (!hit) return "manual";
  if (hit.status === "ready") return "ready";
  if (hit.status === "configured") return "review";
  return "manual";
}

export function buildInterventionPlaybookReport(
  state: AppState,
  diagnosis: DiagnosisCard,
  decisions: TaskDecision[],
  scaffold: ScaffoldMessage,
  reviewTicket: ReviewTicket,
  teacherReport: TeacherReport,
  valueUplift: ValueUpliftReport,
  apiContract: ApiContractReport,
  privacyGuard: PrivacyGuardReport,
  modelOps: ModelOpsReport,
): InterventionPlaybookReport {
  const coverage = evidenceCoverage(state.events);
  const topPass = decisions.find((decision) => decision.gate === "PASS");
  const checklist = decisions.find((decision) => decision.taskId === "action-checklist");
  const miniLab = decisions.find((decision) => decision.taskId === "action-mini-lab");
  const teacherReview = decisions.find((decision) => decision.taskId === "action-teacher-review");
  const paidMentor = decisions.find((decision) => decision.taskId === "action-paid-mentor");
  const privacyReady = privacyGuard.gate === "pass";
  const modelReady = modelOps.score >= 75;
  const apiReady = apiContract.score >= 80;
  const hasTeacherReview = state.events.some((event) => event.type === "teacher_reviewed");
  const hasReflection = state.events.some((event) => event.type === "reflection_submitted");
  const teacherCanApprove =
    privacyGuard.roleMatrix.find((role) => role.role === "teacher")?.canApproveIntervention ?? false;

  const packages: InterventionPackage[] = [
    {
      id: "student-scaffold-card",
      title: "学生脚手架行动卡",
      audience: "student",
      trigger: diagnosis.blocker,
      safeVoiRank: safeRank(checklist ?? topPass),
      publishState: checklist?.gate === "PASS" && scaffold.refusesDirectAnswer ? "可自动草拟，教师可抽检" : "需复核",
      teacherCopy: "建议先发异常路径检查清单，不直接给完整代码；若学生 20 分钟内仍阻塞，再升级 mini lab。",
      studentCopy: `${scaffold.title}：${scaffold.checklist.slice(0, 3).join("；")}`,
      channels: ["应用内行动卡", "飞书学生提醒", "LMS 作业反馈"],
      evidence: [diagnosis.id, ...diagnosis.evidenceEventIds.slice(0, 3)],
      telemetry: ["card_opened", "checklist_completed", "ci_retried"],
      rollback: "学生标记无效或教师撤回时，行动卡归档并保留 traceId，不再重复推送。",
      owner: "assistant drafts / teacher audits",
      apiRoute: "/api/interventions/rank",
      status: checklist?.gate === "PASS" && privacyReady ? "ready" : "review",
    },
    {
      id: "cohort-mini-lab",
      title: "班级 20 分钟 mini lab",
      audience: "cohort",
      trigger: `班级共性阻塞：${teacherReport.classSignals[0]?.label ?? "GrowthOps 队列"}`,
      safeVoiRank: safeRank(miniLab),
      publishState: miniLab?.gate === "PASS" ? "可排入下节课" : "需教师改写",
      teacherCopy: "把失败日志、边界测试和最小修复拆成 20 分钟课堂活动，统一补证据，不按学生排名公开展示。",
      studentCopy: "本轮 mini lab 只要求定位失败路径、补一条最小测试、写下修复假设。",
      channels: ["课程公告", "课堂投屏", "教师周报"],
      evidence: [teacherReport.evidenceReferences[0], `value=${valueUplift.estimatedUpliftPoints}`],
      telemetry: ["attendance", "test_added", "reflection_submitted"],
      rollback: "若超过三分之一学生反馈负担过高，下调为课后可选练习并关闭提醒。",
      owner: "teacher",
      apiRoute: "/api/review/tickets",
      status: miniLab?.gate === "PASS" ? "ready" : "review",
    },
    {
      id: "teacher-review-ticket",
      title: "高风险教师复核工单",
      audience: "teacher",
      trigger: `${reviewTicket.severity} / ${reviewTicket.reason}`,
      safeVoiRank: safeRank(teacherReview),
      publishState: hasTeacherReview ? "已复核，可记录样例" : "必须人工确认",
      teacherCopy: "请判断该建议是否会变成替写、是否需要限制到检查清单、是否补充 Rubric 解释。",
      studentCopy: "该建议正在等待教师确认，先按已发布的检查清单继续补证据。",
      channels: ["教师复核台", "飞书卡片", "审计日志"],
      evidence: [reviewTicket.id, ...reviewTicket.evidenceEventIds],
      telemetry: ["review_created", "review_approved", "review_revised"],
      rollback: "教师拒绝后，所有同类高风险建议进入阻断列表并触发策略回放。",
      owner: "teacher",
      apiRoute: "/api/review/tickets",
      status: hasTeacherReview && teacherCanApprove ? "ready" : "manual",
    },
    {
      id: "reflection-memory-prompt",
      title: "反思记忆回写提示",
      audience: "student",
      trigger: hasReflection ? "已有反思，可进入下一轮路径调整" : "干预后缺少反思",
      safeVoiRank: "闭环必选",
      publishState: hasReflection ? "已闭环" : "干预发布后自动提醒",
      teacherCopy: "反思问题只追问证据、决策和下一次迁移，不评价人格和排名。",
      studentCopy: "请写下：我看到的失败证据、我尝试的最小修复、下一次我会先检查什么。",
      channels: ["应用内反思卡", "LMS 作业追问"],
      evidence: [`coverage=${Math.round(coverage * 100)}%`, `events=${state.events.length}`],
      telemetry: ["reflection_opened", "reflection_submitted", "path_replanned"],
      rollback: "若学生拒绝反思，只保留学习状态，不生成负面标签。",
      owner: "assistant",
      apiRoute: "/api/evidence/events",
      status: hasReflection ? "ready" : "review",
    },
    {
      id: "paid-action-blocker",
      title: "付费/不可逆行动阻断器",
      audience: "ops",
      trigger: paidMentor?.reasonCodes.join(" / ") ?? "LOWER_COST_INFORMATION_DOMINATES",
      safeVoiRank: safeRank(paidMentor),
      publishState: "禁止自动发布",
      teacherCopy: "当前系统优先免费、低负担、可逆行动；付费一对一只能作为人工转介，不能由模型自动推荐。",
      studentCopy: "系统不会因为一次失败 PR 推送付费服务，会先提供可复核的低成本行动。",
      channels: ["策略发布门", "审计日志"],
      evidence: paidMentor?.reasonCodes ?? ["paid decision absent"],
      telemetry: ["blocked_action", "guardrail_reason", "teacher_override_requested"],
      rollback: "任何人工 override 都必须写入 review ticket，并在周报中展示。",
      owner: "school",
      apiRoute: "/api/privacy/audit",
      status: paidMentor?.gate === "BLOCK" ? "ready" : "manual",
    },
  ];

  const queue: InterventionQueueItem[] = [
    {
      id: "publish-student-card",
      label: "发布学生脚手架卡",
      owner: "assistant",
      sla: "当前阻塞识别后 5 分钟内",
      evidence: packages[0].evidence.join(" / "),
      nextAction: "草拟行动卡，附证据 ID 和拒绝替写原因。",
      status: packages[0].status,
    },
    {
      id: "approve-risk-ticket",
      label: "教师复核高风险建议",
      owner: "teacher",
      sla: "P0 当天，P1 24 小时内",
      evidence: reviewTicket.id,
      nextAction: "确认是否发布、改写或阻断该建议。",
      status: packages[2].status,
    },
    {
      id: "schedule-mini-lab",
      label: "排入班级 mini lab",
      owner: "teacher",
      sla: "下一次课前",
      evidence: teacherReport.actionPlan[0]?.evidence ?? "teacher action plan",
      nextAction: "把共性失败路径转为 20 分钟活动，不暴露学生个人排名。",
      status: packages[1].status,
    },
    {
      id: "write-back-telemetry",
      label: "回写干预遥测",
      owner: "ops",
      sla: "干预后 48 小时",
      evidence: valueUplift.telemetryContract.slice(0, 2).join(" / "),
      nextAction: "收集打开、完成、CI 重试、反思质量和教师修订事件。",
      status: apiReady && privacyReady ? "ready" : "review",
    },
  ];

  const channels: InterventionChannel[] = [
    {
      id: "rank-api",
      label: "SafeVOI 排序服务",
      path: "/api/interventions/rank",
      payload: ["diagnosisId", "candidateActions", "strategyVersion", "teacherReviewRequired"],
      ack: "rankedActions + blockedActions + traceId",
      status: routeStatus(apiContract, "/api/interventions/rank"),
    },
    {
      id: "review-ticket-api",
      label: "教师复核工单",
      path: "/api/review/tickets",
      payload: ["learnerHash", "severity", "reasonCodes", "evidenceEventIds"],
      ack: "ticketId + status + requiredActions",
      status: routeStatus(apiContract, "/api/review/tickets"),
    },
    {
      id: "evidence-write-api",
      label: "干预结果回写",
      path: "/api/evidence/events",
      payload: ["source", "eventType", "externalId", "payload", "traceId"],
      ack: "eventId + deduped + qualityGate",
      status: routeStatus(apiContract, "/api/evidence/events"),
    },
    {
      id: "feishu-card",
      label: "飞书教师操作卡",
      path: "card.action.teacher_reviewed",
      payload: ["ticketId", "operatorId", "action", "revisionNote"],
      ack: "teacher_reviewed EvidenceEvent",
      status: apiContract.webhooks.find((webhook) => webhook.id === "feishu-action")?.status === "ready" ? "ready" : "review",
    },
  ];

  const guardrails: InterventionGuardrail[] = [
    {
      id: "no-direct-answer",
      label: "不替写完整答案",
      rule: "学生请求完整代码时，只允许发布检查清单、mini lab、证据追问和教师复核。",
      evidence: scaffold.refusesDirectAnswer ? "scaffold.refusesDirectAnswer=true" : "direct answer gate pending",
      status: scaffold.refusesDirectAnswer ? "ready" : "review",
    },
    {
      id: "privacy-minimum",
      label: "最小化与脱敏",
      rule: "发布对象只使用 learnerHash、competency、evidenceEventIds 和 traceId，不带姓名、手机号或仓库密钥。",
      evidence: `${privacyGuard.piiFindings} PII findings / gate=${privacyGuard.gate}`,
      status: privacyReady ? "ready" : "blocked",
    },
    {
      id: "human-approval",
      label: "高风险人工确认",
      rule: "高风险、不可逆、付费或可能替写的建议必须进入教师发布门。",
      evidence: reviewTicket.action,
      status: teacherCanApprove ? "ready" : "manual",
    },
    {
      id: "model-release",
      label: "模型治理发布门",
      rule: "只有通过 ModelOps 发布门的策略版本才能进入干预发布中心。",
      evidence: `${modelOps.modelVersion} / ${modelOps.gate}`,
      status: modelReady ? "ready" : "review",
    },
  ];

  const metrics: InterventionMetric[] = [
    {
      id: "publishable-actions",
      label: "可发布行动包",
      value: `${packages.filter((item) => item.status === "ready").length}/${packages.length}`,
      target: "至少 3 类行动可发布，且有人工门禁",
      status: packages.filter((item) => item.status === "ready").length >= 3 ? "ready" : "review",
    },
    {
      id: "teacher-gate",
      label: "教师发布门",
      value: teacherCanApprove ? "已定义" : "待配置",
      target: "高风险建议不能自动发给学生",
      status: teacherCanApprove ? "ready" : "manual",
    },
    {
      id: "api-ready",
      label: "API 出口",
      value: `${apiContract.readyCount}/${apiContract.endpoints.length}`,
      target: "排序、复核、证据回写三类接口可追踪",
      status: apiReady ? "ready" : "review",
    },
    {
      id: "uplift-loop",
      label: "增值回收",
      value: `${valueUplift.estimatedUpliftPoints} pts`,
      target: "干预后回收到遥测和反思，不直接宣称真实提分",
      status: valueUplift.claims.every((claim) => claim.allowed || claim.status !== "proved") ? "ready" : "manual",
    },
  ];

  const allStatuses = [
    ...packages.map((item) => item.status),
    ...queue.map((item) => item.status),
    ...channels.map((item) => item.status),
    ...guardrails.map((item) => item.status),
    ...metrics.map((item) => item.status),
  ];
  const readyCount = allStatuses.filter((status) => status === "ready").length;
  const reviewCount = allStatuses.filter((status) => status === "review").length;
  const manualCount = allStatuses.filter((status) => status === "manual").length;
  const blockedCount = allStatuses.filter((status) => status === "blocked").length;
  const score = Math.round((allStatuses.reduce((total, status) => total + statusWeight(status), 0) / allStatuses.length) * 100);

  return {
    score,
    mode: blockedCount > 0 ? "发布阻断 / 需先修复治理" : manualCount > 0 ? "可影子运行 / 教师确认" : "可小班试点发布",
    summary:
      "干预发布中心把 SafeVOI 决策、脚手架生成、教师复核、API 契约、隐私门禁和增值遥测合成为可执行教学行动包。",
    releaseManifest: JSON.stringify(
      {
        version: "sepath-intervention-playbook.v1",
        learnerHash: state.learner.id,
        diagnosisId: diagnosis.id,
        topDecision: topPass?.taskId ?? "none",
        packageCount: packages.length,
        teacherGate: teacherCanApprove,
        privacyGate: privacyGuard.gate,
        apiMode: apiContract.mode,
        modelVersion: modelOps.modelVersion,
        noDirectAnswer: scaffold.refusesDirectAnswer,
      },
      null,
      2,
    ),
    readyCount,
    reviewCount,
    manualCount,
    blockedCount,
    metrics,
    packages,
    queue,
    channels,
    guardrails,
    teacherScript: [
      "先看诊断证据和 SafeVOI 排名，不按模型一句话直接发布。",
      "对学生只发布下一步行动、证据要求和反思问题，不发布完整答案。",
      "对班级只展示共性阻塞和 mini lab，不公开个人排名。",
      "对高风险、付费、不可逆或边界不清建议，进入教师复核工单。",
      "干预后 48 小时看 CI 重试、反思质量、教师修订和阻塞解除时间。",
    ],
    telemetryPlan: [
      "publish_started -> intervention_card_delivered -> student_action_taken",
      "teacher_reviewed / teacher_revised / teacher_rejected",
      "ci_retried + ci_passed + reflection_submitted",
      "value_uplift_shadow_update，不把影子估计表述为真实提分",
      "audit_log 写入 tenantId、courseId、learnerHash、traceId 和 action",
    ],
  };
}
