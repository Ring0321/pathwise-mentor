import type { CompetencyId } from "../domain/types";

const labels: Record<CompetencyId, string> = {
  requirements: "需求拆解",
  architecture: "模块设计",
  implementation: "编码实现",
  testing: "测试质量",
  collaboration: "协作交付",
  reflection: "复盘迁移",
};

interface CompetencyPanelProps {
  scores: Record<CompetencyId, number>;
}

export function CompetencyPanel({ scores }: CompetencyPanelProps) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>路径数字孪生</h2>
        <span>能力状态随证据实时更新</span>
      </div>
      <div className="bars">
        {(Object.keys(labels) as CompetencyId[]).map((key) => (
          <div className="bar-row" key={key}>
            <div className="bar-meta">
              <span>{labels[key]}</span>
              <strong>{Math.round(scores[key])}</strong>
            </div>
            <div className="bar-track">
              <div
                className={scores[key] < 55 ? "bar-fill risk" : "bar-fill"}
                style={{ width: `${Math.max(8, scores[key])}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
