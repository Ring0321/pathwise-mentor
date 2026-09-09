export type EvidenceStatus = "collected" | "missing" | "pending";

export type TeacherDecision = "approve" | "returnEvidence" | "humanTalk";

export type TeacherClosureDecision = "accept" | "returnEvidence";

export type RiskLevel = "low" | "medium" | "high";

export type StudentReturnStep =
  | "scaffoldReceived"
  | "evidenceSubmitted"
  | "reflectionSubmitted";

export type WorkOrderStatus =
  | "diagnosis"
  | "evidence"
  | "guardrail"
  | "intervention"
  | "review"
  | "closed";

export type EvidenceLedgerType =
  | "intake"
  | "baseline"
  | "evidence"
  | "gap"
  | "recommendation"
  | "decision"
  | "course_micro_task"
  | "teacher_reminder"
  | "teaching_improvement"
  | "teaching_improvement_execution"
  | "teaching_improvement_followup"
  | "teaching_improvement_followup_result"
  | "course_resource_revision"
  | "course_resource_release"
  | "course_resource_usage"
  | "teacher_evidence_review"
  | "intervention_package"
  | "student_return"
  | "teacher_acceptance";

export interface StudentReturnState {
  scaffoldReceived: boolean;
  evidenceSubmitted: boolean;
  reflectionSubmitted: boolean;
  revision?: number;
  returnedAt?: string;
  returnReason?: string;
  returnRequestedBy?: string;
}

export interface StudentReturnArtifact {
  failureSymptom: string;
  minimalCase: string;
  verificationRecord: string;
  evidenceLink?: string;
  integrityNote?: string;
}

export type TeacherEvidenceReviewStatus = "accepted" | "needs_evidence" | "rejected";

export interface TeacherEvidenceReviewItem {
  key: string;
  label: string;
  value: string;
  status: TeacherEvidenceReviewStatus;
  note?: string;
  required?: boolean;
}

export interface TeacherEvidenceReviewPayload {
  sourceLedgerEntryId: string;
  summary: string;
  items: TeacherEvidenceReviewItem[];
  teacherNote?: string;
}

export type InterventionPackageStatus =
  | "draft"
  | "ready_for_student"
  | "returned_for_evidence"
  | "human_talk";

export interface InterventionTaskPackage {
  id: string;
  workOrderId: string;
  title: string;
  status: InterventionPackageStatus;
  objective: string;
  safeBoundary: string;
  steps: string[];
  evidenceToSubmit: string[];
  rubricCheckpoints: string[];
  dueHint: string;
  teacherNote: string;
  createdBy: string;
  createdAt: string;
  sourceEvidenceIds: string[];
  valueAddedFocus: string;
  teacherEdited?: boolean;
  draftVersion?: number;
}

export interface InterventionPackageDraft {
  title?: string;
  objective?: string;
  safeBoundary?: string;
  steps?: string[];
  evidenceToSubmit?: string[];
  rubricCheckpoints?: string[];
  dueHint?: string;
  teacherNote?: string;
}

export interface RubricDimension {
  id: string;
  label: string;
  category: string;
  description: string;
  weight: number;
  targetGrowth: number;
  evidenceCoverage: number;
  enabled: boolean;
  evidenceSources: string[];
  guardrailRule: string;
  safeAction: string;
  uncertaintyRule: string;
}

export interface AbilityGraphNode {
  id: string;
  label: string;
  level: string;
  relation: string;
  status: "stable" | "watch" | "gap";
  mappedRubricId: string;
}

export interface EvidenceSourceConfig {
  id: string;
  label: string;
  sourceType: string;
  description: string;
  requiredFor: string[];
}

export interface EvidenceEvent {
  id: string;
  title: string;
  source: string;
  status: EvidenceStatus;
  detail: string;
  time?: string;
}

export interface ValueAddedDimension {
  label: string;
  current: number;
  expected: number;
  delta: number;
  uncertainty: "low" | "medium" | "high";
  description: string;
}

export interface ValueAddedSnapshot {
  id: string;
  workOrderId: string;
  createdAt: string;
  dimension: string;
  baseline: number;
  expected: number;
  observed: number;
  uplift: number;
  remainingGap: number;
  evidenceCoverage: number;
  uncertainty: "low" | "medium" | "high";
  teacherDecision: TeacherClosureDecision;
  teacherNote: string;
  basisEvidenceIds: string[];
  claim: string;
  boundary: string;
  nextTeachingAction: string;
}

