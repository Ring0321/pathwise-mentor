import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createEdgeApiToken } from "../cloud/edge-api-auth.mjs";
import { createMemoryEdgeStore } from "../cloud/edge-api-store.mjs";
import worker from "../cloud/llm-gateway-worker.mjs";

const authSecret = process.env.SEPATH_AUTH_SECRET || "sepath-llm-smoke-secret";
const httpBase = process.env.SEPATH_LLM_GATEWAY_BASE_URL || "";
const privacyHttpBase = process.env.SEPATH_LLM_GATEWAY_PRIVACY_BASE_URL || "";
const base = httpBase || "https://sepath-llm-gateway-smoke.local";
const reportPath = resolve(process.env.SEPATH_LLM_GATEWAY_REPORT || "qa/llm-gateway-smoke-report.json");
const transport = httpBase ? "http" : "worker";

const env = {
  SEPATH_AUTH_SECRET: authSecret,
  SEPATH_PRIVACY_MODE: "pseudonymous",
  SEPATH_STORE: createMemoryEdgeStore(),
};

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function tokenHeaders(claims) {
  return { authorization: `Bearer ${await createEdgeApiToken(claims, authSecret)}` };
}

async function call(path, init = {}, callEnv = env, overrideBase = "") {
  const targetBase = overrideBase || base;
  const requestInit = {
    method: init.method || "POST",
    headers: {
      "content-type": "application/json",
      ...(init.headers || {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  };
  if (httpBase || overrideBase) {
    const response = await fetch(`${targetBase}${path}`, requestInit);
    const data = await response.json();
    return { status: response.status, data };
  }
  const request = new Request(`${base}${path}`, {
    ...requestInit,
  });
  const response = await worker.fetch(request, callEnv);
  const data = await response.json();
  return { status: response.status, data };
}

const teacherHeaders = await tokenHeaders({ role: "teacher" });
const studentHeaders = await tokenHeaders({ role: "student", learnerHash: "stu_hash_8f2a" });
const otherStudentHeaders = await tokenHeaders({ role: "student", learnerHash: "stu_hash_other" });
const reviewerHeaders = await tokenHeaders({ role: "reviewer", reviewMode: "sandbox" });
const badTokenHeaders = { authorization: "Bearer sepath.invalid.bad-signature" };

const basePayload = {
  tenantId: "tenant-se-course-2026",
  courseId: "software-engineering-project",
  learnerHash: "stu_hash_8f2a",
  taskId: "task-ci-boundary",
  traceId: "trace-llm-smoke-001",
  intent: "scaffolded_ci_recovery_help",
  promptVersion: "sepath-scaffold-v1",
  evidenceEventIds: ["evt-ci-failed", "evt-student-question"],
  knowledgeSourceIds: ["ks-rubric-testing", "ks-ai-boundary"],
  guardrails: ["direct-answer-gate", "privacy-minimization", "teacher-release"],
  requestedOutputSchema: {
    refusal: "string",
    checklist: "string[]",
    miniLab: "string[]",
    evidenceToSubmit: "string[]",
    citations: "string[]",
    teacherReviewRequired: "boolean",
  },
};

const rows = [];

async function check(label, path, init, validate, callEnv = env, overrideBase = "") {
  const result = await call(path, init, callEnv, overrideBase);
  validate(result);
  rows.push({
    label,
    status: "PASS",
    httpStatus: result.status,
    evidence: result.data.runtime || result.data.error || "ok",
    mode: result.data.mode || "",
    reason: result.data.reason || result.data.reasonCode || "",
  });
  return result.data;
}

await check(
  "missing token blocked",
  "/api/ai/generate-scaffold",
  { body: basePayload },
  ({ status, data }) => {
    assert(status === 401, "missing token should be unauthorized");
    assert(data.error === "unauthorized", "unauthorized error expected");
    assert(data.reason === "missing_token", "missing token reason expected");
  },
);

await check(
  "bad signature blocked",
  "/api/ai/generate-scaffold",
  { headers: badTokenHeaders, body: basePayload },
  ({ status, data }) => {
    assert(status === 401, "bad signature should be unauthorized");
    assert(data.error === "unauthorized", "unauthorized error expected");
    assert(data.reason === "bad_signature" || data.reason === "bad_token_format", "bad token reason expected");
  },
);

const fallback = await check(
  "teacher no-key fallback",
  "/api/ai/generate-scaffold",
  { headers: teacherHeaders, body: basePayload },
  ({ status, data }) => {
    assert(status === 200, "teacher fallback should return 200");
    assert(data.runtime === "sepath-inference-gateway.v1", "runtime mismatch");
    assert(data.contractVersion === "sepath-scaffold-response.v1", "contract version missing");
    assert(data.mode === "deterministic-fallback", "fallback mode expected");
    assert(data.fallback === true, "fallback flag expected");
    assert(data.reason === "missing-secret-or-model", "missing secret reason expected");
    assert(data.checklist.length >= 4, "checklist should be complete");
    assert(data.citations.includes("ks-rubric-testing"), "citations should echo knowledge ids");
    assert(data.teacherReviewRequired === true, "teacher review should be required");
    assert(data.guardrailHits.includes("schema-contract"), "schema guardrail expected");
  },
);

if (!httpBase) {
  const agentCalls = await env.SEPATH_STORE.listAgentCalls({
    tenantId: basePayload.tenantId,
    courseId: basePayload.courseId,
    learnerHash: basePayload.learnerHash,
  });
  assert(agentCalls.length === 1, "teacher fallback should write one agent_call record");
  assert(agentCalls[0].traceId === basePayload.traceId, "agent_call should keep traceId");
  assert(agentCalls[0].fallback === true, "agent_call should record fallback mode");
  assert(agentCalls[0].guardrailHits.includes("schema-contract"), "agent_call should record guardrails");
}

await check(
  "student own learner allowed",
  "/api/ai/generate-scaffold",
  { headers: studentHeaders, body: { ...basePayload, traceId: "trace-student-own" } },
  ({ status, data }) => {
    assert(status === 200, "student own learner should be allowed");
    assert(data.authMode === "hmac-token", "auth mode should be hmac-token");
  },
);

await check(
  "student other learner blocked",
  "/api/ai/generate-scaffold",
  { headers: otherStudentHeaders, body: { ...basePayload, traceId: "trace-student-other" } },
  ({ status, data }) => {
    assert(status === 403, "student other learner should be forbidden");
    assert(data.error === "forbidden", "forbidden error expected");
  },
);

await check(
  "reviewer sandbox allowed",
  "/api/ai/generate-scaffold",
  { headers: reviewerHeaders, body: { ...basePayload, traceId: "trace-reviewer-sandbox" } },
  ({ status, data }) => {
    assert(status === 200, "reviewer sandbox should be allowed");
    assert(data.mode === "deterministic-fallback", "reviewer should receive fallback without key");
  },
);

await check(
  "privacy protected-field block",
  "/api/ai/generate-scaffold",
  { headers: teacherHeaders, body: { ...basePayload, payload: { rawLog: "secret runner log" } } },
  ({ status, data }) => {
    assert(status === 422, "protected field should be blocked");
    assert(data.error === "privacy_blocked", "privacy error expected");
    assert(data.findings.includes("payload.rawLog"), "rawLog finding expected");
  },
);

await check(
  "plain learner blocked",
  "/api/ai/generate-scaffold",
  { headers: teacherHeaders, body: { ...basePayload, learnerHash: "张三" } },
  ({ status, data }) => {
    assert(status === 422, "plain learner should be privacy blocked");
    assert(data.findings.includes("learnerHash"), "learnerHash finding expected");
  },
);

await check(
  "fallback disabled returns 503",
  "/api/ai/generate-scaffold",
  { headers: teacherHeaders, body: { ...basePayload, noKeyFallback: false } },
  ({ status, data }) => {
    assert(status === 503, "fallback disabled should return model unavailable");
    assert(data.error === "model_unavailable", "model unavailable error expected");
    assert(data.fallbackAvailable === true, "fallback availability should be explicit");
  },
);

await check(
  "privacy mode fallback",
  "/api/ai/generate-scaffold",
  { headers: teacherHeaders, body: { ...basePayload, traceId: "trace-privacy-mode" } },
  ({ status, data }) => {
    assert(status === 200, "privacy mode should degrade to fallback");
    assert(data.reason === "privacy-mode-not-pseudonymous", "privacy mode reason expected");
  },
  { ...env, SEPATH_PRIVACY_MODE: "raw" },
  privacyHttpBase,
);

await writeFile(
  reportPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      runtime: "sepath-inference-gateway.v1",
      summary: {
        pass: rows.length,
        fail: 0,
        scenariosCovered: rows.length,
        transport,
        fallbackReason: fallback.reason,
      },
      rows,
    },
    null,
    2,
  ),
  "utf-8",
);

console.log(JSON.stringify({ pass: rows.length, fail: 0, report: reportPath }, null, 2));
