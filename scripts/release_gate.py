from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
MATERIALS = ROOT / "参赛提交材料包"
SUBMISSION = ROOT / "submission"
MANIFEST = SUBMISSION / "SE-Path学伴_阶段提交包_v0.4_2026-08-09_manifest.json"
AUDIT_JSON = MATERIALS / "09_提交前终审报告_机器可读.json"
REPORT = ROOT / "outputs" / "SE-Path学伴_最终发布门禁报告_机器生成.json"
CLOUD_URL = "https://sepath-xueban.ring0321.chatgpt.site"


PYTHON = sys.executable
NPM = "npm.cmd" if os.name == "nt" else "npm"


def run_command(label: str, command: list[str], cwd: Path, timeout: int) -> dict[str, Any]:
    started = datetime.now(timezone.utc).isoformat()
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUTF8"] = "1"
    try:
        completed = subprocess.run(
            command,
            cwd=cwd,
            env=env,
            text=True,
            encoding="utf-8",
            errors="replace",
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=timeout,
            shell=False,
        )
        output = completed.stdout or ""
        return {
            "label": label,
            "status": "PASS" if completed.returncode == 0 else "FAIL",
            "returncode": completed.returncode,
            "started_at": started,
            "command": command,
            "cwd": str(cwd),
            "tail": output[-3000:],
        }
    except subprocess.TimeoutExpired as exc:
        output = (exc.stdout or "") + (exc.stderr or "")
        return {
            "label": label,
            "status": "FAIL",
            "returncode": "timeout",
            "started_at": started,
            "command": command,
            "cwd": str(cwd),
            "tail": str(output)[-3000:],
        }


