import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";

const chromePath =
  process.env.CHROME_PATH ??
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const appPort = Number(process.env.SEPATH_CAPTURE_APP_PORT ?? 5314);
const cdpPort = Number(process.env.SEPATH_CAPTURE_CDP_PORT ?? 9514);
const outDir = path.resolve("qa/screenshots");
const storageKey = "sepath-yudao-workbench:glass-v1";
const userDataDir = path.join(
  process.env.TEMP ?? ".",
  `sepath-capture-cdp-${Date.now()}`,
);

const viewports = [
  { name: "desktop-1440", width: 1440, height: 1024 },
  { name: "laptop-1024", width: 1024, height: 900 },
  { name: "tablet-768", width: 768, height: 900 },
  { name: "mobile-390", width: 390, height: 900 },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  throw new Error("Vite capture server did not become ready.");
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
  await waitForCondition(
    send,
    `!!document.querySelector('[data-testid="${testId}"]')`,
    `Missing test target before click: ${testId}`,
  );
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

async function acceptTeacherEvidenceReview(send, note = "证据已逐项复核，可进入形成性验收。") {
  await waitForCondition(
    send,
    "!!document.querySelector('[data-testid=\"teacher-evidence-review-panel\"]')",
    "Teacher evidence review panel did not render for capture.",
  );
  const acceptedButtons = await evaluate(
    send,
    `(() => Array.from(
      document.querySelectorAll('[data-testid^="teacher-evidence-review-"][data-testid$="-accepted"]'),
    ).map((node) => node.getAttribute('data-testid')).filter(Boolean))()`,
  );
  if (!acceptedButtons.length) {
    throw new Error("Teacher evidence review capture found no accepted buttons.");
  }
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
      return snapshot.ledger[order.id]?.[0]?.type === 'teacher_evidence_review';
    })()`,
    "Teacher evidence review was not saved before capture.",
  );
}

async function fillTeacherPackageDraft(send) {
  await setFieldValue(
    send,
    "package-draft-objective",
    "教师确认稿：先把 REST API 失败路径变成可复核证据，再做最小修复，不提交完整答案。",
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
}

async function assertNoHorizontalOverflow(send, label) {
  const metrics = await evaluate(
    send,
    `(() => ({
      docScroll: document.documentElement.scrollWidth,
      docClient: document.documentElement.clientWidth,
      bodyScroll: document.body.scrollWidth,
      bodyClient: document.body.clientWidth
    }))()`,
  );
  if (
    metrics.docScroll > metrics.docClient + 1 ||
    metrics.bodyScroll > metrics.bodyClient + 1
  ) {
    throw new Error(
      `${label} has horizontal overflow: doc=${metrics.docScroll}/${metrics.docClient}, body=${metrics.bodyScroll}/${metrics.bodyClient}`,
    );
  }
}

async function capture(send, viewport) {
  await send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: viewport.width < 600,
  });
  await send("Page.navigate", {
    url: `http://127.0.0.1:${appPort}/?v=production-workbench-capture`,
  });
  await waitForCondition(
    send,
    "document.readyState === 'complete' && !!document.querySelector('[data-testid=\"decision-approve\"]')",
    `Workbench did not render at ${viewport.name}.`,
  );
  await evaluate(send, "localStorage.clear(); true");
  await send("Page.reload", { ignoreCache: true });
  await waitForCondition(
    send,
    "document.readyState === 'complete' && !!document.querySelector('[data-testid=\"decision-approve\"]')",
    `Clean workbench did not render at ${viewport.name}.`,
  );
  await sleep(600);
  await assertNoHorizontalOverflow(send, viewport.name);
  const image = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
  });
  const outPath = path.join(outDir, `sepath-${viewport.name}.png`);
  await writeFile(outPath, Buffer.from(image.data, "base64"));
  return outPath;
}

async function captureCourseSettings(send) {
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1024,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send("Page.navigate", {
    url: `http://127.0.0.1:${appPort}/?v=course-settings-capture`,
  });
  await waitForCondition(
    send,
    "document.readyState === 'complete' && !!document.querySelector('[data-testid=\"open-course-settings\"]')",
    "Workbench did not render before course settings capture.",
  );
  await clickTestId(send, "open-course-settings");
  await waitForCondition(
    send,
    "!!document.querySelector('[data-testid=\"pilot-launch-checklist\"]') && !!document.querySelector('[data-testid=\"github-workflow-snippet\"]') && !!document.querySelector('[data-testid=\"webhook-signature-card\"]') && !!document.querySelector('[data-testid=\"github-integration-status\"]')",
    "Course settings integration drawer did not render.",
  );
  await sleep(600);
  await assertNoHorizontalOverflow(send, "course settings");
  const image = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
  });
  const outPath = path.join(outDir, "sepath-course-settings-1440.png");
  await writeFile(outPath, Buffer.from(image.data, "base64"));
  return outPath;
}

