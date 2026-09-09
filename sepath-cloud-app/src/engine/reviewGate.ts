import type { DiagnosisCard, GateAction, ReviewTicket } from "../domain/types";

export function evaluatePublication(diagnosis: DiagnosisCard): ReviewTicket {
  const reasons: string[] = [];
  const actions: string[] = [];
  let action: GateAction = "publish";

  if (diagnosis.evidenceCoverage < 0.6) {
    reasons.push("EVIDENCE_COVERAGE_INSUFFICIENT");
    actions.push("继续采集 PR、CI、反思或教师观察证据");
    action = "defer";
  }
  if (diagnosis.confidence < 0.68) {
    reasons.push("UNCERTAINTY_TOO_WIDE");
    actions.push("进入影子运行，不直接推送强建议");
    action = "defer";
  }
  if (diagnosis.risk === "high") {
    reasons.push("HIGH_STAKES_OR_DIRECT_ANSWER_RISK");
    actions.push("创建教师复核工单，确认不会替写作业");
    action = "human_review";
  }
  if (diagnosis.reasonCodes.includes("DIRECT_ANSWER_REQUEST_DETECTED")) {
    reasons.push("ACADEMIC_INTEGRITY_REVIEW_REQUIRED");
    actions.push("只允许推送脚手架提示，不允许输出完整答案");
    action = "human_review";
  }

  return {
    id: "ticket-current",
    status: action === "publish" ? "approved" : "triaged",
    severity: diagnosis.risk,
    title: action === "publish" ? "建议可直接推送" : "需要教师复核后推送",
    reason: reasons.length ? reasons.join(" / ") : "全部发布门通过",
    evidenceEventIds: diagnosis.evidenceEventIds,
    action,
    requiredActions: actions,
  };
}
