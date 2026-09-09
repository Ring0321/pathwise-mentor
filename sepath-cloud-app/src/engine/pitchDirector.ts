import type { AppState, AwardReadinessReport } from "../domain/types";
import type { AgentRuntimeReport } from "./agentRuntime";
import type { CourseLaunchReport } from "./courseLaunch";
import type { JudgeTrialReport } from "./judgeTrial";
import type { SubmissionOpsReport } from "./submissionOps";
import type { TeacherReport } from "./teacherReport";
import type { ValueUpliftReport } from "./valueUplift";

export type PitchDirectorStatus = "ready" | "watch" | "manual" | "blocked";
export type PitchDirectorOwner = "team" | "ops" | "teacher" | "director" | "organizer";

export interface PitchMetric {
  id: string;
  label: string;
  value: string;
  target: string;
  status: PitchDirectorStatus;
}

export interface PitchSegment {
  id: string;
  title: string;
  timeRange: string;
  durationSeconds: number;
  anchor: string;
  status: PitchDirectorStatus;
  scoringFocus: string;
  voiceover: string;
  screenProof: string;
  transitionCue: string;
  riskBoundary: string;
}

export interface PitchChecklistItem {
  id: string;
  label: string;
  owner: PitchDirectorOwner;
  status: PitchDirectorStatus;
  evidence: string;
  nextAction: string;
}

export interface PitchCoverageItem {
  id: string;
  criterion: string;
  weight: string;
  status: PitchDirectorStatus;
  segments: string[];
  proof: string;
  judgeTakeaway: string;
}

export interface PitchRecordingRoute {
  id: string;
  label: string;
  status: PitchDirectorStatus;
  command: string;
  output: string;
  fallback: string;
}

export interface PitchExportItem {
  id: string;
  label: string;
  status: PitchDirectorStatus;
  path: string;
  validation: string;
}

export interface PitchRiskControl {
  id: string;
  label: string;
  status: PitchDirectorStatus;
  guardrail: string;
  forbiddenLine: string;
  safeLine: string;
}

