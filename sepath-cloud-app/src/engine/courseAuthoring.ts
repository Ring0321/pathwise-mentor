import type { AppState, CompetencyId, KnowledgeSource, PathNodeState } from "../domain/types";
import type { ApiContractReport } from "./apiContract";
import { evidenceCoverage, scoreCompetencies } from "./evidence";
import type { ModelOpsReport } from "./modelOps";
import type { PrivacyGuardReport } from "./privacyGuard";

export type CourseAuthoringStatus = "ready" | "configured" | "manual";

export interface CourseWorkspaceConfig {
  id: string;
  label: string;
  value: string;
  owner: "teacher" | "course_admin" | "ops";
  status: CourseAuthoringStatus;
}

export interface RubricTemplate {
  competencyId: CompetencyId;
  label: string;
  weight: number;
  masteryTarget: number;
  evidenceSignals: string[];
  aiBoundary: string;
  scoringLevels: string[];
  status: CourseAuthoringStatus;
}

export interface AssignmentTemplate {
  id: string;
  label: string;
  scenario: string;
  workflow: string[];
  evidenceSources: string[];
  teacherGate: string;
  status: CourseAuthoringStatus;
}

export interface AIPolicyRule {
  id: string;
  label: string;
  allowed: string[];
  blocked: string[];
  escalation: string;
  status: CourseAuthoringStatus;
}

export interface PublishChecklistItem {
  id: string;
  label: string;
  owner: "teacher" | "course_admin" | "ops";
  status: CourseAuthoringStatus;
  evidence: string;
}

export interface CourseAuthoringReport {
  score: number;
  courseTitle: string;
  courseVersion: string;
  mode: string;
  gate: string;
  readyCount: number;
  configuredCount: number;
  manualCount: number;
  workspace: CourseWorkspaceConfig[];
  rubrics: RubricTemplate[];
  assignments: AssignmentTemplate[];
  aiPolicies: AIPolicyRule[];
  publishChecklist: PublishChecklistItem[];
  learningDesignPatterns: string[];
  exportManifest: string;
}

const competencyLabels: Record<CompetencyId, string> = {
  requirements: "需求分析与验收条件",
  architecture: "架构边界与模块依赖",
  implementation: "可回滚实现能力",
  testing: "测试设计与 CI 修复",
  collaboration: "协作、评审与证据表达",
  reflection: "反思、迁移与长期记忆",
};

function hasKnowledgeSource(sources: KnowledgeSource[], competencyId: CompetencyId): boolean {
  return sources.some((source) => source.competencyIds.includes(competencyId));
}

function statusWeight(status: CourseAuthoringStatus): number {
  if (status === "ready") return 1;
  if (status === "configured") return 0.74;
  return 0.44;
}

function countStatuses(groups: CourseAuthoringStatus[]) {
  const readyCount = groups.filter((status) => status === "ready").length;
  const configuredCount = groups.filter((status) => status === "configured").length;
  const manualCount = groups.filter((status) => status === "manual").length;
  const score = Math.round((groups.reduce((total, status) => total + statusWeight(status), 0) / groups.length) * 100);
  return { readyCount, configuredCount, manualCount, score };
}

