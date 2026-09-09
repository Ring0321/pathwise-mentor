import type { FinalSubmissionReport } from "./finalSubmission";
import type { HostingSelftestReport } from "./hostingSelftest";
import { buildPublicUrlReceiptReport } from "./publicUrlReceipt";

export type SubmissionClosureStatus = "ready" | "watch" | "manual" | "blocked";

export interface SubmissionClosureGate {
  id: string;
  label: string;
  status: SubmissionClosureStatus;
  owner: "machine" | "team" | "platform" | "ops";
  evidence: string;
  nextAction: string;
}

export interface SubmissionClosureCommand {
  id: string;
  label: string;
  status: SubmissionClosureStatus;
  command: string;
  expectedOutput: string;
}

export interface SubmissionClosureArtifact {
  id: string;
  label: string;
  status: SubmissionClosureStatus;
  path: string;
  proof: string;
}

export interface SubmissionClosureReport {
  runtime: string;
  score: number;
  stage: string;
  summary: string;
  finalUrl: string;
  readyCount: number;
  watchCount: number;
  manualCount: number;
  blockedCount: number;
  gates: SubmissionClosureGate[];
  commands: SubmissionClosureCommand[];
  artifacts: SubmissionClosureArtifact[];
  closingOrder: string[];
  platformPastePreview: string[];
  boundary: string;
  manifest: string;
}

function countStatus<T extends { status: SubmissionClosureStatus }>(
  items: T[],
  status: SubmissionClosureStatus,
): number {
  return items.filter((item) => item.status === status).length;
}

function statusWeight(status: SubmissionClosureStatus): number {
  if (status === "ready") return 1;
  if (status === "watch") return 0.72;
  if (status === "manual") return 0.42;
  return 0;
}

function verifiedPythonCommand(script: string, args = "") {
  const suffix = args ? ` ${args}` : "";
  return `rtk C:\\Users\\Ring\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe ${script}${suffix}`;
}

