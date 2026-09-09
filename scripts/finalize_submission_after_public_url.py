from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from finalize_public_url_receipt import (
    RECEIPT_JSON,
    RECEIPT_MD,
    SUBMISSION,
    VALIDATION_REPORT,
    build_receipt,
    render_markdown as render_receipt_markdown,
    sync_platform_copy,
)
from prepare_final_named_submission import PROFILE_SCHEMA, validate_profile


ROOT = Path(__file__).resolve().parents[1]
MATERIALS = ROOT / "参赛提交材料包"
OUTPUTS = ROOT / "outputs"

PROFILE_TEMPLATE = MATERIALS / "54_正式提交画像配置模板.json"
PROFILE_TODO = SUBMISSION / "final_submission_profile.todo.json"
PROFILE_FINAL = SUBMISSION / "final_submission_profile.json"
PLATFORM_COPY = MATERIALS / "10_比赛平台填写文案.md"
PUBLIC_LAUNCH_COMMAND = MATERIALS / "public-launch-command" / "PUBLIC_LAUNCH_COMMAND.json"
PUBLIC_UPLOAD_MANIFEST = MATERIALS / "public-site-upload" / "PUBLIC_SITE_UPLOAD_MANIFEST.json"
FINAL_WORKSPACE = MATERIALS / "68_正式提交填报工作台与人工门禁补全卡_机器可读.json"
PACKAGE_MANIFEST = SUBMISSION / "SE-Path学伴_阶段提交包_v0.4_2026-08-09_manifest.json"
RELEASE_REPORT = OUTPUTS / "SE-Path学伴_最终发布门禁报告_机器生成.json"
CONSISTENCY_REPORT = SUBMISSION / "release_consistency_report.json"
FINAL_NAMED_DIR = SUBMISSION / "final_named"

REPORT_JSON = SUBMISSION / "public_url_submission_closure_report.json"
REPORT_MD = SUBMISSION / "public_url_submission_closure_report.md"
MATERIAL_MD = MATERIALS / "71_公网URL回填后的正式提交收口说明.md"
MATERIAL_JSON = MATERIALS / "71_公网URL回填后的正式提交收口说明_机器可读.json"

CONFIRMATION_KEYS = [
    "team_name_matches_platform",
    "members_match_platform",
    "access_policy_confirmed",
    "video_version_confirmed",
    "no_unverified_real_course_claims",
    "sha256_saved_after_upload",
]


def read_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def rel(path: Path) -> str:
    try:
        return path.resolve().relative_to(ROOT).as_posix()
    except ValueError:
        return str(path)


def row(check_id: str, status: str, evidence: str, path: Path | str) -> dict[str, str]:
    return {
        "id": check_id,
        "status": status,
        "evidence": evidence,
        "path": rel(path) if isinstance(path, Path) else path,
    }


def summarize(rows: list[dict[str, str]]) -> dict[str, int]:
    summary = {"PASS": 0, "FAIL": 0, "MANUAL": 0, "WATCH": 0}
    for item in rows:
        status = item.get("status", "WATCH")
        summary[status] = summary.get(status, 0) + 1
    summary["rows"] = len(rows)
    return summary


def python_invocation() -> str:
    executable = str(Path(sys.executable))
    if " " in executable:
        executable = f'"{executable}"'
    return f"rtk {executable}"


