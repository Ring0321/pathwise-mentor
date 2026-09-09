import type { AppState, CompetencyId, EventType, EvidenceEvent, RiskLevel } from "../domain/types";
import { mergeEvidenceEvents } from "./eventIngestion";

export type LedgerImportStatus = "merged" | "duplicate" | "rejected";

export interface LedgerImportResult {
  status: LedgerImportStatus;
  message: string;
  importedEvents: number;
  skippedEvents: number;
  invalidEvents: number;
  state: AppState | null;
  warnings: string[];
}

const eventTypes = new Set<EventType>([
  "baseline",
  "task_started",
  "issue_created",
  "commit_pushed",
  "pr_opened",
  "ci_failed",
  "ci_passed",
  "conversation",
  "scaffold_delivered",
  "teacher_reviewed",
  "reflection_submitted",
]);

const sources = new Set<EvidenceEvent["source"]>(["baseline", "git", "ci", "chat", "teacher", "reflection"]);
const actors = new Set<EvidenceEvent["actor"]>(["student", "system", "teacher", "tool"]);
const risks = new Set<RiskLevel>(["low", "medium", "high"]);
const competencies = new Set<CompetencyId>([
  "requirements",
  "architecture",
  "implementation",
  "testing",
  "collaboration",
  "reflection",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function cleanNumber(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function inferActor(source: EvidenceEvent["source"]): EvidenceEvent["actor"] {
  if (source === "teacher") return "teacher";
  if (source === "git" || source === "ci") return "tool";
  if (source === "chat" || source === "reflection") return "student";
  return "system";
}

function sanitizeImpacts(value: unknown): Partial<Record<CompetencyId, number>> {
  if (!isRecord(value)) return {};
  const result: Partial<Record<CompetencyId, number>> = {};
  Object.entries(value).forEach(([key, raw]) => {
    if (competencies.has(key as CompetencyId)) {
      result[key as CompetencyId] = cleanNumber(raw, -20, 20, 0);
    }
  });
  return result;
}

function sanitizeEvidenceEvent(value: unknown, index: number): EvidenceEvent | null {
  if (!isRecord(value)) return null;
  const type = value.type;
  const source = value.source;
  const risk = value.risk;
  if (!eventTypes.has(type as EventType)) return null;
  if (!sources.has(source as EvidenceEvent["source"])) return null;

  const typedSource = source as EvidenceEvent["source"];
  const rawActor = value.actor;
  const actor = actors.has(rawActor as EvidenceEvent["actor"])
    ? (rawActor as EvidenceEvent["actor"])
    : inferActor(typedSource);
  const rawTimestamp = cleanString(value.timestamp, new Date().toISOString());
  const timestamp = Number.isNaN(Date.parse(rawTimestamp)) ? new Date().toISOString() : rawTimestamp;
  const id = cleanString(value.id, `evt-import-${Date.now()}-${index}`);

  return {
    id,
    type: type as EventType,
    timestamp,
    actor,
    source: typedSource,
    title: cleanString(value.title, "导入证据事件"),
    detail: cleanString(value.detail, "从外部账本导入的学习证据。"),
    competencyImpacts: sanitizeImpacts(value.competencyImpacts),
    confidence: cleanNumber(value.confidence, 0.1, 1, 0.72),
    risk: risks.has(risk as RiskLevel) ? (risk as RiskLevel) : "medium",
    traceId: cleanString(value.traceId, `trace-import-${id}`),
  };
}

function extractEventArray(payload: unknown): unknown[] | null {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return null;
  if (Array.isArray(payload.events)) return payload.events;
  const state = payload.state;
  if (isRecord(state) && Array.isArray(state.events)) return state.events;
  return null;
}

export function importLedgerPayload(raw: string, currentState: AppState): LedgerImportResult {
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return {
      status: "rejected",
      message: "导入失败：文件不是合法 JSON。",
      importedEvents: 0,
      skippedEvents: 0,
      invalidEvents: 0,
      state: null,
      warnings: ["INVALID_JSON"],
    };
  }

  const rawEvents = extractEventArray(payload);
  if (!rawEvents) {
    return {
      status: "rejected",
      message: "导入失败：未找到 events 或 state.events。",
      importedEvents: 0,
      skippedEvents: 0,
      invalidEvents: 0,
      state: null,
      warnings: ["EVENTS_NOT_FOUND"],
    };
  }

  const sanitized = rawEvents
    .map((event, index) => sanitizeEvidenceEvent(event, index))
    .filter((event): event is EvidenceEvent => Boolean(event));
  const invalidEvents = rawEvents.length - sanitized.length;
  if (sanitized.length === 0) {
    return {
      status: "rejected",
      message: "导入失败：没有可识别的 EvidenceEvent。",
      importedEvents: 0,
      skippedEvents: 0,
      invalidEvents,
      state: null,
      warnings: ["NO_VALID_EVENTS"],
    };
  }

  const mergedEvents = mergeEvidenceEvents(currentState.events, sanitized);
  const importedEvents = mergedEvents.length - currentState.events.length;
  const skippedEvents = sanitized.length - importedEvents;
  if (importedEvents === 0) {
    return {
      status: "duplicate",
      message: `导入完成：未新增事件，${skippedEvents} 条已存在，${invalidEvents} 条无效。`,
      importedEvents,
      skippedEvents,
      invalidEvents,
      state: currentState,
      warnings: invalidEvents > 0 ? ["INVALID_EVENTS_SKIPPED"] : [],
    };
  }

  return {
    status: "merged",
    message: `导入完成：新增 ${importedEvents} 条证据，跳过 ${skippedEvents} 条重复，忽略 ${invalidEvents} 条无效。`,
    importedEvents,
    skippedEvents,
    invalidEvents,
    state: {
      ...currentState,
      events: mergedEvents,
    },
    warnings: invalidEvents > 0 ? ["INVALID_EVENTS_SKIPPED"] : [],
  };
}
