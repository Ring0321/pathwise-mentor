export const WORKBENCH_TENANT_ID = "tenant-se-course-2026";
export const WORKBENCH_COURSE_ID = "software-engineering-project";

export function createDefaultCourseSettings(scope = {}) {
  return {
    tenantId: scope.tenantId || WORKBENCH_TENANT_ID,
    courseId: scope.courseId || WORKBENCH_COURSE_ID,
    courseClass: "软件工程 2301",
    courseName: "REST API 错误处理与边界测试",
    repository: "se-course/rest-api-lab",
    ciProvider: "GitHub Actions",
    privacyPolicy: "仅保存脱敏后的 PR/CI 片段、对话摘要与教师复核记录；不保存真实姓名、邮箱、token 或原始日志。",
    webhookPath: "/api/webhooks/github/ci",
    updatedAt: nowText(),
  };
}

export const teacherDecisionMeta = {
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

const focusProfiles = {
  boundary: {
    label: "边界测试设计",
    description: "针对边界条件与异常路径的测试用例设计与覆盖能力",
    missing: [
      {
        title: "异常路径检查清单",
        source: "测试策略检查表",
        detail: "补齐空值、越界、权限、网络异常等路径和预期响应。",
      },
      {
        title: "最小失败用例",
        source: "故障最小化原则",
        detail: "提交 2-3 个可复现的最小失败场景，不提交完整修复答案。",
      },
    ],
    recommendation: "先补异常路径检查清单和最小失败用例，不展示完整答案或可直接提交代码。",
    reason: "补证据成本低，能区分真实薄弱、粗心缺测和环境问题。",
  },
  transaction: {
    label: "事务边界建模",
    description: "识别提交、回滚、重试和并发冲突路径的能力",
    missing: [
      {
        title: "事务路径说明卡",
        source: "设计卡片",
        detail: "画出正常提交、失败回滚、重试补偿三条路径。",
      },
      {
        title: "回滚断言用例",
        source: "CI Coverage",
        detail: "补充失败后数据一致性的断言，而不是只验证成功路径。",
      },
    ],
    recommendation: "退回事务路径说明卡和回滚断言用例，先验证理解再给脚手架。",
    reason: "事务问题容易被正常路径掩盖，补证据能降低误判。",
  },
  contract: {
    label: "接口契约表达",
    description: "把需求变更转化为接口约束、验收条件和协作语言的能力",
    missing: [
      {
        title: "接口契约变更卡",
        source: "需求澄清记录",
        detail: "写清输入、输出、错误码、兼容性影响和验收条件。",
      },
      {
        title: "契约回归用例",
        source: "测试清单",
        detail: "补充变更前后兼容性与异常响应的回归用例。",
      },
    ],
    recommendation: "先补接口契约变更卡，再发布低风险迁移脚手架。",
    reason: "让学生先表达约束，可避免 AI 直接替学生做需求拆解。",
  },
  review: {
    label: "协作评审表达",
    description: "提出可执行评审建议、回应异议并维护协作质量的能力",
    missing: [
      {
        title: "评审争议事实卡",
        source: "PR Review",
        detail: "区分事实、建议和情绪表达，保留原始上下文摘要。",
      },
      {
        title: "学生反思卡",
        source: "反思提交",
        detail: "说明争议点、修正策略和下一次评审承诺。",
      },
    ],
    recommendation: "转教师复核或一对一会谈，不自动给协作能力结论。",
    reason: "协作争议属于高语境判断，必须保留人工复核。",
  },
};

const studentReturnSteps = ["scaffoldReceived", "evidenceSubmitted", "reflectionSubmitted"];

export function nowText(date = new Date()) {
  return date.toLocaleString("zh-CN", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function createStages(active) {
  const stageMap = [
    { id: "diagnosis", title: "学情诊断", status: "diagnosis" },
    { id: "guardrail", title: "安全门禁", status: "guardrail" },
    { id: "intervention", title: "实时干预", status: "intervention" },
    { id: "evidence", title: "验证修复", status: "evidence" },
    { id: "review", title: "教师复核", status: "review" },
    { id: "closed", title: "闭环完成", status: "closed" },
  ];
  const activeIndex = Math.max(
    0,
    stageMap.findIndex((stage) => stage.status === active),
  );
  return stageMap.map((stage, index) => ({
    id: stage.id,
    title: stage.title,
    state: active === "closed" || index < activeIndex ? "finish" : index === activeIndex ? "process" : "wait",
  }));
}

function buildValueAddedSnapshot(order, valueAdded, decision, teacherNote = "", date = new Date()) {
  if (decision !== "accept") return undefined;
  const baseline = Number(order.valueAdded?.current || 0);
  const expected = Number(order.valueAdded?.expected || baseline);
  const observed = Number(valueAdded?.current || baseline);
  const evidenceCoverage = Math.max(Number(order.evidenceCoverage || 0), 88);
  const studentLabel = order.studentName || order.learnerAlias || order.learnerHash || "学生";
  const dimension = order.valueAdded?.label || "软件工程能力";
  const basisEvidenceIds = uniqueStrings([
    ...(order.collectedEvidence || []).map((item) => item.id),
    ...(order.missingEvidence || []).map((item) => item.id),
    ...(order.interventionPackage?.sourceEvidenceIds || []),
    `return-${order.id}-scaffoldReceived`,
    `return-${order.id}-evidenceSubmitted`,
    `return-${order.id}-reflectionSubmitted`,
  ]);

  return {
    id: `vas-${order.id}-${Date.now().toString(36)}`,
    workOrderId: order.id,
    createdAt: nowText(date),
    dimension,
    baseline,
    expected,
    observed,
    uplift: observed - baseline,
    remainingGap: observed - expected,
    evidenceCoverage,
    uncertainty: valueAdded?.uncertainty || "low",
    teacherDecision: decision,
    teacherNote: String(teacherNote || "").trim() || "教师验收通过，允许关闭本轮形成性诊断单。",
    basisEvidenceIds,
    claim: `${studentLabel}在“${dimension}”上完成一次可复核改进：从 ${baseline} 提升到 ${observed}，证据覆盖达到 ${evidenceCoverage}%。`,
    boundary:
      "该快照仅用于形成性诊断、资源推荐和教学复盘，不用于排名、惩罚、就业预测或高风险自动决策。",
    nextTeachingAction:
      Number(order.valueAdded?.delta || 0) < 0
        ? "下一次任务继续观察迁移表现，并保留最小失败用例与反思作为复核依据。"
        : "纳入学生成长档案，后续只在新证据出现时更新判断。",
  };
}

function evidence(id, title, source, status, detail, time) {
  return { id, title, source, status, detail, time };
}

export function emptyStudentReturnState() {
  return {
    scaffoldReceived: false,
    evidenceSubmitted: false,
    reflectionSubmitted: false,
    revision: 0,
  };
}

function normalizeStudentReturnState(state = {}) {
  return {
    ...emptyStudentReturnState(),
    ...state,
    revision: Number(state?.revision || 0),
  };
}

function countStudentReturnSteps(state = {}) {
  return studentReturnSteps.filter((step) => Boolean(state?.[step])).length;
}

function buildReturnedEvidenceRequirement(order, revision, reason, date = new Date()) {
  return {
    id: `ev-return-${order.id}-${revision}`,
    title: `第 ${revision} 轮退回补证据要求`,
    source: "教师验收",
    status: "pending",
    detail: `教师退回意见：${cropText(reason, 140)}；学生需重新提交关键证据与学习反思后再进入验收。`,
    time: nowText(date),
  };
}

export function createSeedWorkbench(scope = {}) {
  const tenantId = scope.tenantId || WORKBENCH_TENANT_ID;
  const courseId = scope.courseId || WORKBENCH_COURSE_ID;
  const scoped = { tenantId, courseId };
  const workOrders = [
    {
      id: "wo-se-018",
      ...scoped,
      learnerHash: "stu_hash_8f2a",
      studentName: "LZX-0321",
      studentNo: "stu_hash_8f2a",
      courseClass: "软件工程 2301",
      courseName: "REST API 错误处理与边界测试",
      trigger: "PR #18 CI 失败",
      eventDate: "2026-08-22",
      risk: "high",
      status: "diagnosis",
      owner: "张老师",
      updatedAt: "10:42",
      createdAt: "2026-08-22T02:42:00.000Z",
      summary: "边界与异常路径测试证据不足，建议先补关键证据再干预。",
      evidenceCoverage: 34,
      stage: "学情诊断",
      diagnosis: "当前失败集中在异常路径与边界输入，已有证据能提示薄弱点，但还不足以确认真实能力水平。",
      valueAdded: {
        label: "边界测试设计",
        current: 50,
        expected: 54,
        delta: -4,
        uncertainty: "high",
        description: "针对边界条件与异常路径的测试用例设计与覆盖能力",
      },
      collectedEvidence: [
        evidence("ev-ci-018", "CI 失败日志", "GitHub Actions", "collected", "PR #18 在边界输入相关测试失败，状态码与预期不匹配。", "2026-08-22 10:42"),
        evidence("ev-pr-018", "PR 变更摘要", "Pull Request", "collected", "新增错误处理分支，但缺少空值、越界和权限异常用例。", "2026-08-22 09:18"),
        evidence("ev-chat-018", "学生求助对话", "学伴对话", "collected", "学生询问边界值与异常路径是否需要单独测试。", "2026-08-22 09:05"),
      ],
      missingEvidence: [
        evidence("ev-checklist-018", "边界检查清单", "测试策略检查表", "missing", "未提交异常路径检查清单，无法确认覆盖完整性。"),
        evidence("ev-reflection-018", "学习反思记录", "学生反思", "pending", "等待学生说明失败原因与下一次测试计划。"),
      ],
      safeVoiRecommendation: "先补异常路径检查清单和最小失败用例，不展示完整答案或可直接提交代码。",
      safeVoiReason: "该行动成本低，能显著降低不确定性，同时不替代学生完成实现。",
      stages: createStages("diagnosis"),
    },
    {
      id: "wo-se-026",
      ...scoped,
      learnerHash: "stu_hash_7c41",
      studentName: "ZYR-0426",
      studentNo: "stu_hash_7c41",
      courseClass: "软件工程 2301",
      courseName: "数据库事务与并发控制",
      trigger: "CI #217 失败",
      eventDate: "2026-08-24",
      risk: "medium",
      status: "evidence",
      owner: "张老师",
      updatedAt: "09:18",
      createdAt: "2026-08-24T01:18:00.000Z",
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
  ];

  return {
    selectedId: "wo-se-018",
    workOrders,
    ledger: {
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
      "wo-se-026": [
        {
          id: "ledger-ci-026",
          type: "evidence",
          time: "2026-08-24 09:18",
          actor: "GitHub Actions",
          title: "事务回滚相关 CI 失败",
          source: "CI Coverage",
          detail: "成功路径覆盖充分，回滚断言不足。",
          traceId: "trace-ci-026",
        },
      ],
    },
    studentReturn: {
      "wo-se-018": emptyStudentReturnState(),
      "wo-se-026": emptyStudentReturnState(),
    },
  };
}

function cropText(text = "", maxLength = 160) {
  const compact = String(text).replace(/\s+/g, " ").trim();
  return compact.length > maxLength ? `${compact.slice(0, maxLength)}...` : compact;
}

function inferFocus(payload) {
  const text = `${payload.trigger || ""} ${payload.ciLogSummary || ""} ${payload.notes || ""}`;
  if (/事务|rollback|transaction|concurrent/i.test(text)) return "transaction";
  if (/契约|contract|schema|compat/i.test(text)) return "contract";
  if (/review|评审|协作|comment/i.test(text)) return "review";
  return "boundary";
}

function inferRisk(payload) {
  const text = `${payload.trigger || ""} ${payload.ciLogSummary || ""} ${payload.prUrl || ""}`;
  if (/500|panic|exception|权限|越界|direct answer|直接/i.test(text)) return "high";
  if (/coverage|覆盖|rollback|回滚|missing|缺少/i.test(text)) return "medium";
  return "low";
}

function inferCoverage(payload) {
  let coverage = 32;
  if (String(payload.prUrl || "").trim()) coverage += 8;
  if (String(payload.ciRunUrl || "").trim()) coverage += 8;
  if (String(payload.ciLogSummary || "").trim().length > 40) coverage += 8;
  if (String(payload.notes || "").trim()) coverage += 6;
  return Math.min(76, coverage);
}

function buildValueAdded(focus, risk, coverage) {
  const current = risk === "high" ? 50 : risk === "medium" ? 60 : 68;
  const expected = current + (risk === "high" ? 6 : risk === "medium" ? 4 : 3);
  return {
    label: focusProfiles[focus].label,
    current,
    expected,
    delta: current - expected,
    uncertainty: coverage < 50 ? "high" : risk === "low" ? "low" : "medium",
    description: focusProfiles[focus].description,
  };
}

export function createWorkOrderFromGithubImport(payload, digest, date = new Date()) {
  const focus = inferFocus(payload);
  const profile = focusProfiles[focus];
  const risk = inferRisk(payload);
  const coverage = inferCoverage(payload);
  const prMatch = String(payload.prUrl || "").match(/\/pull\/(\d+)/);
  const prNo = prMatch?.[1] || payload.pullRequestNumber || digest.slice(0, 4);
  const id = `wo-live-${digest.slice(0, 10)}`;
  const createdAt = date.toISOString();
  const learnerHash = payload.learnerHash || `stu_hash_${digest.slice(0, 8)}`;
  const learnerAlias = payload.learnerAlias || `SE-${digest.slice(0, 4).toUpperCase()}`;
  const order = {
    id,
    tenantId: payload.tenantId,
    courseId: payload.courseId,
    learnerHash,
    studentName: learnerAlias,
    studentNo: learnerHash,
    courseClass: payload.courseClass || "软件工程 2301",
    courseName: payload.courseName || "软件工程课程闭环任务",
    trigger: payload.trigger || `PR #${prNo} CI 失败`,
    eventDate: payload.eventDate || createdAt.slice(0, 10),
    risk,
    status: "diagnosis",
    owner: payload.owner || "任课教师",
    updatedAt: nowText(date),
    createdAt,
    summary: `${profile.label}证据不足，建议先由教师确认 Safe-VOI 下一步。`,
    evidenceCoverage: coverage,
    stage: "学情诊断",
    diagnosis: `系统从 PR/CI 事件中识别到“${profile.label}”相关风险。当前只形成候选诊断，需教师依据证据决定补证据、脚手架或人工会谈。`,
    valueAdded: buildValueAdded(focus, risk, coverage),
    collectedEvidence: [
      evidence(`ev-pr-${digest.slice(0, 8)}`, "PR 变更摘要", payload.repository || "GitHub", "collected", cropText(payload.prUrl || "已导入 Pull Request 元数据。", 140), nowText(date)),
      evidence(`ev-ci-${digest.slice(0, 8)}`, "CI 运行摘要", payload.ciProvider || "GitHub Actions", "collected", cropText(payload.ciLogSummary || payload.ciRunUrl || "已导入 CI 摘要。", 180), nowText(date)),
    ],
    missingEvidence: profile.missing.map((item, index) =>
      evidence(`ev-missing-${digest.slice(0, 8)}-${index + 1}`, item.title, item.source, index === 0 ? "missing" : "pending", item.detail),
    ),
    safeVoiRecommendation: profile.recommendation,
    safeVoiReason: profile.reason,
    stages: createStages("diagnosis"),
  };
  const ledgerEntry = {
    id: `ledger-import-${digest.slice(0, 12)}`,
    type: "intake",
    time: nowText(date),
    actor: payload.ciProvider || "GitHub Actions",
    title: "PR/CI 事件导入并生成诊断单",
    source: payload.repository || "GitHub",
    detail: cropText(`${order.trigger}；${payload.ciLogSummary || ""}`, 180),
    traceId: `import-${digest.slice(0, 12)}`,
    stageAfter: order.stage,
    evidenceCoverageAfter: order.evidenceCoverage,
  };
  return { order, ledgerEntry, studentReturn: emptyStudentReturnState() };
}

export function createWorkOrderFromCourseBatch(payload, digest, date = new Date()) {
  const focus = ["boundary", "transaction", "contract", "review"].includes(payload.focus)
    ? payload.focus
    : inferFocus(payload);
  const profile = focusProfiles[focus];
  const risk = ["low", "medium", "high"].includes(payload.risk) ? payload.risk : "medium";
  const createdAt = date.toISOString();
  const learnerHash = payload.learnerHash || `stu_hash_${digest.slice(0, 8)}`;
  const learnerAlias = payload.learnerAlias || `SE-${digest.slice(0, 4).toUpperCase()}`;
  const coverage = Math.max(24, Math.min(46, Number(payload.evidenceCoverage || 30)));
  const id = `wo-batch-${digest.slice(0, 10)}`;
  const trigger = payload.trigger || "课程任务批量巡检";
  const order = {
    id,
    tenantId: payload.tenantId,
    courseId: payload.courseId,
    learnerHash,
    studentName: learnerAlias,
    studentNo: learnerHash,
    courseClass: payload.courseClass || "软件工程 2301",
    courseName: payload.courseName || "软件工程课程闭环任务",
    trigger,
    eventDate: payload.eventDate || createdAt.slice(0, 10),
    risk,
    status: "diagnosis",
    owner: payload.owner || "任课教师",
    updatedAt: nowText(date),
    createdAt,
    summary: `${profile.label}进入课程批量巡检，当前只形成低证据覆盖的候选诊断。`,
    evidenceCoverage: coverage,
    stage: "学情诊断",
    diagnosis: `系统根据课程名单与任务配置为 ${learnerAlias} 建立候选诊断单。当前尚未接入完整 PR/CI/对话/反思证据，只能作为形成性跟进入口，需教师确认后再给学生发布补证据或脚手架任务。`,
    valueAdded: {
      ...buildValueAdded(focus, risk, coverage),
      current: Math.max(42, Math.min(72, Number(payload.currentLevel || 52))),
      expected: Math.max(46, Math.min(80, Number(payload.expectedLevel || 58))),
    },
    collectedEvidence: [
      evidence(
        `ev-roster-${digest.slice(0, 8)}`,
        "班级名单映射",
        "课程名单",
        "collected",
        `已确认伪名学习者 ${learnerHash} 属于本课程名单，不包含真实姓名、邮箱或原始日志。`,
        nowText(date),
      ),
      evidence(
        `ev-task-${digest.slice(0, 8)}`,
        "课程任务配置",
        "教师批量巡检",
        "pending",
        cropText(payload.taskSummary || "教师发起批量诊断巡检，等待 PR/CI、测试清单、学生反思或课堂对话补齐。", 180),
        nowText(date),
      ),
    ],
    missingEvidence: profile.missing.map((item, index) =>
      evidence(`ev-batch-missing-${digest.slice(0, 8)}-${index + 1}`, item.title, item.source, index === 0 ? "missing" : "pending", item.detail),
    ),
    safeVoiRecommendation: `先补 ${profile.missing[0]?.title || "关键证据"}，再由教师决定是否发布脚手架；不直接生成可提交答案。`,
    safeVoiReason: "批量巡检只降低发现成本，不替代教师判断；证据不足时保持不确定，避免把低证据信号变成评价结论。",
    stages: createStages("diagnosis"),
  };
  order.valueAdded.delta = order.valueAdded.current - order.valueAdded.expected;
  const ledgerEntry = {
    id: `ledger-batch-${digest.slice(0, 12)}`,
    type: "intake",
    time: nowText(date),
    actor: payload.owner || "任课教师",
    title: "课程批量巡检生成候选诊断单",
    source: "课程名单与任务配置",
    detail: cropText(`${trigger}：${payload.taskSummary || profile.description}`, 180),
    traceId: `batch-${digest.slice(0, 12)}`,
    stageAfter: order.stage,
    evidenceCoverageAfter: order.evidenceCoverage,
  };
  return { order, ledgerEntry, studentReturn: emptyStudentReturnState() };
}

export function applyTeacherDecision(order, decision, teacherNote = "", date = new Date()) {
  const meta = teacherDecisionMeta[decision];
  if (!meta) return null;
  const updated = {
    ...order,
    status: meta.statusAfter,
    stage: meta.stageAfter,
    evidenceCoverage: Math.max(order.evidenceCoverage || 0, meta.coverageAfter),
    selectedDecision: decision,
    teacherNote,
    interventionPackage: undefined,
    updatedAt: nowText(date),
    stages: createStages(meta.statusAfter),
  };
  return {
    order: updated,
    ledgerEntry: {
      id: `ledger-decision-${decision}-${Date.now()}`,
      type: "decision",
      time: nowText(date),
      actor: order.owner || "任课教师",
      title: meta.label,
      source: "教师复核",
      detail: teacherNote ? `${meta.detail} 备注：${teacherNote}` : meta.detail,
      traceId: `review-${order.id}-${decision}`,
      decision,
      stageAfter: meta.stageAfter,
      evidenceCoverageAfter: updated.evidenceCoverage,
    },
  };
}

function uniqueStrings(items = []) {
  return Array.from(new Set(items.map((item) => String(item || "").trim()).filter(Boolean)));
}

function cleanDraftText(value, maxLength) {
  const compact = String(value || "").replace(/\s+/g, " ").trim();
  return compact.length > maxLength ? `${compact.slice(0, maxLength)}...` : compact;
}

function cleanDraftLines(items, fallback, maxItems = 8) {
  if (!Array.isArray(items)) return fallback;
  const cleaned = uniqueStrings(
    items.map((item) =>
      String(item || "")
        .replace(/^\s*(?:[-*]|\d+[.)、])\s*/, "")
        .trim(),
    ),
  ).slice(0, maxItems);
  return cleaned.length ? cleaned : fallback;
}

function guardedSafeBoundary(value, fallback) {
  const boundary = cleanDraftText(value, 420) || fallback;
  if (/不生成|不提供|完整答案|完整实现|可直接提交/.test(boundary)) return boundary;
  return `${boundary}；不生成可直接提交的完整实现代码，不替代教师评价。`;
}

function applyInterventionPackageDraft(basePackage, draft = {}) {
  const teacherEdited = [
    draft.title,
    draft.objective,
    draft.safeBoundary,
    draft.dueHint,
    draft.teacherNote,
    ...(draft.steps || []),
    ...(draft.evidenceToSubmit || []),
    ...(draft.rubricCheckpoints || []),
  ].some((item) => String(item || "").trim().length > 0);
  return {
    ...basePackage,
    title: cleanDraftText(draft.title, 80) || basePackage.title,
    objective: cleanDraftText(draft.objective, 360) || basePackage.objective,
    safeBoundary: guardedSafeBoundary(draft.safeBoundary, basePackage.safeBoundary),
    steps: cleanDraftLines(draft.steps, basePackage.steps, 8),
    evidenceToSubmit: cleanDraftLines(draft.evidenceToSubmit, basePackage.evidenceToSubmit, 10),
    rubricCheckpoints: cleanDraftLines(draft.rubricCheckpoints, basePackage.rubricCheckpoints, 8),
    dueHint: cleanDraftText(draft.dueHint, 160) || basePackage.dueHint,
    teacherNote: cleanDraftText(draft.teacherNote, 1200) || basePackage.teacherNote,
    teacherEdited,
    draftVersion: teacherEdited ? 1 : undefined,
  };
}

function interventionPackageMeta(decision) {
  if (decision === "returnEvidence") {
    return {
      title: "补证据任务包",
      status: "returned_for_evidence",
      orderStatus: "evidence",
      stageAfter: "验证修复",
      coverageAfter: 42,
      leadAction: "先把缺失证据补齐，再由教师重新诊断。",
    };
  }
  if (decision === "humanTalk") {
    return {
      title: "人工会谈准备包",
      status: "human_talk",
      orderStatus: "review",
      stageAfter: "教师复核",
      coverageAfter: 44,
      leadAction: "先准备事实卡与问题清单，课堂或课后一对一确认真实卡点。",
    };
  }
  return {
    title: "安全脚手架任务包",
    status: "ready_for_student",
    orderStatus: "intervention",
    stageAfter: "实时干预",
    coverageAfter: 54,
    leadAction: "在安全边界内完成测试清单、最小失败用例和修复证据。",
  };
}

export function buildInterventionPackage(order, options = {}, date = new Date()) {
  if (!order?.selectedDecision) {
    throw new Error("teacher review decision is required before publishing intervention package");
  }
  const meta = interventionPackageMeta(order.selectedDecision);
  const missingTitles = (order.missingEvidence || []).map((item) => item.title);
  const firstMissing = missingTitles[0] || "关键证据";
  const secondMissing = missingTitles[1] || "学习反思";
  const teacherNote =
    String(options.teacherNote || "").trim() ||
    order.teacherNote ||
    "教师已确认：只发布检查清单、最小失败用例和反思要求。";
  const basePackage = {
    id: `pkg-${order.id}-${Date.now().toString(36)}`,
    workOrderId: order.id,
    title: meta.title,
    status: meta.status,
    objective: `${order.studentName || order.learnerAlias || "学生"}围绕“${order.valueAdded?.label || "软件工程能力"}”完成一次可复核改进：${meta.leadAction}`,
    safeBoundary:
      "只提供检查清单、最小失败用例、证据要求和反思脚手架；不生成可直接提交的完整实现代码，不替代教师评价。",
    steps: [
      `复读本次触发事件：${order.trigger}，记录实际结果、期望结果和失败输入。`,
      `补齐“${firstMissing}”，至少覆盖空值、越界、权限或异常路径中的 2 类场景。`,
      "构造 2 个最小失败用例，先让失败可复现，再提交最小修复或说明无需改代码的证据。",
      "更新 PR 描述或学习记录：写清变更范围、验证方式、仍不确定的点。",
      `提交“${secondMissing}”：用 120-180 字说明这次能力差值如何迁移到下一次任务。`,
    ],
    evidenceToSubmit: uniqueStrings([
      ...missingTitles,
      "最小失败用例清单",
      "CI 重新运行记录或截图",
      "PR 变更说明与自测摘要",
      "120-180 字学习反思",
    ]),
    rubricCheckpoints: [
      "能把失败现象转成可复现的测试条件。",
      "能区分边界检查、异常路径和实现修复的先后顺序。",
      "证据足以让教师复核，不依赖口头承诺。",
      "反思说明下一次如何迁移，而不是只描述本次结果。",
    ],
    dueHint: "建议本次课后 24 小时内提交；教师可在复核面板中调整。",
    teacherNote,
    createdBy: order.owner || "任课教师",
    createdAt: nowText(date),
    sourceEvidenceIds: uniqueStrings([
      ...(order.collectedEvidence || []).map((item) => item.id),
      ...(order.missingEvidence || []).map((item) => item.id),
    ]),
    valueAddedFocus: order.valueAdded?.label || "软件工程能力",
  };
  return applyInterventionPackageDraft(basePackage, {
    ...(options.packageDraft || options.draft || {}),
    teacherNote: options.packageDraft?.teacherNote ?? options.draft?.teacherNote ?? teacherNote,
  });
}

export function applyInterventionPackage(order, taskPackage, date = new Date()) {
  const meta = interventionPackageMeta(order.selectedDecision);
  const updated = {
    ...order,
    interventionPackage: taskPackage,
    status: meta.orderStatus,
    stage: meta.stageAfter,
    evidenceCoverage: Math.max(order.evidenceCoverage || 0, meta.coverageAfter),
    updatedAt: nowText(date),
    stages: createStages(meta.orderStatus),
  };
  return {
    order: updated,
    ledgerEntry: {
      id: `ledger-package-${Date.now()}`,
      type: "intervention_package",
      time: nowText(date),
      actor: order.owner || "任课教师",
      title: taskPackage.title,
      source: "教师发布",
      detail: `${taskPackage.teacherEdited ? "教师编辑确认后发布。 " : ""}${cropText(taskPackage.objective, 160)} 安全边界：${taskPackage.safeBoundary}`,
      traceId: `package-${order.id}`,
      stageAfter: updated.stage,
      evidenceCoverageAfter: updated.evidenceCoverage,
    },
  };
}

export function normalizeCourseMicroTaskPackage(input = {}, actorLabel = "任课教师", date = new Date()) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("package must be an object");
  }
  const targetWorkOrderIds = uniqueStrings(input.targetWorkOrderIds).slice(0, 50);
  if (targetWorkOrderIds.length === 0) {
    throw new Error("targetWorkOrderIds is required");
  }
  const sourceGap = cleanDraftText(input.sourceGap, 100) || "共性证据缺口";
  const focusDimension = cleanDraftText(input.focusDimension, 80) || "软件工程能力";
  const fallbackSteps = [
    "从当前失败 PR 或 CI 日志中选一个最小可复现路径。",
    "补齐边界检查清单，并写明预期结果和实际结果。",
    "提交证据摘要，仍失败也要说明失败点，不要求立刻写出完整实现。",
  ];
  const safeBoundary = guardedSafeBoundary(
    input.safeBoundary,
    "只下发检查清单、最小用例要求和反思脚手架；不生成可直接提交的完整实现，不替学生修改代码，不自动给分、排名或惩罚。",
  );
  return {
    id: cleanDraftText(input.id, 80) || `micro-${Date.now().toString(36)}`,
    product: "SE-Path 学伴",
    exportType: "course_micro_task_package",
    generatedAt: cleanDraftText(input.generatedAt, 40) || nowText(date),
    publishedAt: nowText(date),
    publishedBy: cleanDraftText(input.publishedBy || actorLabel, 60) || "任课教师",
    status: "published",
    courseClass: cleanDraftText(input.courseClass, 80) || "软件工程班级",
    courseName: cleanDraftText(input.courseName, 100) || "软件工程课程任务",
    repository: cleanDraftText(input.repository, 100) || "course/repository",
    sourceGap,
    focusDimension,
    affectedCount: Number(input.affectedCount || targetWorkOrderIds.length),
    targetWorkOrderIds,
    targetLearners: cleanDraftLines(input.targetLearners, [], 50),
    objective:
      cleanDraftText(input.objective, 360) ||
      `围绕“${focusDimension}”补齐“${sourceGap}”证据，让诊断先变得可复核。`,
    safeBoundary,
    steps: cleanDraftLines(input.steps, fallbackSteps, 8),
    evidenceToSubmit: cleanDraftLines(
      input.evidenceToSubmit,
      ["最小失败用例或测试片段摘要", "边界检查清单", "CI 重跑结果或本地测试摘要"],
      10,
    ),
    rubricCheckpoints: cleanDraftLines(
      input.rubricCheckpoints,
      ["证据来源可追溯", "问题定位能被教师复核", "不提交完整答案或不可解释结论"],
      8,
    ),
    dueHint: cleanDraftText(input.dueHint, 180) || "建议安排 15-20 分钟课堂微任务，当堂提交证据摘要。",
    teacherAction:
      cleanDraftText(input.teacherAction, 220) ||
      "教师确认后发布到课堂任务；学生补证据后回到增值诊断单复核。",
    confidenceNote:
      cleanDraftText(input.confidenceNote, 220) ||
      "基于打开工单的重复缺口生成；缺证据学生仍显示为待补证。",
    markdown: cleanDraftText(input.markdown, 5000) || "",
  };
}

function buildCourseMicroTaskStudentPackage(order, microTask, publishedAt) {
  return {
    id: `pkg-course-micro-${microTask.id}-${order.id}`,
    workOrderId: order.id,
    title: `课堂微任务：${microTask.sourceGap}`,
    status: "ready_for_student",
    objective: microTask.objective,
    safeBoundary: microTask.safeBoundary,
    steps: microTask.steps,
    evidenceToSubmit: uniqueStrings([
      ...(microTask.evidenceToSubmit || []),
      ...(order.missingEvidence || []).map((item) => item.title),
    ]),
    rubricCheckpoints: microTask.rubricCheckpoints,
    dueHint: microTask.dueHint,
    teacherNote: microTask.teacherAction,
    createdBy: order.owner || microTask.publishedBy || "任课教师",
    createdAt: publishedAt,
    sourceEvidenceIds: uniqueStrings([
      ...(order.collectedEvidence || []).map((item) => item.id),
      ...(order.missingEvidence || []).map((item) => item.id),
    ]),
    valueAddedFocus: order.valueAdded?.label || microTask.focusDimension,
    teacherEdited: true,
    draftVersion: 1,
  };
}

export function applyCourseMicroTaskPublication(order, microTask, date = new Date()) {
  const publishedAt = microTask.publishedAt || nowText(date);
  const hasPackage = Boolean(order.interventionPackage);
  const status = hasPackage ? order.status : "intervention";
  const stage = hasPackage ? order.stage : "实时干预";
  const evidenceCoverage = Math.max(Number(order.evidenceCoverage || 0), hasPackage ? Number(order.evidenceCoverage || 0) : 54);
  const updated = {
    ...order,
    selectedDecision: order.selectedDecision || "returnEvidence",
    teacherNote:
      order.teacherNote ||
      `教师已批量发布课堂微任务：${microTask.sourceGap}。学生需先补证据，再回到教师复核。`,
    interventionPackage: order.interventionPackage || buildCourseMicroTaskStudentPackage(order, microTask, publishedAt),
    status,
    stage,
    evidenceCoverage,
    updatedAt: publishedAt,
    stages: hasPackage ? order.stages : createStages(status),
  };
  return {
    order: updated,
    ledgerEntry: {
      id: `ledger-course-micro-${microTask.id}-${order.id}-${Date.now()}`,
      type: "course_micro_task",
      time: publishedAt,
      actor: microTask.publishedBy || order.owner || "任课教师",
      title: `课堂微任务：${microTask.sourceGap}`,
      source: "课程运营",
      detail: `${cropText(microTask.objective, 180)} 涉及 ${microTask.affectedCount} 张工单；教师验收点：${microTask.rubricCheckpoints.join("；")}。安全边界：${microTask.safeBoundary}`,
      traceId: `course-micro-task-${microTask.id}`,
      stageAfter: updated.stage,
      evidenceCoverageAfter: updated.evidenceCoverage,
    },
  };
}

export function applyCourseMicroTaskReminder(order, reminder = {}, date = new Date()) {
  const remindedAt = nowText(date);
  const title = cleanDraftText(reminder.title, 120) || "课堂微任务回流";
  const note =
    cleanDraftText(reminder.note, 260) ||
    "提醒学生先领取任务包，再补齐最小失败用例、检查清单或反思证据。";
  const traceId = cleanDraftText(reminder.traceId, 160) || `course-reminder-${order.id}`;
  const updated = {
    ...order,
    updatedAt: remindedAt,
  };
  return {
    order: updated,
    ledgerEntry: {
      id: `ledger-reminder-${Date.now()}-${order.id}`,
      type: "teacher_reminder",
      time: remindedAt,
      actor: reminder.actor || order.owner || "任课教师",
      title: `教师催办：${title}`,
      source: "教师催办",
      detail: `${cropText(note, 220)} 本次催办只要求提交可复核证据，不生成可直接提交的完整答案，不自动评价学生。`,
      traceId,
      stageAfter: order.stage,
      evidenceCoverageAfter: Number(order.evidenceCoverage || 0),
    },
  };
}

export function normalizeCourseTeachingImprovementPlan(input = {}, actorLabel = "任课教师", date = new Date()) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("plan must be an object");
  }
  const items = (Array.isArray(input.items) ? input.items : [])
    .slice(0, 8)
    .map((item, index) => {
      const targetWorkOrderIds = uniqueStrings(
        (Array.isArray(item.targetWorkOrderIds) ? item.targetWorkOrderIds : [])
          .map((id) => String(id || "").trim())
          .filter(Boolean),
      ).slice(0, 80);
      const priority = ["high", "medium", "low"].includes(item.priority) ? item.priority : "medium";
      return {
        id: cleanDraftText(item.id, 80) || `teach-improve-item-${index + 1}`,
        sourceTraceId: cleanDraftText(item.sourceTraceId, 180) || `teaching-improvement-source-${index + 1}`,
        focus: cleanDraftText(item.focus, 140) || "课程共性薄弱能力",
        issue: cleanDraftText(item.issue, 360) || "当前证据不足以稳定支持诊断结论，需要补齐课堂可复核材料。",
        action:
          cleanDraftText(item.action, 420) ||
          "下轮课安排证据站点、最小失败用例复盘和教师抽样复核，不直接给可提交答案。",
        acceptanceEvidence: cleanDraftLines(
          item.acceptanceEvidence,
          ["学生补交的最小失败用例", "教师抽样复核记录", "下轮课资源或任务调整记录"],
          8,
        ),
        targetWorkOrderIds,
        priority,
      };
    })
    .filter((item) => item.targetWorkOrderIds.length > 0);

  if (items.length === 0) {
    throw new Error("plan.items with targetWorkOrderIds is required");
  }

  const boundary = guardedSafeBoundary(
    input.boundary || input.safeBoundary,
    "AI 只汇总课程共性缺口并生成候选教学改进；不自动评价学生、不排名、不惩罚，不生成可直接提交的完整答案。",
  );
  const sourceSummary =
    cleanDraftText(input.sourceSummary, 260) ||
    `基于 ${items.length} 项课程复盘结果生成，需教师确认后才写入诊断单账本。`;
  const generatedAt = cleanDraftText(input.generatedAt, 40) || nowText(date);
  const publishedAt = cleanDraftText(input.publishedAt, 40) || nowText(date);
  const id =
    cleanDraftText(input.id, 100) ||
    `teach-improve-${uniqueStrings(items.flatMap((item) => item.targetWorkOrderIds)).join("-").slice(0, 60)}`;
  const markdown =
    cleanDraftText(input.markdown, 8000) ||
    [
      "# SE-Path 下轮教学改进单",
      "",
      `- 课程：${cleanDraftText(input.courseName, 100) || "软件工程课程任务"}`,
      `- 班级：${cleanDraftText(input.courseClass, 80) || "软件工程班级"}`,
      `- 来源：${sourceSummary}`,
      `- 边界：${boundary}`,
      "",
      ...items.flatMap((item, index) => [
        `## ${index + 1}. ${item.focus}`,
        `- 优先级：${item.priority}`,
        `- 问题：${item.issue}`,
        `- 下轮行动：${item.action}`,
        `- 验收证据：${item.acceptanceEvidence.join("、")}`,
        `- 关联工单：${item.targetWorkOrderIds.join("、")}`,
        "",
      ]),
    ].join("\n");

  return {
    id,
    product: "SE-Path 学伴",
    exportType: "course_teaching_improvement_plan",
    generatedAt,
    publishedAt,
    publishedBy: cleanDraftText(input.publishedBy || actorLabel, 60) || "任课教师",
    status: "published",
    courseClass: cleanDraftText(input.courseClass, 80) || "软件工程班级",
    courseName: cleanDraftText(input.courseName, 100) || "软件工程课程任务",
    repository: cleanDraftText(input.repository, 100) || "course/repository",
    sourceSummary,
    items,
    boundary,
    markdown,
  };
}

