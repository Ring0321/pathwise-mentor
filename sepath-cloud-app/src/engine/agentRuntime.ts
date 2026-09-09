import type {
  AppState,
  DiagnosisCard,
  KnowledgeBoundaryReport,
  ReviewTicket,
  ScaffoldMessage,
  TaskDecision,
} from "../domain/types";
import type { ApiContractReport } from "./apiContract";
import { evidenceCoverage } from "./evidence";
import type { ModelOpsReport } from "./modelOps";
import type { PrivacyGuardReport } from "./privacyGuard";
import type { ValueUpliftReport } from "./valueUplift";

export type AgentRuntimeStatus = "ready" | "shadow" | "manual" | "blocked";

export interface ModelRoute {
  id: string;
  label: string;
  provider: string;
  mode: string;
  purpose: string;
  status: AgentRuntimeStatus;
  fallback: string;
  guardrail: string;
}

export interface PromptContract {
  id: string;
  label: string;
  inputSchema: string[];
  outputSchema: string[];
  refusalRule: string;
  evidenceRefs: string[];
  status: AgentRuntimeStatus;
}

export interface ToolTraceStep {
  id: string;
  tool: string;
  input: string;
  output: string;
  latencyMs: number;
  gate: AgentRuntimeStatus;
}

export interface RuntimeQualityGate {
  id: string;
  label: string;
  status: AgentRuntimeStatus;
  evidence: string;
  action: string;
}

export interface ContextPackItem {
  id: string;
  label: string;
  source: string;
  tokenBudget: number;
  reason: string;
}

export interface AgentRuntimeMetric {
  id: string;
  label: string;
  value: string;
  target: string;
}

