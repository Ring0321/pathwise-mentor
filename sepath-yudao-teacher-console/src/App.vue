<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import TeachingAgent from "./components/TeachingAgent.vue";
import type { AgentDraftSelection } from "./types/teachingAgent";
import {
  ArrowDown,
  ArrowRight,
  Calendar,
  ChatLineRound,
  Check,
  CircleCheckFilled,
  Compass,
  DataBoard,
  Document,
  Download,
  EditPen,
  House,
  Notebook,
  RefreshLeft,
  Setting,
  Tickets,
  TrendCharts,
  User,
  WarningFilled,
} from "@element-plus/icons-vue";
import { decisionMeta, riskLabels, statusLabels } from "./data/workbench";
import {
  buildCourseMicroTaskPackage,
  buildCourseWeeklyReport,
  checkApiConnection,
  clearApiAccessToken,
  closeWorkOrder,
  createBatchWorkOrders,
  createWorkOrderFromIntake,
  downloadJsonFile,
  downloadTextFile,
  exportLedgerPackage,
  generateAiScaffoldDraft,
  getCourseRoster,
  getGithubIntegrationStatus,
  getTeacherWorkbench,
  importGithubCiBatch,
  launchCoursePilot,
  loginWithTeacherAccessCode,
  loadRemoteCourseSettings,
  publishInterventionPackage,
  publishCourseMicroTaskPackage,
  publishCourseTeachingImprovementPlan,
  recordCourseResourceReleaseReceipt,
  recordCourseResourceUsageReceipt,
  remindCourseResourceUsageTargets,
  recordCourseTeachingImprovementExecution,
  recordCourseTeachingImprovementFollowupResult,
  recordCourseTeachingImprovementFollowupSample,
  recordCourseResourceRevisionTicket,
  remindCourseMicroTaskTargets,
  recordTeacherEvidenceReview,
  recordStudentReturn,
  readApiBaseUrl,
  readApiAccessToken,
  readConfiguredLlmGatewayBaseUrl,
  resetWorkbench,
  reviewWorkOrder,
  saveCourseRoster,
  saveApiBaseUrl,
  saveLlmGatewayBaseUrl,
  saveRemoteCourseSettings,
  selectWorkOrder as selectWorkOrderApi,
  type AiScaffoldDraftResult,
  type ApiConnectionCheck,
  type CourseSettingsConfig,
  type TeacherEventIntake,
} from "./services/workbenchApi";
import type {
  CourseBatchTask,
  CourseLaunchChecklistItem,
  CourseLaunchResult,
  CourseMicroTaskPackage,
  CourseResourceReleaseReceipt,
  CourseResourceUsageReceipt,
  CourseResourceRevisionTicket,
  CourseRosterLearner,
  CourseTeachingImprovementExecutionReceipt,
  CourseTeachingImprovementFollowupResult,
  CourseTeachingImprovementFollowupSample,
  CourseTeachingImprovementItem,
  CourseTeachingImprovementPlan,
  EvidenceEvent,
  EvidenceLedgerEntry,
  EvidenceLedgerType,
  GithubCiBatchImportItem,
  GithubIntegrationStatus,
  InterventionPackageDraft,
  LearningWorkOrder,
  RiskLevel,
  StudentReturnArtifact,
  StudentReturnStep,
  StudentReturnState,
  TeacherClosureDecision,
  TeacherDecision,
  TeacherEvidenceReviewPayload,
  TeacherEvidenceReviewStatus,
  WorkbenchSnapshot,
  WorkOrderStatus,
} from "./types";

type ReturnStepKey = StudentReturnStep;

const loading = ref(true);
const saving = ref(false);
const ledgerDrawerOpen = ref(false);
const intakeDrawerOpen = ref(false);
const courseDrawerOpen = ref(false);
const opsDrawerOpen = ref(false);
const agentDrawerOpen = ref(false);
const valueEngineDrawerOpen = ref(false);
const learnerProfileDrawerOpen = ref(false);
const learnerProfileOrderId = ref("");
const launchDrawerOpen = ref(false);
const launchStep = ref(0);
const lastLaunchResult = ref<CourseLaunchResult | null>(null);
const teacherNote = ref("");
interface PackageDraftForm {
  title: string;
  objective: string;
  safeBoundary: string;
  dueHint: string;
  stepsText: string;
  evidenceText: string;
  rubricText: string;
}

const packageDraftForm = reactive<PackageDraftForm>({
  title: "",
  objective: "",
  safeBoundary: "",
  dueHint: "",
  stepsText: "",
  evidenceText: "",
  rubricText: "",
});
const packageDraftTouched = ref(false);
const packageDraftSourceKey = ref("");
const aiScaffoldLoading = ref(false);
const aiScaffoldStatus = ref("");
const snapshot = ref<WorkbenchSnapshot | null>(null);
const searchText = ref("");
const riskFilter = ref<"all" | RiskLevel>("all");
const statusFilter = ref<"all" | WorkOrderStatus>("all");
const selectedTodayIds = ref<string[]>([]);
type LedgerAuditFilter = "all" | "evidence" | "teacher" | "student" | "system";
const ledgerSearchText = ref("");
const ledgerAuditFilter = ref<LedgerAuditFilter>("all");
const initialParams = new URLSearchParams(window.location.search);
type EntryMode = "teacher" | "student" | "reviewer";
const initialMode = initialParams.get("mode");
const entryMode = ref<EntryMode>(
  initialMode === "student" ? "student" : initialMode === "reviewer" ? "reviewer" : "teacher",
);
const studentMode = computed(() => entryMode.value === "student");
const reviewerMode = computed(() => entryMode.value === "reviewer");
const studentModeOrderId = ref(initialParams.get("order") ?? "");
const studentReturnToken = ref(
  initialParams.get("returnToken") ?? initialParams.get("token") ?? "",
);
const studentReflectionText = ref("");
interface StudentEvidenceForm {
  failureSymptom: string;
  minimalCase: string;
  verificationRecord: string;
  evidenceLink: string;
}

const studentEvidenceForm = reactive<StudentEvidenceForm>({
  failureSymptom: "",
  minimalCase: "",
  verificationRecord: "",
  evidenceLink: "",
});
const studentEvidenceIntegrityChecked = ref(false);
type TeacherEvidenceReviewDraftStatus = TeacherEvidenceReviewStatus | "";
const teacherEvidenceReviewStatuses = reactive<Record<string, TeacherEvidenceReviewDraftStatus>>({});
const teacherEvidenceReviewNote = ref("");
const rosterLearners = ref<CourseRosterLearner[]>([]);
const rosterText = ref("");
const selectedLearnerHashes = ref<string[]>([]);
const courseConfigStorageKey = "sepath-yudao-course-config:v1";
interface CourseConfig extends CourseSettingsConfig {
  apiBaseUrl: string;
  llmGatewayBaseUrl: string;
}

function readCourseConfig(): CourseConfig {
  const defaults: CourseConfig = {
    courseClass: "软件工程 2301",
    courseName: "REST API 错误处理与边界测试",
    repository: "se-course/rest-api-lab",
    ciProvider: "GitHub Actions",
    apiBaseUrl: readApiBaseUrl(),
    llmGatewayBaseUrl: readConfiguredLlmGatewayBaseUrl(),
    privacyPolicy: "仅保存脱敏后的 PR/CI 片段、对话摘要与教师复核记录。",
  };
  try {
    const raw = window.localStorage.getItem(courseConfigStorageKey);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return {
      ...defaults,
      ...parsed,
      apiBaseUrl: parsed.apiBaseUrl ?? readApiBaseUrl(),
      llmGatewayBaseUrl: parsed.llmGatewayBaseUrl ?? readConfiguredLlmGatewayBaseUrl(),
    };
  } catch {
    return defaults;
  }
}

const githubImport = reactive({
  prUrl: "https://github.com/se-course/rest-api-lab/pull/28",
  ciRunUrl: "https://github.com/se-course/rest-api-lab/actions/runs/10280028",
  repository: "se-course/rest-api-lab",
  branch: "feature/order-error-handling",
  ciLog:
    "CI failed: POST /orders with empty body returned 500; missing tests for null body, oversized payload and permission exception.",
});
const githubBatchRows = ref(
  [
    "learner-0321 | https://github.com/se-course/rest-api-lab/pull/31 | https://github.com/se-course/rest-api-lab/actions/runs/10310031 | feature/order-null-body | POST /orders 空请求体仍返回 500，缺少 null body 和权限异常测试",
    "learner-0417 | https://github.com/se-course/rest-api-lab/pull/32 | https://github.com/se-course/rest-api-lab/actions/runs/10310032 | feature/order-permission | 权限异常路径缺少契约回归证据，CI 在 forbidden case 失败",
    "learner-0526 | https://github.com/se-course/rest-api-lab/pull/33 | https://github.com/se-course/rest-api-lab/actions/runs/10310033 | feature/order-rollback | 事务回滚测试缺失，并发提交后库存状态不一致",
  ].join("\n"),
);
const githubBatchImportStatus = ref("等待导入");
const githubIntegrationStatus = ref<GithubIntegrationStatus | null>(null);
const integrationStatusLoading = ref(false);
const courseConfig = reactive<CourseConfig>(readCourseConfig());
const apiStatus = ref<"idle" | "checking" | "connected" | "error" | "offline">(
  courseConfig.apiBaseUrl.trim() ? "idle" : "offline",
);
const apiStatusMessage = ref(
  courseConfig.apiBaseUrl.trim()
    ? "已配置后端地址，保存或检测后同步课程设置。"
    : "未配置后端 API 地址，当前使用本地离线数据。",
);
const apiCapabilities = ref<string[]>([]);
const apiStorageMode = ref(courseConfig.apiBaseUrl.trim() ? "pending" : "local-offline");
const apiRequiresToken = ref(false);
const authSessionActive = ref(Boolean(readApiAccessToken()));
const teacherLoginOpen = ref(false);
const teacherAccessCode = ref("");
const authLoginLoading = ref(false);
const launchForm = reactive({
  courseClass: courseConfig.courseClass,
  courseName: courseConfig.courseName,
  repository: courseConfig.repository,
  ciProvider: courseConfig.ciProvider,
  privacyPolicy: courseConfig.privacyPolicy,
  trigger: "第 1 次 REST API 边界测试巡检",
  eventDate: new Date().toISOString().slice(0, 10),
  owner: "张老师",
  focus: "boundary" as CourseBatchTask["focus"],
  risk: "medium" as RiskLevel,
  taskSummary:
    "从 PR、CI、测试清单、课堂求助和学习反思中收集证据；证据不足时只生成候选诊断单，由教师确认下一步。",
});
const launchRosterRows = ref(
  [
    "learner-0321, LZX-0321, A 组, learner-0321, active",
    "learner-0417, ZYR-0417, A 组, learner-0417, active",
    "learner-0526, WY-0526, B 组, learner-0526, watch",
    "learner-0618, QY-0618, B 组, learner-0618, active",
  ].join("\n"),
);
const connectionModeLabel = computed(() =>
  apiStatus.value === "connected"
    ? "Edge API 已连接"
    : courseConfig.apiBaseUrl.trim()
      ? "Edge API 待检测"
      : "本地离线模式",
);
const authModeLabel = computed(() => {
  if (!courseConfig.apiBaseUrl.trim()) return "离线模式";
  if (authSessionActive.value) return "教师已授权";
  if (apiRequiresToken.value || apiStatus.value === "error") return "教师待登录";
  return "本地兼容身份";
});
const llmGatewayModeLabel = computed(() => {
  if (courseConfig.llmGatewayBaseUrl.trim()) return "独立智能体网关";
  if (courseConfig.apiBaseUrl.trim()) return "同源智能体网关";
  return "本地安全模板";
});
const llmGatewayModeDetail = computed(() => {
  if (courseConfig.llmGatewayBaseUrl.trim()) {
    return "教师端调用独立 /api/ai/generate-scaffold，模型密钥只在后端 Secret Store。";
  }
  if (courseConfig.apiBaseUrl.trim()) {
    return "使用主 Edge API 的同源模型路由；无模型密钥时返回受控兜底草稿。";
  }
  return "未配置后端时，仅用本地规则生成可编辑草稿，不声明模型推理。";
});
const storageModeLabel = computed(() => {
  const mode = apiStorageMode.value;
  if (mode.includes("database") || mode.includes("d1")) return "数据库持久化";
  if (mode.includes("memory")) return "内存试运行";
  if (mode === "pending") return "待检测";
  if (mode.includes("offline")) return "本地离线兜底";
  return "Edge API";
});
const webhookUrl = computed(() => {
  const base = courseConfig.apiBaseUrl.trim().replace(/\/+$/, "");
  return base ? `${base}/api/webhooks/github/ci` : "配置后端 API 后生成";
});
const latestGithubIntegrationEvent = computed(
  () => githubIntegrationStatus.value?.events[0] ?? null,
);
const githubIntegrationHealthText = computed(() => {
  const health = githubIntegrationStatus.value?.summary.health;
  if (health === "receiving") return "正在接收";
  if (health === "configured") return "已配置待首条";
  return "未配置";
});
const githubIntegrationStatusTone = computed(() => {
  const health = githubIntegrationStatus.value?.summary.health;
  if (health === "receiving") return "ready";
  if (health === "configured") return "watch";
  return "todo";
});
const githubIntegrationQuickStats = computed(() => {
  const summary = githubIntegrationStatus.value?.summary;
  return [
    {
      label: "成功接入",
      value: String(summary?.successfulCount ?? 0),
    },
    {
      label: "最近鉴权",
      value: summary?.lastAuthMode || "待接入",
    },
    {
      label: "当前工单",
      value: String(summary?.workOrderCount ?? workOrders.value.length),
    },
  ];
});
const pilotChecklist = computed(() => [
  {
    label: "后端连通",
    status: apiStatus.value === "connected" ? "ready" : courseConfig.apiBaseUrl.trim() ? "watch" : "todo",
  },
  {
    label: "数据持久化",
    status:
      apiStorageMode.value.includes("database") || apiStorageMode.value.includes("d1")
        ? "ready"
        : apiStatus.value === "connected"
          ? "watch"
          : "todo",
  },
  {
    label: "仓库 Webhook",
    status: courseConfig.apiBaseUrl.trim() && courseConfig.repository.trim() ? "ready" : "todo",
  },
  {
    label: "签名验真",
    status:
      githubIntegrationStatus.value?.summary.lastAuthMode === "github-signature"
        ? "ready"
        : courseConfig.apiBaseUrl.trim()
          ? "watch"
          : "todo",
  },
  {
    label: "智能体网关",
    status: courseConfig.llmGatewayBaseUrl.trim() || courseConfig.apiBaseUrl.trim() ? "ready" : "watch",
  },
  {
    label: "隐私边界",
    status: courseConfig.privacyPolicy.trim().length >= 12 ? "ready" : "todo",
  },
]);
const githubWorkflowYaml = computed(() => {
  const target = courseConfig.apiBaseUrl.trim()
    ? webhookUrl.value
    : "https://your-sepath-edge.example.com/api/webhooks/github/ci";
  return `name: SE-Path CI Evidence

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  test-and-report:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm test
      - name: Send SE-Path evidence when CI fails
        if: failure()
        env:
          SEPATH_WEBHOOK_URL: "${target}"
          SEPATH_WEBHOOK_SECRET: \${{ secrets.SEPATH_WEBHOOK_SECRET }}
          SEPATH_LEARNER_HASH: \${{ vars.SEPATH_LEARNER_HASH || format('stu_hash_{0}', github.actor) }}
        run: |
          payload_file="$(mktemp)"
          cat > "$payload_file" <<JSON
          {
            "tenantId": "tenant-se-course-2026",
            "courseId": "software-engineering-project",
            "learnerHash": "$SEPATH_LEARNER_HASH",
            "learnerAlias": "SE learner",
            "deliveryId": "\${{ github.run_id }}-\${{ github.run_attempt }}",
            "repository": "\${{ github.repository }}",
            "branch": "\${{ github.head_ref || github.ref_name }}",
            "prUrl": "\${{ github.event.pull_request.html_url }}",
            "ciRunUrl": "\${{ github.server_url }}/\${{ github.repository }}/actions/runs/\${{ github.run_id }}",
            "ciProvider": "GitHub Actions",
            "ciLogSummary": "CI failed. Please inspect failed job summary and add boundary or regression evidence.",
            "courseClass": "${courseConfig.courseClass}",
            "courseName": "${courseConfig.courseName}",
            "owner": "任课教师"
          }
          JSON
          signature="$(openssl dgst -sha256 -hmac "$SEPATH_WEBHOOK_SECRET" "$payload_file" | awk '{print $2}')"
          curl -sS -X POST "$SEPATH_WEBHOOK_URL" \\
            -H "content-type: application/json" \\
            -H "x-github-event: pull_request" \\
            -H "x-github-delivery: \${{ github.run_id }}-\${{ github.run_attempt }}" \\
            -H "x-hub-signature-256: sha256=$signature" \\
            --data-binary "@$payload_file"`;
});

const todayLabel = new Date().toLocaleDateString("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const navItems = [
  { label: "工作台", icon: House, active: true },
  { label: "增值引擎", icon: Compass, active: false },
  { label: "智能体协同", icon: ChatLineRound, active: false },
  { label: "学情档案", icon: User, active: false },
  { label: "证据账本", icon: Document, active: false },
  { label: "增长看板", icon: TrendCharts, active: false },
  { label: "课程设置", icon: Setting, active: false },
];

const riskOptions: Array<{ label: string; value: "all" | RiskLevel }> = [
  { label: "全部风险", value: "all" },
  { label: "高", value: "high" },
  { label: "中", value: "medium" },
  { label: "低", value: "low" },
];

const statusOptions: Array<{ label: string; value: "all" | WorkOrderStatus }> = [
  { label: "全部阶段", value: "all" },
  { label: "诊断", value: "diagnosis" },
  { label: "门禁", value: "guardrail" },
  { label: "干预", value: "intervention" },
  { label: "验证", value: "evidence" },
  { label: "复核", value: "review" },
  { label: "完成", value: "closed" },
];

type CourseOpsTone = "red" | "amber" | "blue" | "green";
type CourseReviewGateStatus =
  | "not_ready"
  | "pending_review"
  | "accepted"
  | "needs_evidence"
  | "rejected";

interface CourseOpsMetric {
  label: string;
  value: string;
  hint: string;
  tone: CourseOpsTone;
}

interface CourseReviewGateMetric {
  label: string;
  value: string;
  hint: string;
  tone: CourseOpsTone;
}

interface CourseReviewGateItem {
  id: string;
  studentName: string;
  studentNo: string;
  focus: string;
  risk: RiskLevel;
  stage: string;
  returnDone: number;
  evidenceCoverage: number;
  gate: CourseReviewGateStatus;
  gateLabel: string;
  action: string;
  reviewedAt: string;
}

interface CoursePriorityItem {
  id: string;
  studentName: string;
  trigger: string;
  risk: RiskLevel;
  status: WorkOrderStatus;
  focus: string;
  score: number;
  action: string;
  evidenceCoverage: number;
  returnDone: number;
}

interface CourseFocusInsight {
  label: string;
  count: number;
  averageDelta: number;
  averageCoverage: number;
  highUncertainty: number;
  acceptedReview: number;
  pendingReview: number;
  blockedReview: number;
}

interface CourseEvidenceGap {
  title: string;
  count: number;
  source: string;
  action: string;
}

interface TodayInboxMetric {
  label: string;
  value: string;
  hint: string;
  tone: "dark" | "blue" | "amber" | "green";
}

interface TodayInboxRow extends CoursePriorityItem {
  studentNo: string;
  courseName: string;
  missingCount: number;
}

interface LearnerProfileMetric {
  label: string;
  value: string;
  hint: string;
  tone: "dark" | "blue" | "amber" | "green";
}

interface LearnerProfileFocus {
  label: string;
  count: number;
  latestScore: number;
  expectedScore: number;
  delta: number;
  coverage: number;
  uncertainty: LearningWorkOrder["valueAdded"]["uncertainty"];
}

interface LearnerProfileEvidenceChannel {
  label: string;
  count: number;
  detail: string;
}

interface LearnerProfileTimelineItem {
  id: string;
  title: string;
  date: string;
  status: WorkOrderStatus;
  statusLabel: string;
  trigger: string;
  focus: string;
  delta: number;
  coverage: number;
  reviewGate: CourseReviewGateStatus;
  reviewGateLabel: string;
  action: string;
}

interface MicroTaskTrackingRow {
  id: string;
  studentName: string;
  studentNo: string;
  stage: string;
  risk: RiskLevel;
  evidenceCoverage: number;
  returnDone: number;
  returnTotal: number;
  action: string;
  studentUrl: string;
  selected: boolean;
  reviewReady: boolean;
}

interface MicroTaskTrackingBoard {
  traceId: string;
  title: string;
  detail: string;
  targetCount: number;
  startedCount: number;
  completedCount: number;
  reviewReadyCount: number;
  averageCoverage: number;
  rows: MicroTaskTrackingRow[];
}

interface CourseInterventionReviewMetric {
  label: string;
  value: string;
  hint: string;
  tone: CourseOpsTone;
}

interface CourseInterventionReviewRow {
  id: string;
  traceId: string;
  title: string;
  focus: string;
  firstOrderId: string;
  targetWorkOrderIds: string[];
  targetCount: number;
  returnedCount: number;
  completedCount: number;
  acceptedReviewCount: number;
  blockedReviewCount: number;
  snapshotCount: number;
  averageCoverage: number;
  effectLabel: string;
  action: string;
}

const decisionOptions: Array<{
  id: TeacherDecision;
  title: string;
  subtitle: string;
  testId: string;
}> = [
  {
    id: "approve",
    title: "批准脚手架",
    subtitle: "生成最小化助手架与测试清单",
    testId: "decision-approve",
  },
  {
    id: "returnEvidence",
    title: "退回补证据",
    subtitle: "要求补齐边界清单和失败用例",
    testId: "decision-return-evidence",
  },
  {
    id: "humanTalk",
    title: "转人工会谈",
    subtitle: "安排一对一确认真实卡点",
    testId: "decision-human-talk",
  },
];

const teacherEvidenceReviewStatusLabels: Record<TeacherEvidenceReviewStatus, string> = {
  accepted: "可采信",
  needs_evidence: "待补",
  rejected: "不采用",
};

const teacherEvidenceReviewOptions: Array<{
  id: TeacherEvidenceReviewStatus;
  label: string;
}> = [
  { id: "accepted", label: "可采信" },
  { id: "needs_evidence", label: "待补" },
  { id: "rejected", label: "不采用" },
];

const structuredStudentEvidenceKeys: Array<{
  key: keyof StudentReturnArtifact;
  label: string;
  required: boolean;
}> = [
  { key: "failureSymptom", label: "失败现象", required: true },
  { key: "minimalCase", label: "最小失败用例", required: true },
  { key: "verificationRecord", label: "修复/验证记录", required: true },
  { key: "evidenceLink", label: "PR/CI 链接", required: false },
  { key: "integrityNote", label: "诚信与边界", required: true },
];

const returnSteps: Array<{
  key: ReturnStepKey;
  title: string;
  detail: string;
  testId: string;
}> = [
  {
    key: "scaffoldReceived",
    title: "学生接收任务",
    detail: "脚手架、检查清单和安全边界已下发",
    testId: "student-return-scaffold",
  },
  {
    key: "evidenceSubmitted",
    title: "学生补证据",
    detail: "提交最小失败用例、测试清单或反思片段",
    testId: "student-return-evidence",
  },
  {
    key: "reflectionSubmitted",
    title: "形成性回流",
    detail: "写入反思，等待教师验收后沉淀增值快照",
    testId: "student-return-reflection",
  },
];

const intakeForm = reactive<TeacherEventIntake>({
  studentName: "韩沐阳",
  studentNo: "2301180728",
  courseClass: "软件工程 2301",
  courseName: "REST API 错误处理与边界测试",
  trigger: "PR #28 CI 失败",
  eventDate: new Date().toISOString().slice(0, 10),
  owner: "张老师",
  focus: "boundary",
  evidenceText:
    "PR #28 新增订单接口错误处理，GitHub Actions 显示空请求体返回 500；测试报告只有成功路径，缺少空值、超长字段和权限异常用例。",
  studentHelpText:
    "学生在学伴对话中请求：能不能直接给我一份错误处理代码。我不确定应该先补测试还是先改接口。",
});

const batchTask = reactive<CourseBatchTask>({
  courseClass: "软件工程 2301",
  courseName: "REST API 错误处理与边界测试",
  trigger: "第 4 周 REST API 边界测试巡检",
  eventDate: new Date().toISOString().slice(0, 10),
  owner: "张老师",
  focus: "boundary",
  risk: "medium",
  taskSummary:
    "批量检查本周 PR/CI、测试清单和课堂求助记录。证据不足时只生成候选诊断单，要求学生补最小失败用例、边界检查清单和学习反思。",
  learnerHashes: [],
});

const workOrders = computed(() => snapshot.value?.workOrders ?? []);

const activeRecordId = computed(() => {
  const current = snapshot.value;
  if (!current) return "";
  if (studentMode.value && studentModeOrderId.value) return studentModeOrderId.value;
  return current.selectedId;
});

const filteredWorkOrders = computed(() => {
  const keyword = searchText.value.trim().toLowerCase();
  const riskWeight: Record<RiskLevel, number> = { high: 0, medium: 1, low: 2 };
  return workOrders.value
    .filter((order) => {
      const riskMatched =
        riskFilter.value === "all" || order.risk === riskFilter.value;
      const statusMatched =
        statusFilter.value === "all" || order.status === statusFilter.value;
      const text = `${order.studentName} ${order.studentNo} ${order.courseClass} ${order.courseName} ${order.trigger} ${order.summary}`.toLowerCase();
      return riskMatched && statusMatched && (!keyword || text.includes(keyword));
    })
    .sort((a, b) => {
      if (a.status === "closed" && b.status !== "closed") return 1;
      if (a.status !== "closed" && b.status === "closed") return -1;
      return riskWeight[a.risk] - riskWeight[b.risk];
    });
});

const selectedOrder = computed<LearningWorkOrder | null>(() => {
  const current = snapshot.value;
  if (!current) return null;
  return (
    current.workOrders.find((item) => item.id === current.selectedId) ??
    current.workOrders[0] ??
    null
  );
});

const selectedLedger = computed(
  () => snapshot.value?.ledger[activeRecordId.value] ?? [],
);

const ledgerTypeLabels: Record<EvidenceLedgerType, string> = {
  intake: "事件导入",
  baseline: "基线记录",
  evidence: "学习证据",
  gap: "缺证提示",
  recommendation: "Safe-VOI",
  decision: "教师决策",
  course_micro_task: "课堂微任务",
  teacher_reminder: "教师催办",
  teaching_improvement: "下轮教学改进",
  teaching_improvement_execution: "执行回证",
  teaching_improvement_followup: "效果采样",
  teaching_improvement_followup_result: "采样回收",
  course_resource_revision: "资源改版",
  course_resource_release: "资源发布",
  course_resource_usage: "使用回流",
  intervention_package: "任务包",
  student_return: "学生回流",
  teacher_evidence_review: "证据复核",
  teacher_acceptance: "教师验收",
};

function isStudentLedgerEntry(entry: EvidenceLedgerEntry) {
  return entry.type === "student_return" || entry.actor.includes("学生");
}

function isTeacherLedgerEntry(entry: EvidenceLedgerEntry) {
  return (
    entry.type === "decision" ||
    entry.type === "teacher_reminder" ||
    entry.type === "teacher_evidence_review" ||
    entry.type === "teacher_acceptance" ||
    entry.actor.includes("教师") ||
    entry.source.includes("教师")
  );
}

function isEvidenceLedgerEntry(entry: EvidenceLedgerEntry) {
  return (
    entry.type === "evidence" ||
    entry.source.includes("Git") ||
    entry.source.includes("CI") ||
    entry.source.includes("PR") ||
    entry.source.includes("反思") ||
    entry.source.includes("对话") ||
    entry.title.includes("证据")
  );
}

function ledgerEntryMatchesFilter(entry: EvidenceLedgerEntry, filter: LedgerAuditFilter) {
  if (filter === "all") return true;
  if (filter === "student") return isStudentLedgerEntry(entry);
  if (filter === "teacher") return isTeacherLedgerEntry(entry);
  if (filter === "evidence") return isEvidenceLedgerEntry(entry);
  return (
    !isStudentLedgerEntry(entry) &&
    !isTeacherLedgerEntry(entry) &&
    (entry.type === "gap" ||
      entry.type === "recommendation" ||
      entry.type === "course_micro_task" ||
      entry.type === "intervention_package" ||
      entry.type === "intake" ||
      entry.actor.includes("SE-Path") ||
      entry.source.includes("Safe-VOI"))
  );
}

function ledgerTypeLabel(type: EvidenceLedgerType) {
  return ledgerTypeLabels[type] ?? type;
}

const ledgerAuditOptions = computed<
  Array<{ key: LedgerAuditFilter; label: string; count: number; hint: string }>
>(() => {
  const entries = selectedLedger.value;
  return [
    { key: "all", label: "全部", count: entries.length, hint: "完整时间线" },
    {
      key: "evidence",
      label: "证据",
      count: entries.filter(isEvidenceLedgerEntry).length,
      hint: "Git / CI / 反思",
    },
    {
      key: "teacher",
      label: "教师",
      count: entries.filter(isTeacherLedgerEntry).length,
      hint: "复核与验收",
    },
    {
      key: "student",
      label: "学生",
      count: entries.filter(isStudentLedgerEntry).length,
      hint: "补证据回流",
    },
    {
      key: "system",
      label: "系统",
      count: entries.filter((entry) => ledgerEntryMatchesFilter(entry, "system")).length,
      hint: "诊断与任务包",
    },
  ];
});

const filteredLedger = computed(() => {
  const keyword = ledgerSearchText.value.trim().toLowerCase();
  return selectedLedger.value.filter((entry) => {
    const matchedFilter = ledgerEntryMatchesFilter(entry, ledgerAuditFilter.value);
    if (!matchedFilter) return false;
    if (!keyword) return true;
    return [
      entry.title,
      entry.source,
      entry.actor,
      entry.detail,
      entry.traceId ?? "",
      entry.stageAfter ?? "",
      entry.evidenceCoverageAfter?.toString() ?? "",
      ledgerTypeLabel(entry.type),
    ]
      .join(" ")
      .toLowerCase()
      .includes(keyword);
  });
});

const ledgerAuditStatus = computed(() => {
  const entries = selectedLedger.value;
  const hasTeacherDecision = entries.some(isTeacherLedgerEntry);
  const hasStudentReturn = entries.some(isStudentLedgerEntry);
  if (selectedOrder.value?.status === "closed") return "已闭环，可导出复核包";
  if (hasTeacherDecision && hasStudentReturn) return "等待教师验收";
  if (hasTeacherDecision) return "等待学生回流";
  return "等待教师确认";
});

function resetLedgerAuditFilters() {
  ledgerSearchText.value = "";
  ledgerAuditFilter.value = "all";
}

const currentReturnState = computed<StudentReturnState>(() => {
  const current = snapshot.value;
  if (!current) {
    return {
      scaffoldReceived: false,
      evidenceSubmitted: false,
      reflectionSubmitted: false,
    };
  }
  return (
    current.studentReturn[activeRecordId.value] ?? {
      scaffoldReceived: false,
      evidenceSubmitted: false,
      reflectionSubmitted: false,
    }
  );
});

const studentOrder = computed(() => {
  const current = snapshot.value;
  if (!current || !studentModeOrderId.value) return null;
  return (
    current.workOrders.find((item) => item.id === studentModeOrderId.value) ??
    null
  );
});

const currentInterventionPackage = computed(
  () => selectedOrder.value?.interventionPackage ?? null,
);

const packageDecisionTitles: Record<TeacherDecision, string> = {
  approve: "安全脚手架任务包",
  returnEvidence: "补证据任务包",
  humanTalk: "人工会谈准备包",
};

const packageDecisionLeadActions: Record<TeacherDecision, string> = {
  approve: "在安全边界内完成测试清单、最小失败用例和修复证据。",
  returnEvidence: "先补齐关键证据，再由教师重新诊断。",
  humanTalk: "先准备事实卡与问题清单，课堂或课后一对一确认真实卡点。",
};

function stripDraftPrefix(line: string) {
  return line.replace(/^\s*(?:[-*]|\d+[.)、])\s*/, "").trim();
}

function splitPackageDraftLines(text: string) {
  return Array.from(
    new Set(
      text
        .split(/\r?\n/)
        .map(stripDraftPrefix)
        .filter(Boolean),
    ),
  );
}

function joinPackageDraftLines(lines: string[]) {
  return lines.join("\n");
}

function packageMissingTitles(order: LearningWorkOrder) {
  return order.missingEvidence.map((item) => item.title);
}

function buildPackageDraftSeed(order: LearningWorkOrder): PackageDraftForm {
  const decision = order.selectedDecision;
  const missingTitles = packageMissingTitles(order);
  const firstMissing = missingTitles[0] ?? "关键证据";
  const secondMissing = missingTitles[1] ?? "学习反思";
  const title = decision ? packageDecisionTitles[decision] : "待复核任务包草稿";
  const leadAction = decision
    ? packageDecisionLeadActions[decision]
    : "先完成教师复核，再开放学生回流入口。";
  return {
    title,
    objective: `${order.studentName}围绕“${order.valueAdded.label}”完成一次可复核改进：${leadAction}`,
    safeBoundary:
      "只提供检查清单、最小失败用例、证据要求和反思脚手架；不生成可直接提交的完整实现代码，不替代教师评价。",
    dueHint: "建议本次课后 24 小时内提交；教师可按班级节奏调整。",
    stepsText: joinPackageDraftLines([
      `复述触发事件：${order.trigger}，记录实际结果、期望结果和失败输入。`,
      `补齐“${firstMissing}”，至少覆盖空值、越界、权限或异常路径中的 2 类场景。`,
      "构造 2 个最小失败用例，先让失败可复现，再提交最小修复或说明无需改代码的证据。",
      "更新 PR 描述或学习记录：写清变更范围、验证方式和仍不确定的点。",
      `提交“${secondMissing}”：用 120-180 字说明这次能力差值如何迁移到下一次任务。`,
    ]),
    evidenceText: joinPackageDraftLines([
      ...missingTitles,
      "最小失败用例清单",
      "CI 重新运行记录或截图",
      "PR 变更说明与自测摘要",
      "120-180 字学习反思",
    ]),
    rubricText: joinPackageDraftLines([
      "能把失败现象转成可复现的测试条件。",
      "能区分边界检查、异常路径和实现修复的先后顺序。",
      "证据足以让教师复核，不依赖口头承诺。",
      "反思说明下一次如何迁移，而不是只描述本次结果。",
    ]),
  };
}

function syncPackageDraftFromOrder(order: LearningWorkOrder | null) {
  if (!order) return;
  if (!order.interventionPackage && packageDraftTouched.value && packageDraftSourceKey.value.startsWith(`${order.id}:conversation:`)) return;
  const sourceKey = `${order.id}:${order.selectedDecision ?? "none"}:${order.interventionPackage?.id ?? "draft"}`;
  if (packageDraftSourceKey.value === sourceKey && packageDraftTouched.value) return;
  if (order.interventionPackage) {
    packageDraftSourceKey.value = sourceKey;
    packageDraftTouched.value = false;
    return;
  }
  Object.assign(packageDraftForm, buildPackageDraftSeed(order));
  packageDraftSourceKey.value = sourceKey;
  packageDraftTouched.value = false;
}

function markPackageDraftTouched() {
  packageDraftTouched.value = true;
}

const packageDraftStepCount = computed(
  () => splitPackageDraftLines(packageDraftForm.stepsText).length,
);

const packageDraftEvidenceCount = computed(
  () => splitPackageDraftLines(packageDraftForm.evidenceText).length,
);

const packageDraftRubricCount = computed(
  () => splitPackageDraftLines(packageDraftForm.rubricText).length,
);

