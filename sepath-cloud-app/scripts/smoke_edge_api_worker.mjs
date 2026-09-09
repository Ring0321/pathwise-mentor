import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHmac } from "node:crypto";
import { createEdgeApiToken } from "../cloud/edge-api-auth.mjs";
import { createMemoryEdgeStore } from "../cloud/edge-api-store.mjs";
import worker from "../cloud/edge-api-worker.mjs";

const authSecret = process.env.SEPATH_AUTH_SECRET || "sepath-smoke-secret";
const tokenIssuerSecret = process.env.SEPATH_TOKEN_ISSUER_SECRET || "sepath-token-issuer-smoke-secret";
const githubWebhookSecret = process.env.SEPATH_GITHUB_WEBHOOK_SECRET || "sepath-github-smoke-secret";
const githubWebhookToken = process.env.SEPATH_GITHUB_WEBHOOK_TOKEN || "sepath-legacy-webhook-smoke-token";
const storeKind = process.env.SEPATH_TEST_STORE || "memory";

function createMemoryD1Database() {
  const records = new Map();
  return {
    prepare(sql) {
      return {
        params: [],
        bind(...params) {
          this.params = params;
          return this;
        },
        async run() {
          if (/insert into sepath_edge_records/i.test(sql)) {
            const [
              record_key,
              record_type,
              tenant_id,
              course_id,
              learner_hash,
              resource_id,
              idempotency_key,
              status,
              actor_role,
              source,
              expires_at,
              record_json,
              created_at,
              updated_at,
            ] = this.params;
            const existing = records.get(record_key);
            records.set(record_key, {
              record_key,
              record_type,
              tenant_id,
              course_id,
              learner_hash,
              resource_id,
              idempotency_key,
              status,
              actor_role,
              source,
              expires_at,
              record_json,
              created_at: existing?.created_at || created_at,
              updated_at,
            });
          }
          return { success: true };
        },
        async first() {
          const result = await this.all();
          return result.results[0] || null;
        },
        async all() {
          if (/where record_key = \?/i.test(sql)) {
            const row = records.get(this.params[0]);
            return { results: row ? [row] : [] };
          }
          if (/where\s+record_type = \?/i.test(sql)) {
            let cursor = 0;
            const recordType = this.params[cursor++];
            const wantsTenant = /tenant_id = \?/i.test(sql);
            const wantsCourse = /course_id = \?/i.test(sql);
            const wantsLearner = /learner_hash = \?/i.test(sql);
            const wantsResource = /resource_id = \?/i.test(sql);
            const wantsStatus = /status = \?/i.test(sql);
            const wantsActorRole = /actor_role = \?/i.test(sql);
            const wantsSource = /source = \?/i.test(sql);
            const tenantId = wantsTenant ? this.params[cursor++] : "";
            const courseId = wantsCourse ? this.params[cursor++] : "";
            const learnerHash = wantsLearner ? this.params[cursor++] : "";
            const resourceId = wantsResource ? this.params[cursor++] : "";
            const status = wantsStatus ? this.params[cursor++] : "";
            const actorRole = wantsActorRole ? this.params[cursor++] : "";
            const source = wantsSource ? this.params[cursor++] : "";
            const limit = Number(this.params[cursor++] || 100);
            const rows = Array.from(records.values())
              .filter((row) => row.record_type === recordType)
              .filter((row) => !wantsTenant || row.tenant_id === tenantId)
              .filter((row) => !wantsCourse || row.course_id === courseId)
              .filter((row) => !wantsLearner || row.learner_hash === learnerHash)
              .filter((row) => !wantsResource || row.resource_id === resourceId)
              .filter((row) => !wantsStatus || row.status === status)
              .filter((row) => !wantsActorRole || row.actor_role === actorRole)
              .filter((row) => !wantsSource || row.source === source)
              .sort((left, right) => String(right.updated_at || "").localeCompare(String(left.updated_at || "")))
              .slice(0, limit);
            return { results: rows };
          }
          return { results: [] };
        },
      };
    },
  };
}

const env = {
  SEPATH_PRIVACY_MODE: "pseudonymous",
  SEPATH_AUTH_SECRET: authSecret,
  SEPATH_TOKEN_ISSUER_SECRET: tokenIssuerSecret,
  SEPATH_GITHUB_WEBHOOK_SECRET: githubWebhookSecret,
  SEPATH_GITHUB_WEBHOOK_TOKEN: githubWebhookToken,
  ...(storeKind === "database" ? { SEPATH_DB: createMemoryD1Database() } : { SEPATH_STORE: createMemoryEdgeStore() }),
};
const httpBase = process.env.SEPATH_EDGE_API_BASE_URL || "";
const base = httpBase || "https://sepath-edge-smoke.local";
const mode = httpBase ? "http" : storeKind === "database" ? "worker-database" : "worker";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function call(path, init = {}) {
  const body =
    init.body === undefined
      ? undefined
      : typeof init.body === "string"
        ? init.body
        : JSON.stringify(init.body);
  const requestInit = {
    method: init.method || "GET",
    headers: {
      "content-type": "application/json",
      ...(init.headers || {}),
    },
    body,
  };
  if (httpBase) {
    const response = await fetch(`${base}${path}`, requestInit);
    const data = await response.json();
    return { status: response.status, data };
  }
  const request = new Request(`${base}${path}`, requestInit);
  const response = await worker.fetch(request, env);
  const data = await response.json();
  return { status: response.status, data };
}

const rows = [];
async function tokenHeaders(claims) {
  return { authorization: `Bearer ${await createEdgeApiToken(claims, authSecret)}` };
}

function githubSignatureHeaders(rawBody, deliveryId = "github-delivery-smoke", githubEvent = "workflow_run") {
  const signature = createHmac("sha256", githubWebhookSecret).update(rawBody).digest("hex");
  return {
    "x-github-delivery": deliveryId,
    "x-github-event": githubEvent,
    "x-hub-signature-256": `sha256=${signature}`,
  };
}

const teacherHeaders = await tokenHeaders({ role: "teacher" });
const systemHeaders = await tokenHeaders({ role: "system" });
const reviewerHeaders = await tokenHeaders({ role: "reviewer" });
const studentLinkHeaders = await tokenHeaders({ role: "student" });
const studentHeaders = await tokenHeaders({ role: "student", learnerHash: "stu_hash_8f2a" });
const badTokenHeaders = { authorization: "Bearer sepath.invalid.bad-signature" };

async function check(label, path, init, validate) {
  const result = await call(path, init);
  validate(result);
  rows.push({
    label,
    status: "PASS",
    httpStatus: result.status,
    evidence: result.data.runtime || result.data.error || "ok",
  });
  return result.data;
}

const evidencePayload = {
  tenantId: "tenant-se-course-2026",
  courseId: "software-engineering-project",
  learnerHash: "stu_hash_8f2a",
  source: "ci",
  eventType: "ci_failed",
  externalId: "run_241901",
  idempotencyKey: "run_241901:ci_failed",
  payload: {
    title: "CI failed: boundary tests",
    competencies: ["testing", "implementation"],
    risk: "medium",
  },
};

await check("health endpoint", "/api/health", {}, ({ status, data }) => {
  assert(status === 200, "health should return 200");
  assert(data.runtime === "sepath-edge-api.v1", "runtime mismatch");
  assert(data.storageMode === (storeKind === "database" ? "database-edge-store.d1" : "memory-edge-store.v1"), "health storage mode mismatch");
  assert(data.status === "ok", "local smoke health should be ready");
  assert(data.readiness?.status === "ready", "health readiness should be ready");
  assert(data.endpoints.includes("POST /api/auth/token"), "endpoint list missing auth token route");
  assert(data.endpoints.includes("GET /api/auth/session"), "endpoint list missing auth session route");
  assert(data.endpoints.includes("POST /api/ai/generate-scaffold"), "endpoint list missing AI scaffold route");
  assert(data.endpoints.includes("GET /api/course/settings"), "endpoint list missing course settings route");
  assert(data.endpoints.includes("POST /api/course/launch"), "endpoint list missing course launch route");
  assert(data.endpoints.includes("GET /api/course/roster"), "endpoint list missing course roster read route");
  assert(data.endpoints.includes("POST /api/course/roster"), "endpoint list missing course roster write route");
  assert(data.endpoints.includes("POST /api/evidence/events"), "endpoint list missing evidence route");
  assert(data.endpoints.includes("GET /api/workbench/teacher/today"), "endpoint list missing teacher workbench route");
    assert(data.endpoints.includes("POST /api/work-order-batches"), "endpoint list missing work order batch route");
    assert(data.endpoints.includes("POST /api/work-orders/{id}/intervention-package"), "endpoint list missing intervention package route");
    assert(data.endpoints.includes("POST /api/course/micro-task-package"), "endpoint list missing course micro-task package route");
    assert(data.endpoints.includes("POST /api/course/micro-task-reminder"), "endpoint list missing course micro-task reminder route");
    assert(data.endpoints.includes("POST /api/course/teaching-improvement-plan"), "endpoint list missing course teaching improvement plan route");
    assert(data.endpoints.includes("POST /api/course/teaching-improvement-execution"), "endpoint list missing course teaching improvement execution route");
    assert(data.endpoints.includes("POST /api/course/teaching-improvement-followup-sample"), "endpoint list missing course teaching improvement followup sample route");
    assert(data.endpoints.includes("POST /api/course/teaching-improvement-followup-result"), "endpoint list missing course teaching improvement followup result route");
    assert(data.endpoints.includes("POST /api/course/resource-revision"), "endpoint list missing course resource revision route");
    assert(data.endpoints.includes("POST /api/course/resource-release"), "endpoint list missing course resource release route");
    assert(data.endpoints.includes("POST /api/course/resource-usage"), "endpoint list missing course resource usage route");
    assert(data.endpoints.includes("POST /api/course/resource-usage-reminder"), "endpoint list missing course resource usage reminder route");
    assert(data.endpoints.includes("POST /api/work-orders/{id}/evidence-review"), "endpoint list missing teacher evidence review route");
    assert(data.endpoints.includes("POST /api/work-orders/{id}/closure"), "endpoint list missing teacher closure route");
    assert(data.endpoints.includes("POST /api/webhooks/github/ci"), "endpoint list missing GitHub webhook route");
    assert(data.endpoints.includes("POST /api/integrations/github/batch-import"), "endpoint list missing GitHub batch import route");
});

await check(
  "edge hosted AI scaffold fallback",
  "/api/ai/generate-scaffold",
  {
    method: "POST",
    headers: teacherHeaders,
    body: {
      tenantId: "tenant-se-course-2026",
      courseId: "software-engineering-project",
      learnerHash: "stu_hash_edge_llm",
      workOrderId: "wo-edge-llm",
      taskId: "wo-edge-llm",
      traceId: "trace-edge-llm",
      intent: "generate_safe_scaffold_package",
      promptVersion: "sepath-scaffold-v1",
      evidenceEventIds: ["ev-edge-llm"],
      knowledgeSourceIds: ["rubric-boundary"],
      guardrails: ["teacher-release", "no-direct-answer", "privacy-minimization"],
      noKeyFallback: true,
      requestedOutputSchema: {
        refusal: "string",
        checklist: "string[]",
        miniLab: "string[]",
        evidenceToSubmit: "string[]",
        citations: "string[]",
        teacherReviewRequired: "boolean",
      },
    },
  },
  ({ status, data }) => {
    assert(status === 200, "edge hosted AI scaffold should return 200");
    assert(data.runtime === "sepath-inference-gateway.v1", "AI scaffold runtime mismatch");
    assert(data.contractVersion === "sepath-scaffold-response.v1", "AI scaffold contract mismatch");
    assert(data.fallback === true, "smoke should use fallback without model secrets");
    assert(data.guardrailHits.includes("no-direct-answer"), "AI scaffold must keep no-direct-answer guardrail");
    assert(Array.isArray(data.checklist) && data.checklist.length > 0, "AI scaffold checklist missing");
    assert(data.teacherReviewRequired === true, "AI scaffold must require teacher review");
  },
);

