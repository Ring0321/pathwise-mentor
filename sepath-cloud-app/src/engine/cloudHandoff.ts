import type { DataPlaneReport } from "./dataPlane";
import type { FinalSubmissionReport } from "./finalSubmission";
import type { JudgeTrialReport } from "./judgeTrial";
import type { LaunchReadinessReport } from "./launchReadiness";
import type { PrivacyGuardReport } from "./privacyGuard";
import type { SubmissionOpsReport } from "./submissionOps";
import type { TenantOpsReport } from "./tenantOps";

export type CloudHandoffStatus = "ready" | "watch" | "manual" | "blocked";
export type CloudHandoffOwner = "team" | "ops" | "organizer" | "reviewer" | "teacher";

export interface CloudHandoffTarget {
  id: string;
  label: string;
  status: CloudHandoffStatus;
  mode: string;
  entry: string;
  evidence: string;
  fallback: string;
  riskControl: string;
}

export interface CloudHandoffProbe {
  id: string;
  label: string;
  status: CloudHandoffStatus;
  signal: string;
  command: string;
  evidence: string;
}

export interface CloudReviewerTask {
  id: string;
  label: string;
  status: CloudHandoffStatus;
  minutes: string;
  entry: string;
  expectedSignal: string;
  scoringPoint: string;
}

export interface CloudFallbackLane {
  id: string;
  label: string;
  status: CloudHandoffStatus;
  trigger: string;
  switchAction: string;
  proof: string;
}

export interface CloudManualGate {
  id: string;
  label: string;
  status: CloudHandoffStatus;
  owner: CloudHandoffOwner;
  whyManual: string;
  acceptance: string;
}

export interface CloudRunbookStep {
  id: string;
  label: string;
  status: CloudHandoffStatus;
  owner: CloudHandoffOwner;
  action: string;
  rollback: string;
}

export interface CloudHandoffReport {
  score: number;
  stage: string;
  accessMode: string;
  summary: string;
  readyCount: number;
  watchCount: number;
  manualCount: number;
  blockedCount: number;
  targets: CloudHandoffTarget[];
  probes: CloudHandoffProbe[];
  reviewerTasks: CloudReviewerTask[];
  fallbackLanes: CloudFallbackLane[];
  manualGates: CloudManualGate[];
  runbook: CloudRunbookStep[];
  cloudUrl: string;
  publicTrialPath: string;
  packagePath: string;
  manifest: string;
}

function countStatus<T extends { status: CloudHandoffStatus }>(items: T[], status: CloudHandoffStatus): number {
  return items.filter((item) => item.status === status).length;
}

function scoreStatus(status: CloudHandoffStatus): number {
  if (status === "ready") return 1;
  if (status === "watch") return 0.72;
  if (status === "manual") return 0.48;
  return 0;
}

function hasManualAccessGate(launchReadiness: LaunchReadinessReport): boolean {
  const accessCheck = launchReadiness.checks.find((item) => item.id === "access-policy");
  return accessCheck?.status === "manual" || launchReadiness.manualGates.join(" ").includes("公开");
}

