import type { AppState } from "../domain/types";
import type { JudgeVerificationReport } from "./judgeVerification";
import type { LaunchLoopAcceptanceReport } from "./launchLoopAcceptance";
import type { PilotEvidenceBinderReport } from "./pilotEvidenceBinder";
import type { ResearchFusionReport } from "./researchFusion";
import type { ReviewerDrillReport } from "./reviewerDrill";
import type { TrialTelemetryReport } from "./trialTelemetry";
import type { ValueUpliftReport } from "./valueUplift";

export type ClaimTierId = "L0" | "L1" | "L2" | "L3";
export type ClaimLedgerStatus = "proved" | "ready" | "manual" | "blocked";

export interface ClaimTierDefinition {
  id: ClaimTierId;
  label: string;
  status: ClaimLedgerStatus;
  canSay: string;
  cannotSay: string;
  evidenceThreshold: string;
}

export interface ClaimEvidenceReference {
  path: string;
  kind: "product" | "material" | "source" | "command" | "test";
  signal: string;
}

export interface ClaimEvidenceItem {
  id: string;
  tier: ClaimTierId;
  status: ClaimLedgerStatus;
  label: string;
  allowedWording: string;
  forbiddenWording: string;
  evidencePaths: ClaimEvidenceReference[];
  productSignals: string[];
  verification: string;
  riskIfOverstated: string;
}

export interface ForbiddenClaimRule {
  id: string;
  forbidden: string;
  safeAlternative: string;
  evidenceBoundary: string;
}

export interface ClaimLedgerMetric {
  id: string;
  label: string;
  value: string;
  note: string;
  status: ClaimLedgerStatus;
}

export interface ClaimEvidenceLedgerReport {
  runtime: string;
  evidenceScope: string;
  productAnchor: string;
  score: number;
  stage: string;
  summary: string;
  provedCount: number;
  readyCount: number;
  manualCount: number;
  blockedCount: number;
  claimTiers: ClaimTierDefinition[];
  metrics: ClaimLedgerMetric[];
  claims: ClaimEvidenceItem[];
  forbiddenClaims: ForbiddenClaimRule[];
  judgeAnswerScript: string[];
  materialPath: string;
  machinePath: string;
  command: string;
  truthBoundary: string;
  manifest: string;
}

function countStatus<T extends { status: ClaimLedgerStatus }>(items: T[], status: ClaimLedgerStatus): number {
  return items.filter((item) => item.status === status).length;
}

function scoreStatus(status: ClaimLedgerStatus): number {
  if (status === "proved") return 1;
  if (status === "ready") return 0.82;
  if (status === "manual") return 0.52;
  return 0;
}

function hasEvent(state: AppState, type: string): boolean {
  return state.events.some((event) => event.type === type);
}

function ref(
  path: string,
  kind: ClaimEvidenceReference["kind"],
  signal: string,
): ClaimEvidenceReference {
  return { path, kind, signal };
}

