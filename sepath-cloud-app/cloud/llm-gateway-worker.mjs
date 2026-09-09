import { verifyEdgeApiToken } from "./edge-api-auth.mjs";
import { getEdgeStore } from "./edge-api-store.mjs";

const RUNTIME = "sepath-inference-gateway.v1";
const ROUTE = "/api/ai/generate-scaffold";

const protectedFieldNames = [
  "accessToken",
  "apiKey",
  "artifactUrl",
  "email",
  "mobile",
  "password",
  "phone",
  "privateEmail",
  "rawDiff",
  "rawLog",
  "runnerSecret",
  "secret",
  "studentName",
  "studentRealName",
];

function envText(env, key) {
  return String(env?.[key] || "").trim();
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
  headers.set("access-control-allow-methods", "POST, OPTIONS");
  headers.set("access-control-allow-headers", "content-type, authorization");
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

function unauthorized(message, details = {}) {
  return json({ runtime: RUNTIME, error: "unauthorized", message, ...details }, { status: 401 });
}

function forbidden(message, details = {}) {
  return json({ runtime: RUNTIME, error: "forbidden", message, ...details }, { status: 403 });
}

function privacyBlocked(message, findings = []) {
  return json({ runtime: RUNTIME, error: "privacy_blocked", message, findings }, { status: 422 });
}

function modelUnavailable(message, details = {}) {
  return json({ runtime: RUNTIME, error: "model_unavailable", message, ...details }, { status: 503 });
}

function hasSecret(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return false;
  return !["replace", "example", "placeholder", "your-", "<", ">"].some((marker) => text.includes(marker));
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

function isLikelyPseudonymous(value) {
  if (typeof value !== "string" || value.trim().length === 0) return false;
  if (value.includes("@")) return false;
  if (/[\u4e00-\u9fa5]/.test(value)) return false;
  return /hash|anon|stu_|learner_|reviewer_|[a-f0-9]{8}/i.test(value);
}

function sanitizePayload(raw) {
  return {
    tenantId: raw.tenantId,
    courseId: raw.courseId,
    learnerHash: raw.learnerHash,
    workOrderId: raw.workOrderId,
    taskId: raw.taskId,
    traceId: raw.traceId,
    intent: raw.intent,
    promptVersion: raw.promptVersion,
    evidenceEventIds: Array.isArray(raw.evidenceEventIds) ? raw.evidenceEventIds.slice(0, 12) : [],
    knowledgeSourceIds: Array.isArray(raw.knowledgeSourceIds) ? raw.knowledgeSourceIds.slice(0, 8) : [],
    guardrails: Array.isArray(raw.guardrails) ? raw.guardrails.slice(0, 12) : [],
    noKeyFallback: raw.noKeyFallback !== false,
    requestedOutputSchema: raw.requestedOutputSchema && typeof raw.requestedOutputSchema === "object"
      ? raw.requestedOutputSchema
      : {},
  };
}

function fallbackResponse(payload, reason, actor = {}) {
  return {
    runtime: RUNTIME,
    contractVersion: "sepath-scaffold-response.v1",
    authMode: actor.authMode ?? "unknown",
    mode: "deterministic-fallback",
    fallback: true,
    reason,
    traceId: payload.traceId ?? "trace-fallback",
    refusal:
      "我不能直接给可复制提交的完整代码，但可以根据证据链帮你定位失败路径、设计最小修复实验，并告诉你需要提交哪些证据。",
    checklist: [
      "先复现 CI 失败，并只记录第一个 failing assertion。",
      "对照 Rubric 判断失败属于测试边界、实现缺口还是需求误读。",
      "只修改最小实现或测试前置条件，避免一次性重写 service 层。",
      "提交 PR 时附上失败日志、修复 diff、通过截图和反思说明。",
    ],
    miniLab: [
      "Given-When-Then 写出边界用例。",
      "本地运行同一条测试命令，截图保存 traceId。",
      "让同伴或教师复核解释是否符合课程智能体使用边界。",
    ],
    evidenceToSubmit: payload.evidenceEventIds ?? [],
    citations: payload.knowledgeSourceIds ?? [],
    teacherReviewRequired: true,
    guardrailHits: ["no-direct-answer", "privacy-minimization", "schema-contract"],
  };
}

function buildMessages(payload) {
  return [
    {
      role: "system",
      content:
        "You are SE-Path, a governed software-engineering learning companion. Refuse direct submissible code, ground every answer in evidence ids and knowledge source ids, and return JSON only.",
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          task: "Generate scaffolded CI recovery help.",
          payload,
          requiredPolicy: [
            "Do not produce complete code that can be submitted directly.",
            "Include refusal, checklist, miniLab, evidenceToSubmit, citations and teacherReviewRequired.",
            "If evidence is insufficient, ask for more evidence or route to teacher review.",
          ],
        },
        null,
        2,
      ),
    },
  ];
}