const packageDraftValidation = computed(() => {
  const order = selectedOrder.value;
  if (!order?.selectedDecision) return "先选择教师复核决定";
  if (!packageDraftForm.objective.trim()) return "请补齐任务目标";
  if (packageDraftStepCount.value < 3) return "至少保留 3 个学生执行步骤";
  if (packageDraftEvidenceCount.value < 2) return "至少列出 2 类提交证据";
  if (packageDraftRubricCount.value < 2) return "至少列出 2 个教师验收点";
  return "";
});

const canPublishPackage = computed(() => {
  const order = selectedOrder.value;
  return Boolean(
    order &&
      order.selectedDecision &&
      !order.interventionPackage &&
      order.status !== "closed" &&
      !saving.value &&
      !packageDraftValidation.value,
  );
});

const canGenerateAiScaffold = computed(() => {
  const order = selectedOrder.value;
  return Boolean(
    order &&
      order.selectedDecision &&
      !order.interventionPackage &&
      order.status !== "closed" &&
      !saving.value &&
      !aiScaffoldLoading.value,
  );
});

function buildPackageDraftPayload(): InterventionPackageDraft {
  return {
    title: packageDraftForm.title,
    objective: packageDraftForm.objective,
    safeBoundary: packageDraftForm.safeBoundary,
    steps: splitPackageDraftLines(packageDraftForm.stepsText),
    evidenceToSubmit: splitPackageDraftLines(packageDraftForm.evidenceText),
    rubricCheckpoints: splitPackageDraftLines(packageDraftForm.rubricText),
    dueHint: packageDraftForm.dueHint,
    teacherNote:
      teacherNote.value ||
      "发布可执行任务包：只给检查清单、最小失败用例和反思要求，不给完整答案。",
  };
}

function applyAiScaffoldDraft(result: AiScaffoldDraftResult) {
  const draft = result.draft;
  Object.assign(packageDraftForm, {
    title: draft.title || packageDraftForm.title,
    objective: draft.objective || packageDraftForm.objective,
    safeBoundary: draft.safeBoundary || packageDraftForm.safeBoundary,
    dueHint: draft.dueHint || packageDraftForm.dueHint,
    stepsText: joinPackageDraftLines(
      draft.steps?.length ? draft.steps : splitPackageDraftLines(packageDraftForm.stepsText),
    ),
    evidenceText: joinPackageDraftLines(
      draft.evidenceToSubmit?.length
        ? draft.evidenceToSubmit
        : splitPackageDraftLines(packageDraftForm.evidenceText),
    ),
    rubricText: joinPackageDraftLines(
      draft.rubricCheckpoints?.length
        ? draft.rubricCheckpoints
        : splitPackageDraftLines(packageDraftForm.rubricText),
    ),
  });
  if (draft.teacherNote) {
    teacherNote.value = draft.teacherNote;
  }
  packageDraftTouched.value = true;
  packageDraftSourceKey.value = `${selectedOrder.value?.id ?? "order"}:agent:${result.traceId}`;
}

function applyConversationDraft(selection: AgentDraftSelection & { workOrderId: string }) {
  if (selection.workOrderId !== selectedOrder.value?.id) return;
  const draft = selection.draft;
  Object.assign(packageDraftForm, {
    title: draft.title || "学习任务", objective: draft.objective || "",
    safeBoundary: draft.safeBoundary || "", dueHint: draft.dueHint || "",
    stepsText: joinPackageDraftLines(draft.steps || []),
    evidenceText: joinPackageDraftLines(draft.evidenceToSubmit || []),
    rubricText: joinPackageDraftLines(draft.rubricCheckpoints || []),
  });
  packageDraftTouched.value = true;
  packageDraftSourceKey.value = `${selection.workOrderId}:conversation:${selection.turnId}`;
  agentDrawerOpen.value = false;
  ElMessage.success("建议已转为可编辑任务草稿，尚未发布。");
  setTimeout(() => document.querySelector('[data-testid="package-draft-editor"]')?.scrollIntoView({ behavior: "smooth", block: "start" }), 200);
}

async function handleGenerateAiScaffoldDraft() {
  const order = selectedOrder.value;
  if (!order) return;
  if (!order.selectedDecision) {
    ElMessage.warning("请先选择教师复核决定，再生成学生任务包草稿。");
    return;
  }
  aiScaffoldLoading.value = true;
  aiScaffoldStatus.value = "正在请求智能体网关";
  try {
    const result = await generateAiScaffoldDraft(order, {
      llmGatewayBaseUrl: courseConfig.llmGatewayBaseUrl,
    });
    applyAiScaffoldDraft(result);
    aiScaffoldStatus.value = result.fallback
      ? `已生成安全兜底草稿：${result.reason ?? "模型网关未返回"}`
      : "模型网关已返回候选草稿";
    if (result.fallback) {
      ElMessage.warning("已使用安全兜底草稿；配置模型密钥后会切换为真实模型网关。");
    } else {
      ElMessage.success("智能体候选草稿已生成，请教师复核后发布。");
    }
  } catch (error) {
    aiScaffoldStatus.value = "智能体网关请求失败";
    ElMessage.error(error instanceof Error ? error.message : "智能体草稿生成失败");
  } finally {
    aiScaffoldLoading.value = false;
  }
}

watch(
  () => ({
    id: selectedOrder.value?.id ?? "",
    decision: selectedOrder.value?.selectedDecision ?? "",
    packageId: selectedOrder.value?.interventionPackage?.id ?? "",
  }),
  () => syncPackageDraftFromOrder(selectedOrder.value),
  { immediate: true },
);

const selectedValueSnapshot = computed(
  () => selectedOrder.value?.valueAddedSnapshot ?? null,
);

const studentInterventionPackage = computed(
  () => studentOrder.value?.interventionPackage ?? null,
);

const studentEvidenceChecklist = computed(() => [
  {
    key: "failureSymptom",
    label: "失败现象",
    ready: studentEvidenceForm.failureSymptom.trim().length >= 12,
    hint: "说明在哪个接口、输入或场景下失败。",
  },
  {
    key: "minimalCase",
    label: "最小失败用例",
    ready: studentEvidenceForm.minimalCase.trim().length >= 12,
    hint: "写出能复现问题的最小请求、断言或测试片段。",
  },
  {
    key: "verificationRecord",
    label: "修复验证",
    ready: studentEvidenceForm.verificationRecord.trim().length >= 12,
    hint: "说明 CI、本地测试或 PR 复核的结果。",
  },
  {
    key: "integrity",
    label: "安全确认",
    ready: studentEvidenceIntegrityChecked.value,
    hint: "确认提交的是证据，不是可直接抄交的完整答案。",
  },
]);

const studentEvidenceReadyCount = computed(
  () => studentEvidenceChecklist.value.filter((item) => item.ready).length,
);

const studentStructuredEvidenceReady = computed(
  () => studentEvidenceReadyCount.value === studentEvidenceChecklist.value.length,
);

const studentEvidenceProgressText = computed(
  () => `${studentEvidenceReadyCount.value}/${studentEvidenceChecklist.value.length} 项已就绪`,
);

const studentReflectionReady = computed(() => studentReflectionText.value.trim().length >= 24);

const visibleEvidence = computed<EvidenceEvent[]>(() => {
  const order = selectedOrder.value;
  if (!order) return [];
  return [...order.collectedEvidence, ...order.missingEvidence].slice(0, 4);
});

const completedReturnCount = computed(
  () => returnSteps.filter((step) => Boolean(currentReturnState.value[step.key])).length,
);

const returnRoundLabel = computed(() =>
  currentReturnState.value.revision
    ? `第 ${(currentReturnState.value.revision ?? 0) + 1} 轮补证据`
    : "首轮回流",
);

const remainingReturnTaskText = computed(() => {
  const pending = returnSteps
    .filter((step) => !currentReturnState.value[step.key])
    .map((step) => step.title);
  return pending.length ? pending.join("、") : "等待教师验收";
});

const hasReturnGuidance = computed(
  () => Boolean(currentReturnState.value.returnReason) && selectedOrder.value?.status !== "closed",
);

const readyForTeacherClosure = computed(() => {
  const order = selectedOrder.value;
  return Boolean(order && order.status !== "closed" && completedReturnCount.value === 3);
});

function isStudentEvidenceReturnEntry(entry: EvidenceLedgerEntry) {
  return (
    entry.type === "student_return" &&
    (entry.title.includes("补充关键证据") ||
      entry.detail.includes("失败现象") ||
      entry.detail.includes("最小失败用例"))
  );
}

function extractStructuredLedgerValue(detail: string, label: string) {
  const text = String(detail || "");
  const markers = [`${label}：`, `${label}:`];
  for (const segment of text.split(/[；;\n]/)) {
    const marker = markers.find((item) => segment.includes(item));
    if (marker) {
      return segment.slice(segment.indexOf(marker) + marker.length).trim();
    }
  }
  const fallbackMarker = markers.find((item) => text.includes(item));
  if (!fallbackMarker) return "";
  const tail = text.slice(text.indexOf(fallbackMarker) + fallbackMarker.length);
  return tail.split(/[；;\n]/)[0]?.trim() ?? "";
}

const latestStudentEvidenceEntry = computed(() =>
  selectedLedger.value.find(isStudentEvidenceReturnEntry) ?? null,
);

const teacherEvidenceReviewTraceId = computed(() =>
  latestStudentEvidenceEntry.value
    ? `teacher-evidence-review-${latestStudentEvidenceEntry.value.id}`
    : "",
);

const savedTeacherEvidenceReviewEntry = computed(() =>
  teacherEvidenceReviewTraceId.value
    ? selectedLedger.value.find(
        (entry) =>
          entry.type === "teacher_evidence_review" &&
          entry.traceId === teacherEvidenceReviewTraceId.value,
      ) ?? null
    : null,
);

const teacherEvidenceReviewItems = computed(() => {
  const entry = latestStudentEvidenceEntry.value;
  if (!entry) return [];
  const structured = structuredStudentEvidenceKeys
    .map((item) => ({
      ...item,
      key: String(item.key),
      value: extractStructuredLedgerValue(entry.detail, item.label),
    }))
    .filter((item) => item.required || item.value);
  if (structured.some((item) => item.value)) {
    return structured.map((item) => ({
      ...item,
      value: item.value || "未在学生回流账本中找到该项，请退回补证据。",
    }));
  }
  return [
    {
      key: "legacyEvidence",
      label: "学生回流说明",
      required: true,
      value: entry.detail,
    },
  ];
});

function savedTeacherEvidenceReviewStatus(label: string): TeacherEvidenceReviewDraftStatus {
  const detail = savedTeacherEvidenceReviewEntry.value?.detail ?? "";
  const matched = teacherEvidenceReviewOptions.find((option) =>
    detail.includes(`${label}=${teacherEvidenceReviewStatusLabels[option.id]}`),
  );
  return matched?.id ?? "";
}

function teacherEvidenceReviewStatus(item: {
  key: string;
  label: string;
}): TeacherEvidenceReviewDraftStatus {
  return teacherEvidenceReviewStatuses[item.key] || savedTeacherEvidenceReviewStatus(item.label);
}

const teacherEvidenceReviewReviewedCount = computed(
  () => teacherEvidenceReviewItems.value.filter((item) => teacherEvidenceReviewStatus(item)).length,
);

const teacherEvidenceReviewPendingCount = computed(() =>
  Math.max(0, teacherEvidenceReviewItems.value.length - teacherEvidenceReviewReviewedCount.value),
);

const teacherEvidenceReviewBlockingCount = computed(
  () =>
    teacherEvidenceReviewItems.value.filter((item) => {
      const status = teacherEvidenceReviewStatus(item);
      return (
        !status ||
        status === "needs_evidence" ||
        status === "rejected" ||
        (item.required && item.value.includes("未在学生回流账本中找到该项"))
      );
    }).length,
);

const teacherEvidenceReviewHasUnsavedDraft = computed(
  () =>
    Object.values(teacherEvidenceReviewStatuses).some(Boolean) ||
    teacherEvidenceReviewNote.value.trim().length > 0,
);

const teacherEvidenceReviewSaved = computed(() => Boolean(savedTeacherEvidenceReviewEntry.value));

const teacherEvidenceReviewReadyForClosure = computed(() => {
  if (!readyForTeacherClosure.value) return false;
  if (teacherEvidenceReviewItems.value.length === 0) return false;
  if (!teacherEvidenceReviewSaved.value) return false;
  if (teacherEvidenceReviewHasUnsavedDraft.value) return false;
  return teacherEvidenceReviewPendingCount.value === 0 && teacherEvidenceReviewBlockingCount.value === 0;
});

const teacherEvidenceReviewProgressText = computed(
  () =>
    `${teacherEvidenceReviewReviewedCount.value}/${teacherEvidenceReviewItems.value.length || 0} 项已复核`,
);

const teacherEvidenceReviewBlockerText = computed(() => {
  if (!readyForTeacherClosure.value) return "等待学生完成三步回流";
  if (!latestStudentEvidenceEntry.value) return "缺少学生补证据记录";
  if (teacherEvidenceReviewPendingCount.value > 0) {
    return `还有 ${teacherEvidenceReviewPendingCount.value} 个证据项未复核`;
  }
  if (teacherEvidenceReviewBlockingCount.value > 0) {
    return "仍有证据被标记为待补或不采用";
  }
  if (teacherEvidenceReviewHasUnsavedDraft.value) return "请先保存当前证据复核";
  if (!teacherEvidenceReviewSaved.value) return "请先保存证据复核记录";
  return "证据复核通过，可以验收";
});

function resetTeacherEvidenceReviewDraft() {
  Object.keys(teacherEvidenceReviewStatuses).forEach((key) => {
    delete teacherEvidenceReviewStatuses[key];
  });
  teacherEvidenceReviewNote.value = "";
}

watch(
  () => `${selectedOrder.value?.id ?? ""}:${latestStudentEvidenceEntry.value?.id ?? ""}`,
  resetTeacherEvidenceReviewDraft,
);

const currentStageIndex = computed(() => {
  const order = selectedOrder.value;
  if (!order) return 0;
  const processIndex = order.stages.findIndex((stage) => stage.state === "process");
  if (order.status === "closed") return order.stages.length - 1;
  return Math.max(0, processIndex);
});

const stagePercent = computed(() => {
  const order = selectedOrder.value;
  if (!order) return 0;
  return Math.round(((currentStageIndex.value + 1) / order.stages.length) * 100);
});

const queueSummary = computed(() => {
  const orders = workOrders.value;
  return {
    total: orders.length,
    high: orders.filter((item) => item.risk === "high").length,
    open: orders.filter((item) => item.status !== "closed").length,
  };
});

const openWorkOrders = computed(() =>
  workOrders.value.filter((order) => order.status !== "closed"),
);

const courseAverageCoverage = computed(() => {
  const orders = openWorkOrders.value;
  if (orders.length === 0) return 0;
  return Math.round(
    orders.reduce((sum, order) => sum + order.evidenceCoverage, 0) / orders.length,
  );
});

function returnDoneCount(orderId: string) {
  const state = snapshot.value?.studentReturn[orderId];
  if (!state) return 0;
  return returnSteps.filter((step) => Boolean(state[step.key])).length;
}

const courseReviewGateLabels: Record<CourseReviewGateStatus, string> = {
  not_ready: "未回流",
  pending_review: "待复核",
  accepted: "可验收",
  needs_evidence: "需补证",
  rejected: "不采用",
};

const courseReviewGateActions: Record<CourseReviewGateStatus, string> = {
  not_ready: "继续等待学生补证据",
  pending_review: "先逐项采信学生证据",
  accepted: "可进入教师验收",
  needs_evidence: "退回补证据并说明缺口",
  rejected: "转人工会谈或重新布置证据",
};

const courseReviewGateSort: Record<CourseReviewGateStatus, number> = {
  pending_review: 0,
  needs_evidence: 1,
  rejected: 2,
  accepted: 3,
  not_ready: 4,
};

function latestStudentEvidenceEntryFor(orderId: string) {
  return (snapshot.value?.ledger[orderId] ?? []).find(isStudentEvidenceReturnEntry) ?? null;
}

function teacherEvidenceReviewEntryFor(orderId: string) {
  const sourceEntry = latestStudentEvidenceEntryFor(orderId);
  if (!sourceEntry) return null;
  return (
    (snapshot.value?.ledger[orderId] ?? []).find(
      (entry) =>
        entry.type === "teacher_evidence_review" &&
        entry.traceId === `teacher-evidence-review-${sourceEntry.id}`,
    ) ?? null
  );
}

function teacherEvidenceReviewGateFor(order: LearningWorkOrder): CourseReviewGateStatus {
  if (order.status === "closed") return "accepted";
  if (returnDoneCount(order.id) < returnSteps.length) return "not_ready";
  if (!latestStudentEvidenceEntryFor(order.id)) return "not_ready";
  const review = teacherEvidenceReviewEntryFor(order.id);
  if (!review) return "pending_review";
  if (review.detail.includes("不采用")) return "rejected";
  if (review.detail.includes("待补")) return "needs_evidence";
  if (review.title.includes("可进入验收")) return "accepted";
  return "pending_review";
}

function courseOpsAction(order: LearningWorkOrder) {
  if (order.status === "review" && returnDoneCount(order.id) === returnSteps.length) {
    return courseReviewGateActions[teacherEvidenceReviewGateFor(order)];
  }
  if (order.status === "review") return "查看学生回流证据";
  if (!order.selectedDecision) return "先完成教师复核";
  if (!order.interventionPackage) return "发布教师确认任务包";
  if (order.status === "intervention" || order.status === "evidence") return "跟进学生补证据";
  if (order.status === "guardrail") return "确认安全边界";
  return "进入单张诊断单";
}

function courseOpsScore(order: LearningWorkOrder) {
  const riskScore: Record<RiskLevel, number> = { high: 62, medium: 38, low: 16 };
  const statusScore: Record<WorkOrderStatus, number> = {
    diagnosis: 32,
    evidence: 26,
    guardrail: 24,
    intervention: 22,
    review: 44,
    closed: 0,
  };
  const coverageGap = Math.max(0, 70 - order.evidenceCoverage);
  const valueGap = order.valueAdded.delta < 0 ? Math.abs(order.valueAdded.delta) * 4 : 0;
  const reviewGate = teacherEvidenceReviewGateFor(order);
  const reviewGateScore =
    reviewGate === "pending_review"
      ? 36
      : reviewGate === "needs_evidence" || reviewGate === "rejected"
        ? 30
        : reviewGate === "accepted"
          ? 24
          : 0;
  return (
    riskScore[order.risk] +
    statusScore[order.status] +
    coverageGap +
    valueGap +
    order.missingEvidence.length * 7 +
    reviewGateScore
  );
}

const courseOpsMetrics = computed<CourseOpsMetric[]>(() => {
  const orders = workOrders.value;
  const open = openWorkOrders.value;
  const awaitingReview = open.filter(
    (order) => teacherEvidenceReviewGateFor(order) === "pending_review",
  ).length;
  const missingCount = open.reduce((sum, order) => sum + order.missingEvidence.length, 0);
  return [
    {
      label: "打开工单",
      value: String(open.length),
      hint: `${orders.length} 张诊断单中仍需跟进`,
      tone: open.length > 0 ? "blue" : "green",
    },
    {
      label: "高风险",
      value: String(open.filter((order) => order.risk === "high").length),
      hint: "按教师待办优先处理，不用于学生排名",
      tone: open.some((order) => order.risk === "high") ? "red" : "green",
    },
    {
      label: "平均证据覆盖",
      value: `${courseAverageCoverage.value}%`,
      hint: "低于 70% 时保持待补证和不确定",
      tone: courseAverageCoverage.value >= 70 ? "green" : "amber",
    },
    {
      label: "待教师动作",
      value: String(awaitingReview + missingCount),
      hint: `${awaitingReview} 张待证据复核，${missingCount} 个证据缺口`,
      tone: awaitingReview + missingCount > 0 ? "amber" : "green",
    },
  ];
});

const courseReviewGateItems = computed<CourseReviewGateItem[]>(() =>
  openWorkOrders.value
    .map((order) => {
      const gate = teacherEvidenceReviewGateFor(order);
      const review = teacherEvidenceReviewEntryFor(order.id);
      return {
        id: order.id,
        studentName: order.studentName,
        studentNo: order.studentNo,
        focus: order.valueAdded.label,
        risk: order.risk,
        stage: statusLabels[order.status],
        returnDone: returnDoneCount(order.id),
        evidenceCoverage: order.evidenceCoverage,
        gate,
        gateLabel: courseReviewGateLabels[gate],
        action: courseReviewGateActions[gate],
        reviewedAt: review?.time ?? "",
      };
    })
    .filter((item) => item.gate !== "not_ready" || item.returnDone > 0)
    .sort((a, b) => {
      const gateDelta = courseReviewGateSort[a.gate] - courseReviewGateSort[b.gate];
      if (gateDelta !== 0) return gateDelta;
      if (a.risk !== b.risk) {
        const riskWeight: Record<RiskLevel, number> = { high: 0, medium: 1, low: 2 };
        return riskWeight[a.risk] - riskWeight[b.risk];
      }
      return b.evidenceCoverage - a.evidenceCoverage;
    })
    .slice(0, 6),
);

const courseReviewGateMetrics = computed<CourseReviewGateMetric[]>(() => {
  const gates = openWorkOrders.value.map((order) => teacherEvidenceReviewGateFor(order));
  const pending = gates.filter((gate) => gate === "pending_review").length;
  const accepted = gates.filter((gate) => gate === "accepted").length;
  const blocked = gates.filter((gate) => gate === "needs_evidence" || gate === "rejected").length;
  const snapshots = workOrders.value.filter((order) => Boolean(order.valueAddedSnapshot)).length;
  return [
    {
      label: "待证据复核",
      value: String(pending),
      hint: "学生已回流，教师尚未逐项采信",
      tone: pending > 0 ? "amber" : "green",
    },
    {
      label: "可验收",
      value: String(accepted),
      hint: "最新学生证据已全部可采信",
      tone: accepted > 0 ? "blue" : "green",
    },
    {
      label: "需补证",
      value: String(blocked),
      hint: "复核后仍需退回或人工确认",
      tone: blocked > 0 ? "red" : "green",
    },
    {
      label: "已沉淀快照",
      value: String(snapshots),
      hint: "仅来自教师验收通过的闭环",
      tone: snapshots > 0 ? "green" : "blue",
    },
  ];
});

const courseReviewGateSummaryText = computed(() => {
  const pending = courseReviewGateMetrics.value.find((item) => item.label === "待证据复核")?.value ?? "0";
  const accepted = courseReviewGateMetrics.value.find((item) => item.label === "可验收")?.value ?? "0";
  const blocked = courseReviewGateMetrics.value.find((item) => item.label === "需补证")?.value ?? "0";
  return `${pending} 待复核 / ${accepted} 可验收 / ${blocked} 需补证`;
});

