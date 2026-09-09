import type { AppState } from "../domain/types";
import type { CourseAuthoringReport } from "./courseAuthoring";
import { evidenceCoverage } from "./evidence";
import type { ModelOpsReport } from "./modelOps";
import type { ResearchEvidenceReport } from "./researchEvidence";
import type { RubricCalibrationReport } from "./rubricCalibration";
import type { StrategyLabReport } from "./strategyLab";
import type { TrialTelemetryReport } from "./trialTelemetry";
import type { ValueUpliftReport } from "./valueUplift";

export type ResearchFusionStatus = "ready" | "watch" | "manual" | "blocked";
export type ResearchFusionOwner = "product" | "algorithm" | "research" | "teacher" | "ops" | "legal";

export interface ResearchFusionMetric {
  id: string;
  label: string;
  value: string;
  target: string;
  status: ResearchFusionStatus;
}

export interface OpenSourceReference {
  id: string;
  label: string;
  license: string;
  sourceUrl: string;
  referenceValue: string;
  productMapping: string;
  boundary: string;
  status: ResearchFusionStatus;
}

export interface AlgorithmContribution {
  id: string;
  label: string;
  novelty: string;
  inputs: string[];
  outputs: string;
  evidence: string;
  status: ResearchFusionStatus;
}

export interface ResearchHypothesis {
  id: string;
  label: string;
  hypothesis: string;
  method: string;
  primaryMetric: string;
  currentEvidence: string;
  status: ResearchFusionStatus;
}

export interface ValidationStage {
  id: string;
  label: string;
  owner: ResearchFusionOwner;
  gate: string;
  evidence: string;
  nextAction: string;
  status: ResearchFusionStatus;
}

export interface ResearchDeliverable {
  id: string;
  label: string;
  artifact: string;
  usage: string;
  status: ResearchFusionStatus;
}

export interface IdeaMigrationStep {
  id: string;
  label: string;
  sourceIdea: string;
  sePathImplementation: string;
  evidence: string;
  status: ResearchFusionStatus;
}

export interface ContributionEdge {
  id: string;
  from: string;
  to: string;
  relation: string;
  judgeCheck: string;
  status: ResearchFusionStatus;
}

export interface ContributionEvidenceItem {
  id: string;
  label: string;
  claim: string;
  evidencePath: string;
  verification: string;
  status: ResearchFusionStatus;
}

export interface ResearchFusionReport {
  score: number;
  stage: string;
  summary: string;
  readyCount: number;
  watchCount: number;
  manualCount: number;
  blockedCount: number;
  metrics: ResearchFusionMetric[];
  openSourceReferences: OpenSourceReference[];
  algorithmContributions: AlgorithmContribution[];
  researchHypotheses: ResearchHypothesis[];
  validationStages: ValidationStage[];
  deliverables: ResearchDeliverable[];
  ideaMigration: IdeaMigrationStep[];
  contributionGraph: ContributionEdge[];
  contributionEvidencePack: ContributionEvidenceItem[];
  paperOutline: string[];
  defenseScript: string[];
  fusionManifest: string;
}

function hasEvent(state: AppState, type: string): boolean {
  return state.events.some((event) => event.type === type);
}

function statusWeight(status: ResearchFusionStatus): number {
  if (status === "ready") return 1;
  if (status === "watch") return 0.72;
  if (status === "manual") return 0.45;
  return 0;
}

function countStatus<T extends { status: ResearchFusionStatus }>(items: T[], status: ResearchFusionStatus): number {
  return items.filter((item) => item.status === status).length;
}

function extractAgreement(report: RubricCalibrationReport): string {
  return report.metrics.find((metric) => metric.id === "agreement")?.value ?? "待校准";
}

