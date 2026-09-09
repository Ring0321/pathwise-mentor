import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Download,
  FileSearch,
  Layers3,
  LockKeyhole,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import type { ClaimEvidenceLedgerReport, ClaimLedgerStatus, ClaimTierId } from "../engine/claimEvidenceLedger";

interface ClaimEvidenceLedgerPanelProps {
  report: ClaimEvidenceLedgerReport;
}

type ClaimLedgerView = "claims" | "tiers" | "forbidden";
type TierFilter = "all" | ClaimTierId;

const statusLabels: Record<ClaimLedgerStatus, string> = {
  proved: "已证明",
  ready: "可声明",
  manual: "待确认",
  blocked: "禁止升级",
};

function StatusIcon({ status }: { status: ClaimLedgerStatus }) {
  if (status === "proved") return <CheckCircle2 size={17} />;
  if (status === "ready") return <ShieldCheck size={17} />;
  if (status === "manual") return <FileSearch size={17} />;
  return <TriangleAlert size={17} />;
}

function downloadLedger(report: ClaimEvidenceLedgerReport) {
  const blob = new Blob([report.manifest], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "sepath-claim-evidence-ledger-product.json";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function ClaimEvidenceLedgerPanel({ report }: ClaimEvidenceLedgerPanelProps) {
  const [view, setView] = useState<ClaimLedgerView>("claims");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const visibleClaims = useMemo(
    () => report.claims.filter((claim) => tierFilter === "all" || claim.tier === tierFilter),
    [report.claims, tierFilter],
  );

  return (
    <section className="panel claim-ledger-panel" id="claim-ledger">
      <div className="panel-heading">
        <h2>主张证据账本</h2>
        <span>把可说主张、禁止表述、L0-L3 声明等级和证据路径做成产品内可审计面板</span>
      </div>

      <div className="claim-ledger-hero">
        <article>
          <Layers3 size={24} />
          <div>
            <strong>{report.stage}</strong>
            <p>{report.summary}</p>
          </div>
        </article>
        <div className="claim-ledger-score">
          <span>证据可信分</span>
          <strong>{report.score}</strong>
        </div>
        <div className="claim-ledger-counts">
          <span>
            <b>{report.provedCount}</b> 已证明
          </span>
          <span>
            <b>{report.readyCount}</b> 可声明
          </span>
          <span>
            <b>{report.manualCount}</b> 待确认
          </span>
          <span>
            <b>{report.blockedCount}</b> 禁止
          </span>
        </div>
      </div>

      <div className="claim-ledger-metrics">
        {report.metrics.map((metric) => (
          <article className={`claim-ledger-metric ${metric.status}`} key={metric.id}>
            <span>{statusLabels[metric.status]}</span>
            <strong>{metric.label}</strong>
            <b>{metric.value}</b>
            <p>{metric.note}</p>
          </article>
        ))}
      </div>

      <div className="claim-ledger-tabs" role="tablist" aria-label="主张证据账本视图">
        <button type="button" className={view === "claims" ? "active" : ""} onClick={() => setView("claims")}>
          <FileSearch size={16} />
          主张矩阵
        </button>
        <button type="button" className={view === "tiers" ? "active" : ""} onClick={() => setView("tiers")}>
          <Layers3 size={16} />
          声明等级
        </button>
        <button type="button" className={view === "forbidden" ? "active" : ""} onClick={() => setView("forbidden")}>
          <LockKeyhole size={16} />
          禁止表述
        </button>
      </div>

      {view === "claims" ? (
        <>
          <div className="claim-ledger-filters" aria-label="按声明等级筛选">
            {(["all", "L0", "L1", "L2", "L3"] as TierFilter[]).map((tier) => (
              <button
                type="button"
                className={tierFilter === tier ? "active" : ""}
                onClick={() => setTierFilter(tier)}
                key={tier}
              >
                {tier === "all" ? "全部" : tier}
              </button>
            ))}
          </div>
          <div className="claim-ledger-claims">
            {visibleClaims.map((claim) => (
              <article className={`claim-ledger-card ${claim.status}`} key={claim.id}>
                <div className="claim-ledger-card-head">
                  <div>
                    <span>{claim.tier}</span>
                    <strong>{claim.label}</strong>
                  </div>
                  <em>
                    <StatusIcon status={claim.status} />
                    {statusLabels[claim.status]}
                  </em>
                </div>
                <div className="claim-ledger-wording">
                  <p>
                    <b>可说</b>
                    {claim.allowedWording}
                  </p>
                  <p>
                    <b>不能说</b>
                    {claim.forbiddenWording}
                  </p>
                </div>
                <div className="claim-ledger-evidence">
                  {claim.evidencePaths.map((item) => (
                    <code key={`${claim.id}-${item.path}`}>
                      {item.kind}: {item.path}
                    </code>
                  ))}
                </div>
                <div className="claim-ledger-signals">
                  {claim.productSignals.map((signal) => (
                    <span key={signal}>{signal}</span>
                  ))}
                </div>
                <small>复核：{claim.verification}</small>
                <p className="claim-ledger-risk">{claim.riskIfOverstated}</p>
              </article>
            ))}
          </div>
        </>
      ) : null}

      {view === "tiers" ? (
        <div className="claim-ledger-tier-grid">
          {report.claimTiers.map((tier) => (
            <article className={`claim-ledger-tier ${tier.status}`} key={tier.id}>
              <div>
                <span>{tier.id}</span>
                <strong>{tier.label}</strong>
              </div>
              <p>可说：{tier.canSay}</p>
              <p>不能说：{tier.cannotSay}</p>
              <small>{tier.evidenceThreshold}</small>
            </article>
          ))}
        </div>
      ) : null}

      {view === "forbidden" ? (
        <div className="claim-ledger-forbidden-grid">
          <article>
            <div className="ops-heading">
              <LockKeyhole size={18} />
              <strong>答辩禁止线</strong>
            </div>
            <div className="claim-ledger-forbidden">
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
              <ShieldCheck size={18} />
              <strong>评委追问回答脚本</strong>
            </div>
            <ol className="claim-ledger-script">
              {report.judgeAnswerScript.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ol>
            <button className="primary-button compact" type="button" onClick={() => downloadLedger(report)}>
              <Download size={16} />
              下载产品内账本 JSON
            </button>
            <pre className="claim-ledger-manifest">{report.manifest}</pre>
          </article>
        </div>
      ) : null}
    </section>
  );
}