export interface CourseWeeklyReportMetric {
  label: string;
  value: string | number;
  evidence: string;
}

export interface CourseWeeklyReportLine {
  id: string;
  label: string;
  detail: string;
  action: string;
  evidence: string;
  status: "watch" | "ready" | "blocked" | "done";
}

export interface CourseWeeklyReport {
  product: string;
  exportType: "course_weekly_operations_report";
  exportedAt: string;
  courseClass: string;
  courseName: string;
  repository: string;
  period: string;
  boundary: string;
  summary: string;
  metrics: CourseWeeklyReportMetric[];
  priorityQueue: CourseWeeklyReportLine[];
  focusInsights: CourseWeeklyReportLine[];
  evidenceGaps: CourseWeeklyReportLine[];
  nextWeekActions: CourseWeeklyReportLine[];
  valueAddedSnapshots: ValueAddedSnapshot[];
  markdown: string;
}

export interface CourseMicroTaskPackage {
  id: string;
  product: string;
  exportType: "course_micro_task_package";
  generatedAt: string;
  publishedAt?: string;
  publishedBy?: string;
  status?: "draft" | "published";
  courseClass: string;
  courseName: string;
  repository: string;
  sourceGap: string;
  focusDimension: string;
  affectedCount: number;
  targetWorkOrderIds: string[];
  targetLearners: string[];
  objective: string;
  safeBoundary: string;
  steps: string[];
  evidenceToSubmit: string[];
  rubricCheckpoints: string[];
  dueHint: string;
  teacherAction: string;
  confidenceNote: string;
  markdown: string;
}

export type TeachingImprovementPriority = "high" | "medium" | "low";

export interface CourseTeachingImprovementItem {
  id: string;
  sourceTraceId: string;
  focus: string;
  issue: string;
  action: string;
  acceptanceEvidence: string[];
  targetWorkOrderIds: string[];
  priority: TeachingImprovementPriority;
}

export interface CourseTeachingImprovementPlan {
  id: string;
  product: string;
  exportType: "course_teaching_improvement_plan";
  generatedAt: string;
  publishedAt?: string;
  publishedBy?: string;
  status?: "draft" | "published";
  courseClass: string;
  courseName: string;
  repository: string;
  sourceSummary: string;
  items: CourseTeachingImprovementItem[];
  boundary: string;
  markdown: string;
}

export interface CourseTeachingImprovementExecutionReceipt {
  id: string;
  product: string;
  exportType: "course_teaching_improvement_execution_receipt";
  planId: string;
  executedAt: string;
  executedBy: string;
  courseClass: string;
  courseName: string;
  repository: string;
  classSession: string;
  summary: string;
  evidence: string[];
  targetWorkOrderIds: string[];
  boundary: string;
  markdown: string;
}

export type CourseTeachingImprovementFollowupStatus =
  | "watch"
  | "improved"
  | "needs_more_evidence";

export interface CourseTeachingImprovementFollowupIndicator {
  id: string;
  label: string;
  before: string;
  expected: string;
  evidence: string;
  interpretation: string;
  status: CourseTeachingImprovementFollowupStatus;
}

export interface CourseTeachingImprovementFollowupSample {
  id: string;
  product: string;
  exportType: "course_teaching_improvement_followup_sample";
  planId: string;
  receiptId: string;
  sampledAt: string;
  sampledBy: string;
  courseClass: string;
  courseName: string;
  repository: string;
  observationWindow: string;
  summary: string;
  indicators: CourseTeachingImprovementFollowupIndicator[];
  targetWorkOrderIds: string[];
  boundary: string;
  markdown: string;
}

export type CourseTeachingImprovementFollowupResultStatus =
  | "observed_improvement"
  | "no_clear_change"
  | "needs_more_evidence";

export interface CourseTeachingImprovementFollowupResultFinding {
  id: string;
  label: string;
  expected: string;
  observed: string;
  evidence: string;
  interpretation: string;
  status: CourseTeachingImprovementFollowupResultStatus;
}