const issuedTeacherToken = await check(
  "token issuer creates teacher token",
  "/api/auth/token",
  {
    method: "POST",
    headers: { "x-sepath-token-issuer-secret": tokenIssuerSecret },
    body: {
      tenantId: "tenant-se-course-2026",
      courseId: "software-engineering-project",
      role: "teacher",
      ttlSeconds: 600,
    },
  },
  ({ status, data }) => {
    assert(status === 200, "auth token issue should return 200");
    assert(data.tokenType === "Bearer", "auth token should use Bearer");
    assert(String(data.accessToken || "").startsWith("sepath."), "auth token should be compact signed token");
    assert(data.claims.role === "teacher", "issued token role should be teacher");
    assert(data.claims.tenantId === "tenant-se-course-2026", "issued token tenant scope should be preserved");
    assert(!data.returnToken, "teacher token should not include a student return token");
  },
);

await check(
  "issued teacher token session",
  "/api/auth/session?tenantId=tenant-se-course-2026&courseId=software-engineering-project",
  { headers: { authorization: `Bearer ${issuedTeacherToken.accessToken}` } },
  ({ status, data }) => {
    assert(status === 200, "issued token should read session");
    assert(data.actor.role === "teacher", "issued session should keep teacher role");
    assert(data.actor.authMode === "hmac-token", "issued session should use hmac-token auth");
  },
);

await check(
  "auth session read",
  "/api/auth/session?tenantId=tenant-se-course-2026&courseId=software-engineering-project",
  { headers: teacherHeaders },
  ({ status, data }) => {
    assert(status === 200, "auth session should return 200");
    assert(data.actor.role === "teacher", "session should keep teacher role");
    assert(data.storageMode === (storeKind === "database" ? "database-edge-store.d1" : "memory-edge-store.v1"), "session storage mode mismatch");
    assert(data.capabilities.includes("save-course-settings"), "teacher should be able to save course settings");
    assert(data.capabilities.includes("manage-course-roster"), "teacher should be able to manage course roster");
    assert(data.capabilities.includes("create-work-order-batch"), "teacher should be able to create work order batches");
    assert(data.capabilities.includes("publish-intervention-package"), "teacher should be able to publish intervention packages");
    assert(data.capabilities.includes("publish-course-micro-task"), "teacher should be able to publish course micro-task packages");
    assert(data.capabilities.includes("remind-course-micro-task"), "teacher should be able to remind course micro-task targets");
    assert(data.capabilities.includes("publish-course-teaching-improvement"), "teacher should be able to publish course teaching improvement plans");
    assert(data.capabilities.includes("record-course-teaching-improvement-execution"), "teacher should be able to record course teaching improvement execution receipts");
    assert(data.capabilities.includes("record-course-teaching-improvement-followup"), "teacher should be able to record course teaching improvement followup samples");
    assert(data.capabilities.includes("record-course-teaching-improvement-followup-result"), "teacher should be able to record course teaching improvement followup results");
    assert(data.capabilities.includes("record-course-resource-revision"), "teacher should be able to record course resource revision tickets");
    assert(data.capabilities.includes("record-course-resource-release"), "teacher should be able to record course resource release receipts");
    assert(data.capabilities.includes("record-course-resource-usage"), "teacher should be able to record course resource usage receipts");
    assert(data.capabilities.includes("remind-course-resource-usage"), "teacher should be able to remind course resource usage return targets");
    assert(data.capabilities.includes("review-student-evidence"), "teacher should be able to review student-return evidence");
    assert(data.capabilities.includes("close-work-order"), "teacher should be able to close returned work orders");
    assert(data.boundaries.some((item) => item.includes("最终结论由教师确认")), "session should expose teacher confirmation boundary");
  },
);

await check(
  "course settings read defaults",
  "/api/course/settings?tenantId=tenant-se-course-2026&courseId=software-engineering-project",
  { headers: teacherHeaders },
  ({ status, data }) => {
    assert(status === 200, "course settings read should return 200");
    assert(data.settings.repository === "se-course/rest-api-lab", "default repository should be present");
    assert(data.settings.webhookPath === "/api/webhooks/github/ci", "webhook path should be present");
  },
);

await check(
  "course settings write",
  "/api/course/settings",
  {
    method: "POST",
    headers: teacherHeaders,
    body: {
      tenantId: "tenant-se-course-2026",
      courseId: "software-engineering-project",
      courseClass: "软件工程 2301",
      courseName: "REST API 错误处理与边界测试",
      repository: "se-course/rest-api-lab",
      ciProvider: "GitHub Actions",
      privacyPolicy: "仅保存脱敏后的 PR/CI 片段、对话摘要与教师复核记录。",
    },
  },
  ({ status, data }) => {
    assert(status === 200, "course settings write should return 200");
    assert(data.settings.courseClass === "软件工程 2301", "course class should be saved");
    assert(data.settings.repository === "se-course/rest-api-lab", "repository should be saved");
    assert(!("apiBaseUrl" in data.settings), "client API URL should not be stored in server settings");
  },
);

await check(
  "course settings readback",
  "/api/course/settings?tenantId=tenant-se-course-2026&courseId=software-engineering-project",
  { headers: teacherHeaders },
  ({ status, data }) => {
    assert(status === 200, "course settings readback should return 200");
    assert(data.settings.privacyPolicy.includes("脱敏"), "privacy policy should be persisted");
  },
);

await check(
  "course roster defaults",
  "/api/course/roster?tenantId=tenant-se-course-2026&courseId=software-engineering-project",
  { headers: teacherHeaders },
  ({ status, data }) => {
    assert(status === 200, "course roster defaults should return 200");
    assert(Array.isArray(data.roster.learners), "course roster learners should be an array");
    assert(
      data.roster.learners.some((learner) => learner.learnerHash === "stu_hash_8f2a"),
      "seed learner should appear in the default pseudonymous roster",
    );
  },
);

await check(
  "course roster write",
  "/api/course/roster",
  {
    method: "POST",
    headers: teacherHeaders,
    body: {
      tenantId: "tenant-se-course-2026",
      courseId: "software-engineering-project",
      learners: [
        {
          learnerHash: "stu_hash_batch_101",
          learnerAlias: "SE-101",
          className: "软件工程 2301",
          groupName: "A 组",
          repositoryUser: "learner-101",
          status: "active",
        },
        {
          learnerHash: "stu_hash_batch_102",
          learnerAlias: "SE-102",
          className: "软件工程 2301",
          groupName: "B 组",
          repositoryUser: "learner-102",
          status: "watch",
        },
      ],
    },
  },
  ({ status, data }) => {
    assert(status === 200, "course roster write should return 200");
    assert(data.stored === true, "course roster should be stored");
    assert(data.roster.learners.length === 2, "course roster should save two learners");
    assert(data.roster.learners.every((learner) => learner.learnerHash.startsWith("stu_hash_")), "roster must remain pseudonymous");
  },
);

await check(
  "course roster readback",
  "/api/course/roster?tenantId=tenant-se-course-2026&courseId=software-engineering-project",
  { headers: teacherHeaders },
  ({ status, data }) => {
    assert(status === 200, "course roster readback should return 200");
    assert(data.roster.learners.some((learner) => learner.learnerAlias === "SE-101"), "saved roster should be readable");
  },
);

await check(
  "course roster protected-field block",
  "/api/course/roster",
  {
    method: "POST",
    headers: teacherHeaders,
    body: {
      tenantId: "tenant-se-course-2026",
      courseId: "software-engineering-project",
      learners: [
        {
          learnerHash: "stu_hash_batch_103",
          learnerAlias: "SE-103",
          className: "软件工程 2301",
          status: "active",
          studentName: "真实姓名不得入库",
        },
      ],
    },
  },
  ({ status, data }) => {
    assert(status === 422, "protected roster field should be blocked");
    assert(data.error === "privacy_blocked", "privacy error expected");
    assert(data.findings.includes("learners[0].studentName"), "studentName finding expected");
  },
);

const courseBatchRequest = {
  tenantId: "tenant-se-course-2026",
  courseId: "software-engineering-project",
  learnerHashes: ["stu_hash_batch_101", "stu_hash_batch_102"],
  task: {
    courseClass: "软件工程 2301",
    courseName: "REST API 错误处理与边界测试",
    trigger: "第 4 周 PR/CI 批量巡检",
    eventDate: "2026-08-30",
    owner: "张老师",
    focus: "boundary",
    risk: "medium",
    taskSummary: "批量检查 PR/CI、测试清单和课堂求助记录；证据不足时只生成候选诊断单。",
    evidenceCoverage: 30,
  },
  idempotencyKey: "week4-rest-api-batch-smoke",
};

await check(
  "course batch creates candidate work orders",
  "/api/work-order-batches",
  {
    method: "POST",
    headers: teacherHeaders,
    body: courseBatchRequest,
  },
  ({ status, data }) => {
    assert(status === 200, "course batch create should return 200");
    assert(data.createdCount === 2, "course batch should create two work orders");
    assert(data.skippedCount === 0, "first batch should not skip learners");
    assert(data.workOrders.every((order) => order.id.startsWith("wo-batch-")), "batch work order ids should be generated");
    assert(data.workOrders.every((order) => order.status === "diagnosis"), "batch work orders should start as diagnosis candidates");
    assert(data.workOrders.every((order) => order.evidenceCoverage < 50), "batch candidates should keep low evidence coverage");
    assert(data.snapshot.workOrders.some((order) => order.learnerHash === "stu_hash_batch_101"), "batch work order should enter teacher snapshot");
  },
);

await check(
  "course batch duplicate skipped",
  "/api/work-order-batches",
  {
    method: "POST",
    headers: teacherHeaders,
    body: courseBatchRequest,
  },
  ({ status, data }) => {
    assert(status === 200, "duplicate course batch should return 200");
    assert(data.createdCount === 0, "duplicate course batch should not create another order");
    assert(data.skippedCount === 2, "duplicate course batch should skip two learners");
  },
);

await check(
  "student batch create blocked",
  "/api/work-order-batches",
  {
    method: "POST",
    headers: studentHeaders,
    body: courseBatchRequest,
  },
  ({ status, data }) => {
    assert(status === 403, "student batch creation should be forbidden");
    assert(data.error === "forbidden", "forbidden error expected");
  },
);

const courseLaunchRequest = {
  tenantId: "tenant-se-course-2026",
  courseId: "software-engineering-project",
  settings: {
    courseClass: "软件工程 2301",
    courseName: "REST API 错误处理与边界测试",
    repository: "se-course/rest-api-lab",
    ciProvider: "GitHub Actions",
    privacyPolicy: "仅保存脱敏后的 PR/CI、对话摘要与教师复核记录；不保存真实姓名、邮箱、token 或原始日志。",
  },
  learners: [
    {
      learnerHash: "stu_hash_launch_101",
      learnerAlias: "LAUNCH-101",
      className: "软件工程 2301",
      groupName: "初始化 A 组",
      repositoryUser: "learner-launch-101",
      status: "active",
    },
    {
      learnerHash: "stu_hash_launch_102",
      learnerAlias: "LAUNCH-102",
      className: "软件工程 2301",
      groupName: "初始化 A 组",
      repositoryUser: "learner-launch-102",
      status: "watch",
    },
  ],
  selectedLearnerHashes: ["stu_hash_launch_101", "stu_hash_launch_102"],
  task: {
    courseClass: "软件工程 2301",
    courseName: "REST API 错误处理与边界测试",
    trigger: "第 1 周开课初始化巡检",
    eventDate: "2026-08-30",
    owner: "张老师",
    focus: "boundary",
    risk: "medium",
    taskSummary: "从 PR、CI、测试清单、课堂求助和学习反思中收集证据；证据不足时只生成候选诊断单，由教师确认下一步。",
    evidenceCoverage: 30,
  },
  idempotencyKey: "course-launch-smoke-20260830",
};

