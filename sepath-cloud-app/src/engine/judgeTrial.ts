import type { AppState, AwardReadinessReport } from "../domain/types";
import { evidenceCoverage } from "./evidence";
import type { ApiContractReport } from "./apiContract";
import type { LaunchReadinessReport } from "./launchReadiness";
import type { PilotReadinessReport } from "./pilotReadiness";
import type { PrivacyGuardReport } from "./privacyGuard";
import type { ValueUpliftReport } from "./valueUplift";

export type JudgeTrialStatus = "ready" | "fallback" | "manual" | "blocked";

export interface JudgeTrialRoute {
  id: string;
  label: string;
  status: JudgeTrialStatus;
  mode: string;
  primaryAction: string;
  evidence: string;
  proofArtifacts: string[];
  fallback: string;
  riskControl: string;
}

export interface JudgeTrialChecklistItem {
  id: string;
  label: string;
  owner: "team" | "teacher" | "ops" | "organizer";
  status: JudgeTrialStatus;
  evidence: string;
  nextAction: string;
}

export interface JudgeTrialMetric {
  id: string;
  label: string;
  value: string;
  target: string;
}

export interface JudgeTrialPlaybookStep {
  id: string;
  label: string;
  minutes: string;
  actions: string[];
}

export interface JudgeTrialTask {
  id: string;
  label: string;
  status: JudgeTrialStatus;
  duration: string;
  entry: string;
  evaluatorAction: string;
  scoringFocus: string;
  successSignal: string;
  fallbackRoute: string;
  proofArtifacts: string[];
}

export interface JudgeTrialProofItem {
  id: string;
  criterion: string;
  weight: string;
  productEvidence: string;
  materialEvidence: string;
  demoLine: string;
  riskBoundary: string;
}

