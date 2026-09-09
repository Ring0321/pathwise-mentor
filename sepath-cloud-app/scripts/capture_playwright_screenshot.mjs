import { existsSync } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

const require = createRequire(import.meta.url);
const chromePath = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function stripOuterQuotes(value) {
  if (typeof value !== "string") return value;
  return value.replace(/^['"]|['"]$/g, "");
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch (primaryError) {
    const candidates = [
      process.env.PLAYWRIGHT_PACKAGE,
      join(
        homedir(),
        ".cache",
        "codex-runtimes",
        "codex-primary-runtime",
        "dependencies",
        "node",
        "node_modules",
        "playwright",
      ),
    ].filter(Boolean);
    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        return require(candidate);
      }
    }
    throw primaryError;
  }
}

const url = option("url", process.env.CAPTURE_URL || "http://127.0.0.1:5188/");
const width = Number(option("width", process.env.CAPTURE_WIDTH || 1440));
const height = Number(option("height", process.env.CAPTURE_HEIGHT || 1024));
const out = option("out", process.env.CAPTURE_OUT || "qa/screenshots/viewport.png");
const scrollTo = stripOuterQuotes(option("scrollTo", process.env.CAPTURE_SCROLL_TO || ""));
const scrollOffset = Number(option("scrollOffset", process.env.CAPTURE_SCROLL_OFFSET || "96"));
const reviewerGuideStep = stripOuterQuotes(option("reviewerGuideStep", process.env.CAPTURE_REVIEWER_GUIDE_STEP || ""));
const enterDemo = process.argv.includes("--enterDemo");
const startReviewerGuide = process.argv.includes("--startReviewerGuide");
const clickExportLedger = process.argv.includes("--clickExportLedger");
const openDemoScript = process.argv.includes("--openDemoScript");
const runAllClosedLoop = process.argv.includes("--runAllClosedLoop");
const clickReviewerGuideAction = process.argv.includes("--clickReviewerGuideAction");
const clickClaimLedgerReview = process.argv.includes("--clickClaimLedgerReview");
const clickSubmissionSeal = process.argv.includes("--clickSubmissionSeal");

const metricsExpression = String.raw`
(() => ({
  innerWidth,
  innerHeight,
  docClient: document.documentElement.clientWidth,
  docScroll: document.documentElement.scrollWidth,
  bodyScroll: document.body.scrollWidth,
  docScrollHeight: document.documentElement.scrollHeight,
  scrollY,
  targetFound: __SCROLL_TO__ ? Boolean(document.querySelector(__SCROLL_TO__)) : null,
  targetTop: __SCROLL_TO__
    ? document.querySelector(__SCROLL_TO__)?.getBoundingClientRect().top ?? null
    : null,
  guideActive: Boolean(document.querySelector('[data-guide-active="true"]')),
  guideStep: document.querySelector("[data-guide-step]")?.getAttribute("data-guide-step") || "",
  guideQuickStepCount: document.querySelectorAll(".reviewer-guide-quickbar button").length,
  guideClock: document.querySelector(".reviewer-guide-clock")?.textContent?.trim() || "",
  closedLoopStatus: document.querySelector(".closed-loop-console")?.getAttribute("data-closed-loop-status") || "",
  closedLoopProgress: Number(document.querySelector(".closed-loop-console")?.getAttribute("data-closed-loop-progress") || 0),
  realWorkbenchStatus: document.querySelector(".real-workbench-panel")?.getAttribute("data-real-workbench-status") || "",
  realWorkbenchConfidence: Number(document.querySelector(".real-workbench-panel")?.getAttribute("data-real-workbench-confidence") || 0),
  realWorkbenchCoverage: Number(document.querySelector(".real-workbench-panel")?.getAttribute("data-real-workbench-coverage") || 0),
  reviewerPackStatus: document.querySelector(".focus-reviewer-pack")?.getAttribute("data-reviewer-pack-status") || "",
  reviewerPackText: document.querySelector(".focus-reviewer-pack-head strong")?.textContent?.trim() || "",
  submissionChainStatus: document.querySelector(".focus-submission-chain")?.getAttribute("data-submission-chain-status") || "",
  submissionChainText: document.querySelector(".focus-submission-chain-head strong")?.textContent?.trim() || "",
  exportReceipt: document.querySelector(".focus-export-receipt")?.textContent?.trim() || "",
  demoScriptOpen: Boolean(document.querySelector('[data-demo-script-open="true"]')),
  h1Text: document.querySelector(".hero h1")?.innerText || "",
  hasApp: Boolean(document.querySelector(".app-shell"))
}))()
`.replaceAll("__SCROLL_TO__", JSON.stringify(scrollTo));