export function buildSubmissionClosureReport(
  candidateUrl: string,
  hostingSelftest: HostingSelftestReport,
  finalSubmission: FinalSubmissionReport,
): SubmissionClosureReport {
  const urlReceipt = buildPublicUrlReceiptReport(candidateUrl, hostingSelftest, finalSubmission);
  const urlReady = urlReceipt.candidateReady;
  const releaseReady = finalSubmission.blockedCount === 0 && finalSubmission.uploadRoutes.some((route) => route.id === "single-zip" && route.status === "ready");
  const packageReady = finalSubmission.packageSnapshot.every((item) => item.status !== "blocked");
  const finalUrl = urlReceipt.normalizedUrl || "PENDING_FINAL_PUBLIC_URL";
  const urlArg = urlReady ? finalUrl : "https://your-public-demo.example";

  const gates: SubmissionClosureGate[] = [
    {
      id: "final-public-url-receipt",
      label: "最终公网 URL 回执",
      status: urlReady ? "ready" : "manual",
      owner: "machine",
      evidence: urlReady ? `${finalUrl} 满足公网 HTTPS 和静态上传包条件。` : "等待外部托管平台生成最终公网 HTTPS URL。",
      nextAction: "运行 finalize_submission_after_public_url.py，生成 71 号收口报告和 final_public_url_receipt.json。",
    },
    {
      id: "platform-copy-sync",
      label: "比赛平台文案同步",
      status: urlReady ? "watch" : "manual",
      owner: "ops",
      evidence: "只有 URL 回执 ready_for_platform 后才允许改写 10_比赛平台填写文案.md。",
      nextAction: "使用 --sync-platform-copy 同步云端演示地址和云端访问说明。",
    },
    {
      id: "team-profile",
      label: "正式队伍画像",
      status: "manual",
      owner: "team",
      evidence: "队伍名、成员、联系方式必须来自比赛平台真实报名信息。",
      nextAction: "运行 build_final_submission_profile.py，补齐 team.name 和 team.members，并逐项确认 confirmed 字段。",
    },
    {
      id: "final-named-copies",
      label: "正式命名副本",
      status: "manual",
      owner: "team",
      evidence: "submission/final_named/ 只能在正式画像通过后生成。",
      nextAction: "先 dry-run 预览队伍名+作品名，再用 --write 生成 ZIP/PDF/PPT/MP4 副本。",
    },
    {
      id: "release-gate",
      label: "最终发布门禁",
      status: releaseReady ? "ready" : "blocked",
      owner: "machine",
      evidence: finalSubmission.finalGateReportPath,
      nextAction: "命名副本和 URL 回填后复跑 release_gate.py --skip-screenshots。",
    },
    {
      id: "release-consistency",
      label: "跨材料一致性",
      status: releaseReady ? (urlReady ? "watch" : "ready") : "blocked",
      owner: "machine",
      evidence: "submission/release_consistency_report.json 需要在最终 URL 回填后再生成一次。",
      nextAction: "复跑 verify_release_consistency.py，确认 manifest、审计和 71 号收口报告同轮一致。",
    },
  ];

  const commands: SubmissionClosureCommand[] = [
    {
      id: "close-public-url",
      label: "URL 回填收口",
      status: urlReady ? "ready" : "manual",
      command: verifiedPythonCommand("scripts/finalize_submission_after_public_url.py", `--url ${urlArg} --write --sync-platform-copy`),
      expectedOutput: "71 号机器可读报告 checks_summary.FAIL=0，URL 回执 ready 后同步平台文案。",
    },
    {
      id: "build-profile",
      label: "生成正式画像",
      status: "manual",
      command: verifiedPythonCommand(
        "scripts/build_final_submission_profile.py",
        '--team-name "<比赛平台队伍名>" --member "姓名|学校|专业|角色|平台联系方式" --access-policy public_cloud_after_permission_switch --cloud-url "' +
          urlArg +
          '" --video-policy caption_material_v0.3 --claim-policy synthetic_replay_only_until_pilot --write --print-next-commands',
      ),
      expectedOutput: "submission/final_submission_profile.json 无 errors，confirmed 字段由人工逐项确认。",
    },
    {
      id: "named-dry-run",
      label: "正式命名预演",
      status: "manual",
      command: verifiedPythonCommand(
        "scripts/prepare_final_named_submission.py",
        '--profile "submission/final_submission_profile.json" --dry-run',
      ),
      expectedOutput: "目标文件名逐字符合比赛平台队伍名+作品名要求。",
    },
    {
      id: "named-write",
      label: "生成正式命名副本",
      status: "manual",
      command: verifiedPythonCommand(
        "scripts/prepare_final_named_submission.py",
        '--profile "submission/final_submission_profile.json" --write',
      ),
      expectedOutput: "submission/final_named/ 生成上传说明和 manifest，目标 SHA256 可复核。",
    },
    {
      id: "release-gate",
      label: "最终门禁复跑",
      status: releaseReady ? "ready" : "blocked",
      command: verifiedPythonCommand("scripts/release_gate.py", "--skip-screenshots"),
      expectedOutput: "release_gate=PASS，command_failures=0，审计 FAIL=0。",
    },
    {
      id: "consistency",
      label: "一致性复核",
      status: releaseReady ? "ready" : "blocked",
      command: verifiedPythonCommand("scripts/verify_release_consistency.py"),
      expectedOutput: "release_consistency_report.json PASS>=42，FAIL=0。",
    },
  ];

  const artifacts: SubmissionClosureArtifact[] = [
    {
      id: "material-71",
      label: "71 号收口说明",
      status: "ready",
      path: "参赛提交材料包/71_公网URL回填后的正式提交收口说明.md",
      proof: "把 URL、平台文案、正式画像、命名副本、发布门禁和一致性检查放在同一张提交日卡片。",
    },
    {
      id: "material-71-json",
      label: "71 号机器可读报告",
      status: "ready",
      path: "参赛提交材料包/71_公网URL回填后的正式提交收口说明_机器可读.json",
      proof: "release consistency 已检查 runtime、关键 gate 和 FAIL=0。",
    },
    {
      id: "final-receipt",
      label: "最终 URL 回执",
      status: urlReady ? "watch" : "manual",
      path: "submission/final_public_url_receipt.json",
      proof: "真实 URL 生成后才会变为 ready_for_platform。",
    },
    {
      id: "final-named",
      label: "正式命名副本目录",
      status: "manual",
      path: "submission/final_named/",
      proof: "需要真实队伍画像，不能从 Demo 合成。",
    },
    {
      id: "stage-package",
      label: "阶段提交主包",
      status: packageReady ? "ready" : "watch",
      path: finalSubmission.packagePath,
      proof: finalSubmission.finalGateReportPath,
    },
  ];

  const allStatuses = [...gates, ...commands, ...artifacts];
  const readyCount = countStatus(allStatuses, "ready");
  const watchCount = countStatus(allStatuses, "watch");
  const manualCount = countStatus(allStatuses, "manual");
  const blockedCount = countStatus(allStatuses, "blocked");
  const score = Math.round(
    (allStatuses.reduce((sum, item) => sum + statusWeight(item.status), 0) / allStatuses.length) * 100,
  );
  const runtime = "sepath-submission-closure-console.v1";
  const boundary =
    "产品内收口总控只展示可执行闭环和剩余人工门禁；真实队伍成员、平台提交回执、生产上线和真实学习效果不能由 Demo 自动生成。";
  const platformPastePreview = urlReceipt.pasteRows.map((item) => `${item.field}: ${item.value}`);

  return {
    runtime,
    score,
    stage: urlReady ? "public URL can be sealed; human profile still required" : "waiting for final public URL and team profile",
    summary: urlReady
      ? "公网地址已满足候选条件，仍需人工确认队伍画像和正式命名副本，再复跑最终门禁。"
      : "应用、材料和静态上传包已形成闭环；提交日前还需最终公网 URL、真实队伍画像和平台回执。",
    finalUrl,
    readyCount,
    watchCount,
    manualCount,
    blockedCount,
    gates,
    commands,
    artifacts,
    closingOrder: [
      "发布公开静态包并拿到公网 HTTPS URL",
      "运行 71 号收口脚本并同步比赛平台文案",
      "按比赛平台真实信息生成 final_submission_profile.json",
      "生成正式命名副本并保存 manifest",
      "复跑 release_gate.py 与 verify_release_consistency.py",
      "上传平台并保存回执截图、最终 ZIP SHA256 和提交时间",
    ],
    platformPastePreview,
    boundary,
    manifest: JSON.stringify(
      {
        runtime,
        finalUrl,
        urlCandidateReady: urlReady,
        score,
        gates: gates.map((item) => ({ id: item.id, status: item.status, owner: item.owner })),
        material71: "参赛提交材料包/71_公网URL回填后的正式提交收口说明_机器可读.json",
        finalReceipt: "submission/final_public_url_receipt.json",
        truthBoundary: boundary,
      },
      null,
      2,
    ),
  };
}
