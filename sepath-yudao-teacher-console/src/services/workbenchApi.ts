import type {
  CourseBatchTask,
  CourseLaunchResult,
  CourseResourceReleaseReceipt,
  CourseResourceUsageReceipt,
  CourseMicroTaskPackage,
  CourseResourceRevisionTicket,
  CourseRoster,
  CourseRosterLearner,
  CourseTeachingImprovementExecutionReceipt,
  CourseTeachingImprovementFollowupResult,
  CourseTeachingImprovementFollowupSample,
  CourseTeachingImprovementPlan,
  CourseWeeklyReport,
  CourseWeeklyReportLine,
  EvidenceEvent,
  EvidenceLedgerEntry,
  GithubIntegrationRun,
  GithubIntegrationStatus,
  GithubCiBatchImportItem,
  GithubCiBatchImportResult,
  InterventionPackageDraft,
  InterventionTaskPackage,
  LearningWorkOrder,
  RiskLevel,
  StudentReturnArtifact,
  StudentReturnStep,
  StudentReturnState,
  TeacherClosureDecision,
  TeacherDecision,
  TeacherEvidenceReviewPayload,
  ValueAddedDimension,
  ValueAddedSnapshot,
  WorkbenchSnapshot,
  WorkOrderStatus,
} from "../types";
import type { AgentConversation, AgentDraftSelection, AgentTurn, AgentContext } from "../types/teachingAgent";
import {
  createStages,
  decisionMeta,
  riskLabels,
  seedLedger,
  seedWorkOrders,
  statusLabels,
} from "../data/workbench";

const storageKey = "sepath-yudao-workbench:glass-v1";
const rosterStorageKey = "sepath-yudao-course-roster:v1";
const apiBaseStorageKey = "sepath-yudao-api-base:v1";
const llmGatewayBaseStorageKey = "sepath-yudao-llm-gateway-base:v1";
const apiTokenSessionStorageKey = "sepath-yudao-api-token:v1";
const githubIntegrationStatusStorageKey = "sepath-yudao-github-integration-status:v1";
const tenantId = "tenant-se-course-2026";
const courseId = "software-engineering-project";
const studentReturnSteps: StudentReturnStep[] = [
  "scaffoldReceived",
  "evidenceSubmitted",
  "reflectionSubmitted",
];

export interface TeacherEventIntake {
  studentName: string;
  studentNo: string;
  courseClass: string;
  courseName: string;
  trigger: string;
  eventDate: string;
  owner: string;
  focus: "boundary" | "transaction" | "contract" | "review";
  evidenceText: string;
  studentHelpText: string;
}

export interface CourseSettingsConfig {
  courseClass: string;
  courseName: string;
  repository: string;
  ciProvider: string;
  privacyPolicy: string;
  apiBaseUrl?: string;
  llmGatewayBaseUrl?: string;
  webhookPath?: string;
}

export interface AiScaffoldDraftResult {
  runtime: string;
  contractVersion: string;
  mode: "governed-llm" | "deterministic-fallback" | "local-rule-fallback" | string;
  fallback: boolean;
  reason?: string;
  provider?: string;
  traceId: string;
  refusal: string;
  checklist: string[];
  miniLab: string[];
  evidenceToSubmit: string[];
  citations: string[];
  teacherReviewRequired: boolean;
  guardrailHits: string[];
  gatewayBaseUrl: string;
  draft: InterventionPackageDraft;
}

interface AuthSessionResponse {
  actor?: {
    role?: string;
    authMode?: string;
    reviewMode?: string;
    tenantId?: string;
    courseId?: string;
  };
  capabilities?: string[];
  boundaries?: string[];
  storageMode?: string;
}

interface HealthResponse {
  status?: string;
  authMode?: string;
  storageMode?: string;
  readiness?: {
    status?: string;
    checks?: Array<{
      key: string;
      status: string;
      detail?: string;
    }>;
  };
}

export interface ApiConnectionCheck {
  ok: boolean;
  mode: "offline" | "edge";
  message: string;
  role?: string;
  capabilities?: string[];
  settings?: Partial<CourseSettingsConfig>;
  storageMode?: string;
  authMode?: string;
  backendStatus?: string;
  readiness?: HealthResponse["readiness"];
  requiresToken?: boolean;
}

export interface TeacherAccessLoginResult {
  runtime: string;
  tokenType: "Bearer";
  accessToken: string;
  expiresAt: string;
  ttlSeconds: number;
  claims: {
    role: "teacher";
    tenantId: string;
    courseId: string;
    tokenScope: string;
  };
  storageMode?: string;
}

function normalizeApiBase(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function envApiBaseUrl() {
  return normalizeApiBase(import.meta.env.VITE_SEPATH_API_BASE ?? "");
}

export function readApiBaseUrl() {
  if (typeof window === "undefined") return envApiBaseUrl();
  const queryValue = new URLSearchParams(window.location.search).get("api");
  if (queryValue !== null) {
    const normalized = normalizeApiBase(queryValue);
    window.localStorage.setItem(apiBaseStorageKey, normalized);
    return normalized;
  }
  return normalizeApiBase(window.localStorage.getItem(apiBaseStorageKey) ?? "") || envApiBaseUrl();
}

export function saveApiBaseUrl(value: string) {
  if (typeof window === "undefined") return;
  const normalized = normalizeApiBase(value);
  if (normalized) {
    window.localStorage.setItem(apiBaseStorageKey, normalized);
  } else {
    window.localStorage.removeItem(apiBaseStorageKey);
  }
}

function envLlmGatewayBaseUrl() {
  return normalizeApiBase(import.meta.env.VITE_SEPATH_LLM_GATEWAY_BASE ?? "");
}

export function readConfiguredLlmGatewayBaseUrl() {
  if (typeof window === "undefined") return envLlmGatewayBaseUrl();
  const params = new URLSearchParams(window.location.search);
  const queryValue = params.get("llm") || params.get("llmGateway") || params.get("agentApi");
  if (queryValue !== null) {
    const normalized = normalizeApiBase(queryValue);
    if (normalized) window.localStorage.setItem(llmGatewayBaseStorageKey, normalized);
    else window.localStorage.removeItem(llmGatewayBaseStorageKey);
    return normalized;
  }
  return (
    normalizeApiBase(window.localStorage.getItem(llmGatewayBaseStorageKey) ?? "") ||
    envLlmGatewayBaseUrl()
  );
}

export function readLlmGatewayBaseUrl() {
  return readConfiguredLlmGatewayBaseUrl() || readApiBaseUrl();
}

export function saveLlmGatewayBaseUrl(value: string) {
  if (typeof window === "undefined") return;
  const normalized = normalizeApiBase(value);
  if (normalized) {
    window.localStorage.setItem(llmGatewayBaseStorageKey, normalized);
  } else {
    window.localStorage.removeItem(llmGatewayBaseStorageKey);
  }
}

function normalizeBearerToken(value: string) {
  return value.trim().replace(/^Bearer\s+/i, "");
}

export function readApiAccessToken() {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  const queryToken = params.get("accessToken") || params.get("apiToken");
  if (queryToken) {
    const normalized = normalizeBearerToken(queryToken);
    window.sessionStorage.setItem(apiTokenSessionStorageKey, normalized);
    return normalized;
  }
  return normalizeBearerToken(window.sessionStorage.getItem(apiTokenSessionStorageKey) ?? "");
}

export function saveApiAccessToken(value: string) {
  if (typeof window === "undefined") return;
  const normalized = normalizeBearerToken(value);
  if (normalized) {
    window.sessionStorage.setItem(apiTokenSessionStorageKey, normalized);
  } else {
    window.sessionStorage.removeItem(apiTokenSessionStorageKey);
  }
}

export function clearApiAccessToken() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(apiTokenSessionStorageKey);
}

function isLocalApiBaseUrl(value: string) {
  if (value.startsWith("/")) return true;
  try {
    const url = new URL(value);
    return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  } catch {
    return false;
  }
}

function stableHash(input: string) {
  let hash = 2166136261;
  for (const char of input) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function looksPseudonymous(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes("@") || /^\d+$/.test(trimmed) || /[\u4e00-\u9fa5]/.test(trimmed)) return false;
  return /^(stu|learner|anon|hash)[_-][a-z0-9_-]{3,}$/i.test(trimmed) || (/^[a-f0-9]{16,}$/i.test(trimmed) && /[a-f]/i.test(trimmed));
}

function learnerHashFrom(intake: Pick<TeacherEventIntake, "studentNo" | "studentName">) {
  const candidate = intake.studentNo.trim() || intake.studentName.trim() || "anonymous-learner";
  return looksPseudonymous(candidate) ? candidate : `stu_hash_${stableHash(candidate)}`;
}

function currentUrlParams() {
  return typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
}

function currentEntryMode() {
  return currentUrlParams().get("mode") || "teacher";
}

function currentStudentOrderId() {
  return currentUrlParams().get("order") || "";
}

function currentStudentReturnToken() {
  const params = currentUrlParams();
  return params.get("returnToken") || params.get("token") || "";
}

function localReturnTokenFor(order: Pick<LearningWorkOrder, "id" | "studentNo" | "studentName">) {
  return `local_return_${stableHash(`${order.id}:${order.studentNo}:${order.studentName}`).slice(0, 18)}`;
}

function withLocalReturnTokens(snapshot: WorkbenchSnapshot): WorkbenchSnapshot {
  return {
    ...snapshot,
    workOrders: snapshot.workOrders.map((order) => ({
      ...order,
      returnToken: order.returnToken ?? localReturnTokenFor(order),
    })),
  };
}

function emptyStudentReturnState(): StudentReturnState {
  return {
    scaffoldReceived: false,
    evidenceSubmitted: false,
    reflectionSubmitted: false,
    revision: 0,
  };
}

function normalizeStudentReturnState(state?: Partial<StudentReturnState>): StudentReturnState {
  return {
    ...emptyStudentReturnState(),
    ...(state ?? {}),
    revision: Number(state?.revision ?? 0),
  };
}

function normalizeSnapshot(snapshot: WorkbenchSnapshot): WorkbenchSnapshot {
  return {
    ...snapshot,
    studentReturn: Object.fromEntries(
      Object.entries(snapshot.studentReturn ?? {}).map(([id, state]) => [
        id,
        normalizeStudentReturnState(state),
      ]),
    ),
  };
}

function countStudentReturnSteps(state?: Partial<StudentReturnState>) {
  return studentReturnSteps.filter((step) => Boolean(state?.[step])).length;
}

function apiHeaders(learnerHash = "", targetBase = readApiBaseUrl()) {
  const params = currentUrlParams();
  const mode = params.get("mode");
  const role = mode === "student" ? "student" : mode === "reviewer" ? "reviewer" : "teacher";
  const base = normalizeApiBase(targetBase);
  const accessToken = readApiAccessToken();
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (accessToken) {
    return {
      ...headers,
      authorization: `Bearer ${accessToken}`,
    };
  }
  if (base && !isLocalApiBaseUrl(base)) {
    return headers;
  }
  const returnToken = currentStudentReturnToken();
  return {
    ...headers,
    "x-sepath-role": role,
    "x-sepath-learner": learnerHash,
    "x-sepath-review-mode": mode === "reviewer" ? "sandbox" : "",
    "x-sepath-return-token": returnToken,
  };
}

async function apiJson<T>(path: string, init: RequestInit = {}, learnerHash = ""): Promise<T> {
  const base = readApiBaseUrl();
  if (!base) {
    throw new Error("Edge API base URL is not configured");
  }
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      ...apiHeaders(learnerHash, base),
      ...(init.headers || {}),
    },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || data?.error || `Edge API request failed: ${response.status}`);
  }
  return data as T;
}

async function llmGatewayJson<T>(
  path: string,
  init: RequestInit = {},
  learnerHash = "",
  targetBase = readLlmGatewayBaseUrl(),
): Promise<T> {
  const base = normalizeApiBase(targetBase);
  if (!base) {
    throw new Error("智能体网关地址未配置");
  }
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      ...apiHeaders(learnerHash, base),
      ...(init.headers || {}),
    },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || data?.error || `LLM Gateway request failed: ${response.status}`);
  }
  return data as T;
}

function scopedQuery() {
  return new URLSearchParams({ tenantId, courseId }).toString();
}

export function getAgentConversation(workOrderId = "", signal?: AbortSignal) {
  return apiJson<AgentConversation>(`/api/agent/conversation?${new URLSearchParams({ tenantId, courseId, workOrderId })}`, { signal });
}

export function sendAgentMessage(workOrderId: string, message: string, idempotencyKey: string, signal?: AbortSignal) {
  return apiJson<{ turn: AgentTurn; context: AgentContext; deduped: boolean }>("/api/agent/conversation", {
    method: "POST", signal,
    body: JSON.stringify({ tenantId, courseId, workOrderId, message, idempotencyKey }),
  });
}

export function prepareAgentDraft(workOrderId: string, turnId: string) {
  return apiJson<AgentDraftSelection>("/api/agent/conversation/draft", {
    method: "POST", body: JSON.stringify({ tenantId, courseId, workOrderId, turnId }),
  });
}

export async function loadRemoteCourseSettings(): Promise<Partial<CourseSettingsConfig> | null> {
  if (!readApiBaseUrl()) return null;
  const data = await apiJson<{ settings?: Partial<CourseSettingsConfig> }>(
    `/api/course/settings?${scopedQuery()}`,
  );
  return data.settings ?? null;
}

export async function saveRemoteCourseSettings(
  settings: CourseSettingsConfig,
): Promise<Partial<CourseSettingsConfig> | null> {
  if (!readApiBaseUrl()) return null;
  const data = await apiJson<{ settings?: Partial<CourseSettingsConfig> }>(
    "/api/course/settings",
    {
      method: "POST",
      body: JSON.stringify({
        tenantId,
        courseId,
        courseClass: settings.courseClass,
        courseName: settings.courseName,
        repository: settings.repository,
        ciProvider: settings.ciProvider,
        privacyPolicy: settings.privacyPolicy,
      }),
    },
  );
  return data.settings ?? null;
}

function emptyGithubIntegrationStatus(): GithubIntegrationStatus {
  const snapshot = readSnapshot();
  return {
    provider: "github",
    configured: false,
    storageMode: readApiBaseUrl() ? "edge-api" : "local-offline",
    stored: false,
    summary: {
      health: "not_configured",
      latestStatus: "none",
      lastReceivedAt: "",
      lastDeliveryId: "",
      lastAuthMode: "",
      successfulCount: 0,
      blockedCount: 0,
      workOrderCount: snapshot.workOrders.length,
    },
    events: [],
  };
}

function normalizeGithubIntegrationStatus(value: unknown): GithubIntegrationStatus {
  const base = emptyGithubIntegrationStatus();
  if (!value || typeof value !== "object") return base;
  const input = value as Partial<GithubIntegrationStatus>;
  const events = Array.isArray(input.events) ? input.events : [];
  return {
    ...base,
    ...input,
    provider: "github",
    summary: {
      ...base.summary,
      ...(input.summary ?? {}),
    },
    events: events
      .filter((event): event is GithubIntegrationRun => Boolean(event && typeof event === "object"))
      .slice(0, 20),
  };
}

function readLocalGithubIntegrationStatus(): GithubIntegrationStatus {
  if (typeof window === "undefined") return emptyGithubIntegrationStatus();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(githubIntegrationStatusStorageKey) || "null");
    return normalizeGithubIntegrationStatus(parsed);
  } catch {
    return emptyGithubIntegrationStatus();
  }
}

function writeLocalGithubIntegrationRun(run: GithubIntegrationRun) {
  if (typeof window === "undefined") return emptyGithubIntegrationStatus();
  const current = readLocalGithubIntegrationStatus();
  const events = [
    run,
    ...current.events.filter((event) => event.id !== run.id),
  ].slice(0, 20);
  const successfulCount = events.filter((event) =>
    ["created", "deduped", "partial"].includes(event.status),
  ).length;
  const blockedCount = events.filter((event) =>
    ["blocked", "failed"].includes(event.status),
  ).length;
  const snapshot = readSnapshot();
  const next: GithubIntegrationStatus = {
    provider: "github",
    configured: true,
    storageMode: readApiBaseUrl() ? "edge-api" : "local-offline",
    stored: false,
    summary: {
      health: "receiving",
      latestStatus: run.status,
      lastReceivedAt: run.createdAt,
      lastDeliveryId: run.deliveryId || "",
      lastAuthMode: run.authMode || "local-import",
      successfulCount,
      blockedCount,
      workOrderCount: snapshot.workOrders.length,
    },
    events,
  };
  window.localStorage.setItem(githubIntegrationStatusStorageKey, JSON.stringify(next));
  return next;
}

export async function getGithubIntegrationStatus(): Promise<GithubIntegrationStatus> {
  await delay();
  if (readApiBaseUrl()) {
    try {
      const status = normalizeGithubIntegrationStatus(
        await apiJson(`/api/integrations/github/status?${scopedQuery()}&limit=8`),
      );
      if (typeof window !== "undefined") {
        window.localStorage.setItem(githubIntegrationStatusStorageKey, JSON.stringify(status));
      }
      return status;
    } catch (error) {
      console.warn("[SE-Path] GitHub integration status API unavailable, using local status.", error);
    }
  }
  return readLocalGithubIntegrationStatus();
}

export async function getCourseRoster(): Promise<CourseRoster> {
  await delay();
  if (readApiBaseUrl()) {
    try {
      const data = await apiJson<{ roster?: CourseRoster }>(
        `/api/course/roster?${scopedQuery()}`,
      );
      if (data.roster?.learners?.length) {
        writeLocalRoster(data.roster);
        return data.roster;
      }
    } catch (error) {
      console.warn("[SE-Path] Course roster API unavailable, using local roster.", error);
    }
  }
  const roster = readLocalRoster();
  writeLocalRoster(roster);
  return clone(roster);
}

export async function saveCourseRoster(
  learners: CourseRosterLearner[],
): Promise<CourseRoster> {
  await delay();
  const base = readLocalRoster();
  const roster: CourseRoster = {
    ...base,
    learners,
    updatedAt: nowText(),
  };
  if (readApiBaseUrl()) {
    try {
      const data = await apiJson<{ roster?: CourseRoster }>(
        "/api/course/roster",
        {
          method: "POST",
          body: JSON.stringify({
            tenantId,
            courseId,
            learners,
          }),
        },
      );
      if (data.roster) {
        writeLocalRoster(data.roster);
        return data.roster;
      }
    } catch (error) {
      console.warn("[SE-Path] Course roster API save failed, using local roster.", error);
    }
  }
  writeLocalRoster(roster);
  return clone(roster);
}

