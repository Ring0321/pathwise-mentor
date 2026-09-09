import type { AwardReadinessReport } from "../domain/types";
import type { ClaimEvidenceLedgerReport } from "./claimEvidenceLedger";
import type { FinalSubmissionReport } from "./finalSubmission";
import type { HostingSelftestReport } from "./hostingSelftest";
import type { JudgeVerificationReport } from "./judgeVerification";

export type CompetitionAlignmentStatus = "pass" | "ready" | "manual";

export interface CompetitionCoreAlignment {
  id: string;
  requirement: string;
  officialPoint: string;
  productAnswer: string;
  demoAnchor: string;
  sourceEvidence: string[];
  materialEvidence: string[];
  judgeProbe: string;
  boundary: string;
  status: CompetitionAlignmentStatus;
}

export interface CompetitionScoreAlignment {
  id: string;
  criterion: string;
  weight: number;
  productAnswer: string;
  demoAnchor: string;
  evidence: string[];
  status: CompetitionAlignmentStatus;
}

export interface CompetitionSubmissionAlignment {
  id: string;
  requirement: string;
  evidence: string[];
  acceptance: string;
  status: CompetitionAlignmentStatus;
}

export interface CompetitionAlignmentReport {
  runtime: string;
  score: number;
  stage: string;
  summary: string;
  passCount: number;
  readyCount: number;
  manualCount: number;
  coreCapabilities: CompetitionCoreAlignment[];
  preliminaryScores: CompetitionScoreAlignment[];
  finalScores: CompetitionScoreAlignment[];
  submissionRequirements: CompetitionSubmissionAlignment[];
  firstPrizeMoves: string[];
  forbiddenClaims: string[];
  materialPath: string;
  manifestPath: string;
  boundary: string;
  manifest: string;
}

function countStatus<T extends { status: CompetitionAlignmentStatus }>(
  rows: T[],
  status: CompetitionAlignmentStatus,
): number {
  return rows.filter((row) => row.status === status).length;
}

function statusScore(status: CompetitionAlignmentStatus): number {
  if (status === "pass") return 1;
  if (status === "ready") return 0.82;
  return 0.62;
}