export function applyCourseTeachingImprovementPlan(order, plan, item, date = new Date()) {
  const publishedAt = plan.publishedAt || nowText(date);
  const evidenceText = uniqueStrings(item.acceptanceEvidence || []).join("、") || "下轮课证据抽样、学生补证据、教师复核记录";
  const updated = {
    ...order,
    teacherNote:
      order.teacherNote ||
      `教师已将“${plan.sourceSummary}”纳入下轮教学改进，仍按单张诊断单进行证据复核。`,
    updatedAt: publishedAt,
  };

  return {
    order: updated,
    ledgerEntry: {
      id: `ledger-teaching-improvement-${Date.now()}-${order.id}-${item.id}`,
      type: "teaching_improvement",
      time: publishedAt,
      actor: plan.publishedBy || order.owner || "任课教师",
      title: `下轮教学改进：${item.focus}`,
      source: "课程复盘",
      detail: `${cropText(item.issue, 180)} 下一步：${cropText(item.action, 220)}；验收证据：${evidenceText}。边界：${plan.boundary}`,
      traceId: `teaching-improvement-${plan.id}`,
      stageAfter: updated.stage,
      evidenceCoverageAfter: Number(updated.evidenceCoverage || 0),
    },
  };
}

export function normalizeCourseTeachingImprovementExecutionReceipt(input = {}, actorLabel = "任课教师", date = new Date()) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("receipt must be an object");
  }
  const planId = cleanDraftText(input.planId, 100);
  if (!planId) {
    throw new Error("receipt.planId is required");
  }
  const targetWorkOrderIds = uniqueStrings(
    (Array.isArray(input.targetWorkOrderIds) ? input.targetWorkOrderIds : [])
      .map((id) => String(id || "").trim())
      .filter(Boolean),
  ).slice(0, 80);
  if (targetWorkOrderIds.length === 0) {
    throw new Error("receipt.targetWorkOrderIds is required");
  }
  const evidence = cleanDraftLines(
    input.evidence,
    ["课堂证据站点记录", "资源版本变更说明", "教师抽样复核记录"],
    8,
  );
  const boundary = guardedSafeBoundary(
    input.boundary || input.safeBoundary,
    "执行回证只证明教师已完成课程改进动作；不自动评价学生、不排名、不惩罚，不生成可直接提交答案。",
  );
  const executedAt = cleanDraftText(input.executedAt, 40) || nowText(date);
  const classSession = cleanDraftText(input.classSession, 120) || "下轮实验课";
  const summary =
    cleanDraftText(input.summary, 420) ||
    "教师已完成下轮课堂证据站点、资源口径和复核路径调整，等待学生补证据后再更新个人诊断。";
  const id = cleanDraftText(input.id, 100) || `teach-exec-${planId}`;
  const courseClass = cleanDraftText(input.courseClass, 80) || "软件工程班级";
  const courseName = cleanDraftText(input.courseName, 100) || "软件工程课程任务";
  const repository = cleanDraftText(input.repository, 100) || "course/repository";
  const markdown =
    cleanDraftText(input.markdown, 8000) ||
    [
      "# SE-Path 下轮课堂执行回证",
      "",
      `- 课程：${courseName}`,
      `- 班级：${courseClass}`,
      `- 仓库：${repository}`,
      `- 关联改进单：${planId}`,
      `- 执行课次：${classSession}`,
      `- 登记时间：${executedAt}`,
      `- 登记人：${cleanDraftText(input.executedBy || actorLabel, 60) || "任课教师"}`,
      `- 边界：${boundary}`,
      "",
      "## 执行摘要",
      "",
      summary,
      "",
      "## 已留存证据",
      "",
      ...evidence.map((item) => `- ${item}`),
      "",
      "## 关联诊断单",
      "",
      ...targetWorkOrderIds.map((id) => `- ${id}`),
    ].join("\n");

  return {
    id,
    product: "SE-Path 学伴",
    exportType: "course_teaching_improvement_execution_receipt",
    planId,
    executedAt,
    executedBy: cleanDraftText(input.executedBy || actorLabel, 60) || "任课教师",
    courseClass,
    courseName,
    repository,
    classSession,
    summary,
    evidence,
    targetWorkOrderIds,
    boundary,
    markdown,
  };
}