function normalizeLaunchLearners(learners: CourseRosterLearner[]): CourseRosterLearner[] {
  return learners
    .map((learner, index) => {
      const status: CourseRosterLearner["status"] =
        learner.status === "paused" || learner.status === "watch" ? learner.status : "active";
      return {
        learnerHash: learnerHashFrom({
          studentNo: learner.learnerHash || `learner-${index + 1}`,
          studentName: learner.learnerAlias || "",
        }),
        learnerAlias: learner.learnerAlias || `SE-${String(index + 1).padStart(3, "0")}`,
        className: learner.className || "软件工程 2301",
        groupName: learner.groupName || "未分组",
        repositoryUser: learner.repositoryUser || "",
        status,
        lastActivity: learner.lastActivity || "",
      };
    })
    .filter(
      (learner, index, all) =>
        all.findIndex((item) => item.learnerHash === learner.learnerHash) === index,
    );
}

export async function launchCoursePilot(plan: {
  settings: CourseSettingsConfig;
  learners: CourseRosterLearner[];
  selectedLearnerHashes: string[];
  task: CourseBatchTask;
}): Promise<CourseLaunchResult> {
  await delay();
  const learners = normalizeLaunchLearners(plan.learners);
  const selectedLearnerHashes = plan.selectedLearnerHashes.length
    ? plan.selectedLearnerHashes
    : learners.filter((learner) => learner.status !== "paused").map((learner) => learner.learnerHash);
  const task: CourseBatchTask = {
    ...plan.task,
    courseClass: plan.settings.courseClass,
    courseName: plan.settings.courseName,
    learnerHashes: selectedLearnerHashes,
  };

  if (readApiBaseUrl()) {
    try {
      const data = await apiJson<CourseLaunchResult>("/api/course/launch", {
        method: "POST",
        body: JSON.stringify({
          tenantId,
          courseId,
          settings: {
            courseClass: plan.settings.courseClass,
            courseName: plan.settings.courseName,
            repository: plan.settings.repository,
            ciProvider: plan.settings.ciProvider,
            privacyPolicy: plan.settings.privacyPolicy,
          },
          learners,
          selectedLearnerHashes,
          task,
          idempotencyKey: `${plan.settings.courseName}:${task.trigger}:${task.eventDate}:launch`,
        }),
      });
      const snapshot = asSnapshot(data);
      writeSnapshot(snapshot);
      writeLocalRoster(data.roster);
      return {
        ...data,
        snapshot: clone(snapshot),
      };
    } catch (error) {
      console.warn("[SE-Path] Course launch API unavailable, using local launch.", error);
    }
  }

  const roster: CourseRoster = {
    tenantId,
    courseId,
    courseClass: plan.settings.courseClass,
    courseName: plan.settings.courseName,
    learners,
    updatedAt: nowText(),
  };
  writeLocalRoster(roster);

  const snapshot = readSnapshot();
  const createdAt = nowText();
  const created: LearningWorkOrder[] = [];
  const skipped: string[] = [];
  const selected = learners
    .filter((learner) => learner.status !== "paused")
    .filter((learner) => selectedLearnerHashes.length === 0 || selectedLearnerHashes.includes(learner.learnerHash))
    .slice(0, 40);

  for (const learner of selected) {
    const suffix = stableHash(
      [
        plan.settings.courseName,
        task.trigger,
        task.eventDate,
        learner.learnerHash,
        "course-launch",
      ].join(":"),
    );
    const orderId = `wo-batch-${suffix}`;
    if (snapshot.workOrders.some((order) => order.id === orderId)) {
      skipped.push(orderId);
      continue;
    }
    const item = createLocalBatchOrder(learner, task, suffix, createdAt);
    snapshot.workOrders.unshift(item.order);
    snapshot.ledger[item.order.id] = [item.ledgerEntry];
    snapshot.studentReturn[item.order.id] = emptyStudentReturnState();
    snapshot.selectedId = item.order.id;
    created.push(item.order);
  }

  snapshot.updatedAt = createdAt;
  const next = withLocalReturnTokens(snapshot);
  writeSnapshot(next);
  return {
    launchId: `local-course-launch-${stableHash(`${createdAt}:${created.map((order) => order.id).join("|")}`)}`,
    settings: {
      courseClass: plan.settings.courseClass,
      courseName: plan.settings.courseName,
      repository: plan.settings.repository,
      ciProvider: plan.settings.ciProvider,
      privacyPolicy: plan.settings.privacyPolicy,
    },
    roster,
    task,
    createdCount: created.length,
    skippedCount: skipped.length,
    workOrders: clone(created),
    skipped,
    checklist: [
      {
        key: "settings",
        label: "课程与仓库已保存",
        status: "done",
        detail: `${plan.settings.courseClass} / ${plan.settings.repository}`,
      },
      {
        key: "roster",
        label: "伪名名单已入库",
        status: "done",
        detail: `${learners.length} 名学习者，真实身份不进入浏览器包。`,
      },
      {
        key: "diagnosis",
        label: "首轮诊断单已生成",
        status: created.length > 0 ? "done" : "watch",
        detail: `${created.length} 张新增，${skipped.length} 张跳过重复。`,
      },
      {
        key: "boundary",
        label: "形成性边界已启用",
        status: "done",
        detail: "智能体只给候选建议，教师复核后才发布给学生。",
      },
    ],
    snapshot: clone(next),
    storageMode: readApiBaseUrl() ? "edge-api-fallback-local" : "local-offline",
    stored: false,
  };
}

export async function createBatchWorkOrders(
  task: CourseBatchTask,
): Promise<WorkbenchSnapshot> {
  await delay();
  if (readApiBaseUrl()) {
    const apiSnapshot = await tryApiSnapshot(async () =>
      asSnapshot(
        await apiJson("/api/work-order-batches", {
          method: "POST",
          body: JSON.stringify({
            tenantId,
            courseId,
            learnerHashes: task.learnerHashes,
            task,
            idempotencyKey: `${task.courseName}:${task.trigger}:${task.eventDate}`,
          }),
        }),
      ),
    );
    if (apiSnapshot) return apiSnapshot;
  }

  const roster = readLocalRoster();
  const selected = roster.learners.filter(
    (learner) =>
      learner.status !== "paused" &&
      (task.learnerHashes.length === 0 || task.learnerHashes.includes(learner.learnerHash)),
  );
  const snapshot = readSnapshot();
  const createdAt = nowText();
  for (const learner of selected.slice(0, 40)) {
    const suffix = stableHash(`${task.courseName}:${task.trigger}:${task.eventDate}:${learner.learnerHash}`);
    if (snapshot.workOrders.some((order) => order.id === `wo-batch-${suffix}`)) continue;
    const created = createLocalBatchOrder(learner, task, suffix, createdAt);
    snapshot.workOrders.unshift(created.order);
    snapshot.ledger[created.order.id] = [created.ledgerEntry];
    snapshot.studentReturn[created.order.id] = emptyStudentReturnState();
    snapshot.selectedId = created.order.id;
  }
  snapshot.updatedAt = createdAt;
  const next = withLocalReturnTokens(snapshot);
  writeSnapshot(next);
  return clone(next);
}

function inferGithubFocus(item: GithubCiBatchImportItem): TeacherEventIntake["focus"] {
  const text = `${item.trigger ?? ""} ${item.ciLogSummary ?? ""} ${item.branch ?? ""}`;
  if (/transaction|rollback|concurrent|事务|回滚|并发/i.test(text)) return "transaction";
  if (/contract|schema|compat|契约|接口|兼容/i.test(text)) return "contract";
  if (/review|comment|merge|评审|协作/i.test(text)) return "review";
  return "boundary";
}

