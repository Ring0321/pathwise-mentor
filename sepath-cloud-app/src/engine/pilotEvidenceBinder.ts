import type { DataPlaneReport } from "./dataPlane";
import type { PrivacyGuardReport } from "./privacyGuard";
import type { RubricCalibrationReport } from "./rubricCalibration";
import type { TrialTelemetryReport } from "./trialTelemetry";

export type PilotEvidenceBinderStatus = "ready" | "collecting" | "manual" | "blocked";
export type PilotEvidenceBinderOwner = "school" | "teacher" | "researcher" | "ops" | "security";

export interface PilotEvidenceBinderMetric {
  id: string;
  label: string;
  value: string;
  target: string;
  status: PilotEvidenceBinderStatus;
}

export interface PilotEvidenceBinderItem {
  id: string;
  label: string;
  owner: PilotEvidenceBinderOwner;
  status: PilotEvidenceBinderStatus;
  evidence: string;
  passCondition: string;
  blockedIf: string;
}

export interface PilotEvidenceFreezeStep {
  id: string;
  label: string;
  status: PilotEvidenceBinderStatus;
  source: string;
  artifact: string;
  checksumRule: string;
  retention: string;
}

export interface PilotClaimTier {
  id: string;
  label: string;
  status: PilotEvidenceBinderStatus;
  canSay: string;
  cannotSay: string;
  evidenceThreshold: string;
}

export interface PilotEvidenceExport {
  id: string;
  label: string;
  status: PilotEvidenceBinderStatus;
  path: string;
  content: string;
}

export interface PilotEvidenceBinderReport {
  runtime: string;
  score: number;
  stage: string;
  summary: string;
  readyCount: number;
  collectingCount: number;
  manualCount: number;
  blockedCount: number;
  metrics: PilotEvidenceBinderMetric[];
  consentPack: PilotEvidenceBinderItem[];
  evidenceFreeze: PilotEvidenceFreezeStep[];
  analysisGates: PilotEvidenceBinderItem[];
  claimTiers: PilotClaimTier[];
  exportPack: PilotEvidenceExport[];
  teacherSignoffScript: string[];
  manifestPath: string;
  materialPath: string;
  binderManifest: string;
}

function countStatus<T extends { status: PilotEvidenceBinderStatus }>(
  items: T[],
  status: PilotEvidenceBinderStatus,
): number {
  return items.filter((item) => item.status === status).length;
}

function scoreStatus(status: PilotEvidenceBinderStatus): number {
  if (status === "ready") return 1;
  if (status === "collecting") return 0.72;
  if (status === "manual") return 0.42;
  return 0;
}

function scoreItems(items: Array<{ status: PilotEvidenceBinderStatus }>, bonus = 0): number {
  const base = items.length ? items.reduce((total, item) => total + scoreStatus(item.status), 0) / items.length : 0;
  return Math.max(0, Math.min(100, Math.round(base * 100 + bonus)));
}