function normalizeModelResponse(modelResponse, payload, actor) {
  const content = modelResponse?.choices?.[0]?.message?.content;
  let parsed = {};
  if (typeof content === "string") {
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { refusal: content };
    }
  }
  const fallback = fallbackResponse(payload, "schema-fill");
  const checklist = Array.isArray(parsed.checklist) && parsed.checklist.length > 0
    ? parsed.checklist.slice(0, 8)
    : fallback.checklist;
  const miniLab = Array.isArray(parsed.miniLab) && parsed.miniLab.length > 0
    ? parsed.miniLab.slice(0, 6)
    : fallback.miniLab;
  return {
    runtime: RUNTIME,
    contractVersion: "sepath-scaffold-response.v1",
    authMode: actor.authMode,
    mode: "governed-llm",
    fallback: false,
    traceId: payload.traceId,
    provider: "openai-compatible",
    refusal: String(parsed.refusal || "我会基于证据给出脚手架建议，而不是替你完成可提交代码。"),
    checklist,
    miniLab,
    evidenceToSubmit: Array.isArray(parsed.evidenceToSubmit) ? parsed.evidenceToSubmit : payload.evidenceEventIds ?? [],
    citations: Array.isArray(parsed.citations) ? parsed.citations : payload.knowledgeSourceIds ?? [],
    teacherReviewRequired: true,
    guardrailHits: ["no-direct-answer", "privacy-minimization", "schema-contract"],
  };
}

