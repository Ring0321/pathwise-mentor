import type { ApiContractReport } from "./apiContract";
import type { CloudHandoffReport } from "./cloudHandoff";
import type { CloudSloReport } from "./cloudSlo";
import type { DataPlaneReport } from "./dataPlane";
import type { InferenceGatewayReport } from "./inferenceGateway";
import type { SchoolProvisioningReport } from "./schoolProvisioning";
import type { TrialTelemetryReport } from "./trialTelemetry";

export type BackendStatus = "online" | "degraded" | "static" | "manual" | "blocked";

export interface BackendConnectionLane {
  id: string;
  label: string;
  status: BackendStatus;
  mode: string;
  endpoint: string;
  signal: string;
  evidence: string;
  fallback: string;
  owner: string;
}

export interface BackendReadinessCheck {
  id: string;
  label: string;
  status: BackendStatus;
  proof: string;
  command: string;
  failureMode: string;
}

export interface BackendDataFlowStep {
  id: string;
  label: string;
  from: string;
  to: string;
  payload: string;
  guardrail: string;
  status: BackendStatus;
}

export interface BackendDeployMode {
  id: string;
  label: string;
  status: BackendStatus;
  entry: string;
  whenToUse: string;
  riskBoundary: string;
}

export interface BackendStatusReport {
  runtime: string;
  score: number;
  stage: string;
  summary: string;
  onlineCount: number;
  degradedCount: number;
  staticCount: number;
  manualCount: number;
  blockedCount: number;
  lanes: BackendConnectionLane[];
  checks: BackendReadinessCheck[];
  dataFlow: BackendDataFlowStep[];
  deployModes: BackendDeployMode[];
  dashboardUrl: string;
  manifest: string;
}

const statusWeight: Record<BackendStatus, number> = {
  online: 1,
  static: 0.86,
  degraded: 0.72,
  manual: 0.5,
  blocked: 0,
};

function countStatus<T extends { status: BackendStatus }>(items: T[], status: BackendStatus): number {
  return items.filter((item) => item.status === status).length;
}

function scoreItems<T extends { status: BackendStatus }>(items: T[]) {
  if (!items.length) return 0;
  return Math.round((items.reduce((sum, item) => sum + statusWeight[item.status], 0) / items.length) * 100);
}

function hasProbe(report: CloudHandoffReport, id: string) {
  return report.probes.some((probe) => probe.id === id && probe.status === "ready");
}