async function captureCourseLaunch(send) {
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1024,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send("Page.navigate", {
    url: `http://127.0.0.1:${appPort}/?v=course-launch-capture`,
  });
  await waitForCondition(
    send,
    "document.readyState === 'complete' && !!document.querySelector('[data-testid=\"open-course-launch\"]')",
    "Workbench did not render before course launch capture.",
  );
  await evaluate(send, "localStorage.clear(); true");
  await send("Page.reload", { ignoreCache: true });
  await waitForCondition(
    send,
    "document.readyState === 'complete' && !!document.querySelector('[data-testid=\"open-course-launch\"]')",
    "Clean workbench did not render before course launch capture.",
  );
  await clickTestId(send, "open-course-launch");
  await waitForCondition(
    send,
    "!!document.querySelector('[data-testid=\"course-launch-drawer\"]') && !!document.querySelector('[data-testid=\"launch-readiness\"]')",
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
  await waitForCondition(
    send,
    "document.querySelector('[data-testid=\"launch-submit\"]')?.disabled === false",
    "Course launch submit should be enabled for capture.",
  );
  await clickTestId(send, "launch-submit");
  await waitForCondition(
    send,
    "document.querySelector('[data-testid=\"launch-result\"]')?.innerText.includes('新增诊断单')",
    "Course launch result did not render for capture.",
  );
  await evaluate(
    send,
    "document.querySelectorAll('.el-message').forEach((node) => node.remove()); true",
  );
  await sleep(600);
  await assertNoHorizontalOverflow(send, "course launch");
  const image = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
  });
  const outPath = path.join(outDir, "sepath-course-launch-1440.png");
  await writeFile(outPath, Buffer.from(image.data, "base64"));
  return outPath;
}

