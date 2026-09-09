import type { ChangeEvent } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { RealWorkOrderInput, RealWorkOrderReport, RealWorkOrderRisk } from "../engine/realWorkOrder";

interface RealWorkOrderPanelProps {
  input: RealWorkOrderInput;
  report: RealWorkOrderReport;
  onApplySample: () => void;
  onChange: (patch: Partial<RealWorkOrderInput>) => void;
  onExport: () => void;
}

function riskText(risk: RealWorkOrderRisk) {
  if (risk === "high") return "高风险";
  if (risk === "medium") return "中风险";
  return "低风险";
}

function riskTone(risk: RealWorkOrderRisk) {
  if (risk === "high") return "需要教师复核";
  if (risk === "medium") return "可抽查后发布";
  return "可低风险推送";
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: keyof RealWorkOrderInput;
  label: string;
  value: string;
  onChange: (patch: Partial<RealWorkOrderInput>) => void;
  placeholder?: string;
}) {
  return (
    <label className="real-workbench-field">
      <span>{label}</span>
      <input
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange({ [id]: event.target.value })}
        placeholder={placeholder}
      />
    </label>
  );
}

function TextArea({
  id,
  label,
  value,
  onChange,
  rows = 5,
  placeholder,
}: {
  id: keyof RealWorkOrderInput;
  label: string;
  value: string;
  onChange: (patch: Partial<RealWorkOrderInput>) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <label className="real-workbench-field">
      <span>{label}</span>
      <textarea
        value={value}
        rows={rows}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChange({ [id]: event.target.value })}
        placeholder={placeholder}
      />
    </label>
  );
}

export function RealWorkOrderPanel({ input, report, onApplySample, onChange, onExport }: RealWorkOrderPanelProps) {
  const readySteps = report.pathPlan.filter((step) => step.status === "ready").length;
  const currentStep = report.pathPlan.find((step) => step.status === "current") ?? report.pathPlan[0];

  return (
    <section
      className={`real-workbench-panel real-workbench-${report.risk}`}
      data-real-workbench-status={report.risk}
      data-real-workbench-confidence={report.confidence}
      data-real-workbench-coverage={report.evidenceCoverage}
      aria-label="真实学习工单工作台"
    >
      <header className="real-workbench-hero">
        <div className="real-workbench-title">
          <span className="real-workbench-eyebrow">SE-Path Live Work Order</span>
          <h1>把真实 PR / CI / 提问变成可复核学习工单</h1>
          <p>
            适合软件工程课程现场使用：粘贴仓库证据后，系统只给诊断、路径和脚手架，不替学生写最终答案。
          </p>
        </div>
        <div className="real-workbench-status" aria-label="当前工单状态">
          <span>{riskTone(report.risk)}</span>
          <strong>{riskText(report.risk)}</strong>
          <small>{report.confidence}% 可信度 / {report.evidenceCoverage}% 证据覆盖</small>
        </div>
      </header>

      <div className="real-workbench-grid">
        <form className="real-workbench-form" onSubmit={(event) => event.preventDefault()}>
          <div className="real-workbench-form-head">
            <div>
              <span>输入真实材料</span>
              <strong>课程运营入口</strong>
            </div>
            <button className="ghost-button compact" onClick={onApplySample} type="button">
              <RefreshCw size={15} />
              载入样例
            </button>
          </div>

          <div className="real-workbench-inline">
            <Field id="studentName" label="学生" value={input.studentName} onChange={onChange} />
            <Field id="courseName" label="课程" value={input.courseName} onChange={onChange} />
          </div>
          <Field id="taskTitle" label="任务" value={input.taskTitle} onChange={onChange} />
          <Field id="prUrl" label="PR / 仓库链接" value={input.prUrl} onChange={onChange} />
          <TextArea id="ciLog" label="CI 失败日志" value={input.ciLog} rows={5} onChange={onChange} />
          <TextArea id="diffSummary" label="PR 变更摘要" value={input.diffSummary} rows={4} onChange={onChange} />
          <TextArea id="studentQuestion" label="学生原始提问" value={input.studentQuestion} rows={3} onChange={onChange} />
          <TextArea id="rubric" label="课程 Rubric / 规则" value={input.rubric} rows={4} onChange={onChange} />
        </form>

        <aside className="real-workbench-output">
          <div className="real-workbench-output-head">
            <div>
              <span>{report.courseName}</span>
              <strong>{report.studentName}</strong>
              <small>{report.taskTitle}</small>
            </div>
            <button className="primary-button compact" onClick={onExport} type="button">
              <Download size={15} />
              导出工单
            </button>
          </div>

          <div className="real-workbench-metrics" aria-label="工单指标">
            <article>
              <span>证据</span>
              <strong>{report.metrics.evidenceCount}</strong>
            </article>
            <article>
              <span>覆盖</span>
              <strong>{report.evidenceCoverage}%</strong>
            </article>
            <article>
              <span>价值</span>
              <strong>{report.interventionValue}</strong>
            </article>
            <article>
              <span>路径</span>
              <strong>{readySteps}/{report.metrics.pathSteps}</strong>
            </article>
          </div>

          <section className="real-workbench-diagnosis">
            <AlertTriangle size={22} />
            <div>
              <span>{report.abilityNode}</span>
              <strong>{report.blocker}</strong>
              <p>{report.diagnosis}</p>
            </div>
          </section>

          <section className="real-workbench-gate">
            <ShieldCheck size={20} />
            <div>
              <span>发布门禁</span>
              <strong>{report.teacherGate.label}</strong>
              <p>{report.teacherGate.rationale}</p>
            </div>
          </section>

          <section className="real-workbench-current">
            <ClipboardList size={20} />
            <div>
              <span>下一步</span>
              <strong>{currentStep.title}</strong>
              <p>{currentStep.doneWhen}</p>
            </div>
          </section>
        </aside>
      </div>

      <div className="real-workbench-secondary">
        <section className="real-workbench-plan" aria-label="自适应学习路径">
          <div className="real-workbench-section-head">
            <span>Path Plan</span>
            <strong>五步学习闭环</strong>
          </div>
          <ol>
            {report.pathPlan.map((step, index) => (
              <li className={step.status} key={step.id}>
                <span>{index + 1}</span>
                <div>
                  <strong>{step.title}</strong>
                  <p>{step.why}</p>
                  <small>{step.doneWhen}</small>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="real-workbench-scaffold" aria-label="脚手架提示">
          <div className="real-workbench-section-head">
            <span>Scaffold</span>
            <strong>只推下一步，不替写</strong>
          </div>
          {report.scaffold.map((item) => (
            <article key={item.title}>
              <Sparkles size={17} />
              <div>
                <strong>{item.title}</strong>
                <p>{item.prompt}</p>
                <small>{item.boundary}</small>
              </div>
            </article>
          ))}
        </section>

        <section className="real-workbench-evidence" aria-label="证据来源">
          <div className="real-workbench-section-head">
            <span>Evidence</span>
            <strong>可追溯证据</strong>
          </div>
          {report.evidence.map((item) => (
            <article key={item.source}>
              <FileText size={17} />
              <div>
                <strong>{item.source}</strong>
                <p>{item.snippet}</p>
              </div>
            </article>
          ))}
          {report.missingEvidence.length > 0 ? (
            <div className="real-workbench-missing">
              <ArrowRight size={16} />
              <span>还缺：{report.missingEvidence.join("、")}</span>
            </div>
          ) : null}
        </section>
      </div>
    </section>
  );
}
