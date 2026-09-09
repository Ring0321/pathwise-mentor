import type { AppState } from "../domain/types";
import type { ApiContractReport } from "./apiContract";
import type { CourseAuthoringReport } from "./courseAuthoring";
import type { CourseLaunchReport } from "./courseLaunch";
import type { LaunchReadinessReport } from "./launchReadiness";
import type { PilotReadinessReport } from "./pilotReadiness";
import type { PrivacyGuardReport } from "./privacyGuard";
import type { TrialTelemetryReport } from "./trialTelemetry";

export type TenantOpsStatus = "ready" | "configured" | "manual" | "blocked";
export type TenantOpsOwner = "school_admin" | "course_admin" | "teacher" | "ops" | "security" | "researcher";

export interface TenantOpsMetric {
  id: string;
  label: string;
  value: string;
  target: string;
  status: TenantOpsStatus;
}

export interface TenantWorkspace {
  id: string;
  label: string;
  status: TenantOpsStatus;
  tenantKey: string;
  activeScope: string;
  learnerSeats: string;
  isolationCheck: string;
  goLiveGate: string;
}

export interface TenantRoleScope {
  id: string;
  role: string;
  status: TenantOpsStatus;
  permissions: string[];
  deniedActions: string[];
  evidence: string;
}

export interface TenantProvisioningStep {
  id: string;
  label: string;
  phase: string;
  owner: TenantOpsOwner;
  status: TenantOpsStatus;
  automation: string;
  evidence: string;
  rollback: string;
}

export interface TenantCostGuardrail {
  id: string;
  label: string;
  status: TenantOpsStatus;
  limit: string;
  trigger: string;
  action: string;
}

export interface TenantServiceSlo {
  id: string;
  label: string;
  status: TenantOpsStatus;
  objective: string;
  monitor: string;
  fallback: string;
}

export interface TenantRunbook {
  id: string;
  label: string;
  status: TenantOpsStatus;
  owner: TenantOpsOwner;
  trigger: string;
  steps: string[];
}

export interface TenantExportItem {
  id: string;
  label: string;
  status: TenantOpsStatus;
  artifact: string;
  usage: string;
}

