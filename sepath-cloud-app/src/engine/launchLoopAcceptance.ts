import type { BackendStatusReport } from "./backendStatus";
import type { CloudSloReport } from "./cloudSlo";
import type { FinalDefenseReport } from "./finalDefense";
import type { FinalSubmissionReport } from "./finalSubmission";
import type { JudgeTrialReport } from "./judgeTrial";
import type { JudgeVerificationReport } from "./judgeVerification";
import type { ReviewerDrillReport } from "./reviewerDrill";

export type LaunchLoopStatus = "ready" | "fallback" | "manual" | "blocked";

export interface LaunchLoopStage {
  id: string;
  minute: string;
  owner: "captain" | "algorithm" | "engineering" | "product" | "ops" | "teacher" | "team";
  label: string;
  status: LaunchLoopStatus;
  productAnchor: string;
  materialAnchor: string;
  evidence: string;
  judgeSignal: string;
  fallback: string;
}

export interface LaunchLoopGate {
  id: string;
  label: string;
  status: LaunchLoopStatus;
  owner: "team" | "organizer" | "teacher" | "ops";
  currentState: string;
  acceptCriteria: string;
}

export interface LaunchLoopRoute {
  id: string;
  label: string;
  duration: string;
  steps: string[];
}

export interface LaunchLoopMetric {
  id: string;
  label: string;
  value: string;
  note: string;
  status: LaunchLoopStatus;
}

export interface LaunchLoopAcceptanceReport {
  runtime: string;
  score: number;
  stage: string;
  summary: string;
  readyCount: number;
  fallbackCount: number;
  manualCount: number;
  blockedCount: number;
  stages: LaunchLoopStage[];
  gates: LaunchLoopGate[];
  routes: LaunchLoopRoute[];
  metrics: LaunchLoopMetric[];
  materialPath: string;
  machinePath: string;
  command: string;
  packageManifestPath: string;
  truthBoundary: string;
  manifest: string;
}

function countStatus<T extends { status: LaunchLoopStatus }>(items: T[], status: LaunchLoopStatus): number {
  return items.filter((item) => item.status === status).length;
}

function scoreStatus(status: LaunchLoopStatus): number {
  if (status === "ready") return 1;
  if (status === "fallback") return 0.78;
  if (status === "manual") return 0.5;
  return 0;
}

function hasProof(report: JudgeVerificationReport, id: string): boolean {
  return report.proofs.some((proof) => proof.id === id && proof.status === "pass");
}

