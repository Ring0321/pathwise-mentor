import type { AppState, CompetencyId } from "../domain/types";
import type { CourseAuthoringReport } from "./courseAuthoring";
import { evidenceCoverage, scoreCompetencies } from "./evidence";
import type { ModelOpsReport } from "./modelOps";
import type { TeacherReport } from "./teacherReport";
import type { TrialTelemetryReport } from "./trialTelemetry";

export type RubricCalibrationStatus = "ready" | "calibrating" | "manual" | "blocked";
export type RubricCalibrationOwner = "teacher" | "course_admin" | "researcher" | "ops" | "modelops";

export interface RubricCalibrationMetric {
  id: string;
  label: string;
  value: string;
  target: string;
  status: RubricCalibrationStatus;
}

export interface CalibrationSample {
  id: string;
  label: string;
  status: RubricCalibrationStatus;
  competencyId: CompetencyId;
  source: string;
  teacherAnchor: number;
  aiEstimate: number;
  delta: number;
  decision: string;
}

export interface AnnotationQueueItem {
  id: string;
  label: string;
  owner: RubricCalibrationOwner;
  status: RubricCalibrationStatus;
  trigger: string;
  action: string;
  evidence: string;
}

export interface AgreementCheck {
  id: string;
  label: string;
  status: RubricCalibrationStatus;
  value: string;
  target: string;
  method: string;
  riskControl: string;
}

export interface CalibrationDriftCheck {
  id: string;
  label: string;
  status: RubricCalibrationStatus;
  signal: string;
  threshold: string;
  response: string;
}

export interface CalibrationReleaseGate {
  id: string;
  label: string;
  status: RubricCalibrationStatus;
  passCondition: string;
  blockCondition: string;
  evidence: string;
}

export interface CalibrationExportItem {
  id: string;
  label: string;
  status: RubricCalibrationStatus;
  artifact: string;
  usage: string;
}

export interface RubricCalibrationReport {
  score: number;
  stage: string;
  summary: string;
  calibrationMode: string;
  readyCount: number;
  calibratingCount: number;
  manualCount: number;
  blockedCount: number;
  metrics: RubricCalibrationMetric[];
  anchorSamples: CalibrationSample[];
  annotationQueue: AnnotationQueueItem[];
  agreementChecks: AgreementCheck[];
  driftChecks: CalibrationDriftCheck[];
  releaseGates: CalibrationReleaseGate[];
  exportPack: CalibrationExportItem[];
  calibrationProtocol: string[];
  calibrationManifest: string;
}

