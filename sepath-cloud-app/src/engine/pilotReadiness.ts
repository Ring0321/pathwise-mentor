import type { AppState, EventType } from "../domain/types";
import type { CohortOpsReport } from "./cohortOps";
import { evidenceCoverage } from "./evidence";
import type { LaunchReadinessReport } from "./launchReadiness";

export type PilotReadinessStatus = "ready" | "shadow" | "manual";

export interface PilotChecklistItem {
  id: string;
  label: string;
  owner: "teacher" | "assistant" | "school" | "team";
  status: PilotReadinessStatus;
  evidence: string;
  nextAction: string;
}

export interface PilotIntegrationItem {
  id: string;
  name: string;
  currentMode: string;
  productionTarget: string;
  riskControl: string;
}

export interface PilotRolloutStage {
  id: string;
  label: string;
  objective: string;
  gate: string;
}

export interface PilotMetric {
  id: string;
  label: string;
  value: string;
  target: string;
}

export interface PilotReadinessReport {
  readinessScore: number;
  mode: string;
  gate: string;
  readyCount: number;
  shadowCount: number;
  manualCount: number;
  checklist: PilotChecklistItem[];
  integrations: PilotIntegrationItem[];
  rolloutStages: PilotRolloutStage[];
  metrics: PilotMetric[];
  workspaceConfig: string[];
  dataControls: string[];
  nextActions: string[];
}

function hasEvent(state: AppState, type: EventType): boolean {
  return state.events.some((event) => event.type === type);
}

function statusWeight(status: PilotReadinessStatus): number {
  if (status === "ready") return 1;
  if (status === "shadow") return 0.62;
  return 0.34;
}