const courseInterventionReviewRows = computed<CourseInterventionReviewRow[]>(() => {
  const current = snapshot.value;
  if (!current) return [];
  const groups = new Map<
    string,
    {
      traceId: string;
      title: string;
      time: string;
      orderIds: Set<string>;
      orders: LearningWorkOrder[];
    }
  >();

  current.workOrders.forEach((order) => {
    (current.ledger[order.id] ?? [])
      .filter((entry) => entry.type === "course_micro_task" && Boolean(entry.traceId))
      .forEach((entry) => {
        const traceId = entry.traceId ?? `course-micro-task-${entry.id}`;
        const group =
          groups.get(traceId) ??
          {
            traceId,
            title: entry.title,
            time: entry.time,
            orderIds: new Set<string>(),
            orders: [],
          };
        if (!group.orderIds.has(order.id)) {
          group.orderIds.add(order.id);
          group.orders.push(order);
        }
        if (entry.time > group.time) {
          group.time = entry.time;
          group.title = entry.title;
        }
        groups.set(traceId, group);
      });
  });

  return Array.from(groups.values())
    .map((group) => {
      const orders = group.orders;
      const focusCounts = new Map<string, number>();
      orders.forEach((order) => {
        focusCounts.set(order.valueAdded.label, (focusCounts.get(order.valueAdded.label) ?? 0) + 1);
      });
      const focus =
        Array.from(focusCounts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"))[0]?.[0] ??
        "共同证据缺口";
      const sortedOrders = [...orders].sort((a, b) => courseOpsScore(b) - courseOpsScore(a));
      const returnedCount = orders.filter((order) => returnDoneCount(order.id) > 0).length;
      const completedCount = orders.filter((order) => returnDoneCount(order.id) === returnSteps.length).length;
      const acceptedReviewCount = orders.filter(
        (order) => teacherEvidenceReviewGateFor(order) === "accepted",
      ).length;
      const blockedReviewCount = orders.filter((order) =>
        ["needs_evidence", "rejected"].includes(teacherEvidenceReviewGateFor(order)),
      ).length;
      const snapshotCount = orders.filter((order) => Boolean(order.valueAddedSnapshot)).length;
      const averageCoverage = Math.round(
        orders.reduce((sum, order) => sum + order.evidenceCoverage, 0) / Math.max(1, orders.length),
      );
      const effectLabel =
        snapshotCount > 0
          ? "已沉淀增值快照"
          : acceptedReviewCount > 0
            ? "教师可验收"
            : blockedReviewCount > 0
              ? "需补证再复盘"
              : completedCount > 0
                ? "待教师复核"
                : returnedCount > 0
                  ? "回流进行中"
                  : "等待学生领取";
      const action =
        snapshotCount > 0
          ? "沉淀为课程样本，进入下一轮教学资源调整"
          : blockedReviewCount > 0
            ? "退回缺口学生补齐证据，不生成终局结论"
            : completedCount > acceptedReviewCount
              ? "优先打开已完成回流的学生，逐项复核证据"
              : returnedCount > 0
                ? "提醒学生补齐 3 步回流，再进入复核"
                : "提醒目标学生领取任务并提交最小证据包";

      return {
        id: group.traceId.replace(/[^a-zA-Z0-9-]/g, "-"),
        traceId: group.traceId,
        title: group.title,
        focus,
        firstOrderId: sortedOrders[0]?.id ?? orders[0]?.id ?? "",
        targetWorkOrderIds: orders.map((order) => order.id),
        targetCount: orders.length,
        returnedCount,
        completedCount,
        acceptedReviewCount,
        blockedReviewCount,
        snapshotCount,
        averageCoverage,
        effectLabel,
        action,
      };
    })
    .sort(
      (a, b) =>
        b.snapshotCount - a.snapshotCount ||
        b.acceptedReviewCount - a.acceptedReviewCount ||
        b.completedCount - a.completedCount ||
        b.returnedCount - a.returnedCount ||
        b.averageCoverage - a.averageCoverage,
    )
    .slice(0, 6);
});

const courseInterventionReviewMetrics = computed<CourseInterventionReviewMetric[]>(() => {
  const rows = courseInterventionReviewRows.value;
  const targets = rows.reduce((sum, row) => sum + row.targetCount, 0);
  const returned = rows.reduce((sum, row) => sum + row.returnedCount, 0);
  const accepted = rows.reduce((sum, row) => sum + row.acceptedReviewCount, 0);
  const blocked = rows.reduce((sum, row) => sum + row.blockedReviewCount, 0);
  const snapshots = rows.reduce((sum, row) => sum + row.snapshotCount, 0);
  return [
    {
      label: "已发布干预",
      value: String(rows.length),
      hint: "只统计已写入证据账本的课堂微任务",
      tone: rows.length > 0 ? "blue" : "amber",
    },
    {
      label: "学生回流",
      value: `${returned}/${targets}`,
      hint: "按任务批次统计回流人次",
      tone: returned >= targets && targets > 0 ? "green" : "amber",
    },
    {
      label: "复核可验收",
      value: String(accepted),
      hint: `${blocked} 人次仍需补证或人工确认`,
      tone: blocked > 0 ? "red" : accepted > 0 ? "green" : "blue",
    },
    {
      label: "增值快照",
      value: String(snapshots),
      hint: "只来自教师验收通过后的沉淀",
      tone: snapshots > 0 ? "green" : "blue",
    },
  ];
});

const courseInterventionReviewSummaryText = computed(() => {
  const rows = courseInterventionReviewRows.value;
  const returned = rows.reduce((sum, row) => sum + row.returnedCount, 0);
  const snapshots = rows.reduce((sum, row) => sum + row.snapshotCount, 0);
  return `${rows.length} 批 / ${returned} 人次回流 / ${snapshots} 快照`;
});

function shortStableId(input: string) {
  let hash = 2166136261;
  for (const char of input) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

const courseTeachingImprovementItems = computed<CourseTeachingImprovementItem[]>(() => {
  if (courseInterventionReviewRows.value.length > 0) {
    return courseInterventionReviewRows.value.slice(0, 4).map((row, index) => {
      const needsReturn = row.returnedCount < row.targetCount;
      const needsReview = row.completedCount > row.acceptedReviewCount;
      const needsEvidence = row.blockedReviewCount > 0;
      const priority = needsEvidence || needsReturn ? "high" : needsReview ? "medium" : "low";
      const action = needsEvidence
        ? `下节课前安排“${row.focus}”证据补齐站会，要求学生补最小失败用例和 CI 重跑记录。`
        : needsReturn
          ? `课前 24 小时提醒未回流学生领取任务，课堂只讲检查路径，不给完整实现。`
          : needsReview
            ? `优先完成已回流学生的逐项证据复核，再决定是否进入验收。`
            : `把已采信样本整理成“失败路径 -> 修复证据 -> 反思”的课堂案例。`;
      return {
        id: `improve-${row.id}-${index + 1}`,
        sourceTraceId: row.traceId,
        focus: row.focus,
        issue: `${row.title} 后，${row.returnedCount}/${row.targetCount} 人次回流，${row.acceptedReviewCount} 人次可验收，${row.blockedReviewCount} 人次仍需补证，已沉淀 ${row.snapshotCount} 个增值快照。`,
        action,
        acceptanceEvidence: ["最小失败用例", "CI 重跑或本地测试摘要", "教师证据复核记录", "学生反思摘要"],
        targetWorkOrderIds: row.targetWorkOrderIds,
        priority,
      };
    });
  }

  return courseEvidenceGaps.value.slice(0, 3).map((gap, index) => {
    const targetIds = openWorkOrders.value
      .filter((order) => order.missingEvidence.some((item) => item.title === gap.title))
      .map((order) => order.id);
    return {
      id: `improve-gap-${shortStableId(`${gap.title}:${gap.source}`)}`,
      sourceTraceId: `evidence-gap-${shortStableId(gap.title)}`,
      focus: gap.title,
      issue: `${gap.count} 名学生反复缺少“${gap.title}”，当前只能形成待补证诊断，不能进入增值结论。`,
      action: `${gap.action}；教师在下次实验课统一给出检查清单和提交口径，不直接提供完整答案。`,
      acceptanceEvidence: ["补齐后的证据条目", "教师采信记录", "课堂任务完成记录"],
      targetWorkOrderIds: targetIds,
      priority: index === 0 ? "high" : "medium",
    };
  });
});

const courseTeachingImprovementPlan = computed<CourseTeachingImprovementPlan | null>(() => {
  const items = courseTeachingImprovementItems.value.filter(
    (item) => item.targetWorkOrderIds.length > 0,
  );
  if (items.length === 0) return null;
  const sourceSummary =
    courseInterventionReviewRows.value.length > 0
      ? `基于 ${courseInterventionReviewRows.value.length} 批课堂微任务复盘`
      : `基于 ${courseEvidenceGaps.value.length} 类共性证据缺口`;
  const generatedAt = new Date().toLocaleString("zh-CN", { hour12: false });
  const basis = items
    .map((item) => `${item.id}:${item.targetWorkOrderIds.join(",")}:${item.priority}`)
    .join("|");
  const planId = `teach-improve-${shortStableId(`${courseConfig.courseClass}:${basis}`)}`;
  const boundary = "只用于安排课程资源、案例复盘和补证据动作；不排名、不惩罚、不自动评价学生，不生成可直接提交的完整答案。";
  const markdown = [
    `# ${courseConfig.courseClass} 下轮教学改进单`,
    "",
    `课程任务：${courseConfig.courseName}`,
    `仓库：${courseConfig.repository}`,
    `生成依据：${sourceSummary}`,
    `生成时间：${generatedAt}`,
    "",
    `> 边界：${boundary}`,
    "",
    "## 改进动作",
    "",
    ...items.flatMap((item, index) => [
      `${index + 1}. 【${item.priority === "high" ? "高优先级" : item.priority === "medium" ? "中优先级" : "低优先级"}】${item.focus}`,
      `   - 问题：${item.issue}`,
      `   - 教师动作：${item.action}`,
      `   - 验收证据：${item.acceptanceEvidence.join("、")}`,
      `   - 关联诊断单：${item.targetWorkOrderIds.join("、")}`,
      "",
    ]),
    "## 使用口径",
    "",
    "- 先改课程资源与证据口径，再回到学生个人诊断单复核。",
    "- 学生补证据后仍需教师采信，不能由系统自动下结论。",
    "- 形成的增值快照用于教学复盘和资源推荐，不用于排名或惩罚。",
  ].join("\n");
  return {
    id: planId,
    product: "SE-Path 学伴",
    exportType: "course_teaching_improvement_plan",
    generatedAt,
    status: "draft",
    courseClass: courseConfig.courseClass,
    courseName: courseConfig.courseName,
    repository: courseConfig.repository,
    sourceSummary,
    items,
    boundary,
    markdown,
  };
});

const courseTeachingImprovementPublished = computed(() => {
  const current = snapshot.value;
  const plan = courseTeachingImprovementPlan.value;
  if (!current || !plan) return false;
  const traceId = `teaching-improvement-${plan.id}`;
  return plan.items
    .flatMap((item) => item.targetWorkOrderIds)
    .every((orderId) =>
      (current.ledger[orderId] ?? []).some(
        (entry) => entry.type === "teaching_improvement" && entry.traceId === traceId,
      ),
    );
});

const courseTeachingImprovementExecutionReceipt =
  computed<CourseTeachingImprovementExecutionReceipt | null>(() => {
    const plan = courseTeachingImprovementPlan.value;
    if (!plan) return null;
    const targetWorkOrderIds = Array.from(
      new Set(plan.items.flatMap((item) => item.targetWorkOrderIds).filter(Boolean)),
    );
    if (targetWorkOrderIds.length === 0) return null;
    const executedAt = new Date().toLocaleString("zh-CN", { hour12: false });
    const focus = plan.items[0]?.focus ?? "共性证据缺口";
    const evidence = Array.from(
      new Set([
        "课堂证据站点记录",
        "资源版本变更说明",
        ...plan.items.flatMap((item) => item.acceptanceEvidence),
        "教师抽样复核记录",
      ]),
    ).slice(0, 6);
    const classSession = `${courseConfig.courseClass} 下轮实验课`;
    const boundary =
      "执行回证只证明教师已完成课程改进动作，不自动评价学生、不排名、不惩罚，不生成可直接提交答案。";
    const summary = `围绕“${focus}”完成下轮课堂证据站点、资源口径和复核路径调整，继续等待学生补证据与教师采信。`;
    const receiptId = `teach-exec-${shortStableId(`${plan.id}:${targetWorkOrderIds.join(",")}`)}`;
    const markdown = [
      `# ${courseConfig.courseClass} 下轮课堂执行回证`,
      "",
      `课程任务：${courseConfig.courseName}`,
      `仓库：${courseConfig.repository}`,
      `关联改进单：${plan.id}`,
      `执行课次：${classSession}`,
      `登记时间：${executedAt}`,
      `登记人：任课教师`,
      "",
      `> 边界：${boundary}`,
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
      "",
      "## 后续处理",
      "",
      "- 学生补证据后进入教师采信，不由系统自动给结论。",
      "- 课程层面的资源调整可回流到下一轮任务配置。",
      "- 增值评价只做形成性改进依据，不用于排名、惩罚或高风险决策。",
    ].join("\n");
    return {
      id: receiptId,
      product: "SE-Path 学伴",
      exportType: "course_teaching_improvement_execution_receipt",
      planId: plan.id,
      executedAt,
      executedBy: "任课教师",
      courseClass: courseConfig.courseClass,
      courseName: courseConfig.courseName,
      repository: courseConfig.repository,
      classSession,
      summary,
      evidence,
      targetWorkOrderIds,
      boundary,
      markdown,
    };
  });

const courseTeachingImprovementExecutionDone = computed(() => {
  const current = snapshot.value;
  const receipt = courseTeachingImprovementExecutionReceipt.value;
  if (!current || !receipt) return false;
  const traceId = `teaching-improvement-execution-${receipt.planId || receipt.id}`;
  return receipt.targetWorkOrderIds.every((orderId) =>
    (current.ledger[orderId] ?? []).some(
      (entry) => entry.type === "teaching_improvement_execution" && entry.traceId === traceId,
    ),
  );
});

const courseTeachingImprovementFollowupSample =
  computed<CourseTeachingImprovementFollowupSample | null>(() => {
    const current = snapshot.value;
    const plan = courseTeachingImprovementPlan.value;
    const receipt = courseTeachingImprovementExecutionReceipt.value;
    if (!current || !plan || !receipt) return null;
    const targetWorkOrderIds = receipt.targetWorkOrderIds.filter(Boolean);
    const targetOrders = current.workOrders.filter((order) => targetWorkOrderIds.includes(order.id));
    if (targetOrders.length === 0) return null;

    const sampledAt = new Date().toLocaleString("zh-CN", { hour12: false });
    const avgCoverage = Math.round(
      targetOrders.reduce((sum, order) => sum + Number(order.evidenceCoverage || 0), 0) /
        targetOrders.length,
    );
    const pendingReturnCount = targetOrders.filter((order) => returnDoneCount(order.id) < 3).length;
    const pendingReviewCount = targetOrders.filter(
      (order) =>
        order.status === "review" &&
        !(current.ledger[order.id] ?? []).some(
          (entry) => entry.type === "teacher_evidence_review" && entry.detail.includes("可采信"),
        ),
    ).length;
    const missingEvidenceCount = targetOrders.reduce(
      (sum, order) => sum + order.missingEvidence.length,
      0,
    );
    const observationWindow = `${courseConfig.courseClass} 下轮课后 48 小时`;
    const boundary =
      "采样单只建立下一轮观察口径，不把一次课堂执行解释为因果效果，不自动评价学生、不排名、不惩罚。";
    const indicators = [
      {
        id: "return-completion",
        label: "补证据回流",
        before: `${pendingReturnCount}/${targetOrders.length} 张诊断单仍未完成三步回流`,
        expected: "下轮课后每张目标诊断单至少补齐 1 条可复核证据",
        evidence: "学生结构化补证据表单、PR/CI 链接、反思摘要",
        interpretation: "若仍未回流，进入教师催办或人工会谈，不给低证据增值结论。",
        status: pendingReturnCount > 0 ? "watch" : "improved",
      },
      {
        id: "evidence-coverage",
        label: "测试与 CI 证据覆盖",
        before: `当前目标工单平均证据覆盖 ${avgCoverage}%`,
        expected: "补齐最小失败用例和 CI 重跑摘要后，证据覆盖提升到 70% 以上",
        evidence: "CI 重跑摘要、最小失败用例、测试覆盖片段",
        interpretation: "只看新增证据是否支持诊断，不直接判断代码能力高低。",
        status: avgCoverage >= 70 ? "improved" : "watch",
      },
      {
        id: "review-load",
        label: "教师复核负担",
        before: `${pendingReviewCount} 张诊断单等待复核，${missingEvidenceCount} 条证据仍缺口`,
        expected: "需人工追问的问题减少，教师能按同一证据口径完成采信",
        evidence: "教师证据复核记录、退回补证据原因、验收备注",
        interpretation: "复核负担下降只能作为教学流程改进线索，不能作为学生排名依据。",
        status: pendingReviewCount > 0 || missingEvidenceCount > 0 ? "needs_more_evidence" : "watch",
      },
    ] as CourseTeachingImprovementFollowupSample["indicators"];
    const summary = `围绕“${plan.items[0]?.focus ?? "共性薄弱能力"}”建立下轮效果采样口径，观察目标诊断单在补证据、测试覆盖和教师复核上的变化。`;
    const sampleId = `teach-followup-${shortStableId(`${plan.id}:${targetWorkOrderIds.join(",")}`)}`;
    const markdown = [
      `# ${courseConfig.courseClass} 下轮效果采样单`,
      "",
      `课程任务：${courseConfig.courseName}`,
      `仓库：${courseConfig.repository}`,
      `关联改进单：${plan.id}`,
      `关联执行回证：${receipt.id}`,
      `观察窗口：${observationWindow}`,
      `登记时间：${sampledAt}`,
      `登记人：任课教师`,
      "",
      `> 边界：${boundary}`,
      "",
      "## 采样摘要",
      "",
      summary,
      "",
      "## 观察指标",
      "",
      ...indicators.flatMap((indicator, index) => [
        `${index + 1}. ${indicator.label}`,
        `   - 当前：${indicator.before}`,
        `   - 期望：${indicator.expected}`,
        `   - 证据：${indicator.evidence}`,
        `   - 解释：${indicator.interpretation}`,
        "",
      ]),
      "## 关联诊断单",
      "",
      ...targetWorkOrderIds.map((id) => `- ${id}`),
    ].join("\n");
    return {
      id: sampleId,
      product: "SE-Path 学伴",
      exportType: "course_teaching_improvement_followup_sample",
      planId: plan.id,
      receiptId: receipt.id,
      sampledAt,
      sampledBy: "任课教师",
      courseClass: courseConfig.courseClass,
      courseName: courseConfig.courseName,
      repository: courseConfig.repository,
      observationWindow,
      summary,
      indicators,
      targetWorkOrderIds,
      boundary,
      markdown,
    };
  });

const courseTeachingImprovementFollowupRecorded = computed(() => {
  const current = snapshot.value;
  const sample = courseTeachingImprovementFollowupSample.value;
  if (!current || !sample) return false;
  const traceId = `teaching-improvement-followup-${sample.planId || sample.id}`;
  return sample.targetWorkOrderIds.every((orderId) =>
    (current.ledger[orderId] ?? []).some(
      (entry) => entry.type === "teaching_improvement_followup" && entry.traceId === traceId,
    ),
  );
});

const courseTeachingImprovementFollowupSummaryText = computed(() => {
  const sample = courseTeachingImprovementFollowupSample.value;
  if (!sample) return "暂无采样单";
  if (!courseTeachingImprovementExecutionDone.value) return "待执行回证";
  if (courseTeachingImprovementFollowupRecorded.value) return "已登记采样";
  return `${sample.indicators.length} 个指标 / ${sample.targetWorkOrderIds.length} 张工单`;
});

const courseTeachingImprovementFollowupResult =
  computed<CourseTeachingImprovementFollowupResult | null>(() => {
    const current = snapshot.value;
    const sample = courseTeachingImprovementFollowupSample.value;
    if (!current || !sample || !courseTeachingImprovementFollowupRecorded.value) return null;
    const targetOrders = current.workOrders.filter((order) =>
      sample.targetWorkOrderIds.includes(order.id),
    );
    if (targetOrders.length === 0) return null;

    const collectedAt = new Date().toLocaleString("zh-CN", { hour12: false });
    const returnedCount = targetOrders.filter(
      (order) => returnDoneCount(order.id) === returnSteps.length,
    ).length;
    const acceptedReviewCount = targetOrders.filter(
      (order) => teacherEvidenceReviewGateFor(order) === "accepted",
    ).length;
    const needsEvidenceCount = targetOrders.filter((order) =>
      ["needs_evidence", "rejected", "not_ready"].includes(teacherEvidenceReviewGateFor(order)),
    ).length;
    const snapshotCount = targetOrders.filter((order) => Boolean(order.valueAddedSnapshot)).length;
    const avgCoverage = Math.round(
      targetOrders.reduce((sum, order) => sum + Number(order.evidenceCoverage || 0), 0) /
        targetOrders.length,
    );
    const findings = [
      {
        id: "return-completion-result",
        label: "补证据回流结果",
        expected: "每张目标诊断单至少补齐 1 条可复核证据",
        observed: `${returnedCount}/${targetOrders.length} 张诊断单完成三步回流`,
        evidence: "学生结构化补证据、反思记录、PR/CI 链接和教师复核状态",
        interpretation:
          returnedCount === targetOrders.length
            ? "目标学生已完成回流，可进入采信复核和形成性诊断更新。"
            : "仍有学生未完成回流，应先提醒或安排会谈，不生成低证据结论。",
        status:
          returnedCount === targetOrders.length
            ? "observed_improvement"
            : returnedCount > 0
              ? "no_clear_change"
              : "needs_more_evidence",
      },
      {
        id: "coverage-result",
        label: "测试与 CI 覆盖结果",
        expected: "补齐最小失败用例和 CI 重跑摘要后，证据覆盖达到 70% 以上",
        observed: `目标诊断单平均证据覆盖 ${avgCoverage}%`,
        evidence: "CI 重跑摘要、最小失败用例、测试覆盖片段和 PR 变更摘要",
        interpretation:
          avgCoverage >= 70
            ? "新增证据已能支撑下一步教师判断，但仍不等同于能力最终评价。"
            : "证据覆盖仍不足，建议继续补最小失败用例和边界路径说明。",
        status: avgCoverage >= 70 ? "observed_improvement" : "needs_more_evidence",
      },
      {
        id: "review-load-result",
        label: "教师复核负担结果",
        expected: "教师能按统一证据口径完成采信，减少逐个解释和反复追问",
        observed: `${acceptedReviewCount} 张可验收，${needsEvidenceCount} 张仍需补证，${snapshotCount} 张已沉淀快照`,
        evidence: "教师证据复核记录、退回补证据原因、增值快照和账本追踪号",
        interpretation:
          needsEvidenceCount === 0 && acceptedReviewCount > 0
            ? "流程负担已有下降迹象，可进入下一轮资源调整记录。"
            : "复核负担仍未完全下降，只能作为教学流程改进线索继续观察。",
        status:
          needsEvidenceCount === 0 && acceptedReviewCount > 0
            ? "observed_improvement"
            : acceptedReviewCount > 0
              ? "no_clear_change"
              : "needs_more_evidence",
      },
    ] as CourseTeachingImprovementFollowupResult["findings"];
    const summary = `已回收 ${sample.observationWindow} 的观察结果：${returnedCount}/${targetOrders.length} 张诊断单完成回流，平均证据覆盖 ${avgCoverage}%，${acceptedReviewCount} 张进入可验收复核。`;
    const nextAction =
      needsEvidenceCount > 0
        ? "继续提醒未回流或需补证据学生，下一轮只更新有新增证据支撑的形成性诊断。"
        : acceptedReviewCount < targetOrders.length
          ? "优先完成剩余教师复核，再决定是否沉淀为课程资源调整样本。"
          : "沉淀为课程资源调整样本，并进入下一轮诊断策略复核；不生成学生排名或惩罚。";
    const boundary =
      "采样结果只记录下一轮观察到的证据变化，不能证明单次教学措施的因果效果，不自动评价学生、不排名、不惩罚。";
    const resultId = `teach-followup-result-${shortStableId(
      `${sample.id}:${sample.targetWorkOrderIds.join(",")}`,
    )}`;
    const markdown = [
      `# ${courseConfig.courseClass} 采样结果回收单`,
      "",
      `课程任务：${courseConfig.courseName}`,
      `仓库：${courseConfig.repository}`,
      `关联改进单：${sample.planId}`,
      `关联执行回证：${sample.receiptId}`,
      `关联采样单：${sample.id}`,
      `观察窗口：${sample.observationWindow}`,
      `回收时间：${collectedAt}`,
      `回收人：任课教师`,
      "",
      `> 边界：${boundary}`,
      "",
      "## 回收摘要",
      "",
      summary,
      "",
      "## 观察结果",
      "",
      ...findings.flatMap((finding, index) => [
        `${index + 1}. ${finding.label}`,
        `   - 预期：${finding.expected}`,
        `   - 观察：${finding.observed}`,
        `   - 证据：${finding.evidence}`,
        `   - 解释：${finding.interpretation}`,
        "",
      ]),
      "## 下一步",
      "",
      nextAction,
      "",
      "## 关联诊断单",
      "",
      ...sample.targetWorkOrderIds.map((id) => `- ${id}`),
    ].join("\n");

    return {
      id: resultId,
      product: "SE-Path 学伴",
      exportType: "course_teaching_improvement_followup_result",
      planId: sample.planId,
      receiptId: sample.receiptId,
      sampleId: sample.id,
      collectedAt,
      collectedBy: "任课教师",
      courseClass: courseConfig.courseClass,
      courseName: courseConfig.courseName,
      repository: courseConfig.repository,
      observationWindow: sample.observationWindow,
      summary,
      findings,
      targetWorkOrderIds: sample.targetWorkOrderIds,
      nextAction,
      boundary,
      markdown,
    };
  });

const courseTeachingImprovementFollowupResultRecorded = computed(() => {
  const current = snapshot.value;
  const result = courseTeachingImprovementFollowupResult.value;
  if (!current || !result) return false;
  const traceId = `teaching-improvement-followup-result-${result.sampleId || result.id}`;
  return result.targetWorkOrderIds.every((orderId) =>
    (current.ledger[orderId] ?? []).some(
      (entry) =>
        entry.type === "teaching_improvement_followup_result" &&
        entry.traceId === traceId,
    ),
  );
});

const courseTeachingImprovementFollowupResultSummaryText = computed(() => {
  const result = courseTeachingImprovementFollowupResult.value;
  if (!result) return "待采样结果";
  if (courseTeachingImprovementFollowupResultRecorded.value) return "已回收入账";
  return `${result.findings.length} 项观察 / ${result.targetWorkOrderIds.length} 张工单`;
});

const courseResourceRevisionTicket = computed<CourseResourceRevisionTicket | null>(() => {
  const result = courseTeachingImprovementFollowupResult.value;
  const plan = courseTeachingImprovementPlan.value;
  if (!result || !plan || !courseTeachingImprovementFollowupResultRecorded.value) return null;
  const focus = plan.items[0]?.focus ?? selectedOrder.value?.valueAdded.label ?? "边界测试设计";
  const createdAt = new Date().toLocaleString("zh-CN", { hour12: false });
  const targetIds = result.targetWorkOrderIds.filter(Boolean);
  const versionTo = `v${createdAt.slice(0, 10).replaceAll("/", ".")}-evidence-loop`;
  const ticketId = `resource-revision-${shortStableId(`${result.id}:${targetIds.join(",")}`)}`;
  const needsEvidenceFinding =
    result.findings.find((finding) => finding.status === "needs_more_evidence") ??
    result.findings.find((finding) => finding.status === "no_clear_change") ??
    result.findings[0];
  const changes: CourseResourceRevisionTicket["changes"] = [
    {
      id: "minimum-case-library",
      area: "测试资源",
      title: "补齐最小失败用例库",
      reason:
        needsEvidenceFinding?.interpretation ??
        "采样结果显示学生仍需要把失败现象转成可复核的测试证据。",
      implementation:
        "新增空请求体、越界字段、无权限访问和异常状态码 4 组案例，每组只给输入、期望、证据口径，不给完整实现。",
      owner: "任课教师 / 助教",
      status: "ready",
    },
    {
      id: "pr-template-evidence",
      area: "仓库模板",
      title: "更新 PR 证据字段",
      reason: "采样结果需要稳定回收 CI 重跑、失败用例和反思摘要，否则教师复核成本仍高。",
      implementation:
        "在 PR 模板中固定“失败现象、最小复现、验证命令、仍不确定点、教师复核链接”字段。",
      owner: "课程仓库维护者",
      status: "needs_review",
    },
    {
      id: "rubric-checkpoint-sync",
      area: "Rubric 口径",
      title: "同步形成性验收检查点",
      reason: "把本轮采样看到的共性证据缺口回写到 Rubric，让下轮诊断先看证据充分性。",
      implementation:
        "将“边界条件覆盖、异常路径说明、CI 证据、反思质量”设为下轮形成性诊断检查点。",
      owner: "课程负责人",
      status: "ready",
    },
  ];
  const acceptanceChecks = [
    "资源改版记录必须能追溯到采样结果回收单和关联诊断单账本。",
    "案例库只给输入、期望、检查清单和证据口径，不生成可直接提交的完整答案。",
    "PR 模板改动必须通过一次教师抽样复核，并能导出证据包。",
    "改版效果只按下一轮新增证据观察，不作为学生排名、惩罚或自动评价依据。",
  ];
  const boundary =
    "课程资源改版只用于修正教学资源、证据口径和教师复核流程；不证明单次教学因果效果，不自动评价学生、不排名、不惩罚、不生成可直接提交的完整答案。";
  const reason = `根据“${result.observationWindow}”采样结果，将“${focus}”的共性证据缺口沉淀为课程资源改版，确保下一轮学生先提交可复核证据，再进入教师形成性诊断。`;
  const markdown = [
    `# ${courseConfig.courseClass} 课程资源改版工单`,
    "",
    `课程任务：${courseConfig.courseName}`,
    `仓库：${courseConfig.repository}`,
    `资源名称：${courseConfig.courseName} / REST API 边界测试资源包`,
    `版本：${"v2026.08.30"} -> ${versionTo}`,
    `关联采样结果：${result.id}`,
    `关联采样单：${result.sampleId}`,
    `创建时间：${createdAt}`,
    `创建人：任课教师`,
    "",
    `> 边界：${boundary}`,
    "",
    "## 改版原因",
    "",
    reason,
    "",
    "## 改版内容",
    "",
    ...changes.flatMap((change, index) => [
      `${index + 1}. ${change.area} / ${change.title}`,
      `   - 原因：${change.reason}`,
      `   - 实施：${change.implementation}`,
      `   - 负责人：${change.owner}`,
      "",
    ]),
    "## 验收口径",
    "",
    ...acceptanceChecks.map((item) => `- ${item}`),
    "",
    "## 关联诊断单",
    "",
    ...targetIds.map((id) => `- ${id}`),
  ].join("\n");

  return {
    id: ticketId,
    product: "SE-Path 学伴",
    exportType: "course_resource_revision_ticket",
    sourceResultId: result.id,
    sampleId: result.sampleId,
    planId: result.planId,
    createdAt,
    createdBy: "任课教师",
    courseClass: courseConfig.courseClass,
    courseName: courseConfig.courseName,
    repository: courseConfig.repository,
    resourceTitle: `${courseConfig.courseName} / REST API 边界测试资源包`,
    versionFrom: "v2026.08.30",
    versionTo,
    reason,
    changes,
    acceptanceChecks,
    targetWorkOrderIds: targetIds,
    boundary,
    markdown,
  };
});

const courseResourceRevisionRecorded = computed(() => {
  const current = snapshot.value;
  const ticket = courseResourceRevisionTicket.value;
  if (!current || !ticket) return false;
  const traceId = `course-resource-revision-${ticket.id}`;
  return ticket.targetWorkOrderIds.every((orderId) =>
    (current.ledger[orderId] ?? []).some(
      (entry) => entry.type === "course_resource_revision" && entry.traceId === traceId,
    ),
  );
});

const courseResourceRevisionSummaryText = computed(() => {
  const ticket = courseResourceRevisionTicket.value;
  if (!ticket) return "待采样结果入账";
  if (courseResourceRevisionRecorded.value) return "已改版入账";
  const readyCount = ticket.changes.filter((change) => change.status === "ready").length;
  return `${ticket.changes.length} 项改版 / ${readyCount} 项可执行`;
});

const courseResourceReleaseReceipt = computed<CourseResourceReleaseReceipt | null>(() => {
  const ticket = courseResourceRevisionTicket.value;
  if (!ticket || !courseResourceRevisionRecorded.value) return null;
  const releasedAt = new Date().toLocaleString("zh-CN", { hour12: false });
  const receiptId = `resource-release-${shortStableId(`${ticket.id}:${ticket.versionTo}`)}`;
  const assets = [
    "resources/rest-api-boundary-cases.md",
    ".github/pull_request_template.md",
    "rubric/boundary-evidence-checkpoints.json",
  ];
  const checks: CourseResourceReleaseReceipt["checks"] = [
    {
      id: "asset-version",
      label: "资源版本已归档",
      evidence: `${ticket.versionTo} 对应 3 类资源资产，均可追溯到改版工单。`,
      owner: "课程仓库维护者",
      status: "passed",
    },
    {
      id: "student-entry",
      label: "学生入口已可见",
      evidence: "下轮课堂微任务、PR 模板和 Rubric 检查点均指向同一证据口径。",
      owner: "任课教师",
      status: "passed",
    },
    {
      id: "rollback-ready",
      label: "回滚路径已准备",
      evidence: "若下轮新增证据覆盖未提升，回退到上一资源版本并保留人工复核。",
      owner: "课程负责人",
      status: "watch",
    },
  ];
  const rollbackPlan =
    "保留上一版 v2026.08.30 资源入口；若下轮新增证据覆盖下降或教师复核负担上升，暂停自动下发，回到教师人工抽样复核。";
  const boundary =
    "资源发布回证只证明课程资源已按教师确认版本交付；不证明教学措施因果效果，不自动评价学生、不排名、不惩罚、不生成可直接提交的完整答案。";
  const markdown = [
    `# ${courseConfig.courseClass} 课程资源发布回证`,
    "",
    `课程任务：${courseConfig.courseName}`,
    `仓库：${courseConfig.repository}`,
    `资源名称：${ticket.resourceTitle}`,
    `发布版本：${ticket.versionTo}`,
    `关联改版工单：${ticket.id}`,
    `关联采样结果：${ticket.sourceResultId}`,
    `发布时间：${releasedAt}`,
    `发布人：任课教师`,
    `发布渠道：课程仓库 + 学生任务入口 + Rubric 配置`,
    `发布范围：${ticket.courseClass} 下一轮 REST API 边界测试学习任务`,
    "",
    `> 边界：${boundary}`,
    "",
    "## 发布资产",
    "",
    ...assets.map((asset) => `- ${asset}`),
    "",
    "## 发布检查",
    "",
    ...checks.flatMap((check, index) => [
      `${index + 1}. ${check.label}`,
      `   - 状态：${check.status}`,
      `   - 证据：${check.evidence}`,
      `   - 负责人：${check.owner}`,
      "",
    ]),
    "## 回滚计划",
    "",
    rollbackPlan,
    "",
    "## 关联诊断单",
    "",
    ...ticket.targetWorkOrderIds.map((id) => `- ${id}`),
  ].join("\n");

  return {
    id: receiptId,
    product: "SE-Path 学伴",
    exportType: "course_resource_release_receipt",
    revisionTicketId: ticket.id,
    sourceResultId: ticket.sourceResultId,
    sampleId: ticket.sampleId,
    releasedAt,
    releasedBy: "任课教师",
    courseClass: ticket.courseClass,
    courseName: ticket.courseName,
    repository: ticket.repository,
    resourceTitle: ticket.resourceTitle,
    releasedVersion: ticket.versionTo,
    releaseChannel: "课程仓库 + 学生任务入口 + Rubric 配置",
    releaseScope: `${ticket.courseClass} 下一轮 REST API 边界测试学习任务`,
    assets,
    checks,
    rollbackPlan,
    targetWorkOrderIds: ticket.targetWorkOrderIds,
    boundary,
    markdown,
  };
});

const courseResourceReleaseRecorded = computed(() => {
  const current = snapshot.value;
  const receipt = courseResourceReleaseReceipt.value;
  if (!current || !receipt) return false;
  const traceId = `course-resource-release-${receipt.id}`;
  return receipt.targetWorkOrderIds.every((orderId) =>
    (current.ledger[orderId] ?? []).some(
      (entry) => entry.type === "course_resource_release" && entry.traceId === traceId,
    ),
  );
});

const courseResourceReleaseSummaryText = computed(() => {
  const receipt = courseResourceReleaseReceipt.value;
  if (!receipt) return "待资源改版入账";
  if (courseResourceReleaseRecorded.value) return "已发布入账";
  const passedCount = receipt.checks.filter((check) => check.status === "passed").length;
  return `${passedCount}/${receipt.checks.length} 项检查通过`;
});

const courseResourceUsageReceipt = computed<CourseResourceUsageReceipt | null>(() => {
  const current = snapshot.value;
  const release = courseResourceReleaseReceipt.value;
  if (!current || !release || !courseResourceReleaseRecorded.value) return null;
  const targetOrders = current.workOrders.filter((order) =>
    release.targetWorkOrderIds.includes(order.id),
  );
  if (targetOrders.length === 0) return null;
  const observedAt = new Date().toLocaleString("zh-CN", { hour12: false });
  const activeLearners = targetOrders.filter((order) => returnDoneCount(order.id) > 0).length;
  const submittedEvidenceCount = targetOrders.filter(
    (order) => returnDoneCount(order.id) >= 2,
  ).length;
  const teacherReviewReadyCount = targetOrders.filter((order) =>
    ["pending_review", "accepted"].includes(teacherEvidenceReviewGateFor(order)),
  ).length;
  const coverageValues = targetOrders
    .map((order) => Number(order.evidenceCoverage || 0))
    .sort((left, right) => left - right);
  const middle = Math.floor(coverageValues.length / 2);
  const medianCoverageAfter =
    coverageValues.length % 2 === 0
      ? Math.round((coverageValues[middle - 1] + coverageValues[middle]) / 2)
      : coverageValues[middle];
  const targetCount = targetOrders.length;
  const signals: CourseResourceUsageReceipt["signals"] = [
    {
      id: "resource-entry",
      label: "学生入口使用",
      value: `${activeLearners}/${targetCount}`,
      evidence: "学生端领取脚手架、打开任务包或提交补证据时写入账本。",
      status: activeLearners > 0 ? "confirmed" : "watch",
    },
    {
      id: "new-evidence",
      label: "新增证据提交",
      value: `${submittedEvidenceCount}/${targetCount}`,
      evidence: "结构化补证据表单回收失败现象、最小失败用例和验证记录。",
      status: submittedEvidenceCount > 0 ? "confirmed" : "watch",
    },
    {
      id: "teacher-review-ready",
      label: "教师复核就绪",
      value: `${teacherReviewReadyCount}/${targetCount}`,
      evidence: "只有完成三步回流并经过证据复核入口的工单才进入复核队列。",
      status: teacherReviewReadyCount > 0 ? "needs_review" : "watch",
    },
  ];
  const nextAction =
    teacherReviewReadyCount > 0
      ? `优先复核 ${teacherReviewReadyCount} 份新证据，再决定是否继续调整资源。`
      : submittedEvidenceCount < targetCount
        ? "继续催办未提交新证据的学生，暂不把资源发布解释为学习提升。"
        : "保留本轮使用信号，等待教师复核后再进入下一轮增值快照。";
  const boundary =
    "资源使用回流只记录学生是否使用新资源和是否提交新证据；不证明资源因果效果，不自动评价学生、不排名、不惩罚。";
  const usageWindow = `${courseConfig.courseClass} 新资源发布后 48 小时`;
  const usageId = `resource-usage-${shortStableId(`${release.id}:${release.releasedVersion}`)}`;
  const markdown = [
    `# ${courseConfig.courseClass} 课程资源使用回流单`,
    "",
    `课程任务：${courseConfig.courseName}`,
    `仓库：${courseConfig.repository}`,
    `发布版本：${release.releasedVersion}`,
    `关联发布回证：${release.id}`,
    `关联改版工单：${release.revisionTicketId}`,
    `观察窗口：${usageWindow}`,
    `回收时间：${observedAt}`,
    `回收人：任课教师`,
    "",
    `> 边界：${boundary}`,
    "",
    "## 使用信号",
    "",
    ...signals.flatMap((signal, index) => [
      `${index + 1}. ${signal.label}：${signal.value}`,
      `   - 状态：${signal.status}`,
      `   - 证据：${signal.evidence}`,
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
    "",
    "## 关联诊断单",
    "",
    ...release.targetWorkOrderIds.map((id) => `- ${id}`),
  ].join("\n");

  return {
    id: usageId,
    product: "SE-Path 学伴",
    exportType: "course_resource_usage_receipt",
    releaseReceiptId: release.id,
    revisionTicketId: release.revisionTicketId,
    sourceResultId: release.sourceResultId,
    sampleId: release.sampleId,
    observedAt,
    observedBy: "任课教师",
    courseClass: release.courseClass,
    courseName: release.courseName,
    repository: release.repository,
    releasedVersion: release.releasedVersion,
    usageWindow,
    activeLearners,
    submittedEvidenceCount,
    teacherReviewReadyCount,
    medianCoverageAfter,
    signals,
    nextAction,
    targetWorkOrderIds: release.targetWorkOrderIds,
    boundary,
    markdown,
  };
});

const courseResourceUsageRecorded = computed(() => {
  const current = snapshot.value;
  const receipt = courseResourceUsageReceipt.value;
  if (!current || !receipt) return false;
  const traceId = `course-resource-usage-${receipt.id}`;
  return receipt.targetWorkOrderIds.every((orderId) =>
    (current.ledger[orderId] ?? []).some(
      (entry) => entry.type === "course_resource_usage" && entry.traceId === traceId,
    ),
  );
});

const courseResourceUsageSummaryText = computed(() => {
  const receipt = courseResourceUsageReceipt.value;
  if (!receipt) return "待资源发布入账";
  if (courseResourceUsageRecorded.value) return "已回流入账";
  return `${receipt.submittedEvidenceCount}/${receipt.targetWorkOrderIds.length} 份新证据`;
});

const courseResourceUsageReminder = computed(() => {
  const receipt = courseResourceUsageReceipt.value;
  const current = snapshot.value;
  if (!receipt || !current || !courseResourceUsageRecorded.value) return null;
  const targetWorkOrderIds = receipt.targetWorkOrderIds.filter((orderId) => {
    const order = current.workOrders.find((item) => item.id === orderId);
    return Boolean(order) && order?.status !== "closed" && returnDoneCount(orderId) < returnSteps.length;
  });
  if (targetWorkOrderIds.length === 0) return null;
  return {
    usageReceiptId: receipt.id,
    traceId: `course-resource-usage-reminder-${receipt.id}`,
    title: `${receipt.releasedVersion} 使用回流`,
    targetWorkOrderIds,
    note: `提醒学生在 ${receipt.usageWindow} 内从新资源入口领取脚手架，并提交失败现象、最小失败用例、验证记录和反思；不要求提交完整答案。`,
  };
});

const courseResourceUsageReminderRecorded = computed(() => {
  const reminder = courseResourceUsageReminder.value;
  const current = snapshot.value;
  if (!reminder || !current) return false;
  return reminder.targetWorkOrderIds.every((orderId) =>
    (current.ledger[orderId] ?? []).some(
      (entry) => entry.type === "teacher_reminder" && entry.traceId === reminder.traceId,
    ),
  );
});

const courseResourceUsageReminderSummaryText = computed(() => {
  const reminder = courseResourceUsageReminder.value;
  if (!courseResourceUsageRecorded.value) return "待使用回流入账";
  if (!reminder) return "无需催办";
  if (courseResourceUsageReminderRecorded.value) return "已催办未回流";
  return `${reminder.targetWorkOrderIds.length} 人待催办`;
});

const courseTeachingImprovementSummaryText = computed(() => {
  const plan = courseTeachingImprovementPlan.value;
  if (!plan) return "暂无可发布改进单";
  const highCount = plan.items.filter((item) => item.priority === "high").length;
  const targetCount = new Set(plan.items.flatMap((item) => item.targetWorkOrderIds)).size;
  return `${plan.items.length} 项 / ${highCount} 高优先级 / ${targetCount} 张工单`;
});

const courseTeachingImprovementExecutionSummaryText = computed(() => {
  const receipt = courseTeachingImprovementExecutionReceipt.value;
  if (!receipt) return "暂无执行回证";
  if (!courseTeachingImprovementPublished.value) return "待发布改进单";
  if (courseTeachingImprovementExecutionDone.value) return "已登记执行回证";
  return `${receipt.evidence.length} 类证据 / ${receipt.targetWorkOrderIds.length} 张工单`;
});

function teachingPriorityLabel(priority: CourseTeachingImprovementItem["priority"]) {
  if (priority === "high") return "高优先级";
  if (priority === "medium") return "中优先级";
  return "低优先级";
}

const coursePriorityQueue = computed<CoursePriorityItem[]>(() =>
  openWorkOrders.value
    .map((order) => ({
      id: order.id,
      studentName: order.studentName,
      trigger: order.trigger,
      risk: order.risk,
      status: order.status,
      focus: order.valueAdded.label,
      score: courseOpsScore(order),
      action: courseOpsAction(order),
      evidenceCoverage: order.evidenceCoverage,
      returnDone: returnDoneCount(order.id),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5),
);

const todayInboxRows = computed<TodayInboxRow[]>(() =>
  filteredWorkOrders.value
    .filter((order) => order.status !== "closed")
    .map((order) => ({
      id: order.id,
      studentName: order.studentName,
      studentNo: order.studentNo,
      courseName: order.courseName,
      trigger: order.trigger,
      risk: order.risk,
      status: order.status,
      focus: order.valueAdded.label,
      score: courseOpsScore(order),
      action: courseOpsAction(order),
      evidenceCoverage: order.evidenceCoverage,
      returnDone: returnDoneCount(order.id),
      missingCount: order.missingEvidence.length,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6),
);

const todayInboxAllSelected = computed(
  () =>
    todayInboxRows.value.length > 0 &&
    todayInboxRows.value.every((row) => selectedTodayIds.value.includes(row.id)),
);

watch(todayInboxRows, (rows) => {
  const visibleIds = new Set(rows.map((row) => row.id));
  selectedTodayIds.value = selectedTodayIds.value.filter((id) => visibleIds.has(id));
});

const todayInboxMetrics = computed<TodayInboxMetric[]>(() => {
  const open = openWorkOrders.value;
  const needsTeacher = open.filter(
    (order) =>
      !order.selectedDecision ||
      !order.interventionPackage ||
      (order.status === "review" &&
        returnDoneCount(order.id) === returnSteps.length &&
        teacherEvidenceReviewGateFor(order) !== "not_ready"),
  ).length;
  const evidenceBlocked = open.filter(
    (order) => order.evidenceCoverage < 60 || order.missingEvidence.length > 0,
  ).length;
  return [
    {
      label: "待处理工单",
      value: String(open.length),
      hint: "未闭环的课程诊断单",
      tone: "dark",
    },
    {
      label: "需教师动作",
      value: String(needsTeacher),
      hint: "复核、发布或验收",
      tone: needsTeacher > 0 ? "amber" : "green",
    },
    {
      label: "证据不足",
      value: String(evidenceBlocked),
      hint: "先补证据再下结论",
      tone: evidenceBlocked > 0 ? "blue" : "green",
    },
  ];
});

const selectedQueueRank = computed(() => {
  const order = selectedOrder.value;
  if (!order) return 0;
  const index = todayInboxRows.value.findIndex((item) => item.id === order.id);
  return index >= 0 ? index + 1 : 0;
});

const selectedTeacherAction = computed(() =>
  selectedOrder.value ? courseOpsAction(selectedOrder.value) : "选择一张工单开始处理",
);

function latestCourseMicroTaskEntryFor(orderId: string) {
  return (snapshot.value?.ledger[orderId] ?? []).find(
    (entry) => entry.type === "course_micro_task" && Boolean(entry.traceId),
  );
}

const microTaskTrackingBoard = computed<MicroTaskTrackingBoard | null>(() => {
  const current = snapshot.value;
  const order = selectedOrder.value;
  if (!current || !order) return null;
  const sourceEntry = latestCourseMicroTaskEntryFor(order.id);
  if (!sourceEntry?.traceId) return null;
  const traceId = sourceEntry.traceId;
  const rows = current.workOrders
    .filter((item) =>
      (current.ledger[item.id] ?? []).some(
        (entry) => entry.type === "course_micro_task" && entry.traceId === traceId,
      ),
    )
    .map((item) => {
      const returnDone = returnDoneCount(item.id);
      const reviewGate = teacherEvidenceReviewGateFor(item);
      const reviewReady = reviewGate === "accepted";
      return {
        id: item.id,
        studentName: item.studentName,
        studentNo: item.studentNo,
        stage: statusLabels[item.status],
        risk: item.risk,
        evidenceCoverage: item.evidenceCoverage,
        returnDone,
        returnTotal: returnSteps.length,
        action: reviewReady
          ? "可进入教师验收"
          : reviewGate === "pending_review"
            ? "先做证据复核"
            : reviewGate === "needs_evidence" || reviewGate === "rejected"
              ? "退回补证据"
              : returnDone > 0
                ? "等待补齐剩余证据"
                : item.interventionPackage
                  ? "提醒学生领取任务"
                  : "待生成学生任务",
        studentUrl: studentReturnUrlFor(item),
        selected: item.id === order.id,
        reviewReady,
      };
    })
    .sort((a, b) => {
      if (a.reviewReady !== b.reviewReady) return a.reviewReady ? -1 : 1;
      return b.returnDone - a.returnDone || b.evidenceCoverage - a.evidenceCoverage;
    });
  if (rows.length <= 1) return null;
  return {
    traceId,
    title: sourceEntry.title,
    detail: sourceEntry.detail,
    targetCount: rows.length,
    startedCount: rows.filter((item) => item.returnDone > 0).length,
    completedCount: rows.filter((item) => item.returnDone === item.returnTotal).length,
    reviewReadyCount: rows.filter((item) => item.reviewReady).length,
    averageCoverage: Math.round(
      rows.reduce((sum, item) => sum + item.evidenceCoverage, 0) / Math.max(1, rows.length),
    ),
    rows,
  };
});

const microTaskTrackingPendingCount = computed(
  () =>
    microTaskTrackingBoard.value?.rows.filter(
      (item) => item.returnDone < item.returnTotal,
    ).length ?? 0,
);

const selectedTodayOrders = computed(() => {
  const ids = new Set(selectedTodayIds.value);
  return workOrders.value.filter((order) => ids.has(order.id) && order.status !== "closed");
});

const selectedTodayEvidenceGaps = computed<CourseEvidenceGap[]>(() => {
  const gaps = new Map<string, { count: number; source: string }>();
  selectedTodayOrders.value.forEach((order) => {
    order.missingEvidence.forEach((item) => {
      const current = gaps.get(item.title) ?? { count: 0, source: item.source };
      gaps.set(item.title, {
        count: current.count + 1,
        source: current.source || item.source,
      });
    });
  });
  return Array.from(gaps.entries())
    .map(([title, item]) => ({
      title,
      count: item.count,
      source: item.source,
      action: title.includes("反思")
        ? "推送反思模板"
        : title.includes("用例") || title.includes("清单")
          ? "补最小失败证据"
          : "补充可复核材料",
    }))
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title, "zh-CN"));
});

const courseFocusInsights = computed<CourseFocusInsight[]>(() => {
  const grouped = new Map<string, LearningWorkOrder[]>();
  openWorkOrders.value.forEach((order) => {
    const list = grouped.get(order.valueAdded.label) ?? [];
    list.push(order);
    grouped.set(order.valueAdded.label, list);
  });
  return Array.from(grouped.entries())
    .map(([label, orders]) => ({
      label,
      count: orders.length,
      averageDelta: Math.round(
        orders.reduce((sum, order) => sum + order.valueAdded.delta, 0) / orders.length,
      ),
      averageCoverage: Math.round(
        orders.reduce((sum, order) => sum + order.evidenceCoverage, 0) / orders.length,
      ),
      highUncertainty: orders.filter((order) => order.valueAdded.uncertainty === "high").length,
      acceptedReview: orders.filter((order) => teacherEvidenceReviewGateFor(order) === "accepted").length,
      pendingReview: orders.filter(
        (order) => teacherEvidenceReviewGateFor(order) === "pending_review",
      ).length,
      blockedReview: orders.filter((order) =>
        ["needs_evidence", "rejected"].includes(teacherEvidenceReviewGateFor(order)),
      ).length,
    }))
    .sort((a, b) => a.averageDelta - b.averageDelta || b.highUncertainty - a.highUncertainty);
});

const courseEvidenceGaps = computed<CourseEvidenceGap[]>(() => {
  const gaps = new Map<string, { count: number; source: string }>();
  openWorkOrders.value.forEach((order) => {
    order.missingEvidence.forEach((item) => {
      const current = gaps.get(item.title) ?? { count: 0, source: item.source };
      gaps.set(item.title, { count: current.count + 1, source: current.source || item.source });
    });
  });
  return Array.from(gaps.entries())
    .map(([title, item]) => ({
      title,
      count: item.count,
      source: item.source,
      action: title.includes("反思")
        ? "推送反思模板"
        : title.includes("用例") || title.includes("清单")
          ? "补最小失败证据"
          : "补充可复核材料",
    }))
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title, "zh-CN"))
    .slice(0, 5);
});

const courseMicroTaskPackage = computed<CourseMicroTaskPackage | null>(() => {
  const current = snapshot.value;
  if (!current) return null;
  return buildCourseMicroTaskPackage(current, {
    courseClass: courseConfig.courseClass,
    courseName: courseConfig.courseName,
    repository: courseConfig.repository,
    sourceGap: courseEvidenceGaps.value[0]?.title,
  });
});

const courseMicroTaskPublished = computed(() => {
  const current = snapshot.value;
  const microTask = courseMicroTaskPackage.value;
  if (!current || !microTask || microTask.targetWorkOrderIds.length === 0) return false;
  return microTask.targetWorkOrderIds.every((orderId) =>
    (current.ledger[orderId] ?? []).some(
      (entry) =>
        entry.type === "course_micro_task" &&
        entry.traceId === `course-micro-task-${microTask.id}`,
    ),
  );
});

const selectedTodayMicroTaskPackage = computed<CourseMicroTaskPackage | null>(() => {
  const current = snapshot.value;
  const orders = selectedTodayOrders.value;
  if (!current || orders.length === 0) return null;
  const targetWorkOrderIds = orders.map((order) => order.id);
  const sourceGap = selectedTodayEvidenceGaps.value[0]?.title ?? courseEvidenceGaps.value[0]?.title;
  const filteredSnapshot: WorkbenchSnapshot = {
    ...current,
    selectedId: orders[0].id,
    workOrders: orders,
  };
  const base = buildCourseMicroTaskPackage(filteredSnapshot, {
    courseClass: courseConfig.courseClass,
    courseName: courseConfig.courseName,
    repository: courseConfig.repository,
    sourceGap,
  });
  const affectedCount = new Set(orders.map((order) => order.studentNo || order.id)).size;
  const targetSignature = targetWorkOrderIds
    .map((id) => id.replace(/[^a-zA-Z0-9-]/g, "-"))
    .join("-");
  const markdown = [
    `# ${courseConfig.courseClass} 今日收件箱批量微任务包`,
    "",
    `课程任务：${courseConfig.courseName}`,
    `仓库：${courseConfig.repository}`,
    `共性缺口：${base.sourceGap}`,
    `涉及工单：${targetWorkOrderIds.join("、")}`,
    "",
    `> 安全边界：${base.safeBoundary}`,
    "",
    "## 任务目标",
    "",
    base.objective,
    "",
    "## 学生步骤",
    "",
    ...base.steps.map((step, index) => `${index + 1}. ${step}`),
    "",
    "## 需要提交的证据",
    "",
    ...base.evidenceToSubmit.map((item) => `- ${item}`),
    "",
    "## 教师验收点",
    "",
    ...base.rubricCheckpoints.map((item) => `- ${item}`),
  ].join("\n");
  return {
    ...base,
    id: `${base.id}-today-${targetSignature}`,
    affectedCount,
    targetWorkOrderIds,
    targetLearners: orders.map((order) => `${order.studentName} / ${order.id}`),
    teacherAction: `教师从今日任务收件箱勾选 ${orders.length} 张诊断单后统一发布；学生回流后仍逐单复核。`,
    confidenceNote: `本次覆盖教师手动勾选的 ${orders.length} 张诊断单，共同缺口用于组织任务主题；每名学生的诊断结论仍按个人证据单独更新。`,
    markdown,
  };
});

const selectedTodayMicroTaskPublished = computed(() => {
  const current = snapshot.value;
  const microTask = selectedTodayMicroTaskPackage.value;
  if (!current || !microTask || microTask.targetWorkOrderIds.length === 0) return false;
  return microTask.targetWorkOrderIds.every((orderId) =>
    (current.ledger[orderId] ?? []).some(
      (entry) =>
        entry.type === "course_micro_task" &&
        entry.traceId === `course-micro-task-${microTask.id}`,
    ),
  );
});

const selectedTodayBatchSummary = computed(() => {
  const microTask = selectedTodayMicroTaskPackage.value;
  if (!microTask) return "勾选同类诊断单后，可批量下发安全边界内的补证据任务。";
  return `${microTask.affectedCount} 张诊断单 · ${microTask.evidenceToSubmit.length} 项证据要求 · ${microTask.focusDimension}`;
});

const activeRosterLearners = computed(() =>
  rosterLearners.value.filter((learner) => learner.status !== "paused"),
);

function parseGithubBatchLine(line: string, index: number): GithubCiBatchImportItem | null {
  const cells = line
    .split(/\s*\|\s*|\t+/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (cells.length === 0) return null;
  const identity = cells[0] || `learner-${index + 1}`;
  const rosterMatch = rosterLearners.value.find(
    (learner) =>
      learner.learnerHash === identity ||
      learner.learnerAlias === identity ||
      learner.repositoryUser === identity,
  );
  const prUrl = cells.find((item) => /\/pull\/\d+/i.test(item)) || cells[1] || "";
  const ciRunUrl =
    cells.find((item) => /actions\/runs|ci|build|pipeline/i.test(item) && item !== prUrl) ||
    cells[2] ||
    "";
  const branch = cells[3] && cells[3] !== ciRunUrl ? cells[3] : "";
  const ciLogSummary = cells.slice(4).join(" | ") || cells.find((item) => item.length > 24 && !/^https?:\/\//i.test(item)) || "";
  if (!prUrl || !ciRunUrl || !ciLogSummary) return null;
  const learnerHash = rosterMatch?.learnerHash || normalizeLearnerHash(identity);
  const prNo = prUrl.match(/\/pull\/(\d+)/)?.[1] || String(index + 1);
  return {
    learnerHash,
    learnerAlias: rosterMatch?.learnerAlias || `SE-${learnerHash.slice(-4).toUpperCase()}`,
    repository: courseConfig.repository || githubImport.repository,
    branch,
    prUrl,
    ciRunUrl,
    ciProvider: courseConfig.ciProvider || "GitHub Actions",
    ciLogSummary,
    trigger: `PR #${prNo} CI 失败`,
    eventDate: new Date().toISOString().slice(0, 10),
    courseClass: courseConfig.courseClass,
    courseName: courseConfig.courseName,
    owner: "张老师",
    idempotencyKey: `${learnerHash}:${prUrl}:${ciRunUrl}`,
  };
}

const githubBatchImportItems = computed(() =>
  githubBatchRows.value
    .split(/\r?\n/)
    .map((line, index) => parseGithubBatchLine(line, index))
    .filter((item): item is GithubCiBatchImportItem => item !== null)
    .slice(0, 40),
);

const githubBatchImportInvalidCount = computed(() => {
  const nonEmpty = githubBatchRows.value.split(/\r?\n/).filter((line) => line.trim()).length;
  return Math.max(0, nonEmpty - githubBatchImportItems.value.length);
});

const learnersWithoutOpenOrder = computed(() => {
  const openHashes = new Set(
    workOrders.value
      .filter((order) => order.status !== "closed")
      .map((order) => order.studentNo),
  );
  return activeRosterLearners.value.filter((learner) => !openHashes.has(learner.learnerHash));
});

const rosterSummary = computed(() => ({
  total: rosterLearners.value.length,
  active: activeRosterLearners.value.length,
  selected: selectedLearnerHashes.value.length,
  withoutOpenOrder: learnersWithoutOpenOrder.value.length,
}));

const profileSummary = computed(() => {
  const order = selectedOrder.value;
  if (!order) {
    return {
      loops: 0,
      coverage: 0,
      focus: "待选择",
      evidenceGap: 0,
    };
  }
  const sameStudent = workOrders.value.filter(
    (item) => item.studentNo === order.studentNo,
  );
  return {
    loops: sameStudent.filter((item) => item.status === "closed").length,
    coverage: Math.round(
      sameStudent.reduce((sum, item) => sum + item.evidenceCoverage, 0) /
        Math.max(1, sameStudent.length),
    ),
    focus: order.valueAdded.label,
    evidenceGap: sameStudent.reduce(
      (sum, item) => sum + item.missingEvidence.length,
      0,
    ),
  };
});

const learnerProfileBaseOrder = computed(() => {
  const current = snapshot.value;
  if (!current) return selectedOrder.value;
  if (learnerProfileOrderId.value) {
    const fromDrawer = current.workOrders.find((item) => item.id === learnerProfileOrderId.value);
    if (fromDrawer) return fromDrawer;
  }
  return selectedOrder.value;
});

function sameLearner(a: LearningWorkOrder, b: LearningWorkOrder) {
  return (
    a.studentNo === b.studentNo ||
    Boolean(a.studentNo && b.studentNo && a.studentNo.slice(-8) === b.studentNo.slice(-8)) ||
    a.studentName === b.studentName
  );
}

const learnerProfileOrders = computed(() => {
  const base = learnerProfileBaseOrder.value;
  if (!base) return [];
  return workOrders.value
    .filter((order) => sameLearner(order, base))
    .sort((a, b) => b.eventDate.localeCompare(a.eventDate) || b.updatedAt.localeCompare(a.updatedAt));
});

const learnerProfileLedgerEntries = computed(() =>
  learnerProfileOrders.value.flatMap((order) =>
    (snapshot.value?.ledger[order.id] ?? []).map((entry) => ({
      ...entry,
      workOrderId: order.id,
      trigger: order.trigger,
    })),
  ),
);

const learnerProfileSnapshots = computed(() =>
  learnerProfileOrders.value
    .map((order) => order.valueAddedSnapshot)
    .filter((item): item is NonNullable<LearningWorkOrder["valueAddedSnapshot"]> => Boolean(item)),
);

const learnerProfileMetrics = computed<LearnerProfileMetric[]>(() => {
  const orders = learnerProfileOrders.value;
  const closed = orders.filter((order) => order.status === "closed").length;
  const averageCoverage = Math.round(
    orders.reduce((sum, order) => sum + order.evidenceCoverage, 0) / Math.max(1, orders.length),
  );
  const openGaps = orders.reduce((sum, order) => sum + order.missingEvidence.length, 0);
  return [
    {
      label: "诊断单",
      value: String(orders.length),
      hint: "同一学习者的课程事件",
      tone: "dark",
    },
    {
      label: "已闭环",
      value: String(closed),
      hint: "经教师验收后沉淀",
      tone: closed > 0 ? "green" : "blue",
    },
    {
      label: "平均覆盖",
      value: `${averageCoverage}%`,
      hint: "来自 Git / CI / 对话 / 反思 / 复核",
      tone: averageCoverage >= 70 ? "green" : "amber",
    },
    {
      label: "待补证据",
      value: String(openGaps),
      hint: "缺证时不写能力结论",
      tone: openGaps > 0 ? "amber" : "green",
    },
  ];
});

const learnerProfileFocuses = computed<LearnerProfileFocus[]>(() => {
  const grouped = new Map<string, LearningWorkOrder[]>();
  learnerProfileOrders.value.forEach((order) => {
    const list = grouped.get(order.valueAdded.label) ?? [];
    list.push(order);
    grouped.set(order.valueAdded.label, list);
  });
  return Array.from(grouped.entries())
    .map(([label, orders]) => {
      const latest = orders[0];
      const coverage = Math.round(
        orders.reduce((sum, order) => sum + order.evidenceCoverage, 0) / Math.max(1, orders.length),
      );
      return {
        label,
        count: orders.length,
        latestScore: latest.valueAdded.current,
        expectedScore: latest.valueAdded.expected,
        delta: latest.valueAdded.delta,
        coverage,
        uncertainty: latest.valueAdded.uncertainty,
      };
    })
    .sort((a, b) => a.delta - b.delta || b.count - a.count);
});

const learnerProfileEvidenceChannels = computed<LearnerProfileEvidenceChannel[]>(() => {
  const channels: Array<{ label: string; matcher: (entry: EvidenceLedgerEntry) => boolean; detail: string }> = [
    {
      label: "Git / CI",
      matcher: (entry) =>
        ["Git", "CI", "PR", "GitHub"].some(
          (keyword) => entry.source.includes(keyword) || entry.title.includes(keyword),
        ),
      detail: "失败日志、PR 摘要、提交节奏",
    },
    {
      label: "学生回流",
      matcher: (entry) => entry.type === "student_return",
      detail: "最小失败用例、修复验证、反思",
    },
    {
      label: "教师复核",
      matcher: (entry) =>
        entry.type === "decision" ||
        entry.type === "teacher_evidence_review" ||
        entry.type === "teacher_acceptance",
      detail: "教师决策、证据采信、验收结论",
    },
    {
      label: "系统建议",
      matcher: (entry) => entry.type === "recommendation" || entry.type === "course_micro_task",
      detail: "Safe-VOI 候选建议与课堂任务",
    },
  ];
  return channels.map((channel) => ({
    label: channel.label,
    count: learnerProfileLedgerEntries.value.filter(channel.matcher).length,
    detail: channel.detail,
  }));
});

const learnerProfileTimeline = computed<LearnerProfileTimelineItem[]>(() =>
  learnerProfileOrders.value.map((order) => {
    const reviewGate = teacherEvidenceReviewGateFor(order);
    return {
      id: order.id,
      title: order.courseName,
      date: order.eventDate,
      status: order.status,
      statusLabel: statusLabels[order.status],
      trigger: order.trigger,
      focus: order.valueAdded.label,
      delta: order.valueAdded.delta,
      coverage: order.evidenceCoverage,
      reviewGate,
      reviewGateLabel: courseReviewGateLabels[reviewGate],
      action: courseOpsAction(order),
    };
  }),
);

const learnerProfileNextAction = computed(() => {
  const open = learnerProfileOrders.value
    .filter((order) => order.status !== "closed")
    .sort((a, b) => courseOpsScore(b) - courseOpsScore(a))[0];
  if (!open) return "暂无未闭环事项，下一次只在新 PR/CI 或反思证据出现时更新画像。";
  return `${open.courseName}：${courseOpsAction(open)}。`;
});

function openLearnerProfile(orderId?: string) {
  const fallbackId = selectedOrder.value?.id ?? workOrders.value[0]?.id ?? "";
  learnerProfileOrderId.value = orderId || fallbackId;
  learnerProfileDrawerOpen.value = true;
}

const canRunStudentReturn = computed(
  () => Boolean(selectedOrder.value?.interventionPackage) && !saving.value,
);

function studentReturnUrlFor(order?: LearningWorkOrder | null) {
  if (typeof window === "undefined" || !order) return "";
  if (!order.interventionPackage) return "";
  const params = new URLSearchParams({
    mode: "student",
    order: order.id,
  });
  if (order.returnToken) params.set("returnToken", order.returnToken);
  const apiBase = courseConfig.apiBaseUrl.trim();
  if (apiBase) params.set("api", apiBase);
  const llmGatewayBase = courseConfig.llmGatewayBaseUrl.trim();
  if (llmGatewayBase) params.set("llm", llmGatewayBase);
  return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
}

const studentReturnUrl = computed(() => studentReturnUrlFor(selectedOrder.value));

const teacherEntryUrl = computed(() => {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams({ mode: "teacher" });
  const apiBase = courseConfig.apiBaseUrl.trim();
  if (apiBase) params.set("api", apiBase);
  const llmGatewayBase = courseConfig.llmGatewayBaseUrl.trim();
  if (llmGatewayBase) params.set("llm", llmGatewayBase);
  return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
});

const reviewerEntryUrl = computed(() => {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams({ mode: "reviewer" });
  const apiBase = courseConfig.apiBaseUrl.trim();
  if (apiBase) params.set("api", apiBase);
  const llmGatewayBase = courseConfig.llmGatewayBaseUrl.trim();
  if (llmGatewayBase) params.set("llm", llmGatewayBase);
  return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
});

const reviewerMetrics = computed(() => {
  const orders = workOrders.value;
  const ledgerCount = Object.values(snapshot.value?.ledger ?? {}).reduce(
    (sum, entries) => sum + entries.length,
    0,
  );
  const closedCount = orders.filter((item) => item.status === "closed").length;
  const reviewedCount = orders.filter((item) => Boolean(item.selectedDecision)).length;
  const averageCoverage = Math.round(
    orders.reduce((sum, item) => sum + item.evidenceCoverage, 0) / Math.max(1, orders.length),
  );
  return {
    orders: orders.length,
    reviewedCount,
    closedCount,
    ledgerCount,
    averageCoverage,
  };
});

const reviewerFlow = [
  "PR/CI 失败进入队列",
  "形成增值诊断单",
  "Safe-VOI 给候选下一步",
  "教师复核后发布",
  "学生补证据与反思",
  "账本导出与审计",
];

const valueEngineHighlights = [
  {
    title: "证据链驱动",
    subtitle: "PR / CI / 测试 / 对话 / 反思",
    detail: "把软件工程课程里的真实过程证据整理成可追溯诊断单，减少凭印象判断。",
  },
  {
    title: "增值诊断",
    subtitle: "当前水平 / 期望水平 / 差值 / 不确定性",
    detail: "关注学生相对起点的能力变化，不做排名、惩罚或高风险自动结论。",
  },
  {
    title: "智能体闭环",
    subtitle: "候选建议 -> 教师确认 -> 学生回流 -> 账本",
    detail: "平台只推动下一步行动，教师始终掌握发布、退回、采信和验收权。",
  },
];

const valueEngineLayers = [
  {
    step: "01",
    title: "学习事件进入",
    short: "GitHub、CI、PR、测试覆盖、课堂求助和反思进入统一账本。",
    proof: "来源、时间、trace、脱敏字段和可用性状态同时记录。",
  },
  {
    step: "02",
    title: "薄弱能力定位",
    short: "从一次失败中定位到软件工程能力维度，而不是只标记一道题错了。",
    proof: "例如把 CI 失败映射到边界测试设计、异常路径建模和验证习惯。",
  },
  {
    step: "03",
    title: "Safe-VOI 排序",
    short: "先处理最能降低不确定性、又不会替学生完成答案的下一步。",
    proof: "补证据、最小失败用例、测试清单、会谈和暂缓都会被排序说明。",
  },
  {
    step: "04",
    title: "教师确认执行",
    short: "所有任务包、催办、资源改版和验收结论都需要教师确认后生效。",
    proof: "智能体产出候选内容，教师负责修改、批准、退回和转人工。",
  },
  {
    step: "05",
    title: "学生回流与复核",
    short: "学生领取脚手架、补证据、写反思，教师逐项采信后更新诊断。",
    proof: "回流状态、教师采信记录和增值快照共同构成后续教学依据。",
  },
  {
    step: "06",
    title: "课程改进闭环",
    short: "多个学生的同类证据缺口回到课程资源、微任务和课堂安排。",
    proof: "平台沉淀为课程周报、资源使用回证、后续采样和审计包。",
  },
];

const valueEngineComparison = [
  {
    label: "普通课程后台",
    old: "管理作业、资源和成绩",
    current: "本平台处理学习过程证据，并形成可复核的增值诊断。",
  },
  {
    label: "普通聊天助手",
    old: "回答问题或生成文本",
    current: "本平台不替学生写答案，只生成候选脚手架和补证据路径。",
  },
  {
    label: "普通评分系统",
    old: "给分、排名或打标签",
    current: "本平台看起点、期望、差值、不确定性和证据覆盖。",
  },
  {
    label: "普通提醒工具",
    old: "发送一次通知",
    current: "本平台把领取、提交、复核、采信和增值快照串成闭环。",
  },
];

const agentEntrySteps = [
  {
    title: "教师进入",
    route: "工作台顶部“智能体”或左侧“智能体协同”",
    usage: "查看本课程启用的智能体、触发条件、输入证据和人工确认点。",
  },
  {
    title: "证据进入",
    route: "课程设置中的 GitHub/CI 接入或“导入事件”抽屉",
    usage: "证据采集智能体读取脱敏 PR、CI、测试摘要和学习对话，生成候选诊断单。",
  },
  {
    title: "学生进入",
    route: "教师发布任务包后的专属学生回流链接",
    usage: "学习脚手架智能体只给检查清单、提示问题和反思结构，不给完整答案。",
  },
  {
    title: "审阅进入",
    route: "质控审阅入口",
    usage: "审阅人员只读查看证据链、边界和日志，不参与教学决策。",
  },
];

const agentOperatingLoop = [
  {
    step: "1",
    title: "接入证据",
    detail: "教师在课程设置接入 GitHub/CI，或在工作台导入脱敏学习事件。",
  },
  {
    step: "2",
    title: "生成候选诊断",
    detail: "证据采集智能体把 PR、CI、测试、对话和反思整理为候选诊断单。",
  },
  {
    step: "3",
    title: "排序下一步",
    detail: "Safe-VOI 决策智能体基于证据覆盖、不确定性和安全边界推荐处理顺序。",
  },
  {
    step: "4",
    title: "教师确认发布",
    detail: "教师编辑并批准任务包后，学习脚手架智能体才开放学生回流入口。",
  },
  {
    step: "5",
    title: "回流与复核",
    detail: "学生补证据和反思后，教师逐项采信，再形成增值快照和审计账本。",
  },
];

const agentCards = [
  {
    name: "证据采集智能体",
    trigger: "PR/CI 失败、教师导入事件、课程批量导入",
    input: "脱敏后的仓库、分支、PR、CI 摘要、对话片段和反思材料",
    output: "候选增值诊断单、证据缺口、待补证字段",
    humanGate: "教师确认后才进入学生任务或课程级处理队列",
  },
  {
    name: "Safe-VOI 决策智能体",
    trigger: "诊断单需要下一步处理时",
    input: "当前能力、期望水平、证据覆盖、不确定性、教师负担和风险边界",
    output: "补证据、脚手架、人工会谈或暂缓处理的候选排序",
    humanGate: "教师选择批准、退回补证据或转人工会谈",
  },
  {
    name: "学习脚手架智能体",
    trigger: "教师批准任务包或课堂微任务后",
    input: "教师确认的目标、步骤、Rubric、证据要求和截止提示",
    output: "最小失败用例提示、测试清单、反思模板和提交检查",
    humanGate: "学生提交后进入教师复核，不自动判定能力提升",
  },
  {
    name: "回流运营智能体",
    trigger: "学生未领取资源、未提交新证据或复核队列积压",
    input: "学生回流进度、资源使用信号、教师复核状态和账本 trace",
    output: "催办建议、课程资源改版建议、周报和后续采样口径",
    humanGate: "教师确认催办、发布、回证和验收",
  },
  {
    name: "治理审计智能体",
    trigger: "任何写入、导出、审阅或接口调用",
    input: "角色、权限、脱敏字段、证据来源、操作时间和数据范围",
    output: "隐私拦截、只读审阅视图、证据账本和导出包",
    humanGate: "敏感字段被拦截；最终解释由教师或课程负责人确认",
  },
];

const agentBoundaries = [
  "智能体只生成候选诊断、候选行动和解释，不直接评价学生。",
  "缺证据时必须显示待补证或不确定，不能强行得出结论。",
  "学生端不展示完整答案、可直接提交代码或替代作业内容。",
  "教师确认前，不向学生发布任务、不写入最终验收、不生成排名。",
];

const studentCanSubmit = computed(
  () =>
    Boolean(studentOrder.value?.interventionPackage) &&
    Boolean(studentReturnToken.value) &&
    !saving.value,
);

watch(
  () => `${studentOrder.value?.id ?? ""}:${currentReturnState.value.revision ?? 0}`,
  () => {
    studentEvidenceForm.failureSymptom = "";
    studentEvidenceForm.minimalCase = "";
    studentEvidenceForm.verificationRecord = "";
    studentEvidenceForm.evidenceLink = "";
    studentEvidenceIntegrityChecked.value = false;
    studentReflectionText.value = "";
  },
);

function valueDeltaText(order: LearningWorkOrder) {
  return order.valueAdded.delta > 0
    ? `+${order.valueAdded.delta}`
    : String(order.valueAdded.delta);
}

function uncertaintyLabel(uncertainty: LearningWorkOrder["valueAdded"]["uncertainty"]) {
  if (uncertainty === "low") return "不确定性低";
  if (uncertainty === "medium") return "不确定性中";
  return "不确定性高";
}

function uncertaintyAdvice(order: LearningWorkOrder) {
  if (order.valueAdded.uncertainty === "low") {
    return "证据覆盖已达到本轮形成性诊断要求，后续只在新证据出现时更新。";
  }
  if (order.valueAdded.uncertainty === "medium") {
    return "证据基本可用，建议补齐争议点或反思材料后再做长期画像判断。";
  }
  return "证据覆盖不足，建议先补关键证据以降低误判。";
}

function uncertaintyTone(order: LearningWorkOrder) {
  return `uncertainty-${order.valueAdded.uncertainty}`;
}

function evidenceStatusLabel(status: EvidenceEvent["status"]) {
  if (status === "collected") return "已验证";
  if (status === "pending") return "待确认";
  return "缺失";
}

function evidenceStatusClass(status: EvidenceEvent["status"]) {
  return {
    collected: status === "collected",
    pending: status === "pending",
    missing: status === "missing",
  };
}

function interventionPackageStatusLabel(status: string) {
  if (status === "ready_for_student") return "已下发";
  if (status === "returned_for_evidence") return "补证据";
  if (status === "human_talk") return "待会谈";
  return "草稿";
}

function returnStepDone(key: ReturnStepKey) {
  return currentReturnState.value[key];
}

function riskTone(order: LearningWorkOrder) {
  return `risk-${order.risk}`;
}

function applyCourseSettings(settings?: Partial<CourseSettingsConfig> | null) {
  if (!settings) return;
  courseConfig.courseClass = settings.courseClass ?? courseConfig.courseClass;
  courseConfig.courseName = settings.courseName ?? courseConfig.courseName;
  courseConfig.repository = settings.repository ?? courseConfig.repository;
  courseConfig.ciProvider = settings.ciProvider ?? courseConfig.ciProvider;
  courseConfig.privacyPolicy = settings.privacyPolicy ?? courseConfig.privacyPolicy;
  courseConfig.llmGatewayBaseUrl = settings.llmGatewayBaseUrl ?? courseConfig.llmGatewayBaseUrl;
  intakeForm.courseClass = courseConfig.courseClass;
  intakeForm.courseName = courseConfig.courseName;
  githubImport.repository = courseConfig.repository;
}

function compactHash(input: string) {
  let hash = 2166136261;
  for (const char of input) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function normalizeLearnerHash(value: string) {
  const trimmed = value.trim();
  if (
    /^(stu|learner|anon|hash)[_-][a-z0-9_-]{3,}$/i.test(trimmed) ||
    (/^[a-f0-9]{16,}$/i.test(trimmed) && /[a-f]/i.test(trimmed))
  ) {
    return trimmed;
  }
  return `stu_hash_${compactHash(trimmed || "anonymous")}`;
}

function formatRosterText(learners: CourseRosterLearner[]) {
  return learners
    .map((learner) =>
      [
        learner.learnerHash,
        learner.learnerAlias,
        learner.groupName,
        learner.repositoryUser,
        learner.status,
      ].join(", "),
    )
    .join("\n");
}

function parseRosterRows(sourceText: string, className = courseConfig.courseClass) {
  return sourceText
    .split(/\r?\n/)
    .map((line, index): CourseRosterLearner | null => {
      const trimmed = line.trim();
      if (!trimmed) return null;
      const cells = trimmed.split(/[,，\t]/).map((item) => item.trim());
      const sourceId = cells[0] || `learner-${index + 1}`;
      const status: CourseRosterLearner["status"] =
        cells[4] === "paused" || cells[4] === "watch" ? cells[4] : "active";
      return {
        learnerHash: normalizeLearnerHash(sourceId),
        learnerAlias: cells[1] || `SE-${String(index + 1).padStart(3, "0")}`,
        className,
        groupName: cells[2] || "未分组",
        repositoryUser: cells[3] || "",
        status,
        lastActivity: "",
      };
    })
    .filter((item): item is CourseRosterLearner => item !== null)
    .filter(
      (learner, index, all) =>
        all.findIndex((item) => item.learnerHash === learner.learnerHash) === index,
    );
}

function parseRosterText() {
  return parseRosterRows(rosterText.value, courseConfig.courseClass);
}

const launchLearners = computed(() => parseRosterRows(launchRosterRows.value, launchForm.courseClass));
const activeLaunchLearners = computed(() =>
  launchLearners.value.filter((learner) => learner.status !== "paused"),
);
const launchReadiness = computed<CourseLaunchChecklistItem[]>(() => [
  {
    key: "settings",
    label: "课程与仓库",
    status:
      launchForm.courseClass.trim() && launchForm.courseName.trim() && launchForm.repository.trim()
        ? "done"
        : "blocked",
    detail: `${launchForm.courseClass || "未填写班级"} / ${launchForm.repository || "未填写仓库"}`,
  },
  {
    key: "roster",
    label: "伪名名单",
    status: activeLaunchLearners.value.length > 0 ? "done" : "blocked",
    detail: `${activeLaunchLearners.value.length} 名可参与学习者`,
  },
  {
    key: "diagnosis",
    label: "首轮任务",
    status: launchForm.trigger.trim() && launchForm.taskSummary.trim() ? "done" : "blocked",
    detail: launchForm.trigger || "未填写巡检任务",
  },
  {
    key: "boundary",
    label: "安全边界",
    status: launchForm.privacyPolicy.trim().length >= 12 ? "done" : "blocked",
    detail: "形成性诊断，不排名不惩罚，智能体不替教师下结论。",
  },
]);
const canLaunchCourse = computed(() =>
  launchReadiness.value.every((item) => item.status === "done") && activeLaunchLearners.value.length > 0,
);

async function loadCourseOps() {
  const roster = await getCourseRoster();
  rosterLearners.value = roster.learners;
  rosterText.value = formatRosterText(roster.learners);
  selectedLearnerHashes.value = roster.learners
    .filter((learner) => learner.status !== "paused")
    .slice(0, 3)
    .map((learner) => learner.learnerHash);
  batchTask.courseClass = courseConfig.courseClass;
  batchTask.courseName = courseConfig.courseName;
  batchTask.owner = "张老师";
}

async function openCourseOps() {
  opsDrawerOpen.value = true;
  if (rosterLearners.value.length === 0) {
    await loadCourseOps();
  }
}

function handleNavClick(label: string) {
  if (label === "增值引擎") {
    valueEngineDrawerOpen.value = true;
    return;
  }
  if (label === "智能体协同") {
    agentDrawerOpen.value = true;
    return;
  }
  if (label === "学情档案") {
    openLearnerProfile();
    return;
  }
  if (label === "证据账本") {
    ledgerDrawerOpen.value = true;
    return;
  }
  if (label === "增长看板") {
    void openCourseOps();
    return;
  }
  if (label === "课程设置") {
    courseDrawerOpen.value = true;
  }
}

function navItemActive(label: string) {
  if (label === "增值引擎") return valueEngineDrawerOpen.value;
  if (label === "智能体协同") return agentDrawerOpen.value;
  if (label === "学情档案") return learnerProfileDrawerOpen.value;
  if (label === "证据账本") return ledgerDrawerOpen.value;
  if (label === "增长看板") return opsDrawerOpen.value;
  if (label === "课程设置") return courseDrawerOpen.value;
  return label === "工作台";
}

function openLaunchWizard() {
  launchForm.courseClass = courseConfig.courseClass;
  launchForm.courseName = courseConfig.courseName;
  launchForm.repository = courseConfig.repository;
  launchForm.ciProvider = courseConfig.ciProvider;
  launchForm.privacyPolicy = courseConfig.privacyPolicy;
  if (rosterLearners.value.length > 0) {
    launchRosterRows.value = formatRosterText(rosterLearners.value);
  }
  launchStep.value = 0;
  launchDrawerOpen.value = true;
}

async function handleLaunchCourse() {
  if (!canLaunchCourse.value) {
    ElMessage.warning("请先补齐课程、名单、任务和安全边界。");
    return;
  }
  saving.value = true;
  try {
    courseConfig.courseClass = launchForm.courseClass;
    courseConfig.courseName = launchForm.courseName;
    courseConfig.repository = launchForm.repository;
    courseConfig.ciProvider = launchForm.ciProvider;
    courseConfig.privacyPolicy = launchForm.privacyPolicy;
    saveApiBaseUrl(courseConfig.apiBaseUrl);
    saveLlmGatewayBaseUrl(courseConfig.llmGatewayBaseUrl);
    window.localStorage.setItem(courseConfigStorageKey, JSON.stringify(courseConfig));
    const result = await launchCoursePilot({
      settings: {
        courseClass: launchForm.courseClass,
        courseName: launchForm.courseName,
        repository: launchForm.repository,
        ciProvider: launchForm.ciProvider,
        privacyPolicy: launchForm.privacyPolicy,
        apiBaseUrl: courseConfig.apiBaseUrl,
        llmGatewayBaseUrl: courseConfig.llmGatewayBaseUrl,
      },
      learners: launchLearners.value,
      selectedLearnerHashes: activeLaunchLearners.value.map((learner) => learner.learnerHash),
      task: {
        courseClass: launchForm.courseClass,
        courseName: launchForm.courseName,
        trigger: launchForm.trigger,
        eventDate: launchForm.eventDate,
        owner: launchForm.owner,
        focus: launchForm.focus,
        risk: launchForm.risk,
        taskSummary: launchForm.taskSummary,
        learnerHashes: activeLaunchLearners.value.map((learner) => learner.learnerHash),
      },
    });
    lastLaunchResult.value = result;
    snapshot.value = result.snapshot;
    rosterLearners.value = result.roster.learners;
    rosterText.value = formatRosterText(result.roster.learners);
    selectedLearnerHashes.value = result.roster.learners
      .filter((learner) => learner.status !== "paused")
      .slice(0, 3)
      .map((learner) => learner.learnerHash);
    intakeForm.courseClass = courseConfig.courseClass;
    intakeForm.courseName = courseConfig.courseName;
    githubImport.repository = courseConfig.repository;
    apiStorageMode.value = result.storageMode || apiStorageMode.value;
    await loadGithubIntegrationStatus(false);
    launchStep.value = 3;
    ElMessage.success(`课程初始化完成，新增 ${result.createdCount} 张首轮诊断单`);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "课程初始化失败");
  } finally {
    saving.value = false;
  }
}

async function handleSaveRoster() {
  const learners = parseRosterText();
  if (learners.length === 0) {
    ElMessage.warning("请至少保留一名伪名学习者");
    return;
  }
  saving.value = true;
  try {
    const roster = await saveCourseRoster(learners);
    rosterLearners.value = roster.learners;
    rosterText.value = formatRosterText(roster.learners);
    selectedLearnerHashes.value = roster.learners
      .filter((learner) => learner.status !== "paused")
      .slice(0, 3)
      .map((learner) => learner.learnerHash);
    ElMessage.success("课程名单已保存，真实身份字段不会进入后端");
  } finally {
    saving.value = false;
  }
}

async function handleBatchCreate() {
  if (selectedLearnerHashes.value.length === 0) {
    ElMessage.warning("请先选择要巡检的学生");
    return;
  }
  saving.value = true;
  try {
    snapshot.value = await createBatchWorkOrders({
      ...batchTask,
      learnerHashes: [...selectedLearnerHashes.value],
    });
    teacherNote.value = "";
    opsDrawerOpen.value = false;
    ElMessage.success(`已生成 ${selectedLearnerHashes.value.length} 张候选诊断单`);
  } finally {
    saving.value = false;
  }
}

async function handleGithubBatchImport() {
  const items = githubBatchImportItems.value;
  if (items.length === 0) {
    ElMessage.warning("请至少保留一条可解析的 PR/CI 记录");
    return;
  }
  saving.value = true;
  try {
    const result = await importGithubCiBatch(items);
    snapshot.value = result.snapshot;
    githubIntegrationStatus.value = result.integrationStatus ?? (await getGithubIntegrationStatus());
    githubBatchImportStatus.value = `新增 ${result.createdCount} 张，跳过 ${result.skippedCount} 张`;
    ElMessage.success(`PR/CI 批量导入完成：新增 ${result.createdCount} 张诊断单`);
  } catch (error) {
    githubBatchImportStatus.value = "导入失败";
    ElMessage.error(error instanceof Error ? error.message : "PR/CI 批量导入失败");
  } finally {
    saving.value = false;
  }
}

async function loadGithubIntegrationStatus(showToast = false) {
  integrationStatusLoading.value = true;
  try {
    githubIntegrationStatus.value = await getGithubIntegrationStatus();
    if (showToast) {
      ElMessage.success("GitHub 接入状态已刷新");
    }
  } catch (error) {
    if (showToast) {
      ElMessage.warning(error instanceof Error ? error.message : "GitHub 接入状态读取失败");
    }
  } finally {
    integrationStatusLoading.value = false;
  }
}

async function handleApiCheck(showToast = true) {
  saveApiBaseUrl(courseConfig.apiBaseUrl);
  saveLlmGatewayBaseUrl(courseConfig.llmGatewayBaseUrl);
  apiStatus.value = courseConfig.apiBaseUrl.trim() ? "checking" : "offline";
  const result: ApiConnectionCheck = await checkApiConnection();
  authSessionActive.value = Boolean(readApiAccessToken());
  apiRequiresToken.value = Boolean(result.requiresToken);
  apiStatus.value = result.ok ? "connected" : result.mode === "offline" ? "offline" : "error";
  apiStatusMessage.value = result.message;
  apiCapabilities.value = result.capabilities ?? [];
  apiStorageMode.value =
    result.storageMode ?? (result.mode === "offline" ? "local-offline" : "edge-api");
  if (result.settings) {
    applyCourseSettings(result.settings);
    window.localStorage.setItem(courseConfigStorageKey, JSON.stringify(courseConfig));
  }
  if (entryMode.value === "teacher" && result.requiresToken && !authSessionActive.value) {
    teacherLoginOpen.value = true;
  }
  if (result.ok && authSessionActive.value) {
    teacherLoginOpen.value = false;
  }
  if (showToast) {
    if (result.ok) ElMessage.success("后端已连接，课程设置已同步");
    else if (result.mode === "offline") ElMessage.info(result.message);
    else ElMessage.warning(result.message);
  }
  await loadGithubIntegrationStatus(false);
  return result;
}

async function handleTeacherAccessLogin() {
  if (!teacherAccessCode.value.trim()) {
    ElMessage.warning("请输入教师访问码");
    return;
  }
  authLoginLoading.value = true;
  try {
    const result = await loginWithTeacherAccessCode(teacherAccessCode.value);
    authSessionActive.value = true;
    apiRequiresToken.value = true;
    apiStorageMode.value = result.storageMode ?? apiStorageMode.value;
    teacherAccessCode.value = "";
    teacherLoginOpen.value = false;
    ElMessage.success("教师授权已生效，正在同步云端工单");
    await handleApiCheck(false);
    await loadWorkbench();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "教师访问码登录失败");
  } finally {
    authLoginLoading.value = false;
  }
}

async function handleTeacherLogout() {
  clearApiAccessToken();
  authSessionActive.value = false;
  if (courseConfig.apiBaseUrl.trim()) {
    apiRequiresToken.value = true;
    teacherLoginOpen.value = true;
  }
  ElMessage.info("已退出当前教师授权");
  await handleApiCheck(false);
}

async function copyWebhookUrl() {
  if (!courseConfig.apiBaseUrl.trim()) {
    ElMessage.info("先配置后端 API 地址后再复制 Webhook 地址");
    return;
  }
  try {
    await navigator.clipboard.writeText(webhookUrl.value);
    ElMessage.success("Webhook 接入地址已复制");
  } catch {
    ElMessage.info(webhookUrl.value);
  }
}

async function copyGithubWorkflowYaml() {
  try {
    await navigator.clipboard.writeText(githubWorkflowYaml.value);
    ElMessage.success("GitHub Actions 接入配置已复制");
  } catch {
    ElMessage.info("当前浏览器不允许复制，请直接选中配置片段。");
  }
}

async function loadWorkbench() {
  loading.value = true;
  if (courseConfig.apiBaseUrl.trim()) {
    try {
      const connection = await handleApiCheck(false);
      if (entryMode.value === "teacher" && connection.requiresToken && !readApiAccessToken()) {
        teacherLoginOpen.value = true;
      }
      applyCourseSettings(await loadRemoteCourseSettings());
      apiStatus.value = "connected";
      apiStatusMessage.value = "已连接后端，当前课程和工单队列来自 Edge API。";
      if (apiStorageMode.value === "local-offline" || apiStorageMode.value === "pending") {
        apiStorageMode.value = "edge-api";
      }
    } catch (error) {
      apiStatus.value = "error";
      apiStatusMessage.value = error instanceof Error ? error.message : "后端课程配置读取失败。";
    }
  }
  snapshot.value = await getTeacherWorkbench();
  await loadGithubIntegrationStatus(false);
  if (studentMode.value && !studentModeOrderId.value) {
    studentModeOrderId.value = snapshot.value.selectedId;
  }
  teacherNote.value = selectedOrder.value?.teacherNote ?? "";
  loading.value = false;
}

async function handleSelectOrder(id: string) {
  snapshot.value = await selectWorkOrderApi(id);
  teacherNote.value = selectedOrder.value?.teacherNote ?? "";
}

function toggleTodaySelection(id: string) {
  const selected = new Set(selectedTodayIds.value);
  if (selected.has(id)) selected.delete(id);
  else selected.add(id);
  selectedTodayIds.value = todayInboxRows.value
    .map((row) => row.id)
    .filter((rowId) => selected.has(rowId));
}

function selectAllTodayRows() {
  selectedTodayIds.value = todayInboxRows.value.map((row) => row.id);
}

function clearTodaySelection() {
  selectedTodayIds.value = [];
}

function scrollToDiagnosis() {
  document
    .querySelector<HTMLElement>('[data-testid="diagnosis-review-section"]')
    ?.scrollIntoView({ block: "start", behavior: "smooth" });
}

async function focusCourseOpsOrder(id: string) {
  await handleSelectOrder(id);
  opsDrawerOpen.value = false;
}

async function handleDecision(decision: TeacherDecision) {
  const order = selectedOrder.value;
  if (!order) return;
  if (order.status === "closed") {
    ElMessage.warning("诊断单已关闭，如需继续处理请新建下一轮诊断。");
    return;
  }
  saving.value = true;
  try {
    snapshot.value = await reviewWorkOrder(
      order.id,
      decision,
      teacherNote.value ||
        "教师确认：仅发布安全边界内的下一步任务，不提供可直接提交答案。",
    );
    ElMessage.success(`${decisionMeta[decision].label}已写入证据账本`);
  } finally {
    saving.value = false;
  }
}

async function handlePublishPackage() {
  const order = selectedOrder.value;
  if (!order) return;
  if (order.status === "closed") {
    ElMessage.warning("诊断单已关闭，不能继续发布任务包。");
    return;
  }
  if (!order.selectedDecision) {
    ElMessage.warning("请先完成教师复核，再发布学生任务包。");
    return;
  }
  if (packageDraftValidation.value) {
    ElMessage.warning(packageDraftValidation.value);
    return;
  }
  saving.value = true;
  try {
    const draft = buildPackageDraftPayload();
    snapshot.value = await publishInterventionPackage(
      order.id,
      draft.teacherNote,
      draft,
    );
    ElMessage.success("任务包已按教师草稿发布，学生回流入口已开放");
  } finally {
    saving.value = false;
  }
}

async function handleStudentReturn(step: ReturnStepKey) {
  const order = selectedOrder.value;
  if (!order) return;
  if (!order.selectedDecision) {
    ElMessage.warning("请先由教师确认下一步，再接收学生回流。");
    return;
  }
  saving.value = true;
  try {
    snapshot.value = await recordStudentReturn(order.id, step);
    ElMessage.success("学生回流已写入证据账本");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "学生回流写入失败");
  } finally {
    saving.value = false;
  }
}

function setTeacherEvidenceReviewStatus(key: string, status: TeacherEvidenceReviewStatus) {
  teacherEvidenceReviewStatuses[key] = status;
}

async function handleTeacherEvidenceReviewSave() {
  const order = selectedOrder.value;
  const sourceEntry = latestStudentEvidenceEntry.value;
  if (!order || !sourceEntry) {
    ElMessage.warning("请先等待学生补充关键证据。");
    return;
  }
  const pending = teacherEvidenceReviewItems.value.filter(
    (item) => !teacherEvidenceReviewStatus(item),
  );
  if (pending.length > 0) {
    ElMessage.warning(`还有 ${pending.length} 个证据项未复核。`);
    return;
  }
  const items = teacherEvidenceReviewItems.value.map((item) => ({
    key: item.key,
    label: item.label,
    value: item.value,
    required: item.required,
    status: teacherEvidenceReviewStatus(item) as TeacherEvidenceReviewStatus,
  }));
  const blockers = items.filter((item) => item.status !== "accepted").length;
  const payload: TeacherEvidenceReviewPayload = {
    sourceLedgerEntryId: sourceEntry.id,
    summary: blockers
      ? `仍有 ${blockers} 项学生回流证据需要补充或不采用，暂不进入最终验收。`
      : "学生回流证据已逐项复核，当前证据可进入形成性验收。",
    items,
    teacherNote: teacherEvidenceReviewNote.value.trim(),
  };
  saving.value = true;
  try {
    snapshot.value = await recordTeacherEvidenceReview(order.id, payload);
    resetTeacherEvidenceReviewDraft();
    ElMessage.success(blockers ? "证据复核已保存，建议退回补证据。" : "证据复核已保存，可以验收。");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "教师证据复核保存失败");
  } finally {
    saving.value = false;
  }
}

async function handleTeacherClosure(decision: TeacherClosureDecision) {
  const order = selectedOrder.value;
  if (!order) return;
  if (decision === "accept" && !teacherEvidenceReviewReadyForClosure.value) {
    ElMessage.warning(teacherEvidenceReviewBlockerText.value);
    return;
  }
  saving.value = true;
  try {
    snapshot.value = await closeWorkOrder(
      order.id,
      decision,
      teacherNote.value ||
        (decision === "accept"
          ? "学生补证据与反思已达到本轮形成性诊断要求，允许关闭诊断单。"
          : "证据仍不足，退回学生继续补齐关键材料。"),
    );
    ElMessage.success(
      decision === "accept" ? "教师验收已通过，诊断单已关闭" : "已退回学生补证据",
    );
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "教师验收处理失败");
  } finally {
    saving.value = false;
  }
}

function buildStudentEvidenceArtifact(): StudentReturnArtifact {
  return {
    failureSymptom: studentEvidenceForm.failureSymptom.trim(),
    minimalCase: studentEvidenceForm.minimalCase.trim(),
    verificationRecord: studentEvidenceForm.verificationRecord.trim(),
    evidenceLink: studentEvidenceForm.evidenceLink.trim(),
    integrityNote: "学生确认仅提交可复核证据、测试清单和修复说明，不提交可直接抄交的完整答案。",
  };
}

function buildStudentEvidenceContent(artifact: StudentReturnArtifact) {
  return [
    `失败现象：${artifact.failureSymptom}`,
    `最小失败用例：${artifact.minimalCase}`,
    `修复/验证记录：${artifact.verificationRecord}`,
    artifact.evidenceLink ? `PR/CI 链接：${artifact.evidenceLink}` : "",
    `诚信与安全边界：${artifact.integrityNote}`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function handleStudentModeReturn(step: ReturnStepKey) {
  const order = studentOrder.value;
  if (!order) return;
  if (!order.selectedDecision) {
    ElMessage.warning("教师确认后才能提交回流材料。");
    return;
  }
  if (step === "evidenceSubmitted" && !currentReturnState.value.scaffoldReceived) {
    ElMessage.warning("请先确认收到任务和安全边界。");
    return;
  }
  if (step === "evidenceSubmitted" && !studentStructuredEvidenceReady.value) {
    ElMessage.warning("请先补齐失败现象、最小用例、验证记录和安全确认。");
    return;
  }
  if (step === "reflectionSubmitted" && !currentReturnState.value.evidenceSubmitted) {
    ElMessage.warning("请先提交补充证据，再完成学习反思。");
    return;
  }
  if (step === "reflectionSubmitted" && !studentReflectionReady.value) {
    ElMessage.warning("请把学习反思补充到可复核长度。");
    return;
  }
  const artifact = step === "evidenceSubmitted" ? buildStudentEvidenceArtifact() : undefined;
  const content =
    step === "evidenceSubmitted"
      ? buildStudentEvidenceContent(artifact as StudentReturnArtifact)
      : step === "reflectionSubmitted"
        ? studentReflectionText.value
        : "学生确认已收到教师发布的学习任务。";
  saving.value = true;
  try {
    snapshot.value = await recordStudentReturn(order.id, step, content, artifact);
    ElMessage.success("已提交到教师端证据账本");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "学生回流提交失败");
  } finally {
    saving.value = false;
  }
}

async function copyStudentReturnUrl() {
  if (!studentReturnUrl.value) return;
  try {
    await navigator.clipboard.writeText(studentReturnUrl.value);
    ElMessage.success("学生回流链接已复制");
  } catch {
    ElMessage.info(studentReturnUrl.value);
  }
}

async function copyReviewerEntryUrl() {
  if (!reviewerEntryUrl.value) return;
  try {
    await navigator.clipboard.writeText(reviewerEntryUrl.value);
    ElMessage.success("质控审阅入口已复制");
  } catch {
    ElMessage.info(reviewerEntryUrl.value);
  }
}

function openTeacherEntry() {
  if (!teacherEntryUrl.value) return;
  window.open(teacherEntryUrl.value, "_blank", "noopener");
}

function openReviewerEntry() {
  if (!reviewerEntryUrl.value) return;
  window.open(reviewerEntryUrl.value, "_blank", "noopener");
}

function openStudentReturnUrl() {
  if (!studentReturnUrl.value) return;
  window.open(studentReturnUrl.value, "_blank", "noopener");
}

function openStudentReturnUrlFor(orderId: string) {
  const order = workOrders.value.find((item) => item.id === orderId);
  const url = studentReturnUrlFor(order);
  if (!url) {
    ElMessage.warning("这张诊断单还没有开放学生回流入口");
    return;
  }
  window.open(url, "_blank", "noopener");
}

function applyGithubImport() {
  const prMatch = githubImport.prUrl.match(/\/pull\/(\d+)/);
  const prNo = prMatch?.[1] ?? "待识别";
  intakeForm.courseClass = courseConfig.courseClass;
  intakeForm.courseName = courseConfig.courseName;
  intakeForm.trigger = `PR #${prNo} CI 失败`;
  intakeForm.evidenceText = [
    `仓库：${githubImport.repository}`,
    `分支：${githubImport.branch}`,
    `PR：${githubImport.prUrl}`,
    `CI 提供方：${courseConfig.ciProvider}`,
    `CI：${githubImport.ciRunUrl}`,
    `日志摘要：${githubImport.ciLog}`,
  ].join("\n");
  intakeForm.studentHelpText =
    "系统检测到 CI 失败与异常路径测试不足，建议教师先确认是否补证据或发布安全脚手架。";
  ElMessage.success("已解析 PR/CI 信息，可直接生成诊断单");
}

async function saveCourseConfig() {
  saving.value = true;
  saveApiBaseUrl(courseConfig.apiBaseUrl);
  saveLlmGatewayBaseUrl(courseConfig.llmGatewayBaseUrl);
  window.localStorage.setItem(courseConfigStorageKey, JSON.stringify(courseConfig));
  intakeForm.courseClass = courseConfig.courseClass;
  intakeForm.courseName = courseConfig.courseName;
  githubImport.repository = courseConfig.repository;
  try {
    if (courseConfig.apiBaseUrl.trim()) {
      const saved = await saveRemoteCourseSettings(courseConfig);
      applyCourseSettings(saved);
      apiStatus.value = "connected";
      apiStatusMessage.value = "课程设置已写入后端，后续 PR/CI 事件会进入教师工单队列。";
      apiCapabilities.value = [
        "read-teacher-workbench",
        "save-course-settings",
        "import-github-ci",
        "review-work-order",
        "publish-intervention-package",
        "close-work-order",
      ];
      if (apiStorageMode.value === "local-offline" || apiStorageMode.value === "pending") {
        apiStorageMode.value = "edge-api";
      }
    } else {
      apiStatus.value = "offline";
      apiStatusMessage.value = "未配置后端 API 地址，当前使用本地离线数据。";
      apiCapabilities.value = [];
      apiStorageMode.value = "local-offline";
    }
    snapshot.value = await getTeacherWorkbench();
    await loadGithubIntegrationStatus(false);
    courseDrawerOpen.value = false;
    ElMessage.success("课程、仓库与后端接入配置已保存");
  } catch (error) {
    apiStatus.value = "error";
    apiStatusMessage.value = error instanceof Error ? error.message : "课程设置写入后端失败。";
    ElMessage.warning("本地配置已保存，后端同步失败，请检测连接。");
  } finally {
    saving.value = false;
  }
}

async function handleReset() {
  snapshot.value = await resetWorkbench();
  teacherNote.value = "";
  ledgerDrawerOpen.value = false;
  searchText.value = "";
  riskFilter.value = "all";
  statusFilter.value = "all";
  selectedTodayIds.value = [];
  ElMessage.success("已重新载入今日工单队列");
}

async function handleExport() {
  const current = snapshot.value;
  const order = selectedOrder.value;
  if (!current || !order) return;
  const payload = await exportLedgerPackage(current, order.id);
  downloadJsonFile(payload, `SE-Path证据账本_${order.studentName}_${order.id}.json`);
  ElMessage.success("证据账本已导出");
}

function buildCurrentCourseReport() {
  const current = snapshot.value;
  if (!current) return null;
  return buildCourseWeeklyReport(current, {
    courseClass: courseConfig.courseClass,
    courseName: courseConfig.courseName,
    repository: courseConfig.repository,
    period: "2026-08-24 至 2026-08-30",
  });
}

function handleExportCourseReport(format: "markdown" | "json") {
  const report = buildCurrentCourseReport();
  if (!report) {
    ElMessage.warning("暂无课程运营数据可导出");
    return;
  }
  const safeClassName = courseConfig.courseClass.replace(/[\\/:*?"<>|\s]+/g, "-");
  if (format === "markdown") {
    downloadTextFile(
      report.markdown,
      `SE-Path课程周报_${safeClassName}_2026-08-30.md`,
      "text/markdown;charset=utf-8",
    );
    ElMessage.success("课程周报已下载");
    return;
  }
  downloadJsonFile(report, `SE-Path课程周报数据包_${safeClassName}_2026-08-30.json`);
  ElMessage.success("课程周报数据包已导出");
}

function handleExportCourseMicroTask() {
  const microTask = courseMicroTaskPackage.value;
  if (!microTask) {
    ElMessage.warning("暂无课堂微任务可导出");
    return;
  }
  const safeClassName = courseConfig.courseClass.replace(/[\\/:*?"<>|\s]+/g, "-");
  downloadTextFile(
    microTask.markdown,
    `SE-Path课堂微任务包_${safeClassName}_2026-08-30.md`,
    "text/markdown;charset=utf-8",
  );
  ElMessage.success("课堂微任务包已下载");
}

function buildCourseInterventionReviewExport() {
  const rows = courseInterventionReviewRows.value;
  const metrics = courseInterventionReviewMetrics.value;
  const exportedAt = new Date().toLocaleString("zh-CN", { hour12: false });
  const markdown = [
    "# SE-Path 课程干预效果复盘",
    "",
    `课程：${courseConfig.courseName}`,
    `班级：${courseConfig.courseClass}`,
    `仓库：${courseConfig.repository}`,
    `导出时间：${exportedAt}`,
    "",
    "> 使用边界：本复盘只用于形成性诊断、证据复核和下一轮教学改进，不用于学生排名、惩罚、就业预测或自动化终局评价。",
    "",
    "## 复盘总览",
    "",
    ...metrics.map((metric) => `- ${metric.label}：${metric.value}（${metric.hint}）`),
    "",
    "## 干预批次",
    "",
    ...(rows.length > 0
      ? rows.map(
          (row, index) =>
            `${index + 1}. ${row.title} / ${row.focus} / 目标 ${row.targetCount} 人 / 回流 ${row.returnedCount} 人 / 完成 ${row.completedCount} 人 / 可验收 ${row.acceptedReviewCount} 人 / 需补证 ${row.blockedReviewCount} 人 / 增值快照 ${row.snapshotCount} 个 / 平均证据覆盖 ${row.averageCoverage}% / 下一步：${row.action}`,
        )
      : ["暂无已发布课堂微任务，需先由教师确认并发布安全边界内的微任务。"]),
    "",
    "## 教师复盘口径",
    "",
    "- 学生回流不等于诊断结论，必须经过教师逐项证据复核。",
    "- 证据不足时保持“不确定/待补证”，不得强行生成增值结论。",
    "- 已沉淀快照仅表示本轮闭环可作为下一轮教学改进样本。",
  ].join("\n");
  return {
    product: "SE-Path 学伴",
    exportType: "course_intervention_effect_review",
    exportedAt,
    courseClass: courseConfig.courseClass,
    courseName: courseConfig.courseName,
    repository: courseConfig.repository,
    boundary: "形成性诊断，不排名、不惩罚、不自动评价学生。",
    summary: courseInterventionReviewSummaryText.value,
    metrics,
    interventions: rows,
    markdown,
  };
}

function handleExportCourseInterventionReview(format: "markdown" | "json") {
  const report = buildCourseInterventionReviewExport();
  const safeClassName = courseConfig.courseClass.replace(/[\\/:*?"<>|\s]+/g, "-");
  if (format === "markdown") {
    downloadTextFile(
      report.markdown,
      `SE-Path课程干预效果复盘_${safeClassName}_2026-08-30.md`,
      "text/markdown;charset=utf-8",
    );
    ElMessage.success("课程干预效果复盘已下载");
    return;
  }
  downloadJsonFile(report, `SE-Path课程干预效果复盘数据包_${safeClassName}_2026-08-30.json`);
  ElMessage.success("课程干预效果复盘数据包已导出");
}

function handleExportCourseTeachingImprovement() {
  const plan = courseTeachingImprovementPlan.value;
  if (!plan) {
    ElMessage.warning("暂无可导出的下轮教学改进单");
    return;
  }
  const safeClassName = courseConfig.courseClass.replace(/[\\/:*?"<>|\s]+/g, "-");
  downloadTextFile(
    plan.markdown,
    `SE-Path下轮教学改进单_${safeClassName}_2026-08-30.md`,
    "text/markdown;charset=utf-8",
  );
  ElMessage.success("下轮教学改进单已下载");
}

async function handlePublishCourseTeachingImprovement() {
  const plan = courseTeachingImprovementPlan.value;
  if (!plan) {
    ElMessage.warning("暂无可发布的下轮教学改进单");
    return;
  }
  if (courseTeachingImprovementPublished.value) {
    ElMessage.info("这份教学改进单已经写入相关诊断单账本");
    return;
  }
  saving.value = true;
  try {
    snapshot.value = await publishCourseTeachingImprovementPlan({
      ...plan,
      status: "published",
      publishedBy: "任课教师",
    });
    ElMessage.success("下轮教学改进单已发布，并写入相关工单账本");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "教学改进单发布失败");
  } finally {
    saving.value = false;
  }
}

function handleExportCourseTeachingImprovementExecution() {
  const receipt = courseTeachingImprovementExecutionReceipt.value;
  if (!receipt) {
    ElMessage.warning("暂无可导出的下轮课堂执行回证");
    return;
  }
  const safeClassName = courseConfig.courseClass.replace(/[\\/:*?"<>|\s]+/g, "-");
  downloadTextFile(
    receipt.markdown,
    `SE-Path下轮课堂执行回证_${safeClassName}_2026-08-30.md`,
    "text/markdown;charset=utf-8",
  );
  ElMessage.success("下轮课堂执行回证已下载");
}

async function handleRecordCourseTeachingImprovementExecution() {
  const receipt = courseTeachingImprovementExecutionReceipt.value;
  if (!receipt) {
    ElMessage.warning("暂无可登记的下轮课堂执行回证");
    return;
  }
  if (!courseTeachingImprovementPublished.value) {
    ElMessage.warning("请先发布下轮教学改进单，再登记课堂执行回证");
    return;
  }
  if (courseTeachingImprovementExecutionDone.value) {
    ElMessage.info("这份课堂执行回证已经写入相关诊断单账本");
    return;
  }
  saving.value = true;
  try {
    snapshot.value = await recordCourseTeachingImprovementExecution(receipt);
    ElMessage.success("下轮课堂执行回证已登记，并写入相关工单账本");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "课堂执行回证登记失败");
  } finally {
    saving.value = false;
  }
}

function handleExportCourseTeachingImprovementFollowup() {
  const sample = courseTeachingImprovementFollowupSample.value;
  if (!sample) {
    ElMessage.warning("暂无可导出的下轮效果采样单");
    return;
  }
  const safeClassName = courseConfig.courseClass.replace(/[\\/:*?"<>|\s]+/g, "-");
  downloadTextFile(
    sample.markdown,
    `SE-Path下轮效果采样单_${safeClassName}_2026-08-31.md`,
    "text/markdown;charset=utf-8",
  );
  ElMessage.success("下轮效果采样单已下载");
}

async function handleRecordCourseTeachingImprovementFollowup() {
  const sample = courseTeachingImprovementFollowupSample.value;
  if (!sample) {
    ElMessage.warning("暂无可登记的下轮效果采样单");
    return;
  }
  if (!courseTeachingImprovementExecutionDone.value) {
    ElMessage.warning("请先登记下轮课堂执行回证，再建立效果采样");
    return;
  }
  if (courseTeachingImprovementFollowupRecorded.value) {
    ElMessage.info("这份下轮效果采样单已经写入相关诊断单账本");
    return;
  }
  saving.value = true;
  try {
    snapshot.value = await recordCourseTeachingImprovementFollowupSample(sample);
    ElMessage.success("下轮效果采样单已登记，并写入相关工单账本");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "下轮效果采样登记失败");
  } finally {
    saving.value = false;
  }
}

function handleExportCourseTeachingImprovementFollowupResult() {
  const result = courseTeachingImprovementFollowupResult.value;
  if (!result) {
    ElMessage.warning("暂无可导出的采样结果回收单");
    return;
  }
  const safeClassName = courseConfig.courseClass.replace(/[\\/:*?"<>|\s]+/g, "-");
  downloadTextFile(
    result.markdown,
    `SE-Path采样结果回收单_${safeClassName}_2026-08-31.md`,
    "text/markdown;charset=utf-8",
  );
  ElMessage.success("采样结果回收单已下载");
}

async function handleRecordCourseTeachingImprovementFollowupResult() {
  const result = courseTeachingImprovementFollowupResult.value;
  if (!result) {
    ElMessage.warning("暂无可登记的采样结果回收单");
    return;
  }
  if (!courseTeachingImprovementFollowupRecorded.value) {
    ElMessage.warning("请先登记下轮效果采样单，再回收观察结果");
    return;
  }
  if (courseTeachingImprovementFollowupResultRecorded.value) {
    ElMessage.info("这份采样结果已经写入相关诊断单账本");
    return;
  }
  saving.value = true;
  try {
    snapshot.value = await recordCourseTeachingImprovementFollowupResult(result);
    ElMessage.success("采样结果已回收，并写入相关工单账本");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "采样结果回收登记失败");
  } finally {
    saving.value = false;
  }
}

function handleExportCourseResourceRevision() {
  const ticket = courseResourceRevisionTicket.value;
  if (!ticket) {
    ElMessage.warning("暂无可导出的课程资源改版工单");
    return;
  }
  const safeClassName = courseConfig.courseClass.replace(/[\\/:*?"<>|\s]+/g, "-");
  downloadTextFile(
    ticket.markdown,
    `SE-Path课程资源改版工单_${safeClassName}_2026-08-31.md`,
    "text/markdown;charset=utf-8",
  );
  ElMessage.success("课程资源改版工单已下载");
}

async function handleRecordCourseResourceRevision() {
  const ticket = courseResourceRevisionTicket.value;
  if (!ticket) {
    ElMessage.warning("暂无可登记的课程资源改版工单");
    return;
  }
  if (!courseTeachingImprovementFollowupResultRecorded.value) {
    ElMessage.warning("请先回收下轮采样结果，再登记课程资源改版");
    return;
  }
  if (courseResourceRevisionRecorded.value) {
    ElMessage.info("这份课程资源改版工单已经写入相关诊断单账本");
    return;
  }
  saving.value = true;
  try {
    snapshot.value = await recordCourseResourceRevisionTicket(ticket);
    ElMessage.success("课程资源改版已登记，并写入相关工单账本");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "课程资源改版登记失败");
  } finally {
    saving.value = false;
  }
}

function handleExportCourseResourceRelease() {
  const receipt = courseResourceReleaseReceipt.value;
  if (!receipt) {
    ElMessage.warning("暂无可导出的课程资源发布回证");
    return;
  }
  const safeClassName = courseConfig.courseClass.replace(/[\\/:*?"<>|\s]+/g, "-");
  downloadTextFile(
    receipt.markdown,
    `SE-Path课程资源发布回证_${safeClassName}_2026-08-31.md`,
    "text/markdown;charset=utf-8",
  );
  ElMessage.success("课程资源发布回证已下载");
}

async function handleRecordCourseResourceRelease() {
  const receipt = courseResourceReleaseReceipt.value;
  if (!receipt) {
    ElMessage.warning("暂无可登记的课程资源发布回证");
    return;
  }
  if (!courseResourceRevisionRecorded.value) {
    ElMessage.warning("请先登记课程资源改版工单，再登记发布回证");
    return;
  }
  if (courseResourceReleaseRecorded.value) {
    ElMessage.info("这份课程资源发布回证已经写入相关诊断单账本");
    return;
  }
  saving.value = true;
  try {
    snapshot.value = await recordCourseResourceReleaseReceipt(receipt);
    ElMessage.success("课程资源发布回证已登记，并写入相关工单账本");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "课程资源发布回证登记失败");
  } finally {
    saving.value = false;
  }
}

function handleExportCourseResourceUsage() {
  const receipt = courseResourceUsageReceipt.value;
  if (!receipt) {
    ElMessage.warning("暂无可导出的课程资源使用回流单");
    return;
  }
  const safeClassName = courseConfig.courseClass.replace(/[\\/:*?"<>|\s]+/g, "-");
  downloadTextFile(
    receipt.markdown,
    `SE-Path课程资源使用回流单_${safeClassName}_2026-08-31.md`,
    "text/markdown;charset=utf-8",
  );
  ElMessage.success("课程资源使用回流单已下载");
}

async function handleRecordCourseResourceUsage() {
  const receipt = courseResourceUsageReceipt.value;
  if (!receipt) {
    ElMessage.warning("暂无可登记的课程资源使用回流单");
    return;
  }
  if (!courseResourceReleaseRecorded.value) {
    ElMessage.warning("请先登记课程资源发布回证，再回收使用信号");
    return;
  }
  if (courseResourceUsageRecorded.value) {
    ElMessage.info("这份课程资源使用回流单已经写入相关诊断单账本");
    return;
  }
  saving.value = true;
  try {
    snapshot.value = await recordCourseResourceUsageReceipt(receipt);
    ElMessage.success("课程资源使用回流已登记，并写入相关工单账本");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "课程资源使用回流登记失败");
  } finally {
    saving.value = false;
  }
}

async function handleRemindCourseResourceUsage() {
  const reminder = courseResourceUsageReminder.value;
  if (!reminder) {
    ElMessage.warning("当前没有需要催办的资源使用回流对象");
    return;
  }
  if (!courseResourceUsageRecorded.value) {
    ElMessage.warning("请先登记课程资源使用回流，再催办未回流学生");
    return;
  }
  if (courseResourceUsageReminderRecorded.value) {
    ElMessage.info("这批资源使用催办已经写入账本");
    return;
  }
  saving.value = true;
  try {
    snapshot.value = await remindCourseResourceUsageTargets(reminder);
    ElMessage.success(`已催办 ${reminder.targetWorkOrderIds.length} 张诊断单的资源使用回流`);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "课程资源使用催办失败");
  } finally {
    saving.value = false;
  }
}

async function handlePublishCourseMicroTask() {
  const microTask = courseMicroTaskPackage.value;
  if (!microTask) {
    ElMessage.warning("暂无课堂微任务可发布");
    return;
  }
  if (courseMicroTaskPublished.value) {
    ElMessage.info("这份课堂微任务已经发布并写入账本");
    return;
  }
  saving.value = true;
  try {
    snapshot.value = await publishCourseMicroTaskPackage(microTask);
    ElMessage.success("课堂微任务已发布，并写入相关工单账本");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "课堂微任务发布失败");
  } finally {
    saving.value = false;
  }
}

async function handlePublishSelectedMicroTask() {
  const microTask = selectedTodayMicroTaskPackage.value;
  if (!microTask) {
    ElMessage.warning("请先勾选需要同批处理的诊断单");
    return;
  }
  if (selectedTodayMicroTaskPublished.value) {
    ElMessage.info("所选诊断单的课堂微任务已经写入账本");
    return;
  }
  saving.value = true;
  try {
    snapshot.value = await publishCourseMicroTaskPackage({
      ...microTask,
      teacherAction: `教师从今日任务收件箱批量确认：${microTask.teacherAction}`,
    });
    selectedTodayIds.value = [];
    ElMessage.success(`已向 ${microTask.affectedCount} 张诊断单下发微任务并写入账本`);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "批量微任务发布失败");
  } finally {
    saving.value = false;
  }
}

async function handleRemindPendingMicroTaskTargets() {
  const board = microTaskTrackingBoard.value;
  if (!board) {
    ElMessage.warning("当前没有可跟踪的同批课堂微任务");
    return;
  }
  const pendingIds = board.rows
    .filter((item) => item.returnDone < item.returnTotal)
    .map((item) => item.id);
  if (pendingIds.length === 0) {
    ElMessage.success("同批学生都已完成回流，无需催办");
    return;
  }
  saving.value = true;
  try {
    snapshot.value = await remindCourseMicroTaskTargets({
      traceId: board.traceId,
      title: board.title,
      targetWorkOrderIds: pendingIds,
      note: `同批课堂微任务仍有 ${pendingIds.length} 名学生未完成回流，请先领取任务包并补齐证据。`,
    });
    ElMessage.success(`已催办 ${pendingIds.length} 名未完成回流的学生，并写入证据账本`);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "同批任务催办失败");
  } finally {
    saving.value = false;
  }
}

async function handleCreateIntake() {
  if (!intakeForm.studentName.trim() || !intakeForm.studentNo.trim()) {
    ElMessage.warning("请填写学生姓名和学号");
    return;
  }
  if (!intakeForm.trigger.trim() || !intakeForm.evidenceText.trim()) {
    ElMessage.warning("请填写触发事件和证据文本");
    return;
  }
  saving.value = true;
  snapshot.value = await createWorkOrderFromIntake({ ...intakeForm });
  teacherNote.value = "";
  intakeDrawerOpen.value = false;
  saving.value = false;
  ElMessage.success("已生成新的增值诊断单");
}

onMounted(async () => {
  await loadWorkbench();
  await loadCourseOps();
});
</script>

<template>
  <main class="app-stage">
    <section v-if="studentMode" class="student-portal" v-loading="loading">
      <template v-if="studentOrder">
        <header class="student-portal-head">
          <div class="brand">
            <div class="brand-mark">SE</div>
            <div>
              <strong>SE-Path 学伴</strong>
              <span>学生回流页</span>
            </div>
          </div>
          <span class="date-pill">
            <el-icon><Calendar /></el-icon>
            {{ todayLabel }}
          </span>
          <span
            class="student-access-pill"
            :class="{ ok: studentReturnToken }"
            data-testid="student-return-access"
          >
            {{ studentReturnToken ? "专属链接已校验" : "缺少回流令牌" }}
          </span>
        </header>

        <section class="student-return-card" data-testid="student-portal">
          <div class="student-return-title">
            <div>
              <p>教师已确认的形成性学习任务</p>
              <h1>{{ studentOrder.studentName }}，请完成本轮回流</h1>
            </div>
            <span :class="riskTone(studentOrder)">
              {{ riskLabels[studentOrder.risk] }}
            </span>
          </div>

          <div class="student-task-grid">
            <article>
              <span>课程任务</span>
              <strong>{{ studentOrder.courseName }}</strong>
              <p>{{ studentOrder.trigger }} / {{ studentOrder.courseClass }}</p>
            </article>
            <article>
              <span>增值聚焦</span>
              <strong>{{ studentOrder.valueAdded.label }}</strong>
              <p>{{ studentOrder.safeVoiRecommendation }}</p>
            </article>
            <article>
              <span>安全边界</span>
              <strong>不提交完整答案</strong>
              <p>只补证据、测试清单、最小失败用例和反思。</p>
            </article>
          </div>

          <section
            v-if="hasReturnGuidance"
            class="return-guidance student"
            data-testid="student-return-guidance"
          >
            <div>
              <span>{{ returnRoundLabel }}</span>
              <strong>教师已退回补证据，请按要求重新提交</strong>
              <p>{{ currentReturnState.returnReason }}</p>
            </div>
            <small>待完成：{{ remainingReturnTaskText }}</small>
          </section>

          <section
            v-if="studentInterventionPackage"
            class="student-package"
            data-testid="student-task-package"
          >
            <div class="package-head">
              <div>
                <span>本轮任务包</span>
                <h2>{{ studentInterventionPackage.title }}</h2>
                <em v-if="studentInterventionPackage.teacherEdited" class="package-edited-mark">
                  教师确认稿
                </em>
              </div>
              <small>{{ studentInterventionPackage.dueHint }}</small>
            </div>
            <p>{{ studentInterventionPackage.objective }}</p>
            <ol>
              <li
                v-for="step in studentInterventionPackage.steps"
                :key="step"
              >
                {{ step }}
              </li>
            </ol>
            <div class="package-tags">
              <span
                v-for="item in studentInterventionPackage.evidenceToSubmit"
                :key="item"
              >
                {{ item }}
              </span>
            </div>
            <footer>
              <el-icon><CircleCheckFilled /></el-icon>
              安全边界：{{ studentInterventionPackage.safeBoundary }}
            </footer>
          </section>

          <section v-else class="student-package empty">
            <div class="package-head">
              <div>
                <span>本轮任务包</span>
                <h2>等待教师发布</h2>
              </div>
            </div>
            <p>教师完成复核并发布任务包后，这里会显示可执行步骤、证据要求和验收点。</p>
          </section>

          <div class="student-return-form">
            <button
              type="button"
              class="student-step"
              :class="{ done: currentReturnState.scaffoldReceived }"
              data-testid="student-portal-submit-scaffold"
              :disabled="!studentCanSubmit || currentReturnState.scaffoldReceived"
              @click="handleStudentModeReturn('scaffoldReceived')"
            >
              <el-icon><CircleCheckFilled /></el-icon>
              <span>
                <strong>确认收到任务</strong>
                <small>我已了解本轮任务和安全边界</small>
              </span>
            </button>

            <section class="student-evidence-card" data-testid="student-evidence-structured-form">
              <div class="student-evidence-head">
                <div>
                  <span>结构化补证据</span>
                  <strong>按教师复核顺序填写，不需要提交完整答案</strong>
                </div>
                <em data-testid="student-evidence-readiness">{{ studentEvidenceProgressText }}</em>
              </div>
              <div class="student-evidence-grid">
                <label>
                  <span>失败现象</span>
                  <textarea
                    v-model="studentEvidenceForm.failureSymptom"
                    data-testid="student-failure-field"
                    rows="3"
                    placeholder="例：空请求体提交订单接口时返回 500，预期应返回 400 与错误码"
                  ></textarea>
                </label>
                <label>
                  <span>最小失败用例</span>
                  <textarea
                    v-model="studentEvidenceForm.minimalCase"
                    data-testid="student-minimal-case-field"
                    rows="3"
                    placeholder="例：POST /orders，body={}，断言 status=400、code=ORDER_BODY_REQUIRED"
                  ></textarea>
                </label>
                <label>
                  <span>修复/验证记录</span>
                  <textarea
                    v-model="studentEvidenceForm.verificationRecord"
                    data-testid="student-verification-field"
                    rows="3"
                    placeholder="例：已补 boundary.spec.ts 3 个用例，CI #418 重跑通过 27/27"
                  ></textarea>
                </label>
                <label>
                  <span>PR / CI 链接（可选）</span>
                  <input
                    v-model="studentEvidenceForm.evidenceLink"
                    data-testid="student-evidence-link-field"
                    type="url"
                    placeholder="https://github.com/course/repo/pull/18"
                  />
                </label>
              </div>
              <label class="student-integrity-check">
                <input
                  v-model="studentEvidenceIntegrityChecked"
                  data-testid="student-integrity-check"
                  type="checkbox"
                />
                <span>我确认本次只提交可复核证据、测试清单和修复说明，不提交可直接抄交的完整答案。</span>
              </label>
              <div class="student-evidence-checklist" aria-label="补证据完整度">
                <span
                  v-for="item in studentEvidenceChecklist"
                  :key="item.key"
                  :class="{ ready: item.ready }"
                >
                  <el-icon><CircleCheckFilled /></el-icon>
                  {{ item.label }}
                </span>
              </div>
            </section>
            <button
              type="button"
              class="student-step"
              :class="{ done: currentReturnState.evidenceSubmitted }"
              data-testid="student-portal-submit-evidence"
              :disabled="
                !studentCanSubmit ||
                !currentReturnState.scaffoldReceived ||
                !studentStructuredEvidenceReady ||
                currentReturnState.evidenceSubmitted
              "
              @click="handleStudentModeReturn('evidenceSubmitted')"
            >
              <el-icon><Document /></el-icon>
              <span>
                <strong>提交补充证据</strong>
                <small>形成可复核证据包，写入教师端账本</small>
              </span>
            </button>

            <label>
              <span>学习反思</span>
              <textarea
                v-model="studentReflectionText"
                data-testid="student-reflection-field"
                rows="4"
                placeholder="说明这次卡点、你做了什么修复、下次如何迁移"
              ></textarea>
            </label>
            <button
              type="button"
              class="student-step primary"
              :class="{ done: currentReturnState.reflectionSubmitted }"
              data-testid="student-portal-submit-reflection"
              :disabled="
                !studentCanSubmit ||
                !currentReturnState.evidenceSubmitted ||
                !studentReflectionReady ||
                currentReturnState.reflectionSubmitted
              "
              @click="handleStudentModeReturn('reflectionSubmitted')"
            >
              <el-icon><TrendCharts /></el-icon>
              <span>
                <strong>提交反思并完成回流</strong>
                <small>{{ completedReturnCount }}/3 个回流节点已完成</small>
              </span>
            </button>

            <p
              v-if="completedReturnCount === 3"
              class="student-waiting-note"
              data-testid="student-waiting-teacher"
            >
              已提交到教师端，等待教师验收。本轮结果只用于形成性诊断，不会自动排名或惩罚。
            </p>
          </div>
        </section>
      </template>
    </section>

    <section v-else-if="reviewerMode" class="reviewer-console" v-loading="loading" data-testid="reviewer-console">
      <header class="reviewer-head">
        <div class="brand">
          <div class="brand-mark">SE</div>
          <div>
            <strong>SE-Path 学伴</strong>
            <span>质控审阅端</span>
          </div>
        </div>
        <div class="reviewer-actions">
          <span class="reviewer-pill">只读沙箱</span>
          <span class="reviewer-pill muted">{{ storageModeLabel }}</span>
          <button type="button" data-testid="open-teacher-entry" @click="openTeacherEntry">
            打开教师端
          </button>
          <button type="button" data-testid="copy-reviewer-entry" @click="copyReviewerEntryUrl">
            复制审阅入口
          </button>
        </div>
      </header>

      <section class="reviewer-hero">
        <div>
          <p>质控视角只看脱敏证据，不进入教学决策</p>
          <h1>软件工程学习闭环审阅台</h1>
        </div>
        <div class="reviewer-boundary">
          <strong>审阅边界</strong>
          <span>智能体只给候选建议</span>
          <span>教师确认后生效</span>
          <span>增值评价不排名不惩罚</span>
        </div>
      </section>

      <section class="reviewer-metrics" data-testid="reviewer-metrics">
        <article>
          <span>今日诊断单</span>
          <strong>{{ reviewerMetrics.orders }}</strong>
          <p>来自 PR / CI / 课堂回流</p>
        </article>
        <article>
          <span>教师已复核</span>
          <strong>{{ reviewerMetrics.reviewedCount }}</strong>
          <p>候选建议经过人工确认</p>
        </article>
        <article>
          <span>已闭环</span>
          <strong>{{ reviewerMetrics.closedCount }}</strong>
          <p>学生补证据并提交反思</p>
        </article>
        <article>
          <span>平均证据覆盖</span>
          <strong>{{ reviewerMetrics.averageCoverage }}%</strong>
          <p>缺证据时保持不确定</p>
        </article>
      </section>

      <section v-if="selectedOrder" class="reviewer-case" data-testid="reviewer-readonly-case">
        <article class="reviewer-diagnosis">
          <div class="section-head">
            <div>
              <h2>脱敏诊断单</h2>
              <p>匿名学习者 {{ selectedOrder.studentNo.slice(-4) }} / {{ selectedOrder.courseName }}</p>
            </div>
            <span class="risk-badge" :class="riskTone(selectedOrder)">
              {{ riskLabels[selectedOrder.risk] }}
            </span>
          </div>
          <div class="reviewer-focus">
            <span>增值聚焦</span>
            <strong>{{ selectedOrder.valueAdded.label }}</strong>
            <p>{{ selectedOrder.valueAdded.description }}</p>
          </div>
          <div class="reviewer-delta">
            <div>
              <span>当前</span>
              <strong>{{ selectedOrder.valueAdded.current }}</strong>
            </div>
            <div>
              <span>期望</span>
              <strong>{{ selectedOrder.valueAdded.expected }}</strong>
            </div>
            <div>
              <span>差值</span>
              <strong>{{ valueDeltaText(selectedOrder) }}</strong>
            </div>
            <div>
              <span>覆盖</span>
              <strong>{{ selectedOrder.evidenceCoverage }}%</strong>
            </div>
          </div>
          <p class="readonly-note">
            审阅端不提供批准、退回或转人工按钮；这里只核验证据链、增值逻辑和人工复核边界。
          </p>
        </article>

        <aside class="reviewer-flow" data-testid="reviewer-flow">
          <h2>闭环链路</h2>
          <ol>
            <li v-for="item in reviewerFlow" :key="item">{{ item }}</li>
          </ol>
        </aside>
      </section>

      <section class="reviewer-ledger" data-testid="reviewer-ledger-preview">
        <div class="section-head">
          <div>
            <h2>证据账本摘要</h2>
            <p>{{ reviewerMetrics.ledgerCount }} 条留痕，按来源、可信度和是否可用于诊断区分。</p>
          </div>
        </div>
        <div class="reviewer-evidence-list">
          <article v-for="item in visibleEvidence" :key="item.id">
            <span :class="evidenceStatusClass(item.status)"></span>
            <div>
              <strong>{{ item.title }}</strong>
              <p>{{ item.source }} / {{ evidenceStatusLabel(item.status) }}</p>
            </div>
          </article>
        </div>
      </section>
    </section>

    <section v-else class="teacher-console" v-loading="loading">
      <header class="topbar">
        <div class="brand">
          <div class="brand-mark">SE</div>
          <div>
            <strong>SE-Path 学伴</strong>
            <span>教师工作台</span>
          </div>
        </div>

        <button
          type="button"
          class="course-pill"
          data-testid="open-course-settings"
          @click="courseDrawerOpen = true"
        >
          <span>{{ selectedOrder?.courseClass ?? "软件工程 2301" }}</span>
          <i>/</i>
          <strong>
            {{ selectedOrder?.courseName ?? "REST API 错误处理与边界测试" }}
          </strong>
          <el-icon><ArrowDown /></el-icon>
        </button>

        <div class="top-actions">
          <button
            type="button"
            class="launch-pill"
            data-testid="open-course-launch"
            @click="openLaunchWizard"
          >
            <el-icon><DataBoard /></el-icon>
            开课初始化
          </button>
          <span
            class="api-pill"
            :class="{ live: apiStatus === 'connected', warn: apiStatus === 'error' || apiStatus === 'checking' }"
          >
            {{ connectionModeLabel }}
          </span>
          <button
            type="button"
            class="auth-pill"
            :class="{ live: authSessionActive, warn: !authSessionActive && (apiRequiresToken || apiStatus === 'error') }"
            data-testid="teacher-auth-entry"
            @click="authSessionActive ? handleTeacherLogout() : (teacherLoginOpen = true)"
          >
            <el-icon><User /></el-icon>
            {{ authModeLabel }}
          </button>
          <button
            type="button"
            class="ghost-pill value-engine-pill"
            data-testid="open-value-engine"
            @click="valueEngineDrawerOpen = true"
          >
            <el-icon><Compass /></el-icon>
            增值引擎
          </button>
          <button
            type="button"
            class="ghost-pill"
            data-testid="open-agent-guide"
            @click="agentDrawerOpen = true"
          >
            <el-icon><ChatLineRound /></el-icon>
            智能体
          </button>
          <button
            type="button"
            class="ghost-pill"
            data-testid="open-intake"
            @click="intakeDrawerOpen = true"
          >
            <el-icon><EditPen /></el-icon>
            导入事件
          </button>
          <button
            type="button"
            class="ghost-pill"
            data-testid="open-course-ops"
            @click="openCourseOps"
          >
            <el-icon><Tickets /></el-icon>
            课程运营
          </button>
          <span class="date-pill">
            <el-icon><Calendar /></el-icon>
            {{ todayLabel }}
          </span>
          <button
            type="button"
            class="review-entry-pill"
            data-testid="open-reviewer-entry"
            @click="openReviewerEntry"
          >
            质控审阅
          </button>
          <img
            class="teacher-avatar"
            src="/assets/avatar-teacher-zhang.png"
            alt="张老师"
          />
          <button type="button" class="teacher-pill">
            张老师
            <el-icon><ArrowDown /></el-icon>
          </button>
        </div>
      </header>

      <aside class="dock" aria-label="功能导航">
        <button
          v-for="item in navItems"
          :key="item.label"
          type="button"
          :class="{ active: navItemActive(item.label) }"
          :title="item.label"
          @click="handleNavClick(item.label)"
        >
          <el-icon><component :is="item.icon" /></el-icon>
        </button>
        <span></span>
      </aside>

      <template v-if="selectedOrder">
        <section class="workspace-head">
          <div>
            <p>今日课堂任务先处理，再进入单张诊断闭环</p>
            <h1>今日任务收件箱</h1>
          </div>
          <div class="head-badges">
            <span class="soft-badge">
              <i></i>
              教学诊断
            </span>
            <span class="risk-badge" :class="riskTone(selectedOrder)">
              {{ riskLabels[selectedOrder.risk] }}
            </span>
          </div>
        </section>

        <section class="value-engine-strip" data-testid="value-engine-strip">
          <button
            type="button"
            class="value-engine-card primary"
            data-testid="open-value-engine-from-strip"
            @click="valueEngineDrawerOpen = true"
          >
            <span>增值引擎</span>
            <strong>把过程证据变成可复核的学习闭环</strong>
            <small>查看平台核心能力</small>
            <el-icon><ArrowRight /></el-icon>
          </button>
          <article
            v-for="item in valueEngineHighlights"
            :key="item.title"
            class="value-engine-card"
          >
            <span>{{ item.title }}</span>
            <strong>{{ item.subtitle }}</strong>
            <small>{{ item.detail }}</small>
          </article>
        </section>

        <section class="today-inbox-board" data-testid="today-task-inbox">
          <div class="today-inbox-main">
            <div class="today-board-head">
              <div>
                <span>教师今日工作流</span>
                <h2>按风险、证据缺口和待复核动作排序</h2>
                <p>系统只整理候选诊断和下一步建议；是否发布、退回或验收仍由教师决定。</p>
              </div>
              <button type="button" data-testid="today-open-launch" @click="openLaunchWizard">
                开课初始化
                <el-icon><ArrowRight /></el-icon>
              </button>
            </div>

            <div class="today-kpis">
              <article
                v-for="metric in todayInboxMetrics"
                :key="metric.label"
                :class="`tone-${metric.tone}`"
              >
                <span>{{ metric.label }}</span>
                <strong>{{ metric.value }}</strong>
                <small>{{ metric.hint }}</small>
              </article>
            </div>

            <div class="today-batch-bar" data-testid="today-batch-bar">
              <div>
                <span data-testid="today-selected-count">已选 {{ selectedTodayIds.length }} 张诊断单</span>
                <strong>
                  {{ selectedTodayMicroTaskPackage?.sourceGap ?? "选择同类工单，批量下发补证据任务" }}
                </strong>
                <small>{{ selectedTodayBatchSummary }}</small>
              </div>
              <div class="today-batch-actions">
                <button
                  type="button"
                  data-testid="today-select-all"
                  :disabled="!todayInboxRows.length || todayInboxAllSelected"
                  @click="selectAllTodayRows"
                >
                  全选当前队列
                </button>
                <button
                  type="button"
                  data-testid="today-clear-selection"
                  :disabled="!selectedTodayIds.length"
                  @click="clearTodaySelection"
                >
                  清空
                </button>
                <button
                  type="button"
                  class="primary"
                  data-testid="today-publish-selected-micro-task"
                  :disabled="saving || !selectedTodayIds.length || selectedTodayMicroTaskPublished"
                  @click="handlePublishSelectedMicroTask"
                >
                  {{ selectedTodayMicroTaskPublished ? "已写入账本" : "批量下发微任务" }}
                </button>
              </div>
            </div>

            <div class="today-table" role="table" aria-label="今日待处理工单">
              <div class="today-row today-row-head" role="row">
                <span></span>
                <span>学生</span>
                <span>触发事件</span>
                <span>阶段</span>
                <span>证据</span>
                <span>下一步</span>
                <span>操作</span>
              </div>
              <div
                v-for="row in todayInboxRows"
                :key="row.id"
                class="today-row"
                :class="{
                  active: row.id === selectedOrder.id,
                  selected: selectedTodayIds.includes(row.id),
                }"
                role="row"
              >
                <label class="today-select-cell" @click.stop>
                  <input
                    type="checkbox"
                    :checked="selectedTodayIds.includes(row.id)"
                    :data-testid="`today-select-${row.id}`"
                    :aria-label="`选择 ${row.studentName} 的诊断单`"
                    @change="toggleTodaySelection(row.id)"
                  />
                  <span></span>
                </label>
                <span>
                  <strong>{{ row.studentName }}</strong>
                  <small>{{ row.studentNo }}</small>
                </span>
                <span>
                  <strong>{{ row.trigger }}</strong>
                  <small>{{ row.focus }} · {{ riskLabels[row.risk] }}</small>
                </span>
                <span>
                  <em>{{ statusLabels[row.status] }}</em>
                  <small>回流 {{ row.returnDone }}/3</small>
                </span>
                <span>
                  <strong>{{ row.evidenceCoverage }}%</strong>
                  <small>{{ row.missingCount }} 个缺口</small>
                </span>
                <span>
                  <strong>{{ row.action }}</strong>
                  <small>优先级 {{ row.score }}</small>
                </span>
                <span class="today-row-action">
                  <button
                    type="button"
                    :data-testid="`today-row-${row.id}`"
                    @click="handleSelectOrder(row.id)"
                  >
                    处理
                  </button>
                </span>
              </div>
              <p v-if="!todayInboxRows.length" class="empty-inbox wide">
                当前筛选下没有待处理工单，可从“开课初始化”或“导入事件”创建首轮诊断单。
              </p>
            </div>
          </div>

          <aside class="today-focus-card">
            <span>当前选中</span>
            <strong>{{ selectedOrder.studentName }}</strong>
            <p>{{ selectedTeacherAction }}</p>
            <dl>
              <div>
                <dt>队列位置</dt>
                <dd>{{ selectedQueueRank ? `#${selectedQueueRank}` : "已筛出" }}</dd>
              </div>
              <div>
                <dt>证据覆盖</dt>
                <dd>{{ selectedOrder.evidenceCoverage }}%</dd>
              </div>
              <div>
                <dt>闭环阶段</dt>
                <dd>{{ statusLabels[selectedOrder.status] }}</dd>
              </div>
            </dl>
            <div
              v-if="selectedOrder.interventionPackage"
              class="today-student-entry"
              data-testid="today-student-return-entry"
            >
              <span>学生入口</span>
              <strong>{{ completedReturnCount }}/3 已回流</strong>
              <small>任务包已开放，学生领取和补证据会写入账本</small>
              <button
                type="button"
                data-testid="today-open-student-return"
                @click="openStudentReturnUrl"
              >
                打开学生页
                <el-icon><ArrowRight /></el-icon>
              </button>
            </div>
            <button
              type="button"
              data-testid="today-focus-diagnosis"
              @click="scrollToDiagnosis"
            >
              进入诊断单
              <el-icon><ArrowRight /></el-icon>
            </button>
          </aside>
        </section>

        <section
          v-if="microTaskTrackingBoard"
          class="batch-tracking-panel"
          data-testid="batch-micro-task-tracking"
        >
          <div class="batch-track-head">
            <div>
              <span>同批课堂微任务</span>
              <h2>{{ microTaskTrackingBoard.title }}</h2>
              <p>同一批下发的学生领取、补证据和教师验收进度集中在这里，避免教师逐张工单翻找。</p>
            </div>
            <div class="batch-track-tools">
              <code>{{ microTaskTrackingBoard.traceId }}</code>
              <button
                type="button"
                data-testid="batch-tracking-remind-pending"
                :disabled="saving || microTaskTrackingPendingCount === 0"
                @click="handleRemindPendingMicroTaskTargets"
              >
                提醒未回流 {{ microTaskTrackingPendingCount }}
              </button>
            </div>
          </div>

          <div class="batch-track-metrics">
            <article>
              <span>下发对象</span>
              <strong>{{ microTaskTrackingBoard.targetCount }}</strong>
            </article>
            <article>
              <span>已领取</span>
              <strong data-testid="batch-tracking-started">
                {{ microTaskTrackingBoard.startedCount }}
              </strong>
            </article>
            <article>
              <span>可验收</span>
              <strong>{{ microTaskTrackingBoard.reviewReadyCount }}</strong>
            </article>
            <article>
              <span>平均覆盖</span>
              <strong>{{ microTaskTrackingBoard.averageCoverage }}%</strong>
            </article>
          </div>

          <div class="batch-track-table" role="table" aria-label="同批微任务学生跟踪">
            <div class="batch-track-row batch-track-row-head" role="row">
              <span>学生</span>
              <span>回流</span>
              <span>证据</span>
              <span>当前动作</span>
              <span>操作</span>
            </div>
            <div
              v-for="member in microTaskTrackingBoard.rows"
              :key="member.id"
              class="batch-track-row"
              :class="{ active: member.selected, ready: member.reviewReady }"
              :data-testid="`batch-tracking-row-${member.id}`"
              role="row"
            >
              <span>
                <strong>{{ member.studentName }}</strong>
                <small>{{ member.studentNo }} · {{ riskLabels[member.risk] }}</small>
              </span>
              <span>
                <strong>{{ member.returnDone }}/{{ member.returnTotal }}</strong>
                <small>{{ member.stage }}</small>
              </span>
              <span>
                <strong>{{ member.evidenceCoverage }}%</strong>
                <small>诊断证据覆盖</small>
              </span>
              <span>
                <strong>{{ member.action }}</strong>
                <small>{{ member.reviewReady ? "可进入复核" : "继续等待学生回流" }}</small>
              </span>
              <span class="batch-track-actions">
                <button
                  type="button"
                  :data-testid="`batch-tracking-select-${member.id}`"
                  @click="handleSelectOrder(member.id)"
                >
                  复核
                </button>
                <button
                  type="button"
                  :data-testid="`batch-tracking-open-student-${member.id}`"
                  :disabled="!member.studentUrl"
                  @click="openStudentReturnUrlFor(member.id)"
                >
                  学生页
                </button>
              </span>
            </div>
          </div>
        </section>

        <section class="hero-grid">
          <aside class="inbox-panel" data-testid="work-order-inbox">
            <div class="inbox-head">
              <div>
                <span>今日待办</span>
                <h2>工单收件箱</h2>
              </div>
              <strong>{{ filteredWorkOrders.length }}/{{ queueSummary.total }}</strong>
            </div>

            <el-input
              v-model="searchText"
              data-testid="queue-search"
              clearable
              placeholder="搜索学生 / PR / CI / 课程"
              class="queue-search"
            />

            <div class="filter-row" aria-label="风险筛选">
              <button
                v-for="option in riskOptions"
                :key="option.value"
                type="button"
                :class="{ active: riskFilter === option.value }"
                @click="riskFilter = option.value"
              >
                {{ option.label }}
              </button>
            </div>

            <div class="filter-row status-filter" aria-label="阶段筛选">
              <button
                v-for="option in statusOptions"
                :key="option.value"
                type="button"
                :class="{ active: statusFilter === option.value }"
                @click="statusFilter = option.value"
              >
                {{ option.label }}
              </button>
            </div>

            <div class="case-switcher" aria-label="今日待办队列">
              <button
                v-for="order in filteredWorkOrders"
                :key="order.id"
                type="button"
                :class="{ active: order.id === selectedOrder.id }"
                :data-testid="`case-${order.id}`"
                @click="handleSelectOrder(order.id)"
              >
                <span>{{ order.studentName.slice(0, 1) }}</span>
                <strong>{{ order.studentName }}</strong>
                <em>{{ statusLabels[order.status] }}</em>
              </button>
              <p v-if="!filteredWorkOrders.length" class="empty-inbox">
                没有符合条件的工单
              </p>
            </div>
          </aside>

          <article class="diagnosis-card" data-testid="diagnosis-review-section">
            <div class="student-strip">
              <img
                class="student-avatar"
                src="/assets/avatar-lin-zhixing.png"
                :alt="selectedOrder.studentName"
              />
              <div>
                <h2>{{ selectedOrder.studentName }}</h2>
                <p>学号：{{ selectedOrder.studentNo }}</p>
                <span class="profile-chip">
                  <el-icon><User /></el-icon>
                  学生画像
                </span>
              </div>
              <dl>
                <div>
                  <dt>触发事件</dt>
                  <dd>{{ selectedOrder.trigger }}</dd>
                </div>
                <div>
                  <dt>发生时间</dt>
                  <dd>{{ selectedOrder.eventDate }}</dd>
                </div>
              </dl>
              <span class="risk-pill" :class="riskTone(selectedOrder)">
                <el-icon><WarningFilled /></el-icon>
                {{ riskLabels[selectedOrder.risk] }}
              </span>
            </div>

            <div class="value-panel">
              <div class="value-icon">
                <el-icon><Compass /></el-icon>
              </div>
              <div class="value-copy">
                <span>增值聚焦（核心薄弱能力）</span>
                <h3>{{ selectedOrder.valueAdded.label }}</h3>
                <p>{{ selectedOrder.valueAdded.description }}</p>
              </div>
              <div class="metric-set">
                <div>
                  <span>当前水平</span>
                  <strong class="blue">{{ selectedOrder.valueAdded.current }}</strong>
                </div>
                <div>
                  <span>期望水平</span>
                  <strong>{{ selectedOrder.valueAdded.expected }}</strong>
                </div>
                <div>
                  <span>差值</span>
                  <strong class="red">{{ valueDeltaText(selectedOrder) }}</strong>
                </div>
                <div>
                  <span>证据覆盖率</span>
                  <strong>{{ selectedOrder.evidenceCoverage }}%</strong>
                </div>
              </div>
              <div class="certainty-track" aria-label="诊断不确定性">
                <span>确定</span>
                <div>
                  <i :style="{ left: `${selectedOrder.evidenceCoverage}%` }"></i>
                </div>
                <span>不确定</span>
              </div>
              <p class="warning-note" :class="uncertaintyTone(selectedOrder)">
                <el-icon><WarningFilled /></el-icon>
                <span>
                  <strong>{{ uncertaintyLabel(selectedOrder.valueAdded.uncertainty) }}：</strong>
                  {{ uncertaintyAdvice(selectedOrder) }}
                </span>
              </p>
            </div>

            <div
              v-if="selectedValueSnapshot"
              class="value-snapshot-panel"
              data-testid="value-added-snapshot"
            >
              <div class="snapshot-copy">
                <span>已沉淀增值快照</span>
                <strong>{{ selectedValueSnapshot.claim }}</strong>
                <p>{{ selectedValueSnapshot.boundary }}</p>
              </div>
              <dl>
                <div>
                  <dt>基线</dt>
                  <dd>{{ selectedValueSnapshot.baseline }}</dd>
                </div>
                <div>
                  <dt>验收</dt>
                  <dd>{{ selectedValueSnapshot.observed }}</dd>
                </div>
                <div>
                  <dt>提升</dt>
                  <dd>+{{ selectedValueSnapshot.uplift }}</dd>
                </div>
                <div>
                  <dt>证据</dt>
                  <dd>{{ selectedValueSnapshot.evidenceCoverage }}%</dd>
                </div>
              </dl>
              <p class="snapshot-next">
                {{ selectedValueSnapshot.nextTeachingAction }}
              </p>
            </div>
          </article>

          <aside class="decision-card">
            <div class="decision-head">
              <div>
                <p>Safe-VOI 推荐</p>
                <h2>先补最高价值证据</h2>
              </div>
              <span>低风险</span>
            </div>
            <div class="recommendation">
              <span class="blue-orb">
                <el-icon><EditPen /></el-icon>
              </span>
              <div>
                <strong>{{ selectedOrder.safeVoiRecommendation }}</strong>
                <p>理由：{{ selectedOrder.safeVoiReason }}</p>
              </div>
            </div>

            <label class="teacher-note">
              <span>教师备注</span>
              <input
                v-model="teacherNote"
                type="text"
                data-testid="teacher-note"
                placeholder="写给学生或复核记录的简短说明"
              />
            </label>

            <div class="decision-list">
              <button
                v-for="option in decisionOptions"
                :key="option.id"
                type="button"
                :class="{ active: selectedOrder.selectedDecision === option.id }"
                :data-testid="option.testId"
                :disabled="saving || selectedOrder.status === 'closed'"
                @click="handleDecision(option.id)"
              >
                <span>
                  <el-icon>
                    <Check v-if="selectedOrder.selectedDecision === option.id" />
                    <ArrowRight v-else />
                  </el-icon>
                </span>
                <strong>{{ option.title }}</strong>
                <small>{{ option.subtitle }}</small>
                <el-icon class="tail"><ArrowRight /></el-icon>
              </button>
            </div>

            <div
              v-if="readyForTeacherClosure && teacherEvidenceReviewItems.length"
              class="teacher-evidence-review-panel"
              data-testid="teacher-evidence-review-panel"
            >
              <div class="teacher-review-head">
                <div>
                  <span>学生证据复核</span>
                  <strong>{{ teacherEvidenceReviewBlockerText }}</strong>
                </div>
                <em data-testid="teacher-evidence-review-progress">
                  {{ teacherEvidenceReviewProgressText }}
                </em>
              </div>

              <div class="teacher-review-items">
                <article
                  v-for="item in teacherEvidenceReviewItems"
                  :key="item.key"
                  class="teacher-review-item"
                  :data-testid="`teacher-evidence-review-item-${item.key}`"
                >
                  <div class="teacher-review-copy">
                    <span>
                      {{ item.label }}
                      <small v-if="item.required">必核</small>
                    </span>
                    <p>{{ item.value }}</p>
                  </div>
                  <div class="teacher-review-switch">
                    <button
                      v-for="option in teacherEvidenceReviewOptions"
                      :key="option.id"
                      type="button"
                      :class="{ active: teacherEvidenceReviewStatus(item) === option.id }"
                      :data-testid="`teacher-evidence-review-${item.key}-${option.id}`"
                      :disabled="saving || selectedOrder.status === 'closed'"
                      @click="setTeacherEvidenceReviewStatus(item.key, option.id)"
                    >
                      {{ option.label }}
                    </button>
                  </div>
                </article>
              </div>

              <label class="teacher-review-note">
                <span>复核备注</span>
                <textarea
                  v-model="teacherEvidenceReviewNote"
                  rows="2"
                  data-testid="teacher-evidence-review-note"
                  placeholder="写下退回原因或验收依据，保存后进入证据账本"
                ></textarea>
              </label>

              <button
                type="button"
                class="teacher-review-save"
                data-testid="teacher-evidence-review-save"
                :disabled="
                  saving ||
                  selectedOrder.status === 'closed' ||
                  teacherEvidenceReviewPendingCount > 0
                "
                @click="handleTeacherEvidenceReviewSave"
              >
                保存证据复核
              </button>
            </div>

            <div
              v-if="readyForTeacherClosure"
              class="decision-closure-actions"
              data-testid="teacher-closure-panel"
            >
              <div>
                <span>等待教师验收</span>
                <strong>学生已完成 3/3 回流</strong>
                <p>验收通过前需先保存学生证据复核；证据不足则退回继续补证据。</p>
              </div>
              <button
                type="button"
                data-testid="close-work-order"
                :disabled="saving || !teacherEvidenceReviewReadyForClosure"
                @click="handleTeacherClosure('accept')"
              >
                验收通过
              </button>
              <button
                type="button"
                class="ghost"
                data-testid="return-closure-evidence"
                :disabled="saving"
                @click="handleTeacherClosure('returnEvidence')"
              >
                退回补证据
              </button>
            </div>

            <div
              v-if="currentInterventionPackage"
              class="task-package-panel"
              data-testid="intervention-package-card"
            >
              <div class="package-head">
                <div>
                  <span>已发布任务包</span>
                  <h3>{{ currentInterventionPackage.title }}</h3>
                </div>
                <small>
                  {{ interventionPackageStatusLabel(currentInterventionPackage.status) }}
                  {{ currentInterventionPackage.teacherEdited ? " · 教师确认稿" : "" }}
                </small>
              </div>
              <p>{{ currentInterventionPackage.objective }}</p>
              <ol>
                <li
                  v-for="step in currentInterventionPackage.steps.slice(0, 3)"
                  :key="step"
                >
                  {{ step }}
                </li>
              </ol>
              <div class="package-tags">
                <span
                  v-for="item in currentInterventionPackage.evidenceToSubmit.slice(0, 4)"
                  :key="item"
                >
                  {{ item }}
                </span>
              </div>
            </div>

            <div v-else class="package-draft-panel" data-testid="package-draft-editor">
              <div class="package-draft-head">
                <div>
                  <span>发布前任务包</span>
                  <strong>教师确认后才开放学生入口</strong>
                </div>
                <div class="package-draft-actions">
                  <small>{{ packageDraftStepCount }} 步 / {{ packageDraftEvidenceCount }} 类证据</small>
                  <button
                    type="button"
                    class="agent-draft-button"
                    data-testid="generate-ai-scaffold-draft"
                    :disabled="!canGenerateAiScaffold"
                    @click="handleGenerateAiScaffoldDraft"
                  >
                    <el-icon><ChatLineRound /></el-icon>
                    <span>
                      <strong>{{ aiScaffoldLoading ? "生成中" : "智能生成草稿" }}</strong>
                      <small>{{ aiScaffoldStatus || llmGatewayModeLabel }}</small>
                    </span>
                  </button>
                </div>
              </div>

              <label class="package-draft-field">
                <span>任务标题</span>
                <input
                  v-model="packageDraftForm.title"
                  data-testid="package-draft-title"
                  type="text"
                  placeholder="例如：安全脚手架任务包"
                  @input="markPackageDraftTouched"
                />
              </label>

              <label class="package-draft-field">
                <span>任务目标</span>
                <textarea
                  v-model="packageDraftForm.objective"
                  data-testid="package-draft-objective"
                  rows="3"
                  placeholder="说明学生本轮要完成的可复核改进"
                  @input="markPackageDraftTouched"
                ></textarea>
              </label>

              <div class="package-draft-grid">
                <label class="package-draft-field">
                  <span>学生执行步骤</span>
                  <textarea
                    v-model="packageDraftForm.stepsText"
                    data-testid="package-draft-steps"
                    rows="6"
                    placeholder="每行一个步骤"
                    @input="markPackageDraftTouched"
                  ></textarea>
                </label>
                <label class="package-draft-field">
                  <span>需提交证据</span>
                  <textarea
                    v-model="packageDraftForm.evidenceText"
                    data-testid="package-draft-evidence"
                    rows="6"
                    placeholder="每行一类证据"
                    @input="markPackageDraftTouched"
                  ></textarea>
                </label>
              </div>

              <label class="package-draft-field">
                <span>教师验收点</span>
                <textarea
                  v-model="packageDraftForm.rubricText"
                  data-testid="package-draft-rubric"
                  rows="4"
                  placeholder="每行一个验收点"
                  @input="markPackageDraftTouched"
                ></textarea>
              </label>

              <div class="package-draft-grid compact">
                <label class="package-draft-field">
                  <span>截止提示</span>
                  <input
                    v-model="packageDraftForm.dueHint"
                    data-testid="package-draft-due"
                    type="text"
                    placeholder="例如：本次课后 24 小时内"
                    @input="markPackageDraftTouched"
                  />
                </label>
                <label class="package-draft-field">
                  <span>安全边界</span>
                  <textarea
                    v-model="packageDraftForm.safeBoundary"
                    data-testid="package-draft-boundary"
                    rows="3"
                    placeholder="不提供完整答案，不替代教师评价"
                    @input="markPackageDraftTouched"
                  ></textarea>
                </label>
              </div>

              <div class="package-draft-status">
                <span>{{ packageDraftRubricCount }} 个验收点</span>
                <strong>{{ packageDraftValidation || "草稿可发布" }}</strong>
              </div>

              <button
                type="button"
                class="publish-package-button"
                data-testid="publish-package"
                :disabled="!canPublishPackage"
                @click="handlePublishPackage"
              >
                <el-icon><CircleCheckFilled /></el-icon>
                <span>
                  <strong>确认发布任务包</strong>
                  <small>{{ packageDraftValidation || "写入账本并开放学生回流入口" }}</small>
                </span>
              </button>
            </div>

            <p class="safety-line">
              <el-icon><CircleCheckFilled /></el-icon>
              智能体只提供候选建议，教师确认后生效；不展示完整答案或可直接提交代码。
            </p>
          </aside>
        </section>

        <section class="lower-grid">
          <article class="evidence-card" data-testid="evidence-ledger-preview">
            <div class="section-head">
              <div>
                <h2>证据账本</h2>
                <p>支持本次诊断的证据与缺失证据</p>
              </div>
              <div class="legend">
                <span><i class="collected"></i>已验证</span>
                <span><i class="pending"></i>待确认</span>
                <span><i class="missing"></i>缺失</span>
              </div>
            </div>

            <div class="evidence-grid">
              <article
                v-for="item in visibleEvidence"
                :key="item.id"
                class="evidence-item"
                :class="evidenceStatusClass(item.status)"
              >
                <span class="evidence-icon">
                  <el-icon>
                    <Document v-if="item.status === 'collected'" />
                    <ChatLineRound v-else-if="item.status === 'pending'" />
                    <Tickets v-else />
                  </el-icon>
                </span>
                <div>
                  <strong>{{ item.title }}</strong>
                  <p>来源：{{ item.source }}</p>
                  <small>{{ item.detail }}</small>
                  <em>{{ evidenceStatusLabel(item.status) }}</em>
                </div>
              </article>
            </div>

            <div class="evidence-footer">
              <span>
                <el-icon><Notebook /></el-icon>
                建议补充：最小失败用例、边界检查清单、个人反思记录
              </span>
              <button type="button" data-testid="open-ledger" @click="ledgerDrawerOpen = true">
                查看证据地图
                <el-icon><ArrowRight /></el-icon>
              </button>
            </div>
          </article>

          <aside class="profile-card" data-testid="student-profile-panel">
            <div class="section-head compact">
              <h2>学生纵向画像</h2>
              <span>{{ profileSummary.focus }}</span>
            </div>
            <div class="profile-stats">
              <div>
                <strong>{{ profileSummary.coverage }}%</strong>
                <span>平均证据覆盖</span>
              </div>
              <div>
                <strong>{{ profileSummary.evidenceGap }}</strong>
                <span>待补证据</span>
              </div>
              <div>
                <strong>{{ profileSummary.loops }}</strong>
                <span>已闭环</span>
              </div>
            </div>
            <p>
              当前结论只用于形成性诊断和资源推荐，不做排名、惩罚、就业预测或高风险自动决策。
            </p>
            <button
              type="button"
              class="profile-open-button"
              data-testid="open-learner-profile"
              @click="openLearnerProfile(selectedOrder.id)"
            >
              打开成长档案
              <el-icon><ArrowRight /></el-icon>
            </button>
          </aside>
        </section>

        <section class="return-panel" data-testid="student-return-panel">
          <div class="section-head">
            <div>
              <h2>学习改进闭环</h2>
              <p>教师确认后生成学生回流入口；线上提交和线下登记都会写入证据账本</p>
            </div>
            <strong>{{ completedReturnCount }}/3</strong>
          </div>

          <div class="return-link-card">
            <div>
              <span>学生回流链接</span>
              <strong>
                {{
                  selectedOrder.interventionPackage
                    ? "已开放"
                    : selectedOrder.selectedDecision
                      ? "待发布任务包"
                      : "待教师确认"
                }}
              </strong>
              <p>{{ studentReturnUrl || "教师发布任务包后生成专属回流链接" }}</p>
            </div>
            <button
              type="button"
              data-testid="copy-student-link"
              :disabled="!selectedOrder.interventionPackage"
              @click="copyStudentReturnUrl"
            >
              复制链接
            </button>
            <button
              type="button"
              data-testid="open-student-link"
              :disabled="!selectedOrder.interventionPackage"
              @click="openStudentReturnUrl"
            >
              打开学生页
            </button>
          </div>

          <div
            v-if="hasReturnGuidance"
            class="return-guidance"
            data-testid="closure-return-guidance"
          >
            <div>
              <span>{{ returnRoundLabel }}</span>
              <strong>教师已退回，本轮等待学生补齐证据后再验收</strong>
              <p>{{ currentReturnState.returnReason }}</p>
            </div>
            <small>待完成：{{ remainingReturnTaskText }}</small>
          </div>

          <div class="return-steps">
            <button
              v-for="step in returnSteps"
              :key="step.key"
              type="button"
              :class="{ done: returnStepDone(step.key) }"
              :data-testid="step.testId"
              :disabled="!canRunStudentReturn || returnStepDone(step.key)"
              @click="handleStudentReturn(step.key)"
            >
              <span>
                <el-icon>
                  <CircleCheckFilled v-if="returnStepDone(step.key)" />
                  <ArrowRight v-else />
                </el-icon>
              </span>
              <strong>{{ step.title }}</strong>
              <small>线下材料或课堂回收时手动登记：{{ step.detail }}</small>
            </button>
          </div>

          <div
            v-if="readyForTeacherClosure"
            class="closure-panel"
            data-testid="teacher-closure-detail"
          >
            <div>
              <span>教师最终验收</span>
              <strong>学生已完成 3/3 个回流节点，请确认是否关闭本轮诊断。</strong>
              <p>通过前需完成学生证据复核；证据不足时可退回补证据，继续保留当前账本。</p>
              <p class="closure-gate-text">{{ teacherEvidenceReviewBlockerText }}</p>
            </div>
            <button
              type="button"
              data-testid="close-work-order-detail"
              :disabled="saving || !teacherEvidenceReviewReadyForClosure"
              @click="handleTeacherClosure('accept')"
            >
              验收通过并关闭
            </button>
            <button
              type="button"
              class="ghost"
              data-testid="return-closure-evidence-detail"
              :disabled="saving"
              @click="handleTeacherClosure('returnEvidence')"
            >
              退回补证据
            </button>
          </div>
        </section>

        <footer class="stage-strip" data-testid="stage-strip">
          <div class="stage-progress">
            <span :style="{ width: `${stagePercent}%` }"></span>
          </div>
          <div class="stages">
            <div
              v-for="(stage, index) in selectedOrder.stages"
              :key="stage.id"
              :class="[stage.state, { current: index === currentStageIndex }]"
            >
              <span>{{ index + 1 }}</span>
              <strong>{{ stage.title }}</strong>
            </div>
          </div>
          <div class="footer-actions">
            <button type="button" data-testid="export-ledger" @click="handleExport">
              <el-icon><Download /></el-icon>
              导出证据账本
            </button>
            <button type="button" data-testid="reset-workbench" @click="handleReset">
              <el-icon><RefreshLeft /></el-icon>
              重新载入今日队列
            </button>
          </div>
        </footer>
      </template>
    </section>

    <el-drawer v-model="ledgerDrawerOpen" size="640px" title="证据地图与审计留痕">
      <div class="ledger-drawer" data-testid="ledger-audit-drawer">
        <section class="ledger-audit-head">
          <div>
            <span>当前复核状态</span>
            <strong>{{ ledgerAuditStatus }}</strong>
            <p>
              {{ selectedOrder?.studentName ?? "未选择学生" }} ·
              {{ selectedOrder?.courseName ?? "未选择课程任务" }}
            </p>
          </div>
          <dl>
            <div>
              <dt>账本记录</dt>
              <dd>{{ selectedLedger.length }}</dd>
            </div>
            <div>
              <dt>证据覆盖</dt>
              <dd>{{ selectedOrder?.evidenceCoverage ?? 0 }}%</dd>
            </div>
          </dl>
        </section>

        <section class="ledger-audit-filters" aria-label="证据账本筛选">
          <button
            v-for="option in ledgerAuditOptions"
            :key="option.key"
            type="button"
            :class="{ active: ledgerAuditFilter === option.key }"
            :data-testid="`ledger-filter-${option.key}`"
            @click="ledgerAuditFilter = option.key"
          >
            <strong>{{ option.count }}</strong>
            <span>{{ option.label }}</span>
            <small>{{ option.hint }}</small>
          </button>
        </section>

        <section class="ledger-audit-tools">
          <el-input
            v-model="ledgerSearchText"
            data-testid="ledger-search"
            clearable
            placeholder="搜索标题、来源、追踪号、退回原因"
          />
          <button type="button" data-testid="ledger-reset-filter" @click="resetLedgerAuditFilters">
            重置
          </button>
          <span data-testid="ledger-filtered-count">
            {{ filteredLedger.length }}/{{ selectedLedger.length }} 条
          </span>
        </section>

        <section v-if="selectedValueSnapshot" class="ledger-claim-card" data-testid="ledger-claim-card">
          <span>形成性结论边界</span>
          <strong>{{ selectedValueSnapshot.claim }}</strong>
          <p>{{ selectedValueSnapshot.boundary }}</p>
          <small>快照：{{ selectedValueSnapshot.id }}</small>
        </section>

        <el-empty
          v-if="!filteredLedger.length"
          data-testid="ledger-empty-state"
          description="当前条件下没有账本记录"
        />
        <el-timeline v-else data-testid="ledger-filtered-list">
          <el-timeline-item
            v-for="entry in filteredLedger"
            :key="entry.id"
            :timestamp="entry.time"
          >
            <article class="ledger-entry">
              <div class="ledger-entry-title">
                <strong>{{ entry.title }}</strong>
                <span>{{ ledgerTypeLabel(entry.type) }}</span>
              </div>
              <p>{{ entry.detail }}</p>
              <dl class="ledger-entry-meta">
                <div>
                  <dt>来源</dt>
                  <dd>{{ entry.source }}</dd>
                </div>
                <div>
                  <dt>操作者</dt>
                  <dd>{{ entry.actor }}</dd>
                </div>
                <div v-if="entry.stageAfter">
                  <dt>流转后阶段</dt>
                  <dd>{{ entry.stageAfter }}</dd>
                </div>
                <div v-if="entry.evidenceCoverageAfter !== undefined">
                  <dt>覆盖率</dt>
                  <dd>{{ entry.evidenceCoverageAfter }}%</dd>
                </div>
              </dl>
              <small v-if="entry.traceId">追踪号：{{ entry.traceId }}</small>
              <small v-if="entry.valueAddedSnapshotId">
                增值快照：{{ entry.valueAddedSnapshotId }}
              </small>
            </article>
          </el-timeline-item>
        </el-timeline>
      </div>
    </el-drawer>

    <el-drawer v-model="learnerProfileDrawerOpen" size="780px" title="学生成长档案">
      <div
        v-if="learnerProfileBaseOrder"
        class="learner-profile-drawer"
        data-testid="learner-profile-drawer"
      >
        <section class="learner-profile-hero">
          <span class="learner-profile-avatar">
            {{ learnerProfileBaseOrder.studentName.slice(0, 1) }}
          </span>
          <div>
            <small>{{ learnerProfileBaseOrder.courseClass }} / {{ learnerProfileBaseOrder.studentNo }}</small>
            <h2>{{ learnerProfileBaseOrder.studentName }}</h2>
            <p>{{ learnerProfileNextAction }}</p>
          </div>
        </section>

        <div class="learner-profile-metrics" data-testid="learner-profile-summary">
          <article
            v-for="metric in learnerProfileMetrics"
            :key="metric.label"
            :class="`tone-${metric.tone}`"
          >
            <span>{{ metric.label }}</span>
            <strong>{{ metric.value }}</strong>
            <small>{{ metric.hint }}</small>
          </article>
        </div>

        <div class="learner-profile-grid">
          <section class="learner-profile-panel" data-testid="learner-profile-focuses">
            <div class="section-head compact">
              <div>
                <strong>能力增值线</strong>
                <small>按该学生历史诊断单聚合，负差值优先处理</small>
              </div>
            </div>
            <article
              v-for="focus in learnerProfileFocuses"
              :key="focus.label"
              class="learner-focus-row"
            >
              <div>
                <strong>{{ focus.label }}</strong>
                <small>{{ focus.count }} 次诊断 / 当前 {{ focus.latestScore }} / 期望 {{ focus.expectedScore }}</small>
              </div>
              <span :class="{ negative: focus.delta < 0 }">
                {{ focus.delta > 0 ? `+${focus.delta}` : focus.delta }}
              </span>
              <el-progress :percentage="focus.coverage" :show-text="false" :stroke-width="8" />
            </article>
          </section>

          <section class="learner-profile-panel" data-testid="learner-profile-evidence">
            <div class="section-head compact">
              <div>
                <strong>证据来源</strong>
                <small>只展示脱敏后的可复核证据，不含真实账号或 token</small>
              </div>
            </div>
            <div class="learner-channel-list">
              <article
                v-for="channel in learnerProfileEvidenceChannels"
                :key="channel.label"
              >
                <span>{{ channel.label }}</span>
                <strong>{{ channel.count }}</strong>
                <small>{{ channel.detail }}</small>
              </article>
            </div>
          </section>
        </div>

        <section class="learner-profile-panel" data-testid="learner-profile-timeline">
          <div class="section-head compact">
            <div>
              <strong>纵向学习事件</strong>
              <small>教师可从任一事件回到诊断单继续处理</small>
            </div>
          </div>
          <div class="learner-timeline">
            <article
              v-for="item in learnerProfileTimeline"
              :key="item.id"
              class="learner-timeline-item"
            >
              <time>{{ item.date }}</time>
              <div>
                <strong>{{ item.trigger }}</strong>
                <small>{{ item.title }} / {{ item.focus }} / 证据 {{ item.coverage }}%</small>
              </div>
              <span :class="['review-gate-badge', `gate-${item.reviewGate}`]">
                {{ item.reviewGateLabel }}
              </span>
              <em :class="{ negative: item.delta < 0 }">
                {{ item.delta > 0 ? `+${item.delta}` : item.delta }}
              </em>
              <button type="button" @click="handleSelectOrder(item.id)">
                打开诊断单
              </button>
            </article>
          </div>
        </section>

        <section
          v-if="learnerProfileSnapshots.length"
          class="learner-profile-panel"
          data-testid="learner-profile-snapshots"
        >
          <div class="section-head compact">
            <div>
              <strong>已沉淀增值快照</strong>
              <small>只来自教师验收通过的闭环，不用于排名</small>
            </div>
          </div>
          <div class="learner-snapshot-list">
            <article
              v-for="snapshotItem in learnerProfileSnapshots"
              :key="snapshotItem.id"
            >
              <span>{{ snapshotItem.dimension }}</span>
              <strong>{{ snapshotItem.baseline }} -> {{ snapshotItem.observed }}</strong>
              <small>
                提升 {{ snapshotItem.uplift }} / 覆盖 {{ snapshotItem.evidenceCoverage }}% /
                {{ snapshotItem.claim }}
              </small>
            </article>
          </div>
        </section>

        <p class="learner-profile-boundary">
          该档案只用于形成性诊断、资源推荐和教师复盘；不做学生排名、惩罚、就业预测或高风险自动决策。
        </p>
      </div>
    </el-drawer>

    <el-drawer v-model="valueEngineDrawerOpen" size="820px" title="增值引擎：平台核心能力">
      <div class="value-engine-drawer" data-testid="value-engine-drawer">
        <section class="value-engine-hero">
          <span>不是配置页，也不是普通课程后台</span>
          <h2>SE-Path 的核心，是把软件工程过程证据变成教师可确认的增值闭环</h2>
          <p>
            平台从 PR、CI、测试、课堂对话和反思中抽取证据，形成候选诊断、Safe-VOI 下一步排序、学生回流和教师复核账本。每一步都保留不确定性和人工确认边界。
          </p>
        </section>

        <section class="value-engine-section">
          <div class="section-head compact">
            <div>
              <strong>本平台真正解决什么</strong>
              <small>用产品流程表达核心能力，而不是堆功能按钮</small>
            </div>
          </div>
          <div class="value-engine-layer-list" data-testid="value-engine-layer-list">
            <article v-for="item in valueEngineLayers" :key="item.step">
              <span>{{ item.step }}</span>
              <div>
                <strong>{{ item.title }}</strong>
                <p>{{ item.short }}</p>
                <small>{{ item.proof }}</small>
              </div>
            </article>
          </div>
        </section>

        <section class="value-engine-section">
          <div class="section-head compact">
            <div>
              <strong>为什么不是普通工具</strong>
              <small>差异直接落到教师每天能使用的工作方式</small>
            </div>
          </div>
          <div class="value-engine-compare" data-testid="value-engine-compare">
            <article v-for="item in valueEngineComparison" :key="item.label">
              <span>{{ item.label }}</span>
              <del>{{ item.old }}</del>
              <strong>{{ item.current }}</strong>
            </article>
          </div>
        </section>

        <section class="value-engine-section value-engine-boundary">
          <div>
            <strong>使用边界</strong>
            <p>
              智能体只提供候选诊断、候选行动和解释；缺证据时显示待补证或不确定；学生端不展示完整答案；教师确认前不发布任务、不写入最终验收、不生成排名。
            </p>
          </div>
          <button type="button" @click="agentDrawerOpen = true">
            查看智能体怎么进入
            <el-icon><ArrowRight /></el-icon>
          </button>
        </section>
      </div>
    </el-drawer>

    <TeachingAgent v-model="agentDrawerOpen" :order="selectedOrder" :authenticated="authSessionActive"
      @login="agentDrawerOpen = false; teacherLoginOpen = true"
      @intake="agentDrawerOpen = false; intakeDrawerOpen = true"
      @draft="applyConversationDraft" />

    <el-drawer v-model="intakeDrawerOpen" size="520px" title="导入真实学习事件">
      <div class="intake-drawer">
        <p>
          用一条 PR、CI、课堂对话或反思记录生成新的增值诊断单。浏览器只保留脱敏后的学习证据。
        </p>
        <section class="integration-card">
          <div class="section-head compact">
            <h2>GitHub / CI 接入</h2>
            <span>{{ courseConfig.repository }}</span>
          </div>
          <el-form label-position="top">
            <el-form-item label="Pull Request URL">
              <el-input v-model="githubImport.prUrl" data-testid="github-pr-url" />
            </el-form-item>
            <el-form-item label="CI Run URL">
              <el-input v-model="githubImport.ciRunUrl" data-testid="github-ci-url" />
            </el-form-item>
            <el-form-item label="CI 日志摘要">
              <el-input
                v-model="githubImport.ciLog"
                data-testid="github-ci-log"
                type="textarea"
                :rows="3"
              />
            </el-form-item>
          </el-form>
          <button type="button" class="secondary-wide" data-testid="parse-github-ci" @click="applyGithubImport">
            解析为学习事件
            <el-icon><ArrowRight /></el-icon>
          </button>
        </section>
        <el-form label-position="top">
          <el-form-item label="学生姓名">
            <el-input v-model="intakeForm.studentName" data-testid="intake-student-name" />
          </el-form-item>
          <el-form-item label="学号">
            <el-input v-model="intakeForm.studentNo" data-testid="intake-student-no" />
          </el-form-item>
          <el-form-item label="课程班级">
            <el-input v-model="intakeForm.courseClass" />
          </el-form-item>
          <el-form-item label="课程任务">
            <el-input v-model="intakeForm.courseName" />
          </el-form-item>
          <el-form-item label="触发事件">
            <el-input v-model="intakeForm.trigger" data-testid="intake-trigger" />
          </el-form-item>
          <el-form-item label="能力维度">
            <el-select v-model="intakeForm.focus" class="full-field">
              <el-option label="边界测试设计" value="boundary" />
              <el-option label="事务边界建模" value="transaction" />
              <el-option label="接口契约表达" value="contract" />
              <el-option label="协作评审表达" value="review" />
            </el-select>
          </el-form-item>
          <el-form-item label="学习证据">
            <el-input
              v-model="intakeForm.evidenceText"
              data-testid="intake-evidence-text"
              type="textarea"
              :rows="5"
            />
          </el-form-item>
          <el-form-item label="学生求助或反思">
            <el-input
              v-model="intakeForm.studentHelpText"
              data-testid="intake-help-text"
              type="textarea"
              :rows="4"
            />
          </el-form-item>
        </el-form>
        <button
          type="button"
          class="primary-wide"
          data-testid="submit-intake"
          :disabled="saving"
          @click="handleCreateIntake"
        >
          生成诊断单
          <el-icon><DataBoard /></el-icon>
        </button>
      </div>
    </el-drawer>

    <el-drawer v-model="opsDrawerOpen" size="760px" title="课程运营与批量诊断">
      <div class="ops-drawer">
        <p>
          面向真实课堂批量处理：从班级工单、证据缺口和能力焦点中决定今日处理顺序。智能体只生成候选入口，教师确认后才进入学生回流。
        </p>

        <section class="ops-command-center" data-testid="course-ops-dashboard">
          <div class="ops-command-head">
            <div>
              <span>本周课程运营</span>
              <strong>{{ courseConfig.courseClass }}</strong>
              <small>{{ courseConfig.courseName }} / {{ courseConfig.repository }}</small>
            </div>
            <div class="ops-command-actions">
              <em>形成性诊断，不排名不惩罚</em>
              <button
                type="button"
                data-testid="export-course-weekly-report"
                @click="handleExportCourseReport('markdown')"
              >
                下载周报
              </button>
              <button
                type="button"
                data-testid="export-course-weekly-data"
                @click="handleExportCourseReport('json')"
              >
                导出数据包
              </button>
            </div>
          </div>

          <div class="ops-metrics" data-testid="course-ops-summary">
            <article
              v-for="metric in courseOpsMetrics"
              :key="metric.label"
              :class="`tone-${metric.tone}`"
            >
              <span>{{ metric.label }}</span>
              <strong>{{ metric.value }}</strong>
              <small>{{ metric.hint }}</small>
            </article>
          </div>

          <section class="ops-review-gate" data-testid="course-review-gate-board">
            <div class="section-head compact">
              <div>
                <strong>教师复核回流</strong>
                <small>学生补证据后先逐项采信，全部通过才进入最终验收</small>
              </div>
              <span class="ops-mini-pill">{{ courseReviewGateSummaryText }}</span>
            </div>

            <div class="review-gate-metrics" data-testid="course-review-gate-summary">
              <article
                v-for="metric in courseReviewGateMetrics"
                :key="metric.label"
                :class="`tone-${metric.tone}`"
              >
                <span>{{ metric.label }}</span>
                <strong>{{ metric.value }}</strong>
                <small>{{ metric.hint }}</small>
              </article>
            </div>

            <div class="review-gate-list">
              <button
                v-for="item in courseReviewGateItems"
                :key="item.id"
                type="button"
                class="review-gate-row"
                :data-testid="`course-review-gate-${item.id}`"
                @click="focusCourseOpsOrder(item.id)"
              >
                <span :class="['review-gate-badge', `gate-${item.gate}`]">
                  {{ item.gateLabel }}
                </span>
                <span>
                  <strong>{{ item.studentName }} · {{ item.focus }}</strong>
                  <small>
                    {{ item.studentNo }} / {{ item.stage }} / 回流 {{ item.returnDone }}/3 /
                    证据 {{ item.evidenceCoverage }}%
                  </small>
                </span>
                <em>{{ item.action }}</em>
              </button>
              <p v-if="courseReviewGateItems.length === 0" class="review-gate-empty">
                暂无学生证据回流需要复核，先从优先队列处理打开工单。
              </p>
            </div>
          </section>

          <section class="ops-intervention-review" data-testid="course-intervention-review">
            <div class="section-head compact">
              <div>
                <strong>干预效果复盘</strong>
                <small>按已发布课堂微任务回看学生回流、证据采信和增值快照</small>
              </div>
              <span class="ops-mini-pill">{{ courseInterventionReviewSummaryText }}</span>
            </div>

            <div class="intervention-review-metrics" data-testid="course-intervention-review-summary">
              <article
                v-for="metric in courseInterventionReviewMetrics"
                :key="metric.label"
                :class="`tone-${metric.tone}`"
              >
                <span>{{ metric.label }}</span>
                <strong>{{ metric.value }}</strong>
                <small>{{ metric.hint }}</small>
              </article>
            </div>

            <div class="intervention-review-list">
              <button
                v-for="row in courseInterventionReviewRows"
                :key="row.traceId"
                type="button"
                class="intervention-review-row"
                :data-testid="`course-intervention-review-${row.id}`"
                :disabled="!row.firstOrderId"
                @click="focusCourseOpsOrder(row.firstOrderId)"
              >
                <span class="intervention-review-status">{{ row.effectLabel }}</span>
                <span class="intervention-review-copy">
                  <strong>{{ row.focus }}</strong>
                  <small>{{ row.title }} / {{ row.traceId }}</small>
                  <em>{{ row.action }}</em>
                </span>
                <span class="intervention-review-kpis">
                  <span>
                    <strong>{{ row.returnedCount }}/{{ row.targetCount }}</strong>
                    <small>回流</small>
                  </span>
                  <span>
                    <strong>{{ row.acceptedReviewCount }}</strong>
                    <small>可验收</small>
                  </span>
                  <span>
                    <strong>{{ row.snapshotCount }}</strong>
                    <small>快照</small>
                  </span>
                </span>
                <span class="intervention-review-coverage">
                  <strong>{{ row.averageCoverage }}%</strong>
                  <el-progress
                    :percentage="row.averageCoverage"
                    :show-text="false"
                    :stroke-width="7"
                  />
                </span>
              </button>
              <p v-if="courseInterventionReviewRows.length === 0" class="intervention-review-empty">
                尚未发布课堂微任务。教师确认发布后，这里会自动汇总回流、复核、补证和快照结果。
              </p>
            </div>

            <div class="intervention-review-actions">
              <button
                type="button"
                class="secondary-action compact-action"
                data-testid="export-course-intervention-review"
                @click="handleExportCourseInterventionReview('markdown')"
              >
                下载复盘单
                <el-icon><Download /></el-icon>
              </button>
              <button
                type="button"
                class="secondary-action compact-action"
                data-testid="export-course-intervention-review-data"
                @click="handleExportCourseInterventionReview('json')"
              >
                导出数据包
                <el-icon><Document /></el-icon>
              </button>
            </div>
          </section>

          <section
            v-if="courseTeachingImprovementPlan"
            class="ops-teaching-improvement"
            data-testid="course-teaching-improvement-plan"
          >
            <div class="section-head compact">
              <div>
                <strong>下轮教学改进单</strong>
                <small>把干预复盘转成课程资源、课堂节奏和证据口径调整</small>
              </div>
              <span class="ops-mini-pill">{{ courseTeachingImprovementSummaryText }}</span>
            </div>

            <div class="teaching-improvement-source">
              <span>{{ courseTeachingImprovementPlan.sourceSummary }}</span>
              <em>{{ courseTeachingImprovementPlan.boundary }}</em>
            </div>

            <div class="teaching-improvement-list">
              <article
                v-for="item in courseTeachingImprovementPlan.items"
                :key="item.id"
                class="teaching-improvement-item"
                :data-testid="`teaching-improvement-item-${item.id}`"
              >
                <div class="teaching-improvement-priority" :class="`priority-${item.priority}`">
                  {{ teachingPriorityLabel(item.priority) }}
                </div>
                <div class="teaching-improvement-copy">
                  <strong>{{ item.focus }}</strong>
                  <p>{{ item.issue }}</p>
                  <small>{{ item.action }}</small>
                </div>
                <div class="teaching-improvement-evidence">
                  <span>{{ item.targetWorkOrderIds.length }} 张诊断单</span>
                  <em
                    v-for="evidence in item.acceptanceEvidence"
                    :key="`${item.id}-${evidence}`"
                  >
                    {{ evidence }}
                  </em>
                </div>
              </article>
            </div>

            <div class="teaching-improvement-actions">
              <button
                type="button"
                class="secondary-action compact-action"
                data-testid="export-course-teaching-improvement"
                @click="handleExportCourseTeachingImprovement"
              >
                下载改进单
                <el-icon><Download /></el-icon>
              </button>
              <button
                type="button"
                class="secondary-action compact-action publish-action"
                data-testid="publish-course-teaching-improvement"
                :class="{ published: courseTeachingImprovementPublished }"
                :disabled="saving || courseTeachingImprovementPublished"
                @click="handlePublishCourseTeachingImprovement"
              >
                {{ courseTeachingImprovementPublished ? "已发布入账" : "发布入账" }}
                <el-icon><Check /></el-icon>
              </button>
            </div>

            <div
              v-if="courseTeachingImprovementExecutionReceipt"
              class="teaching-execution-receipt"
              data-testid="course-teaching-improvement-execution"
            >
              <div class="teaching-execution-copy">
                <span>下轮课堂执行回证</span>
                <strong>{{ courseTeachingImprovementExecutionReceipt.classSession }}</strong>
                <p>{{ courseTeachingImprovementExecutionReceipt.summary }}</p>
                <small>{{ courseTeachingImprovementExecutionReceipt.boundary }}</small>
              </div>
              <div class="teaching-execution-evidence">
                <em>{{ courseTeachingImprovementExecutionSummaryText }}</em>
                <span
                  v-for="evidence in courseTeachingImprovementExecutionReceipt.evidence"
                  :key="`execution-${evidence}`"
                >
                  {{ evidence }}
                </span>
              </div>
              <div class="teaching-execution-actions">
                <button
                  type="button"
                  class="secondary-action compact-action"
                  data-testid="export-course-teaching-execution"
                  @click="handleExportCourseTeachingImprovementExecution"
                >
                  下载回证
                  <el-icon><Download /></el-icon>
                </button>
                <button
                  type="button"
                  class="secondary-action compact-action publish-action"
                  data-testid="record-course-teaching-execution"
                  :class="{ published: courseTeachingImprovementExecutionDone }"
                  :disabled="
                    saving ||
                    !courseTeachingImprovementPublished ||
                    courseTeachingImprovementExecutionDone
                  "
                  @click="handleRecordCourseTeachingImprovementExecution"
                >
                  {{ courseTeachingImprovementExecutionDone ? "已执行入账" : "登记执行" }}
                  <el-icon><Check /></el-icon>
                </button>
              </div>
            </div>

            <div
              v-if="courseTeachingImprovementFollowupSample && courseTeachingImprovementExecutionDone"
              class="teaching-followup-sample"
              data-testid="course-teaching-improvement-followup"
            >
              <div class="teaching-followup-head">
                <div>
                  <span>下轮效果采样单</span>
                  <strong>{{ courseTeachingImprovementFollowupSample.observationWindow }}</strong>
                  <small>{{ courseTeachingImprovementFollowupSample.boundary }}</small>
                </div>
                <em>{{ courseTeachingImprovementFollowupSummaryText }}</em>
              </div>

              <div class="teaching-followup-grid">
                <article
                  v-for="indicator in courseTeachingImprovementFollowupSample.indicators"
                  :key="indicator.id"
                  :class="`followup-${indicator.status}`"
                  :data-testid="`followup-indicator-${indicator.id}`"
                >
                  <span>{{ indicator.label }}</span>
                  <strong>{{ indicator.expected }}</strong>
                  <p>{{ indicator.before }}</p>
                  <small>{{ indicator.interpretation }}</small>
                </article>
              </div>

              <div class="teaching-followup-actions">
                <button
                  type="button"
                  class="secondary-action compact-action"
                  data-testid="export-course-teaching-followup"
                  @click="handleExportCourseTeachingImprovementFollowup"
                >
                  下载采样单
                  <el-icon><Download /></el-icon>
                </button>
                <button
                  type="button"
                  class="secondary-action compact-action publish-action"
                  data-testid="record-course-teaching-followup"
                  :class="{ published: courseTeachingImprovementFollowupRecorded }"
                  :disabled="
                    saving ||
                    !courseTeachingImprovementExecutionDone ||
                    courseTeachingImprovementFollowupRecorded
                  "
                  @click="handleRecordCourseTeachingImprovementFollowup"
                >
                  {{ courseTeachingImprovementFollowupRecorded ? "已采样入账" : "登记采样" }}
                  <el-icon><Check /></el-icon>
                </button>
              </div>
            </div>

            <div
              v-if="courseTeachingImprovementFollowupResult && courseTeachingImprovementFollowupRecorded"
              class="teaching-followup-result"
              data-testid="course-teaching-improvement-followup-result"
            >
              <div class="teaching-followup-head">
                <div>
                  <span>采样结果回收单</span>
                  <strong>{{ courseTeachingImprovementFollowupResult.summary }}</strong>
                  <small>{{ courseTeachingImprovementFollowupResult.boundary }}</small>
                </div>
                <em>{{ courseTeachingImprovementFollowupResultSummaryText }}</em>
              </div>

              <div class="teaching-followup-result-grid">
                <article
                  v-for="finding in courseTeachingImprovementFollowupResult.findings"
                  :key="finding.id"
                  :class="`result-${finding.status}`"
                  :data-testid="`followup-result-${finding.id}`"
                >
                  <span>{{ finding.label }}</span>
                  <strong>{{ finding.observed }}</strong>
                  <p>{{ finding.interpretation }}</p>
                  <small>{{ finding.evidence }}</small>
                </article>
              </div>

              <div class="teaching-followup-next">
                <span>下一步</span>
                <strong>{{ courseTeachingImprovementFollowupResult.nextAction }}</strong>
              </div>

              <div class="teaching-followup-actions">
                <button
                  type="button"
                  class="secondary-action compact-action"
                  data-testid="export-course-teaching-followup-result"
                  @click="handleExportCourseTeachingImprovementFollowupResult"
                >
                  下载回收单
                  <el-icon><Download /></el-icon>
                </button>
                <button
                  type="button"
                  class="secondary-action compact-action publish-action"
                  data-testid="record-course-teaching-followup-result"
                  :class="{ published: courseTeachingImprovementFollowupResultRecorded }"
                  :disabled="
                    saving ||
                    !courseTeachingImprovementFollowupRecorded ||
                    courseTeachingImprovementFollowupResultRecorded
                  "
                  @click="handleRecordCourseTeachingImprovementFollowupResult"
                >
                  {{ courseTeachingImprovementFollowupResultRecorded ? "已回收入账" : "回收结果" }}
                  <el-icon><Check /></el-icon>
                </button>
              </div>
            </div>

            <div
              v-if="courseResourceRevisionTicket && courseTeachingImprovementFollowupResultRecorded"
              class="resource-revision-ticket"
              data-testid="course-resource-revision-ticket"
            >
              <div class="resource-revision-head">
                <div>
                  <span>课程资源改版工单</span>
                  <strong>{{ courseResourceRevisionTicket.resourceTitle }}</strong>
                  <small>{{ courseResourceRevisionTicket.reason }}</small>
                </div>
                <em>{{ courseResourceRevisionSummaryText }}</em>
              </div>

              <div class="resource-revision-version">
                <span>{{ courseResourceRevisionTicket.versionFrom }}</span>
                <el-icon><ArrowRight /></el-icon>
                <strong>{{ courseResourceRevisionTicket.versionTo }}</strong>
              </div>

              <div class="resource-revision-grid">
                <article
                  v-for="change in courseResourceRevisionTicket.changes"
                  :key="change.id"
                  :class="`revision-${change.status}`"
                  :data-testid="`resource-revision-change-${change.id}`"
                >
                  <span>{{ change.area }}</span>
                  <strong>{{ change.title }}</strong>
                  <p>{{ change.implementation }}</p>
                  <small>{{ change.owner }} / {{ change.reason }}</small>
                </article>
              </div>

              <div class="resource-revision-acceptance">
                <span>验收口径</span>
                <ul>
                  <li
                    v-for="check in courseResourceRevisionTicket.acceptanceChecks"
                    :key="check"
                  >
                    {{ check }}
                  </li>
                </ul>
                <small>{{ courseResourceRevisionTicket.boundary }}</small>
              </div>

              <div class="teaching-followup-actions">
                <button
                  type="button"
                  class="secondary-action compact-action"
                  data-testid="export-course-resource-revision"
                  @click="handleExportCourseResourceRevision"
                >
                  下载改版工单
                  <el-icon><Download /></el-icon>
                </button>
                <button
                  type="button"
                  class="secondary-action compact-action publish-action"
                  data-testid="record-course-resource-revision"
                  :class="{ published: courseResourceRevisionRecorded }"
                  :disabled="
                    saving ||
                    !courseTeachingImprovementFollowupResultRecorded ||
                    courseResourceRevisionRecorded
                  "
                  @click="handleRecordCourseResourceRevision"
                >
                  {{ courseResourceRevisionRecorded ? "已改版入账" : "确认改版" }}
                  <el-icon><Check /></el-icon>
                </button>
              </div>
            </div>

            <div
              v-if="courseResourceReleaseReceipt && courseResourceRevisionRecorded"
              class="resource-release-receipt"
              data-testid="course-resource-release-receipt"
            >
              <div class="resource-release-head">
                <div>
                  <span>课程资源发布回证</span>
                  <strong>{{ courseResourceReleaseReceipt.releasedVersion }}</strong>
                  <small>{{ courseResourceReleaseReceipt.boundary }}</small>
                </div>
                <em :class="{ published: courseResourceReleaseRecorded }">
                  {{ courseResourceReleaseSummaryText }}
                </em>
              </div>

              <div class="resource-release-meta">
                <article>
                  <span>发布渠道</span>
                  <strong>{{ courseResourceReleaseReceipt.releaseChannel }}</strong>
                </article>
                <article>
                  <span>发布范围</span>
                  <strong>{{ courseResourceReleaseReceipt.releaseScope }}</strong>
                </article>
              </div>

              <div class="resource-release-assets">
                <span>发布资产</span>
                <code
                  v-for="asset in courseResourceReleaseReceipt.assets"
                  :key="`resource-release-asset-${asset}`"
                >
                  {{ asset }}
                </code>
              </div>

              <div class="resource-release-checks">
                <article
                  v-for="check in courseResourceReleaseReceipt.checks"
                  :key="check.id"
                  :class="`release-${check.status}`"
                  :data-testid="`resource-release-check-${check.id}`"
                >
                  <span>{{ check.owner }}</span>
                  <strong>{{ check.label }}</strong>
                  <p>{{ check.evidence }}</p>
                </article>
              </div>

              <div class="resource-release-rollback">
                <span>回滚计划</span>
                <strong>{{ courseResourceReleaseReceipt.rollbackPlan }}</strong>
              </div>

              <div class="teaching-followup-actions">
                <button
                  type="button"
                  class="secondary-action compact-action"
                  data-testid="export-course-resource-release"
                  @click="handleExportCourseResourceRelease"
                >
                  下载发布回证
                  <el-icon><Download /></el-icon>
                </button>
                <button
                  type="button"
                  class="secondary-action compact-action publish-action"
                  data-testid="record-course-resource-release"
                  :class="{ published: courseResourceReleaseRecorded }"
                  :disabled="
                    saving ||
                    !courseResourceRevisionRecorded ||
                    courseResourceReleaseRecorded
                  "
                  @click="handleRecordCourseResourceRelease"
                >
                  {{ courseResourceReleaseRecorded ? "已发布入账" : "确认发布" }}
                  <el-icon><Check /></el-icon>
                </button>
              </div>
            </div>

            <div
              v-if="courseResourceUsageReceipt && courseResourceReleaseRecorded"
              class="resource-usage-receipt"
              data-testid="course-resource-usage-receipt"
            >
              <div class="resource-usage-head">
                <div>
                  <span>课程资源使用回流单</span>
                  <strong>{{ courseResourceUsageReceipt.usageWindow }}</strong>
                  <small>{{ courseResourceUsageReceipt.boundary }}</small>
                </div>
                <em :class="{ published: courseResourceUsageRecorded }">
                  {{ courseResourceUsageSummaryText }}
                </em>
              </div>

              <div class="resource-usage-metrics">
                <article>
                  <span>活跃学生</span>
                  <strong>{{ courseResourceUsageReceipt.activeLearners }}</strong>
                  <small>领取资源或提交回流证据</small>
                </article>
                <article>
                  <span>新增证据</span>
                  <strong>{{ courseResourceUsageReceipt.submittedEvidenceCount }}</strong>
                  <small>失败现象、最小用例、验证记录</small>
                </article>
                <article>
                  <span>待教师复核</span>
                  <strong>{{ courseResourceUsageReceipt.teacherReviewReadyCount }}</strong>
                  <small>只进入人工确认，不自动判定</small>
                </article>
                <article>
                  <span>覆盖中位数</span>
                  <strong>{{ courseResourceUsageReceipt.medianCoverageAfter }}%</strong>
                  <small>形成性诊断参考，不排名</small>
                </article>
              </div>

              <div class="resource-usage-signals">
                <article
                  v-for="signal in courseResourceUsageReceipt.signals"
                  :key="signal.id"
                  :class="`usage-${signal.status}`"
                  :data-testid="`resource-usage-signal-${signal.id}`"
                >
                  <span>{{ signal.label }}</span>
                  <strong>{{ signal.value }}</strong>
                  <p>{{ signal.evidence }}</p>
                </article>
              </div>

              <div class="resource-usage-next">
                <span>下一步</span>
                <strong>{{ courseResourceUsageReceipt.nextAction }}</strong>
                <small>{{ courseResourceUsageReminderSummaryText }}</small>
              </div>

              <div class="teaching-followup-actions">
                <button
                  type="button"
                  class="secondary-action compact-action"
                  data-testid="export-course-resource-usage"
                  @click="handleExportCourseResourceUsage"
                >
                  下载使用回流单
                  <el-icon><Download /></el-icon>
                </button>
                <button
                  type="button"
                  class="secondary-action compact-action publish-action"
                  data-testid="record-course-resource-usage"
                  :class="{ published: courseResourceUsageRecorded }"
                  :disabled="
                    saving ||
                    !courseResourceReleaseRecorded ||
                    courseResourceUsageRecorded
                  "
                  @click="handleRecordCourseResourceUsage"
                >
                  {{ courseResourceUsageRecorded ? "已回流入账" : "确认回流" }}
                  <el-icon><Check /></el-icon>
                </button>
                <button
                  type="button"
                  class="secondary-action compact-action"
                  data-testid="remind-course-resource-usage"
                  :class="{ published: courseResourceUsageReminderRecorded }"
                  :disabled="
                    saving ||
                    !courseResourceUsageRecorded ||
                    !courseResourceUsageReminder ||
                    courseResourceUsageReminderRecorded
                  "
                  @click="handleRemindCourseResourceUsage"
                >
                  {{ courseResourceUsageReminderSummaryText }}
                  <el-icon><ChatLineRound /></el-icon>
                </button>
              </div>
            </div>
          </section>

          <div class="ops-board">
            <section class="ops-priority" data-testid="course-priority-queue">
              <div class="section-head compact">
                <div>
                  <strong>今日优先处理</strong>
                  <small>按风险、证据覆盖、阶段和教师待办综合排序</small>
                </div>
              </div>
              <button
                v-for="item in coursePriorityQueue"
                :key="item.id"
                type="button"
                class="priority-row"
                :data-testid="`ops-priority-${item.id}`"
                @click="focusCourseOpsOrder(item.id)"
              >
                <span :class="['priority-risk', `risk-${item.risk}`]">{{ riskLabels[item.risk] }}</span>
                <strong>{{ item.studentName }} · {{ item.focus }}</strong>
                <small>{{ item.trigger }} / {{ statusLabels[item.status] }} / 回流 {{ item.returnDone }}/3</small>
                <em>{{ item.action }}</em>
              </button>
            </section>

            <section class="ops-focus" data-testid="course-gap-distribution">
              <div class="section-head compact">
                <div>
                  <strong>能力薄弱分布</strong>
                  <small>只用于课程资源调度，不生成学生名次</small>
                </div>
              </div>
              <div
                v-for="item in courseFocusInsights"
                :key="item.label"
                class="focus-row"
              >
                <div>
                  <strong>{{ item.label }}</strong>
                  <small>
                    {{ item.count }} 张工单 / 可验收 {{ item.acceptedReview }} /
                    待复核 {{ item.pendingReview }} / 需补证 {{ item.blockedReview }}
                  </small>
                </div>
                <span :class="{ negative: item.averageDelta < 0 }">{{ item.averageDelta > 0 ? `+${item.averageDelta}` : item.averageDelta }}</span>
                <el-progress
                  :percentage="item.averageCoverage"
                  :show-text="false"
                  :stroke-width="8"
                />
              </div>
            </section>
          </div>

          <section class="ops-gap-matrix" data-testid="course-evidence-gap-matrix">
            <div class="section-head compact">
              <div>
                <strong>证据缺口矩阵</strong>
                <small>把多名学生重复缺口合并成教师可布置的课堂动作</small>
              </div>
            </div>
            <div class="gap-chip-list">
              <article v-for="gap in courseEvidenceGaps" :key="gap.title">
                <strong>{{ gap.title }}</strong>
                <span>{{ gap.count }} 人涉及</span>
                <small>{{ gap.source }} / {{ gap.action }}</small>
              </article>
              <article v-if="courseEvidenceGaps.length === 0" class="gap-empty">
                <strong>暂无共性证据缺口</strong>
                <span>可进入单张诊断单继续复核</span>
                <small>系统不会强行生成低证据结论</small>
              </article>
            </div>
          </section>

          <section
            v-if="courseMicroTaskPackage"
            class="ops-micro-task"
            data-testid="course-micro-task-package"
          >
            <div class="section-head compact">
              <div>
                <strong>课堂微任务包</strong>
                <small>从最高频证据缺口生成，可直接下发到本周实验课</small>
              </div>
              <div class="micro-task-actions">
                <button
                  type="button"
                  class="secondary-action compact-action"
                  data-testid="export-course-micro-task"
                  @click="handleExportCourseMicroTask"
                >
                  下载任务包
                  <el-icon><Download /></el-icon>
                </button>
                <button
                  type="button"
                  class="secondary-action compact-action publish-action"
                  data-testid="publish-course-micro-task"
                  :class="{ published: courseMicroTaskPublished }"
                  :disabled="saving || courseMicroTaskPublished"
                  @click="handlePublishCourseMicroTask"
                >
                  {{ courseMicroTaskPublished ? "已发布入账" : "发布到课堂" }}
                  <el-icon><Check /></el-icon>
                </button>
              </div>
            </div>

            <div class="micro-task-summary">
              <div>
                <span>共性缺口</span>
                <strong data-testid="course-micro-task-title">
                  {{ courseMicroTaskPackage.sourceGap }}
                </strong>
              </div>
              <div>
                <span>涉及工单</span>
                <strong>{{ courseMicroTaskPackage.affectedCount }} 张</strong>
              </div>
              <div>
                <span>能力焦点</span>
                <strong>{{ courseMicroTaskPackage.focusDimension }}</strong>
              </div>
            </div>

            <p class="micro-task-objective">{{ courseMicroTaskPackage.objective }}</p>

            <div class="micro-task-body">
              <ol class="micro-task-steps">
                <li v-for="step in courseMicroTaskPackage.steps" :key="step">
                  {{ step }}
                </li>
              </ol>
              <div class="micro-task-side">
                <span>提交证据</span>
                <em v-for="item in courseMicroTaskPackage.evidenceToSubmit" :key="item">
                  {{ item }}
                </em>
              </div>
            </div>

            <div class="micro-task-boundary" data-testid="course-micro-task-boundary">
              {{ courseMicroTaskPackage.safeBoundary }}
            </div>
          </section>
        </section>

        <section class="ops-card github-batch-import" data-testid="github-batch-import-card">
          <div class="section-head compact">
            <div>
              <strong>PR/CI 批量导入</strong>
              <small>learnerHash | PR URL | CI URL | branch | 失败摘要</small>
            </div>
            <span class="ops-mini-pill" data-testid="github-batch-preview">
              {{ githubBatchImportItems.length }} 条可导入 / {{ githubBatchImportInvalidCount }} 条待修正
            </span>
          </div>
          <el-input
            v-model="githubBatchRows"
            data-testid="github-batch-rows"
            type="textarea"
            :rows="6"
            placeholder="learner-0321 | https://github.com/org/repo/pull/31 | https://github.com/org/repo/actions/runs/10310031 | feature/order-null-body | CI 失败摘要"
          />
          <div class="batch-import-foot">
            <span data-testid="github-batch-status">{{ githubBatchImportStatus }}</span>
            <button
              type="button"
              class="primary-wide compact-primary"
              data-testid="submit-github-batch-import"
              :disabled="saving || githubBatchImportItems.length === 0"
              @click="handleGithubBatchImport"
            >
              导入 PR/CI 并生成诊断单
              <el-icon><DataBoard /></el-icon>
            </button>
          </div>
        </section>

        <section class="ops-overview">
          <article>
            <span>名单人数</span>
            <strong>{{ rosterSummary.total }}</strong>
          </article>
          <article>
            <span>活跃学生</span>
            <strong>{{ rosterSummary.active }}</strong>
          </article>
          <article>
            <span>已选巡检</span>
            <strong>{{ rosterSummary.selected }}</strong>
          </article>
          <article>
            <span>无打开工单</span>
            <strong>{{ rosterSummary.withoutOpenOrder }}</strong>
          </article>
        </section>

        <section class="ops-card">
          <div class="section-head compact">
            <div>
              <strong>伪名化班级名单</strong>
              <small>一行一个：学号或 learnerHash、课堂代号、小组、GitHub 账号、状态。保存前会转为 learnerHash。</small>
            </div>
            <button type="button" class="secondary-action" data-testid="save-roster" :disabled="saving" @click="handleSaveRoster">
              保存名单
            </button>
          </div>
          <el-input
            v-model="rosterText"
            data-testid="roster-textarea"
            type="textarea"
            :rows="7"
            placeholder="2301180321, LZX-0321, A组, learner-0321, active"
          />
        </section>

        <section class="ops-card">
          <div class="section-head compact">
            <div>
              <strong>批量生成候选诊断单</strong>
              <small>用于周巡检、实验课收尾、PR/CI 失败批处理；证据不足时必须保持待补证。</small>
            </div>
            <span class="ops-mini-pill">{{ selectedLearnerHashes.length }} 人</span>
          </div>
          <el-form label-position="top">
            <el-form-item label="巡检任务">
              <el-input v-model="batchTask.trigger" data-testid="batch-trigger-field" />
            </el-form-item>
            <el-form-item label="能力焦点">
              <el-select v-model="batchTask.focus" class="full-field" data-testid="batch-focus-field">
                <el-option label="边界测试设计" value="boundary" />
                <el-option label="事务边界建模" value="transaction" />
                <el-option label="接口契约表达" value="contract" />
                <el-option label="协作评审表达" value="review" />
              </el-select>
            </el-form-item>
            <el-form-item label="默认风险">
              <el-select v-model="batchTask.risk" class="full-field" data-testid="batch-risk-field">
                <el-option label="高风险" value="high" />
                <el-option label="中风险" value="medium" />
                <el-option label="低风险" value="low" />
              </el-select>
            </el-form-item>
            <el-form-item label="任务说明">
              <el-input
                v-model="batchTask.taskSummary"
                data-testid="batch-summary-field"
                type="textarea"
                :rows="3"
              />
            </el-form-item>
          </el-form>

          <div class="learner-picker" data-testid="batch-learner-picker">
            <el-checkbox-group v-model="selectedLearnerHashes">
              <el-checkbox
                v-for="learner in activeRosterLearners"
                :key="learner.learnerHash"
                :label="learner.learnerHash"
              >
                <strong>{{ learner.learnerAlias }}</strong>
                <small>{{ learner.groupName }} / {{ learner.learnerHash.slice(-8) }}</small>
              </el-checkbox>
            </el-checkbox-group>
          </div>

          <button
            type="button"
            class="primary-wide"
            data-testid="batch-create-workorders"
            :disabled="saving || selectedLearnerHashes.length === 0"
            @click="handleBatchCreate"
          >
            生成候选诊断单
            <el-icon><DataBoard /></el-icon>
          </button>
        </section>
      </div>
    </el-drawer>

    <el-drawer v-model="launchDrawerOpen" size="860px" title="开课初始化">
      <div class="launch-drawer" data-testid="course-launch-drawer">
        <section class="launch-brief">
          <div>
            <span>真实试点入口</span>
            <h2>把课程、仓库、名单和首轮诊断规则一次跑通</h2>
            <p>
              完成后会生成首批候选诊断单，所有结论保持形成性边界：智能体只给建议，教师确认后才发布给学生。
            </p>
          </div>
          <strong>{{ activeLaunchLearners.length }} 名学习者</strong>
        </section>

        <el-steps :active="launchStep" simple class="launch-steps">
          <el-step title="课程接入" />
          <el-step title="伪名名单" />
          <el-step title="诊断规则" />
          <el-step title="生成结果" />
        </el-steps>

        <section class="launch-layout">
          <div class="launch-main">
            <section class="launch-section" data-testid="launch-course-settings">
              <div class="section-head compact">
                <div>
                  <strong>1. 课程与仓库</strong>
                  <small>用于后续 GitHub PR、CI 和课堂证据归集。</small>
                </div>
              </div>
              <el-form label-position="top" class="launch-form-grid">
                <el-form-item label="课程班级">
                  <el-input v-model="launchForm.courseClass" data-testid="launch-course-class" />
                </el-form-item>
                <el-form-item label="课程任务">
                  <el-input v-model="launchForm.courseName" data-testid="launch-course-name" />
                </el-form-item>
                <el-form-item label="GitHub 仓库">
                  <el-input v-model="launchForm.repository" data-testid="launch-repository" />
                </el-form-item>
                <el-form-item label="CI 提供方">
                  <el-input v-model="launchForm.ciProvider" data-testid="launch-ci-provider" />
                </el-form-item>
              </el-form>
            </section>

            <section class="launch-section" data-testid="launch-roster-section">
              <div class="section-head compact">
                <div>
                  <strong>2. 伪名班级名单</strong>
                  <small>格式：learnerHash, 课堂代号, 小组, GitHub 账号, 状态。</small>
                </div>
                <span class="ops-mini-pill">{{ launchLearners.length }} 行 / {{ activeLaunchLearners.length }} 名参与</span>
              </div>
              <el-input
                v-model="launchRosterRows"
                data-testid="launch-roster-textarea"
                type="textarea"
                :rows="6"
                placeholder="learner-0321, LZX-0321, A 组, learner-0321, active"
              />
              <p class="launch-note">
                保存前会转成 learnerHash；真实姓名、邮箱、token 和原始日志不进入浏览器包。
              </p>
            </section>

            <section class="launch-section" data-testid="launch-task-section">
              <div class="section-head compact">
                <div>
                  <strong>3. 首轮诊断规则</strong>
                  <small>生成的是候选诊断单，不是自动评分。</small>
                </div>
              </div>
              <el-form label-position="top" class="launch-form-grid">
                <el-form-item label="巡检任务">
                  <el-input v-model="launchForm.trigger" data-testid="launch-trigger" />
                </el-form-item>
                <el-form-item label="发生日期">
                  <el-input v-model="launchForm.eventDate" data-testid="launch-event-date" />
                </el-form-item>
                <el-form-item label="能力焦点">
                  <el-select v-model="launchForm.focus" class="full-field" data-testid="launch-focus">
                    <el-option label="边界测试设计" value="boundary" />
                    <el-option label="事务边界建模" value="transaction" />
                    <el-option label="接口契约表达" value="contract" />
                    <el-option label="协作评审表达" value="review" />
                  </el-select>
                </el-form-item>
                <el-form-item label="初始风险">
                  <el-select v-model="launchForm.risk" class="full-field" data-testid="launch-risk">
                    <el-option label="高风险" value="high" />
                    <el-option label="中风险" value="medium" />
                    <el-option label="低风险" value="low" />
                  </el-select>
                </el-form-item>
              </el-form>
              <el-input
                v-model="launchForm.taskSummary"
                data-testid="launch-task-summary"
                type="textarea"
                :rows="4"
              />
            </section>
          </div>

          <aside class="launch-side">
            <section class="launch-check" data-testid="launch-readiness">
              <span>上线前检查</span>
              <article
                v-for="item in launchReadiness"
                :key="item.key"
                :class="`state-${item.status}`"
              >
                <i></i>
                <div>
                  <strong>{{ item.label }}</strong>
                  <small>{{ item.detail }}</small>
                </div>
              </article>
            </section>

            <section class="launch-boundary">
              <strong>安全边界</strong>
              <el-input
                v-model="launchForm.privacyPolicy"
                data-testid="launch-privacy-policy"
                type="textarea"
                :rows="5"
              />
            </section>

            <button
              type="button"
              class="launch-submit"
              data-testid="launch-submit"
              :disabled="saving || !canLaunchCourse"
              @click="handleLaunchCourse"
            >
              <el-icon><CircleCheckFilled /></el-icon>
              生成首轮诊断单
            </button>

            <section
              v-if="lastLaunchResult"
              class="launch-result"
              data-testid="launch-result"
            >
              <span>最近一次初始化</span>
              <strong>{{ lastLaunchResult.createdCount }} 张新增诊断单</strong>
              <p>{{ lastLaunchResult.roster.learners.length }} 名伪名学习者已纳入课程。</p>
              <small>{{ lastLaunchResult.stored ? "已写入后端" : "本地离线保存" }} / {{ lastLaunchResult.storageMode }}</small>
            </section>
          </aside>
        </section>
      </div>
    </el-drawer>

    <el-dialog
      v-model="teacherLoginOpen"
      width="420px"
      class="teacher-login-dialog"
      title="教师访问授权"
      :close-on-click-modal="!apiRequiresToken"
    >
      <div class="teacher-login-card" data-testid="teacher-login-card">
        <p>
          当前线上服务启用了短期令牌。请输入教师访问码后继续处理课程工单、证据复核和智能体建议。
        </p>
        <el-input
          v-model="teacherAccessCode"
          data-testid="teacher-access-code"
          type="password"
          show-password
          placeholder="输入教师访问码"
          @keyup.enter="handleTeacherAccessLogin"
        />
        <small>
          访问码只发送到后端校验；浏览器仅保存本次会话令牌，关闭或退出后需要重新授权。
        </small>
        <button
          type="button"
          class="primary-wide"
          data-testid="teacher-login-submit"
          :disabled="authLoginLoading"
          @click="handleTeacherAccessLogin"
        >
          {{ authLoginLoading ? "授权中" : "进入教师工作台" }}
          <el-icon><CircleCheckFilled /></el-icon>
        </button>
      </div>
    </el-dialog>

    <el-drawer v-model="courseDrawerOpen" size="520px" title="课程与仓库设置">
      <div class="intake-drawer">
        <p>
          配置课程、仓库和隐私边界。这里的配置会用于新的 PR/CI 学习事件导入。
        </p>
        <section class="settings-context-card">
          <div>
            <strong>这里是接入配置，不是核心工作面</strong>
            <small>
              平台核心能力在“增值引擎”：把 PR/CI、测试、对话和反思转成可复核的增值诊断闭环。
            </small>
          </div>
          <button
            type="button"
            data-testid="open-value-engine-from-settings"
            @click="valueEngineDrawerOpen = true"
          >
            查看增值引擎
            <el-icon><ArrowRight /></el-icon>
          </button>
        </section>
        <div class="connection-card" :class="apiStatus" data-testid="api-connection-card">
          <div class="connection-main">
            <span class="status-dot"></span>
            <div>
              <strong>{{ connectionModeLabel }}</strong>
              <small>{{ apiStatusMessage }}</small>
            </div>
          </div>
          <button
            type="button"
            class="secondary-action"
            data-testid="check-api-connection"
            :disabled="apiStatus === 'checking'"
            @click="handleApiCheck()"
          >
            {{ apiStatus === "checking" ? "检测中" : "检测连接" }}
          </button>
          <div class="webhook-field">
            <small>GitHub Actions Webhook</small>
            <code>{{ webhookUrl }}</code>
            <button type="button" data-testid="copy-webhook-url" @click="copyWebhookUrl">
              复制
            </button>
          </div>
          <div class="webhook-signature-card" data-testid="webhook-signature-card">
            <strong>生产推荐：GitHub HMAC 签名</strong>
            <small>后端配置 SEPATH_GITHUB_WEBHOOK_SECRET，课程仓库 Secret 同名；密钥不进入浏览器。</small>
          </div>
          <div class="webhook-signature-card agent-gateway-card" data-testid="llm-gateway-card">
            <strong>{{ llmGatewayModeLabel }}</strong>
            <small>{{ llmGatewayModeDetail }}</small>
          </div>
          <div class="storage-mode-row" data-testid="api-storage-mode">
            <span>运行存储</span>
            <strong>{{ storageModeLabel }}</strong>
          </div>
          <div v-if="apiCapabilities.length" class="capability-row">
            <span v-for="item in apiCapabilities.slice(0, 4)" :key="item">{{ item }}</span>
          </div>
        </div>
        <section
          class="github-integration-panel"
          :class="githubIntegrationStatusTone"
          data-testid="github-integration-status"
        >
          <div class="integration-status-head">
            <div>
              <strong>GitHub 接入健康</strong>
              <small>用于确认课堂仓库事件是否已进入教师工单队列。</small>
            </div>
            <button
              type="button"
              data-testid="refresh-github-integration-status"
              :disabled="integrationStatusLoading"
              @click="loadGithubIntegrationStatus(true)"
            >
              <el-icon><RefreshLeft /></el-icon>
              {{ integrationStatusLoading ? "刷新中" : "刷新" }}
            </button>
          </div>
          <div class="integration-health-row">
            <span>{{ githubIntegrationHealthText }}</span>
            <strong v-if="latestGithubIntegrationEvent">
              {{ latestGithubIntegrationEvent.repository || courseConfig.repository }}
            </strong>
            <strong v-else>{{ courseConfig.repository }}</strong>
          </div>
          <div class="integration-kpis">
            <article v-for="item in githubIntegrationQuickStats" :key="item.label">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </article>
          </div>
          <div v-if="latestGithubIntegrationEvent" class="integration-latest" data-testid="github-integration-latest">
            <span>最近导入</span>
            <strong>
              {{ latestGithubIntegrationEvent.source }} / {{ latestGithubIntegrationEvent.status }}
            </strong>
            <small>
              {{ latestGithubIntegrationEvent.createdAt }} ·
              工单 {{ latestGithubIntegrationEvent.workOrderId || latestGithubIntegrationEvent.workOrderIds?.[0] || "待生成" }}
            </small>
            <code v-if="latestGithubIntegrationEvent.deliveryId">
              delivery {{ latestGithubIntegrationEvent.deliveryId }}
            </code>
          </div>
          <div v-else class="integration-empty">
            <span>尚未收到 GitHub 事件</span>
            <small>保存配置并把 YAML 放入课程仓库后，第一次 CI 失败会在这里留下接入记录。</small>
          </div>
        </section>
        <section class="pilot-setup" data-testid="pilot-launch-checklist">
          <div class="setup-head">
            <div>
              <strong>试点上线清单</strong>
              <small>完成后，课程仓库的 CI 失败会自动进入教师增值诊断队列。</small>
            </div>
            <span>{{ pilotChecklist.filter((item) => item.status === "ready").length }}/{{ pilotChecklist.length }}</span>
          </div>
          <div class="setup-list">
            <div v-for="item in pilotChecklist" :key="item.label" class="setup-item" :class="item.status">
              <span></span>
              <strong>{{ item.label }}</strong>
            </div>
          </div>
          <div class="workflow-snippet" data-testid="github-workflow-snippet">
            <div class="workflow-head">
              <strong>GitHub Actions 最小接入片段</strong>
              <button type="button" data-testid="copy-github-workflow" @click="copyGithubWorkflowYaml">
                复制 YAML
              </button>
            </div>
            <pre><code>{{ githubWorkflowYaml }}</code></pre>
          </div>
        </section>
        <el-form label-position="top">
          <el-form-item label="课程班级">
            <el-input v-model="courseConfig.courseClass" data-testid="course-class-field" />
          </el-form-item>
          <el-form-item label="课程任务">
            <el-input v-model="courseConfig.courseName" data-testid="course-name-field" />
          </el-form-item>
          <el-form-item label="代码仓库">
            <el-input v-model="courseConfig.repository" data-testid="course-repo-field" />
          </el-form-item>
          <el-form-item label="CI 提供方">
            <el-input v-model="courseConfig.ciProvider" data-testid="course-ci-field" />
          </el-form-item>
          <el-form-item label="后端 API 地址（可选）">
            <el-input
              v-model="courseConfig.apiBaseUrl"
              data-testid="course-api-base-field"
              placeholder="http://127.0.0.1:8787"
            />
          </el-form-item>
          <el-form-item label="智能体网关地址（可选）">
            <el-input
              v-model="courseConfig.llmGatewayBaseUrl"
              data-testid="course-llm-gateway-field"
              placeholder="留空则使用后端 API 同源 /api/ai/generate-scaffold"
            />
          </el-form-item>
          <el-form-item label="隐私与数据边界">
            <el-input
              v-model="courseConfig.privacyPolicy"
              data-testid="course-privacy-field"
              type="textarea"
              :rows="4"
            />
          </el-form-item>
        </el-form>
        <button type="button" class="primary-wide" data-testid="save-course-config" @click="saveCourseConfig">
          保存课程配置
          <el-icon><CircleCheckFilled /></el-icon>
        </button>
      </div>
    </el-drawer>
  </main>
</template>