async function captureCourseOps(send) {
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1024,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send("Page.navigate", {
    url: `http://127.0.0.1:${appPort}/?v=course-ops-capture`,
  });
  await waitForCondition(
    send,
    "document.readyState === 'complete' && !!document.querySelector('[data-testid=\"open-course-ops\"]')",
    "Workbench did not render before course operations capture.",
  );
  await clickTestId(send, "open-course-ops");
  await waitForCondition(
    send,
    "!!document.querySelector('[data-testid=\"course-ops-dashboard\"]') && !!document.querySelector('[data-testid=\"course-review-gate-board\"]') && !!document.querySelector('[data-testid=\"course-intervention-review\"]') && !!document.querySelector('[data-testid=\"course-priority-queue\"]') && !!document.querySelector('[data-testid=\"course-evidence-gap-matrix\"]') && !!document.querySelector('[data-testid=\"course-micro-task-package\"]') && !!document.querySelector('[data-testid=\"github-batch-import-card\"]') && !!document.querySelector('[data-testid=\"batch-create-workorders\"]')",
    "Course operations drawer did not render.",
  );
  await sleep(600);
  await assertNoHorizontalOverflow(send, "course operations");
  const image = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
  });
  const outPath = path.join(outDir, "sepath-course-ops-1440.png");
  await writeFile(outPath, Buffer.from(image.data, "base64"));
  await evaluate(
    send,
    "document.querySelector('[data-testid=\"course-micro-task-package\"]')?.scrollIntoView({ block: 'center' }); true",
  );
  await sleep(300);
  await clickTestId(send, "publish-course-micro-task");
  await waitForCondition(
    send,
    `(() => { const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}) || '{}'); return Object.values(snapshot.ledger || {}).some((entries) => Array.isArray(entries) && entries.some((event) => event.type === 'course_micro_task')); })()`,
    "Course micro-task package did not reach the published ledger state.",
  );
  await sleep(300);
  await evaluate(
    send,
    "document.querySelector('[data-testid=\"course-intervention-review\"]')?.scrollIntoView({ block: 'center' }); true",
  );
  await sleep(300);
  await assertNoHorizontalOverflow(send, "course intervention review");
  const interventionImage = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
  });
  const interventionOutPath = path.join(outDir, "sepath-intervention-review-1440.png");
  await writeFile(interventionOutPath, Buffer.from(interventionImage.data, "base64"));
  await waitForCondition(
    send,
    "!!document.querySelector('[data-testid=\"course-teaching-improvement-plan\"]')",
    "Course teaching improvement plan did not render for capture.",
  );
  await evaluate(
    send,
    "document.querySelector('[data-testid=\"course-teaching-improvement-plan\"]')?.scrollIntoView({ block: 'center' }); true",
  );
  await sleep(300);
  await assertNoHorizontalOverflow(send, "course teaching improvement plan");
  const teachingImprovementImage = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
  });
  const teachingImprovementOutPath = path.join(outDir, "sepath-teaching-improvement-1440.png");
  await writeFile(teachingImprovementOutPath, Buffer.from(teachingImprovementImage.data, "base64"));
  await clickTestId(send, "publish-course-teaching-improvement");
  await waitForCondition(
    send,
    `(() => { const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}) || '{}'); return Object.values(snapshot.ledger || {}).some((entries) => Array.isArray(entries) && entries.some((event) => event.type === 'teaching_improvement')); })()`,
    "Course teaching improvement plan did not reach the published ledger state.",
  );
  await waitForCondition(
    send,
    "!!document.querySelector('[data-testid=\"course-teaching-improvement-execution\"]') && document.querySelector('[data-testid=\"record-course-teaching-execution\"]')?.disabled === false",
    "Course teaching improvement execution receipt did not become recordable for capture.",
  );
  await evaluate(
    send,
    "document.querySelector('[data-testid=\"course-teaching-improvement-execution\"]')?.scrollIntoView({ block: 'center' }); true",
  );
  await sleep(300);
  await clickTestId(send, "record-course-teaching-execution");
  await waitForCondition(
    send,
    `(() => { const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}) || '{}'); return Object.values(snapshot.ledger || {}).some((entries) => Array.isArray(entries) && entries.some((event) => event.type === 'teaching_improvement_execution')); })()`,
    "Course teaching improvement execution receipt did not reach the ledger state.",
  );
  await sleep(3400);
  await assertNoHorizontalOverflow(send, "course teaching improvement execution");
  const teachingExecutionImage = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
  });
  const teachingExecutionOutPath = path.join(outDir, "sepath-teaching-execution-1440.png");
  await writeFile(teachingExecutionOutPath, Buffer.from(teachingExecutionImage.data, "base64"));
  await waitForCondition(
    send,
    "!!document.querySelector('[data-testid=\"course-teaching-improvement-followup\"]') && document.querySelector('[data-testid=\"record-course-teaching-followup\"]')?.disabled === false",
    "Course teaching improvement followup sample did not become recordable for capture.",
  );
  await evaluate(
    send,
    "document.querySelector('[data-testid=\"course-teaching-improvement-followup\"]')?.scrollIntoView({ block: 'center' }); true",
  );
  await sleep(300);
  await clickTestId(send, "record-course-teaching-followup");
  await waitForCondition(
    send,
    `(() => { const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}) || '{}'); return Object.values(snapshot.ledger || {}).some((entries) => Array.isArray(entries) && entries.some((event) => event.type === 'teaching_improvement_followup')); })()`,
    "Course teaching improvement followup sample did not reach the ledger state.",
  );
  await sleep(3400);
  await assertNoHorizontalOverflow(send, "course teaching improvement followup");
  const teachingFollowupImage = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
  });
  const teachingFollowupOutPath = path.join(outDir, "sepath-teaching-followup-1440.png");
  await writeFile(teachingFollowupOutPath, Buffer.from(teachingFollowupImage.data, "base64"));
  await waitForCondition(
    send,
    "!!document.querySelector('[data-testid=\"course-teaching-improvement-followup-result\"]') && document.querySelector('[data-testid=\"record-course-teaching-followup-result\"]')?.disabled === false",
    "Course teaching improvement followup result did not become recordable for capture.",
  );
  await evaluate(
    send,
    "document.querySelector('[data-testid=\"course-teaching-improvement-followup-result\"]')?.scrollIntoView({ block: 'center' }); true",
  );
  await sleep(300);
  await clickTestId(send, "record-course-teaching-followup-result");
  await waitForCondition(
    send,
    `(() => { const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}) || '{}'); return Object.values(snapshot.ledger || {}).some((entries) => Array.isArray(entries) && entries.some((event) => event.type === 'teaching_improvement_followup_result')); })()`,
    "Course teaching improvement followup result did not reach the ledger state.",
  );
  await sleep(3400);
  await assertNoHorizontalOverflow(send, "course teaching improvement followup result");
  const teachingFollowupResultImage = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
  });
  const teachingFollowupResultOutPath = path.join(outDir, "sepath-teaching-followup-result-1440.png");
  await writeFile(teachingFollowupResultOutPath, Buffer.from(teachingFollowupResultImage.data, "base64"));
  await waitForCondition(
    send,
    "!!document.querySelector('[data-testid=\"course-resource-revision-ticket\"]') && document.querySelector('[data-testid=\"record-course-resource-revision\"]')?.disabled === false",
    "Course resource revision ticket did not become recordable for capture.",
  );
  await evaluate(
    send,
    "document.querySelector('[data-testid=\"course-resource-revision-ticket\"]')?.scrollIntoView({ block: 'center' }); true",
  );
  await sleep(300);
  await clickTestId(send, "record-course-resource-revision");
  await waitForCondition(
    send,
    `(() => { const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}) || '{}'); return Object.values(snapshot.ledger || {}).some((entries) => Array.isArray(entries) && entries.some((event) => event.type === 'course_resource_revision')); })()`,
    "Course resource revision did not reach the ledger state.",
  );
  await sleep(3400);
  await assertNoHorizontalOverflow(send, "course resource revision");
  const resourceRevisionImage = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
  });
  const resourceRevisionOutPath = path.join(outDir, "sepath-course-resource-revision-1440.png");
  await writeFile(resourceRevisionOutPath, Buffer.from(resourceRevisionImage.data, "base64"));
  await waitForCondition(
    send,
    "!!document.querySelector('[data-testid=\"course-resource-release-receipt\"]') && document.querySelector('[data-testid=\"record-course-resource-release\"]')?.disabled === false",
    "Course resource release receipt did not become recordable for capture.",
  );
  await evaluate(
    send,
    "document.querySelector('[data-testid=\"course-resource-release-receipt\"]')?.scrollIntoView({ block: 'center' }); true",
  );
  await sleep(300);
  await clickTestId(send, "record-course-resource-release");
  await waitForCondition(
    send,
    `(() => { const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}) || '{}'); return Object.values(snapshot.ledger || {}).some((entries) => Array.isArray(entries) && entries.some((event) => event.type === 'course_resource_release')); })()`,
    "Course resource release did not reach the ledger state.",
  );
  await sleep(3400);
  await assertNoHorizontalOverflow(send, "course resource release");
  const resourceReleaseImage = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
  });
  const resourceReleaseOutPath = path.join(outDir, "sepath-course-resource-release-1440.png");
  await writeFile(resourceReleaseOutPath, Buffer.from(resourceReleaseImage.data, "base64"));
  await waitForCondition(
    send,
    "!!document.querySelector('[data-testid=\"course-resource-usage-receipt\"]') && document.querySelector('[data-testid=\"record-course-resource-usage\"]')?.disabled === false",
    "Course resource usage receipt did not become recordable for capture.",
  );
  await evaluate(
    send,
    "document.querySelector('[data-testid=\"course-resource-usage-receipt\"]')?.scrollIntoView({ block: 'center' }); true",
  );
  await sleep(300);
  await clickTestId(send, "record-course-resource-usage");
  await waitForCondition(
    send,
    `(() => { const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}) || '{}'); return Object.values(snapshot.ledger || {}).some((entries) => Array.isArray(entries) && entries.some((event) => event.type === 'course_resource_usage')); })()`,
    "Course resource usage did not reach the ledger state.",
  );
  await waitForCondition(
    send,
    "document.querySelector('[data-testid=\"remind-course-resource-usage\"]')?.disabled === false",
    "Course resource usage reminder did not become available for capture.",
  );
  await clickTestId(send, "remind-course-resource-usage");
  await waitForCondition(
    send,
    `(() => { const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}) || '{}'); return Object.values(snapshot.ledger || {}).some((entries) => Array.isArray(entries) && entries.some((event) => event.type === 'teacher_reminder' && String(event.traceId || '').startsWith('course-resource-usage-reminder-'))); })()`,
    "Course resource usage reminder did not reach the ledger state.",
  );
  await sleep(3400);
  await assertNoHorizontalOverflow(send, "course resource usage");
  const resourceUsageImage = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
  });
  const resourceUsageOutPath = path.join(outDir, "sepath-course-resource-usage-1440.png");
  await writeFile(resourceUsageOutPath, Buffer.from(resourceUsageImage.data, "base64"));
  await evaluate(
    send,
    "document.querySelector('[data-testid=\"course-micro-task-package\"]')?.scrollIntoView({ block: 'center' }); true",
  );
  await sleep(300);
  await assertNoHorizontalOverflow(send, "course micro task");
  const microImage = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
  });
  const microOutPath = path.join(outDir, "sepath-course-micro-task-1440.png");
  await writeFile(microOutPath, Buffer.from(microImage.data, "base64"));
  await evaluate(
    send,
    "document.querySelector('[data-testid=\"github-batch-import-card\"]')?.scrollIntoView({ block: 'center' }); true",
  );
  await sleep(300);
  await clickTestId(send, "submit-github-batch-import");
  await waitForCondition(
    send,
    `(() => { const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}) || '{}'); return Array.isArray(snapshot.workOrders) && snapshot.workOrders.some((order) => order.studentNo === 'learner-0321' || order.learnerHash === 'learner-0321'); })()`,
    "GitHub batch import did not create a diagnosis work order for capture.",
  );
  await sleep(300);
  await assertNoHorizontalOverflow(send, "GitHub batch import");
  const batchImage = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
  });
  const batchOutPath = path.join(outDir, "sepath-github-batch-import-1440.png");
  await writeFile(batchOutPath, Buffer.from(batchImage.data, "base64"));
  return [
    outPath,
    interventionOutPath,
    teachingImprovementOutPath,
    teachingExecutionOutPath,
    teachingFollowupOutPath,
    teachingFollowupResultOutPath,
    resourceRevisionOutPath,
    resourceReleaseOutPath,
    resourceUsageOutPath,
    microOutPath,
    batchOutPath,
  ];
}