export function buildPilotReadinessReport(
  state: AppState,
  cohortOps: CohortOpsReport,
  launchReadiness: LaunchReadinessReport,
): PilotReadinessReport {
  const coverage = evidenceCoverage(state.events);
  const hasGitEvidence = hasEvent(state, "issue_created") || hasEvent(state, "pr_opened") || hasEvent(state, "commit_pushed");
  const hasCiEvidence = hasEvent(state, "ci_failed") || hasEvent(state, "ci_passed");
  const hasTeacherReview = hasEvent(state, "teacher_reviewed");
  const hasReflection = hasEvent(state, "reflection_submitted");
  const hasClosedLoop = hasCiEvidence && hasTeacherReview && hasReflection;

  const checklist: PilotChecklistItem[] = [
    {
      id: "roster",
      label: "班级名册与分组",
      owner: "teacher",
      status: cohortOps.learnerCount >= 4 ? "ready" : "shadow",
      evidence: `${cohortOps.cohortName} 已形成 ${cohortOps.learnerCount} 名学生的风险分层样例。`,
      nextAction: "真实接入时导入学号映射表，并只保存脱敏学生 ID。",
    },
    {
      id: "consent",
      label: "授权与数据最小化",
      owner: "school",
      status: state.learner.consentValid ? "ready" : "manual",
      evidence: state.learner.consentValid
        ? "当前演示学生已标记 consentValid=true。"
        : "必须补齐课程授权和数据使用范围。",
      nextAction: "试点前由课程负责人确认告知、授权、退出机制和数据保存期限。",
    },
    {
      id: "repository",
      label: "仓库/Issue/PR/CI 接入",
      owner: "assistant",
      status: hasGitEvidence && hasCiEvidence ? "ready" : "shadow",
      evidence: hasGitEvidence && hasCiEvidence
        ? "Git 与 CI 证据已进入 EvidenceEvent 账本。"
        : "当前仍可用样本仓库事件做影子回放。",
      nextAction: "生产环境使用 GitHub/GitLab Webhook 或课程平台 API 接入。",
    },
    {
      id: "teacher-gate",
      label: "教师发布门",
      owner: "teacher",
      status: hasTeacherReview ? "ready" : "shadow",
      evidence: hasTeacherReview ? "教师复核事件已回写学习账本。" : "高风险建议已能进入教师复核工单，但还未放行。",
      nextAction: "每周固定 15 分钟处理 P0/P1 复核队列。",
    },
    {
      id: "growthops",
      label: "班级干预队列",
      owner: "assistant",
      status: cohortOps.highRiskCount > 0 ? "ready" : "shadow",
      evidence: `${cohortOps.highRiskCount} 名高风险学生已进入 GrowthOps 队列。`,
      nextAction: "把 P0/P1 行动同步到飞书群或教学管理平台。",
    },
    {
      id: "deployment",
      label: "公开访问与服务 SLA",
      owner: "team",
      status: launchReadiness.manualCount > 0 ? "manual" : "ready",
      evidence: `${launchReadiness.cloudUrl} 当前阶段为 ${launchReadiness.stage}。`,
      nextAction: "按比赛或学校要求决定 owner-only、公开只读或账号制访问。",
    },
    {
      id: "measurement",
      label: "试点成效评估",
      owner: "school",
      status: hasClosedLoop && coverage >= 0.7 ? "ready" : "shadow",
      evidence: `当前证据覆盖率 ${Math.round(coverage * 100)}%，闭环事件${hasClosedLoop ? "已补齐" : "仍可继续补齐"}。`,
      nextAction: "正式试点只宣称阻塞解除时间、复核工作量和反思质量，不提前宣称提分因果。",
    },
  ];

  const readyCount = checklist.filter((item) => item.status === "ready").length;
  const shadowCount = checklist.filter((item) => item.status === "shadow").length;
  const manualCount = checklist.filter((item) => item.status === "manual").length;
  const readinessScore = Math.round(
    (checklist.reduce((total, item) => total + statusWeight(item.status), 0) / checklist.length) * 100,
  );

  const mode =
    manualCount > 0
      ? "可公开试用 / 课程影子运行"
      : shadowCount > 0
        ? "可小班试点 / 教师确认干预"
        : "可规模化课程试点";

  const gate =
    manualCount > 0
      ? "允许演示和只读试用，真实课程干预前必须确认访问策略与数据协议。"
      : shadowCount > 0
        ? "允许小班影子运行，教师确认后开放干预。"
        : "允许进入正式课程试点。";

  return {
    readinessScore,
    mode,
    gate,
    readyCount,
    shadowCount,
    manualCount,
    checklist,
    integrations: [
      {
        id: "git-ci",
        name: "Git / CI Webhook",
        currentMode: "样本事件导入 + 手动补证据",
        productionTarget: "GitHub/GitLab Webhook 写入 EvidenceEvent",
        riskControl: "只存 PR、CI、Review 摘要和脱敏 ID，不保存仓库密钥。",
      },
      {
        id: "lms-rubric",
        name: "课程 Rubric / LMS",
        currentMode: "内置 Rubric 与知识边界检索",
        productionTarget: "课程平台任务、评分标准和截止时间 API",
        riskControl: "Rubric 是模型输出边界，禁止绕过教师评分标准。",
      },
      {
        id: "feishu",
        name: "飞书 GrowthOps",
        currentMode: "同步预览文本",
        productionTarget: "教师群 P0/P1 干预卡片与复核提醒",
        riskControl: "高风险学生只显示脱敏标识，敏感详情回到系统内查看。",
      },
      {
        id: "storage",
        name: "课程数据层",
        currentMode: "localStorage + JSON 导出",
        productionTarget: "Supabase/Postgres 或学校课程平台数据库",
        riskControl: "按课程维度隔离租户，保留导出和删除通道。",
      },
    ],
    rolloutStages: [
      {
        id: "stage-0",
        label: "第 0 阶段：公开只读试用",
        objective: "评委、教师和学生不用登录即可理解闭环能力。",
        gate: "只读静态包或 owner-only 云端访问，不接真实学生数据。",
      },
      {
        id: "stage-1",
        label: "第 1 阶段：影子诊断",
        objective: "接入真实 PR/CI 但不自动推送干预，只生成诊断和教师建议。",
        gate: "证据覆盖率连续两周超过 70%，教师确认误报可控。",
      },
      {
        id: "stage-2",
        label: "第 2 阶段：教师确认干预",
        objective: "允许系统生成 mini lab、检查清单和反思任务，教师复核高风险建议。",
        gate: "P0/P1 队列处理时长下降，学生投诉和替写风险为 0。",
      },
      {
        id: "stage-3",
        label: "第 3 阶段：班级 GrowthOps",
        objective: "多班级、多任务运营，形成课程级学习分析和干预复盘。",
        gate: "完成数据协议、权限隔离、审计日志和回滚预案。",
      },
    ],
    metrics: [
      {
        id: "coverage",
        label: "证据覆盖率",
        value: `${Math.round(coverage * 100)}%`,
        target: "真实试点连续两周 >=70%",
      },
      {
        id: "cohort-risk",
        label: "高风险学生",
        value: `${cohortOps.highRiskCount}/${cohortOps.learnerCount}`,
        target: "P0 队列当天处理",
      },
      {
        id: "teacher-time",
        label: "教师节省时间",
        value: `${cohortOps.estimatedTeacherMinutesSaved} 分钟/轮`,
        target: "以教师确认记录为准，不提前宣称长期提分",
      },
      {
        id: "manual-gates",
        label: "人工门禁",
        value: `${manualCount} 项`,
        target: "上线前剩余人工门禁全部有负责人",
      },
    ],
    workspaceConfig: [
      `course=${cohortOps.cohortName}`,
      "tenantMode=course_isolated",
      "privacyMode=pseudonymous_student_id",
      "retentionDays=180",
      "defaultIntervention=teacher_confirmed",
    ],
    dataControls: [
      "真实数据接入前不上传姓名、手机号、邮箱或仓库密钥。",
      "EvidenceEvent 只保存教学决策需要的最小摘要。",
      "学生可退出试点，退出后保留聚合指标并删除个人事件。",
      "高风险建议默认进入教师发布门，不允许模型自动替写可提交代码。",
    ],
    nextActions: checklist
      .filter((item) => item.status !== "ready")
      .map((item) => `${item.owner}: ${item.nextAction}`)
      .slice(0, 4),
  };
}
