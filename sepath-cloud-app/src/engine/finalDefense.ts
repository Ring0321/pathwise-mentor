import type { FinalSubmissionReport } from "./finalSubmission";
import type { JudgeVerificationReport } from "./judgeVerification";
import type { PitchDirectorReport } from "./pitchDirector";

export type FinalDefenseStatus = "ready" | "watch" | "manual" | "blocked";
export type FinalDefenseOwner = "captain" | "algorithm" | "engineering" | "product" | "ops" | "teacher";

export interface FinalDefenseBackendSnapshot {
  runtime: string;
  score: number;
  onlineCount?: number;
  staticCount?: number;
  degradedCount?: number;
  manualCount?: number;
  blockedCount: number;
}

export interface FinalDefenseMetric {
  id: string;
  label: string;
  value: string;
  target: string;
  status: FinalDefenseStatus;
}

export interface FinalDefenseScript {
  id: string;
  label: string;
  durationSeconds: number;
  status: FinalDefenseStatus;
  script: string;
  screenAnchor: string;
  proof: string;
}

export interface FinalDefenseQuestion {
  id: string;
  question: string;
  status: FinalDefenseStatus;
  owner: FinalDefenseOwner;
  shortAnswer: string;
  evidencePath: string;
  demoAnchor: string;
  trap: string;
  recovery: string;
}

export interface FinalDefenseEvidenceRoute {
  id: string;
  label: string;
  status: FinalDefenseStatus;
  productAnchor: string;
  materialPath: string;
  command: string;
  judgeProof: string;
}

export interface FinalDefenseForbiddenLine {
  id: string;
  riskyLine: string;
  safeLine: string;
  source: string;
}

export interface FinalDefenseGate {
  id: string;
  label: string;
  status: FinalDefenseStatus;
  criteria: string;
  evidence: string;
  nextAction: string;
}

export interface FinalDefenseReport {
  runtime: string;
  score: number;
  stage: string;
  summary: string;
  readyCount: number;
  watchCount: number;
  manualCount: number;
  blockedCount: number;
  metrics: FinalDefenseMetric[];
  scripts: FinalDefenseScript[];
  challengeCards: FinalDefenseQuestion[];
  evidenceRoutes: FinalDefenseEvidenceRoute[];
  forbiddenLines: FinalDefenseForbiddenLine[];
  readinessGates: FinalDefenseGate[];
  runbook: string[];
  manifest: string;
}

const statusWeight: Record<FinalDefenseStatus, number> = {
  ready: 1,
  watch: 0.72,
  manual: 0.52,
  blocked: 0,
};

function countStatus<T extends { status: FinalDefenseStatus }>(items: T[], status: FinalDefenseStatus): number {
  return items.filter((item) => item.status === status).length;
}

function scoreItems<T extends { status: FinalDefenseStatus }>(items: T[]) {
  if (!items.length) return 0;
  return Math.round((items.reduce((sum, item) => sum + statusWeight[item.status], 0) / items.length) * 100);
}

function hasProof(report: JudgeVerificationReport, id: string) {
  return report.proofs.some((proof) => proof.id === id && proof.status === "pass");
}

