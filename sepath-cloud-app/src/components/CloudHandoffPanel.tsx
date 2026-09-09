import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  ClipboardCheck,
  FileCheck2,
  Globe2,
  MonitorCheck,
  RotateCcw,
  ServerCog,
  ShieldCheck,
} from "lucide-react";
import type { CloudHandoffReport, CloudHandoffStatus } from "../engine/cloudHandoff";

interface CloudHandoffPanelProps {
  report: CloudHandoffReport;
}

const statusLabels: Record<CloudHandoffStatus, string> = {
  ready: "已就绪",
  watch: "观察",
  manual: "人工项",
  blocked: "阻断",
};

function StatusIcon({ status }: { status: CloudHandoffStatus }) {
  if (status === "ready") return <CheckCircle2 size={17} />;
  if (status === "watch") return <MonitorCheck size={17} />;
  if (status === "manual") return <AlertTriangle size={17} />;
  return <AlertTriangle size={17} />;
}

export function CloudHandoffPanel({ report }: CloudHandoffPanelProps) {
  return (
    <section className="panel cloud-handoff-panel" id="cloud">
      <div className="panel-heading">
        <h2>评委云端交付体检中心</h2>
        <span>把公开试用、私有云、源码复现、视频兜底和发布门禁收成可检查上线作战图</span>
      </div>

      <div className="handoff-hero">
        <article>
          <Cloud size={24} />
          <div>
            <strong>{report.stage}</strong>
            <p>{report.summary}</p>
          </div>
        </article>
        <div className="handoff-score">
          <span>云端交付就绪度</span>
          <strong>{report.score}</strong>
        </div>
        <div className="handoff-counts">
          <span>
            <b>{report.readyCount}</b> ready
          </span>
          <span>
            <b>{report.watchCount}</b> watch
          </span>
          <span>
            <b>{report.manualCount}</b> manual
          </span>
          <span>
            <b>{report.blockedCount}</b> block
          </span>
        </div>
      </div>

      <div className="handoff-note">
        <Globe2 size={17} />
        <code>{report.cloudUrl}</code>
        <code>{report.publicTrialPath}</code>
        <p>{report.accessMode}</p>
      </div>

      <div className="handoff-grid">
        <article>
          <div className="ops-heading">
            <ServerCog size={18} />
            <strong>访问目标与兜底路线</strong>
          </div>
          <div className="handoff-cards">
            {report.targets.map((target) => (
              <div className={`handoff-card ${target.status}`} key={target.id}>
                <span>{statusLabels[target.status]}</span>
                <strong>{target.label}</strong>
                <p>{target.mode}</p>
                <code>{target.entry}</code>
                <small>{target.evidence}</small>
                <em>{target.fallback}</em>
                <b>{target.riskControl}</b>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <MonitorCheck size={18} />
            <strong>健康探针</strong>
          </div>
          <div className="handoff-list">
            {report.probes.map((probe) => (
              <div className={`handoff-row ${probe.status}`} key={probe.id}>
                <StatusIcon status={probe.status} />
                <div>
                  <div className="handoff-row-head">
                    <strong>{probe.label}</strong>
                    <span>{statusLabels[probe.status]}</span>
                  </div>
                  <p>{probe.signal}</p>
                  <code>{probe.command}</code>
                  <small>{probe.evidence}</small>
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="handoff-grid lower">
        <article>
          <div className="ops-heading">
            <ClipboardCheck size={18} />
            <strong>评委试用任务</strong>
          </div>
          <div className="handoff-cards compact">
            {report.reviewerTasks.map((task) => (
              <div className={`handoff-card ${task.status}`} key={task.id}>
                <span>{task.minutes} / {statusLabels[task.status]}</span>
                <strong>{task.label}</strong>
                <code>{task.entry}</code>
                <p>{task.expectedSignal}</p>
                <small>{task.scoringPoint}</small>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <RotateCcw size={18} />
            <strong>失败切换</strong>
          </div>
          <div className="handoff-list">
            {report.fallbackLanes.map((lane) => (
              <div className={`handoff-row ${lane.status}`} key={lane.id}>
                <StatusIcon status={lane.status} />
                <div>
                  <div className="handoff-row-head">
                    <strong>{lane.label}</strong>
                    <span>{statusLabels[lane.status]}</span>
                  </div>
                  <p>{lane.trigger}</p>
                  <small>{lane.switchAction}</small>
                  <code>{lane.proof}</code>
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="handoff-grid lower">
        <article>
          <div className="ops-heading">
            <ShieldCheck size={18} />
            <strong>人工门禁</strong>
          </div>
          <div className="handoff-cards compact">
            {report.manualGates.map((gate) => (
              <div className={`handoff-card ${gate.status}`} key={gate.id}>
                <span>{gate.owner} / {statusLabels[gate.status]}</span>
                <strong>{gate.label}</strong>
                <p>{gate.whyManual}</p>
                <small>{gate.acceptance}</small>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <FileCheck2 size={18} />
            <strong>Runbook 与 Manifest</strong>
          </div>
          <div className="handoff-list">
            {report.runbook.map((step) => (
              <div className={`handoff-row ${step.status}`} key={step.id}>
                <StatusIcon status={step.status} />
                <div>
                  <div className="handoff-row-head">
                    <strong>{step.label}</strong>
                    <span>{step.owner}</span>
                  </div>
                  <p>{step.action}</p>
                  <small>{step.rollback}</small>
                </div>
              </div>
            ))}
          </div>
          <pre className="handoff-manifest">{report.manifest}</pre>
        </article>
      </div>
    </section>
  );
}
