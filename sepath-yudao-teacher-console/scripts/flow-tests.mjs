import { spawn } from "node:child_process";
import { mkdir, readdir, readFile, rm } from "node:fs/promises";
import http from "node:http";
import path from "node:path";

const chromePath =
  process.env.CHROME_PATH ??
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const appPort = Number(process.env.SEPATH_TEST_APP_PORT ?? 5312);
const cdpPort = Number(process.env.SEPATH_TEST_CDP_PORT ?? 9512);
const apiBase = process.env.SEPATH_TEST_API_BASE ?? "";
const apiMode = Boolean(apiBase);
const firstLearnerLabel = apiMode ? "LZX-0321" : "林知行";
const secondLearnerLabel = apiMode ? "ZYR-0426" : "周亦然";
const appQuery = new URLSearchParams({ wo: "wo-se-018" });
if (apiBase) appQuery.set("api", apiBase);
const appUrl = `http://127.0.0.1:${appPort}/?${appQuery.toString()}`;
const reviewerQuery = new URLSearchParams({ mode: "reviewer" });
if (apiBase) reviewerQuery.set("api", apiBase);
const reviewerUrl = `http://127.0.0.1:${appPort}/?${reviewerQuery.toString()}`;
const storageKey = "sepath-yudao-workbench:glass-v1";
const rosterStorageKey = "sepath-yudao-course-roster:v1";
const githubIntegrationStatusStorageKey = "sepath-yudao-github-integration-status:v1";
const downloadDir = path.resolve("qa/downloads", `flow-tests-${appPort}-${cdpPort}`);
const userDataDir = path.join(
  process.env.TEMP ?? ".",
  `sepath-flow-cdp-${Date.now()}`,
);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function getText(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (response) => {
        let data = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          data += chunk;
        });
        response.on("end", () =>
          resolve({ statusCode: response.statusCode, data }),
        );
      })
      .on("error", reject);
  });
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (response) => {
        let data = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          data += chunk;
        });
        response.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(error);
          }
        });
      })
      .on("error", reject);
  });
}

async function waitForServer() {
  const started = Date.now();
  while (Date.now() - started < 20_000) {
    try {
      const response = await getText(`http://127.0.0.1:${appPort}/`);
      if (response.statusCode && response.statusCode < 500) return;
    } catch {
      await sleep(250);
    }
  }
  throw new Error("Vite test server did not become ready.");
}

async function waitForPageWebSocket() {
  const started = Date.now();
  while (Date.now() - started < 10_000) {
    try {
      const pages = await getJson(`http://127.0.0.1:${cdpPort}/json`);
      const page = pages.find((item) => item.type === "page");
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      await sleep(200);
    }
    await sleep(150);
  }
  throw new Error("Chrome DevTools endpoint did not become ready.");
}

async function connectCdp(wsUrl) {
  assert(typeof WebSocket !== "undefined", "This Node.js runtime needs global WebSocket.");

  const socket = new WebSocket(wsUrl);
  const pending = new Map();
  let commandId = 0;

  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result ?? {});
  });

  function send(method, params = {}) {
    commandId += 1;
    const id = commandId;
    socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
    });
  }

  return { send, close: () => socket.close() };
}

async function evaluate(send, expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(
      result.exceptionDetails.exception?.description ??
        result.exceptionDetails.text,
    );
  }
  return result.result?.value;
}

async function waitForCondition(send, expression, message, timeout = 8_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(send, expression)) return;
    await sleep(150);
  }
  throw new Error(message);
}

async function clickTestId(send, testId) {
  await evaluate(
    send,
    `(() => {
      const node = document.querySelector('[data-testid="${testId}"]');
      if (!node) throw new Error('Missing test target: ${testId}');
      node.click();
      return true;
    })()`,
  );
  await sleep(450);
}

async function setFieldValue(send, testId, value) {
  await evaluate(
    send,
    `(() => {
      const root = document.querySelector('[data-testid="${testId}"]');
      if (!root) throw new Error('Missing form field: ${testId}');
      const field = root.matches('input, textarea')
        ? root
        : root.querySelector('input, textarea');
      if (!field) throw new Error('Missing input element for: ${testId}');
      const descriptor = Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(field),
        'value',
      );
      descriptor?.set
        ? descriptor.set.call(field, ${JSON.stringify(value)})
        : (field.value = ${JSON.stringify(value)});
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`,
  );
  await sleep(120);
}

async function acceptTeacherEvidenceReview(send, note = "证据完整，可进入形成性验收。") {
  await waitForCondition(
    send,
    "!!document.querySelector('[data-testid=\"teacher-evidence-review-panel\"]')",
    "Teacher evidence review panel did not render.",
  );
  const acceptedButtons = await evaluate(
    send,
    `(() => Array.from(
      document.querySelectorAll('[data-testid^="teacher-evidence-review-"][data-testid$="-accepted"]'),
    ).map((node) => node.getAttribute('data-testid')).filter(Boolean))()`,
  );
  assert(acceptedButtons.length > 0, "Teacher evidence review must expose accepted buttons.");
  for (const testId of acceptedButtons) {
    await clickTestId(send, testId);
  }
  await setFieldValue(send, "teacher-evidence-review-note", note);
  await clickTestId(send, "teacher-evidence-review-save");
  await waitForCondition(
    send,
    `(() => {
      const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}));
      const order = snapshot.workOrders.find((item) => item.id === snapshot.selectedId);
      return snapshot.ledger[order.id]?.[0]?.type === 'teacher_evidence_review' &&
        snapshot.ledger[order.id]?.[0]?.title.includes('可进入验收');
    })()`,
    "Teacher evidence review was not saved to the ledger.",
  );
}

async function allowDownloads(send) {
  for (const method of ["Browser.setDownloadBehavior", "Page.setDownloadBehavior"]) {
    try {
      await send(method, { behavior: "allow", downloadPath: downloadDir });
      return;
    } catch {
      // Chromium exposes download behavior on different domains by version.
    }
  }
  throw new Error("Could not configure Chrome download directory.");
}

async function listLedgerDownloads() {
  const files = await readdir(downloadDir);
  return new Set(
    files.filter((file) => file.endsWith(".json") && !file.endsWith(".crdownload")),
  );
}

async function listDownloadsByExtension(extension) {
  const files = await readdir(downloadDir);
  return new Set(
    files.filter((file) => file.endsWith(extension) && !file.endsWith(".crdownload")),
  );
}

async function waitForNewLedgerDownload(knownFiles) {
  const started = Date.now();
  while (Date.now() - started < 10_000) {
    const files = await readdir(downloadDir);
    const jsonFile = files.find(
      (file) =>
        file.endsWith(".json") &&
        !file.endsWith(".crdownload") &&
        !knownFiles.has(file),
    );
    if (jsonFile) {
      const raw = await readFile(path.join(downloadDir, jsonFile), "utf8");
      return JSON.parse(raw);
    }
    await sleep(200);
  }
  throw new Error("Ledger JSON export was not downloaded.");
}

async function waitForNewTextDownload(knownFiles, extension) {
  const started = Date.now();
  while (Date.now() - started < 10_000) {
    const files = await readdir(downloadDir);
    const textFile = files.find(
      (file) =>
        file.endsWith(extension) &&
        !file.endsWith(".crdownload") &&
        !knownFiles.has(file),
    );
    if (textFile) {
      return readFile(path.join(downloadDir, textFile), "utf8");
    }
    await sleep(200);
  }
  throw new Error(`Course report ${extension} export was not downloaded.`);
}

async function readSnapshot(send) {
  return evaluate(
    send,
    `(() => JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)})))()`,
  );
}