async function captureLearnerProfile(send) {
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1024,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send("Page.navigate", {
    url: `http://127.0.0.1:${appPort}/?v=learner-profile-capture`,
  });
  await waitForCondition(
    send,
    "document.readyState === 'complete' && !!document.querySelector('[data-testid=\"open-learner-profile\"]')",
    "Workbench did not render before learner profile capture.",
  );
  await clickTestId(send, "open-learner-profile");
  await waitForCondition(
    send,
    "!!document.querySelector('[data-testid=\"learner-profile-drawer\"]') && !!document.querySelector('[data-testid=\"learner-profile-timeline\"]')",
    "Learner profile drawer did not render.",
  );
  await sleep(600);
  await assertNoHorizontalOverflow(send, "learner profile");
  const image = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
  });
  const outPath = path.join(outDir, "sepath-learner-profile-1440.png");
  await writeFile(outPath, Buffer.from(image.data, "base64"));
  return outPath;
}

async function captureBatchTracking(send) {
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1024,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send("Page.navigate", {
    url: `http://127.0.0.1:${appPort}/?v=batch-tracking-capture`,
  });
  await waitForCondition(
    send,
    "document.readyState === 'complete' && !!document.querySelector('[data-testid=\"today-task-inbox\"]')",
    "Workbench did not render before batch tracking capture.",
  );
  const targetIds = await evaluate(
    send,
    `(() => {
      const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}) || '{}');
      const traceCount = {};
      for (const [orderId, entries] of Object.entries(snapshot.ledger || {})) {
        for (const entry of entries || []) {
          if (entry.type !== 'course_micro_task' || !entry.traceId) continue;
          traceCount[entry.traceId] = traceCount[entry.traceId] || [];
          traceCount[entry.traceId].push(orderId);
        }
      }
      const match = Object.values(traceCount).find((ids) => ids.length > 1);
      return match || [];
    })()`,
  );
  if (!Array.isArray(targetIds) || targetIds.length < 2) {
    throw new Error("Batch tracking capture needs a published multi-learner micro-task.");
  }
  const studentUrl = await evaluate(
    send,
    `(() => {
      const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}));
      const order = snapshot.workOrders.find((item) => item.id === ${JSON.stringify(targetIds[0])});
      if (!order?.interventionPackage || !order.returnToken) return '';
      const params = new URLSearchParams({ mode: 'student', order: order.id, returnToken: order.returnToken });
      return window.location.origin + window.location.pathname + '?' + params.toString();
    })()`,
  );
  if (!studentUrl) throw new Error("Batch tracking capture target has no student return URL.");
  await send("Page.navigate", { url: studentUrl });
  await waitForCondition(
    send,
    "document.readyState === 'complete' && !!document.querySelector('[data-testid=\"student-task-package\"]')",
    "Student task package did not render before batch tracking capture.",
  );
  await clickTestId(send, "student-portal-submit-scaffold");
  await waitForCondition(
    send,
    `(() => {
      const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}));
      return snapshot.studentReturn?.[${JSON.stringify(targetIds[0])}]?.scaffoldReceived === true;
    })()`,
    "Student receipt did not persist before batch tracking capture.",
  );
  await send("Page.navigate", {
    url: `http://127.0.0.1:${appPort}/?v=batch-tracking-teacher-capture`,
  });
  await waitForCondition(
    send,
    "document.readyState === 'complete' && !!document.querySelector('[data-testid=\"today-task-inbox\"]')",
    "Teacher inbox did not render before batch tracking screenshot.",
  );
  await clickTestId(send, `today-row-${targetIds[0]}`);
  await waitForCondition(
    send,
    `(() => {
      const panel = document.querySelector('[data-testid="batch-micro-task-tracking"]');
      return !!panel && panel.innerText.includes('1/3');
    })()`,
    "Batch tracking panel did not render before screenshot.",
  );
  await evaluate(
    send,
    "document.querySelector('[data-testid=\"batch-micro-task-tracking\"]')?.scrollIntoView({ block: 'center' }); true",
  );
  await sleep(500);
  await assertNoHorizontalOverflow(send, "batch micro-task tracking");
  const image = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
  });
  const outPath = path.join(outDir, "sepath-batch-tracking-1440.png");
  await writeFile(outPath, Buffer.from(image.data, "base64"));
  return outPath;
}

