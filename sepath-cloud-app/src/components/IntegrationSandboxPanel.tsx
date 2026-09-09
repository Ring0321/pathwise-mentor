import { useMemo, useState } from "react";
import { DatabaseZap, GitBranch, Play, ShieldCheck, UploadCloud } from "lucide-react";
import {
  runIntegrationWebhookDryRun,
  type IntegrationMappingResult,
  type IntegrationSandboxReport,
} from "../engine/integrationSandbox";
import type { AppState, EvidenceEvent } from "../domain/types";
import type { ApiContractReport } from "../engine/apiContract";
import type { PrivacyGuardReport } from "../engine/privacyGuard";

interface IntegrationSandboxPanelProps {
  report: IntegrationSandboxReport;
  state: AppState;
  apiContract: ApiContractReport;
  privacyGate: PrivacyGuardReport["gate"];
  onCommitEvents: (events: EvidenceEvent[]) => void;
}

const gateLabel = {
  pass: "通过",
  watch: "观察",
  block: "阻断",
};

export function IntegrationSandboxPanel({
  report,
  state,
  apiContract,
  privacyGate,
  onCommitEvents,
}: IntegrationSandboxPanelProps) {
  const [sampleId, setSampleId] = useState(report.samples[1]?.id ?? report.samples[0].id);
  const [notice, setNotice] = useState("");
  const sample = report.samples.find((item) => item.id === sampleId) ?? report.samples[0];
  const dryRun: IntegrationMappingResult = useMemo(
    () => runIntegrationWebhookDryRun(sample, state, apiContract, privacyGate),
    [apiContract, privacyGate, sample, state],
  );

  function commit() {
    if (dryRun.events.length === 0) {
      setNotice("当前载荷存在阻断项，未写入账本。");
      return;
    }
    onCommitEvents(dryRun.events);
    setNotice(`已写入 ${dryRun.events.length} 条 EvidenceEvent；重复事件会自动去重。`);
  }

  return (
    <section className="panel integration-panel" id="integration">
      <div className="panel-heading">
        <h2>集成回放沙箱</h2>
        <span>把 Git、CI、LMS 和飞书 Webhook 试运行成可脱敏、可幂等、可写回的 EvidenceEvent</span>
      </div>

      <div className="integration-hero">
        <div>
          <DatabaseZap size={22} />
          <strong>{report.mode}</strong>
          <p>{report.gate}</p>
        </div>
        <div>
          <span>集成就绪度</span>
          <b>{report.score}</b>
        </div>
        <div className="integration-source-grid">
          {report.sourceCoverage.map((item) => (
            <span className={`integration-chip ${item.status}`} key={item.label}>
              <b>{item.label}</b>
              {gateLabel[item.status]}
            </span>
          ))}
        </div>
      </div>

      <div className="integration-body">
        <article className="integration-console">
          <div className="ops-heading">
            <GitBranch size={18} />
            <strong>Webhook 样例</strong>
          </div>
          <label>
            选择来源
            <select
              value={sampleId}
              onChange={(event) => {
                setSampleId(event.target.value);
                setNotice("");
              }}
            >
              {report.samples.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label} | {item.eventName}
                </option>
              ))}
            </select>
          </label>
          <pre className="integration-payload">{dryRun.sanitizedPayload}</pre>
          <div className="integration-actions">
            <button className="primary-button compact" type="button" onClick={commit}>
              <UploadCloud size={17} />
              写入账本
            </button>
            <span>{dryRun.summary}</span>
          </div>
          {notice ? <p className="integration-notice">{notice}</p> : null}
        </article>

        <article className={`integration-result ${dryRun.qualityGate}`}>
          <div className="integration-result-head">
            <div>
              <span>{dryRun.eventName}</span>
              <strong>{gateLabel[dryRun.qualityGate]}</strong>
            </div>
            <b>{dryRun.idempotencyKey}</b>
          </div>
          <div className="integration-checks">
            {dryRun.checks.map((check) => (
              <div className={`integration-check ${check.status}`} key={check.id}>
                <ShieldCheck size={16} />
                <div>
                  <strong>{check.label}</strong>
                  <span>{check.evidence}</span>
                </div>
                <b>{gateLabel[check.status]}</b>
              </div>
            ))}
          </div>
          <div className="integration-events">
            {dryRun.events.length ? (
              dryRun.events.map((event) => (
                <div key={event.id}>
                  <Play size={16} />
                  <div>
                    <strong>{event.type}</strong>
                    <span>{event.title}</span>
                    <small>{Object.keys(event.competencyImpacts).join(" / ")} | {event.risk}</small>
                  </div>
                </div>
              ))
            ) : (
              <p>{dryRun.deadLetterReason}</p>
            )}
          </div>
        </article>
      </div>

      <div className="integration-rules">
        {report.operatingRules.map((rule) => (
          <span key={rule}>{rule}</span>
        ))}
      </div>
    </section>
  );
}
