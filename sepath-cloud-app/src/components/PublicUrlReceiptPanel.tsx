import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Globe2,
  Link2,
  ShieldCheck,
  TerminalSquare,
} from "lucide-react";
import type { FinalSubmissionReport } from "../engine/finalSubmission";
import type { HostingSelftestReport } from "../engine/hostingSelftest";
import {
  buildPublicUrlReceiptReport,
  type PublicUrlReceiptReport,
  type PublicUrlReceiptStatus,
} from "../engine/publicUrlReceipt";

interface PublicUrlReceiptPanelProps {
  hostingSelftest: HostingSelftestReport;
  finalSubmission: FinalSubmissionReport;
}

const statusLabels: Record<PublicUrlReceiptStatus, string> = {
  ready: "已就绪",
  watch: "需复核",
  manual: "人工门禁",
  blocked: "阻断",
};

function StatusIcon({ status }: { status: PublicUrlReceiptStatus }) {
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

function downloadReceipt(report: PublicUrlReceiptReport) {
  const payload = {
    runtime: report.runtime,
    candidateUrl: report.normalizedUrl || "PENDING_FINAL_PUBLIC_URL",
    candidateReady: report.candidateReady,
    score: report.score,
    requiredPaths: report.requiredPaths,
    pasteRows: report.pasteRows,
    commands: report.commands,
    boundary: report.boundary,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "SE-Path_public_url_receipt_console.json";
  link.click();
  URL.revokeObjectURL(link.href);
}

async function copyPasteRows(report: PublicUrlReceiptReport) {
  const text = report.pasteRows.map((row) => `${row.field}: ${row.value}`).join("\n");
  await navigator.clipboard?.writeText(text);
}

export function PublicUrlReceiptPanel({ hostingSelftest, finalSubmission }: PublicUrlReceiptPanelProps) {
  const [candidateUrl, setCandidateUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const report = useMemo(
    () => buildPublicUrlReceiptReport(candidateUrl, hostingSelftest, finalSubmission),
    [candidateUrl, finalSubmission, hostingSelftest],
  );

  useEffect(() => {
    if (candidateUrl) return;
    if (typeof window === "undefined") return;
    if (isPublicOrigin(window.location.origin)) {
      setCandidateUrl(window.location.origin);
    }
  }, [candidateUrl]);

  async function handleCopy() {
    await copyPasteRows(report);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <section className="panel final-submission-panel public-url-panel" id="public-url-receipt">
      <div className="panel-heading">
        <h2>公网 URL 回执验收台</h2>
        <span>把最终评审地址、健康探针、平台粘贴文案和回执封存做成可交互的上线闭环</span>
      </div>

      <div className="final-hero">
        <article>
          <Globe2 size={24} />
          <div>
            <strong>{report.stage}</strong>
            <p>{report.summary}</p>
          </div>
        </article>
        <div className="final-score">
          <span>URL 回执分</span>
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
        <Link2 size={17} />
        <code>{report.normalizedUrl || "PENDING_FINAL_PUBLIC_URL"}</code>
        <p>{report.boundary}</p>
      </div>

      <div className="public-url-form" aria-label="公网 URL 回执表单">
        <label htmlFor="public-url-input">候选公网 HTTPS 地址</label>
        <div className="public-url-input-row">
          <input
            id="public-url-input"
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

      <div className="final-grid">
        <article>
          <div className="ops-heading">
            <ShieldCheck size={18} />
            <strong>URL 验收探针</strong>
          </div>
          <div className="final-routes">
            {report.probes.map((probe) => (
              <div className={`final-status ${probe.status}`} key={probe.id}>
                <StatusIcon status={probe.status} />
                <div>
                  <div className="final-status-head">
                    <strong>{probe.label}</strong>
                    <span>{statusLabels[probe.status]}</span>
                  </div>
                  <p>{probe.evidence}</p>
                  <small>{probe.expected}</small>
                  {probe.url ? <code>{probe.url}</code> : null}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <ClipboardCheck size={18} />
            <strong>比赛平台粘贴块</strong>
          </div>
          <div className="receipt-copy-block">
            {report.pasteRows.map((row) => (
              <div className="final-card watch" key={row.field}>
                <span>{row.field}</span>
                <strong>{row.value}</strong>
                <p>{row.guardrail}</p>
              </div>
            ))}
          </div>
          <div className="receipt-actions">
            <button className="primary-button compact" type="button" onClick={handleCopy}>
              <ClipboardCheck size={16} />
              {copied ? "已复制" : "复制文案"}
            </button>
            <button className="ghost-button compact" type="button" onClick={() => downloadReceipt(report)}>
              <Download size={16} />
              下载回执草稿
            </button>
          </div>
        </article>
      </div>

      <div className="final-grid lower">
        <article>
          <div className="ops-heading">
            <TerminalSquare size={18} />
            <strong>回填后命令链</strong>
          </div>
          <div className="final-commands">
            {report.commands.map((command) => (
              <div className={`final-card ${command.status}`} key={command.id}>
                <span>{statusLabels[command.status]}</span>
                <strong>{command.label}</strong>
                <code>{command.command}</code>
                <p>{command.result}</p>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <ShieldCheck size={18} />
            <strong>回执证据包</strong>
          </div>
          <div className="final-checklist">
            {report.evidenceBundle.map((item) => (
              <div className={`final-status ${item.status}`} key={item.id}>
                <StatusIcon status={item.status} />
                <div>
                  <div className="final-status-head">
                    <strong>{item.label}</strong>
                    <span>{statusLabels[item.status]}</span>
                  </div>
                  <code>{item.path}</code>
                  <small>{item.proof}</small>
                </div>
              </div>
            ))}
          </div>
          <pre className="final-manifest">{report.manifest}</pre>
        </article>
      </div>
    </section>
  );
}