async function capturePublishedPackage(send) {
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1024,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send("Page.navigate", {
    url: `http://127.0.0.1:${appPort}/?v=task-package-capture`,
  });
  await waitForCondition(
    send,
    "document.readyState === 'complete' && !!document.querySelector('[data-testid=\"decision-approve\"]')",
    "Workbench did not render before task package capture.",
  );
  await evaluate(send, "localStorage.clear(); true");
  await send("Page.reload", { ignoreCache: true });
  await waitForCondition(
    send,
    "document.readyState === 'complete' && !!document.querySelector('[data-testid=\"decision-approve\"]')",
    "Clean workbench did not render before task package capture.",
  );
  await clickTestId(send, "decision-approve");
  await waitForCondition(
    send,
    "!!document.querySelector('[data-testid=\"publish-package\"]') && !document.querySelector('[data-testid=\"publish-package\"]')?.disabled",
    "Publish package button did not become available.",
  );
  await fillTeacherPackageDraft(send);
  await evaluate(
    send,
    "document.querySelectorAll('.el-message').forEach((node) => node.remove()); document.querySelector('[data-testid=\"package-draft-editor\"]')?.scrollIntoView({ block: 'center' }); true",
  );
  await sleep(600);
  await assertNoHorizontalOverflow(send, "package draft editor");
  const draftImage = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
  });
  const draftOutPath = path.join(outDir, "sepath-package-draft-1440.png");
  await writeFile(draftOutPath, Buffer.from(draftImage.data, "base64"));
  await clickTestId(send, "publish-package");
  await waitForCondition(
    send,
    "!!document.querySelector('[data-testid=\"intervention-package-card\"]')",
    "Intervention package card did not render for capture.",
  );
  await evaluate(
    send,
    "document.querySelectorAll('.el-message').forEach((node) => node.remove()); true",
  );
  await sleep(600);
  await assertNoHorizontalOverflow(send, "published package");
  const image = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
  });
  const outPath = path.join(outDir, "sepath-task-package-1440.png");
  await writeFile(outPath, Buffer.from(image.data, "base64"));
  return [draftOutPath, outPath];
}

