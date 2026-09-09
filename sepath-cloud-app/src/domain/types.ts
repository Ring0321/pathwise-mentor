export type EventType =
  | "baseline"
  | "task_started"
  | "issue_created"
  | "commit_pushed"
  | "pr_opened"
  | "ci_failed"
  | "ci_passed"
  | "conversation"
  | "scaffold_delivered"
  | "teacher_reviewed"
  | "reflection_submitted";

export type CompetencyId =
  | "requirements"
  | "architecture"
  | "implementation"
  | "testing"
  | "collaboration"
  | "reflection";

export type RiskLevel = "low" | "medium" | "high";
export type GateAction = "publish" | "defer" | "human_review" | "block";
export type PathStatus = "locked" | "available" | "in_progress" | "blocked" | "completed";
export type KnowledgeSourceKind =
  | "course_material"
  | "rubric"
  | "code_evidence"
  | "policy"
  | "reflection";

export interface Learner {
  id: string;
  name: string;
  role: string;
  goal: string;
  baseline: Record<CompetencyId, number>;
  consentValid: boolean;
}

export interface CompetencyNode {
  id: CompetencyId;
  label: string;
  rubric: string;
  prerequisiteIds: CompetencyId[];
}

export interface ProjectTask {
  id: string;
  title: string;
  description: string;
  due: string;
  competencyIds: CompetencyId[];
  rubric: string[];
}

export interface KnowledgeSource {
  id: string;
  title: string;
  kind: KnowledgeSourceKind;
  sourceRef: string;
  summary: string;
  competencyIds: CompetencyId[];
  trustWeight: number;
  freshnessDays: number;
  riskControls: string[];
}

export interface EvidenceEvent {
  id: string;
  type: EventType;
  timestamp: string;
  actor: "student" | "system" | "teacher" | "tool";
  source: "baseline" | "git" | "ci" | "chat" | "teacher" | "reflection";
  title: string;
  detail: string;
  competencyImpacts: Partial<Record<CompetencyId, number>>;
  confidence: number;
  risk: RiskLevel;
  traceId: string;
}

export interface DiagnosisCard {
  id: string;
  learnerId: string;
  blocker: string;
  summary: string;
  confidence: number;
  evidenceCoverage: number;
  risk: RiskLevel;
  focusCompetency: CompetencyId;
  evidenceEventIds: string[];
  reasonCodes: string[];
}

export interface TaskCandidate {
  taskId: string;
  label: string;
  expectedGrowth: number;
  informationGain: number;
  transferability: number;
  windowRescue: number;
  burden: number;
  risk: number;
  estimatedHours: number;
  monetaryCost: number;
  consentValid: boolean;
  rulesValid: boolean;
  reversible: boolean;
  highStakes: boolean;
  paidService: boolean;
}

export interface TaskDecision {
  taskId: string;
  label: string;
  gate: "PASS" | "BLOCK";
  rawValue: number;
  publishableValue: number | null;
  reasonCodes: string[];
  rank: number | null;
}

export interface ScaffoldMessage {
  id: string;
  level: 1 | 2 | 3;
  title: string;
  body: string;
  checklist: string[];
  refusesDirectAnswer: boolean;
  evidenceEventIds: string[];
}

export interface ReviewTicket {
  id: string;
  status: "created" | "triaged" | "approved" | "revised" | "rejected" | "archived";
  severity: RiskLevel;
  title: string;
  reason: string;
  evidenceEventIds: string[];
  action: GateAction;
  requiredActions: string[];
}

export interface PathNodeState {
  id: string;
  label: string;
  competencyId: CompetencyId;
  status: PathStatus;
  evidenceEventIds: string[];
}

export interface ObservabilityTrace {
  id: string;
  span: string;
  model: string;
  tool: string;
  latencyMs: number;
  tokenCost: number;
  qualityGate: "pass" | "warn" | "fail";
}

export interface MatchedKnowledgeSource extends KnowledgeSource {
  matchScore: number;
  matchReason: string;
}

export interface KnowledgeBoundaryReport {
  retrievalCoverage: number;
  matchedSources: MatchedKnowledgeSource[];
  missingCompetencyIds: CompetencyId[];
  ruleHits: string[];
  allowedResponse: string;
  blockedResponse: string;
  teacherReviewRequired: boolean;
}

export interface AwardCriterionEvidence {
  id: string;
  label: string;
  score: number;
  maxScore: number;
  status: "proved" | "ready" | "needs_polish";
  proof: string;
  artifacts: string[];
}

export interface AwardReadinessReport {
  totalScore: number;
  maxScore: number;
  confidence: number;
  criteria: AwardCriterionEvidence[];
  strongestDifferentiator: string;
  nextPolishActions: string[];
}

export interface AppState {
  learner: Learner;
  task: ProjectTask;
  events: EvidenceEvent[];
  demoStep: number;
}