function buildGithubBatchEvidenceText(item: GithubCiBatchImportItem) {
  return [
    `仓库：${item.repository}`,
    item.branch ? `分支：${item.branch}` : "",
    `PR：${item.prUrl}`,
    `CI 提供方：${item.ciProvider || "GitHub Actions"}`,
    `CI：${item.ciRunUrl}`,
    `日志摘要：${item.ciLogSummary}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function createLocalGithubBatchOrder(
  item: GithubCiBatchImportItem,
  suffix: string,
  createdAt: string,
): { order: LearningWorkOrder; ledgerEntry: EvidenceLedgerEntry } {
  const focus = inferGithubFocus(item);
  const profile = focusProfiles[focus];
  const intake: TeacherEventIntake = {
    studentName: item.learnerAlias || `SE-${item.learnerHash.slice(-4).toUpperCase()}`,
    studentNo: item.learnerHash,
    courseClass: item.courseClass || "软件工程 2301",
    courseName: item.courseName || "REST API 错误处理与边界测试",
    trigger: item.trigger || `PR ${item.prUrl.split("/pull/")[1] ? `#${item.prUrl.split("/pull/")[1]}` : ""} CI 失败`,
    eventDate: item.eventDate || new Date().toISOString().slice(0, 10),
    owner: item.owner || "任课教师",
    focus,
    evidenceText: buildGithubBatchEvidenceText(item),
    studentHelpText: "批量 PR/CI 导入形成候选诊断，等待教师确认后再发布补证据或脚手架任务。",
  };
  const risk = inferRisk(intake);
  const coverage = inferCoverage(intake);
  const order: LearningWorkOrder = {
    id: `wo-live-${suffix}`,
    studentName: intake.studentName,
    studentNo: intake.studentNo,
    courseClass: intake.courseClass,
    courseName: intake.courseName,
    trigger: intake.trigger,
    eventDate: intake.eventDate,
    risk,
    status: "diagnosis",
    owner: intake.owner,
    updatedAt: "刚刚",
    summary: `${profile.label}证据不足，建议先由教师确认 Safe-VOI 下一步。`,
    evidenceCoverage: coverage,
    stage: "学情诊断",
    diagnosis: `系统从批量 PR/CI 证据中识别到“${profile.label}”相关风险。当前只形成候选诊断，需教师依据证据决定补证据、脚手架或人工会谈。`,
    valueAdded: buildValueAdded(focus, risk, coverage),
    collectedEvidence: [
      {
        id: `ev-pr-${suffix}`,
        title: "PR 变更摘要",
        source: item.repository || "GitHub",
        status: "collected",
        detail: cropText(item.prUrl, 140),
        time: createdAt,
      },
      {
        id: `ev-ci-${suffix}`,
        title: "CI 运行摘要",
        source: item.ciProvider || "GitHub Actions",
        status: "collected",
        detail: cropText(item.ciLogSummary || item.ciRunUrl, 180),
        time: createdAt,
      },
    ],
    missingEvidence: profile.missing.map((missing, index) => ({
      id: `ev-github-batch-missing-${suffix}-${index + 1}`,
      title: missing.title,
      source: missing.source,
      status: index === 0 ? "missing" : "pending",
      detail: missing.detail,
    })),
    safeVoiRecommendation: profile.recommendation,
    safeVoiReason: profile.reason,
    stages: createStages("diagnosis"),
  };
  return {
    order,
    ledgerEntry: {
      id: `ledger-github-batch-${suffix}`,
      type: "intake",
      time: createdAt,
      actor: item.ciProvider || "GitHub Actions",
      title: "批量 PR/CI 导入并生成诊断单",
      source: item.repository || "GitHub",
      detail: cropText(`${order.trigger}：${item.ciLogSummary}`, 180),
      traceId: `github-batch-${suffix}`,
      stageAfter: order.stage,
      evidenceCoverageAfter: order.evidenceCoverage,
    },
  };
}

export async function importGithubCiBatch(
  importedEvents: GithubCiBatchImportItem[],
): Promise<GithubCiBatchImportResult> {
  await delay();
  const events = importedEvents
    .map((item) => ({
      ...item,
      learnerHash: looksPseudonymous(item.learnerHash)
        ? item.learnerHash
        : `stu_hash_${stableHash(item.learnerHash || item.learnerAlias || "anonymous")}`,
      repository: item.repository || "se-course/rest-api-lab",
      ciProvider: item.ciProvider || "GitHub Actions",
      courseClass: item.courseClass || "软件工程 2301",
      courseName: item.courseName || "REST API 错误处理与边界测试",
      owner: item.owner || "任课教师",
      eventDate: item.eventDate || new Date().toISOString().slice(0, 10),
    }))
    .filter((item) => item.learnerHash && item.prUrl && item.ciRunUrl && item.ciLogSummary);

  if (events.length === 0) {
    throw new Error("请至少保留一条包含 learnerHash、PR、CI 和日志摘要的记录。");
  }

  if (readApiBaseUrl()) {
    try {
      const data = await apiJson<{
        snapshot?: WorkbenchSnapshot;
        createdCount?: number;
        skippedCount?: number;
        workOrders?: LearningWorkOrder[];
        skipped?: string[];
        integrationEvent?: GithubIntegrationRun;
      }>(`/api/integrations/github/batch-import`, {
          method: "POST",
          body: JSON.stringify({
            tenantId,
            courseId,
            idempotencyKey: `${events[0]?.eventDate || "batch"}:${events.length}`,
            importedEvents: events,
          }),
        });
      const apiSnapshot = asSnapshot(data);
      writeSnapshot(apiSnapshot);
      return {
        snapshot: clone(apiSnapshot),
        createdCount: Number(data.createdCount ?? data.workOrders?.length ?? 0),
        skippedCount: Number(data.skippedCount ?? data.skipped?.length ?? 0),
        importedWorkOrderIds: (data.workOrders ?? [])
          .map((order) => order.id),
        skipped: data.skipped ?? [],
        integrationStatus: await getGithubIntegrationStatus(),
      };
    } catch (error) {
      console.warn("[SE-Path] GitHub batch import API unavailable, using local import.", error);
    }
  }

  const snapshot = readSnapshot();
  const createdAt = nowText();
  const createdIds: string[] = [];
  const skipped: string[] = [];

  for (const item of events.slice(0, 40)) {
    const suffix = stableHash(
      [
        item.idempotencyKey || "github-batch",
        item.learnerHash,
        item.prUrl,
        item.ciRunUrl,
      ].join(":"),
    );
    const orderId = `wo-live-${suffix}`;
    if (snapshot.workOrders.some((order) => order.id === orderId)) {
      skipped.push(orderId);
      continue;
    }
    const created = createLocalGithubBatchOrder(item, suffix, createdAt);
    snapshot.workOrders.unshift(created.order);
    snapshot.ledger[created.order.id] = [created.ledgerEntry];
    snapshot.studentReturn[created.order.id] = emptyStudentReturnState();
    snapshot.selectedId = created.order.id;
    createdIds.push(created.order.id);
  }

  snapshot.updatedAt = createdAt;
  const next = withLocalReturnTokens(snapshot);
  writeSnapshot(next);
  const integrationStatus = writeLocalGithubIntegrationRun({
    id: `local-github-batch-${stableHash(`${createdAt}:${events.length}:${createdIds.join("|")}:${skipped.join("|")}`)}`,
    tenantId,
    courseId,
    learnerHash: "",
    provider: "github",
    source: "github-ci-batch",
    status: createdIds.length > 0 && skipped.length > 0 ? "partial" : createdIds.length > 0 ? "created" : "deduped",
    authMode: "local-import",
    deliveryId: "",
    githubEvent: "batch-import",
    repository: events[0]?.repository || "se-course/rest-api-lab",
    branch: "",
    prUrl: "",
    ciRunUrl: "",
    workOrderId: createdIds[0] || skipped[0] || "",
    workOrderIds: createdIds,
    createdCount: createdIds.length,
    skippedCount: skipped.length,
    summary: `Batch import: ${createdIds.length} created, ${skipped.length} skipped`,
    createdAt,
    updatedAt: createdAt,
  });
  return {
    snapshot: clone(next),
    createdCount: createdIds.length,
    skippedCount: skipped.length,
    importedWorkOrderIds: createdIds,
    skipped,
    integrationStatus,
  };
}

export async function checkApiConnection(): Promise<ApiConnectionCheck> {
  const base = readApiBaseUrl();
  if (!base) {
    return {
      ok: false,
      mode: "offline",
      message: "未配置后端 API 地址，当前使用本地离线数据。",
    };
  }
  let health: HealthResponse | null = null;
  try {
    health = await apiJson<HealthResponse>("/api/health");
  } catch (error) {
    console.warn("[SE-Path] Health endpoint unavailable.", error);
  }
  try {
    const session = await apiJson<AuthSessionResponse>(`/api/auth/session?${scopedQuery()}`);
    let settings: Partial<CourseSettingsConfig> | null = null;
    try {
      settings = await loadRemoteCourseSettings();
    } catch (error) {
      console.warn("[SE-Path] Course settings endpoint unavailable.", error);
    }
    const storageMode = session.storageMode ?? "edge-api";
    return {
      ok: true,
      mode: "edge",
      message: "已连接后端，课程配置、工单复核和证据账本将写入 Edge API。",
      role: session.actor?.role ?? "teacher",
      capabilities: session.capabilities ?? [],
      settings: settings ?? undefined,
      storageMode,
      authMode: session.actor?.authMode ?? health?.authMode,
      backendStatus: health?.status,
      readiness: health?.readiness,
      requiresToken: true,
    };
  } catch (error) {
    const needsToken = Boolean(
      base &&
        !readApiAccessToken() &&
        (health?.authMode === "hmac-token" || !isLocalApiBaseUrl(base)),
    );
    return {
      ok: false,
      mode: "edge",
      message: needsToken
        ? "已配置云端 API，但缺少短期访问令牌。请先由后端签发教师、学生回流或只读巡检令牌。"
        : error instanceof Error ? error.message : "后端 API 连接失败。",
      storageMode: health?.storageMode,
      authMode: health?.authMode,
      backendStatus: health?.status,
      readiness: health?.readiness,
      requiresToken: needsToken || health?.authMode === "hmac-token",
    };
  }
}

export async function loginWithTeacherAccessCode(
  accessCode: string,
): Promise<TeacherAccessLoginResult> {
  const trimmed = accessCode.trim();
  if (!trimmed) throw new Error("请输入教师访问码");
  const result = await apiJson<TeacherAccessLoginResult>("/api/auth/teacher-login", {
    method: "POST",
    body: JSON.stringify({
      tenantId,
      courseId,
      accessCode: trimmed,
      ttlSeconds: 4 * 60 * 60,
    }),
  });
  if (!result.accessToken) throw new Error("后端未返回访问令牌");
  saveApiAccessToken(result.accessToken);
  return result;
}

function extractLineValue(text: string, label: string) {
  const line = text
    .split(/\r?\n/)
    .find((item) => item.trim().startsWith(`${label}：`) || item.trim().startsWith(`${label}:`));
  if (!line) return "";
  return line.replace(new RegExp(`^${label}[：:]`), "").trim();
}

function asSnapshot(data: unknown): WorkbenchSnapshot {
  const payload = (data as { snapshot?: WorkbenchSnapshot }).snapshot ?? (data as WorkbenchSnapshot);
  if (!payload || !Array.isArray(payload.workOrders) || !payload.selectedId) {
    throw new Error("Edge API returned an invalid workbench snapshot");
  }
  return normalizeSnapshot({
    selectedId: payload.selectedId,
    workOrders: payload.workOrders,
    ledger: payload.ledger ?? {},
    studentReturn: payload.studentReturn ?? {},
    updatedAt: payload.updatedAt ?? nowText(),
  });
}

async function getApiSnapshot(selectedId = "") {
  if (currentEntryMode() === "student") {
    const orderId = selectedId || currentStudentOrderId();
    const returnToken = currentStudentReturnToken();
    if (!orderId) throw new Error("student order id is required");
    const query = new URLSearchParams({ tenantId, courseId });
    if (returnToken) query.set("returnToken", returnToken);
    const data = (await apiJson(
      `/api/work-orders/${encodeURIComponent(orderId)}?${query.toString()}`,
    )) as {
      workOrder: LearningWorkOrder;
      ledger?: EvidenceLedgerEntry[];
      studentReturn?: StudentReturnState;
      storageMode?: string;
      stored?: boolean;
    };
    return asSnapshot({
      selectedId: data.workOrder.id,
      workOrders: [data.workOrder],
      ledger: { [data.workOrder.id]: data.ledger ?? [] },
      studentReturn: {
        [data.workOrder.id]:
          data.studentReturn ?? emptyStudentReturnState(),
      },
      updatedAt: nowText(),
      storageMode: data.storageMode,
      stored: data.stored,
    });
  }
  const query = new URLSearchParams({ tenantId, courseId });
  if (selectedId) query.set("selectedId", selectedId);
  return asSnapshot(await apiJson(`/api/workbench/teacher/today?${query.toString()}`));
}

async function tryApiSnapshot(task: () => Promise<WorkbenchSnapshot>) {
  if (!readApiBaseUrl()) return null;
  try {
    const snapshot = await task();
    writeSnapshot(snapshot);
    return clone(snapshot);
  } catch (error) {
    console.warn("[SE-Path] Edge API unavailable, falling back to local mode.", error);
    return null;
  }
}

const focusProfiles: Record<
  TeacherEventIntake["focus"],
  {
    label: string;
    description: string;
    missing: Array<Pick<EvidenceEvent, "title" | "source" | "detail">>;
    recommendation: string;
    reason: string;
  }
> = {
  boundary: {
    label: "边界测试设计",
    description: "针对边界条件与异常路径的测试用例设计能力",
    missing: [
      {
        title: "异常路径检查清单",
        source: "测试策略检查表",
        detail: "补齐空值、越界、权限、网络异常等路径和预期响应。",
      },
      {
        title: "最小失败用例",
        source: "故障最小化原则",
        detail: "提交 2-3 个可复现的最小失败场景，不提交完整修复答案。",
      },
    ],
    recommendation: "先补异常路径检查清单和最小失败用例，不展示完整答案或可直接提交代码。",
    reason: "补证据成本低，能区分真实薄弱、粗心缺测和环境问题。",
  },
  transaction: {
    label: "事务边界建模",
    description: "识别提交、回滚、重试和并发冲突路径的能力",
    missing: [
      {
        title: "事务路径说明卡",
        source: "设计卡片",
        detail: "画出正常提交、失败回滚、重试补偿三条路径。",
      },
      {
        title: "回滚断言用例",
        source: "CI Coverage",
        detail: "补充失败后数据一致性的断言，而不是只验证成功路径。",
      },
    ],
    recommendation: "退回事务路径说明卡和回滚断言用例，先验证理解再给脚手架。",
    reason: "事务问题容易被正常路径掩盖，补证据能降低误判。",
  },
  contract: {
    label: "接口契约表达",
    description: "把需求变更转化为接口约束、验收条件和协作语言的能力",
    missing: [
      {
        title: "接口契约变更卡",
        source: "需求澄清记录",
        detail: "写清输入、输出、错误码、兼容性影响和验收条件。",
      },
      {
        title: "契约回归用例",
        source: "测试清单",
        detail: "补充变更前后兼容性与异常响应的回归用例。",
      },
    ],
    recommendation: "先补接口契约变更卡，再发布低风险迁移脚手架。",
    reason: "让学生先表达约束，可避免智能体直接替学生做需求拆解。",
  },
  review: {
    label: "协作评审表达",
    description: "提出可执行评审建议、回应异议并维护协作质量的能力",
    missing: [
      {
        title: "评审争议事实卡",
        source: "PR Review",
        detail: "区分事实、建议和情绪表达，保留原始上下文。",
      },
      {
        title: "学生反思卡",
        source: "反思提交",
        detail: "说明争议点、修正策略和下一次评审承诺。",
      },
    ],
    recommendation: "转教师复核或一对一会谈，不自动给协作能力结论。",
    reason: "协作争议属于高语境判断，必须保留人工复核。",
  },
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function nowText() {
  return new Date().toLocaleString("zh-CN", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildValueAddedSnapshot(
  order: LearningWorkOrder,
  valueAdded: ValueAddedDimension,
  decision: TeacherClosureDecision,
  note = "",
): ValueAddedSnapshot | undefined {
  if (decision !== "accept") return undefined;
  const baseline = order.valueAdded.current;
  const observed = valueAdded.current;
  const expected = order.valueAdded.expected;
  const basisEvidenceIds = uniqueStrings([
    ...order.collectedEvidence.map((item) => item.id),
    ...order.missingEvidence.map((item) => item.id),
    ...(order.interventionPackage?.sourceEvidenceIds ?? []),
    `return-${order.id}-scaffoldReceived`,
    `return-${order.id}-evidenceSubmitted`,
    `return-${order.id}-reflectionSubmitted`,
  ]);

  return {
    id: `vas-${order.id}-${Date.now().toString(36)}`,
    workOrderId: order.id,
    createdAt: nowText(),
    dimension: order.valueAdded.label,
    baseline,
    expected,
    observed,
    uplift: observed - baseline,
    remainingGap: observed - expected,
    evidenceCoverage: Math.max(order.evidenceCoverage, 88),
    uncertainty: valueAdded.uncertainty,
    teacherDecision: decision,
    teacherNote: note.trim() || "教师验收通过，允许关闭本轮形成性诊断单。",
    basisEvidenceIds,
    claim: `${order.studentName}在“${order.valueAdded.label}”上完成一次可复核改进：从 ${baseline} 提升到 ${observed}，证据覆盖达到 ${Math.max(order.evidenceCoverage, 88)}%。`,
    boundary:
      "该快照仅用于形成性诊断、资源推荐和教学复盘，不用于排名、惩罚、就业预测或高风险自动决策。",
    nextTeachingAction:
      order.valueAdded.delta < 0
        ? "下一次任务继续观察迁移表现，并保留最小失败用例与反思作为复核依据。"
        : "纳入学生成长档案，后续只在新证据出现时更新判断。",
  };
}

function buildReturnedEvidenceRequirement(
  order: LearningWorkOrder,
  revision: number,
  reason: string,
): EvidenceEvent {
  return {
    id: `ev-return-${order.id}-${revision}`,
    title: `第 ${revision} 轮退回补证据要求`,
    source: "教师验收",
    status: "pending",
    detail: `教师退回意见：${cropText(reason, 140)}；学生需重新提交关键证据与学习反思后再进入验收。`,
    time: nowText(),
  };
}

function initialSnapshot(): WorkbenchSnapshot {
  return {
    selectedId: "wo-se-018",
    workOrders: clone(seedWorkOrders),
    ledger: clone(seedLedger),
    studentReturn: {},
    updatedAt: nowText(),
  };
}

function defaultCourseRoster(snapshot: WorkbenchSnapshot = initialSnapshot()): CourseRoster {
  const seen = new Set<string>();
  const learners: CourseRosterLearner[] = [];
  for (const order of snapshot.workOrders) {
    const learnerHash = learnerHashFrom({
      studentNo: order.studentNo,
      studentName: order.studentName,
    });
    if (seen.has(learnerHash)) continue;
    seen.add(learnerHash);
    learners.push({
      learnerHash,
      learnerAlias: order.studentName,
      className: order.courseClass || "软件工程 2301",
      groupName: "未分组",
      repositoryUser: "",
      status: order.status === "closed" ? "watch" : "active",
      lastActivity: order.updatedAt,
    });
  }
  if (learners.length === 0) {
    learners.push({
      learnerHash: "stu_hash_8f2a",
      learnerAlias: "LZX-0321",
      className: "软件工程 2301",
      groupName: "A 组",
      repositoryUser: "learner-0321",
      status: "active",
      lastActivity: nowText(),
    });
  }
  return {
    tenantId,
    courseId,
    courseClass: snapshot.workOrders[0]?.courseClass ?? "软件工程 2301",
    courseName: snapshot.workOrders[0]?.courseName ?? "REST API 错误处理与边界测试",
    learners,
    updatedAt: nowText(),
  };
}

function readLocalRoster(): CourseRoster {
  if (typeof window === "undefined") return defaultCourseRoster();
  const fallback = defaultCourseRoster(readSnapshot());
  const raw = window.localStorage.getItem(rosterStorageKey);
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as CourseRoster;
    if (!Array.isArray(parsed.learners) || parsed.learners.length === 0) return fallback;
    return {
      ...fallback,
      ...parsed,
      learners: parsed.learners,
    };
  } catch {
    return fallback;
  }
}

function writeLocalRoster(roster: CourseRoster) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(rosterStorageKey, JSON.stringify(roster));
  }
}

function cropText(text: string, maxLength: number) {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > maxLength ? `${compact.slice(0, maxLength)}...` : compact;
}

function uniqueStrings(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function cleanDraftText(value: string | undefined, maxLength: number) {
  const compact = String(value ?? "").replace(/\s+/g, " ").trim();
  return compact.length > maxLength ? `${compact.slice(0, maxLength)}...` : compact;
}

function cleanDraftLines(items: string[] | undefined, fallback: string[], maxItems = 8) {
  if (!Array.isArray(items)) return fallback;
  const cleaned = uniqueStrings(
    items.map((item) =>
      String(item ?? "")
        .replace(/^\s*(?:[-*]|\d+[.)、])\s*/, "")
        .trim(),
    ),
  ).slice(0, maxItems);
  return cleaned.length ? cleaned : fallback;
}

function guardedSafeBoundary(value: string | undefined, fallback: string) {
  const boundary = cleanDraftText(value, 420) || fallback;
  if (/不生成|不提供|完整答案|完整实现|可直接提交/.test(boundary)) return boundary;
  return `${boundary}；不生成可直接提交的完整实现代码，不替代教师评价。`;
}

function applyInterventionPackageDraft(
  base: InterventionTaskPackage,
  draft?: InterventionPackageDraft,
): InterventionTaskPackage {
  if (!draft) return base;
  const teacherEdited = [
    draft.title,
    draft.objective,
    draft.safeBoundary,
    draft.dueHint,
    draft.teacherNote,
    ...(draft.steps ?? []),
    ...(draft.evidenceToSubmit ?? []),
    ...(draft.rubricCheckpoints ?? []),
  ].some((item) => String(item ?? "").trim().length > 0);
  return {
    ...base,
    title: cleanDraftText(draft.title, 80) || base.title,
    objective: cleanDraftText(draft.objective, 360) || base.objective,
    safeBoundary: guardedSafeBoundary(draft.safeBoundary, base.safeBoundary),
    steps: cleanDraftLines(draft.steps, base.steps, 8),
    evidenceToSubmit: cleanDraftLines(draft.evidenceToSubmit, base.evidenceToSubmit, 10),
    rubricCheckpoints: cleanDraftLines(draft.rubricCheckpoints, base.rubricCheckpoints, 8),
    dueHint: cleanDraftText(draft.dueHint, 160) || base.dueHint,
    teacherNote: cleanDraftText(draft.teacherNote, 1200) || base.teacherNote,
    teacherEdited,
    draftVersion: teacherEdited ? 1 : undefined,
  };
}

function learnerHashForOrder(order: Pick<LearningWorkOrder, "id" | "studentNo" | "studentName">) {
  const candidate = order.studentNo.trim() || order.id;
  if (looksPseudonymous(candidate)) return candidate;
  return `stu_hash_${stableHash(`${candidate}:${order.id}:${order.studentName}`).slice(0, 12)}`;
}

function evidenceTitleById(order: LearningWorkOrder, idOrTitle: string) {
  const item = [...order.collectedEvidence, ...order.missingEvidence].find(
    (evidence) => evidence.id === idOrTitle || evidence.title === idOrTitle,
  );
  return item?.title ?? idOrTitle;
}

function fallbackScaffoldLines(order: LearningWorkOrder) {
  const missingTitles = order.missingEvidence.map((item) => item.title);
  const firstMissing = missingTitles[0] ?? "关键证据";
  const secondMissing = missingTitles[1] ?? "学习反思";
  return {
    checklist: [
      `复现触发事件：${order.trigger}，只记录第一个可稳定复现的失败点。`,
      `补齐“${firstMissing}”，覆盖至少 2 类边界或异常路径。`,
      "用 Given-When-Then 写出最小失败用例，先证明问题再决定是否修改实现。",
      "更新 PR 或学习记录，写清本次验证方式、仍不确定的点和下一步请求。",
    ],
    miniLab: [
      "本地运行与 CI 相同的测试命令，保留命令、时间和 traceId。",
      "把失败输入、期望响应和实际响应整理成三列表。",
      `提交“${secondMissing}”，说明这次差值如何迁移到下一次任务。`,
    ],
  };
}

function draftFromScaffoldOutcome(
  order: LearningWorkOrder,
  outcome: Partial<AiScaffoldDraftResult>,
): InterventionPackageDraft {
  const meta = order.selectedDecision ? interventionPackageMeta(order.selectedDecision) : undefined;
  const fallback = fallbackScaffoldLines(order);
  const checklist = cleanDraftLines(outcome.checklist, fallback.checklist, 6);
  const miniLab = cleanDraftLines(outcome.miniLab, fallback.miniLab, 5);
  const evidenceFromModel = cleanDraftLines(outcome.evidenceToSubmit, [], 8).map((item) =>
    evidenceTitleById(order, item),
  );
  const citations = cleanDraftLines(outcome.citations, [], 6).map((item) => evidenceTitleById(order, item));
  const missingTitles = packageMissingTitlesFromOrder(order);
  const decisionLead = meta?.leadAction ?? "先由教师确认下一步，再开放学生回流入口。";
  const modeLabel = outcome.mode === "governed-llm" ? "模型网关" : "安全兜底";
  const reason = outcome.reason ? `；原因：${cropText(outcome.reason, 90)}` : "";

  return {
    title: meta?.title ?? "安全脚手架任务包",
    objective: `${order.studentName}围绕“${order.valueAdded.label}”完成一次可复核改进：${decisionLead}`,
    safeBoundary: guardedSafeBoundary(
      outcome.refusal,
      "只提供检查清单、最小失败用例、证据要求和反思脚手架；不生成可直接提交的完整实现代码，不替代教师评价。",
    ),
    steps: cleanDraftLines([...checklist, ...miniLab], [...fallback.checklist, ...fallback.miniLab], 8),
    evidenceToSubmit: cleanDraftLines(
      [
        ...missingTitles,
        ...evidenceFromModel,
        "最小失败用例清单",
        "CI 重新运行记录或截图",
        "PR 变更说明与自测摘要",
        "120-180 字学习反思",
      ],
      ["最小失败用例清单", "CI 重新运行记录或截图", "120-180 字学习反思"],
      10,
    ),
    rubricCheckpoints: [
      "能把失败现象转成可复现的测试条件。",
      "能说明边界检查、异常路径和最小修复的先后顺序。",
      "提交证据足以让教师复核，不依赖口头承诺。",
      citations.length ? `引用证据或知识源：${citations.join("、")}` : "缺证据时标记为不确定，不强行给结论。",
    ],
    dueHint: "建议本次课后 24 小时内提交；教师可按班级节奏调整。",
    teacherNote: `${modeLabel}已生成候选任务包${reason}。教师确认后才发布给学生。`,
  };
}

function packageMissingTitlesFromOrder(order: LearningWorkOrder) {
  return order.missingEvidence.map((item) => item.title);
}

function buildLocalAiScaffoldResult(
  order: LearningWorkOrder,
  reason: string,
  gatewayBaseUrl: string,
): AiScaffoldDraftResult {
  const fallback = fallbackScaffoldLines(order);
  const result: Omit<AiScaffoldDraftResult, "draft"> = {
    runtime: "sepath-yudao-teacher-console.v1",
    contractVersion: "sepath-scaffold-response.v1",
    mode: "local-rule-fallback",
    fallback: true,
    reason,
    traceId: `trace-local-agent-${stableHash(`${order.id}:${order.updatedAt}:${reason}`).slice(0, 12)}`,
    refusal:
      "我不能直接给可复制提交的完整代码，但可以根据证据链帮你定位失败路径、设计最小修复实验，并告诉你需要提交哪些证据。",
    checklist: fallback.checklist,
    miniLab: fallback.miniLab,
    evidenceToSubmit: uniqueStrings([
      ...order.missingEvidence.map((item) => item.id),
      ...order.missingEvidence.map((item) => item.title),
    ]),
    citations: uniqueStrings([
      ...order.collectedEvidence.map((item) => item.id),
      order.valueAdded.label,
      "Safe-VOI",
      "形成性增值评价",
    ]),
    teacherReviewRequired: true,
    guardrailHits: ["no-direct-answer", "privacy-minimization", "teacher-release"],
    gatewayBaseUrl,
  };
  return {
    ...result,
    draft: draftFromScaffoldOutcome(order, result),
  };
}

function normalizeAiScaffoldResult(
  order: LearningWorkOrder,
  outcome: Partial<AiScaffoldDraftResult>,
  gatewayBaseUrl: string,
): AiScaffoldDraftResult {
  const fallback = buildLocalAiScaffoldResult(order, "schema-fill", gatewayBaseUrl);
  const result: Omit<AiScaffoldDraftResult, "draft"> = {
    runtime: cleanDraftText(outcome.runtime, 80) || fallback.runtime,
    contractVersion:
      cleanDraftText(outcome.contractVersion, 80) || "sepath-scaffold-response.v1",
    mode: cleanDraftText(outcome.mode, 80) || fallback.mode,
    fallback: Boolean(outcome.fallback ?? fallback.fallback),
    reason: cleanDraftText(outcome.reason, 220) || fallback.reason,
    provider: cleanDraftText(outcome.provider, 80) || outcome.provider,
    traceId: cleanDraftText(outcome.traceId, 120) || fallback.traceId,
    refusal: guardedSafeBoundary(outcome.refusal, fallback.refusal),
    checklist: cleanDraftLines(outcome.checklist, fallback.checklist, 8),
    miniLab: cleanDraftLines(outcome.miniLab, fallback.miniLab, 6),
    evidenceToSubmit: cleanDraftLines(outcome.evidenceToSubmit, fallback.evidenceToSubmit, 10),
    citations: cleanDraftLines(outcome.citations, fallback.citations, 8),
    teacherReviewRequired: Boolean(outcome.teacherReviewRequired ?? true),
    guardrailHits: cleanDraftLines(outcome.guardrailHits, fallback.guardrailHits, 12),
    gatewayBaseUrl,
  };
  return {
    ...result,
    draft: draftFromScaffoldOutcome(order, result),
  };
}

export async function generateAiScaffoldDraft(
  order: LearningWorkOrder,
  options: { llmGatewayBaseUrl?: string } = {},
): Promise<AiScaffoldDraftResult> {
  const explicitGatewayBase =
    options.llmGatewayBaseUrl !== undefined ? normalizeApiBase(options.llmGatewayBaseUrl) : "";
  if (options.llmGatewayBaseUrl !== undefined) {
    saveLlmGatewayBaseUrl(explicitGatewayBase);
  }
  const gatewayBaseUrl = explicitGatewayBase || readLlmGatewayBaseUrl();
  if (!gatewayBaseUrl) {
    return buildLocalAiScaffoldResult(order, "gateway-not-configured", "");
  }

  const learnerHash = learnerHashForOrder(order);
  const evidenceEventIds = uniqueStrings(
    [...order.collectedEvidence, ...order.missingEvidence].map((item) => item.id),
  ).slice(0, 12);
  const knowledgeSourceIds = uniqueStrings([
    ...order.collectedEvidence.map((item) => item.source),
    ...order.missingEvidence.map((item) => item.source),
    order.valueAdded.label,
    "Safe-VOI",
    "形成性增值评价",
  ]).slice(0, 8);
  const traceSeed = `${order.id}:${order.updatedAt}:${order.selectedDecision ?? "none"}`;
  const payload = {
    tenantId,
    courseId,
    learnerHash,
    workOrderId: order.id,
    taskId: order.id,
    traceId: `trace-agent-${stableHash(traceSeed).slice(0, 12)}`,
    intent: "generate_safe_scaffold_package",
    promptVersion: "sepath-scaffold-v1",
    evidenceEventIds,
    knowledgeSourceIds,
    guardrails: [
      "teacher-release",
      "no-direct-answer",
      "privacy-minimization",
      "evidence-grounding",
      "formative-only",
    ],
    noKeyFallback: true,
    requestedOutputSchema: {
      refusal: "string",
      checklist: "string[]",
      miniLab: "string[]",
      evidenceToSubmit: "string[]",
      citations: "string[]",
      teacherReviewRequired: "boolean",
    },
  };

  try {
    const outcome = await llmGatewayJson<Partial<AiScaffoldDraftResult>>(
      "/api/ai/generate-scaffold",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      learnerHash,
      gatewayBaseUrl,
    );
    return normalizeAiScaffoldResult(order, outcome, gatewayBaseUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "agent-gateway-error";
    console.warn("[SE-Path] AI scaffold gateway unavailable, using local safe fallback.", error);
    return buildLocalAiScaffoldResult(order, message, gatewayBaseUrl);
  }
}

function interventionPackageMeta(decision: TeacherDecision): {
  title: string;
  status: InterventionTaskPackage["status"];
  orderStatus: WorkOrderStatus;
  stageAfter: string;
  coverageAfter: number;
  leadAction: string;
} {
  if (decision === "returnEvidence") {
    return {
      title: "补证据任务包",
      status: "returned_for_evidence",
      orderStatus: "evidence",
      stageAfter: "验证修复",
      coverageAfter: 42,
      leadAction: "先把缺失证据补齐，再由教师重新诊断。",
    };
  }
  if (decision === "humanTalk") {
    return {
      title: "人工会谈准备包",
      status: "human_talk",
      orderStatus: "review",
      stageAfter: "教师复核",
      coverageAfter: 44,
      leadAction: "先准备事实卡与问题清单，课堂或课后一对一确认真实卡点。",
    };
  }
  return {
    title: "安全脚手架任务包",
    status: "ready_for_student",
    orderStatus: "intervention",
    stageAfter: "实时干预",
    coverageAfter: 54,
    leadAction: "在安全边界内完成测试清单、最小失败用例和修复证据。",
  };
}

function buildLocalInterventionPackage(
  order: LearningWorkOrder,
  note = "",
  draft?: InterventionPackageDraft,
): InterventionTaskPackage {
  if (!order.selectedDecision) {
    throw new Error("教师先完成复核决定，才能发布学生任务包。");
  }
  const meta = interventionPackageMeta(order.selectedDecision);
  const missingTitles = order.missingEvidence.map((item) => item.title);
  const firstMissing = missingTitles[0] ?? "关键证据";
  const secondMissing = missingTitles[1] ?? "学习反思";
  const teacherMessage =
    note.trim() || order.teacherNote || "教师已确认：只发布检查清单、最小失败用例和反思要求。";

  const basePackage: InterventionTaskPackage = {
    id: `pkg-${order.id}-${Date.now().toString(36)}`,
    workOrderId: order.id,
    title: meta.title,
    status: meta.status,
    objective: `${order.studentName}围绕“${order.valueAdded.label}”完成一次可复核改进：${meta.leadAction}`,
    safeBoundary:
      "只提供检查清单、最小失败用例、证据要求和反思脚手架；不生成可直接提交的完整实现代码，不替代教师评价。",
    steps: [
      `复读本次触发事件：${order.trigger}，记录实际结果、期望结果和失败输入。`,
      `补齐“${firstMissing}”，至少覆盖空值、越界、权限或异常路径中的 2 类场景。`,
      `构造 2 个最小失败用例，先让失败可复现，再提交最小修复或说明无需改代码的证据。`,
      "更新 PR 描述或学习记录：写清变更范围、验证方式、仍不确定的点。",
      `提交“${secondMissing}”：用 120-180 字说明这次能力差值如何迁移到下一次任务。`,
    ],
    evidenceToSubmit: uniqueStrings([
      ...missingTitles,
      "最小失败用例清单",
      "CI 重新运行记录或截图",
      "PR 变更说明与自测摘要",
      "120-180 字学习反思",
    ]),
    rubricCheckpoints: [
      "能把失败现象转成可复现的测试条件。",
      "能区分边界检查、异常路径和实现修复的先后顺序。",
      "证据足以让教师复核，不依赖口头承诺。",
      "反思说明下一次如何迁移，而不是只描述本次结果。",
    ],
    dueHint: "建议本次课后 24 小时内提交；教师可在复核面板中调整。",
    teacherNote: teacherMessage,
    createdBy: order.owner || "任课教师",
    createdAt: nowText(),
    sourceEvidenceIds: uniqueStrings([
      ...order.collectedEvidence.map((item) => item.id),
      ...order.missingEvidence.map((item) => item.id),
    ]),
    valueAddedFocus: order.valueAdded.label,
  };
  return applyInterventionPackageDraft(basePackage, {
    ...draft,
    teacherNote: draft?.teacherNote ?? teacherMessage,
  });
}

function inferRisk(intake: TeacherEventIntake): RiskLevel {
  const text = `${intake.trigger} ${intake.evidenceText} ${intake.studentHelpText}`;
  const highSignals = ["CI 失败", "500", "越界", "权限", "绕过", "直接给代码", "无法运行"];
  const mediumSignals = ["覆盖不足", "缺少", "超时", "回滚", "争议", "不确定"];
  if (highSignals.some((signal) => text.includes(signal))) return "high";
  if (mediumSignals.some((signal) => text.includes(signal))) return "medium";
  return "low";
}

function inferCoverage(intake: TeacherEventIntake) {
  let coverage = 32;
  if (intake.evidenceText.trim().length > 40) coverage += 10;
  if (intake.studentHelpText.trim()) coverage += 8;
  if (/CI|PR|Git|Actions/i.test(intake.evidenceText)) coverage += 6;
  return Math.min(72, coverage);
}

function buildValueAdded(
  focus: TeacherEventIntake["focus"],
  risk: RiskLevel,
  coverage: number,
): ValueAddedDimension {
  const current = risk === "high" ? 50 : risk === "medium" ? 60 : 68;
  const expected = current + (risk === "high" ? 6 : risk === "medium" ? 4 : 3);
  return {
    label: focusProfiles[focus].label,
    current,
    expected,
    delta: current - expected,
    uncertainty: coverage < 50 ? "high" : risk === "low" ? "low" : "medium",
    description: focusProfiles[focus].description,
  };
}

function createLocalBatchOrder(
  learner: CourseRosterLearner,
  task: CourseBatchTask,
  suffix: string,
  createdAt: string,
): {
  order: LearningWorkOrder;
  ledgerEntry: EvidenceLedgerEntry;
} {
  const profile = focusProfiles[task.focus];
  const coverage = 30;
  const current = task.risk === "high" ? 48 : task.risk === "medium" ? 52 : 60;
  const expected = Math.max(current + 4, current + (task.risk === "high" ? 8 : 6));
  const order: LearningWorkOrder = {
    id: `wo-batch-${suffix}`,
    studentName: learner.learnerAlias,
    studentNo: learner.learnerHash,
    courseClass: task.courseClass,
    courseName: task.courseName,
    trigger: task.trigger,
    eventDate: task.eventDate,
    risk: task.risk,
    status: "diagnosis",
    owner: task.owner || "任课教师",
    updatedAt: "刚刚",
    summary: `${profile.label}进入课程批量巡检，当前只形成低证据覆盖的候选诊断。`,
    evidenceCoverage: coverage,
    stage: "学情诊断",
    diagnosis: `系统根据课程名单与任务配置为 ${learner.learnerAlias} 建立候选诊断单。当前尚未接入完整 PR/CI/对话/反思证据，只能作为形成性跟进入口。`,
    valueAdded: {
      label: profile.label,
      current,
      expected,
      delta: current - expected,
      uncertainty: "high",
      description: profile.description,
    },
    collectedEvidence: [
      {
        id: `ev-roster-${suffix}`,
        title: "班级名单映射",
        source: "课程名单",
        status: "collected",
        detail: `已确认伪名学习者 ${learner.learnerHash} 属于 ${learner.className}，不包含真实姓名或邮箱。`,
        time: createdAt,
      },
      {
        id: `ev-task-${suffix}`,
        title: "课程任务配置",
        source: "教师批量巡检",
        status: "pending",
        detail: cropText(task.taskSummary, 180),
        time: createdAt,
      },
    ],
    missingEvidence: profile.missing.map((item, index) => ({
      id: `ev-batch-missing-${suffix}-${index + 1}`,
      title: item.title,
      source: item.source,
      status: index === 0 ? "missing" : "pending",
      detail: item.detail,
    })),
    safeVoiRecommendation: `先补${profile.missing[0]?.title ?? "关键证据"}，再由教师决定是否发布脚手架。`,
    safeVoiReason: "批量巡检只降低发现成本，不替代教师判断；证据不足时保持不确定。",
    stages: createStages("diagnosis"),
  };
  return {
    order,
    ledgerEntry: {
      id: `ledger-batch-${suffix}`,
      type: "intake",
      time: createdAt,
      actor: task.owner || "任课教师",
      title: "课程批量巡检生成候选诊断单",
      source: "课程名单与任务配置",
      detail: cropText(`${task.trigger}：${task.taskSummary}`, 180),
      traceId: `batch-${order.id}`,
      stageAfter: order.stage,
      evidenceCoverageAfter: order.evidenceCoverage,
    },
  };
}

function readSnapshot(): WorkbenchSnapshot {
  if (typeof window === "undefined") return initialSnapshot();
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return initialSnapshot();

  try {
    const parsed = JSON.parse(raw) as WorkbenchSnapshot;
    if (!Array.isArray(parsed.workOrders) || !parsed.selectedId) {
      return initialSnapshot();
    }
    return normalizeSnapshot(parsed);
  } catch {
    return initialSnapshot();
  }
}

function writeSnapshot(snapshot: WorkbenchSnapshot) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
  }
}

async function delay() {
  const timer = typeof window === "undefined" ? setTimeout : window.setTimeout;
  await new Promise((resolve) => timer(resolve, 120));
}

export async function getTeacherWorkbench(): Promise<WorkbenchSnapshot> {
  await delay();
  const apiSnapshot = await tryApiSnapshot(() => getApiSnapshot());
  if (apiSnapshot) return apiSnapshot;
  const snapshot = withLocalReturnTokens(readSnapshot());
  writeSnapshot(snapshot);
  return clone(snapshot);
}

export async function selectWorkOrder(id: string): Promise<WorkbenchSnapshot> {
  await delay();
  const apiSnapshot = await tryApiSnapshot(() => getApiSnapshot(id));
  if (apiSnapshot) return apiSnapshot;
  const snapshot = readSnapshot();
  snapshot.selectedId = id;
  snapshot.updatedAt = nowText();
  const next = withLocalReturnTokens(snapshot);
  writeSnapshot(next);
  return clone(next);
}

export async function reviewWorkOrder(
  orderId: string,
  decision: TeacherDecision,
  note: string,
): Promise<WorkbenchSnapshot> {
  await delay();
  const apiSnapshot = await tryApiSnapshot(async () =>
    asSnapshot(
      await apiJson(`/api/work-orders/${encodeURIComponent(orderId)}/review`, {
        method: "POST",
        body: JSON.stringify({
          tenantId,
          courseId,
          decision,
          teacherNote: note,
        }),
      }),
    ),
  );
  if (apiSnapshot) return apiSnapshot;
  const snapshot = readSnapshot();
  const currentOrder = snapshot.workOrders.find((item) => item.id === orderId);
  if (currentOrder?.status === "closed") {
    throw new Error("诊断单已关闭，不能重复复核。");
  }
  const meta = decisionMeta[decision];
  snapshot.workOrders = snapshot.workOrders.map((order) => {
    if (order.id !== orderId) return order;
    return {
      ...order,
      status: meta.statusAfter,
      stage: meta.stageAfter,
      evidenceCoverage: meta.coverageAfter,
      selectedDecision: decision,
      teacherNote: note,
      interventionPackage: undefined,
      stages: createStages(meta.statusAfter),
    };
  });

  snapshot.ledger[orderId] = [
    {
      id: `ledger-decision-${decision}-${Date.now()}`,
      type: "decision",
      time: nowText(),
      actor: "张老师",
      title: meta.label,
      source: "教师复核",
      detail: note ? `${meta.detail} 备注：${note}` : meta.detail,
      traceId: `review-${orderId}-${decision}`,
      decision,
      stageAfter: meta.stageAfter,
      evidenceCoverageAfter: meta.coverageAfter,
    },
    ...(snapshot.ledger[orderId] ?? []),
  ];

  snapshot.updatedAt = nowText();
  const next = withLocalReturnTokens(snapshot);
  writeSnapshot(next);
  return clone(next);
}

export async function publishInterventionPackage(
  orderId: string,
  note = "",
  draft?: InterventionPackageDraft,
): Promise<WorkbenchSnapshot> {
  await delay();
  const packageDraft =
    draft && Object.keys(draft).some((key) => {
      const value = draft[key as keyof InterventionPackageDraft];
      return Array.isArray(value) ? value.length > 0 : String(value ?? "").trim().length > 0;
    })
      ? draft
      : undefined;
  const apiSnapshot = await tryApiSnapshot(async () =>
    asSnapshot(
      await apiJson(`/api/work-orders/${encodeURIComponent(orderId)}/intervention-package`, {
        method: "POST",
        body: JSON.stringify({
          tenantId,
          courseId,
          teacherNote: note,
          ...(packageDraft ? { packageDraft } : {}),
        }),
      }),
    ),
  );
  if (apiSnapshot) return apiSnapshot;

  const snapshot = readSnapshot();
  const order = snapshot.workOrders.find((item) => item.id === orderId);
  if (!order) throw new Error("未找到当前诊断单。");
  if (order.status === "closed") {
    throw new Error("诊断单已关闭，不能继续发布任务包。");
  }
  const taskPackage = buildLocalInterventionPackage(order, note, packageDraft);
  const meta = interventionPackageMeta(order.selectedDecision as TeacherDecision);
  const updated: LearningWorkOrder = {
    ...order,
    interventionPackage: taskPackage,
    status: meta.orderStatus,
    stage: meta.stageAfter,
    evidenceCoverage: Math.max(order.evidenceCoverage, meta.coverageAfter),
    updatedAt: nowText(),
    stages: createStages(meta.orderStatus),
  };
  snapshot.workOrders = snapshot.workOrders.map((item) =>
    item.id === orderId ? updated : item,
  );
  snapshot.ledger[orderId] = [
    {
      id: `ledger-package-${Date.now()}`,
      type: "intervention_package",
      time: nowText(),
      actor: updated.owner || "任课教师",
      title: taskPackage.title,
      source: "教师发布",
      detail: `${taskPackage.teacherEdited ? "教师编辑确认后发布。 " : ""}${taskPackage.objective} 安全边界：${taskPackage.safeBoundary}`,
      traceId: `package-${orderId}`,
      stageAfter: updated.stage,
      evidenceCoverageAfter: updated.evidenceCoverage,
    },
    ...(snapshot.ledger[orderId] ?? []),
  ];
  snapshot.updatedAt = nowText();
  const next = withLocalReturnTokens(snapshot);
  writeSnapshot(next);
  return clone(next);
}

export async function createWorkOrderFromIntake(
  intake: TeacherEventIntake,
): Promise<WorkbenchSnapshot> {
  await delay();
  const prUrl = extractLineValue(intake.evidenceText, "PR");
  const ciRunUrl = extractLineValue(intake.evidenceText, "CI");
  const repository = extractLineValue(intake.evidenceText, "仓库") || "se-course/rest-api-lab";
  const branch = extractLineValue(intake.evidenceText, "分支");
  const ciProvider = extractLineValue(intake.evidenceText, "CI 提供方") || "GitHub Actions";
  const ciLogSummary = extractLineValue(intake.evidenceText, "日志摘要") || intake.evidenceText;
  const learnerHash = learnerHashFrom(intake);
  const apiSnapshot = await tryApiSnapshot(async () => {
    if (!prUrl || !ciRunUrl) {
      throw new Error("PR URL and CI URL are required for live GitHub import");
    }
    return asSnapshot(
      await apiJson(`/api/integrations/github/import`, {
        method: "POST",
        body: JSON.stringify({
          tenantId,
          courseId,
          learnerHash,
          learnerAlias: `SE-${stableHash(learnerHash).slice(0, 4).toUpperCase()}`,
          repository,
          branch,
          prUrl,
          ciRunUrl,
          ciProvider,
          ciLogSummary,
          courseClass: intake.courseClass,
          courseName: intake.courseName,
          owner: intake.owner,
          idempotencyKey: `${learnerHash}:${prUrl}:${ciRunUrl}`,
        }),
      }),
    );
  });
  if (apiSnapshot) return apiSnapshot;

  const snapshot = readSnapshot();
  const createdAt = nowText();
  const suffix = Date.now().toString(36);
  const profile = focusProfiles[intake.focus];
  const risk = inferRisk(intake);
  const coverage = inferCoverage(intake);
  const valueAdded = buildValueAdded(intake.focus, risk, coverage);

  const collectedEvidence: EvidenceEvent[] = [
    {
      id: `ev-intake-${suffix}`,
      title: "教师导入学习事件",
      source: "试点接入表单",
      status: "collected",
      detail: cropText(intake.evidenceText, 160),
      time: createdAt,
    },
  ];

  if (intake.studentHelpText.trim()) {
    collectedEvidence.push({
      id: `ev-help-${suffix}`,
      title: "学生求助/反思片段",
      source: "学生对话或课堂记录",
      status: "collected",
      detail: cropText(intake.studentHelpText, 140),
      time: createdAt,
    });
  }

  const missingEvidence: EvidenceEvent[] = profile.missing.map((item, index) => ({
    id: `ev-missing-${suffix}-${index + 1}`,
    title: item.title,
    source: item.source,
    status: "missing",
    detail: item.detail,
  }));

  const order: LearningWorkOrder = {
    id: `wo-live-${suffix}`,
    studentName: intake.studentName.trim(),
    studentNo: intake.studentNo.trim(),
    courseClass: intake.courseClass.trim() || "软件工程课程",
    courseName: intake.courseName.trim() || "课程任务",
    trigger: intake.trigger.trim(),
    eventDate: intake.eventDate.trim() || new Date().toISOString().slice(0, 10),
    risk,
    status: "diagnosis",
    owner: intake.owner.trim() || "任课教师",
    updatedAt: "刚刚",
    summary: `${profile.label}证据不足，建议先由教师确认 Safe-VOI 下一步。`,
    evidenceCoverage: coverage,
    stage: "学情诊断",
    diagnosis: `系统从真实学习事件中提取到“${profile.label}”相关风险信号。当前只形成候选诊断，需教师依据证据决定补证据、脚手架或人工会谈。`,
    valueAdded,
    collectedEvidence,
    missingEvidence,
    safeVoiRecommendation: profile.recommendation,
    safeVoiReason: profile.reason,
    stages: createStages("diagnosis"),
  };

  snapshot.selectedId = order.id;
  snapshot.workOrders = [order, ...snapshot.workOrders];
  snapshot.studentReturn[order.id] = emptyStudentReturnState();
  snapshot.ledger[order.id] = [
    {
      id: `ledger-intake-${suffix}`,
      type: "intake",
      time: createdAt,
      actor: order.owner,
      title: "导入真实学习事件并生成诊断单",
      source: "教师试点接入",
      detail: cropText(`${order.trigger}：${intake.evidenceText}`, 180),
      traceId: `intake-${order.id}`,
      stageAfter: "学情诊断",
      evidenceCoverageAfter: coverage,
    },
  ];
  snapshot.updatedAt = createdAt;
  const next = withLocalReturnTokens(snapshot);
  writeSnapshot(next);
  return clone(next);
}

export async function recordStudentReturn(
  orderId: string,
  step: StudentReturnStep,
  content = "",
  artifact?: StudentReturnArtifact,
): Promise<WorkbenchSnapshot> {
  await delay();
  const localBeforeReturn = readSnapshot();
  const learnerHash =
    localBeforeReturn.workOrders.find((item) => item.id === orderId)?.studentNo ||
    localBeforeReturn.workOrders.find((item) => item.id === orderId)?.id ||
    "stu_hash_8f2a";
  const apiSnapshot = await tryApiSnapshot(async () =>
    asSnapshot(
      await apiJson(
        `/api/work-orders/${encodeURIComponent(orderId)}/student-return`,
        {
          method: "POST",
          body: JSON.stringify({
            tenantId,
            courseId,
            learnerHash: looksPseudonymous(learnerHash) ? learnerHash : `stu_hash_${stableHash(learnerHash)}`,
            returnToken: currentStudentReturnToken(),
            step,
            content,
            artifact,
          }),
        },
        looksPseudonymous(learnerHash) ? learnerHash : `stu_hash_${stableHash(learnerHash)}`,
      ),
    ),
  );
  if (apiSnapshot) return apiSnapshot;

  const snapshot = readSnapshot();
  const state = normalizeStudentReturnState(snapshot.studentReturn[orderId]);
  state[step] = true;
  snapshot.studentReturn[orderId] = state;

  const completed = countStudentReturnSteps(state);
  const order = snapshot.workOrders.find((item) => item.id === orderId);
  if (order?.status === "closed") {
    throw new Error("教师已验收关闭，学生回流入口已停止写入。");
  }
  if (order) {
    order.evidenceCoverage = Math.max(order.evidenceCoverage, 48 + completed * 10);
    if (completed === 1) {
      order.status = "intervention";
      order.stage = "实时干预";
    } else if (completed === 2) {
      order.status = "evidence";
      order.stage = "验证修复";
    } else {
      order.status = "review";
      order.stage = "教师验收";
    }
    order.stages = createStages(order.status);
  }

  const titles: Record<StudentReturnStep, string> = {
    scaffoldReceived: "学生已接收脚手架",
    evidenceSubmitted: "学生已补充关键证据",
    reflectionSubmitted: "学生已提交反思",
  };
  const contentText = buildStudentReturnLedgerText(content, artifact);
  const revisionLabel = state.revision ? `第 ${state.revision + 1} 轮` : "首轮";

  snapshot.ledger[orderId] = [
    {
      id: `ledger-return-${step}-${Date.now()}`,
      type: "student_return",
      time: nowText(),
      actor: "学生",
      title: titles[step],
      source: "学生回流",
      detail: contentText
        ? `${revisionLabel}学生回流节点已写入证据账本。提交内容：${contentText}`
        : `${revisionLabel}学生回流节点已写入证据账本，等待下一轮诊断或归档。`,
      traceId: `return-${orderId}-${step}`,
      stageAfter: order?.stage,
      evidenceCoverageAfter: order?.evidenceCoverage,
    },
    ...(snapshot.ledger[orderId] ?? []),
  ];

  snapshot.updatedAt = nowText();
  const next = withLocalReturnTokens(snapshot);
  writeSnapshot(next);
  return clone(next);
}

function buildStudentReturnLedgerText(content = "", artifact?: StudentReturnArtifact) {
  const clean = (value?: string) => cropText(String(value || "").trim(), 260);
  const structuredParts = artifact
    ? [
        ["失败现象", clean(artifact.failureSymptom)],
        ["最小失败用例", clean(artifact.minimalCase)],
        ["修复/验证记录", clean(artifact.verificationRecord)],
        ["PR/CI 链接", clean(artifact.evidenceLink)],
        ["诚信与边界", clean(artifact.integrityNote)],
      ]
        .filter(([, value]) => value)
        .map(([label, value]) => `${label}：${value}`)
    : [];
  if (structuredParts.length > 0) return structuredParts.join("；");
  return clean(content);
}

function latestStudentEvidenceReturnEntry(ledger: EvidenceLedgerEntry[]) {
  return ledger.find(
    (entry) =>
      entry.type === "student_return" &&
      (entry.title.includes("补充关键证据") ||
        entry.detail.includes("失败现象") ||
        entry.detail.includes("最小失败用例")),
  );
}

function hasAcceptedTeacherEvidenceReview(ledger: EvidenceLedgerEntry[]) {
  const sourceEntry = latestStudentEvidenceReturnEntry(ledger);
  if (!sourceEntry) return false;
  const review = ledger.find(
    (entry) =>
      entry.type === "teacher_evidence_review" &&
      entry.traceId === `teacher-evidence-review-${sourceEntry.id}`,
  );
  if (!review) return false;
  return (
    review.title.includes("可进入验收") &&
    !review.detail.includes("待补") &&
    !review.detail.includes("不采用")
  );
}

type CourseEvidenceReviewGateStatus =
  | "not_ready"
  | "pending_review"
  | "accepted"
  | "needs_evidence"
  | "rejected";

function teacherEvidenceReviewEntryFor(ledger: EvidenceLedgerEntry[]) {
  const sourceEntry = latestStudentEvidenceReturnEntry(ledger);
  if (!sourceEntry) return null;
  return (
    ledger.find(
      (entry) =>
        entry.type === "teacher_evidence_review" &&
        entry.traceId === `teacher-evidence-review-${sourceEntry.id}`,
    ) ?? null
  );
}

function teacherEvidenceReviewGateForReport(
  snapshot: WorkbenchSnapshot,
  order: LearningWorkOrder,
): CourseEvidenceReviewGateStatus {
  if (order.status === "closed") return "accepted";
  const returnState = normalizeStudentReturnState(snapshot.studentReturn[order.id]);
  if (countStudentReturnSteps(returnState) < studentReturnSteps.length) return "not_ready";
  const ledger = snapshot.ledger[order.id] ?? [];
  if (!latestStudentEvidenceReturnEntry(ledger)) return "not_ready";
  const review = teacherEvidenceReviewEntryFor(ledger);
  if (!review) return "pending_review";
  if (review.detail.includes("不采用")) return "rejected";
  if (review.detail.includes("待补")) return "needs_evidence";
  if (review.title.includes("可进入验收")) return "accepted";
  return "pending_review";
}

export async function closeWorkOrder(
  orderId: string,
  decision: TeacherClosureDecision,
  note = "",
): Promise<WorkbenchSnapshot> {
  await delay();
  const apiSnapshot = await tryApiSnapshot(async () =>
    asSnapshot(
      await apiJson(`/api/work-orders/${encodeURIComponent(orderId)}/closure`, {
        method: "POST",
        body: JSON.stringify({
          tenantId,
          courseId,
          decision,
          teacherNote: note,
        }),
      }),
    ),
  );
  if (apiSnapshot) return apiSnapshot;

  const snapshot = readSnapshot();
  const order = snapshot.workOrders.find((item) => item.id === orderId);
  if (!order) throw new Error("未找到当前诊断单。");
  const state = normalizeStudentReturnState(snapshot.studentReturn[orderId]);
  const completed = countStudentReturnSteps(state);
  if (decision === "accept" && completed < 3) {
    throw new Error("学生回流三步完成后才能验收关闭。");
  }
  if (decision === "accept" && !hasAcceptedTeacherEvidenceReview(snapshot.ledger[orderId] ?? [])) {
    throw new Error("请先完成学生证据复核，且全部证据可采信后再验收。");
  }

  const isReturn = decision === "returnEvidence";
  const closureTime = nowText();
  const returnReason = note.trim() || "证据仍不足，退回学生继续补齐关键材料。";
  const returnRevision = (state.revision ?? 0) + 1;
  const nextState = isReturn
    ? {
        ...state,
        evidenceSubmitted: false,
        reflectionSubmitted: false,
        revision: returnRevision,
        returnedAt: closureTime,
        returnReason,
        returnRequestedBy: order.owner || "任课教师",
      }
    : state;
  snapshot.studentReturn[orderId] = nextState;

  const nextCurrent = Math.max(order.valueAdded.current, order.valueAdded.expected);
  const valueAdded: ValueAddedDimension = isReturn
    ? {
        ...order.valueAdded,
        uncertainty: "medium",
        description: `${order.valueAdded.description} 教师验收时要求继续补证据，结论保持形成性。`,
      }
    : {
        ...order.valueAdded,
        current: nextCurrent,
        delta: nextCurrent - order.valueAdded.expected,
        uncertainty: "low",
        description: `${order.valueAdded.description} 教师已基于学生回流证据完成验收。`,
      };
  const updated: LearningWorkOrder = {
    ...order,
    status: isReturn ? "evidence" : "closed",
    stage: isReturn ? "退回补证据" : "闭环完成",
    evidenceCoverage: Math.max(order.evidenceCoverage, isReturn ? 72 : 88),
    valueAdded,
    valueAddedSnapshot: buildValueAddedSnapshot(order, valueAdded, decision, note),
    missingEvidence: isReturn
      ? [
          buildReturnedEvidenceRequirement(order, returnRevision, returnReason),
          ...order.missingEvidence.filter((item) => !item.id.startsWith(`ev-return-${order.id}-`)),
        ]
      : order.missingEvidence,
    interventionPackage: order.interventionPackage
      ? {
          ...order.interventionPackage,
          status: isReturn ? "returned_for_evidence" : order.interventionPackage.status,
        }
      : undefined,
    teacherNote: note.trim() || order.teacherNote,
    updatedAt: closureTime,
    stages: createStages(isReturn ? "evidence" : "closed"),
  };
  snapshot.workOrders = snapshot.workOrders.map((item) =>
    item.id === orderId ? updated : item,
  );
  snapshot.ledger[orderId] = [
    {
      id: `ledger-closure-${decision}-${Date.now()}`,
      type: "teacher_acceptance",
      time: closureTime,
      actor: updated.owner || "任课教师",
      title: isReturn ? "教师验收退回补证据" : "教师验收通过并关闭诊断单",
      source: "教师验收",
      detail: note.trim()
        ? `教师验收意见：${note.trim()}${
            updated.valueAddedSnapshot
              ? ` 增值快照：${updated.valueAddedSnapshot.baseline} -> ${updated.valueAddedSnapshot.observed}，覆盖率 ${updated.valueAddedSnapshot.evidenceCoverage}%。`
              : ""
          }`
        : isReturn
          ? "证据仍不足，退回学生继续补齐关键材料。"
          : `学生回流证据达到本轮形成性诊断要求，诊断单关闭。增值快照：${updated.valueAddedSnapshot?.baseline ?? order.valueAdded.current} -> ${updated.valueAddedSnapshot?.observed ?? valueAdded.current}，覆盖率 ${updated.valueAddedSnapshot?.evidenceCoverage ?? updated.evidenceCoverage}%。`,
      traceId: `closure-${orderId}-${decision}`,
      stageAfter: updated.stage,
      evidenceCoverageAfter: updated.evidenceCoverage,
      valueAddedSnapshotId: updated.valueAddedSnapshot?.id,
    },
    ...(snapshot.ledger[orderId] ?? []),
  ];

  snapshot.updatedAt = closureTime;
  const next = withLocalReturnTokens(snapshot);
  writeSnapshot(next);
  return clone(next);
}

export async function recordTeacherEvidenceReview(
  orderId: string,
  review: TeacherEvidenceReviewPayload,
): Promise<WorkbenchSnapshot> {
  await delay();
  const apiSnapshot = await tryApiSnapshot(async () =>
    asSnapshot(
      await apiJson(`/api/work-orders/${encodeURIComponent(orderId)}/evidence-review`, {
        method: "POST",
        body: JSON.stringify({
          tenantId,
          courseId,
          review,
        }),
      }),
    ),
  );
  if (apiSnapshot) return apiSnapshot;

  const snapshot = readSnapshot();
  const order = snapshot.workOrders.find((item) => item.id === orderId);
  if (!order) throw new Error("未找到当前诊断单。");
  if (order.status === "closed") throw new Error("诊断单已关闭，不能继续写入教师证据复核。");
  const reviewedAt = nowText();
  const statusText: Record<string, string> = {
    accepted: "可采信",
    needs_evidence: "待补",
    rejected: "不采用",
  };
  const details = review.items
    .map((item) => `${item.label}=${statusText[item.status] ?? item.status}${item.note ? `（${cropText(item.note, 80)}）` : ""}`)
    .join("；");
  const blockers = review.items.filter((item) => item.status !== "accepted").length;
  snapshot.ledger[orderId] = [
    {
      id: `ledger-teacher-evidence-review-${stableHash(`${orderId}:${review.sourceLedgerEntryId}:${reviewedAt}`)}`,
      type: "teacher_evidence_review",
      time: reviewedAt,
      actor: order.owner || "任课教师",
      title: blockers ? "教师复核学生证据：仍需补证" : "教师复核学生证据：可进入验收",
      source: "教师证据复核",
      detail: `${details}。结论：${review.summary}${review.teacherNote ? `；备注：${cropText(review.teacherNote, 140)}` : ""}`,
      traceId: `teacher-evidence-review-${review.sourceLedgerEntryId}`,
      stageAfter: order.stage,
      evidenceCoverageAfter: order.evidenceCoverage,
    },
    ...(snapshot.ledger[orderId] ?? []),
  ];
  order.updatedAt = reviewedAt;
  snapshot.updatedAt = reviewedAt;
  const next = withLocalReturnTokens(snapshot);
  writeSnapshot(next);
  return clone(next);
}

export async function resetWorkbench(): Promise<WorkbenchSnapshot> {
  await delay();
  const apiSnapshot = await tryApiSnapshot(() => getApiSnapshot());
  if (apiSnapshot) return apiSnapshot;
  const snapshot = withLocalReturnTokens(initialSnapshot());
  writeSnapshot(snapshot);
  return clone(snapshot);
}

export function buildLedgerExport(
  snapshot: WorkbenchSnapshot,
  orderId: string,
) {
  const order = snapshot.workOrders.find((item) => item.id === orderId);
  const exportOrder = order ? { ...order } : undefined;
  if (exportOrder) delete exportOrder.returnToken;
  const returnState = normalizeStudentReturnState(snapshot.studentReturn[orderId]);

  return {
    product: "SE-Path 学伴",
    exportType: "teacher_evidence_ledger",
    exportedAt: nowText(),
    boundary:
      "形成性诊断，不排名不惩罚；智能体只提供候选建议，教师确认后生效；不展示完整答案或可直接提交代码。",
    selectedDecision: order?.selectedDecision ?? null,
    currentStage: order?.stage,
    evidenceCoverage: order?.evidenceCoverage,
    studentReturnProgress: `${countStudentReturnSteps(returnState)}/3`,
    studentReturnRevision: returnState.revision ?? 0,
    studentReturnReason: returnState.returnReason ?? null,
    valueAddedSnapshot: exportOrder?.valueAddedSnapshot ?? null,
    workOrder: exportOrder,
    ledger: snapshot.ledger[orderId] ?? [],
  };
}

export async function exportLedgerPackage(
  snapshot: WorkbenchSnapshot,
  orderId: string,
) {
  if (readApiBaseUrl()) {
    try {
      return await apiJson(`/api/exports/ledger`, {
        method: "POST",
        body: JSON.stringify({
          tenantId,
          courseId,
          workOrderId: orderId,
        }),
      });
    } catch (error) {
      console.warn("[SE-Path] Edge API export unavailable, using local ledger.", error);
    }
  }
  return buildLedgerExport(snapshot, orderId);
}

function weeklyReportStatus(
  order: LearningWorkOrder,
  evidenceReviewGate: CourseEvidenceReviewGateStatus,
): CourseWeeklyReportLine["status"] {
  if (order.status === "closed") return "done";
  if (evidenceReviewGate === "needs_evidence" || evidenceReviewGate === "rejected") {
    return "blocked";
  }
  if (order.evidenceCoverage < 50 || order.valueAdded.uncertainty === "high") return "blocked";
  if (evidenceReviewGate === "pending_review") return "watch";
  if (evidenceReviewGate === "accepted") return "ready";
  if (order.status === "review" || order.interventionPackage) return "ready";
  return "watch";
}

function weeklyReportAction(
  order: LearningWorkOrder,
  returnProgress: string,
  evidenceReviewGate: CourseEvidenceReviewGateStatus,
) {
  if (order.status === "closed") return "沉淀为本周增值样本，下一周观察迁移表现。";
  if (order.status === "review" && returnProgress === "3/3") {
    if (evidenceReviewGate === "accepted") {
      return "进入教师最终验收，确认是否沉淀为增值快照。";
    }
    if (evidenceReviewGate === "needs_evidence" || evidenceReviewGate === "rejected") {
      return "退回补证据或转人工会谈，暂不写入增值结论。";
    }
    return "先逐项复核学生补回证据，再决定是否验收。";
  }
  if (!order.selectedDecision) return "完成教师复核，决定补证据、脚手架或人工会谈。";
  if (!order.interventionPackage) return "发布教师确认任务包，再开放学生回流入口。";
  return "跟进学生证据和反思回流，缺证据时保持不确定。";
}

function reportLineMarkdown(title: string, rows: CourseWeeklyReportLine[]) {
  const body = rows.length
    ? rows.map(
        (row, index) =>
          `${index + 1}. ${row.label}：${row.detail}；下一步：${row.action}；证据：${row.evidence}`,
      )
    : ["暂无。"];
  return [`## ${title}`, "", ...body, ""].join("\n");
}

function sanitizeReportOrder(order: LearningWorkOrder) {
  const safeOrder = { ...order };
  delete safeOrder.returnToken;
  return safeOrder;
}

export function buildCourseWeeklyReport(
  snapshot: WorkbenchSnapshot,
  options: {
    courseClass: string;
    courseName: string;
    repository: string;
    period?: string;
  },
): CourseWeeklyReport {
  const orders = snapshot.workOrders.map(sanitizeReportOrder);
  const openOrders = orders.filter((order) => order.status !== "closed");
  const closedOrders = orders.filter((order) => order.status === "closed");
  const averageCoverage = Math.round(
    openOrders.reduce((sum, order) => sum + order.evidenceCoverage, 0) /
      Math.max(1, openOrders.length),
  );
  const highRiskCount = openOrders.filter((order) => order.risk === "high").length;
  const missingCount = openOrders.reduce((sum, order) => sum + order.missingEvidence.length, 0);
  const reviewedCount = orders.filter((order) => Boolean(order.selectedDecision)).length;
  const evidenceReviewGates = openOrders.map((order) =>
    teacherEvidenceReviewGateForReport(snapshot, order),
  );
  const evidenceReviewPendingCount = evidenceReviewGates.filter(
    (gate) => gate === "pending_review",
  ).length;
  const evidenceReviewAcceptedCount = evidenceReviewGates.filter((gate) => gate === "accepted").length;
  const evidenceReviewBlockedCount = evidenceReviewGates.filter(
    (gate) => gate === "needs_evidence" || gate === "rejected",
  ).length;

  const priorityQueue: CourseWeeklyReportLine[] = openOrders
    .map((order) => {
      const returnState = normalizeStudentReturnState(snapshot.studentReturn[order.id]);
      const returnProgress = `${countStudentReturnSteps(returnState)}/3`;
      const evidenceReviewGate = teacherEvidenceReviewGateForReport(snapshot, order);
      const evidenceReviewScore =
        evidenceReviewGate === "pending_review"
          ? 36
          : evidenceReviewGate === "needs_evidence" || evidenceReviewGate === "rejected"
            ? 30
            : evidenceReviewGate === "accepted"
              ? 24
              : 0;
      const score =
        (order.risk === "high" ? 60 : order.risk === "medium" ? 34 : 12) +
        Math.max(0, 70 - order.evidenceCoverage) +
        Math.max(0, -order.valueAdded.delta * 4) +
        order.missingEvidence.length * 8 +
        (order.status === "review" ? 32 : 0) +
        evidenceReviewScore;
      return {
        id: order.id,
        label: `${order.studentName} / ${order.valueAdded.label}`,
        detail: `${riskLabels[order.risk]}，${statusLabels[order.status]}，证据覆盖 ${order.evidenceCoverage}%，回流 ${returnProgress}。${order.trigger}`,
        action: weeklyReportAction(order, returnProgress, evidenceReviewGate),
        evidence: [
          ...order.collectedEvidence.map((item) => item.title),
          ...order.missingEvidence.map((item) => `缺：${item.title}`),
        ].join("；"),
        status: weeklyReportStatus(order, evidenceReviewGate),
        score,
      };
    })
    .sort((a, b) => (b as CourseWeeklyReportLine & { score: number }).score - (a as CourseWeeklyReportLine & { score: number }).score)
    .slice(0, 8)
    .map(({ score: _score, ...line }) => line as CourseWeeklyReportLine);

  const focusGroups = new Map<string, LearningWorkOrder[]>();
  openOrders.forEach((order) => {
    const group = focusGroups.get(order.valueAdded.label) ?? [];
    group.push(order);
    focusGroups.set(order.valueAdded.label, group);
  });
  const focusInsights: CourseWeeklyReportLine[] = Array.from(focusGroups.entries())
    .map(([label, group]) => {
      const averageDelta = Math.round(
        group.reduce((sum, order) => sum + order.valueAdded.delta, 0) / group.length,
      );
      const focusCoverage = Math.round(
        group.reduce((sum, order) => sum + order.evidenceCoverage, 0) / group.length,
      );
      const uncertaintyCount = group.filter((order) => order.valueAdded.uncertainty === "high").length;
      const acceptedReview = group.filter(
        (order) => teacherEvidenceReviewGateForReport(snapshot, order) === "accepted",
      ).length;
      const pendingReview = group.filter(
        (order) => teacherEvidenceReviewGateForReport(snapshot, order) === "pending_review",
      ).length;
      const blockedReview = group.filter((order) =>
        ["needs_evidence", "rejected"].includes(teacherEvidenceReviewGateForReport(snapshot, order)),
      ).length;
      return {
        id: `focus-${label}`,
        label,
        detail: `${group.length} 张打开工单，平均增值差值 ${averageDelta}，平均证据覆盖 ${focusCoverage}%，高不确定 ${uncertaintyCount}；可验收 ${acceptedReview}，待复核 ${pendingReview}，需补证 ${blockedReview}。`,
        action:
          averageDelta < 0 || focusCoverage < 70
            ? "下周安排针对性课堂微任务，先补共性证据再判断能力迁移。"
            : "保留为迁移观察维度，等待新证据进入。",
        evidence: group.map((order) => order.id).join("；"),
        status: (averageDelta < 0 || uncertaintyCount > 0 ? "watch" : "ready") as CourseWeeklyReportLine["status"],
        averageDelta,
      };
    })
    .sort((a, b) => a.averageDelta - b.averageDelta)
    .map(({ averageDelta: _averageDelta, ...line }) => line);

  const gapGroups = new Map<string, { count: number; source: string; orderIds: string[] }>();
  openOrders.forEach((order) => {
    order.missingEvidence.forEach((gap) => {
      const current = gapGroups.get(gap.title) ?? { count: 0, source: gap.source, orderIds: [] };
      current.count += 1;
      current.orderIds.push(order.id);
      gapGroups.set(gap.title, current);
    });
  });
  const evidenceGaps: CourseWeeklyReportLine[] = Array.from(gapGroups.entries())
    .map(([title, gap]) => ({
      id: `gap-${title}`,
      label: title,
      detail: `${gap.count} 张打开工单重复缺失，来源建议：${gap.source}。`,
      action: title.includes("反思")
        ? "统一下发 120-180 字反思脚手架，并要求写明迁移策略。"
        : title.includes("用例") || title.includes("清单")
          ? "课堂补一次最小失败用例与边界检查清单。"
          : "补充可复核材料，完成后再更新诊断。",
      evidence: gap.orderIds.join("；"),
      status: "watch" as CourseWeeklyReportLine["status"],
      count: gap.count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
    .map(({ count: _count, ...line }) => line);

  const valueAddedSnapshots = orders
    .map((order) => order.valueAddedSnapshot)
    .filter((item): item is ValueAddedSnapshot => Boolean(item));

  const nextWeekActions: CourseWeeklyReportLine[] = [
    {
      id: "next-review",
      label: "教师复核",
      detail: `${reviewedCount}/${orders.length} 张诊断单已有教师决策。`,
      action: "未复核工单先完成教师决策，再开放学生回流入口。",
      evidence: "selectedDecision 字段与教师操作账本",
      status: reviewedCount === orders.length ? "done" : "watch",
    },
    {
      id: "next-evidence-review",
      label: "证据复核关口",
      detail: `${evidenceReviewPendingCount} 张学生回流待逐项采信，${evidenceReviewAcceptedCount} 张可进入验收，${evidenceReviewBlockedCount} 张需补证或人工确认。`,
      action: "最新学生证据必须先经教师采信；待补或不采用时不得写成增值结论。",
      evidence: "student_return 与 teacher_evidence_review 追踪号",
      status:
        evidenceReviewBlockedCount > 0
          ? "blocked"
          : evidenceReviewPendingCount > 0
            ? "watch"
            : evidenceReviewAcceptedCount > 0
              ? "ready"
              : "done",
    },
    {
      id: "next-evidence",
      label: "证据补齐",
      detail: `当前仍有 ${missingCount} 个证据缺口，平均证据覆盖 ${averageCoverage}%。`,
      action: "优先处理重复缺口，避免把低证据状态写成能力结论。",
      evidence: "missingEvidence 与 evidenceCoverage",
      status: missingCount > 0 ? "blocked" : "ready",
    },
    {
      id: "next-snapshot",
      label: "增值沉淀",
      detail: `本周已形成 ${valueAddedSnapshots.length} 个教师验收后的增值快照。`,
      action: "只把验收通过的闭环沉淀为形成性增值样本。",
      evidence: closedOrders.map((order) => order.id).join("；") || "暂无闭环完成工单",
      status: valueAddedSnapshots.length > 0 ? "ready" : "watch",
    },
  ];

  const report: Omit<CourseWeeklyReport, "markdown"> = {
    product: "SE-Path 学伴",
    exportType: "course_weekly_operations_report",
    exportedAt: nowText(),
    courseClass: options.courseClass,
    courseName: options.courseName,
    repository: options.repository,
    period: options.period || "本周",
    boundary:
      "形成性诊断，不排名不惩罚；智能体只提供候选建议，教师确认后生效；周报只用于课程资源调度和教学复盘。",
    summary: `${options.courseClass} 本周共有 ${orders.length} 张诊断单，${openOrders.length} 张仍需跟进，高风险 ${highRiskCount} 张，平均证据覆盖 ${averageCoverage}%；学生回流待证据复核 ${evidenceReviewPendingCount} 张，可进入验收 ${evidenceReviewAcceptedCount} 张。`,
    metrics: [
      { label: "诊断单", value: orders.length, evidence: "workOrders.length" },
      { label: "打开工单", value: openOrders.length, evidence: "status != closed" },
      { label: "高风险", value: highRiskCount, evidence: "risk == high" },
      { label: "平均证据覆盖", value: `${averageCoverage}%`, evidence: "evidenceCoverage average" },
      { label: "教师已复核", value: `${reviewedCount}/${orders.length}`, evidence: "selectedDecision" },
      {
        label: "证据待复核",
        value: evidenceReviewPendingCount,
        evidence: "student_return without latest teacher_evidence_review",
      },
      {
        label: "复核可验收",
        value: evidenceReviewAcceptedCount,
        evidence: "latest teacher_evidence_review accepted",
      },
      { label: "增值快照", value: valueAddedSnapshots.length, evidence: "valueAddedSnapshot" },
    ],
    priorityQueue,
    focusInsights,
    evidenceGaps,
    nextWeekActions,
    valueAddedSnapshots,
  };

  const markdown = [
    `# ${report.courseClass} SE-Path 周运营报告`,
    "",
    `课程任务：${report.courseName}`,
    `仓库：${report.repository}`,
    `周期：${report.period}`,
    `导出时间：${report.exportedAt}`,
    "",
    `> ${report.boundary}`,
    "",
    "## 本周摘要",
    "",
    report.summary,
    "",
    "## 关键指标",
    "",
    ...report.metrics.map((metric) => `- ${metric.label}：${metric.value}（证据：${metric.evidence}）`),
    "",
    reportLineMarkdown("今日优先处理", report.priorityQueue),
    reportLineMarkdown("能力薄弱分布", report.focusInsights),
    reportLineMarkdown("证据缺口矩阵", report.evidenceGaps),
    reportLineMarkdown("下周教学动作", report.nextWeekActions),
  ].join("\n");

  return { ...report, markdown };
}

interface CourseGapAggregate {
  title: string;
  source: string;
  orders: LearningWorkOrder[];
}

function buildGapAggregates(orders: LearningWorkOrder[]) {
  const gapGroups = new Map<string, CourseGapAggregate>();
  orders.forEach((order) => {
    order.missingEvidence.forEach((gap) => {
      const current = gapGroups.get(gap.title) ?? {
        title: gap.title,
        source: gap.source,
        orders: [],
      };
      current.orders.push(order);
      gapGroups.set(gap.title, current);
    });
  });
  return Array.from(gapGroups.values()).sort(
    (a, b) => b.orders.length - a.orders.length || a.title.localeCompare(b.title, "zh-CN"),
  );
}

function mostFrequentFocus(orders: LearningWorkOrder[]) {
  const focusCount = new Map<string, number>();
  orders.forEach((order) => {
    focusCount.set(order.valueAdded.label, (focusCount.get(order.valueAdded.label) ?? 0) + 1);
  });
  return (
    Array.from(focusCount.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"))[0]?.[0] ??
    "软件工程证据表达"
  );
}

function microTaskPlanForGap(sourceGap: string, focusDimension: string) {
  if (sourceGap.includes("反思")) {
    return {
      objective: `围绕“${focusDimension}”完成一次短反思，解释失败路径、修复依据和下一次迁移策略。`,
      steps: [
        "用 3 句话说明本次失败发生在什么输入、状态或协作边界。",
        "标出一个能支撑判断的 PR/CI/测试证据，不写无法复核的笼统感受。",
        "写出下一次遇到相似问题时先检查哪一项，并说明原因。",
      ],
      evidenceToSubmit: [
        "120-180 字学习反思",
        "1 条可回溯的 PR、CI 或测试证据编号",
        "1 条下一次可执行的检查策略",
      ],
      rubricCheckpoints: [
        "能把失败现象和证据对应起来",
        "能说明修复依据而不是只写结果",
        "能形成可迁移的下次行动",
      ],
    };
  }
  if (sourceGap.includes("用例") || sourceGap.includes("清单") || sourceGap.includes("测试")) {
    return {
      objective: `补齐“${focusDimension}”的最小失败用例和边界检查清单，让诊断先变得可复核。`,
      steps: [
        "从当前失败 PR 或 CI 日志中选一个最小可复现路径。",
        "补 2 个边界用例：一个正常边界、一个异常边界，并写明预期结果。",
        "重跑测试后提交证据摘要，仍失败也要说明失败点，不要求立刻写出完整实现。",
      ],
      evidenceToSubmit: [
        "最小失败用例或测试片段摘要",
        "边界检查清单",
        "CI 重跑结果或本地测试截图摘要",
      ],
      rubricCheckpoints: [
        "用例能复现问题或覆盖关键边界",
        "预期结果和实际结果可对比",
        "证据足以让教师判断下一步，而不是直接替学生给答案",
      ],
    };
  }
  return {
    objective: `围绕“${focusDimension}”补充一组可复核证据，先降低诊断不确定性。`,
    steps: [
      "从 PR、CI、对话或课堂记录中选择一条最能说明问题的证据。",
      "按“现象、位置、尝试、结果”四项补全记录。",
      "提交后等待教师复核，系统只更新形成性诊断，不生成排名。",
    ],
    evidenceToSubmit: [
      "1 条来源清楚的学习证据",
      "1 段问题定位说明",
      "1 个后续修复或复盘计划",
    ],
    rubricCheckpoints: [
      "证据来源可追溯",
      "问题定位能被教师复核",
      "诊断结论保持形成性边界",
    ],
  };
}

export function buildCourseMicroTaskPackage(
  snapshot: WorkbenchSnapshot,
  options: {
    courseClass: string;
    courseName: string;
    repository: string;
    sourceGap?: string;
  },
): CourseMicroTaskPackage {
  const openOrders = snapshot.workOrders.filter((order) => order.status !== "closed");
  const gapAggregates = buildGapAggregates(openOrders);
  const selectedGap =
    (options.sourceGap
      ? gapAggregates.find((gap) => gap.title === options.sourceGap)
      : undefined) ?? gapAggregates[0];
  const targetOrders = selectedGap?.orders.length
    ? selectedGap.orders
    : openOrders
        .slice()
        .sort((a, b) => courseOpsScoreForExport(b) - courseOpsScoreForExport(a))
        .slice(0, 3);
  const sourceGap = selectedGap?.title ?? "本周打开工单复核";
  const focusDimension = mostFrequentFocus(targetOrders.length ? targetOrders : openOrders);
  const plan = microTaskPlanForGap(sourceGap, focusDimension);
  const affectedCount = new Set(targetOrders.map((order) => order.studentNo || order.id)).size;
  const safeBoundary =
    "只下发检查清单、最小用例要求和反思脚手架；不生成可直接提交的完整实现，不替学生修改代码，不自动给分、排名或惩罚。";
  const teacherAction =
    targetOrders.length > 0
      ? "教师确认后发布到课堂任务；学生补证据后回到增值诊断单复核。"
      : "当前暂无打开工单，可作为下一次课堂巡检模板暂存。";
  const confidenceNote =
    targetOrders.length > 0
      ? `基于 ${targetOrders.length} 张打开工单的重复缺口生成；缺证据学生仍显示为待补证。`
      : "当前没有打开工单，系统不会强行生成能力结论。";

  const report: Omit<CourseMicroTaskPackage, "markdown"> = {
    id: `micro-${stableHash(
      [options.courseClass, options.courseName, options.repository, sourceGap, targetOrders.map((order) => order.id).join("|")].join(":"),
    )}`,
    product: "SE-Path 学伴",
    exportType: "course_micro_task_package",
    generatedAt: nowText(),
    status: "draft",
    courseClass: options.courseClass,
    courseName: options.courseName,
    repository: options.repository,
    sourceGap,
    focusDimension,
    affectedCount,
    targetWorkOrderIds: targetOrders.map((order) => order.id),
    targetLearners: targetOrders.map((order) => `${order.studentName} / ${order.id}`),
    objective: plan.objective,
    safeBoundary,
    steps: plan.steps,
    evidenceToSubmit: plan.evidenceToSubmit,
    rubricCheckpoints: plan.rubricCheckpoints,
    dueHint: "建议安排 15-20 分钟课堂微任务，当堂提交证据摘要，课后由教师复核。",
    teacherAction,
    confidenceNote,
  };

  const markdown = [
    `# ${report.courseClass} 课堂微任务包`,
    "",
    `课程任务：${report.courseName}`,
    `仓库：${report.repository}`,
    `生成时间：${report.generatedAt}`,
    `共性缺口：${report.sourceGap}`,
    `能力焦点：${report.focusDimension}`,
    `涉及工单：${report.targetWorkOrderIds.join("、") || "暂无"}`,
    "",
    `> 安全边界：${report.safeBoundary}`,
    "",
    "## 任务目标",
    "",
    report.objective,
    "",
    "## 学生步骤",
    "",
    ...report.steps.map((step, index) => `${index + 1}. ${step}`),
    "",
    "## 需要提交的证据",
    "",
    ...report.evidenceToSubmit.map((item) => `- ${item}`),
    "",
    "## 教师验收点",
    "",
    ...report.rubricCheckpoints.map((item) => `- ${item}`),
    "",
    "## 发布说明",
    "",
    `${report.teacherAction}${report.dueHint}`,
    "",
    `不确定性说明：${report.confidenceNote}`,
  ].join("\n");

  return { ...report, markdown };
}

function buildCourseMicroTaskStudentPackage(
  order: LearningWorkOrder,
  microTask: CourseMicroTaskPackage,
  publishedAt: string,
): InterventionTaskPackage {
  return {
    id: `pkg-course-micro-${microTask.id}-${order.id}`,
    workOrderId: order.id,
    title: `课堂微任务：${microTask.sourceGap}`,
    status: "ready_for_student",
    objective: microTask.objective,
    safeBoundary: microTask.safeBoundary,
    steps: microTask.steps,
    evidenceToSubmit: uniqueStrings([
      ...microTask.evidenceToSubmit,
      ...order.missingEvidence.map((item) => item.title),
    ]),
    rubricCheckpoints: microTask.rubricCheckpoints,
    dueHint: microTask.dueHint,
    teacherNote: microTask.teacherAction,
    createdBy: order.owner || microTask.publishedBy || "任课教师",
    createdAt: publishedAt,
    sourceEvidenceIds: uniqueStrings([
      ...order.collectedEvidence.map((item) => item.id),
      ...order.missingEvidence.map((item) => item.id),
    ]),
    valueAddedFocus: order.valueAdded.label || microTask.focusDimension,
    teacherEdited: true,
    draftVersion: 1,
  };
}

export async function publishCourseMicroTaskPackage(
  microTask: CourseMicroTaskPackage,
): Promise<WorkbenchSnapshot> {
  await delay();
  const apiSnapshot = await tryApiSnapshot(async () =>
    asSnapshot(
      await apiJson("/api/course/micro-task-package", {
        method: "POST",
        body: JSON.stringify({
          tenantId,
          courseId,
          package: microTask,
        }),
      }),
    ),
  );
  if (apiSnapshot) return apiSnapshot;

  const snapshot = readSnapshot();
  const targetIds = new Set(microTask.targetWorkOrderIds);
  const publishedAt = nowText();
  const targetOrders = snapshot.workOrders.filter((order) => targetIds.has(order.id));
  if (targetOrders.length === 0) {
    throw new Error("课堂微任务没有可入账的工单。");
  }
  snapshot.workOrders = snapshot.workOrders.map((order) =>
    targetIds.has(order.id)
      ? {
          ...order,
          selectedDecision: order.selectedDecision ?? "returnEvidence",
          teacherNote:
            order.teacherNote ??
            `教师已批量发布课堂微任务：${microTask.sourceGap}。学生需先补证据，再回到教师复核。`,
          interventionPackage:
            order.interventionPackage ??
            buildCourseMicroTaskStudentPackage(order, microTask, publishedAt),
          status: order.interventionPackage ? order.status : "intervention",
          stage: order.interventionPackage ? order.stage : "实时干预",
          evidenceCoverage: Math.max(order.evidenceCoverage, order.interventionPackage ? order.evidenceCoverage : 54),
          updatedAt: publishedAt,
          stages: order.interventionPackage ? order.stages : createStages("intervention"),
        }
      : order,
  );
  targetOrders.forEach((order) => {
    snapshot.studentReturn[order.id] = normalizeStudentReturnState(snapshot.studentReturn[order.id]);
  });
  targetOrders.forEach((order) => {
    const existing = snapshot.ledger[order.id] ?? [];
    const alreadyPublished = existing.some(
      (entry) => entry.type === "course_micro_task" && entry.traceId === `course-micro-task-${microTask.id}`,
    );
    if (alreadyPublished) return;
    snapshot.ledger[order.id] = [
      {
        id: `ledger-course-micro-${microTask.id}-${order.id}-${Date.now()}`,
        type: "course_micro_task",
        time: publishedAt,
        actor: order.owner || "任课教师",
        title: `课堂微任务：${microTask.sourceGap}`,
        source: "课程运营",
        detail: `${microTask.objective} 涉及 ${microTask.affectedCount} 张工单；教师验收点：${microTask.rubricCheckpoints.join("；")}。安全边界：${microTask.safeBoundary}`,
        traceId: `course-micro-task-${microTask.id}`,
        stageAfter: order.interventionPackage ? order.stage : "实时干预",
        evidenceCoverageAfter: Math.max(order.evidenceCoverage, order.interventionPackage ? order.evidenceCoverage : 54),
      },
      ...existing,
    ];
  });
  snapshot.updatedAt = publishedAt;
  const next = withLocalReturnTokens(snapshot);
  writeSnapshot(next);
  return clone(next);
}

export async function remindCourseMicroTaskTargets(reminder: {
  traceId: string;
  title: string;
  targetWorkOrderIds: string[];
  note?: string;
}): Promise<WorkbenchSnapshot> {
  await delay();
  const apiSnapshot = await tryApiSnapshot(async () =>
    asSnapshot(
      await apiJson("/api/course/micro-task-reminder", {
        method: "POST",
        body: JSON.stringify({
          tenantId,
          courseId,
          reminder,
        }),
      }),
    ),
  );
  if (apiSnapshot) return apiSnapshot;

  const traceId = reminder.traceId.trim();
  const targetIds = new Set(reminder.targetWorkOrderIds.filter(Boolean));
  if (!traceId || targetIds.size === 0) {
    throw new Error("催办需要同批任务 trace 和目标诊断单");
  }

  const snapshot = readSnapshot();
  const remindedAt = nowText();
  const title = cropText(reminder.title || "课堂微任务回流", 90);
  const note =
    cropText(reminder.note || "提醒学生先领取任务包，再补齐证据和反思；教师不直接给答案。", 220) ||
    "提醒学生按安全边界补齐证据。";
  const remindedIds: string[] = [];

  snapshot.workOrders
    .filter((order) => targetIds.has(order.id) && order.status !== "closed")
    .forEach((order) => {
      const returnState = normalizeStudentReturnState(snapshot.studentReturn[order.id]);
      if (countStudentReturnSteps(returnState) >= studentReturnSteps.length) return;
      const existing = snapshot.ledger[order.id] ?? [];
      remindedIds.push(order.id);
      snapshot.ledger[order.id] = [
        {
          id: `ledger-reminder-${stableHash(`${traceId}:${order.id}:${remindedAt}`)}`,
          type: "teacher_reminder",
          time: remindedAt,
          actor: order.owner || "任课教师",
          title: `教师催办：${title}`,
          source: "教师催办",
          detail: `${note} 本次催办只要求提交最小失败用例、检查清单或反思证据，不生成可直接提交的完整答案。`,
          traceId,
          stageAfter: order.stage,
          evidenceCoverageAfter: order.evidenceCoverage,
        },
        ...existing,
      ];
      snapshot.studentReturn[order.id] = returnState;
    });

  if (remindedIds.length === 0) {
    throw new Error("同批任务没有需要催办的学生");
  }

  snapshot.workOrders = snapshot.workOrders.map((order) =>
    remindedIds.includes(order.id) ? { ...order, updatedAt: remindedAt } : order,
  );
  snapshot.updatedAt = remindedAt;
  const next = withLocalReturnTokens(snapshot);
  writeSnapshot(next);
  return clone(next);
}

export async function publishCourseTeachingImprovementPlan(
  plan: CourseTeachingImprovementPlan,
): Promise<WorkbenchSnapshot> {
  await delay();
  const apiSnapshot = await tryApiSnapshot(async () =>
    asSnapshot(
      await apiJson("/api/course/teaching-improvement-plan", {
        method: "POST",
        body: JSON.stringify({
          tenantId,
          courseId,
          plan,
        }),
      }),
    ),
  );
  if (apiSnapshot) return apiSnapshot;

  const targetIds = new Set(plan.items.flatMap((item) => item.targetWorkOrderIds).filter(Boolean));
  if (targetIds.size === 0) {
    throw new Error("教学改进单缺少关联诊断单。");
  }

  const snapshot = readSnapshot();
  const publishedAt = nowText();
  const planTraceId = `teaching-improvement-${plan.id}`;
  const publishedOrderIds: string[] = [];

  snapshot.workOrders
    .filter((order) => targetIds.has(order.id) && order.status !== "closed")
    .forEach((order) => {
      const relatedItems = plan.items.filter((item) => item.targetWorkOrderIds.includes(order.id));
      if (relatedItems.length === 0) return;
      const existing = snapshot.ledger[order.id] ?? [];
      if (existing.some((entry) => entry.type === "teaching_improvement" && entry.traceId === planTraceId)) {
        return;
      }
      publishedOrderIds.push(order.id);
      snapshot.ledger[order.id] = [
        {
          id: `ledger-teaching-improvement-${stableHash(`${plan.id}:${order.id}:${publishedAt}`)}`,
          type: "teaching_improvement",
          time: publishedAt,
          actor: plan.publishedBy || order.owner || "任课教师",
          title: `下轮教学改进：${relatedItems[0].focus}`,
          source: "课程复盘",
          detail: relatedItems
            .map(
              (item) =>
                `${item.issue} 下一步：${item.action}；验收证据：${item.acceptanceEvidence.join("、")}。边界：${plan.boundary}`,
            )
            .join("；"),
          traceId: planTraceId,
          stageAfter: order.stage,
          evidenceCoverageAfter: order.evidenceCoverage,
        },
        ...existing,
      ];
    });

  if (publishedOrderIds.length === 0) {
    throw new Error("教学改进单已发布或没有可入账的打开工单。");
  }

  snapshot.workOrders = snapshot.workOrders.map((order) =>
    publishedOrderIds.includes(order.id)
      ? {
          ...order,
          teacherNote:
            order.teacherNote ??
            `教师已将“${plan.sourceSummary}”纳入下轮教学改进，仍按单张诊断单进行证据复核。`,
          updatedAt: publishedAt,
        }
      : order,
  );
  snapshot.updatedAt = publishedAt;
  const next = withLocalReturnTokens(snapshot);
  writeSnapshot(next);
  return clone(next);
}

export async function recordCourseTeachingImprovementExecution(
  receipt: CourseTeachingImprovementExecutionReceipt,
): Promise<WorkbenchSnapshot> {
  await delay();
  const apiSnapshot = await tryApiSnapshot(async () =>
    asSnapshot(
      await apiJson("/api/course/teaching-improvement-execution", {
        method: "POST",
        body: JSON.stringify({
          tenantId,
          courseId,
          receipt,
        }),
      }),
    ),
  );
  if (apiSnapshot) return apiSnapshot;

  const targetIds = new Set(receipt.targetWorkOrderIds.filter(Boolean));
  if (targetIds.size === 0) {
    throw new Error("执行回证缺少关联诊断单。");
  }

  const snapshot = readSnapshot();
  const executedAt = receipt.executedAt || nowText();
  const planTraceId = `teaching-improvement-${receipt.planId}`;
  const receiptTraceId = `teaching-improvement-execution-${receipt.planId || receipt.id}`;
  const recordedOrderIds: string[] = [];

  snapshot.workOrders
    .filter((order) => targetIds.has(order.id))
    .forEach((order) => {
      const existing = snapshot.ledger[order.id] ?? [];
      const planPublished = existing.some(
        (entry) => entry.type === "teaching_improvement" && entry.traceId === planTraceId,
      );
      if (!planPublished) return;
      if (
        existing.some(
          (entry) => entry.type === "teaching_improvement_execution" && entry.traceId === receiptTraceId,
        )
      ) {
        return;
      }
      recordedOrderIds.push(order.id);
      snapshot.ledger[order.id] = [
        {
          id: `ledger-teaching-improvement-execution-${stableHash(`${receipt.id}:${order.id}:${executedAt}`)}`,
          type: "teaching_improvement_execution",
          time: executedAt,
          actor: receipt.executedBy || order.owner || "任课教师",
          title: `下轮课堂执行回证：${receipt.classSession}`,
          source: "下轮课堂",
          detail: `${receipt.summary}；执行证据：${receipt.evidence.join("、")}。边界：${receipt.boundary}`,
          traceId: receiptTraceId,
          stageAfter: order.stage,
          evidenceCoverageAfter: order.evidenceCoverage,
        },
        ...existing,
      ];
    });

  if (recordedOrderIds.length === 0) {
    throw new Error("执行回证已登记，或对应教学改进单尚未发布。");
  }

  snapshot.workOrders = snapshot.workOrders.map((order) =>
    recordedOrderIds.includes(order.id)
      ? {
          ...order,
          teacherNote:
            order.teacherNote ??
            `下轮课堂已完成“${receipt.classSession}”执行回证登记，仍需等待学生补证据后再更新个人诊断。`,
          updatedAt: executedAt,
        }
      : order,
  );
  snapshot.updatedAt = executedAt;
  const next = withLocalReturnTokens(snapshot);
  writeSnapshot(next);
  return clone(next);
}

export async function recordCourseTeachingImprovementFollowupSample(
  sample: CourseTeachingImprovementFollowupSample,
): Promise<WorkbenchSnapshot> {
  await delay();
  const apiSnapshot = await tryApiSnapshot(async () =>
    asSnapshot(
      await apiJson("/api/course/teaching-improvement-followup-sample", {
        method: "POST",
        body: JSON.stringify({
          tenantId,
          courseId,
          sample,
        }),
      }),
    ),
  );
  if (apiSnapshot) return apiSnapshot;

  const targetIds = new Set(sample.targetWorkOrderIds.filter(Boolean));
  if (targetIds.size === 0) {
    throw new Error("效果采样单缺少关联诊断单。");
  }

  const snapshot = readSnapshot();
  const sampledAt = sample.sampledAt || nowText();
  const executionTraceId = `teaching-improvement-execution-${sample.planId || sample.receiptId}`;
  const sampleTraceId = `teaching-improvement-followup-${sample.planId || sample.id}`;
  const recordedOrderIds: string[] = [];

  snapshot.workOrders
    .filter((order) => targetIds.has(order.id))
    .forEach((order) => {
      const existing = snapshot.ledger[order.id] ?? [];
      const executionRecorded = existing.some(
        (entry) =>
          entry.type === "teaching_improvement_execution" &&
          entry.traceId === executionTraceId,
      );
      if (!executionRecorded) return;
      if (
        existing.some(
          (entry) => entry.type === "teaching_improvement_followup" && entry.traceId === sampleTraceId,
        )
      ) {
        return;
      }
      recordedOrderIds.push(order.id);
      snapshot.ledger[order.id] = [
        {
          id: `ledger-teaching-improvement-followup-${stableHash(`${sample.id}:${order.id}:${sampledAt}`)}`,
          type: "teaching_improvement_followup",
          time: sampledAt,
          actor: sample.sampledBy || order.owner || "任课教师",
          title: `下轮效果采样：${sample.observationWindow}`,
          source: "效果采样",
          detail: `${sample.summary}；观察指标：${sample.indicators
            .map((indicator) => `${indicator.label}=${indicator.expected}`)
            .join("、")}。边界：${sample.boundary}`,
          traceId: sampleTraceId,
          stageAfter: order.stage,
          evidenceCoverageAfter: order.evidenceCoverage,
        },
        ...existing,
      ];
    });

  if (recordedOrderIds.length === 0) {
    throw new Error("请先登记下轮课堂执行回证，或该采样单已经入账。");
  }

  snapshot.workOrders = snapshot.workOrders.map((order) =>
    recordedOrderIds.includes(order.id)
      ? {
          ...order,
          teacherNote:
            order.teacherNote ??
            `已建立“${sample.observationWindow}”效果采样口径，后续只依据新增证据更新形成性诊断。`,
          updatedAt: sampledAt,
        }
      : order,
  );
  snapshot.updatedAt = sampledAt;
  const next = withLocalReturnTokens(snapshot);
  writeSnapshot(next);
  return clone(next);
}

export async function recordCourseTeachingImprovementFollowupResult(
  result: CourseTeachingImprovementFollowupResult,
): Promise<WorkbenchSnapshot> {
  await delay();
  const apiSnapshot = await tryApiSnapshot(async () =>
    asSnapshot(
      await apiJson("/api/course/teaching-improvement-followup-result", {
        method: "POST",
        body: JSON.stringify({
          tenantId,
          courseId,
          result,
        }),
      }),
    ),
  );
  if (apiSnapshot) return apiSnapshot;

  const targetIds = new Set(result.targetWorkOrderIds.filter(Boolean));
  if (targetIds.size === 0) {
    throw new Error("采样结果缺少关联诊断单。");
  }

  const snapshot = readSnapshot();
  const collectedAt = result.collectedAt || nowText();
  const sampleTraceId = `teaching-improvement-followup-${result.planId || result.sampleId}`;
  const resultTraceId = `teaching-improvement-followup-result-${result.sampleId || result.id}`;
  const recordedOrderIds: string[] = [];

  snapshot.workOrders
    .filter((order) => targetIds.has(order.id))
    .forEach((order) => {
      const existing = snapshot.ledger[order.id] ?? [];
      const sampleRecorded = existing.some(
        (entry) =>
          entry.type === "teaching_improvement_followup" &&
          entry.traceId === sampleTraceId,
      );
      if (!sampleRecorded) return;
      if (
        existing.some(
          (entry) =>
            entry.type === "teaching_improvement_followup_result" &&
            entry.traceId === resultTraceId,
        )
      ) {
        return;
      }
      recordedOrderIds.push(order.id);
      snapshot.ledger[order.id] = [
        {
          id: `ledger-teaching-improvement-followup-result-${stableHash(`${result.id}:${order.id}:${collectedAt}`)}`,
          type: "teaching_improvement_followup_result",
          time: collectedAt,
          actor: result.collectedBy || order.owner || "任课教师",
          title: `采样结果回收：${result.observationWindow}`,
          source: "结果回收",
          detail: `${result.summary}；观察结果：${result.findings
            .map((finding) => `${finding.label}=${finding.observed}`)
            .join("、")}。下一步：${result.nextAction}。边界：${result.boundary}`,
          traceId: resultTraceId,
          stageAfter: order.stage,
          evidenceCoverageAfter: order.evidenceCoverage,
        },
        ...existing,
      ];
    });

  if (recordedOrderIds.length === 0) {
    throw new Error("请先登记下轮效果采样单，或该采样结果已经入账。");
  }

  snapshot.workOrders = snapshot.workOrders.map((order) =>
    recordedOrderIds.includes(order.id)
      ? {
          ...order,
          teacherNote:
            order.teacherNote ??
            `已回收“${result.observationWindow}”采样结果；仅作为课程改进线索，后续个人诊断仍需新增证据和教师复核。`,
          updatedAt: collectedAt,
        }
      : order,
  );
  snapshot.updatedAt = collectedAt;
  const next = withLocalReturnTokens(snapshot);
  writeSnapshot(next);
  return clone(next);
}

export async function recordCourseResourceRevisionTicket(
  ticket: CourseResourceRevisionTicket,
): Promise<WorkbenchSnapshot> {
  await delay();
  const apiSnapshot = await tryApiSnapshot(async () =>
    asSnapshot(
      await apiJson("/api/course/resource-revision", {
        method: "POST",
        body: JSON.stringify({
          tenantId,
          courseId,
          ticket,
        }),
      }),
    ),
  );
  if (apiSnapshot) return apiSnapshot;

  const targetIds = new Set(ticket.targetWorkOrderIds.filter(Boolean));
  if (targetIds.size === 0) {
    throw new Error("课程资源改版工单缺少关联诊断单。");
  }

  const snapshot = readSnapshot();
  const createdAt = ticket.createdAt || nowText();
  const sourceTraceId = `teaching-improvement-followup-result-${ticket.sampleId || ticket.sourceResultId}`;
  const revisionTraceId = `course-resource-revision-${ticket.id}`;
  const changeText = ticket.changes
    .map((change) => `${change.area}/${change.title}`)
    .join("、");
  const recordedOrderIds: string[] = [];

  snapshot.workOrders
    .filter((order) => targetIds.has(order.id))
    .forEach((order) => {
      const existing = snapshot.ledger[order.id] ?? [];
      const sourceRecorded = existing.some(
        (entry) =>
          entry.type === "teaching_improvement_followup_result" &&
          entry.traceId === sourceTraceId,
      );
      if (!sourceRecorded) return;
      if (
        existing.some(
          (entry) =>
            entry.type === "course_resource_revision" &&
            entry.traceId === revisionTraceId,
        )
      ) {
        return;
      }
      recordedOrderIds.push(order.id);
      snapshot.ledger[order.id] = [
        {
          id: `ledger-course-resource-revision-${stableHash(`${ticket.id}:${order.id}:${createdAt}`)}`,
          type: "course_resource_revision",
          time: createdAt,
          actor: ticket.createdBy || order.owner || "任课教师",
          title: `课程资源改版：${ticket.resourceTitle}`,
          source: "资源改版",
          detail: `${ticket.reason}；版本：${ticket.versionFrom} -> ${ticket.versionTo}；改版项：${changeText}。验收：${ticket.acceptanceChecks.join("、")}。边界：${ticket.boundary}`,
          traceId: revisionTraceId,
          stageAfter: order.stage,
          evidenceCoverageAfter: order.evidenceCoverage,
        },
        ...existing,
      ];
    });

  if (recordedOrderIds.length === 0) {
    throw new Error("请先回收下轮采样结果，或该课程资源改版工单已经入账。");
  }

  snapshot.workOrders = snapshot.workOrders.map((order) =>
    recordedOrderIds.includes(order.id)
      ? {
          ...order,
          teacherNote:
            order.teacherNote ??
            `已把采样结果沉淀为课程资源改版工单“${ticket.versionTo}”；后续只依据新增证据更新形成性诊断。`,
          updatedAt: createdAt,
        }
      : order,
  );
  snapshot.updatedAt = createdAt;
  const next = withLocalReturnTokens(snapshot);
  writeSnapshot(next);
  return clone(next);
}

export async function recordCourseResourceReleaseReceipt(
  receipt: CourseResourceReleaseReceipt,
): Promise<WorkbenchSnapshot> {
  await delay();
  const apiSnapshot = await tryApiSnapshot(async () =>
    asSnapshot(
      await apiJson("/api/course/resource-release", {
        method: "POST",
        body: JSON.stringify({
          tenantId,
          courseId,
          receipt,
        }),
      }),
    ),
  );
  if (apiSnapshot) return apiSnapshot;

  const targetIds = new Set(receipt.targetWorkOrderIds.filter(Boolean));
  if (targetIds.size === 0) {
    throw new Error("课程资源发布回证缺少关联诊断单。");
  }

  const snapshot = readSnapshot();
  const releasedAt = receipt.releasedAt || nowText();
  const revisionTraceId = `course-resource-revision-${receipt.revisionTicketId}`;
  const releaseTraceId = `course-resource-release-${receipt.id}`;
  const checkText = receipt.checks.map((check) => `${check.label}=${check.status}`).join("、");
  const recordedOrderIds: string[] = [];

  snapshot.workOrders
    .filter((order) => targetIds.has(order.id))
    .forEach((order) => {
      const existing = snapshot.ledger[order.id] ?? [];
      const revisionRecorded = existing.some(
        (entry) =>
          entry.type === "course_resource_revision" &&
          entry.traceId === revisionTraceId,
      );
      if (!revisionRecorded) return;
      if (
        existing.some(
          (entry) =>
            entry.type === "course_resource_release" &&
            entry.traceId === releaseTraceId,
        )
      ) {
        return;
      }
      recordedOrderIds.push(order.id);
      snapshot.ledger[order.id] = [
        {
          id: `ledger-course-resource-release-${stableHash(`${receipt.id}:${order.id}:${releasedAt}`)}`,
          type: "course_resource_release",
          time: releasedAt,
          actor: receipt.releasedBy || order.owner || "任课教师",
          title: `课程资源发布回证：${receipt.releasedVersion}`,
          source: "资源发布",
          detail: `${receipt.resourceTitle} 已通过 ${receipt.releaseChannel} 面向 ${receipt.releaseScope} 发布；资产：${receipt.assets.join("、")}；检查：${checkText}。回滚：${receipt.rollbackPlan}。边界：${receipt.boundary}`,
          traceId: releaseTraceId,
          stageAfter: order.stage,
          evidenceCoverageAfter: order.evidenceCoverage,
        },
        ...existing,
      ];
    });

  if (recordedOrderIds.length === 0) {
    throw new Error("请先登记课程资源改版工单，或该资源发布回证已经入账。");
  }

  snapshot.workOrders = snapshot.workOrders.map((order) =>
    recordedOrderIds.includes(order.id)
      ? {
          ...order,
          teacherNote:
            order.teacherNote ??
            `课程资源版本“${receipt.releasedVersion}”已发布；下一轮诊断只依据新证据和教师复核更新。`,
          updatedAt: releasedAt,
        }
      : order,
  );
  snapshot.updatedAt = releasedAt;
  const next = withLocalReturnTokens(snapshot);
  writeSnapshot(next);
  return clone(next);
}

export async function recordCourseResourceUsageReceipt(
  receipt: CourseResourceUsageReceipt,
): Promise<WorkbenchSnapshot> {
  await delay();
  const apiSnapshot = await tryApiSnapshot(async () =>
    asSnapshot(
      await apiJson("/api/course/resource-usage", {
        method: "POST",
        body: JSON.stringify({
          tenantId,
          courseId,
          receipt,
        }),
      }),
    ),
  );
  if (apiSnapshot) return apiSnapshot;

  const targetIds = new Set(receipt.targetWorkOrderIds.filter(Boolean));
  if (targetIds.size === 0) {
    throw new Error("课程资源使用回流单缺少关联诊断单。");
  }

  const snapshot = readSnapshot();
  const observedAt = receipt.observedAt || nowText();
  const releaseTraceId = `course-resource-release-${receipt.releaseReceiptId}`;
  const usageTraceId = `course-resource-usage-${receipt.id}`;
  const signalText = receipt.signals.map((signal) => `${signal.label}=${signal.value}`).join("、");
  const recordedOrderIds: string[] = [];

  snapshot.workOrders
    .filter((order) => targetIds.has(order.id))
    .forEach((order) => {
      const existing = snapshot.ledger[order.id] ?? [];
      const releaseRecorded = existing.some(
        (entry) =>
          entry.type === "course_resource_release" &&
          entry.traceId === releaseTraceId,
      );
      if (!releaseRecorded) return;
      if (
        existing.some(
          (entry) =>
            entry.type === "course_resource_usage" &&
            entry.traceId === usageTraceId,
        )
      ) {
        return;
      }
      recordedOrderIds.push(order.id);
      snapshot.ledger[order.id] = [
        {
          id: `ledger-course-resource-usage-${stableHash(`${receipt.id}:${order.id}:${observedAt}`)}`,
          type: "course_resource_usage",
          time: observedAt,
          actor: receipt.observedBy || order.owner || "任课教师",
          title: `课程资源使用回流：${receipt.usageWindow}`,
          source: "使用回流",
          detail: `${receipt.releasedVersion} 在 ${receipt.usageWindow} 已回收使用证据：活跃 ${receipt.activeLearners} 人、提交证据 ${receipt.submittedEvidenceCount} 份、待教师复核 ${receipt.teacherReviewReadyCount} 份、覆盖中位数 ${receipt.medianCoverageAfter}%。信号：${signalText}。下一步：${receipt.nextAction}。边界：${receipt.boundary}`,
          traceId: usageTraceId,
          stageAfter: order.stage,
          evidenceCoverageAfter: order.evidenceCoverage,
        },
        ...existing,
      ];
    });

  if (recordedOrderIds.length === 0) {
    throw new Error("请先登记课程资源发布回证，或该使用回流单已经入账。");
  }

  snapshot.workOrders = snapshot.workOrders.map((order) =>
    recordedOrderIds.includes(order.id)
      ? {
          ...order,
          teacherNote:
            order.teacherNote ??
            `课程资源版本“${receipt.releasedVersion}”已回收下一轮使用证据；仅作为课程资源继续优化线索。`,
          updatedAt: observedAt,
        }
      : order,
  );
  snapshot.updatedAt = observedAt;
  const next = withLocalReturnTokens(snapshot);
  writeSnapshot(next);
  return clone(next);
}

export async function remindCourseResourceUsageTargets(reminder: {
  usageReceiptId: string;
  traceId: string;
  title: string;
  targetWorkOrderIds: string[];
  note?: string;
}): Promise<WorkbenchSnapshot> {
  await delay();
  const apiSnapshot = await tryApiSnapshot(async () =>
    asSnapshot(
      await apiJson("/api/course/resource-usage-reminder", {
        method: "POST",
        body: JSON.stringify({
          tenantId,
          courseId,
          reminder,
        }),
      }),
    ),
  );
  if (apiSnapshot) return apiSnapshot;

  const usageReceiptId = reminder.usageReceiptId.trim();
  const traceId = reminder.traceId.trim();
  const targetIds = new Set(reminder.targetWorkOrderIds.filter(Boolean));
  if (!usageReceiptId || !traceId || targetIds.size === 0) {
    throw new Error("资源使用催办需要使用回流单和目标诊断单。");
  }

  const snapshot = readSnapshot();
  const remindedAt = nowText();
  const title = cropText(reminder.title || "课程资源使用回流", 90);
  const note =
    cropText(
      reminder.note || "提醒学生从新资源入口领取任务包，再补齐证据和反思；教师不直接给答案。",
      260,
    ) || "提醒学生按安全边界补齐证据。";
  const usageTraceId = `course-resource-usage-${usageReceiptId}`;
  const remindedIds: string[] = [];

  snapshot.workOrders
    .filter((order) => targetIds.has(order.id) && order.status !== "closed")
    .forEach((order) => {
      const returnState = normalizeStudentReturnState(snapshot.studentReturn[order.id]);
      if (countStudentReturnSteps(returnState) >= studentReturnSteps.length) return;
      const existing = snapshot.ledger[order.id] ?? [];
      const usageRecorded = existing.some(
        (entry) =>
          entry.type === "course_resource_usage" &&
          entry.traceId === usageTraceId,
      );
      if (!usageRecorded) return;
      if (
        existing.some(
          (entry) =>
            entry.type === "teacher_reminder" &&
            entry.traceId === traceId,
        )
      ) {
        return;
      }
      remindedIds.push(order.id);
      snapshot.ledger[order.id] = [
        {
          id: `ledger-resource-usage-reminder-${stableHash(`${traceId}:${order.id}:${remindedAt}`)}`,
          type: "teacher_reminder",
          time: remindedAt,
          actor: order.owner || "任课教师",
          title: `资源使用催办：${title}`,
          source: "教师催办",
          detail: `${note} 本次催办只要求提交可复核证据，不生成可直接提交的完整答案，不自动评价学生。`,
          traceId,
          stageAfter: order.stage,
          evidenceCoverageAfter: order.evidenceCoverage,
        },
        ...existing,
      ];
      snapshot.studentReturn[order.id] = returnState;
    });

  if (remindedIds.length === 0) {
    throw new Error("没有需要催办的资源使用回流对象，或请先登记使用回流单。");
  }

  snapshot.workOrders = snapshot.workOrders.map((order) =>
    remindedIds.includes(order.id) ? { ...order, updatedAt: remindedAt } : order,
  );
  snapshot.updatedAt = remindedAt;
  const next = withLocalReturnTokens(snapshot);
  writeSnapshot(next);
  return clone(next);
}

function courseOpsScoreForExport(order: LearningWorkOrder) {
  const riskScore: Record<RiskLevel, number> = { high: 62, medium: 38, low: 16 };
  const statusScore: Record<WorkOrderStatus, number> = {
    diagnosis: 32,
    evidence: 26,
    guardrail: 24,
    intervention: 22,
    review: 44,
    closed: 0,
  };
  return (
    riskScore[order.risk] +
    statusScore[order.status] +
    Math.max(0, 70 - order.evidenceCoverage) +
    Math.max(0, -order.valueAdded.delta * 4) +
    order.missingEvidence.length * 7
  );
}

export function downloadJsonFile(payload: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadTextFile(payload: string, filename: string, type = "text/plain;charset=utf-8") {
  const blob = new Blob([payload], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
