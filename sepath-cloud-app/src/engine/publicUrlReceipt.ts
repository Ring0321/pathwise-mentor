import type { FinalSubmissionReport } from "./finalSubmission";
import type { HostingSelftestReport } from "./hostingSelftest";

export type PublicUrlReceiptStatus = "ready" | "watch" | "manual" | "blocked";

export interface PublicUrlProbe {
  id: string;
  label: string;
  status: PublicUrlReceiptStatus;
  evidence: string;
  expected: string;
  url?: string;
}

export interface PublicUrlCommand {
  id: string;
  label: string;
  status: PublicUrlReceiptStatus;
  command: string;
  result: string;
}

export interface PublicUrlPasteRow {
  field: string;
  value: string;
  guardrail: string;
}

export interface PublicUrlEvidenceBundle {
  id: string;
  label: string;
  status: PublicUrlReceiptStatus;
  path: string;
  proof: string;
}

export interface PublicUrlReceiptReport {
  runtime: string;
  score: number;
  stage: string;
  summary: string;
  normalizedUrl: string;
  candidateReady: boolean;
  readyCount: number;
  watchCount: number;
  manualCount: number;
  blockedCount: number;
  probes: PublicUrlProbe[];
  commands: PublicUrlCommand[];
  pasteRows: PublicUrlPasteRow[];
  evidenceBundle: PublicUrlEvidenceBundle[];
  requiredPaths: string[];
  boundary: string;
  manifest: string;
}

const REQUIRED_PATHS = [
  "/",
  "/PUBLIC_HEALTH.json",
  "/PUBLIC_RELEASE.json",
  "/PUBLIC_TRIAL_MANIFEST.json",
  "/JUDGE_DEMO_SEED_MANIFEST.json",
  "/REVIEWER_DRILL_REPORT.json",
  "/reviewer-guide-overlay.png",
  "/reviewer-guide-claim-ledger.png",
];

function countStatus<T extends { status: PublicUrlReceiptStatus }>(
  items: T[],
  status: PublicUrlReceiptStatus,
): number {
  return items.filter((item) => item.status === status).length;
}

function statusWeight(status: PublicUrlReceiptStatus): number {
  if (status === "ready") return 1;
  if (status === "watch") return 0.72;
  if (status === "manual") return 0.46;
  return 0;
}

function parseUrl(input: string): URL | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed);
  } catch {
    try {
      return new URL(`https://${trimmed}`);
    } catch {
      return null;
    }
  }
}

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(host)) return true;
  if (host.endsWith(".local")) return true;
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
  return false;
}

function withPath(base: URL | null, path: string): string {
  if (!base) return path;
  const next = new URL(base.toString());
  const basePath = next.pathname.endsWith("/") ? next.pathname.slice(0, -1) : next.pathname;
  if (path === "/") {
    next.pathname = basePath || "/";
  } else {
    next.pathname = `${basePath}${path}`;
  }
  next.search = "";
  next.hash = "";
  return next.toString();
}