async function runBrowserFlow(send) {
  await send("Page.enable");
  await send("Runtime.enable");
  await allowDownloads(send);

  await send("Page.navigate", { url: appUrl });
  await waitForCondition(
    send,
    "document.readyState === 'complete' && !!document.querySelector('[data-testid=\"decision-approve\"]')",
    "Diagnosis workbench did not render.",
  );
  await evaluate(send, "localStorage.clear(); true");
  await send("Page.navigate", { url: appUrl });
  await waitForCondition(
    send,
    "document.readyState === 'complete' && !!document.querySelector('[data-testid=\"decision-approve\"]')",
    "Clean diagnosis workbench did not render.",
  );

  const initialState = await evaluate(
    send,
    `(() => ({
      returnButtonsDisabled: [
        'student-return-scaffold',
        'student-return-evidence',
        'student-return-reflection',
      ].every((id) => document.querySelector('[data-testid="' + id + '"]')?.disabled === true),
      studentLinkDisabled:
        document.querySelector('[data-testid="copy-student-link"]')?.disabled === true &&
        document.querySelector('[data-testid="open-student-link"]')?.disabled === true,
      boundaryVisible:
        document.body.innerText.includes('智能体只提供候选建议') &&
        document.body.innerText.includes('不展示完整答案'),
      hasTodayInbox:
        !!document.querySelector('[data-testid="today-task-inbox"]') &&
        document.body.innerText.includes('今日任务收件箱') &&
        document.body.innerText.includes('按风险、证据缺口和待复核动作排序'),
      hasRealWorkSurface:
        document.body.innerText.includes('增值聚焦') &&
        document.body.innerText.includes('证据账本') &&
        document.body.innerText.includes('学习改进闭环'),
    }))()`,
  );
  assert(
    initialState.returnButtonsDisabled,
    "Student return buttons must stay disabled before teacher confirmation.",
  );
  assert(
    initialState.studentLinkDisabled,
    "Student return link must stay disabled before teacher confirmation.",
  );
  assert(initialState.boundaryVisible, "Safe-VOI boundary copy must be visible.");
  assert(initialState.hasTodayInbox, "Teacher home must start from a real today task inbox.");
  assert(initialState.hasRealWorkSurface, "Workbench must show diagnosis, ledger, and loop areas.");

  const valueEngineInitial = await evaluate(
    send,
    `(() => ({
      hasStrip: !!document.querySelector('[data-testid="value-engine-strip"]'),
      hasTopEntry: !!document.querySelector('[data-testid="open-value-engine"]'),
      stripText: document.querySelector('[data-testid="value-engine-strip"]')?.innerText ?? '',
    }))()`,
  );
  assert(
    valueEngineInitial.hasStrip && valueEngineInitial.hasTopEntry,
    "Workbench must expose the value engine from the first screen.",
  );
  assert(
    valueEngineInitial.stripText.includes('\u589e\u503c\u5f15\u64ce') &&
      valueEngineInitial.stripText.includes('\u8bc1\u636e\u94fe\u9a71\u52a8') &&
      valueEngineInitial.stripText.includes('\u667a\u80fd\u4f53\u95ed\u73af'),
    "Value engine strip must show evidence-chain, value-added diagnosis and agent-loop capabilities.",
  );

  await clickTestId(send, "open-value-engine");
  await waitForCondition(
    send,
    "!!document.querySelector('[data-testid=\"value-engine-drawer\"]')",
    "Value engine drawer did not render.",
  );
  const valueEngineState = await evaluate(
    send,
    `(() => {
      const root = document.querySelector('[data-testid="value-engine-drawer"]');
      const text = root?.innerText ?? '';
      return {
        layerCount: root?.querySelectorAll('[data-testid="value-engine-layer-list"] article').length ?? 0,
        compareCount: root?.querySelectorAll('[data-testid="value-engine-compare"] article').length ?? 0,
        hasPlainToolContrast:
          text.includes('\u666e\u901a\u8bfe\u7a0b\u540e\u53f0') &&
          text.includes('\u666e\u901a\u8bc4\u5206\u7cfb\u7edf'),
        hasHumanBoundary:
          text.includes('\u6559\u5e08\u786e\u8ba4\u524d') &&
          text.includes('\u4e0d\u751f\u6210\u6392\u540d'),
      };
    })()`,
  );
  assert(valueEngineState.layerCount === 6, "Value engine drawer must explain the six-step operating loop.");
  assert(valueEngineState.compareCount === 4, "Value engine drawer must compare against ordinary tools.");
  assert(valueEngineState.hasPlainToolContrast, "Value engine drawer must make the product difference visible.");
  assert(valueEngineState.hasHumanBoundary, "Value engine drawer must retain teacher-confirmation boundaries.");
  await evaluate(send, "document.querySelector('.el-drawer__close-btn')?.click(); true");
  await sleep(300);

  await clickTestId(send, "open-agent-guide");
  await waitForCondition(
    send,
    "!!document.querySelector('[data-testid=\"teaching-agent\"]')",
    "Teaching agent did not render.",
  );
  const agentGuideState = await evaluate(
    send,
    `(() => {
      const root = document.querySelector('[data-testid="teaching-agent"]');
      const text = root?.innerText ?? '';
      return {
        hasComposer: !!root?.querySelector('[data-testid="agent-question"]'),
        hasSend: !!root?.querySelector('[data-testid="agent-send"]'),
        hasLogin: text.includes('教师登录'),
        hasBoundaries: text.includes('任务由教师确认后发布'),
      };
    })()`,
  );
  assert(agentGuideState.hasComposer && agentGuideState.hasSend, "Agent must offer a working conversation entry.");
  assert(agentGuideState.hasLogin, "Offline sessions must request teacher authentication.");
  assert(agentGuideState.hasBoundaries, "Agent must retain teacher publication boundaries.");
  await evaluate(send, "document.querySelector('.el-drawer__close-btn')?.click(); true");
  await sleep(300);

  await clickTestId(send, "open-learner-profile");
  await waitForCondition(
    send,
    "!!document.querySelector('[data-testid=\"learner-profile-drawer\"]') && document.body.innerText.includes('学生成长档案')",
    "Learner profile drawer did not render.",
  );
  const learnerProfile = await evaluate(
    send,
    `(() => ({
      summary: document.querySelector('[data-testid="learner-profile-summary"]')?.innerText ?? '',
      focuses: document.querySelector('[data-testid="learner-profile-focuses"]')?.innerText ?? '',
      evidence: document.querySelector('[data-testid="learner-profile-evidence"]')?.innerText ?? '',
      timeline: document.querySelector('[data-testid="learner-profile-timeline"]')?.innerText ?? '',
      boundary: document.querySelector('[data-testid="learner-profile-drawer"]')?.innerText ?? '',
    }))()`,
  );
  assert(
    learnerProfile.summary.includes("诊断单") &&
      learnerProfile.focuses.includes("能力增值线") &&
      learnerProfile.evidence.includes("证据来源") &&
      learnerProfile.timeline.includes("纵向学习事件") &&
      learnerProfile.boundary.includes("不做学生排名"),
    "Learner profile must expose summary, value-added dimensions, evidence channels, timeline and formative boundary.",
  );
  await evaluate(send, "document.querySelector('.el-drawer__close-btn')?.click(); true");
  await sleep(300);

  await clickTestId(send, "open-course-settings");
  await waitForCondition(
    send,
    "document.body.innerText.includes('课程与仓库设置') && !!document.querySelector('[data-testid=\"api-connection-card\"]')",
    "Course settings drawer did not render.",
  );
  const settingsContextState = await evaluate(
    send,
    `(() => {
      const text = document.querySelector('.settings-context-card')?.innerText ?? '';
      return {
        hasContextCard: !!document.querySelector('.settings-context-card'),
        hasValueEngineEntry: !!document.querySelector('[data-testid="open-value-engine-from-settings"]'),
        hasContextCopy:
          text.includes('\u63a5\u5165\u914d\u7f6e') &&
          text.includes('\u6838\u5fc3\u5de5\u4f5c\u9762') &&
          text.includes('\u589e\u503c\u5f15\u64ce'),
      };
    })()`,
  );
  assert(
    settingsContextState.hasContextCard &&
      settingsContextState.hasValueEngineEntry &&
      settingsContextState.hasContextCopy,
    "Course settings must clarify that configuration is not the core work surface.",
  );
  await clickTestId(send, "check-api-connection");
  await waitForCondition(
    send,
    apiMode
      ? "document.querySelector('[data-testid=\"api-connection-card\"]')?.innerText.includes('Edge API 已连接') && document.querySelector('[data-testid=\"api-connection-card\"]')?.innerText.includes('/api/webhooks/github/ci')"
      : "document.querySelector('[data-testid=\"api-connection-card\"]')?.innerText.includes('本地离线模式') && document.querySelector('[data-testid=\"api-connection-card\"]')?.innerText.includes('配置后端 API 后生成')",
    "Course settings connection check did not settle.",
  );
  const storageModeText = await evaluate(
    send,
    "document.querySelector('[data-testid=\"api-storage-mode\"]')?.innerText ?? ''",
  );
  assert(
    storageModeText.includes(apiMode ? "内存试运行" : "本地离线兜底") ||
      storageModeText.includes("数据库持久化"),
    "Course settings drawer must expose the active storage mode.",
  );
  const launchSetupText = await evaluate(
    send,
    `(() => ({
      checklist: document.querySelector('[data-testid="pilot-launch-checklist"]')?.innerText ?? '',
      workflow: document.querySelector('[data-testid="github-workflow-snippet"]')?.innerText ?? '',
      signature: document.querySelector('[data-testid="webhook-signature-card"]')?.innerText ?? '',
      integrationPanel: !!document.querySelector('[data-testid="github-integration-status"]'),
      integrationRefresh: !!document.querySelector('[data-testid="refresh-github-integration-status"]'),
    }))()`,
  );
  assert(
    launchSetupText.checklist.includes("试点上线清单") &&
      launchSetupText.checklist.includes("后端连通") &&
      launchSetupText.checklist.includes("仓库 Webhook"),
    "Course settings drawer must show the pilot launch checklist.",
  );
  assert(
    launchSetupText.workflow.includes("SEPATH_WEBHOOK_SECRET") &&
      launchSetupText.workflow.includes("/api/webhooks/github/ci") &&
      launchSetupText.workflow.includes("x-hub-signature-256") &&
      launchSetupText.workflow.includes("learnerHash"),
    "Course settings drawer must show a usable GitHub Actions webhook snippet.",
  );
  assert(
    launchSetupText.signature.includes("SEPATH_GITHUB_WEBHOOK_SECRET"),
    "Course settings drawer must show that production webhook secrets stay out of the browser.",
  );
  assert(
    launchSetupText.integrationPanel && launchSetupText.integrationRefresh,
    "Course settings drawer must expose GitHub integration health and manual refresh.",
  );
  await evaluate(
    send,
    "document.querySelector('.el-drawer__close-btn')?.click(); true",
  );
  await sleep(450);

  const hasReviewerEntry = await evaluate(
    send,
    "!!document.querySelector('[data-testid=\"open-reviewer-entry\"]')",
  );
  assert(hasReviewerEntry, "Teacher workbench must expose a reviewer validation entry.");

  await send("Page.navigate", { url: reviewerUrl });
  await waitForCondition(
    send,
    "document.readyState === 'complete' && !!document.querySelector('[data-testid=\"reviewer-console\"]') && !!document.querySelector('[data-testid=\"reviewer-readonly-case\"]')",
    "Reviewer validation console did not render.",
  );
  const reviewerState = await evaluate(
    send,
    `(() => ({
      hasMetrics: !!document.querySelector('[data-testid="reviewer-metrics"]'),
      hasFlow: !!document.querySelector('[data-testid="reviewer-flow"]'),
      hasLedger: !!document.querySelector('[data-testid="reviewer-ledger-preview"]'),
      hasSafeVoi: document.body.innerText.includes('Safe-VOI'),
      hasTeacherDecision: !!document.querySelector('[data-testid="decision-approve"]'),
      hasStudentSubmit: !!document.querySelector('[data-testid^="student-portal-submit"]'),
    }))()`,
  );
  assert(reviewerState.hasMetrics, "Reviewer console must show validation metrics.");
  assert(reviewerState.hasFlow, "Reviewer console must show the closed-loop path.");
  assert(reviewerState.hasLedger, "Reviewer console must show a ledger preview.");
  assert(reviewerState.hasSafeVoi, "Reviewer console must retain Safe-VOI boundary language.");
  assert(!reviewerState.hasTeacherDecision, "Reviewer console must not expose teacher decision actions.");
  assert(!reviewerState.hasStudentSubmit, "Reviewer console must not expose student submit actions.");

  await send("Page.navigate", { url: appUrl });
  await waitForCondition(
    send,
    "document.readyState === 'complete' && !!document.querySelector('[data-testid=\"decision-approve\"]')",
    "Teacher workbench did not render after reviewer validation.",
  );

  await setFieldValue(send, "queue-search", secondLearnerLabel);
  await waitForCondition(
    send,
    `document.querySelector('[data-testid="work-order-inbox"]')?.innerText.includes(${JSON.stringify(secondLearnerLabel)}) && !document.querySelector('[data-testid="work-order-inbox"]')?.innerText.includes(${JSON.stringify(firstLearnerLabel)})`,
    "Queue search did not filter work orders.",
  );
  await setFieldValue(send, "queue-search", "");
  await waitForCondition(
    send,
    `document.querySelector('[data-testid="work-order-inbox"]')?.innerText.includes(${JSON.stringify(firstLearnerLabel)})`,
    "Queue search did not clear.",
  );

  let snapshot = await readSnapshot(send);
  let selected = snapshot.workOrders.find((item) => item.id === snapshot.selectedId);
  assert(selected.id === "wo-se-018", "Initial selected work order must be wo-se-018.");
  assert(selected.status === "diagnosis", "Initial work order must start in diagnosis.");

  await clickTestId(send, "decision-approve");
  await waitForCondition(
    send,
    `(() => {
      const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}));
      const order = snapshot.workOrders.find((item) => item.id === snapshot.selectedId);
      return order?.selectedDecision === 'approve' && order.status === 'guardrail';
    })()`,
    "Teacher approval did not persist.",
  );

  snapshot = await readSnapshot(send);
  selected = snapshot.workOrders.find((item) => item.id === snapshot.selectedId);
  assert(selected.evidenceCoverage === 48, "Approval must set evidence coverage to 48.");
  assert(
    snapshot.ledger[selected.id][0].type === "decision" &&
      snapshot.ledger[selected.id][0].decision === "approve",
    "Teacher approval must be written to ledger.",
  );

  await waitForCondition(
    send,
    `(() => {
      const editor = document.querySelector('[data-testid="package-draft-editor"]');
      const button = document.querySelector('[data-testid="publish-package"]');
      return Boolean(editor) && button?.disabled === false;
    })()`,
    "Teacher package draft editor did not become publishable.",
  );

  await clickTestId(send, "generate-ai-scaffold-draft");
  await waitForCondition(
    send,
    `(() => {
      const steps = document.querySelector('[data-testid="package-draft-steps"]')?.value || "";
      const boundary = document.querySelector('[data-testid="package-draft-boundary"]')?.value || "";
      const button = document.querySelector('[data-testid="generate-ai-scaffold-draft"]');
      return !button?.innerText.includes("生成中") &&
        steps.includes("Given-When-Then") &&
        boundary.includes("完整");
    })()`,
    "AI scaffold draft did not populate the teacher-editable package form.",
  );
  const aiDraftState = await evaluate(
    send,
    `(() => ({
      title: document.querySelector('[data-testid="package-draft-title"]')?.value || "",
      evidence: document.querySelector('[data-testid="package-draft-evidence"]')?.value || ""
    }))()`,
  );
  assert(aiDraftState.title.includes("脚手架"), "AI scaffold draft must keep a scaffold package title.");
  assert(
    aiDraftState.evidence.includes("最小失败用例清单"),
    "AI scaffold draft must require concrete evidence instead of a direct answer.",
  );
  await setFieldValue(
    send,
    "package-draft-objective",
    "教师微调目标：先把 REST API 失败路径变成可复核证据，再做最小修复，不提交完整答案。",
  );
  await setFieldValue(
    send,
    "package-draft-steps",
    [
      "复述 PR #18 CI 失败的输入、期望结果和实际结果。",
      "补充空请求体、超长字段、无权限访问 3 个最小失败用例。",
      "先提交测试清单，再提交最小修复或无需改代码的证据说明。",
      "在 PR 描述里写清验证命令、CI 结果和仍不确定的点。",
    ].join("\n"),
  );
  await setFieldValue(
    send,
    "package-draft-evidence",
    [
      "异常路径检查清单",
      "最小失败用例清单",
      "教师补充验收截图",
      "PR 变更说明与自测摘要",
    ].join("\n"),
  );
  await setFieldValue(
    send,
    "package-draft-rubric",
    [
      "能说明异常路径先于实现修复。",
      "能提交可复现的最小失败用例。",
      "证据足以支持教师复核，不依赖口头承诺。",
    ].join("\n"),
  );
  await setFieldValue(send, "package-draft-due", "下次课前提交，课堂复核时带 PR 链接。");
  await setFieldValue(
    send,
    "package-draft-boundary",
    "只给检查清单、失败用例和反思脚手架；不生成可直接提交的完整实现代码。",
  );

  await clickTestId(send, "publish-package");
  await waitForCondition(
    send,
    `(() => {
      const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}));
      const order = snapshot.workOrders.find((item) => item.id === snapshot.selectedId);
      return order?.interventionPackage?.status === 'ready_for_student' && order.status === 'intervention';
    })()`,
    "Intervention task package did not publish.",
  );
  snapshot = await readSnapshot(send);
  selected = snapshot.workOrders.find((item) => item.id === snapshot.selectedId);
  assert(
    selected.interventionPackage?.evidenceToSubmit?.includes("最小失败用例清单"),
    "Published package must include concrete evidence requirements.",
  );
  assert(
    selected.interventionPackage?.teacherEdited === true &&
      selected.interventionPackage.objective.includes("教师微调目标") &&
      selected.interventionPackage.evidenceToSubmit.includes("教师补充验收截图"),
    "Published package must preserve the teacher-edited draft.",
  );
  assert(
    snapshot.ledger[selected.id][0].type === "intervention_package",
    "Published package must be written to ledger.",
  );

  const studentUrl = await evaluate(
    send,
    `(() => document.querySelector('.return-link-card p')?.textContent?.trim() ?? '')()`,
  );
  assert(
    studentUrl.includes("?mode=student&order=wo-se-018"),
    "Teacher workbench must generate a direct student return URL.",
  );
  assert(
    studentUrl.includes("returnToken="),
    "Student return URL must include a scoped return token.",
  );

  await send("Page.navigate", { url: studentUrl });
  await waitForCondition(
    send,
    "document.readyState === 'complete' && !!document.querySelector('[data-testid=\"student-portal\"]')",
    "Student return portal did not render.",
  );
  const studentAccessOk = await evaluate(
    send,
    `(() => ({
      access: document.querySelector('[data-testid="student-return-access"]')?.classList.contains('ok') === true,
      hasPackage: !!document.querySelector('[data-testid="student-task-package"]'),
      packageText: document.querySelector('[data-testid="student-task-package"]')?.innerText ?? '',
    }))()`,
  );
  assert(studentAccessOk.access, "Student return portal must show a validated return link.");
  assert(studentAccessOk.hasPackage, "Student return portal must render the published task package.");
  assert(
    studentAccessOk.packageText.includes("最小失败用例") && studentAccessOk.packageText.includes("安全边界"),
    "Student task package must show executable evidence requirements and safety boundary.",
  );
  assert(
    studentAccessOk.packageText.includes("教师微调目标") &&
      studentAccessOk.packageText.includes("教师补充验收截图") &&
      studentAccessOk.packageText.includes("教师确认稿"),
    "Student task package must show the teacher-confirmed draft content.",
  );
  assert(
    await evaluate(send, "!!document.querySelector('[data-testid=\"student-evidence-structured-form\"]')"),
    "Student portal must render the structured evidence package form.",
  );
  await clickTestId(send, "student-portal-submit-scaffold");
  await setFieldValue(
    send,
    "student-failure-field",
    "订单接口在空请求体、超长字段、无权限访问三类输入下返回值不稳定。",
  );
  await setFieldValue(
    send,
    "student-minimal-case-field",
    "最小失败用例：POST /orders body={}；POST /orders amount=100000000；无 token 访问。",
  );
  await setFieldValue(
    send,
    "student-verification-field",
    "已补充 3 个最小失败用例并重跑 CI，边界测试从 0/3 提升到 3/3。",
  );
  await setFieldValue(
    send,
    "student-evidence-link-field",
    "https://github.com/se-course/rest-api-lab/pull/18",
  );
  await clickTestId(send, "student-integrity-check");
  await clickTestId(send, "student-portal-submit-evidence");
  await setFieldValue(
    send,
    "student-reflection-field",
    "这次问题不是只改异常处理代码，而是先把边界条件变成可验证用例；下次会先写失败用例再修复。",
  );
  await clickTestId(send, "student-portal-submit-reflection");
  await waitForCondition(
    send,
    `(() => {
      const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}));
      const order = snapshot.workOrders.find((item) => item.id === 'wo-se-018');
      const state = snapshot.studentReturn[order.id];
      return order.status === 'review' && state.scaffoldReceived && state.evidenceSubmitted && state.reflectionSubmitted;
    })()`,
    "Student return loop did not reach teacher acceptance.",
  );

  snapshot = await readSnapshot(send);
  selected = snapshot.workOrders.find((item) => item.id === snapshot.selectedId);
  assert(selected.status === "review", "Student return should wait for teacher acceptance.");
  assert(selected.evidenceCoverage >= 78, "Student return should improve evidence coverage.");
  assert(
    snapshot.ledger[selected.id].filter((entry) => entry.type === "student_return").length === 3,
    "All three student return nodes must write ledger entries.",
  );
  assert(
    snapshot.ledger[selected.id].some((entry) => entry.detail.includes("最小失败用例")),
    "Student-submitted evidence must be preserved in the ledger.",
  );
  assert(
    await evaluate(send, "!!document.querySelector('[data-testid=\"student-waiting-teacher\"]')"),
    "Student portal should show that teacher acceptance is pending.",
  );

  await send("Page.navigate", { url: appUrl });
  await waitForCondition(
    send,
    "document.readyState === 'complete' && !!document.querySelector('[data-testid=\"teacher-closure-panel\"]')",
    "Teacher workbench did not render after student return.",
  );
  const firstReviewGate = await evaluate(
    send,
    `(() => ({
      panel: !!document.querySelector('[data-testid="teacher-evidence-review-panel"]'),
      closeDisabled: document.querySelector('[data-testid="close-work-order"]')?.disabled === true,
      progress: document.querySelector('[data-testid="teacher-evidence-review-progress"]')?.innerText ?? '',
    }))()`,
  );
  assert(firstReviewGate.panel, "Teacher closure must expose the student evidence review panel.");
  assert(firstReviewGate.closeDisabled, "Teacher acceptance must stay disabled before evidence review.");
  assert(firstReviewGate.progress.includes("0/"), "Teacher evidence review should start as unreviewed.");

  await clickTestId(send, "return-closure-evidence");
  await waitForCondition(
    send,
    `(() => {
      const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}));
      const order = snapshot.workOrders.find((item) => item.id === 'wo-se-018');
      const state = snapshot.studentReturn[order.id];
      return order.status === 'evidence' &&
        order.interventionPackage?.status === 'returned_for_evidence' &&
        state.scaffoldReceived === true &&
        state.evidenceSubmitted === false &&
        state.reflectionSubmitted === false &&
        state.revision === 1 &&
        typeof state.returnReason === 'string' &&
        state.returnReason.length > 0 &&
        snapshot.ledger[order.id]?.[0]?.title.includes('退回补证据');
    })()`,
    "Teacher return-for-evidence did not reopen the student loop.",
  );
  assert(
    await evaluate(send, "!!document.querySelector('[data-testid=\"closure-return-guidance\"]')"),
    "Teacher workbench should show return-for-evidence guidance.",
  );

  await send("Page.navigate", { url: studentUrl });
  await waitForCondition(
    send,
    "document.readyState === 'complete' && !!document.querySelector('[data-testid=\"student-return-guidance\"]')",
    "Student portal did not show teacher return guidance.",
  );
  await setFieldValue(
    send,
    "student-failure-field",
    "二次补证据：异常路径检查清单缺少越权访问与超长字段的回归记录。",
  );
  await setFieldValue(
    send,
    "student-minimal-case-field",
    "最小失败用例：无权限 token 访问订单详情；amount 超长字段触发校验失败。",
  );
  await setFieldValue(
    send,
    "student-verification-field",
    "已补交异常路径检查清单，并把空请求体、越权访问、超长字段三类失败用例全部跑通。",
  );
  await clickTestId(send, "student-integrity-check");
  await clickTestId(send, "student-portal-submit-evidence");
  await setFieldValue(
    send,
    "student-reflection-field",
    "我根据教师退回意见补齐了检查清单，确认问题来自边界建模不足，后续先列输入边界再写实现。",
  );
  await clickTestId(send, "student-portal-submit-reflection");
  await waitForCondition(
    send,
    `(() => {
      const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}));
      const order = snapshot.workOrders.find((item) => item.id === 'wo-se-018');
      const state = snapshot.studentReturn[order.id];
      return order.status === 'review' &&
        state.revision === 1 &&
        state.scaffoldReceived &&
        state.evidenceSubmitted &&
        state.reflectionSubmitted;
    })()`,
    "Second student return did not reach teacher acceptance.",
  );

  await send("Page.navigate", { url: appUrl });
  await waitForCondition(
    send,
    "document.readyState === 'complete' && !!document.querySelector('[data-testid=\"teacher-closure-panel\"]')",
    "Teacher workbench did not render after second student return.",
  );
  assert(
    await evaluate(send, "document.querySelector('[data-testid=\"close-work-order\"]')?.disabled === true"),
    "Teacher acceptance should remain disabled until the second evidence review is saved.",
  );
  await acceptTeacherEvidenceReview(send, "二次补证据已逐项复核，可进入本轮形成性验收。");

  await clickTestId(send, "close-work-order");
  await waitForCondition(
    send,
    `(() => {
      const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}));
      const order = snapshot.workOrders.find((item) => item.id === 'wo-se-018');
      return order.status === 'closed' &&
        order.valueAddedSnapshot?.teacherDecision === 'accept' &&
        snapshot.ledger[order.id]?.[0]?.type === 'teacher_acceptance' &&
        snapshot.ledger[order.id]?.[0]?.valueAddedSnapshotId === order.valueAddedSnapshot.id;
    })()`,
    "Teacher acceptance did not close the work order.",
  );
  snapshot = await readSnapshot(send);
  selected = snapshot.workOrders.find((item) => item.id === snapshot.selectedId);
  assert(selected.status === "closed", "Teacher acceptance should close the work order.");
  assert(
    selected.valueAddedSnapshot?.uplift > 0 &&
      selected.valueAddedSnapshot?.evidenceCoverage >= 88,
    "Teacher acceptance must create a value-added snapshot with uplift and evidence coverage.",
  );
  assert(
    snapshot.studentReturn[selected.id]?.revision === 1 &&
      snapshot.studentReturn[selected.id]?.returnReason,
    "Closed work order should retain return-for-evidence revision context.",
  );
  assert(
    snapshot.ledger[selected.id].filter((entry) => entry.type === "student_return").length >= 5,
    "Second student return must add another evidence and reflection ledger trace.",
  );
  assert(
    snapshot.ledger[selected.id].some((entry) => entry.type === "teacher_evidence_review"),
    "Teacher evidence review must remain in the ledger before final acceptance.",
  );
  assert(
    await evaluate(send, "!!document.querySelector('[data-testid=\"value-added-snapshot\"]')"),
    "Closed work order should render the value-added snapshot panel.",
  );

  const knownDownloads = await listLedgerDownloads();
  await clickTestId(send, "export-ledger");
  const exported = await waitForNewLedgerDownload(knownDownloads);
  assert(exported.selectedDecision === "approve", "Export must include teacher decision.");
  assert(exported.studentReturnProgress === "3/3", "Export must include complete student return progress.");
  assert(exported.studentReturnRevision === 1, "Export must include the return-for-evidence revision.");
  assert(exported.studentReturnReason, "Export must retain the teacher return reason.");
  assert(
    exported.valueAddedSnapshot?.id === selected.valueAddedSnapshot.id,
    "Export must include the closed-loop value-added snapshot.",
  );
  assert(
    exported.workOrder?.valueAddedSnapshot?.basisEvidenceIds?.length >= 5,
    "Exported snapshot must keep its evidence basis IDs.",
  );
  assert(!exported.workOrder?.returnToken, "Export must not include the live student return token.");
  assert(exported.currentStage === "闭环完成", "Export must include final stage.");
  assert(
    exported.workOrder?.interventionPackage?.rubricCheckpoints?.length >= 3,
    "Export must include the published intervention task package.",
  );
  assert(
    exported.boundary.includes("不排名不惩罚") && exported.boundary.includes("教师确认"),
    "Export must retain formative-evaluation and teacher-confirmation boundaries.",
  );

  await clickTestId(send, "open-ledger");
  await waitForCondition(
    send,
    "document.body.innerText.includes('证据地图与审计留痕') && !!document.querySelector('[data-testid=\"ledger-audit-drawer\"]') && !!document.querySelector('[data-testid=\"ledger-filter-student\"]')",
    "Ledger drawer did not open.",
  );
  const ledgerAudit = await evaluate(
    send,
    `(() => ({
      count: document.querySelector('[data-testid="ledger-filtered-count"]')?.innerText ?? '',
      head: document.querySelector('[data-testid="ledger-audit-drawer"]')?.innerText ?? '',
    }))()`,
  );
  assert(
    ledgerAudit.count.includes("/") &&
      ledgerAudit.head.includes("当前复核状态") &&
      ledgerAudit.head.includes("形成性结论边界"),
    "Ledger drawer must expose audit status, filtered count, and conclusion boundary.",
  );
  await clickTestId(send, "ledger-filter-student");
  await setFieldValue(send, "ledger-search", "二次补证据");
  await waitForCondition(
    send,
    "document.querySelector('[data-testid=\"ledger-filtered-list\"]')?.innerText.includes('二次补证据') && document.querySelector('[data-testid=\"ledger-filtered-count\"]')?.innerText.includes('/')",
    "Ledger student filter and search did not find the second evidence return.",
  );
  await clickTestId(send, "ledger-filter-teacher");
  await setFieldValue(send, "ledger-search", "");
  await waitForCondition(
    send,
    "document.querySelector('[data-testid=\"ledger-filtered-list\"]')?.innerText.includes('教师') && document.querySelector('[data-testid=\"ledger-filtered-list\"]')?.innerText.includes('验收')",
    "Ledger teacher filter did not show teacher review traces.",
  );
  await clickTestId(send, "ledger-reset-filter");
  await waitForCondition(
    send,
    "document.querySelector('[data-testid=\"ledger-filtered-count\"]')?.innerText.trim().startsWith(document.querySelector('[data-testid=\"ledger-filtered-count\"]')?.innerText.trim().split('/')[1]?.split(' ')[0] ?? '0')",
    "Ledger reset filter did not restore the full audit list.",
  );
  await evaluate(
    send,
    "document.querySelector('.el-drawer__close-btn')?.click(); true",
  );
  await sleep(450);

  await clickTestId(send, "case-wo-se-026");
  await waitForCondition(
    send,
    `document.body.innerText.includes(${JSON.stringify(secondLearnerLabel)}) && document.body.innerText.includes('数据库事务与并发控制')`,
    "Case switching did not select the second work order.",
  );

  await clickTestId(send, "open-intake");
  await waitForCondition(
    send,
    "document.body.innerText.includes('导入真实学习事件')",
    "Teacher intake drawer did not open.",
  );
  await setFieldValue(
    send,
    "github-pr-url",
    "https://github.com/se-course/rest-api-lab/pull/28",
  );
  await setFieldValue(
    send,
    "github-ci-log",
    "CI failed: POST /orders with empty body returned 500; missing tests for null body, oversized payload and permission exception.",
  );
  await clickTestId(send, "parse-github-ci");
  await waitForCondition(
    send,
    `(() => {
      const getField = (testId) => {
        const node = document.querySelector('[data-testid="' + testId + '"]');
        return node?.matches('input, textarea')
          ? node
          : node?.querySelector('input, textarea');
      };
      return getField('intake-evidence-text')?.value.includes('GitHub Actions') &&
        getField('intake-trigger')?.value.includes('PR #28');
    })()`,
    "GitHub / CI parser did not populate the intake form.",
  );
  await setFieldValue(send, "intake-student-name", "韩沐阳");
  await setFieldValue(send, "intake-student-no", "2301180728");
  await setFieldValue(
    send,
    "intake-help-text",
    "学生请求直接给出错误处理代码，教师需要系统先生成检查清单而不是答案。",
  );
  await clickTestId(send, "submit-intake");
  await waitForCondition(
    send,
    `(() => {
      const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}));
      const order = snapshot.workOrders.find((item) => item.id === snapshot.selectedId);
      return order?.id.startsWith('wo-live-') && (${JSON.stringify(apiMode)} ? /^SE-/.test(order.studentName) : order.studentName === '韩沐阳');
    })()`,
    "Teacher intake did not create a live work order.",
  );

  snapshot = await readSnapshot(send);
  selected = snapshot.workOrders.find((item) => item.id === snapshot.selectedId);
  assert(selected.risk === "high", "Live intake should infer high risk from CI failure evidence.");
  assert(selected.missingEvidence.length >= 2, "Live intake must create missing-evidence tasks.");
  assert(
    snapshot.ledger[selected.id][0].type === "intake",
    "Live intake must write an intake ledger entry.",
  );

  await clickTestId(send, "reset-workbench");
  if (apiMode) {
    await waitForCondition(
      send,
      `(() => {
        const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}));
        return Array.isArray(snapshot.workOrders) && snapshot.workOrders.length >= 2 && snapshot.workOrders.some((item) => item.id === 'wo-se-018');
      })()`,
      "API reload did not refresh the teacher queue.",
    );
  } else {
    await waitForCondition(
      send,
      `(() => {
        const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}));
        const order = snapshot.workOrders.find((item) => item.id === snapshot.selectedId);
        return order?.id === 'wo-se-018' && !order.selectedDecision;
      })()`,
      "Reset did not restore the initial diagnosis state.",
    );
  }

  await clickTestId(send, "open-course-ops");
  await waitForCondition(
    send,
    "document.body.innerText.includes('课程运营与批量诊断') && !!document.querySelector('[data-testid=\"course-ops-dashboard\"]') && !!document.querySelector('[data-testid=\"course-review-gate-board\"]') && !!document.querySelector('[data-testid=\"course-intervention-review\"]')",
    "Course operations drawer did not render.",
  );
  const opsDashboard = await evaluate(
    send,
    `(() => ({
      summary: document.querySelector('[data-testid="course-ops-summary"]')?.innerText ?? '',
      reviewGate: document.querySelector('[data-testid="course-review-gate-board"]')?.innerText ?? '',
      interventionReview: document.querySelector('[data-testid="course-intervention-review"]')?.innerText ?? '',
      priority: document.querySelector('[data-testid="course-priority-queue"]')?.innerText ?? '',
      focus: document.querySelector('[data-testid="course-gap-distribution"]')?.innerText ?? '',
      gaps: document.querySelector('[data-testid="course-evidence-gap-matrix"]')?.innerText ?? '',
      microTask: document.querySelector('[data-testid="course-micro-task-package"]')?.innerText ?? '',
    }))()`,
  );
  assert(
    opsDashboard.summary.includes("打开工单") &&
      opsDashboard.reviewGate.includes("教师复核回流") &&
      opsDashboard.reviewGate.includes("待证据复核") &&
      opsDashboard.interventionReview.includes("干预效果复盘") &&
      opsDashboard.interventionReview.includes("已发布干预") &&
      opsDashboard.priority.includes("今日优先处理") &&
      opsDashboard.focus.includes("能力薄弱分布") &&
      opsDashboard.gaps.includes("证据缺口矩阵") &&
      opsDashboard.microTask.includes("课堂微任务包"),
    "Course operations dashboard must show weekly pulse, evidence review gate, intervention review, priority queue, focus distribution, evidence gap matrix and a class micro-task package.",
  );
  const beforeGithubBatchCount = await evaluate(
    send,
    `(() => JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)})).workOrders.length)()`,
  );
  await clickTestId(send, "submit-github-batch-import");
  await waitForCondition(
    send,
    `(() => {
      const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}));
      return snapshot.workOrders.length >= ${beforeGithubBatchCount} + 3 &&
        ['learner-0321', 'learner-0417', 'learner-0526'].every((hash) =>
          snapshot.workOrders.some((order) => order.studentNo === hash || order.learnerHash === hash)
        );
    })()`,
    "GitHub / CI batch import did not create work orders.",
  );
  const githubBatchState = await evaluate(
    send,
    `(() => {
      const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}));
      const imported = snapshot.workOrders.filter((order) =>
        ['learner-0321', 'learner-0417', 'learner-0526'].includes(order.studentNo || order.learnerHash)
      );
      return {
        count: imported.length,
        highOrMedium: imported.every((order) => order.risk === 'high' || order.risk === 'medium'),
        hasLedger: imported.every((order) => snapshot.ledger[order.id]?.some((entry) => entry.type === 'intake')),
        statusText: document.querySelector('[data-testid="github-batch-status"]')?.innerText ?? '',
        previewText: document.querySelector('[data-testid="github-batch-preview"]')?.innerText ?? '',
      };
    })()`,
  );
  assert(
    githubBatchState.count >= 3 &&
      githubBatchState.highOrMedium &&
      githubBatchState.hasLedger &&
      githubBatchState.previewText.includes("3"),
    "GitHub batch import must create evidence-backed diagnosis work orders and preserve intake ledger entries.",
  );
  const githubIntegrationStatus = await evaluate(
    send,
    `(() => JSON.parse(localStorage.getItem(${JSON.stringify(githubIntegrationStatusStorageKey)})))()`,
  );
  assert(
    githubIntegrationStatus?.summary?.health === "receiving" &&
      githubIntegrationStatus.events?.some((event) => event.source === "github-ci-batch" && event.createdCount >= 3),
    "GitHub integration status must update after batch import.",
  );
  const knownMarkdownReports = await listDownloadsByExtension(".md");
  await clickTestId(send, "export-course-weekly-report");
  const courseReportMarkdown = await waitForNewTextDownload(knownMarkdownReports, ".md");
  assert(
    courseReportMarkdown.includes("SE-Path 周运营报告") &&
      courseReportMarkdown.includes("今日优先处理") &&
      courseReportMarkdown.includes("证据缺口矩阵") &&
      courseReportMarkdown.includes("形成性诊断，不排名不惩罚"),
    "Course weekly markdown report must include summary, priority, evidence gaps and formative boundary.",
  );
  const knownCourseJsonReports = await listLedgerDownloads();
  await clickTestId(send, "export-course-weekly-data");
  const courseReportJson = await waitForNewLedgerDownload(knownCourseJsonReports);
  assert(
    courseReportJson.exportType === "course_weekly_operations_report" &&
      Array.isArray(courseReportJson.priorityQueue) &&
      Array.isArray(courseReportJson.evidenceGaps) &&
      courseReportJson.boundary.includes("不排名不惩罚"),
    "Course weekly JSON report must export the production operations package.",
  );
  const knownMicroTaskReports = await listDownloadsByExtension(".md");
  await clickTestId(send, "export-course-micro-task");
  const microTaskMarkdown = await waitForNewTextDownload(knownMicroTaskReports, ".md");
  assert(
    microTaskMarkdown.includes("课堂微任务包") &&
      microTaskMarkdown.includes("学生步骤") &&
      microTaskMarkdown.includes("安全边界") &&
      microTaskMarkdown.includes("不生成可直接提交"),
    "Course micro-task markdown must include executable steps and the no-direct-answer safety boundary.",
  );
  await clickTestId(send, "publish-course-micro-task");
  await waitForCondition(
    send,
    `(() => {
      const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}) || '{}');
      return Object.values(snapshot.ledger || {}).some((entries) =>
        Array.isArray(entries) && entries.some((entry) => entry.type === 'course_micro_task')
      );
    })()`,
    "Course micro-task publication did not update the teacher workbench.",
  );
  const publishedMicroTask = await evaluate(
    send,
    `(() => {
      const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}));
      const entriesByOrder = Object.entries(snapshot.ledger)
        .filter(([, entries]) => Array.isArray(entries) && entries.some((entry) => entry.type === 'course_micro_task'));
      return {
        entryCount: entriesByOrder.reduce(
          (total, [, entries]) => total + entries.filter((entry) => entry.type === 'course_micro_task').length,
          0,
        ),
        targetCount: entriesByOrder.length,
        hasCourseOpsSource: entriesByOrder.some(([, entries]) =>
          entries.some((entry) => entry.type === 'course_micro_task' && entry.source === '课程运营'),
        ),
        hasBoundary: entriesByOrder.some(([, entries]) =>
          entries.some((entry) => entry.type === 'course_micro_task' && String(entry.detail || '').includes('不生成可直接提交')),
        ),
      };
    })()`,
  );
  assert(
    publishedMicroTask.entryCount >= 1 &&
      publishedMicroTask.targetCount >= 1 &&
      publishedMicroTask.hasCourseOpsSource &&
      publishedMicroTask.hasBoundary,
    "Publishing the course micro-task must write bounded course-ops ledger entries for target work orders.",
  );
  await waitForCondition(
    send,
    "document.querySelector('[data-testid=\"course-intervention-review-summary\"]')?.innerText.includes('学生回流') && document.querySelectorAll('.intervention-review-row').length >= 1",
    "Intervention review did not roll up the published course micro-task.",
  );
  const interventionReview = await evaluate(
    send,
    `(() => ({
      text: document.querySelector('[data-testid="course-intervention-review"]')?.innerText ?? '',
      rowCount: document.querySelectorAll('.intervention-review-row').length,
    }))()`,
  );
  assert(
    interventionReview.rowCount >= 1 &&
      interventionReview.text.includes("干预效果复盘") &&
      interventionReview.text.includes("证据采信") &&
      interventionReview.text.includes("增值快照"),
    "Intervention review must connect published micro-tasks to return, review and value-added snapshot states.",
  );
  const knownInterventionMarkdownReports = await listDownloadsByExtension(".md");
  await clickTestId(send, "export-course-intervention-review");
  const interventionMarkdown = await waitForNewTextDownload(knownInterventionMarkdownReports, ".md");
  assert(
    interventionMarkdown.includes("SE-Path 课程干预效果复盘") &&
      interventionMarkdown.includes("干预批次") &&
      interventionMarkdown.includes("形成性诊断") &&
      interventionMarkdown.includes("不用于学生排名"),
    "Intervention review markdown must include batches, formative boundary and non-ranking rule.",
  );
  const knownInterventionJsonReports = await listLedgerDownloads();
  await clickTestId(send, "export-course-intervention-review-data");
  const interventionJson = await waitForNewLedgerDownload(knownInterventionJsonReports);
  assert(
    interventionJson.exportType === "course_intervention_effect_review" &&
      Array.isArray(interventionJson.interventions) &&
      interventionJson.interventions.length >= 1 &&
      interventionJson.boundary.includes("不排名"),
    "Intervention review JSON must export the course intervention effect package.",
  );
  await waitForCondition(
    send,
    "!!document.querySelector('[data-testid=\"course-teaching-improvement-plan\"]') && document.querySelectorAll('[data-testid^=\"teaching-improvement-item-\"]').length >= 1",
    "Course teaching improvement plan did not render after intervention review.",
  );
  const teachingImprovementPlan = await evaluate(
    send,
    `(() => ({
      text: document.querySelector('[data-testid="course-teaching-improvement-plan"]')?.innerText ?? '',
      itemCount: document.querySelectorAll('[data-testid^="teaching-improvement-item-"]').length,
      canExport: !!document.querySelector('[data-testid="export-course-teaching-improvement"]'),
      canPublish:
        document.querySelector('[data-testid="publish-course-teaching-improvement"]')?.disabled === false,
    }))()`,
  );
  assert(
    teachingImprovementPlan.itemCount >= 1 &&
      teachingImprovementPlan.canExport &&
      teachingImprovementPlan.canPublish &&
      teachingImprovementPlan.text.includes("下轮教学改进单"),
    "Course teaching improvement plan must expose actionable items, export and publish actions.",
  );
  const knownTeachingImprovementReports = await listDownloadsByExtension(".md");
  await clickTestId(send, "export-course-teaching-improvement");
  const teachingImprovementMarkdown = await waitForNewTextDownload(knownTeachingImprovementReports, ".md");
  assert(
    teachingImprovementMarkdown.includes("下轮教学改进单") &&
      teachingImprovementMarkdown.includes("下轮教学改进") &&
      teachingImprovementMarkdown.includes("不排名"),
    "Teaching improvement markdown must include the course action plan and formative non-ranking boundary.",
  );
  await clickTestId(send, "publish-course-teaching-improvement");
  await waitForCondition(
    send,
    `(() => {
      const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}) || '{}');
      return Object.values(snapshot.ledger || {}).some((entries) =>
        Array.isArray(entries) && entries.some((entry) => entry.type === 'teaching_improvement')
      );
    })()`,
    "Course teaching improvement publication did not update the work-order ledger.",
  );
  const publishedTeachingImprovement = await evaluate(
    send,
    `(() => {
      const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}));
      const entriesByOrder = Object.entries(snapshot.ledger)
        .filter(([, entries]) => Array.isArray(entries) && entries.some((entry) => entry.type === 'teaching_improvement'));
      return {
        entryCount: entriesByOrder.reduce(
          (total, [, entries]) => total + entries.filter((entry) => entry.type === 'teaching_improvement').length,
          0,
        ),
        hasCourseReviewSource: entriesByOrder.some(([, entries]) =>
          entries.some((entry) => entry.type === 'teaching_improvement' && entry.source === '课程复盘'),
        ),
        hasBoundary: entriesByOrder.some(([, entries]) =>
          entries.some((entry) => entry.type === 'teaching_improvement' && String(entry.detail || '').includes('不生成可直接提交')),
        ),
      };
    })()`,
  );
  assert(
    publishedTeachingImprovement.entryCount >= 1 &&
      publishedTeachingImprovement.hasCourseReviewSource &&
      publishedTeachingImprovement.hasBoundary,
    "Publishing the teaching improvement plan must write bounded course-review ledger entries.",
  );
  await waitForCondition(
    send,
    "!!document.querySelector('[data-testid=\"course-teaching-improvement-execution\"]')",
    "Course teaching improvement execution receipt did not render after the plan was published.",
  );
  const teachingExecutionReceipt = await evaluate(
    send,
    `(() => {
      const section = document.querySelector('[data-testid="course-teaching-improvement-execution"]');
      return {
        text: section?.innerText ?? '',
        canExport: !!document.querySelector('[data-testid="export-course-teaching-execution"]'),
        canRecord:
          document.querySelector('[data-testid="record-course-teaching-execution"]')?.disabled === false,
      };
    })()`,
  );
  assert(
    teachingExecutionReceipt.canExport &&
      teachingExecutionReceipt.canRecord &&
      teachingExecutionReceipt.text.includes("下轮课堂执行回证") &&
      teachingExecutionReceipt.text.includes("不自动评价学生"),
    "Teaching execution receipt must be visible, actionable and keep the no-automatic-evaluation boundary.",
  );
  const knownTeachingExecutionReports = await listDownloadsByExtension(".md");
  await clickTestId(send, "export-course-teaching-execution");
  const teachingExecutionMarkdown = await waitForNewTextDownload(knownTeachingExecutionReports, ".md");
  assert(
    teachingExecutionMarkdown.includes("下轮课堂执行回证") &&
      teachingExecutionMarkdown.includes("已留存证据") &&
      teachingExecutionMarkdown.includes("不自动评价学生") &&
      teachingExecutionMarkdown.includes("不用于排名"),
    "Teaching execution receipt markdown must include evidence, execution scope and formative boundaries.",
  );
  await clickTestId(send, "record-course-teaching-execution");
  await waitForCondition(
    send,
    `(() => {
      const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}) || '{}');
      return Object.values(snapshot.ledger || {}).some((entries) =>
        Array.isArray(entries) && entries.some((entry) => entry.type === 'teaching_improvement_execution')
      );
    })()`,
    "Teaching execution receipt did not update the work-order ledger.",
  );
  const recordedTeachingExecution = await evaluate(
    send,
    `(() => {
      const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}));
      const entriesByOrder = Object.entries(snapshot.ledger)
        .filter(([, entries]) => Array.isArray(entries) && entries.some((entry) => entry.type === 'teaching_improvement_execution'));
      return {
        entryCount: entriesByOrder.reduce(
          (total, [, entries]) => total + entries.filter((entry) => entry.type === 'teaching_improvement_execution').length,
          0,
        ),
        hasClassroomSource: entriesByOrder.some(([, entries]) =>
          entries.some((entry) => entry.type === 'teaching_improvement_execution' && entry.source === '下轮课堂'),
        ),
        hasBoundary: entriesByOrder.some(([, entries]) =>
          entries.some((entry) => entry.type === 'teaching_improvement_execution' && String(entry.detail || '').includes('不自动评价学生')),
        ),
      };
    })()`,
  );
  assert(
    recordedTeachingExecution.entryCount >= 1 &&
      recordedTeachingExecution.hasClassroomSource &&
      recordedTeachingExecution.hasBoundary,
    "Recording the teaching execution receipt must write classroom-source bounded ledger entries.",
  );
  await waitForCondition(
    send,
    "!!document.querySelector('[data-testid=\"course-teaching-improvement-followup\"]') && document.querySelector('[data-testid=\"record-course-teaching-followup\"]')?.disabled === false",
    "Course teaching improvement followup sampling did not become recordable after execution receipt.",
  );
  const teachingFollowupSample = await evaluate(
    send,
    `(() => {
      const section = document.querySelector('[data-testid="course-teaching-improvement-followup"]');
      return {
        text: section?.innerText ?? '',
        indicatorCount: document.querySelectorAll('[data-testid^="followup-indicator-"]').length,
        canExport: !!document.querySelector('[data-testid="export-course-teaching-followup"]'),
        canRecord:
          document.querySelector('[data-testid="record-course-teaching-followup"]')?.disabled === false,
      };
    })()`,
  );
  assert(
    teachingFollowupSample.indicatorCount >= 3 &&
      teachingFollowupSample.canExport &&
      teachingFollowupSample.canRecord &&
      teachingFollowupSample.text.includes("下轮效果采样单") &&
      teachingFollowupSample.text.includes("不自动评价学生"),
    "Teaching followup sample must expose observation indicators, export and record actions.",
  );
  const knownTeachingFollowupReports = await listDownloadsByExtension(".md");
  await clickTestId(send, "export-course-teaching-followup");
  const teachingFollowupMarkdown = await waitForNewTextDownload(knownTeachingFollowupReports, ".md");
  assert(
    teachingFollowupMarkdown.includes("下轮效果采样单") &&
      teachingFollowupMarkdown.includes("观察指标") &&
      teachingFollowupMarkdown.includes("不把一次课堂执行解释为因果效果") &&
      teachingFollowupMarkdown.includes("不排名"),
    "Teaching followup markdown must include observation indicators and non-causal formative boundaries.",
  );
  await clickTestId(send, "record-course-teaching-followup");
  await waitForCondition(
    send,
    `(() => {
      const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}) || '{}');
      return Object.values(snapshot.ledger || {}).some((entries) =>
        Array.isArray(entries) && entries.some((entry) => entry.type === 'teaching_improvement_followup')
      );
    })()`,
    "Teaching followup sample did not update the work-order ledger.",
  );
  const recordedTeachingFollowup = await evaluate(
    send,
    `(() => {
      const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}));
      const entriesByOrder = Object.entries(snapshot.ledger)
        .filter(([, entries]) => Array.isArray(entries) && entries.some((entry) => entry.type === 'teaching_improvement_followup'));
      return {
        entryCount: entriesByOrder.reduce(
          (total, [, entries]) => total + entries.filter((entry) => entry.type === 'teaching_improvement_followup').length,
          0,
        ),
        hasSamplingSource: entriesByOrder.some(([, entries]) =>
          entries.some((entry) => entry.type === 'teaching_improvement_followup' && entry.source === '效果采样'),
        ),
        hasBoundary: entriesByOrder.some(([, entries]) =>
          entries.some((entry) => entry.type === 'teaching_improvement_followup' && String(entry.detail || '').includes('不自动评价学生')),
        ),
      };
    })()`,
  );
  assert(
    recordedTeachingFollowup.entryCount >= 1 &&
      recordedTeachingFollowup.hasSamplingSource &&
      recordedTeachingFollowup.hasBoundary,
    "Recording the teaching followup sample must write bounded sampling ledger entries.",
  );
  await waitForCondition(
    send,
    "!!document.querySelector('[data-testid=\"course-teaching-improvement-followup-result\"]') && document.querySelector('[data-testid=\"record-course-teaching-followup-result\"]')?.disabled === false",
    "Course teaching improvement followup result did not become recordable after sampling.",
  );
  const teachingFollowupResult = await evaluate(
    send,
    `(() => {
      const section = document.querySelector('[data-testid="course-teaching-improvement-followup-result"]');
      return {
        text: section?.innerText ?? '',
        findingCount: document.querySelectorAll('[data-testid^="followup-result-"]').length,
        canExport: !!document.querySelector('[data-testid="export-course-teaching-followup-result"]'),
        canRecord:
          document.querySelector('[data-testid="record-course-teaching-followup-result"]')?.disabled === false,
      };
    })()`,
  );
  assert(
    teachingFollowupResult.findingCount >= 3 &&
      teachingFollowupResult.canExport &&
      teachingFollowupResult.canRecord &&
      teachingFollowupResult.text.includes("采样结果回收单") &&
      teachingFollowupResult.text.includes("不自动评价学生"),
    "Teaching followup result must expose collected observations, export and record actions.",
  );
  const knownTeachingFollowupResultReports = await listDownloadsByExtension(".md");
  await clickTestId(send, "export-course-teaching-followup-result");
  const teachingFollowupResultMarkdown = await waitForNewTextDownload(knownTeachingFollowupResultReports, ".md");
  assert(
    teachingFollowupResultMarkdown.includes("采样结果回收单") &&
      teachingFollowupResultMarkdown.includes("观察结果") &&
      teachingFollowupResultMarkdown.includes("不能证明单次教学措施的因果效果") &&
      teachingFollowupResultMarkdown.includes("不排名"),
    "Teaching followup result markdown must include observations and non-causal formative boundaries.",
  );
  await clickTestId(send, "record-course-teaching-followup-result");
  await waitForCondition(
    send,
    `(() => {
      const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}) || '{}');
      return Object.values(snapshot.ledger || {}).some((entries) =>
        Array.isArray(entries) && entries.some((entry) => entry.type === 'teaching_improvement_followup_result')
      );
    })()`,
    "Teaching followup result did not update the work-order ledger.",
  );
  const recordedTeachingFollowupResult = await evaluate(
    send,
    `(() => {
      const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}));
      const entriesByOrder = Object.entries(snapshot.ledger)
        .filter(([, entries]) => Array.isArray(entries) && entries.some((entry) => entry.type === 'teaching_improvement_followup_result'));
      return {
        entryCount: entriesByOrder.reduce(
          (total, [, entries]) => total + entries.filter((entry) => entry.type === 'teaching_improvement_followup_result').length,
          0,
        ),
        hasResultSource: entriesByOrder.some(([, entries]) =>
          entries.some((entry) => entry.type === 'teaching_improvement_followup_result' && entry.source === '结果回收'),
        ),
        hasBoundary: entriesByOrder.some(([, entries]) =>
          entries.some((entry) => entry.type === 'teaching_improvement_followup_result' && String(entry.detail || '').includes('不自动评价学生')),
        ),
      };
    })()`,
  );
  assert(
    recordedTeachingFollowupResult.entryCount >= 1 &&
      recordedTeachingFollowupResult.hasResultSource &&
      recordedTeachingFollowupResult.hasBoundary,
    "Recording the teaching followup result must write bounded observation-result ledger entries.",
  );
  await waitForCondition(
    send,
    "!!document.querySelector('[data-testid=\"course-resource-revision-ticket\"]') && document.querySelector('[data-testid=\"record-course-resource-revision\"]')?.disabled === false",
    "Course resource revision ticket did not become recordable after followup result.",
  );
  const resourceRevisionTicket = await evaluate(
    send,
    `(() => {
      const section = document.querySelector('[data-testid="course-resource-revision-ticket"]');
      return {
        text: section?.innerText ?? '',
        changeCount: document.querySelectorAll('[data-testid^="resource-revision-change-"]').length,
        canExport: !!document.querySelector('[data-testid="export-course-resource-revision"]'),
        canRecord:
          document.querySelector('[data-testid="record-course-resource-revision"]')?.disabled === false,
      };
    })()`,
  );
  assert(
    resourceRevisionTicket.changeCount >= 3 &&
      resourceRevisionTicket.canExport &&
      resourceRevisionTicket.canRecord &&
      resourceRevisionTicket.text.includes("课程资源改版工单") &&
      resourceRevisionTicket.text.includes("不生成可直接提交的完整答案"),
    "Course resource revision ticket must expose concrete changes, export and record actions.",
  );
  const knownResourceRevisionReports = await listDownloadsByExtension(".md");
  await clickTestId(send, "export-course-resource-revision");
  const resourceRevisionMarkdown = await waitForNewTextDownload(knownResourceRevisionReports, ".md");
  assert(
    resourceRevisionMarkdown.includes("课程资源改版工单") &&
      resourceRevisionMarkdown.includes("改版内容") &&
      resourceRevisionMarkdown.includes("验收口径") &&
      resourceRevisionMarkdown.includes("不排名"),
    "Course resource revision markdown must include resource changes, acceptance checks and formative boundaries.",
  );
  await clickTestId(send, "record-course-resource-revision");
  await waitForCondition(
    send,
    `(() => {
      const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}) || '{}');
      return Object.values(snapshot.ledger || {}).some((entries) =>
        Array.isArray(entries) && entries.some((entry) => entry.type === 'course_resource_revision')
      );
    })()`,
    "Course resource revision did not update the work-order ledger.",
  );
  const recordedResourceRevision = await evaluate(
    send,
    `(() => {
      const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}));
      const entriesByOrder = Object.entries(snapshot.ledger)
        .filter(([, entries]) => Array.isArray(entries) && entries.some((entry) => entry.type === 'course_resource_revision'));
      return {
        entryCount: entriesByOrder.reduce(
          (total, [, entries]) => total + entries.filter((entry) => entry.type === 'course_resource_revision').length,
          0,
        ),
        hasRevisionSource: entriesByOrder.some(([, entries]) =>
          entries.some((entry) => entry.type === 'course_resource_revision' && entry.source === '资源改版'),
        ),
        hasBoundary: entriesByOrder.some(([, entries]) =>
          entries.some((entry) => entry.type === 'course_resource_revision' && String(entry.detail || '').includes('不自动评价学生')),
        ),
      };
    })()`,
  );
  assert(
    recordedResourceRevision.entryCount >= 1 &&
      recordedResourceRevision.hasRevisionSource &&
      recordedResourceRevision.hasBoundary,
    "Recording the course resource revision must write bounded resource-revision ledger entries.",
  );
  await waitForCondition(
    send,
    "!!document.querySelector('[data-testid=\"course-resource-release-receipt\"]') && document.querySelector('[data-testid=\"record-course-resource-release\"]')?.disabled === false",
    "Course resource release receipt did not become recordable after resource revision.",
  );
  const resourceReleaseReceipt = await evaluate(
    send,
    `(() => {
      const section = document.querySelector('[data-testid="course-resource-release-receipt"]');
      return {
        text: section?.innerText ?? '',
        checkCount: document.querySelectorAll('[data-testid^="resource-release-check-"]').length,
        canExport: !!document.querySelector('[data-testid="export-course-resource-release"]'),
        canRecord:
          document.querySelector('[data-testid="record-course-resource-release"]')?.disabled === false,
      };
    })()`,
  );
  assert(
    resourceReleaseReceipt.checkCount >= 3 &&
      resourceReleaseReceipt.canExport &&
      resourceReleaseReceipt.canRecord &&
      resourceReleaseReceipt.text.includes("课程资源发布回证") &&
      resourceReleaseReceipt.text.includes("不生成可直接提交的完整答案"),
    "Course resource release receipt must expose release checks, export and record actions.",
  );
  const knownResourceReleaseReports = await listDownloadsByExtension(".md");
  await clickTestId(send, "export-course-resource-release");
  const resourceReleaseMarkdown = await waitForNewTextDownload(knownResourceReleaseReports, ".md");
  assert(
    resourceReleaseMarkdown.includes("课程资源发布回证") &&
      resourceReleaseMarkdown.includes("发布资产") &&
      resourceReleaseMarkdown.includes("发布检查") &&
      resourceReleaseMarkdown.includes("不排名"),
    "Course resource release markdown must include published assets, checks and formative boundaries.",
  );
  await clickTestId(send, "record-course-resource-release");
  await waitForCondition(
    send,
    `(() => {
      const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}) || '{}');
      return Object.values(snapshot.ledger || {}).some((entries) =>
        Array.isArray(entries) && entries.some((entry) => entry.type === 'course_resource_release')
      );
    })()`,
    "Course resource release did not update the work-order ledger.",
  );
  const recordedResourceRelease = await evaluate(
    send,
    `(() => {
      const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}));
      const entriesByOrder = Object.entries(snapshot.ledger)
        .filter(([, entries]) => Array.isArray(entries) && entries.some((entry) => entry.type === 'course_resource_release'));
      return {
        entryCount: entriesByOrder.reduce(
          (total, [, entries]) => total + entries.filter((entry) => entry.type === 'course_resource_release').length,
          0,
        ),
        hasReleaseSource: entriesByOrder.some(([, entries]) =>
          entries.some((entry) => entry.type === 'course_resource_release' && entry.source === '资源发布'),
        ),
        hasBoundary: entriesByOrder.some(([, entries]) =>
          entries.some((entry) => entry.type === 'course_resource_release' && String(entry.detail || '').includes('不自动评价学生')),
        ),
      };
    })()`,
  );
  assert(
    recordedResourceRelease.entryCount >= 1 &&
      recordedResourceRelease.hasReleaseSource &&
      recordedResourceRelease.hasBoundary,
    "Recording the course resource release must write bounded resource-release ledger entries.",
  );
  await waitForCondition(
    send,
    "!!document.querySelector('[data-testid=\"course-resource-usage-receipt\"]') && document.querySelector('[data-testid=\"record-course-resource-usage\"]')?.disabled === false",
    "Course resource usage receipt did not become recordable after resource release.",
  );
  const resourceUsageReceipt = await evaluate(
    send,
    `(() => {
      const section = document.querySelector('[data-testid="course-resource-usage-receipt"]');
      return {
        text: section?.innerText ?? '',
        signalCount: document.querySelectorAll('[data-testid^="resource-usage-signal-"]').length,
        canExport: !!document.querySelector('[data-testid="export-course-resource-usage"]'),
        canRecord:
          document.querySelector('[data-testid="record-course-resource-usage"]')?.disabled === false,
      };
    })()`,
  );
  assert(
    resourceUsageReceipt.signalCount >= 3 &&
      resourceUsageReceipt.canExport &&
      resourceUsageReceipt.canRecord &&
      resourceUsageReceipt.text.includes("课程资源使用回流单") &&
      resourceUsageReceipt.text.includes("不自动评价学生"),
    "Course resource usage receipt must expose usage signals, export and record actions.",
  );
  const knownResourceUsageReports = await listDownloadsByExtension(".md");
  await clickTestId(send, "export-course-resource-usage");
  const resourceUsageMarkdown = await waitForNewTextDownload(knownResourceUsageReports, ".md");
  assert(
    resourceUsageMarkdown.includes("课程资源使用回流单") &&
      resourceUsageMarkdown.includes("使用信号") &&
      resourceUsageMarkdown.includes("下一步") &&
      resourceUsageMarkdown.includes("不排名"),
    "Course resource usage markdown must include usage signals, next action and formative boundaries.",
  );
  await clickTestId(send, "record-course-resource-usage");
  await waitForCondition(
    send,
    `(() => {
      const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}) || '{}');
      return Object.values(snapshot.ledger || {}).some((entries) =>
        Array.isArray(entries) && entries.some((entry) => entry.type === 'course_resource_usage')
      );
    })()`,
    "Course resource usage did not update the work-order ledger.",
  );
  const recordedResourceUsage = await evaluate(
    send,
    `(() => {
      const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}));
      const entriesByOrder = Object.entries(snapshot.ledger)
        .filter(([, entries]) => Array.isArray(entries) && entries.some((entry) => entry.type === 'course_resource_usage'));
      return {
        entryCount: entriesByOrder.reduce(
          (total, [, entries]) => total + entries.filter((entry) => entry.type === 'course_resource_usage').length,
          0,
        ),
        hasUsageSource: entriesByOrder.some(([, entries]) =>
          entries.some((entry) => entry.type === 'course_resource_usage' && entry.source === '使用回流'),
        ),
        hasBoundary: entriesByOrder.some(([, entries]) =>
          entries.some((entry) => entry.type === 'course_resource_usage' && String(entry.detail || '').includes('不自动评价学生')),
        ),
      };
    })()`,
  );
  assert(
    recordedResourceUsage.entryCount >= 1 &&
      recordedResourceUsage.hasUsageSource &&
      recordedResourceUsage.hasBoundary,
    "Recording the course resource usage receipt must write bounded usage ledger entries.",
  );
  await waitForCondition(
    send,
    "document.querySelector('[data-testid=\"remind-course-resource-usage\"]')?.disabled === false",
    "Course resource usage reminder did not become available after usage was recorded.",
  );
  await clickTestId(send, "remind-course-resource-usage");
  await waitForCondition(
    send,
    `(() => {
      const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}) || '{}');
      return Object.values(snapshot.ledger || {}).some((entries) =>
        Array.isArray(entries) &&
        entries.some((entry) => entry.type === 'teacher_reminder' && String(entry.traceId || '').startsWith('course-resource-usage-reminder-'))
      );
    })()`,
    "Course resource usage reminder did not update the work-order ledger.",
  );
  const recordedResourceUsageReminder = await evaluate(
    send,
    `(() => {
      const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}));
      const reminderEntries = Object.values(snapshot.ledger || {})
        .flatMap((entries) => Array.isArray(entries) ? entries : [])
        .filter((entry) => entry.type === 'teacher_reminder' && String(entry.traceId || '').startsWith('course-resource-usage-reminder-'));
      return {
        entryCount: reminderEntries.length,
        hasUsageTitle: reminderEntries.some((entry) => String(entry.title || '').includes('资源使用催办')),
        hasReminderSource: reminderEntries.some((entry) => entry.source === '教师催办'),
        hasDirectAnswerBoundary: reminderEntries.some((entry) => String(entry.detail || '').includes('不生成可直接提交的完整答案')),
        hasEvaluationBoundary: reminderEntries.some((entry) => String(entry.detail || '').includes('不自动评价学生')),
      };
    })()`,
  );
  assert(
    recordedResourceUsageReminder.entryCount >= 1 &&
      recordedResourceUsageReminder.hasUsageTitle &&
      recordedResourceUsageReminder.hasReminderSource &&
      recordedResourceUsageReminder.hasDirectAnswerBoundary &&
      recordedResourceUsageReminder.hasEvaluationBoundary,
    "Course resource usage reminders must write bounded teacher reminder ledger entries.",
  );
  await setFieldValue(
    send,
    "roster-textarea",
    [
      "2301180911, BATCH-0911, C 组, learner-0911, active",
      "2301180912, BATCH-0912, C 组, learner-0912, watch",
    ].join("\n"),
  );
  await clickTestId(send, "save-roster");
  await waitForCondition(
    send,
    `(() => {
      const roster = JSON.parse(localStorage.getItem(${JSON.stringify(rosterStorageKey)}));
      return roster?.learners?.length === 2 &&
        roster.learners.every((learner) => learner.learnerHash.startsWith('stu_hash_')) &&
        roster.learners.some((learner) => learner.learnerAlias === 'BATCH-0911');
    })()`,
    "Course roster save did not produce a pseudonymous roster.",
  );
  await setFieldValue(send, "batch-trigger-field", "第 5 周异常路径批量巡检");
  await setFieldValue(
    send,
    "batch-summary-field",
    "批量检查本周 PR/CI、测试清单和课堂求助记录；证据不足时只形成待补证的候选增值诊断单。",
  );
  await clickTestId(send, "batch-create-workorders");
  await waitForCondition(
    send,
    `(() => {
      const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}));
      const batchOrders = snapshot.workOrders.filter((order) => order.trigger === '第 5 周异常路径批量巡检');
      return batchOrders.length >= 2 &&
        batchOrders.every((order) => order.id.startsWith('wo-batch-')) &&
        batchOrders.every((order) => order.status === 'diagnosis') &&
        batchOrders.every((order) => order.evidenceCoverage < 50);
    })()`,
    "Course batch operation did not create diagnosis-stage candidate work orders.",
  );
  snapshot = await readSnapshot(send);
  const batchOrders = snapshot.workOrders.filter((order) => order.trigger === "第 5 周异常路径批量巡检");
  assert(batchOrders.length >= 2, "Course batch must add multiple candidate diagnosis cards.");
  assert(
    batchOrders.every((order) => snapshot.ledger[order.id]?.[0]?.type === "intake"),
    "Course batch must write an intake ledger entry for every candidate.",
  );
  assert(
    batchOrders.every((order) => order.diagnosis.includes("候选诊断")),
    "Course batch diagnosis must stay clearly marked as a candidate.",
  );
  await evaluate(
    send,
    "document.querySelector('.el-drawer__close-btn')?.click(); true",
  );
  await sleep(450);

  await clickTestId(send, "open-course-launch");
  await waitForCondition(
    send,
    "document.body.innerText.includes('开课初始化') && !!document.querySelector('[data-testid=\"course-launch-drawer\"]')",
    "Course launch drawer did not render.",
  );
  await setFieldValue(
    send,
    "launch-roster-textarea",
    [
      "2301182011, LAUNCH-2011, 初始化 A 组, learner-launch-2011, active",
      "2301182012, LAUNCH-2012, 初始化 A 组, learner-launch-2012, watch",
    ].join("\n"),
  );
  await setFieldValue(send, "launch-trigger", "第 6 周开课初始化巡检");
  await setFieldValue(
    send,
    "launch-task-summary",
    "从 PR、CI、测试清单、课堂求助和学习反思中收集证据；证据不足时只生成候选诊断单，由教师确认下一步。",
  );
  await waitForCondition(
    send,
    "document.querySelector('[data-testid=\"launch-readiness\"]')?.innerText.includes('上线前检查') && document.querySelector('[data-testid=\"launch-submit\"]')?.disabled === false",
    "Course launch readiness should enable first-round diagnosis generation.",
  );
  const beforeLaunchCount = await evaluate(
    send,
    `(() => JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)})).workOrders.length)()`,
  );
  await clickTestId(send, "launch-submit");
  await waitForCondition(
    send,
    `(() => {
      const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}));
      const launchOrders = snapshot.workOrders.filter((order) => order.trigger === '第 6 周开课初始化巡检');
      const roster = JSON.parse(localStorage.getItem(${JSON.stringify(rosterStorageKey)}));
      return snapshot.workOrders.length >= ${beforeLaunchCount} + 2 &&
        launchOrders.length >= 2 &&
        launchOrders.every((order) => order.status === 'diagnosis') &&
        launchOrders.every((order) => order.diagnosis.includes('候选诊断')) &&
        launchOrders.every((order) => snapshot.ledger[order.id]?.[0]?.type === 'intake') &&
        roster?.learners?.some((learner) => learner.learnerAlias === 'LAUNCH-2011');
    })()`,
    "Course launch did not generate usable first-round diagnosis work orders.",
  );
  const launchResult = await evaluate(
    send,
    `(() => ({
      resultText: document.querySelector('[data-testid="launch-result"]')?.innerText ?? '',
      selectedId: JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)})).selectedId,
    }))()`,
  );
  assert(
    launchResult.resultText.includes("新增诊断单") &&
      launchResult.resultText.includes("伪名学习者"),
    "Course launch drawer must show a concrete launch result.",
  );
  assert(
    typeof launchResult.selectedId === "string" && launchResult.selectedId.startsWith("wo-batch-"),
    "Course launch should select a newly generated diagnosis work order.",
  );
  await evaluate(
    send,
    "document.querySelector('.el-drawer__close-btn')?.click(); true",
  );
  await sleep(450);
  await waitForCondition(
    send,
    "!!document.querySelector('[data-testid=\"today-task-inbox\"]') && !!document.querySelector('[data-testid=\"today-batch-bar\"]')",
    "Today inbox batch bar did not render after course launch.",
  );
  if (!apiMode) {
    await clickTestId(send, "reset-workbench");
    await waitForCondition(
      send,
      `(() => {
        const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}));
        return snapshot.selectedId === 'wo-se-018' && !Object.values(snapshot.ledger || {}).some((entries) =>
          Array.isArray(entries) && entries.some((entry) => entry.type === 'course_micro_task')
        );
      })()`,
      "Reset did not prepare a clean today inbox for batch handling.",
    );
  }
  const inboxSelectionIds = await evaluate(
    send,
    `(() => {
      const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}) || '{}');
      return Array.from(document.querySelectorAll('input[data-testid^="today-select-"]'))
        .map((node) => node.getAttribute('data-testid').replace('today-select-', ''))
        .filter((id) => !(snapshot.ledger[id] || []).some((entry) => entry.type === 'course_micro_task'))
        .slice(0, 2);
    })()`,
  );
  assert(
    Array.isArray(inboxSelectionIds) && inboxSelectionIds.length === 2,
    "Today inbox must expose at least two selectable work orders for batch handling.",
  );
  for (const id of inboxSelectionIds) {
    await clickTestId(send, `today-select-${id}`);
  }
  await sleep(600);
  const todayBatchSelectionState = await evaluate(
    send,
    `(() => {
      const countText = document.querySelector('[data-testid="today-selected-count"]')?.innerText ?? '';
      const button = document.querySelector('[data-testid="today-publish-selected-micro-task"]');
      const barText = document.querySelector('[data-testid="today-batch-bar"]')?.innerText ?? '';
      return {
        countText,
        buttonDisabled: button?.disabled ?? null,
        buttonText: button?.innerText ?? '',
        barText,
      };
    })()`,
  );
  assert(
    todayBatchSelectionState.countText.includes("已选 2") &&
      todayBatchSelectionState.buttonDisabled === false,
    `Today inbox batch selection did not enable micro-task publication: ${JSON.stringify(todayBatchSelectionState)}`,
  );
  const beforeTodayBatchMicroTaskCount = await evaluate(
    send,
    `(() => {
      const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}) || '{}');
      return Object.values(snapshot.ledger || {}).reduce(
        (total, entries) => total + (Array.isArray(entries) ? entries.filter((entry) => entry.type === 'course_micro_task').length : 0),
        0,
      );
    })()`,
  );
  await clickTestId(send, "today-publish-selected-micro-task");
  await waitForCondition(
    send,
    `(() => {
      const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}) || '{}');
      const count = Object.values(snapshot.ledger || {}).reduce(
        (total, entries) => total + (Array.isArray(entries) ? entries.filter((entry) => entry.type === 'course_micro_task').length : 0),
        0,
      );
      return count >= ${beforeTodayBatchMicroTaskCount} + 2;
    })()`,
    "Today inbox batch micro-task publication did not write ledger entries.",
  );
  const todayBatchPublishState = await evaluate(
    send,
    `(() => {
      const ids = ${JSON.stringify(inboxSelectionIds)};
      const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}));
      return {
        cleared: document.querySelector('[data-testid="today-selected-count"]')?.innerText.includes('已选 0'),
        targetLedgers: ids.every((id) =>
          snapshot.ledger[id]?.some((entry) =>
            entry.type === 'course_micro_task' &&
            entry.source === '课程运营' &&
            String(entry.detail || '').includes('不生成可直接提交')
          )
        ),
      };
    })()`,
  );
  assert(
    todayBatchPublishState.cleared && todayBatchPublishState.targetLedgers,
    "Today inbox batch handling must clear selection and preserve bounded ledger entries for selected work orders.",
  );
  const batchStudentOrderId = inboxSelectionIds[0];
  const batchStudentUrl = await evaluate(
    send,
    `(() => {
      const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}));
      const order = snapshot.workOrders.find((item) => item.id === ${JSON.stringify(batchStudentOrderId)});
      if (!order?.interventionPackage) return "";
      const params = new URLSearchParams({ mode: "student", order: order.id });
      if (order.returnToken) params.set("returnToken", order.returnToken);
      const apiBase = ${JSON.stringify(apiBase)};
      if (apiBase) params.set("api", apiBase);
      return window.location.origin + window.location.pathname + "?" + params.toString();
    })()`,
  );
  assert(
    batchStudentUrl.includes(`order=${encodeURIComponent(batchStudentOrderId)}`) &&
      batchStudentUrl.includes("returnToken="),
    "Today inbox batch publication must open a scoped student return URL.",
  );
  await send("Page.navigate", { url: batchStudentUrl });
  await waitForCondition(
    send,
    "document.readyState === 'complete' && !!document.querySelector('[data-testid=\"student-portal\"]') && !!document.querySelector('[data-testid=\"student-task-package\"]')",
    "Batch micro-task student portal did not render.",
  );
  const batchStudentPackageText = await evaluate(
    send,
    "document.querySelector('[data-testid=\"student-task-package\"]')?.innerText ?? ''",
  );
  assert(
    batchStudentPackageText.includes("课堂微任务") &&
      batchStudentPackageText.includes("安全边界") &&
      batchStudentPackageText.includes("不生成可直接提交"),
    "Batch micro-task must become a student-visible task package with the safety boundary.",
  );
  await clickTestId(send, "student-portal-submit-scaffold");
  await waitForCondition(
    send,
    `(() => {
      const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}));
      const order = snapshot.workOrders.find((item) => item.id === ${JSON.stringify(batchStudentOrderId)});
      return snapshot.studentReturn?.[${JSON.stringify(batchStudentOrderId)}]?.scaffoldReceived === true &&
        order?.status === 'intervention' &&
        snapshot.ledger?.[${JSON.stringify(batchStudentOrderId)}]?.some((entry) => entry.type === 'student_return');
    })()`,
    "Batch micro-task student receipt did not write back to the closed loop.",
  );
  const teacherUrlAfterBatchStudent = new URL(appUrl);
  if (apiBase) teacherUrlAfterBatchStudent.searchParams.set("api", apiBase);
  await send("Page.navigate", { url: teacherUrlAfterBatchStudent.toString() });
  await waitForCondition(
    send,
    "document.readyState === 'complete' && !!document.querySelector('[data-testid=\"today-task-inbox\"]')",
    "Teacher inbox did not render after batch student receipt.",
  );
  await clickTestId(send, `today-row-${batchStudentOrderId}`);
  await waitForCondition(
    send,
    `(() => {
      const entry = document.querySelector('[data-testid="today-student-return-entry"]')?.innerText ?? '';
      return entry.includes('学生入口') && entry.includes('1/3');
    })()`,
    "Teacher inbox did not show student receipt progress for the batch micro-task.",
  );
  await waitForCondition(
    send,
    `(() => {
      const board = document.querySelector('[data-testid="batch-micro-task-tracking"]')?.innerText ?? '';
      const started = document.querySelector('[data-testid="batch-tracking-started"]')?.innerText ?? '';
      const row = document.querySelector('[data-testid="batch-tracking-row-${batchStudentOrderId}"]')?.innerText ?? '';
      return board.includes('1/3') && started.includes('1') && row.includes('1/3');
    })()`,
    "Teacher batch tracking board did not summarize the student receipt state.",
  );
  await clickTestId(send, `batch-tracking-select-${inboxSelectionIds[1]}`);
  await waitForCondition(
    send,
    `(() => {
      const entry = document.querySelector('[data-testid="today-student-return-entry"]')?.innerText ?? '';
      const row = document.querySelector('[data-testid="batch-tracking-row-${inboxSelectionIds[1]}"]')?.classList.contains('active');
      return row === true && entry.includes('0/3');
    })()`,
    "Teacher batch tracking board did not switch review context to another target learner.",
  );
  const beforeReminderCount = await evaluate(
    send,
    `(() => {
      const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}));
      const ids = ${JSON.stringify(inboxSelectionIds)};
      return ids.reduce((sum, id) => sum + (snapshot.ledger[id] || []).filter((entry) => entry.type === 'teacher_reminder').length, 0);
    })()`,
  );
  await clickTestId(send, "batch-tracking-remind-pending");
  await waitForCondition(
    send,
    `(() => {
      const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}));
      const ids = ${JSON.stringify(inboxSelectionIds)};
      const reminderCount = ids.reduce((sum, id) => sum + (snapshot.ledger[id] || []).filter((entry) => entry.type === 'teacher_reminder').length, 0);
      return reminderCount >= ${beforeReminderCount} + ids.length &&
        ids.every((id) => (snapshot.ledger[id] || []).some((entry) => entry.type === 'teacher_reminder' && String(entry.detail || '').includes('不生成可直接提交')));
    })()`,
    "Teacher batch tracking reminder did not write bounded reminder ledger entries.",
  );
}

