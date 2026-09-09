import { Beaker, GitCompareArrows, ShieldCheck, Trophy } from "lucide-react";
import type { StrategyLabReport, StrategyPolicyId } from "../engine/strategyLab";

interface StrategyLabPanelProps {
  report: StrategyLabReport;
}

const policyClass: Record<StrategyPolicyId, string> = {
  "chat-only": "chat",
  "static-path": "static",
  "sepath-safevoi": "safevoi",
};

export function StrategyLabPanel({ report }: StrategyLabPanelProps) {
  return (
    <section className="panel strategy-panel" id="strategy">
      <div className="panel-heading">
        <h2>策略实验室与对照仿真</h2>
        <span>用同一组学习事件对比普通聊天、固定路径和 SE-Path SafeVOI 闭环</span>
      </div>

      <div className="strategy-hero">
        <article>
          <Trophy size={24} />
          <div>
            <strong>{report.winnerLabel}</strong>
            <p>{report.summary}</p>
          </div>
        </article>
        <div className="strategy-margin">
          <strong>+{report.winnerMargin}</strong>
          <span>领先第二策略</span>
        </div>
      </div>

      <div className="strategy-policy-grid">
        {report.policyResults.map((policy) => (
          <article className={`strategy-card ${policyClass[policy.id]}`} key={policy.id}>
            <div className="strategy-card-head">
              <GitCompareArrows size={18} />
              <strong>{policy.label}</strong>
              <b>{policy.compositeScore}</b>
            </div>
            <p>{policy.explanation}</p>
            <div className="strategy-metrics">
              <span>
                学习增益 <b>{policy.learningGain}</b>
              </span>
              <span>
                风险拦截 <b>{policy.riskInterception}</b>
              </span>
              <span>
                证据追溯 <b>{policy.evidenceTraceability}</b>
              </span>
              <span>
                路径自适应 <b>{policy.pathAdaptivity}</b>
              </span>
              <span>
                教师效率 <b>{policy.teacherEfficiency}</b>
              </span>
            </div>
            <div className="strategy-gate-row">
              <span>可发布 {policy.publishableActions}</span>
              <span>拦截 {policy.blockedUnsafeActions}</span>
            </div>
          </article>
        ))}
      </div>

      <div className="strategy-detail-grid">
        <article>
          <div className="ops-heading">
            <Beaker size={18} />
            <strong>场景回放</strong>
          </div>
          <div className="scenario-list">
            {report.scenarios.map((scenario) => (
              <div key={scenario.id}>
                <strong>{scenario.label}</strong>
                <span>
                  {scenario.signal} / {scenario.expectedRisk}
                </span>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <ShieldCheck size={18} />
            <strong>可审计结论</strong>
          </div>
          <div className="audit-chip-list">
            {report.auditTrail.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </article>
      </div>

      <div className="strategy-outcome-table">
        {report.scenarioResults.map((item) => (
          <div key={`${item.scenarioId}-${item.policyId}`}>
            <span>{report.scenarios.find((scenario) => scenario.id === item.scenarioId)?.label}</span>
            <strong>{report.policyResults.find((policy) => policy.id === item.policyId)?.label}</strong>
            <p>{item.action}</p>
            <b className={item.riskHandled ? "handled" : "missed"}>
              {item.riskHandled ? "风险已处理" : "风险未闭环"}
            </b>
          </div>
        ))}
      </div>
    </section>
  );
}
