import { BookOpenCheck, ShieldCheck, TriangleAlert } from "lucide-react";
import type { CompetencyId, KnowledgeBoundaryReport, KnowledgeSourceKind } from "../domain/types";

interface KnowledgeBoundaryPanelProps {
  report: KnowledgeBoundaryReport;
}

const kindLabels: Record<KnowledgeSourceKind, string> = {
  course_material: "课程材料",
  rubric: "Rubric",
  code_evidence: "代码证据",
  policy: "安全策略",
  reflection: "反思记忆",
};

const competencyLabels: Record<CompetencyId, string> = {
  requirements: "需求",
  architecture: "架构",
  implementation: "实现",
  testing: "测试",
  collaboration: "协作",
  reflection: "反思",
};

export function KnowledgeBoundaryPanel({ report }: KnowledgeBoundaryPanelProps) {
  return (
    <section className="panel knowledge-panel" id="knowledge">
      <div className="panel-heading">
        <h2>课程知识边界与 Rubric 检索</h2>
        <span>把 GraphRAG、评分标准和安全发布门做成可审计面板</span>
      </div>
      <div className="knowledge-summary">
        <div>
          <BookOpenCheck size={20} />
          <strong>{Math.round(report.retrievalCoverage * 100)}%</strong>
          <span>能力覆盖</span>
        </div>
        <div>
          <ShieldCheck size={20} />
          <strong>{report.matchedSources.length}</strong>
          <span>命中知识源</span>
        </div>
        <div className={report.teacherReviewRequired ? "needs-review" : "ready"}>
          <TriangleAlert size={20} />
          <strong>{report.teacherReviewRequired ? "复核" : "放行"}</strong>
          <span>发布门状态</span>
        </div>
      </div>
      <div className="knowledge-grid">
        <div className="source-stack">
          {report.matchedSources.slice(0, 4).map((source) => (
            <article className="source-card" key={source.id}>
              <div>
                <strong>{source.title}</strong>
                <span>{kindLabels[source.kind]}</span>
              </div>
              <p>{source.summary}</p>
              <div className="source-meta">
                <b>{Math.round(source.matchScore * 100)}%</b>
                <span>{source.matchReason}</span>
              </div>
            </article>
          ))}
        </div>
        <div className="boundary-stack">
          <article>
            <strong>规则命中</strong>
            <div className="rule-tags">
              {report.ruleHits.map((rule) => (
                <span key={rule}>{rule}</span>
              ))}
            </div>
          </article>
          <article>
            <strong>允许输出</strong>
            <p>{report.allowedResponse}</p>
          </article>
          <article className="blocked-output">
            <strong>禁止输出</strong>
            <p>{report.blockedResponse}</p>
          </article>
          {report.missingCompetencyIds.length > 0 && (
            <article>
              <strong>缺证据能力</strong>
              <div className="rule-tags">
                {report.missingCompetencyIds.map((id) => (
                  <span key={id}>{competencyLabels[id]}</span>
                ))}
              </div>
            </article>
          )}
        </div>
      </div>
    </section>
  );
}