export function applyCourseTeachingImprovementExecution(order, receipt, date = new Date()) {
  const executedAt = receipt.executedAt || nowText(date);
  const updated = {
    ...order,
    teacherNote:
      order.teacherNote ||
      `下轮课堂已完成“${receipt.classSession}”执行回证登记，仍需等待学生补证据后再更新个人诊断。`,
    updatedAt: executedAt,
  };

  return {
    order: updated,
    ledgerEntry: {
      id: `ledger-teaching-improvement-execution-${Date.now()}-${order.id}`,
      type: "teaching_improvement_execution",
      time: executedAt,
      actor: receipt.executedBy || order.owner || "任课教师",
      title: `下轮课堂执行回证：${receipt.classSession}`,
      source: "下轮课堂",
      detail: `${cropText(receipt.summary, 260)}；执行证据：${uniqueStrings(receipt.evidence || []).join("、")}。边界：${receipt.boundary}`,
      traceId: `teaching-improvement-execution-${receipt.planId || receipt.id}`,
      stageAfter: updated.stage,
      evidenceCoverageAfter: Number(updated.evidenceCoverage || 0),
    },
  };
}

export function normalizeCourseTeachingImprovementFollowupSample(input = {}, actorLabel = "任课教师", date = new Date()) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("sample must be an object");
  }
  const planId = cleanDraftText(input.planId, 100);
  if (!planId) {
    throw new Error("sample.planId is required");
  }
  const receiptId = cleanDraftText(input.receiptId, 100);
  if (!receiptId) {
    throw new Error("sample.receiptId is required");
  }
  const targetWorkOrderIds = uniqueStrings(
    (Array.isArray(input.targetWorkOrderIds) ? input.targetWorkOrderIds : [])
      .map((id) => String(id || "").trim())
      .filter(Boolean),
  ).slice(0, 80);
  if (targetWorkOrderIds.length === 0) {
    throw new Error("sample.targetWorkOrderIds is required");
  }
  const indicators = (Array.isArray(input.indicators) ? input.indicators : [])
    .slice(0, 8)
    .map((indicator, index) => {
      const status = ["watch", "improved", "needs_more_evidence"].includes(indicator.status)
        ? indicator.status
        : "watch";
      return {
        id: cleanDraftText(indicator.id, 80) || `followup-indicator-${index + 1}`,
        label: cleanDraftText(indicator.label, 120) || `观察指标 ${index + 1}`,
        before: cleanDraftText(indicator.before, 220) || "等待下一轮课堂证据回流。",
        expected: cleanDraftText(indicator.expected, 240) || "下一轮只观察可复核证据是否增加。",
        evidence: cleanDraftText(indicator.evidence, 220) || "学生补证据、CI 摘要、教师复核记录。",
        interpretation:
          cleanDraftText(indicator.interpretation, 260) ||
          "仅作为形成性教学改进线索，不作为学生排名或自动评价依据。",
        status,
      };
    });
  if (indicators.length === 0) {
    throw new Error("sample.indicators is required");
  }
  const boundary = guardedSafeBoundary(
    input.boundary || input.safeBoundary,
    "采样单只建立下一轮观察口径；不把一次课堂执行解释为因果效果，不自动评价学生、不排名、不惩罚。",
  );
  const sampledAt = cleanDraftText(input.sampledAt, 40) || nowText(date);
  const observationWindow = cleanDraftText(input.observationWindow, 120) || "下轮课后 48 小时";
  const summary =
    cleanDraftText(input.summary, 420) ||
    "教师建立下一轮效果采样口径，观察补证据、测试覆盖和教师复核负担变化。";
  const id = cleanDraftText(input.id, 100) || `teach-followup-${planId}`;
  const courseClass = cleanDraftText(input.courseClass, 80) || "软件工程班级";
  const courseName = cleanDraftText(input.courseName, 100) || "软件工程课程任务";
  const repository = cleanDraftText(input.repository, 100) || "course/repository";
  const markdown =
    cleanDraftText(input.markdown, 8000) ||
    [
      "# SE-Path 下轮效果采样单",
      "",
      `- 课程：${courseName}`,
      `- 班级：${courseClass}`,
      `- 仓库：${repository}`,
      `- 关联改进单：${planId}`,
      `- 关联执行回证：${receiptId}`,
      `- 观察窗口：${observationWindow}`,
      `- 登记时间：${sampledAt}`,
      `- 登记人：${cleanDraftText(input.sampledBy || actorLabel, 60) || "任课教师"}`,
      `- 边界：${boundary}`,
      "",
      "## 采样摘要",
      "",
      summary,
      "",
      "## 观察指标",
      "",
      ...indicators.flatMap((indicator, index) => [
        `## ${index + 1}. ${indicator.label}`,
        `- 当前：${indicator.before}`,
        `- 期望：${indicator.expected}`,
        `- 证据：${indicator.evidence}`,
        `- 解释：${indicator.interpretation}`,
        "",
      ]),
    ].join("\n");

  return {
    id,
    product: "SE-Path 学伴",
    exportType: "course_teaching_improvement_followup_sample",
    planId,
    receiptId,
    sampledAt,
    sampledBy: cleanDraftText(input.sampledBy || actorLabel, 60) || "任课教师",
    courseClass,
    courseName,
    repository,
    observationWindow,
    summary,
    indicators,
    targetWorkOrderIds,
    boundary,
    markdown,
  };
}