await rm(downloadDir, { recursive: true, force: true });
await mkdir(downloadDir, { recursive: true });

const viteBin = path.resolve(
  "node_modules",
  ".bin",
  process.platform === "win32" ? "vite.cmd" : "vite",
);
const viteCommand = process.platform === "win32" ? "cmd.exe" : viteBin;
const viteArgs =
  process.platform === "win32"
    ? ["/c", viteBin, "--host", "127.0.0.1", "--port", String(appPort), "--strictPort"]
    : ["--host", "127.0.0.1", "--port", String(appPort), "--strictPort"];

const vite = spawn(viteCommand, viteArgs, { stdio: "ignore" });

let chrome;
try {
  await waitForServer();
  chrome = spawn(
    chromePath,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      `--remote-debugging-port=${cdpPort}`,
      `--user-data-dir=${userDataDir}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  const wsUrl = await waitForPageWebSocket();
  const cdp = await connectCdp(wsUrl);
  try {
    await runBrowserFlow(cdp.send);
  } finally {
    cdp.close();
  }

  console.log(
    "SE-Path flow tests passed: teacher decision, reviewer validation, student return, return-for-evidence revision, second student return, teacher acceptance closure, ledger audit search/filter, ledger export, intake, course operations batch, course launch initialization, course micro-task publish ledger, course teaching improvement ledger, course teaching execution receipt ledger, teaching followup sampling ledger, teaching followup result ledger, course resource revision ledger, course resource release ledger, course resource usage ledger, course resource usage reminder ledger, today inbox batch student receipt, batch tracking board, teacher reminder ledger, case switching, reset, and safety boundaries.",
  );
} finally {
  chrome?.kill();
  vite.kill();
}