export interface TenantOpsReport {
  score: number;
  stage: string;
  summary: string;
  cloudMode: string;
  readyCount: number;
  configuredCount: number;
  manualCount: number;
  blockedCount: number;
  metrics: TenantOpsMetric[];
  workspaces: TenantWorkspace[];
  roleScopes: TenantRoleScope[];
  provisioning: TenantProvisioningStep[];
  costGuardrails: TenantCostGuardrail[];
  slos: TenantServiceSlo[];
  runbooks: TenantRunbook[];
  exportPack: TenantExportItem[];
  goLiveChecklist: string[];
  tenantManifest: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function countStatus<T extends { status: TenantOpsStatus }>(items: T[], status: TenantOpsStatus): number {
  return items.filter((item) => item.status === status).length;
}

function scoreStatus(status: TenantOpsStatus): number {
  if (status === "ready") return 1;
  if (status === "configured") return 0.76;
  if (status === "manual") return 0.46;
  return 0;
}

function hasClosedLearningLoop(state: AppState): boolean {
  const types = new Set(state.events.map((event) => event.type));
  return types.has("ci_failed") && types.has("ci_passed") && types.has("teacher_reviewed") && types.has("reflection_submitted");
}

export function buildTenantOpsReport(
  state: AppState,
  launchReadiness: LaunchReadinessReport,
  pilotReadiness: PilotReadinessReport,
  privacyGuard: PrivacyGuardReport,
  apiContract: ApiContractReport,
  courseAuthoring: CourseAuthoringReport,
  courseLaunch: CourseLaunchReport,
  trialTelemetry: TrialTelemetryReport,
): TenantOpsReport {
  const privacyReady = privacyGuard.gate === "pass";
  const apiReady = apiContract.score >= 80;
  const cloudReady = launchReadiness.passCount >= 4;
  const courseReady = courseAuthoring.score >= 80 && courseLaunch.score >= 80;
  const trialReady = trialTelemetry.score >= 75;
  const loopReady = hasClosedLearningLoop(state);
  const ownerOnly = launchReadiness.manualGates.join(" ").includes("公开");
  const cloudMode = ownerOnly ? "multi-tenant-static-shell + owner-only cloud preview" : "multi-tenant-public-trial-ready";

  const workspaces: TenantWorkspace[] = [
    {
      id: "school-tenant",
      label: "学校租户工作区",
      status: privacyReady && apiReady ? "ready" : "manual",
      tenantKey: "tenantId / schoolSlug / dataRegion",
      activeScope: "软件工程课程、班级、教师、助教与试点周期",
      learnerSeats: "30 demo seats / 120 pilot cap",
      isolationCheck: "tenantId + courseId + cohortId + learnerHash 全链路隔离",
      goLiveGate: "正式导入真实名册前必须完成授权、退出机制和数据保留期确认。",
    },
    {
      id: "course-tenant",
      label: "课程复制与版本工作区",
      status: courseReady ? "ready" : "configured",
      tenantKey: courseAuthoring.courseVersion,
      activeScope: courseAuthoring.courseTitle,
      learnerSeats: "按课程 Manifest 复制，不共享学生私有事件",
      isolationCheck: "Rubric、作业模板、AI 边界和发布门随 courseVersion 固化。",
      goLiveGate: "每次开班前由课程负责人冻结课程 Manifest。",
    },
    {
      id: "reviewer-sandbox",
      label: "评委/校内试用沙箱",
      status: ownerOnly ? "manual" : "configured",
      tenantKey: "reviewerTenant / syntheticDataset",
      activeScope: "仅合成样本、演示账本和只读交付包",
      learnerSeats: "5 reviewer seats",
      isolationCheck: "不接触真实学生 PII，不授予写入学校课程的权限。",
      goLiveGate: "若云端保持 owner-only，提交时同时提供公开静态包、本地 Demo 和视频兜底。",
    },
    {
      id: "research-lab",
      label: "科研验证与遥测工作区",
      status: trialReady ? "configured" : "manual",
      tenantKey: "researchTrial / preregistrationId",
      activeScope: "教师确认 A/B、等待组、历史基线复盘",
      learnerSeats: "试点授权后按班级开通",
      isolationCheck: "只导出匿名指标、bootstrap 结果和声明门禁，不导出原始私聊。",
      goLiveGate: "没有真实授权试点前只能声明验证框架，不能声明真实提分。",
    },
  ];

  const roleScopes: TenantRoleScope[] = [
    {
      id: "school-admin",
      role: "学校管理员",
      status: privacyReady ? "configured" : "manual",
      permissions: ["创建租户", "配置数据保留期", "查看脱敏审计", "关闭课程试点"],
      deniedActions: ["查看学生原始对话", "绕过教师发布门", "导出未脱敏数据"],
      evidence: "权限与隐私治理中心已经保留 role matrix 和 blocked request 证据。",
    },
    {
      id: "course-admin",
      role: "课程管理员",
      status: courseReady ? "ready" : "configured",
      permissions: ["复制课程 Manifest", "冻结 Rubric", "查看班级风险队列", "导出周报"],
      deniedActions: ["修改模型安全边界", "删除审计账本", "直接替学生完成作业"],
      evidence: "课程开班向导已生成首周步骤、连接器、启动包和风险登记。",
    },
    {
      id: "teacher",
      role: "任课教师",
      status: loopReady ? "ready" : "configured",
      permissions: ["复核高风险建议", "发布脚手架", "查看班级摘要", "写入教师处理结果"],
      deniedActions: ["查看其他课程租户", "公开学生个人身份", "跳过声明门禁"],
      evidence: "teacher_reviewed 事件和教师周报证明高风险建议进入人工复核。",
    },
    {
      id: "student",
      role: "学生",
      status: "ready",
      permissions: ["查看自己的路径", "请求脚手架提示", "提交反思", "导出个人学习证据"],
      deniedActions: ["访问同伴账本", "获得完整可提交答案", "查看教师后台队列"],
      evidence: "学生对话实验台通过 DIRECT_ANSWER_POLICY_GATE 拦截直接答案请求。",
    },
    {
      id: "competition-reviewer",
      role: "比赛评委/外部试用者",
      status: "configured",
      permissions: ["打开合成数据沙箱", "查看评审证据矩阵", "下载只读 Manifest"],
      deniedActions: ["访问真实租户", "写入真实课程", "获取 API 密钥或私有仓库地址"],
      evidence: "评委试用控制台明确 owner-only 链接不能冒充公开访问。",
    },
  ];

  const provisioning: TenantProvisioningStep[] = [
    {
      id: "tenant-bootstrap",
      label: "创建租户与区域策略",
      phase: "T-7",
      owner: "school_admin",
      status: privacyReady ? "configured" : "manual",
      automation: "生成 tenantId、schoolSlug、dataRegion 和默认保留期。",
      evidence: `privacy gate=${privacyGuard.gate}，PII 命中 ${privacyGuard.piiFindings}。`,
      rollback: "关闭真实导入，只保留合成样本沙箱。",
    },
    {
      id: "course-copy",
      label: "复制课程 Manifest",
      phase: "T-6",
      owner: "course_admin",
      status: courseReady ? "ready" : "configured",
      automation: "从课程配置中心复制 Rubric、作业模板、AI Policy 和发布门。",
      evidence: `courseLaunch=${courseLaunch.score}，courseAuthoring=${courseAuthoring.score}。`,
      rollback: "回退到只读课程模板，不允许学生事件写入。",
    },
    {
      id: "rbac-policy",
      label: "绑定 RBAC 与数据域",
      phase: "T-5",
      owner: "security",
      status: privacyReady && apiReady ? "ready" : "manual",
      automation: "按 school_admin / teacher / student / reviewer 分配最小权限。",
      evidence: `${roleScopes.length} 类角色 scope，${apiContract.endpoints.length} 个 API 端点。`,
      rollback: "全部外部访问降级到只读评审包。",
    },
    {
      id: "connector-bindings",
      label: "绑定 Git/CI/LMS/Webhook",
      phase: "T-4",
      owner: "ops",
      status: apiReady ? "configured" : "manual",
      automation: "按 apiContract.webhooks 与环境变量生成接入清单。",
      evidence: `环境变量：${apiContract.environmentVariables.slice(0, 4).join(", ")}。`,
      rollback: "关闭 webhook 写入，只允许集成回放沙箱演示。",
    },
    {
      id: "quota-slo",
      label: "配置席位、预算与 SLO",
      phase: "T-3",
      owner: "ops",
      status: cloudReady ? "configured" : "manual",
      automation: "为试点课程设置席位上限、模型预算、日志保留和回滚时间。",
      evidence: `cloud=${launchReadiness.cloudUrl}，manual gates=${launchReadiness.manualCount}。`,
      rollback: "超过预算或可用性异常时切回静态 Demo + 本地包。",
    },
    {
      id: "trial-preregistration",
      label: "冻结试点遥测方案",
      phase: "T-2",
      owner: "researcher",
      status: trialReady ? "ready" : "manual",
      automation: "把遥测 Manifest、指标、分组和声明门禁绑定到租户。",
      evidence: `trialTelemetry=${trialTelemetry.score}，mode=${trialTelemetry.readinessMode}。`,
      rollback: "不发布效果声明，只保留过程证据。",
    },
  ];

  const costGuardrails: TenantCostGuardrail[] = [
    {
      id: "seat-quota",
      label: "席位上限",
      status: "configured",
      limit: "每个试点课程默认 120 learnerHash",
      trigger: "名单导入超过上限或重复 learnerHash 激增",
      action: "阻断导入并要求课程管理员确认扩容。",
    },
    {
      id: "model-budget",
      label: "模型预算",
      status: "ready",
      limit: "高风险请求优先走确定性策略和缓存脚手架",
      trigger: "LLM token 成本超出单课程预算阈值",
      action: "降级到 no-key fallback，不影响诊断和教师周报。",
    },
    {
      id: "storage-retention",
      label: "数据保留",
      status: privacyReady ? "ready" : "manual",
      limit: "公开包只保留合成数据；真实租户按授权保留期清理",
      trigger: "原始对话、私有仓库地址或 PII 进入公开材料",
      action: "发布门阻断，重新脱敏并生成审计记录。",
    },
    {
      id: "static-first",
      label: "静态优先交付",
      status: cloudReady ? "ready" : "configured",
      limit: "首版公开试用包 < 5MB，正式提交 ZIP < 100MB",
      trigger: "云端策略变化或评审无法访问 owner-only 链接",
      action: "切换公开静态包、本地 Demo、视频三路兜底。",
    },
  ];

  const slos: TenantServiceSlo[] = [
    {
      id: "demo-availability",
      label: "评审可用性",
      status: cloudReady ? "configured" : "manual",
      objective: "正式提交期间至少有一条可打开、可演示、可解释的路径。",
      monitor: "release_gate + screenshot QA + public trial manifest",
      fallback: "静态包、本地 Vite、演示视频依次兜底。",
    },
    {
      id: "evidence-ingest",
      label: "证据写入延迟",
      status: apiReady ? "configured" : "manual",
      objective: "Git/CI/LMS 事件进入 EvidenceEvent 后可去重、可追踪。",
      monitor: "/api/evidence/events dry-run 与 idempotencyKey",
      fallback: "写入失败时保留原始脱敏 payload 并进入人工补录。",
    },
    {
      id: "teacher-review-sla",
      label: "教师复核时效",
      status: loopReady ? "ready" : "configured",
      objective: "高风险建议不自动发布，先进入教师队列。",
      monitor: "teacher_review.status / reviewMinutes / approvedAction",
      fallback: "超时后只展示安全脚手架，不展示高风险个性化建议。",
    },
    {
      id: "rollback-rto",
      label: "回滚 RTO",
      status: "ready",
      objective: "隐私、模型或接入异常后 15 分钟内降级到只读诊断模式。",
      monitor: "privacy gate、model fallback、connector health",
      fallback: "停用真实写入、导出账本、保留教师可见摘要。",
    },
  ];

  const runbooks: TenantRunbook[] = [
    {
      id: "first-tenant",
      label: "首个学校租户开通",
      status: "configured",
      owner: "ops",
      trigger: "学校确认课程试点意向后",
      steps: ["创建 tenantId", "配置数据区域", "设置保留期", "导入合成预演名单", "提交隐私门禁复核"],
    },
    {
      id: "course-clone",
      label: "课程复制上线",
      status: courseReady ? "ready" : "configured",
      owner: "course_admin",
      trigger: "任课教师确认 Rubric 和任务模板后",
      steps: ["复制 courseVersion", "冻结 Rubric", "绑定 CI Recovery Lab", "生成首周开班清单"],
    },
    {
      id: "integration-onboarding",
      label: "真实工具接入",
      status: apiReady ? "configured" : "manual",
      owner: "ops",
      trigger: "课程要接 Git/CI/LMS/飞书时",
      steps: ["先跑 webhook dry-run", "确认 protectedFields", "写入测试 EvidenceEvent", "开启真实事件窗口"],
    },
    {
      id: "incident-response",
      label: "隐私或模型异常响应",
      status: privacyReady ? "ready" : "manual",
      owner: "security",
      trigger: "检测到 PII、密钥、私有仓库地址或高风险答案输出",
      steps: ["阻断发布", "导出审计账本", "降级到只读诊断", "完成脱敏后重新跑 release gate"],
    },
  ];

  const exportPack: TenantExportItem[] = [
    {
      id: "tenant-manifest",
      label: "租户 Manifest",
      status: "ready",
      artifact: "TenantOps.tenantManifest",
      usage: "交给学校或评委说明租户隔离、角色权限、上云边界和回滚路径。",
    },
    {
      id: "rbac-matrix",
      label: "RBAC 权限矩阵",
      status: privacyReady ? "ready" : "manual",
      artifact: "TenantOps.roleScopes",
      usage: "证明学生、教师、学校、研究者、评委看到的是不同的数据面。",
    },
    {
      id: "cloud-runbook",
      label: "上云运维 Runbook",
      status: "configured",
      artifact: "TenantOps.runbooks",
      usage: "把试点开通、课程复制、集成接入和异常响应变成可执行流程。",
    },
    {
      id: "cost-slo-pack",
      label: "成本与 SLO 包",
      status: "configured",
      artifact: "TenantOps.costGuardrails + TenantOps.slos",
      usage: "回答商业化落地中最常见的成本、稳定性和回滚问题。",
    },
  ];

  const allStatusItems = [
    ...workspaces,
    ...roleScopes,
    ...provisioning,
    ...costGuardrails,
    ...slos,
    ...runbooks,
    ...exportPack,
  ];
  const readyCount = countStatus(allStatusItems, "ready");
  const configuredCount = countStatus(allStatusItems, "configured");
  const manualCount = countStatus(allStatusItems, "manual");
  const blockedCount = countStatus(allStatusItems, "blocked");
  const score = Math.round(
    clamp(
      (allStatusItems.reduce((total, item) => total + scoreStatus(item.status), 0) / allStatusItems.length) * 100
        + (privacyReady ? 5 : -12)
        + (apiReady ? 4 : 0)
        + (cloudReady ? 3 : 0)
        + (trialReady ? 3 : 0),
      0,
      100,
    ),
  );

  const manifest = {
    runtime: "sepath-tenant-ops.v1",
    cloudMode,
    score,
    currentCloudUrl: launchReadiness.cloudUrl,
    tenantKeys: ["tenantId", "schoolSlug", "courseId", "cohortId", "learnerHash"],
    isolation: "Every EvidenceEvent must resolve to tenantId/courseId/cohortId/learnerHash before any real pilot write.",
    gates: {
      privacy: privacyGuard.gate,
      apiScore: apiContract.score,
      courseLaunchScore: courseLaunch.score,
      trialTelemetryScore: trialTelemetry.score,
      manualCloudGates: launchReadiness.manualCount,
    },
    workspaces: workspaces.map((workspace) => ({
      id: workspace.id,
      status: workspace.status,
      tenantKey: workspace.tenantKey,
      goLiveGate: workspace.goLiveGate,
    })),
    roles: roleScopes.map((scope) => ({ id: scope.id, status: scope.status, deniedActions: scope.deniedActions })),
    rollback: slos.find((slo) => slo.id === "rollback-rto")?.fallback,
    claimBoundary: "Cloud-ready and tenant-governed does not mean real school data is connected before authorization.",
  };

  return {
    score,
    stage:
      blockedCount > 0
        ? "租户上线阻断 / 先修复隐私或接入门禁"
        : manualCount > 0
          ? "可上云试用 / 正式学校租户需人工授权"
          : "可进入学校课程试点",
    summary:
      "多租户上云运营中心把 SE-Path 从一个可演示的学习智能体推进为可被学校试用的软件：同一套产品可以开学校租户、复制课程 Manifest、分配最小权限、控制席位和模型成本、监控证据写入与教师复核，并在隐私或模型异常时回滚到只读诊断模式。",
    cloudMode,
    readyCount,
    configuredCount,
    manualCount,
    blockedCount,
    metrics: [
      {
        id: "tenant-score",
        label: "租户可用度",
        value: `${score}`,
        target: "真实学校导入前无隐私阻断，评审沙箱可独立运行",
        status: blockedCount > 0 ? "blocked" : "ready",
      },
      {
        id: "workspace-count",
        label: "工作区",
        value: `${workspaces.length} 类`,
        target: "学校、课程、评委沙箱、科研验证分区隔离",
        status: "configured",
      },
      {
        id: "role-scope",
        label: "角色权限",
        value: `${roleScopes.length} 类`,
        target: "最小权限，不让评委或学生接触真实租户数据",
        status: privacyReady ? "ready" : "manual",
      },
      {
        id: "cloud-fallback",
        label: "上云兜底",
        value: "3 路",
        target: "云端、公开静态包、本地 Demo/视频均可交付",
        status: cloudReady ? "ready" : "configured",
      },
    ],
    workspaces,
    roleScopes,
    provisioning,
    costGuardrails,
    slos,
    runbooks,
    exportPack,
    goLiveChecklist: [
      "冻结 courseAuthoring.exportManifest 与 courseLaunch.classroomManifest。",
      "为学校租户生成 TenantOps.tenantManifest，并确认 tenantId/courseId/cohortId/learnerHash 字段链路。",
      "真实名单导入前完成授权、退出机制、数据保留期和隐私扫描。",
      "先在 reviewer-sandbox 和 integration sandbox 完成 Git/CI/LMS/Webhook dry-run。",
      "试点首周只启用影子诊断和教师确认发布，不自动宣称真实提分。",
      "发布前重新运行 python scripts/release_gate.py，确认 FAIL 为 0。",
    ],
    tenantManifest: JSON.stringify(manifest, null, 2),
  };
}
