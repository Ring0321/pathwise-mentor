import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const apiBase = (process.env.SEPATH_API_BASE || "http://212.129.243.63").replace(/\/$/, "");
const tenantId = process.env.SEPATH_TENANT_ID || "tenant-se-course-2026";
const courseId = process.env.SEPATH_COURSE_ID || "software-engineering-project";
const accessCodePath = process.env.SEPATH_TEACHER_ACCESS_CODE_FILE || join(homedir(), ".codex", "secrets", "sepath-teacher-access-code.txt");
const force = process.env.SEPATH_BOOTSTRAP_FORCE === "true";

async function readAccessCode() {
  const fromEnv = String(process.env.SEPATH_TEACHER_ACCESS_CODE || "").trim();
  if (fromEnv) return fromEnv;
  try {
    return (await readFile(accessCodePath, "utf8")).trim();
  } catch {
    throw new Error("SEPATH_TEACHER_ACCESS_CODE or SEPATH_TEACHER_ACCESS_CODE_FILE is required");
  }
}

async function request(path, { method = "GET", token = "", body } = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    const message = data?.message || data?.error || response.statusText;
    throw new Error(`${method} ${path} failed: ${response.status} ${message}`);
  }
  return data;
}

async function teacherLogin() {
  const accessCode = await readAccessCode();
  const data = await request("/api/auth/teacher-login", {
    method: "POST",
    body: { tenantId, courseId, accessCode, ttlSeconds: 14400 },
  });
  if (!data.accessToken) throw new Error("teacher login did not return an access token");
  return data.accessToken;
}

function launchPayload() {
  return {
    tenantId,
    courseId,
    settings: {
      courseClass: "软件工程 2301",
      courseName: "REST API 错误处理与边界测试",
      repository: "se-course/rest-api-lab",
      ciProvider: "GitHub Actions",
      privacyPolicy: "仅保存脱敏后的 PR/CI 摘要、对话摘要、反思摘要和教师复核记录；不保存真实身份、联系方式、密钥或原始日志。",
    },
    learners: [
      { learnerHash: "stu_hash_lzx0321", learnerAlias: "LZX-0321", className: "软件工程 2301", groupName: "订单服务组", repositoryUser: "lzx0321" },
      { learnerHash: "stu_hash_zyr0426", learnerAlias: "ZYR-0426", className: "软件工程 2301", groupName: "事务一致性组", repositoryUser: "zyr0426" },
      { learnerHash: "stu_hash_wyh0612", learnerAlias: "WYH-0612", className: "软件工程 2301", groupName: "权限契约组", repositoryUser: "wyh0612" },
      { learnerHash: "stu_hash_hmx1108", learnerAlias: "HMX-1108", className: "软件工程 2301", groupName: "评审质量组", repositoryUser: "hmx1108" },
      { learnerHash: "stu_hash_lqy0920", learnerAlias: "LQY-0920", className: "软件工程 2301", groupName: "测试覆盖组", repositoryUser: "lqy0920" },
    ],
    selectedLearnerHashes: ["stu_hash_lzx0321", "stu_hash_zyr0426", "stu_hash_wyh0612"],
    task: {
      courseClass: "软件工程 2301",
      courseName: "REST API 错误处理与边界测试",
      trigger: "第 4 周 PR/CI 学习事件巡检",
      eventDate: "2026-09-09",
      owner: "任课教师",
      focus: "boundary",
      risk: "medium",
      taskSummary: "从 PR、CI、测试清单、课堂求助和学习反思中收集证据；证据不足时只生成候选诊断单，由教师确认下一步。",
      evidenceCoverage: 30,
      currentLevel: 50,
      expectedLevel: 58,
    },
    idempotencyKey: "tencent-pilot-course-launch-20260909-v1",
  };
}