async function captureTeacherClosure(send) {
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1024,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send("Page.navigate", {
    url: `http://127.0.0.1:${appPort}/?v=teacher-closure-capture`,
  });
  await waitForCondition(
    send,
    "document.readyState === 'complete' && !!document.querySelector('[data-testid=\"decision-approve\"]')",
    "Workbench did not render before teacher closure capture.",
  );
  await evaluate(send, "localStorage.clear(); true");
  await send("Page.reload", { ignoreCache: true });
  await waitForCondition(
    send,
    "document.readyState === 'complete' && !!document.querySelector('[data-testid=\"decision-approve\"]')",
    "Clean workbench did not render before teacher closure capture.",
  );
  await clickTestId(send, "decision-approve");
  await waitForCondition(
    send,
    "!!document.querySelector('[data-testid=\"publish-package\"]') && !document.querySelector('[data-testid=\"publish-package\"]')?.disabled",
    "Publish package button did not become available before teacher closure capture.",
  );
  await clickTestId(send, "publish-package");
  await waitForCondition(
    send,
    "!!document.querySelector('[data-testid=\"student-return-scaffold\"]') && !document.querySelector('[data-testid=\"student-return-scaffold\"]')?.disabled",
    "Student return manual registration did not open.",
  );
  await clickTestId(send, "student-return-scaffold");
  await waitForCondition(
    send,
    "!document.querySelector('[data-testid=\"student-return-evidence\"]')?.disabled",
    "Student evidence return button did not become available.",
  );
  await clickTestId(send, "student-return-evidence");
  await waitForCondition(
    send,
    "!document.querySelector('[data-testid=\"student-return-reflection\"]')?.disabled",
    "Student reflection return button did not become available.",
  );
  await clickTestId(send, "student-return-reflection");
  await waitForCondition(
    send,
    "!!document.querySelector('[data-testid=\"teacher-closure-panel\"]') && !!document.querySelector('[data-testid=\"teacher-evidence-review-panel\"]') && document.querySelector('[data-testid=\"close-work-order\"]')?.disabled === true",
    "Teacher closure panel did not render.",
  );
  await evaluate(
    send,
    `(() => {
      document.querySelectorAll('.el-message').forEach((node) => node.remove());
      const node = document.querySelector('[data-testid="teacher-evidence-review-panel"]');
      if (!node) throw new Error('Missing teacher evidence review panel before capture.');
      const top = node.getBoundingClientRect().top + window.scrollY - 140;
      window.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
      return true;
    })()`,
  );
  await sleep(600);
  await assertNoHorizontalOverflow(send, "teacher closure");
  const image = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
  });
  const outPath = path.join(outDir, "sepath-teacher-closure-1440.png");
  await writeFile(outPath, Buffer.from(image.data, "base64"));

  await clickTestId(send, "return-closure-evidence");
  await waitForCondition(
    send,
    "!!document.querySelector('[data-testid=\"closure-return-guidance\"]')",
    "Return-for-evidence guidance did not render for capture.",
  );
  await evaluate(
    send,
    `(() => {
      document.querySelectorAll('.el-message').forEach((node) => node.remove());
      const node = document.querySelector('[data-testid="closure-return-guidance"]');
      if (!node) throw new Error('Missing return guidance before capture.');
      const top = node.getBoundingClientRect().top + window.scrollY - 120;
      window.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
      return true;
    })()`,
  );
  await sleep(600);
  await assertNoHorizontalOverflow(send, "teacher returned for evidence");
  const returnedImage = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
  });
  const returnedOutPath = path.join(outDir, "sepath-return-evidence-1440.png");
  await writeFile(returnedOutPath, Buffer.from(returnedImage.data, "base64"));

  await clickTestId(send, "student-return-evidence");
  await waitForCondition(
    send,
    "!document.querySelector('[data-testid=\"student-return-reflection\"]')?.disabled",
    "Second reflection return button did not become available.",
  );
  await clickTestId(send, "student-return-reflection");
  await waitForCondition(
    send,
    "!!document.querySelector('[data-testid=\"teacher-closure-panel\"]') && !!document.querySelector('[data-testid=\"close-work-order\"]')",
    "Teacher closure panel did not return after second student return.",
  );
  await acceptTeacherEvidenceReview(send, "二次补证据已复核，可进入形成性验收。");
  await clickTestId(send, "close-work-order");
  await waitForCondition(
    send,
    "!!document.querySelector('[data-testid=\"value-added-snapshot\"]')",
    "Value-added snapshot panel did not render after teacher closure.",
  );
  await evaluate(
    send,
    "document.querySelectorAll('.el-message').forEach((node) => node.remove()); true",
  );
  await sleep(600);
  await assertNoHorizontalOverflow(send, "teacher accepted snapshot");
  const acceptedImage = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
  });
  const acceptedOutPath = path.join(outDir, "sepath-value-added-snapshot-1440.png");
  await writeFile(acceptedOutPath, Buffer.from(acceptedImage.data, "base64"));

  await clickTestId(send, "open-ledger");
  await waitForCondition(
    send,
    "!!document.querySelector('[data-testid=\"ledger-audit-drawer\"]') && !!document.querySelector('[data-testid=\"ledger-filter-student\"]')",
    "Ledger audit drawer did not render for capture.",
  );
  await clickTestId(send, "ledger-filter-student");
  await setFieldValue(send, "ledger-search", "学生回流");
  await waitForCondition(
    send,
    "document.querySelector('[data-testid=\"ledger-filtered-list\"]')?.innerText.includes('学生回流')",
    "Ledger audit search did not render filtered student return evidence.",
  );
  await evaluate(
    send,
    "document.querySelectorAll('.el-message').forEach((node) => node.remove()); true",
  );
  await sleep(600);
  await assertNoHorizontalOverflow(send, "ledger audit drawer");
  const ledgerAuditImage = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
  });
  const ledgerAuditOutPath = path.join(outDir, "sepath-ledger-audit-1440.png");
  await writeFile(ledgerAuditOutPath, Buffer.from(ledgerAuditImage.data, "base64"));
  await evaluate(
    send,
    "document.querySelector('.el-drawer__close-btn')?.click(); true",
  );
  await sleep(450);

  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 900,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await evaluate(
    send,
    `(() => {
      const node = document.querySelector('[data-testid="value-added-snapshot"]');
      if (!node) throw new Error('Missing value-added snapshot before mobile capture.');
      const top = node.getBoundingClientRect().top + window.scrollY - 24;
      window.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
      return true;
    })()`,
  );
  await sleep(600);
  await assertNoHorizontalOverflow(send, "teacher accepted snapshot mobile");
  const acceptedMobileImage = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
  });
  const acceptedMobileOutPath = path.join(outDir, "sepath-value-added-snapshot-390.png");
  await writeFile(acceptedMobileOutPath, Buffer.from(acceptedMobileImage.data, "base64"));
  return [outPath, returnedOutPath, acceptedOutPath, ledgerAuditOutPath, acceptedMobileOutPath];
}

