import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";

const chromePath =
  process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const port = Number(option("port", process.env.CDP_PORT || 9240));
const url = option("url", process.env.CAPTURE_URL || "http://127.0.0.1:5188/");
const width = Number(option("width", process.env.CAPTURE_WIDTH || 1440));
const height = Number(option("height", process.env.CAPTURE_HEIGHT || 900));
const outDir = option("outDir", process.env.CAPTURE_OUT_DIR || "qa/demo-flow");
const userDataDir = option(
  "profile",
  process.env.CAPTURE_PROFILE ||
    `D:/相关比赛、论文/2026.8-自适应习路径决策与伴学/sepath-cloud-app/qa/chrome-profile-demo-${port}-${Date.now()}`,
);

const scenes = [
  {
    id: "01-start",
    title: "开场：软件工程闭环智能体",
    subtitle: "学生任务、当前画像、证据覆盖和下一步按钮出现在首屏。",
    action: "reset",
    scrollTo: "top",
  },
  {
    id: "02-ci-failure",
    title: "步骤 1：提交失败 PR",
    subtitle: "CI 失败进入 EvidenceEvent 账本，诊断焦点转向测试边界。",
    action: "click",
    scrollTo: ".main-grid",
  },
  {
    id: "03-direct-answer-risk",
    title: "步骤 2：学生请求完整代码",
    subtitle: "系统识别直接索要答案风险，发布门准备转入教师复核。",
    action: "click",
    scrollTo: ".decision-panel",
  },
  {
    id: "04-scaffold",
    title: "步骤 3：推送脚手架提示",
    subtitle: "AI 拒绝替写完整提交，改为给异常路径检查清单和 mini lab。",
    action: "click",
    scrollTo: ".decision-panel",
  },
  {
    id: "05-ci-pass",
    title: "步骤 4：学生修复并通过 CI",
    subtitle: "测试、协作和路径状态随新证据更新，闭环开始产生增值。",
    action: "click",
    scrollTo: ".main-grid",
  },
  {
    id: "06-student-dialogue",
    title: "步骤 5：学生对话实验台",
    subtitle: "自然语言求助被识别为意图、风险、脚手架回复和 EvidenceEvent 写回。",
    action: "none",
    scrollTo: "#dialogue",
  },
  {
    id: "07-integration-replay",
    title: "步骤 6：集成回放沙箱",
    subtitle: "Git、CI、LMS、飞书 Webhook 样例完成脱敏、幂等、契约匹配和账本写回。",
    action: "none",
    scrollTo: "#integration",
  },
  {
    id: "08-course-authoring",
    title: "步骤 7：课程配置与 Rubric Studio",
    subtitle: "课程目标、能力 Rubric、作业模板、AI 边界和 Manifest 可迁移复用。",
    action: "none",
    scrollTo: "#authoring",
  },
  {
    id: "09-teacher-report",
    title: "步骤 8：教师周报与试点复盘",
    subtitle: "学生阻塞、班级信号、下周行动和 AI 边界沉淀成教师可下载周报。",
    action: "none",
    scrollTo: "#teacher-report",
  },
  {
    id: "10-value-uplift",
    title: "步骤 9：学习增值评估中心",
    subtitle: "能力增量、策略优势、风险拦截、教师工时和真实试点边界可复核。",
    action: "none",
    scrollTo: "#value",
  },
  {
    id: "11-model-governance",
    title: "步骤 10：模型与实验治理",
    subtitle: "算法注册表、实验协议、发布门、红队样本和漂移监控进入产品内看板。",
    action: "none",
    scrollTo: "#modelops",
  },
  {
    id: "12-award-readiness",
    title: "步骤 11：参赛评审证据映射",
    subtitle: "官方评分维度、实现证据和提交材料映射到同一张评审证据表。",
    action: "none",
    scrollTo: "#award",
  },
  {
    id: "13-teacher-review",
    title: "步骤 12：教师复核放行",
    subtitle: "高风险建议必须进入人类发布门，教师保留教学主导权。",
    action: "click",
    scrollTo: "#teacher",
  },
  {
    id: "14-reflection-memory",
    title: "收束：生成反思记忆",
    subtitle: "修复原因、教师复核与反思写回长期证据账本，支持下次路径规划。",
    action: "click",
    scrollTo: ".timeline-panel",
  },
];

