import {
  CheckCircle2,
  CircleDashed,
  ClipboardCheck,
  Code2,
  Download,
  FastForward,
  FileCheck2,
  FileText,
  Lightbulb,
  ListChecks,
  LockKeyhole,
  MessageSquare,
  Play,
  Send,
  ShieldCheck,
} from "lucide-react";
import type { ClosedLoopDemoReport, ClosedLoopStepStatus } from "../engine/closedLoopDemo";

interface ClosedLoopDemoPanelProps {
  claimLedgerReviewedAt: string | null;
  ledgerExportedAt: string | null;
  report: ClosedLoopDemoReport;
  submissionCheckedAt: string | null;
  onExportLedger: () => void;
  onReviewClaimLedger: () => void;
  onRunAll: () => void;
  onRunNext: () => void;
  onReset: () => void;
  onSealSubmission: () => void;
}

function statusLabel(status: ClosedLoopStepStatus) {
  if (status === "done") return "已完成";
  if (status === "active") return "处理中";
  return "待处理";
}

function statusIcon(status: ClosedLoopStepStatus) {
  if (status === "done") return <CheckCircle2 size={16} />;
  if (status === "active") return <Play size={16} />;
  return <CircleDashed size={16} />;
}

function shortStepLabel(label: string) {
  return label.split("：")[0] || label;
}

function stepSubcopy(label: string) {
  if (label.includes("学情诊断")) return "定位问题";
  if (label.includes("安全门禁")) return "安全边界";
  if (label.includes("实时干预")) return "推送脚手架";
  if (label.includes("验证修复")) return "学生自验证";
  if (label.includes("教师复核")) return "确认发布";
  if (label.includes("记忆反思")) return "闭环沉淀";
  return "等待推进";
}