export function buildFinalDefenseReport(
  pitchDirector: PitchDirectorReport,
  finalSubmission: FinalSubmissionReport,
  judgeVerification: JudgeVerificationReport,
  backendStatus?: FinalDefenseBackendSnapshot,
): FinalDefenseReport {
  const pitchReady =
    pitchDirector.durationSeconds >= 180 && pitchDirector.durationSeconds <= 300 && pitchDirector.blockedCount === 0;
  const uploadReady = finalSubmission.score >= 75 && finalSubmission.blockedCount === 0;
  const verificationReady = judgeVerification.score >= 80 && judgeVerification.passCount >= 7;
  const backendReady =
    backendStatus?.runtime === "sepath-backend-status-center.v1"
    && backendStatus.score >= 75
    && backendStatus.blockedCount === 0;
  const backendStatusLabel = backendStatus
    ? `score=${backendStatus.score}; online=${backendStatus.onlineCount ?? 0}; static=${backendStatus.staticCount ?? 0}; degraded=${backendStatus.degradedCount ?? 0}`
    : "static package mode; backend center not bundled in this build";

  const scripts: FinalDefenseScript[] = [
    {
      id: "five-minute-story",
      label: "5分钟主叙事",
      durationSeconds: pitchDirector.durationSeconds,
      status: pitchReady ? "ready" : "watch",
      script:
        "SE-Path学伴用一次失败PR触发诊断，把学生画像、知识边界、SafeVOI路径选择、脚手架干预、教师复核、试点遥测和提交验收串成一个可运行闭环。",
      screenAnchor: "#pitch-director",
      proof: `${pitchDirector.segments.length}段镜头 / ${pitchDirector.durationSeconds}秒 / ${pitchDirector.targetVideoName}`,
    },
    {
      id: "ninety-second-defense",
      label: "90秒压缩版",
      durationSeconds: 90,
      status: verificationReady ? "ready" : "watch",
      script:
        "我们不是做通用答疑，而是做软件工程课程里的证据驱动伴学Agent。核心创新是把代码仓库、CI、对话、反思和教师复核写入证据账本，再用可解释的路径增值函数选择下一步干预。",
      screenAnchor: "#judge-verification",
      proof: `${judgeVerification.passCount}项PASS / ${judgeVerification.verificationPackPath}`,
    },
    {
      id: "thirty-second-elevator",
      label: "30秒电梯版",
      durationSeconds: 30,
      status: uploadReady ? "ready" : "manual",
      script:
        "这是一套面向软件工程项目学习的闭环智能体：学生不拿现成答案，教师拿到可复核证据，学校可以从静态试用包升级到私有云API与数据平面。",
      screenAnchor: "#final-submission",
      proof: `${finalSubmission.packagePath} / ${finalSubmission.finalGateReportPath}`,
    },
  ];

  const challengeCards: FinalDefenseQuestion[] = [
    {
      id: "why-not-chatbot",
      question: "这和一个会聊天的AI助教有什么本质区别？",
      status: "ready",
      owner: "captain",
      shortAnswer:
        "聊天只是入口，决策不交给自由生成。系统用证据账本、Rubric约束、SafeVOI策略、教师复核和发布门禁决定下一步学习行动。",
      evidencePath: "参赛提交材料包/27_学习增值评估中心与科研算法融合说明.md",
      demoAnchor: "#value",
      trap: "不要把大模型输出本身说成教学策略。",
      recovery: "强调LLM只负责解释和脚手架表达，路径决策由可审计策略层完成。",
    },
    {
      id: "adaptive-proof",
      question: "个性化路径怎么证明不是手写规则演示？",
      status: hasProof(judgeVerification, "value-uplift") ? "ready" : "watch",
      owner: "algorithm",
      shortAnswer:
        "每次路径调整都绑定到EvidenceEvent、能力增量、风险拦截和教师工作量估计；评委可以看对照策略、消融指标和试点遥测契约。",
      evidencePath: "参赛提交材料包/17_策略实验室与SafeVOI对照仿真说明.md",
      demoAnchor: "#strategy",
      trap: "不要宣称已经在真实学校完成长期因果提分。",
      recovery: "说清当前证据是合成回放和可复核实验契约，真实试点需教师确认A/B。",
    },
    {
      id: "backend-boundary",
      question: "如果现场没有模型Key或后端授权，还能完整演示吗？",
      status: backendReady ? "ready" : "watch",
      owner: "engineering",
      shortAnswer:
        "可以。公开静态包、PWA离线包、本地HTTP适配器和确定性fallback能兜底；后端状态中心明确标出Edge API、LLM网关、数据平面和授权边界。",
      evidencePath: "参赛提交材料包/51_后端连接状态中心与上线边界说明.md",
      demoAnchor: backendStatus ? "#backend-status" : "#cloud-slo",
      trap: "不要把owner-only私有链接说成匿名公开生产地址。",
      recovery: "切到MP4、公开静态包、release gate报告和本地Demo四条兜底线。",
    },
    {
      id: "privacy-and-rbac",
      question: "真实学生数据、权限和隐私怎么控？",
      status: "ready",
      owner: "ops",
      shortAnswer:
        "参赛包只含合成身份与脱敏learnerHash；真实学校接入前需要租户隔离、RLS、RBAC、无浏览器密钥、教师复核和数据授权门禁。",
      evidencePath: "参赛提交材料包/20_权限与隐私治理中心说明.md",
      demoAnchor: "#privacy",
      trap: "不要展示或承诺任何真实学生账号密码。",
      recovery: "把问题落到角色权限矩阵、种子数据包和数据平面DDL。",
    },
    {
      id: "commercialization",
      question: "它如何从比赛Demo变成学校可买可用的产品？",
      status: uploadReady ? "ready" : "watch",
      owner: "product",
      shortAnswer:
        "产品已拆成课程开班向导、班级GrowthOps、教师周报、租户初始化、SLO容量、提交验收和数据平面，能按课程试点逐步交付。",
      evidencePath: "参赛提交材料包/30_课程开班向导与首周试点落地说明.md",
      demoAnchor: "#course-launch",
      trap: "不要承诺已完成大规模付费部署。",
      recovery: "表述为首周影子运行、教师确认、班级试点和校级私有化四阶段。",
    },
    {
      id: "opensource-originality",
      question: "参考开源项目后，原创性在哪里？",
      status: "ready",
      owner: "captain",
      shortAnswer:
        "开源项目只作为LMS、Agent编排、评测和可观测性参考；原创部分是面向软件工程学习的证据账本、路径增值决策、教学风险门禁和评委验收闭环。",
      evidencePath: "参赛提交材料包/08_开源项目创新矩阵.md",
      demoAnchor: "#research-fusion",
      trap: "不要把开源项目说成已直接集成进生产系统。",
      recovery: "指出哪些是设计参考，哪些是本作品代码和材料中的可运行实现。",
    },
    {
      id: "judge-live-path",
      question: "评委现在打开Demo，三分钟内应该看什么？",
      status: verificationReady ? "ready" : "watch",
      owner: "product",
      shortAnswer:
        "先点一键评委导览，再依次看学生闭环、教师复核、云端交付、后端状态、技术验收；每一步都有对应材料和命令。",
      evidencePath: "参赛提交材料包/50_评委5分钟实操演练与教师复核深潜说明.md",
      demoAnchor: "#reviewer-drill",
      trap: "不要让评委在复杂导航里自由迷路。",
      recovery: "回到ReviewerGuideOverlay，从第1步重新自动滚动。",
    },
    {
      id: "unfinished-truth",
      question: "哪些部分还需要人工确认，不能包装成已完成？",
      status: "manual",
      owner: "captain",
      shortAnswer:
        "队伍名称、成员信息、主办方是否允许匿名公开链接、真实学校数据授权、最终真人旁白和正式命名副本必须由团队赛前确认。",
      evidencePath: "参赛提交材料包/45_提交日人工确认决策卡.md",
      demoAnchor: "#final-submission",
      trap: "不要为了显得完整而编造队伍信息、真实试点或公开访问权限。",
      recovery: "承认人工门禁，并展示系统如何把这些门禁标成manual而不是PASS。",
    },
  ];

  const evidenceRoutes: FinalDefenseEvidenceRoute[] = [
    {
      id: "product-demo",
      label: "产品闭环入口",
      status: "ready",
      productAnchor: "#student",
      materialPath: "参赛提交材料包/START_DEMO.md",
      command: "npm run dev",
      judgeProof: "从失败PR到脚手架干预、CI通过、教师复核和反思记忆。",
    },
    {
      id: "pitch-director",
      label: "路演脚本与镜头证据",
      status: pitchReady ? "ready" : "watch",
      productAnchor: "#pitch-director",
      materialPath: "参赛提交材料包/32_视频与路演导演说明.md",
      command: "打开PitchDirector.recordingManifest",
      judgeProof: "5分钟以内、镜头锚点、评分项和禁止口径同屏。",
    },
    {
      id: "defense-card",
      label: "决赛追问回答卡",
      status: "ready",
      productAnchor: "#final-defense",
      materialPath: "参赛提交材料包/52_决赛路演口播稿与评委追问回答卡.md",
      command: "打开本面板或下载sepath-final-defense-manifest.json",
      judgeProof: "尖锐问题、短回答、证据路径、陷阱与补救口径一一绑定。",
    },
    {
      id: "release-gate",
      label: "最终门禁与上传包",
      status: uploadReady ? "ready" : "manual",
      productAnchor: "#final-submission",
      materialPath: "outputs/SE-Path学伴_最终发布门禁报告_机器生成.json",
      command: "python scripts/release_gate.py",
      judgeProof: "测试、构建、审计、打包、命名预演和人工门禁集中验收。",
    },
    {
      id: "technical-verification",
      label: "技术验收证据包",
      status: verificationReady ? "ready" : "watch",
      productAnchor: "#judge-verification",
      materialPath: "参赛提交材料包/46_评委技术验收包.md",
      command: "python scripts/generate_judge_verification_pack.py --write",
      judgeProof: "release gate、Edge API、LLM网关、SLO、公开试用包和评分证据映射。",
    },
    {
      id: "backend-status",
      label: "后端与上线边界",
      status: backendReady ? "ready" : backendStatus ? "watch" : "manual",
      productAnchor: backendStatus ? "#backend-status" : "#cloud-slo",
      materialPath: "参赛提交材料包/51_后端连接状态中心与上线边界说明.md",
      command: "npm run cloud:smoke && npm run cloud:smoke:llm",
      judgeProof: backendStatusLabel,
    },
  ];

  const readinessGates: FinalDefenseGate[] = [
    {
      id: "opening-rehearsal",
      label: "开场90秒不超时",
      status: scripts.find((item) => item.id === "ninety-second-defense")?.status ?? "watch",
      criteria: "一句定位、三点创新、一个可验证闭环，90秒内讲完。",
      evidence: "本面板90秒脚本 + PitchDirector镜头表。",
      nextAction: "队长按真实姓名和团队名称替换最终口播稿。",
    },
    {
      id: "hard-question-map",
      label: "追问都有证据锚点",
      status: challengeCards.filter((item) => item.status === "ready").length >= 6 ? "ready" : "watch",
      criteria: "不少于6个高频追问能跳转到产品锚点和材料路径。",
      evidence: `${challengeCards.length}张追问卡 / ${evidenceRoutes.length}条证据路线`,
      nextAction: "答辩前把最容易被问的3张卡排到队伍分工首页。",
    },
    {
      id: "truth-boundary",
      label: "真实边界不夸大",
      status: "manual",
      criteria: "不伪造队伍、公开链接、真实学生、真实提分和生产数据库授权。",
      evidence: "45_提交日人工确认决策卡 + FinalSubmission.forbiddenClaims。",
      nextAction: "赛前由全队逐条确认，未确认保持manual。",
    },
    {
      id: "technical-recheck",
      label: "技术复查可复跑",
      status: verificationReady && uploadReady ? "ready" : "watch",
      criteria: "release gate、audit、package、technical pack能在当前机器复跑。",
      evidence: judgeVerification.releaseGatePath,
      nextAction: "最终提交前再跑一次release_gate并保留manifest SHA。",
    },
    {
      id: "fallback-plan",
      label: "现场兜底路线明确",
      status: backendReady || pitchReady ? "ready" : "manual",
      criteria: "断网、无Key、私有链接不可访问时仍可用视频、静态包、本地Demo和报告完成答辩。",
      evidence: backendStatusLabel,
      nextAction: "把MP4、PPT、ZIP和START_DEMO放到同一个离线文件夹。",
    },
  ];

  const forbiddenLines: FinalDefenseForbiddenLine[] = [
    {
      id: "real-student-data",
      riskyLine: "我们已经接入真实学生数据并证明长期提分。",
      safeLine: "当前参赛包使用合成与脱敏样本，真实试点需学校授权和教师确认A/B。",
      source: "45_提交日人工确认决策卡 / 51_后端连接状态中心",
    },
    {
      id: "public-production-url",
      riskyLine: "这个链接是任何评委都能匿名访问的生产系统。",
      safeLine: "可公开的是静态试用包和离线包，私有云或owner-only链接按主办方访问策略开放。",
      source: "16_公开试用发布包与云端迁移手册 / 43_评委云端交付体验中心",
    },
    {
      id: "llm-direct-answer",
      riskyLine: "AI会直接给学生完整答案，所以学习效率最高。",
      safeLine: "AI只给最小脚手架、证据要求和反思提示，高风险发布进入教师复核。",
      source: "25_学生对话实验台与智能干预说明 / 29_AI Agent运行时",
    },
    {
      id: "opensource-claim",
      riskyLine: "我们把某个开源平台直接改成了完整产品。",
      safeLine: "开源项目作为参考基座，原创实现集中在证据账本、路径增值策略、教学门禁和验收闭环。",
      source: "08_开源项目创新矩阵 / 36_科研算法融合与开源证据中台",
    },
  ];

  const scoredItems = [...scripts, ...challengeCards, ...evidenceRoutes, ...readinessGates];
  const readyCount = countStatus(scoredItems, "ready");
  const watchCount = countStatus(scoredItems, "watch");
  const manualCount = countStatus(scoredItems, "manual");
  const blockedCount = countStatus(scoredItems, "blocked");
  const score = scoreItems(scoredItems);
  const runtime = "sepath-final-defense-command-center.v1";

  const reportCore = {
    runtime,
    score,
    pitchDurationSeconds: pitchDirector.durationSeconds,
    challengeCardCount: challengeCards.length,
    evidenceRouteCount: evidenceRoutes.length,
    backendStatus: backendStatusLabel,
    gates: readinessGates.map((gate) => ({ id: gate.id, status: gate.status })),
    topQuestions: challengeCards.slice(0, 4).map((card) => ({
      id: card.id,
      owner: card.owner,
      anchor: card.demoAnchor,
      evidence: card.evidencePath,
    })),
    truthfulBoundaries: forbiddenLines.map((line) => line.id),
  };

  return {
    runtime,
    score,
    stage: score >= 84 ? "决赛答辩可执行" : "决赛答辩待压实",
    summary:
      "把路演主线、评委尖锐追问、材料证据、运行命令、后端边界和禁止夸大口径集中到产品内，形成现场可跳转、可复跑、可兜底的答辩控制台。",
    readyCount,
    watchCount,
    manualCount,
    blockedCount,
    metrics: [
      {
        id: "pitch-duration",
        label: "主视频时长",
        value: `${pitchDirector.durationSeconds}秒`,
        target: "180-300秒",
        status: pitchReady ? "ready" : "watch",
      },
      {
        id: "challenge-cards",
        label: "追问回答卡",
        value: `${challengeCards.length}张`,
        target: "覆盖算法、工程、隐私、商业化、原创性",
        status: "ready",
      },
      {
        id: "evidence-routes",
        label: "证据跳转路线",
        value: `${evidenceRoutes.length}条`,
        target: "产品锚点 + 材料 + 命令",
        status: evidenceRoutes.filter((item) => item.status === "ready").length >= 4 ? "ready" : "watch",
      },
      {
        id: "truth-boundaries",
        label: "禁止夸大口径",
        value: `${forbiddenLines.length}条`,
        target: "真实试点、公开链接、LLM、开源归属",
        status: "manual",
      },
    ],
    scripts,
    challengeCards,
    evidenceRoutes,
    forbiddenLines,
    readinessGates,
    runbook: [
      "先用30秒电梯版确认定位：软件工程项目学习闭环智能体。",
      "进入90秒压缩版：证据账本、SafeVOI、教师复核、云端验收四点连续讲。",
      "遇到追问时只读对应卡片的shortAnswer，再跳到demoAnchor或materialPath。",
      "涉及真实数据、公开地址、提分效果和队伍信息时，按forbiddenLines切换到安全口径。",
      "技术质疑无法现场复跑时，展示release gate、technical pack、manifest和视频兜底路线。",
    ],
    manifest: JSON.stringify(reportCore, null, 2),
  };
}
