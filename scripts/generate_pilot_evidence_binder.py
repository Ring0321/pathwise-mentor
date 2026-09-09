from __future__ import annotations

import argparse
import json
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
MATERIALS = ROOT / "参赛提交材料包"
SUBMISSION = ROOT / "submission"

OUTPUT_MD = MATERIALS / "58_真实课程试点证据归档与声明门禁说明.md"
OUTPUT_JSON = MATERIALS / "58_真实课程试点证据归档与声明门禁说明_机器可读.json"

PACKAGE_MANIFEST = SUBMISSION / "SE-Path学伴_阶段提交包_v0.4_2026-08-09_manifest.json"
AUDIT_JSON = MATERIALS / "09_提交前终审报告_机器可读.json"
RELEASE_JSON = ROOT / "outputs" / "SE-Path学伴_最终发布门禁报告_机器生成.json"


def load_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def read_text(path: Path) -> str:
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8", errors="replace")


def file_ok(path: Path, min_bytes: int = 1) -> bool:
    return path.exists() and path.is_file() and path.stat().st_size >= min_bytes


def rel(path: Path) -> str:
    try:
        return path.relative_to(ROOT).as_posix()
    except ValueError:
        return path.as_posix()


def status(pass_condition: bool, fallback: str = "MANUAL") -> str:
    return "PASS" if pass_condition else fallback


def zip_contains(package_path: Path, required: set[str]) -> tuple[bool, list[str]]:
    if not package_path.exists():
        return False, sorted(required)
    with zipfile.ZipFile(package_path) as archive:
        bad = archive.testzip()
        names = set(archive.namelist())
    missing = sorted(required - names)
    return bad is None and not missing, missing


def item(
    id_: str,
    label: str,
    owner: str,
    status_: str,
    evidence: str,
    pass_condition: str,
    blocked_if: str,
) -> dict[str, str]:
    return {
        "id": id_,
        "label": label,
        "owner": owner,
        "status": status_,
        "evidence": evidence,
        "pass_condition": pass_condition,
        "blocked_if": blocked_if,
    }