await check(
  "course launch creates first diagnosis queue",
  "/api/course/launch",
  {
    method: "POST",
    headers: teacherHeaders,
    body: courseLaunchRequest,
  },
  ({ status, data }) => {
    assert(status === 200, "course launch should return 200");
    assert(data.createdCount === 2, "course launch should create two first-round diagnosis work orders");
    assert(data.roster.learners.length === 2, "course launch should persist the pseudonymous launch roster");
    assert(data.settings.repository === "se-course/rest-api-lab", "course launch should persist repository settings");
    assert(data.checklist.some((item) => item.key === "boundary" && item.status === "done"), "course launch should confirm the safety boundary");
    assert(
      data.snapshot.workOrders.some((order) => order.learnerHash === "stu_hash_launch_101"),
      "course launch work orders should enter the teacher snapshot",
    );
  },
);

await check(
  "student course launch blocked",
  "/api/course/launch",
  {
    method: "POST",
    headers: studentHeaders,
    body: {
      ...courseLaunchRequest,
      idempotencyKey: "course-launch-smoke-student-blocked",
    },
  },
  ({ status, data }) => {
    assert(status === 403, "student course launch should be forbidden");
    assert(data.error === "forbidden", "forbidden error expected");
  },
);

const teacherWorkbench = await check(
  "teacher workbench read",
  "/api/workbench/teacher/today?tenantId=tenant-se-course-2026&courseId=software-engineering-project",
  { headers: teacherHeaders },
  ({ status, data }) => {
    assert(status === 200, "teacher workbench should return 200");
    assert(Array.isArray(data.workOrders), "workOrders should be an array");
    assert(data.workOrders.some((order) => order.id === "wo-se-018"), "seed work order should be present");
    assert(
      data.workOrders.find((order) => order.id === "wo-se-018")?.returnToken?.startsWith("return_"),
      "teacher workbench should include a student return token",
    );
    assert(data.ledger["wo-se-018"].length >= 1, "seed ledger should be present");
  },
);

const returnTokenFor018 = teacherWorkbench.workOrders.find((order) => order.id === "wo-se-018").returnToken;

await check(
  "work order read",
  "/api/work-orders/wo-se-018?tenantId=tenant-se-course-2026&courseId=software-engineering-project",
  { headers: teacherHeaders },
  ({ status, data }) => {
    assert(status === 200, "work order read should return 200");
    assert(data.workOrder.id === "wo-se-018", "work order id mismatch");
    assert(data.studentReturn.scaffoldReceived === false, "initial student return state should be false");
  },
);

await check(
  "package publish blocked before teacher review",
  "/api/work-orders/wo-se-018/intervention-package",
  {
    method: "POST",
    headers: teacherHeaders,
    body: {
      tenantId: "tenant-se-course-2026",
      courseId: "software-engineering-project",
      teacherNote: "尝试在教师复核前发布任务包。",
    },
  },
  ({ status, data }) => {
    assert(status === 400, "package publish should require a teacher decision");
    assert(data.error === "bad_request", "bad_request error expected");
  },
);

await check(
  "student return blocked before teacher confirmation",
  "/api/work-orders/wo-se-018/student-return",
  {
    method: "POST",
    headers: studentLinkHeaders,
    body: {
      tenantId: "tenant-se-course-2026",
      courseId: "software-engineering-project",
      learnerHash: "stu_hash_8f2a",
      returnToken: returnTokenFor018,
      step: "scaffoldReceived",
      content: "尝试在教师确认前回流。",
    },
  },
  ({ status, data }) => {
    assert(status === 403, "student return should stay closed before teacher confirmation");
    assert(data.error === "forbidden", "forbidden error expected");
  },
);

await check(
  "teacher review updates work order",
  "/api/work-orders/wo-se-018/review",
  {
    method: "POST",
    headers: teacherHeaders,
    body: {
      tenantId: "tenant-se-course-2026",
      courseId: "software-engineering-project",
      decision: "approve",
      teacherNote: "先发安全脚手架，再要求学生补交最小失败用例。",
    },
  },
  ({ status, data }) => {
    assert(status === 200, "teacher review should return 200");
    assert(data.workOrder.status === "guardrail", "approved order should move to guardrail");
    assert(data.workOrder.returnToken?.startsWith("return_"), "teacher review response should keep the student return token");
    assert(data.ledgerEntry.type === "decision", "teacher decision should enter ledger");
    assert(data.snapshot.selectedId === "wo-se-018", "snapshot should keep selected work order");
    assert(
      data.snapshot.workOrders.find((order) => order.id === "wo-se-018")?.returnToken?.startsWith("return_"),
      "teacher review snapshot should keep the student return token",
    );
  },
);

await check(
  "student return blocked before package publish",
  "/api/work-orders/wo-se-018/student-return",
  {
    method: "POST",
    headers: studentLinkHeaders,
    body: {
      tenantId: "tenant-se-course-2026",
      courseId: "software-engineering-project",
      learnerHash: "stu_hash_8f2a",
      returnToken: returnTokenFor018,
      step: "scaffoldReceived",
      content: "尝试在任务包发布前回流。",
    },
  },
  ({ status, data }) => {
    assert(status === 403, "student return should stay closed before task package publish");
    assert(data.error === "forbidden", "forbidden error expected");
  },
);

await check(
  "teacher publishes intervention package",
  "/api/work-orders/wo-se-018/intervention-package",
  {
    method: "POST",
    headers: teacherHeaders,
    body: {
      tenantId: "tenant-se-course-2026",
      courseId: "software-engineering-project",
      teacherNote: "发布任务包：先补边界清单和最小失败用例，再写反思。",
      packageDraft: {
        objective: "教师确认稿：先把 REST API 失败路径变成可复核证据，再做最小修复，不提交完整答案。",
        steps: [
          "复述 PR #18 CI 失败的输入、期望结果和实际结果。",
          "补充空请求体、超长字段、无权限访问 3 个最小失败用例。",
          "先提交测试清单，再提交最小修复或无需改代码的证据说明。",
        ],
        evidenceToSubmit: ["异常路径检查清单", "最小失败用例清单", "教师补充验收截图"],
        rubricCheckpoints: [
          "能说明异常路径先于实现修复。",
          "证据足以支持教师复核，不依赖口头承诺。",
        ],
        dueHint: "下次课前提交，课堂复核时带 PR 链接。",
        safeBoundary: "只给检查清单、失败用例和反思脚手架。",
      },
    },
  },
  ({ status, data }) => {
    assert(status === 200, "intervention package publish should return 200");
    assert(data.package.status === "ready_for_student", "approved package should be ready for student");
    assert(data.package.evidenceToSubmit.includes("最小失败用例清单"), "package should include concrete evidence requirements");
    assert(data.package.teacherEdited === true, "package should record teacher draft confirmation");
    assert(data.package.objective.includes("教师确认稿"), "package should preserve teacher-edited objective");
    assert(data.package.evidenceToSubmit.includes("教师补充验收截图"), "package should preserve teacher-added evidence");
    assert(data.package.safeBoundary.includes("不生成可直接提交的完整实现代码"), "package should re-apply no-direct-answer boundary");
    assert(data.workOrder.status === "intervention", "package publish should move order to intervention");
    assert(data.workOrder.interventionPackage?.id === data.package.id, "work order should embed the task package");
    assert(data.ledgerEntry.type === "intervention_package", "package publish should enter ledger");
    assert(
      data.snapshot.workOrders.find((order) => order.id === "wo-se-018")?.interventionPackage?.status === "ready_for_student",
      "teacher snapshot should include the published package",
    );
  },
);

const courseMicroTaskPayload = {
  tenantId: "tenant-se-course-2026",
  courseId: "software-engineering-project",
  package: {
    id: "micro-boundary-smoke",
    courseName: "Software Engineering Project",
    courseClass: "SE 2301",
    sourceGap: "Boundary test evidence gap",
    objective: "Turn repeated PR and CI failures into a short class task that asks learners to submit boundary checks and a minimum failing case.",
    affectedCount: 1,
    targetLearners: ["stu_hash_7c41"],
    targetWorkOrderIds: ["wo-se-026"],
    steps: [
      "List the failed API path, expected response and observed response.",
      "Add at least two boundary cases and one minimum failing case.",
      "Submit evidence first, then ask for teacher review before any implementation advice.",
    ],
    evidenceToSubmit: ["boundary-check-list.md", "minimum-failing-case.md", "ci-rerun-link"],
    rubricCheckpoints: [
      "Evidence explains why boundary checking comes before code changes.",
      "Teacher can review the result without real identity data or raw tokens.",
    ],
    dueHint: "Submit before the next lab review.",
    safeBoundary: "Do not generate directly submittable complete implementation.",
    teacherAction: "Publish a course micro task and record it in target work-order ledgers.",
    confidenceNote: "Uses current PR, CI and work-order evidence only.",
  },
};

await check(
  "student course micro-task publish denied",
  "/api/course/micro-task-package",
  { method: "POST", headers: studentHeaders, body: courseMicroTaskPayload },
  ({ status, data }) => {
    assert(status === 403, "student role should not publish course micro-task packages");
    assert(data.error === "forbidden", "forbidden error expected");
  },
);

await check(
  "teacher publishes course micro-task package",
  "/api/course/micro-task-package",
  { method: "POST", headers: teacherHeaders, body: courseMicroTaskPayload },
  ({ status, data }) => {
    assert(status === 200, "course micro-task publish should return 200");
    assert(data.package.status === "published", "course micro-task package should be published");
    assert(data.publishedCount === 1, "course micro-task should be written to one target work order");
    assert(data.skippedCount === 0, "first course micro-task publish should not skip the target");
    assert(data.ledgerEntries.length === 1, "course micro-task publish should return one ledger entry");
    assert(data.ledgerEntries[0].type === "course_micro_task", "course micro-task publish should enter ledger");
    assert(data.package.safeBoundary.includes("可直接提交"), "server should re-apply the no-direct-answer boundary");
    assert(
      data.snapshot.ledger["wo-se-026"].some(
        (entry) => entry.type === "course_micro_task" && entry.traceId === `course-micro-task-${data.package.id}`,
      ),
      "teacher snapshot should include the course micro-task ledger entry",
    );
    const publishedOrder = data.snapshot.workOrders.find((order) => order.id === "wo-se-026");
    assert(publishedOrder?.selectedDecision === "returnEvidence", "course micro-task should open a teacher-confirmed return-evidence path");
    assert(publishedOrder?.status === "intervention", "course micro-task should move the target work order to intervention");
    assert(publishedOrder?.interventionPackage?.title.includes("课堂微任务"), "course micro-task should create a student-visible task package");
    assert(publishedOrder?.interventionPackage?.status === "ready_for_student", "student-visible micro-task package should be ready");
    assert(data.snapshot.studentReturn["wo-se-026"]?.scaffoldReceived === false, "course micro-task should initialize student return progress");
  },
);

const courseMicroTaskReminderPayload = {
  tenantId: "tenant-se-course-2026",
  courseId: "software-engineering-project",
  reminder: {
    traceId: "course-micro-task-micro-boundary-smoke",
    title: "Boundary test evidence gap",
    targetWorkOrderIds: ["wo-se-026"],
    note: "Please receive the class micro-task and submit reviewable evidence before asking for implementation help.",
  },
};

await check(
  "student course micro-task reminder denied",
  "/api/course/micro-task-reminder",
  { method: "POST", headers: studentHeaders, body: courseMicroTaskReminderPayload },
  ({ status, data }) => {
    assert(status === 403, "student role should not remind course micro-task targets");
    assert(data.error === "forbidden", "forbidden error expected");
  },
);

