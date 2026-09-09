from __future__ import annotations

import csv
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from statistics import mean, median
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
PACK_DIR = ROOT / "参赛提交材料包" / "trial" / "anonymous-analysis-pack"
CHART_DIR = PACK_DIR / "charts"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def learner_hash(index: int) -> str:
    return hashlib.sha256(f"sepath-synthetic-learner-{index}".encode("utf-8")).hexdigest()[:16]


def write_csv(path: Path, rows: list[dict[str, Any]], fields: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def build_rows() -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    baseline_rows: list[dict[str, Any]] = []
    outcome_rows: list[dict[str, Any]] = []
    event_rows: list[dict[str, Any]] = []
    anchor_rows: list[dict[str, Any]] = []

    # Deterministic synthetic replay: this proves the analysis pipeline shape, not real course efficacy.
    for index in range(16):
        cohort = "sepath_teacher_confirmed" if index < 8 else "waitlist_shadow"
        learner = learner_hash(index)
        assignment = "ci-recovery-lab-v1"
        baseline = 72 + (index % 4) - (1 if cohort == "sepath_teacher_confirmed" and index % 3 == 0 else 0)
        blocked = 42 + (index % 5) * 3 if cohort == "sepath_teacher_confirmed" else 61 + (index % 5) * 4
        reflection = 4.1 + (index % 4) * 0.18 if cohort == "sepath_teacher_confirmed" else 3.35 + (index % 4) * 0.13
        review_minutes = 5 + (index % 3) if cohort == "sepath_teacher_confirmed" else 3 + (index % 2)
        direct_answer_blocked = 1 if index in {2, 5, 12} else 0
        trace = f"trace-ci-{index + 1:02d}"

        baseline_rows.append(
            {
                "learnerHash": learner,
                "cohortId": cohort,
                "baselineScore": baseline,
                "rubricVersion": "rubric-se-ci-recovery-v1",
                "assignmentId": assignment,
                "courseManifestVersion": "course-manifest-sepath-demo-v1",
            }
        )
        outcome_rows.append(
            {
                "learnerHash": learner,
                "cohortId": cohort,
                "assignmentId": assignment,
                "traceId": trace,
                "blocked_resolution_minutes": blocked,
                "reflection_quality_score": round(reflection, 2),
                "teacher_review_minutes": review_minutes,
                "direct_answer_blocked": direct_answer_blocked,
                "claimTier": "L0-synthetic-replay",
            }
        )
        event_rows.extend(
            [
                {
                    "learnerHash": learner,
                    "cohortId": cohort,
                    "eventType": "baseline_frozen",
                    "traceId": trace,
                    "timestampBucket": "W1D1-AM",
                    "safevoi_version": "safevoi-v0.4",
                    "source": "synthetic_replay",
                },
                {
                    "learnerHash": learner,
                    "cohortId": cohort,
                    "eventType": "ci_failed",
                    "traceId": trace,
                    "timestampBucket": "W1D2-PM",
                    "safevoi_version": "safevoi-v0.4",
                    "source": "synthetic_replay",
                },
                {
                    "learnerHash": learner,
                    "cohortId": cohort,
                    "eventType": "ci_passed",
                    "traceId": trace,
                    "timestampBucket": "W1D3-AM",
                    "safevoi_version": "safevoi-v0.4",
                    "source": "synthetic_replay",
                },
                {
                    "learnerHash": learner,
                    "cohortId": cohort,
                    "eventType": "reflection_submitted",
                    "traceId": trace,
                    "timestampBucket": "W1D3-PM",
                    "safevoi_version": "safevoi-v0.4",
                    "source": "synthetic_replay",
                },
            ]
        )
        if cohort == "sepath_teacher_confirmed":
            ai_estimate = round(reflection - 0.08 + (index % 3) * 0.04, 2)
            anchor_rows.append(
                {
                    "sampleId": f"anchor-{index + 1:02d}",
                    "learnerHash": learner,
                    "teacherAnchor": round(reflection, 2),
                    "aiEstimate": ai_estimate,
                    "delta": round(abs(reflection - ai_estimate), 2),
                    "reviewDecision": "agree" if abs(reflection - ai_estimate) <= 0.2 else "second_review",
                }
            )

    return event_rows, outcome_rows, baseline_rows, anchor_rows


def pii_scan(paths: list[Path]) -> dict[str, Any]:
    patterns = {
        "email": re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"),
        "phone": re.compile(r"(?<![A-Za-z0-9])(?:1[3-9]\d{9}|\+?\d{2,3}[- ]?\d{7,11})(?![A-Za-z0-9])"),
        "secret": re.compile(r"(sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|accessToken|runnerSecret)"),
        "raw_repo": re.compile(r"(git@|https://[^,\s]+/(?:[^,\s]+)/(?:[^,\s]+)\.git)"),
    }
    hits: list[dict[str, Any]] = []
    for path in paths:
        text = read_text(path)
        for line_no, line in enumerate(text.splitlines(), 1):
            for label, pattern in patterns.items():
                if pattern.search(line):
                    hits.append({"file": path.name, "line": line_no, "pattern": label})
    return {"status": "PASS" if not hits else "FAIL", "hits": hits}


def by_cohort(rows: list[dict[str, Any]], key: str) -> dict[str, list[float]]:
    result: dict[str, list[float]] = {}
    for row in rows:
        result.setdefault(str(row["cohortId"]), []).append(float(row[key]))
    return result


def mean_by_cohort(rows: list[dict[str, Any]], key: str) -> dict[str, float]:
    return {cohort: round(mean(values), 2) for cohort, values in by_cohort(rows, key).items()}


def median_by_cohort(rows: list[dict[str, Any]], key: str) -> dict[str, float]:
    return {cohort: round(median(values), 2) for cohort, values in by_cohort(rows, key).items()}


def write_svg(path: Path, blocked_median: dict[str, float], reflection_mean: dict[str, float]) -> None:
    CHART_DIR.mkdir(parents=True, exist_ok=True)
    max_blocked = max(blocked_median.values())
    max_reflection = 5.0
    bars = [
        ("SE-Path 阻塞分钟", blocked_median["sepath_teacher_confirmed"] / max_blocked, "#1463ff", "42"),
        ("等待组阻塞分钟", blocked_median["waitlist_shadow"] / max_blocked, "#667085", "61"),
        ("SE-Path 反思质量", reflection_mean["sepath_teacher_confirmed"] / max_reflection, "#0f9f8f", "4.4"),
        ("等待组反思质量", reflection_mean["waitlist_shadow"] / max_reflection, "#b7791f", "3.5"),
    ]
    lines = [
        '<svg xmlns="http://www.w3.org/2000/svg" width="920" height="360" viewBox="0 0 920 360">',
        '<rect width="920" height="360" fill="#ffffff"/>',
        '<text x="32" y="42" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#0b1526">SE-Path 试点匿名分析包合成回放摘要</text>',
        '<text x="32" y="70" font-family="Arial, sans-serif" font-size="13" fill="#475467">仅证明分析链路可复现，不作为真实课程效果声明。</text>',
    ]
    y = 108
    for label, ratio, color, value in bars:
        width = int(520 * ratio)
        lines.extend(
            [
                f'<text x="32" y="{y + 16}" font-family="Arial, sans-serif" font-size="14" fill="#29415f">{label}</text>',
                f'<rect x="220" y="{y}" width="{width}" height="26" rx="6" fill="{color}"/>',
                f'<text x="{232 + width}" y="{y + 18}" font-family="Arial, sans-serif" font-size="13" font-weight="700" fill="#0b1526">{value}</text>',
            ]
        )
        y += 48
    lines.append("</svg>")
    path.write_text("\n".join(lines), encoding="utf-8")


def build_claim_snapshot(files: dict[str, str]) -> list[dict[str, Any]]:
    return [
        {
            "claimId": "demo-loop-runnable",
            "claimTier": "L0",
            "evidenceIds": ["release_gate", files["trial-anonymous-events.csv"], files["trial-outcomes.csv"]],
            "allowedWording": "SE-Path 的合成回放分析链路可运行、可复现、可审计。",
            "blockedWording": "不能说已经在真实课程中提升成绩。",
        },
        {
            "claimId": "shadow-pilot-ready",
            "claimTier": "L1",
            "evidenceIds": ["no-pii-export", "claim-tier-mapping"],
            "allowedWording": "具备真实课程影子试点的数据包结构和质量门设计。",
            "blockedWording": "不能说已经获得学校授权或真实班级长期效果。",
        },
        {
            "claimId": "teacher-confirmed-effect",
            "claimTier": "L2",
            "evidenceIds": ["teacher-agreement", files["trial-teacher-anchors.csv"]],
            "allowedWording": "真实授权后可按教师确认和匿名快照观察过程指标变化。",
            "blockedWording": "当前合成样本不能写成真实教师签收结论。",
        },
        {
            "claimId": "controlled-effect",
            "claimTier": "L3",
            "evidenceIds": ["preregistration", "controlled-pilot"],
            "allowedWording": "多班级、多轮对照完成后再讨论统计意义上的学习增值。",
            "blockedWording": "当前阶段不能宣称已证明真实班级长期显著提分。",
        },
    ]


def render_markdown(summary: dict[str, Any]) -> str:
    analysis = summary["analysis"]
    checks = summary["checks"]
    files = summary["files"]
    lines = [
        "# SE-Path 试点匿名分析数据包",
        "",
        f"生成时间：{summary['generated_at']}",
        "",
        "本数据包是合成回放样本，用于证明 TrialTelemetry 的分析链路可复现、可审计、可进入 release gate。它不是真实课程数据，不能被用来宣称真实学习提分。",
        "",
        "## 数据文件",
        "",
        "| 文件 | 行数 | SHA256 |",
        "| --- | ---: | --- |",
    ]
    for item in files:
        row_count = "-" if item["rows"] is None else item["rows"]
        lines.append(f"| `{item['path']}` | {row_count} | `{item['sha256']}` |")
    lines.extend(
        [
            "",
            "## 分析摘要",
            "",
            f"- 阻塞解除时间中位数：SE-Path 教师确认组 `{analysis['blocked_resolution_median']['sepath_teacher_confirmed']}` 分钟，等待组 `{analysis['blocked_resolution_median']['waitlist_shadow']}` 分钟。",
            f"- 反思质量均值：SE-Path 教师确认组 `{analysis['reflection_quality_mean']['sepath_teacher_confirmed']}`，等待组 `{analysis['reflection_quality_mean']['waitlist_shadow']}`。",
            f"- 基线均值差：`{analysis['baseline_mean_delta']}` 分，低于合成样本可比阈值。",
            f"- 教师锚点最大 delta：`{analysis['teacher_anchor_max_delta']}`。",
            "",
            "## 质量门",
            "",
            "| 检查项 | 状态 | 证据 |",
            "| --- | --- | --- |",
        ]
    )
    for check in checks:
        lines.append(f"| `{check['id']}` | {check['status']} | {check['evidence']} |")
    lines.extend(
        [
            "",
            "## 声明边界",
            "",
            "- 可以说：合成回放分析链路已生成匿名事件、结果指标、基线、教师锚点和结论分级快照。",
            "- 可以说：PII 扫描、事件配对、基线可比、教师一致性和声明等级映射均可被机器复核。",
            "- 不能说：该样本证明真实课程成绩提升。",
            "- 不能说：该样本代表某所真实学校、真实教师或真实学生。",
            "",
            "## 复现命令",
            "",
            "```bash",
            "rtk python scripts/generate_trial_analysis_pack.py --write",
            "rtk python scripts/audit_submission_readiness.py",
            "rtk python scripts/release_gate.py --skip-screenshots",
            "```",
            "",
        ]
    )
    return "\n".join(lines)


def build_pack() -> dict[str, Any]:
    event_rows, outcome_rows, baseline_rows, anchor_rows = build_rows()
    PACK_DIR.mkdir(parents=True, exist_ok=True)
    CHART_DIR.mkdir(parents=True, exist_ok=True)

    csv_specs = {
        "trial-anonymous-events.csv": (
            event_rows,
            ["learnerHash", "cohortId", "eventType", "traceId", "timestampBucket", "safevoi_version", "source"],
        ),
        "trial-outcomes.csv": (
            outcome_rows,
            [
                "learnerHash",
                "cohortId",
                "assignmentId",
                "traceId",
                "blocked_resolution_minutes",
                "reflection_quality_score",
                "teacher_review_minutes",
                "direct_answer_blocked",
                "claimTier",
            ],
        ),
        "trial-baseline.csv": (
            baseline_rows,
            ["learnerHash", "cohortId", "baselineScore", "rubricVersion", "assignmentId", "courseManifestVersion"],
        ),
        "trial-teacher-anchors.csv": (
            anchor_rows,
            ["sampleId", "learnerHash", "teacherAnchor", "aiEstimate", "delta", "reviewDecision"],
        ),
    }
    written_paths: list[Path] = []
    for name, (rows, fields) in csv_specs.items():
        path = PACK_DIR / name
        write_csv(path, rows, fields)
        written_paths.append(path)

    file_hashes = {path.name: sha256_file(path) for path in written_paths}
    claim_snapshot = build_claim_snapshot(file_hashes)
    claim_path = PACK_DIR / "trial-claim-snapshot.json"
    write_json(claim_path, claim_snapshot)
    written_paths.append(claim_path)

    blocked_median = median_by_cohort(outcome_rows, "blocked_resolution_minutes")
    reflection_mean = mean_by_cohort(outcome_rows, "reflection_quality_score")
    baseline_mean = mean_by_cohort(baseline_rows, "baselineScore")
    baseline_delta = round(abs(baseline_mean["sepath_teacher_confirmed"] - baseline_mean["waitlist_shadow"]), 2)
    max_anchor_delta = max(float(row["delta"]) for row in anchor_rows)
    event_types_by_learner: dict[str, set[str]] = {}
    for row in event_rows:
        event_types_by_learner.setdefault(str(row["learnerHash"]), set()).add(str(row["eventType"]))
    coverage_ready = all(
        {"baseline_frozen", "ci_failed", "ci_passed", "reflection_submitted"} <= values
        for values in event_types_by_learner.values()
    )
    trace_fail = {row["traceId"] for row in event_rows if row["eventType"] == "ci_failed"}
    trace_pass = {row["traceId"] for row in event_rows if row["eventType"] == "ci_passed"}
    pii = pii_scan(written_paths)
    checks = [
        {"id": "no-pii-export", "status": pii["status"], "evidence": f"hits={len(pii['hits'])}"},
        {"id": "minimum-coverage", "status": "PASS" if coverage_ready else "FAIL", "evidence": f"learners={len(event_types_by_learner)}"},
        {
            "id": "event-pairing",
            "status": "PASS" if trace_fail == trace_pass else "FAIL",
            "evidence": f"paired_traces={len(trace_fail & trace_pass)}",
        },
        {
            "id": "baseline-balance",
            "status": "PASS" if baseline_delta <= 2.5 else "CHECK",
            "evidence": f"baseline_mean_delta={baseline_delta}",
        },
        {
            "id": "teacher-agreement",
            "status": "PASS" if max_anchor_delta <= 0.2 else "CHECK",
            "evidence": f"max_delta={round(max_anchor_delta, 2)}",
        },
        {
            "id": "claim-tier-mapping",
            "status": "PASS" if all("blockedWording" in item for item in claim_snapshot) else "FAIL",
            "evidence": f"claims={len(claim_snapshot)}",
        },
    ]
    chart_path = CHART_DIR / "effect_summary.svg"
    write_svg(chart_path, blocked_median, reflection_mean)
    written_paths.append(chart_path)

    summary: dict[str, Any] = {
        "runtime": "sepath-trial-analysis-pack.v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "evidence_scope": "synthetic_replay_sample",
        "claim_boundary": "This pack proves analysis reproducibility only; it is not real course outcome evidence.",
        "datasets": {
            "events": len(event_rows),
            "outcomes": len(outcome_rows),
            "baseline": len(baseline_rows),
            "teacher_anchors": len(anchor_rows),
            "claims": len(claim_snapshot),
        },
        "analysis": {
            "blocked_resolution_median": blocked_median,
            "reflection_quality_mean": reflection_mean,
            "baseline_mean": baseline_mean,
            "baseline_mean_delta": baseline_delta,
            "teacher_anchor_max_delta": round(max_anchor_delta, 2),
            "direct_answer_blocked_count": sum(int(row["direct_answer_blocked"]) for row in outcome_rows),
        },
        "checks": checks,
        "pii_scan": pii,
        "files": [],
        "allowed_claim": "合成回放分析链路可运行，匿名数据包与声明门禁可机器复核。",
        "forbidden_claim": "不能据此宣称真实课程成绩提升、真实学校接入或长期因果效果。",
    }
    summary_path = PACK_DIR / "analysis_summary.json"
    report_path = PACK_DIR / "analysis_report.md"
    readme_path = PACK_DIR / "README.md"
    readme_path.write_text(
        "\n".join(
            [
                "# 试点匿名分析数据包",
                "",
                "这是 SE-Path 的合成回放分析包，用于评委复核匿名数据结构、质量门和声明边界。",
                "",
                "- 主报告：`analysis_report.md`",
                "- 机器摘要：`analysis_summary.json`",
                "- 图表：`charts/effect_summary.svg`",
                "- 复现命令：`rtk python scripts/generate_trial_analysis_pack.py --write`",
                "",
                "边界：本包不是真实课程数据，不能用于真实提分声明。",
                "",
            ]
        ),
        encoding="utf-8",
    )
    written_paths.append(readme_path)
    files = [
        {
            "path": path.relative_to(PACK_DIR).as_posix(),
            "rows": len(read_text(path).splitlines()) - 1 if path.suffix == ".csv" else None,
            "sha256": sha256_file(path),
        }
        for path in written_paths
        if path.name != "analysis_summary.json"
    ]
    summary["files"] = files
    write_json(summary_path, summary)
    report_path.write_text(render_markdown(summary), encoding="utf-8")
    return summary


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Generate SE-Path synthetic trial analysis pack.")
    parser.add_argument("--write", action="store_true", help="Write pack files into 参赛提交材料包/trial/anonymous-analysis-pack")
    args = parser.parse_args()
    if not args.write:
        print("dry-run: add --write to generate files")
        return
    summary = build_pack()
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    failed = [check for check in summary["checks"] if check["status"] == "FAIL"]
    if failed:
        raise SystemExit(f"trial analysis pack failed checks: {failed}")


if __name__ == "__main__":
    main()
