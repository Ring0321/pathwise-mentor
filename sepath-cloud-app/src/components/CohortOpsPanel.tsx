import { ClipboardList, Clock3, Send, UsersRound } from "lucide-react";
import type { CohortOpsReport } from "../engine/cohortOps";

interface CohortOpsPanelProps {
  report: CohortOpsReport;
}

const riskLabels = {
  low: "低风险",
  medium: "中风险",
  high: "高风险",
};

const ownerLabels = {
  teacher: "教师",
  assistant: "智能体",
  student: "学生",
};

export function CohortOpsPanel({ report }: CohortOpsPanelProps) {
  return (
    <section className="panel cohort-panel" id="cohort">
      <div className="panel-heading">
        <h2>班级 GrowthOps 运营看板</h2>
        <span>把单个学生闭环升级为班级风险分层、干预队列和教师复盘任务</span>
      </div>

      <div className="cohort-summary">
        <article>
          <UsersRound size={20} />
          <strong>{report.learnerCount}</strong>
          <span>试点学生</span>
        </article>
        <article>
          <ClipboardList size={20} />
          <strong>{report.highRiskCount}</strong>
          <span>高风险</span>
        </article>
        <article>
          <Clock3 size={20} />
          <strong>{report.estimatedTeacherMinutesSaved}</strong>
          <span>分钟节省</span>
        </article>
      </div>

      <p className="cohort-intro">{report.summary}</p>

      <div className="cohort-grid">
        <div className="learner-stack">
          {report.learners.map((learner) => (
            <article className={`learner-ops-card ${learner.risk}`} key={learner.id}>
              <div className="learner-ops-top">
                <strong>{learner.name}</strong>
                <span>{riskLabels[learner.risk]}</span>
              </div>
              <p>{learner.group}</p>
              <b>{learner.blocker}</b>
              <div className="learner-bars">
                <label>
                  证据 {Math.round(learner.evidenceCoverage * 100)}%
                  <span>
                    <i style={{ width: `${learner.evidenceCoverage * 100}%` }} />
                  </span>
                </label>
                <label>
                  路径 {Math.round(learner.pathProgress * 100)}%
                  <span>
                    <i style={{ width: `${learner.pathProgress * 100}%` }} />
                  </span>
                </label>
              </div>
            </article>
          ))}
        </div>

        <div className="growthops-stack">
          <article>
            <div className="ops-heading">
              <ClipboardList size={18} />
              <strong>干预队列</strong>
            </div>
            <div className="ops-action-list">
              {report.actions.map((action) => (
                <div key={action.id}>
                  <span>{action.priority}</span>
                  <strong>{action.label}</strong>
                  <p>
                    {ownerLabels[action.owner]}负责，{action.due}。{action.reason}
                  </p>
                </div>
              ))}
            </div>
          </article>

          <article>
            <div className="ops-heading">
              <Send size={18} />
              <strong>飞书同步预览</strong>
            </div>
            <div className="feishu-preview">
              {report.feishuSyncPreview.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

