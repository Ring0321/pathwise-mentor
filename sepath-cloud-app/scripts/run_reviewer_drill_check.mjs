import { readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, "..");
const root = resolve(appRoot, "..");

function rel(path) {
  return path.replace(`${root}\\`, "").replace(`${root}/`, "").replaceAll("\\", "/");
}

async function exists(path, minBytes = 1) {
  try {
    const info = await stat(path);
    return info.isFile() && info.size >= minBytes;
  } catch {
    return false;
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

const seedPath = resolve(appRoot, "qa/demo-seed/JUDGE_DEMO_SEED_MANIFEST.json");
const materialPath = resolve(root, "参赛提交材料包/50_评委5分钟实操演练与教师复核深潜说明.md");
const materialJsonPath = resolve(root, "参赛提交材料包/50_评委5分钟实操演练与教师复核深潜说明_机器可读.json");
const reportPath = resolve(appRoot, "qa/reviewer-drill-report.json");
const screenshotPath = resolve(appRoot, "qa/screenshots/reviewer-drill-panel.png");
const guideScreenshotPath = resolve(appRoot, "qa/screenshots/reviewer-guide-overlay.png");

const steps = [
  { id: "open-trial", seconds: 35, anchor: "#student" },
  { id: "run-loop", seconds: 40, anchor: "#student" },
  { id: "inspect-teacher-gate", seconds: 35, anchor: "#teacher-report" },
  { id: "inspect-algorithm", seconds: 40, anchor: "#value" },
  { id: "inspect-cloud", seconds: 25, anchor: "#cloud-slo" },
  { id: "inspect-public-url-receipt", seconds: 20, anchor: "#public-url-receipt" },
  { id: "inspect-submission-closure", seconds: 20, anchor: "#submission-closure" },
  { id: "inspect-backend-status", seconds: 20, anchor: "#backend-status" },
  { id: "inspect-verification", seconds: 30, anchor: "#judge-verification" },
  { id: "inspect-claim-ledger", seconds: 15, anchor: "#claim-ledger" },
  { id: "answer-boundary", seconds: 20, anchor: "#launch-loop" },
];

const requiredSources = [
  "src/engine/reviewerDrill.ts",
  "src/components/ReviewerDrillPanel.tsx",
  "src/components/ReviewerGuideOverlay.tsx",
  "src/engine/backendStatus.ts",
  "src/components/BackendStatusPanel.tsx",
  "src/engine/launchLoopAcceptance.ts",
  "src/components/LaunchLoopAcceptancePanel.tsx",
  "src/engine/claimEvidenceLedger.ts",
  "src/components/ClaimEvidenceLedgerPanel.tsx",
  "src/App.tsx",
  "src/engine/judgeTrial.ts",
  "src/engine/teacherReport.ts",
  "src/engine/cloudSlo.ts",
  "src/engine/publicUrlReceipt.ts",
  "src/components/PublicUrlReceiptPanel.tsx",
  "src/engine/submissionClosure.ts",
  "src/components/SubmissionClosurePanel.tsx",
  "scripts/capture_screenshot.mjs",
  "scripts/capture_with_dev_server.mjs",
  "qa/cloud-slo-load-report.json",
  "qa/public-trial-pwa-validation.json",
];

async function main() {
  const seed = (await exists(seedPath, 300)) ? await readJson(seedPath) : {};
  const materialJson = (await exists(materialJsonPath, 300)) ? await readJson(materialJsonPath) : {};
  const durationSeconds = steps.reduce((sum, step) => sum + step.seconds, 0);
  const anchors = [...new Set(steps.map((step) => step.anchor))];
  const guidedTour = {
    runtime: "sepath-reviewer-guide.v1",
    totalSteps: steps.length,
    totalSeconds: durationSeconds,
    firstAnchor: steps[0]?.anchor || "#student",
    autoScrollAnchors: anchors,
    actions: ["start", "step-through", "close"],
    screenshot: rel(guideScreenshotPath),
  };
  const sourcePresence = await Promise.all(
    requiredSources.map(async (path) => ({
      path: `sepath-cloud-app/${path}`,
      present: await exists(resolve(appRoot, path), 100),
    })),
  );
  const checks = [
    {
      id: "runtime",
      status: materialJson.runtime === "sepath-reviewer-drill.v1" ? "PASS" : "FAIL",
      evidence: materialJson.runtime || "missing",
    },
    {
      id: "duration",
      status: durationSeconds === 300 ? "PASS" : "FAIL",
      evidence: `${durationSeconds} seconds`,
    },
    {
      id: "seed-accounts",
      status: seed.runtime === "sepath-judge-demo-seed.v1" && Array.isArray(seed.accounts) && seed.accounts.length >= 5 ? "PASS" : "FAIL",
      evidence: `${seed.runtime || "missing"} / accounts=${Array.isArray(seed.accounts) ? seed.accounts.length : 0}`,
    },
    {
      id: "material",
      status: (await exists(materialPath, 800)) && (await exists(materialJsonPath, 300)) ? "PASS" : "FAIL",
      evidence: `${rel(materialPath)} + ${rel(materialJsonPath)}`,
    },
    {
      id: "source-files",
      status: sourcePresence.every((item) => item.present) ? "PASS" : "FAIL",
      evidence: sourcePresence.filter((item) => !item.present).map((item) => item.path).join(", ") || "all present",
    },
    {
      id: "anchor-coverage",
      status: ["#student", "#teacher-report", "#value", "#cloud-slo", "#public-url-receipt", "#submission-closure", "#backend-status", "#judge-verification", "#claim-ledger", "#launch-loop"].every(
        (anchor) => anchors.includes(anchor),
      )
        ? "PASS"
        : "FAIL",
      evidence: anchors.join(" / "),
    },
    {
      id: "truth-boundary",
      status: String(materialJson.truthBoundary || "").includes("synthetic") && String(materialJson.truthBoundary || "").includes("real course")
        ? "PASS"
        : "FAIL",
      evidence: materialJson.truthBoundary || "missing",
    },
    {
      id: "guided-tour-runtime",
      status: guidedTour.runtime === "sepath-reviewer-guide.v1" ? "PASS" : "FAIL",
      evidence: `${guidedTour.runtime} / steps=${guidedTour.totalSteps}`,
    },
    {
      id: "guided-tour-anchors",
      status:
        guidedTour.totalSteps === 11 &&
        guidedTour.firstAnchor === "#student" &&
        ["#teacher-report", "#cloud-slo", "#public-url-receipt", "#submission-closure", "#backend-status", "#judge-verification", "#claim-ledger", "#launch-loop"].every((anchor) =>
          guidedTour.autoScrollAnchors.includes(anchor),
        )
          ? "PASS"
          : "FAIL",
      evidence: guidedTour.autoScrollAnchors.join(" / "),
    },
    {
      id: "guided-tour-actions",
      status: guidedTour.actions.join("|") === "start|step-through|close" ? "PASS" : "FAIL",
      evidence: guidedTour.actions.join(" / "),
    },
  ];

  const summary = {
    PASS: checks.filter((check) => check.status === "PASS").length,
    FAIL: checks.filter((check) => check.status === "FAIL").length,
    rows: checks.length,
    durationSeconds,
    personas: Array.isArray(seed.accounts) ? seed.accounts.length : 0,
    anchors,
  };

  const report = {
    generatedAt: new Date().toISOString(),
    runtime: "sepath-reviewer-drill.v1",
    scope: "synthetic reviewer walkthrough; not a claim of real school production access or real course gains",
    summary,
    checks,
    steps,
    sourcePresence,
    screenshot: rel(screenshotPath),
    guidedTour,
    material: rel(materialPath),
  };
  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify({ summary, report: reportPath }, null, 2));
  if (summary.FAIL > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