export function applyCourseTeachingImprovementFollowupSample(order, sample, date = new Date()) {
  const sampledAt = sample.sampledAt || nowText(date);
  const updated = {
    ...order,
    teacherNote:
      order.teacherNote ||
      `已建立“${sample.observationWindow}”效果采样口径，后续只依据新增证据更新形成性诊断。`,
    updatedAt: sampledAt,
  };
  const indicatorText = (sample.indicators || [])
    .map((indicator) => `${indicator.label}=${indicator.expected}`)
    .join("、");

  return {
    order: updated,
    ledgerEntry: {
      id: `ledger-teaching-improvement-followup-${Date.now()}-${order.id}`,
      type: "teaching_improvement_followup",
      time: sampledAt,
      actor: sample.sampledBy || order.owner || "任课教师",
      title: `下轮效果采样：${sample.observationWindow}`,
      source: "效果采样",
      detail: `${cropText(sample.summary, 260)}；观察指标：${cropText(indicatorText, 320)}。边界：${sample.boundary}`,
      traceId: `teaching-improvement-followup-${sample.planId || sample.id}`,
      stageAfter: updated.stage,
      evidenceCoverageAfter: Number(updated.evidenceCoverage || 0),
    },
  };
}

export function normalizeCourseTeachingImprovementFollowupResult(input = {}, actorLabel = "任课教师", date = new Date()) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("result must be an object");
  }
  const planId = cleanDraftText(input.planId, 100);
  if (!planId) {
    throw new Error("result.planId is required");
  }
  const receiptId = cleanDraftText(input.receiptId, 100);
  if (!receiptId) {
    throw new Error("result.receiptId is required");
  }
  const sampleId = cleanDraftText(input.sampleId, 100);
  if (!sampleId) {
    throw new Error("result.sampleId is required");
  }
  const targetWorkOrderIds = uniqueStrings(
    (Array.isArray(input.targetWorkOrderIds) ? input.targetWorkOrderIds : [])
      .map((id) => String(id || "").trim())
      .filter(Boolean),
  ).slice(0, 80);
  if (targetWorkOrderIds.length === 0) {
    throw new Error("result.targetWorkOrderIds is required");
  }
  const findings = (Array.isArray(input.findings) ? input.findings : [])
    .slice(0, 8)
    .map((finding, index) => {
      const status = ["observed_improvement", "no_clear_change", "needs_more_evidence"].includes(finding.status)
        ? finding.status
        : "no_clear_change";
      return {
        id: cleanDraftText(finding.id, 80) || `followup-result-${index + 1}`,
        label: cleanDraftText(finding.label, 120) || `观察结果 ${index + 1}`,
        expected: cleanDraftText(finding.expected, 240) || "按采样单观察下一轮证据变化。",
        observed: cleanDraftText(finding.observed, 240) || "等待新增证据回收。",
        evidence: cleanDraftText(finding.evidence, 240) || "学生补证据、CI 摘要、教师复核记录和账本追踪号。",
        interpretation:
          cleanDraftText(finding.interpretation, 320) ||
          "仅作为形成性课程改进线索，不作为学生排名、惩罚或自动评价依据。",
        status,
      };
    });
  if (findings.length === 0) {
    throw new Error("result.findings is required");
  }
  const boundary = guardedSafeBoundary(
    input.boundary || input.safeBoundary,
    "采样结果只记录下一轮观察到的证据变化，不能证明单次教学措施的因果效果，不自动评价学生、不排名、不惩罚。",
  );
  const collectedAt = cleanDraftText(input.collectedAt, 40) || nowText(date);
  const observationWindow = cleanDraftText(input.observationWindow, 120) || "下轮课后 48 小时";
  const nextAction =
    cleanDraftText(input.nextAction, 420) ||
    "继续补齐新增证据和教师复核，再沉淀为课程资源调整样本。";
  const summary =
    cleanDraftText(input.summary, 520) ||
    "教师回收下一轮采样结果，只记录证据变化和流程线索，不生成因果效果或自动评价结论。";
  const id = cleanDraftText(input.id, 100) || `teach-followup-result-${sampleId}`;
  const courseClass = cleanDraftText(input.courseClass, 80) || "软件工程班级";
  const courseName = cleanDraftText(input.courseName, 100) || "软件工程课程任务";
  const repository = cleanDraftText(input.repository, 100) || "course/repository";
  const markdown =
    cleanDraftText(input.markdown, 10000) ||
    [
      "# SE-Path 采样结果回收单",
      "",
      `- 课程：${courseName}`,
      `- 班级：${courseClass}`,
      `- 仓库：${repository}`,
      `- 关联改进单：${planId}`,
      `- 关联执行回证：${receiptId}`,
      `- 关联采样单：${sampleId}`,
      `- 观察窗口：${observationWindow}`,
      `- 回收时间：${collectedAt}`,
      `- 回收人：${cleanDraftText(input.collectedBy || actorLabel, 60) || "任课教师"}`,
      `- 边界：${boundary}`,
      "",
      "## 回收摘要",
      "",
      summary,
      "",
      "## 观察结果",
      "",
      ...findings.flatMap((finding, index) => [
        `## ${index + 1}. ${finding.label}`,
        `- 预期：${finding.expected}`,
        `- 观察：${finding.observed}`,
        `- 证据：${finding.evidence}`,
        `- 解释：${finding.interpretation}`,
        "",
      ]),
      "## 下一步",
      "",
      nextAction,
    ].join("\n");

  return {
    id,
    product: "SE-Path 学伴",
    exportType: "course_teaching_improvement_followup_result",
    planId,
    receiptId,
    sampleId,
    collectedAt,
    collectedBy: cleanDraftText(input.collectedBy || actorLabel, 60) || "任课教师",
    courseClass,
    courseName,
    repository,
    observationWindow,
    summary,
    findings,
    targetWorkOrderIds,
    nextAction,
    boundary,
    markdown,
  };
}