export function buildBackendStatusReport(
  apiContract: ApiContractReport,
  inferenceGateway: InferenceGatewayReport,
  dataPlane: DataPlaneReport,
  schoolProvisioning: SchoolProvisioningReport,
  trialTelemetry: TrialTelemetryReport,
  cloudHandoff: CloudHandoffReport,
  cloudSlo: CloudSloReport,
): BackendStatusReport {
  const edgeDirectReady = hasProbe(cloudHandoff, "edge-api-smoke");
  const edgeHttpReady = hasProbe(cloudHandoff, "edge-api-http-smoke");
  const llmReady = inferenceGateway.inferenceManifest.includes("sepath-inference-gateway.v1");
  const pwaReady = hasProbe(cloudHandoff, "pwa-offline");
  const seedReady = schoolProvisioning.accountManifest.includes("sepath-judge-demo-seed.v1");
  const dataPlaneReady = dataPlane.blockedCount === 0 && dataPlane.score >= 75;
  const telemetryReady = trialTelemetry.telemetryManifest.includes("sepath-trial-telemetry.v1");
  const sloReady = cloudSlo.blockCount === 0 && cloudSlo.score >= 85;
  const apiReady = apiContract.openApiManifest.includes("sepath-openapi-contract.v1") && apiContract.readyCount >= 3;

  const lanes: BackendConnectionLane[] = [
    {
      id: "static-pwa",
      label: "公开静态包与 PWA 兜底",
      status: pwaReady ? "static" : "degraded",
      mode: "browser-only / offline cache / synthetic manifests",
      endpoint: "参赛提交材料包/公开试用静态包/index.html",
      signal: pwaReady ? "installable + offline fallback" : "static package only",
      evidence: "PUBLIC_TRIAL_MANIFEST.json + public-trial-pwa-validation.json",
      fallback: "云端或 API 不可用时仍可本地打开、离线回看和一键评委导览。",
      owner: "评委 / 团队",
    },
    {
      id: "edge-api",
      label: "Edge API 后端运行时",
      status: edgeDirectReady && edgeHttpReady ? "online" : "degraded",
      mode: "Cloudflare Worker compatible / local HTTP adapter",
      endpoint: "/api/evidence/events / /api/review/tickets / /api/ledger/export",
      signal: edgeDirectReady && edgeHttpReady ? "direct + HTTP smoke passed" : "waiting for smoke evidence",
      evidence: "edge-api-smoke-report.json + edge-api-http-smoke-report.json",
      fallback: "数据库未接入时使用 memory-edge-store，仍保留 RBAC、HMAC 和隐私字段拦截。",
      owner: "后端 / 运维",
    },
    {
      id: "llm-gateway",
      label: "LLM Gateway 与确定性降级",
      status: llmReady ? "online" : "degraded",
      mode: "server-only provider secret / deterministic fallback",
      endpoint: inferenceGateway.gatewayUrl,
      signal: llmReady ? "schema contract + no-key fallback" : "deterministic scaffold only",
      evidence: inferenceGateway.workerContract,
      fallback: "没有模型 Key 或模型超时时返回可审计脚手架，不生成可直接提交完整答案。",
      owner: "模型平台 / 教师",
    },
    {
      id: "postgres-rls",
      label: "Postgres / Supabase 数据平面",
      status: dataPlaneReady ? "degraded" : dataPlane.blockedCount > 0 ? "blocked" : "manual",
      mode: "schema + RLS + backups prepared, production DB needs authorization",
      endpoint: "cloud/sql/001_init_sepath_schema.sql",
      signal: `dataPlaneScore=${dataPlane.score} / blocked=${dataPlane.blockedCount}`,
      evidence: dataPlane.dataPlaneManifest,
      fallback: "正式学校数据库授权前，仅使用合成账本和只读演示包，不声称真实生产接入。",
      owner: "学校 IT / 数据工程",
    },
    {
      id: "demo-seed",
      label: "评委种子数据与只读身份",
      status: seedReady ? "static" : "manual",
      mode: "synthetic identities / no real passwords in package",
      endpoint: "JUDGE_DEMO_SEED_MANIFEST.json",
      signal: seedReady ? "reviewer seed manifest retained" : "seed manifest pending",
      evidence: schoolProvisioning.demoSeedManifestPath,
      fallback: "无法登录真实账号时，评委仍可用合成身份和一键导览完成验收。",
      owner: "产品 / 评委",
    },
    {
      id: "telemetry",
      label: "试点遥测与效果验证契约",
      status: telemetryReady ? "degraded" : "manual",
      mode: "shadow telemetry / teacher-confirmed A-B / claim gates",
      endpoint: "sepath-trial-telemetry.v1",
      signal: telemetryReady ? "telemetry contract exported" : "trial telemetry pending",
      evidence: trialTelemetry.telemetryManifest,
      fallback: "没有真实试点前只展示合成回放、观测指标和后续 A/B 方案。",
      owner: "教研 / 数据分析",
    },
  ];

  const checks: BackendReadinessCheck[] = [
    {
      id: "api-contract",
      label: "OpenAPI 契约已机器校验",
      status: apiReady ? "online" : "degraded",
      proof: `${apiContract.openApiOperationCount} operations / ${apiContract.openApiSpecPath}`,
      command: apiContract.openApiValidationCommand,
      failureMode: "契约漂移时冻结后端入口，只保留静态试用和视频兜底。",
    },
    {
      id: "edge-smoke",
      label: "Edge API direct/http 双路径验收",
      status: edgeDirectReady && edgeHttpReady ? "online" : "degraded",
      proof: "14 direct scenarios + 14 HTTP scenarios",
      command: "rtk npm run cloud:smoke && rtk npm run cloud:smoke:http",
      failureMode: "HTTP adapter 失败时不得宣称可部署 API，只展示源码和报告。",
    },
    {
      id: "llm-fallback",
      label: "模型缺 Key 可确定性降级",
      status: llmReady ? "online" : "degraded",
      proof: "missing-secret-or-model returns deterministic scaffold",
      command: "rtk npm run cloud:smoke:llm && rtk npm run cloud:smoke:llm:http",
      failureMode: "模型不可用时仍返回脚手架，不直接生成完整答案。",
    },
    {
      id: "database-boundary",
      label: "数据库生产接入边界清晰",
      status: dataPlaneReady ? "manual" : "blocked",
      proof: "RLS DDL, backups, env secrets and no real PII boundary",
      command: "psql $SEPATH_DATABASE_URL -f cloud/sql/001_init_sepath_schema.sql",
      failureMode: "未获学校授权前不能导入真实学生、不能写生产库。",
    },
    {
      id: "slo-budget",
      label: "SLO 容量压测与降级预算",
      status: sloReady ? "online" : "degraded",
      proof: `${cloudSlo.reportPath} / score=${cloudSlo.score}`,
      command: cloudSlo.command,
      failureMode: "SLO 不达标时关闭在线试用入口，切换公开静态包和 PWA。",
    },
  ];

  const dataFlow: BackendDataFlowStep[] = [
    {
      id: "browser-to-static",
      label: "评委打开入口",
      from: "browser",
      to: "static bundle",
      payload: "synthetic learner, product panels, reviewer guide",
      guardrail: "不包含真实学生 PII、真实密码或模型密钥。",
      status: pwaReady ? "static" : "degraded",
    },
    {
      id: "static-to-edge",
      label: "演示请求进入 API",
      from: "React demo",
      to: "Edge API Worker",
      payload: "EvidenceEvent, review ticket, ledger export",
      guardrail: "HMAC token、RBAC 和 protected-field scan 先于写入执行。",
      status: edgeDirectReady && edgeHttpReady ? "online" : "degraded",
    },
    {
      id: "edge-to-llm",
      label: "高风险请求进入推理网关",
      from: "Edge API",
      to: "LLM Gateway",
      payload: "diagnosis, rubric references, safe scaffold schema",
      guardrail: "Key 只在服务端，输出必须符合脚手架 schema 并要求教师复核。",
      status: llmReady ? "online" : "degraded",
    },
    {
      id: "edge-to-db",
      label: "正式试点写入数据平面",
      from: "Edge API",
      to: "Postgres/Supabase",
      payload: "tenant-scoped evidence, decisions, audits",
      guardrail: "RLS 限制 tenantId/learnerHash；正式授权前保持 manual。",
      status: dataPlaneReady ? "manual" : "blocked",
    },
    {
      id: "db-to-telemetry",
      label: "遥测进入效果评估",
      from: "evidence ledger",
      to: "trial telemetry",
      payload: "teacher-confirmed outcomes, blocked-resolution-time, claim gates",
      guardrail: "只在真实试点后声明效果，不把合成样本说成真实提分。",
      status: telemetryReady ? "degraded" : "manual",
    },
  ];

  const deployModes: BackendDeployMode[] = [
    {
      id: "competition-static",
      label: "比赛公开静态试用",
      status: pwaReady ? "static" : "degraded",
      entry: "参赛提交材料包/公开试用静态包",
      whenToUse: "评委无需账号、无需数据库、只看合成闭环和材料索引。",
      riskBoundary: "只能证明可试用闭环和工程打包，不证明真实学校生产上线。",
    },
    {
      id: "local-worker",
      label: "本地 Worker 与 HTTP 验收",
      status: edgeDirectReady && edgeHttpReady ? "online" : "degraded",
      entry: "sepath-cloud-app/cloud/serve_edge_api_worker.mjs",
      whenToUse: "评委或团队需要复查后端接口、RBAC、隐私拦截和读写回放。",
      riskBoundary: "本地 memory store 不等同生产数据库。",
    },
    {
      id: "school-private-cloud",
      label: "学校私有云试点",
      status: dataPlaneReady ? "manual" : "blocked",
      entry: "Postgres/Supabase + Worker + RLS",
      whenToUse: "学校授权真实课程、账号和数据保留策略之后。",
      riskBoundary: "没有授权前不接真实学生、不声明真实 ROI。",
    },
  ];

  const allItems = [...lanes, ...checks, ...dataFlow, ...deployModes];
  const onlineCount = countStatus(allItems, "online");
  const degradedCount = countStatus(allItems, "degraded");
  const staticCount = countStatus(allItems, "static");
  const manualCount = countStatus(allItems, "manual");
  const blockedCount = countStatus(allItems, "blocked");
  const score = Math.round(
    scoreItems(lanes) * 0.34 + scoreItems(checks) * 0.28 + scoreItems(dataFlow) * 0.22 + scoreItems(deployModes) * 0.16,
  );
  const runtime = "sepath-backend-status-center.v1";
  const stage =
    blockedCount > 0
      ? "后端可上线骨架已成型 / 生产数据库仍需授权"
      : manualCount > 0
        ? "后端试用可验收 / 真实生产接入待人工门禁"
        : "后端全链路可上线试用";
  const summary =
    "后端连接状态中心把公开静态包、Edge API、LLM Gateway、Postgres/RLS、评委种子、试点遥测、SLO 与降级策略合成一张可解释状态图，评委可以区分已机器验收、可静态试用、确定性降级和必须授权的生产边界。";

  return {
    runtime,
    score,
    stage,
    summary,
    onlineCount,
    degradedCount,
    staticCount,
    manualCount,
    blockedCount,
    lanes,
    checks,
    dataFlow,
    deployModes,
    dashboardUrl: "#backend-status",
    manifest: JSON.stringify(
      {
        runtime,
        score,
        lanes: lanes.map((lane) => ({ id: lane.id, status: lane.status, endpoint: lane.endpoint })),
        checks: checks.map((check) => ({ id: check.id, status: check.status })),
        dataFlow: dataFlow.map((step) => ({ id: step.id, status: step.status, guardrail: step.guardrail })),
        deployModes: deployModes.map((mode) => ({ id: mode.id, status: mode.status })),
        proof: {
          staticTrial: pwaReady,
          edgeApiDirectAndHttp: edgeDirectReady && edgeHttpReady,
          llmGatewayFallback: llmReady,
          databaseRequiresAuthorization: true,
          noBrowserSecrets: true,
          noRealStudentDataInDemo: true,
        },
      },
      null,
      2,
    ),
  };
}
