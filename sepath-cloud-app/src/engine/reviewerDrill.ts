import type { BackendStatusReport } from "./backendStatus";
import type { CloudHandoffReport } from "./cloudHandoff";
import type { CloudSloReport } from "./cloudSlo";
import type { JudgeTrialReport } from "./judgeTrial";
import type { JudgeVerificationReport } from "./judgeVerification";
import type { TeacherReport } from "./teacherReport";

export type ReviewerDrillStatus = "ready" | "fallback" | "manual" | "blocked";

export interface ReviewerPersona {
  id: string;
  label: string;
  role: string;
  entry: string;
  credentialPolicy: string;
  successSignal: string;
  status: ReviewerDrillStatus;
}

export interface ReviewerMinuteStep {
  id: string;
  minute: string;
  seconds: number;
  label: string;
  action: string;
  expectedSignal: string;
  productAnchor: string;
  materialAnchor: string;
  evidence: string;
  status: ReviewerDrillStatus;
}

export interface ReviewerCheckpoint {
  id: string;
  label: string;
  command: string;
  evidence: string;
  status: ReviewerDrillStatus;
}

export interface ReviewerScoringMap {
  id: string;
  criterion: string;
  scoreWeight: string;
  judgeQuestion: string;
  productProof: string;
  materialProof: string;
}

export interface ReviewerRecoveryLane {
  id: string;
  trigger: string;
  switchTo: string;
  proof: string;
  status: ReviewerDrillStatus;
}

export interface ReviewerDrillReport {
  runtime: string;
  score: number;
  stage: string;
  durationSeconds: number;
  summary: string;
  readyCount: number;
  fallbackCount: number;
  manualCount: number;
  blockedCount: number;
  personas: ReviewerPersona[];
  steps: ReviewerMinuteStep[];
  checkpoints: ReviewerCheckpoint[];
  scoringMap: ReviewerScoringMap[];
  recoveryLanes: ReviewerRecoveryLane[];
  reportPath: string;
  command: string;
  truthBoundary: string;
  manifest: string;
}

export interface ReviewerGuideStep extends ReviewerMinuteStep {
  stepNumber: number;
  progressPercent: number;
  navLabel: string;
  quickAction: string;
}

export interface ReviewerGuideQuickStep extends ReviewerGuideStep {
  sourceStepId: string;
}

export interface ReviewerGuideAction {
  id: string;
  label: string;
  action: string;
  status: ReviewerDrillStatus;
}

export interface ReviewerGuideReport {
  runtime: string;
  modeLabel: string;
  totalSteps: number;
  totalSeconds: number;
  quickTotalSeconds: number;
  firstAnchor: string;
  currentStepId: string;
  keyboardShortcuts: string[];
  steps: ReviewerGuideStep[];
  quickSteps: ReviewerGuideQuickStep[];
  actions: ReviewerGuideAction[];
  manifest: string;
}

function countStatus<T extends { status: ReviewerDrillStatus }>(items: T[], status: ReviewerDrillStatus): number {
  return items.filter((item) => item.status === status).length;
}

function scoreStatus(status: ReviewerDrillStatus): number {
  if (status === "ready") return 1;
  if (status === "fallback") return 0.76;
  if (status === "manual") return 0.5;
  return 0;
}

