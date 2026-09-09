export type RealWorkOrderRisk = "low" | "medium" | "high";
export type RealWorkOrderGateAction = "auto_release_candidate" | "teacher_optional" | "human_review";

export interface RealWorkOrderInput {
  studentName: string;
  courseName: string;
  taskTitle: string;
  prUrl: string;
  ciLog: string;
  diffSummary: string;
  studentQuestion: string;
  rubric: string;
}

export interface RealWorkOrderEvidence {
  source: string;
  snippet: string;
  weight: number;
}

export interface RealWorkOrderStep {
  id: string;
  title: string;
  owner: "student" | "system" | "teacher";
  status: "ready" | "current" | "blocked";
  why: string;
  doneWhen: string;
}

export interface RealWorkOrderScaffold {
  title: string;
  prompt: string;
  boundary: string;
}

export interface RealWorkOrderReport {
  runtime: "sepath-real-work-order.v1";
  risk: RealWorkOrderRisk;
  confidence: number;
  evidenceCoverage: number;
  interventionValue: number;
  studentName: string;
  courseName: string;
  taskTitle: string;
  abilityNode: string;
  blocker: string;
  diagnosis: string;
  detectedSignals: string[];
  missingEvidence: string[];
  evidence: RealWorkOrderEvidence[];
  pathPlan: RealWorkOrderStep[];
  scaffold: RealWorkOrderScaffold[];
  teacherGate: {
    action: RealWorkOrderGateAction;
    label: string;
    rationale: string;
    releaseCondition: string;
  };
  exportSummary: string;
  metrics: {
    blockedDirectAnswer: boolean;
    evidenceCount: number;
    pathSteps: number;
  };
}

export const defaultRealWorkOrderInput: RealWorkOrderInput = {
  studentName: "林知行",
  courseName: "软件工程 2301",
  taskTitle: "REST API 错误处理与边界测试",
  prUrl: "https://git.example.edu/se2301/order-service/pull/18",
  ciLog: [
    "CI #18 failed at api/orders.test.ts",
    "expected status 400 for empty items, received 500",
    "TypeError: Cannot read properties of undefined (reading 'id')",
    "coverage branch: error handler 41%, boundary cases missing: null user, empty items, duplicate coupon",
  ].join("\n"),
  diffSummary: [
    "PR 修改 orderService.createOrder 和 controller POST /orders",
    "新增 happy-path 测试 2 个；未覆盖库存不足、空购物车、非法优惠券和未登录用户",
    "异常直接向上抛出，缺少统一错误响应模型",
  ].join("\n"),
  studentQuestion: "老师，我已经改了很久还是失败。能不能直接给我 service 层完整代码，我想先让 CI 通过。",
  rubric: [
    "Rubric: 错误处理 25%，边界测试 25%，接口契约 20%，代码可读性 15%，反思说明 15%",
    "课程政策：可以给检查清单、定位方法和最小提示，不可替学生提交完整实现。",
  ].join("\n"),
};

const signalRules = [
  {
    id: "ci-test-failure",
    label: "CI 失败与测试证据",
    keywords: ["ci failed", "failed", "test", "测试", "coverage", "vitest", "jest", "pytest", "失败"],
  },
  {
    id: "boundary-path",
    label: "边界与异常路径",
    keywords: ["boundary", "edge", "异常", "边界", "null", "undefined", "empty", "400", "404", "500", "timeout"],
  },
  {
    id: "api-contract",
    label: "接口契约理解",
    keywords: ["api", "rest", "http", "接口", "controller", "request", "response", "参数", "status"],
  },
  {
    id: "direct-answer-request",
    label: "替写请求门禁",
    keywords: ["直接给我", "完整代码", "替我", "直接答案", "copy", "answer", "fix it for me"],
  },
  {
    id: "security-auth",
    label: "权限与安全边界",
    keywords: ["token", "auth", "permission", "secret", "password", "权限", "密钥", "鉴权", "未登录"],
  },
] as const;

function normalizeText(value: string) {
  return value.toLowerCase();
}

