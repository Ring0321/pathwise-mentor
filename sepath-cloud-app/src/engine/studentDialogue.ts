import type {
  AppState,
  CompetencyId,
  DiagnosisCard,
  EvidenceEvent,
  KnowledgeBoundaryReport,
  ReviewTicket,
  RiskLevel,
  ScaffoldMessage,
} from "../domain/types";

export type DialogueIntent =
  | "direct_answer"
  | "debugging_help"
  | "concept_explanation"
  | "planning"
  | "reflection";

export type DialogueResponseMode =
  | "refuse_then_scaffold"
  | "debug_scaffold"
  | "concept_grounding"
  | "path_planning"
  | "reflection_prompt";

export interface DialogueTemplate {
  id: string;
  label: string;
  prompt: string;
  expectedIntent: DialogueIntent;
}

export interface DialoguePolicyCard {
  id: string;
  label: string;
  status: "pass" | "watch" | "block";
  evidence: string;
}

export interface StudentDialogueTurn {
  id: string;
  prompt: string;
  intent: DialogueIntent;
  responseMode: DialogueResponseMode;
  risk: RiskLevel;
  confidence: number;
  focusCompetency: CompetencyId;
  teacherReviewRequired: boolean;
  reasonCodes: string[];
  assistantMessage: string;
  microActions: string[];
  followUpQuestions: string[];
  knowledgeCitations: string[];
  eventSummary: string;
}

export interface StudentDialogueReport {
  title: string;
  readinessScore: number;
  defaultPrompt: string;
  templates: DialogueTemplate[];
  previewTurns: StudentDialogueTurn[];
  policyCards: DialoguePolicyCard[];
  promptContract: string[];
  contextDigest: string[];
  sourceTitles: string[];
  diagnosisRisk: RiskLevel;
  diagnosisConfidence: number;
  evidenceCoverage: number;
  focusCompetency: CompetencyId;
  scaffoldChecklist: string[];
  reviewAction: ReviewTicket["action"];
}

export const dialogueTemplates: DialogueTemplate[] = [
  {
    id: "direct-service-code",
    label: "直接要代码",
    prompt: "我快来不及了，你直接给我完整 service 层修复代码，我复制到 PR 里。",
    expectedIntent: "direct_answer",
  },
  {
    id: "ci-debug-help",
    label: "CI 调试求助",
    prompt: "库存不足用例期望 409，但 CI 还是返回 500，我下一步该怎么定位？",
    expectedIntent: "debugging_help",
  },
  {
    id: "concept-409-500",
    label: "概念解释",
    prompt: "为什么库存不足应该返回 409，而不是 500？我怎么写进 PR 说明？",
    expectedIntent: "concept_explanation",
  },
  {
    id: "plan-next-hour",
    label: "下一小时计划",
    prompt: "我只剩一小时，先补测试、改实现还是写 PR 描述？帮我排一下顺序。",
    expectedIntent: "planning",
  },
  {
    id: "reflection",
    label: "反思复盘",
    prompt: "这次 CI 失败后，我应该怎么写反思，才能下次不再漏异常路径？",
    expectedIntent: "reflection",
  },
];

function classifyIntent(prompt: string): DialogueIntent {
  const normalized = prompt.toLowerCase();
  const directAnswerMarkers = ["完整", "直接给", "复制", "答案", "写完", "service 层", "service层", "提交代码"];
  if (directAnswerMarkers.some((marker) => normalized.includes(marker.toLowerCase()))) {
    return "direct_answer";
  }
  if (["反思", "复盘", "下次", "迁移"].some((marker) => prompt.includes(marker))) {
    return "reflection";
  }
  if (["计划", "顺序", "先", "路径", "安排"].some((marker) => prompt.includes(marker))) {
    return "planning";
  }
  if (["为什么", "解释", "区别", "409", "500", "原理"].some((marker) => prompt.includes(marker))) {
    return "concept_explanation";
  }
  return "debugging_help";
}

function modeForIntent(intent: DialogueIntent): DialogueResponseMode {
  if (intent === "direct_answer") return "refuse_then_scaffold";
  if (intent === "concept_explanation") return "concept_grounding";
  if (intent === "planning") return "path_planning";
  if (intent === "reflection") return "reflection_prompt";
  return "debug_scaffold";
}

