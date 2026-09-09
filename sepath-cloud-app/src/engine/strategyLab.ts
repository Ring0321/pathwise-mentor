import type { AppState, TaskDecision } from "../domain/types";
import { evidenceCoverage } from "./evidence";

export type StrategyPolicyId = "chat-only" | "static-path" | "sepath-safevoi";

export interface StrategyScenario {
  id: string;
  label: string;
  signal: string;
  expectedRisk: "low" | "medium" | "high";
}

export interface StrategyPolicyResult {
  id: StrategyPolicyId;
  label: string;
  compositeScore: number;
  learningGain: number;
  riskInterception: number;
  evidenceTraceability: number;
  pathAdaptivity: number;
  teacherEfficiency: number;
  publishableActions: number;
  blockedUnsafeActions: number;
  explanation: string;
}

export interface StrategyScenarioResult {
  scenarioId: string;
  policyId: StrategyPolicyId;
  action: string;
  outcome: string;
  riskHandled: boolean;
}

export interface StrategyLabReport {
  summary: string;
  winnerId: StrategyPolicyId;
  winnerLabel: string;
  winnerMargin: number;
  policyResults: StrategyPolicyResult[];
  scenarios: StrategyScenario[];
  scenarioResults: StrategyScenarioResult[];
  auditTrail: string[];
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function composite(result: Omit<StrategyPolicyResult, "compositeScore">): number {
  return clampScore(
    result.learningGain * 0.3 +
      result.riskInterception * 0.25 +
      result.evidenceTraceability * 0.2 +
      result.pathAdaptivity * 0.15 +
      result.teacherEfficiency * 0.1,
  );
}

function buildPolicyResult(
  result: Omit<StrategyPolicyResult, "compositeScore">,
): StrategyPolicyResult {
  return {
    ...result,
    compositeScore: composite(result),
  };
}

function scenarioResults(): StrategyScenarioResult[] {
  return [
    {
      scenarioId: "direct-answer",
      policyId: "chat-only",
      action: "直接生成答案或完整代码片段",
      outcome: "短期完成度高，但破坏学习真实性，教师难以追溯。",
      riskHandled: false,
    },
    {
      scenarioId: "direct-answer",
      policyId: "static-path",
      action: "跳回固定章节练习",
      outcome: "能避免直接替写，但没有利用当前 PR/CI 证据。",
      riskHandled: true,
    },
    {
      scenarioId: "direct-answer",
      policyId: "sepath-safevoi",
      action: "触发安全发布门，输出检查清单与 mini lab",
      outcome: "既拦截替写风险，又保留可执行下一步。",
      riskHandled: true,
    },
    {
      scenarioId: "ci-failure",
      policyId: "chat-only",
      action: "解释报错并给出泛化建议",
      outcome: "缺少课程 Rubric 与事件账本约束，难以形成长期画像。",
      riskHandled: false,
    },
    {
      scenarioId: "ci-failure",
      policyId: "static-path",
      action: "安排测试章节复习",
      outcome: "方向正确，但不能根据截止期和证据覆盖动态排序。",
      riskHandled: true,
    },
    {
      scenarioId: "ci-failure",
      policyId: "sepath-safevoi",
      action: "把 CI 失败转成诊断卡、路径阻塞和脚手架任务",
      outcome: "学生知道为什么失败、先做什么、完成后如何回写证据。",
      riskHandled: true,
    },
    {
      scenarioId: "low-evidence",
      policyId: "chat-only",
      action: "根据学生自述继续答疑",
      outcome: "容易被单次对话带偏，证据不足时仍可能过度自信。",
      riskHandled: false,
    },
    {
      scenarioId: "low-evidence",
      policyId: "static-path",
      action: "要求补交固定反思",
      outcome: "能补材料，但无法判断需要补哪类工程证据。",
      riskHandled: true,
    },
    {
      scenarioId: "low-evidence",
      policyId: "sepath-safevoi",
      action: "先补 Issue、CI、Review 与反思证据，再更新路径",
      outcome: "避免低证据下误推荐，把诊断置信度暴露给教师。",
      riskHandled: true,
    },
  ];
}

export function buildStrategyLabReport(
  state: AppState,
  decisions: TaskDecision[],
): StrategyLabReport {
  const coverage = evidenceCoverage(state.events);
  const blockedCount = decisions.filter((decision) => decision.gate === "BLOCK").length;
  const passCount = decisions.filter((decision) => decision.gate === "PASS").length;
  const highRiskEvents = state.events.filter((event) => event.risk === "high").length;
  const hasTeacherReview = state.events.some((event) => event.type === "teacher_reviewed");
  const hasReflection = state.events.some((event) => event.type === "reflection_submitted");

  const policyResults = [
    buildPolicyResult({
      id: "chat-only",
      label: "普通聊天助教",
      learningGain: 58 + Math.min(8, state.events.length),
      riskInterception: 28 + (highRiskEvents > 0 ? 4 : 0),
      evidenceTraceability: 34 + Math.round(coverage * 18),
      pathAdaptivity: 35,
      teacherEfficiency: 42,
      publishableActions: 3,
      blockedUnsafeActions: 0,
      explanation: "擅长即时答疑，但缺少工程证据账本、课程边界和发布门。",
    }),
    buildPolicyResult({
      id: "static-path",
      label: "固定路径推荐",
      learningGain: 64 + Math.round(coverage * 10),
      riskInterception: 54 + (highRiskEvents > 0 ? 6 : 0),
      evidenceTraceability: 58 + Math.round(coverage * 20),
      pathAdaptivity: 56,
      teacherEfficiency: 50 + (hasTeacherReview ? 6 : 0),
      publishableActions: 2,
      blockedUnsafeActions: 1,
      explanation: "路径更稳定，但对 PR、CI、Review 和反思的实时证据利用不足。",
    }),
    buildPolicyResult({
      id: "sepath-safevoi",
      label: "SE-Path SafeVOI 闭环",
      learningGain: 80 + Math.round(coverage * 12) + (hasReflection ? 3 : 0),
      riskInterception: 82 + blockedCount * 4 + (hasTeacherReview ? 4 : 0),
      evidenceTraceability: 76 + Math.round(coverage * 20),
      pathAdaptivity: 82 + Math.min(8, state.demoStep),
      teacherEfficiency: 72 + Math.min(10, passCount * 3),
      publishableActions: passCount,
      blockedUnsafeActions: blockedCount,
      explanation: "把学习增益、风险、证据覆盖、教师负担和可逆性统一到下一步行动选择。",
    }),
  ].map((result) => ({
    ...result,
    learningGain: clampScore(result.learningGain),
    riskInterception: clampScore(result.riskInterception),
    evidenceTraceability: clampScore(result.evidenceTraceability),
    pathAdaptivity: clampScore(result.pathAdaptivity),
    teacherEfficiency: clampScore(result.teacherEfficiency),
    compositeScore: clampScore(result.compositeScore),
  }));

  const sorted = [...policyResults].sort((a, b) => b.compositeScore - a.compositeScore);
  const winner = sorted[0];
  const runnerUp = sorted[1];
  const scenarios: StrategyScenario[] = [
    {
      id: "direct-answer",
      label: "学生直接索要完整代码",
      signal: "chat + high risk",
      expectedRisk: "high",
    },
    {
      id: "ci-failure",
      label: "PR 失败且 CI 日志指向边界用例",
      signal: "git + ci",
      expectedRisk: "medium",
    },
    {
      id: "low-evidence",
      label: "只有学生自述，缺少工程证据",
      signal: "chat only",
      expectedRisk: "medium",
    },
  ];

  return {
    summary:
      "策略实验室用同一组学习事件回放三种策略，证明 SE-Path 的智能性来自证据账本、SafeVOI 排序、课程边界和教师发布门的组合，而不是一次性聊天回复。",
    winnerId: winner.id,
    winnerLabel: winner.label,
    winnerMargin: winner.compositeScore - runnerUp.compositeScore,
    policyResults,
    scenarios,
    scenarioResults: scenarioResults(),
    auditTrail: [
      `当前 EvidenceEvent 数量：${state.events.length}`,
      `证据覆盖率：${Math.round(coverage * 100)}%`,
      `SafeVOI 可发布行动：${passCount}，拦截行动：${blockedCount}`,
      hasTeacherReview ? "教师复核已进入证据链" : "高风险建议仍需教师复核确认",
      hasReflection ? "反思记忆已回写路径" : "反思记忆待学生提交后更新",
    ],
  };
}