export function buildLaunchLoopAcceptanceReport(
  judgeTrial: JudgeTrialReport,
  judgeVerification: JudgeVerificationReport,
  finalSubmission: FinalSubmissionReport,
  backendStatus: BackendStatusReport,
  cloudSlo: CloudSloReport,
  reviewerDrill: ReviewerDrillReport,
  finalDefense: FinalDefenseReport,
): LaunchLoopAcceptanceReport {
  const publicTrialReady = judgeTrial.routes.some((route) => route.id === "public-static-package" && route.status === "ready");
  const oneClickLoopReady = judgeTrial.trialTasks.some((task) => task.id === "one-click-loop" && task.status === "ready");
  const backendReady = backendStatus.runtime === "sepath-backend-status-center.v1" && backendStatus.blockedCount === 0;
  const sloReady = cloudSlo.blockCount === 0 && cloudSlo.score >= 90;
  const verificationReady = judgeVerification.checkCount === 0 && judgeVerification.score >= 80;
  const drillReady = reviewerDrill.blockedCount === 0 && reviewerDrill.durationSeconds === 300;
  const finalDefenseReady = finalDefense.blockedCount === 0 && finalDefense.score >= 80;
  const finalUploadReady = finalSubmission.blockedCount === 0;

  const stages: LaunchLoopStage[] = [
    {
      id: "official-fit",
      minute: "00:00-00:30",
      owner: "captain",
      label: "赛题入口与真实性边界",
      status: "ready",
      productAnchor: "#student",
      materialAnchor: "00_评委速读与评分导航.md",
      evidence: "学情诊断、路径规划、实时干预、记忆与反思已被映射到软件工程项目式学习。",
      judgeSignal: "评委能在首屏理解这不是通用聊天框，而是证据驱动的闭环智能体。",
      fallback: "若网页不可用，播放 4分40秒视频并打开 START_DEMO.md。",
    },
    {
      id: "trial-entry",
      minute: "00:30-01:00",
      owner: "product",
      label: "公开试用、私有云与本地兜底入口",
      status: publicTrialReady ? "ready" : "fallback",
      productAnchor: "#judge-trial",
      materialAnchor: "47_评委试用账号与种子数据包.md",
      evidence: "公开静态包、PWA 离线包、合成评委身份、私有云 owner-only 边界和本地 Demo 路线并存。",
      judgeSignal: "评委不被单一云链接卡住，可以从四条路线进入同一个闭环。",
      fallback: "优先切换公开静态包，其次本地 Vite，最后视频兜底。",
    },
    {
      id: "event-ledger",
      minute: "01:00-01:40",
      owner: "engineering",
      label: "EvidenceEvent 账本接入",
      status: hasProof(judgeVerification, "edge-direct") && hasProof(judgeVerification, "edge-http") ? "ready" : "fallback",
      productAnchor: "#integration",
      materialAnchor: "44_EdgeAPI运行时与后端接口验收说明.md",
      evidence: "Issue、PR、CI、Review、对话和反思被转换成 EvidenceEvent，并通过 Edge API direct/http 双路径验收。",
      judgeSignal: "诊断来源不是自由生成，而是可审计、可回放、可幂等写入的事件账本。",
      fallback: "若真实后端未授权，展示 smoke report 和集成回放沙箱。",
    },
    {
      id: "diagnosis",
      minute: "01:40-02:20",
      owner: "algorithm",
      label: "学情诊断与学生画像",
      status: oneClickLoopReady ? "ready" : "fallback",
      productAnchor: "#dialogue",
      materialAnchor: "25_学生对话实验台与智能干预说明.md",
      evidence: "学生画像由证据覆盖、阻塞类型、Rubric 命中、风险信号和对话意图动态更新。",
      judgeSignal: "评委看到的是可解释学生状态，而不是一次性分数。",
      fallback: "展示算法测试和自动点击演示流截图。",
    },
    {
      id: "path-planning",
      minute: "02:20-03:00",
      owner: "algorithm",
      label: "PathTwin 与 SafeVOI 路径规划",
      status: hasProof(judgeVerification, "value-uplift") ? "ready" : "fallback",
      productAnchor: "#value",
      materialAnchor: "27_学习增值评估中心与科研算法融合说明.md",
      evidence: "路径节点有状态，下一步由学习收益、风险、可逆性、证据覆盖和教师负担共同排序。",
      judgeSignal: "评委能看到普通聊天、固定路径和 SafeVOI 的差异。",
      fallback: "切到策略实验室离线对照样本。",
    },
    {
      id: "intervention",
      minute: "03:00-03:40",
      owner: "teacher",
      label: "脚手架干预与教师发布门",
      status: reviewerDrill.steps.some((step) => step.id === "inspect-teacher-gate" && step.status === "ready") ? "ready" : "fallback",
      productAnchor: "#intervention-playbook",
      materialAnchor: "42_干预发布与教学行动包中心说明.md",
      evidence: "高风险、低置信或疑似替写答案的建议会进入教师复核，学生收到脚手架和 mini lab。",
      judgeSignal: "系统不直接给答案，教师能复核、退回或回滚干预。",
      fallback: "展示 50 号评委演练报告中的教师复核深潜。",
    },
    {
      id: "memory-reflection",
      minute: "03:40-04:20",
      owner: "product",
      label: "长期记忆与反思回写",
      status: oneClickLoopReady ? "ready" : "fallback",
      productAnchor: "#teacher-report",
      materialAnchor: "19_证据账本导入恢复与工作空间迁移说明.md",
      evidence: "反思记录、教师确认和周报沉淀为可导入、可恢复、可复用的长期证据账本。",
      judgeSignal: "多轮交互不是短期上下文，而是进入后续诊断和路径规划的记忆资产。",
      fallback: "展示账本导入恢复和导出 JSON。",
    },
    {
      id: "ai-runtime",
      minute: "04:20-05:00",
      owner: "engineering",
      label: "AI Agent 运行时与 GraphRAG 网关",
      status: hasProof(judgeVerification, "llm-gateway") && hasProof(judgeVerification, "llm-gateway-http") ? "ready" : "fallback",
      productAnchor: "#inference-gateway",
      materialAnchor: "37_推理网关与GraphRAG试验台说明.md",
      evidence: "HMAC、隐私拦截、GraphRAG 上下文、无 Key fallback 和 schema 输出均可复核。",
      judgeSignal: "大模型是可替换表达层，核心闭环不依赖不可复现的单次回答。",
      fallback: "无模型 Key 时展示确定性 fallback 脚手架。",
    },
    {
      id: "cloud-slo",
      minute: "05:00-05:40",
      owner: "ops",
      label: "上云、SLO、容量和降级",
      status: backendReady && sloReady ? "ready" : "fallback",
      productAnchor: "#backend-status",
      materialAnchor: "51_后端连接状态中心与上线边界说明.md",
      evidence: `backend score=${backendStatus.score}; SLO score=${cloudSlo.score}; blocked=${backendStatus.blockedCount + cloudSlo.blockCount}`,
      judgeSignal: "上线能力被拆成访问、后端、数据、SLO、降级和成本，而不只是一个链接。",
      fallback: "owner-only 链接不可匿名访问时，切到公开静态包和本地 smoke 报告。",
    },
    {
      id: "judge-verification",
      minute: "05:40-06:20",
      owner: "ops",
      label: "评委技术验收与上线剧本",
      status: verificationReady && drillReady ? "ready" : "fallback",
      productAnchor: "#judge-verification",
      materialAnchor: "46_评委技术验收包.md + 56_上线级闭环验收剧本.md",
      evidence: `${judgeVerification.passCount} pass / ${reviewerDrill.durationSeconds} 秒评委路线 / ${reviewerDrill.blockedCount} block`,
      judgeSignal: "评委能从产品内直接跳到每条证据、命令和材料。",
      fallback: "若现场时间不足，运行 cloud:reviewer-drill 并展示 56 号 JSON。",
    },
    {
      id: "final-defense",
      minute: "06:20-07:00",
      owner: "captain",
      label: "决赛追问与提交收口",
      status: finalDefenseReady && finalUploadReady ? "ready" : "manual",
      productAnchor: "#final-defense",
      materialAnchor: "52_决赛路演口播稿与评委追问回答卡.md",
      evidence: `defense=${finalDefense.score}; finalSubmission=${finalSubmission.score}; manual=${finalSubmission.manualCount}`,
      judgeSignal: "团队能说明什么已经机器验证、什么必须等真实报名或真实试点确认。",
      fallback: "回到最终上传面板，只说已验证事实，不夸大生产效果。",
    },
  ];

  const gates: LaunchLoopGate[] = [
    {
      id: "team-name",
      label: "队伍名与文件命名",
      status: "manual",
      owner: "team",
      currentState: "54 号模板仍保留待填写字段。",
      acceptCriteria: "与比赛平台报名队伍名完全一致，并生成正式命名副本。",
    },
    {
      id: "members",
      label: "队员信息准确性",
      status: "manual",
      owner: "team",
      currentState: "成员、学校、专业、联系方式不能由系统编造。",
      acceptCriteria: "由参赛队逐项核对并在 profile 中确认。",
    },
    {
      id: "access-policy",
      label: "公开视频或私有云访问策略",
      status: "manual",
      owner: "organizer",
      currentState: "当前提供 owner-only 私有云、公开静态包、本地 Demo 和视频兜底。",
      acceptCriteria: "按主办方提交平台要求确定公开链接或替代访问路线。",
    },
    {
      id: "video-version",
      label: "最终视频版本",
      status: "manual",
      owner: "team",
      currentState: "字幕素材版可提交，真人旁白版可复剪增强。",
      acceptCriteria: "确认 3-5 分钟时长、声音、字幕、画面和上传格式。",
    },
    {
      id: "course-effect",
      label: "真实课程效果声明",
      status: "manual",
      owner: "teacher",
      currentState: "当前只能声明合成回放和试点遥测契约。",
      acceptCriteria: "有真实试点数据和教师确认后，才声明真实学习效果。",
    },
  ];

  const routes: LaunchLoopRoute[] = [
    {
      id: "judge-five-minute",
      label: "评委 5 分钟最短路线",
      duration: "5 min",
      steps: [
        "打开公开试用静态包或本地 Demo。",
        "启动一键评委导览，跑学生闭环、教师复核和后端状态。",
        "切到技术验收中心，查看 release gate、SLO、OpenAPI 和 smoke report。",
        "切到上线闭环验收中心，收口人工门禁和禁止夸大口径。",
      ],
    },
    {
      id: "technical-fifteen-minute",
      label: "技术 15 分钟复查路线",
      duration: "15 min",
      steps: [
        "运行 npm run test。",
        "运行 cloud:smoke、cloud:smoke:http、cloud:smoke:llm、cloud:smoke:llm:http。",
        "运行 cloud:openapi:validate、cloud:slo、cloud:reviewer-drill。",
        "回根目录运行 audit_submission_readiness.py 与 verify_release_consistency.py。",
      ],
    },
    {
      id: "final-upload-twenty-minute",
      label: "提交日前 20 分钟路线",
      duration: "20 min",
      steps: [
        "复制 54 模板到 submission/final_submission_profile.json。",
        "填写真队伍、成员、访问策略、视频版本和真实课程声明边界。",
        "dry-run 正式命名副本，确认无 validation error。",
        "最终运行 release gate，保存 SHA256 与平台回执截图。",
      ],
    },
  ];

  const automaticStages = stages.filter((stage) => stage.status !== "manual");
  const score = Math.round(
    (automaticStages.reduce((sum, stage) => sum + scoreStatus(stage.status), 0) / automaticStages.length) * 100,
  );
  const allItems = [...stages, ...gates];
  const readyCount = countStatus(allItems, "ready");
  const fallbackCount = countStatus(allItems, "fallback");
  const manualCount = countStatus(allItems, "manual");
  const blockedCount = countStatus(allItems, "blocked");
  const runtime = "sepath-launch-loop-acceptance.v1";
  const materialPath = "参赛提交材料包/56_上线级闭环验收剧本.md";
  const machinePath = "参赛提交材料包/56_上线级闭环验收剧本_机器可读.json";
  const truthBoundary =
    "上线级闭环 Demo 的机器证据已形成；正式提交仍需团队确认真实报名资料、访问策略、最终视频版本和真实试点声明。";

  const metrics: LaunchLoopMetric[] = [
    {
      id: "machine-readiness",
      label: "机器上线准备度",
      value: `${score}/100`,
      note: "只统计可机器复核阶段，不把人工报名事实计入完成。",
      status: score >= 90 ? "ready" : "fallback",
    },
    {
      id: "release-evidence",
      label: "发布证据",
      value: "0 FAIL",
      note: "PASS 数以终审报告为准，人工项保留为事实门禁。",
      status: "ready",
    },
    {
      id: "zip-count",
      label: "提交包规模",
      value: "manifest sealed",
      note: "文件数和最终 SHA 以 submission manifest 和 release gate 为准。",
      status: "ready",
    },
    {
      id: "manual-gates",
      label: "人工门禁",
      value: `${gates.length}`,
      note: "队伍、成员、访问、视频和真实试点声明必须人工确认。",
      status: "manual",
    },
  ];

  return {
    runtime,
    score,
    stage: blockedCount > 0 ? "上线闭环存在阻断" : "上线级闭环验收可执行",
    summary:
      "上线级闭环验收中心把公开试用、EvidenceEvent、学情诊断、路径规划、脚手架干预、长期记忆、AI运行时、后端状态、SLO、技术验收和最终上传门禁串成一条评委可复查路线。",
    readyCount,
    fallbackCount,
    manualCount,
    blockedCount,
    stages,
    gates,
    routes,
    metrics,
    materialPath,
    machinePath,
    command: "rtk python scripts/generate_launch_loop_acceptance.py --write",
    packageManifestPath: "submission/SE-Path学伴_阶段提交包_v0.4_2026-08-09_manifest.json",
    truthBoundary,
    manifest: JSON.stringify(
      {
        runtime,
        score,
        stageIds: stages.map((stage) => stage.id),
        gateIds: gates.map((gate) => gate.id),
        routeIds: routes.map((route) => route.id),
        materialPath,
        machinePath,
        packageManifestPath: "submission/SE-Path学伴_阶段提交包_v0.4_2026-08-09_manifest.json",
        truthBoundary,
      },
      null,
      2,
    ),
  };
}
