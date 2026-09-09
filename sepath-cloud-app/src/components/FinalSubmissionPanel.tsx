import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  Mic2,
  PackageCheck,
  PlaySquare,
  UploadCloud,
} from "lucide-react";
import type { FinalSubmissionReport, FinalSubmissionStatus } from "../engine/finalSubmission";

interface FinalSubmissionPanelProps {
  report: FinalSubmissionReport;
}

const statusLabels: Record<FinalSubmissionStatus, string> = {
  ready: "已就绪",
  watch: "观察项",
  manual: "人工确认",
  blocked: "阻断",
};

function StatusIcon({ status }: { status: FinalSubmissionStatus }) {
  if (status === "ready") return <CheckCircle2 size={17} />;
  if (status === "blocked") return <AlertTriangle size={17} />;
  return <ClipboardList size={17} />;
}

export function FinalSubmissionPanel({ report }: FinalSubmissionPanelProps) {
  return (
    <section className="panel final-submission-panel" id="final-submission">
      <div className="panel-heading">
        <h2>最终上传与路演控制台</h2>
        <span>把正式上传、命名副本、提交日流程、答辩锚点和真实性边界收成最终作战面板</span>
      </div>

      <div className="final-hero">
        <article>
          <UploadCloud size={24} />
          <div>
            <strong>{report.stage}</strong>
            <p>{report.summary}</p>
          </div>
        </article>
        <div className="final-score">
          <span>最终上传就绪度</span>
          <strong>{report.score}</strong>
        </div>
        <div className="final-counts">
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

      <div className="final-note">
        <FileCheck2 size={17} />
        <code>{report.packagePath}</code>
        <code>{report.handbookPath}</code>
        <p>{report.finalGateReportPath}</p>
      </div>

      <div className="final-grid final-snapshot-grid">
        <article>
          <div className="ops-heading">
            <FileCheck2 size={18} />
            <strong>提交包事实快照</strong>
          </div>
          <div className="final-snapshot">
            {report.packageSnapshot.map((item) => (
              <div className={`final-card ${item.status}`} key={item.id}>
                <span>{statusLabels[item.status]}</span>
                <strong>{item.label}</strong>
                <code>{item.value}</code>
                <p>{item.evidence}</p>
                <small>{item.judgeUse}</small>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <PlaySquare size={18} />
            <strong>一等奖冲刺路线</strong>
          </div>
          <div className="final-sprint">
            {report.awardSprint.map((task) => (
              <div className={`final-status ${task.status}`} key={task.id}>
                <StatusIcon status={task.status} />
                <div>
                  <div className="final-status-head">
                    <strong>{task.label}</strong>
                    <span>
                      {task.owner} / {statusLabels[task.status]}
                    </span>
                  </div>
                  <p>{task.window}</p>
                  <small>{task.action}</small>
                  <em>{task.successSignal}</em>
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="final-grid">
        <article>
          <div className="ops-heading">
            <PackageCheck size={18} />
            <strong>上传路线</strong>
          </div>
          <div className="final-routes">
            {report.uploadRoutes.map((route) => (
              <div className={`final-status ${route.status}`} key={route.id}>
                <StatusIcon status={route.status} />
                <div>
                  <div className="final-status-head">
                    <strong>{route.label}</strong>
                    <span>{statusLabels[route.status]}</span>
                  </div>
                  <p>{route.platformMode}</p>
                  <code>{route.primaryFile}</code>
                  <small>{route.verification}</small>
                  <em>{route.fallback}</em>
                  <div className="final-tags">
                    {route.uploadOrder.map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <ClipboardList size={18} />
            <strong>正式命名副本</strong>
          </div>
          <div className="final-cards">
            {report.namedCopies.map((copy) => (
              <div className={`final-card ${copy.status}`} key={copy.id}>
                <span>{statusLabels[copy.status]}</span>
                <strong>{copy.label}</strong>
                <p>{copy.source}</p>
                <code>{copy.targetPattern}</code>
                <small>{copy.rule}</small>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="final-grid lower">
        <article>
          <div className="ops-heading">
            <PlaySquare size={18} />
            <strong>提交当天 20 分钟流程</strong>
          </div>
          <div className="final-checklist">
            {report.dayChecklist.map((item) => (
              <div className={`final-status ${item.status}`} key={item.id}>
                <StatusIcon status={item.status} />
                <div>
                  <div className="final-status-head">
                    <strong>{item.label}</strong>
                    <span>{item.minutes}</span>
                  </div>
                  <p>{item.action}</p>
                  <small>{item.evidence}</small>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <Mic2 size={18} />
            <strong>答辩打开顺序</strong>
          </div>
          <div className="final-cards">
            {report.rehearsalAnchors.map((anchor) => (
              <div className={`final-card ${anchor.status}`} key={anchor.id}>
                <span>{anchor.demoAnchor} / {statusLabels[anchor.status]}</span>
                <strong>{anchor.label}</strong>
                <p>{anchor.material}</p>
                <b>{anchor.judgeMessage}</b>
                <small>{anchor.riskBoundary}</small>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="final-grid lower">
        <article>
          <div className="ops-heading">
            <AlertTriangle size={18} />
            <strong>人工门禁与禁止口径</strong>
          </div>
          <div className="final-gates">
            {report.manualGates.map((gate) => (
              <div className={`final-card ${gate.status}`} key={gate.id}>
                <span>{gate.owner} / {statusLabels[gate.status]}</span>
                <strong>{gate.label}</strong>
                <p>{gate.currentState}</p>
                <small>{gate.acceptCriteria}</small>
              </div>
            ))}
          </div>
          <div className="final-forbidden">
            {report.forbiddenClaims.map((claim) => (
              <div key={claim.id}>
                <strong>{claim.forbidden}</strong>
                <p>{claim.safeAlternative}</p>
                <small>{claim.evidenceBoundary}</small>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <FileCheck2 size={18} />
            <strong>最终命令与 Manifest</strong>
          </div>
          <div className="final-commands">
            {report.commands.map((command) => (
              <div className={`final-card ${command.status}`} key={command.id}>
                <span>{statusLabels[command.status]}</span>
                <strong>{command.label}</strong>
                <code>{command.command}</code>
                <p>{command.output}</p>
                <small>{command.whenToRun}</small>
              </div>
            ))}
          </div>
          <pre className="final-manifest">{report.manifest}</pre>
        </article>
      </div>
    </section>
  );
}