export function applyCourseTeachingImprovementFollowupResult(order, result, date = new Date()) {
  const collectedAt = result.collectedAt || nowText(date);
  const updated = {
    ...order,
    teacherNote:
      order.teacherNote ||
      `已回收“${result.observationWindow}”采样结果；仅作为课程改进线索，个人诊断仍需新增证据和教师复核。`,
    updatedAt: collectedAt,
  };
  const findingText = (result.findings || [])
    .map((finding) => `${finding.label}=${finding.observed}`)
    .join("、");

  return {
    order: updated,
    ledgerEntry: {
      id: `ledger-teaching-improvement-followup-result-${Date.now()}-${order.id}`,
      type: "teaching_improvement_followup_result",
      time: collectedAt,
      actor: result.collectedBy || order.owner || "任课教师",
      title: `采样结果回收：${result.observationWindow}`,
      source: "结果回收",
      detail: `${cropText(result.summary, 280)}；观察结果：${cropText(findingText, 360)}。下一步：${cropText(result.nextAction, 220)}。边界：${result.boundary}`,
      traceId: `teaching-improvement-followup-result-${result.sampleId || result.id}`,
      stageAfter: updated.stage,
      evidenceCoverageAfter: Number(updated.evidenceCoverage || 0),
    },
  };
}