await check(
  "teacher reminds pending course micro-task targets",
  "/api/course/micro-task-reminder",
  { method: "POST", headers: teacherHeaders, body: courseMicroTaskReminderPayload },
  ({ status, data }) => {
    assert(status === 200, "course micro-task reminder should return 200");
    assert(data.remindedCount === 1, "course micro-task reminder should write one pending target");
    assert(data.skippedCount === 0, "first course micro-task reminder should not skip the pending target");
    assert(data.ledgerEntries.length === 1, "course micro-task reminder should return one ledger entry");
    assert(data.ledgerEntries[0].type === "teacher_reminder", "teacher reminder should enter ledger");
    assert(data.ledgerEntries[0].traceId === courseMicroTaskReminderPayload.reminder.traceId, "teacher reminder should keep the batch trace");
    assert(
      data.snapshot.ledger["wo-se-026"].some(
        (entry) => entry.type === "teacher_reminder" && entry.traceId === courseMicroTaskReminderPayload.reminder.traceId,
      ),
      "teacher snapshot should include the course micro-task reminder ledger entry",
    );
  },
);

const courseTeachingImprovementPlanPayload = {
  tenantId: "tenant-se-course-2026",
  courseId: "software-engineering-project",
  plan: {
    id: "teach-improve-boundary-smoke",
    product: "SE-Path",
    exportType: "course_teaching_improvement_plan",
    courseName: "Software Engineering Project",
    courseClass: "SE 2301",
    repository: "se-course/rest-api-lab",
    sourceSummary: "Based on repeated boundary-testing evidence gaps after a class micro-task review.",
    boundary:
      "AI only proposes course-level teaching adjustments. Do not rank learners, punish learners or generate directly submittable code.",
    items: [
      {
        id: "improve-boundary-evidence",
        sourceTraceId: "course-micro-task-micro-boundary-smoke",
        focus: "Boundary testing evidence",
        issue: "Learners still mix implementation repair with evidence diagnosis, so teacher review lacks minimum failing cases.",
        action:
          "Add a next-lab evidence station: boundary checklist first, minimum failing case second, teacher sampling third.",
        acceptanceEvidence: ["boundary-checklist", "minimum-failing-case", "teacher-sampling-record"],
        targetWorkOrderIds: ["wo-se-026"],
        priority: "high",
      },
    ],
    markdown: "# SE-Path next-round teaching improvement plan\n\nBoundary testing evidence station.",
  },
};

await check(
  "student course teaching-improvement publish denied",
  "/api/course/teaching-improvement-plan",
  { method: "POST", headers: studentHeaders, body: courseTeachingImprovementPlanPayload },
  ({ status, data }) => {
    assert(status === 403, "student role should not publish course teaching improvement plans");
    assert(data.error === "forbidden", "forbidden error expected");
  },
);

await check(
  "teacher publishes course teaching-improvement plan",
  "/api/course/teaching-improvement-plan",
  { method: "POST", headers: teacherHeaders, body: courseTeachingImprovementPlanPayload },
  ({ status, data }) => {
    assert(status === 200, "course teaching improvement publish should return 200");
    assert(data.plan.status === "published", "teaching improvement plan should be published");
    assert(data.publishedCount === 1, "teaching improvement should be written to one target work order");
    assert(data.skippedCount === 0, "first teaching improvement publish should not skip the target");
    assert(data.ledgerEntries.length === 1, "teaching improvement publish should return one ledger entry");
    assert(data.ledgerEntries[0].type === "teaching_improvement", "teaching improvement should enter ledger");
    assert(data.plan.boundary.includes("directly submittable"), "server should retain the no-direct-answer boundary");
    assert(
      data.snapshot.ledger["wo-se-026"].some(
        (entry) =>
          entry.type === "teaching_improvement" &&
          entry.traceId === `teaching-improvement-${data.plan.id}`,
      ),
      "teacher snapshot should include the teaching improvement ledger entry",
    );
  },
);

const courseTeachingImprovementExecutionPayload = {
  tenantId: "tenant-se-course-2026",
  courseId: "software-engineering-project",
  receipt: {
    id: "teach-exec-boundary-smoke",
    product: "SE-Path",
    exportType: "course_teaching_improvement_execution_receipt",
    planId: "teach-improve-boundary-smoke",
    executedAt: "2026-08-30 10:20:00",
    executedBy: "Course teacher",
    courseName: "Software Engineering Project",
    courseClass: "SE 2301",
    repository: "se-course/rest-api-lab",
    classSession: "SE 2301 next lab",
    summary:
      "Teacher executed the evidence station: boundary checklist, minimum failing case and sampling review are now available for learners.",
    evidence: ["classroom-evidence-station", "resource-version-change", "teacher-sampling-record"],
    targetWorkOrderIds: ["wo-se-026"],
    boundary:
      "This receipt only proves the teacher executed course improvement actions. Do not rank learners, punish learners or automatically evaluate learners.",
    markdown: "# SE-Path teaching improvement execution receipt\n\nEvidence station executed.",
  },
};

await check(
  "student course teaching-improvement execution denied",
  "/api/course/teaching-improvement-execution",
  { method: "POST", headers: studentHeaders, body: courseTeachingImprovementExecutionPayload },
  ({ status, data }) => {
    assert(status === 403, "student role should not record course teaching improvement execution");
    assert(data.error === "forbidden", "forbidden error expected");
  },
);

await check(
  "teacher records course teaching-improvement execution",
  "/api/course/teaching-improvement-execution",
  { method: "POST", headers: teacherHeaders, body: courseTeachingImprovementExecutionPayload },
  ({ status, data }) => {
    assert(status === 200, "course teaching improvement execution should return 200");
    assert(data.recordedCount === 1, "teaching improvement execution should be written to one target work order");
    assert(data.skippedCount === 0, "first teaching improvement execution should not skip the target");
    assert(data.ledgerEntries.length === 1, "teaching improvement execution should return one ledger entry");
    assert(data.ledgerEntries[0].type === "teaching_improvement_execution", "teaching improvement execution should enter ledger");
    assert(data.ledgerEntries[0].source === "下轮课堂", "teaching improvement execution should keep the classroom source");
    assert(data.receipt.boundary.includes("automatically evaluate"), "server should retain the no-automatic-evaluation boundary");
    assert(
      data.snapshot.ledger["wo-se-026"].some(
        (entry) =>
          entry.type === "teaching_improvement_execution" &&
          entry.traceId === `teaching-improvement-execution-${data.receipt.planId}`,
      ),
      "teacher snapshot should include the teaching improvement execution ledger entry",
    );
  },
);

const courseTeachingImprovementFollowupPayload = {
  tenantId: "tenant-se-course-2026",
  courseId: "software-engineering-project",
  sample: {
    id: "teach-followup-boundary-smoke",
    product: "SE-Path",
    exportType: "course_teaching_improvement_followup_sample",
    planId: "teach-improve-boundary-smoke",
    receiptId: "teach-exec-boundary-smoke",
    sampledAt: "2026-08-31 18:20:00",
    sampledBy: "Course teacher",
    courseName: "Software Engineering Project",
    courseClass: "SE 2301",
    repository: "se-course/rest-api-lab",
    observationWindow: "48 hours after next lab",
    summary:
      "Teacher records a follow-up sampling plan for evidence return, CI coverage and review workload after the executed improvement.",
    indicators: [
      {
        id: "return-completion",
        label: "Evidence return",
        before: "One target diagnosis still has missing evidence.",
        expected: "Each target diagnosis adds at least one reviewable evidence item.",
        evidence: "student structured return, PR link and reflection summary",
        interpretation: "Missing return stays in teacher reminder or human talk; it does not become a low-evidence value-added conclusion.",
        status: "watch",
      },
      {
        id: "review-load",
        label: "Teacher review load",
        before: "Teacher still needs manual clarification for boundary cases.",
        expected: "Teacher can review with a shared boundary checklist.",
        evidence: "teacher evidence review records",
        interpretation: "Review-load change is a teaching-process signal, not a learner ranking signal.",
        status: "needs_more_evidence",
      },
    ],
    targetWorkOrderIds: ["wo-se-026"],
    boundary:
      "This sample only defines observation criteria. It is not causal proof, learner ranking, punishment or automatic evaluation.",
    markdown: "# SE-Path teaching improvement follow-up sample\n\nObservation criteria only.",
  },
};

await check(
  "student course teaching-improvement followup denied",
  "/api/course/teaching-improvement-followup-sample",
  { method: "POST", headers: studentHeaders, body: courseTeachingImprovementFollowupPayload },
  ({ status, data }) => {
    assert(status === 403, "student role should not record course teaching improvement followup samples");
    assert(data.error === "forbidden", "forbidden error expected");
  },
);

await check(
  "teacher records course teaching-improvement followup sample",
  "/api/course/teaching-improvement-followup-sample",
  { method: "POST", headers: teacherHeaders, body: courseTeachingImprovementFollowupPayload },
  ({ status, data }) => {
    assert(status === 200, "course teaching improvement followup sample should return 200");
    assert(data.recordedCount === 1, "followup sample should be written to one target work order");
    assert(data.skippedCount === 0, "first followup sample should not skip the target");
    assert(data.ledgerEntries.length === 1, "followup sample should return one ledger entry");
    assert(data.ledgerEntries[0].type === "teaching_improvement_followup", "followup sample should enter ledger");
    assert(data.ledgerEntries[0].source === "效果采样", "followup sample should keep the sampling source");
    assert(data.sample.boundary.includes("not causal proof"), "server should retain the non-causal boundary");
    assert(
      data.snapshot.ledger["wo-se-026"].some(
        (entry) =>
          entry.type === "teaching_improvement_followup" &&
          entry.traceId === `teaching-improvement-followup-${data.sample.planId}`,
      ),
      "teacher snapshot should include the teaching improvement followup ledger entry",
    );
  },
);

const courseTeachingImprovementFollowupResultPayload = {
  tenantId: "tenant-se-course-2026",
  courseId: "software-engineering-project",
  result: {
    id: "teach-followup-result-boundary-smoke",
    product: "SE-Path",
    exportType: "course_teaching_improvement_followup_result",
    planId: "teach-improve-boundary-smoke",
    receiptId: "teach-exec-boundary-smoke",
    sampleId: "teach-followup-boundary-smoke",
    collectedAt: "2026-08-31 20:10:00",
    collectedBy: "Course teacher",
    courseName: "Software Engineering Project",
    courseClass: "SE 2301",
    repository: "se-course/rest-api-lab",
    observationWindow: "48 hours after next lab",
    summary:
      "Teacher collects follow-up observations for evidence return, CI coverage and review load without making a causal or automatic learner-evaluation claim.",
    findings: [
      {
        id: "return-completion-result",
        label: "Evidence return result",
        expected: "Each target diagnosis adds one reviewable evidence item.",
        observed: "1/1 target diagnosis has a reviewable return package.",
        evidence: "student structured return and teacher review trace",
        interpretation: "The result is only a formative observation and still depends on teacher review.",
        status: "observed_improvement",
      },
      {
        id: "review-load-result",
        label: "Teacher review load result",
        expected: "Teacher can review through one evidence checklist.",
        observed: "The same checklist is now used for the target diagnosis.",
        evidence: "teacher review ledger and evidence trace",
        interpretation: "Review-load change is a course process signal, not learner ranking evidence.",
        status: "no_clear_change",
      },
    ],
    targetWorkOrderIds: ["wo-se-026"],
    nextAction:
      "Keep collecting new evidence and teacher review records before updating formative diagnosis.",
    boundary:
      "This result records observed evidence changes only. It is not causal proof, learner ranking, punishment or automatic evaluation.",
    markdown: "# SE-Path follow-up result\n\nObserved evidence changes only.",
  },
};

await check(
  "student course teaching-improvement followup result denied",
  "/api/course/teaching-improvement-followup-result",
  { method: "POST", headers: studentHeaders, body: courseTeachingImprovementFollowupResultPayload },
  ({ status, data }) => {
    assert(status === 403, "student role should not record course teaching improvement followup results");
    assert(data.error === "forbidden", "forbidden error expected");
  },
);

