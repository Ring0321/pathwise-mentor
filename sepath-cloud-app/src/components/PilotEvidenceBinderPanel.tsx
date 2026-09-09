import {
  Archive,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileCheck2,
  LockKeyhole,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import type { PilotEvidenceBinderReport, PilotEvidenceBinderStatus } from "../engine/pilotEvidenceBinder";

interface PilotEvidenceBinderPanelProps {
  report: PilotEvidenceBinderReport;
}

const statusLabels: Record<PilotEvidenceBinderStatus, string> = {
  ready: "就绪",
  collecting: "采集中",
  manual: "人工",
  blocked: "阻断",
};

const ownerLabels: Record<string, string> = {
  school: "学校",
  teacher: "教师",
  researcher: "研究",
  ops: "工程",
  security: "安全",
};

function StatusIcon({ status }: { status: PilotEvidenceBinderStatus }) {
  if (status === "ready") return <CheckCircle2 size={17} />;
  if (status === "blocked") return <TriangleAlert size={17} />;
  if (status === "manual") return <ClipboardCheck size={17} />;
  return <Archive size={17} />;
}

function downloadManifest(report: PilotEvidenceBinderReport) {
  const blob = new Blob([report.binderManifest], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "sepath-pilot-evidence-binder-manifest.json";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function PilotEvidenceBinderPanel({ report }: PilotEvidenceBinderPanelProps) {
  return (
    <section className="panel pilot-binder-panel" id="pilot-evidence-binder">
      <div className="panel-heading">
        <h2>试点证据归档中心</h2>
        <span>把真实课程试点前的授权、脱敏、预注册、数据冻结、教师签收和声明分级装订成可复核证据包</span>
      </div>

      <div className="pilot-binder-hero">
        <article>
          <FileCheck2 size={24} />
          <div>
            <strong>{report.stage}</strong>
            <p>{report.summary}</p>
          </div>
        </article>
        <div className="pilot-binder-score">
          <span>证据装订</span>
          <strong>{report.score}</strong>
        </div>
        <div className="pilot-binder-counts">
          <span>
            <b>{report.readyCount}</b> ready
          </span>
          <span>
            <b>{report.collectingCount}</b> collect
          </span>
          <span>
            <b>{report.manualCount}</b> manual
          </span>
          <span>
            <b>{report.blockedCount}</b> block
          </span>
        </div>
      </div>

      <div className="pilot-binder-metrics">
        {report.metrics.map((metric) => (
          <div className={`pilot-binder-card ${metric.status}`} key={metric.id}>
            <span>{statusLabels[metric.status]}</span>
            <strong>{metric.label}</strong>
            <b>{metric.value}</b>
            <p>{metric.target}</p>
          </div>
        ))}
      </div>

      <div className="pilot-binder-grid">
        <article>
          <div className="ops-heading">
            <LockKeyhole size={18} />
            <strong>授权与安全门禁</strong>
          </div>
          <div className="pilot-binder-list">
            {report.consentPack.map((item) => (
              <div className={`pilot-binder-status ${item.status}`} key={item.id}>
                <StatusIcon status={item.status} />
                <div>
                  <div className="pilot-binder-head">
                    <strong>{item.label}</strong>
                    <span>{ownerLabels[item.owner]}</span>
                  </div>
                  <p>{item.evidence}</p>
                  <small>通过：{item.passCondition}</small>
                  <em>阻断：{item.blockedIf}</em>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <Archive size={18} />
            <strong>证据冻结链</strong>
          </div>
          <div className="pilot-binder-list">
            {report.evidenceFreeze.map((step) => (
              <div className={`pilot-binder-status ${step.status}`} key={step.id}>
                <StatusIcon status={step.status} />
                <div>
                  <div className="pilot-binder-head">
                    <strong>{step.label}</strong>
                    <span>{statusLabels[step.status]}</span>
                  </div>
                  <p>{step.source}</p>
                  <code>{step.artifact}</code>
                  <small>{step.checksumRule}</small>
                  <em>{step.retention}</em>
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="pilot-binder-grid lower">
        <article>
          <div className="ops-heading">
            <ShieldCheck size={18} />
            <strong>分析门禁与声明等级</strong>
          </div>
          <div className="pilot-binder-claims">
            {report.analysisGates.map((gate) => (
              <div className={`pilot-binder-card ${gate.status}`} key={gate.id}>
                <span>{statusLabels[gate.status]}</span>
                <strong>{gate.label}</strong>
                <p>{gate.evidence}</p>
                <small>通过：{gate.passCondition}</small>
                <em>阻断：{gate.blockedIf}</em>
              </div>
            ))}
            {report.claimTiers.map((tier) => (
              <div className={`pilot-binder-card ${tier.status}`} key={tier.id}>
                <span>{statusLabels[tier.status]}</span>
                <strong>{tier.label}</strong>
                <p>可说：{tier.canSay}</p>
                <small>不能说：{tier.cannotSay}</small>
                <em>{tier.evidenceThreshold}</em>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <ClipboardCheck size={18} />
            <strong>教师签收与导出包</strong>
          </div>
          <ol className="pilot-binder-script">
            {report.teacherSignoffScript.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
          <div className="pilot-binder-export">
            {report.exportPack.map((item) => (
              <div className={`pilot-binder-card ${item.status}`} key={item.id}>
                <span>{statusLabels[item.status]}</span>
                <strong>{item.label}</strong>
                <code>{item.path}</code>
                <p>{item.content}</p>
              </div>
            ))}
          </div>
          <button className="primary-button compact" onClick={() => downloadManifest(report)}>
            <Download size={16} />
            下载证据装订 Manifest
          </button>
          <pre className="pilot-binder-manifest">{report.binderManifest}</pre>
        </article>
      </div>
    </section>
  );
}
