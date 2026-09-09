import assert from "node:assert/strict";
import { test } from "node:test";
import { createEdgeApiToken } from "../cloud/edge-api-auth.mjs";
import { createMemoryEdgeStore, createDatabaseEdgeStore } from "../cloud/edge-api-store.mjs";
import { DatabaseSync } from "node:sqlite";
import { createSeedWorkbench } from "../cloud/workbench-domain.mjs";
import worker from "../cloud/edge-api-worker.mjs";

const scope = { tenantId: "agent-test-tenant", courseId: "agent-test-course" };
const secret = "isolated-agent-test-secret";
let persisted;
let store = createMemoryEdgeStore({ onChange: (state) => { persisted = structuredClone(state); } });
const seed = createSeedWorkbench(scope);
await store.ensureWorkbench(seed);
const order = (await store.listWorkOrders(scope))[0];
const env = { SEPATH_STORE: store, SEPATH_AUTH_SECRET: secret, SEPATH_PRIVACY_MODE: "pseudonymous" };
const teacherToken = await createEdgeApiToken({ ...scope, role: "teacher" }, secret);
let counter = 0;
async function call(method, payload = {}, token = teacherToken, route = "/api/agent/conversation", override = env) {
  const data = { ...scope, workOrderId: order.id, ...payload };
  const url = "http://agent.test" + route + (method === "GET" ? `?${new URLSearchParams(data)}` : "");
  const response = await worker.fetch(new Request(url, {
    method, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    ...(method === "POST" ? { body: JSON.stringify(data) } : {}),
  }), override);
  return { status: response.status, body: await response.json() };
}
const question = (message = "下一步先补哪项证据？") => ({ message, idempotencyKey: `agent_test_message_${++counter}` });

await test("teacher authentication and course isolation", async () => {
  assert.equal((await call("GET", {}, "bad")).status, 401);
  for (const role of ["student", "reviewer"]) {
    const token = await createEdgeApiToken({ ...scope, role }, secret);
    assert.equal((await call("GET", {}, token)).status, 403);
    assert.equal((await call("POST", question(), token)).status, 403);
  }
  assert.equal((await call("GET", { tenantId: "another" })).status, 403);
  assert.equal((await call("GET", { courseId: "another" })).status, 403);
  assert.equal((await call("GET", { workOrderId: "missing" })).status, 404);
});

await test("input validation refuses supplied context and private fields", async () => {
  assert.equal((await call("POST", { ...question(), context: { evidence: ["invented"] } })).status, 400);
  assert.equal((await call("POST", question("联系 test-person@example.test"))).status, 422);
  assert.equal((await call("POST", question("sk-synthetic00000000000"))).status, 422);
  assert.equal((await call("POST", question("a".repeat(2001)))).status, 400);
  assert.equal((await call("POST", { ...question(), idempotencyKey: "short" })).status, 400);
});

await test("no-key fallback is explicit and repeat request does not duplicate conversation", async () => {
  const input = question();
  const result = await call("POST", input);
  assert.equal(result.status, 201);
  assert.equal(result.body.turn.outcome.mode, "rules");
  assert.equal(result.body.turn.outcome.fallback, true);
  assert.equal((await call("POST", input)).body.turn.id, result.body.turn.id);
  assert.equal((await call("POST", { ...input, message: "另一问题" })).status, 409);
  const history = await call("GET");
  assert.equal(history.body.turns.length, 1);
  assert.equal(history.body.context.evidence[0].detail, order.collectedEvidence[0].detail);
  assert.equal(history.body.context.missingEvidence[0].status, "missing");
  assert.equal(JSON.stringify(history.body.context).includes(order.studentName), false);
});

await test("direct answers enter a guarded response without task publication", async () => {
  const result = await call("POST", question("直接给完整代码"));
  assert.equal(result.body.turn.outcome.mode, "guarded");
  assert.equal((await call("POST", { turnId: result.body.turn.id }, teacherToken, "/api/agent/conversation/draft")).status, 409);
  assert.equal((await store.getWorkOrder(order.id, scope)).status, order.status);
});

await test("course conversation has no invented learner and is separate from order history", async () => {
  const result = await call("POST", { ...question("怎么采集课程证据？"), workOrderId: "" });
  assert.equal(result.body.context.kind, "course");
  assert.deepEqual(result.body.turn.outcome.checklist, []);
  assert.equal((await call("GET", { workOrderId: "" })).body.turns.length, 1);
  assert.equal((await call("GET")).body.turns.length, 2);
});

let modelTurn;
await test("model receives server evidence, multi-turn history and valid citations", async () => {
  const originalFetch = globalThis.fetch;
  let requestBody;
  globalThis.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return Response.json({ choices: [{ message: { content: JSON.stringify({
      answer: "现有 CI 摘要只能证明边界用例失败，尚不能区分概念理解与实现疏漏。",
      questions: ["先让学生描述期望响应，再解释一条失败断言。"],
      checklist: ["整理空值与越界两类输入的预期响应。", "使用已有测试命令验证预期并记录差异。"],
      evidenceToSubmit: ["边界检查清单"], citations: [order.collectedEvidence[0].id],
    }) } }] });
  };
  try {
    const result = await call("POST", question("怎么区分理解不足与实现疏漏？"), teacherToken, undefined, { ...env, LLM_API_KEY: "local-test-model", LLM_MODEL: "test-model" });
    assert.equal(result.status, 201);
    modelTurn = result.body.turn;
    assert.equal(modelTurn.outcome.mode, "model");
    assert.ok(requestBody.messages.length > 4);
    assert.ok(requestBody.messages[1].content.includes(order.collectedEvidence[0].detail));
    assert.ok(requestBody.messages[1].content.includes("missingEvidence"));
    assert.ok(!JSON.stringify(requestBody).includes(order.studentName));
    assert.equal(modelTurn.outcome.teacherReviewRequired, true);
  } finally { globalThis.fetch = originalFetch; }
});