export function ClosedLoopDemoPanel({
  claimLedgerReviewedAt,
  ledgerExportedAt,
  report,
  submissionCheckedAt,
  onExportLedger,
  onReviewClaimLedger,
  onRunAll,
  onRunNext,
  onReset,
  onSealSubmission,
}: ClosedLoopDemoPanelProps) {
  const isClosed = report.status === "closed";
  const ledgerExported = Boolean(ledgerExportedAt);
  const claimLedgerReviewed = Boolean(claimLedgerReviewedAt);
  const submissionChecked = Boolean(submissionCheckedAt);
  const submissionReady = ledgerExported && claimLedgerReviewed && submissionChecked;
  const readyChecks = report.checks.filter((check) => check.status === "ready");
  const currentStep = report.nextStep ?? report.steps.find((step) => step.status === "active") ?? report.steps[report.steps.length - 1];
  const currentStageName = isClosed ? "闭环已完成" : shortStepLabel(currentStep?.label ?? "等待推进");
  const reviewChecks = [
    "建议在安全边界内",
    "证据充分可靠",
    "下一步清晰可执行",
  ];
  const evidenceItems = [
    { icon: <FileText size={18} />, label: "失败日志（CI）", count: "1 条" },
    { icon: <Code2 size={18} />, label: "PR 变更摘要", count: "1 条" },
    { icon: <ListChecks size={18} />, label: "测试覆盖片段", count: "1 条" },
  ];
  const acceptanceItems = [
    { label: "可复核", value: `${report.eventCount} 条事件`, note: "PR / CI / 对话 / 反思已入账" },
    { label: "可发布", value: "教师门禁", note: "复核通过后再发布给学生" },
    { label: "可迁移", value: "长期记忆", note: "沉淀到下一次路径规划" },
  ];
  const reviewerPackItems = [
    {
      label: "闭环结果",
      value: `${report.completedSteps}/${report.totalSteps}`,
      note: isClosed ? "六步处理链已完成" : "先跑完整闭环",
      ready: isClosed,
    },
    {
      label: "证据账本",
      value: ledgerExported ? "已导出" : "待导出",
      note: ledgerExported ? `导出回执 ${ledgerExportedAt}` : "点击导出证据账本",
      ready: ledgerExported,
    },
    {
      label: "提交证明",
      value: ledgerExported ? "可封存" : "待生成",
      note: ledgerExported ? "可进入主张账本核验" : "导出后生成验收包状态",
      ready: isClosed && ledgerExported,
    },
  ];
  const submissionChainItems = [
    {
      label: "评委验收包",
      value: ledgerExported ? "ready" : "waiting",
      note: ledgerExported ? `账本回执 ${ledgerExportedAt}` : "先导出证据账本",
      ready: ledgerExported,
    },
    {
      label: "主张账本核验",
      value: claimLedgerReviewed ? "checked" : "pending",
      note: claimLedgerReviewed ? `核验回执 ${claimLedgerReviewedAt}` : "核对 L0-L3 声明边界",
      ready: claimLedgerReviewed,
    },
    {
      label: "提交收口",
      value: submissionChecked ? "sealed" : "pending",
      note: submissionChecked ? `收口回执 ${submissionCheckedAt}` : "生成提交前检查回执",
      ready: submissionChecked,
    },
  ];

  return (
    <section
      className="panel closed-loop-console focus-loop-page"
      data-closed-loop-status={report.status}
      data-closed-loop-progress={report.progress}
      id="closed-loop"
    >
      <ol className="focus-flow-rail" aria-label="闭环阶段">
        {report.steps.map((step, index) => (
          <li className={`focus-flow-step ${step.status}`} data-closed-loop-step={step.status} key={step.id}>
            <a href={step.anchor} aria-label={`查看 ${step.label} 对应产品区域`}>
              <span className="focus-flow-index">{step.status === "done" ? <CheckCircle2 size={14} /> : index + 1}</span>
              <strong>{shortStepLabel(step.label)}</strong>
              <small>{stepSubcopy(step.label)}</small>
            </a>
          </li>
        ))}
      </ol>

      <div className="focus-case-shell">
        <div className="focus-case-toolbar" aria-label="当前闭环演示状态">
          <span>LIVE LOOP</span>
          <strong>{isClosed ? "证据链已闭合，等待课程复盘归档" : `当前：${currentStageName}`}</strong>
          <small>{report.completedSteps}/{report.totalSteps} 阶段 · {report.eventCount} 条证据事件 · 教师复核后发布</small>
        </div>
        <header className="focus-case-header">
          <div className="focus-learner-avatar" aria-hidden="true">林</div>
          <div className="focus-case-title">
            <h1>林知行</h1>
            <p>REST API 错误处理与边界测试</p>
          </div>
          <dl className="focus-case-facts" aria-label="当前工单摘要">
            <div>
              <dt>PR</dt>
              <dd>#18 CI 失败</dd>
            </div>
            <div>
              <dt>风险</dt>
              <dd><span className="focus-risk">high</span></dd>
            </div>
            <div>
              <dt>证据覆盖</dt>
              <dd>34%</dd>
            </div>
            <div>
              <dt>闭环</dt>
              <dd>{report.completedSteps}/{report.totalSteps}</dd>
            </div>
          </dl>
        </header>

        <div className="focus-case-body">
          <main className="focus-case-main">
            <section className="focus-section">
              <h2>学情诊断</h2>
              <div className="focus-insight-block">
                <ShieldCheck size={32} />
                <div>
                  <strong>测试边界与异常路径建模不足</strong>
                  <p>{currentStep?.label ?? "闭环已完成"}。系统只把失败现象转成验收条件和测试清单，不直接替学生写完整答案。</p>
                </div>
              </div>
            </section>

            <section className="focus-section">
              <h2>AI 处理建议（安全边界内）</h2>
              <div className="focus-insight-block muted">
                <Lightbulb size={32} />
                <div>
                  <strong>{isClosed ? "进入教师复核后归档" : "先完成异常路径检查清单，再提交修复 PR。"}</strong>
                  <p>{isClosed ? "证据链已经可导出，适合进入课程复盘。" : "仅推荐安全操作，不改动学生代码或仓库权限。"}</p>
                </div>
              </div>
            </section>

            <section className="focus-section">
              <h2>关键证据（3）</h2>
              <div className="focus-evidence-strip" aria-label="关键证据预览">
                {evidenceItems.map((item) => (
                  <article key={item.label}>
                    {item.icon}
                    <div>
                      <strong>{item.label}</strong>
                      <span>{item.count}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            {isClosed ? (
              <section className="focus-section focus-acceptance-section" aria-label="闭环验收结果">
                <h2>闭环验收结果</h2>
                <div className="focus-acceptance-card">
                  <ClipboardCheck size={34} />
                  <div>
                    <span>ACCEPTED</span>
                    <strong>失败 PR 已转化为可复核学习证据链</strong>
                    <p>系统完成诊断、门禁、干预、验证、教师复核与反思沉淀；建议进入课程复盘和证据账本归档。</p>
                  </div>
                </div>
                <div className="focus-acceptance-grid">
                  {acceptanceItems.map((item) => (
                    <article key={item.label}>
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                      <p>{item.note}</p>
                    </article>
                  ))}
                </div>
                <div
                  className={`focus-reviewer-pack ${ledgerExported ? "ready" : "waiting"}`}
                  data-reviewer-pack-status={ledgerExported ? "ready" : "waiting-export"}
                >
                  <div className="focus-reviewer-pack-head">
                    <span>JUDGE PACK</span>
                    <strong>{ledgerExported ? "评委验收包已就绪" : "评委验收包待导出账本"}</strong>
                    <p>把闭环结果、证据账本和提交证明合成一条可复查交付链，方便现场演示后直接进入参赛材料核验。</p>
                  </div>
                  <ol className="focus-reviewer-pack-list" aria-label="评委验收包状态">
                    {reviewerPackItems.map((item) => (
                      <li className={item.ready ? "ready" : "waiting"} key={item.label}>
                        <CheckCircle2 size={17} />
                        <div>
                          <span>{item.label}</span>
                          <strong>{item.value}</strong>
                          <p>{item.note}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                  <div className="focus-reviewer-pack-actions">
                    {ledgerExported ? (
                      <span className="focus-pack-receipt">回执已生成 · {ledgerExportedAt}</span>
                    ) : (
                      <button className="ghost-button compact" data-export-ledger-pack onClick={onExportLedger} type="button">
                        <Download size={16} />
                        导出账本生成回执
                      </button>
                    )}
                    <a className="ghost-button compact" href="#claim-ledger">
                      <FileText size={16} />
                      核对主张账本
                    </a>
                  </div>
                </div>
                <div
                  className={`focus-submission-chain ${submissionReady ? "ready" : "waiting"}`}
                  data-submission-chain-status={submissionReady ? "ready" : "waiting"}
                >
                  <div className="focus-submission-chain-head">
                    <span>SUBMISSION CHAIN</span>
                    <strong>{submissionReady ? "提交收口链已封存" : "继续完成提交收口链"}</strong>
                    <p>把演示结果和参赛主张对齐，避免“能演示”但提交材料里证据口径对不上。</p>
                  </div>
                  <ol className="focus-submission-chain-list" aria-label="提交收口链状态">
                    {submissionChainItems.map((item) => (
                      <li className={item.ready ? "ready" : "waiting"} key={item.label}>
                        <CheckCircle2 size={16} />
                        <div>
                          <span>{item.label}</span>
                          <strong>{item.value}</strong>
                          <p>{item.note}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                  <div className="focus-submission-chain-actions">
                    <button className="ghost-button compact" disabled={!ledgerExported} onClick={onReviewClaimLedger} type="button">
                      <FileCheck2 size={16} />
                      {claimLedgerReviewed ? "主张账本已核对" : "标记主张账本核验"}
                    </button>
                    <button
                      className="primary-button compact"
                      disabled={!ledgerExported || !claimLedgerReviewed}
                      onClick={onSealSubmission}
                      type="button"
                    >
                      <Send size={16} />
                      {submissionChecked ? "提交收口已封存" : "生成提交收口回执"}
                    </button>
                    <a className="ghost-button compact" href="#submission-closure">
                      <FileText size={16} />
                      查看提交收口
                    </a>
                  </div>
                </div>
              </section>
            ) : null}
          </main>

          <aside className="focus-decision-panel" aria-label="教师决策">
            <h2>教师决策</h2>
            <div className="focus-decision-meter" aria-label="闭环进度">
              <div>
                <span>闭环进度</span>
                <strong>{report.progress}%</strong>
              </div>
              <i aria-hidden="true"><b style={{ width: `${report.progress}%` }} /></i>
              <small>{isClosed ? "证据账本已可导出" : "只推进可解释、可回滚的下一步"}</small>
            </div>
            <div className="focus-review-checks" aria-label="发布前检查">
              {reviewChecks.map((check, index) => (
                <article className="closed-loop-check ready" key={check}>
                  <CheckCircle2 size={20} />
                  <strong>{check}</strong>
                  <span>{index < readyChecks.length ? "已确认" : "待确认"}</span>
                </article>
              ))}
            </div>
            <div className="closed-loop-machine-checks" hidden aria-hidden="true">
              {report.checks.slice(reviewChecks.length).map((check) => (
                <span className={`closed-loop-check ${check.status}`} key={check.id}>
                  {check.label}
                </span>
              ))}
            </div>

            <div className="closed-loop-actions focus-actions">
              <button className="primary-button closed-loop-next" disabled={isClosed} onClick={onRunNext} type="button">
                <Play size={18} />
                处理下一步
              </button>
              <button className="ghost-button closed-loop-run-all" disabled={isClosed} onClick={onRunAll} type="button">
                <FastForward size={18} />
                自动推进闭环
              </button>
              <button className="ghost-button" data-export-ledger onClick={onExportLedger} type="button">
                <Download size={18} />
                导出证据账本
              </button>
            </div>

            <div className="focus-publish-note">
              <LockKeyhole size={16} />
              <span>教师复核后发布</span>
            </div>
            <div className="closed-loop-footer">
              <MessageSquare size={18} />
              <p><span data-closed-loop-events>{report.eventCount}</span> 条事件已写入证据账本，避免只有口头结论。</p>
            </div>
            <button className="focus-reset-button" onClick={onReset} type="button">重置演示</button>
          </aside>
        </div>
      </div>
    </section>
  );
}
