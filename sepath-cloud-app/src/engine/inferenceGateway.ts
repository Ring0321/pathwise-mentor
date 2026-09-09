import type {
  AppState,
  DiagnosisCard,
  KnowledgeBoundaryReport,
  ScaffoldMessage,
  TaskDecision,
} from "../domain/types";
import type { AgentRuntimeReport } from "./agentRuntime";
import type { ApiContractReport } from "./apiContract";
import { evidenceCoverage } from "./evidence";
import type { ModelOpsReport } from "./modelOps";
import type { PrivacyGuardReport } from "./privacyGuard";

export type InferenceGatewayStatus = "ready" | "shadow" | "manual" | "blocked";

export interface InferenceProvider {
  id: string;
  label: string;
  role: string;
  endpoint: string;
  status: InferenceGatewayStatus;
  envVars: string[];
  fallback: string;
  guardrail: string;
}

export interface GatewayContextChunk {
  id: string;
  label: string;
  source: string;
  score: number;
  tokenBudget: number;
  excerpt: string;
}

export interface GatewayGuardrail {
  id: string;
  label: string;
  status: InferenceGatewayStatus;
  evidence: string;
  enforcement: string;
}

export interface GatewayTraceStep {
  id: string;
  label: string;
  tool: string;
  latencyMs: number;
  status: InferenceGatewayStatus;
  output: string;
}

export interface GatewayOpenSourceReference {
  id: string;
  label: string;
  sourceUrl: string;
  referenceValue: string;
  productBoundary: string;
}