export interface CourseTeachingImprovementFollowupResult {
  id: string;
  product: string;
  exportType: "course_teaching_improvement_followup_result";
  planId: string;
  receiptId: string;
  sampleId: string;
  collectedAt: string;
  collectedBy: string;
  courseClass: string;
  courseName: string;
  repository: string;
  observationWindow: string;
  summary: string;
  findings: CourseTeachingImprovementFollowupResultFinding[];
  targetWorkOrderIds: string[];
  nextAction: string;
  boundary: string;
  markdown: string;
}

export type CourseResourceRevisionStatus = "ready" | "needs_review" | "blocked";

export interface CourseResourceRevisionChange {
  id: string;
  area: string;
  title: string;
  reason: string;
  implementation: string;
  owner: string;
  status: CourseResourceRevisionStatus;
}

export interface CourseResourceRevisionTicket {
  id: string;
  product: string;
  exportType: "course_resource_revision_ticket";
  sourceResultId: string;
  sampleId: string;
  planId: string;
  createdAt: string;
  createdBy: string;
  courseClass: string;
  courseName: string;
  repository: string;
  resourceTitle: string;
  versionFrom: string;
  versionTo: string;
  reason: string;
  changes: CourseResourceRevisionChange[];
  acceptanceChecks: string[];
  targetWorkOrderIds: string[];
  boundary: string;
  markdown: string;
}

export type CourseResourceReleaseCheckStatus = "passed" | "watch" | "blocked";

export interface CourseResourceReleaseCheck {
  id: string;
  label: string;
  evidence: string;
  owner: string;
  status: CourseResourceReleaseCheckStatus;
}

export interface CourseResourceReleaseReceipt {
  id: string;
  product: string;
  exportType: "course_resource_release_receipt";
  revisionTicketId: string;
  sourceResultId: string;
  sampleId: string;
  releasedAt: string;
  releasedBy: string;
  courseClass: string;
  courseName: string;
  repository: string;
  resourceTitle: string;
  releasedVersion: string;
  releaseChannel: string;
  releaseScope: string;
  assets: string[];
  checks: CourseResourceReleaseCheck[];
  rollbackPlan: string;
  targetWorkOrderIds: string[];
  boundary: string;
  markdown: string;
}

export type CourseResourceUsageSignalStatus = "confirmed" | "watch" | "needs_review";

export interface CourseResourceUsageSignal {
  id: string;
  label: string;
  value: string;
  evidence: string;
  status: CourseResourceUsageSignalStatus;
}

export interface CourseResourceUsageReceipt {
  id: string;
  product: string;
  exportType: "course_resource_usage_receipt";
  releaseReceiptId: string;
  revisionTicketId: string;
  sourceResultId: string;
  sampleId: string;
  observedAt: string;
  observedBy: string;
  courseClass: string;
  courseName: string;
  repository: string;
  releasedVersion: string;
  usageWindow: string;
  activeLearners: number;
  submittedEvidenceCount: number;
  teacherReviewReadyCount: number;
  medianCoverageAfter: number;
  signals: CourseResourceUsageSignal[];
  nextAction: string;
  targetWorkOrderIds: string[];
  boundary: string;
  markdown: string;
}

export interface LearningStage {
  id: string;
  title: string;
  state: "finish" | "process" | "wait";
}

export interface LearningWorkOrder {
  id: string;
  studentName: string;
  studentNo: string;
  courseClass: string;
  courseName: string;
  trigger: string;
  eventDate: string;
  risk: RiskLevel;
  status: WorkOrderStatus;
  owner: string;
  updatedAt: string;
  summary: string;
  evidenceCoverage: number;
  stage: string;
  diagnosis: string;
  valueAdded: ValueAddedDimension;
  collectedEvidence: EvidenceEvent[];
  missingEvidence: EvidenceEvent[];
  safeVoiRecommendation: string;
  safeVoiReason: string;
  stages: LearningStage[];
  selectedDecision?: TeacherDecision;
  teacherNote?: string;
  returnToken?: string;
  interventionPackage?: InterventionTaskPackage;
  valueAddedSnapshot?: ValueAddedSnapshot;
}

export interface WorkbenchSnapshot {
  selectedId: string;
  workOrders: LearningWorkOrder[];
  ledger: Record<string, EvidenceLedgerEntry[]>;
  studentReturn: Record<string, StudentReturnState>;
  updatedAt: string;
}

