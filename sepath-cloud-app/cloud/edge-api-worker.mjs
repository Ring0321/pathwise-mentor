import { getEdgeStore } from "./edge-api-store.mjs";
import { createEdgeApiToken, verifyEdgeApiToken } from "./edge-api-auth.mjs";
import { handleLlmGatewayRequest } from "./llm-gateway-worker.mjs";
import { handleTeachingAgent } from "./work-order-agent.mjs";
import {
  WORKBENCH_COURSE_ID,
  WORKBENCH_TENANT_ID,
  applyCourseMicroTaskPublication,
  applyCourseMicroTaskReminder,
  applyCourseTeachingImprovementExecution,
  applyCourseTeachingImprovementFollowupResult,
  applyCourseTeachingImprovementFollowupSample,
  applyCourseTeachingImprovementPlan,
  applyCourseResourceReleaseReceipt,
  applyCourseResourceRevisionTicket,
  applyCourseResourceUsageReceipt,
  applyCourseResourceUsageReminder,
  applyInterventionPackage,
  applyStudentReturn,
  applyTeacherEvidenceReview,
  applyTeacherClosure,
  applyTeacherDecision,
  buildInterventionPackage,
  buildLearnerProfile,
  buildLedgerExportPayload,
  createDefaultCourseSettings,
  createSeedWorkbench,
  createWorkOrderFromCourseBatch,
  createWorkOrderFromGithubImport,
  emptyStudentReturnState,
  normalizeCourseMicroTaskPackage,
  normalizeCourseTeachingImprovementExecutionReceipt,
  normalizeCourseTeachingImprovementFollowupResult,
  normalizeCourseTeachingImprovementFollowupSample,
  normalizeCourseTeachingImprovementPlan,
  normalizeCourseResourceReleaseReceipt,
  normalizeCourseResourceRevisionTicket,
  normalizeCourseResourceUsageReceipt,
  nowText,
} from "./workbench-domain.mjs";

const RUNTIME = "sepath-edge-api.v1";

const protectedFieldNames = [
  "accessToken",
  "rawDiff",
  "privateEmail",
  "runnerSecret",
  "rawLog",
  "artifactUrl",
  "studentRealName",
  "studentName",
  "phone",
  "mobile",
  "email",
  "password",
  "apiKey",
  "secret",
];

const writeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const tokenIssuerHeader = "x-sepath-token-issuer-secret";

function envText(env, key) {
  return String(env?.[key] || "").trim();
}

function hasRuntimeSecret(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return false;
  return !["replace", "example", "placeholder", "your-", "<", ">"].some((marker) => text.includes(marker));
}

function isCloudRuntime(env) {
  return ["production", "staging", "cloud"].includes(envText(env, "SEPATH_DEPLOY_ENV").toLowerCase());
}

function requiresAuthSecret(env) {
  return isCloudRuntime(env) || envText(env, "SEPATH_REQUIRE_AUTH").toLowerCase() === "true";
}

function parseCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function allowedOrigins(env) {
  return parseCsv(env?.SEPATH_ALLOWED_ORIGINS);
}

function isLocalOrigin(origin) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(String(origin || ""));
}

function corsOriginFor(request, env) {
  const origin = request?.headers?.get("origin") || "";
  const allowed = allowedOrigins(env);
  if (allowed.length === 0) return isCloudRuntime(env) ? "" : "*";
  if (!origin) return allowed[0];
  if (allowed.includes(origin) || (!isCloudRuntime(env) && isLocalOrigin(origin))) return origin;
  return "";
}

function withCors(response, request, env) {
  const headers = new Headers(response.headers);
  const origin = corsOriginFor(request, env);
  if (origin) {
    headers.set("access-control-allow-origin", origin);
    headers.set("vary", "Origin");
  } else {
    headers.delete("access-control-allow-origin");
  }
  headers.set("access-control-allow-methods", "GET, POST, OPTIONS");
  headers.set(
    "access-control-allow-headers",
    `content-type, authorization, ${tokenIssuerHeader}, x-sepath-role, x-sepath-learner, x-sepath-review-mode, x-sepath-webhook-token, x-sepath-return-token, x-hub-signature-256, x-github-delivery, x-github-event`,
  );
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "no-referrer");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function json(data, init = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers: {
      "content-type": "application/json;charset=utf-8",
      ...init.headers,
    },
  });
}

function badRequest(message, details = {}) {
  return json({ runtime: RUNTIME, error: "bad_request", message, ...details }, { status: 400 });
}

function notFound(pathname) {
  return json({ runtime: RUNTIME, error: "not_found", pathname }, { status: 404 });
}

function privacyBlocked(message, findings = []) {
  return json({ runtime: RUNTIME, error: "privacy_blocked", message, findings }, { status: 422 });
}

function forbidden(message, details = {}) {
  return json({ runtime: RUNTIME, error: "forbidden", message, ...details }, { status: 403 });
}

function unauthorized(message, details = {}) {
  return json({ runtime: RUNTIME, error: "unauthorized", message, ...details }, { status: 401 });
}

