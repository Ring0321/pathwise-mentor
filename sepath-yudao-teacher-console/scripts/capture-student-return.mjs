import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";

const chromePath =
  process.env.CHROME_PATH ??
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const appPort = Number(process.env.SEPATH_STUDENT_CAPTURE_APP_PORT ?? 5315);
const cdpPort = Number(process.env.SEPATH_STUDENT_CAPTURE_CDP_PORT ?? 9515);
const teacherUrl = `http://127.0.0.1:${appPort}/?wo=wo-se-018`;
const storageKey = "sepath-yudao-workbench:glass-v1";
const screenshotDir = path.resolve("qa/screenshots");
const userDataDir = path.join(
  process.env.TEMP ?? ".",
  `sepath-student-cdp-${Date.now()}`,
);

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
  throw new Error("Vite student-capture server did not become ready.");
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

async function prepareStudentPortal(send) {
  await send("Page.navigate", { url: teacherUrl });
  await waitForCondition(
    send,
    "document.readyState === 'complete' && !!document.querySelector('[data-testid=\"decision-approve\"]')",
    "Teacher workbench did not render for student capture.",
  );
  await evaluate(send, `localStorage.removeItem(${JSON.stringify(storageKey)}); true`);
  await send("Page.navigate", { url: `${teacherUrl}&capture=${Date.now()}` });
  await sleep(500);
  await waitForCondition(
    send,
    "document.readyState === 'complete' && !!document.querySelector('[data-testid=\"decision-approve\"]')",
    "Clean teacher workbench did not render for student capture.",
  );
  await clickTestId(send, "decision-approve");
  await waitForCondition(
    send,
    "!!document.querySelector('[data-testid=\"publish-package\"]') && !document.querySelector('[data-testid=\"publish-package\"]')?.disabled",
    "Publish package action did not become available.",
  );
  await clickTestId(send, "publish-package");
  await waitForCondition(
    send,
    "!!document.querySelector('[data-testid=\"intervention-package-card\"]')",
    "Published intervention package did not render.",
  );
  const studentUrl = await evaluate(
    send,
    `(() => document.querySelector('.return-link-card p')?.textContent?.trim() ?? '')()`,
  );
  await send("Page.navigate", { url: studentUrl });
  await waitForCondition(
    send,
    "document.readyState === 'complete' && !!document.querySelector('[data-testid=\"student-portal\"]')",
    "Student portal did not render for capture.",
  );
}

async function capture(send, filename, width, height, mobile) {
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile,
  });
  await prepareStudentPortal(send);
  await sleep(700);
  const result = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
  });
  const outPath = path.join(screenshotDir, filename);
  await writeFile(outPath, Buffer.from(result.data, "base64"));
  return outPath;
}

async function captureCurrent(send, filename, width, height, mobile) {
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile,
  });
  await waitForCondition(
    send,
    "document.readyState === 'complete' && !!document.querySelector('[data-testid=\"student-portal\"]')",
    "Student portal was not available for current-state capture.",
  );
  await evaluate(
    send,
    `(() => {
      document.querySelectorAll('.el-message').forEach((node) => node.remove());
      document.querySelector('.student-return-form')?.scrollIntoView({
        block: 'start',
        inline: 'nearest',
      });
      return true;
    })()`,
  );
  await sleep(700);
  const result = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
  });
  const outPath = path.join(screenshotDir, filename);
  await writeFile(outPath, Buffer.from(result.data, "base64"));
  return outPath;
}

await mkdir(screenshotDir, { recursive: true });
await rm(userDataDir, { recursive: true, force: true });

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
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    const outputs = [
      await capture(cdp.send, "student-portal-desktop-1440.png", 1440, 1024, false),
      await capture(cdp.send, "student-portal-mobile-390.png", 390, 900, true),
    ];
    await clickTestId(cdp.send, "student-portal-submit-scaffold");
    await setFieldValue(
      cdp.send,
      "student-failure-field",
      "订单接口在空请求体时返回 500，预期应返回 400 与明确错误码。",
    );
    await setFieldValue(
      cdp.send,
      "student-minimal-case-field",
      "POST /orders，body={}，断言 status=400、code=ORDER_BODY_REQUIRED。",
    );
    await setFieldValue(
      cdp.send,
      "student-verification-field",
      "已补充边界检查清单并重跑 CI，新增用例通过。",
    );
    await clickTestId(cdp.send, "student-integrity-check");
    await clickTestId(cdp.send, "student-portal-submit-evidence");
    await setFieldValue(
      cdp.send,
      "student-reflection-field",
      "我先补测试再改实现，避免只靠猜测修复。",
    );
    await clickTestId(cdp.send, "student-portal-submit-reflection");
    outputs.push(
      await captureCurrent(
        cdp.send,
        "student-portal-after-submit-390.png",
        390,
        900,
        true,
      ),
    );
    console.log(outputs.join("\n"));
  } finally {
    cdp.close();
  }
} finally {
  chrome?.kill();
  vite.kill();
}