export function buildCloudHandoffReport(
  launchReadiness: LaunchReadinessReport,
  judgeTrial: JudgeTrialReport,
  tenantOps: TenantOpsReport,
  dataPlane: DataPlaneReport,
  finalSubmission: FinalSubmissionReport,
  privacyGuard: PrivacyGuardReport,
  submissionOps: SubmissionOpsReport,
): CloudHandoffReport {
  const ownerOnly = hasManualAccessGate(launchReadiness);
  const releaseReady = finalSubmission.blockedCount === 0 && submissionOps.blockedCount === 0;
  const packageReady = finalSubmission.uploadRoutes.some((route) => route.id === "single-zip" && route.status === "ready");
  const privateCloudReady = tenantOps.blockedCount === 0 && tenantOps.score >= 80 && dataPlane.score >= 75;
  const privacyReady = privacyGuard.gate === "pass";
  const judgeReady = judgeTrial.blockedCount === 0 && judgeTrial.readyCount >= 3;

  const targets: CloudHandoffTarget[] = [
    {
      id: "public-static-trial",
      label: "公开静态试用包",
      status: packageReady ? "ready" : "watch",
      mode: "无账号 / 可上传任意静态托管",
      entry: "参赛提交材料包/公开试用静态包/index.html",
      evidence: "PUBLIC_TRIAL_MANIFEST.json 已列出入口、资源、隐私边界和包体大小。",
      fallback: "如果评委无法访问云端链接，直接打开静态包或把 public trial 目录上传到托管平台。",
      riskControl: "仅包含合成样本和只读演示，不写入真实学校数据。",
    },
    {
      id: "pwa-offline-trial",
      label: "PWA 离线试用容灾",
      status: "ready",
      mode: "可安装 / Service Worker / 离线兜底",
      entry: "公开试用静态包/manifest.webmanifest + sw.js + offline.html",
      evidence: "公开包包含 Web App Manifest、Service Worker、离线页、PWA 验收报告和评委种子 Manifest。",
      fallback: "浏览器不支持 Service Worker 时，仍保持普通静态包、视频和本地 Demo 三条兜底路线。",
      riskControl: "只缓存静态前端、合成样本和只读 Manifest，不缓存真实账号、模型密钥或学校生产数据。",
    },
    {
      id: "cloud-slo-capacity",
      label: "云端 SLO 容量压测",
      status: "ready",
      mode: "Synthetic Worker load / P95 / error-rate / fallback budget",
      entry: "sepath-cloud-app/qa/cloud-slo-load-report.json",
      evidence: "npm run cloud:slo 覆盖 Edge API、LLM fallback、隐私拦截、P95 延迟、错误率和成本护栏。",
      fallback: "如果容量验证失败，冻结公开试用入口，切换静态包、PWA、视频和本地 Demo，同时修复运行时瓶颈。",
      riskControl: "当前是本地合成 Worker 负载证据，不冒充真实学校生产 SLO；真实上线前再接入云监控和学校授权数据。",
    },
    {
      id: "owner-only-sites",
      label: "OpenAI Sites 历史私有云记录",
      status: ownerOnly ? "watch" : "ready",
      mode: ownerOnly ? "historical owner-only / project recovery required" : "public reviewer URL",
      entry: launchReadiness.cloudUrl,
      evidence: ownerOnly
        ? "历史 Sites version 3 为 owner-only 记录；当前 project_id 返回 project_not_found，不能冒充最新版公开 URL。"
        : "公开 URL 可作为评委首选访问入口。",
      fallback: "访问失败时切换公开静态包、本地 Demo 和 4分40秒视频。",
      riskControl: "不把历史 owner-only 链接或 project_not_found 项目当作公开提交地址，避免评审当天打不开。",
    },
    {
      id: "private-school-cloud",
      label: "学校私有云迁移路线",
      status: privateCloudReady ? "ready" : "watch",
      mode: "Postgres/Supabase + Worker 网关 + RLS",
      entry: "sepath-cloud-app/cloud/",
      evidence: `${tenantOps.cloudMode}；数据平面 ${dataPlane.score} 分，租户运营 ${tenantOps.score} 分。`,
      fallback: "若数据库或身份源暂未开通，保持静态前端 + 合成数据演示。",
      riskControl: "真实名册导入前必须完成授权、退出机制、保留期和 RLS 检查。",
    },
    {
      id: "edge-api-runtime",
      label: "Edge API 后端接口",
      status: "ready",
      mode: "Cloudflare Worker compatible / Node smoke tested",
      entry: "sepath-cloud-app/cloud/edge-api-worker.mjs",
      evidence: "覆盖 evidence、diagnosis、intervention、review、ledger 和 privacy audit 路由，支持写入后读回与角色权限拦截。",
      fallback: "生产数据库未开通时使用可注入 memory-edge-store，真实部署替换为 D1/Postgres/Supabase adapter。",
      riskControl: "内置 HMAC access token、protected-field scan 与 RBAC，拒绝缺失/伪造令牌、rawLog、rawDiff、学生 PII、密钥字段、评委写入和学生跨范围读取。",
    },
    {
      id: "local-engineering-demo",
      label: "本地源码复现",
      status: releaseReady ? "ready" : "watch",
      mode: "源码可运行 / 算法可复查",
      entry: "sepath-cloud-app",
      evidence: "npm run test、npm run build、截图 QA、打包和审计均由 release_gate 串联。",
      fallback: "本地依赖安装失败时用视频、截图 manifest 和终审报告兜底。",
      riskControl: "核心策略为确定性 TypeScript 纯函数，不依赖临场模型随机输出。",
    },
    {
      id: "video-proof",
      label: "离线视频兜底",
      status: "ready",
      mode: "4分40秒 / 1920x1080 / H.264",
      entry: "参赛提交材料包/演示视频素材/SE-Path学伴_4分40秒演示视频素材_v0.3.mp4",
      evidence: "视频、旁白稿、SRT、VTT 和复剪增补旁白均已入包。",
      fallback: "视频播放异常时按 PPT 第 1-21 页和 START_DEMO 镜头路线讲解。",
      riskControl: "旁白稿保留合成数据和真实试点边界，不宣称未验证提分。",
    },
  ];

  const probes: CloudHandoffProbe[] = [
    {
      id: "release-gate",
      label: "一键发布门禁",
      status: releaseReady ? "ready" : "blocked",
      signal: "release_gate=PASS / command_failures=0",
      command: "rtk python scripts/release_gate.py",
      evidence: "串联测试、构建、截图、公开包、审计、打包和云端探针。",
    },
    {
      id: "pwa-offline",
      label: "公开试用 PWA 离线容灾",
      status: "ready",
      signal: "sepath-public-trial-pwa.v1 / installable / offline fallback",
      command: "rtk python scripts/validate_public_trial_pwa.py",
      evidence: "qa/public-trial-pwa-validation.json 记录 manifest、sw.js、offline.html、图标和评委种子保留情况。",
    },
    {
      id: "cloud-slo-load",
      label: "云端 SLO 容量压测",
      status: "ready",
      signal: "sepath-cloud-slo.v1 / totalRequests>=100 / FAIL=0",
      command: "rtk npm run cloud:slo",
      evidence: "qa/cloud-slo-load-report.json 记录 6 类合成负载的 P95、错误率、吞吐、兜底预算和真实边界。",
    },
    {
      id: "zip-integrity",
      label: "提交包完整性",
      status: packageReady ? "ready" : "watch",
      signal: "zipfile.testzip() pass / <100MB / secret_scan_hits=[]",
      command: "rtk python scripts/audit_submission_readiness.py",
      evidence: finalSubmission.packagePath,
    },
    {
      id: "edge-api-smoke",
      label: "Edge API smoke test",
      status: "ready",
      signal: "14 scenarios covered / 0 fail",
      command: "rtk npm run cloud:smoke",
      evidence: "qa/edge-api-smoke-report.json",
    },
    {
      id: "edge-api-http-smoke",
      label: "Edge API HTTP smoke test",
      status: "ready",
      signal: "local HTTP adapter / 14 scenarios covered / 0 fail",
      command: "rtk npm run cloud:smoke:http",
      evidence: "qa/edge-api-http-smoke-report.json",
    },
    {
      id: "visual-overflow",
      label: "桌面与移动端截图 QA",
      status: "ready",
      signal: "docClient == docScroll",
      command: "rtk node scripts/capture_with_dev_server.mjs --preview ...",
      evidence: "关键模块截图均进入 sepath-cloud-app/qa/screenshots/。",
    },
    {
      id: "anonymous-access-policy",
      label: "匿名访问策略",
      status: ownerOnly ? "manual" : "ready",
      signal: ownerOnly ? "当前保持 owner-only" : "公开访问已启用",
      command: "按主办方要求决定是否公开 Sites 或仅提交静态包。",
      evidence: ownerOnly ? "人工项保留，不伪造公开 URL。" : "公开 URL 可写入平台字段。",
    },
    {
      id: "privacy-boundary",
      label: "隐私与密钥边界",
      status: privacyReady ? "ready" : "blocked",
      signal: `privacyGate=${privacyGuard.gate}`,
      command: "检查 20_权限与隐私治理中心说明.md 与 cloud/README_LLM_GATEWAY.md",
      evidence: "前端包不包含真实学生 PII、真实 API Key 或真实数据库地址。",
    },
    {
      id: "judge-route",
      label: "评委访问路线",
      status: judgeReady ? "ready" : "watch",
      signal: `${judgeTrial.readyCount} ready / ${judgeTrial.fallbackCount} fallback / ${judgeTrial.manualCount} manual`,
      command: "打开 28_评委试用与交付控制台说明.md",
      evidence: "公开包、私有云、本地 Demo、视频兜底和源码审计均有路线。",
    },
  ];

  const reviewerTasks: CloudReviewerTask[] = [
    {
      id: "watch-video-first",
      label: "先看 4分40秒视频",
      status: "ready",
      minutes: "5 分钟",
      entry: "演示视频素材/SE-Path学伴_4分40秒演示视频素材_v0.3.mp4",
      expectedSignal: "看到学生对话、拒绝替写、脚手架干预、CI 修复、教师复核和评审证据。",
      scoringPoint: "先让评委确认这不是普通聊天窗口。",
    },
    {
      id: "open-public-package",
      label: "打开公开静态包",
      status: packageReady ? "ready" : "watch",
      minutes: "3 分钟",
      entry: "公开试用静态包/index.html",
      expectedSignal: "能看到产品入口、隐私边界、素材索引和离线兜底说明。",
      scoringPoint: "证明上云失败时仍能试用。",
    },
    {
      id: "inspect-cloud-handoff",
      label: "查看云端交付体检",
      status: "ready",
      minutes: "2 分钟",
      entry: "#cloud",
      expectedSignal: "访问模式、探针、回滚路线和人工门禁在同一面板。",
      scoringPoint: "证明团队知道上线风险，不只会做页面演示。",
    },
    {
      id: "run-local-audit",
      label: "复查本地 release gate",
      status: releaseReady ? "ready" : "watch",
      minutes: "5-8 分钟",
      entry: "scripts/release_gate.py",
      expectedSignal: "PASS / command_failures=0 / FAIL=0。",
      scoringPoint: "用机器证据支撑材料可信度。",
    },
  ];

  const fallbackLanes: CloudFallbackLane[] = [
    {
      id: "cloud-to-static",
      label: "云端打不开",
      status: "ready",
      trigger: "评委无法访问 Sites、网络受限或匿名策略未放开。",
      switchAction: "打开公开静态包或上传 public trial 目录。",
      proof: "PUBLIC_TRIAL_MANIFEST.json + README_公开试用.md。",
    },
    {
      id: "network-to-pwa-cache",
      label: "网络短暂中断",
      status: "ready",
      trigger: "评委已打开过公开包，但现场网络波动、刷新失败或托管平台临时不可达。",
      switchAction: "浏览器回退到 Service Worker 缓存的 index.html 或 offline.html，再按 Manifest/视频继续说明。",
      proof: "manifest.webmanifest + sw.js + offline.html + public-trial-pwa-validation.json。",
    },
    {
      id: "static-to-local",
      label: "静态包需要复查算法",
      status: "ready",
      trigger: "评委希望看源码和算法函数。",
      switchAction: "运行 sepath-cloud-app 的 npm run test / npm run dev。",
      proof: "engine.test.ts 覆盖诊断、SafeVOI、干预发布、云端交付和最终上传。",
    },
    {
      id: "local-to-video",
      label: "现场依赖安装异常",
      status: "ready",
      trigger: "网络或依赖下载慢。",
      switchAction: "切到 4分40秒视频、PPT 和截图 manifest。",
      proof: "演示视频素材、SRT/VTT、PPT v0.2 和 qa/demo-flow manifest。",
    },
    {
      id: "trial-claim-guard",
      label: "真实效果追问",
      status: "manual",
      trigger: "评委追问真实课程提分或 ROI。",
      switchAction: "只回答当前证明产品闭环和验证方案，真实效果需后续授权试点。",
      proof: "05_真实性与边界声明.md + 33_试点遥测与效果验证中心说明.md。",
    },
  ];

  const manualGates: CloudManualGate[] = [
    {
      id: "public-url-policy",
      label: "正式公开 URL 策略",
      status: ownerOnly ? "manual" : "ready",
      owner: "team",
      whyManual: "主办方是否允许公开外链、是否要求只上传文件，需要提交前确认。",
      acceptance: "如果允许公开，则写入公开 URL；如果不允许，则提交静态包、本地 Demo 和视频兜底。",
    },
    {
      id: "team-name-copy",
      label: "队伍名与正式命名副本",
      status: "manual",
      owner: "team",
      whyManual: "报名队伍名和成员信息只能由参赛队确认。",
      acceptance: "运行 prepare_final_named_submission.py 生成队伍名+作品名副本。",
    },
    {
      id: "human-voiceover",
      label: "真人旁白是否补录",
      status: "manual",
      owner: "team",
      whyManual: "当前视频为字幕素材版，可直接提交，也可录真人旁白增强路演表现。",
      acceptance: "若补录，保持 3-5 分钟并同步 SRT/VTT。",
    },
    {
      id: "real-course-claim",
      label: "真实课程效果声明",
      status: "manual",
      owner: "teacher",
      whyManual: "没有授权试点数据前不能宣称真实提分或因果效果。",
      acceptance: "只声明合成验证、产品闭环和后续试点评估协议。",
    },
  ];

  const runbook: CloudRunbookStep[] = [
    {
      id: "freeze-package",
      label: "冻结提交包",
      status: releaseReady ? "ready" : "watch",
      owner: "ops",
      action: "运行 release_gate，记录 ZIP SHA256、文件数和审计摘要。",
      rollback: "失败时回退到上一版 manifest 与 ZIP。",
    },
    {
      id: "choose-access",
      label: "选择访问模式",
      status: ownerOnly ? "manual" : "ready",
      owner: "team",
      action: "在公开 URL、公开静态包、私有云现场演示、本地 Demo 中选择主路线。",
      rollback: "任何在线路线失败时立刻切换静态包或视频。",
    },
    {
      id: "smoke-test",
      label: "上线前烟测",
      status: "ready",
      owner: "ops",
      action: "检查首页、#cloud、#judge-trial、#final-submission、移动端无横向溢出。",
      rollback: "若截图异常，保持本地/视频兜底，不临时公开故障链接。",
    },
    {
      id: "answer-boundary",
      label: "答辩边界口径",
      status: "ready",
      owner: "reviewer",
      action: "准备“当前证明什么、不证明什么、下一步怎么试点”的 30 秒回答。",
      rollback: "遇到真实效果追问时回到 05/33 号材料。",
    },
  ];

  const allStatuses = [...targets, ...probes, ...reviewerTasks, ...fallbackLanes, ...manualGates, ...runbook].map(
    (item) => item.status,
  );
  const readyCount = allStatuses.filter((status) => status === "ready").length;
  const watchCount = allStatuses.filter((status) => status === "watch").length;
  const manualCount = allStatuses.filter((status) => status === "manual").length;
  const blockedCount = allStatuses.filter((status) => status === "blocked").length;
  const score = Math.round((allStatuses.reduce((sum, status) => sum + scoreStatus(status), 0) / allStatuses.length) * 100);

  const accessMode = ownerOnly ? "公开静态包优先 / 私有云现场演示 / 本地与视频兜底" : "公开云端 URL 优先 / 静态包兜底";

  return {
    score,
    stage: blockedCount > 0 ? "云端交付阻断待修复" : manualCount > 0 ? "可提交 / 访问策略待人工确认" : "公开云端试用就绪",
    accessMode,
    summary:
      "云端交付体检把评委访问、公开静态包、私有云预览、本地源码复现、视频兜底、健康探针和真实性边界合成一张上线作战图。",
    readyCount,
    watchCount,
    manualCount,
    blockedCount,
    targets,
    probes,
    reviewerTasks,
    fallbackLanes,
    manualGates,
    runbook,
    cloudUrl: launchReadiness.cloudUrl,
    publicTrialPath: "参赛提交材料包/公开试用静态包/index.html",
    packagePath: finalSubmission.packagePath,
    manifest: JSON.stringify(
      {
        manifest: "sepath-cloud-handoff.v1",
        accessMode,
        cloudUrl: launchReadiness.cloudUrl,
        publicTrialPath: "参赛提交材料包/公开试用静态包/index.html",
        packagePath: finalSubmission.packagePath,
        releaseGate: {
          blockedCount,
          manualCount,
          privacyGate: privacyGuard.gate,
          submissionBlockedCount: submissionOps.blockedCount,
          finalSubmissionBlockedCount: finalSubmission.blockedCount,
        },
        proof: {
          noRealStudentData: true,
        noBrowserSecrets: true,
        deterministicCore: true,
        edgeApiSmokeTested: true,
        edgeApiHttpSmokeTested: true,
        edgeApiRbacTested: true,
        edgeApiAuthTokenTested: true,
        offlineFallback: true,
        pwaOfflineTrial: true,
        cloudSloTested: true,
        cloudSloReport: "sepath-cloud-app/qa/cloud-slo-load-report.json",
        webAppManifest: "manifest.webmanifest",
        serviceWorker: "sw.js",
        offlinePage: "offline.html",
        pwaValidation: "sepath-cloud-app/qa/public-trial-pwa-validation.json",
        publicUrlRequiresManualPolicy: ownerOnly,
      },
        targetIds: targets.map((target) => target.id),
        probeIds: probes.map((probe) => probe.id),
      },
      null,
      2,
    ),
  };
}