export function buildClaimEvidenceLedgerReport(
  state: AppState,
  valueUplift: ValueUpliftReport,
  trialTelemetry: TrialTelemetryReport,
  pilotEvidenceBinder: PilotEvidenceBinderReport,
  researchFusion: ResearchFusionReport,
  reviewerDrill: ReviewerDrillReport,
  judgeVerification: JudgeVerificationReport,
  launchLoop: LaunchLoopAcceptanceReport,
): ClaimEvidenceLedgerReport {
  const hasCiPair = hasEvent(state, "ci_failed") && hasEvent(state, "ci_passed");
  const hasTeacherReview = hasEvent(state, "teacher_reviewed");
  const hasReflection = hasEvent(state, "reflection_submitted");
  const machineReleaseReady =
    judgeVerification.score >= 80 &&
    judgeVerification.checkCount === 0 &&
    launchLoop.score >= 90 &&
    reviewerDrill.blockedCount === 0;
  const pilotReady = pilotEvidenceBinder.blockedCount === 0 && trialTelemetry.blockedCount === 0;
  const valueBoundaryBlocked = valueUplift.claims.some((claim) => claim.id === "real-score-claim" && !claim.allowed);

  const claimTiers: ClaimTierDefinition[] = [
    {
      id: "L0",
      label: "工程 Demo 与材料机器验证",
      status: machineReleaseReady ? "proved" : "ready",
      canSay: "可以声明当前 Demo、公开试用包、测试、演示视频和机器审计证明闭环可运行。",
      cannotSay: "不能把 L0 说成真实学校生产接入或真实课程效果。",
      evidenceThreshold: "release gate、自动审计、评委 300 秒演练、公开静态包和源码测试。",
    },
    {
      id: "L1",
      label: "真实课程影子试点可启动",
      status: pilotReady ? "ready" : "manual",
      canSay: "可以声明已经准备好授权、脱敏、影子运行、教师周报、no-pii-export 和声明门禁。",
      cannotSay: "不能说已经采集真实学生生产数据。",
      evidenceThreshold: "学校授权、匿名数据契约、教师周报、试点证据装订包和隐私门禁。",
    },
    {
      id: "L2",
      label: "教师确认干预待授权",
      status: hasTeacherReview ? "manual" : "blocked",
      canSay: "拿到授权和教师签收后，可以分级声明教师确认干预与等待组或 A/B 结果。",
      cannotSay: "在没有授权试点数据前不能宣称真实提分。",
      evidenceThreshold: "教师签收、A/B 或等待组、事件配对、Rubric 一致性和匿名分析快照。",
    },
    {
      id: "L3",
      label: "受控效果结论",
      status: "blocked",
      canSay: "只有多班级、多轮、预注册、样本量说明、负面结果记录和复现实验包齐全后才能声明受控效果。",
      cannotSay: "当前阶段不能宣称长期因果学习增益。",
      evidenceThreshold: "预注册、多轮对照、样本量说明、负面结果记录和可复现实验包。",
    },
  ];

  const claims: ClaimEvidenceItem[] = [
    {
      id: "closed-loop-runnable",
      tier: "L0",
      status: machineReleaseReady && hasCiPair && hasReflection ? "proved" : "ready",
      label: "可运行闭环 Demo",
      allowedWording: "SE-Path 已完成诊断、规划、干预、复核、反思、记忆闭环 Demo。",
      forbiddenWording: "已经在真实学校生产系统稳定运行。",
      evidencePaths: [
        ref("#student", "product", "首屏一键推进失败 PR 到反思记忆"),
        ref("#reviewer-drill", "product", "300 秒评委演练可复核"),
        ref("sepath-cloud-app/src/engine/engine.test.ts", "test", "Vitest 覆盖闭环引擎"),
        ref("参赛提交材料包/START_DEMO.md", "material", "本地、公开包与视频兜底路线"),
      ],
      productSignals: [`EvidenceEvent=${state.events.length}`, `CI pair=${hasCiPair}`, `reflection=${hasReflection}`],
      verification: "npm run test; python scripts/release_gate.py --skip-screenshots",
      riskIfOverstated: "把合成演示误说成真实生产，会直接削弱可信度。",
    },
    {
      id: "evidence-native-diagnosis",
      tier: "L0",
      status: state.events.length >= 6 ? "proved" : "ready",
      label: "证据原生诊断",
      allowedWording: "学情诊断来自 Issue、PR、CI、对话、教师复核和反思的 EvidenceEvent。",
      forbiddenWording: "AI 只凭聊天内容就能准确判断所有学习状态。",
      evidencePaths: [
        ref("#teacher", "product", "证据捕获与账本导入导出"),
        ref("sepath-cloud-app/src/engine/evidence.ts", "source", "证据覆盖计算"),
        ref("sepath-cloud-app/src/engine/diagnosis.ts", "source", "诊断 reason codes"),
        ref("参赛提交材料包/19_证据账本导入恢复与工作空间迁移说明.md", "material", "账本迁移说明"),
      ],
      productSignals: [`eventTypes=${new Set(state.events.map((event) => event.type)).size}`, `coverage-linked diagnosis`],
      verification: "查看 EvidenceTimeline 与诊断卡 reasonCodes。",
      riskIfOverstated: "弱证据诊断必须降级为影子运行或教师复核。",
    },
    {
      id: "safevoi-path-adaptation",
      tier: "L0",
      status: valueUplift.valueScore >= 75 ? "proved" : "ready",
      label: "SafeVOI 路径自适应",
      allowedWording: "SafeVOI 根据学习增益、风险、可逆性和证据覆盖动态排序下一步行动。",
      forbiddenWording: "系统能保证每个学生都获得最高分路线。",
      evidencePaths: [
        ref("#strategy", "product", "策略实验对比 chat-only、固定路径和 SafeVOI"),
        ref("#value", "product", "增值评估显示策略对照与声明边界"),
        ref("sepath-cloud-app/src/engine/safeVoi.ts", "source", "策略排序实现"),
        ref("参赛提交材料包/17_策略实验室与SafeVOI对照仿真说明.md", "material", "SafeVOI 对照仿真说明"),
      ],
      productSignals: [`valueScore=${valueUplift.valueScore}`, `realScoreBlocked=${valueBoundaryBlocked}`],
      verification: "切换策略实验和增值评估声明边界视图。",
      riskIfOverstated: "策略优势只能声明为当前样本回放和受控仿真，不等于真实长期因果增益。",
    },
    {
      id: "teacher-calibration",
      tier: "L0",
      status: hasTeacherReview ? "proved" : "ready",
      label: "教师发布与 Rubric 校准",
      allowedWording: "高风险干预、替写风险和低证据诊断先进入教师发布门。",
      forbiddenWording: "AI 可以替代教师直接决定所有教学行动。",
      evidencePaths: [
        ref("#rubric-calibration", "product", "教师锚点、AI 估计、一致性阈值和发布门禁"),
        ref("#intervention-playbook", "product", "教学行动包可发布、回滚、审计"),
        ref("sepath-cloud-app/src/engine/reviewGate.ts", "source", "教师复核门禁"),
        ref("参赛提交材料包/35_教师标注与Rubric校准中心说明.md", "material", "Rubric 校准材料"),
      ],
      productSignals: [`teacherReviewed=${hasTeacherReview}`, `pilotManual=${pilotEvidenceBinder.manualCount}`],
      verification: "点击教师复核放行，观察 EvidenceEvent 与发布门更新。",
      riskIfOverstated: "教育高风险建议必须保留教师最终确认权。",
    },
    {
      id: "research-fusion",
      tier: "L0",
      status: researchFusion.score >= 80 ? "proved" : "ready",
      label: "科研思想融合",
      allowedWording: "路径增值、研究假设、开源参考边界和算法贡献已进入产品内证据中台。",
      forbiddenWording: "当前 Demo 已经完成 SCI 级真实课程实证结论。",
      evidencePaths: [
        ref("#research-fusion", "product", "思想迁移链、贡献图谱、验证阶梯"),
        ref("#trial-telemetry", "product", "试点遥测和效果声明门禁"),
        ref("sepath-cloud-app/src/engine/researchFusion.ts", "source", "科研融合报告"),
        ref("参赛提交材料包/36_科研算法融合与开源证据中台说明.md", "material", "科研融合材料"),
      ],
      productSignals: [`researchFusion=${researchFusion.score}`, `trialRules=${trialTelemetry.effectDecisionRules.length}`],
      verification: "查看科研融合面板与 trial effect decision rules。",
      riskIfOverstated: "科研假设不能被包装成已经验证的真实课程结论。",
    },
    {
      id: "cloud-and-local-readiness",
      tier: "L0",
      status: launchLoop.score >= 90 ? "proved" : "ready",
      label: "公开试用、私有云和本地兜底",
      allowedWording: "产品具备公开静态包、owner-only 私有云、本地源码运行和视频兜底路线。",
      forbiddenWording: "当前已经完全公开生产上线并接入真实数据库。",
      evidencePaths: [
        ref("#cloud", "product", "云交付体检中心"),
        ref("#launch-loop", "product", "上线级闭环验收剧本"),
        ref("参赛提交材料包/公开试用静态包/index.html", "material", "公开静态试用入口"),
        ref("参赛提交材料包/local-run-doctor/LOCAL_RUN_DOCTOR.json", "material", "本地运行自检包"),
      ],
      productSignals: [`launchLoop=${launchLoop.score}`, `reviewerDrill=${reviewerDrill.score}`],
      verification: "python scripts/release_gate.py --skip-screenshots",
      riskIfOverstated: "owner-only 链接不能冒充公开生产访问。",
    },
    {
      id: "api-and-backend-readiness",
      tier: "L0",
      status: judgeVerification.proofs.some((proof) => proof.id === "edge-http" && proof.status === "pass")
        ? "proved"
        : "ready",
      label: "后端接口与技术验收",
      allowedWording: "Edge API、LLM Gateway、OpenAPI、SLO 和后端状态中心均有机器验收路线。",
      forbiddenWording: "所有真实学校后端和 LMS 已经接入并长期在线。",
      evidencePaths: [
        ref("#backend-status", "product", "后端连接状态中心"),
        ref("#judge-verification", "product", "技术验收中心"),
        ref("sepath-cloud-app/cloud/openapi.sepath.json", "source", "OpenAPI 契约"),
        ref("参赛提交材料包/46_评委技术验收包.md", "material", "评委技术验收包"),
      ],
      productSignals: [`judgeVerification=${judgeVerification.score}`, `proofs=${judgeVerification.proofs.length}`],
      verification: "npm run cloud:smoke && npm run cloud:smoke:http",
      riskIfOverstated: "后端 readiness 必须和数据库授权、公开访问策略分开表述。",
    },
    {
      id: "tenant-data-plane-ready",
      tier: "L1",
      status: pilotReady ? "ready" : "manual",
      label: "多租户数据平面可进入影子试点",
      allowedWording: "多租户表结构、RLS、账号初始化和 no-pii-export 已准备好影子试点路线。",
      forbiddenWording: "已经持有真实学生 PII 或真实学校生产数据。",
      evidencePaths: [
        ref("#data-plane", "product", "生产数据平面与 RLS"),
        ref("#school-provisioning", "product", "学校初始化与演示账号"),
        ref("#pilot-evidence-binder", "product", "真实试点证据装订中心"),
        ref("参赛提交材料包/39_生产数据平面与部署运维中心说明.md", "material", "数据平面说明"),
      ],
      productSignals: [`pilotBlocked=${pilotEvidenceBinder.blockedCount}`, `telemetryBlocked=${trialTelemetry.blockedCount}`],
      verification: "查看 DataPlanePanel、SchoolProvisioningPanel 和 PilotEvidenceBinderPanel。",
      riskIfOverstated: "影子试点准备不能被说成真实生产数据接入。",
    },
    {
      id: "real-pilot-boundary",
      tier: "L1",
      status: pilotReady ? "ready" : "manual",
      label: "真实试点边界清楚",
      allowedWording: "真实课程效果等待授权、脱敏、教师签收、预注册和对照验证。",
      forbiddenWording: "当前已经证明真实课程长期提分。",
      evidencePaths: [
        ref("#claim-ledger", "product", "本面板把 L0-L3 声明等级显性化"),
        ref("#trial-telemetry", "product", "试点遥测与效果验证中心"),
        ref("sepath-cloud-app/src/engine/claimEvidenceLedger.ts", "source", "主张证据账本引擎"),
        ref("参赛提交材料包/62_主张证据账本与真实性核验包.md", "material", "主张证据账本材料"),
      ],
      productSignals: [`effectRules=${trialTelemetry.effectDecisionRules.length}`, `realScoreClaimBlocked=${valueBoundaryBlocked}`],
      verification: "查看本面板禁止表述和 L2/L3 等级。",
      riskIfOverstated: "这是最容易被评委追问的边界，必须坚持 L0/L1 当前证据口径。",
    },
  ];

  const forbiddenClaims: ForbiddenClaimRule[] = [
    {
      id: "no-real-production",
      forbidden: "已经接入真实学校生产系统并稳定运行。",
      safeAlternative: "当前可展示公开静态包、owner-only 私有云、本地源码运行和视频兜底。",
      evidenceBoundary: "公开访问、真实数据库授权和生产接入需要另行确认。",
    },
    {
      id: "no-real-student-pii",
      forbidden: "提交包包含真实学生数据或真实私有仓库数据。",
      safeAlternative: "提交包使用合成样本、脱敏事件和公开可查源码路径。",
      evidenceBoundary: "真实试点前必须通过学校授权、学生知情和 no-pii-export。",
    },
    {
      id: "no-causal-uplift",
      forbidden: "当前已经证明长期因果提分。",
      safeAlternative: "当前证明工程闭环、策略对照设计和真实试点分析路径。",
      evidenceBoundary: "L3 需要预注册、多班级或多轮对照和可复现实验包。",
    },
    {
      id: "no-teacher-replacement",
      forbidden: "AI 可以替代教师直接发布所有干预。",
      safeAlternative: "AI 负责诊断、排序和脚手架，教师负责高风险发布确认。",
      evidenceBoundary: "教师复核、Rubric 校准和发布门是必要组成。",
    },
    {
      id: "no-award-guarantee",
      forbidden: "该作品一定能获得一等奖。",
      safeAlternative: "当前材料把官方评分项、差异化证据和机器验证尽量做齐。",
      evidenceBoundary: "最终结果取决于评委、现场展示和其他参赛作品。",
    },
  ];

  const provedCount = countStatus(claims, "proved");
  const readyCount = countStatus(claims, "ready");
  const manualCount = countStatus(claims, "manual");
  const blockedCount = countStatus(claims, "blocked");
  const score = Math.round((claims.reduce((total, claim) => total + scoreStatus(claim.status), 0) / claims.length) * 100);
  const runtime = "sepath-claim-evidence-ledger.v1";
  const truthBoundary =
    "This product panel maps allowed and forbidden claims to current demo, source, material, and release evidence. It does not upgrade L0/L1 demo or pilot-readiness evidence into L2/L3 real course outcome claims.";
  const materialPath = "参赛提交材料包/62_主张证据账本与真实性核验包.md";
  const machinePath = "参赛提交材料包/claim-evidence-ledger/CLAIM_EVIDENCE_LEDGER.json";
  const command = "python scripts/generate_claim_evidence_ledger_pack.py --write";
  const manifest = JSON.stringify(
    {
      runtime,
      evidenceScope: "product_visible_claim_to_evidence_traceability",
      productAnchor: "#claim-ledger",
      score,
      claimCounts: { provedCount, readyCount, manualCount, blockedCount },
      claimTiers: claimTiers.map((tier) => ({ id: tier.id, status: tier.status })),
      claims: claims.map((claim) => ({
        id: claim.id,
        tier: claim.tier,
        status: claim.status,
        evidencePaths: claim.evidencePaths.map((item) => item.path),
      })),
      forbiddenClaimIds: forbiddenClaims.map((claim) => claim.id),
      truthBoundary,
    },
    null,
    2,
  );

  return {
    runtime,
    evidenceScope: "product_visible_claim_to_evidence_traceability",
    productAnchor: "#claim-ledger",
    score,
    stage: blockedCount > 0 ? "claim-overstatement-blocked" : "claim-ledger-ready",
    summary:
      "主张证据账本把 Demo 能力、源码证据、提交材料、发布门禁和真实试点边界统一到同一张产品内账本。评委追问时，可以逐条查看哪些主张已经由 L0 工程证据证明，哪些只能说到 L1 试点准备，哪些必须等授权试点后才能升级。",
    provedCount,
    readyCount,
    manualCount,
    blockedCount,
    claimTiers,
    metrics: [
      {
        id: "claims",
        label: "核心主张",
        value: `${claims.length}`,
        note: "每条主张绑定可说表述、禁止表述、证据路径和复核命令",
        status: "proved",
      },
      {
        id: "tiering",
        label: "声明等级",
        value: `${claimTiers.length}`,
        note: "L0/L1/L2/L3 明确分层，避免提前宣称真实效果",
        status: valueBoundaryBlocked ? "proved" : "ready",
      },
      {
        id: "product-visible",
        label: "产品内可查",
        value: "#claim-ledger",
        note: "材料中的 62 号账本已变成应用内面板",
        status: "proved",
      },
      {
        id: "pilot-boundary",
        label: "真实试点边界",
        value: pilotReady ? "L1 ready" : "manual",
        note: "L2/L3 等待授权、教师签收和对照验证",
        status: pilotReady ? "ready" : "manual",
      },
    ],
    claims,
    forbiddenClaims,
    judgeAnswerScript: [
      "我们现在能证明的是 L0：工程闭环、测试、公开试用包、演示视频和机器审计。",
      "我们已经准备到 L1：真实课程影子试点的授权、脱敏、教师周报和 no-pii-export 门禁。",
      "L2/L3 不提前说。只有授权试点、教师签收、对照数据和复现实验包齐全后，才谈真实效果。",
      "所有主张都能回到产品锚点、源码路径、材料路径和复核命令，而不是只靠 PPT 表述。",
    ],
    materialPath,
    machinePath,
    command,
    truthBoundary,
    manifest,
  };
}
