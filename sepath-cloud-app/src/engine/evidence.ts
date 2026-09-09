import type { CompetencyId, EvidenceEvent } from "../domain/types";

export function scoreCompetencies(
  baseline: Record<CompetencyId, number>,
  events: EvidenceEvent[],
): Record<CompetencyId, number> {
  const scores = { ...baseline };
  for (const event of events) {
    for (const [competency, delta] of Object.entries(event.competencyImpacts)) {
      const key = competency as CompetencyId;
      scores[key] = Math.max(0, Math.min(100, scores[key] + Number(delta)));
    }
  }
  return scores;
}

export function evidenceCoverage(events: EvidenceEvent[]): number {
  const sources = new Set(events.map((event) => event.source));
  const hasEngineeringEvidence = sources.has("git") || sources.has("ci");
  const hasHumanEvidence = sources.has("chat") || sources.has("reflection") || sources.has("teacher");
  const sourceScore = Math.min(1, sources.size / 5);
  const depthScore = Math.min(1, events.length / 6);
  const diversityBonus = hasEngineeringEvidence && hasHumanEvidence ? 0.1 : 0;
  return Math.min(1, sourceScore * 0.55 + depthScore * 0.35 + diversityBonus);
}

export function latestEvents(events: EvidenceEvent[], count = 5): EvidenceEvent[] {
  return [...events]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, count);
}
