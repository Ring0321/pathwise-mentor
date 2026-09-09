import type { AppState, CompetencyId, TaskDecision } from "../domain/types";
import type { CohortOpsReport } from "./cohortOps";
import { evidenceCoverage, scoreCompetencies } from "./evidence";
import type { ResearchEvidenceReport } from "./researchEvidence";
import type { StrategyLabReport, StrategyPolicyId } from "./strategyLab";

export type ValueEvidenceStatus = "proved" | "shadow" | "manual";

export interface ValueMetric {
  id: string;
  label: string;
  value: string;
  target: string;
  status: ValueEvidenceStatus;
}

export interface ValueDimension {
  id: CompetencyId;
  label: string;
  baseline: number;
  current: number;
  growth: number;
  evidenceCount: number;
  confidence: number;
  nextAction: string;
}

export interface ValueExperimentCell {
  id: StrategyPolicyId | "teacher-confirmed";
  label: string;
  expectedGain: number;
  riskReduction: number;
  teacherLoad: string;
  evidence: string;
  status: ValueEvidenceStatus;
}

export interface ValueClaim {
  id: string;
  label: string;
  statement: string;
  allowed: boolean;
  evidence: string;
  status: ValueEvidenceStatus;
}

export interface ValueStage {
  id: string;
  label: string;
  owner: "student" | "teacher" | "assistant" | "school";
  gate: string;
  evidence: string;
  status: ValueEvidenceStatus;
}

export interface ValueUpliftReport {
  mode: string;
  valueScore: number;
  estimatedUpliftPoints: number;
  confidenceBand: string;
  summary: string;
  metrics: ValueMetric[];
  dimensions: ValueDimension[];
  experimentCells: ValueExperimentCell[];
  claims: ValueClaim[];
  measurementPlan: ValueStage[];
  telemetryContract: string[];
  exportManifest: string;
}

const competencyLabels: Record<CompetencyId, string> = {
  requirements: "需求拆解",
  architecture: "模块设计",
  implementation: "编码实现",
  testing: "测试质量",
  collaboration: "协作交付",
  reflection: "复盘迁移",
};

