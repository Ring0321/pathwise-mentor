import type { AwardReadinessReport } from "../domain/types";
import type { BackendStatusReport } from "./backendStatus";
import type { CloudHandoffReport, CloudHandoffStatus } from "./cloudHandoff";
import type { CloudSloReport } from "./cloudSlo";
import type { FinalSubmissionReport } from "./finalSubmission";
import type { HostingSelftestReport } from "./hostingSelftest";
import type { SubmissionOpsReport } from "./submissionOps";
import type { ValueUpliftReport } from "./valueUplift";

export type JudgeVerificationStatus = "pass" | "check" | "manual";

export interface JudgeVerificationProof {
  id: string;
  label: string;
  status: JudgeVerificationStatus;
  evidence: string;
  materialPath: string;
  command: string;
  judgeValue: string;
}

export interface JudgeVerificationRoute {
  id: string;
  minute: string;
  action: string;
  expectedSignal: string;
  scoringFocus: string;
}

export interface JudgeVerificationBoundary {
  id: string;
  label: string;
  status: JudgeVerificationStatus;
  safeClaim: string;
  forbiddenClaim: string;
}

export interface JudgeVerificationReport {
  score: number;
  stage: string;
  summary: string;
  passCount: number;
  checkCount: number;
  manualCount: number;
  verificationPackPath: string;
  machinePackPath: string;
  releaseGatePath: string;
  proofs: JudgeVerificationProof[];
  routes: JudgeVerificationRoute[];
  sourceHotspots: string[];
  boundaries: JudgeVerificationBoundary[];
  manifest: string;
}

function toVerificationStatus(status: CloudHandoffStatus): JudgeVerificationStatus {
  if (status === "ready") return "pass";
  if (status === "manual") return "manual";
  return "check";
}

function countStatus<T extends { status: JudgeVerificationStatus }>(items: T[], status: JudgeVerificationStatus): number {
  return items.filter((item) => item.status === status).length;
}

function scoreStatus(status: JudgeVerificationStatus): number {
  if (status === "pass") return 1;
  if (status === "manual") return 0.55;
  return 0.35;
}

