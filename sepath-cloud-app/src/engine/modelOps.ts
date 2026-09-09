import type { AppState } from "../domain/types";
import type { ApiContractReport } from "./apiContract";
import { evidenceCoverage } from "./evidence";
import type { PrivacyGuardReport } from "./privacyGuard";
import type { ResearchEvidenceReport } from "./researchEvidence";
import type { StrategyLabReport } from "./strategyLab";

export type ModelOpsStatus = "ready" | "watch" | "manual";

export interface AlgorithmRegistryItem {
  id: string;
  label: string;
  version: string;
  role: string;
  inputSignals: string[];
  outputContract: string;
  status: ModelOpsStatus;
}

export interface ExperimentProtocol {
  id: string;
  label: string;
  hypothesis: string;
  design: string;
  primaryMetric: string;
  guardrail: string;
  status: ModelOpsStatus;
}

export interface ModelReleaseGate {
  id: string;
  label: string;
  status: ModelOpsStatus;
  evidence: string;
}

export interface DriftMonitor {
  id: string;
  label: string;
  value: string;
  threshold: string;
  action: string;
  status: ModelOpsStatus;
}

export interface FeatureContract {
  id: string;
  label: string;
  source: string;
  refresh: string;
  privacy: string;
}

export interface ModelOpsReport {
  score: number;
  modelVersion: string;
  champion: string;
  challenger: string;
  releaseMode: string;
  gate: string;
  readyCount: number;
  watchCount: number;
  manualCount: number;
  registry: AlgorithmRegistryItem[];
  protocols: ExperimentProtocol[];
  releaseGates: ModelReleaseGate[];
  monitors: DriftMonitor[];
  featureContracts: FeatureContract[];
  offlineEval: string[];
  onlineEval: string[];
  nextModelActions: string[];
}

function hasEvent(state: AppState, type: string): boolean {
  return state.events.some((event) => event.type === type);
}

function statusWeight(status: ModelOpsStatus): number {
  if (status === "ready") return 1;
  if (status === "watch") return 0.68;
  return 0.4;
}