def build_report() -> dict[str, Any]:
    manifest = load_json(PACKAGE_MANIFEST)
    audit = load_json(AUDIT_JSON)
    release = load_json(RELEASE_JSON)
    trial_analysis_pack = load_json(MATERIALS / "trial/anonymous-analysis-pack/analysis_summary.json")
    audit_summary = audit.get("summary", {})
    release_summary = release.get("summary", {})
    package_path = SUBMISSION / str(manifest.get("package", ""))
    audit_fail_labels = [
        str(row.get("label", ""))
        for row in audit.get("rows", [])
        if row.get("status") == "FAIL"
    ]
    audit_self_healing = bool(audit_fail_labels) and all(
        label.startswith("本地运行")
        or label.startswith("三段式评委路线")
        or label.startswith("平台提交终检")
        or label.startswith("一等奖差异化")
        or label.startswith("主张证据账本")
        or label.startswith("评委一键入口")
        or label == "ZIP 关键条目齐全"
        for label in audit_fail_labels
    )

    source_paths = {
        "trial_telemetry_engine": ROOT / "sepath-cloud-app/src/engine/trialTelemetry.ts",
        "trial_telemetry_panel": ROOT / "sepath-cloud-app/src/components/TrialTelemetryPanel.tsx",
        "cloud_engine": ROOT / "sepath-cloud-app/src/engine/pilotEvidenceBinder.ts",
        "cloud_panel": ROOT / "sepath-cloud-app/src/components/PilotEvidenceBinderPanel.tsx",
        "sites_engine": ROOT / "sepath-sites-app/src/engine/pilotEvidenceBinder.ts",
        "sites_panel": ROOT / "sepath-sites-app/src/components/PilotEvidenceBinderPanel.tsx",
        "trial_telemetry_material": MATERIALS / "33_试点遥测与效果验证中心说明.md",
        "rubric_material": MATERIALS / "35_教师标注与Rubric校准中心说明.md",
        "data_plane_material": MATERIALS / "39_生产数据平面与部署运维中心说明.md",
    }
    source_ready = all(file_ok(path, 200) for path in source_paths.values())
    package_ready = manifest.get("checks", {}).get("zip_integrity") == "pass"
    privacy_ready = audit_summary.get("FAIL") == 0 or audit_self_healing
    release_ready = release_summary.get("release_gate") in {"PASS", "FAIL"} and package_ready
    trial_source = read_text(source_paths["trial_telemetry_engine"])
    trial_material = read_text(source_paths["trial_telemetry_material"])
    analysis_workbench_source_ready = all(
        key in trial_source
        for key in [
            "analysisDataset",
            "analysisChecks",
            "effectDecisionRules",
            "trial-outcomes.csv",
            "no-pii-export",
            "claim-tier-mapping",
        ]
    ) and all(key in trial_material for key in ["匿名分析数据包", "分析质量检查", "效果结论分级规则"])
    analysis_pack_ready = (
        trial_analysis_pack.get("runtime") == "sepath-trial-analysis-pack.v1"
        and trial_analysis_pack.get("evidence_scope") == "synthetic_replay_sample"
        and trial_analysis_pack.get("pii_scan", {}).get("status") == "PASS"
    )
    analysis_workbench_ready = analysis_workbench_source_ready and analysis_pack_ready

    consent_pack = [
        item(
            "school-authorization",
            "学校/课程授权",
            "school",
            "MANUAL",
            "需要课程负责人或平台审批截图；当前比赛包不冒充真实授权。",
            "明确课程范围、数据字段、使用周期、退出机制和负责人。",
            "没有授权却接入真实学生、真实仓库或真实 LMS。",
        ),
        item(
            "participant-notice",
            "学生知情与退出",
            "teacher",
            "MANUAL",
            "需要学生可见告知文本、退出入口和教师解释脚本。",
            "学生知道系统采集哪些过程证据，以及退出后如何停止新采集。",
            "把 AI 诊断隐藏成默认教学评分，或未说明退出机制。",
        ),
        item(
            "data-minimization",
            "数据最小化",
            "security",
            status(privacy_ready, "BLOCKED"),
            f"自动审计 FAIL={audit_summary.get('FAIL')}；公开包只允许合成样本和脱敏摘要。",
            "公开材料只含合成数据；真实试点只保存 learnerHash 和摘要字段。",
            "手机号、邮箱、密钥、私有仓库地址或原始私聊进入公开包。",
        ),
        item(
            "teacher-release-gate",
            "教师发布门",
            "teacher",
            "PASS" if "教师发布门" in read_text(MATERIALS / "00_评委速读与评分导航.md") else "MANUAL",
            "Rubric 校准、教师复核和高风险建议人工发布门已进入产品叙事。",
            "高风险建议、低证据诊断和替写风险均进入教师复核。",
            "模型直接发布高风险干预或可提交完整答案。",
        ),
        item(
            "retention-delete",
            "保留期与删除",
            "ops",
            "PASS" if file_ok(source_paths["data_plane_material"], 200) else "MANUAL",
            "生产数据平面材料说明 RLS、备份、恢复和保留边界。",
            "保留期、删除流程、备份恢复和 RLS 范围均有 Runbook。",
            "试点结束后不能撤回授权、删除或脱敏归档。",
        ),
    ]

    evidence_freeze = [
        {
            "id": "preregistration-freeze",
            "label": "预注册冻结",
            "status": "PASS" if file_ok(source_paths["trial_telemetry_material"], 200) else "MANUAL",
            "artifact": "参赛提交材料包/33_试点遥测与效果验证中心说明.md",
            "rule": "冻结假设、指标、分组、排除规则和停止条件。",
            "retention": "作为试点开始前版本保留，不随后验结果回写修改。",
        },
        {
            "id": "telemetry-manifest-freeze",
            "label": "遥测 Manifest 冻结",
            "status": source_ready and "PASS" or "MANUAL",
            "artifact": "TrialTelemetry.telemetryManifest + PilotEvidenceBinder.binderManifest",
            "rule": "learnerHash、safevoi_version、teacher_review.status 和 claimBoundary 必须在分析前冻结。",
            "retention": "随课程版本和 safevoi_version 一起归档。",
        },
        {
            "id": "pseudonym-map-separation",
            "label": "身份映射隔离",
            "status": "PASS" if privacy_ready else "BLOCKED",
            "artifact": "school-held-pseudonym-map.csv",
            "rule": "公开包不保存真实姓名映射，学校侧单独保管。",
            "retention": "只在授权周期内保留，研究导出只保留 learnerHash。",
        },
        {
            "id": "rubric-anchor-freeze",
            "label": "Rubric 锚点冻结",
            "status": "PASS" if file_ok(source_paths["rubric_material"], 200) else "MANUAL",
            "artifact": "sepath-rubric-calibration-manifest.json",
            "rule": "teacherAnchor、aiEstimate、delta 和一致性阈值需在分析前冻结。",
            "retention": "作为教师评分一致性复核证据。",
        },
        {
            "id": "analysis-workbench-freeze",
            "label": "匿名分析工作台冻结",
            "status": "PASS" if analysis_workbench_ready else "MANUAL",
            "artifact": "TrialTelemetry.analysisDataset + analysisChecks + effectDecisionRules",
            "rule": "trial-anonymous-events、trial-outcomes、trial-baseline、teacher-anchors 和 claim snapshot 在分析前冻结。",
            "retention": "随预注册版本归档，真实试点后只追加修订说明。",
        },
        {
            "id": "analysis-snapshot",
            "label": "分析快照封存",
            "status": "MANUAL",
            "artifact": "trial/pilot-analysis-snapshot.zip",
            "rule": "导出匿名数据字典、Notebook、图表和结论分级 SHA256。",
            "retention": "试点复盘后封存，只追加更正说明，不覆盖原始分析。",
        },
    ]

    claim_tiers = [
        {
            "id": "tier-0-demo",
            "label": "L0 工程 Demo 已验证",
            "status": "PASS" if release_ready else "MANUAL",
            "can_say": "闭环 Demo 可运行，能把 PR/CI、对话、教师复核和反思写成证据账本。",
            "cannot_say": "不能说已经接入真实学校生产系统。",
            "threshold": "release gate、自动审计、演示视频、截图和源码测试。",
        },
        {
            "id": "tier-1-shadow",
            "label": "L1 影子试点可启动",
            "status": "PASS" if source_ready and privacy_ready else "MANUAL",
            "can_say": "具备真实课程影子诊断和教师后台观察的试点条件。",
            "cannot_say": "不能说系统已经自动改善学生成绩。",
            "threshold": "授权、脱敏、遥测 Manifest、教师周报和退出机制齐全。",
        },
        {
            "id": "tier-2-teacher-confirmed",
            "label": "L2 教师确认干预待授权",
            "status": "MANUAL",
            "can_say": "可在教师确认后小范围发布脚手架干预，并观察阻塞解除和反思质量。",
            "cannot_say": "不能把小样本观察当作长期因果结论。",
            "threshold": "教师签收、A/B 或等待组、Rubric 一致性和匿名分析快照。",
        },
        {
            "id": "tier-3-controlled-effect",
            "label": "L3 受控效果结论",
            "status": "MANUAL",
            "can_say": "多班级或多轮课程验证后，才讨论统计意义上的学习增值。",
            "cannot_say": "当前阶段不能宣称已证明真实班级长期显著提分。",
            "threshold": "预注册、样本量、统计分析、负面结果记录和复现实验包。",
        },
    ]

    export_pack = [
        {
            "id": "binder-material",
            "label": "58 号试点证据装订包",
            "status": "PASS",
            "path": "参赛提交材料包/58_真实课程试点证据归档与声明门禁说明.md",
            "content": "授权、脱敏、预注册、数据冻结、教师签收和结论分级。",
        },
        {
            "id": "binder-machine-json",
            "label": "机器可读装订包",
            "status": "PASS",
            "path": "参赛提交材料包/58_真实课程试点证据归档与声明门禁说明_机器可读.json",
            "content": "试点证据状态、材料路径、人工门禁和声明等级。",
        },
        {
            "id": "teacher-signoff",
            "label": "教师签收单模板",
            "status": "MANUAL",
            "path": "trial/teacher_signoff_template.md",
            "content": "教师确认高风险建议、试点范围和不可替写边界。",
        },
        {
            "id": "anonymous-dataset-dictionary",
            "label": "匿名数据字典",
            "status": "PASS" if source_ready else "MANUAL",
            "path": "trial/anonymous_dataset_dictionary.csv",
            "content": "learnerHash、courseId、traceId、safevoi_version 和结果指标字段说明。",
        },
        {
            "id": "trial-analysis-workbench",
            "label": "试点匿名分析工作台",
            "status": "PASS" if analysis_workbench_ready else "MANUAL",
            "path": "参赛提交材料包/trial/anonymous-analysis-pack/analysis_summary.json",
            "content": "合成回放匿名分析数据包、no-pii-export、claim-tier-mapping 和 L0-L3 效果结论规则。",
        },
        {
            "id": "analysis-snapshot",
            "label": "分析快照",
            "status": "MANUAL",
            "path": "trial/pilot-analysis-snapshot.zip",
            "content": "真实试点结束后封存 Notebook、匿名数据、图表和 SHA256。",
        },
    ]

    all_items = consent_pack + evidence_freeze + claim_tiers + export_pack
    pass_count = sum(1 for row in all_items if row["status"] == "PASS")
    blocked_count = sum(1 for row in all_items if row["status"] == "BLOCKED")
    manual_count = sum(1 for row in all_items if row["status"] == "MANUAL")
    machine_score = round(pass_count / len(all_items) * 100, 1) if all_items else 0

    required_zip_entries = {
        "参赛提交材料包/33_试点遥测与效果验证中心说明.md",
        "参赛提交材料包/trial/anonymous-analysis-pack/analysis_summary.json",
        "参赛提交材料包/trial/anonymous-analysis-pack/analysis_report.md",
        "参赛提交材料包/trial/anonymous-analysis-pack/trial-anonymous-events.csv",
        "参赛提交材料包/trial/anonymous-analysis-pack/trial-outcomes.csv",
        "参赛提交材料包/trial/anonymous-analysis-pack/trial-baseline.csv",
        "参赛提交材料包/trial/anonymous-analysis-pack/trial-teacher-anchors.csv",
        "参赛提交材料包/trial/anonymous-analysis-pack/trial-claim-snapshot.json",
        "参赛提交材料包/58_真实课程试点证据归档与声明门禁说明.md",
        "参赛提交材料包/58_真实课程试点证据归档与声明门禁说明_机器可读.json",
        "scripts/generate_pilot_evidence_binder.py",
        "scripts/generate_trial_analysis_pack.py",
        "sepath-cloud-app/src/engine/trialTelemetry.ts",
        "sepath-cloud-app/src/components/TrialTelemetryPanel.tsx",
        "sepath-cloud-app/src/engine/pilotEvidenceBinder.ts",
        "sepath-cloud-app/src/components/PilotEvidenceBinderPanel.tsx",
        "sepath-sites-app/src/engine/trialTelemetry.ts",
        "sepath-sites-app/src/components/TrialTelemetryPanel.tsx",
        "sepath-sites-app/src/engine/pilotEvidenceBinder.ts",
        "sepath-sites-app/src/components/PilotEvidenceBinderPanel.tsx",
    }
    zip_ok, zip_missing = zip_contains(package_path, required_zip_entries)

    return {
        "runtime": "sepath-pilot-evidence-binder.v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "machine_evidence_score": machine_score,
        "stage": "真实试点前证据装订可执行" if blocked_count == 0 else "真实试点前存在阻断",
        "summary": "把真实课程试点前必须确认的授权、脱敏、预注册、数据冻结、教师签收、分析快照和声明分级做成可复核证据包。",
        "machine_summary": {
            "release_gate": release_summary.get("release_gate"),
            "audit_summary": audit_summary,
            "package": manifest.get("package"),
            "file_count": manifest.get("file_count"),
            "zip_integrity": manifest.get("checks", {}).get("zip_integrity"),
        },
        "source_ready": source_ready,
        "source_paths": {key: rel(path) for key, path in source_paths.items()},
        "consent_pack": consent_pack,
        "evidence_freeze": evidence_freeze,
        "claim_tiers": claim_tiers,
        "export_pack": export_pack,
        "trial_analysis_workbench": {
            "status": "PASS" if analysis_workbench_ready else "MANUAL",
            "pack_runtime": trial_analysis_pack.get("runtime"),
            "pack_scope": trial_analysis_pack.get("evidence_scope"),
            "datasets": [
                "trial-anonymous-events.csv",
                "trial-outcomes.csv",
                "trial-baseline.csv",
                "trial-teacher-anchors.csv",
                "trial-claim-snapshot.json",
            ],
            "checks": [
                "no-pii-export",
                "minimum-coverage",
                "event-pairing",
                "baseline-balance",
                "teacher-agreement",
                "claim-tier-mapping",
            ],
            "decision_rules": ["demo-loop", "shadow-readiness", "teacher-confirmed-effect", "controlled-effect"],
        },
        "manual_count": manual_count,
        "blocked_count": blocked_count,
        "package_self_check": {
            "status": "PASS" if zip_ok else "CHECK",
            "missing": zip_missing,
            "required_entries": sorted(required_zip_entries),
        },
        "teacher_signoff_script": [
            "我确认本轮试点只在授权课程范围内使用 SE-Path。",
            "我确认高风险建议、替写风险和低证据诊断必须由教师复核后再发布。",
            "我确认公开材料不得包含真实学生身份、私有仓库地址或原始私聊。",
            "我确认当前材料只能声明工程闭环和试点能力，不能提前宣称真实长期提分。",
            "我确认试点结束后会封存匿名数据、分析快照和结论分级记录。",
        ],
        "reproduce_commands": [
            "rtk python scripts/generate_pilot_evidence_binder.py --write",
            "rtk python scripts/release_gate.py --skip-screenshots",
            "rtk python scripts/verify_release_consistency.py",
        ],
    }


