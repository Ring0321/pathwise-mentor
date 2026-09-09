import type {
  EvidenceEvent,
  EvidenceLedgerEntry,
  LearningStage,
  LearningWorkOrder,
  RiskLevel,
  TeacherDecision,
  WorkOrderStatus,
} from "../types";

export const riskLabels: Record<RiskLevel, string> = {
  high: "高风险",
  medium: "中风险",
  low: "低风险",
};

export const statusLabels: Record<WorkOrderStatus, string> = {
  diagnosis: "学情诊断",
  evidence: "验证修复",
  guardrail: "安全门禁",
  intervention: "实时干预",
  review: "教师验收",
  closed: "闭环完成",
};

export const decisionMeta: Record<
  TeacherDecision,
  {
    label: string;
    shortLabel: string;
    detail: string;
    stageAfter: string;
    statusAfter: WorkOrderStatus;
    coverageAfter: number;
  }
> = {
  approve: {
    label: "批准脚手架",
    shortLabel: "已批准",
    detail: "生成最小化脚手架与测试清单，不含答案实现。",
    stageAfter: "安全门禁",
    statusAfter: "guardrail",
    coverageAfter: 48,
  },
  returnEvidence: {
    label: "退回补证据",
    shortLabel: "补证据",
    detail: "请学生补齐关键证据后重新诊断。",
    stageAfter: "验证修复",
    statusAfter: "evidence",
    coverageAfter: 34,
  },
  humanTalk: {
    label: "转人工会谈",
    shortLabel: "会谈",
    detail: "安排一对一确认真实卡点，避免低证据误判。",
    stageAfter: "教师复核",
    statusAfter: "review",
    coverageAfter: 44,
  },
};

export function createStages(active: WorkOrderStatus): LearningStage[] {
  const stageMap: Array<{ id: string; title: string; status: WorkOrderStatus }> = [
    { id: "diagnosis", title: "学情诊断", status: "diagnosis" },
    { id: "guardrail", title: "安全门禁", status: "guardrail" },
    { id: "intervention", title: "实时干预", status: "intervention" },
    { id: "evidence", title: "验证修复", status: "evidence" },
    { id: "review", title: "教师验收", status: "review" },
    { id: "closed", title: "闭环完成", status: "closed" },
  ];
  const activeIndex = Math.max(
    0,
    stageMap.findIndex((stage) => stage.status === active),
  );

  return stageMap.map((stage, index) => ({
    id: stage.id,
    title: stage.title,
    state:
      active === "closed" || index < activeIndex
        ? "finish"
        : index === activeIndex
          ? "process"
          : "wait",
  }));
}

function evidence(
  id: string,
  title: string,
  source: string,
  status: EvidenceEvent["status"],
  detail: string,
  time?: string,
): EvidenceEvent {
  return { id, title, source, status, detail, time };
}