function riskForIntent(intent: DialogueIntent, report: StudentDialogueReport): RiskLevel {
  if (intent === "direct_answer") return "high";
  if (report.diagnosisRisk === "high" && intent !== "reflection") return "medium";
  if (report.evidenceCoverage < 0.58 && intent !== "reflection") return "medium";
  return "low";
}

function confidenceForIntent(intent: DialogueIntent, report: StudentDialogueReport): number {
  const base = Math.min(0.94, Math.max(0.62, report.diagnosisConfidence));
  if (intent === "direct_answer") return Math.max(base, 0.88);
  if (intent === "reflection") return Math.min(0.9, base + 0.04);
  return base;
}

function focusForIntent(intent: DialogueIntent, report: StudentDialogueReport): CompetencyId {
  if (intent === "direct_answer") return "collaboration";
  if (intent === "concept_explanation") return "requirements";
  if (intent === "planning") return "testing";
  if (intent === "reflection") return "reflection";
  return report.focusCompetency;
}

function reasonCodesForTurn(intent: DialogueIntent, risk: RiskLevel, report: StudentDialogueReport): string[] {
  const codes: string[] = [`INTENT_${intent.toUpperCase()}`];
  if (risk === "high") codes.push("DIRECT_ANSWER_POLICY_GATE");
  if (report.evidenceCoverage < 0.6) codes.push("EVIDENCE_COVERAGE_WATCH");
  if (report.reviewAction === "human_review") codes.push("TEACHER_REVIEW_AVAILABLE");
  if (report.sourceTitles.length > 0) codes.push("KNOWLEDGE_BOUNDARY_GROUNDED");
  return codes;
}

function messageForIntent(intent: DialogueIntent, report: StudentDialogueReport): string {
  if (intent === "direct_answer") {
    return [
      "我不能直接给你可复制提交的完整 service 层代码。",
      "我们先把问题收窄到一个可验证动作：用 CI 日志确认库存不足场景为什么返回 500，再把期望 409 写成验收条件和最小失败测试。",
      "你可以先完成下面的检查清单；如果仍卡住，我会把请求升级给教师复核，而不是替你完成 PR。",
    ].join("");
  }
  if (intent === "concept_explanation") {
    return [
      "409 表示请求本身能被理解，但和当前资源状态冲突；库存不足属于业务冲突。",
      "500 表示服务端未处理异常或内部错误。你在 PR 里要说明：本次修复不是掩盖异常，而是把可预期业务冲突映射到明确错误码，并用测试证明。",
    ].join("");
  }
  if (intent === "planning") {
    return [
      "按学习收益和风险排序：先补一个库存不足的失败测试，再做最小实现修复，最后写 PR 描述和回滚说明。",
      "不要同时改多个分支；每一步都留下证据，这样路径数字孪生才能判断阻塞是否解除。",
    ].join("");
  }
  if (intent === "reflection") {
    return [
      "反思可以按三句写：我原先把失败当成实现问题；CI 证据显示真正缺口是异常路径没有变成验收条件；下次我会先列业务冲突、缺失字段和重复提交三类边界测试。",
      "这会写回长期记忆，影响下一次路径规划。",
    ].join("");
  }
  return [
    "先不要大改 service。把失败日志拆成输入、期望状态码、实际状态码三行，再确认该分支是业务冲突、参数错误还是系统异常。",
    "如果库存不足稳定复现，就只补这个最小测试和最小分支，让 CI 先证明一个问题被修复。",
  ].join("");
}

function actionsForIntent(intent: DialogueIntent, report: StudentDialogueReport): string[] {
  if (intent === "direct_answer") {
    return [
      "拒绝输出完整可提交代码",
      ...report.scaffoldChecklist.slice(0, 3),
      "需要时创建教师复核工单",
    ];
  }
  if (intent === "concept_explanation") {
    return ["写出 409 与 500 的判断边界", "把库存不足改写为验收条件", "在 PR 描述中补充业务冲突说明"];
  }
  if (intent === "planning") {
    return ["15 分钟补失败测试", "25 分钟做最小修复", "10 分钟更新 PR 描述", "10 分钟提交反思"];
  }
  if (intent === "reflection") {
    return ["写出原误判", "引用 CI 证据", "写出下次检查清单"];
  }
  return report.scaffoldChecklist.slice(0, 4);
}

