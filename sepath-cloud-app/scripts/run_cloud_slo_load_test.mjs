import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { createEdgeApiToken } from "../cloud/edge-api-auth.mjs";
import { createMemoryEdgeStore } from "../cloud/edge-api-store.mjs";
import edgeWorker from "../cloud/edge-api-worker.mjs";
import llmWorker from "../cloud/llm-gateway-worker.mjs";

const reportPath = resolve(process.env.SEPATH_CLOUD_SLO_REPORT || "qa/cloud-slo-load-report.json");
const authSecret = process.env.SEPATH_AUTH_SECRET || "sepath-slo-secret";
const edgeBase = "https://sepath-edge-slo.local";
const llmBase = "https://sepath-llm-slo.local";
const edgeEnv = {
  SEPATH_PRIVACY_MODE: "pseudonymous",
  SEPATH_AUTH_SECRET: authSecret,
  SEPATH_STORE: createMemoryEdgeStore(),
};
const llmEnv = {
  SEPATH_PRIVACY_MODE: "pseudonymous",
  SEPATH_AUTH_SECRET: authSecret,
};

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
}

function roundMs(value) {
  return Math.round(value * 10) / 10;
}

async function tokenHeaders(claims) {
  return { authorization: `Bearer ${await createEdgeApiToken(claims, authSecret)}` };
}

