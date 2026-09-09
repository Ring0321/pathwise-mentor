import { useState } from "react";
import {
  Activity,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Gauge,
  LineChart,
  ShieldCheck,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import type { ValueEvidenceStatus, ValueUpliftReport } from "../engine/valueUplift";

interface ValueUpliftPanelProps {
  report: ValueUpliftReport;
}

type ValueView = "metrics" | "experiment" | "claims";

const statusLabels: Record<ValueEvidenceStatus, string> = {
  proved: "已验证",
  shadow: "影子指标",
  manual: "人工确认",
};

function statusClass(status: ValueEvidenceStatus): string {
  return `value-status ${status}`;
}

function StatusIcon({ status }: { status: ValueEvidenceStatus }) {
  if (status === "proved") return <CheckCircle2 size={17} />;
  if (status === "shadow") return <Activity size={17} />;
  return <TriangleAlert size={17} />;
}

export function ValueUpliftPanel({ report }: ValueUpliftPanelProps) {
  const [view, setView] = useState<ValueView>("metrics");

  return (
    <section className="panel value-panel" id="value">
      <div className="panel-heading">
        <h2>学习增值评估中心</h2>
        <span>把路径增值、策略对照、科研边界和试点指标统一成可复核价值模型</span>
      </div>

      <div className="value-hero">
        <article>
          <TrendingUp size={24} />
          <div>
            <strong>{report.mode}</strong>
            <p>{report.summary}</p>
          </div>
        </article>
        <div className="value-score">
          <span>增值可信分</span>
          <strong>{report.valueScore}</strong>
        </div>
        <div className="value-score">
          <span>估计增值</span>
          <strong>+{report.estimatedUpliftPoints}</strong>
          <small>{report.confidenceBand}</small>
        </div>
      </div>

      <div className="value-tabs" role="tablist" aria-label="学习增值视图">
        <button type="button" className={view === "metrics" ? "active" : ""} onClick={() => setView("metrics")}>
          <Gauge size={16} />
          指标
        </button>
        <button type="button" className={view === "experiment" ? "active" : ""} onClick={() => setView("experiment")}>
          <BarChart3 size={16} />
          对照
        </button>
        <button type="button" className={view === "claims" ? "active" : ""} onClick={() => setView("claims")}>
          <ShieldCheck size={16} />
          声明边界
        </button>
      </div>

      {view === "metrics" ? (
        <>
          <div className="value-metrics">
            {report.metrics.map((metric) => (
              <article className={statusClass(metric.status)} key={metric.id}>
                <div>
                  <StatusIcon status={metric.status} />
                  <span>{statusLabels[metric.status]}</span>
                </div>
                <strong>{metric.label}</strong>
                <b>{metric.value}</b>
                <p>{metric.target}</p>
              </article>
            ))}
          </div>

          <div className="value-dimensions">
            {report.dimensions.map((dimension) => (
              <article key={dimension.id}>
                <div className="value-dimension-head">
                  <strong>{dimension.label}</strong>
                  <span>{dimension.evidenceCount} 条证据</span>
                </div>
                <div className="value-dimension-score">
                  <span>{dimension.baseline}</span>
                  <i>
                    <b style={{ width: `${dimension.current}%` }} />
                  </i>
                  <strong>{dimension.current}</strong>
                </div>
                <p>
                  增量 {dimension.growth >= 0 ? "+" : ""}
                  {dimension.growth}，置信 {dimension.confidence}%。
                </p>
                <small>{dimension.nextAction}</small>
              </article>
            ))}
          </div>
        </>
      ) : null}

      {view === "experiment" ? (
        <div className="value-experiment-grid">
          <article>
            <div className="ops-heading">
              <LineChart size={18} />
              <strong>策略增值对照</strong>
            </div>
            <div className="value-experiment-table">
              {report.experimentCells.map((cell) => (
                <div className={statusClass(cell.status)} key={cell.id}>
                  <span>{statusLabels[cell.status]}</span>
                  <strong>{cell.label}</strong>
                  <b>+{cell.expectedGain}</b>
                  <p>{cell.evidence}</p>
                  <small>
                    风险治理 {cell.riskReduction} / {cell.teacherLoad}
                  </small>
                </div>
              ))}
            </div>
          </article>

          <article>
            <div className="ops-heading">
              <ClipboardCheck size={18} />
              <strong>真实试点测量路径</strong>
            </div>
            <div className="value-stage-list">
              {report.measurementPlan.map((stage) => (
                <div className={statusClass(stage.status)} key={stage.id}>
                  <StatusIcon status={stage.status} />
                  <div>
                    <strong>{stage.label}</strong>
                    <p>{stage.gate}</p>
                    <small>
                      {stage.owner} / {stage.evidence}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>
      ) : null}

      {view === "claims" ? (
        <div className="value-claims-grid">
          <article>
            <div className="ops-heading">
              <ShieldCheck size={18} />
              <strong>可说与不可说</strong>
            </div>
            <div className="value-claims">
              {report.claims.map((claim) => (
                <div className={claim.allowed ? "claim allowed" : "claim blocked"} key={claim.id}>
                  <span>{claim.label}</span>
                  <strong>{claim.statement}</strong>
                  <p>{claim.evidence}</p>
                </div>
              ))}
            </div>
          </article>

          <article>
            <div className="ops-heading">
              <Activity size={18} />
              <strong>Telemetry Contract</strong>
            </div>
            <div className="value-telemetry">
              {report.telemetryContract.map((item) => (
                <code key={item}>{item}</code>
              ))}
            </div>
            <pre className="value-manifest">{report.exportManifest}</pre>
          </article>
        </div>
      ) : null}
    </section>
  );
}
