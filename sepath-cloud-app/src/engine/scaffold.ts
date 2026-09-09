import type { DiagnosisCard, ScaffoldMessage } from "../domain/types";

export function generateScaffold(diagnosis: DiagnosisCard): ScaffoldMessage {
  const directAnswerRisk = diagnosis.reasonCodes.includes("DIRECT_ANSWER_REQUEST_DETECTED");
  const level: 1 | 2 | 3 =
    diagnosis.risk === "high" ? 1 : diagnosis.confidence > 0.8 && diagnosis.evidenceCoverage > 0.65 ? 2 : 1;

  return {
    id: "scaffold-current",
    level,
    title: directAnswerRisk ? "已切换为不替写脚手架模式" : "下一步最小行动",
    body: directAnswerRisk
      ? "我不能直接给完整 service 层代码。你可以先把失败用例转成验收条件，再用下面的清单定位最小修改点。"
      : "先不要大改业务逻辑。用一个失败测试定位异常路径，再提交小步修复。",
    checklist: [
      "把 CI 失败日志中的期望状态码、实际状态码和触发输入写成三行记录。",
      "确认库存不足、缺失字段、重复提交是否分别有独立测试。",
      "只改一个异常分支，先让最小失败用例通过。",
      "PR 描述中写清楚为什么不是 500，以及如何回滚。",
    ],
    refusesDirectAnswer: directAnswerRisk,
    evidenceEventIds: diagnosis.evidenceEventIds,
  };
}
