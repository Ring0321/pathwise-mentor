import type { InterventionPackageDraft } from "../types";

export interface AgentEvidence {
  id: string;
  title: string;
  source: string;
  status: string;
  detail: string;
}

export interface AgentContext {
  kind: "course" | "work_order";
  workOrderId?: string;
  courseName: string;
  status?: string;
  trigger?: string;
  evidenceCoverage?: number | null;
  sampledOrders?: number;
  pendingOrders?: number;
  evidence: AgentEvidence[];
  missingEvidence: AgentEvidence[];
  valueAdded?: { label: string; current: number | null; expected: number | null; delta: number | null; uncertainty: string };
}

export interface AgentTurn {
  id: string;
  workOrderId: string;
  message: string;
  createdAt: string;
  contextVersion: string;
  draftPreparedAt?: string;
  evidence: AgentEvidence[];
  missingEvidence: AgentEvidence[];
  outcome: {
    mode: "model" | "rules" | "guarded";
    fallback: boolean;
    reason?: string;
    answer: string;
    questions: string[];
    checklist: string[];
    evidenceToSubmit: string[];
    citations: string[];
    teacherReviewRequired: boolean;
  };
}

export interface AgentConversation {
  context: AgentContext;
  contextVersion: string;
  turns: AgentTurn[];
  historyWindow: number;
}

export interface AgentDraftSelection {
  draft: InterventionPackageDraft;
  turnId: string;
  draftPreparedAt: string;
  published: false;
}