async function main() {
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
    args: ["--disable-dev-shm-usage", "--no-first-run", "--disable-gpu"],
  });
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  let screenshotStatus = "captured";
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForSelector(".app-shell", { timeout: 30000 });
    await page.waitForTimeout(700);

    if (enterDemo) {
      const clicked = await page.evaluate(() => {
        const button = document.querySelector(".hero-actions .primary-button");
        if (!(button instanceof HTMLElement)) return false;
        button.click();
        return true;
      });
      if (!clicked) throw new Error("Could not enter demo: primary button not found");
      await page.waitForTimeout(700);
    }

    if (startReviewerGuide) {
      const clicked = await page.evaluate(() => {
        const button = document.querySelector(".reviewer-guide-hero, .reviewer-guide-launch");
        if (!(button instanceof HTMLElement)) return false;
        button.click();
        return true;
      });
      if (!clicked) throw new Error("Could not start reviewer guide: guide button not found");
      await page.waitForSelector('[data-guide-active="true"]', { timeout: 12000 });
    }

    if (reviewerGuideStep) {
      const jumped = await page.evaluate((targetStep) => {
        const buttons = Array.from(document.querySelectorAll(".reviewer-guide-steps button"));
        const byNumber = Number.parseInt(targetStep, 10);
        const button = Number.isFinite(byNumber)
          ? buttons[byNumber - 1]
          : buttons.find((item) => (item.getAttribute("aria-label") || "").includes(targetStep));
        if (!(button instanceof HTMLElement)) return false;
        button.click();
        return true;
      }, reviewerGuideStep);
      if (!jumped) throw new Error(`Could not jump reviewer guide to step: ${reviewerGuideStep}`);
      await page.waitForTimeout(900);
    }

    if (runAllClosedLoop) {
      const clicked = await page.evaluate(() => {
        const button = document.querySelector(".closed-loop-run-all");
        if (!(button instanceof HTMLElement)) return false;
        button.click();
        return true;
      });
      if (!clicked) throw new Error("Could not run closed loop: run-all button not found");
      await page.waitForFunction(
        () => document.querySelector(".closed-loop-console")?.getAttribute("data-closed-loop-status") === "closed",
        null,
        { timeout: 12000 },
      );
      await page.waitForTimeout(500);
    }

    if (clickReviewerGuideAction) {
      const clicked = await page.evaluate(() => {
        const button = document.querySelector(".reviewer-guide-run-loop");
        if (!(button instanceof HTMLElement)) return false;
        button.click();
        return true;
      });
      if (!clicked) throw new Error("Could not click reviewer guide action: action button not found");
      await page.waitForFunction(
        () => document.querySelector(".closed-loop-console")?.getAttribute("data-closed-loop-status") === "closed",
        null,
        { timeout: 12000 },
      );
      await page.waitForTimeout(500);
    }

    if (clickExportLedger) {
      const clicked = await page.evaluate(() => {
        const button = document.querySelector("[data-export-ledger]");
        if (!(button instanceof HTMLElement)) return false;
        button.click();
        return true;
      });
      if (!clicked) throw new Error("Could not export ledger: export button not found");
      await page.waitForSelector(".focus-export-receipt", { timeout: 12000 });
      await page.waitForTimeout(500);
    }

    if (clickClaimLedgerReview) {
      const clicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll(".focus-submission-chain-actions button"));
        const button = buttons.find((item) => (item.textContent || "").includes("主张账本"));
        if (!(button instanceof HTMLElement)) return false;
        button.click();
        return true;
      });
      if (!clicked) throw new Error("Could not mark claim ledger review: button not found");
      await page.waitForTimeout(500);
    }

    if (clickSubmissionSeal) {
      const clicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll(".focus-submission-chain-actions button"));
        const button = buttons.find((item) => (item.textContent || "").includes("提交收口"));
        if (!(button instanceof HTMLElement)) return false;
        button.click();
        return true;
      });
      if (!clicked) throw new Error("Could not seal submission closure: button not found");
      await page.waitForFunction(
        () => document.querySelector(".focus-submission-chain")?.getAttribute("data-submission-chain-status") === "ready",
        null,
        { timeout: 12000 },
      );
      await page.waitForTimeout(500);
    }

    if (openDemoScript) {
      const clicked = await page.evaluate(() => {
        const button = document.querySelector(".focus-script-button");
        if (!(button instanceof HTMLElement)) return false;
        button.click();
        return true;
      });
      if (!clicked) throw new Error("Could not open demo script: script button not found");
      await page.waitForSelector('[data-demo-script-open="true"]', { timeout: 12000 });
      await page.waitForTimeout(500);
    }

    if (scrollTo) {
      const scrolled = await page.evaluate(
        ({ selector, offset }) => {
          const target = document.querySelector(selector);
          if (!target) return false;
          const top = target.getBoundingClientRect().top + window.scrollY - offset;
          window.scrollTo({ top: Math.max(0, top), left: 0, behavior: "instant" });
          return true;
        },
        { selector: scrollTo, offset: scrollOffset },
      );
      if (!scrolled) throw new Error(`Scroll target not found: ${scrollTo}`);
      await page.waitForTimeout(700);
    }

    const metrics = await page.evaluate(metricsExpression);
    if (!metrics.hasApp) throw new Error(`Application did not mount at ${url}`);
    if (metrics.docScroll > metrics.docClient + 1) {
      throw new Error(`Horizontal overflow: docScroll=${metrics.docScroll}, docClient=${metrics.docClient}`);
    }

    await mkdir(dirname(out), { recursive: true });
    await page.screenshot({ path: out, fullPage: false });
    await writeFile(
      `${out}.json`,
      JSON.stringify({ out, width, height, screenshotStatus, metrics }, null, 2),
      "utf-8",
    );
    console.log(JSON.stringify({ out, width, height, screenshotStatus, metrics }, null, 2));
  } catch (error) {
    const existing = await stat(out).catch(() => null);
    if (!existing) {
      throw error;
    }
    screenshotStatus = `reused-existing: ${error.message}`;
    console.log(JSON.stringify({ out, width, height, screenshotStatus }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