export function normalizeCourseResourceRevisionTicket(input = {}, actorLabel = "任课教师", date = new Date()) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("ticket must be an object");
  }
  const sourceResultId = cleanDraftText(input.sourceResultId, 100);
  if (!sourceResultId) {
    throw new Error("ticket.sourceResultId is required");
  }
  const sampleId = cleanDraftText(input.sampleId, 100);
  if (!sampleId) {
    throw new Error("ticket.sampleId is required");
  }
  const planId = cleanDraftText(input.planId, 100);
  if (!planId) {
    throw new Error("ticket.planId is required");
  }
  const targetWorkOrderIds = uniqueStrings(
    (Array.isArray(input.targetWorkOrderIds) ? input.targetWorkOrderIds : [])
      .map((id) => String(id || "").trim())
      .filter(Boolean),
  ).slice(0, 80);
  if (targetWorkOrderIds.length === 0) {
    throw new Error("ticket.targetWorkOrderIds is required");
  }
  const allowedStatuses = new Set(["ready", "needs_review", "blocked"]);
  const changes = (Array.isArray(input.changes) ? input.changes : [])
    .slice(0, 8)
    .map((change, index) => ({
      id: cleanDraftText(change.id, 80) || `resource-change-${index + 1}`,
      area: cleanDraftText(change.area, 100) || "课程资源",
      title: cleanDraftText(change.title, 140) || `资源改版项 ${index + 1}`,
      reason:
        cleanDraftText(change.reason, 320) ||
        "根据下轮采样结果补齐证据口径和教师复核流程。",
      implementation:
        cleanDraftText(change.implementation, 420) ||
        "更新课堂资源、PR 模板和 Rubric 检查点，只提供证据脚手架，不给完整答案。",
      owner: cleanDraftText(change.owner, 80) || actorLabel,
      status: allowedStatuses.has(change.status) ? change.status : "needs_review",
    }));
  if (changes.length === 0) {
    throw new Error("ticket.changes is required");
  }
  const acceptanceChecks = uniqueStrings(
    (Array.isArray(input.acceptanceChecks) ? input.acceptanceChecks : [])
      .map((item) => cleanDraftText(item, 220))
      .filter(Boolean),
  ).slice(0, 10);
  if (acceptanceChecks.length === 0) {
    acceptanceChecks.push(
      "资源改版记录必须能追溯到采样结果和关联诊断单账本。",
      "不生成可直接提交的完整答案，不自动评价学生、不排名、不惩罚。",
    );
  }
  const boundary = guardedSafeBoundary(
    input.boundary || input.safeBoundary,
    "课程资源改版只用于修正教学资源、证据口径和教师复核流程；不证明单次教学因果效果，不自动评价学生、不排名、不惩罚、不生成可直接提交的完整答案。",
  );
  const createdAt = cleanDraftText(input.createdAt, 40) || nowText(date);
  const resourceTitle =
    cleanDraftText(input.resourceTitle, 180) || "软件工程课程边界测试资源包";
  const versionFrom = cleanDraftText(input.versionFrom, 80) || "previous";
  const versionTo = cleanDraftText(input.versionTo, 100) || `revision-${sourceResultId}`;
  const reason =
    cleanDraftText(input.reason, 600) ||
    "根据采样结果把共性证据缺口沉淀为课程资源改版，下一轮仍以新增证据和教师复核为准。";
  const courseClass = cleanDraftText(input.courseClass, 80) || "软件工程班级";
  const courseName = cleanDraftText(input.courseName, 100) || "软件工程课程任务";
  const repository = cleanDraftText(input.repository, 100) || "course/repository";
  const markdown =
    cleanDraftText(input.markdown, 12000) ||
    [
      "# SE-Path 课程资源改版工单",
      "",
      `- 课程：${courseName}`,
      `- 班级：${courseClass}`,
      `- 仓库：${repository}`,
      `- 资源：${resourceTitle}`,
      `- 版本：${versionFrom} -> ${versionTo}`,
      `- 关联采样结果：${sourceResultId}`,
      `- 关联采样单：${sampleId}`,
      `- 创建时间：${createdAt}`,
      `- 创建人：${cleanDraftText(input.createdBy || actorLabel, 60) || "任课教师"}`,
      `- 边界：${boundary}`,
      "",
      "## 改版原因",
      "",
      reason,
      "",
      "## 改版内容",
      "",
      ...changes.flatMap((change, index) => [
        `## ${index + 1}. ${change.area} / ${change.title}`,
        `- 原因：${change.reason}`,
        `- 实施：${change.implementation}`,
        `- 负责人：${change.owner}`,
        "",
      ]),
      "## 验收口径",
      "",
      ...acceptanceChecks.map((item) => `- ${item}`),
    ].join("\n");

  return {
    id: cleanDraftText(input.id, 100) || `resource-revision-${sourceResultId}`,
    product: "SE-Path 学伴",
    exportType: "course_resource_revision_ticket",
    sourceResultId,
    sampleId,
    planId,
    createdAt,
    createdBy: cleanDraftText(input.createdBy || actorLabel, 60) || "任课教师",
    courseClass,
    courseName,
    repository,
    resourceTitle,
    versionFrom,
    versionTo,
    reason,
    changes,
    acceptanceChecks,
    targetWorkOrderIds,
    boundary,
    markdown,
  };
}

export function applyCourseResourceRevisionTicket(order, ticket, date = new Date()) {
  const createdAt = ticket.createdAt || nowText(date);
  const updated = {
    ...order,
    teacherNote:
      order.teacherNote ||
      `已把采样结果沉淀为课程资源改版“${ticket.versionTo}”；后续只依据新增证据更新形成性诊断。`,
    updatedAt: createdAt,
  };
  const changeText = (ticket.changes || [])
    .map((change) => `${change.area}/${change.title}`)
    .join("、");

  return {
    order: updated,
    ledgerEntry: {
      id: `ledger-course-resource-revision-${Date.now()}-${order.id}`,
      type: "course_resource_revision",
      time: createdAt,
      actor: ticket.createdBy || order.owner || "任课教师",
      title: `课程资源改版：${ticket.resourceTitle}`,
      source: "资源改版",
      detail: `${cropText(ticket.reason, 320)}；版本：${ticket.versionFrom} -> ${ticket.versionTo}；改版项：${cropText(changeText, 360)}。验收：${cropText((ticket.acceptanceChecks || []).join("、"), 260)}。边界：${ticket.boundary}`,
      traceId: `course-resource-revision-${ticket.id}`,
      stageAfter: updated.stage,
      evidenceCoverageAfter: Number(updated.evidenceCoverage || 0),
    },
  };
}