export function buildModelOpsReport(
  state: AppState,
  researchEvidence: ResearchEvidenceReport,
  strategyLab: StrategyLabReport,
  privacyGuard: PrivacyGuardReport,
  apiContract: ApiContractReport,
): ModelOpsReport {
  const coverage = evidenceCoverage(state.events);
  const hasTeacherReview = hasEvent(state, "teacher_reviewed");
  const hasReflection = hasEvent(state, "reflection_submitted");
  const highRiskCount = state.events.filter((event) => event.risk === "high").length;
  const safeVoiScore = strategyLab.policyResults.find((policy) => policy.id === "sepath-safevoi")?.compositeScore ?? 0;
  const chatScore = strategyLab.policyResults.find((policy) => policy.id === "chat-only")?.compositeScore ?? 0;

  const registry: AlgorithmRegistryItem[] = [
    {
      id: "path-twin",
      label: "路径数字孪生",
      version: "path-twin.v1",
      role: "将能力、路径节点、阻塞原因和完成证据保持为可追踪状态。",
      inputSignals: ["baseline", "Issue", "PR", "CI", "reflection"],
      outputContract: "PathNodeState[]",
      status: coverage >= 0.6 ? "ready" : "watch",
    },
    {
      id: "safevoi",
      label: "SafeVOI 策略排序",
      version: "safevoi.v1.3",
      role: "按学习增益、信息增益、迁移价值、窗口期、负担和风险选择下一步行动。",
      inputSignals: ["DiagnosisCard", "TaskCandidate", "risk", "cost"],
      outputContract: "TaskDecision[] with PASS/BLOCK gates",
      status: safeVoiScore > chatScore ? "ready" : "watch",
    },
    {
      id: "knowledge-boundary",
      label: "课程知识边界",
      version: "boundary.v1",
      role: "把 Rubric、代码证据、AI 使用策略和反思记忆约束到输出边界。",
      inputSignals: ["rubric", "code_evidence", "policy", "reflection"],
      outputContract: "KnowledgeBoundaryReport",
      status: researchEvidence.readinessScore >= 80 ? "ready" : "watch",
    },
    {
      id: "scaffold-policy",
      label: "不替写脚手架策略",
      version: "scaffold.v1",
      role: "把直接答案请求改写为检查清单、mini lab 和教师可复核建议。",
      inputSignals: ["chat risk", "diagnosis", "teacher gate"],
      outputContract: "ScaffoldMessage",
      status: highRiskCount > 0 ? "ready" : "watch",
    },
    {
      id: "privacy-policy",
      label: "隐私与权限治理",
      version: "privacy.v1",
      role: "扫描敏感字段、约束角色权限并记录越权拦截。",
      inputSignals: ["AppState", "PilotReadinessReport"],
      outputContract: "PrivacyGuardReport",
      status: privacyGuard.gate === "pass" ? "ready" : "manual",
    },
    {
      id: "api-contract",
      label: "API 与集成契约",
      version: "api-contract.v1",
      role: "定义真实 Git/CI/LMS/飞书接入时的接口、Webhook、幂等键和租户隔离。",
      inputSignals: ["tenantId", "courseId", "webhook", "ledger"],
      outputContract: "ApiContractReport",
      status: apiContract.score >= 80 ? "ready" : "watch",
    },
  ];

  const protocols: ExperimentProtocol[] = [
    {
      id: "offline-replay",
      label: "离线事件回放",
      hypothesis: "同一组 EvidenceEvent 下，SE-Path SafeVOI 比普通聊天更能控制风险并保持学习增益。",
      design: "固定合成账本，回放 chat-only、static-path、sepath-safevoi 三类策略。",
      primaryMetric: `SafeVOI 领先 ${strategyLab.winnerMargin} 分`,
      guardrail: "不把合成回放宣称为真实课程提分。",
      status: strategyLab.winnerId === "sepath-safevoi" ? "ready" : "watch",
    },
    {
      id: "shadow-course",
      label: "真实课程影子运行",
      hypothesis: "只读接入 PR/CI 后，诊断能帮助教师更快定位阻塞学生。",
      design: "接入真实仓库但不自动推送干预，教师每周复核误报。",
      primaryMetric: "证据覆盖率、误报率、教师复核时长",
      guardrail: "所有学生使用 learnerHash，退出后删除个人事件。",
      status: apiContract.manualCount > 0 ? "manual" : "watch",
    },
    {
      id: "teacher-confirmed-ab",
      label: "教师确认 A/B",
      hypothesis: "脚手架式 SafeVOI 干预比固定错题清单更能缩短阻塞解除时间。",
      design: "按项目组分配固定路径与 SafeVOI，所有高风险建议进入教师确认。",
      primaryMetric: "阻塞解除时间、CI 修复次数、反思质量",
      guardrail: "不以一次作业成绩直接推断长期提分。",
      status: hasTeacherReview && hasReflection ? "watch" : "manual",
    },
    {
      id: "red-team",
      label: "AI 使用边界红队",
      hypothesis: "直接索要完整代码、绕过测试、泄露隐私等请求应被拦截或降级。",
      design: "构造高风险对话、低证据建议和敏感字段注入样本。",
      primaryMetric: "替写拦截率、敏感字段命中率、教师复核命中率",
      guardrail: "红队样本只用合成数据和假密钥格式。",
      status: privacyGuard.blockedRequests.length > 0 ? "ready" : "watch",
    },
  ];

  const releaseGates: ModelReleaseGate[] = [
    {
      id: "tests",
      label: "算法回归测试",
      status: "ready",
      evidence: "Vitest 覆盖诊断、SafeVOI、策略实验、隐私治理、API 契约和 ModelOps 报告。",
    },
    {
      id: "evidence",
      label: "证据覆盖门",
      status: coverage >= 0.7 ? "ready" : "watch",
      evidence: `当前证据覆盖率 ${Math.round(coverage * 100)}%。`,
    },
    {
      id: "privacy",
      label: "隐私发布门",
      status: privacyGuard.gate === "pass" ? "ready" : "manual",
      evidence: `${privacyGuard.piiFindings} 个疑似 PII 命中，${privacyGuard.blockedRequests.length} 个越权请求被展示。`,
    },
    {
      id: "api",
      label: "API 契约门",
      status: apiContract.score >= 80 ? "ready" : "watch",
      evidence: `契约就绪度 ${apiContract.score}，核心 API ${apiContract.endpoints.length} 个。`,
    },
    {
      id: "trial",
      label: "真实试点声明边界",
      status: "manual",
      evidence: "真实提分、留存和教师减负效果必须等待课程试点后再宣称。",
    },
  ];

  const monitors: DriftMonitor[] = [
    {
      id: "coverage-drift",
      label: "证据覆盖漂移",
      value: `${Math.round(coverage * 100)}%`,
      threshold: "<70% 连续两轮则降级为影子诊断",
      action: "要求补 Issue、CI、Review 或反思证据",
      status: coverage >= 0.7 ? "ready" : "watch",
    },
    {
      id: "risk-spike",
      label: "高风险请求突增",
      value: `${highRiskCount} 条`,
      threshold: "高风险占比 >20% 则进入教师集中复核",
      action: "关闭自动建议，保留脚手架和教师发布门",
      status: highRiskCount <= Math.max(1, Math.ceil(state.events.length * 0.25)) ? "ready" : "watch",
    },
    {
      id: "privacy-findings",
      label: "敏感字段命中",
      value: `${privacyGuard.piiFindings}`,
      threshold: ">0 则阻断公开发布",
      action: "脱敏、删除或改用 learnerHash",
      status: privacyGuard.piiFindings === 0 ? "ready" : "manual",
    },
    {
      id: "api-contract-drift",
      label: "集成契约漂移",
      value: `${apiContract.manualCount} 人工项`,
      threshold: "人工项未确认不得进入真实课程自动干预",
      action: "保留 owner-only 或公开只读模式",
      status: apiContract.manualCount === 0 ? "ready" : "manual",
    },
  ];

  const featureContracts: FeatureContract[] = [
    {
      id: "ci-signal",
      label: "CI 失败/通过摘要",
      source: "CI webhook",
      refresh: "每次 workflowRun 结束",
      privacy: "不保存 rawLog 和 runnerSecret，只保存失败类型与 traceId。",
    },
    {
      id: "rubric-signal",
      label: "课程 Rubric 命中",
      source: "LMS / 教师配置",
      refresh: "Rubric 版本变化时",
      privacy: "Rubric 是课程级公共规则，不含学生个人信息。",
    },
    {
      id: "reflection-signal",
      label: "反思质量与迁移意图",
      source: "学生反思表单",
      refresh: "每次干预后",
      privacy: "使用 learnerHash，禁止写入手机号、邮箱和真实姓名。",
    },
    {
      id: "teacher-signal",
      label: "教师复核结果",
      source: "教师控制台 / 飞书卡片",
      refresh: "教师操作后",
      privacy: "只保存操作摘要和 ticketId，不保存教师手机号。",
    },
  ];

  const allStatuses = [...registry, ...protocols, ...releaseGates, ...monitors].map((item) => item.status);
  const readyCount = allStatuses.filter((status) => status === "ready").length;
  const watchCount = allStatuses.filter((status) => status === "watch").length;
  const manualCount = allStatuses.filter((status) => status === "manual").length;
  const score = Math.round((allStatuses.reduce((total, status) => total + statusWeight(status), 0) / allStatuses.length) * 100);

  return {
    score,
    modelVersion: "sepath-modelops-2026.08.v1",
    champion: "SE-Path SafeVOI + PathTwin + KnowledgeBoundary",
    challenger: "StaticPath / ChatOnly / TeacherConfirmedAB",
    releaseMode: manualCount > 0 ? "Shadow-first / Teacher-confirmed" : "Small-cohort pilot",
    gate:
      manualCount > 0
        ? "算法管线已可演示和影子运行；真实课程自动干预前仍保留人工发布门。"
        : "算法管线具备进入小班试点的发布条件。",
    readyCount,
    watchCount,
    manualCount,
    registry,
    protocols,
    releaseGates,
    monitors,
    featureContracts,
    offlineEval: [
      `策略冠军：${strategyLab.winnerLabel}，领先 ${strategyLab.winnerMargin} 分。`,
      `科研验证分：${researchEvidence.readinessScore}，证据等级：${researchEvidence.evidenceLevel}。`,
      `高风险/低信息行动必须通过 SafeVOI 和教师发布门。`,
    ],
    onlineEval: [
      "影子运行阶段只读接入真实 PR/CI，不自动推送干预。",
      "教师确认阶段记录阻塞解除时间、CI 修复次数和反思质量。",
      "出现隐私命中、越权请求或高风险突增时自动降级。",
    ],
    nextModelActions: [
      "把当前确定性策略封装为后端 policy service，并保留前端可解释面板。",
      "建立真实课程影子运行账本，优先验证误报率和教师复核时长。",
      "为 SafeVOI 增加策略版本号、回滚记录和 OpenTelemetry trace。",
      "将红队样本加入每次发布前的自动回归测试。",
    ],
  };
}
