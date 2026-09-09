import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Cloud,
  FileCheck2,
  MonitorPlay,
  PackageCheck,
  Route,
  ShieldCheck,
} from "lucide-react";
import type { JudgeTrialReport, JudgeTrialStatus } from "../engine/judgeTrial";

interface JudgeTrialPanelProps {
  report: JudgeTrialReport;
}

const statusLabels: Record<JudgeTrialStatus, string> = {
  ready: "可直接用",
  fallback: "兜底路线",
  manual: "人工确认",
  blocked: "先阻断",
};

function StatusIcon({ status }: { status: JudgeTrialStatus }) {
  if (status === "ready") return <CheckCircle2 size={17} />;
  if (status === "fallback") return <Route size={17} />;
  if (status === "manual") return <ClipboardCheck size={17} />;
  return <AlertTriangle size={17} />;
}

export function JudgeTrialPanel({ report }: JudgeTrialPanelProps) {
  return (
    <section className="panel judge-panel" id="judge-trial">
      <div className="panel-heading">
        <h2>评委试用与交付控制台</h2>
        <span>把公开静态包、私有云、本地 Demo、视频兜底和源码审计整理成可执行评审路线</span>
      </div>

      <div className="judge-hero">
        <article>
          <PackageCheck size={24} />
          <div>
            <strong>{report.stage}</strong>
            <p>{report.summary}</p>
          </div>
        </article>
        <div className="judge-score">
          <span>试用就绪度</span>
          <strong>{report.score}</strong>
        </div>
        <div className="judge-counts">
          <span>
            <b>{report.readyCount}</b> ready
          </span>
          <span>
            <b>{report.fallbackCount}</b> fallback
          </span>
          <span>
            <b>{report.manualCount}</b> manual
          </span>
        </div>
      </div>

      <div className="judge-metrics">
        {report.metrics.map((metric) => (
          <article key={metric.id}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <p>{metric.target}</p>
          </article>
        ))}
      </div>

      <div className="judge-lower-grid compact">
        <article>
          <div className="ops-heading">
            <MonitorPlay size={18} />
            <strong>评委任务包</strong>
          </div>
          <div className="judge-task-grid">
            {report.trialTasks.map((task) => (
              <div className={`judge-task ${task.status}`} key={task.id}>
                <div className="judge-task-head">
                  <StatusIcon status={task.status} />
                  <div>
                    <strong>{task.label}</strong>
                    <span>{task.duration} / {statusLabels[task.status]}</span>
                  </div>
                </div>
                <p>{task.evaluatorAction}</p>
                <dl>
                  <div>
                    <dt>入口</dt>
                    <dd>{task.entry}</dd>
                  </div>
                  <div>
                    <dt>评分项</dt>
                    <dd>{task.scoringFocus}</dd>
                  </div>
                  <div>
                    <dt>成功信号</dt>
                    <dd>{task.successSignal}</dd>
                  </div>
                </dl>
                <small>{task.fallbackRoute}</small>
                <div className="judge-artifacts">
                  {task.proofArtifacts.map((artifact) => (
                    <code key={artifact}>{artifact}</code>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <FileCheck2 size={18} />
            <strong>评分证据矩阵</strong>
          </div>
          <div className="judge-proof-list">
            {report.proofMatrix.map((item) => (
              <div key={item.id}>
                <div>
                  <strong>{item.criterion}</strong>
                  <span>{item.weight}</span>
                </div>
                <p>{item.productEvidence}</p>
                <code>{item.materialEvidence}</code>
                <small>{item.demoLine}</small>
                <em>{item.riskBoundary}</em>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="judge-route-grid">
        {report.routes.map((route) => (
          <article className={`judge-route ${route.status}`} key={route.id}>
            <div className="judge-route-head">
              <StatusIcon status={route.status} />
              <div>
                <strong>{route.label}</strong>
                <span>{route.mode}</span>
              </div>
              <b>{statusLabels[route.status]}</b>
            </div>
            <p>{route.primaryAction}</p>
            <dl>
              <div>
                <dt>证据</dt>
                <dd>{route.evidence}</dd>
              </div>
              <div>
                <dt>兜底</dt>
                <dd>{route.fallback}</dd>
              </div>
              <div>
                <dt>风控</dt>
                <dd>{route.riskControl}</dd>
              </div>
            </dl>
            <div className="judge-artifacts">
              {route.proofArtifacts.map((artifact) => (
                <code key={artifact}>{artifact}</code>
              ))}
            </div>
          </article>
        ))}
      </div>

      <div className="judge-lower-grid">
        <article>
          <div className="ops-heading">
            <ShieldCheck size={18} />
            <strong>提交前人工门禁</strong>
          </div>
          <div className="judge-checklist">
            {report.checklist.map((item) => (
              <div className={`judge-check ${item.status}`} key={item.id}>
                <StatusIcon status={item.status} />
                <div>
                  <strong>{item.label}</strong>
                  <span>{item.owner} / {statusLabels[item.status]}</span>
                  <p>{item.evidence}</p>
                  <small>{item.nextAction}</small>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <MonitorPlay size={18} />
            <strong>评审现场 Playbook</strong>
          </div>
          <div className="judge-playbook">
            {report.playbook.map((step) => (
              <div key={step.id}>
                <FileCheck2 size={17} />
                <strong>{step.label}</strong>
                <span>{step.minutes}</span>
                <ul>
                  {step.actions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="judge-statement">
            <Cloud size={17} />
            <p>{report.submissionStatement}</p>
          </div>
        </article>
      </div>
    </section>
  );
}
