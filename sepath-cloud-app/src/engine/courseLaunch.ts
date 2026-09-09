import type { AppState } from "../domain/types";
import type { AgentRuntimeReport } from "./agentRuntime";
import type { ApiContractReport } from "./apiContract";
import type { CourseAuthoringReport } from "./courseAuthoring";
import { evidenceCoverage } from "./evidence";
import type { IntegrationSandboxReport } from "./integrationSandbox";
import type { JudgeTrialReport } from "./judgeTrial";
import type { PilotReadinessReport } from "./pilotReadiness";
import type { PrivacyGuardReport } from "./privacyGuard";
import type { TeacherReport } from "./teacherReport";

export type CourseLaunchStatus = "ready" | "configured" | "manual" | "blocked";
export type CourseLaunchOwner = "teacher" | "course_admin" | "ops" | "assistant" | "team" | "school";

export interface CourseLaunchMetric {
  id: string;
  label: string;
  value: string;
  target: string;
  status: CourseLaunchStatus;
}

export interface CourseLaunchStep {
  id: string;
  label: string;
  day: string;
  owner: CourseLaunchOwner;
  status: CourseLaunchStatus;
  evidence: string;
  nextAction: string;
}

export interface CourseLaunchConnector {
  id: string;
  label: string;
  status: CourseLaunchStatus;
  source: string;
  target: string;
  gate: string;
  riskControl: string;
}

export interface CourseStarterItem {
  id: string;
  label: string;
  status: CourseLaunchStatus;
  artifact: string;
  owner: CourseLaunchOwner;
  useCase: string;
}

export interface CourseRiskItem {
  id: string;
  label: string;
  status: CourseLaunchStatus;
  trigger: string;
  mitigation: string;
}

