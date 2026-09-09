import { CalendarDays, ClipboardCheck, Download, FileText, ShieldCheck, Users } from "lucide-react";
import type { TeacherReport, TeacherReportStatus } from "../engine/teacherReport";

interface TeacherReportPanelProps {
  report: TeacherReport;
}

const statusLabel: Record<TeacherReportStatus, string> = {
  ready: "可执行",
  watch: "需观察",
  manual: "人工项",
};

function statusClass(status: TeacherReportStatus) {
  return `teacher-report-status ${status}`;
}

function downloadMarkdown(report: TeacherReport) {
  const blob = new Blob([report.markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = report.exportFileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function TeacherReportPanel({ report }: TeacherReportPanelProps) {
  return (
    <section className="panel teacher-report-panel" id="teacher-report">
      <div className="panel-heading">
        <h2>教师周报与试点复盘</h2>
        <span>把证据、Rubric、班级运营、AI 边界和上线门禁汇总成可下载周报</span>
      </div>

      <div className="teacher-report-hero">
        <div>
          <FileText size={22} />
          <strong>{report.title}</strong>
          <p>{report.summary}</p>
        </div>
        <div>
          <span>周报就绪度</span>
          <b>{report.score}</b>
        </div>
        <div className="teacher-report-mode">
          <CalendarDays size={18} />
          <strong>{report.mode}</strong>
          <span>{report.period}</span>
          <button className="primary-button compact" onClick={() => downloadMarkdown(report)}>
            <Download size={16} />
            下载周报
          </button>
        </div>
      </div>

      <div className="teacher-report-metrics">
        {report.metrics.map((metric) => (
          <div className={statusClass(metric.status)} key={metric.id}>
            <span>{statusLabel[metric.status]}</span>
            <strong>{metric.label}</strong>
            <b>{metric.value}</b>
            <p>{metric.target}</p>
          </div>
        ))}
      </div>

      <div className="teacher-report-grid">
        <article>
          <div className="ops-heading">
            <Users size={18} />
            <strong>学生画像与班级信号</strong>
          </div>
          <div className="teacher-report-lines">
            {[...report.learnerSnapshot, ...report.classSignals].map((line) => (
              <div className={statusClass(line.status)} key={line.id}>
                <span>{statusLabel[line.status]}</span>
                <strong>{line.label}</strong>
                <p>{line.detail}</p>
                <small>{line.evidence}</small>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <ClipboardCheck size={18} />
            <strong>下周行动计划</strong>
          </div>
          <div className="teacher-report-lines">
            {report.actionPlan.map((line) => (
              <div className={statusClass(line.status)} key={line.id}>
                <span>{statusLabel[line.status]}</span>
                <strong>{line.label}</strong>
                <p>{line.detail}</p>
                <small>{line.evidence}</small>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="teacher-report-grid lower">
        <article>
          <div className="ops-heading">
            <ShieldCheck size={18} />
            <strong>AI 使用与数据风险边界</strong>
          </div>
          <div className="teacher-report-lines">
            {report.riskControls.map((line) => (
              <div className={statusClass(line.status)} key={line.id}>
                <span>{statusLabel[line.status]}</span>
                <strong>{line.label}</strong>
                <p>{line.detail}</p>
                <small>{line.evidence}</small>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <FileText size={18} />
            <strong>周报预览</strong>
          </div>
          <pre className="teacher-report-preview">{report.markdown}</pre>
          <div className="teacher-report-references">
            {report.evidenceReferences.map((item) => (
              <code key={item}>{item}</code>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
