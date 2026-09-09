import type { AppState, CompetencyId } from "../domain/types";
import type { ApiContractReport } from "./apiContract";
import type { CohortOpsReport } from "./cohortOps";
import type { CourseAuthoringReport } from "./courseAuthoring";
import { evidenceCoverage, scoreCompetencies } from "./evidence";
import type { ModelOpsReport } from "./modelOps";
import type { PrivacyGuardReport } from "./privacyGuard";
import type { ResearchEvidenceReport } from "./researchEvidence";

export type TeacherReportStatus = "ready" | "watch" | "manual";

export interface TeacherReportMetric {
  id: string;
  label: string;
  value: string;
  target: string;
  status: TeacherReportStatus;
}

export interface TeacherReportLine {
  id: string;
  label: string;
  detail: string;
  evidence: string;
  status: TeacherReportStatus;
}

export interface TeacherReport {
  score: number;
  title: string;
  period: string;
  mode: string;
  summary: string;
  exportFileName: string;
  metrics: TeacherReportMetric[];
  learnerSnapshot: TeacherReportLine[];
  classSignals: TeacherReportLine[];
  actionPlan: TeacherReportLine[];
  riskControls: TeacherReportLine[];
  evidenceReferences: string[];
  markdown: string;
}

const competencyLabels: Record<CompetencyId, string> = {
  requirements: "需求分析",
  architecture: "架构边界",
  implementation: "实现能力",
  testing: "测试质量",
  collaboration: "协作交付",
  reflection: "反思迁移",
};

function weakestCompetency(scores: Record<CompetencyId, number>): CompetencyId {
  return (Object.entries(scores).sort((a, b) => a[1] - b[1])[0][0] ?? "testing") as CompetencyId;
}

function statusScore(status: TeacherReportStatus): number {
  if (status === "ready") return 1;
  if (status === "watch") return 0.72;
  return 0.44;
}

function metricStatus(condition: boolean, manual = false): TeacherReportStatus {
  if (manual) return "manual";
  return condition ? "ready" : "watch";
}

function renderSection(title: string, rows: TeacherReportLine[]): string {
  const body = rows.map((row, index) => `${index + 1}. ${row.label}：${row.detail}（证据：${row.evidence}）`);
  return [`## ${title}`, "", ...body, ""].join("\n");
}

function buildMarkdown(report: Omit<TeacherReport, "markdown">): string {
  return [
    `# ${report.title}`,
    "",
    `周期：${report.period}`,
    "",
    `模式：${report.mode}`,
    "",
    `摘要：${report.summary}`,
    "",
    "## 核心指标",
    "",
    ...report.metrics.map((metric) => `- ${metric.label}：${metric.value}；目标：${metric.target}`),
    "",
    renderSection("学生画像与本周阻塞", report.learnerSnapshot),
    renderSection("班级运营信号", report.classSignals),
    renderSection("下周行动计划", report.actionPlan),
    renderSection("AI 使用与数据风险边界", report.riskControls),
    "## 证据引用",
    "",
    ...report.evidenceReferences.map((item) => `- ${item}`),
    "",
    "## 真实性声明",
    "",
    "当前报告基于合成演示数据、确定性算法回放和可审计 EvidenceEvent 账本生成，不宣称已经完成真实课程提分验证。进入真实试点前必须补齐授权、访问策略和教师复核人。",
    "",
  ].join("\n");
}

