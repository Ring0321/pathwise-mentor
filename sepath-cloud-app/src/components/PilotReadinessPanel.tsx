import { ClipboardCheck, DatabaseZap, GraduationCap, Rocket, ShieldCheck } from "lucide-react";
import type { PilotReadinessReport, PilotReadinessStatus } from "../engine/pilotReadiness";

interface PilotReadinessPanelProps {
  report: PilotReadinessReport;
}

const statusLabel: Record<PilotReadinessStatus, string> = {
  ready: "可执行",
  shadow: "影子运行",
  manual: "人工门禁",
};

function statusClass(status: PilotReadinessStatus) {
  return `pilot-status ${status}`;
}

export function PilotReadinessPanel({ report }: PilotReadinessPanelProps) {
  return (
    <section className="panel pilot-panel" id="pilot">
      <div className="panel-heading">
        <h2>课程试点上线工作台</h2>
        <span>把班级接入、数据治理、教师确认、成效指标和分阶段上线门禁做成可执行配置</span>
      </div>

      <div className="pilot-hero">
        <div>
          <Rocket size={22} />
          <strong>{report.mode}</strong>
          <p>{report.gate}</p>
        </div>
        <div className="pilot-score">
          <span>试点就绪度</span>
          <b>{report.readinessScore}</b>
        </div>
        <div className="pilot-counts">
          <span>
            <b>{report.readyCount}</b> 可执行
          </span>
          <span>
            <b>{report.shadowCount}</b> 影子运行
          </span>
          <span>
            <b>{report.manualCount}</b> 人工门禁
          </span>
        </div>
      </div>

      <div className="pilot-grid">
        <article>
          <div className="ops-heading">
            <ClipboardCheck size={18} />
            <strong>开课清单</strong>
          </div>
          <div className="pilot-checklist">
            {report.checklist.map((item) => (
              <div className={statusClass(item.status)} key={item.id}>
                <span>{statusLabel[item.status]}</span>
                <strong>{item.label}</strong>
                <p>{item.evidence}</p>
                <small>{item.owner} | {item.nextAction}</small>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <DatabaseZap size={18} />
            <strong>生产接入路线</strong>
          </div>
          <div className="pilot-integration-list">
            {report.integrations.map((item) => (
              <div key={item.id}>
                <strong>{item.name}</strong>
                <span>{item.currentMode}</span>
                <p>{item.productionTarget}</p>
                <small>{item.riskControl}</small>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="pilot-grid lower">
        <article>
          <div className="ops-heading">
            <GraduationCap size={18} />
            <strong>分阶段试点路径</strong>
          </div>
          <ol className="pilot-stage-list">
            {report.rolloutStages.map((stage) => (
              <li key={stage.id}>
                <strong>{stage.label}</strong>
                <p>{stage.objective}</p>
                <span>{stage.gate}</span>
              </li>
            ))}
          </ol>
        </article>

        <article>
          <div className="ops-heading">
            <ShieldCheck size={18} />
            <strong>指标、配置与数据边界</strong>
          </div>
          <div className="pilot-metrics">
            {report.metrics.map((metric) => (
              <div key={metric.id}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <p>{metric.target}</p>
              </div>
            ))}
          </div>
          <div className="pilot-config">
            {report.workspaceConfig.map((item) => (
              <code key={item}>{item}</code>
            ))}
          </div>
          <div className="pilot-controls">
            {report.dataControls.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