const competencyOrder: CompetencyId[] = [
  "requirements",
  "architecture",
  "implementation",
  "testing",
  "collaboration",
  "reflection",
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function average(values: number[]): number {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
}

function statusFor(condition: boolean, manual = false): ValueEvidenceStatus {
  if (manual) return "manual";
  return condition ? "proved" : "shadow";
}

function policyScore(strategyLab: StrategyLabReport, id: StrategyPolicyId): number {
  return strategyLab.policyResults.find((policy) => policy.id === id)?.compositeScore ?? 0;
}

function eventCountFor(state: AppState, competencyId: CompetencyId): number {
  return state.events.filter((event) => Object.prototype.hasOwnProperty.call(event.competencyImpacts, competencyId)).length;
}

export function buildValueUpliftReport(
  state: AppState,
  decisions: TaskDecision[],
  strategyLab: StrategyLabReport,
  researchEvidence: ResearchEvidenceReport,
  cohortOps: CohortOpsReport,
): ValueUpliftReport {
  const scores = scoreCompetencies(state.learner.baseline, state.events);
  const coverage = evidenceCoverage(state.events);
  const baselineAverage = average(competencyOrder.map((id) => state.learner.baseline[id]));
  const currentAverage = average(competencyOrder.map((id) => scores[id]));
  const observedGrowth = currentAverage - baselineAverage;
  const safeScore = policyScore(strategyLab, "sepath-safevoi");
  const chatScore = policyScore(strategyLab, "chat-only");
  const staticScore = policyScore(strategyLab, "static-path");
  const strategyAdvantage = safeScore - Math.max(chatScore, staticScore);
  const hasCiPass = state.events.some((event) => event.type === "ci_passed");
  const hasTeacherReview = state.events.some((event) => event.type === "teacher_reviewed");
  const hasReflection = state.events.some((event) => event.type === "reflection_submitted");
  const closedLoopSignals = [hasCiPass, hasTeacherReview, hasReflection].filter(Boolean).length;
  const blockedActions = decisions.filter((decision) => decision.gate === "BLOCK").length;
  const estimatedUpliftPoints = Math.round(
    clamp(observedGrowth * 0.48 + strategyAdvantage * 0.32 + coverage * 10 + closedLoopSignals * 1.5, 0, 40),
  );
  const valueScore = Math.round(
    clamp(
      52 +
        observedGrowth * 0.58 +
        coverage * 13 +
        strategyAdvantage * 0.42 +
        researchEvidence.readinessScore * 0.1 +
        closedLoopSignals * 3,
      0,
      100,
    ),
  );
  const margin = Math.round(clamp(18 - coverage * 7 - closedLoopSignals * 2, 4, 16));
  const mode =
    coverage >= 0.72 && closedLoopSignals >= 3
      ? "增值评估 / 教师确认试点"
      : coverage >= 0.55
        ? "增值评估 / 影子运行"
        : "增值评估 / 待补证据";

  const dimensions: ValueDimension[] = competencyOrder.map((id) => {
    const baseline = Math.round(state.learner.baseline[id]);
    const current = Math.round(scores[id]);
    const growth = current - baseline;
    const evidenceCount = eventCountFor(state, id);
    const confidence = Math.round(clamp(48 + coverage * 26 + evidenceCount * 5 + (growth > 0 ? 6 : 0), 0, 96));
    return {
      id,
      label: competencyLabels[id],
      baseline,
      current,
      growth,
      evidenceCount,
      confidence,
      nextAction:
        growth >= 12
          ? "进入迁移复盘，沉淀为可复用工程模式。"
          : evidenceCount <= 1
            ? "补一条 Issue、PR、CI 或反思证据，避免低证据误判。"
            : "安排 mini lab 或教师复核，验证增值是否稳定。",
    };
  });

  const experimentCells: ValueExperimentCell[] = strategyLab.policyResults.map((policy) => ({
    id: policy.id,
    label: policy.label,
    expectedGain: Math.round(clamp(policy.learningGain - 50, 0, 45)),
    riskReduction: policy.riskInterception,
    teacherLoad:
      policy.id === "chat-only"
        ? "教师事后兜底"
        : policy.id === "static-path"
          ? "教师批量维护路径"
          : "教师只复核高风险项",
    evidence: policy.explanation,
    status: policy.id === strategyLab.winnerId ? "proved" : "shadow",
  }));
  experimentCells.push({
    id: "teacher-confirmed",
    label: "教师确认试点",
    expectedGain: Math.round(clamp(estimatedUpliftPoints - 4, 0, 40)),
    riskReduction: hasTeacherReview ? 88 : 70,
    teacherLoad: `${cohortOps.estimatedTeacherMinutesSaved} 分钟/轮可节省`,
    evidence: "只在教师确认后发布高风险干预，用真实课程数据验证阻塞解除时间和反思质量。",
    status: hasTeacherReview ? "proved" : "manual",
  });

  const metrics: ValueMetric[] = [
    {
      id: "competency-growth",
      label: "能力均值增量",
      value: `+${Math.round(observedGrowth)} 分`,
      target: "以 baseline 到当前 EvidenceEvent 得分变化为准",
      status: statusFor(observedGrowth > 0),
    },
    {
      id: "safevoi-uplift",
      label: "SafeVOI 策略优势",
      value: `+${strategyAdvantage} 分`,
      target: "对比普通聊天和固定路径的综合策略分",
      status: statusFor(strategyAdvantage > 0),
    },
    {
      id: "estimated-uplift",
      label: "可解释增值估计",
      value: `+${estimatedUpliftPoints} 分`,
      target: "融合能力增长、策略优势、证据覆盖和闭环信号",
      status: statusFor(coverage >= 0.55),
    },
    {
      id: "blocked-actions",
      label: "风险拦截",
      value: `${blockedActions} 项`,
      target: "低安全、低信息、不可逆行动不能自动发布",
      status: statusFor(blockedActions > 0),
    },
    {
      id: "teacher-efficiency",
      label: "教师运营节省",
      value: `${cohortOps.estimatedTeacherMinutesSaved} 分钟/轮`,
      target: "正式试点后由教师工单处理时长验证",
      status: "shadow",
    },
    {
      id: "research-readiness",
      label: "科研验证就绪",
      value: `${researchEvidence.readinessScore}`,
      target: "合成回放可验证，真实提分等待试点",
      status: statusFor(researchEvidence.readinessScore >= 80),
    },
  ];

  const claims: ValueClaim[] = [
    {
      id: "closed-loop-value",
      label: "可以声明",
      statement: "当前 Demo 能把 CI 失败、脚手架干预、教师复核和反思回写转化为可解释学习增值。",
      allowed: true,
      evidence: `${state.events.length} 条 EvidenceEvent，证据覆盖 ${Math.round(coverage * 100)}%。`,
      status: "proved",
    },
    {
      id: "strategy-value",
      label: "可以声明",
      statement: "在同一组合成事件回放下，SE-Path SafeVOI 闭环优于普通聊天和固定路径。",
      allowed: true,
      evidence: `策略领先 ${strategyAdvantage} 分，winner=${strategyLab.winnerLabel}。`,
      status: "proved",
    },
    {
      id: "teacher-efficiency",
      label: "谨慎声明",
      statement: "可以把教师节省时间作为试点假设和运营指标，不提前宣称已在真实课程中达成。",
      allowed: true,
      evidence: `当前班级运营估计 ${cohortOps.estimatedTeacherMinutesSaved} 分钟/轮。`,
      status: "shadow",
    },
    {
      id: "real-score-claim",
      label: "不可声明",
      statement: "不能宣称已经在真实学校数据中显著提分或形成长期因果效果。",
      allowed: false,
      evidence: "真实课程试点尚未接入，当前证据等级仍是合成样本回放和确定性测试。",
      status: "manual",
    },
  ];

  const measurementPlan: ValueStage[] = [
    {
      id: "baseline",
      label: "第 1 步：基线采集",
      owner: "teacher",
      gate: "每名学生至少有 baseline、任务、Rubric 和一条仓库证据",
      evidence: `${Math.round(coverage * 100)}% coverage`,
      status: statusFor(coverage >= 0.55),
    },
    {
      id: "shadow",
      label: "第 2 步：影子诊断",
      owner: "assistant",
      gate: "系统只生成诊断和建议，不自动推送给学生",
      evidence: researchEvidence.evidenceLevel,
      status: "proved",
    },
    {
      id: "teacher-confirmed",
      label: "第 3 步：教师确认干预",
      owner: "teacher",
      gate: "高风险、低证据、直接答案请求必须人工确认",
      evidence: hasTeacherReview ? "teacher_reviewed 已写入账本" : "等待教师复核证据",
      status: hasTeacherReview ? "proved" : "manual",
    },
    {
      id: "outcome",
      label: "第 4 步：增值复盘",
      owner: "school",
      gate: "只统计阻塞解除时间、反思质量、教师工时和证据覆盖",
      evidence: hasReflection ? "reflection_submitted 已写入账本" : "等待反思证据",
      status: hasReflection ? "proved" : "manual",
    },
  ];

  const telemetryContract = [
    "tenantId",
    "courseId",
    "learnerHash",
    "evidenceEvent.type",
    "traceId",
    "competencyImpacts",
    "safevoi_version",
    "decision.gate",
    "teacher_review.status",
    "reflection_quality_score",
  ];

  return {
    mode,
    valueScore,
    estimatedUpliftPoints,
    confidenceBand: `±${margin} 分`,
    summary:
      "学习增值评估中心把你的路径增值思想显性化：先用 EvidenceEvent 记录学习过程，再用能力增量、策略对照、风险拦截、教师工时和科研边界共同判断本轮干预是否真的有价值。",
    metrics,
    dimensions,
    experimentCells,
    claims,
    measurementPlan,
    telemetryContract,
    exportManifest: JSON.stringify(
      {
        valueModel: "sepath-uplift.v1",
        mode,
        estimatedUpliftPoints,
        confidenceBand: `±${margin}`,
        evidenceLevel: researchEvidence.evidenceLevel,
        forbiddenClaim: "no_real_course_causal_gain_until_trial",
      },
      null,
      2,
    ),
  };
}
