import { ChevronLeft, ChevronRight, Clock3, FastForward, MonitorPlay, MousePointer2, X } from "lucide-react";
import type { ReviewerGuideReport } from "../engine/reviewerDrill";

interface ReviewerGuideOverlayProps {
  guide: ReviewerGuideReport;
  active: boolean;
  currentIndex: number;
  onStop: () => void;
  onPrev: () => void;
  onNext: () => void;
  onJump: (index: number) => void;
  onStepAction?: (stepId: string) => void;
}

export function ReviewerGuideOverlay({
  guide,
  active,
  currentIndex,
  onStop,
  onPrev,
  onNext,
  onJump,
  onStepAction,
}: ReviewerGuideOverlayProps) {
  if (!active) {
    return null;
  }

  const displaySteps = guide.quickSteps.length > 0 ? guide.quickSteps : guide.steps;
  const safeIndex = Math.min(Math.max(currentIndex, 0), displaySteps.length - 1);
  const step = displaySteps[safeIndex];
  const isFirst = safeIndex === 0;
  const isLast = safeIndex === displaySteps.length - 1;
  const canRunClosedLoop = step.id === "quick-run-loop" || step.id === "run-loop";

  return (
    <aside className="reviewer-guide-overlay" data-guide-active="true" data-guide-step={step.id}>
      <div className="reviewer-guide-topline">
        <span>
          <MonitorPlay size={17} />
          {guide.modeLabel}
        </span>
        <strong className="reviewer-guide-clock">
          <Clock3 size={15} />
          {guide.quickTotalSeconds || guide.totalSeconds} 秒快讲
        </strong>
        <button aria-label="结束评委导览" className="icon-button" onClick={onStop} type="button">
          <X size={17} />
        </button>
      </div>
      <div className="reviewer-guide-quickbar" aria-label="60秒演示节奏">
        {displaySteps.map((item, index) => (
          <button
            aria-label={item.navLabel}
            className={index === safeIndex ? "active" : index < safeIndex ? "done" : ""}
            key={item.id}
            onClick={() => onJump(index)}
            type="button"
          >
            <span>{item.minute}</span>
            <strong>{item.label}</strong>
          </button>
        ))}
      </div>
      <div className="reviewer-guide-body">
        <div>
          <small>
            {step.minute} / 快讲 {step.stepNumber} / {displaySteps.length}
          </small>
          <strong>{step.label}</strong>
          <p>{step.action}</p>
        </div>
        <div className="reviewer-guide-signal">
          <MousePointer2 size={17} />
          <div>
            <span>{step.expectedSignal}</span>
            <b>{step.quickAction}</b>
          </div>
        </div>
      </div>
      <div className="reviewer-guide-progress" aria-label="评委导览进度">
        <span style={{ width: `${step.progressPercent}%` }} />
      </div>
      <div className="reviewer-guide-steps" aria-label="评委导览步骤">
        {displaySteps.map((item, index) => (
          <button
            aria-label={item.navLabel}
            className={index === safeIndex ? "active" : index < safeIndex ? "done" : ""}
            key={item.id}
            onClick={() => onJump(index)}
            type="button"
          >
            {item.stepNumber}
          </button>
        ))}
      </div>
      <div className="reviewer-guide-footer">
        <code>{step.productAnchor}</code>
        <span>{step.quickAction}</span>
        <div>
          {canRunClosedLoop ? (
            <button className="ghost-button compact reviewer-guide-run-loop" onClick={() => onStepAction?.(step.id)} type="button">
              <FastForward size={16} />
              跑完整闭环
            </button>
          ) : null}
          <button className="ghost-button compact" disabled={isFirst} onClick={onPrev} type="button">
            <ChevronLeft size={16} />
            上一步
          </button>
          <button className="primary-button compact" onClick={isLast ? onStop : onNext} type="button">
            {isLast ? "结束导览" : "下一步"}
            {!isLast && <ChevronRight size={16} />}
          </button>
        </div>
      </div>
    </aside>
  );
}