export const seedWorkOrders: LearningWorkOrder[] = [
  {
    id: "wo-se-018",
    studentName: "林知行",
    studentNo: "2301180321",
    courseClass: "软件工程 2301",
    courseName: "REST API 错误处理与边界测试",
    trigger: "PR #18 CI 失败",
    eventDate: "2026-08-22",
    risk: "high",
    status: "diagnosis",
    owner: "张老师",
    updatedAt: "10:42",
    summary: "边界与异常路径测试证据不足，建议先补关键证据再干预。",
    evidenceCoverage: 34,
    stage: "学情诊断",
    diagnosis:
      "当前失败集中在异常路径与边界输入，已有证据能提示薄弱点，但还不足以确认真实能力水平。",
    valueAdded: {
      label: "边界测试设计",
      current: 50,
      expected: 54,
      delta: -4,
      uncertainty: "high",
      description: "针对边界条件与异常路径的测试用例设计与覆盖能力",
    },
    collectedEvidence: [
      evidence(
        "ev-ci-018",
        "CI 失败日志",
        "GitHub Actions",
        "collected",
        "PR #18 在边界输入相关测试失败，状态码与预期不匹配。",
        "2026-08-22 10:42",
      ),
      evidence(
        "ev-pr-018",
        "PR 变更摘要",
        "Pull Request",
        "collected",
        "新增错误处理分支，但缺少空值、越界和权限异常用例。",
        "2026-08-22 09:18",
      ),
      evidence(
        "ev-chat-018",
        "学生求助对话",
        "学伴对话",
        "collected",
        "学生询问边界值与异常路径是否需要单独测试。",
        "2026-08-22 09:05",
      ),
    ],
    missingEvidence: [
      evidence(
        "ev-checklist-018",
        "边界检查清单",
        "测试策略检查表",
        "missing",
        "未提交异常路径检查清单，无法确认覆盖完整性。",
      ),
      evidence(
        "ev-reflection-018",
        "学习反思记录",
        "学生反思",
        "pending",
        "等待学生说明失败原因与下一次测试计划。",
      ),
    ],
    safeVoiRecommendation:
      "先补异常路径检查清单和最小失败用例，不展示完整答案或可直接提交代码。",
    safeVoiReason:
      "该行动成本低，能显著降低不确定性，同时不替代学生完成实现。",
    stages: createStages("diagnosis"),
  },
  {
    id: "wo-se-026",
    studentName: "周亦然",
    studentNo: "2301180426",
    courseClass: "软件工程 2301",
    courseName: "数据库事务与并发控制",
    trigger: "CI #217 失败",
    eventDate: "2026-08-24",
    risk: "medium",
    status: "evidence",
    owner: "张老师",
    updatedAt: "09:18",
    summary: "事务边界说明不足，建议补齐提交/回滚路径。",
    evidenceCoverage: 52,
    stage: "补证据",
    diagnosis: "事务失败路径证据不足，需要先确认学生是否理解回滚与重试。",
    valueAdded: {
      label: "异常处理策略",
      current: 62,
      expected: 66,
      delta: -4,
      uncertainty: "medium",
      description: "识别失败路径、回滚策略和并发冲突处理的能力",
    },
    collectedEvidence: [
      evidence("ev-ci-026", "单测覆盖报告", "CI Coverage", "collected", "正常路径覆盖充分，失败路径覆盖不足。"),
      evidence("ev-git-026", "提交节奏记录", "Git", "collected", "关键代码集中在截止前 23 分钟提交。"),
    ],
    missingEvidence: [
      evidence("ev-design-026", "事务路径说明卡", "设计卡片", "missing", "需补正常提交、失败回滚、重试补偿三条路径。"),
    ],
    safeVoiRecommendation: "退回事务路径说明卡和回滚断言用例。",
    safeVoiReason: "补证据成本低，可区分粗心缺测与真实概念薄弱。",
    stages: createStages("evidence"),
  },
  {
    id: "wo-se-031",
    studentName: "陈嘉木",
    studentNo: "2301180531",
    courseClass: "软件工程 2301",
    courseName: "接口契约与需求澄清",
    trigger: "PR #14 需补充说明",
    eventDate: "2026-08-27",
    risk: "low",
    status: "guardrail",
    owner: "张老师",
    updatedAt: "昨日",
    summary: "证据较充分，等待教师确认低风险迁移脚手架。",
    evidenceCoverage: 76,
    stage: "安全门禁",
    diagnosis: "学生已能表达接口契约，适合发布迁移型练习。",
    valueAdded: {
      label: "接口契约表达",
      current: 71,
      expected: 69,
      delta: 2,
      uncertainty: "low",
      description: "把需求变更转化为接口约束和验收条件的能力",
    },
    collectedEvidence: [
      evidence("ev-contract-031", "接口契约变更卡", "需求澄清记录", "collected", "输入、输出、错误码、兼容性影响已说明。"),
      evidence("ev-review-031", "Rubric 复核记录", "教师复核", "collected", "契约表达达到 B+，建议进入迁移任务。"),
    ],
    missingEvidence: [],
    safeVoiRecommendation: "发布低风险迁移脚手架。",
    safeVoiReason: "证据覆盖较高，迁移任务可产生新的增值证据。",
    stages: createStages("guardrail"),
  },
  {
    id: "wo-se-044",
    studentName: "许安澜",
    studentNo: "2301180644",
    courseClass: "软件工程 2301",
    courseName: "协作开发与代码评审",
    trigger: "同伴评审争议",
    eventDate: "2026-08-28",
    risk: "medium",
    status: "review",
    owner: "张老师",
    updatedAt: "昨日",
    summary: "协作语境复杂，等待教师决定是否转人工会谈。",
    evidenceCoverage: 61,
    stage: "教师复核",
    diagnosis: "系统只整理候选证据，不自动判断协作责任归属。",
    valueAdded: {
      label: "协作评审表达",
      current: 58,
      expected: 61,
      delta: -3,
      uncertainty: "medium",
      description: "提出可执行评审建议并回应异议的能力",
    },
    collectedEvidence: [
      evidence("ev-review-044", "PR Review 对话", "GitHub Review", "collected", "存在两次情绪化表达，但也提出有效重构建议。"),
      evidence("ev-peer-044", "同伴反馈", "小组互评", "collected", "同伴认可建议有效，但沟通方式影响协作气氛。"),
    ],
    missingEvidence: [
      evidence("ev-reflection-044", "学生反思卡", "反思提交", "missing", "需说明争议点、修正策略和下一次评审承诺。"),
    ],
    safeVoiRecommendation: "转人工会谈，不自动给协作能力结论。",
    safeVoiReason: "协作争议属于高语境判断，必须保留人工复核。",
    stages: createStages("review"),
  },
];

export const seedLedger: Record<string, EvidenceLedgerEntry[]> = {
  "wo-se-018": [
    {
      id: "ledger-ci-018",
      type: "evidence",
      time: "2026-08-22 10:42",
      actor: "GitHub Actions",
      title: "CI 失败日志已采集",
      source: "GitHub Actions",
      detail: "接口边界条件用例失败，触发高风险诊断。",
      traceId: "trace-ci-018-fail",
    },
    {
      id: "ledger-pr-018",
      type: "evidence",
      time: "2026-08-22 09:18",
      actor: "Pull Request",
      title: "PR 变更摘要已采集",
      source: "Pull Request #18",
      detail: "新增错误处理分支，但缺少边界用例。",
      traceId: "trace-pr-018",
    },
    {
      id: "ledger-gap-018",
      type: "gap",
      time: "2026-08-22 10:44",
      actor: "SE-Path",
      title: "发现关键缺证据",
      source: "Safe-VOI",
      detail: "缺少边界检查清单和学生反思记录。",
      traceId: "trace-gap-018",
    },
  ],
};