export interface AgentRuntimeReport {
  score: number;
  stage: string;
  summary: string;
  runtimeMode: string;
  readyCount: number;
  shadowCount: number;
  manualCount: number;
  blockedCount: number;
  routes: ModelRoute[];
  promptContracts: PromptContract[];
  contextPack: ContextPackItem[];
  toolTrace: ToolTraceStep[];
  qualityGates: RuntimeQualityGate[];
  metrics: AgentRuntimeMetric[];
  fallbackPlan: string[];
  deploymentManifest: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function countStatus<T extends { status: AgentRuntimeStatus }>(items: T[], status: AgentRuntimeStatus): number {
  return items.filter((item) => item.status === status).length;
}

function ms(base: number, evidenceCount: number, offset: number): number {
  return base + Math.min(240, evidenceCount * 6) + offset;
}

export function buildAgentRuntimeReport(
  state: AppState,
  diagnosis: DiagnosisCard,
  decisions: TaskDecision[],
  scaffold: ScaffoldMessage,
  reviewTicket: ReviewTicket,
  knowledgeBoundary: KnowledgeBoundaryReport,
  privacyGuard: PrivacyGuardReport,
  apiContract: ApiContractReport,
  modelOps: ModelOpsReport,
  valueUplift: ValueUpliftReport,
): AgentRuntimeReport {
  const coverage = evidenceCoverage(state.events);
  const highRisk = diagnosis.risk === "high" || reviewTicket.action === "human_review";
  const hasSafeDecision = decisions.some((decision) => decision.gate === "PASS");
  const hasBlockedDecision = decisions.some((decision) => decision.gate === "BLOCK");
  const hasKnowledge = knowledgeBoundary.matchedSources.length >= 3;
  const privacyReady = privacyGuard.gate === "pass";
  const apiReady = apiContract.readyCount >= 2;
  const liveModelBlocked = privacyGuard.piiFindings > 0;

  const routes: ModelRoute[] = [
    {
      id: "deterministic-policy",
      label: "确定性策略内核",
      provider: "SE-Path local policy",
      mode: "always-on",
      purpose: "诊断、SafeVOI 排序、发布门、学习增值和账本导出保持可复现。",
      status: "ready",
      fallback: "无网络、无 API Key 时仍可完整演示闭环。",
      guardrail: "关键教育决策不依赖一次模型采样结果。",
    },
    {
      id: "llm-expression",
      label: "大模型表达层",
      provider: "OpenAI-compatible / school-hosted LLM",
      mode: "optional connector",
      purpose: "把结构化诊断、Rubric 和脚手架转换为自然语言解释。",
      status: liveModelBlocked ? "blocked" : "shadow",
      fallback: "没有 API Key 时使用本地模板化脚手架回复。",
      guardrail: "模型只能改写表达，不能覆盖 SafeVOI、隐私门和教师发布门。",
    },
    {
      id: "rag-boundary",
      label: "GraphRAG 知识边界",
      provider: "course knowledge store",
      mode: "retrieval-gated",
      purpose: "检索课程 Rubric、代码证据、AI 使用政策和历史反思。",
      status: hasKnowledge ? "ready" : "shadow",
      fallback: "缺少命中时降级为教师复核或补证据请求。",
      guardrail: "回答必须引用 EvidenceEvent 或 KnowledgeSource。",
    },
    {
      id: "tool-runtime",
      label: "工具调用运行时",
      provider: "Git / CI / LMS / Feishu / ledger tools",
      mode: "contract-first",
      purpose: "把外部工具事件转为 EvidenceEvent，再交给诊断和路径模块。",
      status: apiReady ? "ready" : "manual",
      fallback: "真实工具不可用时使用集成回放沙箱和合成账本。",
      guardrail: "所有 Webhook 先脱敏、幂等、契约校验，再写入账本。",
    },
  ];

  const promptContracts: PromptContract[] = [
    {
      id: "diagnostic-brief",
      label: "诊断解释 Prompt",
      inputSchema: ["DiagnosisCard", "EvidenceEvent[]", "KnowledgeBoundaryReport"],
      outputSchema: ["blocker", "reasonCodes", "confidence", "nextQuestion"],
      refusalRule: "证据覆盖不足时必须追问或转教师复核。",
      evidenceRefs: diagnosis.evidenceEventIds,
      status: diagnosis.confidence >= 0.65 ? "ready" : "shadow",
    },
    {
      id: "scaffold-answer",
      label: "脚手架回复 Prompt",
      inputSchema: ["ScaffoldMessage", "TaskDecision[]", "ReviewTicket"],
      outputSchema: ["refusal", "checklist", "miniLab", "evidenceToSubmit"],
      refusalRule: "学生索要完整代码时不得输出可直接提交答案。",
      evidenceRefs: scaffold.evidenceEventIds,
      status: scaffold.refusesDirectAnswer ? "ready" : highRisk ? "manual" : "shadow",
    },
    {
      id: "teacher-review",
      label: "教师复核摘要 Prompt",
      inputSchema: ["ReviewTicket", "KnowledgeSource[]", "riskControls"],
      outputSchema: ["severity", "approvalOptions", "classroomAction"],
      refusalRule: "高风险、低证据、隐私命中必须保留人工发布门。",
      evidenceRefs: reviewTicket.evidenceEventIds,
      status: reviewTicket.action === "human_review" ? "ready" : "shadow",
    },
  ];

  const contextPack: ContextPackItem[] = [
    {
      id: "events",
      label: "EvidenceEvent 摘要",
      source: `${state.events.length} 条学习证据`,
      tokenBudget: 900,
      reason: `当前证据覆盖率 ${Math.round(coverage * 100)}%，用于诊断和路径更新。`,
    },
    {
      id: "rubric",
      label: "Rubric 与课程边界",
      source: `${knowledgeBoundary.matchedSources.length} 个命中知识源`,
      tokenBudget: 700,
      reason: "约束模型只在课程要求、AI 使用边界和代码证据内回答。",
    },
    {
      id: "safevoi",
      label: "SafeVOI 决策候选",
      source: `${decisions.length} 个候选行动`,
      tokenBudget: 520,
      reason: hasSafeDecision ? "用于解释为什么推荐脚手架而不是直接给答案。" : "候选行动不足时转补证据。",
    },
    {
      id: "value",
      label: "学习增值声明",
      source: `valueScore=${valueUplift.valueScore}`,
      tokenBudget: 360,
      reason: "帮助模型只表达已验证增值框架，不夸大真实提分。",
    },
  ];

  const toolTrace: ToolTraceStep[] = [
    {
      id: "retrieve",
      tool: "retrieveRubricAndEvidence",
      input: diagnosis.focusCompetency,
      output: `${knowledgeBoundary.matchedSources.length} sources`,
      latencyMs: ms(92, state.events.length, 0),
      gate: hasKnowledge ? "ready" : "shadow",
    },
    {
      id: "rank",
      tool: "rankSafeVOI",
      input: `${decisions.length} candidates`,
      output: hasSafeDecision ? "PASS candidate selected" : "needs evidence",
      latencyMs: ms(78, state.events.length, 20),
      gate: hasSafeDecision ? "ready" : "manual",
    },
    {
      id: "guard",
      tool: "policyAndPrivacyGuard",
      input: `${privacyGuard.piiFindings} pii / ${hasBlockedDecision ? "blocked" : "no-block"}`,
      output: privacyReady ? "publishable scaffold" : "manual review",
      latencyMs: ms(64, state.events.length, 12),
      gate: privacyReady ? "ready" : "blocked",
    },
    {
      id: "observe",
      tool: "emitRuntimeTrace",
      input: modelOps.modelVersion,
      output: "trace + quality gate",
      latencyMs: ms(48, state.events.length, 8),
      gate: modelOps.manualCount > 0 ? "manual" : "ready",
    },
  ];

  const qualityGates: RuntimeQualityGate[] = [
    {
      id: "direct-answer",
      label: "直接答案拦截",
      status: scaffold.refusesDirectAnswer || hasBlockedDecision ? "ready" : "shadow",
      evidence: scaffold.refusesDirectAnswer ? "脚手架回复已拒绝完整替写。" : "当前轮未触发直接答案请求。",
      action: "只允许检查清单、mini lab 和证据提交要求。",
    },
    {
      id: "grounding",
      label: "证据 grounding",
      status: hasKnowledge && coverage >= 0.6 ? "ready" : "shadow",
      evidence: `${knowledgeBoundary.matchedSources.length} 个知识源，${Math.round(coverage * 100)}% 证据覆盖。`,
      action: "缺证据时追问、补账本或转教师复核。",
    },
    {
      id: "privacy",
      label: "隐私与敏感字段",
      status: privacyReady ? "ready" : "blocked",
      evidence: `${privacyGuard.piiFindings} 个 PII 命中，gate=${privacyGuard.gate}。`,
      action: "命中敏感字段时阻断公开发布和模型上下文注入。",
    },
    {
      id: "runtime-observability",
      label: "运行时可观测",
      status: modelOps.score >= 80 ? "ready" : "manual",
      evidence: `ModelOps ${modelOps.score} 分，发布门 ${modelOps.readyCount} ready。`,
      action: "上线后接 OpenTelemetry trace、质量门和回滚版本。",
    },
  ];

  const allStatuses = [
    ...routes.map((item) => item.status),
    ...promptContracts.map((item) => item.status),
    ...toolTrace.map((item) => item.gate),
    ...qualityGates.map((item) => item.status),
  ];
  const readyCount = allStatuses.filter((status) => status === "ready").length;
  const shadowCount = allStatuses.filter((status) => status === "shadow").length;
  const manualCount = allStatuses.filter((status) => status === "manual").length;
  const blockedCount = allStatuses.filter((status) => status === "blocked").length;
  const score = clamp(
    Math.round(74 + readyCount * 2.8 + Math.round(coverage * 5) + (privacyReady ? 5 : -14) - manualCount * 1.4 - blockedCount * 16),
    0,
    100,
  );

  return {
    score,
    stage: "Agent Runtime v1 / LLM connector ready",
    runtimeMode:
      blockedCount > 0
        ? "privacy-blocked"
        : manualCount > 0
          ? "deterministic + shadow LLM"
          : "deterministic + governed LLM",
    summary:
      "SE-Path 将大模型放在可治理表达层：确定性策略负责教育决策，LLM 负责解释和对话表达，RAG 与工具调用必须经过证据、隐私和教师发布门。",
    readyCount,
    shadowCount,
    manualCount,
    blockedCount,
    routes,
    promptContracts,
    contextPack,
    toolTrace,
    qualityGates,
    metrics: [
      {
        id: "context-budget",
        label: "上下文预算",
        value: `${contextPack.reduce((total, item) => total + item.tokenBudget, 0)} tokens`,
        target: "只注入摘要、Rubric 和证据引用",
      },
      {
        id: "tools",
        label: "工具调用",
        value: `${toolTrace.length} steps`,
        target: "检索、排序、风控、观测全链路可追踪",
      },
      {
        id: "quality",
        label: "质量门",
        value: `${readyCount} ready`,
        target: "无证据不回答，高风险不自动发布",
      },
      {
        id: "fallback",
        label: "无 Key 降级",
        value: routes.find((route) => route.id === "deterministic-policy")?.status === "ready" ? "可演示" : "需修复",
        target: "评审现场不依赖临场 API Key",
      },
    ],
    fallbackPlan: [
      "无 Key 或没有模型密钥时，使用本地确定性策略和模板化脚手架完成闭环演示。",
      "RAG 命中不足时，不让模型自由发挥，转为补证据或教师复核。",
      "隐私命中或越权请求出现时，阻断上下文注入和公开发布。",
      "真实上线后，把 toolTrace 接入 OpenTelemetry，并按 modelOps 版本回滚。",
    ],
    deploymentManifest: JSON.stringify(
      {
        runtime: "sepath-agent-runtime.v1",
        decisionLayer: "deterministic-policy",
        llmLayer: "optional-expression-and-dialogue",
        grounding: "KnowledgeBoundaryReport + EvidenceEvent refs",
        safety: ["SafeVOI", "privacyGuard", "teacherReviewGate"],
        noKeyFallback: true,
        claimBoundary: "no real-score uplift claim before trial",
      },
      null,
      2,
    ),
  };
}