export function buildReviewerDrillReport(
  judgeTrial: JudgeTrialReport,
  teacherReport: TeacherReport,
  cloudHandoff: CloudHandoffReport,
  cloudSlo: CloudSloReport,
  judgeVerification: JudgeVerificationReport,
  backendStatus?: BackendStatusReport,
): ReviewerDrillReport {
  const publicStaticReady = judgeTrial.routes.some((route) => route.id === "public-static-package" && route.status === "ready");
  const closedLoopReady = judgeTrial.trialTasks.some((task) => task.id === "one-click-loop" && task.status === "ready");
  const teacherReady = teacherReport.actionPlan.some((item) => item.id === "teacher-review" && item.status === "ready");
  const cloudReady = cloudHandoff.blockedCount === 0 && cloudHandoff.score >= 80;
  const sloReady = cloudSlo.score >= 90 && cloudSlo.blockCount === 0;
  const verificationReady = judgeVerification.checkCount === 0 && judgeVerification.score >= 80;
  const backendReady = !!backendStatus && backendStatus.runtime === "sepath-backend-status-center.v1" && backendStatus.score >= 75;

  const personas: ReviewerPersona[] = [
    {
      id: "reviewer-demo",
      label: "评委只读视角",
      role: "reviewer",
      entry: "公开试用静态包/index.html 或本地 npm run dev",
      credentialPolicy: "提交包不放真实密码；评委使用只读合成种子和现场角色切换。",
      successSignal: "无需真实学校账号即可看完学生闭环、教师复核、云交付和技术验收。",
      status: publicStaticReady ? "ready" : "fallback",
    },
    {
      id: "teacher-reviewer",
      label: "教师复核视角",
      role: "teacher",
      entry: "#teacher-report / #teacher / #intervention-playbook",
      credentialPolicy: "教师复核仅用于合成演示；真实试点前需要学校授权和复核人名单。",
      successSignal: "能看到 AI 建议进入人工发布门、周报行动项和不替写作业护栏。",
      status: teacherReady ? "ready" : "fallback",
    },
    {
      id: "ops-auditor",
      label: "运维审计视角",
      role: "ops",
      entry: "#cloud / #cloud-slo / #backend-status / #judge-verification",
      credentialPolicy: "只检查 manifest、报告和本地脚本，不需要生产密钥。",
      successSignal: "能复核 release gate、PWA、SLO、后端连接状态、ZIP、OpenAPI 和 smoke report。",
      status: cloudReady && sloReady && backendReady && verificationReady ? "ready" : "fallback",
    },
    {
      id: "student-shadow",
      label: "学生影子视角",
      role: "student",
      entry: "#student / #dialogue / #knowledge",
      credentialPolicy: "使用合成学生画像和 EvidenceEvent，不接真实学生 PII。",
      successSignal: "直接索要完整答案会被改写为脚手架、检查清单和教师复核。",
      status: "ready",
    },
  ];

  const steps: ReviewerMinuteStep[] = [
    {
      id: "open-trial",
      minute: "00:00-00:35",
      seconds: 35,
      label: "打开可试用入口",
      action: "打开公开静态包或本地 Demo，确认页面可用、PWA 离线说明和评委种子包入口存在。",
      expectedSignal: "顶部导航、学生闭环按钮、公开试用 Manifest 和评委路线可见。",
      productAnchor: "#student",
      materialAnchor: "START_DEMO.md",
      evidence: "PUBLIC_TRIAL_MANIFEST.json + JUDGE_DEMO_SEED_MANIFEST.json",
      status: publicStaticReady ? "ready" : "fallback",
    },
    {
      id: "run-loop",
      minute: "00:35-01:15",
      seconds: 40,
      label: "跑完学生闭环",
      action: "连续点击主按钮，触发失败 PR、直接答案请求、脚手架干预、CI 通过、教师复核和反思记忆。",
      expectedSignal: "EvidenceEvent 数量增长，路径节点从 blocked 走向 completed。",
      productAnchor: "#student",
      materialAnchor: "00_评委速读与评分导航.md",
      evidence: "ci_failed / scaffold_recommended / ci_passed / teacher_reviewed / reflection_submitted",
      status: closedLoopReady ? "ready" : "fallback",
    },
    {
      id: "inspect-teacher-gate",
      minute: "01:15-01:50",
      seconds: 35,
      label: "查看教师复核发布门",
      action: "切到教师周报、干预发布和教师复核台，检查高风险建议是否需要教师批准或退回。",
      expectedSignal: "教师行动计划、AI 使用边界、复核工单和不替写护栏同时出现。",
      productAnchor: "#teacher-report",
      materialAnchor: "24_教师周报与试点复盘中心说明.md",
      evidence: "TeacherReport + InterventionPlaybook + ReviewTicket",
      status: teacherReady ? "ready" : "fallback",
    },
    {
      id: "inspect-algorithm",
      minute: "01:50-02:30",
      seconds: 40,
      label: "核对算法创新",
      action: "查看策略实验、增值评估、科研融合和知识边界，确认不是普通聊天框。",
      expectedSignal: "PathTwin、SafeVOI、Rubric 校准、GraphRAG 边界和增值估计有独立证据。",
      productAnchor: "#value",
      materialAnchor: "27_学习增值评估中心与科研算法融合说明.md",
      evidence: "strategyLab + valueUplift + researchFusion + knowledgeBoundary",
      status: "ready",
    },
    {
      id: "inspect-cloud",
      minute: "02:30-02:55",
      seconds: 25,
      label: "检查上云与 SLO",
      action: "查看云交付、SLO 容量压测、数据平面和 API 契约，确认它具备上线骨架。",
      expectedSignal: "能看到 P95、错误率、PWA 兜底、Edge API、OpenAPI、隐私门禁和真实边界。",
      productAnchor: "#cloud-slo",
      materialAnchor: "49_云端SLO容量压测与成本预算说明.md",
      evidence: "cloud-slo-load-report.json + edge-api-smoke-report.json",
      status: cloudReady && sloReady ? "ready" : "fallback",
    },
    {
      id: "inspect-public-url-receipt",
      minute: "02:55-03:15",
      seconds: 20,
      label: "核对公网 URL 回执",
      action: "切到公网 URL 回执验收台，确认候选 HTTPS 地址、health/release 探针、平台粘贴块、回执 JSON 和复跑门禁命令已经串联。",
      expectedSignal: "评委能看到公网 URL 仍需机器回执，不会把 owner-only、localhost 或历史 Sites 链接误写成公开地址。",
      productAnchor: "#public-url-receipt",
      materialAnchor: "70_公网部署实操包与回执封存说明.md",
      evidence: "sepath-public-url-receipt-console.v1 + final_public_url_receipt.json",
      status: publicStaticReady ? "ready" : "manual",
    },
    {
      id: "inspect-submission-closure",
      minute: "03:15-03:35",
      seconds: 20,
      label: "检查正式提交收口",
      action: "切到正式提交收口总控，确认公网回执、平台文案、团队画像、命名副本、release gate 和一致性验证被排成可执行闭环。",
      expectedSignal: "能看到剩余人工门、下一步命令、平台粘贴块和 71 号材料入口，避免提交日前漏项。",
      productAnchor: "#submission-closure",
      materialAnchor: "71_公网URL回填后的正式提交收口说明.md",
      evidence: "sepath-submission-closure-console.v1 + finalize_submission_after_public_url.py",
      status: publicStaticReady ? "manual" : "fallback",
    },
    {
      id: "inspect-backend-status",
      minute: "03:35-03:55",
      seconds: 20,
      label: "核对后端连接状态",
      action: "查看后端连接状态中心，确认静态试用、Edge API、LLM Gateway、数据库授权、种子数据、遥测和降级模式被区分。",
      expectedSignal: "能看到 online/static/degraded/manual/blocked 五类状态，以及每条链路的证据、命令和失败切换。",
      productAnchor: "#backend-status",
      materialAnchor: "51_后端连接状态中心与上线边界说明.md",
      evidence: "sepath-backend-status-center.v1",
      status: backendReady ? "ready" : "fallback",
    },
    {
      id: "inspect-verification",
      minute: "03:55-04:25",
      seconds: 30,
      label: "打开技术验收包",
      action: "切到技术验收面板，确认评委要看的命令、报告、源码热点和安全边界被串成一张证据表。",
      expectedSignal: "release gate、终审、OpenAPI、LLM Gateway、SLO、PWA、种子包全部有路径。",
      productAnchor: "#judge-verification",
      materialAnchor: "46_评委技术验收包.md",
      evidence: "sepath-judge-verification.v1",
      status: verificationReady ? "ready" : "fallback",
    },
    {
      id: "inspect-claim-ledger",
      minute: "04:25-04:40",
      seconds: 15,
      label: "核验主张证据账本",
      action: "打开主张账本，逐条核对参赛亮点、声明等级、证据路径、禁止表述和产品锚点是否一致。",
      expectedSignal: "每条主张都有 L0-L3 等级、材料证据、源码证据、禁用口径和真实性边界。",
      productAnchor: "#claim-ledger",
      materialAnchor: "62_主张证据账本与真实性核验包.md",
      evidence: "sepath-claim-evidence-ledger.v1 + forbidden_claim_crosscheck",
      status: "ready",
    },
    {
      id: "answer-boundary",
      minute: "04:40-05:00",
      seconds: 20,
      label: "收口真实性边界",
      action: "最后打开提交日人工确认卡，说明哪些已机器验证，哪些必须等正式报名或真实试点。",
      expectedSignal: "队伍信息、公开访问、真人旁白和真实提分声明仍被保留为人工项。",
      productAnchor: "#launch-loop",
      materialAnchor: "45_提交日人工确认决策卡.md",
      evidence: "自动审计 0 FAIL / 5 MANUAL",
      status: "manual",
    },
  ];

  const checkpoints: ReviewerCheckpoint[] = [
    {
      id: "reviewer-drill",
      label: "评委演练包自检",
      command: "rtk npm run cloud:reviewer-drill",
      evidence: "qa/reviewer-drill-report.json",
      status: "ready",
    },
    {
      id: "release-gate",
      label: "最终发布门禁",
      command: "rtk python scripts/release_gate.py",
      evidence: "outputs/SE-Path学伴_最终发布门禁报告_机器生成.json",
      status: verificationReady ? "ready" : "fallback",
    },
    {
      id: "teacher-export",
      label: "教师周报导出",
      command: "产品内下载 sepath-teacher-weekly-report.md",
      evidence: teacherReport.exportFileName,
      status: teacherReport.score >= 80 ? "ready" : "fallback",
    },
    {
      id: "slo-evidence",
      label: "云端 SLO 证据",
      command: cloudSlo.command,
      evidence: cloudSlo.reportPath,
      status: sloReady ? "ready" : "fallback",
    },
  ];

  const scoringMap: ReviewerScoringMap[] = [
    {
      id: "architecture",
      criterion: "智能体架构设计",
      scoreWeight: "30 分",
      judgeQuestion: "这是否合理使用 Agent 的规划、记忆、工具和人工发布门？",
      productProof: "AI 运行时、推理网关、知识边界、教师复核、API 契约和技术验收在同一演练路线中串联。",
      materialProof: "29_AI Agent运行时与模型接入中心说明.md + 46_评委技术验收包.md",
    },
    {
      id: "adaptive",
      criterion: "自适应策略",
      scoreWeight: "25 分",
      judgeQuestion: "学习路径是否根据画像、证据和反馈动态调整？",
      productProof: "失败 PR 后触发诊断、SafeVOI 排序、脚手架、教师复核和反思记忆。",
      materialProof: "13_算法验证与科研证据说明.md + 27_学习增值评估中心与科研算法融合说明.md",
    },
    {
      id: "complete-loop",
      criterion: "功能完整程度",
      scoreWeight: "20 分",
      judgeQuestion: "是否覆盖诊断、规划、干预、复核、记忆和上云交付？",
      productProof: "5 分钟演练把学生闭环、教师复核、云交付、SLO 和发布门禁一次跑完。",
      materialProof: "START_DEMO.md + 50_评委5分钟实操演练与教师复核深潜说明.md",
    },
    {
      id: "innovation-experience",
      criterion: "创新性与体验",
      scoreWeight: "15 分",
      judgeQuestion: "评委是否能快速看出它不是普通答疑助手？",
      productProof: "演练明确展示证据原生、路径数字孪生、增值估计、人工发布门和真实性边界。",
      materialProof: "00_评委速读与评分导航.md + 36_科研算法融合与开源证据中台说明.md",
    },
    {
      id: "commercial",
      criterion: "商业价值",
      scoreWeight: "10 分",
      judgeQuestion: "是否具备真实课程、学校私有云和可运营试点路径？",
      productProof: "开班向导、账号初始化、数据平面、PWA、SLO 和多租户运营均有证据入口。",
      materialProof: "34_多租户上云运营中心说明.md + 39_生产数据平面与部署运维中心说明.md",
    },
  ];

  const recoveryLanes: ReviewerRecoveryLane[] = [
    {
      id: "network-fail",
      trigger: "现场网络不稳定或云端私有链接打不开",
      switchTo: "公开静态包、PWA 离线页或 4分40秒视频",
      proof: "PUBLIC_TRIAL_MANIFEST.json + public-trial-pwa-validation.json",
      status: "ready",
    },
    {
      id: "runtime-fail",
      trigger: "本地依赖安装慢或开发服务器启动失败",
      switchTo: "技术验收包、截图 manifest、视频和最终 release gate JSON",
      proof: "46_评委技术验收包.md + outputs release gate",
      status: "ready",
    },
    {
      id: "effect-question",
      trigger: "评委追问真实课程提分或长期因果效果",
      switchTo: "真实性边界和试点遥测协议",
      proof: "05_真实性与边界声明.md + 33_试点遥测与效果验证中心说明.md",
      status: "manual",
    },
  ];

  const allStatuses = [...personas, ...steps, ...checkpoints, ...recoveryLanes].map((item) => item.status);
  const statusItems = [...personas, ...steps, ...checkpoints, ...recoveryLanes];
  const readyCount = countStatus(statusItems, "ready");
  const fallbackCount = countStatus(statusItems, "fallback");
  const manualCount = countStatus(statusItems, "manual");
  const blockedCount = countStatus(statusItems, "blocked");
  const score = Math.round((allStatuses.reduce((sum, status) => sum + scoreStatus(status), 0) / allStatuses.length) * 100);
  const durationSeconds = steps.reduce((sum, step) => sum + step.seconds, 0);
  const runtime = "sepath-reviewer-drill.v1";
  const truthBoundary = "The drill uses synthetic reviewer personas and demo evidence only; it does not claim real course causal gains.";

  return {
    runtime,
    score,
    stage: blockedCount > 0 ? "演练阻断待修复" : "5 分钟评委演练可执行",
    durationSeconds,
    summary:
      "评委演练中心把可试用入口、学生闭环、教师复核、算法创新、云端 SLO、技术验收、主张账本和真实性边界压缩成一条 5 分钟路线，帮助评委快速看到产品可用性和工程可信度。",
    readyCount,
    fallbackCount,
    manualCount,
    blockedCount,
    personas,
    steps,
    checkpoints,
    scoringMap,
    recoveryLanes,
    reportPath: "sepath-cloud-app/qa/reviewer-drill-report.json",
    command: "rtk npm run cloud:reviewer-drill",
    truthBoundary,
    manifest: JSON.stringify(
      {
        runtime,
        durationSeconds,
        reportPath: "sepath-cloud-app/qa/reviewer-drill-report.json",
        screenshot: "sepath-cloud-app/qa/screenshots/reviewer-drill-panel.png",
        requiredAnchors: steps.map((step) => step.productAnchor),
        material: "参赛提交材料包/50_评委5分钟实操演练与教师复核深潜说明.md",
        launchLoopMaterial: "参赛提交材料包/56_上线级闭环验收剧本.md",
        truthBoundary,
      },
      null,
      2,
    ),
  };
}

