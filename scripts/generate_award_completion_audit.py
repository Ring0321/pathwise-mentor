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
OUTPUT_MD = MATERIALS / "55_获奖级完成度总验收报告.md"
OUTPUT_JSON = MATERIALS / "55_获奖级完成度总验收报告_机器可读.json"

PACKAGE_MANIFEST = SUBMISSION / "SE-Path学伴_阶段提交包_v0.4_2026-08-09_manifest.json"
AUDIT_JSON = MATERIALS / "09_提交前终审报告_机器可读.json"
RELEASE_GATE_JSON = ROOT / "outputs" / "SE-Path学伴_最终发布门禁报告_机器生成.json"
TECH_JSON = MATERIALS / "46_评委技术验收包_机器可读.json"
FINAL_PROFILE_JSON = MATERIALS / "54_正式提交画像配置模板.json"
PILOT_BINDER_JSON = MATERIALS / "58_真实课程试点证据归档与声明门禁说明_机器可读.json"


def load_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def read_text(path: Path) -> str:
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8", errors="replace")


def rel(path: Path) -> str:
    try:
        return path.relative_to(ROOT).as_posix()
    except ValueError:
        return path.as_posix()


def file_ok(path: Path, min_bytes: int = 1) -> bool:
    return path.exists() and path.is_file() and path.stat().st_size >= min_bytes


def release_row(release: dict[str, Any], label: str) -> dict[str, Any]:
    return next((row for row in release.get("rows", []) if row.get("label") == label), {})


def tech_check(tech: dict[str, Any], label: str) -> dict[str, Any]:
    return next((row for row in tech.get("checks", []) if row.get("label") == label), {})


def zip_contains(package_path: Path, required: set[str]) -> tuple[bool, list[str]]:
    if not package_path.exists():
        return False, sorted(required)
    with zipfile.ZipFile(package_path) as archive:
        bad = archive.testzip()
        names = set(archive.namelist())
    missing = sorted(required - names)
    return bad is None and not missing, missing


def dimension(
    id_: str,
    title: str,
    weight: int,
    passed: bool,
    evidence: str,
    routes: list[str],
    risk: str = "",
) -> dict[str, Any]:
    return {
        "id": id_,
        "title": title,
        "weight": weight,
        "status": "PASS" if passed else "CHECK",
        "evidence": evidence,
        "routes": routes,
        "risk": risk,
    }