export interface PitchDirectorReport {
  score: number;
  stage: string;
  summary: string;
  durationSeconds: number;
  targetVideoName: string;
  readyCount: number;
  watchCount: number;
  manualCount: number;
  blockedCount: number;
  metrics: PitchMetric[];
  segments: PitchSegment[];
  voiceoverChecklist: PitchChecklistItem[];
  shotCoverage: PitchCoverageItem[];
  recordingRoutes: PitchRecordingRoute[];
  exportPack: PitchExportItem[];
  riskControls: PitchRiskControl[];
  recutCommand: string;
  finalVideoPath: string;
  recordingManifest: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function countStatus<T extends { status: PitchDirectorStatus }>(items: T[], status: PitchDirectorStatus): number {
  return items.filter((item) => item.status === status).length;
}

function statusWeight(status: PitchDirectorStatus): number {
  if (status === "ready") return 1;
  if (status === "watch") return 0.7;
  if (status === "manual") return 0.46;
  return 0;
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

export function buildPitchDirectorReport(
  state: AppState,
  awardReadiness: AwardReadinessReport,
  valueUplift: ValueUpliftReport,
  agentRuntime: AgentRuntimeReport,
  courseLaunch: CourseLaunchReport,
  teacherReport: TeacherReport,
  judgeTrial: JudgeTrialReport,
  submissionOps: SubmissionOpsReport,
): PitchDirectorReport {
  const hasClosedLoop = state.events.some((event) => event.type === "ci_passed")
    && state.events.some((event) => event.type === "teacher_reviewed")
    && state.events.some((event) => event.type === "reflection_submitted");
  const videoReady = submissionOps.requirements.find((item) => item.id === "demo-video")?.status === "ready";
  const submissionReady = submissionOps.score >= 70 && submissionOps.blockedCount === 0;
  const runtimeReady = agentRuntime.score >= 80 && agentRuntime.blockedCount === 0;
  const launchReady = courseLaunch.score >= 80 && courseLaunch.blockedCount === 0;
  const judgeReady = judgeTrial.score >= 80 && judgeTrial.blockedCount === 0;
  const teacherReady = teacherReport.score >= 75;
  const valueReady = valueUplift.valueScore >= 75;
  const currentVideoPath = "参赛提交材料包/演示视频素材/SE-Path学伴_4分40秒演示视频素材_v0.3.mp4";

  const segments: PitchSegment[] = [
    {
      id: "opening-positioning",
      title: "开场定位：软件工程闭环智能体",
      timeRange: "00:00-00:28",
      durationSeconds: 28,
      anchor: "#student",
      status: "ready",
      scoringFocus: "赛题匹配 / 功能完整",
      voiceover: "SE-Path 学伴不是通用问答，而是面向软件工程项目式学习的诊断、干预、复核和记忆闭环。",
      screenProof: "英雄区、证据事件、证据覆盖、路径完成、云端形态四个指标。",
      transitionCue: "从一次失败 PR 切入，让评委看到真实学习触发点。",
      riskBoundary: "只说明当前 Demo 能闭环，不宣称已经在真实课程中形成长期提分。",
    },
    {
      id: "student-loop",
      title: "失败 PR 到脚手架干预",
      timeRange: "00:28-01:10",
      durationSeconds: 42,
      anchor: "#dialogue",
      status: hasClosedLoop ? "ready" : "watch",
      scoringFocus: "实时干预 / 记忆与反思",
      voiceover: "学生索要完整代码时，系统拒绝替写，给出最小脚手架、证据要求和教师复核路径。",
      screenProof: "学生对话实验台、EvidenceEvent 写入、直接答案拦截和反思记忆。",
      transitionCue: "把学生视角转换为教师可运营视角。",
      riskBoundary: "不让 AI 直接输出可提交答案，高风险建议进入教师发布门。",
    },
    {
      id: "course-authoring",
      title: "课程配置与首周开班",
      timeRange: "01:10-01:44",
      durationSeconds: 34,
      anchor: "#course-launch",
      status: launchReady ? "ready" : "watch",
      scoringFocus: "商业价值 / 市场接受度",
      voiceover: "系统可以把 Rubric、Git/CI/LMS、飞书队列、隐私授权和首周影子运行压缩成可上线清单。",
      screenProof: "课程开班向导、课程启动包、接入链路、风险登记和开班 Manifest。",
      transitionCue: "说明它不是一次性页面，而是可以进入真实课程试点的工作台。",
      riskBoundary: "真实开班前仍需教师确认名册、授权和试点边界。",
    },
    {
      id: "runtime-governance",
      title: "AI Agent 运行时与无 Key 降级",
      timeRange: "01:44-02:20",
      durationSeconds: 36,
      anchor: "#ai-runtime",
      status: runtimeReady ? "ready" : "watch",
      scoringFocus: "智能体架构设计 / 技术水平",
      voiceover: "确定性策略负责教育决策，大模型只做解释表达；RAG、工具调用、隐私门和教师复核都可追踪。",
      screenProof: "Agent Runtime、Prompt 契约、RAG 上下文包、工具 Trace、质量门和 deployment manifest。",
      transitionCue: "从系统架构转到算法价值证明。",
      riskBoundary: "不把临场模型输出当成唯一能力，断网或无 Key 仍可完整演示。",
    },
    {
      id: "value-uplift",
      title: "SafeVOI 与学习增值评估",
      timeRange: "02:20-02:57",
      durationSeconds: 37,
      anchor: "#value",
      status: valueReady ? "ready" : "watch",
      scoringFocus: "自适应策略 / 创新性",
      voiceover: "路径增值引擎把下一步行动、风险拦截、能力增量和教师工时一起量化，避免把聊天体验误当学习效果。",
      screenProof: "学习增值评估中心、策略实验室、算法验证与科研证据。",
      transitionCue: "让评委知道创新点能被验证，而不只是口头提出。",
      riskBoundary: "真实提分仍等待试点，当前只展示合成回放、消融对照和 Telemetry Contract。",
    },
    {
      id: "teacher-and-report",
      title: "教师周报与运营复盘",
      timeRange: "02:57-03:27",
      durationSeconds: 30,
      anchor: "#teacher-report",
      status: teacherReady ? "ready" : "watch",
      scoringFocus: "功能完整 / 真实落地",
      voiceover: "教师看到的是 P0/P1 队列、风险控制、周报导出和下一轮 mini lab，而不是一个无法复核的黑盒建议。",
      screenProof: "教师周报与试点复盘、GrowthOps 队列、下载周报。",
      transitionCue: "从教师运营切到评委如何快速验收。",
      riskBoundary: "公开试用包只读合成数据，不暴露真实学生账本。",
    },
    {
      id: "judge-trial",
      title: "评委试用与评分证据矩阵",
      timeRange: "03:27-04:04",
      durationSeconds: 37,
      anchor: "#judge-trial",
      status: judgeReady ? "ready" : "watch",
      scoringFocus: "评审体验 / 交付可信",
      voiceover: "评委可以按公开静态包、私有云、本地 Demo、视频兜底和源码审计五条路线检查，不依赖现场口头解释。",
      screenProof: "评委任务包、评分证据矩阵、试用路线和现场 Playbook。",
      transitionCue: "最后用提交助手和路演导演封装参赛交付。",
      riskBoundary: "不把 owner-only 链接写成匿名公开链接。",
    },
    {
      id: "submission-close",
      title: "提交助手与最终口径",
      timeRange: "04:04-04:36",
      durationSeconds: 32,
      anchor: "#submission",
      status: submissionReady ? "ready" : "watch",
      scoringFocus: "提交完整度 / 可复核交付",
      voiceover: "系统把项目计划书、源码 Demo、视频、公开试用包、release gate 和人工确认项压成一张提交清单。",
      screenProof: "比赛提交助手、ZIP 命名、release gate 命令、平台填写文案检查。",
      transitionCue: "收束到一句话：已经可运行、可上云、可审计，剩余为队伍信息和访问策略人工确认。",
      riskBoundary: "队伍名、成员信息、最终命名和真人旁白必须由参赛队最后确认。",
    },
  ];

  const durationSeconds = segments.reduce((total, segment) => total + segment.durationSeconds, 0);

  const voiceoverChecklist: PitchChecklistItem[] = [
    {
      id: "human-voiceover",
      label: "真人旁白终版",
      owner: "team",
      status: "manual",
      evidence: "当前已有字幕素材版和正式旁白稿，是否叠加真人声音需参赛队确认。",
      nextAction: "用 160-180 字/分钟录制，保持 4分36秒以内，录完后完整播放一遍。",
    },
    {
      id: "srt-vtt",
      label: "SRT/VTT 字幕",
      owner: "ops",
      status: videoReady ? "ready" : "watch",
      evidence: "v0.3 已生成 SRT、VTT 和旁白稿，可作为无声/弱声环境兜底。",
      nextAction: "若补录 v0.4 镜头，重新对齐时间轴和字幕序号。",
    },
    {
      id: "claim-boundary",
      label: "真实性边界口径",
      owner: "director",
      status: "ready",
      evidence: "增值评估、开班向导、提交助手均保留不夸大真实提分的表述。",
      nextAction: "全片禁止出现已在真实学校长期显著提分等无法证明的口径。",
    },
    {
      id: "audio-level",
      label: "音量与噪声",
      owner: "team",
      status: "manual",
      evidence: "最终音频需人工监听，当前机器审计只能验证文件存在和时长。",
      nextAction: "目标响度保持稳定，开头 3 秒和结尾 3 秒不留杂音。",
    },
    {
      id: "screen-rhythm",
      label: "镜头节奏",
      owner: "director",
      status: "watch",
      evidence: "v0.3 视频可提交，但最新模块建议按本镜头表补拍或复剪。",
      nextAction: "每个核心评分项至少停留 20 秒，避免评委还没看清就切换。",
    },
  ];

  const shotCoverage: PitchCoverageItem[] = [
    {
      id: "architecture",
      criterion: "智能体架构设计",
      weight: "30 分",
      status: runtimeReady ? "ready" : "watch",
      segments: ["runtime-governance", "course-authoring"],
      proof: `Agent Runtime ${agentRuntime.score}，课程开班 ${courseLaunch.score}。`,
      judgeTakeaway: "确定性策略、大模型表达层、RAG、工具 Trace 和教师门禁分工清楚。",
    },
    {
      id: "adaptive-strategy",
      criterion: "自适应策略",
      weight: "25 分",
      status: valueReady ? "ready" : "watch",
      segments: ["student-loop", "value-uplift"],
      proof: `学习增值可信分 ${valueUplift.valueScore}，评分自评 ${awardReadiness.totalScore}/${awardReadiness.maxScore}。`,
      judgeTakeaway: "推荐的是解除阻塞的下一步行动，而不是普通聊天答案。",
    },
    {
      id: "complete-function",
      criterion: "功能完整程度",
      weight: "20 分",
      status: hasClosedLoop ? "ready" : "watch",
      segments: ["opening-positioning", "student-loop", "teacher-and-report"],
      proof: hasClosedLoop ? "CI 通过、教师复核和反思记忆均已写入账本。" : "继续运行主流程可补齐闭环事件。",
      judgeTakeaway: "从失败 PR 到反思记忆的主链路能被评委操作和复查。",
    },
    {
      id: "innovation-experience",
      criterion: "创新性与体验",
      weight: "15 分",
      status: "ready",
      segments: ["value-uplift", "judge-trial", "submission-close"],
      proof: "路径增值、评委任务包、提交助手和路演导演形成参赛级产品闭环。",
      judgeTakeaway: "不止做学习推荐，还把评审、上线、提交、材料口径一起产品化。",
    },
    {
      id: "commercial-value",
      criterion: "商业价值",
      weight: "10 分",
      status: launchReady && submissionReady ? "ready" : "watch",
      segments: ["course-authoring", "judge-trial", "submission-close"],
      proof: "课程开班、公开试用包、私有云、本地 Demo、视频兜底和源码审计均有路线。",
      judgeTakeaway: "能以软件工程课程试点进入真实学校，而不是只停留在比赛 PPT。",
    },
  ];

  const recordingRoutes: PitchRecordingRoute[] = [
    {
      id: "current-video",
      label: "当前 v0.3 素材版",
      status: videoReady ? "ready" : "watch",
      command: "打开参赛提交材料包/演示视频素材/SE-Path学伴_4分40秒演示视频素材_v0.3.mp4",
      output: "已有 4分40秒、1920x1080、字幕与旁白稿，可作为提交兜底。",
      fallback: "若临场打不开云端，直接播放此视频并展示字幕稿。",
    },
    {
      id: "v04-recut",
      label: "一等奖 v0.4 复剪路线",
      status: "watch",
      command: "cd sepath-cloud-app && npm run dev，然后按 #dialogue -> #course-launch -> #ai-runtime -> #value -> #judge-trial -> #submission 录屏",
      output: "覆盖最新 AI 运行时、开班向导、评委试用和提交助手模块。",
      fallback: "时间不够时，用 v0.3 视频 + 路演导演截图补充说明。",
    },
    {
      id: "live-roadshow",
      label: "现场 5 分钟路演",
      status: "manual",
      command: "按本模块 segment 顺序讲解，每段只证明一个评分点。",
      output: "答辩时可从任意评分项快速跳转到对应产品证据。",
      fallback: "网络异常时切换公开静态包、本地 Demo 或视频兜底。",
    },
    {
      id: "artifact-audit",
      label: "材料与源码审计",
      status: submissionReady ? "ready" : "watch",
      command: "python scripts/release_gate.py",
      output: "生成终审报告、ZIP manifest、截图检查和敏感信息扫描。",
      fallback: "如果 release gate 失败，先修复 FAIL 项再重新打包。",
    },
  ];

  const exportPack: PitchExportItem[] = [
    {
      id: "mp4",
      label: "演示视频 MP4",
      status: videoReady ? "ready" : "watch",
      path: currentVideoPath,
      validation: "必须在 3-5 分钟内，播放无黑屏，能看清关键面板。",
    },
    {
      id: "script",
      label: "正式旁白稿",
      status: "ready",
      path: "参赛提交材料包/演示视频素材/SE-Path学伴_正式旁白稿_v0.3.md",
      validation: "用于真人旁白、字幕校对和答辩口径复用。",
    },
    {
      id: "subtitles",
      label: "SRT/VTT 字幕",
      status: videoReady ? "ready" : "watch",
      path: "参赛提交材料包/演示视频素材/*.srt / *.vtt",
      validation: "平台静音播放或评委快速浏览时仍能理解闭环。",
    },
    {
      id: "shot-manifest",
      label: "路演分镜 Manifest",
      status: "ready",
      path: "产品内 PitchDirector.recordingManifest",
      validation: "记录每个镜头、锚点、评分项、口径边界和兜底路线。",
    },
    {
      id: "director-doc",
      label: "视频与路演导演说明",
      status: "ready",
      path: "参赛提交材料包/32_视频与路演导演说明.md",
      validation: "将本模块结果写入提交材料，便于正式参赛前复核。",
    },
  ];

  const riskControls: PitchRiskControl[] = [
    {
      id: "no-real-score-overclaim",
      label: "不宣称真实提分",
      status: "ready",
      guardrail: "不宣称真实提分，只能说可解释增值估计、合成回放和试点设计。",
      forbiddenLine: "已经在真实学校长期显著提升成绩。",
      safeLine: "当前证明闭环、算法和工程可运行，真实提分等待试点数据验证。",
    },
    {
      id: "no-public-url-overclaim",
      label: "不冒充公开云链接",
      status: judgeTrial.routes.find((route) => route.id === "owner-only-sites")?.status === "manual" ? "ready" : "watch",
      guardrail: "owner-only Sites 只能说现场登录态或私有演示。",
      forbiddenLine: "匿名评委可直接打开私有 URL。",
      safeLine: "公开静态包、本地 Demo 和视频作为评审兜底。",
    },
    {
      id: "no-answer-agent",
      label: "不把替写作业当能力",
      status: "ready",
      guardrail: "强调脚手架、检查清单、证据回写和教师复核。",
      forbiddenLine: "AI 可以直接帮学生完成提交。",
      safeLine: "AI 拦截直接答案请求，只给可学习、可复核的下一步行动。",
    },
    {
      id: "manual-team-info",
      label: "队伍信息人工确认",
      status: "manual",
      guardrail: "队伍名、成员、最终文件命名以报名系统为准。",
      forbiddenLine: "系统已自动确认队伍全部报名信息。",
      safeLine: "系统保留人工确认项，正式提交前统一命名和成员信息。",
    },
  ];

  const allStatusItems = [
    ...segments,
    ...voiceoverChecklist,
    ...shotCoverage,
    ...recordingRoutes,
    ...exportPack,
    ...riskControls,
  ];
  const readyCount = countStatus(allStatusItems, "ready");
  const watchCount = countStatus(allStatusItems, "watch");
  const manualCount = countStatus(allStatusItems, "manual");
  const blockedCount = countStatus(allStatusItems, "blocked");
  const score = clamp(
    Math.round(
      (allStatusItems.reduce((total, item) => total + statusWeight(item.status), 0) / allStatusItems.length) * 100
        + (durationSeconds >= 180 && durationSeconds <= 300 ? 4 : -12)
        + (awardReadiness.totalScore >= 90 ? 3 : 0),
    ),
    0,
    100,
  );

  const manifest = {
    runtime: "sepath-pitch-director.v1",
    generatedFrom: "product-state",
    targetDuration: formatDuration(durationSeconds),
    targetVideoName: "SE-Path学伴_4分36秒演示视频_v0.4",
    currentVideoPath,
    stage: blockedCount > 0 ? "blocked" : manualCount > 0 ? "manual-final-cut" : "submission-ready",
    score,
    segments: segments.map((segment) => ({
      id: segment.id,
      anchor: segment.anchor,
      timeRange: segment.timeRange,
      status: segment.status,
      scoringFocus: segment.scoringFocus,
    })),
    exportPack: exportPack.map((item) => ({ id: item.id, status: item.status, path: item.path })),
    claimBoundary: "no real-score uplift claim before approved pilot data",
  };

  return {
    score,
    stage:
      blockedCount > 0
        ? "路演阻断 / 先修复素材或口径"
        : "视频素材可提交 / 一等奖路演建议补 v0.4 复剪",
    summary:
      "视频与路演导演把 3-5 分钟演示拆成评分项驱动的镜头表：每段都有产品锚点、旁白句、证据画面、转场提示和风险边界，避免临场讲散，也让已有视频素材、字幕、源码审计和提交助手形成最终参赛闭环。",
    durationSeconds,
    targetVideoName: "SE-Path学伴_4分36秒演示视频_v0.4",
    readyCount,
    watchCount,
    manualCount,
    blockedCount,
    metrics: [
      {
        id: "duration",
        label: "目标时长",
        value: formatDuration(durationSeconds),
        target: "官方要求 3-5 分钟",
        status: durationSeconds >= 180 && durationSeconds <= 300 ? "ready" : "blocked",
      },
      {
        id: "award-score",
        label: "评分锚点",
        value: `${awardReadiness.totalScore}/${awardReadiness.maxScore}`,
        target: "五项评分维度全部映射到镜头",
        status: awardReadiness.totalScore >= 90 ? "ready" : "watch",
      },
      {
        id: "video-asset",
        label: "现有素材",
        value: videoReady ? "v0.3 ready" : "待补齐",
        target: "MP4、字幕、旁白稿齐全",
        status: videoReady ? "ready" : "watch",
      },
      {
        id: "manual-left",
        label: "人工终检",
        value: `${manualCount} 项`,
        target: "真人旁白、访问策略、队伍信息不自动编造",
        status: manualCount > 0 ? "manual" : "ready",
      },
    ],
    segments,
    voiceoverChecklist,
    shotCoverage,
    recordingRoutes,
    exportPack,
    riskControls,
    recutCommand:
      "按 PitchDirector.segments 的 anchor 顺序录屏，并用 02_演示视频脚本_3-5分钟.md 与 SRT/VTT 重新对齐 v0.4。",
    finalVideoPath: currentVideoPath,
    recordingManifest: JSON.stringify(manifest, null, 2),
  };
}