function hashText(input) {
  let hash = 2166136261;
  for (const char of String(input || "")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

async function recordAgentCall(env, payload = {}, actor = {}, outcome = {}, status = "ok") {
  const store = getEdgeStore(env);
  if (!store?.putAgentCall || !payload.tenantId || !payload.courseId) return;
  const createdAt = new Date().toISOString();
  const traceId = String(payload.traceId || `trace-agent-${hashText(createdAt)}`);
  const mode = String(outcome.mode || outcome.error || status);
  const callId = `agent_${hashText([payload.tenantId, payload.courseId, payload.learnerHash, traceId, mode].join(":"))}`;
  await store.putAgentCall({
    runtime: RUNTIME,
    callId,
    tenantId: payload.tenantId,
    courseId: payload.courseId,
    learnerHash: payload.learnerHash || "",
    workOrderId: payload.workOrderId || payload.taskId || "",
    traceId,
    idempotencyKey: `${traceId}:${mode}`,
    actorRole: actor.role || "unknown",
    authMode: actor.authMode || "unknown",
    source: "llm-gateway",
    action: "agent.generate_scaffold",
    intent: payload.intent || "generate_scaffold",
    promptVersion: payload.promptVersion || "",
    evidenceEventIds: Array.isArray(payload.evidenceEventIds) ? payload.evidenceEventIds : [],
    knowledgeSourceIds: Array.isArray(payload.knowledgeSourceIds) ? payload.knowledgeSourceIds : [],
    outputType: outcome.contractVersion || "sepath-scaffold-response.v1",
    guardrailHits: Array.isArray(outcome.guardrailHits) ? outcome.guardrailHits : [],
    fallback: Boolean(outcome.fallback),
    fallbackReason: outcome.reason || "",
    teacherReviewRequired: Boolean(outcome.teacherReviewRequired ?? true),
    adoptedByTeacher: false,
    status,
    result: mode,
    provider: outcome.provider || (outcome.fallback ? "deterministic" : "openai-compatible"),
    createdAt,
    updatedAt: createdAt,
  });
}

async function respondWithAgentCall(env, payload, actor, outcome, init = {}, status = "ok") {
  await recordAgentCall(env, payload, actor, outcome, status);
  return json(outcome, init);
}

async function callOpenAiCompatible(env, payload) {
  const baseUrl = (env.LLM_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.LLM_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: env.LLM_MODEL,
      messages: buildMessages(payload),
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
  });
  if (!response.ok) {
    throw new Error(`model gateway returned ${response.status}`);
  }
  return response.json();
}

async function actorContext(request, env) {
  if (!env?.SEPATH_AUTH_SECRET) {
    if (requiresAuthSecret(env)) return { error: "missing_auth_secret" };
    return { role: "reviewer", learnerHash: "", reviewMode: "sandbox", authMode: "local-header" };
  }
  const verified = await verifyEdgeApiToken(request.headers.get("authorization") || "", env.SEPATH_AUTH_SECRET);
  if (!verified.ok) return { error: verified.error };
  return {
    role: String(verified.claims.role || "reviewer").toLowerCase().trim(),
    learnerHash: String(verified.claims.learnerHash || ""),
    reviewMode: String(verified.claims.reviewMode || ""),
    tenantId: String(verified.claims.tenantId || ""),
    courseId: String(verified.claims.courseId || ""),
    workOrderId: String(verified.claims.workOrderId || ""),
    tokenScope: String(verified.claims.tokenScope || ""),
    authMode: "hmac-token",
  };
}

function canGenerateScaffold(actor, payload) {
  if (actor.tenantId && actor.tenantId !== payload.tenantId) return false;
  if (actor.courseId && actor.courseId !== payload.courseId) return false;
  if (actor.workOrderId && actor.workOrderId !== payload.workOrderId) return false;
  if (["system", "course_admin", "teacher"].includes(actor.role)) return true;
  if (actor.role === "reviewer" && actor.reviewMode === "sandbox") return true;
  return actor.role === "student" && actor.learnerHash && actor.learnerHash === payload.learnerHash;
}

export async function handleLlmGatewayRequest(request, env = {}) {
  if (request.method === "OPTIONS") {
    return json({ runtime: RUNTIME, ok: true });
  }
  const url = new URL(request.url);
  if (request.method !== "POST" || url.pathname !== ROUTE) {
    return json({ runtime: RUNTIME, error: "not_found", pathname: url.pathname }, { status: 404 });
  }

  const actor = await actorContext(request, env);
  if (actor.error) {
    return unauthorized("valid SE-Path access token is required", { reason: actor.error, authMode: "hmac-token" });
  }

  let raw;
  try {
    raw = await request.json();
  } catch {
    return json(fallbackResponse({}, "invalid-json", actor), { status: 400 });
  }

  const protectedFindings = scanProtectedFields(raw);
  if (protectedFindings.length > 0) {
    return privacyBlocked("protected fields are not allowed in the inference payload", protectedFindings);
  }
  const payload = sanitizePayload(raw);
  if (!payload.tenantId || !payload.courseId || !payload.learnerHash) {
    return json({ runtime: RUNTIME, error: "bad_request", message: "tenantId, courseId and learnerHash are required" }, { status: 400 });
  }
  if (!isLikelyPseudonymous(payload.learnerHash)) {
    return privacyBlocked("learnerHash must be pseudonymous", ["learnerHash"]);
  }
  if (!canGenerateScaffold(actor, payload)) {
    return forbidden("actor cannot generate scaffold for this learner", { role: actor.role });
  }
  if (env.SEPATH_PRIVACY_MODE && env.SEPATH_PRIVACY_MODE !== "pseudonymous") {
    const outcome = fallbackResponse(payload, "privacy-mode-not-pseudonymous", actor);
    return respondWithAgentCall(env, payload, actor, outcome, {}, "fallback");
  }
  if (!hasSecret(env.LLM_API_KEY) || !hasSecret(env.LLM_MODEL)) {
    if (payload.noKeyFallback) {
      const outcome = fallbackResponse(payload, "missing-secret-or-model", actor);
      return respondWithAgentCall(env, payload, actor, outcome, {}, "fallback");
    }
    const outcome = {
      runtime: RUNTIME,
      error: "model_unavailable",
      message: "LLM credentials are not configured and noKeyFallback=false",
      traceId: payload.traceId,
      fallbackAvailable: true,
      mode: "model-unavailable",
      fallback: false,
      teacherReviewRequired: true,
      guardrailHits: ["model-unavailable"],
    };
    return respondWithAgentCall(env, payload, actor, outcome, { status: 503 }, "model_unavailable");
  }

  try {
    const modelResponse = await callOpenAiCompatible(env, payload);
    const outcome = normalizeModelResponse(modelResponse, payload, actor);
    return respondWithAgentCall(env, payload, actor, outcome, {}, "ok");
  } catch (error) {
    const reason = error instanceof Error ? error.message : "model-error";
    const outcome = fallbackResponse(payload, reason, actor);
    return respondWithAgentCall(env, payload, actor, outcome, {}, "fallback");
  }
}

export default {
  async fetch(request, env = {}) {
    const response = await handleLlmGatewayRequest(request, env);
    return withCors(response, request, env);
  },
};