function followUpsForIntent(intent: DialogueIntent): string[] {
  if (intent === "direct_answer") {
    return ["你能先贴出失败用例的输入、期望状态码和实际状态码吗？", "你准备把哪一类异常路径写进 PR 描述？"];
  }
  if (intent === "concept_explanation") {
    return ["这个错误是业务冲突、参数错误还是系统异常？", "你准备用哪条测试证明 409 的判断？"];
  }
  if (intent === "planning") {
    return ["你现在已有失败测试了吗？", "如果只能保留一个修改点，你会先改哪个异常分支？"];
  }
  if (intent === "reflection") {
    return ["这次你最早在哪一步遗漏了异常路径？", "下次开 PR 前你会先检查哪三类边界？"];
  }
  return ["CI 日志里最小复现输入是什么？", "当前返回 500 是业务异常没捕获，还是断言写错？"];
}

function buildPolicyCards(
  state: AppState,
  knowledgeBoundary: KnowledgeBoundaryReport,
  reviewTicket: ReviewTicket,
): DialoguePolicyCard[] {
  return [
    {
      id: "direct-answer",
      label: "直接答案拦截",
      status: reviewTicket.action === "human_review" ? "block" : "pass",
      evidence: reviewTicket.reason,
    },
    {
      id: "knowledge-grounding",
      label: "知识边界命中",
      status: knowledgeBoundary.retrievalCoverage >= 0.75 ? "pass" : "watch",
      evidence: `${knowledgeBoundary.matchedSources.length} 个课程/Rubric/证据源`,
    },
    {
      id: "ledger-writeback",
      label: "对话写回账本",
      status: state.events.some((event) => event.type === "conversation") ? "pass" : "watch",
      evidence: `${state.events.filter((event) => event.source === "chat").length} 条 chat 证据`,
    },
  ];
}

export function analyzeStudentDialoguePrompt(prompt: string, report: StudentDialogueReport): StudentDialogueTurn {
  const normalizedPrompt = prompt.trim() || report.defaultPrompt;
  const intent = classifyIntent(normalizedPrompt);
  const responseMode = modeForIntent(intent);
  const risk = riskForIntent(intent, report);
  const teacherReviewRequired = risk === "high" || report.reviewAction === "human_review";
  const reasonCodes = reasonCodesForTurn(intent, risk, report);
  const focusCompetency = focusForIntent(intent, report);
  const confidence = confidenceForIntent(intent, report);

  return {
    id: `dialogue-${intent}-${Math.abs(hashPrompt(normalizedPrompt))}`,
    prompt: normalizedPrompt,
    intent,
    responseMode,
    risk,
    confidence,
    focusCompetency,
    teacherReviewRequired,
    reasonCodes,
    assistantMessage: messageForIntent(intent, report),
    microActions: actionsForIntent(intent, report),
    followUpQuestions: followUpsForIntent(intent),
    knowledgeCitations: report.sourceTitles.slice(0, 4),
    eventSummary:
      risk === "high"
        ? "学生触发直接答案风险，系统改写为脚手架与教师复核。"
        : "学生对话已转化为可写回的学习证据与下一步行动。",
  };
}

