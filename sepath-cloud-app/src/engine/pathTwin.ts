import type { AppState, CompetencyId, PathNodeState } from "../domain/types";
import { competencyGraph } from "../data/seed";
import { scoreCompetencies } from "./evidence";

const nodeLabels: Record<CompetencyId, string> = {
  requirements: "把需求转成验收条件",
  architecture: "确认模块边界与依赖",
  implementation: "完成最小可回滚修复",
  testing: "补齐异常路径测试",
  collaboration: "提交可审阅 PR",
  reflection: "完成错误归因复盘",
};

export function buildPathTwin(state: AppState): PathNodeState[] {
  const scores = scoreCompetencies(state.learner.baseline, state.events);
  return competencyGraph.map((node) => {
    const score = scores[node.id];
    const evidenceEventIds = state.events
      .filter((event) => Object.keys(event.competencyImpacts).includes(node.id))
      .map((event) => event.id);
    const prerequisitesComplete = node.prerequisiteIds.every((id) => scores[id] >= 70);
    const status =
      score >= 78
        ? "completed"
        : score < 45
          ? "blocked"
          : prerequisitesComplete || node.prerequisiteIds.length === 0
            ? "in_progress"
            : "locked";
    return {
      id: `path-${node.id}`,
      label: nodeLabels[node.id],
      competencyId: node.id,
      status,
      evidenceEventIds,
    };
  });
}