await check(
  "teacher records course teaching-improvement followup result",
  "/api/course/teaching-improvement-followup-result",
  { method: "POST", headers: teacherHeaders, body: courseTeachingImprovementFollowupResultPayload },
  ({ status, data }) => {
    assert(status === 200, "course teaching improvement followup result should return 200");
    assert(data.recordedCount === 1, "followup result should be written to one target work order");
    assert(data.skippedCount === 0, "first followup result should not skip the target");
    assert(data.ledgerEntries.length === 1, "followup result should return one ledger entry");
    assert(data.ledgerEntries[0].type === "teaching_improvement_followup_result", "followup result should enter ledger");
    assert(data.ledgerEntries[0].source === "结果回收", "followup result should keep the observation-result source");
    assert(data.result.boundary.includes("not causal proof"), "server should retain the non-causal boundary");
    assert(data.result.nextAction.includes("teacher review"), "server should retain a human-review next action");
    assert(
      data.snapshot.ledger["wo-se-026"].some(
        (entry) =>
          entry.type === "teaching_improvement_followup_result" &&
          entry.traceId === `teaching-improvement-followup-result-${data.result.sampleId}`,
      ),
      "teacher snapshot should include the teaching improvement followup result ledger entry",
    );
  },
);

const courseResourceRevisionPayload = {
  tenantId: "tenant-se-course-2026",
  courseId: "software-engineering-project",
  ticket: {
    id: "resource-revision-boundary-smoke",
    product: "SE-Path",
    exportType: "course_resource_revision_ticket",
    sourceResultId: "teach-followup-result-boundary-smoke",
    sampleId: "teach-followup-boundary-smoke",
    planId: "teach-improve-boundary-smoke",
    createdAt: "2026-08-31 21:10:00",
    createdBy: "Course teacher",
    courseName: "Software Engineering Project",
    courseClass: "SE 2301",
    repository: "se-course/rest-api-lab",
    resourceTitle: "REST API boundary testing resource pack",
    versionFrom: "v2026.08.30",
    versionTo: "v2026.09.01-evidence-loop",
    reason:
      "Follow-up observations show that the course resource should make boundary evidence, minimum failing cases and teacher review checkpoints explicit.",
    changes: [
      {
        id: "minimum-case-library",
        area: "Testing resource",
        title: "Add minimum failing case library",
        reason: "Learners need concrete evidence prompts before implementation repair.",
        implementation:
          "Add body-empty, field-out-of-range, unauthorized and abnormal status-code cases with expected evidence only.",
        owner: "Course teacher",
        status: "ready",
      },
      {
        id: "pr-template-evidence",
        area: "Repository template",
        title: "Update PR evidence fields",
        reason: "Teacher review needs stable CI rerun and reflection fields.",
        implementation:
          "Require failure symptom, minimum reproduction, verification command, uncertainty and teacher-review link fields.",
        owner: "Teaching assistant",
        status: "needs_review",
      },
    ],
    acceptanceChecks: [
      "Resource revision must trace back to the follow-up result and target work-order ledgers.",
      "The resource gives evidence scaffolds only and does not generate directly submittable answers.",
      "The next observation round records evidence changes only and does not rank, punish or automatically evaluate learners.",
    ],
    targetWorkOrderIds: ["wo-se-026"],
    boundary:
      "Course resource revision only updates teaching resources and evidence criteria. It is not causal proof, learner ranking, punishment, automatic evaluation or directly submittable answer generation.",
    markdown: "# SE-Path course resource revision ticket\n\nResource changes only.",
  },
};

await check(
  "student course resource revision denied",
  "/api/course/resource-revision",
  { method: "POST", headers: studentHeaders, body: courseResourceRevisionPayload },
  ({ status, data }) => {
    assert(status === 403, "student role should not record course resource revisions");
    assert(data.error === "forbidden", "forbidden error expected");
  },
);

await check(
  "teacher records course resource revision",
  "/api/course/resource-revision",
  { method: "POST", headers: teacherHeaders, body: courseResourceRevisionPayload },
  ({ status, data }) => {
    assert(status === 200, "course resource revision should return 200");
    assert(data.recordedCount === 1, "resource revision should be written to one target work order");
    assert(data.skippedCount === 0, "first resource revision should not skip the target");
    assert(data.ledgerEntries.length === 1, "resource revision should return one ledger entry");
    assert(data.ledgerEntries[0].type === "course_resource_revision", "resource revision should enter ledger");
    assert(data.ledgerEntries[0].source === "资源改版", "resource revision should keep the resource source");
    assert(data.ticket.boundary.includes("automatic evaluation"), "server should retain the no-automatic-evaluation boundary");
    assert(data.ticket.boundary.includes("directly submittable"), "server should retain the no-direct-answer boundary");
    assert(
      data.snapshot.ledger["wo-se-026"].some(
        (entry) =>
          entry.type === "course_resource_revision" &&
          entry.traceId === `course-resource-revision-${data.ticket.id}`,
      ),
      "teacher snapshot should include the course resource revision ledger entry",
    );
  },
);

const courseResourceReleasePayload = {
  tenantId: "tenant-se-course-2026",
  courseId: "software-engineering-project",
  receipt: {
    id: "resource-release-boundary-smoke",
    product: "SE-Path",
    exportType: "course_resource_release_receipt",
    revisionTicketId: "resource-revision-boundary-smoke",
    sourceResultId: "teach-followup-result-boundary-smoke",
    sampleId: "teach-followup-boundary-smoke",
    releasedAt: "2026-08-31 21:25:00",
    releasedBy: "Course teacher",
    courseName: "Software Engineering Project",
    courseClass: "SE 2301",
    repository: "se-course/rest-api-lab",
    resourceTitle: "REST API boundary testing resource pack",
    releasedVersion: "v2026.09.01-evidence-loop",
    releaseChannel: "course repository + learner task entry + rubric config",
    releaseScope: "SE 2301 next REST API boundary testing task",
    assets: [
      "resources/rest-api-boundary-cases.md",
      ".github/pull_request_template.md",
      "rubric/boundary-evidence-checkpoints.json",
    ],
    checks: [
      {
        id: "asset-version",
        label: "Resource version archived",
        evidence: "The release version has three traceable course assets.",
        owner: "Course maintainer",
        status: "passed",
      },
      {
        id: "student-entry",
        label: "Learner entry visible",
        evidence: "Task entry, PR template and rubric checkpoints use the same evidence criteria.",
        owner: "Course teacher",
        status: "passed",
      },
      {
        id: "rollback-ready",
        label: "Rollback path prepared",
        evidence: "The previous resource version remains available for rollback and manual review.",
        owner: "Course lead",
        status: "watch",
      },
    ],
    rollbackPlan:
      "Keep v2026.08.30 as a rollback entry. If the next evidence coverage drops or teacher review load increases, pause automatic distribution and return to manual sampling.",
    targetWorkOrderIds: ["wo-se-026"],
    boundary:
      "Course resource release receipt proves delivery only. It is not causal proof, learner ranking, punishment, automatic evaluation or directly submittable answer generation.",
    markdown:
      "# SE-Path course resource release receipt\n\nPublished assets with rollback and no automatic evaluation.",
  },
};

await check(
  "student course resource release denied",
  "/api/course/resource-release",
  { method: "POST", headers: studentHeaders, body: courseResourceReleasePayload },
  ({ status, data }) => {
    assert(status === 403, "student role should not record course resource release receipts");
    assert(data.error === "forbidden", "forbidden error expected");
  },
);

await check(
  "teacher records course resource release",
  "/api/course/resource-release",
  { method: "POST", headers: teacherHeaders, body: courseResourceReleasePayload },
  ({ status, data }) => {
    assert(status === 200, "course resource release should return 200");
    assert(data.recordedCount === 1, "resource release should be written to one target work order");
    assert(data.skippedCount === 0, "first resource release should not skip the target");
    assert(data.ledgerEntries.length === 1, "resource release should return one ledger entry");
    assert(data.ledgerEntries[0].type === "course_resource_release", "resource release should enter ledger");
    assert(data.ledgerEntries[0].source === "资源发布", "resource release should keep the resource release source");
    assert(data.receipt.boundary.includes("automatic evaluation"), "server should retain the no-automatic-evaluation boundary");
    assert(data.receipt.boundary.includes("directly submittable"), "server should retain the no-direct-answer boundary");
    assert(
      data.snapshot.ledger["wo-se-026"].some(
        (entry) =>
          entry.type === "course_resource_release" &&
          entry.traceId === `course-resource-release-${data.receipt.id}`,
      ),
      "teacher snapshot should include the course resource release ledger entry",
    );
  },
);

const courseResourceUsagePayload = {
  tenantId: "tenant-se-course-2026",
  courseId: "software-engineering-project",
  receipt: {
    id: "resource-usage-boundary-smoke",
    product: "SE-Path",
    exportType: "course_resource_usage_receipt",
    releaseReceiptId: "resource-release-boundary-smoke",
    revisionTicketId: "resource-revision-boundary-smoke",
    sourceResultId: "teach-followup-result-boundary-smoke",
    sampleId: "teach-followup-boundary-smoke",
    observedAt: "2026-08-31 21:40:00",
    observedBy: "Course teacher",
    courseName: "Software Engineering Project",
    courseClass: "SE 2301",
    repository: "se-course/rest-api-lab",
    releasedVersion: "v2026.09.01-evidence-loop",
    usageWindow: "48 hours after release",
    activeLearners: 1,
    submittedEvidenceCount: 1,
    teacherReviewReadyCount: 1,
    medianCoverageAfter: 74,
    signals: [
      {
        id: "resource-entry",
        label: "Learner resource entry",
        value: "1/1",
        evidence: "The learner opened the revised task entry and received the resource package.",
        status: "confirmed",
      },
      {
        id: "new-evidence",
        label: "New evidence returned",
        value: "1/1",
        evidence: "The learner submitted failure symptom, minimum case and verification record.",
        status: "confirmed",
      },
      {
        id: "teacher-review-ready",
        label: "Teacher review ready",
        value: "1/1",
        evidence: "The returned evidence is queued for teacher confirmation before any value-added interpretation.",
        status: "needs_review",
      },
    ],
    nextAction: "Review new evidence before interpreting resource impact.",
    targetWorkOrderIds: ["wo-se-026"],
    boundary:
      "Course resource usage receipt records usage and evidence only. It is not causal proof, learner ranking, punishment or automatic evaluation.",
    markdown: "# SE-Path course resource usage receipt\n\nUsage signals only.",
  },
};

await check(
  "student course resource usage denied",
  "/api/course/resource-usage",
  { method: "POST", headers: studentHeaders, body: courseResourceUsagePayload },
  ({ status, data }) => {
    assert(status === 403, "student role should not record course resource usage receipts");
    assert(data.error === "forbidden", "forbidden error expected");
  },
);

await check(
  "teacher records course resource usage",
  "/api/course/resource-usage",
  { method: "POST", headers: teacherHeaders, body: courseResourceUsagePayload },
  ({ status, data }) => {
    assert(status === 200, "course resource usage should return 200");
    assert(data.recordedCount === 1, "resource usage should be written to one target work order");
    assert(data.skippedCount === 0, "first resource usage should not skip the target");
    assert(data.ledgerEntries.length === 1, "resource usage should return one ledger entry");
    assert(data.ledgerEntries[0].type === "course_resource_usage", "resource usage should enter ledger");
    assert(data.ledgerEntries[0].source === "使用回流", "resource usage should keep the usage source");
    assert(data.receipt.boundary.includes("automatic evaluation"), "server should retain the no-automatic-evaluation boundary");
    assert(data.receipt.boundary.includes("ranking"), "server should retain the no-ranking boundary");
    assert(
      data.snapshot.ledger["wo-se-026"].some(
        (entry) =>
          entry.type === "course_resource_usage" &&
          entry.traceId === `course-resource-usage-${data.receipt.id}`,
      ),
      "teacher snapshot should include the course resource usage ledger entry",
    );
  },
);

