import { Activity, BarChart3, CloudCog, Gauge, ShieldCheck, Zap } from "lucide-react";
import type { CloudSloReport, CloudSloStatus } from "../engine/cloudSlo";

interface CloudSloPanelProps {
  report: CloudSloReport;
}

const statusLabel: Record<CloudSloStatus, string> = {
  pass: "达标",
  watch: "观察",
  manual: "人工",
  block: "阻断",
};

function statusClass(status: CloudSloStatus) {
  return `status-card ${status}`;
}

export function CloudSloPanel({ report }: CloudSloPanelProps) {
  return (
    <section className="panel cloud-slo-panel" id="cloud-slo">
      <div className="panel-heading">
        <h2>云端 SLO 与容量压测中心</h2>
        <span>用延迟、错误率、降级、容量和成本预算证明产品不是一次性演示</span>
      </div>

      <div className="cloud-slo-hero">
        <article>
          <Gauge size={24} />
          <div>
            <strong>{report.stage}</strong>
            <p>{report.summary}</p>
          </div>
        </article>
        <div className="cloud-slo-score">
          <span>SLO 就绪度</span>
          <strong>{report.score}</strong>
        </div>
        <div className="cloud-slo-counts">
          <span>
            <b>{report.passCount}</b> pass
          </span>
          <span>
            <b>{report.watchCount}</b> watch
          </span>
          <span>
            <b>{report.manualCount}</b> manual
          </span>
          <span>
            <b>{report.blockCount}</b> block
          </span>
        </div>
      </div>

      <div className="cloud-slo-note">
        <CloudCog size={17} />
        <code>{report.command}</code>
        <p>{report.reportPath}</p>
      </div>

      <div className="cloud-slo-grid">
        <article>
          <div className="ops-heading">
            <BarChart3 size={18} />
            <strong>压测场景</strong>
          </div>
          <div className="cloud-slo-scenarios">
            {report.scenarios.map((scenario) => (
              <div className={statusClass(scenario.status)} key={scenario.id}>
                <div>
                  <span>{statusLabel[scenario.status]}</span>
                  <strong>{scenario.label}</strong>
                </div>
                <p>{scenario.traffic}</p>
                <div className="cloud-slo-bars">
                  <span>
                    P95 <b>{scenario.p95Ms}ms</b>
                  </span>
                  <span>
                    阈值 <b>{scenario.thresholdMs}ms</b>
                  </span>
                  <span>
                    错误率 <b>{scenario.errorRate}%</b>
                  </span>
                </div>
                <small>
                  {scenario.requestCount} requests | {scenario.evidence}
                </small>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <ShieldCheck size={18} />
            <strong>SLO 预算</strong>
          </div>
          <div className="cloud-slo-budget">
            {report.budgets.map((budget) => (
              <div className={statusClass(budget.status)} key={budget.id}>
                <span>{statusLabel[budget.status]}</span>
                <strong>{budget.label}</strong>
                <p>{budget.target}</p>
                <code>{budget.observed}</code>
                <small>{budget.evidence}</small>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="cloud-slo-grid">
        <article>
          <div className="ops-heading">
            <Zap size={18} />
            <strong>降级与兜底</strong>
          </div>
          <div className="cloud-slo-fallbacks">
            {report.fallbacks.map((fallback) => (
              <div className={statusClass(fallback.status)} key={fallback.id}>
                <span>{statusLabel[fallback.status]}</span>
                <strong>{fallback.label}</strong>
                <p>{fallback.trigger}</p>
                <code>{fallback.action}</code>
                <small>{fallback.proof}</small>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <Activity size={18} />
            <strong>成本与扩容</strong>
          </div>
          <div className="cloud-slo-costs">
            {report.costItems.map((item) => (
              <div className={statusClass(item.status)} key={item.id}>
                <span>{statusLabel[item.status]}</span>
                <strong>{item.label}</strong>
                <p>{item.unit}</p>
                <code>{item.estimate}</code>
                <small>{item.guardrail}</small>
              </div>
            ))}
          </div>
          <div className="cloud-slo-plan">
            {report.capacityPlan.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </article>
      </div>

      <pre className="cloud-slo-manifest">{report.manifest}</pre>
    </section>
  );
}
