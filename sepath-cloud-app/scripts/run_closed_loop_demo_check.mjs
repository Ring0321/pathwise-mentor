import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import http from "node:http";
import net from "node:net";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, "..");
const reportPath = resolve(appRoot, "qa/closed-loop-demo-check.json");
const chromePath = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch (primaryError) {
    const candidates = [
      process.env.PLAYWRIGHT_PACKAGE,
      join(homedir(), ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "node", "node_modules", "playwright"),
    ].filter(Boolean);
    for (const candidate of candidates) {
      if (existsSync(candidate)) return require(candidate);
    }
    throw primaryError;
  }
}

function canListen(port, host = "127.0.0.1") {
  return new Promise((resolveCheck) => {
    const server = net.createServer();
    server.once("error", () => resolveCheck(false));
    server.once("listening", () => server.close(() => resolveCheck(true)));
    server.listen(port, host);
  });
}

function getEphemeralPort(host = "127.0.0.1") {
  return new Promise((resolvePort, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, host, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolvePort(port));
    });
  });
}

async function choosePort(preferred) {
  return (await canListen(preferred)) ? preferred : getEphemeralPort();
}

function request(url) {
  return new Promise((resolveRequest, reject) => {
    const req = http.get(url, (res) => {
      res.resume();
      res.on("end", () => resolveRequest(res.statusCode || 0));
    });
    req.on("error", reject);
    req.setTimeout(2500, () => req.destroy(new Error("request timed out")));
  });
}

async function waitForServer(url) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const code = await request(url);
      if (code >= 200 && code < 500) return;
    } catch {
      // Vite preview is still warming up.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 300));
  }
  throw new Error(`Preview server did not become ready: ${url}`);
}

function summarize(rows) {
  return {
    PASS: rows.filter((row) => row.status === "PASS").length,
    FAIL: rows.filter((row) => row.status === "FAIL").length,
    rows: rows.length,
  };
}

async function main() {
  const port = await choosePort(53250);
  const url = `http://127.0.0.1:${port}/?qa=closed-loop`;
  const viteBin = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));
  const server = spawn(process.execPath, [viteBin, "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    stdio: "ignore",
    windowsHide: true,
  });

  try {
    await waitForServer(url);
    const { chromium } = await loadPlaywright();
    const browser = await chromium.launch({
      executablePath: chromePath,
      headless: true,
      args: ["--disable-dev-shm-usage", "--no-first-run", "--disable-gpu"],
    });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1024 }, deviceScaleFactor: 1 });
    try {
      await page.addInitScript(() => window.localStorage.removeItem("sepath.demo.state.v1"));
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.evaluate(() => {
        document.querySelector(".legacy-demo-details")?.setAttribute("open", "");
      });
      await page.waitForSelector(".closed-loop-console", { timeout: 30000 });

      const initialStatus = await page.locator(".closed-loop-console").getAttribute("data-closed-loop-status");
      await page.locator(".closed-loop-run-all").click();
      await page.waitForFunction(() => document.querySelector(".closed-loop-console")?.getAttribute("data-closed-loop-status") === "closed", null, {
        timeout: 12000,
      });

      const dom = await page.evaluate(() => {
        const panel = document.querySelector(".closed-loop-console");
        const steps = Array.from(document.querySelectorAll("[data-closed-loop-step]")).map((item) =>
          item.getAttribute("data-closed-loop-step"),
        );
        const checks = Array.from(document.querySelectorAll(".closed-loop-check")).map((item) =>
          item.classList.contains("ready") ? "ready" : "watch",
        );
        const eventCount = Number(document.querySelector("[data-closed-loop-events]")?.textContent || 0);
        const exportReady = Array.from(document.querySelectorAll("button")).some((button) =>
          button.textContent?.includes("导出证据账本"),
        );
        return {
          status: panel?.getAttribute("data-closed-loop-status") || "",
          progress: Number(panel?.getAttribute("data-closed-loop-progress") || 0),
          stepCount: steps.length,
          doneCount: steps.filter((step) => step === "done").length,
          readyChecks: checks.filter((check) => check === "ready").length,
          eventCount,
          exportReady,
          noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
        };
      });

      const rows = [
        { id: "initial-state", status: initialStatus === "running" ? "PASS" : "FAIL", evidence: initialStatus || "missing" },
        { id: "closed-status", status: dom.status === "closed" ? "PASS" : "FAIL", evidence: dom.status },
        { id: "progress", status: dom.progress === 100 ? "PASS" : "FAIL", evidence: `${dom.progress}%` },
        { id: "steps", status: dom.stepCount === 6 && dom.doneCount === 6 ? "PASS" : "FAIL", evidence: `${dom.doneCount}/${dom.stepCount}` },
        { id: "ready-checks", status: dom.readyChecks >= 5 ? "PASS" : "FAIL", evidence: `${dom.readyChecks} ready checks` },
        { id: "event-ledger", status: dom.eventCount >= 8 ? "PASS" : "FAIL", evidence: `${dom.eventCount} events` },
        { id: "export-entry", status: dom.exportReady ? "PASS" : "FAIL", evidence: dom.exportReady ? "button present" : "missing" },
        {
          id: "horizontal-overflow",
          status: dom.noHorizontalOverflow ? "PASS" : "FAIL",
          evidence: dom.noHorizontalOverflow ? "no overflow" : "page overflows horizontally",
        },
      ];
      const report = {
        runtime: "sepath-closed-loop-demo-check.v1",
        generatedAt: new Date().toISOString(),
        url,
        summary: summarize(rows),
        rows,
        dom,
      };
      await mkdir(dirname(reportPath), { recursive: true });
      await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
      console.log(JSON.stringify({ summary: report.summary, report: "qa/closed-loop-demo-check.json" }, null, 2));
      if (report.summary.FAIL > 0) process.exitCode = 1;
    } finally {
      await browser.close();
    }
  } finally {
    server.kill();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