const courseResourceUsageReminderPayload = {
  tenantId: "tenant-se-course-2026",
  courseId: "software-engineering-project",
  reminder: {
    usageReceiptId: "resource-usage-boundary-smoke",
    traceId: "course-resource-usage-reminder-resource-usage-boundary-smoke",
    title: "v2026.09.01-evidence-loop usage return",
    targetWorkOrderIds: ["wo-se-026"],
    note: "Please open the revised resource entry and submit failure symptom, minimum failing case, verification record and reflection. Do not submit a complete answer.",
  },
};

await check(
  "student course resource usage reminder denied",
  "/api/course/resource-usage-reminder",
  { method: "POST", headers: studentHeaders, body: courseResourceUsageReminderPayload },
  ({ status, data }) => {
    assert(status === 403, "student role should not remind course resource usage return targets");
    assert(data.error === "forbidden", "forbidden error expected");
  },
);

await check(
  "teacher records course resource usage reminder",
  "/api/course/resource-usage-reminder",
  { method: "POST", headers: teacherHeaders, body: courseResourceUsageReminderPayload },
  ({ status, data }) => {
    assert(status === 200, "course resource usage reminder should return 200");
    assert(data.remindedCount === 1, "resource usage reminder should be written to one target work order");
    assert(data.skippedCount === 0, "first resource usage reminder should not skip the target");
    assert(data.ledgerEntries.length === 1, "resource usage reminder should return one ledger entry");
    assert(data.ledgerEntries[0].type === "teacher_reminder", "resource usage reminder should enter ledger as teacher reminder");
    assert(data.ledgerEntries[0].source === "教师催办", "resource usage reminder should keep the teacher reminder source");
    assert(data.ledgerEntries[0].title.includes("资源使用催办"), "resource usage reminder should keep the resource usage title");
    assert(data.ledgerEntries[0].detail.includes("不生成可直接提交的完整答案"), "resource usage reminder should retain the no-direct-answer boundary");
    assert(data.ledgerEntries[0].detail.includes("不自动评价学生"), "resource usage reminder should retain the no-automatic-evaluation boundary");
    assert(
      data.snapshot.ledger["wo-se-026"].some(
        (entry) =>
          entry.type === "teacher_reminder" &&
          entry.traceId === courseResourceUsageReminderPayload.reminder.traceId,
      ),
      "teacher snapshot should include the course resource usage reminder ledger entry",
    );
  },
);

await check(
  "student return token mismatch blocked",
  "/api/work-orders/wo-se-018/student-return",
  {
    method: "POST",
    headers: studentLinkHeaders,
    body: {
      tenantId: "tenant-se-course-2026",
      courseId: "software-engineering-project",
      learnerHash: "stu_hash_8f2a",
      returnToken: "return_wrong_token",
      step: "scaffoldReceived",
      content: "尝试使用错误令牌回流。",
    },
  },
  ({ status, data }) => {
    assert(status === 403, "student return with a wrong token should be forbidden");
    assert(data.error === "forbidden", "forbidden error expected");
  },
);

await check(
  "student return link token works",
  "/api/work-orders/wo-se-018/student-return",
  {
    method: "POST",
    headers: studentLinkHeaders,
    body: {
      tenantId: "tenant-se-course-2026",
      courseId: "software-engineering-project",
      learnerHash: "stu_hash_8f2a",
      returnToken: returnTokenFor018,
      step: "scaffoldReceived",
      content: "通过教师生成的专属链接确认收到任务。",
    },
  },
  ({ status, data }) => {
    assert(status === 200, "student return token should authorize the return link");
    assert(data.studentReturn.scaffoldReceived === true, "student scaffold receipt should be marked returned");
    assert(!data.workOrder.returnToken, "student response must not expose the return token");
  },
);

const firstStudentEvidenceReturn = await check(
  "student return own work order",
  "/api/work-orders/wo-se-018/student-return",
  {
    method: "POST",
    headers: studentHeaders,
    body: {
      tenantId: "tenant-se-course-2026",
      courseId: "software-engineering-project",
      learnerHash: "stu_hash_8f2a",
      step: "evidenceSubmitted",
      artifact: {
        failureSymptom: "订单接口在空请求体、越界金额、无权限访问三类输入下返回值不稳定。",
        minimalCase: "POST /orders body={}；POST /orders amount=100000000；无 token 访问。",
        verificationRecord: "已补交三类最小失败用例并重跑 CI，边界测试全部通过。",
        evidenceLink: "https://github.com/se-course/rest-api-lab/pull/18",
        integrityNote: "只提交可复核证据、测试清单和修复说明，不提交完整答案。",
      },
    },
  },
  ({ status, data }) => {
    assert(status === 200, "student return should return 200");
    assert(data.studentReturn.evidenceSubmitted === true, "student evidence should be marked returned");
    assert(data.ledgerEntry.type === "student_return", "student return should enter ledger");
    assert(data.ledgerEntry.detail.includes("失败现象"), "structured student evidence should be summarized in ledger");
    assert(data.ledgerEntry.detail.includes("最小失败用例"), "minimal failing case should be preserved in ledger");
  },
);
const firstStudentEvidenceReturnLedgerId = firstStudentEvidenceReturn.ledgerEntry.id;

await check(
  "student teacher evidence review denied",
  "/api/work-orders/wo-se-018/evidence-review",
  {
    method: "POST",
    headers: studentHeaders,
    body: {
      tenantId: "tenant-se-course-2026",
      courseId: "software-engineering-project",
      review: {
        sourceLedgerEntryId: firstStudentEvidenceReturnLedgerId,
        summary: "学生尝试代替教师完成证据复核。",
        items: [
          {
            key: "failureSymptom",
            label: "失败现象",
            value: "学生侧不能写入教师复核。",
            status: "accepted",
            required: true,
          },
        ],
      },
    },
  },
  ({ status, data }) => {
    assert(status === 403, "student role should not review evidence for teacher acceptance");
    assert(data.error === "forbidden", "forbidden error expected");
  },
);

await check(
  "teacher evidence review writes ledger",
  "/api/work-orders/wo-se-018/evidence-review",
  {
    method: "POST",
    headers: teacherHeaders,
    body: {
      tenantId: "tenant-se-course-2026",
      courseId: "software-engineering-project",
      review: {
        sourceLedgerEntryId: firstStudentEvidenceReturnLedgerId,
        summary: "首轮学生证据已逐项复核，但仍等待反思后再决定是否退回。",
        teacherNote: "证据项本身可采信，最终结论仍由教师验收决定。",
        items: [
          {
            key: "failureSymptom",
            label: "失败现象",
            value: "订单接口三类边界输入返回不稳定。",
            status: "accepted",
            required: true,
          },
          {
            key: "minimalCase",
            label: "最小失败用例",
            value: "空请求体、越界金额、无 token 访问。",
            status: "accepted",
            required: true,
          },
          {
            key: "verificationRecord",
            label: "修复/验证记录",
            value: "CI 已重跑。",
            status: "accepted",
            required: true,
          },
        ],
      },
    },
  },
  ({ status, data }) => {
    assert(status === 200, "teacher evidence review should return 200");
    assert(data.ledgerEntry.type === "teacher_evidence_review", "teacher evidence review should enter ledger");
    assert(data.ledgerEntry.traceId === `teacher-evidence-review-${firstStudentEvidenceReturnLedgerId}`, "teacher evidence review should point to the reviewed learner return");
    assert(data.ledgerEntry.detail.includes("可采信"), "teacher evidence review should persist accepted statuses");
  },
);

await check(
  "teacher closure blocked before full return",
  "/api/work-orders/wo-se-018/closure",
  {
    method: "POST",
    headers: teacherHeaders,
    body: {
      tenantId: "tenant-se-course-2026",
      courseId: "software-engineering-project",
      decision: "accept",
      teacherNote: "尝试在学生未完成反思前关闭。",
    },
  },
  ({ status, data }) => {
    assert(status === 400, "teacher closure should require full student return");
    assert(data.error === "bad_request", "bad_request error expected");
  },
);

await check(
  "student reflection moves work order to teacher acceptance",
  "/api/work-orders/wo-se-018/student-return",
  {
    method: "POST",
    headers: studentHeaders,
    body: {
      tenantId: "tenant-se-course-2026",
      courseId: "software-engineering-project",
      learnerHash: "stu_hash_8f2a",
      step: "reflectionSubmitted",
      content: "我先把失败现象转成最小用例，再修复边界处理；下一次会先列异常路径清单。",
    },
  },
  ({ status, data }) => {
    assert(status === 200, "student reflection should return 200");
    assert(data.studentReturn.reflectionSubmitted === true, "student reflection should be marked returned");
    assert(data.workOrder.status === "review", "full return should wait for teacher acceptance, not close itself");
  },
);

await check(
  "teacher returns full return for more evidence",
  "/api/work-orders/wo-se-018/closure",
  {
    method: "POST",
    headers: teacherHeaders,
    body: {
      tenantId: "tenant-se-course-2026",
      courseId: "software-engineering-project",
      decision: "returnEvidence",
      teacherNote: "最小失败用例已补，但异常路径检查清单缺少越权访问和超长字段说明，请二次补证据。",
    },
  },
  ({ status, data }) => {
    assert(status === 200, "teacher return-for-evidence should return 200 after full return");
    assert(data.workOrder.status === "evidence", "return-for-evidence should reopen evidence stage");
    assert(!data.workOrder.valueAddedSnapshot, "return-for-evidence must not create a final value-added snapshot");
    assert(data.workOrder.interventionPackage.status === "returned_for_evidence", "task package should show returned status");
    assert(data.studentReturn.scaffoldReceived === true, "scaffold receipt should remain completed after return");
    assert(data.studentReturn.evidenceSubmitted === false, "evidence step should reset after return");
    assert(data.studentReturn.reflectionSubmitted === false, "reflection step should reset after return");
    assert(data.studentReturn.revision === 1, "return state should record the first revision");
    assert(data.studentReturn.returnReason.includes("二次补证据"), "return state should retain teacher reason");
    assert(
      data.workOrder.missingEvidence.some((item) => item.title.includes("第 1 轮退回补证据要求")),
      "work order should expose the returned evidence requirement",
    );
  },
);

const secondStudentEvidenceReturn = await check(
  "student second evidence return after teacher request",
  "/api/work-orders/wo-se-018/student-return",
  {
    method: "POST",
    headers: studentHeaders,
    body: {
      tenantId: "tenant-se-course-2026",
      courseId: "software-engineering-project",
      learnerHash: "stu_hash_8f2a",
      step: "evidenceSubmitted",
      content: "二次补证据：补交越权访问、超长字段和空请求体三类异常路径检查清单。",
    },
  },
  ({ status, data }) => {
    assert(status === 200, "second evidence return should return 200");
    assert(data.studentReturn.revision === 1, "second evidence should keep revision context");
    assert(data.studentReturn.evidenceSubmitted === true, "second evidence should be marked returned");
    assert(data.workOrder.status === "evidence", "second evidence alone should stay in evidence stage");
  },
);
const secondStudentEvidenceReturnLedgerId = secondStudentEvidenceReturn.ledgerEntry.id;

await check(
  "student second reflection returns to teacher acceptance",
  "/api/work-orders/wo-se-018/student-return",
  {
    method: "POST",
    headers: studentHeaders,
    body: {
      tenantId: "tenant-se-course-2026",
      courseId: "software-engineering-project",
      learnerHash: "stu_hash_8f2a",
      step: "reflectionSubmitted",
      content: "二次反思：先列输入边界和异常路径，再写实现并用 CI 回证据。",
    },
  },
  ({ status, data }) => {
    assert(status === 200, "second reflection should return 200");
    assert(data.studentReturn.revision === 1, "second reflection should keep revision context");
    assert(data.studentReturn.reflectionSubmitted === true, "second reflection should be marked returned");
    assert(data.workOrder.status === "review", "second full return should wait for teacher acceptance");
  },
);