export interface CourseLaunchReport {
  score: number;
  stage: string;
  summary: string;
  mode: string;
  readyCount: number;
  configuredCount: number;
  manualCount: number;
  blockedCount: number;
  metrics: CourseLaunchMetric[];
  launchSteps: CourseLaunchStep[];
  connectors: CourseLaunchConnector[];
  starterKit: CourseStarterItem[];
  riskRegister: CourseRiskItem[];
  exportChecklist: string[];
  classroomManifest: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function hasEvent(state: AppState, type: string): boolean {
  return state.events.some((event) => event.type === type);
}

function statusWeight(status: CourseLaunchStatus): number {
  if (status === "ready") return 1;
  if (status === "configured") return 0.72;
  if (status === "manual") return 0.42;
  return 0;
}

function byStatus(items: { status: CourseLaunchStatus }[], status: CourseLaunchStatus): number {
  return items.filter((item) => item.status === status).length;
}

function statusFromGate(condition: boolean, fallback: CourseLaunchStatus = "configured"): CourseLaunchStatus {
  return condition ? "ready" : fallback;
}

export function buildCourseLaunchReport(
  state: AppState,
  courseAuthoring: CourseAuthoringReport,
  pilotReadiness: PilotReadinessReport,
  privacyGuard: PrivacyGuardReport,
  apiContract: ApiContractReport,
  integrationSandbox: IntegrationSandboxReport,
  teacherReport: TeacherReport,
  judgeTrial: JudgeTrialReport,
  agentRuntime: AgentRuntimeReport,
): CourseLaunchReport {
  const coverage = evidenceCoverage(state.events);
  const privacyReady = privacyGuard.gate === "pass";
  const apiReady = apiContract.score >= 80;
  const integrationReady = integrationSandbox.score >= 80 && integrationSandbox.privacyGate === "pass";
  const runtimeReady = agentRuntime.score >= 80 && agentRuntime.blockedCount === 0;
  const hasClosedLoop = hasEvent(state, "ci_passed") && hasEvent(state, "teacher_reviewed") && hasEvent(state, "reflection_submitted");
  const hasReflection = hasEvent(state, "reflection_submitted");

  const launchSteps: CourseLaunchStep[] = [
    {
      id: "course-blueprint",
      label: "课程蓝图与 Rubric 冻结",
      day: "D-7",
      owner: "teacher",
      status: statusFromGate(courseAuthoring.score >= 80),
      evidence: `${courseAuthoring.courseVersion}，课程配置就绪度 ${courseAuthoring.score}。`,
      nextAction: "将课程目标、作业模板、评分 Rubric 和 AI 边界作为第一版课程配置冻结。",
    },
    {
      id: "roster-consent",
      label: "名册、授权与脱敏空间",
      day: "D-5",
      owner: "school",
      status: privacyReady ? "ready" : privacyGuard.gate === "block" ? "blocked" : "manual",
      evidence: `${privacyGuard.piiFindings} 个敏感字段命中，privacy gate=${privacyGuard.gate}。`,
      nextAction: "真实开班前由课程负责人确认知情同意、退出机制和数据保存期限。",
    },
    {
      id: "tool-contracts",
      label: "Git/CI/LMS/Webhook 接入契约",
      day: "D-4",
      owner: "ops",
      status: apiReady && integrationReady ? "ready" : "configured",
      evidence: `${apiContract.endpoints.length} 个 API，${integrationSandbox.dryRuns.length} 个 Webhook dry-run。`,
      nextAction: "使用集成回放沙箱跑一遍 PR、CI、LMS 和飞书样例，确认幂等和脱敏。",
    },
    {
      id: "shadow-diagnosis",
      label: "第一周影子诊断",
      day: "D-3",
      owner: "assistant",
      status: statusFromGate(pilotReadiness.readinessScore >= 75),
      evidence: `试点就绪度 ${pilotReadiness.readinessScore}，人工门禁 ${pilotReadiness.manualCount}。`,
      nextAction: "只生成诊断和教师建议，不自动向学生推送高风险干预。",
    },
    {
      id: "teacher-brief",
      label: "教师周报与复核班会",
      day: "D-2",
      owner: "teacher",
      status: statusFromGate(teacherReport.score >= 75),
      evidence: `${teacherReport.exportFileName} 可下载，周报就绪度 ${teacherReport.score}。`,
      nextAction: "把 P0/P1 队列、AI 边界和第一周观察指标写入开班说明。",
    },
    {
      id: "judge-access",
      label: "评委/校内试用入口",
      day: "D-1",
      owner: "team",
      status: judgeTrial.blockedCount > 0 ? "blocked" : judgeTrial.manualCount > 0 ? "manual" : "ready",
      evidence: `${judgeTrial.routes.length} 条试用路线，${judgeTrial.manualCount} 项仍需人工确认。`,
      nextAction: "明确公开静态包、owner-only 云端、本地 Demo 和视频兜底的优先顺序。",
    },
    {
      id: "first-class",
      label: "第一次课：失败 PR 闭环演示",
      day: "D0",
      owner: "teacher",
      status: runtimeReady && hasClosedLoop ? "ready" : "configured",
      evidence: `AgentRuntime=${agentRuntime.score}，闭环事件${hasClosedLoop ? "已补齐" : "待补齐"}。`,
      nextAction: "现场只演示脚手架和证据回写，不让模型直接替学生完成作业。",
    },
    {
      id: "week-one-review",
      label: "第一周复盘与下一轮实验",
      day: "W1",
      owner: "course_admin",
      status: hasReflection ? "ready" : "configured",
      evidence: hasReflection ? "反思记忆已写入 EvidenceEvent。" : "等待第一周学生反思和教师复核。",
      nextAction: "只统计阻塞解除时间、反思质量和教师复核时长，不提前宣称真实提分。",
    },
  ];

  const connectors: CourseLaunchConnector[] = [
    {
      id: "git-ci",
      label: "Git/CI 证据管道",
      status: integrationReady ? "ready" : "configured",
      source: "GitHub/GitLab + CI Webhook",
      target: "/api/evidence/events",
      gate: "幂等键 + 脱敏 + EvidenceEvent schema",
      riskControl: "不保存仓库密钥、rawDiff、runnerSecret 和完整私有日志。",
    },
    {
      id: "lms-rubric",
      label: "LMS 与 Rubric 管道",
      status: courseAuthoring.manualCount > 0 ? "manual" : "ready",
      source: "课程平台任务、截止时间、Rubric",
      target: "KnowledgeBoundaryReport",
      gate: "Rubric 版本 + 教师确认",
      riskControl: "模型只能引用课程边界，不能覆盖教师评分标准。",
    },
    {
      id: "feishu-growthops",
      label: "飞书 GrowthOps 队列",
      status: pilotReadiness.readyCount >= 4 ? "configured" : "manual",
      source: "班级风险队列",
      target: "教师群 P0/P1 卡片",
      gate: "只推送脱敏摘要",
      riskControl: "学生风险分层只对任课教师可见。",
    },
    {
      id: "agent-runtime",
      label: "AI Agent Runtime",
      status: runtimeReady ? "ready" : "manual",
      source: "SafeVOI + GraphRAG + Tool Trace",
      target: "脚手架表达与教师复核",
      gate: "Prompt 契约 + 无 Key 降级 + 隐私门",
      riskControl: "LLM 不能覆盖确定性策略、隐私门和教师发布门。",
    },
    {
      id: "ledger-export",
      label: "证据账本迁移",
      status: "ready",
      source: "EvidenceEvent JSON",
      target: "课程工作空间恢复",
      gate: "schema 校验 + ID 去重",
      riskControl: "公开试用包只含合成数据，真实课程导出需脱敏授权。",
    },
  ];

  const starterKit: CourseStarterItem[] = [
    {
      id: "course-manifest",
      label: "课程 Manifest",
      status: "ready",
      artifact: "courseAuthoring.exportManifest",
      owner: "teacher",
      useCase: "把课程目标、Rubric、AI 边界和任务模板一次性交给课程负责人复核。",
    },
    {
      id: "runtime-manifest",
      label: "Agent Runtime Manifest",
      status: runtimeReady ? "ready" : "manual",
      artifact: "agentRuntime.deploymentManifest",
      owner: "ops",
      useCase: "说明模型路由、RAG 上下文、工具调用和无 Key 降级。",
    },
    {
      id: "api-env",
      label: "API 环境变量清单",
      status: apiReady ? "configured" : "manual",
      artifact: apiContract.environmentVariables.join(", "),
      owner: "ops",
      useCase: "把静态 Demo 迁移到 Git/CI/LMS/飞书真实接入。",
    },
    {
      id: "teacher-weekly",
      label: "教师周报模板",
      status: teacherReport.score >= 75 ? "ready" : "configured",
      artifact: teacherReport.exportFileName,
      owner: "teacher",
      useCase: "开班第一周后直接生成教学复盘材料。",
    },
    {
      id: "judge-route",
      label: "评委试用路线",
      status: judgeTrial.blockedCount > 0 ? "blocked" : "manual",
      artifact: "公开静态包 / 私有云 / 本地 Demo / 视频兜底",
      owner: "team",
      useCase: "确保评委现场至少有一条可打开、可解释、可兜底路线。",
    },
  ];

  const riskRegister: CourseRiskItem[] = [
    {
      id: "privacy",
      label: "真实学生隐私",
      status: privacyReady ? "ready" : "blocked",
      trigger: "出现姓名、手机号、邮箱、仓库密钥或原始私聊。",
      mitigation: "阻断发布、脱敏重跑、只保留 learnerHash 和教学摘要。",
    },
    {
      id: "direct-answer",
      label: "AI 替写作业",
      status: agentRuntime.qualityGates.find((gate) => gate.id === "direct-answer")?.status === "ready" ? "ready" : "manual",
      trigger: "学生直接索要完整可提交代码。",
      mitigation: "触发 Prompt 拒答规则、SafeVOI 阻断和教师复核。",
    },
    {
      id: "model-key",
      label: "模型密钥或网络不可用",
      status: agentRuntime.fallbackPlan.join(" ").includes("无 Key") ? "ready" : "manual",
      trigger: "现场没有 API Key、模型限流或外网不稳定。",
      mitigation: "使用确定性策略内核和模板化脚手架完成闭环演示。",
    },
    {
      id: "access-policy",
      label: "云端访问策略未确认",
      status: judgeTrial.manualCount > 0 ? "manual" : "ready",
      trigger: "owner-only 链接被误当作公开评审地址。",
      mitigation: "提交公开静态包、本地 Demo 和视频兜底，不把私有 URL 冒充公开访问。",
    },
    {
      id: "uplift-claim",
      label: "过度宣称真实提分",
      status: "manual",
      trigger: "在没有真实试点数据前宣称长期因果效果。",
      mitigation: "只表述合成回放、确定性验证和后续试点 Telemetry Contract。",
    },
  ];

  const allStatusItems = [...launchSteps, ...connectors, ...starterKit, ...riskRegister];
  const readyCount = byStatus(allStatusItems, "ready");
  const configuredCount = byStatus(allStatusItems, "configured");
  const manualCount = byStatus(allStatusItems, "manual");
  const blockedCount = byStatus(allStatusItems, "blocked");
  const score = clamp(
    Math.round((allStatusItems.reduce((total, item) => total + statusWeight(item.status), 0) / allStatusItems.length) * 100 + coverage * 4),
    0,
    100,
  );

  const manifest = {
    runtime: "sepath-course-launch.v1",
    course: courseAuthoring.courseTitle,
    mode: blockedCount > 0 ? "blocked" : manualCount > 0 ? "teacher-confirmed-shadow" : "first-week-ready",
    evidenceCoverage: Math.round(coverage * 100),
    gates: {
      privacy: privacyGuard.gate,
      apiScore: apiContract.score,
      integrationScore: integrationSandbox.score,
      agentRuntimeScore: agentRuntime.score,
      judgeManualCount: judgeTrial.manualCount,
    },
    firstWeek: launchSteps.map((step) => ({ id: step.id, day: step.day, status: step.status, owner: step.owner })),
    connectors: connectors.map((connector) => ({ id: connector.id, status: connector.status, gate: connector.gate })),
    claimBoundary: "no real course uplift claim before approved pilot data",
  };

  return {
    score,
    stage: blockedCount > 0 ? "开班阻断 / 先修复治理问题" : manualCount > 0 ? "可影子开班 / 教师确认优先" : "可首周试点",
    summary:
      "课程开班向导把课程配置、真实接入、隐私治理、教师复盘、评委试用和 AI 运行时压缩成一张首周落地清单，帮助评委判断产品能否进入真实软件工程课程。",
    mode: manifest.mode,
    readyCount,
    configuredCount,
    manualCount,
    blockedCount,
    metrics: [
      {
        id: "course-readiness",
        label: "课程配置",
        value: `${courseAuthoring.score}`,
        target: "Rubric、作业模板、AI 边界可迁移",
        status: courseAuthoring.score >= 80 ? "ready" : "configured",
      },
      {
        id: "pilot",
        label: "试点就绪",
        value: `${pilotReadiness.readinessScore}`,
        target: "真实课程先影子运行，再教师确认干预",
        status: pilotReadiness.manualCount > 0 ? "manual" : "ready",
      },
      {
        id: "connectors",
        label: "接入链路",
        value: `${connectors.length} 条`,
        target: "Git/CI/LMS/飞书/Agent/账本均有门禁",
        status: integrationReady ? "ready" : "configured",
      },
      {
        id: "risk-left",
        label: "人工风险",
        value: `${manualCount} 项`,
        target: "正式提交前不编造、不误导、不越权",
        status: manualCount > 0 ? "manual" : "ready",
      },
    ],
    launchSteps,
    connectors,
    starterKit,
    riskRegister,
    exportChecklist: [
      "开班前冻结 courseAuthoring.exportManifest。",
      "开班前复核 agentRuntime.deploymentManifest 和 no-key fallback。",
      "真实接入前先在 integration sandbox dry-run Git/CI/LMS/飞书样例。",
      "第一周只做影子诊断和教师确认干预，不自动推送高风险建议。",
      "第一周复盘只统计阻塞解除时间、教师复核时长和反思质量。",
    ],
    classroomManifest: JSON.stringify(manifest, null, 2),
  };
}
