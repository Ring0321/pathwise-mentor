import { CheckCircle2, ExternalLink, Globe2, PackageCheck, Route, ShieldCheck, UploadCloud } from "lucide-react";
import type { HostingSelftestReport, HostingSelftestStatus } from "../engine/hostingSelftest";

interface HostingSelftestPanelProps {
  report: HostingSelftestReport;
}

const statusLabels: Record<HostingSelftestStatus, string> = {
  pass: "可上传",
  watch: "需复核",
  manual: "人工确认",
};

function visualStatus(status: HostingSelftestStatus) {
  if (status === "pass") return "ready";
  if (status === "watch") return "watch";
  return "manual";
}

export function HostingSelftestPanel({ report }: HostingSelftestPanelProps) {
  return (
    <section className="panel final-submission-panel hosting-selftest-panel" id="hosting-selftest">
      <div className="panel-heading">
        <h2>公网托管发布体检中心</h2>
        <span>把静态上传 ZIP、平台 fallback、health/release 探针和最终 URL 回执做成可复查的上线工作台</span>
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
          <span>托管自检分</span>
          <strong>{report.score}</strong>
        </div>
        <div className="final-counts">
          <span>
            <b>{report.passCount}</b> pass
          </span>
          <span>
            <b>{report.watchCount}</b> watch
          </span>
          <span>
            <b>{report.manualCount}</b> manual
          </span>
        </div>
      </div>

      <div className="final-note">
        <PackageCheck size={17} />
        <code>{report.uploadZip}</code>
        <code>{report.selftestPath}</code>
        <p>{report.receiptPath}</p>
      </div>

      <div className="final-grid">
        <article>
          <div className="ops-heading">
            <Globe2 size={18} />
            <strong>平台配置矩阵</strong>
          </div>
          <div className="final-routes">
            {report.providers.map((provider) => (
              <div className={`final-status ${visualStatus(provider.status)}`} key={provider.id}>
                <ExternalLink size={17} />
                <div>
                  <div className="final-status-head">
                    <strong>{provider.provider}</strong>
                    <span>{statusLabels[provider.status]}</span>
                  </div>
                  <p>{provider.uploadMode}</p>
                  <code>{provider.fallbackRule}</code>
                  <small>{provider.postDeployProbe}</small>
                  <em>{provider.risk}</em>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <CheckCircle2 size={18} />
            <strong>上传包结构证据</strong>
          </div>
          <div className="final-checklist">
            {report.artifactChecks.map((item) => (
              <div className={`final-status ${visualStatus(item.status)}`} key={item.id}>
                <CheckCircle2 size={17} />
                <div>
                  <div className="final-status-head">
                    <strong>{item.label}</strong>
                    <span>{statusLabels[item.status]}</span>
                  </div>
                  <p>{item.evidence}</p>
                  <small>{item.path}</small>
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="final-grid lower">
        <article>
          <div className="ops-heading">
            <Route size={18} />
            <strong>发布日 runbook</strong>
          </div>
          <div className="final-routes">
            {report.runbook.map((step) => (
              <div className={`final-status ${visualStatus(step.status)}`} key={step.id}>
                <CheckCircle2 size={17} />
                <div>
                  <div className="final-status-head">
                    <strong>{step.label}</strong>
                    <span>{statusLabels[step.status]}</span>
                  </div>
                  <code>{step.command}</code>
                  <small>{step.acceptance}</small>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <ShieldCheck size={18} />
            <strong>边界与 Manifest</strong>
          </div>
          <div className="final-note">
            <ShieldCheck size={17} />
            <code>{report.materialPath}</code>
            <p>{report.boundary}</p>
          </div>
          <pre className="final-manifest">{report.manifest}</pre>
        </article>
      </div>
    </section>
  );
}
