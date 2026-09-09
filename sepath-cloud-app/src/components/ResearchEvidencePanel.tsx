import { Beaker, CheckCircle2, FlaskConical, ShieldCheck, TriangleAlert } from "lucide-react";
import type { ResearchEvidenceReport, ResearchEvidenceStatus } from "../engine/researchEvidence";

interface ResearchEvidencePanelProps {
  report: ResearchEvidenceReport;
}

const statusLabels: Record<ResearchEvidenceStatus, string> = {
  validated: "已回放验证",
  simulated: "合成对照",
  needs_trial: "待真实试点",
};

function StatusIcon({ status }: { status: ResearchEvidenceStatus }) {
  if (status === "validated") return <CheckCircle2 size={17} />;
  if (status === "simulated") return <FlaskConical size={17} />;
  return <TriangleAlert size={17} />;
}

export function ResearchEvidencePanel({ report }: ResearchEvidencePanelProps) {
  return (
    <section className="panel research-panel" id="research">
      <div className="panel-heading">
        <h2>算法验证与科研证据</h2>
        <span>用合成样本、消融对照和边界声明证明智能性来自算法闭环</span>
      </div>

      <div className="research-hero">
        <article>
          <Beaker size={24} />
          <div>
            <strong>{report.evidenceLevel}</strong>
            <p>{report.summary}</p>
          </div>
        </article>
        <div className="research-score">
          <strong>{report.readinessScore}</strong>
          <span>试点就绪分</span>
        </div>
      </div>

      <div className="ablation-grid">
        {report.ablations.map((ablation) => (
          <article className={`ablation-card ${ablation.status}`} key={ablation.id}>
            <div className="ablation-topline">
              <StatusIcon status={ablation.status} />
              <strong>{ablation.label}</strong>
              <span>{statusLabels[ablation.status]}</span>
            </div>
            <div className="ablation-score">
              <b>{ablation.score}</b>
              <span>{ablation.delta === 0 ? "当前方案" : `${ablation.delta} 分差`}</span>
            </div>
            <p>{ablation.explanation}</p>
          </article>
        ))}
      </div>

      <div className="research-detail-grid">
        <article>
          <div className="ops-heading">
            <FlaskConical size={18} />
            <strong>验证指标</strong>
          </div>
          <div className="metric-stack">
            {report.metrics.map((metric) => (
              <div key={metric.id}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <p>{metric.benchmark}</p>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <ShieldCheck size={18} />
            <strong>科研边界与下一步试点</strong>
          </div>
          <div className="research-safeguards">
            {report.safeguards.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
          <ol className="rollback-list">
            {report.nextValidationSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </article>
      </div>
    </section>
  );
}

