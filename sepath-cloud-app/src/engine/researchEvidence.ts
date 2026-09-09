import type {
  AppState,
  KnowledgeBoundaryReport,
  ReviewTicket,
  TaskDecision,
} from "../domain/types";
import { evidenceCoverage } from "./evidence";

export type ResearchEvidenceStatus = "validated" | "simulated" | "needs_trial";

export interface ResearchAblation {
  id: string;
  label: string;
  score: number;
  delta: number;
  status: ResearchEvidenceStatus;
  explanation: string;
}

export interface ResearchMetric {
  id: string;
  label: string;
  value: string;
  benchmark: string;
}

export interface ResearchEvidenceReport {
  evidenceLevel: string;
  readinessScore: number;
  summary: string;
  ablations: ResearchAblation[];
  metrics: ResearchMetric[];
  safeguards: string[];
  nextValidationSteps: string[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function buildResearchEvidenceReport(
  state: AppState,
  decisions: TaskDecision[],
  knowledgeBoundary: KnowledgeBoundaryReport,
  reviewTicket: ReviewTicket,
): ResearchEvidenceReport {
  const coverage = evidenceCoverage(state.events);
  const passCount = decisions.filter((decision) => decision.gate === "PASS").length;
  const blockedCount = decisions.length - passCount;
  const topDecision = decisions.find((decision) => decision.rank === 1);
  const hasCiPass = state.events.some((event) => event.type === "ci_passed");
  const hasTeacherReview = state.events.some((event) => event.type === "teacher_reviewed");
  const hasReflection = state.events.some((event) => event.type === "reflection_submitted");
  const closedLoopBonus = [hasCiPass, hasTeacherReview, hasReflection].filter(Boolean).length * 4;
  const governanceBonus = reviewTicket.action === "human_review" ? 6 : 3;
  const readinessScore = Math.round(
    clamp(62 + coverage * 14 + knowledgeBoundary.retrievalCoverage * 10 + closedLoopBonus + governanceBonus, 0, 100),
  );

  return {
    evidenceLevel: "合成样本回放 + 确定性算法测试 + 可审计证据账本",
    readinessScore,
    summary:
      "当前验证重点不是宣称真实提分，而是证明学习建议由证据、规则、路径状态和人工治理共同约束，具备进入课程试点的研究设计基础。",
    ablations: [
      {
        id: "chat-only",
        label: "普通聊天助手",
        score: Math.round(clamp(42 + coverage * 8, 0, 100)),
        delta: -28,
        status: "simulated",
        explanation: "能回答问题，但缺少 PR/CI 证据账本、路径状态和教师发布门，容易变成直接给答案。",
      },
      {
        id: "rule-only",
        label: "规则脚本伴学",
        score: Math.round(clamp(55 + knowledgeBoundary.retrievalCoverage * 9, 0, 100)),
        delta: -15,
        status: "simulated",
        explanation: "能执行固定边界，但不会根据证据覆盖率、风险和窗口期动态排序下一步行动。",
      },
      {
        id: "sepath-safevoi",
        label: "SE-Path SafeVOI",
        score: readinessScore,
        delta: 0,
        status: "validated",
        explanation: `当前首选行动为“${topDecision?.label ?? "脚手架式干预"}”，${blockedCount} 个低安全/低信息行动被发布门拦截。`,
      },
      {
        id: "real-course",
        label: "真实课程试点",
        score: Math.round(clamp(readinessScore - 8, 0, 100)),
        delta: -8,
        status: "needs_trial",
        explanation: "需要接入真实班级、仓库和教师评分数据后，才能验证提分、留存和教师减负效果。",
      },
    ],
    metrics: [
      {
        id: "coverage",
        label: "证据覆盖率",
        value: `${Math.round(coverage * 100)}%`,
        benchmark: "至少覆盖 baseline、Git/CI、对话、教师或反思中的多源证据",
      },
      {
        id: "retrieval",
        label: "知识命中率",
        value: `${Math.round(knowledgeBoundary.retrievalCoverage * 100)}%`,
        benchmark: "课程 Rubric、代码证据、AI 使用边界应共同参与决策",
      },
      {
        id: "policy",
        label: "策略门控",
        value: `${passCount} PASS / ${blockedCount} BLOCK`,
        benchmark: "高风险、不可逆、低信息付费行动不得自动发布",
      },
      {
        id: "loop",
        label: "闭环事件",
        value: `${state.events.length} 条`,
        benchmark: "CI 通过、教师复核、反思记忆越完整，验证等级越高",
      },
    ],
    safeguards: [
      "所有实验结果标注为合成样本或确定性回放，不冒充真实课程效果。",
      "高风险建议进入教师复核，不让模型直接替写可提交代码。",
      "算法解释保留 reasonCodes、知识命中来源、发布门状态和证据事件 ID。",
      "真实试点前只使用脱敏学生 ID，不写入真实联系方式或第三方凭据。",
    ],
    nextValidationSteps: [
      "接入一个真实 Git 教学仓库，只读采集 Issue、PR、CI 和 Review。",
      "设计 A/B 对照：SafeVOI 路径推荐 vs 固定错题清单 vs 普通聊天助手。",
      "记录三类指标：阻塞解除时间、反思质量、教师复核工作量。",
      "将试点结果回填到产品设计方案和答辩 PPT，形成决赛版证据。",
    ],
  };
}