function githubBatchPayload() {
  return {
    tenantId,
    courseId,
    idempotencyKey: "tencent-pilot-github-ci-20260909-v1",
    importedEvents: [
      {
        learnerHash: "stu_hash_lzx0321",
        learnerAlias: "LZX-0321",
        repository: "se-course/rest-api-lab",
        branch: "feature/order-error-boundary",
        prUrl: "https://github.com/se-course/rest-api-lab/pull/18",
        ciRunUrl: "https://github.com/se-course/rest-api-lab/actions/runs/202609090018",
        ciProvider: "GitHub Actions",
        ciLogSummary: "CI failed: POST /orders with empty body returned 500; missing regression tests for null body, oversized payload and permission exception.",
        trigger: "PR #18 CI 失败",
        eventDate: "2026-09-09",
        courseClass: "软件工程 2301",
        courseName: "REST API 错误处理与边界测试",
        owner: "任课教师",
      },
      {
        learnerHash: "stu_hash_zyr0426",
        learnerAlias: "ZYR-0426",
        repository: "se-course/rest-api-lab",
        branch: "feature/transaction-rollback",
        prUrl: "https://github.com/se-course/rest-api-lab/pull/27",
        ciRunUrl: "https://github.com/se-course/rest-api-lab/actions/runs/202609090027",
        ciProvider: "GitHub Actions",
        ciLogSummary: "CI failed: transaction rollback assertion is missing after duplicate order submit; retry path has no minimum failing case.",
        trigger: "PR #27 事务回滚验证失败",
        eventDate: "2026-09-09",
        courseClass: "软件工程 2301",
        courseName: "REST API 错误处理与边界测试",
        owner: "任课教师",
      },
      {
        learnerHash: "stu_hash_wyh0612",
        learnerAlias: "WYH-0612",
        repository: "se-course/rest-api-lab",
        branch: "feature/permission-contract",
        prUrl: "https://github.com/se-course/rest-api-lab/pull/31",
        ciRunUrl: "https://github.com/se-course/rest-api-lab/actions/runs/202609090031",
        ciProvider: "GitHub Actions",
        ciLogSummary: "CI failed: contract response changed from 403 to 500; permission exception path lacks contract regression evidence.",
        trigger: "PR #31 权限契约回归失败",
        eventDate: "2026-09-09",
        courseClass: "软件工程 2301",
        courseName: "REST API 错误处理与边界测试",
        owner: "任课教师",
      },
    ],
  };
}

async function workbench(token) {
  return request(`/api/workbench/teacher/today?tenantId=${encodeURIComponent(tenantId)}&courseId=${encodeURIComponent(courseId)}`, { token });
}

async function main() {
  const token = await teacherLogin();
  const before = await workbench(token);
  let launch = null;
  let github = null;

  if (force || !before.workOrders?.length) {
    launch = await request("/api/course/launch", { method: "POST", token, body: launchPayload() });
  }

  github = await request("/api/integrations/github/batch-import", { method: "POST", token, body: githubBatchPayload() });
  const snapshot = await workbench(token);
  const selected =
    snapshot.workOrders?.find((order) => String(order.trigger || "").includes("PR #18")) ||
    snapshot.workOrders?.find((order) => order.status !== "closed") ||
    snapshot.workOrders?.[0];
  if (!selected?.id) throw new Error("bootstrap finished but no work order is available");

  const context = await request(
    `/api/agent/conversation?tenantId=${encodeURIComponent(tenantId)}&courseId=${encodeURIComponent(courseId)}&workOrderId=${encodeURIComponent(selected.id)}`,
    { token },
  );
  const message = await request("/api/agent/conversation", {
    method: "POST",
    token,
    body: {
      tenantId,
      courseId,
      workOrderId: selected.id,
      idempotencyKey: `bootstrap_${Date.now().toString(36)}`,
      message: "下一步最值得补哪条证据？请给出依据、教师复核要点和可发给学生的学习步骤。",
    },
  });

  let draft = null;
  if (message.turn?.outcome?.checklist?.length && message.turn?.outcome?.mode !== "guarded") {
    draft = await request("/api/agent/conversation/draft", {
      method: "POST",
      token,
      body: { tenantId, courseId, workOrderId: selected.id, turnId: message.turn.id },
    });
  }

  console.log(
    JSON.stringify(
      {
        apiBase,
        login: "ok",
        beforeOrders: before.workOrders?.length || 0,
        launchCreated: launch?.createdCount ?? null,
        githubCreated: github?.createdCount ?? null,
        githubSkipped: github?.skippedCount ?? null,
        currentOrders: snapshot.workOrders?.length || 0,
        selectedOrder: selected.id,
        selectedTrigger: selected.trigger,
        contextKind: context.context?.kind,
        evidenceCount: context.context?.evidence?.length || 0,
        missingEvidenceCount: context.context?.missingEvidence?.length || 0,
        agentMode: message.turn?.outcome?.mode,
        agentFallback: message.turn?.outcome?.fallback,
        agentReason: message.turn?.outcome?.reason || "",
        citations: message.turn?.outcome?.citations?.length || 0,
        answerPreview: String(message.turn?.outcome?.answer || "").slice(0, 120),
        teacherReviewRequired: message.turn?.outcome?.teacherReviewRequired,
        draftPrepared: Boolean(draft?.draft),
        draftPublished: Boolean(draft?.published),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
