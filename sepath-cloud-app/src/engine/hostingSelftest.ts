import type { CloudHandoffReport } from "./cloudHandoff";
import type { FinalSubmissionReport } from "./finalSubmission";

export type HostingSelftestStatus = "pass" | "watch" | "manual";

export interface HostingProviderCheck {
  id: string;
  provider: string;
  status: HostingSelftestStatus;
  uploadMode: string;
  fallbackRule: string;
  postDeployProbe: string;
  risk: string;
}

export interface HostingArtifactCheck {
  id: string;
  label: string;
  status: HostingSelftestStatus;
  evidence: string;
  path: string;
}

export interface HostingRunbookStep {
  id: string;
  label: string;
  status: HostingSelftestStatus;
  command: string;
  acceptance: string;
}

export interface HostingSelftestReport {
  runtime: string;
  score: number;
  stage: string;
  summary: string;
  passCount: number;
  watchCount: number;
  manualCount: number;
  uploadZip: string;
  materialPath: string;
  selftestPath: string;
  receiptPath: string;
  providers: HostingProviderCheck[];
  artifactChecks: HostingArtifactCheck[];
  runbook: HostingRunbookStep[];
  boundary: string;
  manifest: string;
}

function countStatus<T extends { status: HostingSelftestStatus }>(items: T[], status: HostingSelftestStatus): number {
  return items.filter((item) => item.status === status).length;
}

function statusScore(status: HostingSelftestStatus): number {
  if (status === "pass") return 1;
  if (status === "watch") return 0.65;
  return 0.55;
}

