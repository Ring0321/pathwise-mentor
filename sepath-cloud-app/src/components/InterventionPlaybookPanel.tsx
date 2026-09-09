import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  FileJson,
  RotateCcw,
  Send,
  ShieldCheck,
} from "lucide-react";
import type { InterventionPlaybookReport, InterventionPlaybookStatus } from "../engine/interventionPlaybook";

interface InterventionPlaybookPanelProps {
  report: InterventionPlaybookReport;
}

const statusLabels: Record<InterventionPlaybookStatus, string> = {
  ready: "已就绪",
  review: "待复核",
  manual: "人工项",
  blocked: "阻断",
};

function StatusIcon({ status }: { status: InterventionPlaybookStatus }) {
  if (status === "ready") return <CheckCircle2 size={16} />;
  if (status === "blocked") return <AlertTriangle size={16} />;
  if (status === "manual") return <ShieldCheck size={16} />;
  return <Activity size={16} />;
}

export function InterventionPlaybookPanel({ report }: InterventionPlaybookPanelProps) {
  return (
    <section className="panel intervention-panel" id="intervention-playbook">
      <div className="panel-heading">
        <h2>干预发布与教学行动包中心</h2>
        <span>把算法建议变成教师可确认、学生可执行、平台可追踪的行动包</span>
      </div>

      <div className="intervention-hero">
        <article>
          <Send size={24} />
          <div>
            <strong>{report.mode}</strong>
            <p>{report.summary}</p>
          </div>
        </article>
        <div className="intervention-score">
          <span>发布就绪度</span>
          <strong>{report.score}</strong>
        </div>
        <div className="intervention-counts">
          <span>
            <b>{report.readyCount}</b>
            ready
          </span>
          <span>
            <b>{report.reviewCount}</b>
            review
          </span>
          <span>
            <b>{report.manualCount}</b>
            manual
          </span>
          <span>
            <b>{report.blockedCount}</b>
            block
          </span>
        </div>
      </div>

      <div className="intervention-metrics">
        {report.metrics.map((metric) => (
          <div className={`intervention-status ${metric.status}`} key={metric.id}>
            <span>{statusLabels[metric.status]}</span>
            <strong>{metric.label}</strong>
            <b>{metric.value}</b>
            <p>{metric.target}</p>
          </div>
        ))}
      </div>

      <div className="intervention-grid">
        <article>
          <div className="ops-heading">
            <ClipboardCheck size={18} />
            <strong>可发布教学行动包</strong>
          </div>
          <div className="intervention-packages">
            {report.packages.map((item) => (
              <div className={`intervention-package ${item.status}`} key={item.id}>
                <div className="intervention-status-head">
                  <span>{statusLabels[item.status]}</span>
                  <StatusIcon status={item.status} />
                </div>
                <strong>{item.title}</strong>
                <p>{item.trigger}</p>
                <div className="intervention-tags">
                  <span>{item.audience}</span>
                  <span>{item.safeVoiRank}</span>
                  <span>{item.publishState}</span>
                </div>
                <b>学生话术</b>
                <p>{item.studentCopy}</p>
                <b>教师话术</b>
                <p>{item.teacherCopy}</p>
                <small>{item.channels.join(" / ")}</small>
                <code>{item.apiRoute}</code>
                <em>{item.rollback}</em>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <ShieldCheck size={18} />
            <strong>教师发布队列</strong>
          </div>
          <div className="intervention-list">
            {report.queue.map((item) => (
              <div className={`intervention-status ${item.status}`} key={item.id}>
                <div className="intervention-status-head">
                  <span>{statusLabels[item.status]}</span>
                  <StatusIcon status={item.status} />
                </div>
                <strong>{item.label}</strong>
                <p>{item.nextAction}</p>
                <small>{item.owner} / {item.sla}</small>
                <code>{item.evidence}</code>
              </div>
            ))}
          </div>

          <div className="ops-heading intervention-subheading">
            <RotateCcw size={18} />
            <strong>通道、确认与回写</strong>
          </div>
          <div className="intervention-list compact">
            {report.channels.map((channel) => (
              <div className={`intervention-status ${channel.status}`} key={channel.id}>
                <div className="intervention-status-head">
                  <span>{statusLabels[channel.status]}</span>
                  <StatusIcon status={channel.status} />
                </div>
                <strong>{channel.label}</strong>
                <p>{channel.ack}</p>
                <code>{channel.path}</code>
                <small>{channel.payload.join(" / ")}</small>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="intervention-grid lower">
        <article>
          <div className="ops-heading">
            <ShieldCheck size={18} />
            <strong>安全护栏与禁止口径</strong>
          </div>
          <div className="intervention-list">
            {report.guardrails.map((guardrail) => (
              <div className={`intervention-status ${guardrail.status}`} key={guardrail.id}>
                <div className="intervention-status-head">
                  <span>{statusLabels[guardrail.status]}</span>
                  <StatusIcon status={guardrail.status} />
                </div>
                <strong>{guardrail.label}</strong>
                <p>{guardrail.rule}</p>
                <small>{guardrail.evidence}</small>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <FileJson size={18} />
            <strong>路演话术、遥测与 Manifest</strong>
          </div>
          <div className="intervention-script">
            {report.teacherScript.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          <div className="intervention-tags wide">
            {report.telemetryPlan.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
          <pre className="intervention-manifest">{report.releaseManifest}</pre>
        </article>
      </div>
    </section>
  );
}
