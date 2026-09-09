import type {
  AppState,
  CompetencyId,
  DiagnosisCard,
  KnowledgeBoundaryReport,
  KnowledgeSource,
  MatchedKnowledgeSource,
} from "../domain/types";

const competencyLabels: Record<CompetencyId, string> = {
  requirements: "需求拆解",
  architecture: "模块设计",
  implementation: "编码实现",
  testing: "测试质量",
  collaboration: "协作交付",
  reflection: "复盘迁移",
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function intersects(left: CompetencyId[], right: Set<CompetencyId>): boolean {
  return left.some((item) => right.has(item));
}

function eventSignalFor(source: KnowledgeSource, state: AppState): number {
  const sources = new Set(state.events.map((event) => event.source));
  if (source.kind === "code_evidence" && (sources.has("ci") || sources.has("git"))) {
    return 0.16;
  }
  if (source.kind === "reflection" && sources.has("reflection")) {
    return 0.12;
  }
  if (source.kind === "policy" && sources.has("chat")) {
    return 0.1;
  }
  if (source.kind === "rubric" && sources.has("baseline")) {
    return 0.08;
  }
  return 0;
}

function riskSignalFor(source: KnowledgeSource, diagnosis: DiagnosisCard): number {
  if (diagnosis.risk === "high" && source.kind === "policy") {
    return 0.18;
  }
  if (diagnosis.risk !== "low" && source.kind === "rubric") {
    return 0.08;
  }
  return 0;
}

export function buildKnowledgeBoundaryReport(
  state: AppState,
  diagnosis: DiagnosisCard,
  sources: KnowledgeSource[],
): KnowledgeBoundaryReport {
  const activeCompetencies = new Set<CompetencyId>([
    ...state.task.competencyIds,
    diagnosis.focusCompetency,
  ]);
  const maxFreshnessDays = Math.max(...sources.map((source) => source.freshnessDays), 1);

  const matchedSources = sources
    .map<MatchedKnowledgeSource>((source) => {
      const competencySignal = intersects(source.competencyIds, activeCompetencies) ? 0.2 : 0;
      const freshnessSignal = 0.1 * (1 - source.freshnessDays / (maxFreshnessDays + 1));
      const matchScore = clamp01(
        source.trustWeight * 0.5 +
          competencySignal +
          freshnessSignal +
          eventSignalFor(source, state) +
          riskSignalFor(source, diagnosis),
      );
      const matchedCompetencies = source.competencyIds
        .filter((id) => activeCompetencies.has(id))
        .map((id) => competencyLabels[id])
        .join("、");

      return {
        ...source,
        matchScore,
        matchReason: matchedCompetencies
          ? `命中当前任务能力：${matchedCompetencies}`
          : "作为低权重背景资料保留",
      };
    })
    .filter((source) => source.matchScore >= 0.58)
    .sort((a, b) => b.matchScore - a.matchScore);

  const coveredCompetencies = new Set<CompetencyId>();
  for (const source of matchedSources) {
    for (const competencyId of source.competencyIds) {
      if (activeCompetencies.has(competencyId)) {
        coveredCompetencies.add(competencyId);
      }
    }
  }

  const missingCompetencyIds = [...activeCompetencies].filter(
    (competencyId) => !coveredCompetencies.has(competencyId),
  );
  const retrievalCoverage = activeCompetencies.size
    ? coveredCompetencies.size / activeCompetencies.size
    : 1;

  const ruleHits = [
    "COURSE_RUBRIC_BOUNDARY",
    diagnosis.risk === "high" ? "DIRECT_ANSWER_POLICY_GATE" : "SCAFFOLD_FIRST_POLICY",
    retrievalCoverage < 0.75 ? "INSUFFICIENT_EVIDENCE_REVIEW" : "EVIDENCE_COVERAGE_OK",
    state.learner.consentValid ? "CONSENT_VALID" : "CONSENT_REQUIRED",
  ];

  return {
    retrievalCoverage,
    matchedSources,
    missingCompetencyIds,
    ruleHits,
    allowedResponse:
      "可以输出错误复现思路、异常路径检查清单、mini lab、PR 描述模板和教师可复核建议。",
    blockedResponse:
      "禁止直接生成可提交的完整 service 层代码、绕过测试的补丁、或基于缺证据的能力结论。",
    teacherReviewRequired:
      diagnosis.risk === "high" || retrievalCoverage < 0.75 || !state.learner.consentValid,
  };
}