export function buildTeacherReport(
  state: AppState,
  cohortOps: CohortOpsReport,
  courseAuthoring: CourseAuthoringReport,
  privacyGuard: PrivacyGuardReport,
  apiContract: ApiContractReport,
  modelOps: ModelOpsReport,
  researchEvidence: ResearchEvidenceReport,
): TeacherReport {
  const coverage = evidenceCoverage(state.events);
  const scores = scoreCompetencies(state.learner.baseline, state.events);
  const weakest = weakestCompetency(scores);
  const hasCiFailure = state.events.some((event) => event.type === "ci_failed");
  const hasCiPass = state.events.some((event) => event.type === "ci_passed");
  const hasTeacherReview = state.events.some((event) => event.type === "teacher_reviewed");
  const hasReflection = state.events.some((event) => event.type === "reflection_submitted");
  const directAnswerGate = courseAuthoring.aiPolicies.some((policy) => policy.id === "DIRECT_ANSWER_POLICY_GATE");
  const manualCount = courseAuthoring.manualCount + modelOps.manualCount + apiContract.manualCount;

  const metrics: TeacherReportMetric[] = [
    {
      id: "evidence-coverage",
      label: "证据覆盖率",
      value: `${Math.round(coverage * 100)}%`,
      target: ">=70% 可进入教师确认干预",
      status: metricStatus(coverage >= 0.7),
    },
    {
      id: "cohort-risk",
      label: "班级高风险人数",
      value: `${cohortOps.highRiskCount}/${cohortOps.learnerCount}`,
      target: "P0 学生当天进入 mini lab 或教师复核",
      status: metricStatus(cohortOps.highRiskCount <= 1),
    },
    {
      id: "course-config",
      label: "课程配置就绪度",
      value: `${courseAuthoring.score}`,
      target: "Rubric、作业模板和 AI 边界可迁移",
      status: metricStatus(courseAuthoring.score >= 80, courseAuthoring.manualCount > 2),
    },
    {
      id: "privacy-gate",
      label: "隐私发布门",
      value: privacyGuard.gate,
      target: "公开试用不包含真实学生隐私",
      status: metricStatus(privacyGuard.gate === "pass", privacyGuard.gate === "block"),
    },
    {
      id: "modelops",
      label: "模型治理分",
      value: `${modelOps.score}`,
      target: "发布门、实验协议和漂移监控可见",
      status: metricStatus(modelOps.score >= 75),
    },
  ];

  const learnerSnapshot: TeacherReportLine[] = [
    {
      id: "weakest",
      label: "当前最弱能力",
      detail: `${competencyLabels[weakest]}，当前分 ${Math.round(scores[weakest])}，需要用 PR/CI/反思继续补证据。`,
      evidence: `${state.events.length} 条 EvidenceEvent`,
      status: "watch",
    },
    {
      id: "ci-loop",
      label: "工程闭环",
      detail: hasCiFailure && hasCiPass ? "已从 CI 失败走到 CI 通过，可以进入复盘和迁移。" : "CI 证据仍不完整，建议先补失败用例或修复证据。",
      evidence: hasCiFailure && hasCiPass ? "ci_failed + ci_passed" : "CI evidence pending",
      status: hasCiFailure && hasCiPass ? "ready" : "watch",
    },
    {
      id: "reflection",
      label: "反思记忆",
      detail: hasReflection ? "已有反思事件，可用于下轮路径调整。" : "缺少反思事件，下周应补一次失败到修复的复盘卡片。",
      evidence: hasReflection ? "reflection_submitted" : "reflection pending",
      status: hasReflection ? "ready" : "watch",
    },
  ];

  const classSignals: TeacherReportLine[] = [
    {
      id: "growthops",
      label: "班级 GrowthOps 队列",
      detail: cohortOps.actions.map((action) => `${action.priority}-${action.label}`).join("；"),
      evidence: `${cohortOps.learnerCount} 名学习者快照`,
      status: cohortOps.highRiskCount > 0 ? "watch" : "ready",
    },
    {
      id: "rubric",
      label: "Rubric 可迁移性",
      detail: `课程包包含 ${courseAuthoring.rubrics.length} 项能力 Rubric 和 ${courseAuthoring.assignments.length} 个作业模板。`,
      evidence: courseAuthoring.courseVersion,
      status: courseAuthoring.score >= 80 ? "ready" : "watch",
    },
    {
      id: "research",
      label: "科研验证边界",
      detail: `${researchEvidence.evidenceLevel}，当前只声明合成样本回放和确定性测试。`,
      evidence: `readiness=${researchEvidence.readinessScore}`,
      status: "ready",
    },
  ];

  const actionPlan: TeacherReportLine[] = [
    {
      id: "mini-lab",
      label: "安排 CI Recovery Lab",
      detail: "让高风险学生从失败日志中定位异常路径，补一条最小失败用例，再提交可回滚修复。",
      evidence: courseAuthoring.assignments.find((assignment) => assignment.id === "ci-recovery-lab")?.label ?? "CI Recovery Lab",
      status: "ready",
    },
    {
      id: "teacher-review",
      label: "复核 AI 使用边界",
      detail: hasTeacherReview ? "教师复核已经进入证据链，下周可抽检同类建议。" : "配置主备复核人，所有高风险建议先走教师发布门。",
      evidence: hasTeacherReview ? "teacher_reviewed" : "teacher-reviewers checklist",
      status: hasTeacherReview ? "ready" : "watch",
    },
    {
      id: "rubric-calibration",
      label: "校准 Rubric 样例",
      detail: "选取一条优秀 PR 和一条失败 PR，按六项能力 Rubric 做课堂讲评。",
      evidence: `${courseAuthoring.rubrics.length} rubric items`,
      status: "ready",
    },
    {
      id: "manual-gates",
      label: "补齐上线人工项",
      detail: manualCount > 0 ? `仍有 ${manualCount} 个配置/治理人工项，真实试点前不得自动干预。` : "配置项已可进入小班试点。",
      evidence: "courseAuthoring + apiContract + modelOps",
      status: manualCount > 0 ? "manual" : "ready",
    },
  ];

  const riskControls: TeacherReportLine[] = [
    {
      id: "no-substitution",
      label: "不替写作业",
      detail: directAnswerGate ? "直接答案请求会被改写为脚手架、检查清单和教师复核。" : "需要补充直接答案拦截策略。",
      evidence: "DIRECT_ANSWER_POLICY_GATE",
      status: directAnswerGate ? "ready" : "manual",
    },
    {
      id: "privacy",
      label: "脱敏与最小化",
      detail: privacyGuard.summary,
      evidence: `${privacyGuard.piiFindings} PII findings`,
      status: privacyGuard.gate === "pass" ? "ready" : "manual",
    },
    {
      id: "api-boundary",
      label: "真实系统接入边界",
      detail: `当前定义 ${apiContract.endpoints.length} 个 API 和 ${apiContract.webhooks.length} 类 Webhook，生产密钥不进入提交包。`,
      evidence: apiContract.mode,
      status: apiContract.score >= 80 ? "ready" : "watch",
    },
  ];

  const allStatuses = [
    ...metrics.map((metric) => metric.status),
    ...learnerSnapshot.map((line) => line.status),
    ...classSignals.map((line) => line.status),
    ...actionPlan.map((line) => line.status),
    ...riskControls.map((line) => line.status),
  ];
  const score = Math.round((allStatuses.reduce((total, status) => total + statusScore(status), 0) / allStatuses.length) * 100);

  const reportWithoutMarkdown: Omit<TeacherReport, "markdown"> = {
    score,
    title: "SE-Path 学伴教师周报与试点复盘",
    period: "Demo Week / 课程影子运行模板",
    mode: manualCount > 0 ? "教师确认 / 影子运行" : "小班试点准备",
    summary:
      "本报告把学生证据、班级 GrowthOps、课程 Rubric、AI 边界、隐私治理和模型发布门汇总为教师可直接带走的复盘材料。",
    exportFileName: "sepath-teacher-weekly-report.md",
    metrics,
    learnerSnapshot,
    classSignals,
    actionPlan,
    riskControls,
    evidenceReferences: [
      `EvidenceEvent: ${state.events.length} 条`,
      `Course Manifest: ${courseAuthoring.courseVersion}`,
      `API Contract: ${apiContract.mode}`,
      `ModelOps: ${modelOps.modelVersion}`,
      `Privacy Gate: ${privacyGuard.gate}`,
    ],
  };

  return {
    ...reportWithoutMarkdown,
    markdown: buildMarkdown(reportWithoutMarkdown),
  };
}
