import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  PackageCheck,
  ShieldCheck,
} from "lucide-react";
import type { SubmissionOpsReport, SubmissionOpsStatus } from "../engine/submissionOps";

interface SubmissionOpsPanelProps {
  report: SubmissionOpsReport;
}

const statusLabels: Record<SubmissionOpsStatus, string> = {
  ready: "已就绪",
  watch: "观察项",
  manual: "人工确认",
  blocked: "阻断",
};

function StatusIcon({ status }: { status: SubmissionOpsStatus }) {
  if (status === "ready") return <CheckCircle2 size={17} />;
  if (status === "blocked") return <AlertTriangle size={17} />;
  return <ClipboardCheck size={17} />;
}

export function SubmissionOpsPanel({ report }: SubmissionOpsPanelProps) {
  return (
    <section className="panel submission-panel" id="submission">
      <div className="panel-heading">
        <h2>比赛提交助手</h2>
        <span>把官方要求、材料包、源码 Demo、视频、发布门禁和人工项整理成可提交清单</span>
      </div>

      <div className="submission-hero">
        <article>
          <PackageCheck size={24} />
          <div>
            <strong>{report.stage}</strong>
            <p>{report.summary}</p>
          </div>
        </article>
        <div className="submission-score">
          <span>提交就绪度</span>
          <strong>{report.score}</strong>
        </div>
        <div className="submission-counts">
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

      <div className="submission-note">
        <FileCheck2 size={17} />
        <span>{report.zipNamePattern}</span>
        <code>{report.finalGateCommand}</code>
        <p>{report.releaseBoundary}</p>
      </div>

      <div className="submission-grid">
        <article>
          <div className="ops-heading">
            <ShieldCheck size={18} />
            <strong>官方要求映射</strong>
          </div>
          <div className="submission-requirements">
            {report.requirements.map((item) => (
              <div className={`submission-status ${item.status}`} key={item.id}>
                <StatusIcon status={item.status} />
                <div>
                  <div className="submission-row-head">
                    <strong>{item.label}</strong>
                    <span>{statusLabels[item.status]}</span>
                  </div>
                  <p>{item.officialNeed}</p>
                  <small>{item.evidence}</small>
                  <code>{item.artifact}</code>
                  <em>{item.judgeCheck}</em>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <PackageCheck size={18} />
            <strong>提交材料资产</strong>
          </div>
          <div className="submission-artifacts">
            {report.artifacts.map((artifact) => (
              <div className={`submission-card ${artifact.status}`} key={artifact.id}>
                <span>{artifact.kind} / {statusLabels[artifact.status]}</span>
                <strong>{artifact.label}</strong>
                <code>{artifact.path}</code>
                <p>{artifact.validation}</p>
                <small>{artifact.riskControl}</small>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="submission-grid lower">
        <article>
          <div className="ops-heading">
            <ClipboardCheck size={18} />
            <strong>打包与验证步骤</strong>
          </div>
          <div className="submission-steps">
            {report.packageSteps.map((step) => (
              <div className={`submission-card ${step.status}`} key={step.id}>
                <span>{statusLabels[step.status]}</span>
                <strong>{step.label}</strong>
                <code>{step.command}</code>
                <p>{step.output}</p>
                <small>{step.reason}</small>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <CalendarDays size={18} />
            <strong>时间节点与人工项</strong>
          </div>
          <div className="submission-timeline">
            {report.timeline.map((item) => (
              <div className={`submission-status ${item.status}`} key={item.id}>
                <StatusIcon status={item.status} />
                <div>
                  <div className="submission-row-head">
                    <strong>{item.label}</strong>
                    <span>{item.date}</span>
                  </div>
                  <p>{item.action}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="submission-manual">
            {report.manualFields.map((field) => (
              <div className={`submission-card ${field.status}`} key={field.id}>
                <span>{field.owner} / {statusLabels[field.status]}</span>
                <strong>{field.label}</strong>
                <p>{field.currentState}</p>
                <small>{field.nextAction}</small>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="submission-grid lower">
        <article>
          <div className="ops-heading">
            <FileCheck2 size={18} />
            <strong>平台填写文案检查</strong>
          </div>
          <div className="submission-copy">
            {report.copyChecks.map((item) => (
              <div className={`submission-status ${item.status}`} key={item.id}>
                <StatusIcon status={item.status} />
                <div>
                  <div className="submission-row-head">
                    <strong>{item.label}</strong>
                    <span>{item.platformField}</span>
                  </div>
                  <p>{item.textSource}</p>
                  <small>{item.guardrail}</small>
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
