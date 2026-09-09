import type { DiagnosisCard, Learner, TaskCandidate, TaskDecision } from "../domain/types";

const policy = {
  growthWeight: 0.3,
  informationWeight: 0.25,
  transferabilityWeight: 0.2,
  windowWeight: 0.15,
  burdenWeight: 0.1,
  riskWeight: 0.15,
  paidMinimumInformation: 5,
};

function rawValue(candidate: TaskCandidate): number {
  return (
    policy.growthWeight * candidate.expectedGrowth +
    policy.informationWeight * candidate.informationGain +
    policy.transferabilityWeight * candidate.transferability +
    policy.windowWeight * candidate.windowRescue -
    policy.burdenWeight * candidate.burden -
    policy.riskWeight * candidate.risk
  );
}

function lowerCostDominates(candidate: TaskCandidate, alternatives: TaskCandidate[]): boolean {
  return alternatives.some((alternative) => {
    if (alternative.taskId === candidate.taskId) return false;
    const noMoreCostly =
      alternative.monetaryCost <= candidate.monetaryCost &&
      alternative.estimatedHours <= candidate.estimatedHours;
    const noLessInformative = alternative.informationGain >= candidate.informationGain;
    const strictlyBetter =
      alternative.monetaryCost < candidate.monetaryCost ||
      alternative.estimatedHours < candidate.estimatedHours ||
      alternative.informationGain > candidate.informationGain;
    return noMoreCostly && noLessInformative && strictlyBetter;
  });
}

export function buildCandidates(learner: Learner, diagnosis: DiagnosisCard): TaskCandidate[] {
  const risk = diagnosis.risk === "high" ? 8 : diagnosis.risk === "medium" ? 5 : 2;
  return [
    {
      taskId: "action-checklist",
      label: "先完成异常路径检查清单",
      expectedGrowth: 7,
      informationGain: 8,
      transferability: 8,
      windowRescue: 7,
      burden: 2,
      risk: 1,
      estimatedHours: 0.5,
      monetaryCost: 0,
      consentValid: learner.consentValid,
      rulesValid: true,
      reversible: true,
      highStakes: false,
      paidService: false,
    },
    {
      taskId: "action-mini-lab",
      label: "插入 20 分钟边界测试 mini lab",
      expectedGrowth: 8,
      informationGain: 6,
      transferability: 7,
      windowRescue: 6,
      burden: 4,
      risk: 2,
      estimatedHours: 0.8,
      monetaryCost: 0,
      consentValid: learner.consentValid,
      rulesValid: true,
      reversible: true,
      highStakes: false,
      paidService: false,
    },
    {
      taskId: "action-teacher-review",
      label: "教师复核后推送具体改写建议",
      expectedGrowth: 6,
      informationGain: 5,
      transferability: 5,
      windowRescue: 8,
      burden: 5,
      risk,
      estimatedHours: 0.3,
      monetaryCost: 0,
      consentValid: learner.consentValid,
      rulesValid: true,
      reversible: true,
      highStakes: diagnosis.risk === "high",
      paidService: false,
    },
    {
      taskId: "action-paid-mentor",
      label: "付费导师一对一排查",
      expectedGrowth: 7,
      informationGain: 3,
      transferability: 5,
      windowRescue: 7,
      burden: 8,
      risk: 4,
      estimatedHours: 1,
      monetaryCost: 120,
      consentValid: learner.consentValid,
      rulesValid: true,
      reversible: false,
      highStakes: false,
      paidService: true,
    },
  ];
}

export function rankTasks(candidates: TaskCandidate[]): TaskDecision[] {
  const decisions = candidates.map((candidate) => {
    const reasons: string[] = [];
    if (!candidate.consentValid) reasons.push("CONSENT_INVALID");
    if (!candidate.rulesValid) reasons.push("KNOWLEDGE_RULE_INVALID");
    if (!candidate.reversible) reasons.push("ACTION_NOT_REVERSIBLE");
    if (candidate.highStakes) reasons.push("HIGH_STAKES_REQUIRES_HUMAN");
    if (candidate.paidService && candidate.informationGain < policy.paidMinimumInformation) {
      reasons.push("PAID_ACTION_LOW_INFORMATION");
    }
    if (candidate.paidService && lowerCostDominates(candidate, candidates)) {
      reasons.push("LOWER_COST_INFORMATION_DOMINATES");
    }
    const value = rawValue(candidate);
    return {
      taskId: candidate.taskId,
      label: candidate.label,
      gate: reasons.length ? "BLOCK" : "PASS",
      rawValue: value,
      publishableValue: reasons.length ? null : value,
      reasonCodes: reasons.length ? reasons : ["SAFE_BASELINE_PASSED"],
      rank: null,
    } satisfies TaskDecision;
  });
  const passed = decisions
    .filter((decision) => decision.gate === "PASS")
    .sort((a, b) => b.rawValue - a.rawValue)
    .map((decision, index) => ({ ...decision, rank: index + 1 }));
  const blocked = decisions
    .filter((decision) => decision.gate === "BLOCK")
    .sort((a, b) => b.rawValue - a.rawValue);
  return [...passed, ...blocked];
}
