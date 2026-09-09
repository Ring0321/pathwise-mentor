import { type FormEvent, useMemo, useState } from "react";
import { MessageSquareText, PlusCircle, SendHorizontal, ShieldCheck } from "lucide-react";
import {
  analyzeStudentDialoguePrompt,
  type StudentDialogueReport,
  type StudentDialogueTurn,
} from "../engine/studentDialogue";

interface StudentDialoguePanelProps {
  report: StudentDialogueReport;
  onCommitTurn: (turn: StudentDialogueTurn) => void;
}

const statusText = {
  pass: "通过",
  watch: "观察",
  block: "拦截",
};

export function StudentDialoguePanel({ report, onCommitTurn }: StudentDialoguePanelProps) {
  const [prompt, setPrompt] = useState(report.defaultPrompt);
  const [submittedPrompt, setSubmittedPrompt] = useState(report.defaultPrompt);
  const [notice, setNotice] = useState("");

  const turn = useMemo(
    () => analyzeStudentDialoguePrompt(submittedPrompt, report),
    [report, submittedPrompt],
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedPrompt(prompt);
    setNotice("");
  }

  function commitTurn() {
    onCommitTurn(turn);
    setNotice("已写入 EvidenceEvent：学生对话 + 系统脚手架");
  }

  return (
    <section className="panel student-dialogue-panel" id="dialogue">
      <div className="panel-heading">
        <h2>学生对话实验台</h2>
        <span>把自然语言求助转成意图识别、知识边界、脚手架回复和证据写回</span>
      </div>

      <div className="dialogue-layout">
        <div className="dialogue-composer">
          <div className="dialogue-score">
            <MessageSquareText size={22} />
            <div>
              <span>对话闭环就绪度</span>
              <strong>{report.readinessScore}</strong>
            </div>
          </div>
          <form onSubmit={submit}>
            <label>
              学生输入
              <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={4} />
            </label>
            <div className="dialogue-template-row" aria-label="对话模板">
              {report.templates.map((template) => (
                <button
                  className="ghost-button compact"
                  type="button"
                  key={template.id}
                  onClick={() => {
                    setPrompt(template.prompt);
                    setSubmittedPrompt(template.prompt);
                    setNotice("");
                  }}
                >
                  {template.label}
                </button>
              ))}
            </div>
            <div className="dialogue-actions">
              <button className="primary-button compact" type="submit">
                <SendHorizontal size={17} />
                分析对话
              </button>
              <button className="ghost-button compact" type="button" onClick={commitTurn}>
                <PlusCircle size={17} />
                写入证据账本
              </button>
            </div>
            {notice ? <p className="dialogue-notice">{notice}</p> : null}
          </form>
        </div>

        <article className={`dialogue-turn-card ${turn.risk}`}>
          <div className="dialogue-turn-head">
            <div>
              <span>{turn.responseMode}</span>
              <strong>{turn.intent}</strong>
            </div>
            <b>{turn.teacherReviewRequired ? "教师复核" : "可推送"}</b>
          </div>
          <p>{turn.assistantMessage}</p>
          <div className="dialogue-reasons">
            {turn.reasonCodes.map((code) => (
              <span key={code}>{code}</span>
            ))}
          </div>
          <div className="dialogue-action-grid">
            <div>
              <h3>微行动</h3>
              <ol>
                {turn.microActions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </div>
            <div>
              <h3>追问</h3>
              <ol>
                {turn.followUpQuestions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </div>
          </div>
        </article>
      </div>

      <div className="dialogue-lower-grid">
        <article>
          <h3>知识与证据引用</h3>
          <div className="dialogue-citations">
            {turn.knowledgeCitations.map((title) => (
              <span key={title}>{title}</span>
            ))}
          </div>
        </article>
        <article>
          <h3>提示词契约</h3>
          <ul>
            {report.promptContract.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
        <article>
          <h3>发布策略</h3>
          <div className="dialogue-policy-list">
            {report.policyCards.map((card) => (
              <div className={`dialogue-policy ${card.status}`} key={card.id}>
                <ShieldCheck size={17} />
                <div>
                  <strong>{card.label}</strong>
                  <span>{card.evidence}</span>
                </div>
                <b>{statusText[card.status]}</b>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