export function buildCompetitionAlignmentReport(
  awardReadiness: AwardReadinessReport,
  claimLedger: ClaimEvidenceLedgerReport,
  finalSubmission: FinalSubmissionReport,
  hostingSelftest: HostingSelftestReport,
  judgeVerification: JudgeVerificationReport,
): CompetitionAlignmentReport {
  const hostingReady = hostingSelftest.stage.includes("ready");
  const judgeReady = judgeVerification.score >= 85;
  const packageReady = finalSubmission.uploadRoutes.some((route) => route.id === "single-zip" && route.status === "ready");
  const claimLedgerReady = claimLedger.score >= 85 && claimLedger.productAnchor === "#claim-ledger";
  const awardWeight = awardReadiness.criteria.reduce((sum, item) => sum + item.maxScore, 0);

  const coreCapabilities: CompetitionCoreAlignment[] = [
    {
      id: "diagnosis",
      requirement: "学情诊断",
      officialPoint: "通过对话或测试动态分析知识掌握情况，构建学生画像。",
      productAnswer: "PR、CI、Issue、Rubric、对话、修复与反思统一写入 EvidenceEvent，再生成软件工程能力诊断卡。",
      demoAnchor: "#student / #dialogue",
      sourceEvidence: ["src/engine/diagnosis.ts", "src/engine/evidence.ts"],
      materialEvidence: ["00_评委速读与评分导航.md", "25_学生对话实验台与智能干预说明.md"],
      judgeProbe: "点击提交失败 PR 或学生对话，检查诊断卡与证据账本是否同步变化。",
      boundary: "当前演示使用合成课程事件；真实班级画像需按试点门禁接入。",
      status: "pass",
    },
    {
      id: "path-planning",
      requirement: "路径规划",
      officialPoint: "基于学生画像与知识图谱，动态生成个性化学习路径。",
      productAnswer: "路径数字孪生记录节点状态、阻塞原因、证据来源与下一步行动，SafeVOI 负责行动排序。",
      demoAnchor: "#strategy-lab / #value",
      sourceEvidence: ["src/engine/pathTwin.ts", "src/engine/safeVoi.ts"],
      materialEvidence: ["13_算法验证与科研证据说明.md", "17_策略实验室与SafeVOI对照仿真说明.md"],
      judgeProbe: "对比普通聊天、固定路径与 SafeVOI 闭环在同一事件下的行动选择。",
      boundary: "路径规划证明为可解释决策逻辑，不提前宣称真实长期提分。",
      status: awardReadiness.totalScore >= 90 ? "pass" : "ready",
    },
    {
      id: "intervention",
      requirement: "实时干预",
      officialPoint: "学生遇到困难时提供针对性脚手架辅导，而不是直接给答案。",
      productAnswer: "脚手架引擎把求助转为提示层级、mini lab、检查清单和教师发布门，高风险替写会被拦截。",
      demoAnchor: "#dialogue / #launch-loop",
      sourceEvidence: ["src/engine/scaffold.ts", "src/engine/interventionPlaybook.ts"],
      materialEvidence: ["25_学生对话实验台与智能干预说明.md", "42_干预发布与教学行动包中心说明.md"],
      judgeProbe: "输入直接给我完整代码，确认系统拒绝替写并转为排查脚手架。",
      boundary: "AI 表达层不能绕过 SafeVOI、隐私门和教师复核门。",
      status: judgeReady ? "pass" : "ready",
    },
    {
      id: "memory-reflection",
      requirement: "记忆与反思",
      officialPoint: "具备长期记忆能力，能在多次交互中持续优化学习计划。",
      productAnswer: "学生反思、教师复核、CI 结果和课程事件回写 EvidenceEvent，支持下一轮诊断、路径与主张证据账本。",
      demoAnchor: "#claim-ledger / #teacher-report",
      sourceEvidence: ["src/engine/eventIngestion.ts", "src/engine/claimEvidenceLedger.ts"],
      materialEvidence: ["19_证据账本导入恢复与工作空间迁移说明.md", "62_主张证据账本与真实性核验包.md"],
      judgeProbe: "完成一轮 CI 修复和反思后，检查证据账本、教师周报与下一步路径是否更新。",
      boundary: "长期记忆只保存脱敏学习证据和合成演示样本。",
      status: claimLedgerReady ? "pass" : "ready",
    },
  ];

  const preliminaryScores: CompetitionScoreAlignment[] = [
    {
      id: "agent-architecture",
      criterion: "智能体架构设计",
      weight: 30,
      productAnswer: "确定性策略内核、可选 LLM 表达层、GraphRAG 边界、工具调用、教师发布门和审计 Trace 共用同一证据链。",
      demoAnchor: "#ai-runtime / #inference-gateway",
      evidence: ["29_AI Agent运行时与模型接入中心说明.md", "37_推理网关与GraphRAG试验台说明.md"],
      status: "pass",
    },
    {
      id: "adaptive-strategy",
      criterion: "自适应策略",
      weight: 25,
      productAnswer: "EvidenceEvent 驱动 PathTwin，SafeVOI 同时考虑学习收益、风险、可逆性和证据覆盖。",
      demoAnchor: "#strategy-lab / #value",
      evidence: ["13_算法验证与科研证据说明.md", "27_学习增值评估中心与科研算法融合说明.md"],
      status: awardWeight === 100 ? "pass" : "ready",
    },
    {
      id: "feature-completeness",
      criterion: "功能完整程度",
      weight: 20,
      productAnswer: "学生、教师、评委、后台、云交付、PWA、API、SLO、上传回执和本地兜底均形成可运行链路。",
      demoAnchor: "#reviewer-drill / #backend-status",
      evidence: ["46_评委技术验收包.md", "50_评委5分钟实操演练与教师复核深潜说明.md"],
      status: judgeReady && packageReady ? "pass" : "ready",
    },
    {
      id: "innovation-experience",
      criterion: "创新性与体验",
      weight: 15,
      productAnswer: "软件工程项目证据、科研算法迁移、开源创新矩阵和评委 300 秒导览被做成产品体验。",
      demoAnchor: "#research-fusion / #reviewer-guide",
      evidence: ["08_开源项目创新矩阵.md", "61_一等奖差异化创新证据包.md"],
      status: "pass",
    },
    {
      id: "commercial-value",
      criterion: "商业价值",
      weight: 10,
      productAnswer: "高校课程、企业新人训练和产教融合可复用多租户、数据平面、账号初始化和试点证据门禁。",
      demoAnchor: "#tenantops / #data-plane",
      evidence: ["34_多租户上云运营中心说明.md", "58_真实课程试点证据归档与声明门禁说明.md"],
      status: "ready",
    },
  ];

  const finalScores: CompetitionScoreAlignment[] = [
    {
      id: "roadshow-function",
      criterion: "功能实现情况",
      weight: 40,
      productAnswer: "现场可演示学生闭环、教师复核、评委演练、后端状态、云交付和提交助手。",
      demoAnchor: "#judge-verification",
      evidence: ["50_评委5分钟实操演练与教师复核深潜说明.md", "qa/screenshots/judge-verification-panel.png"],
      status: judgeReady ? "pass" : "ready",
    },
    {
      id: "roadshow-tech",
      criterion: "技术水平",
      weight: 30,
      productAnswer: "OpenAPI、Edge API、LLM Gateway、GraphRAG 边界、SLO 压测、PWA、release gate 和一致性校验均可复核。",
      demoAnchor: "#backend-status",
      evidence: ["44_EdgeAPI运行时与后端接口验收说明.md", "submission/release_consistency_report.json"],
      status: judgeReady && hostingReady ? "pass" : "ready",
    },
    {
      id: "roadshow-market",
      criterion: "市场接受度",
      weight: 10,
      productAnswer: "课程试点工作台、教师运营看板、多租户运营和真实试点证据归档说明可推广路径。",
      demoAnchor: "#tenantops",
      evidence: ["15_班级GrowthOps与教师运营看板方案.md", "34_多租户上云运营中心说明.md"],
      status: "ready",
    },
    {
      id: "roadshow-materials",
      criterion: "文档及演示视频清晰度",
      weight: 20,
      productAnswer: "产品设计 PDF、答辩 PPT、4分40秒视频素材、评委一键入口、3/5/10 分钟路线和提交作战手册齐备。",
      demoAnchor: "#pitch-director",
      evidence: ["SE-Path学伴_产品设计与原型验证方案_v0.2.pdf", "00_评委一键打开入口.html"],
      status: packageReady ? "pass" : "ready",
    },
  ];

  const submissionRequirements: CompetitionSubmissionAlignment[] = [
    {
      id: "plan-pdf-ppt",
      requirement: "项目计划书 PDF/PPT",
      evidence: ["SE-Path学伴_产品设计与原型验证方案_v0.2.pdf", "SE-Path学伴_答辩PPT_v0.2.pptx"],
      acceptance: "文件存在且纳入最终提交 ZIP。",
      status: packageReady ? "pass" : "ready",
    },
    {
      id: "source-demo",
      requirement: "源码或可运行 Demo",
      evidence: ["sepath-cloud-app/src/App.tsx", "公开试用静态包/index.html"],
      acceptance: "源码、公开静态包和本地运行自检包齐备。",
      status: packageReady ? "pass" : "ready",
    },
    {
      id: "demo-video",
      requirement: "3-5 分钟演示视频",
      evidence: ["演示视频素材/SE-Path学伴_4分40秒演示视频素材_v0.3.mp4", "02_演示视频脚本_3-5分钟.md"],
      acceptance: "视频素材、旁白稿、字幕和复剪建议齐备。",
      status: packageReady ? "pass" : "ready",
    },
    {
      id: "architecture-knowledge",
      requirement: "技术架构与知识库构建说明",
      evidence: ["figures/plantuml/15_推理网关与GraphRAG试验台.puml", "37_推理网关与GraphRAG试验台说明.md"],
      acceptance: "PlantUML 架构图和 GraphRAG/知识边界说明同时存在。",
      status: "pass",
    },
    {
      id: "originality-sensitive",
      requirement: "原创性与敏感信息处理",
      evidence: ["05_真实性与边界声明.md", "68_正式提交填报工作台与人工门禁补全卡.md"],
      acceptance: "团队信息保留人工门禁，不编造；敏感信息和真实数据边界明确。",
      status: claimLedgerReady ? "pass" : "ready",
    },
    {
      id: "public-delivery",
      requirement: "最终公网/上线交付",
      evidence: ["public-site-upload/SE-Path学伴_公开静态站点上传包_v0.1.zip", "67_静态托管平台配置自检与故障恢复卡.md"],
      acceptance: "公开静态上传包 ready；最终外部 URL 仍需部署后回执。",
      status: hostingReady ? "ready" : "manual",
    },
  ];

  const allRows = [...coreCapabilities, ...preliminaryScores, ...finalScores, ...submissionRequirements];
  const passCount = countStatus(allRows, "pass");
  const readyCount = countStatus(allRows, "ready");
  const manualCount = countStatus(allRows, "manual");
  const score = Math.round((allRows.reduce((sum, row) => sum + statusScore(row.status), 0) / allRows.length) * 100);
  const runtime = "sepath-competition-alignment-center.v1";

  return {
    runtime,
    score,
    stage: score >= 90 ? "official requirement alignment ready" : "alignment needs review",
    summary:
      "把赛题四项核心能力、初赛评分、决赛评分、提交要求和禁止夸大声明放进产品内同一张证据矩阵，评委可以从页面直接跳到对应材料和源码锚点。",
    passCount,
    readyCount,
    manualCount,
    coreCapabilities,
    preliminaryScores,
    finalScores,
    submissionRequirements,
    firstPrizeMoves: [
      "把任务要求讲成证据闭环，而不是功能列表。",
      "把智能拆成可治理架构，而不是大模型黑箱。",
      "把科研路径增值思想迁移到软件工程课程。",
      "把上云和提交也做成产品能力。",
      "主动声明边界，换取评委信任。",
    ],
    forbiddenClaims: [
      "不能宣称合成 Demo 已证明真实班级长期显著提分。",
      "不能把 owner-only 云端链接说成最终公开公网 URL。",
      "不能把开源项目参考说成复制源码或使用其私有数据。",
      "不能让模型绕过教师复核门自动发布高风险干预。",
      "不能在公开包中放入真实学生隐私、API Key 或生产数据库地址。",
    ],
    materialPath: "参赛提交材料包/69_赛题要求逐项对齐矩阵与夺奖证据总表.md",
    manifestPath: "参赛提交材料包/competition-requirement-alignment/COMPETITION_REQUIREMENT_ALIGNMENT.json",
    boundary:
      "产品内对齐矩阵证明当前作品对官方要求的证据覆盖；最终队伍信息、外部公网 URL、视频版本和真实课程试点主张仍需人工确认。",
    manifest: JSON.stringify(
      {
        runtime,
        productAnchor: "#competition-alignment",
        officialCoreCapabilities: coreCapabilities.map((item) => item.requirement),
        preliminaryWeight: preliminaryScores.reduce((sum, item) => sum + item.weight, 0),
        finalWeight: finalScores.reduce((sum, item) => sum + item.weight, 0),
        submissionRequirements: submissionRequirements.length,
        score,
        manualGates: submissionRequirements.filter((item) => item.status === "manual").map((item) => item.id),
        materialPath: "69_赛题要求逐项对齐矩阵与夺奖证据总表.md",
      },
      null,
      2,
    ),
  };
}
