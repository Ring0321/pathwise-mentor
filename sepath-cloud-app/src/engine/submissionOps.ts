import type { AppState, AwardReadinessReport } from "../domain/types";
import type { CourseLaunchReport } from "./courseLaunch";
import type { JudgeTrialReport } from "./judgeTrial";
import type { LaunchReadinessReport } from "./launchReadiness";
import type { PrivacyGuardReport } from "./privacyGuard";

export type SubmissionOpsStatus = "ready" | "watch" | "manual" | "blocked";

export interface SubmissionRequirement {
  id: string;
  label: string;
  officialNeed: string;
  status: SubmissionOpsStatus;
  evidence: string;
  artifact: string;
  judgeCheck: string;
}

export interface SubmissionArtifact {
  id: string;
  label: string;
  kind: "plan" | "demo" | "video" | "source" | "audit" | "ops";
  status: SubmissionOpsStatus;
  path: string;
  validation: string;
  riskControl: string;
}

export interface SubmissionManualField {
  id: string;
  label: string;
  owner: "team" | "ops" | "teacher" | "organizer";
  status: SubmissionOpsStatus;
  currentState: string;
  nextAction: string;
}

export interface SubmissionPackageStep {
  id: string;
  label: string;
  status: SubmissionOpsStatus;
  command: string;
  output: string;
  reason: string;
}

export interface SubmissionTimelineItem {
  id: string;
  label: string;
  date: string;
  status: SubmissionOpsStatus;
  action: string;
}

export interface SubmissionCopyCheck {
  id: string;
  label: string;
  platformField: string;
  status: SubmissionOpsStatus;
  textSource: string;
  guardrail: string;
}

export interface SubmissionOpsReport {
  score: number;
  stage: string;
  summary: string;
  readyCount: number;
  watchCount: number;
  manualCount: number;
  blockedCount: number;
  requirements: SubmissionRequirement[];
  artifacts: SubmissionArtifact[];
  manualFields: SubmissionManualField[];
  packageSteps: SubmissionPackageStep[];
  timeline: SubmissionTimelineItem[];
  copyChecks: SubmissionCopyCheck[];
  finalGateCommand: string;
  zipNamePattern: string;
  releaseBoundary: string;
}

function countStatus<T extends { status: SubmissionOpsStatus }>(items: T[], status: SubmissionOpsStatus): number {
  return items.filter((item) => item.status === status).length;
}

function scoreStatus(status: SubmissionOpsStatus): number {
  if (status === "ready") return 1;
  if (status === "watch") return 0.66;
  if (status === "manual") return 0.42;
  return 0;
}

