import { CheckCircle2, ClipboardCheck, FileText, ShieldAlert, Trophy } from "lucide-react";
import type {
  CompetitionAlignmentReport,
  CompetitionAlignmentStatus,
  CompetitionCoreAlignment,
  CompetitionScoreAlignment,
  CompetitionSubmissionAlignment,
} from "../engine/competitionAlignment";

interface CompetitionAlignmentPanelProps {
  report: CompetitionAlignmentReport;
}

const statusLabels: Record<CompetitionAlignmentStatus, string> = {
  pass: "已证明",
  ready: "可提交",
  manual: "人工门禁",
};

function visualStatus(status: CompetitionAlignmentStatus) {
  if (status === "pass") return "ready";
  if (status === "ready") return "watch";
  return "manual";
}

function EvidenceTags({ items }: { items: string[] }) {
  return (
    <div className="artifact-tags">
      {items.map((item) => (
        <span key={item}>
          <FileText size={13} />
          {item}
        </span>
      ))}
    </div>
  );
}

function CoreCard({ item }: { item: CompetitionCoreAlignment }) {
  return (
    <article className={`criterion-card ${item.status === "pass" ? "proved" : "ready"}`}>
      <div className="criterion-topline">
        <CheckCircle2 size={18} />
        <strong>{item.requirement}</strong>
        <span>{statusLabels[item.status]}</span>
      </div>
      <p>{item.officialPoint}</p>
      <p>{item.productAnswer}</p>
      <code>{item.demoAnchor}</code>
      <EvidenceTags items={[...item.sourceEvidence, ...item.materialEvidence]} />
      <small>{item.judgeProbe}</small>
      <em>{item.boundary}</em>
    </article>
  );
}

function ScoreRow({ item }: { item: CompetitionScoreAlignment }) {
  return (
    <div className={`final-status ${visualStatus(item.status)}`}>
      <CheckCircle2 size={17} />
      <div>
        <div className="final-status-head">
          <strong>
            {item.criterion} · {item.weight}分
          </strong>
          <span>{statusLabels[item.status]}</span>
        </div>
        <p>{item.productAnswer}</p>
        {item.demoAnchor ? <code>{item.demoAnchor}</code> : null}
        <EvidenceTags items={item.evidence} />
      </div>
    </div>
  );
}

function SubmissionRow({ item }: { item: CompetitionSubmissionAlignment }) {
  return (
    <div className={`final-status ${visualStatus(item.status)}`}>
      <ClipboardCheck size={17} />
      <div>
        <div className="final-status-head">
          <strong>{item.requirement}</strong>
          <span>{statusLabels[item.status]}</span>
        </div>
        <p>{item.acceptance}</p>
        <EvidenceTags items={item.evidence} />
      </div>
    </div>
  );
}

export function CompetitionAlignmentPanel({ report }: CompetitionAlignmentPanelProps) {
  return (
    <section className="panel final-submission-panel competition-alignment-panel" id="competition-alignment">
      <div className="panel-heading">
        <h2>赛题要求逐项对齐中心</h2>
        <span>把官方任务、评分项、提交要求、源码证据和真实性边界压到同一张可复核总表</span>
      </div>

      <div className="final-hero">
        <article>
          <Trophy size={24} />
          <div>
            <strong>{report.stage}</strong>
            <p>{report.summary}</p>
          </div>
        </article>
        <div className="final-score">
          <span>对齐成熟度</span>
          <strong>{report.score}</strong>
        </div>
        <div className="final-counts">
          <span>
            <b>{report.passCount}</b> proved
          </span>
          <span>
            <b>{report.readyCount}</b> ready
          </span>
          <span>
            <b>{report.manualCount}</b> manual
          </span>
        </div>
      </div>

      <div className="final-note">
        <FileText size={17} />
        <code>{report.materialPath}</code>
        <code>{report.manifestPath}</code>
        <p>{report.boundary}</p>
      </div>

      <div className="criterion-grid">
        {report.coreCapabilities.map((item) => (
          <CoreCard item={item} key={item.id} />
        ))}
      </div>

      <div className="final-grid lower">
        <article>
          <div className="ops-heading">
            <Trophy size={18} />
            <strong>初赛评分矩阵</strong>
          </div>
          <div className="final-routes">
            {report.preliminaryScores.map((item) => (
              <ScoreRow item={item} key={item.id} />
            ))}
          </div>
        </article>
        <article>
          <div className="ops-heading">
            <Trophy size={18} />
            <strong>决赛路演评分矩阵</strong>
          </div>
          <div className="final-routes">
            {report.finalScores.map((item) => (
              <ScoreRow item={item} key={item.id} />
            ))}
          </div>
        </article>
      </div>

      <div className="final-grid lower">
        <article>
          <div className="ops-heading">
            <ClipboardCheck size={18} />
            <strong>提交要求核验</strong>
          </div>
          <div className="final-routes">
            {report.submissionRequirements.map((item) => (
              <SubmissionRow item={item} key={item.id} />
            ))}
          </div>
        </article>
        <article>
          <div className="ops-heading">
            <ShieldAlert size={18} />
            <strong>夺奖打法与禁止声明</strong>
          </div>
          <div className="final-checklist">
            {report.firstPrizeMoves.map((item) => (
              <div className="final-status ready" key={item}>
                <CheckCircle2 size={17} />
                <p>{item}</p>
              </div>
            ))}
          </div>
          <div className="claim-ledger-forbidden-grid">
            {report.forbiddenClaims.map((item) => (
              <div className="claim-ledger-forbidden" key={item}>
                <ShieldAlert size={16} />
                <span>{item}</span>
              </div>
            ))}
          </div>
          <pre className="final-manifest">{report.manifest}</pre>
        </article>
      </div>
    </section>
  );
}
