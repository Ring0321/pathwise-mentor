import { spawn } from "node:child_process";
import { stat, writeFile } from "node:fs/promises";
import http from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

const chromePath =
  process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function stripOuterQuotes(value) {
  if (typeof value !== "string") return value;
  return value.replace(/^['"]|['"]$/g, "");
}

const port = Number(option("port", process.env.CDP_PORT || 9224));
const url = option("url", process.env.CAPTURE_URL || "http://127.0.0.1:5188/");
const width = Number(option("width", process.env.CAPTURE_WIDTH || 1440));
const height = Number(option("height", process.env.CAPTURE_HEIGHT || 1024));
const out = option("out", process.env.CAPTURE_OUT || "qa/screenshots/viewport.png");
const scrollTo = stripOuterQuotes(option("scrollTo", process.env.CAPTURE_SCROLL_TO || ""));
const scrollOffset = Number(option("scrollOffset", process.env.CAPTURE_SCROLL_OFFSET || "96"));
const enterDemo = process.argv.includes("--enterDemo");
const startReviewerGuide = process.argv.includes("--startReviewerGuide");
const defaultUserDataDir = join(tmpdir(), `sepath-chrome-profile-${port}-${width}-${Date.now()}`);
const userDataDir =
  option(
    "profile",
    process.env.CAPTURE_PROFILE || defaultUserDataDir ||
      `D:/相关比赛、论文/2026.8-自适应习路径决策与伴学/sepath-cloud-app/qa/chrome-profile-capture-${port}-${width}-${Date.now()}`,
  );

const chrome = spawn(
  chromePath,
  [
    "--headless=new",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--disable-cache",
    "--remote-allow-origins=*",
    `--remote-debugging-port=${port}`,
    "--force-device-scale-factor=1",
    `--user-data-dir=${userDataDir}`,
    `--window-size=${Math.max(width, 500)},${height}`,
    url,
  ],
  { stdio: "ignore" },
);

function withTimeout(promise, label, timeout = 10000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${timeout}ms`)), timeout);
    }),
  ]);
}

function getJson(path) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: "127.0.0.1", port, path }, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on("error", reject);
  });
}

async function waitForTab() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const tabs = await getJson("/json");
      const tab = tabs.find((candidate) => candidate.type === "page") || tabs[0];
      if (tab?.webSocketDebuggerUrl) {
        return tab;
      }
    } catch {
      // Chrome may need a short moment before exposing the debugging endpoint.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("Chrome DevTools endpoint did not become available.");
}

const metricsExpression = String.raw`
(() => ({
  innerWidth,
  innerHeight,
  docClient: document.documentElement.clientWidth,
  docScroll: document.documentElement.scrollWidth,
  bodyScroll: document.body.scrollWidth,
  docScrollHeight: document.documentElement.scrollHeight,
  scrollY,
  targetFound: ${JSON.stringify(scrollTo)} ? Boolean(document.querySelector(${JSON.stringify(scrollTo)})) : null,
  targetTop: ${JSON.stringify(scrollTo)}
    ? document.querySelector(${JSON.stringify(scrollTo)})?.getBoundingClientRect().top ?? null
    : null,
  guideActive: Boolean(document.querySelector('[data-guide-active="true"]')),
  guideStep: document.querySelector("[data-guide-step]")?.getAttribute("data-guide-step") || "",
  h1Text: document.querySelector(".hero h1")?.innerText || "",
  hasApp: Boolean(document.querySelector(".app-shell"))
}))()
`;

async function main() {
  const tab = await waitForTab();
  const socket = new WebSocket(tab.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const runtimeEvents = [];

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data.toString());
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    } else if (message.method === "Runtime.exceptionThrown") {
      runtimeEvents.push(message.params.exceptionDetails);
    } else if (message.method === "Log.entryAdded") {
      runtimeEvents.push(message.params.entry);
    }
  });

  await withTimeout(
    new Promise((resolve, reject) => {
      if (socket.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    }),
    "WebSocket open",
  );

  const send = (method, params = {}) =>
    withTimeout(
      new Promise((resolve) => {
        const current = ++id;
        pending.set(current, resolve);
        socket.send(JSON.stringify({ id: current, method, params }));
      }),
      method,
      method === "Page.captureScreenshot" ? 30000 : 30000,
    );

  await send("Page.enable");
  await send("Log.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width <= 720,
  });
  await send("Page.reload", { ignoreCache: true });
  let metrics;
  for (let i = 0; i < 60; i += 1) {
    metrics = await send("Runtime.evaluate", {
      expression: metricsExpression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (metrics.result.result.value.hasApp) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  const metricValue = metrics.result.result.value;
  if (!metricValue.hasApp) {
    const diagnostics = await send("Runtime.evaluate", {
      expression: String.raw`
        (() => ({
          href: window.location.href,
          title: document.title,
          bodyText: document.body.innerText.slice(0, 600),
          rootHtml: document.querySelector("#root")?.innerHTML.slice(0, 600) || "",
          scripts: Array.from(document.scripts).map((script) => script.src || script.textContent?.slice(0, 80)),
        }))()
      `,
      returnByValue: true,
      awaitPromise: true,
    });
    throw new Error(
      `Application did not mount at ${url}: ${JSON.stringify({
        ...diagnostics.result.result.value,
        runtimeEvents: runtimeEvents.slice(-10),
      })}`,
    );
  }
  if (metricValue.docScroll > metricValue.docClient + 1) {
    throw new Error(
      `Horizontal overflow: docScroll=${metricValue.docScroll}, docClient=${metricValue.docClient}`,
    );
  }
  if (enterDemo) {
    const enterResult = await send("Runtime.evaluate", {
      expression: String.raw`
        (() => {
          const buttons = Array.from(document.querySelectorAll("button"));
          const button = buttons.find((item) => item.innerText.includes("进入演示系统"));
          if (!button) return { clicked: false, reason: "button not found" };
          button.click();
          return { clicked: true };
        })()
      `,
      returnByValue: true,
      awaitPromise: true,
    });
    if (!enterResult.result.result.value.clicked) {
      throw new Error(`Could not enter demo: ${enterResult.result.result.value.reason}`);
    }
    for (let i = 0; i < 30; i += 1) {
      const appResult = await send("Runtime.evaluate", {
        expression: "Boolean(document.querySelector('.hero-actions .primary-button'))",
        returnByValue: true,
        awaitPromise: true,
      });
      if (appResult.result.result.value) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  if (startReviewerGuide) {
    const guideResult = await send("Runtime.evaluate", {
      expression: String.raw`
        (() => {
          const buttons = Array.from(document.querySelectorAll("button"));
          const button = buttons.find((item) => item.innerText.includes("一键评委导览"));
          if (!button) return { clicked: false, reason: "guide button not found" };
          button.click();
          return { clicked: true };
        })()
      `,
      returnByValue: true,
      awaitPromise: true,
    });
    if (!guideResult.result.result.value.clicked) {
      throw new Error(`Could not start reviewer guide: ${guideResult.result.result.value.reason}`);
    }
    for (let i = 0; i < 30; i += 1) {
      const guideMounted = await send("Runtime.evaluate", {
        expression: "Boolean(document.querySelector('[data-guide-active=\"true\"]'))",
        returnByValue: true,
        awaitPromise: true,
      });
      if (guideMounted.result.result.value) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  if (scrollTo) {
    await send("Runtime.evaluate", {
      expression: `(() => {
        const target = document.querySelector(${JSON.stringify(scrollTo)});
        if (!target) return false;
        const top = target.getBoundingClientRect().top + window.scrollY - ${JSON.stringify(scrollOffset)};
        window.scrollTo({ top: Math.max(0, top), left: 0, behavior: "instant" });
        return true;
      })()`,
      returnByValue: true,
      awaitPromise: true,
    });
    await new Promise((resolve) => setTimeout(resolve, 700));
  }

  const finalMetrics = await send("Runtime.evaluate", {
    expression: metricsExpression,
    returnByValue: true,
    awaitPromise: true,
  });
  const finalMetricValue = finalMetrics.result.result.value;

  let screenshotStatus = "captured";
  try {
    await send("Page.bringToFront");
    const screenshot = await send("Page.captureScreenshot", {
      format: "png",
    });

    await writeFile(out, Buffer.from(screenshot.result.data, "base64"));
  } catch (error) {
    const existing = await stat(out).catch(() => null);
    if (!existing) {
      throw error;
    }
    screenshotStatus = `reused-existing: ${error.message}`;
  }
  console.log(
    JSON.stringify(
      {
        out,
        width,
        height,
        screenshotStatus,
        metrics: finalMetricValue,
      },
      null,
      2,
    ),
  );
  socket.close();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    chrome.kill();
  });