export function buildSubmissionOpsReport(
  state: AppState,
  launchReadiness: LaunchReadinessReport,
  judgeTrial: JudgeTrialReport,
  courseLaunch: CourseLaunchReport,
  awardReadiness: AwardReadinessReport,
  privacyGuard: PrivacyGuardReport,
): SubmissionOpsReport {
  const closedLoopReady = state.events.some((event) => event.type === "ci_passed")
    && state.events.some((event) => event.type === "teacher_reviewed")
    && state.events.some((event) => event.type === "reflection_submitted");
  const privacyReady = privacyGuard.gate === "pass";
  const releaseGateReady = launchReadiness.checks.some((check) => check.id === "local-build" && check.status === "pass");
  const judgeRoutesReady = judgeTrial.routes.filter((route) => route.status === "ready").length >= 3;

  const requirements: SubmissionRequirement[] = [
    {
      id: "project-plan",
      label: "项目计划书",
      officialNeed: "项目计划书以 PDF 或 PPT 提交，文件命名为队伍名+作品名。",
      status: "ready",
      evidence: "184 页产品设计 PDF、DOCX 和 Markdown 源稿已准备；最终队伍名仍需人工确认。",
      artifact: "参赛提交材料包/SE-Path学伴_产品设计与原型验证方案_v0.2.pdf",
      judgeCheck: "打开目录 01_项目计划书，确认 PDF 可读且队伍名最终一致。",
    },
    {
      id: "source-demo",
      label: "源码或可运行 Demo",
      officialNeed: "提交源代码或可运行演示 Demo。",
      status: releaseGateReady ? "ready" : "watch",
      evidence: "本地 React/Vite 工程、Sites 工程、公开静态包和启动说明均进入打包范围。",
      artifact: "sepath-cloud-app/、sepath-sites-app/、参赛提交材料包/公开试用静态包/",
      judgeCheck: "运行 npm run test、npm run build，或直接打开公开静态包。",
    },
    {
      id: "demo-video",
      label: "3-5 分钟演示视频",
      officialNeed: "演示视频需展示智能体与学生交互过程。",
      status: "ready",
      evidence: "4分40秒 MP4、旁白稿、SRT/VTT 字幕已准备；是否叠加真人旁白仍需人工确认。",
      artifact: "参赛提交材料包/演示视频素材/SE-Path学伴_4分40秒演示视频素材_v0.3.mp4",
      judgeCheck: "播放视频，确认覆盖学生对话、干预、教师复核、增值评估和评委试用路线。",
    },
    {
      id: "zip-limit",
      label: "ZIP 与 100MB 限制",
      officialNeed: "多个文件压缩为 ZIP，单文件大小 100MB 以内。",
      status: "ready",
      evidence: "release_gate 和 package 脚本会检查 ZIP 完整性、文件数、大小和敏感信息。",
      artifact: "submission/SE-Path学伴_阶段提交包_v0.4_2026-08-09.zip",
      judgeCheck: "查看 submission manifest，确认 size_under_100mb=true 且 zip_integrity=pass。",
    },
    {
      id: "learning-agent",
      label: "赛题核心能力",
      officialNeed: "覆盖学情诊断、路径规划、实时干预、记忆与反思。",
      status: closedLoopReady ? "ready" : "watch",
      evidence: closedLoopReady
        ? "CI 通过、教师复核和反思记忆均进入 EvidenceEvent。"
        : "继续运行主流程可补齐闭环事件。",
      artifact: "Demo 顶部导航：学生闭环、学生对话、教师周报、评审证据",
      judgeCheck: "从失败 PR 一路检查诊断、脚手架、复核和反思记忆。",
    },
  ];

  const artifacts: SubmissionArtifact[] = [
    {
      id: "quick-read",
      label: "评委速读",
      kind: "plan",
      status: "ready",
      path: "参赛提交材料包/00_评委速读与评分导航.md",
      validation: "把作品定位、演示顺序、评分证据和可复核命令放在首页。",
      riskControl: "先让评委理解作品，不依赖现场口头解释。",
    },
    {
      id: "design-pdf",
      label: "产品设计 PDF/DOCX",
      kind: "plan",
      status: "ready",
      path: "参赛提交材料包/SE-Path学伴_产品设计与原型验证方案_v0.2.pdf",
      validation: "当前 PDF 已导出，最终仍需按队伍名统一命名。",
      riskControl: "不自动填写队伍名和作者信息。",
    },
    {
      id: "stage-zip",
      label: "阶段提交 ZIP",
      kind: "audit",
      status: "ready",
      path: "submission/SE-Path学伴_阶段提交包_v0.4_2026-08-09.zip",
      validation: "由 release_gate 生成并再次运行审计。",
      riskControl: "manifest 作为精确文件数、大小和 SHA 来源，不以 UI 文案为准。",
    },
    {
      id: "public-trial",
      label: "公开试用静态包",
      kind: "demo",
      status: judgeRoutesReady ? "ready" : "watch",
      path: "参赛提交材料包/公开试用静态包/",
      validation: "可上传到 Vercel、Netlify、Cloudflare Pages、OpenAI Sites 或 Nginx。",
      riskControl: "只读合成数据，不要求评委账号。",
    },
    {
      id: "source-app",
      label: "本地源码工程",
      kind: "source",
      status: releaseGateReady ? "ready" : "watch",
      path: "sepath-cloud-app/、sepath-sites-app/",
      validation: "Vitest、Vite build 和 Sites render test 作为基础质量门。",
      riskControl: "node_modules、日志和临时 profile 被排除在 ZIP 外。",
    },
    {
      id: "video-pack",
      label: "视频与字幕",
      kind: "video",
      status: "ready",
      path: "参赛提交材料包/演示视频素材/",
      validation: "MP4、旁白稿、SRT/VTT 字幕已准备。",
      riskControl: "真人旁白、音量和平台格式需最终人工播放确认。",
    },
    {
      id: "readiness-report",
      label: "终审报告",
      kind: "audit",
      status: privacyReady ? "ready" : "blocked",
      path: "参赛提交材料包/09_提交前终审报告.md",
      validation: `当前隐私门禁 ${privacyGuard.gate}，疑似 PII ${privacyGuard.piiFindings}。`,
      riskControl: "若敏感信息命中，必须先脱敏再重新打包。",
    },
  ];

  const manualFields: SubmissionManualField[] = [
    {
      id: "team-profile",
      label: "队伍名与成员信息",
      owner: "team",
      status: "manual",
      currentState: "材料保留待填写占位。",
      nextAction: "以报名系统最终信息为准，统一 PDF、PPT、ZIP、平台字段和封面。",
    },
    {
      id: "file-naming",
      label: "最终文件命名",
      owner: "team",
      status: "manual",
      currentState: "当前为阶段提交包命名。",
      nextAction: "正式提交前改为“队伍名+作品名”的平台要求格式。",
    },
    {
      id: "access-policy",
      label: "云端访问策略",
      owner: "organizer",
      status: "manual",
      currentState: "OpenAI Sites 当前 owner-only；公开静态包可作为替代。",
      nextAction: "按主办方要求选择公开链接、演示账号、静态包或视频兜底。",
    },
    {
      id: "voiceover",
      label: "真人旁白与视频终版",
      owner: "team",
      status: "manual",
      currentState: "字幕素材版已具备提交条件。",
      nextAction: "决定是否补真人旁白，并播放全片核对字幕和节奏。",
    },
    {
      id: "trial-claim",
      label: "真实试点效果声明",
      owner: "teacher",
      status: "manual",
      currentState: "当前为合成回放、确定性算法和试点设计。",
      nextAction: "只宣称可验证闭环和试点设计，不宣称已完成真实长期提分。",
    },
  ];

  const packageSteps: SubmissionPackageStep[] = [
    {
      id: "test-build",
      label: "测试与生产构建",
      status: releaseGateReady ? "ready" : "watch",
      command: "cd sepath-cloud-app && npm run test && npm run build",
      output: "Vitest、TypeScript 和 Vite 生产包。",
      reason: "证明核心算法和前端可运行，而不是只提交设计稿。",
    },
    {
      id: "sites-build",
      label: "云端工程构建",
      status: "ready",
      command: "cd sepath-sites-app && npm test",
      output: "vinext build + server rendered shell test。",
      reason: "证明可上云版本和本地版本同步。",
    },
    {
      id: "public-bundle",
      label: "公开静态包",
      status: "ready",
      command: "python scripts/build_public_trial_bundle.py",
      output: "参赛提交材料包/公开试用静态包/",
      reason: "私有云打不开时仍可试用。",
    },
    {
      id: "release-gate",
      label: "最终发布门禁",
      status: privacyReady ? "ready" : "blocked",
      command: "python scripts/release_gate.py",
      output: "outputs/SE-Path学伴_最终发布门禁报告_机器生成.json",
      reason: "统一检查语法、测试、构建、截图、打包、敏感信息和材料完整性。",
    },
  ];

  const timeline: SubmissionTimelineItem[] = [
    {
      id: "publish",
      label: "赛题发布",
      date: "2026-07-09",
      status: "ready",
      action: "已完成赛题拆解并转化为软件工程自适应伴学方向。",
    },
    {
      id: "deadline",
      label: "初赛截止",
      date: "2026-09-09 24:00",
      status: "watch",
      action: "截止前完成队伍信息、最终命名、视频终版和访问策略确认。",
    },
    {
      id: "review",
      label: "作品集中评审",
      date: "2026-09-10 至 2026-09-25",
      status: "ready",
      action: "评委可使用公开静态包、本地 Demo、视频和源码审计材料。",
    },
    {
      id: "finalist",
      label: "入围名单",
      date: "2026-09-26 10:00",
      status: "watch",
      action: "若入围，优先补真人旁白、真实课程影子运行和答辩演示账号。",
    },
  ];

  const copyChecks: SubmissionCopyCheck[] = [
    {
      id: "short-intro",
      label: "一句话简介",
      platformField: "作品简介/一句话介绍",
      status: "ready",
      textSource: "参赛提交材料包/10_比赛平台填写文案.md",
      guardrail: "强调软件工程项目式学习闭环，不写成通用聊天助教。",
    },
    {
      id: "innovation",
      label: "创新点",
      platformField: "创新亮点/项目特色",
      status: "ready",
      textSource: "证据原生、SafeVOI、PathTwin、课程开班、AI Runtime、评委任务包。",
      guardrail: "说明开源参考是工程底座，不宣称复制外部项目成果。",
    },
    {
      id: "cloud-access",
      label: "演示访问说明",
      platformField: "Demo 地址/使用说明",
      status: "manual",
      textSource: "owner-only Sites + 公开静态包 + 本地 Demo + 视频兜底。",
      guardrail: "正式提交前不能把私有 URL 写成匿名公开可访问。",
    },
    {
      id: "claim-boundary",
      label: "真实性声明",
      platformField: "项目说明/补充说明",
      status: "ready",
      textSource: courseLaunch.riskRegister.find((risk) => risk.id === "uplift-claim")?.mitigation ?? "真实提分等待试点验证。",
      guardrail: "真实学习效果等待课程试点验证，当前只证明闭环、算法和工程可运行。",
    },
  ];

  const allStatuses = [...requirements, ...artifacts, ...manualFields, ...packageSteps, ...timeline, ...copyChecks];
  const readyCount = countStatus(allStatuses, "ready");
  const watchCount = countStatus(allStatuses, "watch");
  const manualCount = countStatus(allStatuses, "manual");
  const blockedCount = countStatus(allStatuses, "blocked");
  const score = Math.round((allStatuses.reduce((sum, item) => sum + scoreStatus(item.status), 0) / allStatuses.length) * 100);

  return {
    score,
    stage: blockedCount > 0 ? "提交阻断需处理" : "阶段提交候选 / 最终人工信息待确认",
    summary:
      blockedCount > 0
        ? "当前仍有敏感信息或发布阻断项，必须先处理再提交。"
        : "官方要求、材料包、源码 Demo、视频、公开试用包、发布门禁和平台文案已经被整理成一张提交清单；剩余项均为必须由参赛队人工确认的信息。",
    readyCount,
    watchCount,
    manualCount,
    blockedCount,
    requirements,
    artifacts,
    manualFields,
    packageSteps,
    timeline,
    copyChecks,
    finalGateCommand: "python scripts/release_gate.py",
    zipNamePattern: "【队伍名】SE-Path学伴_参赛提交包.zip",
    releaseBoundary: `评分证据 ${awardReadiness.totalScore}/${awardReadiness.maxScore}；最终文件数、大小和 SHA 以 submission manifest 为准。`,
  };
}