export function buildPublicUrlReceiptReport(
  candidateUrl: string,
  hostingSelftest: HostingSelftestReport,
  finalSubmission: FinalSubmissionReport,
): PublicUrlReceiptReport {
  const parsed = parseUrl(candidateUrl);
  const hasCandidate = candidateUrl.trim().length > 0;
  const isHttps = parsed?.protocol === "https:";
  const publicHost = Boolean(parsed?.hostname && !isPrivateHost(parsed.hostname) && parsed.hostname.includes("."));
  const basePath = parsed?.pathname && parsed.pathname !== "/" ? parsed.pathname.replace(/\/$/, "") : "";
  const artifactReady = hostingSelftest.passCount >= 8 && hostingSelftest.uploadZip.includes("public-site-upload");
  const packageReady = finalSubmission.uploadRoutes.some((route) => route.id === "single-zip" && route.status === "ready");
  const candidateReady = Boolean(parsed && isHttps && publicHost && artifactReady);
  const normalizedUrl = parsed ? parsed.toString().replace(/\/$/, "") : "";

  const probes: PublicUrlProbe[] = [
    {
      id: "candidate-url",
      label: "候选 URL",
      status: hasCandidate ? "ready" : "manual",
      evidence: hasCandidate ? normalizedUrl : "等待外部静态托管平台生成 HTTPS 地址。",
      expected: "填入评委可匿名打开的最终公网地址。",
      url: normalizedUrl || undefined,
    },
    {
      id: "https-public",
      label: "公网 HTTPS",
      status: isHttps && publicHost ? "ready" : hasCandidate ? "blocked" : "manual",
      evidence:
        isHttps && publicHost
          ? `${parsed?.protocol}//${parsed?.hostname}`
          : "不能使用 localhost、内网 IP、owner-only 私有链接或 HTTP 地址。",
      expected: "https:// 开头，主机名为公网域名。",
      url: normalizedUrl || undefined,
    },
    {
      id: "spa-base",
      label: "SPA 根路径",
      status: basePath ? "watch" : hasCandidate ? "ready" : "manual",
      evidence: basePath ? `检测到项目子路径 ${basePath}，GitHub Pages 等场景需要确认 assets 基路径。` : "根路径部署可直接访问 index.html。",
      expected: "根路径或已配置好子路径回退到 index.html。",
      url: withPath(parsed, "/"),
    },
    {
      id: "upload-artifact",
      label: "静态上传包",
      status: artifactReady ? "ready" : "watch",
      evidence: hostingSelftest.uploadZip,
      expected: "ZIP 根目录含 index.html、路由回退和 health/release JSON。",
    },
    {
      id: "stage-package",
      label: "主提交包一致",
      status: packageReady ? "ready" : "watch",
      evidence: finalSubmission.packagePath,
      expected: "最终提交包与公网静态包来自同一轮 release gate。",
    },
    {
      id: "health-release-probes",
      label: "运行时探针",
      status: candidateReady ? "ready" : hasCandidate ? "watch" : "manual",
      evidence: REQUIRED_PATHS.slice(1).join(" / "),
      expected: "上线后用 CLI 验证这些路径全部 2xx/3xx 且关键 JSON runtime 正确。",
      url: withPath(parsed, "/PUBLIC_HEALTH.json"),
    },
    {
      id: "platform-receipt",
      label: "平台回执封存",
      status: candidateReady ? "manual" : "manual",
      evidence: "final_public_url_receipt.json 必须由 finalize_public_url_receipt.py 生成。",
      expected: "status=ready_for_platform 且 validation_summary.FAIL=0 后才能粘贴比赛平台。",
    },
  ];

  const finalCommand = candidateReady
    ? `rtk python scripts/finalize_public_url_receipt.py --url ${normalizedUrl} --write`
    : "rtk python scripts/finalize_public_url_receipt.py --url https://your-public-demo.example --write";
  const syncCommand = candidateReady
    ? `rtk python scripts/finalize_public_url_receipt.py --url ${normalizedUrl} --write --sync-platform-copy`
    : "rtk python scripts/finalize_public_url_receipt.py --url https://your-public-demo.example --write --sync-platform-copy";

  const commands: PublicUrlCommand[] = [
    {
      id: "seal-receipt",
      label: "生成最终公网 URL 回执",
      status: candidateReady ? "ready" : "manual",
      command: finalCommand,
      result: "写入 submission/final_public_url_receipt.json 和 public_url_validation_report.json。",
    },
    {
      id: "sync-platform-copy",
      label: "同步比赛平台粘贴文案",
      status: candidateReady ? "watch" : "manual",
      command: syncCommand,
      result: "只有 ready_for_platform 后才会更新 10_比赛平台填写文案.md。",
    },
    {
      id: "final-release-gate",
      label: "回填后复跑最终门禁",
      status: candidateReady ? "watch" : "manual",
      command: "rtk python scripts/release_gate.py --skip-screenshots",
      result: "重新生成提交包、审计和一致性报告，证明 URL 与 ZIP 同轮封存。",
    },
  ];

  const pasteRows: PublicUrlPasteRow[] = [
    {
      field: "云端演示地址",
      value: candidateReady ? normalizedUrl : "【待填：最终公网 HTTPS URL】",
      guardrail: "未通过回执前不要填 owner-only、localhost 或历史 Sites 地址。",
    },
    {
      field: "云端访问说明",
      value: candidateReady
        ? "公网只读 Demo，使用合成样本；无真实学生数据、API Key、生产数据库凭据。"
        : "先提交本地 Demo、演示视频和静态上传包；公网 URL 发布并回执通过后再同步平台文案。",
      guardrail: "只能说 public static demo passed URL receipt，不能说真实学校生产上线。",
    },
    {
      field: "评委验证路径",
      value: REQUIRED_PATHS.join(" , "),
      guardrail: "评委打不开 health/release JSON 时，优先排查 ZIP 根目录和 SPA fallback。",
    },
  ];

  const evidenceBundle: PublicUrlEvidenceBundle[] = [
    {
      id: "upload-zip",
      label: "公网静态上传包",
      status: "ready",
      path: hostingSelftest.uploadZip,
      proof: "可拖拽上传，内含跨平台路由文件和只读合成演示资产。",
    },
    {
      id: "receipt-json",
      label: "最终 URL 回执",
      status: candidateReady ? "watch" : "manual",
      path: "submission/final_public_url_receipt.json",
      proof: "上线后由脚本写入，ready_for_platform 才能提交平台。",
    },
    {
      id: "release-consistency",
      label: "一致性报告",
      status: candidateReady ? "watch" : "ready",
      path: "submission/release_consistency_report.json",
      proof: "URL 回填后需重跑，确保审计、manifest、release gate 同轮一致。",
    },
    {
      id: "platform-copy",
      label: "平台填写文案",
      status: candidateReady ? "watch" : "manual",
      path: "参赛提交材料包/10_比赛平台填写文案.md",
      proof: "只允许同步已经机器验收的最终公网 URL。",
    },
  ];

  const allStatuses = [...probes, ...commands, ...evidenceBundle];
  const readyCount = countStatus(allStatuses, "ready");
  const watchCount = countStatus(allStatuses, "watch");
  const manualCount = countStatus(allStatuses, "manual");
  const blockedCount = countStatus(allStatuses, "blocked");
  const score = Math.round(
    (allStatuses.reduce((sum, item) => sum + statusWeight(item.status), 0) / allStatuses.length) * 100,
  );
  const runtime = "sepath-public-url-receipt-console.v1";
  const boundary =
    "产品侧工作台做结构化 URL 回执推演；最终可提交状态仍以 finalize_public_url_receipt.py 的机器验证和 release gate 为准。";

  return {
    runtime,
    score,
    stage: candidateReady ? "ready to seal public URL receipt" : "waiting for external public URL",
    summary: candidateReady
      ? "候选公网 URL 已满足 HTTPS、公网域名和静态包就绪条件，下一步生成回执并同步比赛平台文案。"
      : "公网发布资产已经就绪，但最终评审 URL 仍需外部托管平台生成并通过回执验收。",
    normalizedUrl,
    candidateReady,
    readyCount,
    watchCount,
    manualCount,
    blockedCount,
    probes,
    commands,
    pasteRows,
    evidenceBundle,
    requiredPaths: REQUIRED_PATHS,
    boundary,
    manifest: JSON.stringify(
      {
        runtime,
        candidateUrl: normalizedUrl || "PENDING_FINAL_PUBLIC_URL",
        candidateReady,
        requiredPaths: REQUIRED_PATHS,
        finalReceiptScript: "scripts/finalize_public_url_receipt.py",
        finalReceiptJson: "submission/final_public_url_receipt.json",
        releaseConsistency: "submission/release_consistency_report.json",
        truthBoundary: boundary,
      },
      null,
      2,
    ),
  };
}