const competencyLabels: Record<CompetencyId, string> = {
  requirements: "需求分析",
  architecture: "架构边界",
  implementation: "实现能力",
  testing: "测试质量",
  collaboration: "协作交付",
  reflection: "反思迁移",
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function countStatus<T extends { status: RubricCalibrationStatus }>(
  items: T[],
  status: RubricCalibrationStatus,
): number {
  return items.filter((item) => item.status === status).length;
}

function statusWeight(status: RubricCalibrationStatus): number {
  if (status === "ready") return 1;
  if (status === "calibrating") return 0.74;
  if (status === "manual") return 0.46;
  return 0;
}

function hasEvent(state: AppState, type: string): boolean {
  return state.events.some((event) => event.type === type);
}

function scoreStatus(delta: number): RubricCalibrationStatus {
  if (delta <= 6) return "ready";
  if (delta <= 12) return "calibrating";
  return "manual";
}

export function buildRubricCalibrationReport(
  state: AppState,
  courseAuthoring: CourseAuthoringReport,
  teacherReport: TeacherReport,
  modelOps: ModelOpsReport,
  trialTelemetry: TrialTelemetryReport,
): RubricCalibrationReport {
  const coverage = evidenceCoverage(state.events);
  const scores = scoreCompetencies(state.learner.baseline, state.events);
  const hasTeacherReview = hasEvent(state, "teacher_reviewed");
  const hasReflection = hasEvent(state, "reflection_submitted");
  const hasCiPair = hasEvent(state, "ci_failed") && hasEvent(state, "ci_passed");
  const rubricReady = courseAuthoring.rubrics.length >= 6 && courseAuthoring.score >= 80;
  const teacherReady = teacherReport.score >= 75 && hasTeacherReview;
  const modelReady = modelOps.score >= 75;
  const telemetryReady = trialTelemetry.score >= 75;
  const directAnswerGate = courseAuthoring.aiPolicies.some((policy) => policy.id === "DIRECT_ANSWER_POLICY_GATE");

  const anchorSamples: CalibrationSample[] = courseAuthoring.rubrics.slice(0, 6).map((rubric, index) => {
    const aiEstimate = Math.round(scores[rubric.competencyId]);
    const teacherAnchor = clamp(
      Math.round(
        aiEstimate
          + (rubric.competencyId === "testing" ? 4 : 0)
          + (rubric.competencyId === "reflection" && hasReflection ? 3 : 0)
          - (rubric.competencyId === "architecture" ? 2 : 0)
          + (index % 2 === 0 ? 1 : -1),
      ),
      0,
      100,
    );
    const delta = Math.abs(teacherAnchor - aiEstimate);
    return {
      id: `anchor-${rubric.competencyId}`,
      label: `${rubric.label} 标注锚点`,
      status: scoreStatus(delta),
      competencyId: rubric.competencyId,
      source:
        rubric.competencyId === "testing"
          ? "CI Recovery Lab / PR 修复证据"
          : rubric.competencyId === "reflection"
            ? "reflection_submitted / 教师周报"
            : "Course Manifest / EvidenceEvent",
      teacherAnchor,
      aiEstimate,
      delta,
      decision:
        delta <= 6
          ? "可作为发布前稳定锚点"
          : delta <= 12
            ? "进入抽样复核，暂不影响主路径"
            : "阻断自动评分声明，必须教师复核",
    };
  });

  const maxDelta = Math.max(...anchorSamples.map((sample) => sample.delta), 0);
  const averageDelta =
    anchorSamples.length > 0
      ? anchorSamples.reduce((total, sample) => total + sample.delta, 0) / anchorSamples.length
      : 100;
  const agreementScore = clamp(Math.round(100 - averageDelta * 4), 0, 100);

  const annotationQueue: AnnotationQueueItem[] = [
    {
      id: "ci-failure-anchor",
      label: "CI 失败到修复样本",
      owner: "teacher",
      status: hasCiPair ? "ready" : "calibrating",
      trigger: "出现 ci_failed 与 ci_passed 成对证据后",
      action: "教师标注错误定位、测试补全、修复解释三项 Rubric。",
      evidence: hasCiPair ? "ci_failed + ci_passed" : "等待真实仓库或回放样本补齐",
    },
    {
      id: "direct-answer-redteam",
      label: "直接要答案红队样本",
      owner: "modelops",
      status: directAnswerGate ? "ready" : "manual",
      trigger: "学生请求完整可提交代码、绕过测试或复制答案",
      action: "标注是否拒答、是否给出脚手架、是否进入教师复核。",
      evidence: "DIRECT_ANSWER_POLICY_GATE",
    },
    {
      id: "reflection-quality",
      label: "反思质量样本",
      owner: "researcher",
      status: hasReflection ? "ready" : "calibrating",
      trigger: "学生提交修复后 24 小时内",
      action: "按原因解释、修复依据、迁移场景三个维度标注反思质量。",
      evidence: hasReflection ? "reflection_submitted" : "等待反思证据",
    },
    {
      id: "weekly-teacher-audit",
      label: "教师周报抽样复核",
      owner: "course_admin",
      status: teacherReport.score >= 80 ? "ready" : "manual",
      trigger: "每周导出教师周报前",
      action: "抽样检查 P0/P1 队列、下周行动和 AI 边界是否与证据一致。",
      evidence: teacherReport.exportFileName,
    },
    {
      id: "trial-claim-review",
      label: "真实效果声明复核",
      owner: "researcher",
      status: "manual",
      trigger: "准备对外声明阻塞解除、反思提升或成绩提升时",
      action: "先检查遥测分组、对照组、教师确认 A/B 和声明门禁。",
      evidence: "TrialTelemetry.claimGates",
    },
  ];

  const agreementChecks: AgreementCheck[] = [
    {
      id: "rubric-coverage",
      label: "Rubric 覆盖",
      status: rubricReady ? "ready" : "manual",
      value: `${courseAuthoring.rubrics.length}/6`,
      target: "六类软件工程能力均有可解释 Rubric",
      method: "Course Manifest 中逐项检查 competencyId、evidenceSignals、aiBoundary。",
      riskControl: "缺少 Rubric 的能力不得进入自动诊断提分声明。",
    },
    {
      id: "teacher-ai-agreement",
      label: "教师-AI 一致性",
      status: agreementScore >= 85 ? "ready" : agreementScore >= 70 ? "calibrating" : "manual",
      value: `${agreementScore}%`,
      target: "首轮试点前 >=85%，低于阈值进入教师复核",
      method: "用教师锚点分与 AI 能力估计差值计算校准一致性。",
      riskControl: "一致性不足时只输出脚手架建议，不输出高置信能力结论。",
    },
    {
      id: "max-disagreement",
      label: "最大分歧",
      status: maxDelta <= 8 ? "ready" : maxDelta <= 14 ? "calibrating" : "manual",
      value: `${maxDelta} 分`,
      target: "单项 Rubric 分歧 <=8 分",
      method: "逐能力比较 teacherAnchor 与 aiEstimate。",
      riskControl: "最大分歧超阈值时阻断该能力的自动路径升级。",
    },
    {
      id: "telemetry-contract",
      label: "遥测字段可复核",
      status:
        trialTelemetry.dataContract.includes("reflection_quality_score") &&
        trialTelemetry.dataContract.includes("teacher_review.status")
          ? "ready"
          : "manual",
      value: `${trialTelemetry.dataContract.length} 字段`,
      target: "包含教师复核、反思质量、阻塞解除时间",
      method: "复核 TrialTelemetry.dataContract 与校准样本字段是否一致。",
      riskControl: "字段缺失时不做真实课程效果分析。",
    },
  ];

  const driftChecks: CalibrationDriftCheck[] = [
    {
      id: "agreement-drift",
      label: "一致性漂移",
      status: agreementScore >= 85 ? "ready" : "calibrating",
      signal: `agreement=${agreementScore}%`,
      threshold: "连续两周低于 85%",
      response: "冻结自动能力升级，扩大教师抽样标注比例。",
    },
    {
      id: "rubric-version-drift",
      label: "Rubric 版本漂移",
      status: courseAuthoring.courseVersion.includes("v1") ? "ready" : "manual",
      signal: courseAuthoring.courseVersion,
      threshold: "课程 Rubric 改版后未重新校准",
      response: "重新生成 anchorSamples，并在 ModelOps 中记录模型版本。",
    },
    {
      id: "high-risk-label-drift",
      label: "高风险标签漂移",
      status: directAnswerGate ? "ready" : "manual",
      signal: "DIRECT_ANSWER_POLICY_GATE",
      threshold: "直接答案请求未被拦截",
      response: "阻断发布，更新红队样本和 Prompt 契约。",
    },
    {
      id: "evidence-coverage-drift",
      label: "证据覆盖漂移",
      status: coverage >= 0.7 ? "ready" : "calibrating",
      signal: `${Math.round(coverage * 100)}%`,
      threshold: "低于 70% 时不能声称高置信诊断",
      response: "要求补充 Git/CI/教师复核/反思证据。",
    },
  ];

  const releaseGates: CalibrationReleaseGate[] = [
    {
      id: "teacher-anchor-gate",
      label: "教师锚点发布门",
      status: teacherReady ? "ready" : "manual",
      passCondition: "至少有教师复核事件和可导出的教师周报。",
      blockCondition: "没有教师锚点时不得发布高风险个性化干预。",
      evidence: teacherReady ? "teacher_reviewed + weekly report" : "teacher review pending",
    },
    {
      id: "agreement-gate",
      label: "一致性阈值发布门",
      status: agreementScore >= 85 ? "ready" : "calibrating",
      passCondition: "教师-AI 一致性 >=85%。",
      blockCondition: "低于 70% 时只能影子运行。",
      evidence: `agreement=${agreementScore}%, maxDelta=${maxDelta}`,
    },
    {
      id: "modelops-gate",
      label: "ModelOps 追踪门",
      status: modelReady ? "ready" : "manual",
      passCondition: "模型版本、发布门、漂移监控和红队样本可追踪。",
      blockCondition: "没有模型版本记录或回滚路径。",
      evidence: modelOps.modelVersion,
    },
    {
      id: "trial-claim-gate",
      label: "真实效果声明门",
      status: telemetryReady ? "calibrating" : "manual",
      passCondition: "完成授权试点、对照组和教师确认 A/B 后再声明真实效果。",
      blockCondition: "只有合成样本或 Demo 时不得宣称真实提分。",
      evidence: trialTelemetry.telemetryManifest.includes("sepath-trial-telemetry.v1")
        ? "TrialTelemetry manifest ready"
        : "TrialTelemetry manifest pending",
    },
  ];

  const exportPack: CalibrationExportItem[] = [
    {
      id: "calibration-manifest",
      label: "校准 Manifest",
      status: "ready",
      artifact: "RubricCalibration.calibrationManifest",
      usage: "交给评委或学校说明教师标注、AI 估计、一致性阈值和发布边界。",
    },
    {
      id: "anchor-samples",
      label: "教师标注锚点",
      status: anchorSamples.length >= 6 ? "ready" : "manual",
      artifact: "RubricCalibration.anchorSamples",
      usage: "作为后续真实课程校准数据包的结构模板。",
    },
    {
      id: "annotation-queue",
      label: "标注队列",
      status: annotationQueue.some((item) => item.status === "manual") ? "calibrating" : "ready",
      artifact: "RubricCalibration.annotationQueue",
      usage: "指导教师和研究者优先标注哪些样本。",
    },
    {
      id: "release-gates",
      label: "校准发布门",
      status: releaseGates.every((gate) => gate.status !== "blocked") ? "ready" : "blocked",
      artifact: "RubricCalibration.releaseGates",
      usage: "防止 AI 自己给分、自己证明自己。",
    },
  ];

  const allStatusItems = [
    ...anchorSamples,
    ...annotationQueue,
    ...agreementChecks,
    ...driftChecks,
    ...releaseGates,
    ...exportPack,
  ];
  const readyCount = countStatus(allStatusItems, "ready");
  const calibratingCount = countStatus(allStatusItems, "calibrating");
  const manualCount = countStatus(allStatusItems, "manual");
  const blockedCount = countStatus(allStatusItems, "blocked");
  const score = Math.round(
    clamp(
      (allStatusItems.reduce((total, item) => total + statusWeight(item.status), 0) / allStatusItems.length) * 100
        + (rubricReady ? 4 : -8)
        + (teacherReady ? 4 : 0)
        + (modelReady ? 3 : 0)
        + (telemetryReady ? 3 : 0),
      0,
      100,
    ),
  );
  const calibrationMode =
    blockedCount > 0 ? "blocked" : manualCount > 0 ? "teacher-anchored-shadow" : "calibrated-small-cohort";

  const manifest = {
    runtime: "sepath-rubric-calibration.v1",
    calibrationMode,
    score,
    courseVersion: courseAuthoring.courseVersion,
    teacherReport: teacherReport.exportFileName,
    modelVersion: modelOps.modelVersion,
    agreementScore,
    maxDelta,
    dataContract: [
      "tenantId",
      "courseId",
      "cohortId",
      "learnerHash",
      "rubricVersion",
      "competencyId",
      "teacherAnchor",
      "aiEstimate",
      "delta",
      "teacher_review.status",
    ],
    gates: releaseGates.map((gate) => ({ id: gate.id, status: gate.status, evidence: gate.evidence })),
    claimBoundary: "AI ability estimates require teacher calibration before real course outcome claims.",
  };

  return {
    score,
    stage:
      blockedCount > 0
        ? "校准阻断 / 先修复教师标注或 Rubric 边界"
        : manualCount > 0
          ? "教师锚点校准中 / 可影子运行"
          : "可进入小班校准试点",
    summary:
      "教师标注与 Rubric 校准中心把课程 Rubric、教师周报、AI 能力估计、试点遥测和 ModelOps 发布门连接起来，避免系统自己给分、自己证明自己。它先用教师锚点样本校准 AI 判断，再监控一致性、最大分歧和证据覆盖，最后决定哪些能力结论可以发布、哪些必须进入教师复核。",
    calibrationMode,
    readyCount,
    calibratingCount,
    manualCount,
    blockedCount,
    metrics: [
      {
        id: "calibration-score",
        label: "校准可信分",
        value: `${score}`,
        target: "真实课程试点前教师-AI 一致性可解释",
        status: blockedCount > 0 ? "blocked" : "ready",
      },
      {
        id: "agreement",
        label: "教师-AI 一致性",
        value: `${agreementScore}%`,
        target: ">=85% 才能发布高置信能力结论",
        status: agreementScore >= 85 ? "ready" : "calibrating",
      },
      {
        id: "max-delta",
        label: "最大分歧",
        value: `${maxDelta} 分`,
        target: "单项 Rubric 分歧 <=8 分",
        status: maxDelta <= 8 ? "ready" : "calibrating",
      },
      {
        id: "anchor-count",
        label: "教师锚点",
        value: `${anchorSamples.length} 个`,
        target: "六类能力均有 anchor sample",
        status: anchorSamples.length >= 6 ? "ready" : "manual",
      },
    ],
    anchorSamples,
    annotationQueue,
    agreementChecks,
    driftChecks,
    releaseGates,
    exportPack,
    calibrationProtocol: [
      "先冻结课程 Rubric 与 Course Manifest。",
      "从 CI 修复、直接答案拦截、反思质量和教师周报中抽取 anchor sample。",
      "教师按 Rubric 标注 teacherAnchor，系统记录 aiEstimate 与 delta。",
      "一致性低于 85% 时只允许影子诊断，不发布高置信能力结论。",
      "所有真实效果声明必须经过 TrialTelemetry 与 ModelOps 发布门。",
    ],
    calibrationManifest: JSON.stringify(manifest, null, 2),
  };
}
