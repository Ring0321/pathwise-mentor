import type { AppState, ObservabilityTrace } from "../domain/types";

export function buildTraces(state: AppState): ObservabilityTrace[] {
  const latest = state.events.slice(-5);
  return latest.map((event, index) => ({
    id: event.traceId,
    span:
      event.type === "ci_failed"
        ? "diagnosis.ci_failure_mapper"
        : event.type === "scaffold_delivered"
          ? "agent.scaffold.generate"
          : event.type === "teacher_reviewed"
            ? "human_review.ticket.close"
            : "ledger.event.append",
    model: event.actor === "system" ? "LLM-orchestrated" : "deterministic",
    tool: event.source,
    latencyMs: 120 + index * 37,
    tokenCost: event.actor === "system" ? 860 + index * 95 : 0,
    qualityGate: event.risk === "high" ? "warn" : "pass",
  }));
}
