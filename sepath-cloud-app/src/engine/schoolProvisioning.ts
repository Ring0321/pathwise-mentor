import type { AppState } from "../domain/types";
import type { ApiContractReport } from "./apiContract";
import type { CourseLaunchReport } from "./courseLaunch";
import type { InferenceGatewayReport } from "./inferenceGateway";
import type { JudgeTrialReport } from "./judgeTrial";
import type { PrivacyGuardReport } from "./privacyGuard";
import type { TenantOpsReport } from "./tenantOps";

export type SchoolProvisioningStatus = "ready" | "configured" | "manual" | "blocked";
export type SchoolProvisioningRole =
  | "school_admin"
  | "course_admin"
  | "teacher"
  | "student"
  | "reviewer"
  | "ops";

export interface ProvisioningMetric {
  id: string;
  label: string;
  value: string;
  target: string;
  status: SchoolProvisioningStatus;
}

export interface IdentityProviderRoute {
  id: string;
  label: string;
  status: SchoolProvisioningStatus;
  mode: string;
  entry: string;
  envVars: string[];
  fallback: string;
  boundary: string;
}

export interface DemoAccountRoute {
  id: string;
  label: string;
  role: SchoolProvisioningRole;
  status: SchoolProvisioningStatus;
  entryPath: string;
  workspace: string;
  canView: string[];
  deniedActions: string[];
  credentialPolicy: string;
  evidence: string;
}

export interface InvitationRoute {
  id: string;
  label: string;
  role: SchoolProvisioningRole;
  status: SchoolProvisioningStatus;
  channel: string;
  tokenScope: string;
  expiresIn: string;
  approvalGate: string;
}

export interface ProvisioningStage {
  id: string;
  label: string;
  phase: string;
  owner: SchoolProvisioningRole;
  status: SchoolProvisioningStatus;
  action: string;
  evidence: string;
  rollback: string;
}

export interface ProvisioningGate {
  id: string;
  label: string;
  status: SchoolProvisioningStatus;
  evidence: string;
  enforcement: string;
}

export interface AccountAuditEvent {
  id: string;
  label: string;
  status: SchoolProvisioningStatus;
  actor: SchoolProvisioningRole;
  trace: string;
  evidence: string;
}

export interface EntryPlaybook {
  id: string;
  label: string;
  role: SchoolProvisioningRole;
  minutes: string;
  route: string;
  successSignal: string;
}

export interface ProvisioningExportItem {
  id: string;
  label: string;
  status: SchoolProvisioningStatus;
  artifact: string;
  usage: string;
}

export interface SchoolProvisioningReport {
  score: number;
  stage: string;
  mode: string;
  summary: string;
  readyCount: number;
  configuredCount: number;
  manualCount: number;
  blockedCount: number;
  metrics: ProvisioningMetric[];
  identityProviders: IdentityProviderRoute[];
  demoAccounts: DemoAccountRoute[];
  invitations: InvitationRoute[];
  stages: ProvisioningStage[];
  gates: ProvisioningGate[];
  auditTrail: AccountAuditEvent[];
  playbooks: EntryPlaybook[];
  exportPack: ProvisioningExportItem[];
  accountNotice: string[];
  demoSeedManifestPath: string;
  demoSeedMaterialPath: string;
  demoSeedCommand: string;
  demoSeedRuntime: string;
  accountManifest: string;
}

function countStatus<T extends { status: SchoolProvisioningStatus }>(
  items: T[],
  status: SchoolProvisioningStatus,
): number {
  return items.filter((item) => item.status === status).length;
}

