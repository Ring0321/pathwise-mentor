import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileCheck2,
  Globe2,
  Route,
  ShieldCheck,
  TerminalSquare,
} from "lucide-react";
import type { FinalSubmissionReport } from "../engine/finalSubmission";
import type { HostingSelftestReport } from "../engine/hostingSelftest";
import {
  buildSubmissionClosureReport,
  type SubmissionClosureReport,
  type SubmissionClosureStatus,
} from "../engine/submissionClosure";

interface SubmissionClosurePanelProps {
  finalSubmission: FinalSubmissionReport;
  hostingSelftest: HostingSelftestReport;
}

const statusLabels: Record<SubmissionClosureStatus, string> = {
  ready: "已就绪",
  watch: "需复核",
  manual: "人工门禁",
  blocked: "阻断",
};

function StatusIcon({ status }: { status: SubmissionClosureStatus }) {
  if (status === "ready") return <CheckCircle2 size={17} />;
  if (status === "blocked") return <AlertTriangle size={17} />;
  return <ClipboardCheck size={17} />;
}

function isPublicOrigin(origin: string) {
  try {
    const url = new URL(origin);
    return url.protocol === "https:" && !["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

function downloadClosure(report: SubmissionClosureReport) {
  const blob = new Blob([report.manifest], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "SE-Path_submission_closure_console.json";
  link.click();
  URL.revokeObjectURL(link.href);
}

export function SubmissionClosurePanel({ finalSubmission, hostingSelftest }: SubmissionClosurePanelProps) {
  const [candidateUrl, setCandidateUrl] = useState("");
  const report = useMemo(
    () => buildSubmissionClosureReport(candidateUrl, hostingSelftest, finalSubmission),
    [candidateUrl, finalSubmission, hostingSelftest],
  );

  useEffect(() => {
    if (candidateUrl) return;
    if (typeof window === "undefined") return;
    if (isPublicOrigin(window.location.origin)) {
      setCandidateUrl(window.location.origin);
    }
  }, [candidateUrl]);

  return (
    <section className="panel final-submission-panel submission-closure-panel" id="submission-closure">
      <div className="panel-heading">
        <h2>正式提交收口总控</h2>
        <span>把公网 URL、平台文案、正式画像、命名副本、发布门禁和一致性报告收成最后一条可执行闭环</span>
      </div>

      <div className="final-hero">
        <article>
          <Route size={24} />
          <div>
            <strong>{report.stage}</strong>
            <p>{report.summary}</p>
          </div>
        </article>
        <div className="final-score">
          <span>提交收口分</span>
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
        <ShieldCheck size={17} />
        <code>{report.runtime}</code>
        <code>{report.finalUrl}</code>
        <p>{report.boundary}</p>
      </div>

      <div className="public-url-form" aria-label="正式提交收口 URL 表单">
        <label htmlFor="submission-closure-url">最终公网 HTTPS 地址</label>
        <div className="public-url-input-row">
          <input
            id="submission-closure-url"
            inputMode="url"
            placeholder="https://your-public-demo.example"
            value={candidateUrl}
            onChange={(event) => setCandidateUrl(event.target.value)}
          />
          <button
            className="ghost-button compact"
            type="button"
            onClick={() => setCandidateUrl(typeof window !== "undefined" ? window.location.origin : "")}
          >
            <Globe2 size={16} />
            当前站点
          </button>
          <button className="ghost-button compact" type="button" onClick={() => setCandidateUrl("")}>
            清空
          </button>
        </div>
      </div>

      <div className="final-grid final-snapshot-grid">
        <article>
          <div className="ops-heading">
            <ClipboardCheck size={18} />
            <strong>收口门禁</strong>
          </div>
          <div className="final-checklist">
            {report.gates.map((gate) => (
              <div className={`final-status ${gate.status}`} key={gate.id}>
                <StatusIcon status={gate.status} />
                <div>
                  <div className="final-status-head">
                    <strong>{gate.label}</strong>
                    <span>
                      {gate.owner} / {statusLabels[gate.status]}
                    </span>
                  </div>
                  <p>{gate.evidence}</p>
                  <small>{gate.nextAction}</small>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <FileCheck2 size={18} />
            <strong>提交证据包</strong>
          </div>
          <div className="final-cards">
            {report.artifacts.map((artifact) => (
              <div className={`final-card ${artifact.status}`} key={artifact.id}>
                <span>{statusLabels[artifact.status]}</span>
                <strong>{artifact.label}</strong>
                <code>{artifact.path}</code>
                <p>{artifact.proof}</p>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="final-grid lower">
        <article>
          <div className="ops-heading">
            <TerminalSquare size={18} />
            <strong>最后命令链</strong>
          </div>
          <div className="final-commands">
            {report.commands.map((command) => (
              <div className={`final-card ${command.status}`} key={command.id}>
                <span>{statusLabels[command.status]}</span>
                <strong>{command.label}</strong>
                <code>{command.command}</code>
                <p>{command.expectedOutput}</p>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <Route size={18} />
            <strong>提交日闭环顺序</strong>
          </div>
          <ol className="closure-order">
            {report.closingOrder.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <div className="platform-paste-preview">
            {report.platformPastePreview.map((row) => (
              <code key={row}>{row}</code>
            ))}
          </div>
          <button className="ghost-button compact" type="button" onClick={() => downloadClosure(report)}>
            <Download size={16} />
            下载收口 Manifest
          </button>
          <pre className="final-manifest">{report.manifest}</pre>
        </article>
      </div>
    </section>
  );
}
