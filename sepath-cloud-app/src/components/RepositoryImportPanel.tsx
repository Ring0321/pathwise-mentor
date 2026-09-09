import { DatabaseZap, GitPullRequestArrow, ShieldCheck, UploadCloud } from "lucide-react";
import { repositorySignals } from "../data/repositorySamples";
import { normalizeRepositorySignals } from "../engine/eventIngestion";
import type { EvidenceEvent } from "../domain/types";

interface RepositoryImportPanelProps {
  onImportEvents: (events: EvidenceEvent[]) => void;
}

const result = normalizeRepositorySignals(repositorySignals);

const statusLabels = {
  pass: "通过",
  watch: "观察",
  block: "阻断",
};

export function RepositoryImportPanel({ onImportEvents }: RepositoryImportPanelProps) {
  const gitCount = result.events.filter((event) => event.source === "git").length;
  const ciCount = result.events.filter((event) => event.source === "ci").length;
  const humanCount = result.events.filter(
    (event) => event.source === "teacher" || event.source === "reflection",
  ).length;

  return (
    <section className="panel repository-panel" id="repository">
      <div className="panel-heading">
        <h2>仓库证据接入沙箱</h2>
        <span>把 Issue、PR、CI、Review 和反思归一化为同一套 EvidenceEvent</span>
      </div>

      <div className="repository-summary">
        <article>
          <GitPullRequestArrow size={20} />
          <strong>{gitCount}</strong>
          <span>Git 事件</span>
        </article>
        <article>
          <DatabaseZap size={20} />
          <strong>{ciCount}</strong>
          <span>CI 事件</span>
        </article>
        <article>
          <ShieldCheck size={20} />
          <strong>{humanCount}</strong>
          <span>人类反馈</span>
        </article>
      </div>

      <div className="repository-body">
        <div className="repository-checks">
          {result.checks.map((check) => (
            <article className={`repository-check ${check.status}`} key={check.id}>
              <strong>{check.label}</strong>
              <span>{statusLabels[check.status]}</span>
              <p>{check.evidence}</p>
            </article>
          ))}
        </div>

        <div className="repository-actions">
          <p>{result.summary}</p>
          <button className="primary-button compact" onClick={() => onImportEvents(result.events)}>
            <UploadCloud size={17} />
            导入仓库样本
          </button>
          <span>重复导入会按事件 ID 自动去重，避免污染学习账本。</span>
        </div>
      </div>
    </section>
  );
}