export interface CourseRosterLearner {
  learnerHash: string;
  learnerAlias: string;
  className: string;
  groupName: string;
  repositoryUser: string;
  status: "active" | "watch" | "paused";
  lastActivity?: string;
}

export interface CourseRoster {
  tenantId: string;
  courseId: string;
  courseClass: string;
  courseName: string;
  learners: CourseRosterLearner[];
  updatedAt: string;
}

export interface CourseBatchTask {
  courseClass: string;
  courseName: string;
  trigger: string;
  eventDate: string;
  owner: string;
  focus: "boundary" | "transaction" | "contract" | "review";
  risk: RiskLevel;
  taskSummary: string;
  learnerHashes: string[];
}

export interface CourseLaunchChecklistItem {
  key: "settings" | "roster" | "diagnosis" | "boundary";
  label: string;
  status: "done" | "watch" | "blocked";
  detail: string;
}

export interface CourseLaunchPlan {
  settings: {
    courseClass: string;
    courseName: string;
    repository: string;
    ciProvider: string;
    privacyPolicy: string;
  };
  learners: CourseRosterLearner[];
  selectedLearnerHashes: string[];
  task: CourseBatchTask;
}

export interface CourseLaunchResult {
  launchId: string;
  settings: CourseLaunchPlan["settings"];
  roster: CourseRoster;
  task: CourseBatchTask;
  createdCount: number;
  skippedCount: number;
  workOrders: LearningWorkOrder[];
  skipped: string[];
  checklist: CourseLaunchChecklistItem[];
  snapshot: WorkbenchSnapshot;
  storageMode: string;
  stored: boolean;
  warning?: string;
}

export interface GithubCiBatchImportItem {
  learnerHash: string;
  learnerAlias?: string;
  repository: string;
  branch?: string;
  prUrl: string;
  ciRunUrl: string;
  ciProvider?: string;
  ciLogSummary: string;
  trigger?: string;
  eventDate?: string;
  courseClass?: string;
  courseName?: string;
  owner?: string;
  idempotencyKey?: string;
}

export interface GithubCiBatchImportResult {
  snapshot: WorkbenchSnapshot;
  createdCount: number;
  skippedCount: number;
  importedWorkOrderIds: string[];
  skipped: string[];
  integrationStatus?: GithubIntegrationStatus;
}

export type GithubIntegrationRunStatus =
  | "created"
  | "deduped"
  | "partial"
  | "blocked"
  | "failed";

export interface GithubIntegrationRun {
  id: string;
  tenantId: string;
  courseId: string;
  learnerHash?: string;
  provider: "github";
  source: "github-ci" | "github-ci-batch" | "github-webhook";
  status: GithubIntegrationRunStatus;
  authMode?: string;
  deliveryId?: string;
  githubEvent?: string;
  repository: string;
  branch?: string;
  prUrl?: string;
  ciRunUrl?: string;
  workOrderId?: string;
  workOrderIds?: string[];
  createdCount: number;
  skippedCount: number;
  summary: string;
  createdAt: string;
  updatedAt?: string;
}

export interface GithubIntegrationStatus {
  provider: "github";
  configured: boolean;
  storageMode: string;
  stored: boolean;
  summary: {
    health: "not_configured" | "configured" | "receiving";
    latestStatus: GithubIntegrationRunStatus | "none";
    lastReceivedAt: string;
    lastDeliveryId: string;
    lastAuthMode: string;
    successfulCount: number;
    blockedCount: number;
    workOrderCount: number;
  };
  events: GithubIntegrationRun[];
}

export interface PilotEvidenceIntake {
  studentName: string;
  studentNo: string;
  courseClass: string;
  courseName: string;
  trigger: string;
  eventDate: string;
  owner: string;
  rubricFocus: "boundary" | "transaction" | "contract" | "review";
  evidenceText: string;
  studentHelpText: string;
}

export interface EvidenceLedgerEntry {
  id: string;
  type: EvidenceLedgerType;
  time: string;
  actor: string;
  title: string;
  source: string;
  detail: string;
  traceId?: string;
  decision?: TeacherDecision;
  stageAfter?: string;
  evidenceCoverageAfter?: number;
  valueAddedSnapshotId?: string;
}
