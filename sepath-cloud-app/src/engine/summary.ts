import type { AppState } from "../domain/types";
import { diagnoseLearner } from "./diagnosis";
import { scoreCompetencies } from "./evidence";

export function buildAwardSummary(state: AppState): string {
  const diagnosis = diagnoseLearner(state.learner, state.events);
  const scores = scoreCompetencies(state.learner.baseline, state.events);
  const testing = Math.round(scores.testing);
  const reflection = Math.round(scores.reflection);
  return `当前闭环已采集 ${state.events.length} 条证据，测试能力估计 ${testing} 分，复盘迁移 ${reflection} 分。诊断焦点为“${diagnosis.blocker}”，系统已将建议限定为脚手架与教师可复核动作。`;
}
