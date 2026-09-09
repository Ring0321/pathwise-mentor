import type { AppState } from "../domain/types";
import type { ApiContractReport } from "./apiContract";
import type { InferenceGatewayReport } from "./inferenceGateway";
import type { PrivacyGuardReport } from "./privacyGuard";
import type { SchoolProvisioningReport } from "./schoolProvisioning";
import type { TenantOpsReport } from "./tenantOps";
import type { TrialTelemetryReport } from "./trialTelemetry";

export type DataPlaneStatus = "ready" | "configured" | "manual" | "blocked";

export interface DataPlaneMetric {
  id: string;
  label: string;
  value: string;
  target: string;
  status: DataPlaneStatus;
}

export interface DataPlaneTable {
  id: string;
  name: string;
  purpose: string;
  primaryKey: string;
  tenantKey: string;
  piiPolicy: string;
  retention: string;
  status: DataPlaneStatus;
  fields: string[];
}

export interface DataPlaneMigration {
  id: string;
  title: string;
  command: string;
  owner: string;
  rollback: string;
  status: DataPlaneStatus;
  checks: string[];
}

export interface DataPlanePolicy {
  id: string;
  label: string;
  scope: string;
  rule: string;
  evidence: string;
  status: DataPlaneStatus;
}

export interface DataPlaneBackup {
  id: string;
  label: string;
  cadence: string;
  rpo: string;
  rto: string;
  restoreDrill: string;
  status: DataPlaneStatus;
}

export interface DataPlaneProbe {
  id: string;
  label: string;
  endpoint: string;
  expected: string;
  evidence: string;
  status: DataPlaneStatus;
}

export interface DataPlaneEnvironmentItem {
  key: string;
  owner: string;
  requiredFor: string;
  storage: string;
  exposedToBrowser: boolean;
  status: DataPlaneStatus;
}

export interface DataPlaneRunbookStep {
  id: string;
  label: string;
  trigger: string;
  action: string;
  evidence: string;
  status: DataPlaneStatus;
}

export interface DataPlaneExportItem {
  id: string;
  label: string;
  path: string;
  purpose: string;
  status: DataPlaneStatus;
}

export interface DataPlaneReport {
  score: number;
  mode: string;
  summary: string;
  readyCount: number;
  configuredCount: number;
  manualCount: number;
  blockedCount: number;
  metrics: DataPlaneMetric[];
  tables: DataPlaneTable[];
  migrations: DataPlaneMigration[];
  policies: DataPlanePolicy[];
  backups: DataPlaneBackup[];
  probes: DataPlaneProbe[];
  env: DataPlaneEnvironmentItem[];
  runbook: DataPlaneRunbookStep[];
  exportPack: DataPlaneExportItem[];
  ddlPreview: string;
  dataPlaneManifest: string;
}