export function buildCourseAuthoringReport(
  state: AppState,
  knowledgeSources: KnowledgeSource[],
  pathNodes: PathNodeState[],
  privacyGuard: PrivacyGuardReport,
  apiContract: ApiContractReport,
  modelOps: ModelOpsReport,
): CourseAuthoringReport {
  const scores = scoreCompetencies(state.learner.baseline, state.events);
  const coverage = evidenceCoverage(state.events);
  const completedPathNodes = pathNodes.filter((node) => node.status === "completed").length;
  const manualSystemGates = apiContract.manualCount + modelOps.manualCount + (privacyGuard.gate === "pass" ? 0 : 1);
  const privacyReady = privacyGuard.gate === "pass";

  const workspace: CourseWorkspaceConfig[] = [
    {
      id: "tenant",
      label: "课程租户",
      value: "tenant-se-course-2026 / course-software-engineering-project",
      owner: "ops",
      status: "ready",
    },
    {
      id: "rubric-version",
      label: "Rubric 版本",
      value: "rubric.se.project.v1.0",
      owner: "teacher",
      status: state.task.rubric.length >= 3 ? "ready" : "configured",
    },
    {
      id: "task-graph",
      label: "路径任务图",
      value: `${pathNodes.length} 个能力节点，${completedPathNodes} 个已完成节点`,
      owner: "course_admin",
      status: pathNodes.length >= 6 ? "ready" : "configured",
    },
    {
      id: "ai-policy",
      label: "AI 使用边界",
      value: "scaffold-only / no-substitution / teacher-gate",
      owner: "course_admin",
      status: privacyReady ? "ready" : "manual",
    },
    {
      id: "lms-integration",
      label: "LMS 与工具互联",
      value: "LTI/xAPI ready, Git/CI webhook ready, Feishu card configured",
      owner: "ops",
      status: apiContract.score >= 80 ? "configured" : "manual",
    },
  ];

  const rubrics: RubricTemplate[] = (Object.keys(competencyLabels) as CompetencyId[]).map((competencyId) => {
    const score = scores[competencyId];
    const hasSource = hasKnowledgeSource(knowledgeSources, competencyId);
    return {
      competencyId,
      label: competencyLabels[competencyId],
      weight: competencyId === "testing" || competencyId === "implementation" ? 20 : 15,
      masteryTarget: 78,
      evidenceSignals: [
        `${competencyId} score=${Math.round(score)}`,
        hasSource ? "course source matched" : "teacher rubric source needed",
        "EvidenceEvent trace required",
      ],
      aiBoundary:
        competencyId === "implementation"
          ? "允许解释边界、给出检查清单和最小修复方向；禁止输出可直接提交的完整实现。"
          : "允许给出诊断、提示和反思问题；需要保留学生独立完成证据。",
      scoringLevels: [
        "0-59：证据缺失或无法复核",
        "60-77：能完成局部任务但缺少迁移",
        "78-89：能独立完成并解释关键取舍",
        "90-100：能复用到新场景并帮助同伴评审",
      ],
      status: hasSource && score >= 60 ? "ready" : hasSource ? "configured" : "manual",
    };
  });

  const assignments: AssignmentTemplate[] = [
    {
      id: "pr-debug-sprint",
      label: "PR Debug Sprint",
      scenario: state.task.title,
      workflow: ["导入 Issue", "提交 PR", "触发 CI", "SafeVOI 选择下一步", "教师复核高风险建议", "反思回写"],
      evidenceSources: ["git.pr", "ci.check", "chat.scaffold", "teacher.review", "reflection"],
      teacherGate: "直接替写、绕过测试、低证据高风险建议必须进入教师发布门。",
      status: state.events.some((event) => event.type === "ci_failed") ? "ready" : "configured",
    },
    {
      id: "architecture-boundary-lab",
      label: "架构边界 Lab",
      scenario: "把 service/controller/repository 边界拆成可测试决策。",
      workflow: ["上传模块图", "标注依赖", "生成边界问题", "小组互评", "教师确认"],
      evidenceSources: ["rubric", "code_evidence", "teacher.review"],
      teacherGate: "涉及重构方向时只给验证问题，不替学生决定全部实现。",
      status: "configured",
    },
    {
      id: "ci-recovery-lab",
      label: "CI Recovery Lab",
      scenario: "从失败日志中定位异常路径，补齐单元测试与回归说明。",
      workflow: ["读取失败摘要", "匹配测试 Rubric", "生成最小复现实验", "提交修复", "反思迁移"],
      evidenceSources: ["ci.failed", "ci.passed", "reflection"],
      teacherGate: "原始大日志和密钥不进入模型上下文。",
      status: state.events.some((event) => event.type === "ci_passed") ? "ready" : "configured",
    },
    {
      id: "review-quality-round",
      label: "Review Quality Round",
      scenario: "把代码评审从形式打分升级为证据化反馈。",
      workflow: ["抽取 PR 摘要", "按 Rubric 生成评审提纲", "学生互评", "教师抽检", "班级共性阻塞分析"],
      evidenceSources: ["git.review", "teacher.review", "cohort.ops"],
      teacherGate: "评审结论只进入课程内部，不公开学生风险分层。",
      status: state.events.some((event) => event.type === "teacher_reviewed") ? "ready" : "configured",
    },
  ];

  const aiPolicies: AIPolicyRule[] = [
    {
      id: "DIRECT_ANSWER_POLICY_GATE",
      label: "直接答案替写拦截",
      allowed: ["解释错误原因", "提供定位步骤", "给出测试清单", "提出反思问题"],
      blocked: ["完整 service 层代码", "可直接提交的作业答案", "绕过测试或伪造证据"],
      escalation: "创建教师复核工单，并把原始请求保留为高风险 EvidenceEvent。",
      status: "ready",
    },
    {
      id: "LOW_EVIDENCE_SHADOW_MODE",
      label: "低证据影子运行",
      allowed: ["生成诊断候选", "提示需要补齐的证据", "只读展示路径图"],
      blocked: ["自动发布个性化干预", "写入真实成绩", "向同伴暴露风险分层"],
      escalation: "证据覆盖低于 70% 时只给教师看，不向学生自动推送。",
      status: coverage >= 0.7 ? "ready" : "configured",
    },
    {
      id: "PSEUDONYMIZED_COURSE_SPACE",
      label: "脱敏课程空间",
      allowed: ["learnerHash", "PR/CI 摘要", "Rubric 命中", "教师工单状态"],
      blocked: ["手机号", "邮箱", "仓库密钥", "原始私有聊天记录"],
      escalation: "隐私扫描命中时阻断导出与公开部署。",
      status: privacyReady ? "ready" : "manual",
    },
    {
      id: "TEACHER_CONFIRMED_AB",
      label: "教师确认实验",
      allowed: ["离线回放", "影子运行", "教师确认后的小班 A/B"],
      blocked: ["未经试点宣称真实提分", "自动把实验结论写入成绩"],
      escalation: "所有线上效果只在试点协议内统计，材料中保留真实性边界。",
      status: modelOps.manualCount > 0 ? "configured" : "ready",
    },
  ];

  const publishChecklist: PublishChecklistItem[] = [
    {
      id: "course-blueprint",
      label: "课程蓝图已配置",
      owner: "teacher",
      status: "ready",
      evidence: `${state.task.competencyIds.length} 个任务能力目标与 ${state.task.rubric.length} 条评分要求已绑定。`,
    },
    {
      id: "rubric-coverage",
      label: "Rubric 覆盖六项能力",
      owner: "teacher",
      status: rubrics.every((item) => item.status !== "manual") ? "ready" : "manual",
      evidence: `${rubrics.filter((item) => item.status !== "manual").length}/${rubrics.length} 项有知识源或评分证据。`,
    },
    {
      id: "policy-boundary",
      label: "AI 边界与红线",
      owner: "course_admin",
      status: aiPolicies.every((item) => item.status !== "manual") ? "ready" : "manual",
      evidence: "直接答案、低证据、脱敏空间和教师确认实验均有规则。",
    },
    {
      id: "teacher-reviewers",
      label: "教师复核人",
      owner: "course_admin",
      status: state.events.some((event) => event.type === "teacher_reviewed") ? "ready" : "configured",
      evidence: "高风险建议已可生成教师复核工单，真实上线需填主备复核人。",
    },
    {
      id: "integration-contract",
      label: "工具集成契约",
      owner: "ops",
      status: apiContract.score >= 80 ? "configured" : "manual",
      evidence: `${apiContract.endpoints.length} 个 API 与 ${apiContract.webhooks.length} 类 Webhook 已建模。`,
    },
    {
      id: "model-release",
      label: "模型与实验发布门",
      owner: "ops",
      status: modelOps.score >= 75 ? "configured" : "manual",
      evidence: modelOps.gate,
    },
  ];

  const statuses = [
    ...workspace.map((item) => item.status),
    ...rubrics.map((item) => item.status),
    ...assignments.map((item) => item.status),
    ...aiPolicies.map((item) => item.status),
    ...publishChecklist.map((item) => item.status),
  ];
  const { readyCount, configuredCount, manualCount, score } = countStatuses(statuses);

  const manifest = {
    courseTitle: "软件工程项目式学习：从失败 PR 到可复核成长",
    courseVersion: "sepath-course-design.v1.0",
    taskId: state.task.id,
    rubricVersion: "rubric.se.project.v1.0",
    policyVersion: "sepath-ai-policy.v1.0",
    learnerSpace: "pseudonymous",
    evidenceCoverage: Math.round(coverage * 100),
    pathNodeCount: pathNodes.length,
    manualSystemGates,
    publishChecklist: publishChecklist.map((item) => ({ id: item.id, status: item.status })),
  };

  return {
    score,
    courseTitle: manifest.courseTitle,
    courseVersion: manifest.courseVersion,
    mode: manualCount > 0 ? "Course Studio / Shadow-first" : "Course Studio / Small-cohort pilot",
    gate:
      manualCount > 0
        ? "课程包可用于比赛演示和教师配置；真实班级自动干预前仍需补齐人工项。"
        : "课程包已具备小班试点所需的 Rubric、AI 边界、证据账本和发布门。",
    readyCount,
    configuredCount,
    manualCount,
    workspace,
    rubrics,
    assignments,
    aiPolicies,
    publishChecklist,
    learningDesignPatterns: [
      "Learning Design as Code：把课程目标、Rubric、AI 边界和工具契约一起版本化。",
      "Evidence-first Rubric：每个评分点都要求 EvidenceEvent 或教师复核，不只看聊天文本。",
      "Software Engineering Native：以 PR、CI、Issue、Review 和反思日志作为核心学习证据。",
      "Shadow-first Pilot：真实课程先只读诊断和教师确认，再逐步开放自动干预。",
      "No-substitution AI：AI 做脚手架和追问，不替学生完成可提交作业。",
    ],
    exportManifest: JSON.stringify(manifest, null, 2),
  };
}
