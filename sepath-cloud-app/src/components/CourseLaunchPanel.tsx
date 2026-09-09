import {
  CalendarDays,
  ClipboardCheck,
  Download,
  GraduationCap,
  PlugZap,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import type { CourseLaunchReport, CourseLaunchStatus } from "../engine/courseLaunch";

interface CourseLaunchPanelProps {
  report: CourseLaunchReport;
}

const statusLabels: Record<CourseLaunchStatus, string> = {
  ready: "就绪",
  configured: "已配置",
  manual: "人工确认",
  blocked: "阻断",
};

const ownerLabels: Record<string, string> = {
  teacher: "教师",
  course_admin: "课程管理员",
  ops: "运维",
  assistant: "智能体",
  team: "参赛队",
  school: "学校",
};

function statusClass(status: CourseLaunchStatus): string {
  return `course-launch-status ${status}`;
}

function StatusIcon({ status }: { status: CourseLaunchStatus }) {
  if (status === "blocked") return <TriangleAlert size={17} />;
  if (status === "manual") return <ShieldCheck size={17} />;
  return <ClipboardCheck size={17} />;
}

function downloadManifest(report: CourseLaunchReport) {
  const blob = new Blob([report.classroomManifest], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "sepath-course-launch-manifest.json";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function CourseLaunchPanel({ report }: CourseLaunchPanelProps) {
  return (
    <section className="panel course-launch-panel" id="course-launch">
      <div className="panel-heading">
        <h2>课程开班向导</h2>
        <span>把课程配置、工具接入、教师复核、评委试用和 AI 运行时整理成首周落地清单</span>
      </div>

      <div className="course-launch-hero">
        <article>
          <GraduationCap size={23} />
          <div>
            <strong>{report.stage}</strong>
            <p>{report.summary}</p>
          </div>
        </article>
        <div className="course-launch-score">
          <span>开班就绪度</span>
          <strong>{report.score}</strong>
        </div>
        <div className="course-launch-counts">
          <span>
            <b>{report.readyCount}</b> ready
          </span>
          <span>
            <b>{report.configuredCount}</b> config
          </span>
          <span>
            <b>{report.manualCount}</b> manual
          </span>
          <span>
            <b>{report.blockedCount}</b> block
          </span>
        </div>
      </div>

      <div className="course-launch-metrics">
        {report.metrics.map((metric) => (
          <div className={statusClass(metric.status)} key={metric.id}>
            <span>{statusLabels[metric.status]}</span>
            <strong>{metric.label}</strong>
            <b>{metric.value}</b>
            <p>{metric.target}</p>
          </div>
        ))}
      </div>

      <div className="course-launch-grid">
        <article>
          <div className="ops-heading">
            <CalendarDays size={18} />
            <strong>首周开班步骤</strong>
          </div>
          <div className="course-launch-steps">
            {report.launchSteps.map((step) => (
              <div className={statusClass(step.status)} key={step.id}>
                <StatusIcon status={step.status} />
                <div className="course-launch-status-body">
                  <div className="course-launch-status-meta">
                    <span>{step.day}</span>
                    <b>{ownerLabels[step.owner]}</b>
                  </div>
                  <strong>{step.label}</strong>
                  <p>{step.evidence}</p>
                  <small>{step.nextAction}</small>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <PlugZap size={18} />
            <strong>开班接入链路</strong>
          </div>
          <div className="course-launch-connectors">
            {report.connectors.map((connector) => (
              <div className={statusClass(connector.status)} key={connector.id}>
                <span>{statusLabels[connector.status]}</span>
                <strong>{connector.label}</strong>
                <p>
                  {connector.source} {"->"} {connector.target}
                </p>
                <small>{connector.gate}</small>
                <em>{connector.riskControl}</em>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="course-launch-grid lower">
        <article>
          <div className="ops-heading">
            <ClipboardCheck size={18} />
            <strong>课程启动包</strong>
          </div>
          <div className="course-launch-kit">
            {report.starterKit.map((item) => (
              <div className={statusClass(item.status)} key={item.id}>
                <span>{ownerLabels[item.owner]}</span>
                <strong>{item.label}</strong>
                <p>{item.useCase}</p>
                <code>{item.artifact}</code>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <ShieldCheck size={18} />
            <strong>风险登记与发布边界</strong>
          </div>
          <div className="course-launch-risks">
            {report.riskRegister.map((risk) => (
              <div className={statusClass(risk.status)} key={risk.id}>
                <StatusIcon status={risk.status} />
                <div className="course-launch-status-body">
                  <div className="course-launch-status-meta">
                    <span>{statusLabels[risk.status]}</span>
                  </div>
                  <strong>{risk.label}</strong>
                  <p>{risk.trigger}</p>
                  <small>{risk.mitigation}</small>
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="course-launch-grid lower">
        <article>
          <div className="ops-heading">
            <ClipboardCheck size={18} />
            <strong>正式开班导出清单</strong>
          </div>
          <ol className="course-launch-checklist">
            {report.exportChecklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </article>

        <article>
          <div className="ops-heading">
            <Download size={18} />
            <strong>可导出开班 Manifest</strong>
          </div>
          <button className="primary-button compact" onClick={() => downloadManifest(report)}>
            <Download size={16} />
            下载 Manifest
          </button>
          <pre className="course-launch-manifest">{report.classroomManifest}</pre>
        </article>
      </div>
    </section>
  );
}