async function captureReviewerConsole(send) {
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1024,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send("Page.navigate", {
    url: `http://127.0.0.1:${appPort}/?mode=reviewer&v=reviewer-capture`,
  });
  await waitForCondition(
    send,
    "document.readyState === 'complete' && !!document.querySelector('[data-testid=\"reviewer-console\"]') && !!document.querySelector('[data-testid=\"reviewer-readonly-case\"]')",
    "Reviewer console did not render.",
  );
  await sleep(600);
  await assertNoHorizontalOverflow(send, "reviewer console");
  const image = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
  });
  const outPath = path.join(outDir, "sepath-reviewer-1440.png");
  await writeFile(outPath, Buffer.from(image.data, "base64"));
  return outPath;
}

async function captureValueEngine(send) {
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1024,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send("Page.navigate", {
    url: `http://127.0.0.1:${appPort}/?v=value-engine-capture`,
  });
  await waitForCondition(
    send,
    "document.readyState === 'complete' && !!document.querySelector('[data-testid=\"open-value-engine\"]')",
    "Workbench did not render before value engine capture.",
  );
  await clickTestId(send, "open-value-engine");
  await waitForCondition(
    send,
    "!!document.querySelector('[data-testid=\"value-engine-drawer\"]') && document.querySelectorAll('[data-testid=\"value-engine-layer-list\"] article').length === 6 && document.querySelectorAll('[data-testid=\"value-engine-compare\"] article').length === 4",
    "Value engine drawer did not render its operating loop and contrast cards.",
  );
  await sleep(600);
  await assertNoHorizontalOverflow(send, "value engine");
  const image = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
  });
  const outPath = path.join(outDir, "sepath-value-engine-1440.png");
  await writeFile(outPath, Buffer.from(image.data, "base64"));
  return outPath;
}

