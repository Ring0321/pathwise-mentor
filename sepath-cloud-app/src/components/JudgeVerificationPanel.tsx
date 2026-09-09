import { AlertTriangle, CheckCircle2, ClipboardCheck, FileSearch, Route, ShieldCheck } from "lucide-react";
import type { JudgeVerificationReport, JudgeVerificationStatus } from "../engine/judgeVerification";

interface JudgeVerificationPanelProps {
  report: JudgeVerificationReport;
}

const statusLabels: Record<JudgeVerificationStatus, string> = {
  pass: "可验收",
  check: "需复核",
  manual: "人工事实",
};

function StatusIcon({ status }: { status: JudgeVerificationStatus }) {
  if (status === "pass") return <CheckCircle2 size={17} />;
  if (status === "manual") return <ShieldCheck size={17} />;
  return <AlertTriangle size={17} />;
}

function visualStatus(status: JudgeVerificationStatus) {
  if (status === "pass") return "ready";
  if (status === "check") return "watch";
  return "manual";
}

export function JudgeVerificationPanel({ report }: JudgeVerificationPanelProps) {
  return (
    <section className="panel final-submission-panel judge-verification-panel" id="judge-verification">
      <div className="panel-heading">
        <h2>评委技术验收中心</h2>
        <span>把闭环 Demo、后端接口、公开试用、发布门禁、科研增值和真实性边界合成现场复查路线</span>
      </div>

      <div className="final-hero">
        <article>
          <FileSearch size={24} />
          <div>
            <strong>{report.stage}</strong>
            <p>{report.summary}</p>
          </div>
        </article>
        <div className="final-score">
          <span>验收就绪度</span>
          <strong>{report.score}</strong>
        </div>
        <div className="final-counts">
          <span>
            <b>{report.passCount}</b> pass
          </span>
          <span>
            <b>{report.checkCount}</b> check
          </span>
          <span>
            <b>{report.manualCount}</b> manual
          </span>
        </div>
      </div>

      <div className="final-note">
        <ClipboardCheck size={17} />
        <code>{report.verificationPackPath}</code>
        <code>{report.machinePackPath}</code>
        <p>{report.releaseGatePath}</p>
      </div>

      <div className="final-grid">
        <article>
          <div className="ops-heading">
            <CheckCircle2 size={18} />
            <strong>机器证据</strong>
          </div>
          <div className="final-routes">
            {report.proofs.map((proof) => (
              <div className={`final-status ${visualStatus(proof.status)}`} key={proof.id}>
                <StatusIcon status={proof.status} />
                <div>
                  <div className="final-status-head">
                    <strong>{proof.label}</strong>
                    <span>{statusLabels[proof.status]}</span>
                  </div>
                  <p>{proof.evidence}</p>
                  <code>{proof.command}</code>
                  <small>{proof.materialPath}</small>
                  <em>{proof.judgeValue}</em>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <Route size={18} />
            <strong>10 分钟复查路线</strong>
          </div>
          <div className="final-checklist">
            {report.routes.map((route) => (
              <div className="final-status ready" key={route.id}>
                <CheckCircle2 size={17} />
                <div>
                  <div className="final-status-head">
                    <strong>{route.action}</strong>
                    <span>{route.minute}</span>
                  </div>
                  <p>{route.expectedSignal}</p>
                  <small>{route.scoringFocus}</small>
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="final-grid lower">
        <article>
          <div className="ops-heading">
            <ShieldCheck size={18} />
            <strong>真实性边界</strong>
          </div>
          <div className="final-gates">
            {report.boundaries.map((boundary) => (
              <div className={`final-card ${visualStatus(boundary.status)}`} key={boundary.id}>
                <span>{statusLabels[boundary.status]}</span>
                <strong>{boundary.label}</strong>
                <p>{boundary.safeClaim}</p>
                <small>{boundary.forbiddenClaim}</small>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <FileSearch size={18} />
            <strong>源码热点与 Manifest</strong>
          </div>
          <div className="final-tags">
            {report.sourceHotspots.map((path) => (
              <span key={path}>{path}</span>
            ))}
          </div>
          <pre className="final-manifest">{report.manifest}</pre>
        </article>
      </div>
    </section>
  );
}
