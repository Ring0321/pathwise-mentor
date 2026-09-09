import { Activity, CheckCircle2, Gauge, RotateCcw, ShieldAlert } from "lucide-react";
import type { LaunchReadinessReport, LaunchReadinessStatus } from "../engine/launchReadiness";

interface LaunchReadinessPanelProps {
  report: LaunchReadinessReport;
}

const statusLabels: Record<LaunchReadinessStatus, string> = {
  pass: "已验证",
  watch: "演示中",
  manual: "人工确认",
};

function StatusIcon({ status }: { status: LaunchReadinessStatus }) {
  if (status === "pass") return <CheckCircle2 size={17} />;
  if (status === "watch") return <Activity size={17} />;
  return <ShieldAlert size={17} />;
}

export function LaunchReadinessPanel({ report }: LaunchReadinessPanelProps) {
  return (
    <section className="panel launch-panel" id="launch">
      <div className="panel-heading">
        <h2>上线试用与交付就绪</h2>
        <span>把 Demo、测试、云端、监控、回滚和人工门禁合并成一张发布证据板</span>
      </div>

      <div className="launch-overview">
        <div>
          <Activity size={22} />
          <strong>{report.stage}</strong>
          <span>{report.cloudUrl}</span>
        </div>
        <p>{report.summary}</p>
        <div className="launch-counts">
          <span>
            <b>{report.passCount}</b> 已验证
          </span>
          <span>
            <b>{report.watchCount}</b> 演示中
          </span>
          <span>
            <b>{report.manualCount}</b> 人工门禁
          </span>
        </div>
      </div>

      <div className="launch-check-grid">
        {report.checks.map((check) => (
          <article className={`launch-check ${check.status}`} key={check.id}>
            <div>
              <StatusIcon status={check.status} />
              <strong>{check.label}</strong>
              <span>{statusLabels[check.status]}</span>
            </div>
            <p>{check.evidence}</p>
          </article>
        ))}
      </div>

      <div className="launch-ops-grid">
        <article>
          <div className="ops-heading">
            <Gauge size={18} />
            <strong>试点监控指标</strong>
          </div>
          <div className="metric-stack">
            {report.metrics.map((metric) => (
              <div key={metric.id}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <p>{metric.target}</p>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <RotateCcw size={18} />
            <strong>回滚与降级路径</strong>
          </div>
          <ol className="rollback-list">
            {report.rollbackSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <div className="manual-gates">
            {report.manualGates.map((gate) => (
              <span key={gate}>{gate}</span>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
