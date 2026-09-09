import { spawn } from "node:child_process";
import http from "node:http";

const chromePath =
  process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const port = Number(process.env.CDP_PORT || 9223);
const url = process.env.PROBE_URL || "http://127.0.0.1:5188/?qa=layout-probe";
const width = Number(process.env.PROBE_WIDTH || 390);
const height = Number(process.env.PROBE_HEIGHT || 900);
const userDataDir =
  process.env.PROBE_PROFILE ||
  "D:/相关比赛、论文/2026.8-自适应习路径决策与伴学/sepath-cloud-app/qa/chrome-profile-probe";

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
    `--window-size=${width},${height}`,
    url,
  ],
  { stdio: "ignore" },
);

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
      const tab = tabs.find((candidate) => candidate.url.includes("127.0.0.1")) || tabs[0];
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

async function main() {
  const tab = await waitForTab();
  const socket = new WebSocket(tab.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();

  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  };

  await new Promise((resolve) => {
    socket.onopen = resolve;
  });

  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const current = ++id;
      pending.set(current, resolve);
      socket.send(JSON.stringify({ id: current, method, params }));
    });

  await send("Runtime.enable");
  await new Promise((resolve) => setTimeout(resolve, 1200));

  const expression = String.raw`
(() => {
  const rect = (selector) => {
    const el = document.querySelector(selector);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      left: Math.round(r.left * 10) / 10,
      width: Math.round(r.width * 10) / 10,
      right: Math.round(r.right * 10) / 10,
      display: cs.display,
      gridTemplateColumns: cs.gridTemplateColumns,
      fontSize: cs.fontSize,
      wordBreak: cs.wordBreak,
      overflowWrap: cs.overflowWrap,
      whiteSpace: cs.whiteSpace,
      boxSizing: cs.boxSizing,
    };
  };
  return {
    innerWidth,
    outerWidth,
    devicePixelRatio,
    docClient: document.documentElement.clientWidth,
    docScroll: document.documentElement.scrollWidth,
    bodyScroll: document.body.scrollWidth,
    app: rect(".app-shell"),
    topbar: rect(".topbar"),
    hero: rect(".hero"),
    heroCopy: rect(".hero-copy"),
    h1: rect(".hero h1"),
    paragraph: rect(".hero-copy p"),
    heroPanel: rect(".hero-panel"),
    metricGrid: rect(".metric-grid"),
  };
})()
`;

  const result = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });

  console.log(JSON.stringify(result.result.result.value, null, 2));
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