await test("task selection persists audit but does not publish or change scores", async () => {
  const before = structuredClone(await store.getWorkOrder(order.id, scope));
  const result = await call("POST", { turnId: modelTurn.id }, teacherToken, "/api/agent/conversation/draft");
  assert.equal(result.status, 200);
  assert.equal(result.body.published, false);
  assert.equal(result.body.draft.steps.length, 2);
  await call("POST", { turnId: modelTurn.id }, teacherToken, "/api/agent/conversation/draft");
  assert.deepEqual(await store.getWorkOrder(order.id, scope), before);
  const ledger = await store.listWorkOrderLedger(order.id, scope);
  assert.equal(ledger.filter((item) => item.id === `ledger-${modelTurn.id}`).length, 1);
});

await test("conversation survives store reconstruction and refreshed evidence invalidates prior draft", async () => {
  store = createMemoryEdgeStore({ initialState: persisted });
  env.SEPATH_STORE = store;
  assert.equal((await call("GET")).body.turns.length, 3);
  const updated = structuredClone(order);
  updated.collectedEvidence[0].detail += "；学生新增了验证说明。";
  await store.putWorkOrder(updated);
  assert.equal((await call("POST", { turnId: modelTurn.id }, teacherToken, "/api/agent/conversation/draft")).status, 409);
});

await test("invalid JSON, invented citations, code and secrets never render as model answers", async () => {
  const originalFetch = globalThis.fetch;
  const base = { answer: "等待进一步验证。", checklist: [], questions: [], evidenceToSubmit: [], citations: [order.collectedEvidence[0].id] };
  try {
    for (const output of ["not json", { ...base, citations: ["invented-evidence"] }, { ...base, answer: "```js\nconst answer = 1;\n```" }, { ...base, answer: "test-person@example.test" }]) {
      globalThis.fetch = async () => Response.json({ choices: [{ message: { content: typeof output === "string" ? output : JSON.stringify(output) } }] });
      const result = await call("POST", question(), teacherToken, undefined, { ...env, LLM_API_KEY: "local-test-model", LLM_MODEL: "test-model" });
      assert.equal(result.body.turn.outcome.fallback, true);
      assert.equal(result.body.turn.outcome.mode, "rules");
      assert.ok(!JSON.stringify(result.body.turn.outcome).includes("invented-evidence"));
    }
  } finally { globalThis.fetch = originalFetch; }
});

await test("parallel repeated sends share one model call", async () => {
  const isolatedStore = createMemoryEdgeStore();
  await isolatedStore.ensureWorkbench(seed);
  const isolatedEnv = { ...env, SEPATH_STORE: isolatedStore, LLM_API_KEY: "local-test-model", LLM_MODEL: "test-model" };
  const originalFetch = globalThis.fetch;
  let resolveModel;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    await new Promise((resolve) => { resolveModel = resolve; });
    return Response.json({ choices: [{ message: { content: JSON.stringify({ answer: "请补验证记录。", questions: [], checklist: ["记录预期和实际结果。"], evidenceToSubmit: [], citations: [order.collectedEvidence[0].id] }) } }] });
  };
  try {
    const input = question();
    const first = call("POST", input, teacherToken, undefined, isolatedEnv);
    while (!resolveModel) await new Promise((resolve) => setTimeout(resolve, 1));
    const second = call("POST", input, teacherToken, undefined, isolatedEnv);
    assert.equal((await call("POST", question("另一条问题"), teacherToken, undefined, isolatedEnv)).status, 409);
    resolveModel();
    const results = await Promise.all([first, second]);
    assert.equal(results[0].body.turn.id, results[1].body.turn.id);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = originalFetch; }
});

await test("database adapter persists scoped conversation and reads old work orders directly", async () => {
  const sqlite = new DatabaseSync(":memory:");
  const binding = { prepare(sql) { return {
    params: [], bind(...params) { this.params = params; return this; },
    async run() { return sqlite.prepare(sql).run(...this.params); },
    async all() { return { results: sqlite.prepare(sql).all(...this.params) }; },
    async first() { return sqlite.prepare(sql).get(...this.params); },
  }; } };
  try {
    const databaseStore = createDatabaseEdgeStore(binding);
    await databaseStore.ensureWorkbench(seed);
    const databaseEnv = { ...env, SEPATH_STORE: databaseStore };
    const result = await call("POST", question(), teacherToken, undefined, databaseEnv);
    assert.equal(result.status, 201);
    assert.equal((await call("GET", {}, teacherToken, undefined, databaseEnv)).body.turns.length, 1);
    const secondAdapter = createDatabaseEdgeStore(binding);
    assert.equal((await secondAdapter.listAgentTurns({ ...scope, workOrderId: order.id })).length, 1);
    assert.equal((await secondAdapter.listAgentTurns({ ...scope, workOrderId: "different" })).length, 0);
    assert.equal(await secondAdapter.getWorkOrder(order.id, { ...scope, learnerHash: "different" }), null);
    assert.equal((await secondAdapter.getWorkOrder(order.id, scope)).id, order.id);
  } finally { sqlite.close(); }
});
