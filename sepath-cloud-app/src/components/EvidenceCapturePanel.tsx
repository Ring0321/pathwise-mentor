import { type ChangeEvent, type FormEvent, useRef, useState } from "react";
import { ClipboardCheck, Download, PlusCircle, UploadCloud } from "lucide-react";
import type { CompetencyId, EventType, EvidenceEvent, RiskLevel } from "../domain/types";

export interface ManualEvidenceInput {
  type: EventType;
  source: EvidenceEvent["source"];
  title: string;
  detail: string;
  competencyId: CompetencyId;
  delta: number;
  risk: RiskLevel;
  confidence: number;
}

interface EvidenceCapturePanelProps {
  onAddEvidence: (input: ManualEvidenceInput) => void;
  onExportLedger: () => void;
  onImportLedger: (raw: string) => string;
  summary: string;
}

const competencyOptions: { value: CompetencyId; label: string }[] = [
  { value: "requirements", label: "需求拆解" },
  { value: "architecture", label: "模块设计" },
  { value: "implementation", label: "编码实现" },
  { value: "testing", label: "测试质量" },
  { value: "collaboration", label: "协作交付" },
  { value: "reflection", label: "复盘迁移" },
];

export function EvidenceCapturePanel({
  onAddEvidence,
  onExportLedger,
  onImportLedger,
  summary,
}: EvidenceCapturePanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("教师观察：学生能解释失败用例");
  const [detail, setDetail] = useState("学生说明库存不足应返回 409，并能把该异常路径补进 PR 描述。");
  const [type, setType] = useState<EventType>("teacher_reviewed");
  const [source, setSource] = useState<EvidenceEvent["source"]>("teacher");
  const [competencyId, setCompetencyId] = useState<CompetencyId>("testing");
  const [delta, setDelta] = useState(4);
  const [risk, setRisk] = useState<RiskLevel>("low");
  const [copied, setCopied] = useState(false);
  const [importNotice, setImportNotice] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onAddEvidence({
      type,
      source,
      title,
      detail,
      competencyId,
      delta,
      risk,
      confidence: risk === "high" ? 0.72 : 0.84,
    });
  }

  async function copySummary() {
    await navigator.clipboard.writeText(summary);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  async function importLedger(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const raw = await file.text();
    const message = onImportLedger(raw);
    setImportNotice(message);
    event.target.value = "";
  }

  return (
    <section className="panel capture-panel">
      <div className="panel-heading">
        <h2>证据采集与交付</h2>
        <span>支持手动补证据、导出账本和复制复核摘要</span>
      </div>
      <form className="capture-form" onSubmit={submit}>
        <label>
          事件标题
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label>
          证据描述
          <textarea value={detail} onChange={(event) => setDetail(event.target.value)} rows={3} />
        </label>
        <div className="form-grid">
          <label>
            类型
            <select value={type} onChange={(event) => setType(event.target.value as EventType)}>
              <option value="teacher_reviewed">教师复核</option>
              <option value="reflection_submitted">学生反思</option>
              <option value="ci_failed">CI 失败</option>
              <option value="ci_passed">CI 通过</option>
              <option value="commit_pushed">代码提交</option>
              <option value="conversation">对话证据</option>
            </select>
          </label>
          <label>
            来源
            <select
              value={source}
              onChange={(event) => setSource(event.target.value as EvidenceEvent["source"])}
            >
              <option value="teacher">teacher</option>
              <option value="reflection">reflection</option>
              <option value="ci">ci</option>
              <option value="git">git</option>
              <option value="chat">chat</option>
            </select>
          </label>
          <label>
            能力节点
            <select
              value={competencyId}
              onChange={(event) => setCompetencyId(event.target.value as CompetencyId)}
            >
              {competencyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            增量
            <input
              type="number"
              min="-20"
              max="20"
              value={delta}
              onChange={(event) => setDelta(Number(event.target.value))}
            />
          </label>
          <label>
            风险
            <select value={risk} onChange={(event) => setRisk(event.target.value as RiskLevel)}>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
          </label>
        </div>
        <div className="capture-actions">
          <button className="primary-button compact" type="submit">
            <PlusCircle size={17} />
            追加证据
          </button>
          <button className="ghost-button compact" type="button" onClick={onExportLedger}>
            <Download size={17} />
            导出账本
          </button>
          <button className="ghost-button compact" type="button" onClick={() => fileInputRef.current?.click()}>
            <UploadCloud size={17} />
            导入账本
          </button>
          <button className="ghost-button compact" type="button" onClick={copySummary}>
            <ClipboardCheck size={17} />
            {copied ? "已复制" : "复制摘要"}
          </button>
        </div>
        <input
          ref={fileInputRef}
          className="hidden-file-input"
          type="file"
          accept="application/json,.json"
          onChange={importLedger}
        />
        {importNotice ? <p className="import-notice">{importNotice}</p> : null}
      </form>
    </section>
  );
}