function hasSignal(text: string, keywords: readonly string[]) {
  const normalized = normalizeText(text);
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function firstUsefulLine(value: string, fallback: string) {
  const line = value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find((item) => item.length > 0);
  if (!line) return fallback;
  return line.length > 108 ? `${line.slice(0, 105)}...` : line;
}

function buildEvidence(input: RealWorkOrderInput): RealWorkOrderEvidence[] {
  const sources = [
    { source: "CI 日志", value: input.ciLog, weight: 0.32 },
    { source: "PR 摘要", value: input.diffSummary, weight: 0.26 },
    { source: "学生提问", value: input.studentQuestion, weight: 0.22 },
    { source: "课程 Rubric", value: input.rubric, weight: 0.2 },
  ];

  return sources
    .filter((item) => item.value.trim().length > 0)
    .map((item) => ({
      source: item.source,
      snippet: firstUsefulLine(item.value, "已提供材料，但缺少可读片段"),
      weight: item.weight,
    }));
}

function detectAbilityNode(signals: string[]) {
  if (signals.includes("边界与异常路径") && signals.includes("CI 失败与测试证据")) {
    return "测试边界与异常路径建模";
  }
  if (signals.includes("接口契约理解")) return "接口契约与错误语义";
  if (signals.includes("权限与安全边界")) return "权限场景与安全边界";
  if (signals.includes("替写请求门禁")) return "自主调试与求助策略";
  return "问题分解与证据表达";
}

function riskLabel(risk: RealWorkOrderRisk) {
  if (risk === "high") return "教师复核后发布";
  if (risk === "medium") return "教师可选复核";
  return "可作为低风险候选";
}

function gateAction(risk: RealWorkOrderRisk): RealWorkOrderGateAction {
  if (risk === "high") return "human_review";
  if (risk === "medium") return "teacher_optional";
  return "auto_release_candidate";
}

function stepStatus(index: number, readyStepCount: number): RealWorkOrderStep["status"] {
  if (index < readyStepCount) return "ready";
  if (index === readyStepCount) return "current";
  return "blocked";
}

export function buildRealWorkOrderReport(input: RealWorkOrderInput): RealWorkOrderReport {
  const joined = [input.ciLog, input.diffSummary, input.studentQuestion, input.rubric].join("\n");
  const evidence = buildEvidence(input);
  const detectedSignals = signalRules
    .filter((rule) => hasSignal(joined, rule.keywords))
    .map((rule) => rule.label);
  const missingEvidence = [
    input.ciLog.trim() ? "" : "CI 失败日志",
    input.diffSummary.trim() ? "" : "PR 变更摘要",
    input.studentQuestion.trim() ? "" : "学生原始提问",
    input.rubric.trim() ? "" : "课程 Rubric 或评分规则",
  ].filter(Boolean);
  const evidenceCoverage = Math.round((evidence.reduce((sum, item) => sum + item.weight, 0) / 1) * 100);
  const hasDirectAnswerRequest = detectedSignals.includes("替写请求门禁");
  const hasTestingFailure = detectedSignals.includes("CI 失败与测试证据");
  const hasBoundaryIssue = detectedSignals.includes("边界与异常路径");
  const hasSecurity = detectedSignals.includes("权限与安全边界");
  const risk: RealWorkOrderRisk =
    hasSecurity || (hasDirectAnswerRequest && (hasTestingFailure || hasBoundaryIssue))
      ? "high"
      : hasTestingFailure || hasBoundaryIssue
        ? "medium"
        : missingEvidence.length >= 2
          ? "medium"
          : "low";
  const confidence = clamp(52 + evidence.length * 8 + detectedSignals.length * 5 - missingEvidence.length * 7, 35, 96);
  const abilityNode = detectAbilityNode(detectedSignals);
  const readyStepCount = clamp(
    (hasTestingFailure ? 1 : 0) + (hasBoundaryIssue ? 1 : 0) + (hasDirectAnswerRequest ? 1 : 0),
    0,
    3,
  );
  const interventionValue = clamp(
    48 + (hasTestingFailure ? 14 : 0) + (hasBoundaryIssue ? 14 : 0) + (hasDirectAnswerRequest ? 10 : 0) + evidence.length * 4,
    35,
    92,
  );

  const pathPlan: RealWorkOrderStep[] = [
    {
      id: "replay-failure",
      title: "还原失败证据",
      owner: "system",
      status: stepStatus(0, readyStepCount),
      why: "先把 CI、PR 和提问绑定成一个可复核工单，避免只凭口头描述判断。",
      doneWhen: "失败用例、异常堆栈、PR 变更点进入同一证据链。",
    },
    {
      id: "boundary-map",
      title: "画出异常路径",
      owner: "student",
      status: stepStatus(1, readyStepCount),
      why: "把 happy path 之外的空值、权限、状态码和业务异常列出来。",
      doneWhen: "学生能说清每个输入为什么返回 400、401、404 或 409。",
    },
    {
      id: "red-test",
      title: "补最小红灯测试",
      owner: "student",
      status: stepStatus(2, readyStepCount),
      why: "先写失败测试，再修代码，避免靠猜测让 CI 变绿。",
      doneWhen: "至少 2 个边界测试先失败、再被最小修复通过。",
    },
    {
      id: "minimal-fix",
      title: "最小修复与自验证",
      owner: "student",
      status: stepStatus(3, readyStepCount),
      why: "只改错误处理与接口返回，不重写无关业务逻辑。",
      doneWhen: "CI 通过，并保留测试截图或日志片段。",
    },
    {
      id: "teacher-memory",
      title: "教师复核与反思沉淀",
      owner: "teacher",
      status: stepStatus(4, readyStepCount),
      why: "高风险帮助必须由教师确认，再进入学生长期学习画像。",
      doneWhen: "教师放行后，系统记录迁移策略和下次提醒条件。",
    },
  ];

  const blocker = hasBoundaryIssue
    ? "测试边界与异常路径建模不足"
    : hasTestingFailure
      ? "CI 失败尚未转化为学习证据"
      : hasDirectAnswerRequest
        ? "学生正在请求替写式帮助"
        : "证据不足，暂不建议自动干预";
  const diagnosis = `${input.studentName || "当前学生"}在「${input.taskTitle || "当前任务"}」中暴露出「${abilityNode}」短板。系统建议先补证据和边界清单，再给脚手架式提示；不直接提供可复制的最终实现。`;
  const action = gateAction(risk);

  return {
    runtime: "sepath-real-work-order.v1",
    risk,
    confidence,
    evidenceCoverage,
    interventionValue,
    studentName: input.studentName.trim() || "未命名学生",
    courseName: input.courseName.trim() || "未命名课程",
    taskTitle: input.taskTitle.trim() || "未命名任务",
    abilityNode,
    blocker,
    diagnosis,
    detectedSignals,
    missingEvidence,
    evidence,
    pathPlan,
    scaffold: [
      {
        title: "先复述失败条件",
        prompt: "请你把 CI 中最早失败的断言、输入数据和实际返回状态写成三行，不需要改代码。",
        boundary: "只要求定位证据，不给实现答案。",
      },
      {
        title: "再列边界清单",
        prompt: "围绕空购物车、未登录用户、非法优惠券和库存不足，各写一个期望状态码和错误信息。",
        boundary: "给检查维度，不替学生设计完整函数。",
      },
      {
        title: "最后提交最小修复",
        prompt: "先新增一个会失败的边界测试，确认失败后只修相关错误处理，再贴 CI 通过片段。",
        boundary: "只推动下一步，不接管仓库权限。",
      },
    ],
    teacherGate: {
      action,
      label: riskLabel(risk),
      rationale:
        action === "human_review"
          ? "存在替写请求或权限/异常风险，建议进入教师复核后再发布给学生。"
          : action === "teacher_optional"
            ? "证据足以形成脚手架，但可由教师抽查关键提示。"
            : "当前风险较低，可作为自动候选建议。",
      releaseCondition: "必须保留 CI/PR/提问/Rubric 的证据片段，并确认提示不包含完整可复制实现。",
    },
    exportSummary: `${input.courseName || "课程"} / ${input.studentName || "学生"} / ${risk} / ${confidence}% confidence`,
    metrics: {
      blockedDirectAnswer: hasDirectAnswerRequest,
      evidenceCount: evidence.length,
      pathSteps: pathPlan.length,
    },
  };
}