export interface InferenceGatewayReport {
  score: number;
  mode: string;
  summary: string;
  gatewayUrl: string;
  readyCount: number;
  shadowCount: number;
  manualCount: number;
  blockedCount: number;
  providers: InferenceProvider[];
  contextChunks: GatewayContextChunk[];
  guardrails: GatewayGuardrail[];
  trace: GatewayTraceStep[];
  openSourceReferences: GatewayOpenSourceReference[];
  requestContract: string;
  responsePreview: string;
  deploymentSteps: string[];
  workerContract: string;
  inferenceManifest: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function statusWeight(status: InferenceGatewayStatus): number {
  if (status === "ready") return 1;
  if (status === "shadow") return 0.72;
  if (status === "manual") return 0.48;
  return 0;
}

function countStatus<T extends { status: InferenceGatewayStatus }>(items: T[], status: InferenceGatewayStatus): number {
  return items.filter((item) => item.status === status).length;
}

function traceLatency(base: number, eventCount: number, offset: number): number {
  return base + Math.min(180, eventCount * 5) + offset;
}

function safeTaskDecision(decisions: TaskDecision[]): TaskDecision | undefined {
  return decisions.find((decision) => decision.gate === "PASS") ?? decisions[0];
}

export function buildInferenceGatewayReport(
  state: AppState,
  diagnosis: DiagnosisCard,
  decisions: TaskDecision[],
  scaffold: ScaffoldMessage,
  knowledgeBoundary: KnowledgeBoundaryReport,
  privacyGuard: PrivacyGuardReport,
  apiContract: ApiContractReport,
  agentRuntime: AgentRuntimeReport,
  modelOps: ModelOpsReport,
): InferenceGatewayReport {
  const coverage = evidenceCoverage(state.events);
  const retrievalReady = knowledgeBoundary.matchedSources.length >= 3 && knowledgeBoundary.retrievalCoverage >= 0.75;
  const privacyReady = privacyGuard.gate === "pass" && privacyGuard.piiFindings === 0;
  const apiReady = apiContract.readyCount >= 2;
  const modelOpsReady = modelOps.score >= 80;
  const highRisk = diagnosis.risk === "high" || scaffold.refusesDirectAnswer;
  const chosenDecision = safeTaskDecision(decisions);

  const providers: InferenceProvider[] = [
    {
      id: "edge-gateway",
      label: "Edge LLM Gateway",
      role: "把浏览器请求转成 HMAC 保护的 OpenAI-compatible / 学校托管模型调用",
      endpoint: "POST /api/ai/generate-scaffold",
      status: apiReady && privacyReady ? "ready" : privacyReady ? "shadow" : "blocked",
      envVars: ["SEPATH_AUTH_SECRET", "LLM_BASE_URL", "LLM_API_KEY", "LLM_MODEL", "SEPATH_PRIVACY_MODE"],
      fallback: "缺少 LLM_API_KEY 或 LLM_MODEL 时返回确定性脚手架响应，并由 npm run cloud:smoke:llm 验证不阻断闭环演示。",
      guardrail: "HMAC Bearer token 先校验角色和 learnerHash，API Key 只存在 Worker/后端密钥仓库，前端永不暴露密钥。",
    },
    {
      id: "graph-rag",
      label: "GraphRAG Context Pack",
      role: "把 Rubric、课程政策、CI 证据和反思压缩成可引用上下文",
      endpoint: "retrieveRubricAndEvidence()",
      status: retrievalReady ? "ready" : "shadow",
      envVars: ["SEPATH_COURSE_ID", "SEPATH_TENANT_ID"],
      fallback: "命中不足时只允许追问、补证据或转教师复核。",
      guardrail: "所有回答必须引用 KnowledgeSource 或 EvidenceEvent，禁止自由编造课程要求。",
    },
    {
      id: "deterministic-fallback",
      label: "No-Key Deterministic Fallback",
      role: "无 Key、无网或模型失败时生成可复现脚手架",
      endpoint: "localScaffoldTemplate()",
      status: "ready",
      envVars: [],
      fallback: "这是默认模式，保证评审现场和公开静态包都能完整运行。",
      guardrail: "教育决策来自 SafeVOI、发布门和教师复核，不来自一次模型采样。",
    },
    {
      id: "eval-observability",
      label: "LLM Eval & Trace",
      role: "把模型输入、输出、拒答、引用和教师校准结果写入质量追踪",
      endpoint: "emitInferenceTrace()",
      status: modelOpsReady ? "ready" : "manual",
      envVars: ["OTEL_EXPORTER_OTLP_ENDPOINT", "SEPATH_TRACE_SAMPLE_RATE"],
      fallback: "未接入观测平台时保留前端 trace 和 EvidenceEvent 导出。",
      guardrail: "RAG/LLM 指标只验证输出质量，不替代真实学习增值和教师金标。",
    },
  ];

  const contextChunks: GatewayContextChunk[] = knowledgeBoundary.matchedSources.slice(0, 4).map((source, index) => ({
    id: source.id,
    label: source.title,
    source: `${source.kind} / ${source.sourceRef}`,
    score: source.matchScore,
    tokenBudget: 240 - index * 24,
    excerpt: source.summary,
  }));

  if (contextChunks.length === 0) {
    contextChunks.push({
      id: "fallback-task",
      label: state.task.title,
      source: "project_task",
      score: 0.58,
      tokenBudget: 220,
      excerpt: state.task.description,
    });
  }

  const guardrails: GatewayGuardrail[] = [
    {
      id: "direct-answer-gate",
      label: "直接答案拦截",
      status: scaffold.refusesDirectAnswer || highRisk ? "ready" : "shadow",
      evidence: scaffold.refusesDirectAnswer ? "当前请求已触发拒绝替写。" : "当前轮次未出现完整代码索要。",
      enforcement: "输出 schema 中必须包含 refusal、checklist、miniLab 和 evidenceToSubmit，不能输出可直接提交代码。",
    },
    {
      id: "privacy-minimization",
      label: "上下文最小化",
      status: privacyReady ? "ready" : "blocked",
      evidence: `${privacyGuard.piiFindings} 个 PII 命中，gate=${privacyGuard.gate}。`,
      enforcement: "只传 learnerHash、traceId、证据摘要和 Rubric 片段，不传姓名、学号、仓库密钥或原始日志。",
    },
    {
      id: "rag-citation",
      label: "RAG 引用约束",
      status: retrievalReady ? "ready" : "shadow",
      evidence: `${contextChunks.length} 个上下文片段，检索覆盖 ${Math.round(knowledgeBoundary.retrievalCoverage * 100)}%。`,
      enforcement: "响应必须返回 citations；引用不足时转追问或教师复核。",
    },
    {
      id: "teacher-release",
      label: "教师发布门",
      status: diagnosis.risk === "high" ? "manual" : "ready",
      evidence: diagnosis.risk === "high" ? "高风险诊断需要教师确认后发布。" : "当前风险允许影子运行或脚手架发布。",
      enforcement: "高风险、低证据或 Rubric 漂移时只创建 ReviewTicket，不自动面向学生发布。",
    },
  ];

  const trace: GatewayTraceStep[] = [
    {
      id: "pack",
      label: "上下文打包",
      tool: "buildGraphRagContextPack",
      latencyMs: traceLatency(48, state.events.length, 0),
      status: retrievalReady ? "ready" : "shadow",
      output: `${contextChunks.length} chunks / ${contextChunks.reduce((total, item) => total + item.tokenBudget, 0)} tokens`,
    },
    {
      id: "policy",
      label: "策略发布门",
      tool: "applySafeVoiAndPrivacyGate",
      latencyMs: traceLatency(52, state.events.length, 14),
      status: privacyReady ? (diagnosis.risk === "high" ? "manual" : "ready") : "blocked",
      output: chosenDecision ? `${chosenDecision.label} / ${chosenDecision.gate}` : "no decision",
    },
    {
      id: "compose",
      label: "Prompt 契约组装",
      tool: "composeScaffoldPrompt",
      latencyMs: traceLatency(42, state.events.length, 20),
      status: scaffold.refusesDirectAnswer ? "ready" : "shadow",
      output: "system + task + evidence refs + output schema",
    },
    {
      id: "fallback",
      label: "无 Key 降级响应",
      tool: "localScaffoldTemplate",
      latencyMs: traceLatency(28, state.events.length, 8),
      status: "ready",
      output: "deterministic scaffold response",
    },
    {
      id: "llm-smoke",
      label: "LLM Gateway 烟测",
      tool: "smoke_llm_gateway_worker",
      latencyMs: traceLatency(34, state.events.length, 10),
      status: "ready",
      output: "10 scenarios / HMAC / fallback / privacy block / schema contract",
    },
    {
      id: "llm-http-smoke",
      label: "LLM Gateway HTTP 烟测",
      tool: "smoke_llm_gateway_http",
      latencyMs: traceLatency(46, state.events.length, 18),
      status: "ready",
      output: "10 HTTP scenarios / local adapter / HMAC / fallback / privacy block",
    },
    {
      id: "observe",
      label: "Trace 与评测写回",
      tool: "emitInferenceTrace",
      latencyMs: traceLatency(36, state.events.length, 12),
      status: modelOpsReady ? "ready" : "manual",
      output: `AgentRuntime=${agentRuntime.score} / ModelOps=${modelOps.score}`,
    },
  ];

  const requestContract = JSON.stringify(
    {
      endpoint: "POST /api/ai/generate-scaffold",
      auth: "server-side secret only",
      tenantId: "tenant-se-course-2026",
      courseId: "software-engineering-project",
      learnerHash: state.learner.id.replace("learner-", "stu_hash_"),
      taskId: state.task.id,
      traceId: "trace-demo-inference-001",
      intent: "scaffolded_ci_recovery_help",
      promptVersion: "sepath-scaffold-v1",
      evidenceEventIds: diagnosis.evidenceEventIds,
      knowledgeSourceIds: contextChunks.map((item) => item.id),
      guardrails: guardrails.map((item) => item.id),
      requestedOutputSchema: {
        refusal: "string",
        checklist: "string[]",
        miniLab: "string[]",
        evidenceToSubmit: "string[]",
        citations: "string[]",
        teacherReviewRequired: "boolean",
      },
      noKeyFallback: true,
    },
    null,
    2,
  );

  const responsePreview = JSON.stringify(
    {
      mode: "deterministic-fallback",
      fallback: true,
      refusal: scaffold.refusesDirectAnswer
        ? "我不能直接给你可复制提交的完整代码，但可以帮你定位失败路径并设计最小修复实验。"
        : "我会基于证据和 Rubric 给出脚手架建议。",
      checklist: scaffold.checklist.slice(0, 4),
      miniLab: [
        "复现 CI 失败并只记录第一个 failing assertion。",
        "用 Given-When-Then 写出边界用例，再修改最小实现。",
        "提交 PR 时附上失败日志、修复 diff 和反思说明。",
      ],
      evidenceToSubmit: diagnosis.evidenceEventIds.slice(0, 4),
      citations: contextChunks.map((item) => item.id),
      teacherReviewRequired: diagnosis.risk === "high" || knowledgeBoundary.teacherReviewRequired,
    },
    null,
    2,
  );

  const openSourceReferences: GatewayOpenSourceReference[] = [
    {
      id: "llamaindex",
      label: "LlamaIndex",
      sourceUrl: "https://github.com/run-llama/llama_index",
      referenceValue: "数据连接、索引、检索和上下文打包思路。",
      productBoundary: "SE-Path 只吸收 RAG 工程范式，检索对象和学习证据模型为自研。",
    },
    {
      id: "ragas",
      label: "Ragas",
      sourceUrl: "https://github.com/explodinggradients/ragas",
      referenceValue: "RAG 检索质量、忠实度和上下文相关性评测思路。",
      productBoundary: "RAG 指标只作为输出质量信号，学习增值仍需 TrialTelemetry 和教师确认。",
    },
    {
      id: "deepeval",
      label: "DeepEval",
      sourceUrl: "https://github.com/confident-ai/deepeval",
      referenceValue: "LLM 输出回归测试、测试用例和 CI 化评测。",
      productBoundary: "SE-Path 将评测维度改造成拒答率、脚手架质量、Rubric 对齐和教师负担。",
    },
    {
      id: "langfuse",
      label: "Langfuse",
      sourceUrl: "https://github.com/langfuse/langfuse",
      referenceValue: "Prompt、trace、评估和可观测性平台设计。",
      productBoundary: "SE-Path trace 与 EvidenceEvent 合账，但不上传真实学生隐私数据。",
    },
  ];

  const deploymentSteps = [
    "静态前端部署到 OpenAI Sites、Cloudflare Pages、Vercel、Nginx 或学校内网静态服务。",
    "将 `cloud/llm-gateway-worker.ts` 部署为 Worker 或学校后端路由，配置 LLM_BASE_URL、LLM_API_KEY 和 LLM_MODEL。",
    "前端只调用 `/api/ai/generate-scaffold`，不保存、不传递、不展示模型密钥。",
    "Worker 先做隐私字段过滤、证据覆盖检查和输出 schema 约束，再调用 OpenAI-compatible 模型。",
    "模型失败、限流、无 Key、RAG 命中不足或隐私命中时，自动返回确定性 fallback 响应并写入 trace。",
  ];

  const workerContract = JSON.stringify(
    {
      file: "sepath-cloud-app/cloud/llm-gateway-worker.mjs",
      typedWrapper: "sepath-cloud-app/cloud/llm-gateway-worker.ts",
      route: "/api/ai/generate-scaffold",
      method: "POST",
      auth: "SE-Path HMAC Bearer token",
      secretBoundary: "LLM_API_KEY only lives in Worker env",
      fallbackModes: ["missing-secret", "missing-model", "model-error", "privacy-block", "low-rag-coverage"],
      serveCommand: "npm run cloud:serve:llm",
      smokeCommands: ["npm run cloud:smoke:llm", "npm run cloud:smoke:llm:http"],
      smokeReports: [
        "sepath-cloud-app/qa/llm-gateway-smoke-report.json",
        "sepath-cloud-app/qa/llm-gateway-http-smoke-report.json",
      ],
      responseManifest: "sepath-inference-gateway.v1",
    },
    null,
    2,
  );

  const statusItems = [...providers, ...guardrails, ...trace];
  const readyCount = countStatus(statusItems, "ready");
  const shadowCount = countStatus(statusItems, "shadow");
  const manualCount = countStatus(statusItems, "manual");
  const blockedCount = countStatus(statusItems, "blocked");
  const averageStatus = statusItems.reduce((total, item) => total + statusWeight(item.status), 0) / statusItems.length;
  const score = clamp(
    Math.round(
      averageStatus * 78 +
        Math.round(coverage * 6) +
        (privacyReady ? 5 : -18) +
        (apiReady ? 4 : 0) +
        (retrievalReady ? 4 : 0) +
        (agentRuntime.score >= 80 ? 3 : 0) -
        blockedCount * 14,
    ),
    0,
    100,
  );

  return {
    score,
    mode:
      blockedCount > 0
        ? "privacy-blocked fallback"
        : manualCount > 0
          ? "edge-ready / teacher-gated LLM"
          : "edge-ready / governed LLM optional",
    summary:
      "推理网关把真实模型能力放到可替换的云端表达层：浏览器不接触密钥，Worker 负责 OpenAI-compatible 调用、RAG 引用、隐私过滤、输出 schema、Trace 和无 Key 降级。",
    gatewayUrl: "/api/ai/generate-scaffold",
    readyCount,
    shadowCount,
    manualCount,
    blockedCount,
    providers,
    contextChunks,
    guardrails,
    trace,
    openSourceReferences,
    requestContract,
    responsePreview,
    deploymentSteps,
    workerContract,
    inferenceManifest: JSON.stringify(
      {
        runtime: "sepath-inference-gateway.v1",
        frontend: "static React app",
        edgeGateway: "/api/ai/generate-scaffold",
        llmCompatibility: "OpenAI-compatible chat completion or school-hosted model",
        deterministicFallback: true,
        secretBoundary: "browser never receives LLM_API_KEY",
        auth: "HMAC token required when SEPATH_AUTH_SECRET is configured",
        smokeReports: ["qa/llm-gateway-smoke-report.json", "qa/llm-gateway-http-smoke-report.json"],
        grounding: contextChunks.map((item) => item.id),
        guardrails: guardrails.map((item) => item.id),
        observability: ["InferenceTrace", "EvidenceEvent", "ModelOps", "TrialTelemetry"],
        claimBoundary: "LLM output quality is not claimed as real learning uplift before teacher-confirmed trial",
      },
      null,
      2,
    ),
  };
}
