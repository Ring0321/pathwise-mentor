import { ArrowUpRight, Ban, CheckCheck } from "lucide-react";
import type { DiagnosisCard, ScaffoldMessage, TaskDecision } from "../domain/types";

interface DecisionPanelProps {
  diagnosis: DiagnosisCard;
  decisions: TaskDecision[];
  scaffold: ScaffoldMessage;
}

export function DecisionPanel({ diagnosis, decisions, scaffold }: DecisionPanelProps) {
  return (
    <section className="panel decision-panel">
      <div className="panel-heading">
        <h2>Agent 决策台</h2>
        <span>诊断、路径、脚手架三件事合在一起看</span>
      </div>
      <article className={`diagnosis-card ${diagnosis.risk}`}>
        <div className="diagnosis-topline">
          <span>{diagnosis.blocker}</span>
          <strong>{Math.round(diagnosis.confidence * 100)}%</strong>
        </div>
        <p>{diagnosis.summary}</p>
        <div className="reason-list">
          {diagnosis.reasonCodes.map((code) => (
            <span key={code}>{code}</span>
          ))}
        </div>
      </article>
      <div className="decision-list">
        {decisions.map((decision) => (
          <div className="decision-row" key={decision.taskId}>
            <div className={decision.gate === "PASS" ? "decision-icon pass" : "decision-icon block"}>
              {decision.gate === "PASS" ? <CheckCheck size={16} /> : <Ban size={16} />}
            </div>
            <div>
              <strong>{decision.rank ? `#${decision.rank} ${decision.label}` : decision.label}</strong>
              <span>{decision.reasonCodes.join(" / ")}</span>
            </div>
            <b>{decision.publishableValue === null ? "BLOCK" : decision.publishableValue.toFixed(2)}</b>
          </div>
        ))}
      </div>
      <article className="scaffold-card">
        <div className="scaffold-head">
          <ArrowUpRight size={18} />
          <strong>{scaffold.title}</strong>
          <span>L{scaffold.level}</span>
        </div>
        <p>{scaffold.body}</p>
        <ol>
          {scaffold.checklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </article>
    </section>
  );
}