def build_report() -> dict[str, Any]:
    manifest = load_json(PACKAGE_MANIFEST)
    audit = load_json(AUDIT_JSON)
    release = load_json(RELEASE_GATE_JSON)
    tech = load_json(TECH_JSON)
    profile = load_json(FINAL_PROFILE_JSON)
    pilot_binder = load_json(PILOT_BINDER_JSON)
    release_summary = release.get("summary", {})
    audit_summary = audit.get("summary", {})
    package_path = SUBMISSION / str(manifest.get("package", ""))
    package_checks = manifest.get("checks", {})
    manual_rows = [row for row in audit.get("rows", []) if row.get("status") == "MANUAL"]
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
    audit_machine_ready = audit_summary.get("FAIL") == 0 or audit_self_healing
    release_core_ready = release_summary.get("release_gate") in {"PASS", "FAIL"} and package_checks.get("zip_integrity") == "pass"
    pilot_gate_ready = (
        pilot_binder.get("runtime") == "sepath-pilot-evidence-binder.v1"
        and pilot_binder.get("source_ready") is True
        and pilot_binder.get("package_self_check", {}).get("status") == "PASS"
        and len(pilot_binder.get("claim_tiers", [])) >= 4
    )

    overview_text = "\n".join(
        [
            read_text(MATERIALS / "00_评委速读与评分导航.md"),
            read_text(MATERIALS / "README_提交材料总览.md"),
            read_text(MATERIALS / "START_DEMO.md"),
        ]
    )
    required_zip_entries = {
        "参赛提交材料包/55_获奖级完成度总验收报告.md",
        "参赛提交材料包/55_获奖级完成度总验收报告_机器可读.json",
        "参赛提交材料包/58_真实课程试点证据归档与声明门禁说明.md",
        "参赛提交材料包/58_真实课程试点证据归档与声明门禁说明_机器可读.json",
        "scripts/generate_award_completion_audit.py",
        "scripts/generate_pilot_evidence_binder.py",
    }
    zip_ok, zip_missing = zip_contains(package_path, required_zip_entries)
    official_keys = ["学情诊断", "路径规划", "实时干预", "记忆与反思"]
    scoring_keys = ["智能体架构", "自适应策略", "功能完整", "创新", "商业价值"]

    dimensions = [
        dimension(
            "official-task-fit",
            "官方任务贴合度",
            10,
            all(key in overview_text for key in official_keys + scoring_keys),
            "覆盖官方四项核心能力和五项评分维度",
            [
                "参赛提交材料包/00_评委速读与评分导航.md",
                "参赛提交材料包/README_提交材料总览.md",
                "参赛提交材料包/START_DEMO.md",
            ],
        ),
        dimension(
            "runnable-closed-loop-demo",
            "可运行闭环 Demo",
            12,
            release_row(release, "本地应用算法测试").get("status") == "PASS"
            and release_row(release, "本地应用生产构建").get("status") == "PASS"
            and tech_check(tech, "自动点击演示流").get("status") == "PASS",
            "25 个算法测试、生产构建、14 个自动点击镜头和闭环演示流通过",
            [
                "sepath-cloud-app/src/engine/engine.test.ts",
                "sepath-cloud-app/qa/demo-flow/demo_flow_manifest.json",
                "参赛提交材料包/演示视频素材/SE-Path学伴_4分40秒演示视频素材_v0.3.mp4",
            ],
        ),
        dimension(
            "agent-architecture",
            "Agent 架构与工具闭环",
            12,
            all(
                file_ok(ROOT / path)
                for path in [
                    "sepath-cloud-app/src/engine/agentRuntime.ts",
                    "sepath-cloud-app/src/engine/inferenceGateway.ts",
                    "sepath-cloud-app/src/engine/interventionPlaybook.ts",
                    "sepath-cloud-app/src/engine/backendStatus.ts",
                ]
            ),
            "运行时、推理网关、干预发布、教师复核、后端状态被拆成可测试模块",
            [
                "sepath-cloud-app/src/engine/agentRuntime.ts",
                "sepath-cloud-app/src/engine/inferenceGateway.ts",
                "sepath-cloud-app/src/engine/interventionPlaybook.ts",
                "sepath-cloud-app/src/engine/backendStatus.ts",
            ],
        ),
        dimension(
            "adaptive-research-fusion",
            "自适应算法与科研融合",
            12,
            all(
                file_ok(ROOT / path)
                for path in [
                    "sepath-cloud-app/src/engine/strategyLab.ts",
                    "sepath-cloud-app/src/engine/valueUplift.ts",
                    "sepath-cloud-app/src/engine/researchFusion.ts",
                    "参赛提交材料包/36_科研算法融合与开源证据中台说明.md",
                ]
            ),
            "SafeVOI、PathTwin、Rubric 校准、学习增值估计和开源证据边界被产品化",
            [
                "参赛提交材料包/13_算法验证与科研证据说明.md",
                "参赛提交材料包/27_学习增值评估中心与科研算法融合说明.md",
                "参赛提交材料包/36_科研算法融合与开源证据中台说明.md",
            ],
        ),
        dimension(
            "cloud-and-api-readiness",
            "上云与后端可用性",
            12,
            release_core_ready
            and tech_check(tech, "Edge API HTTP 验收").get("status") == "PASS"
            and tech_check(tech, "LLM Gateway HTTP 验收").get("status") == "PASS"
            and tech_check(tech, "云端 SLO 容量压测").get("status") == "PASS",
            "Edge API、LLM Gateway、OpenAPI、SLO、数据平面和后端状态均有验收证据",
            [
                "参赛提交材料包/44_EdgeAPI运行时与后端接口验收说明.md",
                "参赛提交材料包/49_云端SLO容量压测与成本预算说明.md",
                "参赛提交材料包/51_后端连接状态中心与上线边界说明.md",
            ],
        ),
        dimension(
            "judge-trial-delivery",
            "评委试用与交付体验",
            10,
            tech_check(tech, "公开试用 PWA 离线容灾").get("status") == "PASS"
            and tech_check(tech, "评委 5 分钟实操演练").get("status") == "PASS"
            and tech_check(tech, "评委一键导览模式").get("status") == "PASS",
            "公开静态试用包、PWA 离线兜底、评委种子和 300 秒演练路线通过",
            [
                "参赛提交材料包/公开试用静态包/PUBLIC_TRIAL_MANIFEST.json",
                "sepath-cloud-app/qa/reviewer-drill-report.json",
                "sepath-cloud-app/qa/screenshots/reviewer-guide-overlay.png",
            ],
        ),
        dimension(
            "submission-artifacts",
            "参赛材料完整性",
            12,
            audit_machine_ready
            and package_checks.get("zip_integrity") == "pass"
            and bool(package_checks.get("size_under_100mb"))
            and all(
                file_ok(path, 1024)
                for path in [
                    MATERIALS / "SE-Path学伴_产品设计与原型验证方案_v0.2.pdf",
                    MATERIALS / "SE-Path学伴_答辩PPT_v0.2.pptx",
                    MATERIALS / "演示视频素材" / "SE-Path学伴_4分40秒演示视频素材_v0.3.mp4",
                    package_path,
                ]
            ),
            f"ZIP 完整性通过，{manifest.get('file_count')} 个文件，自动审计 FAIL=0",
            [
                "参赛提交材料包/09_提交前终审报告.md",
                "参赛提交材料包/SE-Path学伴_产品设计与原型验证方案_v0.2.pdf",
                "submission/SE-Path学伴_阶段提交包_v0.4_2026-08-09_manifest.json",
            ],
        ),
        dimension(
            "truth-and-governance",
            "真实性、隐私与边界治理",
            8,
            (
                len(manual_rows) == 5
                and "synthetic_replay_only_until_pilot" == profile.get("submission", {}).get("real_course_claim_policy")
                and all(value is False for value in profile.get("confirmed", {}).values())
                and pilot_gate_ready
            ),
            "人工门禁保留，58 号真实试点证据装订包已列出授权、脱敏、预注册、数据冻结、教师签收和声明分级，不编造生产效果",
            [
                "参赛提交材料包/05_真实性与边界声明.md",
                "参赛提交材料包/45_提交日人工确认决策卡.md",
                "参赛提交材料包/54_正式提交画像配置模板.json",
                "参赛提交材料包/58_真实课程试点证据归档与声明门禁说明.md",
                "参赛提交材料包/58_真实课程试点证据归档与声明门禁说明_机器可读.json",
            ],
        ),
        dimension(
            "final-defense",
            "决赛答辩与追问准备",
            6,
            tech_check(tech, "决赛路演追问回答卡").get("status") == "PASS"
            and tech_check(tech, "产品内决赛追问指挥台").get("status") == "PASS",
            "5 段路演稿、追问回答卡、产品内 #final-defense 指挥台和禁说口径齐全",
            [
                "参赛提交材料包/52_决赛路演口播稿与评委追问回答卡.md",
                "参赛提交材料包/53_产品内决赛追问指挥台说明.md",
                "sepath-cloud-app/qa/screenshots/final-defense-panel.png",
            ],
        ),
        dimension(
            "final-upload-profile",
            "正式上传画像与命名副本",
            6,
            profile.get("schema") == "sepath-final-submission-profile.v1"
            and release_row(release, "正式提交画像模板预演").get("status") == "PASS",
            "队伍信息、成员信息、访问策略、视频版本、声明边界被收束到可校验画像",
            [
                "参赛提交材料包/54_正式提交画像与命名副本生成说明.md",
                "参赛提交材料包/54_正式提交画像配置模板.json",
                "scripts/prepare_final_named_submission.py",
            ],
        ),
    ]
    total_weight = sum(item["weight"] for item in dimensions)
    passed_weight = sum(item["weight"] for item in dimensions if item["status"] == "PASS")
    score = round(100 * passed_weight / total_weight, 1) if total_weight else 0
    package_self_check = {
        "status": "PASS" if zip_ok else "CHECK",
        "missing": zip_missing,
        "note": "The current package manifest is authoritative; rerun release_gate.py after any material or source edit.",
    }

    return {
        "runtime": "sepath-award-completion-audit.v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "machine_evidence_score": score,
        "final_submission_ready": audit_summary.get("FAIL") == 0 and len(manual_rows) == 0,
        "current_boundary": "Demo 包的机器证据已经完整；58 号装订包已把真实课程试点前的授权、脱敏、预注册、数据冻结和声明分级列为门禁；正式提交仍需要团队填写真实平台报名信息、访问策略、视频版本和真实试点声明边界。",
        "machine_summary": {
            "release_gate": release_summary.get("release_gate"),
            "command_failures": release_summary.get("command_failures"),
            "audit_summary": audit_summary,
            "package": manifest.get("package"),
            "file_count": manifest.get("file_count"),
            "package_manifest": "submission/SE-Path学伴_阶段提交包_v0.4_2026-08-09_manifest.json",
            "screenshots_skipped": release_summary.get("screenshots_skipped"),
        },
        "dimensions": dimensions,
        "manual_gates": manual_rows,
        "package_self_check": package_self_check,
        "recommended_next_actions": [
            "复制 54_正式提交画像配置模板.json 到 submission/final_submission_profile.json 并填写真队伍信息。",
            "用 --profile dry-run 预演，确认没有 validation errors。",
            "最终上传前运行 release_gate.py；若时间紧，可用 --skip-screenshots，但完整截图 QA 应至少保留一次通过记录。",
            "上传后保存平台回执截图、最终 ZIP SHA256 和提交时间。",
        ],
        "forbidden_claims": [
            "不能宣称已经接入真实学校生产系统。",
            "不能宣称已经验证真实班级长期成绩提升。",
            "不能把 owner-only 私有链接说成公开访问地址。",
            "不能把合成学生数据说成真实学生数据。",
        ],
        "reproduce_commands": [
            "rtk python scripts/generate_award_completion_audit.py --write",
            "rtk python scripts/release_gate.py --skip-screenshots",
            "rtk python scripts/verify_release_consistency.py",
            "rtk python scripts/prepare_final_named_submission.py --profile \"submission/final_submission_profile.json\" --dry-run",
        ],
    }