function statusWeight(status: SchoolProvisioningStatus): number {
  if (status === "ready") return 1;
  if (status === "configured") return 0.78;
  if (status === "manual") return 0.48;
  return 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function hasEvent(state: AppState, type: string): boolean {
  return state.events.some((event) => event.type === type);
}

export function buildSchoolProvisioningReport(
  state: AppState,
  privacyGuard: PrivacyGuardReport,
  apiContract: ApiContractReport,
  tenantOps: TenantOpsReport,
  courseLaunch: CourseLaunchReport,
  judgeTrial: JudgeTrialReport,
  inferenceGateway: InferenceGatewayReport,
): SchoolProvisioningReport {
  const privacyReady = privacyGuard.gate === "pass" && privacyGuard.piiFindings === 0;
  const apiReady = apiContract.score >= 80;
  const tenantReady = tenantOps.score >= 80;
  const launchReady = courseLaunch.score >= 80;
  const judgeReady = judgeTrial.score >= 80;
  const inferenceReady = inferenceGateway.score >= 80;
  const closedLoop = hasEvent(state, "ci_passed") && hasEvent(state, "teacher_reviewed");

  const identityProviders: IdentityProviderRoute[] = [
    {
      id: "demo-role-switch",
      label: "本地演示角色切换",
      status: "ready",
      mode: "no-password synthetic demo",
      entry: "前端静态包内置角色视图，不含真实账号密码。",
      envVars: [],
      fallback: "评审现场无需登录即可查看合成数据沙箱。",
      boundary: "只能访问合成样本，不能写入真实学校租户。",
    },
    {
      id: "school-oidc",
      label: "学校统一身份 OIDC",
      status: privacyReady && apiReady ? "configured" : "manual",
      mode: "school managed SSO",
      entry: "生产环境由学校 IdP 跳转回 /auth/callback。",
      envVars: ["OIDC_ISSUER", "OIDC_CLIENT_ID", "OIDC_CLIENT_SECRET", "SESSION_SECRET"],
      fallback: "未配置 SSO 时只开放演示账号和教师手动导入名单。",
      boundary: "OIDC secret 只在后端或平台 Secret Store，不进入前端和提交包。",
    },
    {
      id: "lti-launch",
      label: "LMS / LTI 课程入口",
      status: apiReady ? "configured" : "manual",
      mode: "course tool launch",
      entry: "从 Moodle、Open edX 或学校 LMS 以课程工具方式打开。",
      envVars: ["LTI_CLIENT_ID", "LTI_DEPLOYMENT_ID", "LTI_KEY_SET_URL"],
      fallback: "LTI 未接入时用 courseId + cohortId 手动绑定。",
      boundary: "LTI 只传课程身份和角色，不传学生明文隐私字段。",
    },
    {
      id: "reviewer-access",
      label: "评委只读入口",
      status: judgeReady ? "configured" : "manual",
      mode: "read-only reviewer route",
      entry: "公开静态包、本地 Demo、视频或 owner-only 云端登录态。",
      envVars: ["REVIEWER_ACCESS_MODE"],
      fallback: "若云端 owner-only 不可打开，切换公开静态包和演示视频。",
      boundary: "评委入口只看合成数据、证据矩阵和 Manifest，不看真实学生账本。",
    },
  ];

  const demoAccounts: DemoAccountRoute[] = [
    {
      id: "school-admin-demo",
      label: "学校管理员演示身份",
      role: "school_admin",
      status: tenantReady && privacyReady ? "configured" : "manual",
      entryPath: "#school-provisioning",
      workspace: "school-tenant",
      canView: ["租户 Manifest", "数据保留期", "审计摘要", "回滚 Runbook"],
      deniedActions: ["查看学生原始对话", "获取模型密钥", "绕过教师发布门"],
      credentialPolicy: "使用一次性演示链接或学校 SSO，不在提交包内放置密码。",
      evidence: "TenantOps 已给出 school-tenant、RBAC、SLO 和 rollback 证据。",
    },
    {
      id: "course-admin-demo",
      label: "课程管理员演示身份",
      role: "course_admin",
      status: launchReady ? "ready" : "configured",
      entryPath: "#course-launch",
      workspace: state.task.title,
      canView: ["课程 Manifest", "Rubric Studio", "开班向导", "API 契约"],
      deniedActions: ["修改全局安全策略", "删除审计记录", "导出未脱敏学生数据"],
      credentialPolicy: "由学校管理员邀请，首轮只允许配置课程模板和工具接入。",
      evidence: `courseLaunch=${courseLaunch.score}，课程任务=${state.task.title}。`,
    },
    {
      id: "teacher-demo",
      label: "任课教师演示身份",
      role: "teacher",
      status: closedLoop ? "ready" : "configured",
      entryPath: "#teacher-report",
      workspace: "software-engineering-project",
      canView: ["班级风险队列", "教师周报", "Rubric 校准", "复核工单"],
      deniedActions: ["访问其他课程租户", "公开真实学生身份", "跳过高风险复核"],
      credentialPolicy: "试点前由课程管理员发放邀请，真实姓名不进入公开 Demo。",
      evidence: closedLoop ? "teacher_reviewed 已写入 EvidenceEvent。" : "继续点击主流程可补齐教师复核事件。",
    },
    {
      id: "student-demo",
      label: "学生演示身份",
      role: "student",
      status: "ready",
      entryPath: "#student",
      workspace: "learnerHash scoped workspace",
      canView: ["本人路径", "本人证据摘要", "脚手架提示", "反思任务"],
      deniedActions: ["查看同伴账本", "导出班级风险清单", "获得可直接提交完整答案"],
      credentialPolicy: "演示身份使用 learnerHash，不出现真实姓名、学号、手机号或邮箱。",
      evidence: `当前合成学习者 ${state.learner.id}，consent=${state.learner.consentValid}。`,
    },
    {
      id: "reviewer-demo",
      label: "评委只读演示身份",
      role: "reviewer",
      status: "configured",
      entryPath: "#judge-trial",
      workspace: "reviewer-sandbox",
      canView: ["评审证据矩阵", "公开静态包 Manifest", "源码审计路径", "演示视频脚本"],
      deniedActions: ["访问真实学校租户", "写入学生账本", "查看 API 密钥或私有仓库"],
      credentialPolicy: "正式提交按主办方要求提供公开包、演示账号或本地运行说明。",
      evidence: `judgeTrial=${judgeTrial.score}，manual gates=${judgeTrial.manualCount}。`,
    },
  ];

  const invitations: InvitationRoute[] = [
    {
      id: "invite-school-admin",
      label: "学校管理员邀请",
      role: "school_admin",
      status: "manual",
      channel: "学校邮箱 / 线下确认",
      tokenScope: "tenant:create, retention:configure, audit:read",
      expiresIn: "24h",
      approvalGate: "必须由参赛团队和学校联系人共同确认，不能自动开放。",
    },
    {
      id: "invite-teacher",
      label: "任课教师邀请",
      role: "teacher",
      status: launchReady ? "configured" : "manual",
      channel: "课程管理员发放",
      tokenScope: "course:review, intervention:approve, report:export",
      expiresIn: "7d",
      approvalGate: "教师接受 AI 使用边界后才能发布脚手架建议。",
    },
    {
      id: "invite-student",
      label: "学生加入课程",
      role: "student",
      status: privacyReady ? "configured" : "manual",
      channel: "LMS 名册 / 课程码",
      tokenScope: "learner:own_path, reflection:submit, scaffold:request",
      expiresIn: "course window",
      approvalGate: "必须确认授权、退出机制和数据保留期。",
    },
    {
      id: "invite-reviewer",
      label: "评委只读试用",
      role: "reviewer",
      status: judgeReady ? "configured" : "manual",
      channel: "比赛平台材料 / 现场演示",
      tokenScope: "reviewer:read_synthetic, manifest:download",
      expiresIn: "competition review window",
      approvalGate: "只读合成样本，不开放真实租户写权限。",
    },
  ];

  const stages: ProvisioningStage[] = [
    {
      id: "identity-mode",
      label: "选择身份接入模式",
      phase: "D-7",
      owner: "ops",
      status: "configured",
      action: "在 demo-role-switch、OIDC、LTI、reviewer-access 中选择本轮入口。",
      evidence: `${identityProviders.length} 条身份入口已建模。`,
      rollback: "身份服务不可用时切回本地演示角色切换。",
    },
    {
      id: "tenant-role-map",
      label: "绑定租户角色与数据域",
      phase: "D-6",
      owner: "school_admin",
      status: tenantReady ? "ready" : "configured",
      action: "把 school_admin、course_admin、teacher、student、reviewer 映射到 TenantOps roleScopes。",
      evidence: `tenantOps=${tenantOps.score}，roles=${tenantOps.roleScopes.length}。`,
      rollback: "不导入真实名册，仅使用 reviewer-sandbox。",
    },
    {
      id: "demo-account-pack",
      label: "生成演示账号包",
      phase: "D-5",
      owner: "ops",
      status: "ready",
      action: "生成无密码演示身份、入口路径、可见范围和禁止动作。",
      evidence: `${demoAccounts.length} 个演示身份，不含真实密码。`,
      rollback: "删除演示身份，仅保留视频和截图材料。",
    },
    {
      id: "student-consent",
      label: "确认授权与退出机制",
      phase: "D-4",
      owner: "course_admin",
      status: privacyReady ? "ready" : "manual",
      action: "真实学生加入前确认 consent、retention、deletion 和 learnerHash。",
      evidence: `privacy=${privacyGuard.gate}，protectedFields=${privacyGuard.protectedFields.length}。`,
      rollback: "转为只读影子诊断，不写入真实学生事件。",
    },
    {
      id: "model-secret-boundary",
      label: "确认模型密钥边界",
      phase: "D-3",
      owner: "ops",
      status: inferenceReady ? "configured" : "manual",
      action: "确认 LLM_API_KEY 只在 Worker 或学校后端，不进入浏览器、材料或导出账本。",
      evidence: `inferenceGateway=${inferenceGateway.score}，fallback=${inferenceGateway.providers.some((item) => item.id === "deterministic-fallback")}。`,
      rollback: "无 Key 时继续使用确定性 fallback。",
    },
    {
      id: "reviewer-dry-run",
      label: "评委路径预演",
      phase: "D-1",
      owner: "reviewer",
      status: judgeReady ? "ready" : "manual",
      action: "按 START_DEMO.md 验证评委能看见闭环、材料、Manifest 和兜底路线。",
      evidence: `judgeTrial=${judgeTrial.score}，routes=${judgeTrial.routes.length}。`,
      rollback: "公开包、本地 Demo、视频三路兜底。",
    },
  ];

  const gates: ProvisioningGate[] = [
    {
      id: "no-password-in-package",
      label: "提交包不含真实密码",
      status: "ready",
      evidence: "演示账号只定义角色、入口和权限，不写真实口令。",
      enforcement: "若需要评委账号，提交前通过平台说明或现场发放，不写进 ZIP。",
    },
    {
      id: "least-privilege",
      label: "最小权限",
      status: privacyReady ? "ready" : "manual",
      evidence: `${privacyGuard.roleMatrix.length} 类 PrivacyGuard role，${demoAccounts.length} 类演示身份。`,
      enforcement: "学生只看本人，评委只看合成，教师只看课程内摘要。",
    },
    {
      id: "real-data-free-demo",
      label: "公开 Demo 不接真实数据",
      status: "ready",
      evidence: "公开静态包和本地 Demo 使用合成学生、模拟 PR/CI 与演示账本。",
      enforcement: "真实学校数据必须进入授权试点租户，不能进入比赛公开包。",
    },
    {
      id: "sso-manual-gate",
      label: "SSO 人工发布门",
      status: "manual",
      evidence: "OIDC/LTI 入口已设计，但真实 IdP 配置必须由学校确认。",
      enforcement: "未确认学校 IdP 前，不能宣称已完成真实 SSO 接入。",
    },
    {
      id: "model-secret-gate",
      label: "模型密钥隔离",
      status: inferenceReady ? "configured" : "manual",
      evidence: inferenceGateway.workerContract,
      enforcement: "前端永不接收 LLM_API_KEY，Worker 无 Key 自动 fallback。",
    },
  ];

  const auditTrail: AccountAuditEvent[] = [
    {
      id: "audit-role-create",
      label: "演示身份生成",
      status: "ready",
      actor: "ops",
      trace: "trace-account-demo-create",
      evidence: `${demoAccounts.length} 个演示身份已进入 Manifest。`,
    },
    {
      id: "audit-reviewer-readonly",
      label: "评委只读边界",
      status: "configured",
      actor: "reviewer",
      trace: "trace-reviewer-readonly",
      evidence: "reviewer-demo 禁止写入真实课程和获取密钥。",
    },
    {
      id: "audit-teacher-release",
      label: "教师发布门",
      status: closedLoop ? "ready" : "configured",
      actor: "teacher",
      trace: "trace-teacher-release",
      evidence: closedLoop ? "教师复核事件已存在。" : "演示流程可生成教师复核事件。",
    },
    {
      id: "audit-student-scope",
      label: "学生个人范围",
      status: "ready",
      actor: "student",
      trace: "trace-student-scope",
      evidence: "student-demo 只允许查看本人路径和个人证据摘要。",
    },
  ];

  const playbooks: EntryPlaybook[] = [
    {
      id: "reviewer-five-minute",
      label: "评委 5 分钟检查路线",
      role: "reviewer",
      minutes: "5",
      route: "评委试用 -> 评审证据 -> 推理网关 -> 提交助手",
      successSignal: "看到合成闭环、Manifest、材料索引和无 Key fallback。",
    },
    {
      id: "teacher-first-class",
      label: "教师首课路线",
      role: "teacher",
      minutes: "8",
      route: "教师周报 -> Rubric校准 -> 开班向导 -> 学生闭环",
      successSignal: "教师能确认高风险建议、导出周报并知道首周只做影子诊断。",
    },
    {
      id: "school-admin-go-live",
      label: "学校管理员上线路线",
      role: "school_admin",
      minutes: "10",
      route: "租户运营 -> 账号初始化 -> 隐私治理 -> API契约",
      successSignal: "管理员能看到租户隔离、数据保留、回滚和接入边界。",
    },
    {
      id: "student-learning-loop",
      label: "学生学习路线",
      role: "student",
      minutes: "3",
      route: "学生闭环 -> 学生对话 -> 反思记忆",
      successSignal: "学生获得脚手架而非完整答案，并提交个人反思证据。",
    },
  ];

  const exportPack: ProvisioningExportItem[] = [
    {
      id: "judge-demo-seed",
      label: "评委试用种子包",
      status: "ready",
      artifact: "JUDGE_DEMO_SEED_MANIFEST.json",
      usage: "给评委提供合成演示身份、闭环事件种子、10 分钟复查路线和无真实密码边界。",
    },
    {
      id: "account-manifest",
      label: "账号与入口 Manifest",
      status: "ready",
      artifact: "SchoolProvisioning.accountManifest",
      usage: "提交给评委或学校说明角色入口、权限范围、禁止动作和回滚边界。",
    },
    {
      id: "demo-account-sheet",
      label: "演示身份清单",
      status: "configured",
      artifact: "SchoolProvisioning.demoAccounts",
      usage: "正式路演时决定是否生成一次性链接或只使用本地角色切换。",
    },
    {
      id: "invitation-policy",
      label: "邀请策略",
      status: "manual",
      artifact: "SchoolProvisioning.invitations",
      usage: "真实学校试点前由学校联系人确认邀请渠道、有效期和审批门。",
    },
    {
      id: "entry-playbooks",
      label: "角色进入路线",
      status: "ready",
      artifact: "SchoolProvisioning.playbooks",
      usage: "让评委、教师、学生、学校管理员按不同路径验证产品价值。",
    },
  ];

  const statusItems = [
    ...identityProviders,
    ...demoAccounts,
    ...invitations,
    ...stages,
    ...gates,
    ...auditTrail,
    ...exportPack,
  ];
  const readyCount = countStatus(statusItems, "ready");
  const configuredCount = countStatus(statusItems, "configured");
  const manualCount = countStatus(statusItems, "manual");
  const blockedCount = countStatus(statusItems, "blocked");
  const score = Math.round(
    clamp(
      (statusItems.reduce((total, item) => total + statusWeight(item.status), 0) / statusItems.length) * 100
        + (privacyReady ? 4 : -10)
        + (tenantReady ? 4 : 0)
        + (judgeReady ? 3 : 0)
        + (inferenceReady ? 2 : 0),
      0,
      100,
    ),
  );

  const accountManifest = JSON.stringify(
    {
      runtime: "sepath-school-provisioning.v1",
      mode: "synthetic demo accounts + school SSO/LTI ready design",
      score,
      tenantManifest: "TenantOps.tenantManifest",
      noRealPasswordsInPackage: true,
      judgeDemoSeedRuntime: "sepath-judge-demo-seed.v1",
      judgeDemoSeedManifest: "sepath-cloud-app/qa/demo-seed/JUDGE_DEMO_SEED_MANIFEST.json",
      demoAccounts: demoAccounts.map((account) => ({
        id: account.id,
        role: account.role,
        status: account.status,
        entryPath: account.entryPath,
        deniedActions: account.deniedActions,
      })),
      identityProviders: identityProviders.map((provider) => ({
        id: provider.id,
        status: provider.status,
        mode: provider.mode,
        envVars: provider.envVars,
      })),
      gates: gates.map((gate) => ({ id: gate.id, status: gate.status })),
      claimBoundary: "Account routes are launch-ready designs and synthetic demo identities until a school confirms SSO/LTI and data authorization.",
    },
    null,
    2,
  );

  return {
    score,
    stage:
      blockedCount > 0
        ? "账号开通阻断 / 先修复隐私或权限"
        : manualCount > 0
          ? "演示账号可用 / 学校 SSO 与真实邀请待确认"
          : "可进入学校试点账号开通",
    mode: "demo accounts + SSO/LTI ready",
    summary:
      "学校初始化与演示账号中心把评委、教师、学生、课程管理员和学校管理员的进入路径拆清楚：公开演示不放真实密码，真实试点走学校 SSO/LTI 或一次性邀请；每个角色都有可见范围、禁止动作、审计 trace 和回滚路径。",
    readyCount,
    configuredCount,
    manualCount,
    blockedCount,
    metrics: [
      {
        id: "demo-accounts",
        label: "演示身份",
        value: `${demoAccounts.length} 类`,
        target: "评委、教师、学生、学校管理员各有入口和边界",
        status: "ready",
      },
      {
        id: "identity-routes",
        label: "身份入口",
        value: `${identityProviders.length} 条`,
        target: "本地演示、学校 SSO、LTI、评委只读均可解释",
        status: "configured",
      },
      {
        id: "access-gates",
        label: "访问门禁",
        value: `${gates.length} 项`,
        target: "无真实密码、最小权限、公开数据合成、密钥隔离",
        status: privacyReady ? "ready" : "manual",
      },
      {
        id: "manifest",
        label: "账号 Manifest",
        value: "v1",
        target: "可被提交包、答辩和学校试点复用",
        status: "ready",
      },
    ],
    identityProviders,
    demoAccounts,
    invitations,
    stages,
    gates,
    auditTrail,
    playbooks,
    exportPack,
    accountNotice: [
      "提交包不包含真实密码、真实学校账号、真实学生名单或模型密钥。",
      "评委默认使用公开静态包、本地 Demo、视频或只读演示身份。",
      "真实学校试点必须由学校确认 SSO/LTI、授权、退出机制和数据保留期。",
      "演示账号只证明产品开通路径和权限边界，不冒充已接入真实学校身份系统。",
    ],
    demoSeedManifestPath: "sepath-cloud-app/qa/demo-seed/JUDGE_DEMO_SEED_MANIFEST.json",
    demoSeedMaterialPath: "参赛提交材料包/47_评委试用账号与种子数据包.md",
    demoSeedCommand: "python scripts/generate_judge_demo_seed_pack.py --write",
    demoSeedRuntime: "sepath-judge-demo-seed.v1",
    accountManifest,
  };
}
