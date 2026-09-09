import { Award, CheckCircle2, CircleDot, FileText, Sparkles } from "lucide-react";
import type { AwardReadinessReport } from "../domain/types";

interface AwardReadinessPanelProps {
  report: AwardReadinessReport;
}

const statusLabels: Record<string, string> = {
  proved: "已验证",
  ready: "可提交",
  needs_polish: "待打磨",
};

export function AwardReadinessPanel({ report }: AwardReadinessPanelProps) {
  return (
    <section className="panel award-panel" id="award">
      <div className="panel-heading">
        <h2>参赛评审证据面板</h2>
        <span>把评分维度、实现证据和提交材料映射到同一张表</span>
      </div>
      <div className="award-hero">
        <div className="award-score">
          <Award size={28} />
          <strong>
            {report.totalScore}
            <span>/{report.maxScore}</span>
          </strong>
          <p>自评目标分，仅用于对照官方评分项，不代表主办方最终成绩。</p>
        </div>
        <article>
          <Sparkles size={20} />
          <div>
            <strong>最强差异化</strong>
            <p>{report.strongestDifferentiator}</p>
          </div>
        </article>
      </div>
      <div className="criterion-grid">
        {report.criteria.map((criterion) => (
          <article className={`criterion-card ${criterion.status}`} key={criterion.id}>
            <div className="criterion-topline">
              <CheckCircle2 size={18} />
              <strong>{criterion.label}</strong>
              <span>{statusLabels[criterion.status]}</span>
            </div>
            <div className="criterion-score">
              <b>{criterion.score}</b>
              <span>/{criterion.maxScore}</span>
            </div>
            <p>{criterion.proof}</p>
            <div className="artifact-tags">
              {criterion.artifacts.map((artifact) => (
                <span key={artifact}>
                  <FileText size={13} />
                  {artifact}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>
      <div className="polish-strip">
        {report.nextPolishActions.map((action) => (
          <span key={action}>
            <CircleDot size={13} />
            {action}
          </span>
        ))}
      </div>
    </section>
  );
}