def probe_cloud() -> dict[str, Any]:
    request = urllib.request.Request(CLOUD_URL, headers={"User-Agent": "SE-Path-release-gate/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            status_code = response.status
            ok = 200 <= status_code < 400
            return {
                "label": "云端匿名访问探测",
                "status": "PASS" if ok else "FAIL",
                "status_code": status_code,
                "evidence": "publicly reachable" if ok else "unexpected status",
                "url": CLOUD_URL,
            }
    except urllib.error.HTTPError as exc:
        status_code = exc.code
        private_ok = status_code in {401, 403}
        return {
            "label": "云端匿名访问探测",
            "status": "PASS" if private_ok else "FAIL",
            "status_code": status_code,
            "evidence": "owner-only access control active" if private_ok else exc.reason,
            "url": CLOUD_URL,
        }
    except urllib.error.URLError as exc:
        return {
            "label": "云端匿名访问探测",
            "status": "WARN",
            "status_code": "network-error",
            "evidence": f"external probe skipped by network layer: {exc.reason}",
            "url": CLOUD_URL,
        }


def load_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the SE-Path final release gate.")
    parser.add_argument(
        "--skip-screenshots",
        action="store_true",
        help="Skip Playwright/Chrome screenshot QA when a quick release gate is needed.",
    )
    args = parser.parse_args()

    commands = [
        (
            "Python 脚本语法检查",
            [
                PYTHON,
                "-B",
                "-m",
                "py_compile",
                "scripts/audit_submission_readiness.py",
                "scripts/package_sepath_submission.py",
                "scripts/build_public_trial_bundle.py",
                "scripts/build_public_site_upload_artifact.py",
                "scripts/build_final_submission_profile.py",
                "scripts/generate_final_submission_workspace.py",
                "scripts/generate_public_launch_commander.py",
                "scripts/generate_sites_publish_preflight.py",
                "scripts/generate_hosting_upload_selftest_pack.py",
                "scripts/generate_public_deploy_playbook_pack.py",
                "scripts/sync_public_deploy_index_materials.py",
                "scripts/prepare_final_named_submission.py",
                "scripts/generate_final_submission_decision_card.py",
                "scripts/generate_judge_verification_pack.py",
                "scripts/validate_openapi_contract.py",
                "scripts/generate_judge_demo_seed_pack.py",
                "scripts/validate_public_trial_pwa.py",
                "scripts/validate_deploy_artifacts.py",
                "scripts/validate_public_url_release.py",
                "scripts/smoke_public_url_validator_local.py",
                "scripts/finalize_public_url_receipt.py",
                "scripts/finalize_submission_after_public_url.py",
                "scripts/release_gate.py",
                "scripts/update_ppt_backend_status_text.py",
                "scripts/verify_release_consistency.py",
                "scripts/generate_award_completion_audit.py",
                "scripts/generate_launch_loop_acceptance.py",
                "scripts/generate_pilot_evidence_binder.py",
                "scripts/generate_trial_analysis_pack.py",
                "scripts/generate_reviewer_5min_drill_pack.py",
                "scripts/generate_judge_route_orchestrator.py",
                "scripts/generate_local_run_doctor_pack.py",
                "scripts/generate_submission_upload_preflight_pack.py",
                "scripts/generate_award_differentiation_pack.py",
                "scripts/generate_claim_evidence_ledger_pack.py",
                "scripts/generate_competition_requirement_alignment_pack.py",
                "scripts/generate_judge_launchpad.py",
            ],
            ROOT,
            120,
        ),
        ("本地应用算法测试", [NPM, "run", "test"], ROOT / "sepath-cloud-app", 180),
        ("Edge API Worker smoke test", [NPM, "run", "cloud:smoke"], ROOT / "sepath-cloud-app", 120),
        ("Edge API HTTP smoke test", [NPM, "run", "cloud:smoke:http"], ROOT / "sepath-cloud-app", 120),
        ("LLM Gateway smoke test", [NPM, "run", "cloud:smoke:llm"], ROOT / "sepath-cloud-app", 120),
        ("LLM Gateway HTTP smoke test", [NPM, "run", "cloud:smoke:llm:http"], ROOT / "sepath-cloud-app", 120),
        ("Cloud SLO load test", [NPM, "run", "cloud:slo"], ROOT / "sepath-cloud-app", 120),
        ("Reviewer drill walkthrough check", [NPM, "run", "cloud:reviewer-drill"], ROOT / "sepath-cloud-app", 120),
        ("评委 5 分钟独立演练包生成", [PYTHON, "scripts/generate_reviewer_5min_drill_pack.py", "--write"], ROOT, 120),
        ("OpenAPI 机器契约校验", [PYTHON, "scripts/validate_openapi_contract.py"], ROOT, 120),
        ("评委试用种子包生成", [PYTHON, "scripts/generate_judge_demo_seed_pack.py", "--write"], ROOT, 120),
        ("本地应用生产构建", [NPM, "run", "build"], ROOT / "sepath-cloud-app", 180),
    ]
    if not args.skip_screenshots:
        commands.append(("本地应用截图 QA", [NPM, "run", "qa:screenshots"], ROOT / "sepath-cloud-app", 650))
    commands.extend(
        [
            ("公开试用静态包生成", [PYTHON, "scripts/build_public_trial_bundle.py"], ROOT, 120),
            ("公网静态站点上传包生成", [PYTHON, "scripts/build_public_site_upload_artifact.py"], ROOT, 120),
            ("公开试用 PWA 离线容灾验收", [PYTHON, "scripts/validate_public_trial_pwa.py"], ROOT, 120),
            ("标准化部署配置验收", [PYTHON, "scripts/validate_deploy_artifacts.py", "--write"], ROOT, 120),
            ("公开 URL 验收器本地烟测", [PYTHON, "scripts/smoke_public_url_validator_local.py", "--write"], ROOT, 120),
            ("最终公开 URL 回执模板生成", [PYTHON, "scripts/finalize_public_url_receipt.py", "--template", "--write"], ROOT, 120),
            ("公网发布指挥台生成", [PYTHON, "scripts/generate_public_launch_commander.py", "--write"], ROOT, 120),
            ("Sites 发布预检与替代路线生成", [PYTHON, "scripts/generate_sites_publish_preflight.py", "--write"], ROOT, 120),
            ("正式提交填报工作台生成", [PYTHON, "scripts/generate_final_submission_workspace.py", "--write"], ROOT, 120),
            ("静态托管上传自检包生成", [PYTHON, "scripts/generate_hosting_upload_selftest_pack.py", "--write"], ROOT, 120),
            ("公网部署实操包生成", [PYTHON, "scripts/generate_public_deploy_playbook_pack.py", "--write"], ROOT, 120),
            ("公网部署索引同步", [PYTHON, "scripts/sync_public_deploy_index_materials.py", "--write"], ROOT, 120),
            ("公网 URL 正式提交收口生成", [PYTHON, "scripts/finalize_submission_after_public_url.py", "--write"], ROOT, 120),
            ("三段式评委评审路线生成", [PYTHON, "scripts/generate_judge_route_orchestrator.py", "--write"], ROOT, 120),
            ("本地运行环境自检包生成", [PYTHON, "scripts/generate_local_run_doctor_pack.py", "--write"], ROOT, 120),
            ("平台提交终检包生成", [PYTHON, "scripts/generate_submission_upload_preflight_pack.py", "--write"], ROOT, 120),
            ("一等奖差异化创新证据包生成", [PYTHON, "scripts/generate_award_differentiation_pack.py", "--write"], ROOT, 120),
            ("主张证据账本生成", [PYTHON, "scripts/generate_claim_evidence_ledger_pack.py", "--write"], ROOT, 120),
            ("赛题要求逐项对齐矩阵生成", [PYTHON, "scripts/generate_competition_requirement_alignment_pack.py", "--write"], ROOT, 120),
            ("评委一键启动入口生成", [PYTHON, "scripts/generate_judge_launchpad.py", "--write"], ROOT, 120),
            ("Sites 工程构建与渲染测试", [NPM, "test"], ROOT / "sepath-sites-app", 240),
            ("试点匿名分析数据包生成", [PYTHON, "scripts/generate_trial_analysis_pack.py", "--write"], ROOT, 120),
            ("真实试点证据装订包生成", [PYTHON, "scripts/generate_pilot_evidence_binder.py", "--write"], ROOT, 120),
            ("获奖级完成度总验收生成", [PYTHON, "scripts/generate_award_completion_audit.py", "--write"], ROOT, 120),
            ("上线级闭环验收剧本生成", [PYTHON, "scripts/generate_launch_loop_acceptance.py", "--write"], ROOT, 120),
            ("阶段提交包打包", [PYTHON, "scripts/package_sepath_submission.py"], ROOT, 180),
            ("PPT 文本与提交包 manifest 同步", [PYTHON, "scripts/update_ppt_backend_status_text.py"], ROOT, 120),
            ("提交前自动审计", [PYTHON, "scripts/audit_submission_readiness.py"], ROOT, 180),
            ("PPT 文本与审计结果复核同步", [PYTHON, "scripts/update_ppt_backend_status_text.py"], ROOT, 120),
            ("提交日人工确认决策卡生成", [PYTHON, "scripts/generate_final_submission_decision_card.py", "--write"], ROOT, 120),
            ("试点匿名分析数据包复核", [PYTHON, "scripts/generate_trial_analysis_pack.py", "--write"], ROOT, 120),
            ("真实试点证据装订包复核", [PYTHON, "scripts/generate_pilot_evidence_binder.py", "--write"], ROOT, 120),
            ("获奖级完成度总验收复核", [PYTHON, "scripts/generate_award_completion_audit.py", "--write"], ROOT, 120),
            ("上线级闭环验收剧本复核", [PYTHON, "scripts/generate_launch_loop_acceptance.py", "--write"], ROOT, 120),
            ("评委技术验收包生成", [PYTHON, "scripts/generate_judge_verification_pack.py", "--write"], ROOT, 120),
            ("三段式评委评审路线复核", [PYTHON, "scripts/generate_judge_route_orchestrator.py", "--write"], ROOT, 120),
            ("本地运行环境自检包复核", [PYTHON, "scripts/generate_local_run_doctor_pack.py", "--write"], ROOT, 120),
            ("平台提交终检包复核", [PYTHON, "scripts/generate_submission_upload_preflight_pack.py", "--write"], ROOT, 120),
            ("一等奖差异化创新证据包复核", [PYTHON, "scripts/generate_award_differentiation_pack.py", "--write"], ROOT, 120),
            ("主张证据账本复核", [PYTHON, "scripts/generate_claim_evidence_ledger_pack.py", "--write"], ROOT, 120),
            ("赛题要求逐项对齐矩阵复核", [PYTHON, "scripts/generate_competition_requirement_alignment_pack.py", "--write"], ROOT, 120),
            ("公网部署实操包复核", [PYTHON, "scripts/generate_public_deploy_playbook_pack.py", "--write"], ROOT, 120),
            ("公网部署索引复核", [PYTHON, "scripts/sync_public_deploy_index_materials.py", "--write"], ROOT, 120),
            ("公网 URL 正式提交收口复核", [PYTHON, "scripts/finalize_submission_after_public_url.py", "--write"], ROOT, 120),
            ("标准化部署配置复核", [PYTHON, "scripts/validate_deploy_artifacts.py", "--write"], ROOT, 120),
            ("评委一键启动入口复核", [PYTHON, "scripts/generate_judge_launchpad.py", "--write"], ROOT, 120),
            ("最终提交包封装", [PYTHON, "scripts/package_sepath_submission.py"], ROOT, 180),
            (
                "正式提交画像生成脚本预演",
                [
                    PYTHON,
                    "scripts/build_final_submission_profile.py",
                    "--team-name",
                    "路演预演队",
                    "--work-name",
                    "SE-Path学伴",
                    "--member",
                    "路演成员|预演学校|软件工程|项目负责人|platform-contact",
                    "--access-policy",
                    "owner_only_cloud_plus_public_static_bundle",
                    "--video-policy",
                    "caption_material_v0.3",
                    "--claim-policy",
                    "synthetic_replay_only_until_pilot",
                    "--print-next-commands",
                ],
                ROOT,
                120,
            ),
            (
                "正式提交画像模板预演",
                [
                    PYTHON,
                    "scripts/prepare_final_named_submission.py",
                    "--profile",
                    "参赛提交材料包/54_正式提交画像配置模板.json",
                    "--dry-run",
                ],
                ROOT,
                120,
            ),
            (
                "正式命名脚本预演",
                [
                    PYTHON,
                    "scripts/prepare_final_named_submission.py",
                    "--team-name",
                    "待填写队伍名",
                    "--work-name",
                    "SE-Path学伴",
                    "--dry-run",
                ],
                ROOT,
                120,
            ),
        ]
    )

    rows = [run_command(label, command, cwd, timeout) for label, command, cwd, timeout in commands]
    rows.append(probe_cloud())

    manifest = load_json(MANIFEST)
    audit = load_json(AUDIT_JSON)
    fail_count = sum(1 for row in rows if row["status"] == "FAIL")
    audit_summary = audit.get("summary", {})
    audit_ok = audit_summary.get("FAIL") == 0

    result = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "release_gate": "PASS" if fail_count == 0 and audit_ok else "FAIL",
            "command_failures": fail_count,
            "audit_summary": audit_summary,
            "package": manifest.get("package"),
            "package_size_bytes": manifest.get("package_size_bytes"),
            "package_sha256": manifest.get("package_sha256"),
            "file_count": manifest.get("file_count"),
            "screenshots_skipped": args.skip_screenshots,
        },
        "rows": rows,
    }
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps(result["summary"], ensure_ascii=False, indent=2))
    print(f"report: {REPORT.relative_to(ROOT).as_posix()}")
    return 0 if result["summary"]["release_gate"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
