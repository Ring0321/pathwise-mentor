import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileCheck2,
  Film,
  ListChecks,
  MonitorPlay,
  Route,
  ShieldCheck,
  Timer,
  Video,
} from "lucide-react";
import type { PitchDirectorReport, PitchDirectorStatus } from "../engine/pitchDirector";

interface PitchDirectorPanelProps {
  report: PitchDirectorReport;
}

const statusLabels: Record<PitchDirectorStatus, string> = {
  ready: "就绪",
  watch: "观察",
  manual: "人工",
  blocked: "阻断",
};

const ownerLabels: Record<string, string> = {
  team: "参赛队",
  ops: "工程",
  teacher: "教师",
  director: "导演",
  organizer: "主办方",
};

function StatusIcon({ status }: { status: PitchDirectorStatus }) {
  if (status === "ready") return <CheckCircle2 size={17} />;
  if (status === "blocked") return <AlertTriangle size={17} />;
  if (status === "watch") return <Route size={17} />;
  return <ClipboardCheck size={17} />;
}

function downloadManifest(report: PitchDirectorReport) {
  const blob = new Blob([report.recordingManifest], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "sepath-pitch-director-manifest.json";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function PitchDirectorPanel({ report }: PitchDirectorPanelProps) {
  return (
    <section className="panel pitch-panel" id="pitch-director">
      <div className="panel-heading">
        <h2>视频与路演导演</h2>
        <span>把 3-5 分钟演示、旁白、评分证据、提交素材和答辩口径整理成可执行镜头表</span>
      </div>

      <div className="pitch-hero">
        <article>
          <Film size={24} />
          <div>
            <strong>{report.stage}</strong>
            <p>{report.summary}</p>
          </div>
        </article>
        <div className="pitch-score">
          <span>路演就绪度</span>
          <strong>{report.score}</strong>
        </div>
        <div className="pitch-counts">
          <span>
            <b>{report.readyCount}</b> ready
          </span>
          <span>
            <b>{report.watchCount}</b> watch
          </span>
          <span>
            <b>{report.manualCount}</b> manual
          </span>
          <span>
            <b>{report.blockedCount}</b> block
          </span>
        </div>
      </div>

      <div className="pitch-metrics">
        {report.metrics.map((metric) => (
          <div className={`pitch-card ${metric.status}`} key={metric.id}>
            <span>{statusLabels[metric.status]}</span>
            <strong>{metric.label}</strong>
            <b>{metric.value}</b>
            <p>{metric.target}</p>
          </div>
        ))}
      </div>

      <div className="pitch-note">
        <Timer size={17} />
        <strong>{report.targetVideoName}</strong>
        <span>{report.durationSeconds} 秒</span>
        <code>{report.finalVideoPath}</code>
      </div>

      <div className="pitch-grid">
        <article>
          <div className="ops-heading">
            <Video size={18} />
            <strong>评分项驱动镜头表</strong>
          </div>
          <div className="pitch-segments">
            {report.segments.map((segment) => (
              <div className={`pitch-segment ${segment.status}`} key={segment.id}>
                <StatusIcon status={segment.status} />
                <div>
                  <div className="pitch-segment-head">
                    <strong>{segment.title}</strong>
                    <span>{segment.timeRange}</span>
                  </div>
                  <p>{segment.voiceover}</p>
                  <dl>
                    <div>
                      <dt>锚点</dt>
                      <dd>{segment.anchor}</dd>
                    </div>
                    <div>
                      <dt>评分项</dt>
                      <dd>{segment.scoringFocus}</dd>
                    </div>
                    <div>
                      <dt>证据画面</dt>
                      <dd>{segment.screenProof}</dd>
                    </div>
                  </dl>
                  <small>{segment.transitionCue}</small>
                  <em>{segment.riskBoundary}</em>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <ListChecks size={18} />
            <strong>旁白与录制终检</strong>
          </div>
          <div className="pitch-checklist">
            {report.voiceoverChecklist.map((item) => (
              <div className={`pitch-card ${item.status}`} key={item.id}>
                <span>{ownerLabels[item.owner]} / {statusLabels[item.status]}</span>
                <strong>{item.label}</strong>
                <p>{item.evidence}</p>
                <small>{item.nextAction}</small>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="pitch-grid lower">
        <article>
          <div className="ops-heading">
            <FileCheck2 size={18} />
            <strong>评分覆盖矩阵</strong>
          </div>
          <div className="pitch-coverage">
            {report.shotCoverage.map((item) => (
              <div className={`pitch-card ${item.status}`} key={item.id}>
                <span>{item.weight} / {statusLabels[item.status]}</span>
                <strong>{item.criterion}</strong>
                <p>{item.proof}</p>
                <small>{item.judgeTakeaway}</small>
                <div className="pitch-tags">
                  {item.segments.map((segment) => (
                    <code key={segment}>{segment}</code>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <MonitorPlay size={18} />
            <strong>录制路线与兜底</strong>
          </div>
          <div className="pitch-routes">
            {report.recordingRoutes.map((route) => (
              <div className={`pitch-card ${route.status}`} key={route.id}>
                <span>{statusLabels[route.status]}</span>
                <strong>{route.label}</strong>
                <code>{route.command}</code>
                <p>{route.output}</p>
                <small>{route.fallback}</small>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="pitch-grid lower">
        <article>
          <div className="ops-heading">
            <ShieldCheck size={18} />
            <strong>提交口径风险控制</strong>
          </div>
          <div className="pitch-risks">
            {report.riskControls.map((risk) => (
              <div className={`pitch-card ${risk.status}`} key={risk.id}>
                <span>{statusLabels[risk.status]}</span>
                <strong>{risk.label}</strong>
                <p>{risk.guardrail}</p>
                <small>禁止：{risk.forbiddenLine}</small>
                <em>可说：{risk.safeLine}</em>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="ops-heading">
            <Download size={18} />
            <strong>导出素材包</strong>
          </div>
          <div className="pitch-export">
            {report.exportPack.map((item) => (
              <div className={`pitch-card ${item.status}`} key={item.id}>
                <span>{statusLabels[item.status]}</span>
                <strong>{item.label}</strong>
                <code>{item.path}</code>
                <p>{item.validation}</p>
              </div>
            ))}
          </div>
          <button className="primary-button compact" onClick={() => downloadManifest(report)}>
            <Download size={16} />
            下载路演 Manifest
          </button>
          <pre className="pitch-manifest">{report.recordingManifest}</pre>
        </article>
      </div>
    </section>
  );
}