export function buildResearchFusionReport(
  state: AppState,
  courseAuthoring: CourseAuthoringReport,
  strategyLab: StrategyLabReport,
  researchEvidence: ResearchEvidenceReport,
  valueUplift: ValueUpliftReport,
  modelOps: ModelOpsReport,
  rubricCalibration: RubricCalibrationReport,
  trialTelemetry: TrialTelemetryReport,
): ResearchFusionReport {
  const coverage = evidenceCoverage(state.events);
  const hasTeacherReview = hasEvent(state, "teacher_reviewed");
  const hasReflection = hasEvent(state, "reflection_submitted");
  const hasCiPass = hasEvent(state, "ci_passed");
  const agreement = extractAgreement(rubricCalibration);
  const winner = strategyLab.winnerLabel;
  const algorithmReady = modelOps.score >= 80 && strategyLab.winnerId === "sepath-safevoi";
  const calibrationReady = rubricCalibration.score >= 85;
  const trialReady = trialTelemetry.score >= 75;
  const valueReady = valueUplift.valueScore >= 75;

  const openSourceReferences: OpenSourceReference[] = [
    {
      id: "openedx",
      label: "Open edX Platform",
      license: "AGPL-3.0",
      sourceUrl: "https://github.com/openedx/openedx-platform",
      referenceValue: "面向大规模在线课程的开放学习平台生态，可启发课程、学习活动、权限与内容发布的边界设计。",
      productMapping: "SE-Path 不复刻 LMS，而是把 Course Manifest、Rubric Studio 和 EvidenceEvent 设计为可接入 LMS 的能力层。",
      boundary: "只参考平台生态和课程对象思想，不复制 Open edX 源码；若未来深度集成，单独做 AGPL 合规评估。",
      status: "ready",
    },
    {
      id: "moodle",
      label: "Moodle",
      license: "GPL-3.0-or-later",
      sourceUrl: "https://github.com/moodle/moodle",
      referenceValue: "成熟开源学习平台，启发插件化课程活动、教师工作流和教育机构部署场景。",
      productMapping: "SE-Path 以 API 契约、Webhook 回放和多租户上云中心对接类似课程平台，而不是替代平台本体。",
      boundary: "只做设计对照和接口适配思路，不复制 GPL 代码进入参赛作品。",
      status: "ready",
    },
    {
      id: "langgraph",
      label: "LangGraph",
      license: "MIT",
      sourceUrl: "https://github.com/langchain-ai/langgraph",
      referenceValue: "面向长时、有状态 Agent 的编排框架，启发智能体状态机、工具调用和可恢复执行。",
      productMapping: "当前 Demo 用确定性 TypeScript 策略复现可审计闭环，后续可把 Agent Runtime 迁移为 LangGraph 类状态图服务。",
      boundary: "当前无外部框架运行依赖；只保留迁移路线和架构启发。",
      status: "ready",
    },
    {
      id: "opentelemetry",
      label: "OpenTelemetry Collector",
      license: "Apache-2.0",
      sourceUrl: "https://github.com/open-telemetry/opentelemetry-collector",
      referenceValue: "供应商中立的遥测采集与导出思想，启发真实课程试点的数据契约和观测链路。",
      productMapping: "TrialTelemetry、TenantOps 和 ModelOps 统一记录 traceId、learnerHash、事件流和发布门状态。",
      boundary: "当前为产品内遥测模型，不打包 OpenTelemetry 代码；未来后端服务可对接 OTel SDK/Collector。",
      status: "ready",
    },
  ];

  const algorithmContributions: AlgorithmContribution[] = [
    {
      id: "evidence-event-ledger",
      label: "EvidenceEvent 证据账本",
      novelty: "把软件工程过程证据统一成可追踪学习事件，而不是只看测验分或聊天内容。",
      inputs: ["Issue", "PR", "CI", "chat", "teacher_review", "reflection"],
      outputs: "EvidenceEvent[]",
      evidence: `${state.events.length} 条事件，覆盖率 ${Math.round(coverage * 100)}%。`,
      status: coverage >= 0.7 ? "ready" : "watch",
    },
    {
      id: "path-twin",
      label: "路径数字孪生",
      novelty: "把能力、路径节点、阻塞原因和完成证据维护为动态状态。",
      inputs: ["baseline", "EvidenceEvent", "competencyImpacts"],
      outputs: "PathNodeState / nextAction",
      evidence: "主 Demo 的路径看板随 CI、教师复核和反思事件更新。",
      status: hasCiPass ? "ready" : "watch",
    },
    {
      id: "safevoi",
      label: "SafeVOI 策略排序",
      novelty: "在学习收益之外显式加入风险、负担、可逆性和证据覆盖，避免高风险自动放行。",
      inputs: ["DiagnosisCard", "TaskCandidate", "risk", "burden", "coverage"],
      outputs: "TaskDecision[] with PASS/BLOCK",
      evidence: `${winner} 领先 ${strategyLab.winnerMargin} 分。`,
      status: algorithmReady ? "ready" : "watch",
    },
    {
      id: "rubric-calibration",
      label: "教师锚点 Rubric 校准",
      novelty: "用 teacherAnchor 与 aiEstimate 的差值控制能力结论发布，避免 AI 自评自证。",
      inputs: ["Course Rubric", "teacher_review", "aiEstimate", "TrialTelemetry"],
      outputs: "agreementScore / releaseGates",
      evidence: `校准可信分 ${rubricCalibration.score}，教师-AI 一致性 ${agreement}。`,
      status: calibrationReady ? "ready" : "watch",
    },
    {
      id: "value-uplift",
      label: "学习增值估计",
      novelty: "把能力增量、策略优势、风险拦截和教师工时放进同一套价值模型。",
      inputs: ["competencyGrowth", "strategyLab", "cohortOps", "researchEvidence"],
      outputs: "estimatedUpliftPoints / claimBoundary",
      evidence: `估计增值 +${valueUplift.estimatedUpliftPoints} 分，真实提分声明仍受门禁控制。`,
      status: valueReady ? "ready" : "watch",
    },
    {
      id: "trial-telemetry",
      label: "试点遥测与声明门禁",
      novelty: "把真实课程验证拆成数据契约、教师确认 A/B、指标和不可过度宣称边界。",
      inputs: ["learnerHash", "safevoi_version", "teacher_review.status", "reflection_quality_score"],
      outputs: "TrialTelemetry.telemetryManifest",
      evidence: `遥测字段 ${trialTelemetry.dataContract.length} 个，manifest 已生成。`,
      status: trialReady ? "ready" : "watch",
    },
  ];

  const researchHypotheses: ResearchHypothesis[] = [
    {
      id: "h1-safevoi",
      label: "H1 安全价值排序",
      hypothesis: "在同一组学习事件下，SafeVOI 比普通聊天或固定路径更能拦截高风险行为，同时保持学习收益。",
      method: "离线事件回放 + 策略实验室对照。",
      primaryMetric: "综合策略分、风险拦截数、PASS/BLOCK 合理性。",
      currentEvidence: `${strategyLab.winnerLabel} 为当前冠军策略。`,
      status: strategyLab.winnerId === "sepath-safevoi" ? "ready" : "watch",
    },
    {
      id: "h2-calibration",
      label: "H2 教师校准可信度",
      hypothesis: "教师锚点校准能降低 AI 能力诊断的误发布风险，提高教师采纳度。",
      method: "teacherAnchor vs aiEstimate 一致性分析。",
      primaryMetric: "教师-AI 一致性、最大分歧、人工复核比例。",
      currentEvidence: `agreement=${agreement}，anchorSamples=${rubricCalibration.anchorSamples.length}。`,
      status: rubricCalibration.score >= 85 ? "ready" : "watch",
    },
    {
      id: "h3-value",
      label: "H3 学习增值",
      hypothesis: "证据账本 + 脚手架干预能缩短阻塞解除时间并提升反思质量。",
      method: "先用合成回放验证流程，再用教师确认 A/B 进入真实课程。",
      primaryMetric: "阻塞解除时间、反思质量、CI 修复次数、教师工时。",
      currentEvidence: `valueScore=${valueUplift.valueScore}，当前不宣称真实提分。`,
      status: hasReflection ? "ready" : "manual",
    },
    {
      id: "h4-cloud-adoption",
      label: "H4 可上云运营",
      hypothesis: "多租户、RBAC、SLO 和 Runbook 能降低学校试点交付风险。",
      method: "评委沙箱 + 静态公开包 + owner-only 云端站点 + 本地兜底。",
      primaryMetric: "发布门禁、访问控制、回滚路径、材料完整性。",
      currentEvidence: "release gate 已覆盖云端工程、公开静态包和阶段提交 ZIP。",
      status: "ready",
    },
  ];

  const ideaMigration: IdeaMigrationStep[] = [
    {
      id: "path-value-engine",
      label: "路径增值引擎迁移",
      sourceIdea: "把学习路径看成可增值资产：每一步行动都要解释为什么能增加能力、降低风险或补齐证据。",
      sePathImplementation: "ValueUplift + PathTwin + SafeVOI 把路径增值落成能力增量、策略优势、风险拦截和教师工时四类指标。",
      evidence: "参赛提交材料包/27_学习增值评估中心与科研算法融合说明.md",
      status: valueReady ? "ready" : "watch",
    },
    {
      id: "dynamic-portrait",
      label: "动态学生画像迁移",
      sourceIdea: "不把学生理解为静态分数，而是持续更新的能力、阻塞、证据覆盖和风险状态。",
      sePathImplementation: "DiagnosisCard、EvidenceEvent 和 PathTwin 共同生成动态画像，并在学生对话和教师周报中复用。",
      evidence: "sepath-cloud-app/src/engine/diagnosis.ts + sepath-cloud-app/src/engine/pathTwin.ts",
      status: coverage >= 0.7 ? "ready" : "watch",
    },
    {
      id: "teacher-release-gate",
      label: "教师发布门迁移",
      sourceIdea: "AI 不应绕过教师直接发布高风险建议，尤其不能替写作业或替代真实评价。",
      sePathImplementation: "ReviewGate、RubricCalibration 和 PilotEvidenceBinder 把低证据、替写风险和真实效果声明都放进发布门。",
      evidence: "参赛提交材料包/35_教师标注与Rubric校准中心说明.md + 58_真实课程试点证据归档与声明门禁说明.md",
      status: hasTeacherReview ? "ready" : "watch",
    },
    {
      id: "trial-evidence-ladder",
      label: "试点证据阶梯迁移",
      sourceIdea: "从 Demo 能力到真实课程效果之间必须有影子运行、教师确认、数据冻结和受控实验阶梯。",
      sePathImplementation: "TrialTelemetry + PilotEvidenceBinder 把 L0 工程 Demo、L1 影子试点、L2 教师确认、L3 受控效果结论显式分层。",
      evidence: "参赛提交材料包/33_试点遥测与效果验证中心说明.md + 58_真实课程试点证据归档与声明门禁说明_机器可读.json",
      status: trialReady ? "ready" : "manual",
    },
  ];

  const contributionGraph: ContributionEdge[] = [
    {
      id: "ledger-to-diagnosis",
      from: "EvidenceEvent",
      to: "DiagnosisCard",
      relation: "事件账本驱动学情诊断",
      judgeCheck: "点击失败 PR 后诊断卡应更新，且导出账本能看到对应 traceId。",
      status: coverage >= 0.7 ? "ready" : "watch",
    },
    {
      id: "diagnosis-to-safevoi",
      from: "DiagnosisCard",
      to: "SafeVOI",
      relation: "阻塞、风险和置信度进入下一步行动排序",
      judgeCheck: "学生请求完整代码时，SafeVOI/发布门应阻断替写并改给脚手架。",
      status: algorithmReady ? "ready" : "watch",
    },
    {
      id: "safevoi-to-path",
      from: "SafeVOI",
      to: "PathTwin",
      relation: "下一步行动写回路径数字孪生",
      judgeCheck: "学生修复并通过 CI 后，路径节点应从 blocked 变为 completed/active。",
      status: hasCiPass ? "ready" : "watch",
    },
    {
      id: "rubric-to-release",
      from: "RubricCalibration",
      to: "TeacherReleaseGate",
      relation: "教师锚点控制 AI 诊断与干预发布",
      judgeCheck: "Rubric 校准面板应展示 teacherAnchor、aiEstimate、delta 与发布门。",
      status: calibrationReady ? "ready" : "watch",
    },
    {
      id: "telemetry-to-claims",
      from: "TrialTelemetry",
      to: "ClaimBoundary",
      relation: "试点遥测和证据装订器共同控制真实效果声明",
      judgeCheck: "58 号材料和试点证据面板必须写明不能提前宣称真实长期提分。",
      status: trialReady ? "ready" : "manual",
    },
  ];

  const validationStages: ValidationStage[] = [
    {
      id: "unit-tests",
      label: "确定性算法回归",
      owner: "algorithm",
      gate: "核心引擎必须通过 Vitest，不依赖外部 API Key。",
      evidence: "engine.test.ts 覆盖诊断、SafeVOI、模型治理、Rubric 校准和上云交付。",
      nextAction: "继续把新增科研融合 report 纳入综合用例。",
      status: "ready",
    },
    {
      id: "synthetic-replay",
      label: "合成事件回放",
      owner: "research",
      gate: "合成数据只证明流程和算法边界，不宣称真实学校效果。",
      evidence: researchEvidence.evidenceLevel,
      nextAction: "扩展更多红队对话和 CI 失败类型。",
      status: researchEvidence.readinessScore >= 80 ? "ready" : "watch",
    },
    {
      id: "teacher-calibration",
      label: "教师锚点校准",
      owner: "teacher",
      gate: "低于一致性阈值时只允许影子诊断。",
      evidence: rubricCalibration.calibrationManifest.includes("sepath-rubric-calibration.v1")
        ? "calibration manifest ready"
        : "calibration manifest pending",
      nextAction: "真实课程时增加教师双人标注和一致性复核。",
      status: calibrationReady ? "ready" : "watch",
    },
    {
      id: "shadow-pilot",
      label: "真实课程影子运行",
      owner: "ops",
      gate: "只读接入 Git/CI/LMS，先不自动推送干预。",
      evidence: trialTelemetry.telemetryManifest.includes("sepath-trial-telemetry.v1")
        ? "trial telemetry manifest ready"
        : "trial telemetry pending",
      nextAction: "拿到课程授权后接入一门软件工程课的只读仓库。",
      status: "manual",
    },
    {
      id: "teacher-confirmed-ab",
      label: "教师确认 A/B",
      owner: "research",
      gate: "真实效果声明必须等教师确认 A/B 完成后再发布。",
      evidence: hasTeacherReview && hasReflection ? "teacher_reviewed + reflection_submitted" : "awaiting real pilot",
      nextAction: "定义实验分组、样本量、退出机制和伦理说明。",
      status: hasTeacherReview && hasReflection ? "watch" : "manual",
    },
  ];

  const deliverables: ResearchDeliverable[] = [
    {
      id: "design-paper",
      label: "产品设计方案",
      artifact: "184 页产品设计 PDF / DOCX",
      usage: "把产品、算法、架构、试点、商业化和真实性边界统一成主材料。",
      status: "ready",
    },
    {
      id: "research-matrix",
      label: "科研算法融合说明",
      artifact: "36_科研算法融合与开源证据中台说明.md",
      usage: "给评委解释作品的研究思想、开源参考、算法贡献和验证路线。",
      status: "ready",
    },
    {
      id: "fusion-manifest",
      label: "Research Fusion Manifest",
      artifact: "ResearchFusion.fusionManifest",
      usage: "作为答辩和源码审计时的机器可读研究证据清单。",
      status: "ready",
    },
    {
      id: "paper-outline",
      label: "论文/开题转化提纲",
      artifact: "paperOutline",
      usage: "后续可扩写为软件工程教育、AI 助教可信评估或学习分析方向论文。",
      status: "watch",
    },
  ];

  const contributionEvidencePack: ContributionEvidenceItem[] = [
    {
      id: "algorithm-unit-test",
      label: "算法单测证据",
      claim: "核心诊断、路径、SafeVOI、Rubric、试点遥测和证据装订均可确定性复现。",
      evidencePath: "sepath-cloud-app/src/engine/engine.test.ts",
      verification: "npm run test",
      status: "ready",
    },
    {
      id: "product-panel",
      label: "产品内证据",
      claim: "研究思想被落成真实产品面板，而不是只写在 PPT。",
      evidencePath: "#research-fusion / #value / #trial-telemetry / #pilot-evidence-binder",
      verification: "打开 Demo 顶部导航依次查看科研融合、增值评估、试点遥测和试点证据。",
      status: "ready",
    },
    {
      id: "material-evidence",
      label: "材料证据",
      claim: "开源参考、自研贡献、验证阶梯和真实性边界均进入提交材料。",
      evidencePath: "参赛提交材料包/36_科研算法融合与开源证据中台说明.md",
      verification: "查看 36 号材料与 46/55/58 号机器证据包交叉引用。",
      status: "ready",
    },
    {
      id: "real-pilot-boundary",
      label: "真实试点边界",
      claim: "真实课程效果声明被 L0-L3 证据等级约束，不提前夸大。",
      evidencePath: "参赛提交材料包/58_真实课程试点证据归档与声明门禁说明_机器可读.json",
      verification: "确认 noRealScoreClaimBeforeControlledPilot 与 teacher-release-gate 存在。",
      status: "manual",
    },
  ];

  const allStatusItems = [
    ...openSourceReferences,
    ...algorithmContributions,
    ...researchHypotheses,
    ...validationStages,
    ...deliverables,
    ...ideaMigration,
    ...contributionGraph,
    ...contributionEvidencePack,
  ];
  const readyCount = countStatus(allStatusItems, "ready");
  const watchCount = countStatus(allStatusItems, "watch");
  const manualCount = countStatus(allStatusItems, "manual");
  const blockedCount = countStatus(allStatusItems, "blocked");
  const score = Math.round(
    (allStatusItems.reduce((total, item) => total + statusWeight(item.status), 0) / allStatusItems.length) * 100,
  );

  const manifest = {
    runtime: "sepath-research-fusion.v1",
    courseVersion: courseAuthoring.courseVersion,
    strategyWinner: strategyLab.winnerId,
    researchReadiness: researchEvidence.readinessScore,
    valueScore: valueUplift.valueScore,
    modelOpsVersion: modelOps.modelVersion,
    rubricCalibrationScore: rubricCalibration.score,
    trialTelemetryScore: trialTelemetry.score,
    ideaMigrationIds: ideaMigration.map((item) => item.id),
    contributionGraphIds: contributionGraph.map((item) => item.id),
    contributionEvidenceIds: contributionEvidencePack.map((item) => item.id),
    openSourceReferences: openSourceReferences.map((item) => ({
      id: item.id,
      license: item.license,
      sourceUrl: item.sourceUrl,
      boundary: item.boundary,
    })),
    claimBoundary: "Open-source projects are used as design references only; no external source code is copied into the demo.",
  };

  return {
    score,
    stage:
      manualCount > 0
        ? "科研融合已成型 / 真实课程研究仍需授权试点"
        : "可进入小班研究验证",
    summary:
      "科研算法融合与开源证据中台把 SE-Path 的算法思想、开源参考、研究假设、验证阶梯和论文/答辩交付件收束到同一个产品面板。它说明作品不是普通问答 Demo，而是从软件工程过程证据出发，融合 SafeVOI、路径数字孪生、教师 Rubric 校准、试点遥测和 ModelOps 的可研究、可上线、可答辩系统。",
    readyCount,
    watchCount,
    manualCount,
    blockedCount,
    metrics: [
      {
        id: "fusion-score",
        label: "科研融合度",
        value: `${score}`,
        target: "算法、产品、开源参考、材料和验证路线可互相证明",
        status: score >= 85 ? "ready" : "watch",
      },
      {
        id: "source-count",
        label: "开源参考",
        value: `${openSourceReferences.length} 项`,
        target: "LMS / Agent / Telemetry / Governance 均有参考边界",
        status: "ready",
      },
      {
        id: "algorithm-count",
        label: "算法贡献",
        value: `${algorithmContributions.length} 项`,
        target: "证据账本、路径孪生、SafeVOI、Rubric 校准、增值评估、遥测门禁",
        status: algorithmReady ? "ready" : "watch",
      },
      {
        id: "trial-boundary",
        label: "真实声明门禁",
        value: trialReady ? "manifest ready" : "manual",
        target: "真实提分、教师减负和长期因果效果必须经授权试点",
        status: "manual",
      },
    ],
    openSourceReferences,
    algorithmContributions,
    researchHypotheses,
    validationStages,
    deliverables,
    ideaMigration,
    contributionGraph,
    contributionEvidencePack,
    paperOutline: [
      "题目建议：面向软件工程项目式学习的证据驱动自适应伴学智能体研究。",
      "研究问题 RQ1：工程过程证据能否比单轮问答更稳定地诊断学习阻塞？",
      "研究问题 RQ2：SafeVOI 是否能在保持学习收益的同时降低替写、低证据和高风险建议？",
      "研究问题 RQ3：教师 Rubric 锚点校准是否能提高 AI 能力诊断的可信度与采纳度？",
      "实验设计：合成回放、红队样本、真实课程影子运行、教师确认 A/B。",
      "边界声明：当前阶段不宣称真实课程显著提分，所有真实效果需等待授权试点。",
    ],
    defenseScript: [
      "我们不是把大模型包装成聊天窗口，而是把软件工程学习过程变成证据账本。",
      "算法上，我们用 SafeVOI 选择下一步行动，用路径数字孪生维护学习状态，用 Rubric 校准防止 AI 自评自证。",
      "工程上，我们参考开放学习平台、Agent 编排和遥测系统的思想，但没有复制外部代码，所有核心闭环是本项目自研。",
      "科研上，我们把合成回放、教师锚点、试点遥测和真实声明门禁放进同一套验证阶梯，确保能演示，也能走向真实课程研究。",
    ],
    fusionManifest: JSON.stringify(manifest, null, 2),
  };
}