const statusWeight: Record<DataPlaneStatus, number> = {
  ready: 1,
  configured: 0.82,
  manual: 0.48,
  blocked: 0,
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function countStatus<T extends { status: DataPlaneStatus }>(items: T[], status: DataPlaneStatus) {
  return items.filter((item) => item.status === status).length;
}

function scoreItems<T extends { status: DataPlaneStatus }>(items: T[]) {
  if (!items.length) return 0;
  return Math.round((items.reduce((sum, item) => sum + statusWeight[item.status], 0) / items.length) * 100);
}

export function buildDataPlaneReport(
  state: AppState,
  privacyGuard: PrivacyGuardReport,
  apiContract: ApiContractReport,
  tenantOps: TenantOpsReport,
  schoolProvisioning: SchoolProvisioningReport,
  trialTelemetry: TrialTelemetryReport,
  inferenceGateway: InferenceGatewayReport,
): DataPlaneReport {
  const hasPIIBlock = privacyGuard.gate === "block" || privacyGuard.piiFindings > 0;
  const hasTenantManifest = tenantOps.tenantManifest.includes("sepath-tenant-ops.v1");
  const hasAccountManifest = schoolProvisioning.accountManifest.includes("sepath-school-provisioning.v1");
  const hasInferenceManifest = inferenceGateway.inferenceManifest.includes("sepath-inference-gateway.v1");
  const hasTelemetryContract = trialTelemetry.telemetryManifest.includes("sepath-trial-telemetry.v1");
  const evidenceCount = state.events.length;

  const tables: DataPlaneTable[] = [
    {
      id: "tenants",
      name: "sepath_tenants",
      purpose: "学校、机构、比赛评审空间和部署区域的根实体。",
      primaryKey: "tenant_id",
      tenantKey: "tenant_id",
      piiPolicy: "不存学生姓名，保存学校级配置和访问策略。",
      retention: "合同期 + 90 天归档窗口",
      status: hasTenantManifest ? "ready" : "manual",
      fields: ["tenant_id", "name", "region", "plan", "slo_tier", "created_at"],
    },
    {
      id: "courses",
      name: "sepath_courses",
      purpose: "课程模板、Rubric、AI 使用边界和开班 Manifest。",
      primaryKey: "course_id",
      tenantKey: "tenant_id",
      piiPolicy: "课程级数据，不含自然人明文标识。",
      retention: "课程结束后 2 年或学校合同约定",
      status: "ready",
      fields: ["course_id", "tenant_id", "rubric_version", "policy_version", "launch_manifest"],
    },
    {
      id: "learners",
      name: "sepath_learners",
      purpose: "学生伪匿名画像、授权状态和能力基线。",
      primaryKey: "learner_hash",
      tenantKey: "tenant_id",
      piiPolicy: "只保存 learnerHash，不保存姓名、手机号、邮箱或仓库密钥。",
      retention: "试点期 + 教师确认归档",
      status: privacyGuard.piiFindings === 0 ? "ready" : "blocked",
      fields: ["learner_hash", "tenant_id", "course_id", "consent_valid", "baseline_json"],
    },
    {
      id: "evidence",
      name: "sepath_evidence_events",
      purpose: "Issue、PR、CI、对话、教师复核和反思的证据账本。",
      primaryKey: "event_id",
      tenantKey: "tenant_id",
      piiPolicy: "runnerSecret、URL token、明文学生身份在写入前脱敏。",
      retention: "默认 180 天热存储，2 年冷归档",
      status: apiContract.readyCount >= 3 ? "ready" : "configured",
      fields: ["event_id", "tenant_id", "course_id", "learner_hash", "event_type", "trace_id", "payload_json"],
    },
    {
      id: "decisions",
      name: "sepath_agent_decisions",
      purpose: "SafeVOI 决策、发布门、GraphRAG 上下文摘要和模型降级记录。",
      primaryKey: "decision_id",
      tenantKey: "tenant_id",
      piiPolicy: "仅保存证据引用和策略版本，不保存完整私密代码片段。",
      retention: "与 evidence_events 同步",
      status: hasInferenceManifest ? "ready" : "configured",
      fields: ["decision_id", "tenant_id", "learner_hash", "safevoi_version", "gate", "context_refs"],
    },
    {
      id: "reviews",
      name: "sepath_teacher_reviews",
      purpose: "高风险建议、教师锚点、Rubric 校准和申诉处理。",
      primaryKey: "review_id",
      tenantKey: "tenant_id",
      piiPolicy: "教师操作留痕，学生身份仍使用 learnerHash。",
      retention: "课程结束后 2 年或学校审计要求",
      status: "configured",
      fields: ["review_id", "tenant_id", "teacher_id", "learner_hash", "status", "anchor_delta"],
    },
    {
      id: "audit",
      name: "sepath_audit_log",
      purpose: "账号初始化、导入导出、越权拦截、备份恢复和模型调用审计。",
      primaryKey: "audit_id",
      tenantKey: "tenant_id",
      piiPolicy: "安全事件留痕，敏感值只记录 hash 和类别。",
      retention: "默认 1 年，安全事件按学校制度延长",
      status: hasAccountManifest ? "ready" : "manual",
      fields: ["audit_id", "tenant_id", "actor_role", "action", "resource", "result", "created_at"],
    },
  ];

  const migrations: DataPlaneMigration[] = [
    {
      id: "schema-bootstrap",
      title: "初始化 Postgres/Supabase schema",
      command: "psql $SEPATH_DATABASE_URL -f cloud/sql/001_init_sepath_schema.sql",
      owner: "平台管理员",
      rollback: "执行 001_down.sql 或恢复 pre-bootstrap snapshot。",
      status: "configured",
      checks: ["7 张核心表存在", "tenant_id 索引存在", "migration_version 写入"],
    },
    {
      id: "rls-enable",
      title: "启用 Row Level Security 与租户隔离策略",
      command: "psql $SEPATH_DATABASE_URL -f cloud/sql/002_enable_rls.sql",
      owner: "安全管理员",
      rollback: "只允许在维护窗口暂停 RLS，并保留 audit_log。",
      status: hasTenantManifest && hasAccountManifest ? "ready" : "manual",
      checks: ["student 不能跨 learnerHash", "reviewer 只读", "teacher 仅本课程"],
    },
    {
      id: "telemetry-index",
      title: "建立证据检索和遥测指标索引",
      command: "psql $SEPATH_DATABASE_URL -f cloud/sql/003_evidence_indexes.sql",
      owner: "数据工程",
      rollback: "drop index concurrently，保留原始证据表。",
      status: hasTelemetryContract ? "ready" : "configured",
      checks: ["traceId 查询 < 300ms", "learnerHash 聚合 < 1s", "Git/CI stream 可回放"],
    },
    {
      id: "backup-drill",
      title: "执行备份恢复演练",
      command: "sepath ops restore --snapshot latest --target staging",
      owner: "运维负责人",
      rollback: "staging 演练失败不影响 production，记录 Runbook 复盘。",
      status: "manual",
      checks: ["RPO <= 24h", "RTO <= 4h", "恢复后 secret_scan_hits=0"],
    },
  ];

  const policies: DataPlanePolicy[] = [
    {
      id: "tenant-rls",
      label: "租户行级隔离",
      scope: "所有业务表",
      rule: "where tenant_id = current_setting('sepath.tenant_id')",
      evidence: hasTenantManifest ? "TenantOps Manifest 已包含 tenantId/learnerHash。" : "等待租户 Manifest。",
      status: hasTenantManifest ? "ready" : "manual",
    },
    {
      id: "learner-scope",
      label: "学生只能访问本人证据",
      scope: "sepath_learners / sepath_evidence_events",
      rule: "student role requires learner_hash = jwt.claims.learnerHash",
      evidence:
        privacyGuard.roleMatrix.find((role) => role.role === "student")?.restrictions.join(" / ") ?? "角色矩阵待确认",
      status: privacyGuard.piiFindings === 0 ? "ready" : "blocked",
    },
    {
      id: "reviewer-readonly",
      label: "评委只读与脱敏试用",
      scope: "trial bundle / judge route",
      rule: "competition_reviewer can read synthetic ledger and cannot export class data",
      evidence: schoolProvisioning.demoAccounts.find((account) => account.id === "reviewer-demo")?.evidence ?? "评委账号待确认",
      status: hasAccountManifest ? "ready" : "manual",
    },
    {
      id: "model-secret-boundary",
      label: "模型密钥只在后端环境变量",
      scope: "LLM gateway / worker",
      rule: "OPENAI_API_KEY and provider secrets are never shipped to browser bundles",
      evidence: inferenceGateway.providers.find((provider) => provider.id === "edge-gateway")?.guardrail ?? "等待推理网关",
      status: hasInferenceManifest ? "ready" : "configured",
    },
    {
      id: "retention-window",
      label: "证据保留与删除窗口",
      scope: "evidence / decision / review / audit",
      rule: "pilot demo keeps synthetic data; real pilot needs school-approved retention policy",
      evidence:
        privacyGuard.dataClasses.find((dataClass) => dataClass.id === "real-course")?.retention ??
        "保留期等待学校确认",
      status: "manual",
    },
  ];

  const backups: DataPlaneBackup[] = [
    {
      id: "daily-snapshot",
      label: "每日数据库快照",
      cadence: "daily 02:00",
      rpo: "24h",
      rto: "4h",
      restoreDrill: "每次课程试点前恢复到 staging 并校验 EvidenceEvent 数量。",
      status: "configured",
    },
    {
      id: "ledger-export",
      label: "证据账本导出兜底",
      cadence: "教师每周复盘后导出",
      rpo: "1 周",
      rto: "30 min",
      restoreDrill: "使用导入恢复中心重放 JSON，校验 traceId 去重。",
      status: evidenceCount >= 6 ? "ready" : "configured",
    },
    {
      id: "release-snapshot",
      label: "上线前发布快照",
      cadence: "每次 release_gate PASS 后",
      rpo: "release point",
      rto: "1h",
      restoreDrill: "保留 ZIP SHA、数据库 schema version 和 Worker version。",
      status: "ready",
    },
  ];

  const probes: DataPlaneProbe[] = [
    {
      id: "healthz",
      label: "应用健康检查",
      endpoint: "GET /api/healthz",
      expected: "200 + buildVersion + migrationVersion",
      evidence: "静态 Demo 当前通过 release_gate；后端化后由边缘函数返回。",
      status: "configured",
    },
    {
      id: "db-read",
      label: "数据库只读探针",
      endpoint: "SELECT count(*) FROM sepath_evidence_events WHERE tenant_id=$1",
      expected: "tenant scoped count, no cross-tenant rows",
      evidence: policies.find((policy) => policy.id === "tenant-rls")?.evidence ?? "等待 RLS",
      status: hasTenantManifest ? "ready" : "manual",
    },
    {
      id: "write-dry-run",
      label: "证据写入 dry-run",
      endpoint: "POST /api/evidence/events?dryRun=1",
      expected: "schema valid, idempotency key accepted, no real write",
      evidence: apiContract.endpoints.find((endpoint) => endpoint.path.includes("/api/evidence/events"))?.purpose ?? "等待 API 契约",
      status: apiContract.readyCount >= 3 ? "ready" : "configured",
    },
    {
      id: "secret-scan",
      label: "提交包敏感信息扫描",
      endpoint: "python scripts/audit_submission_readiness.py",
      expected: "secret_scan_hits = []",
      evidence: "release gate 将其作为打包门禁。",
      status: "ready",
    },
  ];

  const env: DataPlaneEnvironmentItem[] = [
    {
      key: "SEPATH_DATABASE_URL",
      owner: "运维负责人",
      requiredFor: "Postgres/Supabase 连接",
      storage: "平台 Secret Store",
      exposedToBrowser: false,
      status: "manual",
    },
    {
      key: "SEPATH_JWT_AUDIENCE",
      owner: "学校 SSO 管理员",
      requiredFor: "OIDC/LTI token 校验",
      storage: "Worker / API runtime secret",
      exposedToBrowser: false,
      status: hasAccountManifest ? "configured" : "manual",
    },
    {
      key: "SEPATH_STORAGE_BUCKET",
      owner: "数据工程",
      requiredFor: "冷归档、导出包和恢复演练",
      storage: "对象存储配置",
      exposedToBrowser: false,
      status: "configured",
    },
    {
      key: "OPENAI_API_KEY",
      owner: "模型平台管理员",
      requiredFor: "LLM Gateway 可选模型调用",
      storage: "Worker Secret Store",
      exposedToBrowser: false,
      status: hasInferenceManifest ? "ready" : "manual",
    },
  ];

  const runbook: DataPlaneRunbookStep[] = [
    {
      id: "go-live",
      label: "学校试点前开通",
      trigger: "课程负责人确认班级、Rubric、数据授权和账号入口。",
      action: "执行 schema bootstrap、RLS、账号初始化、dry-run 写入和 release gate。",
      evidence: "DataPlane + SchoolProvisioning + TenantOps 三个 Manifest 同时归档。",
      status: "configured",
    },
    {
      id: "incident-pii",
      label: "疑似敏感字段命中",
      trigger: "privacyGuard.piiFindings > 0 或 secret_scan_hits 非空。",
      action: "阻断导入、清理 payload、重新跑脱敏和审计脚本。",
      evidence: privacyGuard.piiFindings === 0 ? "当前合成样本未发现 PII。" : "存在 PII 命中，需要阻断。",
      status: privacyGuard.piiFindings === 0 ? "ready" : "blocked",
    },
    {
      id: "incident-model",
      label: "模型网关不可用",
      trigger: "LLM provider timeout、quota 或 key missing。",
      action: "切换确定性 SafeVOI + scaffold fallback，保留 trace。",
      evidence: inferenceGateway.trace.find((step) => step.id === "fallback")?.output ?? "等待 fallback trace",
      status: hasInferenceManifest ? "ready" : "configured",
    },
    {
      id: "restore",
      label: "恢复演练",
      trigger: "课程试点前、版本发布前或数据异常后。",
      action: "恢复最新 snapshot 到 staging，重放账本导入，校验 learnerHash 与 evidence count。",
      evidence: "真实数据库接入前保持 manual，不提前宣称已完成生产演练。",
      status: "manual",
    },
  ];

  const exportPack: DataPlaneExportItem[] = [
    {
      id: "schema-ddl",
      label: "数据库 DDL 草案",
      path: "cloud/sql/001_init_sepath_schema.sql",
      purpose: "给学校 IT 或后端同学落库评审。",
      status: "configured",
    },
    {
      id: "rls-policy",
      label: "RLS 策略草案",
      path: "cloud/sql/002_enable_rls.sql",
      purpose: "证明多租户和角色访问不是口头描述。",
      status: "configured",
    },
    {
      id: "restore-runbook",
      label: "备份恢复 Runbook",
      path: "参赛提交材料包/39_生产数据平面与部署运维中心说明.md",
      purpose: "说明上线前后的健康检查、备份、回滚和人工边界。",
      status: "ready",
    },
    {
      id: "data-plane-manifest",
      label: "数据平面 Manifest",
      path: "product export / dataPlane.dataPlaneManifest",
      purpose: "和 EvidenceEvent 账本一同导出，供评委复核。",
      status: "ready",
    },
  ];

  const ddlPreview = [
    "create table sepath_tenants (tenant_id text primary key, name text, region text, plan text, slo_tier text, created_at timestamptz default now());",
    "create table sepath_courses (course_id text primary key, tenant_id text references sepath_tenants, rubric_version text, policy_version text, launch_manifest jsonb);",
    "create table sepath_learners (learner_hash text primary key, tenant_id text, course_id text, consent_valid boolean, baseline_json jsonb);",
    "create table sepath_evidence_events (event_id text primary key, tenant_id text, course_id text, learner_hash text, event_type text, trace_id text, payload_json jsonb);",
    "create table sepath_agent_decisions (decision_id text primary key, tenant_id text, learner_hash text, safevoi_version text, gate text, context_refs jsonb);",
    "create table sepath_teacher_reviews (review_id text primary key, tenant_id text, teacher_id text, learner_hash text, status text, anchor_delta numeric);",
    "create table sepath_audit_log (audit_id text primary key, tenant_id text, actor_role text, action text, resource text, result text, created_at timestamptz default now());",
  ].join("\n");

  const allStatusItems = [...tables, ...migrations, ...policies, ...backups, ...probes, ...env, ...runbook, ...exportPack];
  const readyCount = countStatus(allStatusItems, "ready");
  const configuredCount = countStatus(allStatusItems, "configured");
  const manualCount = countStatus(allStatusItems, "manual");
  const blockedCount = countStatus(allStatusItems, "blocked");
  const baseScore = Math.round(
    scoreItems(tables) * 0.22 +
      scoreItems(migrations) * 0.16 +
      scoreItems(policies) * 0.18 +
      scoreItems(backups) * 0.12 +
      scoreItems(probes) * 0.14 +
      scoreItems(runbook) * 0.1 +
      scoreItems(exportPack) * 0.08,
  );
  const score = clamp(baseScore + (hasPIIBlock ? -18 : 0) + (hasTelemetryContract ? 3 : 0), 0, 100);

  const metrics: DataPlaneMetric[] = [
    {
      id: "tables",
      label: "核心数据表",
      value: `${tables.length} 张`,
      target: "租户、课程、学生、证据、决策、复核、审计可落库",
      status: tables.every((table) => table.status !== "blocked") ? "ready" : "blocked",
    },
    {
      id: "rls",
      label: "隔离策略",
      value: `${policies.filter((policy) => policy.status === "ready").length}/${policies.length}`,
      target: "tenantId、learnerHash、reviewer readonly 均有策略",
      status: policies.some((policy) => policy.status === "blocked") ? "blocked" : "configured",
    },
    {
      id: "backup",
      label: "备份恢复",
      value: `${backups.length} 条`,
      target: "快照、账本导出、发布快照三条兜底",
      status: backups.some((backup) => backup.status === "manual") ? "configured" : "ready",
    },
    {
      id: "health",
      label: "健康探针",
      value: `${probes.filter((probe) => probe.status === "ready").length}/${probes.length}`,
      target: "应用、数据库、写入 dry-run、敏感信息扫描",
      status: probes.some((probe) => probe.status === "blocked") ? "blocked" : "configured",
    },
  ];

  const dataPlaneManifest = JSON.stringify(
    {
      manifest: "sepath-data-plane.v1",
      generatedFor: "SE-Path 学伴",
      tenantBoundary: {
        tenantManifest: hasTenantManifest,
        accountManifest: hasAccountManifest,
        noPlainStudentIdentity: privacyGuard.piiFindings === 0,
      },
      schemaTables: tables.map((table) => table.name),
      migrations: migrations.map((migration) => migration.id),
      policies: policies.map((policy) => policy.id),
      backups: backups.map((backup) => ({ id: backup.id, rpo: backup.rpo, rto: backup.rto })),
      env: env.map((item) => ({ key: item.key, exposedToBrowser: item.exposedToBrowser })),
      forbiddenClaims: [
        "no production database connected until school authorization",
        "no real student PII in demo package",
        "no model provider key in browser bundle",
      ],
    },
    null,
    2,
  );

  return {
    score,
    mode: blockedCount > 0 ? "数据平面 / 存在阻断项" : "生产数据平面 / 上线前可配置",
    summary:
      "生产数据平面把前端闭环继续向真实 SaaS 形态推进：Postgres/Supabase schema、RLS、证据账本、备份恢复、健康探针和环境变量都被产品化展示，便于学校 IT、教师和评委共同复核。",
    readyCount,
    configuredCount,
    manualCount,
    blockedCount,
    metrics,
    tables,
    migrations,
    policies,
    backups,
    probes,
    env,
    runbook,
    exportPack,
    ddlPreview,
    dataPlaneManifest,
  };
}