const chrome = spawn(
  chromePath,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--disable-cache",
    `--remote-debugging-port=${port}`,
    "--force-device-scale-factor=1",
    `--user-data-dir=${userDataDir}`,
    `--window-size=${Math.max(width, 500)},${height}`,
    url,
  ],
  { stdio: "ignore" },
);

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(promise, label, timeout = 12000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${timeout}ms`)), timeout);
    }),
  ]);
}

function getJson(requestPath) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: "127.0.0.1", port, path: requestPath }, (res) => {
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
      // Chrome needs a short moment before exposing the debugging endpoint.
    }
    await delay(200);
  }
  throw new Error("Chrome DevTools endpoint did not become available.");
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const tab = await waitForTab();
  const socket = new WebSocket(tab.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data.toString());
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
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
      method === "Page.captureScreenshot" ? 30000 : 12000,
    );

  async function evaluate(expression) {
    return send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
  }

  async function waitForApp(label) {
    for (let i = 0; i < 40; i += 1) {
      const result = await evaluate(
        "Boolean(document.querySelector('.app-shell') && document.querySelector('.hero-actions .primary-button'))",
      );
      if (result.result.result.value) {
        return;
      }
      await delay(300);
    }
    throw new Error(`Application did not mount before ${label}`);
  }

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width <= 720,
  });
  await send("Page.reload", { ignoreCache: true });
  await waitForApp("initial reset");
  await evaluate(
    "localStorage.removeItem('sepath.demo.state.v1'); window.scrollTo({ top: 0, behavior: 'instant' });",
  );
  await send("Page.reload", { ignoreCache: true });
  await waitForApp("post-reset reload");

  const captures = [];
  for (const scene of scenes) {
    if (scene.action === "click") {
      await waitForApp(scene.id);
      const clickResult = await evaluate(
        "(() => { const button = document.querySelector('.hero-actions .primary-button:not(:disabled)'); if (!button) return false; button.click(); return true; })()",
      );
      if (!clickResult.result.result.value) {
        throw new Error(`Primary demo button was not clickable for ${scene.id}`);
      }
      await delay(800);
    } else if (scene.action === "reset") {
      await evaluate(
        "localStorage.removeItem('sepath.demo.state.v1'); window.dispatchEvent(new Event('storage'));",
      );
      await send("Page.reload", { ignoreCache: true });
      await waitForApp(scene.id);
    }

    await evaluate(
      scene.scrollTo === "top"
        ? "window.scrollTo({ top: 0, left: 0, behavior: 'instant' })"
        : `document.querySelector(${JSON.stringify(
            scene.scrollTo,
          )})?.scrollIntoView({ block: "start", inline: "nearest" })`,
    );
    await delay(500);

    const metrics = await evaluate(String.raw`
      (() => ({
        innerWidth,
        innerHeight,
        docClient: document.documentElement.clientWidth,
        docScroll: document.documentElement.scrollWidth,
        bodyScroll: document.body.scrollWidth,
        evidenceCount: document.querySelector(".metric-card strong")?.innerText || "",
        primaryButton: document.querySelector(".hero-actions .primary-button")?.innerText || "",
        hasKnowledgePanel: Boolean(document.querySelector("#knowledge")),
        hasDialoguePanel: Boolean(document.querySelector("#dialogue")),
        hasIntegrationPanel: Boolean(document.querySelector("#integration")),
        hasValuePanel: Boolean(document.querySelector("#value")),
        hasModelOpsPanel: Boolean(document.querySelector("#modelops")),
        hasAwardPanel: Boolean(document.querySelector("#award")),
      }))()
    `);
    const metricValue = metrics.result.result.value;
    if (metricValue.docScroll > metricValue.docClient + 1) {
      throw new Error(
        `Horizontal overflow in ${scene.id}: docScroll=${metricValue.docScroll}, docClient=${metricValue.docClient}`,
      );
    }

    const screenshot = await send("Page.captureScreenshot", { format: "png" });
    const out = path.join(outDir, `${scene.id}.png`);
    await writeFile(out, Buffer.from(screenshot.result.data, "base64"));
    captures.push({
      ...scene,
      file: out,
      metrics: metricValue,
    });
  }

  const manifest = {
    capturedAt: new Date().toISOString(),
    url,
    width,
    height,
    scenes: captures,
  };
  await writeFile(
    path.join(outDir, "demo_flow_manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );
  console.log(JSON.stringify(manifest, null, 2));
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
