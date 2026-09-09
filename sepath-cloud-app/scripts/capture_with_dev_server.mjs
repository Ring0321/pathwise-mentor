import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import http from "node:http";
import net from "node:net";
import { tmpdir } from "node:os";

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const preset = process.argv.includes("--courseLaunch") ? "courseLaunch" : "";
const vitePort = Number(option("vitePort", "5188"));
const cdpPort = Number(option("port", preset === "courseLaunch" ? "9237" : "9224"));
const width = Number(option("width", preset === "courseLaunch" ? "1440" : "1440"));
const height = Number(option("height", preset === "courseLaunch" ? "900" : "1024"));
const url = option(
  "url",
  preset === "courseLaunch"
    ? `http://127.0.0.1:${vitePort}/?qa=course-launch`
    : `http://127.0.0.1:${vitePort}/`,
);
const out = option(
  "out",
  preset === "courseLaunch" ? "qa/screenshots/course-launch-panel.png" : "qa/screenshots/viewport.png",
);
const scrollTo = option("scrollTo", preset === "courseLaunch" ? "#course-launch" : "");
const scrollOffset = Number(option("scrollOffset", "96"));
const reviewerGuideStep = option("reviewerGuideStep", "");
const enterDemo = process.argv.includes("--enterDemo");
const startReviewerGuide = process.argv.includes("--startReviewerGuide");
const clickExportLedger = process.argv.includes("--clickExportLedger");
const openDemoScript = process.argv.includes("--openDemoScript");
const runAllClosedLoop = process.argv.includes("--runAllClosedLoop");
const clickReviewerGuideAction = process.argv.includes("--clickReviewerGuideAction");
const clickClaimLedgerReview = process.argv.includes("--clickClaimLedgerReview");
const clickSubmissionSeal = process.argv.includes("--clickSubmissionSeal");
const preview = process.argv.includes("--preview");
const defaultProfile = join(tmpdir(), `sepath-chrome-profile-${preset || "section"}-${cdpPort}-${Date.now()}`);
const profile = resolve(
  option("profile", defaultProfile),
);

function canListen(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once("error", () => resolve(false));
    tester.once("listening", () => {
      tester.close(() => resolve(true));
    });
    tester.listen(port, host);
  });
}

function getEphemeralPort(host = "127.0.0.1") {
  return new Promise((resolve, reject) => {
    const tester = net.createServer();
    tester.once("error", reject);
    tester.listen(0, host, () => {
      const address = tester.address();
      const selectedPort = typeof address === "object" && address ? address.port : 0;
      tester.close(() => resolve(selectedPort));
    });
  });
}

async function choosePort(preferredPort) {
  if (Number.isFinite(preferredPort) && preferredPort > 0 && (await canListen(preferredPort))) {
    return preferredPort;
  }
  return getEphemeralPort();
}

function withPort(rawUrl, port) {
  const parsed = new URL(rawUrl);
  parsed.hostname = "127.0.0.1";
  parsed.port = String(port);
  return parsed.toString();
}

function request(urlToCheck) {
  return new Promise((resolve, reject) => {
    const req = http.get(urlToCheck, (res) => {
      res.resume();
      res.on("end", () => resolve(res.statusCode || 0));
    });
    req.on("error", reject);
    req.setTimeout(2500, () => {
      req.destroy(new Error("request timed out"));
    });
  });
}

async function waitForServer(urlToCheck) {
  for (let i = 0; i < 50; i += 1) {
    try {
      const statusCode = await request(urlToCheck);
      if (statusCode >= 200 && statusCode < 500) return;
    } catch {
      // Vite is still warming up.
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Vite server did not become ready at ${urlToCheck}`);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", windowsHide: true });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

async function main() {
  const viteBin = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));
  const actualVitePort = await choosePort(vitePort);
  const actualCdpPort = await choosePort(cdpPort);
  const actualUrl = withPort(url, actualVitePort);
  const actualProfile = profile.replace(String(cdpPort), String(actualCdpPort));
  const serverArgs = preview
    ? [viteBin, "preview", "--host", "0.0.0.0", "--port", String(actualVitePort), "--strictPort"]
    : [viteBin, "--host", "0.0.0.0", "--port", String(actualVitePort), "--strictPort"];
  const server = spawn(process.execPath, serverArgs, {
    stdio: "ignore",
    windowsHide: true,
  });

  try {
    await waitForServer(actualUrl);
    const captureArgs = [
      "./scripts/capture_playwright_screenshot.mjs",
      "--port",
      String(actualCdpPort),
      "--width",
      String(width),
      "--height",
      String(height),
      "--out",
      out,
      "--url",
      actualUrl,
      "--profile",
      actualProfile,
    ];
    if (scrollTo) {
      captureArgs.push("--scrollTo", scrollTo);
      captureArgs.push("--scrollOffset", String(scrollOffset));
    }
    if (enterDemo) {
      captureArgs.push("--enterDemo");
    }
    if (startReviewerGuide) {
      captureArgs.push("--startReviewerGuide");
    }
    if (clickExportLedger) {
      captureArgs.push("--clickExportLedger");
    }
    if (openDemoScript) {
      captureArgs.push("--openDemoScript");
    }
    if (runAllClosedLoop) {
      captureArgs.push("--runAllClosedLoop");
    }
    if (clickReviewerGuideAction) {
      captureArgs.push("--clickReviewerGuideAction");
    }
    if (clickClaimLedgerReview) {
      captureArgs.push("--clickClaimLedgerReview");
    }
    if (clickSubmissionSeal) {
      captureArgs.push("--clickSubmissionSeal");
    }
    if (reviewerGuideStep) {
      captureArgs.push("--reviewerGuideStep", reviewerGuideStep);
    }
    await run(process.execPath, captureArgs);
  } finally {
    server.kill();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
