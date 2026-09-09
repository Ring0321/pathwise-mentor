import type { AppState, CompetencyId, RiskLevel } from "../domain/types";
import { evidenceCoverage, scoreCompetencies } from "./evidence";

export interface CohortLearnerSnapshot {
  id: string;
  name: string;
  group: string;
  blocker: string;
  risk: RiskLevel;
  evidenceCoverage: number;
  pathProgress: number;
  teacherMinutesSaved: number;
  weakestCompetency: CompetencyId;
}

export interface GrowthOpsAction {
  id: string;
  label: string;
  owner: "teacher" | "assistant" | "student";
  priority: "P0" | "P1" | "P2";
  due: string;
  reason: string;
}

export interface CohortOpsReport {
  cohortName: string;
  learnerCount: number;
  highRiskCount: number;
  averageCoverage: number;
  averagePathProgress: number;
  estimatedTeacherMinutesSaved: number;
  summary: string;
  learners: CohortLearnerSnapshot[];
  actions: GrowthOpsAction[];
  feishuSyncPreview: string[];
}

const competencyLabels: Record<CompetencyId, string> = {
  requirements: "需求拆解",
  architecture: "模块设计",
  implementation: "编码实现",
  testing: "测试质量",
  collaboration: "协作交付",
  reflection: "复盘迁移",
};

const syntheticPeers: CohortLearnerSnapshot[] = [
  {
    id: "stu-zhao",
    name: "赵同学",
    group: "订单服务 A 组",
    blocker: "PR 描述缺少回滚策略",
    risk: "medium",
    evidenceCoverage: 0.68,
    pathProgress: 0.56,
    teacherMinutesSaved: 12,
    weakestCompetency: "collaboration",
  },
  {
    id: "stu-chen",
    name: "陈同学",
    group: "库存服务 B 组",
    blocker: "只提交实现，没有失败用例",
    risk: "high",
    evidenceCoverage: 0.52,
    pathProgress: 0.38,
    teacherMinutesSaved: 18,
    weakestCompetency: "testing",
  },
  {
    id: "stu-wu",
    name: "吴同学",
    group: "支付服务 C 组",
    blocker: "异常边界已补齐，等待教师复核",
    risk: "low",
    evidenceCoverage: 0.81,
    pathProgress: 0.74,
    teacherMinutesSaved: 10,
    weakestCompetency: "reflection",
  },
];

function weakestCompetency(scores: Record<CompetencyId, number>): CompetencyId {
  return (Object.entries(scores).sort((a, b) => a[1] - b[1])[0][0] ?? "testing") as CompetencyId;
}

function riskScore(risk: RiskLevel): number {
  if (risk === "high") return 3;
  if (risk === "medium") return 2;
  return 1;
}

export function buildCohortOpsReport(state: AppState): CohortOpsReport {
  const scores = scoreCompetencies(state.learner.baseline, state.events);
  const liveCoverage = evidenceCoverage(state.events);
  const hasCiPass = state.events.some((event) => event.type === "ci_passed");
  const hasReflection = state.events.some((event) => event.type === "reflection_submitted");
  const liveProgress = Math.min(1, 0.2 + state.events.length * 0.08 + (hasCiPass ? 0.16 : 0) + (hasReflection ? 0.1 : 0));
  const weakest = weakestCompetency(scores);
  const liveRisk: RiskLevel = liveCoverage < 0.55 ? "high" : liveProgress < 0.7 ? "medium" : "low";

  const liveLearner: CohortLearnerSnapshot = {
    id: state.learner.id,
    name: state.learner.name,
    group: "当前演示组",
    blocker: `${competencyLabels[weakest]}仍是当前最弱节点`,
    risk: liveRisk,
    evidenceCoverage: liveCoverage,
    pathProgress: liveProgress,
    teacherMinutesSaved: Math.round(8 + state.events.length * 1.7),
    weakestCompetency: weakest,
  };

  const learners = [liveLearner, ...syntheticPeers].sort((a, b) => {
    const riskDelta = riskScore(b.risk) - riskScore(a.risk);
    if (riskDelta !== 0) return riskDelta;
    return a.pathProgress - b.pathProgress;
  });

  const highRiskCount = learners.filter((learner) => learner.risk === "high").length;
  const averageCoverage = learners.reduce((total, learner) => total + learner.evidenceCoverage, 0) / learners.length;
  const averagePathProgress = learners.reduce((total, learner) => total + learner.pathProgress, 0) / learners.length;
  const estimatedTeacherMinutesSaved = learners.reduce(
    (total, learner) => total + learner.teacherMinutesSaved,
    0,
  );

  const actions: GrowthOpsAction[] = [
    {
      id: "ops-high-risk-lab",
      label: "给高风险学生推送异常路径 mini lab",
      owner: "assistant",
      priority: highRiskCount > 0 ? "P0" : "P1",
      due: "今天课后",
      reason: `${highRiskCount} 名学生处于高风险或低路径进度状态`,
    },
    {
      id: "ops-teacher-review",
      label: "教师集中复核 AI 使用边界",
      owner: "teacher",
      priority: "P1",
      due: "下一次实验课前",
      reason: "避免学生把 AI 脚手架误用为可提交答案",
    },
    {
      id: "ops-reflection",
      label: "收集一次失败到修复的反思卡片",
      owner: "student",
      priority: averageCoverage > 0.7 ? "P2" : "P1",
      due: "本周五",
      reason: "把 CI 失败经验沉淀为长期记忆和迁移策略",
    },
  ];

  return {
    cohortName: "软件工程项目式学习试点班",
    learnerCount: learners.length,
    highRiskCount,
    averageCoverage,
    averagePathProgress,
    estimatedTeacherMinutesSaved,
    summary:
      "班级运营看板把单个学生闭环升级为教师可用的 GrowthOps 队列：先看风险，再看证据覆盖，最后把干预任务同步给教师、学生和智能体。",
    learners,
    actions,
    feishuSyncPreview: actions.map(
      (action) => `${action.priority} | ${action.owner} | ${action.label} | ${action.due}`,
    ),
  };
}

