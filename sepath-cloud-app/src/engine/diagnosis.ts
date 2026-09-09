import type { CompetencyId, DiagnosisCard, EvidenceEvent, Learner } from "../domain/types";
import { evidenceCoverage, scoreCompetencies } from "./evidence";

const labels: Record<CompetencyId, string> = {
  requirements: "需求拆解",
  architecture: "模块设计",
  implementation: "编码实现",
  testing: "测试与质量",
  collaboration: "协作交付",
  reflection: "复盘迁移",
};

export function diagnoseLearner(learner: Learner, events: EvidenceEvent[]): DiagnosisCard {
  const scores = scoreCompetencies(learner.baseline, events);
  const sorted = Object.entries(scores).sort((a, b) => a[1] - b[1]) as [CompetencyId, number][];
  const [focusCompetency, score] = sorted[0];
  const failedCi = events.filter((event) => event.type === "ci_failed");
  const directAnswer = events.find((event) => event.detail.includes("完整") || event.detail.includes("直接"));
  const coverage = evidenceCoverage(events);
  const confidence = Math.min(
    0.95,
    0.46 + coverage * 0.32 + Math.min(events.length, 6) * 0.025 + (failedCi.length ? 0.08 : 0),
  );
  const risk = directAnswer || score < 45 ? "high" : failedCi.length ? "medium" : "low";
  const blocker =
    focusCompetency === "testing"
      ? "测试边界与异常路径建模不足"
      : focusCompetency === "requirements"
        ? "验收条件没有转化为可验证任务"
        : `${labels[focusCompetency]}能力需要补证据`;

  return {
    id: "diag-current",
    learnerId: learner.id,
    blocker,
    summary: `当前最低能力节点为“${labels[focusCompetency]}”（${Math.round(score)}分）。系统判断学生需要先把失败现象转为验收条件和测试清单，再进入代码修复。`,
    confidence,
    evidenceCoverage: coverage,
    risk,
    focusCompetency,
    evidenceEventIds: events.slice(-4).map((event) => event.id),
    reasonCodes: [
      failedCi.length ? "CI_FAILURE_AS_LEARNING_EVIDENCE" : "NO_RECENT_CI_FAILURE",
      directAnswer ? "DIRECT_ANSWER_REQUEST_DETECTED" : "SCAFFOLD_MODE_SAFE",
      coverage < 0.6 ? "EVIDENCE_COVERAGE_LOW" : "EVIDENCE_COVERAGE_OK",
    ],
  };
}