export interface JudgeTrialReport {
  score: number;
  stage: string;
  summary: string;
  readyCount: number;
  fallbackCount: number;
  manualCount: number;
  blockedCount: number;
  routes: JudgeTrialRoute[];
  checklist: JudgeTrialChecklistItem[];
  metrics: JudgeTrialMetric[];
  playbook: JudgeTrialPlaybookStep[];
  trialTasks: JudgeTrialTask[];
  proofMatrix: JudgeTrialProofItem[];
  submissionStatement: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function countStatus<T extends { status: JudgeTrialStatus }>(items: T[], status: JudgeTrialStatus): number {
  return items.filter((item) => item.status === status).length;
}

export function buildJudgeTrialReport(
  state: AppState,
  launchReadiness: LaunchReadinessReport,
  awardReadiness: AwardReadinessReport,
  pilotReadiness: PilotReadinessReport,
  privacyGuard: PrivacyGuardReport,
  apiContract: ApiContractReport,
  valueUplift: ValueUpliftReport,
): JudgeTrialReport {
  const coverage = evidenceCoverage(state.events);
  const hasClosedLoop = state.events.some((event) => event.type === "ci_passed")
    && state.events.some((event) => event.type === "teacher_reviewed")
    && state.events.some((event) => event.type === "reflection_submitted");
  const packageReady = launchReadiness.passCount >= 5 && launchReadiness.watchCount === 0;
  const privacyReady = privacyGuard.gate === "pass";
  const apiReady = apiContract.readyCount >= 2 && apiContract.manualCount <= 2;

  const routes: JudgeTrialRoute[] = [
    {
      id: "public-static-package",
      label: "公开只读静态包",
      status: "ready",
      mode: "评委可部署 / 可离线打开",
      primaryAction: "提交 ZIP 内的公开试用静态包，或上传到任意静态托管。",
      evidence: "参赛提交材料包/公开试用静态包 已由构建脚本生成并进入发布门禁。",
      proofArtifacts: ["index.html", "PUBLIC_TRIAL_MANIFEST.json", "README_公开试用.md", "manifest.webmanifest", "sw.js"],
      fallback: "如果托管平台不可用，切换到本地 Vite Demo 或 4分40秒视频。",
      riskControl: "只读演示，不接真实学生数据，不需要评委提供账号密码。",
    },
    {
      id: "pwa-offline-resilience",
      label: "PWA 离线容灾路线",
      status: "ready",
      mode: "首访缓存 / 可安装 / 离线页兜底",
      primaryAction: "用 HTTPS 托管公开试用包后，浏览器可读取 manifest.webmanifest 并注册 sw.js。",
      evidence: "validate_public_trial_pwa.py 会检查 PWA manifest、Service Worker、offline.html、图标、公开 Manifest 和评委种子包。",
      proofArtifacts: ["manifest.webmanifest", "sw.js", "offline.html", "public-trial-pwa-validation.json"],
      fallback: "如果浏览器禁用 Service Worker，则按普通静态包、本地 Demo 或视频路线继续评审。",
      riskControl: "离线缓存只包含静态演示资产和合成 Manifest，不缓存真实账号、学生 PII 或模型密钥。",
    },
    {
      id: "owner-only-sites",
      label: "OpenAI Sites 私有云版本",
      status: "manual",
      mode: "owner-only / 登录态演示",
      primaryAction: "现场路演用登录态打开，正式提交前按主办方要求决定是否公开。",
      evidence: `${launchReadiness.cloudUrl} 当前匿名访问 401/403 属于访问控制生效。`,
      proofArtifacts: ["07_云端部署记录.md", "release_gate.py 云端探测", "sepath-sites-app/.openai/hosting.json"],
      fallback: "评委不能登录时，立即切到公开静态包。",
      riskControl: "不把私有 URL 冒充公开演示地址，避免评审当天打不开。",
    },
    {
      id: "local-engineering-demo",
      label: "本地工程 Demo",
      status: packageReady ? "ready" : "fallback",
      mode: "源码可运行 / 可复查算法",
      primaryAction: "进入 sepath-cloud-app 后运行 npm install、npm run test、npm run dev。",
      evidence: packageReady
        ? "算法测试、生产构建、截图 QA 和提交包审计均已通过。"
        : "演示闭环仍有动态证据可继续补齐。",
      proofArtifacts: ["sepath-cloud-app/src/engine", "sepath-cloud-app/src/components", "START_DEMO.md"],
      fallback: "本地依赖安装失败时，播放视频并展示终审报告。",
      riskControl: "核心决策为确定性 TypeScript 纯函数，便于复查，不依赖临场模型波动。",
    },
    {
      id: "video-proof",
      label: "4分40秒演示视频",
      status: "ready",
      mode: "离线兜底 / 14 个真实镜头",
      primaryAction: "按视频展示学生对话、集成回放、增值评估、模型治理和评审证据。",
      evidence: "MP4 为 1920x1080、H.264、280 秒，来自自动点击 Demo 截图。",
      proofArtifacts: ["SE-Path学伴_4分40秒演示视频素材_v0.3.mp4", "SRT/VTT 字幕", "正式旁白稿"],
      fallback: "视频播放异常时，用 PPT v0.2 和截图 manifest 讲同一条闭环。",
      riskControl: "旁白稿保留真实性边界，不宣称已完成真实提分。",
    },
    {
      id: "source-audit",
      label: "源码与审计证据",
      status: privacyReady && apiReady ? "ready" : "fallback",
      mode: "技术复查 / 机器门禁",
      primaryAction: "打开提交前终审报告、manifest、测试输出和关键源码模块。",
      evidence: `当前隐私门禁 ${privacyGuard.gate}，API 契约 ${apiContract.readyCount} ready / ${apiContract.manualCount} manual。`,
      proofArtifacts: ["09_提交前终审报告.md", "submission manifest", "scripts/release_gate.py"],
      fallback: "若评委只看材料，PPT 第 15 页和 README 总览给出证据索引。",
      riskControl: "敏感信息扫描为 0 命中，真实报名信息仍保留待填写占位。",
    },
  ];

  const checklist: JudgeTrialChecklistItem[] = [
    {
      id: "team-profile",
      label: "队伍名、队员和文件命名",
      owner: "team",
      status: "manual",
      evidence: "比赛报名信息只能由参赛队确认，当前材料保留待填写占位。",
      nextAction: "提交前统一 PDF、PPT、ZIP 和平台字段。",
    },
    {
      id: "access-policy",
      label: "评委打开方式",
      owner: "team",
      status: "manual",
      evidence: "当前同时准备 owner-only Sites、公开静态包、本地 Demo 和视频兜底。",
      nextAction: "按主办方要求选择公开链接、演示账号或上传静态包。",
    },
    {
      id: "privacy-scan",
      label: "隐私与敏感信息",
      owner: "ops",
      status: privacyReady ? "ready" : "blocked",
      evidence: privacyReady ? `受保护字段 ${privacyGuard.protectedFields.length} 类，PII 命中 ${privacyGuard.piiFindings}。` : privacyGuard.summary,
      nextAction: privacyReady ? "正式提交前复跑 release gate。" : "先脱敏，再重新生成提交包。",
    },
    {
      id: "closed-loop-proof",
      label: "闭环演示证据",
      owner: "ops",
      status: hasClosedLoop ? "ready" : "fallback",
      evidence: hasClosedLoop ? "CI 通过、教师复核和反思记忆均已写入证据账本。" : "继续点击主流程补齐闭环证据。",
      nextAction: "现场优先演示失败 PR 到反思记忆的完整链路。",
    },
    {
      id: "voiceover",
      label: "真人旁白选择",
      owner: "team",
      status: "manual",
      evidence: "当前字幕素材版可直接提交，也可叠加真人旁白。",
      nextAction: "正式提交前播放全片，确认口播节奏和字幕一致。",
    },
    {
      id: "trial-claim",
      label: "真实试点声明边界",
      owner: "teacher",
      status: "manual",
      evidence: "学习增值中心已给出 Telemetry Contract，但当前不能宣称真实课程提分。",
      nextAction: "只表述合成回放、确定性验证和下一轮真实试点设计。",
    },
  ];

  const readyCount = countStatus(routes, "ready") + countStatus(checklist, "ready");
  const fallbackCount = countStatus(routes, "fallback") + countStatus(checklist, "fallback");
  const manualCount = countStatus(routes, "manual") + countStatus(checklist, "manual");
  const blockedCount = countStatus(routes, "blocked") + countStatus(checklist, "blocked");

  const trialTasks: JudgeTrialTask[] = [
    {
      id: "one-click-loop",
      label: "三分钟闭环验收",
      status: hasClosedLoop ? "ready" : "fallback",
      duration: "3 min",
      entry: "顶部导航：学生闭环 -> 学生对话 -> 教师周报",
      evaluatorAction: "点击主流程按钮补齐失败 PR、脚手架干预、CI 通过、教师复核和反思记忆。",
      scoringFocus: "功能完整程度 / 实时干预 / 记忆与反思",
      successSignal: hasClosedLoop ? "证据账本已出现 CI 通过、教师复核和反思记忆。" : "继续运行主流程即可补齐闭环事件。",
      fallbackRoute: "若现场不操作，播放 4分40秒视频第 00:30-02:40 段。",
      proofArtifacts: ["EvidenceTimeline", "StudentDialoguePanel", "TeacherReportPanel"],
    },
    {
      id: "algorithm-audit",
      label: "算法与科研创新验收",
      status: valueUplift.valueScore >= 75 && awardReadiness.totalScore >= 80 ? "ready" : "fallback",
      duration: "4 min",
      entry: "顶部导航：策略实验 -> 增值评估 -> 算法验证",
      evaluatorAction: "查看 SafeVOI、PathTwin、KnowledgeBoundary 与对照策略的得分差异和声明边界。",
      scoringFocus: "自适应策略 / 创新性与体验 / 技术水平",
      successSignal: `增值分 ${valueUplift.valueScore}，评分证据 ${awardReadiness.totalScore}/${awardReadiness.maxScore}。`,
      fallbackRoute: "若只看材料，打开 13、17、27 三份算法验证说明。",
      proofArtifacts: ["StrategyLabPanel", "ValueUpliftPanel", "ResearchEvidencePanel"],
    },
    {
      id: "course-deploy",
      label: "真实课程落地验收",
      status: pilotReadiness.readinessScore >= 70 && apiReady ? "ready" : "fallback",
      duration: "3 min",
      entry: "顶部导航：课程配置 -> 开班向导 -> API契约",
      evaluatorAction: "检查 Rubric、名册授权、Git/CI/LMS/飞书接入链路和首周影子运行计划。",
      scoringFocus: "商业价值 / 市场接受度 / 可上线使用",
      successSignal: `试点就绪 ${pilotReadiness.readinessScore}，API ready ${apiContract.readyCount} 项。`,
      fallbackRoute: "若未接真实平台，展示 Webhook dry-run 和可导出 Manifest。",
      proofArtifacts: ["CourseAuthoringPanel", "CourseLaunchPanel", "ApiContractPanel"],
    },
    {
      id: "red-team-governance",
      label: "红队与治理验收",
      status: privacyReady ? "ready" : "blocked",
      duration: "2 min",
      entry: "顶部导航：隐私治理 -> AI运行时 -> 评审证据",
      evaluatorAction: "验证直接索要答案、敏感字段、私有链接和模型无 Key 场景都有降级方案。",
      scoringFocus: "智能体架构设计 / 大模型调用稳定性 / 安全可信",
      successSignal: privacyReady ? `隐私门禁 ${privacyGuard.gate}，PII 命中 ${privacyGuard.piiFindings}。` : privacyGuard.summary,
      fallbackRoute: "若出现阻断项，按终审报告先脱敏再提交。",
      proofArtifacts: ["PrivacyGuardPanel", "AgentRuntimePanel", "JudgeTrialPanel"],
    },
  ];

  const proofMatrix: JudgeTrialProofItem[] = [
    {
      id: "architecture",
      criterion: "智能体架构设计",
      weight: "初赛 30 / 决赛技术 30",
      productEvidence: "AI 运行时、RAG 上下文包、工具调用 Trace、API 契约和课程开班 Manifest 已在产品内联动。",
      materialEvidence: "21_API、22_ModelOps、29_AI Agent、30_开班向导",
      demoLine: "这不是单轮问答，而是可回放、可审计、可降级的伴学 Agent 运行时。",
      riskBoundary: "无 API Key 时使用确定性策略兜底，不把模型临场输出当成唯一能力。",
    },
    {
      id: "adaptive-strategy",
      criterion: "自适应策略",
      weight: "初赛 25 / 决赛功能 40",
      productEvidence: "PathTwin 画像、SafeVOI 排序、KnowledgeBoundary 约束和反思记忆共同生成下一步任务。",
      materialEvidence: "13_算法验证、17_策略实验、27_学习增值",
      demoLine: "学生不是被推答案，而是被推一个能解除当前阻塞的最小脚手架行动。",
      riskBoundary: "增值来自合成回放和离线对照，真实提分等待试点验证。",
    },
    {
      id: "closed-loop",
      criterion: "功能完整程度",
      weight: "初赛 20 / 决赛功能 40",
      productEvidence: "失败 PR、学生对话、CI 修复、教师复核、反思记忆和周报导出形成闭环证据链。",
      materialEvidence: "START_DEMO、25_学生对话、26_集成回放、24_教师周报",
      demoLine: "评委可以从一条失败 PR 看到诊断、干预、复核和下一轮计划。",
      riskBoundary: "高风险建议进入教师发布门，不自动替写可提交代码。",
    },
    {
      id: "commercialization",
      criterion: "商业价值与市场接受度",
      weight: "初赛 10 / 决赛市场 10",
      productEvidence: "课程配置、开班向导、公开试用包、本地 Demo、私有云和源码审计组成可交付路线。",
      materialEvidence: "10_平台文案、11_上线运维、16_公开试用、18_课程试点",
      demoLine: "它已经按软件工程课程试点方式组织，不是一次性页面 Demo。",
      riskBoundary: "访问策略、队伍信息和真实试点数据保持人工确认，不编造外部事实。",
    },
  ];

  const score = clamp(
    Math.round(
      72
        + readyCount * 3
        + countStatus(trialTasks, "ready") * 2
        + Math.round(coverage * 6)
        + Math.round((awardReadiness.totalScore / awardReadiness.maxScore) * 6)
        + Math.round(valueUplift.valueScore / 20)
        + (pilotReadiness.readinessScore >= 70 ? 4 : 0)
        - fallbackCount * 2
        - manualCount
        - blockedCount * 18,
    ),
    0,
    100,
  );

  return {
    score,
    stage: "评委试用发布候选 / 正式提交前人工确认",
    summary:
      blockedCount > 0
        ? "当前存在发布阻断项，必须先完成脱敏或访问策略修复。"
        : "当前已经具备公开静态包、本地 Demo、私有云、视频和源码审计五条评委试用路线；剩余事项是报名信息、访问策略和旁白口径的人工确认。",
    readyCount,
    fallbackCount,
    manualCount,
    blockedCount,
    routes,
    checklist,
    metrics: [
      {
        id: "trial-routes",
        label: "试用路线",
        value: `${routes.length} 条`,
        target: "公开、私有、本地、视频、源码均可兜底",
      },
      {
        id: "auto-gate",
        label: "动态观察项",
        value: launchReadiness.watchCount === 0 ? "0 watch" : `${launchReadiness.watchCount} watch`,
        target: "产品内 watch 不等于发布失败；最终以 release_gate 报告为准",
      },
      {
        id: "award-proof",
        label: "评分证据",
        value: `${awardReadiness.totalScore}/${awardReadiness.maxScore}`,
        target: "评审证据可回溯到源码和材料",
      },
      {
        id: "manual-left",
        label: "人工确认",
        value: `${manualCount} 项`,
        target: "不编造报名信息、公开访问或真实提分",
      },
    ],
    playbook: [
      {
        id: "first-five",
        label: "5 分钟评委路线",
        minutes: "0-5",
        actions: ["打开公开静态包或本地 Demo", "跑失败 PR 闭环", "切到增值评估和评审证据"],
      },
      {
        id: "technical-audit",
        label: "技术复查路线",
        minutes: "5-12",
        actions: ["查看 release gate", "打开源码 engine 测试", "检查 API 契约、隐私门禁和证据账本导出"],
      },
      {
        id: "fallback-demo",
        label: "网络异常兜底",
        minutes: "随时",
        actions: ["播放 4分40秒视频", "打开 PPT v0.2 第 15 页", "展示 ZIP manifest 和终审报告"],
      },
    ],
    trialTasks,
    proofMatrix,
    submissionStatement:
      "正式提交时应表述为：SE-Path 已完成可运行、可上云、可审计的闭环 Demo 与公开试用包；真实课程提分仍需后续试点验证，不提前夸大。",
  };
}