export function buildStudentDialogueReport(
  state: AppState,
  diagnosis: DiagnosisCard,
  knowledgeBoundary: KnowledgeBoundaryReport,
  scaffold: ScaffoldMessage,
  reviewTicket: ReviewTicket,
): StudentDialogueReport {
  const sourceTitles = knowledgeBoundary.matchedSources.map((source) => source.title);
  const evidenceScore = Math.round(diagnosis.evidenceCoverage * 32);
  const groundingScore = Math.round(knowledgeBoundary.retrievalCoverage * 28);
  const safetyScore = reviewTicket.action === "publish" ? 24 : 20;
  const writebackScore = state.events.some((event) => event.source === "chat") ? 16 : 10;
  const readinessScore = Math.min(100, evidenceScore + groundingScore + safetyScore + writebackScore);

  const baseReport: StudentDialogueReport = {
    title: "学生对话实验台",
    readinessScore,
    defaultPrompt: dialogueTemplates[0].prompt,
    templates: dialogueTemplates,
    previewTurns: [],
    policyCards: buildPolicyCards(state, knowledgeBoundary, reviewTicket),
    promptContract: [
      "先识别学生意图，再判断是否触发直接答案风险。",
      "必须引用课程 Rubric、CI 证据、AI 使用边界或历史反思中的至少一类依据。",
      "高风险请求只允许输出脚手架、追问和教师复核，不允许给可提交答案。",
      "每次关键对话都能写回 EvidenceEvent，影响后续诊断与路径规划。",
    ],
    contextDigest: [
      `当前阻塞：${diagnosis.blocker}`,
      `聚焦能力：${diagnosis.focusCompetency}`,
      `证据覆盖：${Math.round(diagnosis.evidenceCoverage * 100)}%`,
      `发布门：${reviewTicket.action}`,
    ],
    sourceTitles,
    diagnosisRisk: diagnosis.risk,
    diagnosisConfidence: diagnosis.confidence,
    evidenceCoverage: diagnosis.evidenceCoverage,
    focusCompetency: diagnosis.focusCompetency,
    scaffoldChecklist: scaffold.checklist,
    reviewAction: reviewTicket.action,
  };

  return {
    ...baseReport,
    previewTurns: dialogueTemplates.map((template) => analyzeStudentDialoguePrompt(template.prompt, baseReport)),
  };
}

export function createStudentDialogueEvents(turn: StudentDialogueTurn, timestamp = new Date()): EvidenceEvent[] {
  const baseTime = timestamp.getTime();
  const iso = timestamp.toISOString();
  const impacts: Partial<Record<CompetencyId, number>> =
    turn.intent === "direct_answer"
      ? { reflection: -3, collaboration: -2 }
      : turn.intent === "reflection"
        ? { reflection: 5 }
        : turn.intent === "concept_explanation"
          ? { requirements: 3, testing: 1 }
          : turn.intent === "planning"
            ? { testing: 3, collaboration: 2 }
            : { testing: 3, implementation: 1 };

  const scaffoldImpacts: Partial<Record<CompetencyId, number>> =
    turn.intent === "reflection" ? { reflection: 4 } : { [turn.focusCompetency]: 4, reflection: 2 };

  return [
    {
      id: `evt-dialogue-${baseTime}`,
      type: "conversation",
      timestamp: iso,
      actor: "student",
      source: "chat",
      title: `学生对话：${labelForIntent(turn.intent)}`,
      detail: `${turn.prompt} / 系统识别：${turn.reasonCodes.join(", ")}`,
      competencyImpacts: impacts,
      confidence: turn.confidence,
      risk: turn.risk,
      traceId: `trace-dialogue-${baseTime}`,
    },
    {
      id: `evt-dialogue-scaffold-${baseTime}`,
      type: "scaffold_delivered",
      timestamp: new Date(baseTime + 1000).toISOString(),
      actor: "system",
      source: "chat",
      title: `对话脚手架：${modeLabel(turn.responseMode)}`,
      detail: `${turn.assistantMessage} 下一步：${turn.microActions.join("；")}`,
      competencyImpacts: scaffoldImpacts,
      confidence: Math.min(0.95, turn.confidence + 0.03),
      risk: turn.teacherReviewRequired ? "medium" : "low",
      traceId: `trace-dialogue-${baseTime}`,
    },
  ];
}

function labelForIntent(intent: DialogueIntent): string {
  const labels: Record<DialogueIntent, string> = {
    direct_answer: "直接答案风险",
    debugging_help: "CI 调试求助",
    concept_explanation: "概念解释",
    planning: "下一步规划",
    reflection: "反思复盘",
  };
  return labels[intent];
}

function modeLabel(mode: DialogueResponseMode): string {
  const labels: Record<DialogueResponseMode, string> = {
    refuse_then_scaffold: "拒绝替写并转脚手架",
    debug_scaffold: "调试脚手架",
    concept_grounding: "概念锚定",
    path_planning: "路径规划",
    reflection_prompt: "反思追问",
  };
  return labels[mode];
}

function hashPrompt(prompt: string): number {
  let hash = 0;
  for (let index = 0; index < prompt.length; index += 1) {
    hash = (hash << 5) - hash + prompt.charCodeAt(index);
    hash |= 0;
  }
  return hash;
}