export function normalizeCourseResourceReleaseReceipt(input = {}, actorLabel = "任课教师", date = new Date()) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("receipt must be an object");
  }
  const revisionTicketId = cleanDraftText(input.revisionTicketId, 100);
  if (!revisionTicketId) {
    throw new Error("receipt.revisionTicketId is required");
  }
  const sourceResultId = cleanDraftText(input.sourceResultId, 100);
  if (!sourceResultId) {
    throw new Error("receipt.sourceResultId is required");
  }
  const sampleId = cleanDraftText(input.sampleId, 100);
  if (!sampleId) {
    throw new Error("receipt.sampleId is required");
  }
  const targetWorkOrderIds = uniqueStrings(
    (Array.isArray(input.targetWorkOrderIds) ? input.targetWorkOrderIds : [])
      .map((id) => String(id || "").trim())
      .filter(Boolean),
  ).slice(0, 80);
  if (targetWorkOrderIds.length === 0) {
    throw new Error("receipt.targetWorkOrderIds is required");
  }

  const allowedStatuses = new Set(["passed", "watch", "blocked"]);
  const assets = uniqueStrings(
    (Array.isArray(input.assets) ? input.assets : [])
      .map((asset) => cleanDraftText(asset, 180))
      .filter(Boolean),
  ).slice(0, 12);
  if (assets.length === 0) {
    throw new Error("receipt.assets is required");
  }

  const checks = (Array.isArray(input.checks) ? input.checks : [])
    .slice(0, 8)
    .map((check, index) => ({
      id: cleanDraftText(check.id, 80) || `resource-release-check-${index + 1}`,
      label: cleanDraftText(check.label, 140) || `发布检查 ${index + 1}`,
      evidence:
        cleanDraftText(check.evidence, 420) ||
        "已保留可复核的版本、入口或验收证据。",
      owner: cleanDraftText(check.owner, 80) || actorLabel,
      status: allowedStatuses.has(check.status) ? check.status : "watch",
    }));
  if (checks.length === 0) {
    throw new Error("receipt.checks is required");
  }

  const boundary = guardedSafeBoundary(
    input.boundary || input.safeBoundary,
    "资源发布回证只证明课程资源已按教师确认版本交付；不证明教学措施因果效果，不自动评价学生、不排名、不惩罚、不生成可直接提交的完整答案。",
  );
  const releasedAt = cleanDraftText(input.releasedAt, 40) || nowText(date);
  const resourceTitle =
    cleanDraftText(input.resourceTitle, 180) || "软件工程课程边界测试资源包";
  const releasedVersion =
    cleanDraftText(input.releasedVersion || input.versionTo, 100) ||
    `released-${revisionTicketId}`;
  const releaseChannel =
    cleanDraftText(input.releaseChannel, 180) || "课程仓库 + 学生任务入口 + Rubric 配置";
  const releaseScope =
    cleanDraftText(input.releaseScope, 180) || "下一轮软件工程课程学习任务";
  const rollbackPlan =
    cleanDraftText(input.rollbackPlan, 520) ||
    "保留上一版课程资源入口；若下一轮证据覆盖下降或教师复核负担上升，暂停下发并回到人工抽样复核。";
  const courseClass = cleanDraftText(input.courseClass, 80) || "软件工程班级";
  const courseName = cleanDraftText(input.courseName, 100) || "软件工程课程任务";
  const repository = cleanDraftText(input.repository, 100) || "course/repository";
  const releasedBy = cleanDraftText(input.releasedBy || actorLabel, 60) || "任课教师";
  const markdown =
    cleanDraftText(input.markdown, 12000) ||
    [
      "# SE-Path 课程资源发布回证",
      "",
      `- 课程：${courseName}`,
      `- 班级：${courseClass}`,
      `- 仓库：${repository}`,
      `- 资源：${resourceTitle}`,
      `- 发布版本：${releasedVersion}`,
      `- 关联改版工单：${revisionTicketId}`,
      `- 关联采样结果：${sourceResultId}`,
      `- 关联采样单：${sampleId}`,
      `- 发布时间：${releasedAt}`,
      `- 发布人：${releasedBy}`,
      `- 发布渠道：${releaseChannel}`,
      `- 发布范围：${releaseScope}`,
      `- 边界：${boundary}`,
      "",
      "## 发布资产",
      "",
      ...assets.map((asset) => `- ${asset}`),
      "",
      "## 发布检查",
      "",
      ...checks.flatMap((check, index) => [
        `## ${index + 1}. ${check.label}`,
        `- 状态：${check.status}`,
        `- 证据：${check.evidence}`,
        `- 负责人：${check.owner}`,
        "",
      ]),
      "## 回滚计划",
      "",
      rollbackPlan,
    ].join("\n");

  return {
    id: cleanDraftText(input.id, 100) || `resource-release-${revisionTicketId}`,
    product: "SE-Path 学伴",
    exportType: "course_resource_release_receipt",
    revisionTicketId,
    sourceResultId,
    sampleId,
    releasedAt,
    releasedBy,
    courseClass,
    courseName,
    repository,
    resourceTitle,
    releasedVersion,
    releaseChannel,
    releaseScope,
    assets,
    checks,
    rollbackPlan,
    targetWorkOrderIds,
    boundary,
    markdown,
  };
}

export function applyCourseResourceReleaseReceipt(order, receipt, date = new Date()) {
  const releasedAt = receipt.releasedAt || nowText(date);
  const updated = {
    ...order,
    teacherNote:
      order.teacherNote ||
      `课程资源版本“${receipt.releasedVersion}”已发布；下一轮诊断只依据新增证据和教师复核更新。`,
    updatedAt: releasedAt,
  };
  const assetText = (receipt.assets || []).join("、");
  const checkText = (receipt.checks || [])
    .map((check) => `${check.label}=${check.status}`)
    .join("、");

  return {
    order: updated,
    ledgerEntry: {
      id: `ledger-course-resource-release-${Date.now()}-${order.id}`,
      type: "course_resource_release",
      time: releasedAt,
      actor: receipt.releasedBy || order.owner || "任课教师",
      title: `课程资源发布回证：${receipt.releasedVersion}`,
      source: "资源发布",
      detail: `${receipt.resourceTitle} 已通过 ${receipt.releaseChannel} 面向 ${receipt.releaseScope} 发布；资产：${cropText(assetText, 280)}；检查：${cropText(checkText, 320)}。回滚：${cropText(receipt.rollbackPlan, 280)}。边界：${receipt.boundary}`,
      traceId: `course-resource-release-${receipt.id}`,
      stageAfter: updated.stage,
      evidenceCoverageAfter: Number(updated.evidenceCoverage || 0),
    },
  };
}

export function normalizeCourseResourceUsageReceipt(input = {}, actorLabel = "任课教师", date = new Date()) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("receipt must be an object");
  }
  const releaseReceiptId = cleanDraftText(input.releaseReceiptId, 100);
  if (!releaseReceiptId) {
    throw new Error("receipt.releaseReceiptId is required");
  }
  const revisionTicketId = cleanDraftText(input.revisionTicketId, 100);
  if (!revisionTicketId) {
    throw new Error("receipt.revisionTicketId is required");
  }
  const sourceResultId = cleanDraftText(input.sourceResultId, 100);
  if (!sourceResultId) {
    throw new Error("receipt.sourceResultId is required");
  }
  const sampleId = cleanDraftText(input.sampleId, 100);
  if (!sampleId) {
    throw new Error("receipt.sampleId is required");
  }
  const targetWorkOrderIds = uniqueStrings(
    (Array.isArray(input.targetWorkOrderIds) ? input.targetWorkOrderIds : [])
      .map((id) => String(id || "").trim())
      .filter(Boolean),
  ).slice(0, 80);
  if (targetWorkOrderIds.length === 0) {
    throw new Error("receipt.targetWorkOrderIds is required");
  }

  const boundedNumber = (value, min, max, fallback = 0) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(max, Math.max(min, Math.round(numeric)));
  };
  const activeLearners = boundedNumber(input.activeLearners, 0, 10000);
  const submittedEvidenceCount = boundedNumber(input.submittedEvidenceCount, 0, 10000);
  const teacherReviewReadyCount = boundedNumber(input.teacherReviewReadyCount, 0, 10000);
  const medianCoverageAfter = boundedNumber(input.medianCoverageAfter, 0, 100, 0);

  const allowedStatuses = new Set(["confirmed", "watch", "needs_review"]);
  const signals = (Array.isArray(input.signals) ? input.signals : [])
    .slice(0, 10)
    .map((signal, index) => ({
      id: cleanDraftText(signal.id, 80) || `resource-usage-signal-${index + 1}`,
      label: cleanDraftText(signal.label, 120) || `使用信号 ${index + 1}`,
      value: cleanDraftText(signal.value, 80) || "待观察",
      evidence:
        cleanDraftText(signal.evidence, 420) ||
        "仅记录课程资源入口使用、新证据提交或教师复核就绪状态。",
      status: allowedStatuses.has(signal.status) ? signal.status : "watch",
    }));
  if (signals.length === 0) {
    throw new Error("receipt.signals is required");
  }

  let boundary = guardedSafeBoundary(
    input.boundary || input.safeBoundary,
    "资源使用回流只记录学生是否使用新资源和是否提交新证据；不证明资源因果效果，不自动评价学生、不排名、不惩罚、不生成可直接提交的完整答案。",
  );
  if (!/排名/.test(boundary)) boundary = `${boundary}；不用于排名。`;
  if (!/惩罚/.test(boundary)) boundary = `${boundary}；不用于惩罚。`;
  if (!/自动评价/.test(boundary)) boundary = `${boundary}；不自动评价学生。`;
  const observedAt = cleanDraftText(input.observedAt, 40) || nowText(date);
  const observedBy = cleanDraftText(input.observedBy || actorLabel, 60) || "任课教师";
  const courseClass = cleanDraftText(input.courseClass, 80) || "软件工程班级";
  const courseName = cleanDraftText(input.courseName, 100) || "软件工程课程任务";
  const repository = cleanDraftText(input.repository, 100) || "course/repository";
  const releasedVersion =
    cleanDraftText(input.releasedVersion || input.version, 100) || `released-${releaseReceiptId}`;
  const usageWindow =
    cleanDraftText(input.usageWindow, 160) || `${courseClass} 新资源发布后 48 小时`;
  const nextAction =
    cleanDraftText(input.nextAction, 520) ||
    "先复核新增证据，再判断是否需要继续调整课程资源。";
  const markdown =
    cleanDraftText(input.markdown, 12000) ||
    [
      "# SE-Path 课程资源使用回流单",
      "",
      `- 课程：${courseName}`,
      `- 班级：${courseClass}`,
      `- 仓库：${repository}`,
      `- 发布版本：${releasedVersion}`,
      `- 关联发布回证：${releaseReceiptId}`,
      `- 关联改版工单：${revisionTicketId}`,
      `- 关联采样结果：${sourceResultId}`,
      `- 关联采样单：${sampleId}`,
      `- 观察窗口：${usageWindow}`,
      `- 回收时间：${observedAt}`,
      `- 回收人：${observedBy}`,
      `- 边界：${boundary}`,
      "",
      "## 使用信号",
      "",
      ...signals.flatMap((signal, index) => [
        `## ${index + 1}. ${signal.label}`,
        `- 数值：${signal.value}`,
        `- 状态：${signal.status}`,
        `- 证据：${signal.evidence}`,
        "",
      ]),
      "## 汇总",
      "",
      `- 活跃学生：${activeLearners}`,
      `- 新增证据：${submittedEvidenceCount}`,
      `- 待教师复核：${teacherReviewReadyCount}`,
      `- 证据覆盖中位数：${medianCoverageAfter}%`,
      "",
      "## 下一步",
      "",
      nextAction,
    ].join("\n");

  return {
    id: cleanDraftText(input.id, 100) || `resource-usage-${releaseReceiptId}`,
    product: "SE-Path 学伴",
    exportType: "course_resource_usage_receipt",
    releaseReceiptId,
    revisionTicketId,
    sourceResultId,
    sampleId,
    observedAt,
    observedBy,
    courseClass,
    courseName,
    repository,
    releasedVersion,
    usageWindow,
    activeLearners,
    submittedEvidenceCount,
    teacherReviewReadyCount,
    medianCoverageAfter,
    signals,
    nextAction,
    targetWorkOrderIds,
    boundary,
    markdown,
  };
}

export function applyCourseResourceUsageReceipt(order, receipt, date = new Date()) {
  const observedAt = receipt.observedAt || nowText(date);
  const updated = {
    ...order,
    teacherNote:
      order.teacherNote ||
      `课程资源版本“${receipt.releasedVersion}”已回收下一轮使用证据；仅作为课程资源继续优化线索。`,
    updatedAt: observedAt,
  };
  const signalText = (receipt.signals || [])
    .map((signal) => `${signal.label}=${signal.value}`)
    .join("、");

  return {
    order: updated,
    ledgerEntry: {
      id: `ledger-course-resource-usage-${Date.now()}-${order.id}`,
      type: "course_resource_usage",
      time: observedAt,
      actor: receipt.observedBy || order.owner || "任课教师",
      title: `课程资源使用回流：${receipt.usageWindow}`,
      source: "使用回流",
      detail: `${receipt.releasedVersion} 在 ${receipt.usageWindow} 已回收使用证据：活跃 ${receipt.activeLearners} 人、提交证据 ${receipt.submittedEvidenceCount} 份、待教师复核 ${receipt.teacherReviewReadyCount} 份、覆盖中位数 ${receipt.medianCoverageAfter}%。信号：${cropText(signalText, 320)}。下一步：${cropText(receipt.nextAction, 260)}。边界：${receipt.boundary}`,
      traceId: `course-resource-usage-${receipt.id}`,
      stageAfter: updated.stage,
      evidenceCoverageAfter: Number(updated.evidenceCoverage || 0),
    },
  };
}