def build_or_load_receipt(url: str | None, allow_local: bool, write: bool) -> tuple[dict[str, Any], dict[str, Any]]:
    if url:
        receipt = build_receipt(url, allow_local=allow_local)
        validation = receipt.pop("validation")
        if write:
            SUBMISSION.mkdir(parents=True, exist_ok=True)
            VALIDATION_REPORT.write_text(json.dumps(validation, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            RECEIPT_JSON.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            RECEIPT_MD.write_text(render_receipt_markdown(receipt), encoding="utf-8")
        return receipt, validation

    receipt = read_json(RECEIPT_JSON)
    if receipt:
        return receipt, read_json(VALIDATION_REPORT)

    receipt = build_receipt(None, allow_local=allow_local)
    validation = receipt.pop("validation")
    if write:
        SUBMISSION.mkdir(parents=True, exist_ok=True)
        VALIDATION_REPORT.write_text(json.dumps(validation, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        RECEIPT_JSON.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        RECEIPT_MD.write_text(render_receipt_markdown(receipt), encoding="utf-8")
    return receipt, validation


def choose_profile(path_arg: Path | None) -> tuple[Path, dict[str, Any], dict[str, Any], dict[str, Any]]:
    if path_arg:
        profile_path = path_arg.resolve()
    elif PROFILE_FINAL.exists():
        profile_path = PROFILE_FINAL
    elif PROFILE_TODO.exists():
        profile_path = PROFILE_TODO
    else:
        profile_path = PROFILE_TEMPLATE

    profile = read_json(profile_path)
    if not profile:
        return profile_path, {}, {"errors": ["profile file not found or empty"], "warnings": []}, {"errors": [], "warnings": []}
    preview = validate_profile(profile, require_confirmed=False)
    final = validate_profile(profile, require_confirmed=True)
    return profile_path, profile, preview, final


def named_manifest_status() -> dict[str, Any]:
    manifests = sorted(FINAL_NAMED_DIR.glob("*_manifest.json")) if FINAL_NAMED_DIR.exists() else []
    if not manifests:
        return {
            "status": "MANUAL",
            "manifest": "",
            "file_count": 0,
            "evidence": "submission/final_named has not been generated yet",
        }
    latest = max(manifests, key=lambda item: item.stat().st_mtime)
    data = read_json(latest)
    files = data.get("files", [])
    target_sha_ready = all(item.get("target_sha256") for item in files) if isinstance(files, list) else False
    return {
        "status": "PASS" if len(files) >= 5 and target_sha_ready else "WATCH",
        "manifest": rel(latest),
        "file_count": len(files) if isinstance(files, list) else 0,
        "evidence": f"files={len(files) if isinstance(files, list) else 0} target_sha_ready={target_sha_ready}",
    }


def build_checks(
    receipt: dict[str, Any],
    profile_path: Path,
    profile_final_validation: dict[str, Any],
    sync_status: dict[str, str],
) -> list[dict[str, str]]:
    upload_manifest = read_json(PUBLIC_UPLOAD_MANIFEST)
    package_manifest = read_json(PACKAGE_MANIFEST)
    release_report = read_json(RELEASE_REPORT)
    consistency_report = read_json(CONSISTENCY_REPORT)
    final_workspace = read_json(FINAL_WORKSPACE)
    launch_command = read_json(PUBLIC_LAUNCH_COMMAND)
    named_status = named_manifest_status()

    receipt_status = receipt.get("status")
    receipt_summary = receipt.get("validation_summary", {})
    receipt_ready = (
        receipt_status == "ready_for_platform"
        and receipt.get("public_https_check") is True
        and receipt_summary.get("FAIL") == 0
    )
    profile_is_final = profile_path.resolve() == PROFILE_FINAL.resolve()
    profile_ready = profile_is_final and not profile_final_validation.get("errors")

    return [
        row(
            "final-public-url-receipt",
            "PASS" if receipt_ready else "MANUAL" if receipt_status == "pending_final_public_url" else "FAIL",
            f"status={receipt_status} public_https={receipt.get('public_https_check')} summary={receipt_summary}",
            RECEIPT_JSON,
        ),
        row(
            "public-url-platform-copy",
            sync_status["status"],
            sync_status["evidence"],
            PLATFORM_COPY,
        ),
        row(
            "public-static-upload-artifact",
            "PASS"
            if upload_manifest.get("zip_integrity") == "pass"
            and upload_manifest.get("required_missing") == []
            and int(upload_manifest.get("zip_size_bytes") or 0) > 0
            else "FAIL",
            f"zip_integrity={upload_manifest.get('zip_integrity')} missing={upload_manifest.get('required_missing')} size={upload_manifest.get('zip_size_bytes')}",
            PUBLIC_UPLOAD_MANIFEST,
        ),
        row(
            "public-launch-command",
            "PASS"
            if launch_command.get("runtime") in {"sepath-public-launch-command.v1", "sepath-public-launch-commander.v1"}
            else "WATCH",
            f"runtime={launch_command.get('runtime')} status={launch_command.get('status')} url={launch_command.get('url')}",
            PUBLIC_LAUNCH_COMMAND,
        ),
        row(
            "final-submission-profile",
            "PASS" if profile_ready else "MANUAL" if profile_final_validation.get("errors") else "WATCH",
            f"profile={rel(profile_path)} errors={len(profile_final_validation.get('errors', []))} warnings={len(profile_final_validation.get('warnings', []))}",
            profile_path,
        ),
        row(
            "manual-gates-retained",
            "PASS"
            if all(read_json(PROFILE_TODO).get("confirmed", {}).get(key) is False for key in CONFIRMATION_KEYS)
            else "FAIL",
            "todo profile confirmation flags stay false until platform facts are manually confirmed",
            PROFILE_TODO,
        ),
        row(
            "final-named-submission-copies",
            named_status["status"],
            named_status["evidence"],
            named_status["manifest"] or FINAL_NAMED_DIR,
        ),
        row(
            "release-gate",
            "PASS"
            if release_report.get("summary", {}).get("release_gate") == "PASS"
            and release_report.get("summary", {}).get("command_failures") == 0
            else "WATCH",
            f"release_gate={release_report.get('summary', {}).get('release_gate')} command_failures={release_report.get('summary', {}).get('command_failures')}",
            RELEASE_REPORT,
        ),
        row(
            "release-consistency",
            "PASS" if consistency_report.get("summary", {}).get("FAIL") == 0 else "FAIL",
            f"summary={consistency_report.get('summary')}",
            CONSISTENCY_REPORT,
        ),
        row(
            "stage-package-manifest",
            "PASS"
            if package_manifest.get("checks", {}).get("zip_integrity") == "pass"
            and package_manifest.get("checks", {}).get("secret_scan_hits") == []
            and package_manifest.get("checks", {}).get("size_under_100mb") is True
            else "FAIL",
            "zip_integrity={zip_integrity} secrets={secrets} size_under_100mb={size}".format(
                zip_integrity=package_manifest.get("checks", {}).get("zip_integrity"),
                secrets=len(package_manifest.get("checks", {}).get("secret_scan_hits", [])),
                size=package_manifest.get("checks", {}).get("size_under_100mb"),
            ),
            PACKAGE_MANIFEST,
        ),
        row(
            "final-submission-workspace",
            "PASS" if final_workspace.get("runtime") == "sepath-final-submission-workspace.v1" else "WATCH",
            f"runtime={final_workspace.get('runtime')} status={final_workspace.get('status')}",
            FINAL_WORKSPACE,
        ),
    ]


def next_commands(url: str | None, receipt_ready: bool, profile_ready: bool) -> list[dict[str, str]]:
    final_url = url or "https://your-public-demo.example"
    py = python_invocation()
    commands = [
        {
            "stage": "1_url_receipt",
            "command": f"{py} scripts/finalize_submission_after_public_url.py --url {final_url} --write --sync-platform-copy",
            "when": "拿到最终公网 HTTPS URL 后执行。",
        },
        {
            "stage": "2_profile",
            "command": (
                f'{py} scripts/build_final_submission_profile.py --team-name "<比赛平台队伍名>" '
                '--member "姓名|学校|专业|角色|平台联系方式" '
                f'--access-policy public_cloud_after_permission_switch --cloud-url "{final_url}" '
                "--video-policy caption_material_v0.3 --claim-policy synthetic_replay_only_until_pilot "
                "--write --print-next-commands"
            ),
            "when": "队伍名、成员、视频版本、真实效果声明边界人工确认后执行。",
        },
        {
            "stage": "3_named_dry_run",
            "command": f'{py} scripts/prepare_final_named_submission.py --profile "submission/final_submission_profile.json" --dry-run',
            "when": "正式画像无错误后先预演目标文件名。",
        },
        {
            "stage": "4_named_write",
            "command": f'{py} scripts/prepare_final_named_submission.py --profile "submission/final_submission_profile.json" --write',
            "when": "预演文件名和平台要求逐字核对后执行。",
        },
        {
            "stage": "5_release_gate",
            "command": f"{py} scripts/release_gate.py --skip-screenshots",
            "when": "命名副本生成后重新跑最终发布门禁。",
        },
        {
            "stage": "6_consistency",
            "command": f"{py} scripts/verify_release_consistency.py",
            "when": "发布门禁通过后做跨材料一致性复查。",
        },
    ]
    if receipt_ready and profile_ready:
        commands.append(
            {
                "stage": "7_submit",
                "command": "打开比赛平台，上传 submission/final_named 中的正式命名副本，并保存平台回执截图与最终 SHA256。",
                "when": "所有机器门禁 PASS 且人工门禁已签收后。",
            }
        )
    return commands


def determine_status(summary: dict[str, int]) -> str:
    if summary.get("FAIL", 0) > 0:
        return "blocked_by_machine_gate"
    if summary.get("MANUAL", 0) > 0:
        return "manual_gates_remaining"
    if summary.get("WATCH", 0) > 0:
        return "ready_with_watch_items"
    return "ready_for_final_platform_submission"


def build_report(args: argparse.Namespace) -> dict[str, Any]:
    receipt, validation = build_or_load_receipt(args.url, args.allow_local, args.write)
    sync_status = {"status": "MANUAL", "evidence": "platform copy is not synced unless --sync-platform-copy is used after URL validation"}
    if args.sync_platform_copy:
        try:
            sync_platform_copy(receipt)
            sync_status = {"status": "PASS", "evidence": "10_比赛平台填写文案.md has been synchronized from final_public_url_receipt.json"}
        except Exception as exc:  # noqa: BLE001 - this script must preserve a human-readable closure report.
            sync_status = {"status": "FAIL", "evidence": f"sync refused: {exc}"}

    profile_path, profile, profile_preview, profile_final = choose_profile(args.profile)
    receipt_ready = (
        receipt.get("status") == "ready_for_platform"
        and receipt.get("public_https_check") is True
        and receipt.get("validation_summary", {}).get("FAIL") == 0
    )
    profile_ready = profile_path.resolve() == PROFILE_FINAL.resolve() and not profile_final.get("errors")
    checks = build_checks(receipt, profile_path, profile_final, sync_status)
    summary = summarize(checks)
    status = determine_status(summary)

    return {
        "runtime": "sepath-public-url-submission-closure.v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "status": status,
        "url": receipt.get("url"),
        "receipt_ready": receipt_ready,
        "profile_ready": profile_ready,
        "profile_path": rel(profile_path),
        "profile_schema": profile.get("schema"),
        "python_invocation": python_invocation(),
        "profile_preview_validation": profile_preview,
        "profile_final_validation": profile_final,
        "receipt": {
            "path": rel(RECEIPT_JSON),
            "status": receipt.get("status"),
            "public_https_check": receipt.get("public_https_check"),
            "validation_summary": receipt.get("validation_summary"),
            "validation_report": rel(VALIDATION_REPORT),
            "receipt_markdown": rel(RECEIPT_MD),
        },
        "validation_raw_summary": validation.get("summary", {}),
        "checks_summary": summary,
        "checks": checks,
        "next_commands": next_commands(args.url, receipt_ready, profile_ready),
        "outputs": {
            "report_json": rel(REPORT_JSON),
            "report_md": rel(REPORT_MD),
            "material_md": rel(MATERIAL_MD),
            "material_json": rel(MATERIAL_JSON),
        },
        "truth_boundary": (
            "This closure report only confirms URL/package/profile consistency gates. "
            "It must not be used to invent real team members, platform receipts, production rollout, real student data, or causal learning gains."
        ),
    }


def render_report_md(report: dict[str, Any], *, material_view: bool) -> str:
    title = "71 公网 URL 回填后的正式提交收口说明" if material_view else "公网 URL 与正式提交收口报告"
    lines = [
        f"# {title}",
        "",
        f"生成时间：{report['generated_at']}",
        f"状态：`{report['status']}`",
        f"最终 URL：`{report.get('url')}`",
        f"URL 回执就绪：`{report.get('receipt_ready')}`",
        f"正式画像就绪：`{report.get('profile_ready')}`",
        "",
        "## 一、收口结论",
        "",
        "| 项 | 数值 |",
        "| --- | --- |",
        f"| 机器检查 | PASS {report['checks_summary'].get('PASS', 0)} / FAIL {report['checks_summary'].get('FAIL', 0)} / MANUAL {report['checks_summary'].get('MANUAL', 0)} / WATCH {report['checks_summary'].get('WATCH', 0)} |",
        f"| URL 回执 | `{report['receipt'].get('status')}` / public_https `{report['receipt'].get('public_https_check')}` |",
        f"| 正式画像 | `{report['profile_path']}` / errors `{len(report['profile_final_validation'].get('errors', []))}` |",
        "",
        "## 二、门禁明细",
        "",
        "| 门禁 | 状态 | 证据 | 路径 |",
        "| --- | --- | --- | --- |",
    ]
    for item in report["checks"]:
        lines.append(f"| {item['id']} | {item['status']} | {item['evidence']} | `{item['path']}` |")

    lines.extend(
        [
            "",
            "## 三、下一步命令",
            "",
            "| 阶段 | 何时执行 | 命令 |",
            "| --- | --- | --- |",
        ]
    )
    for item in report["next_commands"]:
        command = item["command"].replace("|", "\\|")
        lines.append(f"| {item['stage']} | {item['when']} | `{command}` |")

    lines.extend(
        [
            "",
            "## 四、不能越界的地方",
            "",
            report["truth_boundary"],
            "",
        ]
    )
    if material_view:
        lines.extend(
            [
                "## 五、正式提交时使用方式",
                "",
                "1. 先按 `70_公网部署实操包与回执封存说明.md` 完成公网部署。",
                "2. 拿到公网 HTTPS 地址后运行 71 号收口脚本，确认 `final-public-url-receipt` 为 PASS。",
                "3. 人工填写真队伍画像，生成 `submission/final_named` 正式命名副本。",
                "4. 最后重跑发布门禁和一致性检查，再上传平台并保存回执截图。",
                "",
            ]
        )
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Close the final public URL, profile, named-file, and release-gate loop.")
    parser.add_argument("--url", help="Final public HTTPS demo URL. Omit it to produce a pending closure report.")
    parser.add_argument("--allow-local", action="store_true", help="Allow local URLs for internal rehearsal only.")
    parser.add_argument("--profile", type=Path, help="Final submission profile to validate. Defaults to submission/final_submission_profile.json if present.")
    parser.add_argument("--write", action="store_true", help="Write receipt, closure report, and material 71 files.")
    parser.add_argument("--sync-platform-copy", action="store_true", help="Synchronize 10_比赛平台填写文案.md after URL validation passes.")
    args = parser.parse_args()

    report = build_report(args)
    if args.write:
        SUBMISSION.mkdir(parents=True, exist_ok=True)
        MATERIALS.mkdir(parents=True, exist_ok=True)
        REPORT_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        REPORT_MD.write_text(render_report_md(report, material_view=False), encoding="utf-8")
        MATERIAL_JSON.write_text(
            json.dumps({key: value for key, value in report.items() if key not in {"profile_preview_validation"}}, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        MATERIAL_MD.write_text(render_report_md(report, material_view=True), encoding="utf-8")

    print(
        json.dumps(
            {
                "runtime": report["runtime"],
                "status": report["status"],
                "url": report["url"],
                "checks_summary": report["checks_summary"],
                "receipt": report["receipt"],
                "outputs": report["outputs"],
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0 if report["status"] != "blocked_by_machine_gate" else 1


if __name__ == "__main__":
    raise SystemExit(main())