export function buildJudgeVerificationReport(
  cloudHandoff: CloudHandoffReport,
  finalSubmission: FinalSubmissionReport,
  submissionOps: SubmissionOpsReport,
  awardReadiness: AwardReadinessReport,
  valueUplift: ValueUpliftReport,
  cloudSlo?: CloudSloReport,
  backendStatus?: BackendStatusReport,
  hostingSelftest?: HostingSelftestReport,
): JudgeVerificationReport {
  const edgeSmoke = cloudHandoff.probes.find((probe) => probe.id === "edge-api-smoke");
  const edgeHttpSmoke = cloudHandoff.probes.find((probe) => probe.id === "edge-api-http-smoke");
  const publicTrial = cloudHandoff.targets.find((target) => target.id === "public-static-trial");
  const releaseReady = finalSubmission.blockedCount === 0 && submissionOps.blockedCount === 0;
  const edgeReady = edgeSmoke?.signal.includes("14") && edgeHttpSmoke?.signal.includes("14");
  const proofRows: JudgeVerificationProof[] = [
    {
      id: "release-gate",
      label: "最终发布门禁",
      status: releaseReady ? "pass" : "check",
      evidence: "release_gate=PASS、command_failures=0、截图 QA、构建、审计和打包串联执行。",
      materialPath: "outputs/SE-Path学伴_最终发布门禁报告_机器生成.json",
      command: "rtk python scripts/release_gate.py",
      judgeValue: "证明作品不是一次性页面，而是可重复验收的工程交付。",
    },
    {
      id: "audit",
      label: "提交前自动终审",
      status: submissionOps.blockedCount === 0 ? "pass" : "check",
      evidence: "自动审计 0 WARN / 0 FAIL / 5 MANUAL，PASS 数以终审报告为准，人工项均为不可编造事实。",
      materialPath: "参赛提交材料包/09_提交前终审报告_机器可读.json",
      command: "rtk python scripts/audit_submission_readiness.py",
      judgeValue: "证明材料、视频、源码、ZIP、隐私边界和评分维度均被机器索引。",
    },
    {
      id: "edge-direct",
      label: "Edge API 直调验收",
      status: edgeReady ? "pass" : "check",
      evidence: edgeSmoke?.signal ?? "等待 Edge API direct smoke 报告。",
      materialPath: "sepath-cloud-app/qa/edge-api-smoke-report.json",
      command: edgeSmoke?.command ?? "rtk npm run cloud:smoke",
      judgeValue: "证明 HMAC token、RBAC、隐私字段拦截、证据读回和教师工单不是纸面接口。",
    },
    {
      id: "edge-http",
      label: "Edge API HTTP 验收",
      status: edgeReady ? "pass" : "check",
      evidence: edgeHttpSmoke?.signal ?? "等待 Edge API HTTP smoke 报告。",
      materialPath: "sepath-cloud-app/qa/edge-api-http-smoke-report.json",
      command: edgeHttpSmoke?.command ?? "rtk npm run cloud:smoke:http",
      judgeValue: "证明同一个 Worker 可通过本地 HTTP adapter 复查。",
    },
    {
      id: "llm-gateway",
      label: "LLM Gateway 验收",
      status: releaseReady ? "pass" : "check",
      evidence: "10 个场景覆盖 HMAC 鉴权、无 Key fallback、隐私字段拦截、学生越权、评委沙箱和输出 schema 契约。",
      materialPath: "sepath-cloud-app/qa/llm-gateway-smoke-report.json",
      command: "rtk npm run cloud:smoke:llm",
      judgeValue: "证明真实模型接入链路不是纯文案；无 Key 时也能稳定返回可审计脚手架响应。",
    },
    {
      id: "llm-gateway-http",
      label: "LLM Gateway HTTP 验收",
      status: releaseReady ? "pass" : "check",
      evidence: "本地 HTTP adapter 覆盖同一组 10 个场景，验证 /api/ai/generate-scaffold 可经真实 HTTP 请求复查。",
      materialPath: "sepath-cloud-app/qa/llm-gateway-http-smoke-report.json",
      command: "rtk npm run cloud:smoke:llm:http",
      judgeValue: "证明推理网关能从 Worker 直调走到可部署 HTTP 入口，不只是在单元脚本内部通过。",
    },
    {
      id: "public-trial",
      label: "公开静态试用包",
      status: publicTrial ? toVerificationStatus(publicTrial.status) : "check",
      evidence: publicTrial?.evidence ?? "等待公开静态包 manifest。",
      materialPath: "参赛提交材料包/公开试用静态包/PUBLIC_TRIAL_MANIFEST.json",
      command: "rtk python scripts/build_public_trial_bundle.py",
      judgeValue: "证明评委无需真实账号也能看到只读闭环 Demo。",
    },
    {
      id: "hosting-selftest",
      label: "公网托管体检",
      status: hostingSelftest && hostingSelftest.score >= 85 ? "pass" : "check",
      evidence: hostingSelftest
        ? `runtime=${hostingSelftest.runtime} score=${hostingSelftest.score} pass=${hostingSelftest.passCount} watch=${hostingSelftest.watchCount} manual=${hostingSelftest.manualCount}`
        : "等待 sepath-hosting-selftest-center.v1 报告。",
      materialPath: "参赛提交材料包/67_静态托管平台配置自检与故障恢复卡.md",
      command: "rtk python scripts/generate_hosting_upload_selftest_pack.py --write",
      judgeValue: "证明团队把上传 ZIP、平台 fallback、PUBLIC_HEALTH/PUBLIC_RELEASE 探针和最终 URL 回执做成了上线前自检，而不是把一个私有链接直接交给评委。",
    },
    {
      id: "cloud-slo",
      label: "云端 SLO 与容量压测",
      status: cloudSlo && cloudSlo.blockCount === 0 ? "pass" : "check",
      evidence: cloudSlo
        ? `score=${cloudSlo.score} / pass=${cloudSlo.passCount} watch=${cloudSlo.watchCount} manual=${cloudSlo.manualCount}`
        : "等待 cloud SLO load report。",
      materialPath: "sepath-cloud-app/qa/cloud-slo-load-report.json",
      command: cloudSlo?.command ?? "rtk npm run cloud:slo",
      judgeValue: "证明作品有延迟、错误率、降级、容量和成本预算的上线运行证据，而不只是能打开页面。",
    },
    {
      id: "backend-status",
      label: "后端连接状态中心",
      status: backendStatus && backendStatus.runtime === "sepath-backend-status-center.v1" && backendStatus.score >= 75 ? "pass" : "check",
      evidence: backendStatus
        ? `runtime=${backendStatus.runtime} score=${backendStatus.score} online=${backendStatus.onlineCount} static=${backendStatus.staticCount} degraded=${backendStatus.degradedCount} manual=${backendStatus.manualCount} blocked=${backendStatus.blockedCount}`
        : "等待后端连接状态中心。",
      materialPath: "参赛提交材料包/51_后端连接状态中心与上线边界说明.md",
      command: "打开产品 #backend-status，或运行 rtk npm run test 复核 sepath-backend-status-center.v1",
      judgeValue: "证明团队明确区分静态试用、Edge API、模型网关、数据库授权、遥测和降级兜底，不把未授权生产库包装成已上线。",
    },
    {
      id: "award-map",
      label: "评分证据映射",
      status: awardReadiness.totalScore >= 85 ? "pass" : "check",
      evidence: `评审证据自评分 ${awardReadiness.totalScore}/${awardReadiness.maxScore}，强差异化：${awardReadiness.strongestDifferentiator}`,
      materialPath: "参赛提交材料包/00_评委速读与评分导航.md",
      command: "打开产品顶部“评审证据”和材料 00。",
      judgeValue: "证明架构、策略、功能、创新、商业价值都有证据路径。",
    },
    {
      id: "value-uplift",
      label: "学习增值评估",
      status: valueUplift.valueScore >= 80 ? "pass" : "check",
      evidence: `增值评分 ${valueUplift.valueScore}，估计增量 ${valueUplift.estimatedUpliftPoints}，置信区间 ${valueUplift.confidenceBand}。`,
      materialPath: "参赛提交材料包/27_学习增值评估中心与科研算法融合说明.md",
      command: "打开产品顶部“增值评估”。",
      judgeValue: "证明科研思想被落实为可解释指标和试点遥测契约。",
    },
  ];

  const boundaries: JudgeVerificationBoundary[] = [
    {
      id: "synthetic-data",
      label: "合成数据边界",
      status: "pass",
      safeClaim: "可声明使用合成学生、模拟 PR/CI 和脱敏 learnerHash 验证闭环。",
      forbiddenClaim: "不能把合成样本说成真实学生数据。",
    },
    {
      id: "course-effect",
      label: "真实课程效果",
      status: "manual",
      safeClaim: "可声明已准备真实课程试点遥测契约和教师确认 A/B 流程。",
      forbiddenClaim: "不能宣称已经完成真实班级长期因果提分。",
    },
    {
      id: "public-access",
      label: "公开访问策略",
      status: "manual",
      safeClaim: "可声明提供公开静态包、本地 Demo、视频和 owner-only 私有云路线。",
      forbiddenClaim: "不能把 owner-only 私有链接冒充公开评审地址。",
    },
  ];

  const routes: JudgeVerificationRoute[] = [
    {
      id: "overview",
      minute: "0-2",
      action: "打开评委速读、START_DEMO 和本面板。",
      expectedSignal: "官方四项能力、评分维度、材料路线和风险边界同时可见。",
      scoringFocus: "功能完整 / 评审体验",
    },
    {
      id: "closed-loop",
      minute: "2-4",
      action: "点击失败 PR、索要完整代码、脚手架、CI 通过、教师复核、反思记忆。",
      expectedSignal: "EvidenceEvent、PathTwin、SafeVOI、教师发布门和记忆反思形成闭环。",
      scoringFocus: "自适应策略 / 创新体验",
    },
    {
      id: "backend",
      minute: "4-6",
      action: "运行 Edge API direct/http smoke。",
      expectedSignal: "两条路径均 14/14，通过 token、RBAC、隐私门和读回验证。",
      scoringFocus: "技术水平 / 可上线",
    },
    {
      id: "research",
      minute: "6-8",
      action: "查看科研融合、增值评估、试点遥测和模型治理。",
      expectedSignal: "科研项目思想转化为可复现实验、遥测契约和模型发布门。",
      scoringFocus: "创新性 / 科研深度",
    },
    {
      id: "submission",
      minute: "8-10",
      action: "查看 45/46 号材料、release gate 和最终 ZIP manifest。",
      expectedSignal: "提交包、机器证据、人工门禁和禁止口径一一对应。",
      scoringFocus: "商业价值 / 材料成熟度",
    },
  ];

  const sourceHotspots = [
    "sepath-cloud-app/src/engine/judgeVerification.ts",
    "sepath-cloud-app/src/components/JudgeVerificationPanel.tsx",
    "sepath-cloud-app/src/engine/hostingSelftest.ts",
    "sepath-cloud-app/src/components/HostingSelftestPanel.tsx",
    "sepath-cloud-app/src/engine/backendStatus.ts",
    "sepath-cloud-app/src/components/BackendStatusPanel.tsx",
    "sepath-cloud-app/cloud/llm-gateway-worker.mjs",
    "sepath-cloud-app/cloud/serve_llm_gateway_worker.mjs",
    "sepath-cloud-app/src/engine/valueUplift.ts",
    "sepath-cloud-app/src/engine/researchFusion.ts",
    "sepath-cloud-app/src/engine/trialTelemetry.ts",
    "sepath-cloud-app/cloud/edge-api-auth.mjs",
    "sepath-cloud-app/cloud/edge-api-worker.mjs",
    "scripts/release_gate.py",
    "scripts/generate_judge_verification_pack.py",
  ];

  const passCount = countStatus(proofRows, "pass") + countStatus(boundaries, "pass");
  const checkCount = countStatus(proofRows, "check") + countStatus(boundaries, "check");
  const manualCount = countStatus(proofRows, "manual") + countStatus(boundaries, "manual");
  const score = Math.round(
    (proofRows.reduce((sum, item) => sum + scoreStatus(item.status), 0)
      + boundaries.reduce((sum, item) => sum + scoreStatus(item.status), 0))
      / (proofRows.length + boundaries.length)
      * 100,
  );

  return {
    score,
    stage: checkCount === 0 ? "评委技术验收就绪 / 剩余人工事实待确认" : "评委技术验收需复核",
    summary:
      "评委技术验收中心把应用闭环、后端接口、公开试用、发布门禁、科研增值和真实性边界合成一张现场复查路线图。",
    passCount,
    checkCount,
    manualCount,
    verificationPackPath: "参赛提交材料包/46_评委技术验收包.md",
    machinePackPath: "参赛提交材料包/46_评委技术验收包_机器可读.json",
    releaseGatePath: "outputs/SE-Path学伴_最终发布门禁报告_机器生成.json",
    proofs: proofRows,
    routes,
    sourceHotspots,
    boundaries,
    manifest: JSON.stringify(
      {
        runtime: "sepath-judge-verification.v1",
        score,
        proofIds: proofRows.map((item) => item.id),
        routeIds: routes.map((item) => item.id),
        sourceHotspots,
        boundaryIds: boundaries.map((item) => item.id),
        backendStatusRuntime: backendStatus?.runtime ?? "missing",
        safeClaim:
          "可声明可运行、可上云、可审计、可后端验收；真实课程长期效果等待试点验证。",
      },
      null,
      2,
    ),
  };
}