export function applyCourseResourceUsageReminder(order, reminder = {}, date = new Date()) {
  const remindedAt = nowText(date);
  const title = cleanDraftText(reminder.title, 120) || "课程资源使用回流";
  const note =
    cleanDraftText(reminder.note, 300) ||
    "提醒学生从新资源入口领取任务包，再补齐证据和反思；教师不直接给答案。";
  const traceId = cleanDraftText(reminder.traceId, 180) || `course-resource-usage-reminder-${order.id}`;
  const updated = {
    ...order,
    updatedAt: remindedAt,
  };
  return {
    order: updated,
    ledgerEntry: {
      id: `ledger-resource-usage-reminder-${Date.now()}-${order.id}`,
      type: "teacher_reminder",
      time: remindedAt,
      actor: reminder.actor || order.owner || "任课教师",
      title: `资源使用催办：${title}`,
      source: "教师催办",
      detail: `${cropText(note, 260)} 本次催办只要求提交可复核证据，不生成可直接提交的完整答案，不自动评价学生。`,
      traceId,
      stageAfter: order.stage,
      evidenceCoverageAfter: Number(order.evidenceCoverage || 0),
    },
  };
}

export function applyStudentReturn(order, state, step, content = "", date = new Date()) {
  const nextState = { ...normalizeStudentReturnState(state), [step]: true };
  const completed = countStudentReturnSteps(nextState);
  const status = completed >= 3 ? "review" : completed === 2 ? "evidence" : "intervention";
  const stage = completed >= 3 ? "教师验收" : completed === 2 ? "验证修复" : "实时干预";
  const revisionLabel = nextState.revision ? `第 ${nextState.revision + 1} 轮` : "首轮";
  const updated = {
    ...order,
    status,
    stage,
    evidenceCoverage: Math.max(order.evidenceCoverage || 0, 48 + completed * 10),
    updatedAt: nowText(date),
    stages: createStages(status),
  };
  const titles = {
    scaffoldReceived: "学生已接收脚手架",
    evidenceSubmitted: "学生已补充关键证据",
    reflectionSubmitted: "学生已提交反思",
  };
  return {
    order: updated,
    state: nextState,
    ledgerEntry: {
      id: `ledger-return-${step}-${Date.now()}`,
      type: "student_return",
      time: nowText(date),
      actor: "学生端",
      title: titles[step] || "学生回流事件",
      source: "学生回流",
      detail: content
        ? `${revisionLabel}学生回流内容：${cropText(content, 220)}`
        : `${revisionLabel}学生回流节点已写入证据账本。`,
      traceId: `return-${order.id}-${step}`,
      stageAfter: stage,
      evidenceCoverageAfter: updated.evidenceCoverage,
    },
  };
}

export function applyTeacherEvidenceReview(order, review = {}, date = new Date()) {
  const reviewedAt = nowText(date);
  const statusText = {
    accepted: "可采信",
    needs_evidence: "待补",
    rejected: "不采用",
  };
  const items = Array.isArray(review.items) ? review.items : [];
  const blockers = items.filter((item) => item.status !== "accepted").length;
  const details = items
    .map((item) => `${cropText(item.label, 60)}=${statusText[item.status] || item.status}${item.note ? `（${cropText(item.note, 80)}）` : ""}`)
    .join("；");
  const updated = {
    ...order,
    updatedAt: reviewedAt,
  };
  return {
    order: updated,
    ledgerEntry: {
      id: `ledger-teacher-evidence-review-${Date.now()}-${order.id}`,
      type: "teacher_evidence_review",
      time: reviewedAt,
      actor: order.owner || "任课教师",
      title: blockers ? "教师复核学生证据：仍需补证" : "教师复核学生证据：可进入验收",
      source: "教师证据复核",
      detail: `${details || "教师已复核学生回流证据"}。结论：${cropText(review.summary || "", 180)}${review.teacherNote ? `；备注：${cropText(review.teacherNote, 140)}` : ""}`,
      traceId: `teacher-evidence-review-${cropText(review.sourceLedgerEntryId || order.id, 120)}`,
      stageAfter: order.stage,
      evidenceCoverageAfter: Number(order.evidenceCoverage || 0),
      payload: {
        sourceLedgerEntryId: review.sourceLedgerEntryId || "",
        summary: review.summary || "",
        items,
      },
    },
  };
}

export function applyTeacherClosure(order, state, decision, teacherNote = "", date = new Date()) {
  const normalizedState = normalizeStudentReturnState(state);
  const completed = countStudentReturnSteps(normalizedState);
  if (decision === "accept" && completed < 3) {
    throw new Error("student return must complete before teacher closure");
  }
  if (!["accept", "returnEvidence"].includes(decision)) {
    throw new Error("decision must be accept or returnEvidence");
  }
  const isReturn = decision === "returnEvidence";
  const returnReason = String(teacherNote || "").trim() || "证据仍不足，退回学生继续补齐关键材料。";
  const returnRevision = Number(normalizedState.revision || 0) + 1;
  const nextState = isReturn
    ? {
        ...normalizedState,
        evidenceSubmitted: false,
        reflectionSubmitted: false,
        revision: returnRevision,
        returnedAt: nowText(date),
        returnReason,
        returnRequestedBy: order.owner || "任课教师",
      }
    : normalizedState;
  const nextCurrent = Math.max(order.valueAdded?.current || 0, order.valueAdded?.expected || 0);
  const valueAdded = isReturn
    ? {
        ...order.valueAdded,
        uncertainty: "medium",
        description: `${order.valueAdded?.description || ""} 教师验收时要求继续补证据，结论保持形成性。`.trim(),
      }
    : {
        ...order.valueAdded,
        current: nextCurrent,
        delta: nextCurrent - (order.valueAdded?.expected || 0),
        uncertainty: "low",
        description: `${order.valueAdded?.description || ""} 教师已基于学生回流证据完成验收。`.trim(),
      };
  const status = isReturn ? "evidence" : "closed";
  const stage = isReturn ? "退回补证据" : "闭环完成";
  const valueAddedSnapshot = buildValueAddedSnapshot(order, valueAdded, decision, teacherNote, date);
  const updated = {
    ...order,
    status,
    stage,
    evidenceCoverage: Math.max(order.evidenceCoverage || 0, isReturn ? 72 : 88),
    valueAdded,
    valueAddedSnapshot,
    missingEvidence: isReturn
      ? [
          buildReturnedEvidenceRequirement(order, returnRevision, returnReason, date),
          ...(order.missingEvidence || []).filter((item) => !String(item.id || "").startsWith(`ev-return-${order.id}-`)),
        ]
      : order.missingEvidence,
    interventionPackage: order.interventionPackage
      ? {
          ...order.interventionPackage,
          status: isReturn ? "returned_for_evidence" : order.interventionPackage.status,
        }
      : undefined,
    teacherNote: teacherNote || order.teacherNote,
    updatedAt: nowText(date),
    stages: createStages(status),
  };
  return {
    order: updated,
    state: nextState,
    ledgerEntry: {
      id: `ledger-closure-${decision}-${Date.now()}`,
      type: "teacher_acceptance",
      time: nowText(date),
      actor: order.owner || "任课教师",
      title: isReturn ? "教师验收退回补证据" : "教师验收通过并关闭诊断单",
      source: "教师验收",
      detail: teacherNote
        ? `教师验收意见：${cropText(teacherNote, 220)}${
            valueAddedSnapshot
              ? ` 增值快照：${valueAddedSnapshot.baseline} -> ${valueAddedSnapshot.observed}，覆盖率 ${valueAddedSnapshot.evidenceCoverage}%。`
              : ""
          }`
        : isReturn
          ? "证据仍不足，退回学生继续补齐关键材料。"
          : `学生回流证据达到本轮形成性诊断要求，诊断单关闭。增值快照：${valueAddedSnapshot?.baseline ?? order.valueAdded?.current ?? 0} -> ${valueAddedSnapshot?.observed ?? valueAdded.current ?? 0}，覆盖率 ${valueAddedSnapshot?.evidenceCoverage ?? updated.evidenceCoverage}%。`,
      traceId: `closure-${order.id}-${decision}`,
      stageAfter: stage,
      evidenceCoverageAfter: updated.evidenceCoverage,
      valueAddedSnapshotId: valueAddedSnapshot?.id,
    },
  };
}

export function buildLearnerProfile(learnerHash, workOrders = []) {
  const learnerOrders = workOrders.filter((order) => order.learnerHash === learnerHash || order.studentNo === learnerHash);
  const dimensions = learnerOrders.map((order) => order.valueAdded).filter(Boolean);
  const averageCoverage =
    learnerOrders.length === 0
      ? 0
      : Math.round(learnerOrders.reduce((sum, order) => sum + Number(order.evidenceCoverage || 0), 0) / learnerOrders.length);
  return {
    learnerHash,
    workOrderCount: learnerOrders.length,
    averageCoverage,
    dimensions,
    valueAddedSnapshots: learnerOrders.map((order) => order.valueAddedSnapshot).filter(Boolean),
    boundary:
      "增值画像只用于形成性诊断和资源推荐，不用于排名、惩罚、就业预测或其他高风险自动决策。",
    updatedAt: nowText(),
  };
}

export function buildLedgerExportPayload(order, ledger, studentReturn) {
  const normalizedReturn = normalizeStudentReturnState(studentReturn);
  return {
    product: "SE-Path 学伴",
    exportType: "teacher_evidence_ledger",
    exportedAt: nowText(),
    boundary:
      "形成性诊断，不排名不惩罚；AI 只提供候选建议，教师确认后生效；不展示完整答案或可直接提交代码。",
    selectedDecision: order?.selectedDecision || null,
    currentStage: order?.stage || null,
    evidenceCoverage: order?.evidenceCoverage || 0,
    studentReturnProgress: `${countStudentReturnSteps(normalizedReturn)}/3`,
    studentReturnRevision: normalizedReturn.revision || 0,
    studentReturnReason: normalizedReturn.returnReason || null,
    valueAddedSnapshot: order?.valueAddedSnapshot || null,
    workOrder: order,
    ledger,
  };
}