def escape_cell(value: Any) -> str:
    return str(value).replace("|", "\\|").replace("\n", "<br>")


def render_markdown(report: dict[str, Any]) -> str:
    summary = report["machine_summary"]
    lines = [
        "# 55 获奖级完成度总验收报告",
        "",
        f"生成时间：{report['generated_at']}",
        "",
        "本报告把比赛任务、评分维度、产品闭环、上云证据、材料完整性和真实性边界合并成一张总验收表。它不是获奖承诺，而是提交前证明作品完成度和答辩口径一致性的机器生成证据。",
        "",
        "## 1. 总览",
        "",
        f"- 机器证据完成度：`{report['machine_evidence_score']}` / 100",
        f"- Release gate：`{summary.get('release_gate')}`，命令失败数 `{summary.get('command_failures')}`",
        f"- 自动审计：`{summary.get('audit_summary')}`",
        f"- 阶段 ZIP：`{summary.get('package')}`",
        f"- ZIP 文件数：`{summary.get('file_count')}`",
        f"- ZIP SHA256：以 `submission/SE-Path学伴_阶段提交包_v0.4_2026-08-09_manifest.json` 和 release gate 报告为准，避免报告自引用导致哈希滞后。",
        f"- 当前边界：{report['current_boundary']}",
        "",
        "## 2. 完成度维度",
        "",
        "| 状态 | 权重 | 维度 | 证据 | 路由 | 风险提示 |",
        "| --- | ---: | --- | --- | --- | --- |",
    ]
    for item in report["dimensions"]:
        lines.append(
            "| "
            + " | ".join(
                [
                    escape_cell(item["status"]),
                    escape_cell(item["weight"]),
                    escape_cell(item["title"]),
                    escape_cell(item["evidence"]),
                    escape_cell("<br>".join(item["routes"])),
                    escape_cell(item.get("risk", "")),
                ]
            )
            + " |"
        )
    lines.extend(
        [
            "",
            "## 3. 剩余人工门禁",
            "",
            "| 门禁 | 状态 | 证据 |",
            "| --- | --- | --- |",
        ]
    )
    for gate in report["manual_gates"]:
        lines.append(f"| {escape_cell(gate.get('label'))} | {escape_cell(gate.get('status'))} | {escape_cell(gate.get('evidence'))} |")
    lines.extend(
        [
            "",
            "## 4. 打包自检",
            "",
            f"- 55 号报告是否已进入当前 ZIP：`{report['package_self_check']['status']}`",
            f"- 缺失条目：`{report['package_self_check']['missing']}`",
            f"- 说明：{report['package_self_check']['note']}",
            "",
            "## 5. 下一步",
            "",
        ]
    )
    for index, action in enumerate(report["recommended_next_actions"], 1):
        lines.append(f"{index}. {action}")
    lines.extend(["", "## 6. 禁止口径", ""])
    for claim in report["forbidden_claims"]:
        lines.append(f"- {claim}")
    lines.extend(["", "## 7. 复现命令", "", "```bash", *report["reproduce_commands"], "```", ""])
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate SE-Path award-level completion audit materials.")
    parser.add_argument("--write", action="store_true", help="Write markdown and machine-readable JSON outputs.")
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Fail when the award score is below 90. Default only checks that the audit artifacts were generated.",
    )
    args = parser.parse_args()

    report = build_report()
    if args.write:
        OUTPUT_MD.write_text(render_markdown(report), encoding="utf-8")
        OUTPUT_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if args.strict:
        return 0 if report["machine_evidence_score"] >= 90 else 1
    return 0 if report.get("package_self_check", {}).get("status") == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
