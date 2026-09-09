import type { AppState } from "../domain/types";
import type { ApiContractReport } from "./apiContract";
import type { PilotReadinessReport } from "./pilotReadiness";
import type { PrivacyGuardReport } from "./privacyGuard";
import type { ResearchEvidenceReport } from "./researchEvidence";
import type { TeacherReport } from "./teacherReport";
import type { ValueUpliftReport } from "./valueUplift";

export type TrialTelemetryStatus = "ready" | "collecting" | "manual" | "blocked";
export type TrialTelemetryOwner = "teacher" | "ops" | "researcher" | "course_admin" | "school";

export interface TrialTelemetryMetric {
  id: string;
  label: string;
  value: string;
  target: string;
  status: TrialTelemetryStatus;
}

export interface TrialTelemetryStream {
  id: string;
  label: string;
  source: string;
  cadence: string;
  fields: string[];
  status: TrialTelemetryStatus;
  privacyGate: string;
  qualityCheck: string;
}

export interface TrialExperimentArm {
  id: string;
  label: string;
  status: TrialTelemetryStatus;
  population: string;
  intervention: string;
  comparison: string;
  successSignal: string;
  riskControl: string;
}

export interface TrialOutcomeMeasure {
  id: string;
  label: string;
  baseline: string;
  target: string;
  analysisMethod: string;
  status: TrialTelemetryStatus;
  evidence: string;
}

export interface TrialValidationStep {
  id: string;
  label: string;
  day: string;
  owner: TrialTelemetryOwner;
  status: TrialTelemetryStatus;
  action: string;
  exitCriteria: string;
}

export interface TrialClaimGate {
  id: string;
  label: string;
  status: TrialTelemetryStatus;
  allowedClaim: string;
  forbiddenClaim: string;
  evidenceNeeded: string;
}

export interface TrialExportItem {
  id: string;
  label: string;
  status: TrialTelemetryStatus;
  path: string;
  content: string;
}

export interface TrialAnalysisDataset {
  id: string;
  label: string;
  status: TrialTelemetryStatus;
  fileName: string;
  grain: string;
  fields: string[];
  purpose: string;
  privacyRule: string;
  readinessCheck: string;
}

export interface TrialAnalysisCheck {
  id: string;
  label: string;
  status: TrialTelemetryStatus;
  method: string;
  passRule: string;
  failAction: string;
}

export interface TrialEffectDecisionRule {
  id: string;
  label: string;
  status: TrialTelemetryStatus;
  claimTier: string;
  minEvidence: string;
  allowedDecision: string;
  blockedDecision: string;
  reviewerQuestion: string;
}