async function captureAgentGuide(send) {
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1024,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send("Page.navigate", {
    url: `http://127.0.0.1:${appPort}/?v=agent-guide-capture`,
  });
  await waitForCondition(
    send,
    "document.readyState === 'complete' && !!document.querySelector('[data-testid=\"open-agent-guide\"]')",
    "Workbench did not render before agent guide capture.",
  );
  await clickTestId(send, "open-agent-guide");
  await waitForCondition(
    send,
    "!!document.querySelector('[data-testid=\"agent-guide-drawer\"]') && document.querySelector('[data-testid=\"agent-guide-drawer\"]')?.innerText.includes('一次真实处理怎么跑')",
    "Agent guide drawer did not render.",
  );
  await sleep(600);
  await assertNoHorizontalOverflow(send, "agent guide");
  const image = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
  });
  const outPath = path.join(outDir, "sepath-agent-guide-1440.png");
  await writeFile(outPath, Buffer.from(image.data, "base64"));
  return outPath;
}

await mkdir(outDir, { recursive: true });

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
  await rm(userDataDir, { recursive: true, force: true });
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
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    const outputs = [];
    for (const viewport of viewports) {
      outputs.push(await capture(cdp.send, viewport));
    }
    outputs.push(await captureValueEngine(cdp.send));
    outputs.push(await captureAgentGuide(cdp.send));
    outputs.push(await captureCourseSettings(cdp.send));
    outputs.push(await captureCourseLaunch(cdp.send));
    outputs.push(...(await captureCourseOps(cdp.send)));
    outputs.push(await captureLearnerProfile(cdp.send));
    outputs.push(await captureBatchTracking(cdp.send));
    outputs.push(...(await capturePublishedPackage(cdp.send)));
    outputs.push(...(await captureTeacherClosure(cdp.send)));
    outputs.push(await captureReviewerConsole(cdp.send));
    console.log(outputs.join("\n"));
  } finally {
    cdp.close();
  }
} finally {
  chrome?.kill();
  vite.kill();
}