await check(
  "teacher closure blocked without latest evidence review",
  "/api/work-orders/wo-se-018/closure",
  {
    method: "POST",
    headers: teacherHeaders,
    body: {
      tenantId: "tenant-se-course-2026",
      courseId: "software-engineering-project",
      decision: "accept",
      teacherNote: "尝试在未复核最新补证据前关闭。",
    },
  },
  ({ status, data }) => {
    assert(status === 400, "teacher closure should require latest evidence review");
    assert(data.error === "bad_request", "bad_request error expected");
    assert(String(data.message || "").includes("evidence review"), "blocked closure should explain evidence review requirement");
  },
);

await check(
  "teacher second evidence review gates final acceptance",
  "/api/work-orders/wo-se-018/evidence-review",
  {
    method: "POST",
    headers: teacherHeaders,
    body: {
      tenantId: "tenant-se-course-2026",
      courseId: "software-engineering-project",
      review: {
        sourceLedgerEntryId: secondStudentEvidenceReturnLedgerId,
        summary: "二次补证据已逐项复核，当前证据可进入形成性验收。",
        teacherNote: "退回项已补齐，证据可采信。",
        items: [
          {
            key: "failureSymptom",
            label: "失败现象",
            value: "异常路径检查清单缺少越权访问与超长字段的回归记录。",
            status: "accepted",
            required: true,
          },
          {
            key: "minimalCase",
            label: "最小失败用例",
            value: "无权限 token 访问订单详情；amount 超长字段触发校验失败。",
            status: "accepted",
            required: true,
          },
          {
            key: "verificationRecord",
            label: "修复/验证记录",
            value: "三类失败用例全部跑通。",
            status: "accepted",
            required: true,
          },
        ],
      },
    },
  },
  ({ status, data }) => {
    assert(status === 200, "second teacher evidence review should return 200");
    assert(data.ledgerEntry.traceId === `teacher-evidence-review-${secondStudentEvidenceReturnLedgerId}`, "second teacher evidence review should point to the latest learner return");
    assert(data.ledgerEntry.title.includes("可进入验收"), "second teacher evidence review should unlock acceptance");
  },
);

await check(
  "teacher closes returned work order",
  "/api/work-orders/wo-se-018/closure",
  {
    method: "POST",
    headers: teacherHeaders,
    body: {
      tenantId: "tenant-se-course-2026",
      courseId: "software-engineering-project",
      decision: "accept",
      teacherNote: "学生补证据与反思达到本轮形成性诊断要求。",
    },
  },
  ({ status, data }) => {
    assert(status === 200, "teacher closure should return 200 after full return");
    assert(data.workOrder.status === "closed", "teacher acceptance should close the order");
    assert(data.ledgerEntry.type === "teacher_acceptance", "teacher closure should enter ledger");
    assert(data.workOrder.valueAdded.uncertainty === "low", "teacher closure should lower uncertainty");
    assert(data.workOrder.valueAddedSnapshot?.teacherDecision === "accept", "teacher closure should create a value-added snapshot");
    assert(data.workOrder.valueAddedSnapshot.uplift > 0, "value-added snapshot should record uplift");
    assert(data.studentReturn.revision === 1, "teacher closure should retain return revision context");
    assert(data.studentReturn.returnReason.includes("二次补证据"), "teacher closure should retain return reason context");
    assert(
      data.ledgerEntry.valueAddedSnapshotId === data.workOrder.valueAddedSnapshot.id,
      "teacher closure ledger should point to the value-added snapshot",
    );
    assert(
      data.snapshot.workOrders.some((order) => order.id === "wo-se-018" && order.valueAddedSnapshot?.id === data.workOrder.valueAddedSnapshot.id),
      "teacher snapshot response should include the value-added snapshot",
    );
  },
);

await check(
  "student return blocked after teacher closure",
  "/api/work-orders/wo-se-018/student-return",
  {
    method: "POST",
    headers: studentLinkHeaders,
    body: {
      tenantId: "tenant-se-course-2026",
      courseId: "software-engineering-project",
      learnerHash: "stu_hash_8f2a",
      returnToken: returnTokenFor018,
      step: "reflectionSubmitted",
      content: "尝试在教师关闭后继续写入。",
    },
  },
  ({ status, data }) => {
    assert(status === 403, "student return should be blocked after teacher closure");
    assert(data.error === "forbidden", "forbidden error expected");
  },
);

await check(
  "teacher review blocked after closure",
  "/api/work-orders/wo-se-018/review",
  {
    method: "POST",
    headers: teacherHeaders,
    body: {
      tenantId: "tenant-se-course-2026",
      courseId: "software-engineering-project",
      decision: "returnEvidence",
      teacherNote: "尝试关闭后重写复核决定。",
    },
  },
  ({ status, data }) => {
    assert(status === 403, "closed work order should not accept another teacher review");
    assert(data.error === "forbidden", "forbidden error expected");
  },
);

await check(
  "package publish blocked after closure",
  "/api/work-orders/wo-se-018/intervention-package",
  {
    method: "POST",
    headers: teacherHeaders,
    body: {
      tenantId: "tenant-se-course-2026",
      courseId: "software-engineering-project",
      teacherNote: "尝试关闭后重发任务包。",
    },
  },
  ({ status, data }) => {
    assert(status === 403, "closed work order should not publish another package");
    assert(data.error === "forbidden", "forbidden error expected");
  },
);

await check(
  "student cannot return other learner work order",
  "/api/work-orders/wo-se-026/student-return",
  {
    method: "POST",
    headers: studentHeaders,
    body: {
      tenantId: "tenant-se-course-2026",
      courseId: "software-engineering-project",
      learnerHash: "stu_hash_8f2a",
      step: "reflectionSubmitted",
      content: "尝试写入其他学习者工单。",
    },
  },
  ({ status, data }) => {
    assert(status === 403, "student writing another learner should be forbidden");
    assert(data.error === "forbidden", "forbidden error expected");
  },
);

const importedWorkOrder = await check(
  "GitHub CI import creates work order",
  "/api/integrations/github/import",
  {
    method: "POST",
    headers: teacherHeaders,
    body: {
      tenantId: "tenant-se-course-2026",
      courseId: "software-engineering-project",
      learnerHash: "stu_hash_live_028",
      learnerAlias: "SE-028",
      repository: "se-course/rest-api-lab",
      branch: "feature/order-error-handling",
      prUrl: "https://github.com/se-course/rest-api-lab/pull/28",
      ciRunUrl: "https://github.com/se-course/rest-api-lab/actions/runs/10280028",
      ciProvider: "GitHub Actions",
      ciLogSummary: "CI failed: POST /orders with empty body returned 500; missing tests for null body, oversized payload and permission exception.",
      courseClass: "软件工程 2301",
      courseName: "REST API 错误处理与边界测试",
      owner: "张老师",
    },
  },
  ({ status, data }) => {
    assert(status === 200, "GitHub import should return 200");
    assert(data.source === "github-ci", "source should be github-ci");
    assert(data.workOrder.id.startsWith("wo-live-"), "import should create a live work order");
    assert(data.integrationEvent?.source === "github-ci", "manual GitHub import should write an integration event");
    assert(data.integrationEvent?.workOrderId === data.workOrder.id, "manual GitHub integration event should point to the work order");
    assert(data.workOrder.returnToken?.startsWith("return_"), "teacher GitHub import response should include a student return token");
    assert(data.snapshot.workOrders.some((order) => order.id === data.workOrder.id), "imported work order should be in snapshot");
  },
);

const batchGithubPayload = {
  tenantId: "tenant-se-course-2026",
  courseId: "software-engineering-project",
  idempotencyKey: "github-batch-smoke-20260830",
  importedEvents: [
    {
      learnerHash: "stu_hash_batch_041",
      learnerAlias: "SE-041",
      repository: "se-course/rest-api-lab",
      branch: "feature/batch-null-body",
      prUrl: "https://github.com/se-course/rest-api-lab/pull/41",
      ciRunUrl: "https://github.com/se-course/rest-api-lab/actions/runs/10280041",
      ciProvider: "GitHub Actions",
      ciLogSummary: "CI failed: null body path returns 500 and missing minimum failing case.",
      trigger: "PR #41 CI failed",
      courseClass: "SE 2301",
      courseName: "REST API error handling and boundary testing",
      owner: "Teacher Zhang",
    },
    {
      learnerHash: "stu_hash_batch_042",
      learnerAlias: "SE-042",
      repository: "se-course/rest-api-lab",
      branch: "feature/batch-permission",
      prUrl: "https://github.com/se-course/rest-api-lab/pull/42",
      ciRunUrl: "https://github.com/se-course/rest-api-lab/actions/runs/10280042",
      ciProvider: "GitHub Actions",
      ciLogSummary: "CI failed: permission exception path lacks contract regression evidence.",
      trigger: "PR #42 CI failed",
      courseClass: "SE 2301",
      courseName: "REST API error handling and boundary testing",
      owner: "Teacher Zhang",
    },
  ],
};

await check(
  "GitHub CI batch import creates work orders",
  "/api/integrations/github/batch-import",
  { method: "POST", headers: teacherHeaders, body: batchGithubPayload },
  ({ status, data }) => {
    assert(status === 200, "GitHub batch import should return 200");
    assert(data.source === "github-ci-batch", "source should be github-ci-batch");
    assert(data.createdCount === 2, "GitHub batch import should create two work orders");
    assert(data.skippedCount === 0, "first GitHub batch import should not skip records");
    assert(data.integrationEvent?.createdCount === 2, "batch import should write an integration event count");
    assert(data.workOrders.every((order) => order.id.startsWith("wo-live-")), "batch import should create live work orders");
    assert(
      data.workOrders.every((order) => data.snapshot.ledger[order.id]?.[0]?.type === "intake"),
      "batch imported work orders should have intake ledger entries",
    );
  },
);

await check(
  "GitHub CI batch import privacy blocked",
  "/api/integrations/github/batch-import",
  {
    method: "POST",
    headers: teacherHeaders,
    body: {
      ...batchGithubPayload,
      idempotencyKey: "github-batch-smoke-privacy",
      importedEvents: [{ ...batchGithubPayload.importedEvents[0], learnerHash: "stu_hash_batch_043", rawLog: "raw failure log" }],
    },
  },
  ({ status, data }) => {
    assert(status === 422, "rawLog should be blocked in GitHub batch import");
    assert(data.error === "privacy_blocked", "privacy blocked error expected");
  },
);

const signedWebhookPayload = {
  tenantId: "tenant-se-course-2026",
  courseId: "software-engineering-project",
  learnerHash: "stu_hash_live_031",
  learnerAlias: "SE-031",
  deliveryId: "github-delivery-031",
  repository: "se-course/rest-api-lab",
  branch: "feature/error-contract",
  prUrl: "https://github.com/se-course/rest-api-lab/pull/31",
  ciRunUrl: "https://github.com/se-course/rest-api-lab/actions/runs/10280031",
  ciProvider: "GitHub Actions",
  ciLogSummary: "CI failed: contract response changed from 400 to 500; missing regression cases for empty body and permission exception.",
  courseClass: "软件工程 2301",
  courseName: "REST API 错误处理与边界测试",
  owner: "张老师",
};
const signedWebhookBody = JSON.stringify(signedWebhookPayload);