export interface TrialTelemetryReport {
  score: number;
  stage: string;
  summary: string;
  readinessMode: string;
  readyCount: number;
  collectingCount: number;
  manualCount: number;
  blockedCount: number;
  metrics: TrialTelemetryMetric[];
  streams: TrialTelemetryStream[];
  experimentArms: TrialExperimentArm[];
  outcomeMeasures: TrialOutcomeMeasure[];
  validationPlan: TrialValidationStep[];
  claimGates: TrialClaimGate[];
  exportPack: TrialExportItem[];
  analysisDataset: TrialAnalysisDataset[];
  analysisChecks: TrialAnalysisCheck[];
  effectDecisionRules: TrialEffectDecisionRule[];
  dataContract: string[];
  analysisNotebook: string;
  telemetryManifest: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function countStatus<T extends { status: TrialTelemetryStatus }>(items: T[], status: TrialTelemetryStatus): number {
  return items.filter((item) => item.status === status).length;
}

function scoreStatus(status: TrialTelemetryStatus): number {
  if (status === "ready") return 1;
  if (status === "collecting") return 0.74;
  if (status === "manual") return 0.44;
  return 0;
}

function hasEvent(state: AppState, type: string): boolean {
  return state.events.some((event) => event.type === type);
}

export function buildTrialTelemetryReport(
  state: AppState,
  pilotReadiness: PilotReadinessReport,
  privacyGuard: PrivacyGuardReport,
  apiContract: ApiContractReport,
  valueUplift: ValueUpliftReport,
  teacherReport: TeacherReport,
  researchEvidence: ResearchEvidenceReport,
): TrialTelemetryReport {
  const hasCiPass = hasEvent(state, "ci_passed");
  const hasCiFail = hasEvent(state, "ci_failed");
  const hasTeacherReview = hasEvent(state, "teacher_reviewed");
  const hasReflection = hasEvent(state, "reflection_submitted");
  const privacyReady = privacyGuard.gate === "pass";
  const apiReady = apiContract.readyCount >= 2;
  const pilotReady = pilotReadiness.readinessScore >= 70;
  const researchReady = researchEvidence.readinessScore >= 80;
  const dataContract = [
    "tenantId",
    "courseId",
    "cohortId",
    "learnerHash",
    "assignmentId",
    "evidenceEvent.type",
    "traceId",
    "safevoi_version",
    "decision.gate",
    "teacher_review.status",
    "blocked_resolution_minutes",
    "reflection_quality_score",
    "ci_recovery_status",
  ];

  const streams: TrialTelemetryStream[] = [
    {
      id: "baseline-rubric",
      label: "基线与 Rubric",
      source: "课程配置 / baseline / Rubric Studio",
      cadence: "D-7 冻结，D0 复核",
      fields: ["learnerHash", "baselineScore", "rubricVersion", "assignmentId"],
      status: pilotReady ? "ready" : "manual",
      privacyGate: "只保存 learnerHash 和 Rubric 版本，不上传真实姓名。",
      qualityCheck: "每名学生至少有 baseline、Rubric 和任务模板。",
    },
    {
      id: "git-ci-events",
      label: "Git/CI 工程事件",
      source: "GitHub/GitLab + CI Webhook",
      cadence: "实时写入 EvidenceEvent",
      fields: ["pr_opened", "ci_failed", "ci_passed", "traceId"],
      status: hasCiFail && hasCiPass && apiReady ? "ready" : "collecting",
      privacyGate: "脱敏 commit message、runnerSecret、accessToken 和私有仓库地址。",
      qualityCheck: "幂等键去重，CI 失败和修复通过必须成对进入分析窗口。",
    },
    {
      id: "student-dialogue",
      label: "学生对话与脚手架",
      source: "学生对话实验台 / AI Agent Runtime",
      cadence: "每次求助后写入",
      fields: ["intent", "risk", "responseMode", "reasonCodes"],
      status: valueUplift.valueScore >= 75 ? "ready" : "collecting",
      privacyGate: "只保存意图、风险和脚手架摘要，不保存原始私聊。",
      qualityCheck: "直接答案请求必须触发拒答或教师复核，不进入自动提分声明。",
    },
    {
      id: "teacher-review",
      label: "教师复核与发布门",
      source: "TeacherReview / weekly report",
      cadence: "高风险建议发布前",
      fields: ["teacher_review.status", "reviewMinutes", "approvedAction"],
      status: hasTeacherReview && teacherReport.score >= 75 ? "ready" : "manual",
      privacyGate: "教师评语进入课程内部账本，公开材料只保留脱敏摘要。",
      qualityCheck: "高风险干预必须有教师处理状态和处理时长。",
    },
    {
      id: "reflection-memory",
      label: "反思记忆与迁移",
      source: "EvidenceEvent reflection_submitted",
      cadence: "每次修复后 24 小时内",
      fields: ["reflection_quality_score", "misconceptionTag", "nextTransferTask"],
      status: hasReflection ? "ready" : "collecting",
      privacyGate: "反思文本公开前先摘要化，保留能力标签和质量分。",
      qualityCheck: "反思质量需要 Rubric 化，不能只统计提交次数。",
    },
  ];

  const experimentArms: TrialExperimentArm[] = [
    {
      id: "teacher-confirmed-sepath",
      label: "SE-Path 教师确认组",
      status: pilotReady && privacyReady ? "ready" : "manual",
      population: "软件工程课程中使用 Git/CI 作业的学生小组。",
      intervention: "系统生成诊断、SafeVOI 下一步行动和脚手架，由教师确认高风险项。",
      comparison: "与等待组或普通助教答疑窗口对比。",
      successSignal: "阻塞解除时间下降、反思质量上升、教师复核时长可控。",
      riskControl: "不自动推送高风险建议，不替写可提交代码。",
    },
    {
      id: "waitlist-shadow",
      label: "等待组 / 影子诊断",
      status: "collecting",
      population: "同课程或同任务的另一批学生。",
      intervention: "系统只做影子诊断和教师后台观察，不直接干预学生。",
      comparison: "作为同周期对照，控制任务难度和时间窗口。",
      successSignal: "两组 EvidenceEvent 覆盖一致，干预差异可解释。",
      riskControl: "等待组仍保留常规教学支持，不人为制造学习风险。",
    },
    {
      id: "historical-baseline",
      label: "历史基线复盘",
      status: "manual",
      population: "历史课程中相同 CI Recovery Lab 的脱敏记录。",
      intervention: "不干预，只用于估计任务自然完成时间和常见阻塞。",
      comparison: "与当前首周试点结果做匹配对照。",
      successSignal: "同任务、同 Rubric、同 CI 指标可比。",
      riskControl: "历史数据必须完成授权和脱敏，不能把不可比班级当强证据。",
    },
  ];

  const outcomeMeasures: TrialOutcomeMeasure[] = [
    {
      id: "blocked-resolution-time",
      label: "阻塞解除时间",
      baseline: "从 ci_failed 到 ci_passed 的分钟数。",
      target: "首周试点相对等待组下降 15%-25%。",
      analysisMethod: "中位数差异 + bootstrap 置信区间。",
      status: hasCiFail && hasCiPass ? "ready" : "collecting",
      evidence: hasCiFail && hasCiPass ? "当前 Demo 已包含 CI 失败和修复通过事件。" : "等待真实课程 Git/CI 流持续写入。",
    },
    {
      id: "reflection-quality",
      label: "反思质量",
      baseline: "反思是否能解释错误原因、修复依据和迁移场景。",
      target: "Rubric 化反思质量均值提升。",
      analysisMethod: "教师 Rubric 评分 + 双人抽样复核。",
      status: hasReflection ? "ready" : "collecting",
      evidence: hasReflection ? "reflection_submitted 已进入账本。" : "等待学生提交反思。",
    },
    {
      id: "teacher-review-load",
      label: "教师复核负担",
      baseline: "每个高风险建议的处理分钟数。",
      target: "不超过教师可接受阈值，并能节省重复答疑时间。",
      analysisMethod: "处理时长分布 + 教师访谈摘要。",
      status: hasTeacherReview ? "ready" : "manual",
      evidence: `${teacherReport.exportFileName} 可导出教师周报。`,
    },
    {
      id: "unsafe-answer-rate",
      label: "替写风险拦截率",
      baseline: "直接索要完整答案的请求数量。",
      target: "高风险请求 100% 进入拒答、脚手架或教师复核。",
      analysisMethod: "reasonCodes 审计 + 抽样人工复核。",
      status: "ready",
      evidence: "DIRECT_ANSWER_POLICY_GATE 已进入学生对话和知识边界。",
    },
    {
      id: "course-adoption",
      label: "课程采用度",
      baseline: "教师是否愿意把周报和开班 Manifest 带入下一轮课程。",
      target: "至少 1 门课程完成首周影子运行。",
      analysisMethod: "课程管理员确认 + 使用日志 + 访谈。",
      status: "manual",
      evidence: "当前为试点设计，真实课程采用需校内授权。",
    },
  ];

  const validationPlan: TrialValidationStep[] = [
    {
      id: "preregistration",
      label: "预注册试点方案",
      day: "D-10",
      owner: "researcher",
      status: "ready",
      action: "冻结假设、指标、分组方式、排除规则和停止条件。",
      exitCriteria: "预注册文档中明确不以真实提分为当前已证明结论。",
    },
    {
      id: "consent",
      label: "授权与数据最小化",
      day: "D-7",
      owner: "school",
      status: privacyReady ? "ready" : "blocked",
      action: "确认学生知情、退出机制、保留期限和脱敏字段。",
      exitCriteria: `privacy gate=${privacyGuard.gate}，PII 命中 ${privacyGuard.piiFindings}。`,
    },
    {
      id: "shadow-week",
      label: "首周影子运行",
      day: "W1",
      owner: "ops",
      status: "collecting",
      action: "只生成后台诊断、教师周报和证据质量报告。",
      exitCriteria: "EvidenceEvent 覆盖、Git/CI 成对率和教师复核队列达到阈值。",
    },
    {
      id: "teacher-confirmed-ab",
      label: "教师确认 A/B",
      day: "W2-W4",
      owner: "teacher",
      status: "manual",
      action: "教师确认后向干预组发布脚手架，对照组保留常规支持。",
      exitCriteria: "比较阻塞解除时间、反思质量和教师负担，不用单一成绩分断言。",
    },
    {
      id: "post-review",
      label: "试点复盘与结论分级",
      day: "W4+",
      owner: "course_admin",
      status: "manual",
      action: "按证据等级输出可宣称、谨慎宣称和不可宣称三类结论。",
      exitCriteria: "形成课程复盘报告、匿名数据包和下一轮改进清单。",
    },
  ];

  const claimGates: TrialClaimGate[] = [
    {
      id: "closed-loop-claim",
      label: "可以声明闭环可运行",
      status: "ready",
      allowedClaim: "SE-Path 能把 PR/CI、对话、教师复核和反思转成可追踪学习闭环。",
      forbiddenClaim: "闭环已经在所有真实课程中稳定提分。",
      evidenceNeeded: "本地测试、发布门禁、演示视频、截图和 EvidenceEvent 账本。",
    },
    {
      id: "uplift-framework-claim",
      label: "可以声明增值评价框架",
      status: valueUplift.valueScore >= 75 && researchReady ? "ready" : "collecting",
      allowedClaim: "当前具备可解释增值估计、策略对照和真实试点指标设计。",
      forbiddenClaim: "当前已经证明长期因果提分。",
      evidenceNeeded: "ValueUplift、ResearchEvidence、Telemetry Contract 和后续试点数据。",
    },
    {
      id: "real-score-claim",
      label: "不能声明真实提分",
      status: "manual",
      allowedClaim: "真实提分等待授权课程试点和对照验证。",
      forbiddenClaim: "已经用真实学校数据显著提升考试成绩。",
      evidenceNeeded: "真实课程授权、对照数据、统计分析、教师复核记录和伦理边界。",
    },
    {
      id: "privacy-claim",
      label: "可以声明隐私门禁",
      status: privacyReady ? "ready" : "blocked",
      allowedClaim: "当前公开 Demo 与提交包不含真实学生 PII。",
      forbiddenClaim: "系统可直接接入任何真实学生数据而无需授权。",
      evidenceNeeded: "privacy gate、敏感信息扫描、访问控制和数据最小化说明。",
    },
  ];

  const analysisDataset: TrialAnalysisDataset[] = [
    {
      id: "anonymous-events",
      label: "匿名事件明细",
      status: privacyReady && apiReady ? "ready" : "blocked",
      fileName: "trial-anonymous-events.csv",
      grain: "每名学生每次学习事件一行。",
      fields: ["learnerHash", "cohortId", "eventType", "traceId", "timestampBucket", "safevoi_version"],
      purpose: "还原 PR/CI、对话、教师复核和反思链路，支撑过程证据覆盖率分析。",
      privacyRule: "不导出姓名、邮箱、手机号、仓库地址、原始私聊和完整代码。",
      readinessCheck: "no-pii-export 必须通过，traceId 与 EvidenceEvent 幂等键可追踪。",
    },
    {
      id: "trial-outcomes",
      label: "匿名结果指标",
      status: hasCiFail && hasCiPass && hasReflection ? "ready" : "collecting",
      fileName: "trial-outcomes.csv",
      grain: "每名学生每次作业或每个 PR 修复窗口一行。",
      fields: [
        "learnerHash",
        "blocked_resolution_minutes",
        "reflection_quality_score",
        "teacher_review_minutes",
        "direct_answer_blocked",
      ],
      purpose: "计算阻塞解除、反思质量、教师复核负担和替写风险拦截。",
      privacyRule: "只保留指标值和风险标记，不导出作业原文或私聊原文。",
      readinessCheck: "ci_failed 与 ci_passed 成对，reflection_quality_score 有 Rubric 来源。",
    },
    {
      id: "trial-baseline",
      label: "基线与 Rubric 快照",
      status: pilotReady ? "ready" : "manual",
      fileName: "trial-baseline.csv",
      grain: "每名学生每个作业入口一行。",
      fields: ["learnerHash", "baselineScore", "rubricVersion", "assignmentId", "courseManifestVersion"],
      purpose: "检查等待组、干预组或历史基线是否可比，避免任务难度混淆。",
      privacyRule: "基线只保留分段和 Rubric 版本，不公开学生身份映射。",
      readinessCheck: "预注册前冻结 courseManifestVersion 与 rubricVersion。",
    },
    {
      id: "trial-teacher-anchors",
      label: "教师锚点评分",
      status: hasTeacherReview && teacherReport.score >= 75 ? "ready" : "manual",
      fileName: "trial-teacher-anchors.csv",
      grain: "每个抽样作品或反思样本一行。",
      fields: ["sampleId", "teacherAnchor", "aiEstimate", "delta", "reviewDecision"],
      purpose: "验证 AI 估计是否贴近教师 Rubric，防止 AI 自评自证。",
      privacyRule: "样本只使用 sampleId 和摘要，不导出原始学生身份。",
      readinessCheck: "delta 超阈值样本进入教师二次复核。",
    },
    {
      id: "trial-claim-snapshot",
      label: "结论分级快照",
      status: "ready",
      fileName: "trial-claim-snapshot.json",
      grain: "每条对外结论一条记录。",
      fields: ["claimId", "claimTier", "evidenceIds", "allowedWording", "blockedWording"],
      purpose: "把产品演示、影子试点、教师确认和受控效果声明分开归档。",
      privacyRule: "只记录证据索引和表述边界，不包含真实学生数据。",
      readinessCheck: "每条结论必须指向 claim-tier-mapping 检查。",
    },
  ];

  const analysisChecks: TrialAnalysisCheck[] = [
    {
      id: "no-pii-export",
      label: "PII 零导出检查",
      status: privacyReady ? "ready" : "blocked",
      method: "导出前扫描姓名、手机号、邮箱、token、私有仓库地址、原始私聊和完整代码片段。",
      passRule: "公开包和匿名分析包均无 PII 命中，学校侧身份映射单独保管。",
      failAction: "阻断导出和对外声明，只允许重新脱敏后复跑审计。",
    },
    {
      id: "minimum-coverage",
      label: "最小覆盖率检查",
      status: "collecting",
      method: "统计每名学生是否至少有 baseline、Git/CI、对话或教师复核、反思四类证据。",
      passRule: "核心链路覆盖率达到预注册阈值，缺失模式可解释。",
      failAction: "只能输出工程可用性结论，不输出学习效果结论。",
    },
    {
      id: "event-pairing",
      label: "CI 事件配对检查",
      status: hasCiFail && hasCiPass ? "ready" : "collecting",
      method: "按 traceId 和 assignmentId 配对 ci_failed 与 ci_passed，剔除跨任务或重复事件。",
      passRule: "阻塞解除时间只来自可配对窗口。",
      failAction: "改用影子诊断复盘，不计算阻塞解除提升。",
    },
    {
      id: "baseline-balance",
      label: "基线可比检查",
      status: "manual",
      method: "比较干预组、等待组和历史基线的 baselineScore、任务模板、Rubric 版本与时间窗口。",
      passRule: "组间起点和任务条件可解释，无法随机时至少完成倾向匹配或分层描述。",
      failAction: "把结果降级为观察性案例，不使用因果表述。",
    },
    {
      id: "teacher-agreement",
      label: "教师一致性检查",
      status: hasTeacherReview && teacherReport.score >= 75 ? "ready" : "manual",
      method: "抽样比对 teacherAnchor、aiEstimate 和 delta，超阈值进入复核队列。",
      passRule: "Rubric 锚点稳定，AI 估计不能替代教师最终判断。",
      failAction: "暂停自动评价口径，只保留教师复核后的描述。",
    },
    {
      id: "claim-tier-mapping",
      label: "声明等级映射检查",
      status: "ready",
      method: "每条路演或材料结论绑定 L0-L3 等级、证据 ID 和禁止表述。",
      passRule: "没有真实授权对照数据时，不出现真实提分或长期因果效果声明。",
      failAction: "材料退回修改，并在 Pilot Evidence Binder 中记录被阻断表述。",
    },
  ];

  const effectDecisionRules: TrialEffectDecisionRule[] = [
    {
      id: "demo-loop",
      label: "L0 工程闭环",
      status: "ready",
      claimTier: "L0",
      minEvidence: "release gate、自动审计、合成回放、截图和演示视频。",
      allowedDecision: "可以说闭环可运行、证据账本可追踪、教师发布门可演示。",
      blockedDecision: "不能说已经接入真实学校或已经证明真实成绩提升。",
      reviewerQuestion: "如果评委只看 Demo，它证明了工程闭环，不证明真实学习效果。",
    },
    {
      id: "shadow-readiness",
      label: "L1 影子试点",
      status: privacyReady ? "ready" : "blocked",
      claimTier: "L1",
      minEvidence: "学校授权、知情退出、匿名数据契约、教师周报和 no-pii-export 通过。",
      allowedDecision: "可以说具备进入真实课程影子诊断和教师后台观察的条件。",
      blockedDecision: "不能说系统已经直接改善学生行为或成绩。",
      reviewerQuestion: "如果评委问如何落地，回答先影子运行、只给教师后台诊断。",
    },
    {
      id: "teacher-confirmed-effect",
      label: "L2 教师确认干预",
      status: "manual",
      claimTier: "L2",
      minEvidence: "教师签收、A/B 或等待组、事件配对、Rubric 一致性和匿名分析快照。",
      allowedDecision: "可以谨慎说在授权小样本中观察到阻塞解除或反思质量改善信号。",
      blockedDecision: "不能把小样本、单班或无对照观察写成长期因果结论。",
      reviewerQuestion: "如果评委问有没有真实效果，回答效果要按 L2 证据和阈值分级。",
    },
    {
      id: "controlled-effect",
      label: "L3 受控效果结论",
      status: "manual",
      claimTier: "L3",
      minEvidence: "预注册、多班级或多轮对照、样本量说明、负面结果记录和可复现实验包。",
      allowedDecision: "只有达到受控设计后才讨论统计意义上的学习增值。",
      blockedDecision: "当前比赛阶段不能宣称已证明真实班级长期显著提分。",
      reviewerQuestion: "如果评委追问一等奖创新点，强调系统把可验证路线产品化，而不是提前夸大。",
    },
  ];

  const exportPack: TrialExportItem[] = [
    {
      id: "trial-protocol",
      label: "试点预注册方案",
      status: "ready",
      path: "参赛提交材料包/33_试点遥测与效果验证中心说明.md",
      content: "假设、指标、分组、授权、退出机制和结论分级。",
    },
    {
      id: "telemetry-manifest",
      label: "遥测 Manifest",
      status: "ready",
      path: "TrialTelemetry.telemetryManifest",
      content: "数据流、字段契约、结论边界和试点阶段。",
    },
    {
      id: "weekly-report",
      label: "教师周报",
      status: teacherReport.score >= 75 ? "ready" : "collecting",
      path: teacherReport.exportFileName,
      content: "教师复核、班级风险、下周行动和 AI 边界。",
    },
    {
      id: "analysis-notebook",
      label: "分析 Notebook 规格",
      status: "collecting",
      path: "参赛提交材料包/trial/anonymous-analysis-pack/analysis_report.md",
      content: "阻塞解除时间、反思质量、复核负担、替写拦截率和声明分级分析规格。",
    },
    {
      id: "anonymous-analysis-pack",
      label: "匿名分析数据包",
      status: privacyReady ? "ready" : "blocked",
      path: "参赛提交材料包/trial/anonymous-analysis-pack/",
      content: "合成回放匿名事件、结果指标、基线 Rubric、教师锚点、PII 扫描和结论分级快照。",
    },
    {
      id: "effect-decision-rules",
      label: "效果结论分级规则",
      status: "ready",
      path: "TrialTelemetry.effectDecisionRules",
      content: "L0 工程闭环、L1 影子试点、L2 教师确认、L3 受控效果四级声明边界。",
    },
  ];

  const allStatusItems = [
    ...streams,
    ...experimentArms,
    ...outcomeMeasures,
    ...validationPlan,
    ...claimGates,
    ...analysisDataset,
    ...analysisChecks,
    ...effectDecisionRules,
    ...exportPack,
  ];
  const readyCount = countStatus(allStatusItems, "ready");
  const collectingCount = countStatus(allStatusItems, "collecting");
  const manualCount = countStatus(allStatusItems, "manual");
  const blockedCount = countStatus(allStatusItems, "blocked");
  const score = Math.round(
    clamp(
      (allStatusItems.reduce((total, item) => total + scoreStatus(item.status), 0) / allStatusItems.length) * 100
        + (privacyReady ? 4 : -12)
        + (apiReady ? 3 : 0)
        + (researchReady ? 3 : 0),
      0,
      100,
    ),
  );
  const readinessMode =
    blockedCount > 0 ? "privacy-blocked" : manualCount > 0 ? "shadow-to-teacher-confirmed" : "trial-ready";
  const manifest = {
    runtime: "sepath-trial-telemetry.v1",
    readinessMode,
    score,
    courseScope: "software-engineering-project-based-learning",
    dataContract,
    streams: streams.map((stream) => ({ id: stream.id, status: stream.status, fields: stream.fields })),
    outcomes: outcomeMeasures.map((measure) => ({ id: measure.id, status: measure.status, method: measure.analysisMethod })),
    analysisDataset: analysisDataset.map((dataset) => ({
      id: dataset.id,
      status: dataset.status,
      fileName: dataset.fileName,
      fields: dataset.fields,
    })),
    analysisChecks: analysisChecks.map((check) => ({ id: check.id, status: check.status, passRule: check.passRule })),
    effectDecisionRules: effectDecisionRules.map((rule) => ({
      id: rule.id,
      status: rule.status,
      claimTier: rule.claimTier,
      blockedDecision: rule.blockedDecision,
    })),
    claimBoundary: "no real-score uplift claim before authorized controlled pilot",
  };

  return {
    score,
    stage: blockedCount > 0 ? "试点遥测阻断 / 先修复隐私授权" : "可影子试点 / 教师确认 A/B 待真实课程授权",
    summary:
      "试点遥测与效果验证中心把 SE-Path 从比赛 Demo 推到真实课程验证：先冻结数据契约和预注册方案，再采集 Git/CI、对话、教师复核和反思指标，导出匿名分析数据包和质量检查结果，最后用对照组、等待组或历史基线判断干预是否真的有价值，同时严格限制真实提分口径。",
    readinessMode,
    readyCount,
    collectingCount,
    manualCount,
    blockedCount,
    metrics: [
      {
        id: "trial-score",
        label: "试点就绪",
        value: `${score}`,
        target: "进入影子运行前无隐私阻断",
        status: blockedCount > 0 ? "blocked" : "ready",
      },
      {
        id: "data-contract",
        label: "数据契约",
        value: `${dataContract.length} 字段`,
        target: "tenant/course/learnerHash 全链路隔离",
        status: apiReady ? "ready" : "collecting",
      },
      {
        id: "outcomes",
        label: "效果指标",
        value: `${outcomeMeasures.length} 项`,
        target: "不只看成绩，也看阻塞解除、反思质量和教师负担",
        status: "ready",
      },
      {
        id: "claim-gates",
        label: "声明门禁",
        value: `${claimGates.length} 道`,
        target: "可声明、谨慎声明、不可声明分级",
        status: "ready",
      },
      {
        id: "analysis-pack",
        label: "分析包",
        value: `${analysisDataset.length}+${analysisChecks.length}`,
        target: "匿名数据集与质量检查成套导出",
        status: privacyReady ? "ready" : "blocked",
      },
    ],
    streams,
    experimentArms,
    outcomeMeasures,
    validationPlan,
    claimGates,
    exportPack,
    analysisDataset,
    analysisChecks,
    effectDecisionRules,
    dataContract,
    analysisNotebook:
      "参赛提交材料包/trial/anonymous-analysis-pack/analysis_report.md: synthetic replay analysis for blocked_resolution_minutes, reflection_quality_score, teacher workload, no-pii-export, claim-tier-mapping, and unsafe-answer audit.",
    telemetryManifest: JSON.stringify(manifest, null, 2),
  };
}