export function buildReviewerGuideReport(report: ReviewerDrillReport): ReviewerGuideReport {
  const runtime = "sepath-reviewer-guide.v1";
  const steps: ReviewerGuideStep[] = report.steps.map((step, index) => ({
    ...step,
    stepNumber: index + 1,
    progressPercent: Math.round(((index + 1) / report.steps.length) * 100),
    navLabel: `${index + 1}. ${step.label}`,
    quickAction:
      index === 0
        ? "先确认页面可打开，再看顶部指标和主按钮。"
        : index === report.steps.length - 1
          ? "最后收口真实性边界，不夸大真实提分。"
          : "跟随导览条点击下一步，检查当前模块的成功信号。",
  }));
  const quickPlan = [
    {
      id: "open-trial",
      minute: "00-08s",
      seconds: 8,
      label: "定位：不是聊天框，是证据工单",
      action: "先指向失败 PR、high 风险、证据覆盖和闭环阶段，让评委明白系统从真实开发证据出发。",
      expectedSignal: "首屏能看到学生工单、风险、证据覆盖、闭环进度和主按钮。",
      quickAction: "一句话：先读证据，再决定是否干预。",
    },
    {
      id: "run-loop",
      minute: "08-24s",
      seconds: 16,
      label: "演示：一键跑通六步闭环",
      action: "点击跑完整闭环，把 CI 失败转成诊断、门禁、脚手架、验证、教师复核和反思记忆。",
      expectedSignal: "闭环进度到 100%，出现验收结果和可导出的证据账本。",
      quickAction: "在本步点击“跑完整闭环”。",
    },
    {
      id: "inspect-teacher-gate",
      minute: "24-34s",
      seconds: 10,
      label: "边界：AI 给脚手架，教师管发布",
      action: "说明高风险建议必须经过教师复核；系统不替学生写完整代码、不绕过课程权限。",
      expectedSignal: "教师复核、发布门禁和不替写护栏被同时展示。",
      quickAction: "强调安全边界比花哨回答更重要。",
    },
    {
      id: "inspect-algorithm",
      minute: "34-45s",
      seconds: 11,
      label: "创新：路径数字学生 + SafeVOI",
      action: "把 PathTwin、SafeVOI、Rubric 校准和增值评估连在一起，说明它是路径决策系统。",
      expectedSignal: "评委能看到策略、路径、增值和知识边界都有独立证据。",
      quickAction: "用“为什么先做这一步”解释算法价值。",
    },
    {
      id: "inspect-cloud",
      minute: "45-54s",
      seconds: 9,
      label: "上线：有 SLO、API 和导出账本",
      action: "展示云交付、SLO、API 契约和证据账本，说明它不是静态页面，而是可验收产品骨架。",
      expectedSignal: "SLO、OpenAPI、PWA 兜底和导出证据能够互相对上。",
      quickAction: "把工程可信度说成可复查证据。",
    },
    {
      id: "answer-boundary",
      minute: "54-60s",
      seconds: 6,
      label: "收口：哪些已验证，哪些待试点",
      action: "最后回到真实性边界，说明当前是合成演示和上线骨架，不夸大真实课程提分。",
      expectedSignal: "评委能看到人工确认项和真实试点边界。",
      quickAction: "用边界收尾，显得可信。",
    },
  ];
  const stepsById = new Map(steps.map((step) => [step.id, step]));
  const quickTotalSeconds = quickPlan.reduce((sum, step) => sum + step.seconds, 0);
  const quickSteps: ReviewerGuideQuickStep[] = quickPlan
    .map((item, index) => {
      const source = stepsById.get(item.id);
      if (!source) return null;
      return {
        ...source,
        id: `quick-${item.id}`,
        sourceStepId: source.id,
        minute: item.minute,
        seconds: item.seconds,
        label: item.label,
        action: item.action,
        expectedSignal: item.expectedSignal,
        stepNumber: index + 1,
        progressPercent: Math.round(((index + 1) / quickPlan.length) * 100),
        navLabel: `${index + 1}. ${item.label}`,
        quickAction: item.quickAction,
      };
    })
    .filter((step): step is ReviewerGuideQuickStep => Boolean(step));
  const actions: ReviewerGuideAction[] = [
    {
      id: "start",
      label: "一键启动",
      action: "点击顶部或首屏的一键评委导览按钮，页面自动定位到第一步。",
      status: steps.length > 0 ? "ready" : "blocked",
    },
    {
      id: "step-through",
      label: "逐步复核",
      action: "使用上一步、下一步和步骤圆点跳转，按评分路线查看每个产品锚点。",
      status: "ready",
    },
    {
      id: "close",
      label: "随时退出",
      action: "点击结束导览，回到普通产品浏览模式，不改变证据账本和学习状态。",
      status: "ready",
    },
  ];

  return {
    runtime,
    modeLabel: "评委一键导览模式",
    totalSteps: steps.length,
    totalSeconds: report.durationSeconds,
    quickTotalSeconds,
    firstAnchor: steps[0]?.productAnchor ?? "#student",
    currentStepId: quickSteps[0]?.id ?? steps[0]?.id ?? "missing",
    keyboardShortcuts: ["下一步", "上一步", "结束导览"],
    steps,
    quickSteps,
    actions,
    manifest: JSON.stringify(
      {
        runtime,
        sourceRuntime: report.runtime,
        totalSteps: steps.length,
        totalSeconds: report.durationSeconds,
        quickTotalSeconds,
        quickSteps: quickSteps.map((step) => ({
          id: step.id,
          sourceStepId: step.sourceStepId,
          minute: step.minute,
          anchor: step.productAnchor,
        })),
        autoScrollAnchors: steps.map((step) => step.productAnchor),
        evidenceReport: report.reportPath,
        truthBoundary: report.truthBoundary,
      },
      null,
      2,
    ),
  };
}