async function callWorker(worker, base, env, path, init = {}) {
  const request = new Request(`${base}${path}`, {
    method: init.method || "GET",
    headers: {
      "content-type": "application/json",
      ...(init.headers || {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const response = await worker.fetch(request, env);
  const data = await response.json();
  return { status: response.status, data };
}

const teacherHeaders = await tokenHeaders({ role: "teacher" });
const reviewerHeaders = await tokenHeaders({ role: "reviewer", reviewMode: "sandbox" });

const evidenceBase = {
  tenantId: "tenant-se-course-2026",
  courseId: "software-engineering-project",
  learnerHash: "stu_hash_8f2a",
  source: "ci",
  eventType: "ci_failed",
  payload: {
    title: "CI failed under SLO load",
    competencies: ["testing", "implementation"],
    risk: "medium",
  },
};

const llmBasePayload = {
  tenantId: "tenant-se-course-2026",
  courseId: "software-engineering-project",
  learnerHash: "stu_hash_8f2a",
  taskId: "task-ci-boundary",
  traceId: "trace-slo-llm",
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

async function runScenario(config) {
  let cursor = 0;
  const durations = [];
  const failures = [];
  async function loop() {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= config.requestCount) break;
      const started = performance.now();
      try {
        const result = await config.call(index);
        config.validate(result, index);
      } catch (error) {
        failures.push({ index, message: error.message });
      } finally {
        durations.push(performance.now() - started);
      }
    }
  }
  await Promise.all(Array.from({ length: config.concurrency }, () => loop()));
  const p50Ms = roundMs(percentile(durations, 50));
  const p95Ms = roundMs(percentile(durations, 95));
  const maxMs = roundMs(Math.max(...durations));
  const errorRate = roundMs((failures.length / config.requestCount) * 100);
  const passed = failures.length === 0 && p95Ms <= config.thresholdMs && errorRate <= config.maxErrorRate;
  return {
    id: config.id,
    label: config.label,
    status: passed ? "PASS" : "FAIL",
    requestCount: config.requestCount,
    concurrency: config.concurrency,
    p50Ms,
    p95Ms,
    maxMs,
    thresholdMs: config.thresholdMs,
    errorRate,
    maxErrorRate: config.maxErrorRate,
    expected: config.expected,
    evidence: config.evidence,
    failures,
  };
}

const scenarios = [
  {
    id: "edge-health-burst",
    label: "Edge health burst",
    requestCount: 40,
    concurrency: 8,
    thresholdMs: 750,
    maxErrorRate: 1,
    expected: "HTTP 200 and sepath-edge-api.v1",
    evidence: "health route remains available without credentials",
    call: () => callWorker(edgeWorker, edgeBase, edgeEnv, "/api/health"),
    validate: ({ status, data }) => {
      assert(status === 200, "health should return 200");
      assert(data.runtime === "sepath-edge-api.v1", "runtime mismatch");
    },
  },
  {
    id: "evidence-write-burst",
    label: "Evidence write burst",
    requestCount: 32,
    concurrency: 8,
    thresholdMs: 900,
    maxErrorRate: 1,
    expected: "HTTP 200, HMAC token, privacy pass, idempotent event id",
    evidence: "teacher write path with in-memory synthetic store",
    call: (index) =>
      callWorker(edgeWorker, edgeBase, edgeEnv, "/api/evidence/events", {
        method: "POST",
        headers: teacherHeaders,
        body: {
          ...evidenceBase,
          externalId: `slo-ci-${index}`,
          idempotencyKey: `slo-ci-${index}:ci_failed`,
        },
      }),
    validate: ({ status, data }) => {
      assert(status === 200, "evidence write should return 200");
      assert(data.eventId?.startsWith("evt_"), "event id missing");
      assert(data.qualityGate === "pass", "quality gate mismatch");
      assert(data.stored === true, "event should use memory store");
    },
  },
  {
    id: "diagnosis-read-mix",
    label: "Diagnosis read mix",
    requestCount: 24,
    concurrency: 6,
    thresholdMs: 900,
    maxErrorRate: 1,
    expected: "HTTP 200 diagnosis for teacher/reviewer sandbox",
    evidence: "read path stays stable under mixed review traffic",
    call: (index) =>
      callWorker(
        edgeWorker,
        edgeBase,
        edgeEnv,
        "/api/learners/stu_hash_8f2a/diagnosis?tenantId=tenant-se-course-2026&courseId=software-engineering-project",
        { headers: index % 2 === 0 ? teacherHeaders : reviewerHeaders },
      ),
    validate: ({ status, data }) => {
      assert(status === 200, "diagnosis read should return 200");
      assert(data.blocker, "diagnosis blocker missing");
    },
  },
  {
    id: "intervention-rank-burst",
    label: "Intervention rank burst",
    requestCount: 16,
    concurrency: 4,
    thresholdMs: 1000,
    maxErrorRate: 1,
    expected: "HTTP 200, SafeVOI ranks safe action and blocks direct answer",
    evidence: "core decision loop remains deterministic under burst calls",
    call: (index) =>
      callWorker(edgeWorker, edgeBase, edgeEnv, "/api/interventions/rank", {
        method: "POST",
        headers: teacherHeaders,
        body: {
          tenantId: "tenant-se-course-2026",
          courseId: "software-engineering-project",
          learnerHash: "stu_hash_8f2a",
          diagnosisId: `diag-slo-${index}`,
          strategyVersion: "safevoi-v1",
          candidateActions: [
            {
              id: "mini-lab",
              label: "20 minute boundary mini lab",
              expectedGrowth: 8,
              informationGain: 7,
              transferability: 7,
              windowRescue: 6,
              burden: 3,
              risk: 2,
              reversible: true,
              consentValid: true,
              rulesValid: true,
            },
            {
              id: "direct-code",
              label: "write complete service implementation",
              expectedGrowth: 9,
              informationGain: 2,
              transferability: 2,
              windowRescue: 7,
              burden: 1,
              risk: 9,
              directAnswer: true,
              reversible: false,
              consentValid: true,
              rulesValid: false,
            },
          ],
        },
      }),
    validate: ({ status, data }) => {
      assert(status === 200, "rank should return 200");
      assert(data.rankedActions[0].id === "mini-lab", "safe action should rank first");
      assert(data.blockedActions[0].blockedReason === "DIRECT_ANSWER_POLICY_GATE", "direct answer block missing");
    },
  },
  {
    id: "llm-fallback-budget",
    label: "LLM fallback budget",
    requestCount: 12,
    concurrency: 4,
    thresholdMs: 1400,
    maxErrorRate: 1,
    expected: "HTTP 200 deterministic fallback and schema contract",
    evidence: "model-key-missing path remains usable for offline operation and audit",
    call: (index) =>
      callWorker(llmWorker, llmBase, llmEnv, "/api/ai/generate-scaffold", {
        method: "POST",
        headers: teacherHeaders,
        body: { ...llmBasePayload, traceId: `trace-slo-llm-${index}` },
      }),
    validate: ({ status, data }) => {
      assert(status === 200, "LLM fallback should return 200");
      assert(data.runtime === "sepath-inference-gateway.v1", "LLM runtime mismatch");
      assert(data.mode === "deterministic-fallback", "fallback mode expected");
      assert(data.contractVersion === "sepath-scaffold-response.v1", "schema contract missing");
    },
  },
  {
    id: "privacy-block-under-load",
    label: "Privacy block under load",
    requestCount: 8,
    concurrency: 4,
    thresholdMs: 900,
    maxErrorRate: 1,
    expected: "HTTP 422 is the correct privacy protection outcome",
    evidence: "unsafe rawLog payload is rejected without degrading the service",
    call: (index) =>
      callWorker(edgeWorker, edgeBase, edgeEnv, "/api/evidence/events", {
        method: "POST",
        headers: teacherHeaders,
        body: {
          ...evidenceBase,
          externalId: `slo-rawlog-${index}`,
          payload: { rawLog: "should be blocked" },
        },
      }),
    validate: ({ status, data }) => {
      assert(status === 422, "protected field should be blocked");
      assert(data.error === "privacy_blocked", "privacy error expected");
      assert(data.findings.includes("payload.rawLog"), "rawLog finding expected");
    },
  },
];

const rows = [];
for (const scenario of scenarios) {
  rows.push(await runScenario(scenario));
}

const failed = rows.filter((row) => row.status !== "PASS");
const totalRequests = rows.reduce((sum, row) => sum + row.requestCount, 0);
const report = {
  generatedAt: new Date().toISOString(),
  runtime: "sepath-cloud-slo.v1",
  scope: "synthetic local Worker load; not a claim of real school production traffic",
  summary: {
    PASS: rows.length - failed.length,
    FAIL: failed.length,
    rows: rows.length,
    totalRequests,
    maxP95Ms: Math.max(...rows.map((row) => row.p95Ms)),
    maxErrorRate: Math.max(...rows.map((row) => row.errorRate)),
  },
  slo: {
    p95TargetMs: 1400,
    errorRateTargetPct: 1,
    availabilityFallbacks: ["public-static-package", "pwa-offline", "local-vite-workbench", "deterministic-llm-fallback"],
    costGuardrails: ["short scaffold prompts", "teacher-review gate for high-risk actions", "tenant-scoped storage"],
  },
  rows,
};

await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, JSON.stringify(report, null, 2), "utf-8");
console.log(
  JSON.stringify(
    {
      summary: report.summary,
      report: reportPath,
    },
    null,
    2,
  ),
);

if (failed.length > 0) {
  process.exitCode = 1;
}
