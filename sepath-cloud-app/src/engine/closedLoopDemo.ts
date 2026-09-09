import { demoEventTemplates } from "../data/seed";
import type {
  AppState,
  DiagnosisCard,
  EventType,
  PathNodeState,
  ReviewTicket,
  ScaffoldMessage,
  TaskDecision,
} from "../domain/types";
import { evidenceCoverage } from "./evidence";
import type { TeacherReport } from "./teacherReport";
import type { ValueUpliftReport } from "./valueUplift";

export type ClosedLoopStepStatus = "done" | "active" | "queued";
export type ClosedLoopCheckStatus = "ready" | "watch";

export interface ClosedLoopDemoStep {
  id: string;
  label: string;
  role: "student" | "agent" | "teacher" | "tool";
  expectedType: EventType;
  anchor: string;
  status: ClosedLoopStepStatus;
  evidence: string;
  traceId: string;
}

export interface ClosedLoopDemoCheck {
  id: string;
  label: string;
  status: ClosedLoopCheckStatus;
  evidence: string;
}

export interface ClosedLoopDemoReport {
  runtime: "sepath-closed-loop-demo.v1";
  status: "closed" | "running";
  progress: number;
  completedSteps: number;
  totalSteps: number;
  nextStep: ClosedLoopDemoStep | null;
  steps: ClosedLoopDemoStep[];
  checks: ClosedLoopDemoCheck[];
  headline: string;
  nextAction: string;
  eventCount: number;
  exportReady: boolean;
}

interface ClosedLoopDemoInput {
  state: AppState;
  diagnosis: DiagnosisCard;
  decisions: TaskDecision[];
  scaffold: ScaffoldMessage;
  reviewTicket: ReviewTicket;
  pathNodes: PathNodeState[];
  teacherReport: TeacherReport;
  valueUplift: ValueUpliftReport;
}

const stepConfig = [
  { id: "diagnose-ci-failure", label: "学情诊断：读取失败 PR/CI", role: "tool", anchor: "#student" },
  { id: "safe-answer-gate", label: "安全门禁：拦截完整代码请求", role: "agent", anchor: "#dialogue" },
  { id: "publish-scaffold", label: "实时干预：发布脚手架行动", role: "agent", anchor: "#intervention-playbook" },
  { id: "verify-fix", label: "验证修复：CI 通过写回证据", role: "tool", anchor: "#repository" },
  { id: "teacher-review", label: "教师复核：确认可发布", role: "teacher", anchor: "#teacher-report" },
  { id: "memory-reflection", label: "记忆反思：沉淀迁移策略", role: "student", anchor: "#value" },
] as const;

function findEvent(state: AppState, index: number) {
  const template = demoEventTemplates[index];
  return state.events.find((event) => event.id === template.id || event.type === template.type);
}

function checkStatus(condition: boolean): ClosedLoopCheckStatus {
  return condition ? "ready" : "watch";
}

export function buildClosedLoopDemoReport(input: ClosedLoopDemoInput): ClosedLoopDemoReport {
  const { state, diagnosis, decisions, scaffold, reviewTicket, pathNodes, teacherReport, valueUplift } = input;
  const firstMissingIndex = stepConfig.findIndex((_, index) => !findEvent(state, index));
  const activeIndex = firstMissingIndex === -1 ? -1 : firstMissingIndex;
  const coverage = evidenceCoverage(state.events);
  const passDecisions = decisions.filter((decision) => decision.gate === "PASS");
  const blockedDecisions = decisions.filter((decision) => decision.gate === "BLOCK");

  const steps: ClosedLoopDemoStep[] = stepConfig.map((step, index) => {
    const event = findEvent(state, index);
    const template = demoEventTemplates[index];
    return {
      id: step.id,
      label: step.label,
      role: step.role,
      expectedType: template.type,
      anchor: step.anchor,
      status: event ? "done" : index === activeIndex ? "active" : "queued",
      evidence: event ? event.title : `等待 ${template.title}`,
      traceId: event?.traceId ?? template.traceId,
    };
  });

  const completedSteps = steps.filter((step) => step.status === "done").length;
  const allCompleted = completedSteps === steps.length;
  const checks: ClosedLoopDemoCheck[] = [
    {
      id: "diagnosis",
      label: "诊断可信",
      status: checkStatus(diagnosis.confidence >= 0.66 && diagnosis.evidenceEventIds.length >= 3),
      evidence: `${Math.round(diagnosis.confidence * 100)}% / ${diagnosis.reasonCodes.join("、")}`,
    },
    {
      id: "safevoi",
      label: "SafeVOI 已排序",
      status: checkStatus(passDecisions.length > 0 && blockedDecisions.length > 0),
      evidence: `${passDecisions.length} 个可发布行动，${blockedDecisions.length} 个被门禁拦截`,
    },
    {
      id: "scaffold",
      label: "脚手架不替写",
      status: checkStatus(scaffold.refusesDirectAnswer && reviewTicket.action === "human_review"),
      evidence: `${scaffold.title} / ${reviewTicket.action}`,
    },
    {
      id: "path-twin",
      label: "路径数字孪生更新",
      status: checkStatus(pathNodes.some((node) => node.status === "completed") && pathNodes.length >= 6),
      evidence: `${pathNodes.filter((node) => node.status === "completed").length}/${pathNodes.length} 个节点完成`,
    },
    {
      id: "teacher-gate",
      label: "教师复核已入账",
      status: checkStatus(state.events.some((event) => event.type === "teacher_reviewed") && teacherReport.score >= 75),
      evidence: `teacherReport=${teacherReport.score}`,
    },
    {
      id: "value-memory",
      label: "增值与记忆可解释",
      status: checkStatus(allCompleted && valueUplift.valueScore >= 75 && coverage >= 0.7),
      evidence: `value=${valueUplift.valueScore} / coverage=${Math.round(coverage * 100)}%`,
    },
  ];
  const readyChecks = checks.filter((check) => check.status === "ready").length;
  const nextStep = steps.find((step) => step.status === "active") ?? null;
  const progress = Math.round((completedSteps / steps.length) * 100);

  return {
    runtime: "sepath-closed-loop-demo.v1",
    status: allCompleted ? "closed" : "running",
    progress,
    completedSteps,
    totalSteps: steps.length,
    nextStep,
    steps,
    checks,
    headline: allCompleted
      ? "闭环已跑通：诊断、干预、复核、反思和增值证据都已写回。"
      : `下一步：${nextStep?.label ?? "等待证据写回"}`,
    nextAction: allCompleted ? "可以导出证据账本或进入教师复核视图。" : (nextStep?.evidence ?? "推进下一条证据"),
    eventCount: state.events.length,
    exportReady: allCompleted && readyChecks >= checks.length - 1,
  };
}