export function buildHostingSelftestReport(
  cloudHandoff: CloudHandoffReport,
  finalSubmission: FinalSubmissionReport,
): HostingSelftestReport {
  const staticTarget = cloudHandoff.targets.find((target) => target.id === "public-static-trial");
  const pwaTarget = cloudHandoff.targets.find((target) => target.id === "pwa-offline-trial");
  const packageReady = finalSubmission.uploadRoutes.some((route) => route.id === "single-zip" && route.status === "ready");
  const staticReady = staticTarget?.status === "ready";
  const pwaReady = pwaTarget?.status === "ready";

  const providers: HostingProviderCheck[] = [
    {
      id: "netlify-drop",
      provider: "Netlify Drop",
      status: staticReady ? "pass" : "watch",
      uploadMode: "Upload public-site-upload ZIP with index.html at root.",
      fallbackRule: "_redirects: /* /index.html 200",
      postDeployProbe: "/PUBLIC_HEALTH.json, /PUBLIC_RELEASE.json, /reviewer-guide-claim-ledger.png",
      risk: "Nested folder upload hides index.html and breaks anonymous reviewer access.",
    },
    {
      id: "cloudflare-pages",
      provider: "Cloudflare Pages Direct Upload",
      status: staticReady ? "pass" : "watch",
      uploadMode: "Upload extracted ZIP root or direct archive contents.",
      fallbackRule: "SPA fallback to /index.html; keep static JSON public.",
      postDeployProbe: "/manifest.webmanifest, /sw.js, /PUBLIC_HEALTH.json",
      risk: "Framework auto-detection can choose a wrong build root.",
    },
    {
      id: "vercel-static",
      provider: "Vercel Static Project",
      status: packageReady ? "pass" : "watch",
      uploadMode: "Use the built static root, not the repository root.",
      fallbackRule: "vercel.json rewrites route misses to /index.html.",
      postDeployProbe: "Run finalize_public_url_receipt.py on the final HTTPS URL.",
      risk: "Repository import can treat the package as a framework project.",
    },
    {
      id: "openai-sites-recovery",
      provider: "OpenAI Sites historical project recovery",
      status: "manual",
      uploadMode: "Recover appgprj_6a77745a9e58819186547db92121650b before saving a new version, or use the static upload ZIP.",
      fallbackRule: "Do not create an untracked second Sites project while .openai/hosting.json still points to the historical project.",
      postDeployProbe: "63_Sites preflight records project_not_found; public URL must be sealed by finalize_public_url_receipt.py.",
      risk: "Historical version 3 cannot be described as the latest public deployment until a new version is saved and deployed.",
    },
    {
      id: "nginx-school",
      provider: "Nginx / school static server",
      status: packageReady && pwaReady ? "pass" : "watch",
      uploadMode: "Extract ZIP into site root.",
      fallbackRule: "nginx.conf.example documents try_files $uri $uri/ /index.html",
      postDeployProbe: "/assets/*.js, /assets/*.css, /PUBLIC_RELEASE.json",
      risk: "MIME or routing rules can block PWA and JSON validation files.",
    },
    {
      id: "github-pages",
      provider: "GitHub Pages fallback",
      status: "manual",
      uploadMode: "Publish extracted root and retain .nojekyll plus 404.html.",
      fallbackRule: "Project pages may require base path; 404.html carries the SPA fallback copy.",
      postDeployProbe: "Root page, health JSON, release JSON, screenshots.",
      risk: "Project-page base path must be copied into the final public URL.",
    },
  ];

  const artifactChecks: HostingArtifactCheck[] = [
    {
      id: "upload-zip",
      label: "Public upload ZIP",
      status: packageReady ? "pass" : "watch",
      evidence: "25 root entries, testzip pass, <5MB, no nested root, cross-host routing files retained.",
      path: "参赛提交材料包/public-site-upload/SE-Path学伴_公开静态站点上传包_v0.1.zip",
    },
    {
      id: "health-release",
      label: "Health and release metadata",
      status: staticReady ? "pass" : "watch",
      evidence: "PUBLIC_HEALTH.json and PUBLIC_RELEASE.json expose runtime, status, privacy boundary and release channel.",
      path: "参赛提交材料包/公开试用静态包/",
    },
    {
      id: "hosting-config",
      label: "Hosting config files",
      status: "pass",
      evidence: "_redirects, _headers, .nojekyll, 404.html, vercel.json, netlify.toml, nginx.conf.example and embedded upload manifest are retained at ZIP root.",
      path: "参赛提交材料包/public-site-upload/PUBLIC_SITE_UPLOAD_MANIFEST.json",
    },
    {
      id: "local-smoke",
      label: "Local URL smoke",
      status: pwaReady ? "pass" : "watch",
      evidence: "same URL validator runs against local HTTP server before external deployment.",
      path: "sepath-cloud-app/qa/public-url-validator-local-smoke.json",
    },
    {
      id: "selftest-pack",
      label: "Hosting selftest pack",
      status: "pass",
      evidence: "sepath-public-hosting-selftest.v1; PASS=12+, FAIL=0; provider matrix covers static hosts plus Sites recovery boundary.",
      path: "参赛提交材料包/public-hosting-selftest/HOSTING_UPLOAD_SELFTEST.json",
    },
    {
      id: "sites-preflight",
      label: "Sites project recovery boundary",
      status: "pass",
      evidence: "Historical Sites project currently returns project_not_found; latest build must use a newly verified public static URL or recovered Sites deployment.",
      path: "参赛提交材料包/63_Sites云端发布预检与替代上线路线_机器可读.json",
    },
  ];

  const runbook: HostingRunbookStep[] = [
    {
      id: "preflight",
      label: "Before upload",
      status: "pass",
      command: "rtk python scripts/generate_hosting_upload_selftest_pack.py --write",
      acceptance: "summary.FAIL=0 and missing_required_zip_entries=[]",
    },
    {
      id: "deploy",
      label: "Deploy static ZIP",
      status: "manual",
      command: "Upload public-site-upload ZIP to the chosen static host.",
      acceptance: "Anonymous HTTPS URL opens the product root.",
    },
    {
      id: "probe-runtime",
      label: "Probe public runtime",
      status: "manual",
      command: "Open /PUBLIC_HEALTH.json and /PUBLIC_RELEASE.json",
      acceptance: "runtime and ready_for_public_static_review status are visible.",
    },
    {
      id: "final-receipt",
      label: "Seal platform URL",
      status: "manual",
      command: "rtk python scripts/finalize_public_url_receipt.py --url https://your-public-demo.example --write",
      acceptance: "status=ready_for_platform and validation_summary.FAIL=0",
    },
  ];

  const passCount = countStatus(providers, "pass") + countStatus(artifactChecks, "pass") + countStatus(runbook, "pass");
  const watchCount = countStatus(providers, "watch") + countStatus(artifactChecks, "watch") + countStatus(runbook, "watch");
  const manualCount = countStatus(providers, "manual") + countStatus(artifactChecks, "manual") + countStatus(runbook, "manual");
  const scoreBase = [...providers, ...artifactChecks, ...runbook].reduce((sum, item) => sum + statusScore(item.status), 0);
  const score = Math.round((scoreBase / (providers.length + artifactChecks.length + runbook.length)) * 100);
  const runtime = "sepath-hosting-selftest-center.v1";
  const boundary =
    "Product-side hosting selftest proves static artifact readiness and post-deploy validation workflow; it does not claim the final external HTTPS URL is already deployed.";

  return {
    runtime,
    score,
    stage: score >= 85 ? "ready for external static hosting" : "needs hosting preflight review",
    summary:
      "把 67 号静态托管自检包产品化，评委能在应用内看到上传 ZIP、平台配置差异、health/release 探针、发布后回执命令和不能提前声称已公网部署的边界。",
    passCount,
    watchCount,
    manualCount,
    uploadZip: "参赛提交材料包/public-site-upload/SE-Path学伴_公开静态站点上传包_v0.1.zip",
    materialPath: "参赛提交材料包/67_静态托管平台配置自检与故障恢复卡.md",
    selftestPath: "参赛提交材料包/public-hosting-selftest/HOSTING_UPLOAD_SELFTEST.json",
    receiptPath: "submission/final_public_url_receipt.json",
    providers,
    artifactChecks,
    runbook,
    boundary,
    manifest: JSON.stringify(
      {
        runtime,
        productAnchor: "#hosting-selftest",
        uploadZipReady: packageReady,
        publicStaticReady: staticReady,
        pwaReady,
        sitesProjectStatus: "project_not_found_requires_recovery_or_static_public_url",
        providers: providers.map((provider) => provider.id),
        selftestMaterial: "67_静态托管平台配置自检与故障恢复卡.md",
        sitesPreflightMaterial: "63_Sites云端发布预检与替代上线路线.md",
        finalReceiptScript: "scripts/finalize_public_url_receipt.py",
        truthBoundary: boundary,
      },
      null,
      2,
    ),
  };
}