await check(
  "GitHub CI webhook signature creates work order",
  "/api/webhooks/github/ci",
  {
    method: "POST",
    headers: githubSignatureHeaders(signedWebhookBody, "github-delivery-031"),
    body: signedWebhookBody,
  },
  ({ status, data }) => {
    assert(status === 200, "GitHub webhook should return 200");
    assert(data.source === "github-webhook", "source should be github-webhook");
    assert(data.authMode === "github-signature", "webhook should use GitHub HMAC signature");
    assert(data.integrationEvent?.authMode === "github-signature", "signed webhook should write its auth mode to integration status");
    assert(data.workOrder.status === "diagnosis", "webhook should create a diagnosis-stage work order");
    assert(data.snapshot.workOrders.some((order) => order.id === data.workOrder.id), "webhook order should be in snapshot");
  },
);

await check(
  "GitHub CI webhook bad signature blocked",
  "/api/webhooks/github/ci",
  {
    method: "POST",
    headers: {
      "x-github-delivery": "github-delivery-bad-signature",
      "x-github-event": "workflow_run",
      "x-hub-signature-256": "sha256=bad",
    },
    body: signedWebhookBody,
  },
  ({ status, data }) => {
    assert(status === 401, "bad GitHub webhook signature should be unauthorized");
    assert(data.reason === "bad_github_signature", "bad GitHub webhook signature reason expected");
  },
);

await check(
  "GitHub CI webhook legacy token creates work order",
  "/api/webhooks/github/ci",
  {
    method: "POST",
    headers: {
      "x-sepath-webhook-token": githubWebhookToken,
    },
    body: {
      ...signedWebhookPayload,
      learnerHash: "stu_hash_live_032",
      learnerAlias: "SE-032",
      deliveryId: "github-delivery-032",
      prUrl: "https://github.com/se-course/rest-api-lab/pull/32",
      ciRunUrl: "https://github.com/se-course/rest-api-lab/actions/runs/10280032",
    },
  },
  ({ status, data }) => {
    assert(status === 200, "legacy SE-Path webhook token should still work");
    assert(data.authMode === "sepath-webhook-token", "legacy webhook should expose token auth mode");
    assert(data.integrationEvent?.authMode === "sepath-webhook-token", "legacy webhook should write token mode to integration status");
    assert(data.source === "github-webhook", "legacy token source should be github-webhook");
  },
);

await check(
  "GitHub integration status readback",
  "/api/integrations/github/status?tenantId=tenant-se-course-2026&courseId=software-engineering-project&limit=8",
  { headers: teacherHeaders },
  ({ status, data }) => {
    assert(status === 200, "GitHub integration status should return 200");
    assert(data.provider === "github", "integration status should be scoped to GitHub");
    assert(data.summary.health === "receiving", "integration status should show that events have been received");
    assert(data.summary.successfulCount >= 4, "integration status should count successful imports");
    assert(
      data.events.some((event) => event.source === "github-ci-batch" && event.createdCount === 2),
      "integration status should include batch import details",
    );
    assert(
      data.events.some((event) => event.authMode === "github-signature"),
      "integration status should include signed webhook evidence",
    );
  },
);

await check(
  "learner profile read",
  "/api/learners/stu_hash_8f2a/profile?tenantId=tenant-se-course-2026&courseId=software-engineering-project",
  { headers: teacherHeaders },
  ({ status, data }) => {
    assert(status === 200, "learner profile should return 200");
    assert(data.profile.learnerHash === "stu_hash_8f2a", "profile learnerHash mismatch");
    assert(data.profile.boundary.includes("形成性诊断"), "profile should expose formative boundary");
    assert(
      data.profile.valueAddedSnapshots?.some((snapshot) => snapshot.workOrderId === "wo-se-018"),
      "profile should include teacher-accepted value-added snapshots",
    );
  },
);

await check(
  "closed ledger export includes value-added snapshot",
  "/api/exports/ledger",
  {
    method: "POST",
    headers: teacherHeaders,
    body: {
      tenantId: "tenant-se-course-2026",
      courseId: "software-engineering-project",
      workOrderId: "wo-se-018",
    },
  },
  ({ status, data }) => {
    assert(status === 200, "closed ledger export should return 200");
    assert(data.valueAddedSnapshot?.workOrderId === "wo-se-018", "closed export should expose value-added snapshot");
    assert(
      data.workOrder.valueAddedSnapshot?.basisEvidenceIds?.length >= 5,
      "closed export should keep snapshot evidence basis IDs",
    );
  },
);

await check(
  "ledger export",
  "/api/exports/ledger",
  {
    method: "POST",
    headers: teacherHeaders,
    body: {
      tenantId: "tenant-se-course-2026",
      courseId: "software-engineering-project",
      workOrderId: importedWorkOrder.workOrder.id,
    },
  },
  ({ status, data }) => {
    assert(status === 200, "ledger export should return 200");
    assert(data.exportType === "teacher_evidence_ledger", "ledger export type mismatch");
    assert(data.workOrder.id === importedWorkOrder.workOrder.id, "exported work order mismatch");
    assert(!data.workOrder.returnToken, "ledger export must not expose live student return tokens");
    assert(data.boundary.includes("AI 只提供候选建议"), "export should keep AI boundary");
  },
);

const createdEvidence = await check(
  "evidence create",
  "/api/evidence/events",
  { method: "POST", headers: teacherHeaders, body: evidencePayload },
  ({ status, data }) => {
    assert(status === 200, "evidence create should return 200");
    assert(data.eventId?.startsWith("evt_"), "eventId missing");
    assert(data.qualityGate === "pass", "quality gate should pass");
    assert(data.stored === true, "evidence should be stored in smoke store");
  },
);

await check(
  "evidence readback",
  "/api/evidence/events?tenantId=tenant-se-course-2026&courseId=software-engineering-project&learnerHash=stu_hash_8f2a",
  { headers: teacherHeaders },
  ({ status, data }) => {
    assert(status === 200, "evidence readback should return 200");
    assert(data.stored === true, "evidence readback should use smoke store");
    assert(data.events.some((event) => event.eventId === createdEvidence.eventId), "created event should be readable");
  },
);

await check(
  "reviewer write blocked",
  "/api/evidence/events",
  { method: "POST", headers: reviewerHeaders, body: { ...evidencePayload, externalId: "reviewer-write" } },
  ({ status, data }) => {
    assert(status === 403, "reviewer write should be forbidden");
    assert(data.error === "forbidden", "forbidden error expected");
    assert(data.role === "reviewer", "role should be reviewer");
  },
);

await check(
  "missing token blocked",
  "/api/evidence/events",
  { method: "POST", body: { ...evidencePayload, externalId: "missing-token" } },
  ({ status, data }) => {
    assert(status === 401, "missing token should be unauthorized");
    assert(data.error === "unauthorized", "unauthorized error expected");
    assert(data.reason === "missing_token", "missing token reason expected");
  },
);

await check(
  "bad signature blocked",
  "/api/evidence/events",
  { method: "POST", headers: badTokenHeaders, body: { ...evidencePayload, externalId: "bad-signature" } },
  ({ status, data }) => {
    assert(status === 401, "bad signature should be unauthorized");
    assert(data.error === "unauthorized", "unauthorized error expected");
    assert(data.reason === "bad_signature" || data.reason === "bad_token_format", "bad token reason expected");
  },
);

await check(
  "student wide evidence read blocked",
  "/api/evidence/events?tenantId=tenant-se-course-2026&courseId=software-engineering-project",
  { headers: studentHeaders },
  ({ status, data }) => {
    assert(status === 403, "student wide evidence read should be forbidden");
    assert(data.error === "forbidden", "forbidden error expected");
    assert(data.role === "student", "role should be student");
  },
);

await check(
  "privacy protected-field block",
  "/api/evidence/events",
  {
    method: "POST",
    headers: teacherHeaders,
    body: {
      ...evidencePayload,
      externalId: "run_with_secret",
      payload: { rawLog: "do not accept raw CI logs" },
    },
  },
  ({ status, data }) => {
    assert(status === 422, "protected field should be blocked");
    assert(data.error === "privacy_blocked", "privacy error expected");
    assert(data.findings.includes("payload.rawLog"), "rawLog finding expected");
  },
);

await check(
  "diagnosis read",
  "/api/learners/stu_hash_8f2a/diagnosis?tenantId=tenant-se-course-2026&courseId=software-engineering-project",
  { headers: teacherHeaders },
  ({ status, data }) => {
    assert(status === 200, "diagnosis should return 200");
    assert(data.blocker.includes("测试边界"), "diagnosis blocker should mention testing boundary");
  },
);

await check(
  "intervention rank",
  "/api/interventions/rank",
  {
    method: "POST",
    headers: teacherHeaders,
    body: {
      tenantId: "tenant-se-course-2026",
      courseId: "software-engineering-project",
      learnerHash: "stu_hash_8f2a",
      diagnosisId: "diag-testing-boundary",
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
  },
  ({ status, data }) => {
    assert(status === 200, "rank should return 200");
    assert(data.rankedActions[0].id === "mini-lab", "safe action should rank first");
    assert(data.blockedActions[0].blockedReason === "DIRECT_ANSWER_POLICY_GATE", "direct answer should be blocked");
    assert(data.teacherReviewRequired === true, "teacher review should be required");
  },
);

const createdTicket = await check(
  "review ticket create",
  "/api/review/tickets",
  {
    method: "POST",
    headers: teacherHeaders,
    body: {
      tenantId: "tenant-se-course-2026",
      courseId: "software-engineering-project",
      learnerHash: "stu_hash_8f2a",
      severity: "high",
      reasonCodes: ["DIRECT_ANSWER_POLICY_GATE", "HIGH_RISK_SCAFFOLD"],
    },
  },
  ({ status, data }) => {
    assert(status === 200, "ticket should return 200");
    assert(data.status === "pending_teacher_review", "ticket should wait for teacher");
    assert(data.stored === true, "review ticket should be stored in smoke store");
    assert(data.requiredActions.includes("do not publish direct answer"), "ticket should keep no-direct-answer rule");
  },
);

await check(
  "review ticket readback",
  "/api/review/tickets?tenantId=tenant-se-course-2026&courseId=software-engineering-project&learnerHash=stu_hash_8f2a",
  { headers: teacherHeaders },
  ({ status, data }) => {
    assert(status === 200, "review ticket readback should return 200");
    assert(data.stored === true, "ticket readback should use smoke store");
    assert(data.tickets.some((ticket) => ticket.ticketId === createdTicket.ticketId), "created ticket should be readable");
  },
);

await check(
  "ledger import validation",
  "/api/ledgers/import",
  {
    method: "POST",
    headers: systemHeaders,
    body: {
      tenantId: "tenant-se-course-2026",
      ledgerSha256: "sha256-pilot-ledger",
      events: [
        { id: "evt-1", type: "ci_failed", traceId: "trace-1" },
        { id: "evt-1", type: "ci_failed", traceId: "trace-1" },
        { id: "", type: "bad" },
      ],
    },
  },
  ({ status, data }) => {
    assert(status === 200, "ledger import should return 200");
    assert(data.importedEvents === 1, "one unique valid event should be imported");
    assert(data.duplicateEvents === 1, "duplicate should be detected");
    assert(data.invalidEvents === 1, "invalid event should be detected");
  },
);

await check(
  "privacy audit",
  "/api/privacy/audit?tenantId=tenant-se-course-2026&courseId=software-engineering-project",
  { headers: reviewerHeaders },
  ({ status, data }) => {
    assert(status === 200, "privacy audit should return 200");
    assert(data.gate === "pass", "privacy gate should pass");
    assert(data.blockedRequests.includes("view_student_pii"), "reviewer PII access should be blocked");
  },
);

const report = {
  generatedAt: new Date().toISOString(),
  runtime: "sepath-edge-api.v1",
  mode,
  summary: {
    pass: rows.length,
    fail: 0,
    endpointsCovered: rows.length,
  },
  rows,
};

const out = resolve(process.env.SEPATH_EDGE_API_REPORT || "qa/edge-api-smoke-report.json");
await writeFile(out, JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify(report.summary, null, 2));