function requireText(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is required`);
  }
  return value.trim();
}

function cleanStudentReturnText(value, maxLength = 800) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function studentReturnContentFromPayload(payload) {
  const artifact = payload.artifact;
  if (artifact && typeof artifact === "object" && !Array.isArray(artifact)) {
    const parts = [
      ["失败现象", cleanStudentReturnText(artifact.failureSymptom)],
      ["最小失败用例", cleanStudentReturnText(artifact.minimalCase)],
      ["修复/验证记录", cleanStudentReturnText(artifact.verificationRecord)],
      ["PR/CI 链接", cleanStudentReturnText(artifact.evidenceLink, 300)],
      ["诚信与边界", cleanStudentReturnText(artifact.integrityNote, 300)],
    ]
      .filter(([, value]) => value)
      .map(([label, value]) => `${label}：${value}`);
    if (parts.length > 0) return parts.join("；");
  }
  return cleanStudentReturnText(payload.content, 4000);
}

function isLikelyPseudonymous(value) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes("@")) return false;
  if (/^\d+$/.test(trimmed)) return false;
  if (/[\u4e00-\u9fa5]/.test(value)) return false;
  return /^(stu|learner|anon|hash|reviewer)[_-][a-z0-9_-]{3,}$/i.test(trimmed) || (/^[a-f0-9]{16,}$/i.test(trimmed) && /[a-f]/i.test(trimmed));
}

function scanProtectedFields(input) {
  const findings = [];
  const visit = (value, path) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      const fullPath = path ? `${path}.${key}` : key;
      if (protectedFieldNames.some((protectedName) => protectedName.toLowerCase() === key.toLowerCase())) {
        findings.push(fullPath);
      }
      visit(child, fullPath);
    }
  };
  visit(input, "");
  return findings;
}

async function sha256Hex(input) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return bytesToHex(new Uint8Array(digest));
}

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256Hex(input, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(input));
  return bytesToHex(new Uint8Array(signature));
}

function safeEqualText(left, right) {
  const a = String(left || "").toLowerCase();
  const b = String(right || "").toLowerCase();
  const length = Math.max(a.length, b.length);
  let mismatch = a.length ^ b.length;
  for (let index = 0; index < length; index += 1) {
    mismatch |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  }
  return mismatch === 0;
}

function safeEqualRawText(left, right) {
  const a = String(left || "");
  const b = String(right || "");
  const length = Math.max(a.length, b.length);
  let mismatch = a.length ^ b.length;
  for (let index = 0; index < length; index += 1) {
    mismatch |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  }
  return mismatch === 0;
}

function returnTokenSeed(env) {
  return env?.SEPATH_RETURN_SECRET || env?.SEPATH_AUTH_SECRET || "sepath-local-return-link";
}

async function studentReturnTokenFor(env, workOrder) {
  const digest = await sha256Hex(
    [
      returnTokenSeed(env),
      workOrder?.tenantId || WORKBENCH_TENANT_ID,
      workOrder?.courseId || WORKBENCH_COURSE_ID,
      workOrder?.id || "",
      workOrder?.learnerHash || workOrder?.studentNo || "",
    ].join(":"),
  );
  return `return_${digest.slice(0, 28)}`;
}

async function hasValidStudentReturnToken(env, workOrder, token) {
  if (!token || !workOrder) return false;
  return token === (await studentReturnTokenFor(env, workOrder));
}

function studentReturnTokenFrom(request, url, payload = {}) {
  return (
    payload.returnToken ||
    request.headers.get("x-sepath-return-token") ||
    url.searchParams.get("returnToken") ||
    url.searchParams.get("token") ||
    ""
  );
}

async function parseJson(request) {
  try {
    return await request.json();
  } catch {
    throw new Error("invalid JSON body");
  }
}

function parseJsonText(text) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("invalid JSON body");
  }
}

function checkTenantScope(payload) {
  const tenantId = requireText(payload.tenantId, "tenantId");
  const courseId = requireText(payload.courseId, "courseId");
  const learnerHash = payload.learnerHash === undefined ? undefined : requireText(payload.learnerHash, "learnerHash");
  if (learnerHash && !isLikelyPseudonymous(learnerHash)) {
    throw new Error("learnerHash must be pseudonymous");
  }
  return { tenantId, courseId, learnerHash };
}

function privacyMode(env) {
  return env?.SEPATH_PRIVACY_MODE || "pseudonymous";
}

function enforcePrivacy(env, payload) {
  if (privacyMode(env) !== "pseudonymous") {
    return ["SEPATH_PRIVACY_MODE"];
  }
  return scanProtectedFields(payload);
}

function storeMode(env) {
  const store = getEdgeStore(env);
  return store?.mode || "stateless-reference-worker";
}

function scopeFromUrl(url) {
  return {
    tenantId: url.searchParams.get("tenantId") || WORKBENCH_TENANT_ID,
    courseId: url.searchParams.get("courseId") || WORKBENCH_COURSE_ID,
  };
}

function scopeFromPayload(payload) {
  return {
    tenantId: requireText(payload.tenantId || WORKBENCH_TENANT_ID, "tenantId"),
    courseId: requireText(payload.courseId || WORKBENCH_COURSE_ID, "courseId"),
  };
}

async function ensureWorkbench(env, scope) {
  const seed = createSeedWorkbench(scope);
  const store = getEdgeStore(env);
  if (store?.ensureWorkbench) {
    await store.ensureWorkbench(seed);
  }
  return seed;
}

async function getWorkbenchSnapshot(env, scope, selectedId = "") {
  const seed = await ensureWorkbench(env, scope);
  const store = getEdgeStore(env);
  const workOrders = store?.listWorkOrders ? await store.listWorkOrders({ ...scope, limit: 100 }) : seed.workOrders;
  const availableIds = new Set(workOrders.map((order) => order.id));
  const resolvedSelectedId = availableIds.has(selectedId) ? selectedId : workOrders[0]?.id || seed.selectedId;
  const ledger = {};
  const studentReturn = {};

  for (const order of workOrders) {
    ledger[order.id] = store?.listWorkOrderLedger
      ? await store.listWorkOrderLedger(order.id, scope)
      : seed.ledger[order.id] || [];
    studentReturn[order.id] = store?.getStudentReturn
      ? (await store.getStudentReturn(order.id, scope)) || emptyStudentReturnState()
      : seed.studentReturn[order.id] || emptyStudentReturnState();
  }

  return {
    runtime: RUNTIME,
    tenantId: scope.tenantId,
    courseId: scope.courseId,
    selectedId: resolvedSelectedId,
    workOrders,
    ledger,
    studentReturn,
    updatedAt: nowText(),
    stored: Boolean(store),
    storageMode: storeMode(env),
  };
}

async function getWorkOrderBundle(env, scope, orderId) {
  const snapshot = await getWorkbenchSnapshot(env, scope, orderId);
  const workOrder = snapshot.workOrders.find((order) => order.id === orderId) || null;
  return {
    snapshot,
    workOrder,
    ledger: snapshot.ledger[orderId] || [],
    studentReturn: snapshot.studentReturn[orderId] || emptyStudentReturnState(),
  };
}

function isSameLearner(order, learnerHash) {
  return Boolean(
    learnerHash &&
      order &&
      (order.learnerHash === learnerHash || order.studentNo === learnerHash),
  );
}

function anonymizedLearnerLabel(order) {
  const source = String(order?.learnerHash || order?.studentNo || order?.id || "anonymous");
  return `匿名学习者 ${source.slice(-4)}`;
}

async function shapeWorkOrderForActor(env, actor, order) {
  if (!order) return order;
  const shaped = { ...order };
  delete shaped.returnToken;

  if (canManageCourse(actor.role)) {
    shaped.returnToken = await studentReturnTokenFor(env, order);
    return shaped;
  }

  if (actor.role === "reviewer") {
    shaped.studentName = anonymizedLearnerLabel(order);
    shaped.studentNo = order.learnerHash || `anon_${String(order.id).slice(-6)}`;
    shaped.owner = "课程教师";
    if (shaped.teacherNote) {
      shaped.teacherNote = "教师复核记录已留存，只读巡检端仅查看脱敏结论。";
    }
  }

  return shaped;
}

async function shapeSnapshotForActor(env, snapshot, actor, options = {}) {
  let visibleOrders = snapshot.workOrders;
  if (actor.role === "student") {
    visibleOrders = visibleOrders.filter((order) => {
      if (options.returnTokenOrderId) return order.id === options.returnTokenOrderId;
      return isSameLearner(order, actor.learnerHash);
    });
  }

  const visibleIds = new Set(visibleOrders.map((order) => order.id));
  const selectedId = visibleIds.has(snapshot.selectedId)
    ? snapshot.selectedId
    : visibleOrders[0]?.id || "";
  const shapedOrders = await Promise.all(
    visibleOrders.map((order) => shapeWorkOrderForActor(env, actor, order)),
  );

  return {
    ...snapshot,
    selectedId,
    workOrders: shapedOrders,
    ledger: Object.fromEntries(
      Object.entries(snapshot.ledger || {}).filter(([id]) => visibleIds.has(id)),
    ),
    studentReturn: Object.fromEntries(
      Object.entries(snapshot.studentReturn || {}).filter(([id]) => visibleIds.has(id)),
    ),
  };
}

async function getCourseSettings(env, scope) {
  const defaults = createDefaultCourseSettings(scope);
  const store = getEdgeStore(env);
  return store?.getCourseSettings ? await store.getCourseSettings(scope, defaults) : defaults;
}

function rosterFromWorkbench(scope, settings, snapshot) {
  const seen = new Set();
  const learners = [];
  for (const order of snapshot.workOrders || []) {
    const learnerHash = order.learnerHash || order.studentNo;
    if (!isLikelyPseudonymous(learnerHash) || seen.has(learnerHash)) continue;
    seen.add(learnerHash);
    learners.push({
      learnerHash,
      learnerAlias: order.studentName || `SE-${String(learnerHash).slice(-4).toUpperCase()}`,
      className: order.courseClass || settings.courseClass,
      groupName: "未分组",
      repositoryUser: "",
      status: order.status === "closed" ? "watch" : "active",
      lastActivity: order.updatedAt || order.createdAt || "",
    });
  }
  return {
    tenantId: scope.tenantId,
    courseId: scope.courseId,
    courseClass: settings.courseClass,
    courseName: settings.courseName,
    learners,
    updatedAt: nowText(),
  };
}

function normalizeRosterLearner(input, index, settings) {
  const learnerHash = requireText(input.learnerHash, `learners[${index}].learnerHash`);
  if (!isLikelyPseudonymous(learnerHash)) {
    throw new Error(`learners[${index}].learnerHash must be pseudonymous`);
  }
  const status = ["active", "watch", "paused"].includes(input.status) ? input.status : "active";
  return {
    learnerHash,
    learnerAlias: String(input.learnerAlias || `SE-${String(index + 1).padStart(3, "0")}`).trim().slice(0, 40),
    className: String(input.className || settings.courseClass || "软件工程班级").trim().slice(0, 60),
    groupName: String(input.groupName || "未分组").trim().slice(0, 40),
    repositoryUser: String(input.repositoryUser || "").trim().replace(/^@/, "").slice(0, 80),
    status,
    lastActivity: String(input.lastActivity || "").trim().slice(0, 40),
  };
}

async function getCourseRoster(env, scope) {
  const settings = await getCourseSettings(env, scope);
  const snapshot = await getWorkbenchSnapshot(env, scope);
  const defaults = rosterFromWorkbench(scope, settings, snapshot);
  const store = getEdgeStore(env);
  return store?.getCourseRoster ? await store.getCourseRoster(scope, defaults) : defaults;
}

async function handleCourseRosterRead(url, request, env) {
  const scope = scopeFromUrl(url);
  const authError = await authorize(request, url, env, "course_roster.read", scope);
  if (authError) return authError;
  const roster = await getCourseRoster(env, scope);
  return json({
    runtime: RUNTIME,
    tenantId: scope.tenantId,
    courseId: scope.courseId,
    roster,
    storageMode: storeMode(env),
    stored: Boolean(getEdgeStore(env)),
  });
}

async function handleCourseRosterWrite(request, env) {
  const url = new URL(request.url);
  const payload = await parseJson(request);
  const findings = enforcePrivacy(env, payload);
  if (findings.length > 0) {
    return privacyBlocked("course roster contains protected fields", findings);
  }

  let scope;
  let packageDraft;
  try {
    scope = scopeFromPayload(payload);
    if (payload.packageDraft !== undefined) {
      if (!payload.packageDraft || typeof payload.packageDraft !== "object" || Array.isArray(payload.packageDraft)) {
        throw new Error("packageDraft must be an object");
      }
      packageDraft = payload.packageDraft;
    }
  } catch (error) {
    return badRequest(error.message);
  }

  const authError = await authorize(request, url, env, "course_roster.write", scope);
  if (authError) return authError;
  const store = getEdgeStore(env);
  const settings = await getCourseSettings(env, scope);
  let learners;
  try {
    learners = (Array.isArray(payload.learners) ? payload.learners : [])
      .map((learner, index) => normalizeRosterLearner(learner, index, settings))
      .filter((learner, index, all) => all.findIndex((item) => item.learnerHash === learner.learnerHash) === index);
    if (learners.length === 0) throw new Error("at least one pseudonymous learner is required");
    if (learners.length > 120) throw new Error("course roster supports up to 120 learners in one request");
  } catch (error) {
    return badRequest(error.message);
  }
  const roster = {
    tenantId: scope.tenantId,
    courseId: scope.courseId,
    courseClass: settings.courseClass,
    courseName: settings.courseName,
    learners,
    updatedAt: nowText(),
  };
  const saved = store?.putCourseRoster ? await store.putCourseRoster(scope, roster) : roster;
  return json({
    runtime: RUNTIME,
    tenantId: scope.tenantId,
    courseId: scope.courseId,
    roster: saved,
    storageMode: storeMode(env),
    stored: Boolean(store),
  });
}

async function actorContext(request, url, env) {
  if (env?.SEPATH_AUTH_SECRET) {
    const verified = await verifyEdgeApiToken(request.headers.get("authorization") || "", env.SEPATH_AUTH_SECRET);
    if (!verified.ok) return { error: verified.error };
    const role = String(verified.claims.role || "reviewer").toLowerCase().trim();
    return {
      role,
      learnerHash: verified.claims.learnerHash || "",
      reviewMode: verified.claims.reviewMode || "",
      tenantId: verified.claims.tenantId || "",
      courseId: verified.claims.courseId || "",
      workOrderId: verified.claims.workOrderId || "",
      tokenScope: verified.claims.tokenScope || "",
      authMode: "hmac-token",
    };
  }
  if (requiresAuthSecret(env)) {
    return { error: "missing_auth_secret" };
  }
  const role = (request.headers.get("x-sepath-role") || url.searchParams.get("role") || "reviewer")
    .toLowerCase()
    .trim();
  return {
    role,
    learnerHash: request.headers.get("x-sepath-learner") || "",
    reviewMode: request.headers.get("x-sepath-review-mode") || url.searchParams.get("reviewMode") || "",
    tenantId: "",
    courseId: "",
    workOrderId: "",
    tokenScope: "",
    authMode: "local-header",
  };
}

function canManageCourse(role) {
  return ["system", "course_admin", "teacher"].includes(role);
}

function canWriteSystemLedger(role) {
  return ["system", "course_admin"].includes(role);
}

function hasValidWebhookToken(request, env) {
  const configured = env?.SEPATH_GITHUB_WEBHOOK_TOKEN || "";
  if (!configured) return false;
  return request.headers.get("x-sepath-webhook-token") === configured;
}

async function verifyGithubWebhookAuth(request, rawBody, env) {
  const signatureSecret = env?.SEPATH_GITHUB_WEBHOOK_SECRET || env?.SEPATH_GITHUB_WEBHOOK_TOKEN || "";
  const signatureHeader = request.headers.get("x-hub-signature-256") || "";
  if (signatureHeader) {
    if (!signatureSecret) {
      return { ok: false, mode: "github-signature", reason: "missing_webhook_secret" };
    }
    const expected = `sha256=${await hmacSha256Hex(rawBody, signatureSecret)}`;
    if (!safeEqualText(signatureHeader, expected)) {
      return { ok: false, mode: "github-signature", reason: "bad_github_signature" };
    }
    return { ok: true, mode: "github-signature" };
  }
  if (hasValidWebhookToken(request, env)) {
    return { ok: true, mode: "sepath-webhook-token" };
  }
  return {
    ok: false,
    mode: "github-webhook",
    reason: signatureSecret ? "missing_github_signature" : "missing_webhook_secret",
  };
}

function githubIntegrationEventBase(payload, scope, sourceLabel, digest, request, extras = {}) {
  const now = new Date().toISOString();
  const status = extras.status || "created";
  const deliveryId = payload.deliveryId || request.headers.get("x-github-delivery") || "";
  const githubEvent = request.headers.get("x-github-event") || "";
  return {
    id: extras.id || `github-${sourceLabel}-${digest.slice(0, 16)}`,
    tenantId: scope.tenantId,
    courseId: scope.courseId,
    learnerHash: scope.learnerHash || payload.learnerHash || "",
    provider: "github",
    source: sourceLabel,
    status,
    authMode: extras.authMode || "",
    deliveryId,
    githubEvent,
    repository: String(payload.repository || "").trim(),
    branch: String(payload.branch || "").trim(),
    prUrl: String(payload.prUrl || "").trim(),
    ciRunUrl: String(payload.ciRunUrl || "").trim(),
    workOrderId: extras.workOrderId || "",
    workOrderIds: extras.workOrderIds || [],
    createdCount: Number(extras.createdCount || 0),
    skippedCount: Number(extras.skippedCount || 0),
    summary: String(extras.summary || payload.ciLogSummary || payload.trigger || "").slice(0, 260),
    createdAt: extras.createdAt || now,
    updatedAt: extras.updatedAt || extras.createdAt || now,
  };
}

async function recordIntegrationEvent(env, event) {
  const store = getEdgeStore(env);
  if (store?.putIntegrationEvent) {
    await store.putIntegrationEvent(event);
  }
  return event;
}

async function authorize(request, url, env, action, scope = {}) {
  const actor = await actorContext(request, url, env);
  if (actor.error) {
    return unauthorized("valid SE-Path access token is required", {
      action,
      authMode: "hmac-token",
      reason: actor.error,
    });
  }
  if (actor.tenantId && scope.tenantId && actor.tenantId !== scope.tenantId) {
    return forbidden("token tenant scope does not match requested tenant", {
      action,
      role: actor.role,
      authMode: actor.authMode,
    });
  }
  if (actor.courseId && scope.courseId && actor.courseId !== scope.courseId) {
    return forbidden("token course scope does not match requested course", {
      action,
      role: actor.role,
      authMode: actor.authMode,
    });
  }
  const learnerHash = scope.learnerHash || url.searchParams.get("learnerHash") || "";
  const studentOwnScope = actor.role === "student" && learnerHash && learnerHash === actor.learnerHash;
  const workOrderTokenBound =
    !actor.workOrderId || (scope.workOrderId && actor.workOrderId === scope.workOrderId);
  const studentOwnUnboundScope = studentOwnScope && !actor.workOrderId;
  const studentOwnWorkOrderScope = studentOwnScope && workOrderTokenBound;
  const studentReturnTokenScope = actor.role === "student" && Boolean(scope.returnTokenValid) && Boolean(learnerHash);
  const reviewerSandbox = actor.role === "reviewer" && actor.reviewMode === "sandbox";

  const allow = (() => {
    switch (action) {
      case "health.read":
      case "session.read":
        return true;
      case "evidence.write":
        return canManageCourse(actor.role) || (studentOwnUnboundScope && ["reflection_submitted", "student_question", "help_request"].includes(scope.eventType));
      case "evidence.read":
        return canManageCourse(actor.role) || studentOwnUnboundScope || studentReturnTokenScope || (reviewerSandbox && Boolean(learnerHash));
      case "diagnosis.read":
        return canManageCourse(actor.role) || studentOwnUnboundScope || actor.role === "reviewer";
      case "intervention.rank":
        return canManageCourse(actor.role);
      case "review.write":
        return canManageCourse(actor.role);
      case "review.read":
        return canManageCourse(actor.role) || (reviewerSandbox && Boolean(learnerHash));
      case "ledger.import":
        return canWriteSystemLedger(actor.role);
      case "privacy.read":
        return canManageCourse(actor.role) || actor.role === "reviewer";
      case "workbench.read":
      case "workorder.read":
      case "profile.read":
      case "integration.read":
        return canManageCourse(actor.role) || studentOwnWorkOrderScope || studentReturnTokenScope || reviewerSandbox;
      case "workorder.review":
      case "workorder.package":
      case "workorder.evidence_review":
      case "workorder.close":
      case "course_micro_task.publish":
      case "course_micro_task.remind":
      case "course_teaching_improvement.publish":
      case "course_teaching_improvement_execution.record":
      case "course_teaching_improvement_followup.record":
      case "course_teaching_improvement_followup_result.record":
      case "course_resource_revision.record":
      case "course_resource_release.record":
      case "course_resource_usage.record":
      case "course_resource_usage.remind":
      case "course.launch":
      case "integration.import":
      case "course_settings.write":
      case "course_roster.write":
      case "workorder.batch_create":
      case "webhook.import":
        return canManageCourse(actor.role);
      case "course_settings.read":
      case "course_roster.read":
        return canManageCourse(actor.role) || reviewerSandbox;
      case "workorder.student_return":
        return canManageCourse(actor.role) || studentOwnWorkOrderScope || studentReturnTokenScope;
      case "ledger.export":
        return canManageCourse(actor.role) || reviewerSandbox;
      default:
        return false;
    }
  })();

  if (allow) return null;
  return forbidden("role is not allowed for this Edge API action", {
    action,
    role: actor.role,
    authMode: actor.authMode,
    learnerHash: actor.learnerHash || undefined,
    requiredScope: action,
  });
}

async function handleEvidenceCreate(request, env) {
  const url = new URL(request.url);
  const payload = await parseJson(request);
  const findings = enforcePrivacy(env, payload);
  if (findings.length > 0) {
    return privacyBlocked("payload contains protected fields or non-pseudonymous runtime mode", findings);
  }
  let scope;
  try {
    scope = checkTenantScope(payload);
    requireText(payload.source, "source");
    requireText(payload.eventType, "eventType");
    requireText(payload.externalId, "externalId");
  } catch (error) {
    return badRequest(error.message);
  }
  const authError = await authorize(request, url, env, "evidence.write", { ...scope, eventType: payload.eventType });
  if (authError) return authError;

  const idempotencyKey =
    payload.idempotencyKey || `${scope.tenantId}:${payload.source}:${payload.externalId}:${payload.eventType}`;
  const digest = await sha256Hex(idempotencyKey);
  const traceId = payload.traceId || `trace-${digest.slice(0, 12)}`;
  const qualityGate = payload.eventType === "direct_answer_requested" ? "watch" : "pass";
  const eventRecord = {
    runtime: RUNTIME,
    eventId: `evt_${digest.slice(0, 16)}`,
    tenantId: scope.tenantId,
    courseId: scope.courseId,
    learnerHash: scope.learnerHash,
    source: payload.source,
    eventType: payload.eventType,
    externalId: payload.externalId,
    traceId,
    idempotencyKey,
    qualityGate,
    payload: payload.payload || {},
    createdAt: new Date().toISOString(),
  };
  const store = getEdgeStore(env);
  const stored = store ? await store.putEvidence(eventRecord) : { record: eventRecord, deduped: false };

  return json({
    runtime: RUNTIME,
    eventId: stored.record.eventId,
    traceId,
    deduped: stored.deduped,
    qualityGate,
    stored: Boolean(store),
    storageMode: storeMode(env),
    acceptedShape: ["tenantId", "courseId", "learnerHash", "source", "eventType", "externalId", "payload"],
    evidenceBoundary: "payload accepted only after protected-field scan; current store is injectable and can be replaced by Postgres/D1.",
  });
}

async function handleEvidenceList(url, request, env) {
  const tenantId = url.searchParams.get("tenantId");
  const courseId = url.searchParams.get("courseId");
  const learnerHash = url.searchParams.get("learnerHash") || undefined;
  if (!tenantId || !courseId) {
    return badRequest("tenantId and courseId are required");
  }
  if (learnerHash && !isLikelyPseudonymous(learnerHash)) {
    return badRequest("learnerHash must be pseudonymous");
  }
  const authError = await authorize(request, url, env, "evidence.read", { tenantId, courseId, learnerHash });
  if (authError) return authError;
  const store = getEdgeStore(env);
  const events = store
    ? await store.listEvidence({ tenantId, courseId, learnerHash, limit: Number(url.searchParams.get("limit") || 50) })
    : [];
  return json({
    runtime: RUNTIME,
    tenantId,
    courseId,
    learnerHash,
    storageMode: storeMode(env),
    stored: Boolean(store),
    count: events.length,
    events,
  });
}

function diagnosisFor(learnerHash) {
  const lowTesting = String(learnerHash || "").includes("8f2a") || String(learnerHash || "").includes("testing");
  return {
    diagnosisId: lowTesting ? "diag-testing-boundary" : "diag-software-project-loop",
    blocker: lowTesting ? "测试边界与异常路径建模不足" : "证据覆盖不足，需补齐 CI、PR 和反思链路",
    confidence: lowTesting ? 0.78 : 0.66,
    evidenceEventIds: lowTesting ? ["evt-ci-failed", "evt-pr-opened", "evt-review"] : ["evt-baseline"],
    recommendedNextAction: lowTesting ? "先完成异常路径检查清单，再进入 20 分钟 mini lab。" : "补齐最近一次 PR、CI 和反思事件。",
  };
}

async function handleDiagnosisRead(url, request, env) {
  const match = url.pathname.match(/^\/api\/learners\/([^/]+)\/diagnosis$/);
  if (!match) return notFound(url.pathname);
  const tenantId = url.searchParams.get("tenantId");
  const courseId = url.searchParams.get("courseId");
  const learnerHash = decodeURIComponent(match[1]);
  if (!tenantId || !courseId || !isLikelyPseudonymous(learnerHash)) {
    return badRequest("tenantId, courseId and pseudonymous learnerHash are required");
  }
  const authError = await authorize(request, url, env, "diagnosis.read", { tenantId, courseId, learnerHash });
  if (authError) return authError;
  return json({
    runtime: RUNTIME,
    tenantId,
    courseId,
    learnerHash,
    qualityGate: "read-only",
    ...diagnosisFor(learnerHash),
  });
}

function safeVoiScore(action) {
  const expectedGrowth = Number(action.expectedGrowth ?? 0);
  const informationGain = Number(action.informationGain ?? 0);
  const transferability = Number(action.transferability ?? 0);
  const windowRescue = Number(action.windowRescue ?? 0);
  const burden = Number(action.burden ?? 0);
  const risk = Number(action.risk ?? 0);
  const monetaryCost = Number(action.monetaryCost ?? 0);
  return Math.round((expectedGrowth * 1.25 + informationGain + transferability + windowRescue - burden - risk * 1.7 - monetaryCost / 40) * 100) / 100;
}

async function handleInterventionRank(request, env) {
  const url = new URL(request.url);
  const payload = await parseJson(request);
  const findings = enforcePrivacy(env, payload);
  if (findings.length > 0) {
    return privacyBlocked("intervention payload contains protected fields", findings);
  }
  try {
    const scope = checkTenantScope(payload);
    requireText(payload.diagnosisId, "diagnosisId");
    requireText(payload.strategyVersion, "strategyVersion");
    const authError = await authorize(request, url, env, "intervention.rank", scope);
    if (authError) return authError;
  } catch (error) {
    return badRequest(error.message);
  }
  const candidateActions = Array.isArray(payload.candidateActions) ? payload.candidateActions : [];
  if (candidateActions.length === 0) {
    return badRequest("candidateActions must be a non-empty array");
  }
  const evaluated = candidateActions.map((action, index) => {
    const id = action.id || action.taskId || `action-${index + 1}`;
    const blockedReason = action.directAnswer
      ? "DIRECT_ANSWER_POLICY_GATE"
      : action.highStakes
        ? "HIGH_STAKES_REVIEW_REQUIRED"
        : action.paidService
          ? "PAID_ACTION_BLOCKED"
          : action.consentValid === false || action.rulesValid === false
            ? "POLICY_OR_CONSENT_INVALID"
            : action.reversible === false
              ? "IRREVERSIBLE_ACTION_REVIEW_REQUIRED"
              : "";
    return {
      ...action,
      id,
      safeVoiScore: safeVoiScore(action),
      qualityGate: blockedReason ? "blocked" : "ready",
      blockedReason,
    };
  });
  const rankedActions = evaluated
    .filter((action) => action.qualityGate === "ready")
    .sort((left, right) => right.safeVoiScore - left.safeVoiScore);
  const blockedActions = evaluated.filter((action) => action.qualityGate === "blocked");
  return json({
    runtime: RUNTIME,
    strategyVersion: payload.strategyVersion,
    traceId: payload.traceId || `trace-rank-${Date.now()}`,
    rankedActions,
    blockedActions,
    teacherReviewRequired: blockedActions.length > 0 || rankedActions.some((action) => Number(action.risk ?? 0) >= 6),
    policy: "SafeVOI ranks reversible, low-risk learning actions and blocks direct-answer or paid high-stakes actions.",
  });
}

async function handleReviewTicket(request, env) {
  const url = new URL(request.url);
  const payload = await parseJson(request);
  const findings = enforcePrivacy(env, payload);
  if (findings.length > 0) {
    return privacyBlocked("review ticket contains protected fields", findings);
  }
  let scope;
  try {
    scope = checkTenantScope(payload);
    requireText(payload.severity, "severity");
  } catch (error) {
    return badRequest(error.message);
  }
  const authError = await authorize(request, url, env, "review.write", scope);
  if (authError) return authError;
  const reasonCodes = Array.isArray(payload.reasonCodes) ? payload.reasonCodes.slice(0, 8) : [];
  const digest = await sha256Hex(`${scope.tenantId}:${scope.courseId}:${scope.learnerHash}:${payload.severity}:${reasonCodes.join("|")}`);
  const ticket = {
    runtime: RUNTIME,
    ticketId: `ticket_${digest.slice(0, 14)}`,
    tenantId: scope.tenantId,
    courseId: scope.courseId,
    learnerHash: scope.learnerHash,
    status: "pending_teacher_review",
    requiredActions: ["confirm risk reason", "choose scaffold or mini lab", "do not publish direct answer"],
    sla: payload.severity === "high" ? "same day" : "next teaching window",
    reasonCodes,
    traceId: payload.traceId || `trace-ticket-${digest.slice(0, 10)}`,
    createdAt: new Date().toISOString(),
  };
  const store = getEdgeStore(env);
  const stored = store ? await store.putReviewTicket(ticket) : { ticket, deduped: false };
  return json({
    ...stored.ticket,
    deduped: stored.deduped,
    stored: Boolean(store),
    storageMode: storeMode(env),
  });
}

async function handleReviewTicketList(url, request, env) {
  const tenantId = url.searchParams.get("tenantId");
  const courseId = url.searchParams.get("courseId");
  const learnerHash = url.searchParams.get("learnerHash") || undefined;
  if (!tenantId || !courseId) {
    return badRequest("tenantId and courseId are required");
  }
  if (learnerHash && !isLikelyPseudonymous(learnerHash)) {
    return badRequest("learnerHash must be pseudonymous");
  }
  const authError = await authorize(request, url, env, "review.read", { tenantId, courseId, learnerHash });
  if (authError) return authError;
  const store = getEdgeStore(env);
  const tickets = store
    ? await store.listReviewTickets({
        tenantId,
        courseId,
        learnerHash,
        status: url.searchParams.get("status") || undefined,
        limit: Number(url.searchParams.get("limit") || 50),
      })
    : [];
  return json({
    runtime: RUNTIME,
    tenantId,
    courseId,
    learnerHash,
    storageMode: storeMode(env),
    stored: Boolean(store),
    count: tickets.length,
    tickets,
  });
}

async function handleLedgerImport(request, env) {
  const url = new URL(request.url);
  const payload = await parseJson(request);
  const findings = enforcePrivacy(env, payload);
  if (findings.length > 0) {
    return privacyBlocked("ledger payload contains protected fields", findings);
  }
  try {
    requireText(payload.tenantId, "tenantId");
    requireText(payload.ledgerSha256, "ledgerSha256");
  } catch (error) {
    return badRequest(error.message);
  }
  const authError = await authorize(request, url, env, "ledger.import", { tenantId: payload.tenantId });
  if (authError) return authError;
  const events = Array.isArray(payload.events) ? payload.events.slice(0, 200) : [];
  const validIds = new Set();
  let duplicateEvents = 0;
  let invalidEvents = 0;
  for (const event of events) {
    if (!event?.id || !event?.type || !event?.traceId) {
      invalidEvents += 1;
      continue;
    }
    if (validIds.has(event.id)) duplicateEvents += 1;
    validIds.add(event.id);
  }
  return json({
    runtime: RUNTIME,
    importedEvents: validIds.size,
    duplicateEvents,
    invalidEvents,
    mergeStatus: invalidEvents > 0 ? "partial" : "accepted",
    storageMode: storeMode(env),
  });
}

async function handlePrivacyAudit(url, request, env) {
  const tenantId = url.searchParams.get("tenantId");
  const courseId = url.searchParams.get("courseId");
  const role = request.headers.get("x-sepath-role") || url.searchParams.get("role") || "reviewer";
  if (!tenantId || !courseId) {
    return badRequest("tenantId and courseId are required");
  }
  const authError = await authorize(request, url, env, "privacy.read", { tenantId, courseId });
  if (authError) return authError;
  const reviewerDenied = ["export_raw_ledger", "view_student_pii", "publish_direct_answer"];
  const store = getEdgeStore(env);
  const scope = { tenantId, courseId, limit: 20 };
  const storedAuditEvents = store?.listAuditEvents ? await store.listAuditEvents(scope) : [];
  return json({
    runtime: RUNTIME,
    gate: privacyMode(env) === "pseudonymous" ? "pass" : "block",
    tenantId,
    courseId,
    role,
    piiFindings: [],
    blockedRequests: role === "reviewer" ? reviewerDenied : ["publish_direct_answer"],
    storageMode: storeMode(env),
    auditEvents: [
      {
        id: "audit-cloud-smoke",
        action: "privacy-audit-read",
        actorRole: role,
        result: "read-only",
      },
      ...storedAuditEvents,
    ],
  });
}

function clampTokenTtlSeconds(value, role) {
  const requested = Number(value || 0);
  const defaults = {
    student: 20 * 60,
    reviewer: 30 * 60,
    teacher: 60 * 60,
    course_admin: 60 * 60,
    system: 15 * 60,
  };
  const max = role === "student" ? 2 * 60 * 60 : 4 * 60 * 60;
  if (!Number.isFinite(requested) || requested <= 0) return defaults[role] || 30 * 60;
  return Math.max(60, Math.min(Math.floor(requested), max));
}

async function tokenIssuerContext(request, url, env) {
  if (!env?.SEPATH_AUTH_SECRET) {
    return { error: "missing_auth_secret", status: 503 };
  }
  const configured = envText(env, "SEPATH_TOKEN_ISSUER_SECRET");
  const provided = request.headers.get(tokenIssuerHeader) || "";
  if (configured && safeEqualRawText(provided, configured)) {
    return { role: "system", authMode: "issuer-secret" };
  }
  const actor = await actorContext(request, url, env);
  if (actor.error) return { error: actor.error, status: 401 };
  if (!canManageCourse(actor.role)) return { error: "token_issuer_forbidden", status: 403, actor };
  return actor;
}

async function handleAuthToken(request, env) {
  const url = new URL(request.url);
  const payload = await parseJson(request);
  const findings = enforcePrivacy(env, payload);
  if (findings.length > 0) {
    return privacyBlocked("token request contains protected fields", findings);
  }

  let scope;
  let role;
  let learnerHash = "";
  let workOrderId = "";
  try {
    scope = scopeFromPayload(payload);
    role = requireText(payload.role, "role").toLowerCase();
    if (!["teacher", "course_admin", "student", "reviewer", "system"].includes(role)) {
      throw new Error("role must be teacher, course_admin, student, reviewer or system");
    }
    learnerHash = String(payload.learnerHash || "").trim();
    if (role === "student" && !learnerHash) throw new Error("student token requires learnerHash");
    if (learnerHash && !isLikelyPseudonymous(learnerHash)) {
      throw new Error("learnerHash must be pseudonymous");
    }
    workOrderId = String(payload.workOrderId || "").trim();
  } catch (error) {
    return badRequest(error.message);
  }

  const issuer = await tokenIssuerContext(request, url, env);
  if (issuer.error) {
    const details = { reason: issuer.error, authMode: env?.SEPATH_AUTH_SECRET ? "hmac-token" : "missing" };
    if (issuer.status === 403) return forbidden("actor cannot issue access tokens", details);
    if (issuer.status === 503) return json({ runtime: RUNTIME, error: "not_ready", message: "SEPATH_AUTH_SECRET is required before issuing tokens", ...details }, { status: 503 });
    return unauthorized("valid token issuer credential is required", details);
  }
  if (issuer.tenantId && issuer.tenantId !== scope.tenantId) {
    return forbidden("issuer tenant scope does not match requested tenant");
  }
  if (issuer.courseId && issuer.courseId !== scope.courseId) {
    return forbidden("issuer course scope does not match requested course");
  }
  if (issuer.role === "teacher" && ["system", "course_admin"].includes(role)) {
    return forbidden("teacher token cannot issue elevated tokens");
  }

  let returnToken = "";
  if (workOrderId) {
    const bundle = await getWorkOrderBundle(env, scope, workOrderId);
    if (!bundle.workOrder) return notFound(`/api/work-orders/${workOrderId}`);
    if (learnerHash && bundle.workOrder.learnerHash && learnerHash !== bundle.workOrder.learnerHash) {
      return forbidden("requested learnerHash does not match work order");
    }
    learnerHash = bundle.workOrder.learnerHash || learnerHash;
    if (role === "student") returnToken = await studentReturnTokenFor(env, bundle.workOrder);
  }

  const ttlSeconds = clampTokenTtlSeconds(payload.ttlSeconds, role);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const expiresAt = new Date((nowSeconds + ttlSeconds) * 1000).toISOString();
  const claims = {
    role,
    tenantId: scope.tenantId,
    courseId: scope.courseId,
    learnerHash: learnerHash || undefined,
    reviewMode: role === "reviewer" ? String(payload.reviewMode || "sandbox") : String(payload.reviewMode || ""),
    workOrderId: workOrderId || undefined,
    tokenScope: workOrderId ? "work_order" : role,
    iat: nowSeconds,
    exp: nowSeconds + ttlSeconds,
  };
  const accessToken = await createEdgeApiToken(claims, env.SEPATH_AUTH_SECRET);
  const store = getEdgeStore(env);
  if (store?.putAuditEvent) {
    await store.putAuditEvent({
      id: `audit-token-${Date.now()}-${role}`,
      tenantId: scope.tenantId,
      courseId: scope.courseId,
      learnerHash: learnerHash || "",
      actorRole: issuer.role,
      action: "auth.token.issue",
      result: role,
      resource: workOrderId || role,
      expiresAt,
      createdAt: new Date().toISOString(),
    });
  }

  return json({
    runtime: RUNTIME,
    tokenType: "Bearer",
    accessToken,
    expiresAt,
    ttlSeconds,
    claims: {
      role,
      tenantId: scope.tenantId,
      courseId: scope.courseId,
      learnerHash: learnerHash || undefined,
      reviewMode: claims.reviewMode || undefined,
      workOrderId: workOrderId || undefined,
      tokenScope: claims.tokenScope,
    },
    returnToken: returnToken || undefined,
    returnTokenScope: returnToken ? { workOrderId, learnerHash } : undefined,
    storageMode: storeMode(env),
  });
}

async function handleTeacherLogin(request, env) {
  const payload = await parseJson(request);
  const findings = enforcePrivacy(env, payload);
  if (findings.length > 0) {
    return privacyBlocked("teacher login contains protected fields", findings);
  }

  if (!env?.SEPATH_AUTH_SECRET) {
    return json(
      {
        runtime: RUNTIME,
        error: "not_ready",
        message: "SEPATH_AUTH_SECRET is required before issuing teacher access tokens",
        readiness: cloudReadiness(env),
      },
      { status: 503 },
    );
  }

  const configuredCode = envText(env, "SEPATH_TEACHER_ACCESS_CODE");
  if (!configuredCode) {
    return json(
      {
        runtime: RUNTIME,
        error: "not_ready",
        message: "SEPATH_TEACHER_ACCESS_CODE is required before teacher access-code login",
        readiness: cloudReadiness(env),
      },
      { status: 503 },
    );
  }

  let scope;
  let accessCode;
  try {
    scope = scopeFromPayload(payload);
    accessCode = requireText(payload.accessCode, "accessCode");
  } catch (error) {
    return badRequest(error.message);
  }

  if (!safeEqualRawText(accessCode, configuredCode)) {
    return unauthorized("invalid teacher access code", { authMode: "teacher-access-code" });
  }

  const ttlSeconds = clampTokenTtlSeconds(payload.ttlSeconds, "teacher");
  const nowSeconds = Math.floor(Date.now() / 1000);
  const expiresAt = new Date((nowSeconds + ttlSeconds) * 1000).toISOString();
  const claims = {
    role: "teacher",
    tenantId: scope.tenantId,
    courseId: scope.courseId,
    reviewMode: "",
    tokenScope: "teacher_access_code",
    iat: nowSeconds,
    exp: nowSeconds + ttlSeconds,
  };
  const accessToken = await createEdgeApiToken(claims, env.SEPATH_AUTH_SECRET);
  const store = getEdgeStore(env);
  if (store?.putAuditEvent) {
    await store.putAuditEvent({
      id: `audit-teacher-login-${Date.now()}`,
      tenantId: scope.tenantId,
      courseId: scope.courseId,
      learnerHash: "",
      actorRole: "teacher",
      action: "auth.teacher_login",
      result: "issued",
      resource: "teacher_access_code",
      expiresAt,
      createdAt: new Date().toISOString(),
    });
  }

  return json({
    runtime: RUNTIME,
    tokenType: "Bearer",
    accessToken,
    expiresAt,
    ttlSeconds,
    claims: {
      role: "teacher",
      tenantId: scope.tenantId,
      courseId: scope.courseId,
      tokenScope: "teacher_access_code",
    },
    storageMode: storeMode(env),
  });
}

async function handleAuthSession(url, request, env) {
  const scope = scopeFromUrl(url);
  const actor = await actorContext(request, url, env);
  if (actor.error) {
    return unauthorized("valid SE-Path access token is required", {
      action: "session.read",
      authMode: "hmac-token",
      reason: actor.error,
    });
  }
  const reviewerSandbox = actor.role === "reviewer" && actor.reviewMode === "sandbox";
  const manageCourse = canManageCourse(actor.role);
  const studentOwn = actor.role === "student" && Boolean(actor.learnerHash);
  const capabilities = [
    "read-session",
    manageCourse ? "read-teacher-workbench" : "",
    manageCourse ? "save-course-settings" : "",
    manageCourse ? "manage-course-roster" : "",
    manageCourse ? "import-github-ci" : "",
    manageCourse ? "read-integration-status" : "",
    manageCourse ? "launch-course-pilot" : "",
    manageCourse ? "create-work-order-batch" : "",
    manageCourse ? "review-work-order" : "",
    manageCourse ? "publish-intervention-package" : "",
    manageCourse ? "publish-course-micro-task" : "",
    manageCourse ? "remind-course-micro-task" : "",
    manageCourse ? "publish-course-teaching-improvement" : "",
    manageCourse ? "record-course-teaching-improvement-execution" : "",
    manageCourse ? "record-course-teaching-improvement-followup" : "",
    manageCourse ? "record-course-teaching-improvement-followup-result" : "",
    manageCourse ? "record-course-resource-revision" : "",
    manageCourse ? "record-course-resource-release" : "",
    manageCourse ? "record-course-resource-usage" : "",
    manageCourse ? "remind-course-resource-usage" : "",
    manageCourse ? "review-student-evidence" : "",
    manageCourse ? "close-work-order" : "",
    manageCourse ? "export-ledger" : "",
    studentOwn ? "submit-own-return" : "",
    reviewerSandbox ? "reviewer-sandbox-read" : "",
  ].filter(Boolean);

  return json({
    runtime: RUNTIME,
    tenantId: scope.tenantId,
    courseId: scope.courseId,
    actor: {
      role: actor.role,
      authMode: actor.authMode,
      reviewMode: actor.reviewMode || "",
      learnerHash: actor.learnerHash || undefined,
      tenantId: actor.tenantId || undefined,
      courseId: actor.courseId || undefined,
      workOrderId: actor.workOrderId || undefined,
      tokenScope: actor.tokenScope || undefined,
    },
    storageMode: storeMode(env),
    capabilities,
    boundaries: [
      "智能体只提供候选诊断、候选干预和解释，最终结论由教师确认。",
      "增值评价仅用于形成性诊断和资源推荐，不用于排名、惩罚或就业预测。",
      "缺证据时必须显示待补证，不强行给结论。",
    ],
  });
}

async function handleCourseSettingsRead(url, request, env) {
  const scope = scopeFromUrl(url);
  const authError = await authorize(request, url, env, "course_settings.read", scope);
  if (authError) return authError;
  return json({
    runtime: RUNTIME,
    tenantId: scope.tenantId,
    courseId: scope.courseId,
    settings: await getCourseSettings(env, scope),
    storageMode: storeMode(env),
    stored: Boolean(getEdgeStore(env)),
  });
}

function normalizeCourseSettingsPayload(payload, scope) {
  const defaults = createDefaultCourseSettings(scope);
  return {
    ...defaults,
    courseClass: requireText(payload.courseClass || defaults.courseClass, "courseClass"),
    courseName: requireText(payload.courseName || defaults.courseName, "courseName"),
    repository: requireText(payload.repository || defaults.repository, "repository"),
    ciProvider: String(payload.ciProvider || defaults.ciProvider).trim() || defaults.ciProvider,
    privacyPolicy: String(payload.privacyPolicy || defaults.privacyPolicy).trim() || defaults.privacyPolicy,
    webhookPath: defaults.webhookPath,
  };
}

async function handleCourseSettingsWrite(request, env) {
  const url = new URL(request.url);
  const payload = await parseJson(request);
  const findings = enforcePrivacy(env, payload);
  if (findings.length > 0) {
    return privacyBlocked("course settings contain protected fields", findings);
  }

  let scope;
  let settings;
  try {
    scope = scopeFromPayload(payload);
    settings = normalizeCourseSettingsPayload(payload, scope);
  } catch (error) {
    return badRequest(error.message);
  }

  const authError = await authorize(request, url, env, "course_settings.write", scope);
  if (authError) return authError;
  const store = getEdgeStore(env);
  const saved = store?.putCourseSettings ? await store.putCourseSettings(scope, settings) : settings;
  return json({
    runtime: RUNTIME,
    tenantId: scope.tenantId,
    courseId: scope.courseId,
    settings: saved,
    storageMode: storeMode(env),
    stored: Boolean(store),
  });
}

async function handleCourseLaunch(request, env) {
  const url = new URL(request.url);
  const payload = await parseJson(request);
  const findings = enforcePrivacy(env, payload);
  if (findings.length > 0) {
    return privacyBlocked("course launch contains protected fields", findings);
  }

  let scope;
  let settings;
  let learners;
  let task;
  try {
    scope = scopeFromPayload(payload);
    const settingsPayload =
      payload.settings && typeof payload.settings === "object" && !Array.isArray(payload.settings)
        ? payload.settings
        : payload;
    settings = normalizeCourseSettingsPayload(settingsPayload, scope);
    const rawLearners = Array.isArray(payload.learners) ? payload.learners : [];
    if (rawLearners.length === 0) throw new Error("course launch requires at least one learner");
    if (rawLearners.length > 120) throw new Error("course launch roster supports up to 120 learners");
    learners = rawLearners
      .map((learner, index) => normalizeRosterLearner(learner, index, settings))
      .filter((learner, index, all) => all.findIndex((item) => item.learnerHash === learner.learnerHash) === index);
    if (learners.length === 0) throw new Error("course launch requires at least one pseudonymous learner");
    task = normalizeBatchTask(payload.task || {}, settings);
  } catch (error) {
    return badRequest(error.message);
  }

  const authError = await authorize(request, url, env, "course.launch", scope);
  if (authError) return authError;

  const store = getEdgeStore(env);
  const actor = await actorContext(request, url, env);
  const courseScope = { tenantId: scope.tenantId, courseId: scope.courseId };
  const launchId = `course-launch-${Date.now()}`;
  const roster = {
    tenantId: scope.tenantId,
    courseId: scope.courseId,
    courseClass: settings.courseClass,
    courseName: settings.courseName,
    learners,
    updatedAt: nowText(),
  };

  if (store?.putCourseSettings) await store.putCourseSettings(courseScope, settings);
  if (store?.putCourseRoster) await store.putCourseRoster(courseScope, roster);
  await ensureWorkbench(env, courseScope);

  const selectedLearners = new Set(
    (Array.isArray(payload.selectedLearnerHashes) ? payload.selectedLearnerHashes : [])
      .map((item) => String(item || "").trim())
      .filter(Boolean),
  );
  const targetLearners = learners
    .filter((learner) => learner.status !== "paused")
    .filter((learner) => selectedLearners.size === 0 || selectedLearners.has(learner.learnerHash));
  if (targetLearners.length === 0) return badRequest("course launch found no active learners for initial diagnosis");
  if (targetLearners.length > 40) return badRequest("course launch supports up to 40 initial work orders");

  const created = [];
  const createdLedger = {};
  const createdReturns = {};
  const skipped = [];
  const seenOrderIds = new Set();
  for (const learner of targetLearners) {
    const digest = await sha256Hex(
      [
        payload.idempotencyKey || launchId,
        scope.tenantId,
        scope.courseId,
        learner.learnerHash,
        task.courseName,
        task.trigger,
        task.eventDate,
      ].join(":"),
    );
    const imported = createWorkOrderFromCourseBatch(
      {
        ...task,
        tenantId: scope.tenantId,
        courseId: scope.courseId,
        learnerHash: learner.learnerHash,
        learnerAlias: learner.learnerAlias,
      },
      digest,
    );
    if (seenOrderIds.has(imported.order.id)) {
      skipped.push(imported.order.id);
      continue;
    }
    seenOrderIds.add(imported.order.id);
    const existing = store?.getWorkOrder ? await store.getWorkOrder(imported.order.id, courseScope) : null;
    if (existing) {
      skipped.push(existing.id);
      continue;
    }
    if (store?.putWorkOrder) await store.putWorkOrder(imported.order);
    if (store?.putStudentReturn) await store.putStudentReturn(imported.order.id, imported.studentReturn, courseScope);
    if (store?.putWorkOrderLedgerEntry) await store.putWorkOrderLedgerEntry(imported.order.id, imported.ledgerEntry, courseScope);
    created.push(imported.order);
    createdLedger[imported.order.id] = [imported.ledgerEntry];
    createdReturns[imported.order.id] = imported.studentReturn;
  }

  const storedSnapshot = await getWorkbenchSnapshot(env, courseScope, created[0]?.id || "");
  const snapshot = store
    ? storedSnapshot
    : {
        ...storedSnapshot,
        selectedId: created[0]?.id || storedSnapshot.selectedId,
        workOrders: [
          ...created,
          ...storedSnapshot.workOrders.filter((order) => !seenOrderIds.has(order.id)),
        ],
        ledger: {
          ...storedSnapshot.ledger,
          ...createdLedger,
        },
        studentReturn: {
          ...storedSnapshot.studentReturn,
          ...createdReturns,
        },
      };

  return json({
    runtime: RUNTIME,
    launchId,
    tenantId: scope.tenantId,
    courseId: scope.courseId,
    settings,
    roster,
    task,
    createdCount: created.length,
    skippedCount: skipped.length,
    workOrders: await Promise.all(created.map((order) => shapeWorkOrderForActor(env, actor, order))),
    skipped,
    checklist: [
      {
        key: "settings",
        label: "课程与仓库已保存",
        status: "done",
        detail: `${settings.courseClass} / ${settings.repository}`,
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
        detail: "AI 只给候选建议，教师复核后才发布给学生。",
      },
    ],
    snapshot: await shapeSnapshotForActor(env, snapshot, actor),
    storageMode: storeMode(env),
    stored: Boolean(store),
    warning: store ? "" : "stateless worker cannot persist course launch state; use memory or database store for pilot operation",
  });
}

function normalizeBatchTask(payload, settings) {
  const task = payload.task && typeof payload.task === "object" ? payload.task : payload;
  const focus = ["boundary", "transaction", "contract", "review"].includes(task.focus) ? task.focus : "boundary";
  const risk = ["low", "medium", "high"].includes(task.risk) ? task.risk : "medium";
  return {
    courseClass: String(task.courseClass || settings.courseClass || "软件工程班级").trim(),
    courseName: String(task.courseName || settings.courseName || "软件工程课程任务").trim(),
    trigger: String(task.trigger || "课程任务批量巡检").trim(),
    eventDate: String(task.eventDate || new Date().toISOString().slice(0, 10)).trim(),
    owner: String(task.owner || "任课教师").trim(),
    focus,
    risk,
    taskSummary: String(task.taskSummary || task.ciLogSummary || "教师发起批量巡检，等待学生补充证据后再形成诊断结论。").trim(),
    currentLevel: Number(task.currentLevel || 52),
    expectedLevel: Number(task.expectedLevel || 58),
    evidenceCoverage: Number(task.evidenceCoverage || 30),
  };
}

async function handleWorkOrderBatchCreate(request, env) {
  const url = new URL(request.url);
  const payload = await parseJson(request);
  const findings = enforcePrivacy(env, payload);
  if (findings.length > 0) {
    return privacyBlocked("work-order batch contains protected fields", findings);
  }

  let scope;
  try {
    scope = scopeFromPayload(payload);
  } catch (error) {
    return badRequest(error.message);
  }

  const authError = await authorize(request, url, env, "workorder.batch_create", scope);
  if (authError) return authError;

  const settings = await getCourseSettings(env, scope);
  const roster = await getCourseRoster(env, scope);
  const selectedLearners = new Set(
    (Array.isArray(payload.learnerHashes) ? payload.learnerHashes : [])
      .map((item) => String(item || "").trim())
      .filter(Boolean),
  );
  const learners = (roster.learners || [])
    .filter((learner) => learner.status !== "paused")
    .filter((learner) => selectedLearners.size === 0 || selectedLearners.has(learner.learnerHash));

  if (learners.length === 0) return badRequest("no active learners matched the batch request");
  if (learners.length > 40) return badRequest("batch creation supports up to 40 learners per request");

  const task = normalizeBatchTask(payload, settings);
  const store = getEdgeStore(env);
  const created = [];
  const skipped = [];
  await ensureWorkbench(env, scope);

  for (const learner of learners) {
    const digest = await sha256Hex(
      [
        payload.idempotencyKey || task.trigger,
        scope.tenantId,
        scope.courseId,
        learner.learnerHash,
        task.courseName,
        task.eventDate,
      ].join(":"),
    );
    const imported = createWorkOrderFromCourseBatch(
      {
        ...task,
        tenantId: scope.tenantId,
        courseId: scope.courseId,
        learnerHash: learner.learnerHash,
        learnerAlias: learner.learnerAlias,
      },
      digest,
    );
    const existing = store?.getWorkOrder ? await store.getWorkOrder(imported.order.id, scope) : null;
    if (existing) {
      skipped.push(existing.id);
      continue;
    }
    if (store?.putWorkOrder) await store.putWorkOrder(imported.order);
    if (store?.putStudentReturn) await store.putStudentReturn(imported.order.id, imported.studentReturn, scope);
    if (store?.putWorkOrderLedgerEntry) await store.putWorkOrderLedgerEntry(imported.order.id, imported.ledgerEntry, scope);
    created.push(imported.order);
  }

  if (!store) {
    return json({
      runtime: RUNTIME,
      batchId: `batch-${Date.now()}`,
      createdCount: created.length,
      skippedCount: skipped.length,
      workOrders: created,
      skipped,
      snapshot: await shapeSnapshotForActor(env, await getWorkbenchSnapshot(env, scope, created[0]?.id || ""), await actorContext(request, url, env)),
      storageMode: storeMode(env),
      stored: false,
      warning: "stateless worker cannot persist batch-created work orders; use memory or database store for pilot operation",
    });
  }

  const actor = await actorContext(request, url, env);
  return json({
    runtime: RUNTIME,
    batchId: `batch-${Date.now()}`,
    createdCount: created.length,
    skippedCount: skipped.length,
    workOrders: await Promise.all(created.map((order) => shapeWorkOrderForActor(env, actor, order))),
    skipped,
    snapshot: await shapeSnapshotForActor(env, await getWorkbenchSnapshot(env, scope, created[0]?.id || ""), actor),
    storageMode: storeMode(env),
    stored: true,
  });
}

async function handleTeacherWorkbench(url, request, env) {
  const scope = scopeFromUrl(url);
  const authError = await authorize(request, url, env, "workbench.read", scope);
  if (authError) return authError;
  const actor = await actorContext(request, url, env);
  const selectedId = url.searchParams.get("selectedId") || "";
  const snapshot = await getWorkbenchSnapshot(env, scope, selectedId);
  return json(await shapeSnapshotForActor(env, snapshot, actor));
}

async function handleWorkOrdersList(url, request, env) {
  const scope = scopeFromUrl(url);
  const authError = await authorize(request, url, env, "workorder.read", scope);
  if (authError) return authError;
  const actor = await actorContext(request, url, env);
  const snapshot = await getWorkbenchSnapshot(env, scope, url.searchParams.get("selectedId") || "");
  const shaped = await shapeSnapshotForActor(env, snapshot, actor);
  return json({
    runtime: RUNTIME,
    tenantId: scope.tenantId,
    courseId: scope.courseId,
    count: shaped.workOrders.length,
    workOrders: shaped.workOrders,
    storageMode: snapshot.storageMode,
    stored: snapshot.stored,
  });
}

async function handleWorkOrderRead(url, request, env) {
  const match = url.pathname.match(/^\/api\/work-orders\/([^/]+)$/);
  if (!match) return notFound(url.pathname);
  const scope = scopeFromUrl(url);
  const orderId = decodeURIComponent(match[1]);
  const bundle = await getWorkOrderBundle(env, scope, orderId);
  if (!bundle.workOrder) return notFound(url.pathname);
  const returnTokenValid = await hasValidStudentReturnToken(
    env,
    bundle.workOrder,
    studentReturnTokenFrom(request, url),
  );
  const authError = await authorize(request, url, env, "workorder.read", {
    ...scope,
    learnerHash: bundle.workOrder.learnerHash,
    workOrderId: orderId,
    returnTokenValid,
  });
  if (authError) return authError;
  const actor = await actorContext(request, url, env);
  return json({
    runtime: RUNTIME,
    tenantId: scope.tenantId,
    courseId: scope.courseId,
    workOrder: await shapeWorkOrderForActor(env, actor, bundle.workOrder),
    ledger: bundle.ledger,
    studentReturn: bundle.studentReturn,
    storageMode: bundle.snapshot.storageMode,
    stored: bundle.snapshot.stored,
  });
}

async function handleWorkOrderReview(url, request, env) {
  const match = url.pathname.match(/^\/api\/work-orders\/([^/]+)\/review$/);
  if (!match) return notFound(url.pathname);
  const payload = await parseJson(request);
  const findings = enforcePrivacy(env, payload);
  if (findings.length > 0) {
    return privacyBlocked("work order review contains protected fields", findings);
  }

  let scope;
  let decision;
  try {
    scope = scopeFromPayload(payload);
    decision = requireText(payload.decision, "decision");
    if (!["approve", "returnEvidence", "humanTalk"].includes(decision)) {
      throw new Error("decision must be approve, returnEvidence or humanTalk");
    }
  } catch (error) {
    return badRequest(error.message);
  }

  const authError = await authorize(request, url, env, "workorder.review", scope);
  if (authError) return authError;
  const actor = await actorContext(request, url, env);
  const orderId = decodeURIComponent(match[1]);
  const bundle = await getWorkOrderBundle(env, scope, orderId);
  if (!bundle.workOrder) return notFound(url.pathname);
  if (bundle.workOrder.status === "closed") {
    return forbidden("closed work order cannot be reviewed again");
  }

  const applied = applyTeacherDecision(bundle.workOrder, decision, String(payload.teacherNote || "").trim());
  if (!applied) return badRequest("unsupported teacher decision");

  const store = getEdgeStore(env);
  if (store?.putWorkOrder) await store.putWorkOrder(applied.order);
  if (store?.putWorkOrderLedgerEntry) await store.putWorkOrderLedgerEntry(orderId, applied.ledgerEntry, scope);

  return json({
    runtime: RUNTIME,
    workOrder: await shapeWorkOrderForActor(env, actor, applied.order),
    ledgerEntry: applied.ledgerEntry,
    snapshot: await shapeSnapshotForActor(env, await getWorkbenchSnapshot(env, scope, orderId), actor),
  });
}

async function handleInterventionPackagePublish(url, request, env) {
  const match = url.pathname.match(/^\/api\/work-orders\/([^/]+)\/intervention-package$/);
  if (!match) return notFound(url.pathname);
  const payload = await parseJson(request);
  const findings = enforcePrivacy(env, payload);
  if (findings.length > 0) {
    return privacyBlocked("intervention package request contains protected fields", findings);
  }
  const packageDraft = payload.packageDraft;
  if (
    packageDraft !== undefined &&
    (!packageDraft || typeof packageDraft !== "object" || Array.isArray(packageDraft))
  ) {
    return badRequest("packageDraft must be an object when provided");
  }

  let scope;
  try {
    scope = scopeFromPayload(payload);
  } catch (error) {
    return badRequest(error.message);
  }

  const authError = await authorize(request, url, env, "workorder.package", scope);
  if (authError) return authError;
  const actor = await actorContext(request, url, env);
  const orderId = decodeURIComponent(match[1]);
  const bundle = await getWorkOrderBundle(env, scope, orderId);
  if (!bundle.workOrder) return notFound(url.pathname);
  if (bundle.workOrder.status === "closed") {
    return forbidden("closed work order cannot publish a new intervention package");
  }
  if (!bundle.workOrder.selectedDecision) {
    return badRequest("teacher review decision is required before publishing intervention package");
  }

  let taskPackage;
  try {
    taskPackage = buildInterventionPackage(
      bundle.workOrder,
      { teacherNote: String(payload.teacherNote || "").trim(), packageDraft },
    );
  } catch (error) {
    return badRequest(error.message);
  }
  const applied = applyInterventionPackage(bundle.workOrder, taskPackage);

  const store = getEdgeStore(env);
  if (store?.putWorkOrder) await store.putWorkOrder(applied.order);
  if (store?.putWorkOrderLedgerEntry) await store.putWorkOrderLedgerEntry(orderId, applied.ledgerEntry, scope);

  return json({
    runtime: RUNTIME,
    package: taskPackage,
    workOrder: await shapeWorkOrderForActor(env, actor, applied.order),
    ledgerEntry: applied.ledgerEntry,
    snapshot: await shapeSnapshotForActor(env, await getWorkbenchSnapshot(env, scope, orderId), actor),
  });
}

async function handleCourseMicroTaskPackagePublish(request, env) {
  const url = new URL(request.url);
  const payload = await parseJson(request);
  const findings = enforcePrivacy(env, payload);
  if (findings.length > 0) {
    return privacyBlocked("course micro-task package contains protected fields", findings);
  }

  let scope;
  try {
    scope = scopeFromPayload(payload);
    if (!payload.package || typeof payload.package !== "object" || Array.isArray(payload.package)) {
      throw new Error("package must be an object");
    }
  } catch (error) {
    return badRequest(error.message);
  }

  const authError = await authorize(request, url, env, "course_micro_task.publish", scope);
  if (authError) return authError;
  const actor = await actorContext(request, url, env);
  const actorLabel = canManageCourse(actor.role) ? "任课教师" : actor.role;

  let microTask;
  try {
    microTask = normalizeCourseMicroTaskPackage(payload.package, actorLabel);
  } catch (error) {
    return badRequest(error.message);
  }

  await ensureWorkbench(env, scope);
  const snapshot = await getWorkbenchSnapshot(env, scope, microTask.targetWorkOrderIds[0] || "");
  const targetIds = new Set(microTask.targetWorkOrderIds);
  const targetOrders = snapshot.workOrders.filter(
    (order) => targetIds.has(order.id) && order.status !== "closed",
  );
  if (targetOrders.length === 0) {
    return badRequest("no open target work orders found for course micro-task package");
  }

  const store = getEdgeStore(env);
  const ledgerEntries = [];
  const skipped = [];
  const responseSnapshot = {
    ...snapshot,
    workOrders: [...snapshot.workOrders],
    ledger: { ...(snapshot.ledger || {}) },
    studentReturn: { ...(snapshot.studentReturn || {}) },
  };

  for (const order of targetOrders) {
    const existingLedger = responseSnapshot.ledger[order.id] || [];
    const currentReturn = responseSnapshot.studentReturn[order.id] || emptyStudentReturnState();
    const duplicated = existingLedger.some(
      (entry) => entry.type === "course_micro_task" && entry.traceId === `course-micro-task-${microTask.id}`,
    );
    if (duplicated) {
      skipped.push(order.id);
      continue;
    }
    const applied = applyCourseMicroTaskPublication(order, microTask);
    ledgerEntries.push(applied.ledgerEntry);
    if (store?.putWorkOrder) await store.putWorkOrder(applied.order);
    if (store?.putStudentReturn) await store.putStudentReturn(order.id, currentReturn, scope);
    if (store?.putWorkOrderLedgerEntry) {
      await store.putWorkOrderLedgerEntry(order.id, applied.ledgerEntry, scope);
    }
    responseSnapshot.workOrders = responseSnapshot.workOrders.map((item) =>
      item.id === order.id ? applied.order : item,
    );
    responseSnapshot.ledger[order.id] = [applied.ledgerEntry, ...existingLedger];
    responseSnapshot.studentReturn[order.id] = currentReturn;
  }

  const shapedSnapshot = store
    ? await getWorkbenchSnapshot(env, scope, targetOrders[0]?.id || snapshot.selectedId)
    : {
        ...responseSnapshot,
        selectedId: targetOrders[0]?.id || snapshot.selectedId,
        updatedAt: nowText(),
        stored: false,
        storageMode: storeMode(env),
      };

  return json({
    runtime: RUNTIME,
    package: microTask,
    publishedCount: ledgerEntries.length,
    skippedCount: skipped.length,
    skipped,
    ledgerEntries,
    snapshot: await shapeSnapshotForActor(env, shapedSnapshot, actor),
    storageMode: storeMode(env),
    stored: Boolean(store),
  });
}

async function handleCourseMicroTaskReminder(request, env) {
  const url = new URL(request.url);
  const payload = await parseJson(request);
  const findings = enforcePrivacy(env, payload);
  if (findings.length > 0) {
    return privacyBlocked("course micro-task reminder contains protected fields", findings);
  }

  let scope;
  let reminder;
  try {
    scope = scopeFromPayload(payload);
    reminder = payload.reminder || {};
    if (!reminder || typeof reminder !== "object" || Array.isArray(reminder)) {
      throw new Error("reminder must be an object");
    }
    reminder.traceId = requireText(reminder.traceId, "reminder.traceId");
    reminder.title = String(reminder.title || "course micro-task return").trim();
    reminder.note = String(reminder.note || "").trim();
    reminder.targetWorkOrderIds = Array.from(
      new Set(
        (Array.isArray(reminder.targetWorkOrderIds) ? reminder.targetWorkOrderIds : [])
          .map((id) => String(id || "").trim())
          .filter(Boolean),
      ),
    ).slice(0, 50);
    if (reminder.targetWorkOrderIds.length === 0) {
      throw new Error("reminder.targetWorkOrderIds is required");
    }
  } catch (error) {
    return badRequest(error.message);
  }

  const authError = await authorize(request, url, env, "course_micro_task.remind", scope);
  if (authError) return authError;
  const actor = await actorContext(request, url, env);
  const actorLabel = canManageCourse(actor.role) ? "任课教师" : actor.role;

  await ensureWorkbench(env, scope);
  const snapshot = await getWorkbenchSnapshot(env, scope, reminder.targetWorkOrderIds[0] || "");
  const store = getEdgeStore(env);
  const returnKeys = ["scaffoldReceived", "evidenceSubmitted", "reflectionSubmitted"];
  const targetIds = new Set(reminder.targetWorkOrderIds);
  const responseSnapshot = {
    ...snapshot,
    workOrders: [...snapshot.workOrders],
    ledger: { ...(snapshot.ledger || {}) },
    studentReturn: { ...(snapshot.studentReturn || {}) },
  };
  const ledgerEntries = [];
  const skipped = [];

  for (const order of snapshot.workOrders.filter((item) => targetIds.has(item.id))) {
    const existingLedger = responseSnapshot.ledger[order.id] || [];
    const hasBatchTrace = existingLedger.some(
      (entry) => entry.type === "course_micro_task" && entry.traceId === reminder.traceId,
    );
    const returnState = responseSnapshot.studentReturn[order.id] || emptyStudentReturnState();
    const completed = returnKeys.filter((key) => Boolean(returnState[key])).length;
    if (order.status === "closed" || completed >= returnKeys.length || !hasBatchTrace) {
      skipped.push(order.id);
      continue;
    }
    const applied = applyCourseMicroTaskReminder(order, {
      ...reminder,
      actor: actorLabel,
    });
    ledgerEntries.push(applied.ledgerEntry);
    if (store?.putWorkOrder) await store.putWorkOrder(applied.order);
    if (store?.putWorkOrderLedgerEntry) {
      await store.putWorkOrderLedgerEntry(order.id, applied.ledgerEntry, scope);
    }
    responseSnapshot.workOrders = responseSnapshot.workOrders.map((item) =>
      item.id === order.id ? applied.order : item,
    );
    responseSnapshot.ledger[order.id] = [applied.ledgerEntry, ...existingLedger];
  }

  const shapedSnapshot = store
    ? await getWorkbenchSnapshot(env, scope, reminder.targetWorkOrderIds[0] || snapshot.selectedId)
    : {
        ...responseSnapshot,
        selectedId: reminder.targetWorkOrderIds[0] || snapshot.selectedId,
        updatedAt: nowText(),
        stored: false,
        storageMode: storeMode(env),
      };

  return json({
    runtime: RUNTIME,
    remindedCount: ledgerEntries.length,
    skippedCount: skipped.length,
    skipped,
    ledgerEntries,
    snapshot: await shapeSnapshotForActor(env, shapedSnapshot, actor),
    storageMode: storeMode(env),
    stored: Boolean(store),
  });
}

async function handleCourseTeachingImprovementPlanPublish(request, env) {
  const url = new URL(request.url);
  const payload = await parseJson(request);
  const findings = enforcePrivacy(env, payload);
  if (findings.length > 0) {
    return privacyBlocked("course teaching improvement plan contains protected fields", findings);
  }

  let scope;
  try {
    scope = scopeFromPayload(payload);
    if (!payload.plan || typeof payload.plan !== "object" || Array.isArray(payload.plan)) {
      throw new Error("plan must be an object");
    }
  } catch (error) {
    return badRequest(error.message);
  }

  const authError = await authorize(request, url, env, "course_teaching_improvement.publish", scope);
  if (authError) return authError;
  const actor = await actorContext(request, url, env);
  const actorLabel = canManageCourse(actor.role) ? "任课教师" : actor.role;

  let plan;
  try {
    plan = normalizeCourseTeachingImprovementPlan(payload.plan, actorLabel);
  } catch (error) {
    return badRequest(error.message);
  }

  await ensureWorkbench(env, scope);
  const targetIds = new Set(plan.items.flatMap((item) => item.targetWorkOrderIds));
  const firstTargetId = [...targetIds][0] || "";
  const snapshot = await getWorkbenchSnapshot(env, scope, firstTargetId);
  const targetOrders = snapshot.workOrders.filter(
    (order) => targetIds.has(order.id) && order.status !== "closed",
  );
  if (targetOrders.length === 0) {
    return badRequest("no open target work orders found for course teaching improvement plan");
  }

  const store = getEdgeStore(env);
  const responseSnapshot = {
    ...snapshot,
    workOrders: [...snapshot.workOrders],
    ledger: { ...(snapshot.ledger || {}) },
    studentReturn: { ...(snapshot.studentReturn || {}) },
  };
  const traceId = `teaching-improvement-${plan.id}`;
  const ledgerEntries = [];
  const skipped = [];

  for (const order of targetOrders) {
    const existingLedger = responseSnapshot.ledger[order.id] || [];
    const duplicated = existingLedger.some(
      (entry) => entry.type === "teaching_improvement" && entry.traceId === traceId,
    );
    if (duplicated) {
      skipped.push(order.id);
      continue;
    }
    const relatedItems = plan.items.filter((item) => item.targetWorkOrderIds.includes(order.id));
    if (relatedItems.length === 0) {
      skipped.push(order.id);
      continue;
    }
    const combinedItem = {
      ...relatedItems[0],
      id: relatedItems.map((item) => item.id).join("-").slice(0, 100),
      focus: Array.from(new Set(relatedItems.map((item) => item.focus))).join(" / "),
      issue: relatedItems.map((item) => item.issue).join("；"),
      action: relatedItems.map((item) => item.action).join("；"),
      acceptanceEvidence: Array.from(
        new Set(relatedItems.flatMap((item) => item.acceptanceEvidence || [])),
      ),
    };
    const applied = applyCourseTeachingImprovementPlan(order, plan, combinedItem);
    ledgerEntries.push(applied.ledgerEntry);
    if (store?.putWorkOrder) await store.putWorkOrder(applied.order);
    if (store?.putWorkOrderLedgerEntry) {
      await store.putWorkOrderLedgerEntry(order.id, applied.ledgerEntry, scope);
    }
    responseSnapshot.workOrders = responseSnapshot.workOrders.map((item) =>
      item.id === order.id ? applied.order : item,
    );
    responseSnapshot.ledger[order.id] = [applied.ledgerEntry, ...existingLedger];
  }

  if (ledgerEntries.length === 0) {
    return badRequest("course teaching improvement plan has already been published to target work orders");
  }

  const shapedSnapshot = store
    ? await getWorkbenchSnapshot(env, scope, firstTargetId || snapshot.selectedId)
    : {
        ...responseSnapshot,
        selectedId: firstTargetId || snapshot.selectedId,
        updatedAt: nowText(),
        stored: false,
        storageMode: storeMode(env),
      };

  return json({
    runtime: RUNTIME,
    plan,
    publishedCount: ledgerEntries.length,
    skippedCount: skipped.length,
    skipped,
    ledgerEntries,
    snapshot: await shapeSnapshotForActor(env, shapedSnapshot, actor),
    storageMode: storeMode(env),
    stored: Boolean(store),
  });
}

async function handleCourseTeachingImprovementExecutionRecord(request, env) {
  const url = new URL(request.url);
  const payload = await parseJson(request);
  const findings = enforcePrivacy(env, payload);
  if (findings.length > 0) {
    return privacyBlocked("course teaching improvement execution receipt contains protected fields", findings);
  }

  let scope;
  try {
    scope = scopeFromPayload(payload);
    if (!payload.receipt || typeof payload.receipt !== "object" || Array.isArray(payload.receipt)) {
      throw new Error("receipt must be an object");
    }
  } catch (error) {
    return badRequest(error.message);
  }

  const authError = await authorize(request, url, env, "course_teaching_improvement_execution.record", scope);
  if (authError) return authError;
  const actor = await actorContext(request, url, env);
  const actorLabel = canManageCourse(actor.role) ? "任课教师" : actor.role;

  let receipt;
  try {
    receipt = normalizeCourseTeachingImprovementExecutionReceipt(payload.receipt, actorLabel);
  } catch (error) {
    return badRequest(error.message);
  }

  await ensureWorkbench(env, scope);
  const targetIds = new Set(receipt.targetWorkOrderIds);
  const firstTargetId = [...targetIds][0] || "";
  const snapshot = await getWorkbenchSnapshot(env, scope, firstTargetId);
  const targetOrders = snapshot.workOrders.filter((order) => targetIds.has(order.id));
  if (targetOrders.length === 0) {
    return badRequest("no target work orders found for course teaching improvement execution receipt");
  }

  const store = getEdgeStore(env);
  const responseSnapshot = {
    ...snapshot,
    workOrders: [...snapshot.workOrders],
    ledger: { ...(snapshot.ledger || {}) },
    studentReturn: { ...(snapshot.studentReturn || {}) },
  };
  const planTraceId = `teaching-improvement-${receipt.planId}`;
  const receiptTraceId = `teaching-improvement-execution-${receipt.planId || receipt.id}`;
  const ledgerEntries = [];
  const skipped = [];

  for (const order of targetOrders) {
    const existingLedger = responseSnapshot.ledger[order.id] || [];
    const planPublished = existingLedger.some(
      (entry) => entry.type === "teaching_improvement" && entry.traceId === planTraceId,
    );
    if (!planPublished) {
      skipped.push(`${order.id}:missing-plan`);
      continue;
    }
    const duplicated = existingLedger.some(
      (entry) => entry.type === "teaching_improvement_execution" && entry.traceId === receiptTraceId,
    );
    if (duplicated) {
      skipped.push(`${order.id}:duplicated`);
      continue;
    }
    const applied = applyCourseTeachingImprovementExecution(order, receipt);
    ledgerEntries.push(applied.ledgerEntry);
    if (store?.putWorkOrder) await store.putWorkOrder(applied.order);
    if (store?.putWorkOrderLedgerEntry) {
      await store.putWorkOrderLedgerEntry(order.id, applied.ledgerEntry, scope);
    }
    responseSnapshot.workOrders = responseSnapshot.workOrders.map((item) =>
      item.id === order.id ? applied.order : item,
    );
    responseSnapshot.ledger[order.id] = [applied.ledgerEntry, ...existingLedger];
  }

  if (ledgerEntries.length === 0) {
    return badRequest("course teaching improvement plan must be published before recording execution, or execution has already been recorded", {
      skipped,
    });
  }

  const shapedSnapshot = store
    ? await getWorkbenchSnapshot(env, scope, firstTargetId || snapshot.selectedId)
    : {
        ...responseSnapshot,
        selectedId: firstTargetId || snapshot.selectedId,
        updatedAt: nowText(),
        stored: false,
        storageMode: storeMode(env),
      };

  return json({
    runtime: RUNTIME,
    receipt,
    recordedCount: ledgerEntries.length,
    skippedCount: skipped.length,
    skipped,
    ledgerEntries,
    snapshot: await shapeSnapshotForActor(env, shapedSnapshot, actor),
    storageMode: storeMode(env),
    stored: Boolean(store),
  });
}

async function handleCourseTeachingImprovementFollowupRecord(request, env) {
  const url = new URL(request.url);
  const payload = await parseJson(request);
  const findings = enforcePrivacy(env, payload);
  if (findings.length > 0) {
    return privacyBlocked("course teaching improvement followup sample contains protected fields", findings);
  }

  let scope;
  try {
    scope = scopeFromPayload(payload);
    if (!payload.sample || typeof payload.sample !== "object" || Array.isArray(payload.sample)) {
      throw new Error("sample must be an object");
    }
  } catch (error) {
    return badRequest(error.message);
  }

  const authError = await authorize(request, url, env, "course_teaching_improvement_followup.record", scope);
  if (authError) return authError;
  const actor = await actorContext(request, url, env);
  const actorLabel = canManageCourse(actor.role) ? "任课教师" : actor.role;

  let sample;
  try {
    sample = normalizeCourseTeachingImprovementFollowupSample(payload.sample, actorLabel);
  } catch (error) {
    return badRequest(error.message);
  }

  await ensureWorkbench(env, scope);
  const targetIds = new Set(sample.targetWorkOrderIds);
  const firstTargetId = [...targetIds][0] || "";
  const snapshot = await getWorkbenchSnapshot(env, scope, firstTargetId);
  const targetOrders = snapshot.workOrders.filter((order) => targetIds.has(order.id));
  if (targetOrders.length === 0) {
    return badRequest("no target work orders found for course teaching improvement followup sample");
  }

  const store = getEdgeStore(env);
  const responseSnapshot = {
    ...snapshot,
    workOrders: [...snapshot.workOrders],
    ledger: { ...(snapshot.ledger || {}) },
    studentReturn: { ...(snapshot.studentReturn || {}) },
  };
  const executionTraceId = `teaching-improvement-execution-${sample.planId}`;
  const sampleTraceId = `teaching-improvement-followup-${sample.planId || sample.id}`;
  const ledgerEntries = [];
  const skipped = [];

  for (const order of targetOrders) {
    const existingLedger = responseSnapshot.ledger[order.id] || [];
    const executionRecorded = existingLedger.some(
      (entry) =>
        entry.type === "teaching_improvement_execution" &&
        entry.traceId === executionTraceId,
    );
    if (!executionRecorded) {
      skipped.push(`${order.id}:missing-execution`);
      continue;
    }
    const duplicated = existingLedger.some(
      (entry) => entry.type === "teaching_improvement_followup" && entry.traceId === sampleTraceId,
    );
    if (duplicated) {
      skipped.push(`${order.id}:duplicated`);
      continue;
    }
    const applied = applyCourseTeachingImprovementFollowupSample(order, sample);
    ledgerEntries.push(applied.ledgerEntry);
    if (store?.putWorkOrder) await store.putWorkOrder(applied.order);
    if (store?.putWorkOrderLedgerEntry) {
      await store.putWorkOrderLedgerEntry(order.id, applied.ledgerEntry, scope);
    }
    responseSnapshot.workOrders = responseSnapshot.workOrders.map((item) =>
      item.id === order.id ? applied.order : item,
    );
    responseSnapshot.ledger[order.id] = [applied.ledgerEntry, ...existingLedger];
  }

  if (ledgerEntries.length === 0) {
    return badRequest("course teaching improvement execution receipt must be recorded before followup sampling, or sampling has already been recorded", {
      skipped,
    });
  }

  const shapedSnapshot = store
    ? await getWorkbenchSnapshot(env, scope, firstTargetId || snapshot.selectedId)
    : {
        ...responseSnapshot,
        selectedId: firstTargetId || snapshot.selectedId,
        updatedAt: nowText(),
        stored: false,
        storageMode: storeMode(env),
      };

  return json({
    runtime: RUNTIME,
    sample,
    recordedCount: ledgerEntries.length,
    skippedCount: skipped.length,
    skipped,
    ledgerEntries,
    snapshot: await shapeSnapshotForActor(env, shapedSnapshot, actor),
    storageMode: storeMode(env),
    stored: Boolean(store),
  });
}

async function handleCourseTeachingImprovementFollowupResultRecord(request, env) {
  const url = new URL(request.url);
  const payload = await parseJson(request);
  const findings = enforcePrivacy(env, payload);
  if (findings.length > 0) {
    return privacyBlocked("course teaching improvement followup result contains protected fields", findings);
  }

  let scope;
  try {
    scope = scopeFromPayload(payload);
    if (!payload.result || typeof payload.result !== "object" || Array.isArray(payload.result)) {
      throw new Error("result must be an object");
    }
  } catch (error) {
    return badRequest(error.message);
  }

  const authError = await authorize(request, url, env, "course_teaching_improvement_followup_result.record", scope);
  if (authError) return authError;
  const actor = await actorContext(request, url, env);
  const actorLabel = canManageCourse(actor.role) ? "任课教师" : actor.role;

  let result;
  try {
    result = normalizeCourseTeachingImprovementFollowupResult(payload.result, actorLabel);
  } catch (error) {
    return badRequest(error.message);
  }

  await ensureWorkbench(env, scope);
  const targetIds = new Set(result.targetWorkOrderIds);
  const firstTargetId = [...targetIds][0] || "";
  const snapshot = await getWorkbenchSnapshot(env, scope, firstTargetId);
  const targetOrders = snapshot.workOrders.filter((order) => targetIds.has(order.id));
  if (targetOrders.length === 0) {
    return badRequest("no target work orders found for course teaching improvement followup result");
  }

  const store = getEdgeStore(env);
  const responseSnapshot = {
    ...snapshot,
    workOrders: [...snapshot.workOrders],
    ledger: { ...(snapshot.ledger || {}) },
    studentReturn: { ...(snapshot.studentReturn || {}) },
  };
  const sampleTraceId = `teaching-improvement-followup-${result.planId}`;
  const resultTraceId = `teaching-improvement-followup-result-${result.sampleId || result.id}`;
  const ledgerEntries = [];
  const skipped = [];

  for (const order of targetOrders) {
    const existingLedger = responseSnapshot.ledger[order.id] || [];
    const sampleRecorded = existingLedger.some(
      (entry) =>
        entry.type === "teaching_improvement_followup" &&
        entry.traceId === sampleTraceId,
    );
    if (!sampleRecorded) {
      skipped.push(`${order.id}:missing-followup-sample`);
      continue;
    }
    const duplicated = existingLedger.some(
      (entry) =>
        entry.type === "teaching_improvement_followup_result" &&
        entry.traceId === resultTraceId,
    );
    if (duplicated) {
      skipped.push(`${order.id}:duplicated`);
      continue;
    }
    const applied = applyCourseTeachingImprovementFollowupResult(order, result);
    ledgerEntries.push(applied.ledgerEntry);
    if (store?.putWorkOrder) await store.putWorkOrder(applied.order);
    if (store?.putWorkOrderLedgerEntry) {
      await store.putWorkOrderLedgerEntry(order.id, applied.ledgerEntry, scope);
    }
    responseSnapshot.workOrders = responseSnapshot.workOrders.map((item) =>
      item.id === order.id ? applied.order : item,
    );
    responseSnapshot.ledger[order.id] = [applied.ledgerEntry, ...existingLedger];
  }

  if (ledgerEntries.length === 0) {
    return badRequest("course teaching improvement followup sample must be recorded before collecting followup results, or result has already been recorded", {
      skipped,
    });
  }

  const shapedSnapshot = store
    ? await getWorkbenchSnapshot(env, scope, firstTargetId || snapshot.selectedId)
    : {
        ...responseSnapshot,
        selectedId: firstTargetId || snapshot.selectedId,
        updatedAt: nowText(),
        stored: false,
        storageMode: storeMode(env),
      };

  return json({
    runtime: RUNTIME,
    result,
    recordedCount: ledgerEntries.length,
    skippedCount: skipped.length,
    skipped,
    ledgerEntries,
    snapshot: await shapeSnapshotForActor(env, shapedSnapshot, actor),
    storageMode: storeMode(env),
    stored: Boolean(store),
  });
}

async function handleCourseResourceRevisionRecord(request, env) {
  const url = new URL(request.url);
  const payload = await parseJson(request);
  const findings = enforcePrivacy(env, payload);
  if (findings.length > 0) {
    return privacyBlocked("course resource revision ticket contains protected fields", findings);
  }

  let scope;
  try {
    scope = scopeFromPayload(payload);
    if (!payload.ticket || typeof payload.ticket !== "object" || Array.isArray(payload.ticket)) {
      throw new Error("ticket must be an object");
    }
  } catch (error) {
    return badRequest(error.message);
  }

  const authError = await authorize(request, url, env, "course_resource_revision.record", scope);
  if (authError) return authError;
  const actor = await actorContext(request, url, env);
  const actorLabel = canManageCourse(actor.role) ? "任课教师" : actor.role;

  let ticket;
  try {
    ticket = normalizeCourseResourceRevisionTicket(payload.ticket, actorLabel);
  } catch (error) {
    return badRequest(error.message);
  }

  await ensureWorkbench(env, scope);
  const targetIds = new Set(ticket.targetWorkOrderIds);
  const firstTargetId = [...targetIds][0] || "";
  const snapshot = await getWorkbenchSnapshot(env, scope, firstTargetId);
  const targetOrders = snapshot.workOrders.filter((order) => targetIds.has(order.id));
  if (targetOrders.length === 0) {
    return badRequest("no target work orders found for course resource revision ticket");
  }

  const store = getEdgeStore(env);
  const responseSnapshot = {
    ...snapshot,
    workOrders: [...snapshot.workOrders],
    ledger: { ...(snapshot.ledger || {}) },
    studentReturn: { ...(snapshot.studentReturn || {}) },
  };
  const sourceTraceId = `teaching-improvement-followup-result-${ticket.sampleId || ticket.sourceResultId}`;
  const revisionTraceId = `course-resource-revision-${ticket.id}`;
  const ledgerEntries = [];
  const skipped = [];

  for (const order of targetOrders) {
    const existingLedger = responseSnapshot.ledger[order.id] || [];
    const sourceRecorded = existingLedger.some(
      (entry) =>
        entry.type === "teaching_improvement_followup_result" &&
        entry.traceId === sourceTraceId,
    );
    if (!sourceRecorded) {
      skipped.push(`${order.id}:missing-followup-result`);
      continue;
    }
    const duplicated = existingLedger.some(
      (entry) =>
        entry.type === "course_resource_revision" &&
        entry.traceId === revisionTraceId,
    );
    if (duplicated) {
      skipped.push(`${order.id}:duplicated`);
      continue;
    }
    const applied = applyCourseResourceRevisionTicket(order, ticket);
    ledgerEntries.push(applied.ledgerEntry);
    if (store?.putWorkOrder) await store.putWorkOrder(applied.order);
    if (store?.putWorkOrderLedgerEntry) {
      await store.putWorkOrderLedgerEntry(order.id, applied.ledgerEntry, scope);
    }
    responseSnapshot.workOrders = responseSnapshot.workOrders.map((item) =>
      item.id === order.id ? applied.order : item,
    );
    responseSnapshot.ledger[order.id] = [applied.ledgerEntry, ...existingLedger];
  }

  if (ledgerEntries.length === 0) {
    return badRequest("course followup result must be recorded before resource revision, or revision has already been recorded", {
      skipped,
    });
  }

  const shapedSnapshot = store
    ? await getWorkbenchSnapshot(env, scope, firstTargetId || snapshot.selectedId)
    : {
        ...responseSnapshot,
        selectedId: firstTargetId || snapshot.selectedId,
        updatedAt: nowText(),
        stored: false,
        storageMode: storeMode(env),
      };

  return json({
    runtime: RUNTIME,
    ticket,
    recordedCount: ledgerEntries.length,
    skippedCount: skipped.length,
    skipped,
    ledgerEntries,
    snapshot: await shapeSnapshotForActor(env, shapedSnapshot, actor),
    storageMode: storeMode(env),
    stored: Boolean(store),
  });
}

async function handleCourseResourceReleaseRecord(request, env) {
  const url = new URL(request.url);
  const payload = await parseJson(request);
  const findings = enforcePrivacy(env, payload);
  if (findings.length > 0) {
    return privacyBlocked("course resource release receipt contains protected fields", findings);
  }

  let scope;
  try {
    scope = scopeFromPayload(payload);
    if (!payload.receipt || typeof payload.receipt !== "object" || Array.isArray(payload.receipt)) {
      throw new Error("receipt must be an object");
    }
  } catch (error) {
    return badRequest(error.message);
  }

  const authError = await authorize(request, url, env, "course_resource_release.record", scope);
  if (authError) return authError;
  const actor = await actorContext(request, url, env);
  const actorLabel = canManageCourse(actor.role) ? "任课教师" : actor.role;

  let receipt;
  try {
    receipt = normalizeCourseResourceReleaseReceipt(payload.receipt, actorLabel);
  } catch (error) {
    return badRequest(error.message);
  }

  await ensureWorkbench(env, scope);
  const targetIds = new Set(receipt.targetWorkOrderIds);
  const firstTargetId = [...targetIds][0] || "";
  const snapshot = await getWorkbenchSnapshot(env, scope, firstTargetId);
  const targetOrders = snapshot.workOrders.filter((order) => targetIds.has(order.id));
  if (targetOrders.length === 0) {
    return badRequest("no target work orders found for course resource release receipt");
  }

  const store = getEdgeStore(env);
  const responseSnapshot = {
    ...snapshot,
    workOrders: [...snapshot.workOrders],
    ledger: { ...(snapshot.ledger || {}) },
    studentReturn: { ...(snapshot.studentReturn || {}) },
  };
  const revisionTraceId = `course-resource-revision-${receipt.revisionTicketId}`;
  const releaseTraceId = `course-resource-release-${receipt.id}`;
  const ledgerEntries = [];
  const skipped = [];

  for (const order of targetOrders) {
    const existingLedger = responseSnapshot.ledger[order.id] || [];
    const revisionRecorded = existingLedger.some(
      (entry) =>
        entry.type === "course_resource_revision" &&
        entry.traceId === revisionTraceId,
    );
    if (!revisionRecorded) {
      skipped.push(`${order.id}:missing-resource-revision`);
      continue;
    }
    const duplicated = existingLedger.some(
      (entry) =>
        entry.type === "course_resource_release" &&
        entry.traceId === releaseTraceId,
    );
    if (duplicated) {
      skipped.push(`${order.id}:duplicated`);
      continue;
    }
    const applied = applyCourseResourceReleaseReceipt(order, receipt);
    ledgerEntries.push(applied.ledgerEntry);
    if (store?.putWorkOrder) await store.putWorkOrder(applied.order);
    if (store?.putWorkOrderLedgerEntry) {
      await store.putWorkOrderLedgerEntry(order.id, applied.ledgerEntry, scope);
    }
    responseSnapshot.workOrders = responseSnapshot.workOrders.map((item) =>
      item.id === order.id ? applied.order : item,
    );
    responseSnapshot.ledger[order.id] = [applied.ledgerEntry, ...existingLedger];
  }

  if (ledgerEntries.length === 0) {
    return badRequest("course resource revision must be recorded before resource release, or release has already been recorded", {
      skipped,
    });
  }

  const shapedSnapshot = store
    ? await getWorkbenchSnapshot(env, scope, firstTargetId || snapshot.selectedId)
    : {
        ...responseSnapshot,
        selectedId: firstTargetId || snapshot.selectedId,
        updatedAt: nowText(),
        stored: false,
        storageMode: storeMode(env),
      };

  return json({
    runtime: RUNTIME,
    receipt,
    recordedCount: ledgerEntries.length,
    skippedCount: skipped.length,
    skipped,
    ledgerEntries,
    snapshot: await shapeSnapshotForActor(env, shapedSnapshot, actor),
    storageMode: storeMode(env),
    stored: Boolean(store),
  });
}

async function handleCourseResourceUsageRecord(request, env) {
  const url = new URL(request.url);
  const payload = await parseJson(request);
  const findings = enforcePrivacy(env, payload);
  if (findings.length > 0) {
    return privacyBlocked("course resource usage receipt contains protected fields", findings);
  }

  let scope;
  try {
    scope = scopeFromPayload(payload);
    if (!payload.receipt || typeof payload.receipt !== "object" || Array.isArray(payload.receipt)) {
      throw new Error("receipt must be an object");
    }
  } catch (error) {
    return badRequest(error.message);
  }

  const authError = await authorize(request, url, env, "course_resource_usage.record", scope);
  if (authError) return authError;
  const actor = await actorContext(request, url, env);
  const actorLabel = canManageCourse(actor.role) ? "任课教师" : actor.role;

  let receipt;
  try {
    receipt = normalizeCourseResourceUsageReceipt(payload.receipt, actorLabel);
  } catch (error) {
    return badRequest(error.message);
  }

  await ensureWorkbench(env, scope);
  const targetIds = new Set(receipt.targetWorkOrderIds);
  const firstTargetId = [...targetIds][0] || "";
  const snapshot = await getWorkbenchSnapshot(env, scope, firstTargetId);
  const targetOrders = snapshot.workOrders.filter((order) => targetIds.has(order.id));
  if (targetOrders.length === 0) {
    return badRequest("no target work orders found for course resource usage receipt");
  }

  const store = getEdgeStore(env);
  const responseSnapshot = {
    ...snapshot,
    workOrders: [...snapshot.workOrders],
    ledger: { ...(snapshot.ledger || {}) },
    studentReturn: { ...(snapshot.studentReturn || {}) },
  };
  const releaseTraceId = `course-resource-release-${receipt.releaseReceiptId}`;
  const usageTraceId = `course-resource-usage-${receipt.id}`;
  const ledgerEntries = [];
  const skipped = [];

  for (const order of targetOrders) {
    const existingLedger = responseSnapshot.ledger[order.id] || [];
    const releaseRecorded = existingLedger.some(
      (entry) =>
        entry.type === "course_resource_release" &&
        entry.traceId === releaseTraceId,
    );
    if (!releaseRecorded) {
      skipped.push(`${order.id}:missing-resource-release`);
      continue;
    }
    const duplicated = existingLedger.some(
      (entry) =>
        entry.type === "course_resource_usage" &&
        entry.traceId === usageTraceId,
    );
    if (duplicated) {
      skipped.push(`${order.id}:duplicated`);
      continue;
    }
    const applied = applyCourseResourceUsageReceipt(order, receipt);
    ledgerEntries.push(applied.ledgerEntry);
    if (store?.putWorkOrder) await store.putWorkOrder(applied.order);
    if (store?.putWorkOrderLedgerEntry) {
      await store.putWorkOrderLedgerEntry(order.id, applied.ledgerEntry, scope);
    }
    responseSnapshot.workOrders = responseSnapshot.workOrders.map((item) =>
      item.id === order.id ? applied.order : item,
    );
    responseSnapshot.ledger[order.id] = [applied.ledgerEntry, ...existingLedger];
  }

  if (ledgerEntries.length === 0) {
    return badRequest("course resource release must be recorded before usage receipt, or usage has already been recorded", {
      skipped,
    });
  }

  const shapedSnapshot = store
    ? await getWorkbenchSnapshot(env, scope, firstTargetId || snapshot.selectedId)
    : {
        ...responseSnapshot,
        selectedId: firstTargetId || snapshot.selectedId,
        updatedAt: nowText(),
        stored: false,
        storageMode: storeMode(env),
      };

  return json({
    runtime: RUNTIME,
    receipt,
    recordedCount: ledgerEntries.length,
    skippedCount: skipped.length,
    skipped,
    ledgerEntries,
    snapshot: await shapeSnapshotForActor(env, shapedSnapshot, actor),
    storageMode: storeMode(env),
    stored: Boolean(store),
  });
}

async function handleCourseResourceUsageReminder(request, env) {
  const url = new URL(request.url);
  const payload = await parseJson(request);
  const findings = enforcePrivacy(env, payload);
  if (findings.length > 0) {
    return privacyBlocked("course resource usage reminder contains protected fields", findings);
  }

  let scope;
  let reminder;
  try {
    scope = scopeFromPayload(payload);
    reminder = payload.reminder || {};
    if (!reminder || typeof reminder !== "object" || Array.isArray(reminder)) {
      throw new Error("reminder must be an object");
    }
    reminder.usageReceiptId = requireText(reminder.usageReceiptId, "reminder.usageReceiptId");
    reminder.traceId =
      String(reminder.traceId || "").trim() ||
      `course-resource-usage-reminder-${reminder.usageReceiptId}`;
    reminder.title = String(reminder.title || "course resource usage return").trim();
    reminder.note = String(reminder.note || "").trim();
    reminder.targetWorkOrderIds = Array.from(
      new Set(
        (Array.isArray(reminder.targetWorkOrderIds) ? reminder.targetWorkOrderIds : [])
          .map((id) => String(id || "").trim())
          .filter(Boolean),
      ),
    ).slice(0, 80);
    if (reminder.targetWorkOrderIds.length === 0) {
      throw new Error("reminder.targetWorkOrderIds is required");
    }
  } catch (error) {
    return badRequest(error.message);
  }

  const authError = await authorize(request, url, env, "course_resource_usage.remind", scope);
  if (authError) return authError;
  const actor = await actorContext(request, url, env);
  const actorLabel = canManageCourse(actor.role) ? "任课教师" : actor.role;

  await ensureWorkbench(env, scope);
  const snapshot = await getWorkbenchSnapshot(env, scope, reminder.targetWorkOrderIds[0] || "");
  const targetIds = new Set(reminder.targetWorkOrderIds);
  const targetOrders = snapshot.workOrders.filter((order) => targetIds.has(order.id));
  if (targetOrders.length === 0) {
    return badRequest("no target work orders found for course resource usage reminder");
  }

  const store = getEdgeStore(env);
  const returnKeys = ["scaffoldReceived", "evidenceSubmitted", "reflectionSubmitted"];
  const usageTraceId = `course-resource-usage-${reminder.usageReceiptId}`;
  const responseSnapshot = {
    ...snapshot,
    workOrders: [...snapshot.workOrders],
    ledger: { ...(snapshot.ledger || {}) },
    studentReturn: { ...(snapshot.studentReturn || {}) },
  };
  const ledgerEntries = [];
  const skipped = [];

  for (const order of targetOrders) {
    const existingLedger = responseSnapshot.ledger[order.id] || [];
    const returnState = responseSnapshot.studentReturn[order.id] || emptyStudentReturnState();
    const completed = returnKeys.filter((key) => Boolean(returnState[key])).length;
    const usageRecorded = existingLedger.some(
      (entry) => entry.type === "course_resource_usage" && entry.traceId === usageTraceId,
    );
    const duplicated = existingLedger.some(
      (entry) => entry.type === "teacher_reminder" && entry.traceId === reminder.traceId,
    );
    if (order.status === "closed") {
      skipped.push(`${order.id}:closed`);
      continue;
    }
    if (completed >= returnKeys.length) {
      skipped.push(`${order.id}:return-completed`);
      continue;
    }
    if (!usageRecorded) {
      skipped.push(`${order.id}:missing-resource-usage`);
      continue;
    }
    if (duplicated) {
      skipped.push(`${order.id}:duplicated`);
      continue;
    }
    const applied = applyCourseResourceUsageReminder(order, {
      ...reminder,
      actor: actorLabel,
    });
    ledgerEntries.push(applied.ledgerEntry);
    if (store?.putWorkOrder) await store.putWorkOrder(applied.order);
    if (store?.putWorkOrderLedgerEntry) {
      await store.putWorkOrderLedgerEntry(order.id, applied.ledgerEntry, scope);
    }
    responseSnapshot.workOrders = responseSnapshot.workOrders.map((item) =>
      item.id === order.id ? applied.order : item,
    );
    responseSnapshot.ledger[order.id] = [applied.ledgerEntry, ...existingLedger];
    responseSnapshot.studentReturn[order.id] = returnState;
  }

  if (ledgerEntries.length === 0) {
    return badRequest("course resource usage must be recorded before reminder, or all targets have returned/been reminded", {
      skipped,
    });
  }

  const shapedSnapshot = store
    ? await getWorkbenchSnapshot(env, scope, reminder.targetWorkOrderIds[0] || snapshot.selectedId)
    : {
        ...responseSnapshot,
        selectedId: reminder.targetWorkOrderIds[0] || snapshot.selectedId,
        updatedAt: nowText(),
        stored: false,
        storageMode: storeMode(env),
      };

  return json({
    runtime: RUNTIME,
    remindedCount: ledgerEntries.length,
    skippedCount: skipped.length,
    skipped,
    ledgerEntries,
    snapshot: await shapeSnapshotForActor(env, shapedSnapshot, actor),
    storageMode: storeMode(env),
    stored: Boolean(store),
  });
}

async function handleStudentReturn(url, request, env) {
  const match = url.pathname.match(/^\/api\/work-orders\/([^/]+)\/student-return$/);
  if (!match) return notFound(url.pathname);
  const payload = await parseJson(request);
  const findings = enforcePrivacy(env, payload);
  if (findings.length > 0) {
    return privacyBlocked("student return contains protected fields", findings);
  }

  let scope;
  let step;
  try {
    scope = scopeFromPayload(payload);
    step = requireText(payload.step, "step");
    if (!["scaffoldReceived", "evidenceSubmitted", "reflectionSubmitted"].includes(step)) {
      throw new Error("step must be scaffoldReceived, evidenceSubmitted or reflectionSubmitted");
    }
  } catch (error) {
    return badRequest(error.message);
  }

  const orderId = decodeURIComponent(match[1]);
  const bundle = await getWorkOrderBundle(env, scope, orderId);
  if (!bundle.workOrder) return notFound(url.pathname);
  if (!bundle.workOrder.selectedDecision) {
    return forbidden("student return is not open until teacher confirms the next action");
  }
  if (!bundle.workOrder.interventionPackage) {
    return forbidden("student return is not open until teacher publishes intervention package");
  }
  if (bundle.workOrder.status === "closed") {
    return forbidden("student return is closed after teacher acceptance");
  }

  const learnerHash = payload.learnerHash || bundle.workOrder.learnerHash;
  if (learnerHash && !isLikelyPseudonymous(learnerHash)) {
    return badRequest("learnerHash must be pseudonymous");
  }
  if (learnerHash && bundle.workOrder.learnerHash && learnerHash !== bundle.workOrder.learnerHash) {
    return forbidden("student return learnerHash does not match work order");
  }
  const returnTokenValid = await hasValidStudentReturnToken(
    env,
    bundle.workOrder,
    studentReturnTokenFrom(request, url, payload),
  );

  const scopedLearner = { ...scope, learnerHash, workOrderId: orderId, returnTokenValid };
  const authError = await authorize(request, url, env, "workorder.student_return", scopedLearner);
  if (authError) return authError;
  const actor = await actorContext(request, url, env);

  const applied = applyStudentReturn(
    bundle.workOrder,
    bundle.studentReturn,
    step,
    studentReturnContentFromPayload(payload),
  );
  const store = getEdgeStore(env);
  if (store?.putWorkOrder) await store.putWorkOrder(applied.order);
  if (store?.putStudentReturn) await store.putStudentReturn(orderId, applied.state, scope);
  if (store?.putWorkOrderLedgerEntry) await store.putWorkOrderLedgerEntry(orderId, applied.ledgerEntry, scope);

  return json({
    runtime: RUNTIME,
    workOrder: await shapeWorkOrderForActor(env, actor, applied.order),
    studentReturn: applied.state,
    ledgerEntry: applied.ledgerEntry,
    snapshot: await shapeSnapshotForActor(
      env,
      await getWorkbenchSnapshot(env, scope, orderId),
      actor,
      { returnTokenOrderId: actor.role === "student" ? orderId : "" },
    ),
  });
}

async function handleTeacherEvidenceReview(url, request, env) {
  const match = url.pathname.match(/^\/api\/work-orders\/([^/]+)\/evidence-review$/);
  if (!match) return notFound(url.pathname);
  const payload = await parseJson(request);
  const findings = enforcePrivacy(env, payload);
  if (findings.length > 0) {
    return privacyBlocked("teacher evidence review contains protected fields", findings);
  }

  let scope;
  let review;
  try {
    scope = scopeFromPayload(payload);
    review = payload.review || {};
    if (!review || typeof review !== "object" || Array.isArray(review)) {
      throw new Error("review must be an object");
    }
    review.sourceLedgerEntryId = requireText(review.sourceLedgerEntryId, "review.sourceLedgerEntryId");
    review.summary = cleanStudentReturnText(review.summary || "教师已复核学生回流证据。", 260);
    review.teacherNote = cleanStudentReturnText(review.teacherNote, 220);
    review.items = (Array.isArray(review.items) ? review.items : []).slice(0, 8).map((item, index) => {
      const status = requireText(item.status, `review.items[${index}].status`);
      if (!["accepted", "needs_evidence", "rejected"].includes(status)) {
        throw new Error("review item status must be accepted, needs_evidence or rejected");
      }
      return {
        key: cleanStudentReturnText(item.key || `item-${index + 1}`, 80),
        label: cleanStudentReturnText(item.label || `证据项 ${index + 1}`, 80),
        value: cleanStudentReturnText(item.value, 800),
        status,
        note: cleanStudentReturnText(item.note, 120),
        required: Boolean(item.required),
      };
    });
    if (review.items.length === 0) throw new Error("review.items is required");
  } catch (error) {
    return badRequest(error.message);
  }

  const orderId = decodeURIComponent(match[1]);
  const authError = await authorize(request, url, env, "workorder.evidence_review", scope);
  if (authError) return authError;
  const actor = await actorContext(request, url, env);
  const bundle = await getWorkOrderBundle(env, scope, orderId);
  if (!bundle.workOrder) return notFound(url.pathname);
  if (bundle.workOrder.status === "closed") {
    return forbidden("teacher evidence review is closed after teacher acceptance");
  }

  const applied = applyTeacherEvidenceReview(bundle.workOrder, review);
  const store = getEdgeStore(env);
  if (store?.putWorkOrder) await store.putWorkOrder(applied.order);
  if (store?.putWorkOrderLedgerEntry) await store.putWorkOrderLedgerEntry(orderId, applied.ledgerEntry, scope);

  return json({
    runtime: RUNTIME,
    workOrder: await shapeWorkOrderForActor(env, actor, applied.order),
    ledgerEntry: applied.ledgerEntry,
    snapshot: await shapeSnapshotForActor(env, await getWorkbenchSnapshot(env, scope, orderId), actor),
  });
}

function latestStudentEvidenceReturnEntry(ledger = []) {
  const entries = ledger.filter(
    (entry) =>
      entry?.type === "student_return" &&
      (String(entry.traceId || "").includes("-evidenceSubmitted") ||
        String(entry.title || "").includes("补充关键证据") ||
        String(entry.detail || "").includes("失败现象") ||
        String(entry.detail || "").includes("最小失败用例")),
  );
  return entries[0] || null;
}

function hasAcceptedTeacherEvidenceReview(ledger = []) {
  const sourceEntry = latestStudentEvidenceReturnEntry(ledger);
  if (!sourceEntry) return false;
  const review = ledger.find(
    (entry) =>
      entry?.type === "teacher_evidence_review" &&
      entry.traceId === `teacher-evidence-review-${sourceEntry.id}`,
  );
  if (!review) return false;
  const payload = review.payload && typeof review.payload === "object" ? review.payload : {};
  const items = Array.isArray(payload.items) ? payload.items : [];
  if (items.length > 0) return items.every((item) => item?.status === "accepted");
  const detail = String(review.detail || "");
  return String(review.title || "").includes("可进入验收") && !detail.includes("待补") && !detail.includes("不采用");
}

async function handleWorkOrderClosure(url, request, env) {
  const match = url.pathname.match(/^\/api\/work-orders\/([^/]+)\/closure$/);
  if (!match) return notFound(url.pathname);
  const payload = await parseJson(request);
  const findings = enforcePrivacy(env, payload);
  if (findings.length > 0) {
    return privacyBlocked("work order closure contains protected fields", findings);
  }

  let scope;
  let decision;
  try {
    scope = scopeFromPayload(payload);
    decision = requireText(payload.decision, "decision");
    if (!["accept", "returnEvidence"].includes(decision)) {
      throw new Error("decision must be accept or returnEvidence");
    }
  } catch (error) {
    return badRequest(error.message);
  }

  const authError = await authorize(request, url, env, "workorder.close", scope);
  if (authError) return authError;
  const actor = await actorContext(request, url, env);
  const orderId = decodeURIComponent(match[1]);
  const bundle = await getWorkOrderBundle(env, scope, orderId);
  if (!bundle.workOrder) return notFound(url.pathname);

  let applied;
  try {
    applied = applyTeacherClosure(
      bundle.workOrder,
      bundle.studentReturn,
      decision,
      String(payload.teacherNote || "").trim(),
    );
  } catch (error) {
    return badRequest(error.message);
  }

  if (decision === "accept" && !hasAcceptedTeacherEvidenceReview(bundle.ledger)) {
    return badRequest("teacher acceptance requires saved all-accepted evidence review");
  }

  const store = getEdgeStore(env);
  if (store?.putWorkOrder) await store.putWorkOrder(applied.order);
  if (store?.putStudentReturn) await store.putStudentReturn(orderId, applied.state, scope);
  if (store?.putWorkOrderLedgerEntry) await store.putWorkOrderLedgerEntry(orderId, applied.ledgerEntry, scope);

  return json({
    runtime: RUNTIME,
    workOrder: await shapeWorkOrderForActor(env, actor, applied.order),
    studentReturn: applied.state,
    ledgerEntry: applied.ledgerEntry,
    snapshot: await shapeSnapshotForActor(env, await getWorkbenchSnapshot(env, scope, orderId), actor),
  });
}

async function handleLearnerProfile(url, request, env) {
  const match = url.pathname.match(/^\/api\/learners\/([^/]+)\/profile$/);
  if (!match) return notFound(url.pathname);
  const scope = scopeFromUrl(url);
  const learnerHash = decodeURIComponent(match[1]);
  if (!isLikelyPseudonymous(learnerHash)) {
    return badRequest("learnerHash must be pseudonymous");
  }
  const authError = await authorize(request, url, env, "profile.read", { ...scope, learnerHash });
  if (authError) return authError;
  const snapshot = await getWorkbenchSnapshot(env, scope);
  return json({
    runtime: RUNTIME,
    tenantId: scope.tenantId,
    courseId: scope.courseId,
    profile: buildLearnerProfile(learnerHash, snapshot.workOrders),
  });
}

async function importGithubWorkOrder(request, env, sourceLabel, authAction, options = {}) {
  const url = new URL(request.url);
  const payload = options.payload ?? (await parseJson(request));
  const findings = enforcePrivacy(env, payload);
  if (findings.length > 0) {
    return privacyBlocked("GitHub import contains protected fields", findings);
  }

  let scope;
  try {
    scope = checkTenantScope(payload);
    if (scope.learnerHash && !isLikelyPseudonymous(scope.learnerHash)) {
      throw new Error("learnerHash must be pseudonymous");
    }
    requireText(payload.repository, "repository");
    requireText(payload.prUrl, "prUrl");
    requireText(payload.ciRunUrl, "ciRunUrl");
  } catch (error) {
    return badRequest(error.message);
  }

  if (!(sourceLabel === "github-webhook" && options.webhookAuth?.ok)) {
    const authError = await authorize(request, url, env, authAction, scope);
    if (authError) return authError;
  }
  const responseActor =
    sourceLabel === "github-webhook"
      ? { role: "system", learnerHash: "", reviewMode: "", authMode: options.webhookAuth?.mode || "webhook-token" }
      : await actorContext(request, url, env);
  const courseScope = { tenantId: scope.tenantId, courseId: scope.courseId };
  const idempotencyKey =
    payload.idempotencyKey || payload.deliveryId || `${scope.tenantId}:${scope.courseId}:${payload.prUrl}:${payload.ciRunUrl}`;
  const digest = await sha256Hex(idempotencyKey);
  const imported = createWorkOrderFromGithubImport({ ...payload, ...scope }, digest);
  const store = getEdgeStore(env);
  let workOrder = imported.order;
  let deduped = false;

  await ensureWorkbench(env, courseScope);
  const existing = store?.getWorkOrder ? await store.getWorkOrder(workOrder.id, courseScope) : null;
  if (existing) {
    workOrder = existing;
    deduped = true;
  } else {
    if (store?.putWorkOrder) await store.putWorkOrder(workOrder);
    if (store?.putStudentReturn) await store.putStudentReturn(workOrder.id, imported.studentReturn, courseScope);
    if (store?.putWorkOrderLedgerEntry) await store.putWorkOrderLedgerEntry(workOrder.id, imported.ledgerEntry, courseScope);
  }
  const integrationEvent = await recordIntegrationEvent(
    env,
    githubIntegrationEventBase(payload, scope, sourceLabel, digest, request, {
      authMode: sourceLabel === "github-webhook" ? responseActor.authMode : "sepath-hmac-token",
      status: deduped ? "deduped" : "created",
      workOrderId: workOrder.id,
      workOrderIds: [workOrder.id],
      createdCount: deduped ? 0 : 1,
      skippedCount: deduped ? 1 : 0,
      summary: `${workOrder.trigger} / ${workOrder.valueAdded?.label || "value-added diagnosis"}`,
    }),
  );

  return json({
    runtime: RUNTIME,
    source: sourceLabel,
    authMode: sourceLabel === "github-webhook" ? responseActor.authMode : undefined,
    deliveryId: payload.deliveryId || request.headers.get("x-github-delivery") || "",
    githubEvent: request.headers.get("x-github-event") || "",
    deduped,
    integrationEvent,
    workOrder: await shapeWorkOrderForActor(env, responseActor, workOrder),
    snapshot: await shapeSnapshotForActor(
      env,
      await getWorkbenchSnapshot(env, courseScope, workOrder.id),
      responseActor,
    ),
  });
}

function normalizeGithubBatchImportItems(payload, settings) {
  const items = Array.isArray(payload.importedEvents)
    ? payload.importedEvents
    : Array.isArray(payload.events)
      ? payload.events
      : [];
  if (items.length === 0) {
    throw new Error("importedEvents must include at least one PR/CI event");
  }
  if (items.length > 40) {
    throw new Error("batch GitHub import supports up to 40 events per request");
  }

  return items.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`importedEvents[${index}] must be an object`);
    }
    const learnerHash = requireText(item.learnerHash, `importedEvents[${index}].learnerHash`);
    if (!isLikelyPseudonymous(learnerHash)) {
      throw new Error(`importedEvents[${index}].learnerHash must be pseudonymous`);
    }
    const prUrl = requireText(item.prUrl, `importedEvents[${index}].prUrl`);
    const ciRunUrl = requireText(item.ciRunUrl, `importedEvents[${index}].ciRunUrl`);
    return {
      learnerHash,
      learnerAlias: String(item.learnerAlias || `SE-${learnerHash.slice(-4).toUpperCase()}`).trim(),
      repository: String(item.repository || settings.repository || "se-course/rest-api-lab").trim(),
      branch: String(item.branch || "").trim(),
      prUrl,
      ciRunUrl,
      ciProvider: String(item.ciProvider || settings.ciProvider || "GitHub Actions").trim(),
      ciLogSummary: String(item.ciLogSummary || item.summary || "CI failed. Teacher review required before any intervention.").trim(),
      trigger: String(item.trigger || "").trim(),
      eventDate: String(item.eventDate || new Date().toISOString().slice(0, 10)).trim(),
      courseClass: String(item.courseClass || settings.courseClass || "软件工程 2301").trim(),
      courseName: String(item.courseName || settings.courseName || "软件工程课程闭环任务").trim(),
      owner: String(item.owner || "任课教师").trim(),
      idempotencyKey: String(item.idempotencyKey || "").trim(),
    };
  });
}

async function handleGithubBatchImport(request, env) {
  const url = new URL(request.url);
  const payload = await parseJson(request);
  const findings = enforcePrivacy(env, payload);
  if (findings.length > 0) {
    return privacyBlocked("GitHub batch import contains protected fields", findings);
  }

  let scope;
  let importedEvents;
  try {
    scope = scopeFromPayload(payload);
    const settings = await getCourseSettings(env, scope);
    importedEvents = normalizeGithubBatchImportItems(payload, settings);
  } catch (error) {
    return badRequest(error.message);
  }

  const authError = await authorize(request, url, env, "integration.import", scope);
  if (authError) return authError;

  const courseScope = { tenantId: scope.tenantId, courseId: scope.courseId };
  const store = getEdgeStore(env);
  const actor = await actorContext(request, url, env);
  const created = [];
  const createdLedger = {};
  const createdReturns = {};
  const skipped = [];
  const seenOrderIds = new Set();

  await ensureWorkbench(env, courseScope);

  for (const item of importedEvents) {
    const idempotencyKey =
      item.idempotencyKey ||
      `${payload.idempotencyKey || "github-batch"}:${courseScope.tenantId}:${courseScope.courseId}:${item.learnerHash}:${item.prUrl}:${item.ciRunUrl}`;
    const digest = await sha256Hex(idempotencyKey);
    const imported = createWorkOrderFromGithubImport({ ...item, ...courseScope }, digest);
    if (seenOrderIds.has(imported.order.id)) {
      skipped.push(imported.order.id);
      continue;
    }
    seenOrderIds.add(imported.order.id);
    const existing = store?.getWorkOrder ? await store.getWorkOrder(imported.order.id, courseScope) : null;
    if (existing) {
      skipped.push(existing.id);
      continue;
    }
    if (store?.putWorkOrder) await store.putWorkOrder(imported.order);
    if (store?.putStudentReturn) await store.putStudentReturn(imported.order.id, imported.studentReturn, courseScope);
    if (store?.putWorkOrderLedgerEntry) await store.putWorkOrderLedgerEntry(imported.order.id, imported.ledgerEntry, courseScope);
    created.push(imported.order);
    createdLedger[imported.order.id] = [imported.ledgerEntry];
    createdReturns[imported.order.id] = imported.studentReturn;
  }

  const storedSnapshot = await getWorkbenchSnapshot(env, courseScope, created[0]?.id || "");
  const snapshot = store
    ? storedSnapshot
    : {
        ...storedSnapshot,
        selectedId: created[0]?.id || storedSnapshot.selectedId,
        workOrders: [
          ...created,
          ...storedSnapshot.workOrders.filter((order) => !seenOrderIds.has(order.id)),
        ],
        ledger: {
          ...storedSnapshot.ledger,
          ...createdLedger,
        },
        studentReturn: {
          ...storedSnapshot.studentReturn,
          ...createdReturns,
        },
      };

  const batchId = `github-batch-${Date.now()}`;
  const integrationEvent = await recordIntegrationEvent(
    env,
    {
      id: batchId,
      tenantId: courseScope.tenantId,
      courseId: courseScope.courseId,
      learnerHash: "",
      provider: "github",
      source: "github-ci-batch",
      status: created.length > 0 && skipped.length > 0 ? "partial" : created.length > 0 ? "created" : "deduped",
      authMode: "sepath-hmac-token",
      deliveryId: "",
      githubEvent: "batch-import",
      repository: importedEvents[0]?.repository || "",
      branch: "",
      prUrl: "",
      ciRunUrl: "",
      workOrderId: created[0]?.id || skipped[0] || "",
      workOrderIds: created.map((order) => order.id),
      createdCount: created.length,
      skippedCount: skipped.length,
      summary: `Batch import: ${created.length} created, ${skipped.length} skipped`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  );

  return json({
    runtime: RUNTIME,
    source: "github-ci-batch",
    batchId,
    createdCount: created.length,
    skippedCount: skipped.length,
    workOrders: await Promise.all(created.map((order) => shapeWorkOrderForActor(env, actor, order))),
    skipped,
    integrationEvent,
    snapshot: await shapeSnapshotForActor(env, snapshot, actor),
    storageMode: storeMode(env),
    stored: Boolean(store),
    warning: store ? "" : "stateless worker cannot persist batch-imported work orders; use memory or database store for pilot operation",
  });
}

async function handleGithubImport(request, env) {
  return importGithubWorkOrder(request, env, "github-ci", "integration.import");
}

async function handleGithubIntegrationStatus(url, request, env) {
  const scope = scopeFromUrl(url);
  const authError = await authorize(request, url, env, "integration.read", scope);
  if (authError) return authError;

  const store = getEdgeStore(env);
  const limit = Math.min(20, Math.max(1, Number(url.searchParams.get("limit") || 8)));
  const settings = await getCourseSettings(env, scope);
  const events = store?.listIntegrationEvents
    ? await store.listIntegrationEvents({ ...scope, limit })
    : [];
  const successful = events.filter((event) => ["created", "deduped", "partial"].includes(event.status));
  const blocked = events.filter((event) => ["blocked", "failed"].includes(event.status));
  const latest = events[0] || null;
  const snapshot = await getWorkbenchSnapshot(env, scope);

  return json({
    runtime: RUNTIME,
    tenantId: scope.tenantId,
    courseId: scope.courseId,
    provider: "github",
    configured: Boolean(settings.repository),
    storageMode: storeMode(env),
    stored: Boolean(store),
    summary: {
      health: latest ? "receiving" : settings.repository ? "configured" : "not_configured",
      latestStatus: latest?.status || "none",
      lastReceivedAt: latest?.createdAt || "",
      lastDeliveryId: latest?.deliveryId || "",
      lastAuthMode: latest?.authMode || "",
      successfulCount: successful.length,
      blockedCount: blocked.length,
      workOrderCount: snapshot.workOrders.length,
    },
    events,
  });
}

async function handleGithubWebhookImport(request, env) {
  const rawBody = await request.text();
  const webhookAuth = await verifyGithubWebhookAuth(request, rawBody, env);
  if (!webhookAuth.ok) {
    return unauthorized("valid GitHub webhook signature or SE-Path webhook token is required", {
      authMode: webhookAuth.mode,
      reason: webhookAuth.reason,
    });
  }
  let payload;
  try {
    payload = parseJsonText(rawBody);
  } catch (error) {
    return badRequest(error.message);
  }
  return importGithubWorkOrder(request, env, "github-webhook", "webhook.import", {
    payload,
    webhookAuth,
  });
}

async function handleLedgerExport(request, env) {
  const url = new URL(request.url);
  const payload = await parseJson(request);
  const findings = enforcePrivacy(env, payload);
  if (findings.length > 0) {
    return privacyBlocked("ledger export contains protected fields", findings);
  }

  let scope;
  let workOrderId;
  try {
    scope = scopeFromPayload(payload);
    workOrderId = requireText(payload.workOrderId, "workOrderId");
  } catch (error) {
    return badRequest(error.message);
  }

  const authError = await authorize(request, url, env, "ledger.export", scope);
  if (authError) return authError;
  const actor = await actorContext(request, url, env);
  const bundle = await getWorkOrderBundle(env, scope, workOrderId);
  if (!bundle.workOrder) return notFound(`/api/work-orders/${workOrderId}`);
  const exportWorkOrder = await shapeWorkOrderForActor(env, actor, bundle.workOrder);
  delete exportWorkOrder.returnToken;
  return json({
    runtime: RUNTIME,
    ...buildLedgerExportPayload(
      exportWorkOrder,
      bundle.ledger,
      bundle.studentReturn,
    ),
  });
}

function cloudReadiness(env) {
  const checks = [
    {
      key: "database",
      status: getEdgeStore(env) ? "ready" : isCloudRuntime(env) ? "not_ready" : "local_fallback",
      detail: getEdgeStore(env) ? storeMode(env) : "SEPATH_DB is required for cloud runtime",
    },
    {
      key: "auth",
      status: env?.SEPATH_AUTH_SECRET ? "ready" : requiresAuthSecret(env) ? "not_ready" : "local_fallback",
      detail: env?.SEPATH_AUTH_SECRET ? "HMAC access tokens enabled" : "SEPATH_AUTH_SECRET is required before cloud writes",
    },
    {
      key: "privacy",
      status: privacyMode(env) === "pseudonymous" ? "ready" : "not_ready",
      detail: `SEPATH_PRIVACY_MODE=${privacyMode(env)}`,
    },
    {
      key: "cors",
      status: allowedOrigins(env).length > 0 ? "ready" : isCloudRuntime(env) ? "not_ready" : "local_fallback",
      detail: allowedOrigins(env).length > 0 ? allowedOrigins(env).join(",") : "SEPATH_ALLOWED_ORIGINS is not configured",
    },
    {
      key: "llmGateway",
      status: hasRuntimeSecret(env?.LLM_API_KEY) && hasRuntimeSecret(env?.LLM_MODEL) ? "ready" : "local_fallback",
      detail: hasRuntimeSecret(env?.LLM_API_KEY) && hasRuntimeSecret(env?.LLM_MODEL)
        ? `OpenAI-compatible model gateway enabled: ${env.LLM_MODEL}`
        : "Model credentials are not configured; governed deterministic fallback remains available",
    },
  ];
  return {
    status: checks.some((check) => check.status === "not_ready") ? "not_ready" : "ready",
    cloudRuntime: isCloudRuntime(env),
    checks,
  };
}

function handleHealth(env) {
  const readiness = cloudReadiness(env);
  return json({
    runtime: RUNTIME,
    status: readiness.status === "ready" ? "ok" : "not_ready",
    readiness,
    privacyMode: privacyMode(env),
    authMode: env?.SEPATH_AUTH_SECRET ? "hmac-token" : "local-header",
    defaultRole: "reviewer",
    rolePolicy: "reviewer read-only; student own learnerHash only; teacher/course_admin/system manage course actions",
    storageMode: storeMode(env),
    endpoints: [
      "POST /api/auth/token",
      "POST /api/auth/teacher-login",
      "GET /api/auth/session",
      "POST /api/ai/generate-scaffold",
      "GET /api/agent/conversation",
      "POST /api/agent/conversation",
      "POST /api/agent/conversation/draft",
      "GET /api/course/settings",
      "POST /api/course/settings",
      "POST /api/course/launch",
      "GET /api/course/roster",
      "POST /api/course/roster",
      "POST /api/evidence/events",
      "GET /api/evidence/events",
      "GET /api/workbench/teacher/today",
      "GET /api/work-orders",
      "POST /api/work-order-batches",
      "GET /api/work-orders/{id}",
      "POST /api/work-orders/{id}/review",
      "POST /api/work-orders/{id}/intervention-package",
      "POST /api/course/micro-task-package",
      "POST /api/course/micro-task-reminder",
      "POST /api/course/teaching-improvement-plan",
      "POST /api/course/teaching-improvement-execution",
      "POST /api/course/teaching-improvement-followup-sample",
      "POST /api/course/teaching-improvement-followup-result",
      "POST /api/course/resource-revision",
      "POST /api/course/resource-release",
      "POST /api/course/resource-usage",
      "POST /api/course/resource-usage-reminder",
      "POST /api/work-orders/{id}/student-return",
      "POST /api/work-orders/{id}/evidence-review",
      "POST /api/work-orders/{id}/closure",
      "GET /api/learners/{learnerHash}/diagnosis",
      "GET /api/learners/{learnerHash}/profile",
      "POST /api/interventions/rank",
      "POST /api/integrations/github/import",
      "POST /api/integrations/github/batch-import",
      "GET /api/integrations/github/status",
      "POST /api/webhooks/github/ci",
      "POST /api/review/tickets",
      "GET /api/review/tickets",
      "POST /api/ledgers/import",
      "POST /api/exports/ledger",
      "GET /api/privacy/audit",
    ],
  });
}

export default {
  async fetch(request, env = {}) {
    const response = await (async () => {
      if (request.method === "OPTIONS") return json({ ok: true, runtime: RUNTIME });
      const url = new URL(request.url);
      try {
        if (writeMethods.has(request.method) && requiresAuthSecret(env) && !env?.SEPATH_AUTH_SECRET) {
          return json(
            {
              runtime: RUNTIME,
              error: "not_ready",
              message: "SEPATH_AUTH_SECRET is required before cloud writes",
              readiness: cloudReadiness(env),
            },
            { status: 503 },
          );
        }
        if (request.method === "GET" && url.pathname === "/api/health") return handleHealth(env);
        if (request.method === "POST" && url.pathname === "/api/auth/token") return handleAuthToken(request, env);
        if (request.method === "POST" && url.pathname === "/api/auth/teacher-login") return handleTeacherLogin(request, env);
        if (request.method === "GET" && url.pathname === "/api/auth/session") return handleAuthSession(url, request, env);
        if (request.method === "POST" && url.pathname === "/api/ai/generate-scaffold") return handleLlmGatewayRequest(request, env);
        if (["/api/agent/conversation", "/api/agent/conversation/draft"].includes(url.pathname)) return handleTeachingAgent(request, env);
        if (request.method === "GET" && url.pathname === "/api/course/settings") return handleCourseSettingsRead(url, request, env);
        if (request.method === "POST" && url.pathname === "/api/course/settings") return handleCourseSettingsWrite(request, env);
        if (request.method === "POST" && url.pathname === "/api/course/launch") return handleCourseLaunch(request, env);
        if (request.method === "GET" && url.pathname === "/api/course/roster") return handleCourseRosterRead(url, request, env);
        if (request.method === "POST" && url.pathname === "/api/course/roster") return handleCourseRosterWrite(request, env);
        if (request.method === "POST" && url.pathname === "/api/evidence/events") return handleEvidenceCreate(request, env);
        if (request.method === "GET" && url.pathname === "/api/evidence/events") return handleEvidenceList(url, request, env);
        if (request.method === "GET" && url.pathname === "/api/workbench/teacher/today") return handleTeacherWorkbench(url, request, env);
        if (request.method === "GET" && url.pathname === "/api/work-orders") return handleWorkOrdersList(url, request, env);
        if (request.method === "POST" && url.pathname === "/api/work-order-batches") return handleWorkOrderBatchCreate(request, env);
        if (request.method === "GET" && /^\/api\/work-orders\/[^/]+$/.test(url.pathname)) return handleWorkOrderRead(url, request, env);
        if (request.method === "POST" && /^\/api\/work-orders\/[^/]+\/review$/.test(url.pathname)) return handleWorkOrderReview(url, request, env);
        if (request.method === "POST" && /^\/api\/work-orders\/[^/]+\/intervention-package$/.test(url.pathname)) return handleInterventionPackagePublish(url, request, env);
        if (request.method === "POST" && url.pathname === "/api/course/micro-task-package") return handleCourseMicroTaskPackagePublish(request, env);
        if (request.method === "POST" && url.pathname === "/api/course/micro-task-reminder") return handleCourseMicroTaskReminder(request, env);
        if (request.method === "POST" && url.pathname === "/api/course/teaching-improvement-plan") return handleCourseTeachingImprovementPlanPublish(request, env);
        if (request.method === "POST" && url.pathname === "/api/course/teaching-improvement-execution") return handleCourseTeachingImprovementExecutionRecord(request, env);
        if (request.method === "POST" && url.pathname === "/api/course/teaching-improvement-followup-sample") return handleCourseTeachingImprovementFollowupRecord(request, env);
        if (request.method === "POST" && url.pathname === "/api/course/teaching-improvement-followup-result") return handleCourseTeachingImprovementFollowupResultRecord(request, env);
        if (request.method === "POST" && url.pathname === "/api/course/resource-revision") return handleCourseResourceRevisionRecord(request, env);
        if (request.method === "POST" && url.pathname === "/api/course/resource-release") return handleCourseResourceReleaseRecord(request, env);
        if (request.method === "POST" && url.pathname === "/api/course/resource-usage") return handleCourseResourceUsageRecord(request, env);
        if (request.method === "POST" && url.pathname === "/api/course/resource-usage-reminder") return handleCourseResourceUsageReminder(request, env);
        if (request.method === "POST" && /^\/api\/work-orders\/[^/]+\/student-return$/.test(url.pathname)) return handleStudentReturn(url, request, env);
        if (request.method === "POST" && /^\/api\/work-orders\/[^/]+\/evidence-review$/.test(url.pathname)) return handleTeacherEvidenceReview(url, request, env);
        if (request.method === "POST" && /^\/api\/work-orders\/[^/]+\/closure$/.test(url.pathname)) return handleWorkOrderClosure(url, request, env);
        if (request.method === "GET" && /^\/api\/learners\/[^/]+\/diagnosis$/.test(url.pathname)) return handleDiagnosisRead(url, request, env);
        if (request.method === "GET" && /^\/api\/learners\/[^/]+\/profile$/.test(url.pathname)) return handleLearnerProfile(url, request, env);
        if (request.method === "POST" && url.pathname === "/api/interventions/rank") return handleInterventionRank(request, env);
        if (request.method === "POST" && url.pathname === "/api/integrations/github/import") return handleGithubImport(request, env);
        if (request.method === "POST" && url.pathname === "/api/integrations/github/batch-import") return handleGithubBatchImport(request, env);
        if (request.method === "GET" && url.pathname === "/api/integrations/github/status") return handleGithubIntegrationStatus(url, request, env);
        if (request.method === "POST" && url.pathname === "/api/webhooks/github/ci") return handleGithubWebhookImport(request, env);
        if (request.method === "POST" && url.pathname === "/api/review/tickets") return handleReviewTicket(request, env);
        if (request.method === "GET" && url.pathname === "/api/review/tickets") return handleReviewTicketList(url, request, env);
        if (request.method === "POST" && url.pathname === "/api/ledgers/import") return handleLedgerImport(request, env);
        if (request.method === "POST" && url.pathname === "/api/exports/ledger") return handleLedgerExport(request, env);
        if (request.method === "GET" && url.pathname === "/api/privacy/audit") return handlePrivacyAudit(url, request, env);
        return notFound(url.pathname);
      } catch (error) {
        const exposeDetail = !requiresAuthSecret(env) && !isCloudRuntime(env);
        return json(
          {
            runtime: RUNTIME,
            error: "internal_error",
            message: exposeDetail && error instanceof Error ? error.message : "internal server error",
          },
          { status: 500 },
        );
      }
    })();
    return withCors(response, request, env);
  },
};