export function buildPilotEvidenceBinderReport(
  telemetry: TrialTelemetryReport,
  privacyGuard: PrivacyGuardReport,
  rubricCalibration: RubricCalibrationReport,
  dataPlane: DataPlaneReport,
): PilotEvidenceBinderReport {
  const privacyReady = privacyGuard.gate === "pass";
  const telemetryReady = telemetry.dataContract.includes("learnerHash") && telemetry.score >= 75;
  const calibrationReady = rubricCalibration.score >= 75 && rubricCalibration.calibrationManifest.includes("teacherAnchor");
  const dataPlaneReady = dataPlane.score >= 75 && dataPlane.dataPlaneManifest.includes("tenantId");

  const consentPack: PilotEvidenceBinderItem[] = [
    {
      id: "school-authorization",
      label: "学校/课程授权",
      owner: "school",
      status: "manual",
      evidence: "真实课程负责人签字或平台审批截图，当前 Demo 不代替授权。",
      passCondition: "明确课程范围、数据字段、使用周期、退出机制和负责人。",
      blockedIf: "没有授权却接入真实学生、真实仓库或真实 LMS。",
    },
    {
      id: "participant-notice",
      label: "学生知情与退出",
      owner: "teacher",
      status: "manual",
      evidence: "学生可见告知文本、退出入口和教师解释脚本。",
      passCondition: "学生知道系统采集哪些过程证据，以及退出后如何停止新采集。",
      blockedIf: "把 AI 诊断隐藏成默认教学评分，或未说明退出机制。",
    },
    {
      id: "data-minimization",
      label: "数据最小化",
      owner: "security",
      status: privacyReady ? "ready" : "blocked",
      evidence: `privacy gate=${privacyGuard.gate}，PII 命中 ${privacyGuard.piiFindings}。`,
      passCondition: "公开材料只含合成数据；真实试点只保存 learnerHash 和摘要字段。",
      blockedIf: "手机号、邮箱、密钥、私有仓库地址或原始私聊进入公开包。",
    },
    {
      id: "teacher-release-gate",
      label: "教师发布门",
      owner: "teacher",
      status: calibrationReady ? "ready" : "collecting",
      evidence: `Rubric 校准分 ${rubricCalibration.score}，发布门 ${rubricCalibration.releaseGates.length} 项。`,
      passCondition: "高风险建议、低证据诊断和替写风险均进入教师复核。",
      blockedIf: "模型直接发布高风险干预或可提交完整答案。",
    },
    {
      id: "retention-delete",
      label: "保留期与删除",
      owner: "ops",
      status: dataPlaneReady ? "ready" : "collecting",
      evidence: `数据平面 ${dataPlane.score} 分，备份策略 ${dataPlane.backups.length} 项。`,
      passCondition: "保留期、删除流程、备份恢复和 RLS 范围均有 Runbook。",
      blockedIf: "试点结束后不能撤回授权、删除或脱敏归档。",
    },
  ];

  const evidenceFreeze: PilotEvidenceFreezeStep[] = [
    {
      id: "preregistration-freeze",
      label: "预注册冻结",
      status: "ready",
      source: "TrialTelemetry.validationPlan",
      artifact: "参赛提交材料包/33_试点遥测与效果验证中心说明.md",
      checksumRule: "冻结假设、指标、分组、排除规则和停止条件。",
      retention: "作为试点开始前版本保留，不随后验结果回写修改。",
    },
    {
      id: "telemetry-manifest-freeze",
      label: "遥测 Manifest 冻结",
      status: telemetryReady ? "ready" : "collecting",
      source: "TrialTelemetry.telemetryManifest",
      artifact: "sepath-trial-telemetry-manifest.json",
      checksumRule: `${telemetry.dataContract.length} 个字段，claimBoundary 不允许真实提分提前声明。`,
      retention: "随课程版本和 safevoi_version 一起归档。",
    },
    {
      id: "pseudonym-map-separation",
      label: "身份映射隔离",
      status: privacyReady && dataPlaneReady ? "ready" : "manual",
      source: "PrivacyGuard + DataPlane",
      artifact: "school-held-pseudonym-map.csv",
      checksumRule: "公开包不保存真实姓名映射，学校侧单独保管。",
      retention: "只在授权周期内保留，研究导出只保留 learnerHash。",
    },
    {
      id: "rubric-anchor-freeze",
      label: "Rubric 锚点冻结",
      status: calibrationReady ? "ready" : "collecting",
      source: "RubricCalibration.calibrationManifest",
      artifact: "sepath-rubric-calibration-manifest.json",
      checksumRule: "teacherAnchor、aiEstimate、delta 和一致性阈值需在分析前冻结。",
      retention: "作为教师评分一致性复核证据。",
    },
    {
      id: "analysis-snapshot",
      label: "分析快照封存",
      status: "manual",
      source: "analysis/sepath_trial_effects.ipynb",
      artifact: "pilot-analysis-snapshot.zip",
      checksumRule: "导出匿名数据字典、Notebook、图表和结论分级 SHA256。",
      retention: "试点复盘后封存，只追加更正说明，不覆盖原始分析。",
    },
  ];

  const analysisGates: PilotEvidenceBinderItem[] = [
    {
      id: "coverage-gate",
      label: "证据覆盖门",
      owner: "researcher",
      status: telemetryReady ? "ready" : "collecting",
      evidence: `试点遥测分 ${telemetry.score}，数据契约 ${telemetry.dataContract.length} 字段。`,
      passCondition: "baseline、Git/CI、对话、教师复核、反思至少覆盖核心链路。",
      blockedIf: "只有聊天记录或只有成绩，无法解释学习过程。",
    },
    {
      id: "baseline-balance",
      label: "基线可比门",
      owner: "researcher",
      status: "manual",
      evidence: "等待真实班级分组后计算基线差异。",
      passCondition: "干预组、等待组或历史基线任务难度和起点可比。",
      blockedIf: "把不同课程、不同任务、不同时间窗口强行比较。",
    },
    {
      id: "teacher-agreement",
      label: "教师一致性门",
      owner: "teacher",
      status: calibrationReady ? "ready" : "collecting",
      evidence: rubricCalibration.metrics.find((metric) => metric.id === "agreement")?.value ?? "agreement pending",
      passCondition: "教师锚点与 AI 估计差异在阈值内，分歧样本进入复核。",
      blockedIf: "AI 自评自证，没有教师锚点或复核记录。",
    },
    {
      id: "claim-tiering",
      label: "结论分级门",
      owner: "researcher",
      status: "ready",
      evidence: "声明被拆成可声明、谨慎声明和不可声明三档。",
      passCondition: "每个对外结论都能指向试点证据等级。",
      blockedIf: "把合成回放、影子诊断或小样本观察写成因果提分结论。",
    },
  ];

  const claimTiers: PilotClaimTier[] = [
    {
      id: "tier-0-demo",
      label: "L0 工程 Demo 已验证",
      status: "ready",
      canSay: "闭环 Demo 可运行，能把 PR/CI、对话、教师复核和反思写成证据账本。",
      cannotSay: "不能说已经接入真实学校生产系统。",
      evidenceThreshold: "release gate、自动审计、演示视频、截图和源码测试。",
    },
    {
      id: "tier-1-shadow",
      label: "L1 影子试点可启动",
      status: privacyReady && telemetryReady ? "ready" : "manual",
      canSay: "具备真实课程影子诊断和教师后台观察的试点条件。",
      cannotSay: "不能说系统已经自动改善学生成绩。",
      evidenceThreshold: "授权、脱敏、遥测 Manifest、教师周报和退出机制齐全。",
    },
    {
      id: "tier-2-teacher-confirmed",
      label: "L2 教师确认干预待授权",
      status: "manual",
      canSay: "可在教师确认后小范围发布脚手架干预，并观察阻塞解除和反思质量。",
      cannotSay: "不能把小样本观察当作长期因果结论。",
      evidenceThreshold: "教师签收、A/B 或等待组、Rubric 一致性和匿名分析快照。",
    },
    {
      id: "tier-3-controlled-effect",
      label: "L3 受控效果结论",
      status: "manual",
      canSay: "多班级或多轮课程验证后，才讨论统计意义上的学习增值。",
      cannotSay: "当前阶段不能宣称已证明真实班级长期显著提分。",
      evidenceThreshold: "预注册、样本量、统计分析、负面结果记录和复现实验包。",
    },
  ];

  const exportPack: PilotEvidenceExport[] = [
    {
      id: "binder-material",
      label: "58 号试点证据装订包",
      status: "ready",
      path: "参赛提交材料包/58_真实课程试点证据归档与声明门禁说明.md",
      content: "授权、脱敏、预注册、数据冻结、教师签收和结论分级。",
    },
    {
      id: "binder-machine-json",
      label: "机器可读装订包",
      status: "ready",
      path: "参赛提交材料包/58_真实课程试点证据归档与声明门禁说明_机器可读.json",
      content: "试点证据状态、材料路径、人工门禁和声明等级。",
    },
    {
      id: "teacher-signoff",
      label: "教师签收单模板",
      status: "manual",
      path: "trial/teacher_signoff_template.md",
      content: "教师确认高风险建议、试点范围和不可替写边界。",
    },
    {
      id: "anonymous-dataset-dictionary",
      label: "匿名数据字典",
      status: dataPlaneReady ? "ready" : "collecting",
      path: "trial/anonymous_dataset_dictionary.csv",
      content: "learnerHash、courseId、traceId、safevoi_version 和结果指标字段说明。",
    },
    {
      id: "analysis-snapshot",
      label: "分析快照",
      status: "manual",
      path: "trial/pilot-analysis-snapshot.zip",
      content: "真实试点结束后封存 Notebook、匿名数据、图表和 SHA256。",
    },
  ];

  const allStatusItems = [...consentPack, ...evidenceFreeze, ...analysisGates, ...claimTiers, ...exportPack];
  const readyCount = countStatus(allStatusItems, "ready");
  const collectingCount = countStatus(allStatusItems, "collecting");
  const manualCount = countStatus(allStatusItems, "manual");
  const blockedCount = countStatus(allStatusItems, "blocked");
  const score = scoreItems(allStatusItems, privacyReady ? 4 : -10);
  const runtime = "sepath-pilot-evidence-binder.v1";
  const materialPath = "参赛提交材料包/58_真实课程试点证据归档与声明门禁说明.md";
  const manifestPath = "参赛提交材料包/58_真实课程试点证据归档与声明门禁说明_机器可读.json";
  const binderManifest = JSON.stringify(
    {
      runtime,
      score,
      stage: blockedCount > 0 ? "blocked-before-real-pilot" : "shadow-pilot-evidence-binder-ready",
      requiredBeforeRealPilot: consentPack.filter((item) => item.status !== "ready").map((item) => item.id),
      evidenceFreeze: evidenceFreeze.map((item) => ({ id: item.id, status: item.status, artifact: item.artifact })),
      claimTiers: claimTiers.map((tier) => ({ id: tier.id, status: tier.status, cannotSay: tier.cannotSay })),
      noRealScoreClaimBeforeControlledPilot: true,
    },
    null,
    2,
  );

  return {
    runtime,
    score,
    stage: blockedCount > 0 ? "真实试点前存在阻断" : "影子试点证据装订可执行",
    summary:
      "试点证据归档中心把真实课程落地前必须确认的授权、脱敏、预注册、数据冻结、教师签收、分析快照和声明分级做成一套证据装订器。它让 SE-Path 可以大胆展示工程闭环，同时不把尚未完成的真实课程效果说成既成事实。",
    readyCount,
    collectingCount,
    manualCount,
    blockedCount,
    metrics: [
      {
        id: "binder-score",
        label: "装订完整度",
        value: `${score}`,
        target: "无隐私阻断，可进入影子试点准备",
        status: blockedCount > 0 ? "blocked" : "ready",
      },
      {
        id: "consent",
        label: "授权门禁",
        value: `${consentPack.length} 项`,
        target: "学校、学生、教师、保留期和退出机制齐全",
        status: consentPack.some((item) => item.status === "blocked") ? "blocked" : "manual",
      },
      {
        id: "freeze",
        label: "冻结证据",
        value: `${evidenceFreeze.length} 件`,
        target: "预注册、遥测、身份映射、Rubric 和分析快照可追溯",
        status: telemetryReady ? "ready" : "collecting",
      },
      {
        id: "claim-tier",
        label: "声明分级",
        value: `${claimTiers.length} 层`,
        target: "Demo、影子、教师确认、受控效果分层表达",
        status: "ready",
      },
    ],
    consentPack,
    evidenceFreeze,
    analysisGates,
    claimTiers,
    exportPack,
    teacherSignoffScript: [
      "我确认本轮试点只在授权课程范围内使用 SE-Path。",
      "我确认高风险建议、替写风险和低证据诊断必须由教师复核后再发布。",
      "我确认公开材料不得包含真实学生身份、私有仓库地址或原始私聊。",
      "我确认当前材料只能声明工程闭环和试点能力，不能提前宣称真实长期提分。",
      "我确认试点结束后会封存匿名数据、分析快照和结论分级记录。",
    ],
    manifestPath,
    materialPath,
    binderManifest,
  };
}