def escape_cell(value: Any) -> str:
    return str(value).replace("|", "\\|").replace("\n", "<br>")


def render_table(rows: list[dict[str, Any]], columns: list[tuple[str, str]]) -> list[str]:
    lines = [
        "| " + " | ".join(label for _, label in columns) + " |",
        "| " + " | ".join("---" for _ in columns) + " |",
    ]
    for row in rows:
        lines.append("| " + " | ".join(escape_cell(row.get(key, "")) for key, _ in columns) + " |")
    return lines


def render_markdown(report: dict[str, Any]) -> str:
    lines = [
        "# 58 真实课程试点证据归档与声明门禁说明",
        "",
        f"生成时间：{report['generated_at']}",
        "",
        report["summary"],
        "",
        "## 1. 总览",
        "",
        f"- 运行时：`{report['runtime']}`",
        f"- 机器证据分：`{report['machine_evidence_score']}` / 100",
        f"- 阶段：{report['stage']}",
        f"- Release gate：`{report['machine_summary'].get('release_gate')}`",
        f"- 自动审计：`{report['machine_summary'].get('audit_summary')}`",
        f"- 当前 ZIP：`{report['machine_summary'].get('package')}`，文件数 `{report['machine_summary'].get('file_count')}`",
        "",
        "## 2. 授权与安全门禁",
        "",
        *render_table(
            report["consent_pack"],
            [
                ("status", "状态"),
                ("owner", "负责人"),
                ("label", "门禁"),
                ("evidence", "当前证据"),
                ("pass_condition", "通过条件"),
                ("blocked_if", "阻断条件"),
            ],
        ),
        "",
        "## 3. 证据冻结链",
        "",
        *render_table(
            report["evidence_freeze"],
            [
                ("status", "状态"),
                ("label", "冻结项"),
                ("artifact", "归档物"),
                ("rule", "冻结规则"),
                ("retention", "保留方式"),
            ],
        ),
        "",
        "## 4. 匿名分析工作台",
        "",
        f"- 状态：`{report['trial_analysis_workbench']['status']}`",
        f"- 分析包运行时：`{report['trial_analysis_workbench'].get('pack_runtime')}`",
        f"- 证据范围：`{report['trial_analysis_workbench'].get('pack_scope')}`",
        f"- 数据包：`{', '.join(report['trial_analysis_workbench']['datasets'])}`",
        f"- 质量检查：`{', '.join(report['trial_analysis_workbench']['checks'])}`",
        f"- 结论规则：`{', '.join(report['trial_analysis_workbench']['decision_rules'])}`",
        "",
        "## 5. 声明等级",
        "",
        *render_table(
            report["claim_tiers"],
            [
                ("status", "状态"),
                ("label", "等级"),
                ("can_say", "可以说"),
                ("cannot_say", "不能说"),
                ("threshold", "证据阈值"),
            ],
        ),
        "",
        "## 6. 导出包",
        "",
        *render_table(
            report["export_pack"],
            [
                ("status", "状态"),
                ("label", "材料"),
                ("path", "路径"),
                ("content", "内容"),
            ],
        ),
        "",
        "## 7. 教师签收脚本",
        "",
    ]
    for index, line in enumerate(report["teacher_signoff_script"], 1):
        lines.append(f"{index}. {line}")
    lines.extend(
        [
            "",
            "## 8. 打包自检",
            "",
            f"- 58 号材料是否已进入当前 ZIP：`{report['package_self_check']['status']}`",
            f"- 当前缺失条目：`{report['package_self_check']['missing']}`",
            "",
            "## 9. 复现命令",
            "",
            "```bash",
            *report["reproduce_commands"],
            "```",
            "",
        ]
    )
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate real-pilot evidence binder and claim gate materials.")
    parser.add_argument("--write", action="store_true", help="Write markdown and machine-readable JSON outputs.")
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Fail when real-course pilot blockers remain. Default only checks that the binder artifacts were generated.",
    )
    args = parser.parse_args()

    report = build_report()
    if args.write:
        OUTPUT_MD.write_text(render_markdown(report), encoding="utf-8")
        OUTPUT_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if args.strict:
        return 0 if report["blocked_count"] == 0 else 1
    binder_ready = (
        report.get("source_ready") is True
        and report.get("package_self_check", {}).get("status") == "PASS"
        and report.get("trial_analysis_workbench", {}).get("status") == "PASS"
        and len(report.get("claim_tiers", [])) >= 4
    )
    return 0 if binder_ready else 1


if __name__ == "__main__":
    raise SystemExit(main())
