from __future__ import annotations

import argparse
import hashlib
import json
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
MATERIALS = ROOT / "参赛提交材料包"
SUBMISSION = ROOT / "submission"
OUTPUTS = ROOT / "outputs"

PROFILE_TEMPLATE = MATERIALS / "54_正式提交画像配置模板.json"
MATERIAL_MD = MATERIALS / "68_正式提交填报工作台与人工门禁补全卡.md"
MATERIAL_JSON = MATERIALS / "68_正式提交填报工作台与人工门禁补全卡_机器可读.json"
TODO_PROFILE = SUBMISSION / "final_submission_profile.todo.json"
MANUAL_MD = SUBMISSION / "final_submission_manual_checklist.md"
MANUAL_JSON = SUBMISSION / "final_submission_manual_checklist.json"
PACKAGED_WORKSPACE = MATERIALS / "final-submission-workspace"
PACKAGED_TODO_PROFILE = PACKAGED_WORKSPACE / "final_submission_profile.todo.json"
PACKAGED_MANUAL_MD = PACKAGED_WORKSPACE / "final_submission_manual_checklist.md"
PACKAGED_MANUAL_JSON = PACKAGED_WORKSPACE / "final_submission_manual_checklist.json"
PACKAGED_README = PACKAGED_WORKSPACE / "README.md"
FINAL_RECEIPT = SUBMISSION / "final_public_url_receipt.json"
PUBLIC_LAUNCH = MATERIALS / "public-launch-command" / "PUBLIC_LAUNCH_COMMAND.json"
UPLOAD_MANIFEST = MATERIALS / "public-site-upload" / "PUBLIC_SITE_UPLOAD_MANIFEST.json"
PACKAGE_MANIFEST = SUBMISSION / "SE-Path学伴_阶段提交包_v0.4_2026-08-09_manifest.json"
RELEASE_REPORT = OUTPUTS / "SE-Path学伴_最终发布门禁报告_机器生成.json"


CONFIRMATION_KEYS = [
    "team_name_matches_platform",
    "members_match_platform",
    "access_policy_confirmed",
    "video_version_confirmed",
    "no_unverified_real_course_claims",
    "sha256_saved_after_upload",
]


def load_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def sha256_file(path: Path) -> str:
    if not path.exists() or not path.is_file():
        return ""
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def rel(path: Path) -> str:
    try:
        return path.resolve().relative_to(ROOT).as_posix()
    except ValueError:
        return str(path)


def latest_release_summary() -> dict[str, Any]:
    data = load_json(RELEASE_REPORT)
    return data.get("summary", {}) if isinstance(data.get("summary"), dict) else {}


def build_todo_profile() -> dict[str, Any]:
    template = deepcopy(load_json(PROFILE_TEMPLATE))
    receipt = load_json(FINAL_RECEIPT)
    public_url_ready = receipt.get("status") == "ready_for_platform" and receipt.get("public_https_check") is True
    public_url = str(receipt.get("url") or "PENDING_FINAL_PUBLIC_URL")

    template["profile_owner"] = "提交日前由参赛队负责人根据比赛平台真实信息填写"
    template.setdefault("team", {})["name"] = "【待填写：与比赛平台完全一致的队伍名】"
    template["team"]["members"] = [
        {
            "name": "【待填写：成员姓名】",
            "school": "【待填写：学校】",
            "major": "【待填写：专业】",
            "role": "【待填写：项目负责人/算法/前端/后端/文档路演】",
            "contact_for_platform": "【待填写：平台要求的联系方式；不要放入公开 ZIP】",
        }
    ]

    submission = template.setdefault("submission", {})
    submission["access_policy"] = "public_cloud_after_permission_switch" if public_url_ready else "owner_only_cloud_plus_public_static_bundle"
    submission["public_static_bundle"] = "参赛提交材料包/公开试用静态包/index.html"
    submission["public_upload_zip"] = "参赛提交材料包/public-site-upload/SE-Path学伴_公开静态站点上传包_v0.1.zip"
    submission["cloud_url"] = public_url if public_url_ready else "PENDING_FINAL_PUBLIC_URL"
    submission["final_public_url_receipt"] = "submission/final_public_url_receipt.json"
    submission["video_policy"] = "caption_material_v0.3"
    submission["demo_video"] = "参赛提交材料包/演示视频素材/SE-Path学伴_4分40秒演示视频素材_v0.3.mp4"
    submission["real_course_claim_policy"] = "synthetic_replay_only_until_pilot"
    submission["pilot_evidence_path"] = ""
    submission["final_package_manifest"] = rel(PACKAGE_MANIFEST)

    confirmed = template.setdefault("confirmed", {})
    for key in CONFIRMATION_KEYS:
        confirmed[key] = False
    return template


def build_manual_gates() -> list[dict[str, str]]:
    return [
        {
            "id": "team-name",
            "field": "team.name",
            "owner": "队长",
            "required_evidence": "比赛平台报名页显示的最终队伍名",
            "write_to": "submission/final_submission_profile.json",
            "must_not": "不要使用临时队名或路演预演队名。",
        },
        {
            "id": "members",
            "field": "team.members[]",
            "owner": "队长",
            "required_evidence": "比赛平台成员列表、学校、专业、角色",
            "write_to": "submission/final_submission_profile.json",
            "must_not": "不要补写没有报名的成员或联系方式。",
        },
        {
            "id": "public-url",
            "field": "submission.cloud_url",
            "owner": "部署成员",
            "required_evidence": "final_public_url_receipt.json status=ready_for_platform",
            "write_to": "submission/final_submission_profile.json 与 10_比赛平台填写文案.md",
            "must_not": "不要把 owner-only 私有地址写成公开评审地址。",
        },
        {
            "id": "video-version",
            "field": "submission.video_policy",
            "owner": "视频成员",
            "required_evidence": "最终视频可播放且口径未夸大真实课程效果",
            "write_to": "submission/final_submission_profile.json",
            "must_not": "如果重新录旁白，必须重新看完整视频再确认。",
        },
        {
            "id": "claim-policy",
            "field": "submission.real_course_claim_policy",
            "owner": "路演负责人",
            "required_evidence": "若选择 pilot_evidence_attached，必须提供真实授权和试点证据路径",
            "write_to": "submission/final_submission_profile.json",
            "must_not": "当前没有真实试点数据时不能宣称真实长期提分。",
        },
        {
            "id": "sha256-receipt",
            "field": "confirmed.sha256_saved_after_upload",
            "owner": "提交成员",
            "required_evidence": "平台提交回执截图、最终 ZIP SHA256、提交时间",
            "write_to": "submission/final_submission_profile.json 与 submission/final_named/README",
            "must_not": "不要在未保存回执截图前关闭提交页。",
        },
    ]


def build_report() -> dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()
    release_summary = latest_release_summary()
    release_snapshot = {
        "release_gate": release_summary.get("release_gate"),
        "command_failures": release_summary.get("command_failures"),
        "audit_summary": release_summary.get("audit_summary"),
        "screenshots_skipped": release_summary.get("screenshots_skipped"),
        "metadata_authority": "Current package size and SHA256 are intentionally not embedded in this in-package workspace; use submission manifest and release gate report.",
    }
    receipt = load_json(FINAL_RECEIPT)
    public_launch = load_json(PUBLIC_LAUNCH)
    upload_manifest = load_json(UPLOAD_MANIFEST)
    package_manifest = load_json(PACKAGE_MANIFEST)
    todo_profile = build_todo_profile()
    gates = build_manual_gates()
    public_url_ready = receipt.get("status") == "ready_for_platform" and receipt.get("public_https_check") is True

    checks = [
        {
            "id": "release-gate",
            "status": "PASS" if release_summary.get("release_gate") == "PASS" and release_summary.get("command_failures") == 0 else "WATCH",
            "evidence": f"release_gate={release_summary.get('release_gate')} command_failures={release_summary.get('command_failures')}",
        },
        {
            "id": "public-upload-zip",
            "status": "PASS" if upload_manifest.get("checks_summary", {}).get("FAIL") == 0 and upload_manifest.get("zip_integrity") == "pass" else "WATCH",
            "evidence": f"sha256={upload_manifest.get('zip_sha256')} size={upload_manifest.get('zip_size_bytes')}",
        },
        {
            "id": "final-url",
            "status": "PASS" if public_url_ready else "MANUAL",
            "evidence": f"status={receipt.get('status')} url={receipt.get('url')}",
        },
        {
            "id": "profile-template",
            "status": "PASS" if todo_profile.get("schema") == "sepath-final-submission-profile.v1" else "FAIL",
            "evidence": f"schema={todo_profile.get('schema')}",
        },
        {
            "id": "manual-gates-retained",
            "status": "PASS" if all(todo_profile.get("confirmed", {}).get(key) is False for key in CONFIRMATION_KEYS) else "FAIL",
            "evidence": "all confirmation flags remain false in todo profile",
        },
        {
            "id": "package-manifest",
            "status": "PASS" if package_manifest.get("package") and package_manifest.get("file_count", 0) >= 700 else "WATCH",
            "evidence": f"package={package_manifest.get('package')} metadata_authority={rel(PACKAGE_MANIFEST)}",
        },
    ]

    status = "ready_for_named_submission" if public_url_ready and all(item["status"] == "PASS" for item in checks) else "manual_required"
    next_commands = [
        "rtk python scripts/build_final_submission_profile.py --team-name \"<比赛平台队伍名>\" --member \"姓名|学校|专业|角色|平台联系方式\" --access-policy public_cloud_after_permission_switch --cloud-url \"https://<最终公开URL>\" --video-policy caption_material_v0.3 --claim-policy synthetic_replay_only_until_pilot --write --print-next-commands",
        "rtk python scripts/prepare_final_named_submission.py --profile \"submission/final_submission_profile.json\" --dry-run",
        "rtk python scripts/prepare_final_named_submission.py --profile \"submission/final_submission_profile.json\" --write",
        "rtk python scripts/release_gate.py --skip-screenshots",
    ]
    fallback_commands = [
        "rtk python scripts/finalize_public_url_receipt.py --url https://your-public-demo.example --write",
        "rtk python scripts/finalize_public_url_receipt.py --url https://your-public-demo.example --write --sync-platform-copy",
        "rtk python scripts/generate_final_submission_workspace.py --write",
    ]

    return {
        "runtime": "sepath-final-submission-workspace.v1",
        "generated_at": now,
        "status": status,
        "public_url_ready": public_url_ready,
        "todo_profile": rel(TODO_PROFILE),
        "manual_checklist_md": rel(MANUAL_MD),
        "manual_checklist_json": rel(MANUAL_JSON),
        "packaged_workspace": rel(PACKAGED_WORKSPACE),
        "packaged_todo_profile": rel(PACKAGED_TODO_PROFILE),
        "packaged_manual_checklist_md": rel(PACKAGED_MANUAL_MD),
        "packaged_manual_checklist_json": rel(PACKAGED_MANUAL_JSON),
        "material_md": rel(MATERIAL_MD),
        "material_json": rel(MATERIAL_JSON),
        "release_gate": release_snapshot,
        "public_launch_status": public_launch.get("status"),
        "final_url_receipt": {
            "path": rel(FINAL_RECEIPT),
            "status": receipt.get("status"),
            "url": receipt.get("url"),
            "public_https_check": receipt.get("public_https_check"),
            "validation_summary": receipt.get("validation_summary"),
        },
        "upload_artifact": {
            "manifest": rel(UPLOAD_MANIFEST),
            "zip_name": upload_manifest.get("zip_name"),
            "zip_sha256": upload_manifest.get("zip_sha256"),
            "zip_size_bytes": upload_manifest.get("zip_size_bytes"),
            "checks_summary": upload_manifest.get("checks_summary"),
        },
        "package": {
            "manifest": rel(PACKAGE_MANIFEST),
            "package": package_manifest.get("package"),
            "metadata_authority": "Use the submission manifest and release gate report for final size, file count, and SHA256. This workspace avoids embedding self-referential ZIP metadata.",
        },
        "manual_gates": gates,
        "checks": checks,
        "todo_profile_preview": todo_profile,
        "next_commands_after_manual_fill": next_commands,
        "commands_after_public_url_ready": fallback_commands,
        "truth_boundary": "This workspace prepares final submission facts for human confirmation. It must not be used to invent team members, public URLs, platform receipts, or real-course gains.",
    }


def render_manual_checklist(report: dict[str, Any]) -> str:
    lines = [
        "# 正式提交人工门禁清单",
        "",
        f"生成时间：{report['generated_at']}",
        f"状态：`{report['status']}`",
        "",
        "## 必填项",
        "",
    ]
    for gate in report["manual_gates"]:
        lines.extend(
            [
                f"### {gate['id']}",
                "",
                f"- 字段：`{gate['field']}`",
                f"- 负责人：{gate['owner']}",
                f"- 证据：{gate['required_evidence']}",
                f"- 写入：{gate['write_to']}",
                f"- 禁止：{gate['must_not']}",
                "",
            ]
        )
    lines.extend(
        [
            "## 填完后执行",
            "",
            "```bash",
            *report["next_commands_after_manual_fill"],
            "```",
            "",
        ]
    )
    return "\n".join(lines)


def render_packaged_readme(report: dict[str, Any]) -> str:
    return "\n".join(
        [
            "# 正式提交填报工作台安全副本",
            "",
            "本目录会进入阶段提交 ZIP，只包含待填模板、人工门禁和机器清单，不包含真实成员联系方式。",
            "",
            f"- 状态：`{report['status']}`",
            f"- 待填画像：`{report['packaged_todo_profile']}`",
            f"- 人工清单：`{report['packaged_manual_checklist_md']}`",
            f"- 机器清单：`{report['packaged_manual_checklist_json']}`",
            "",
            "正式提交前，请在本地 `submission/final_submission_profile.json` 填写真信息，不要把真实联系方式加入公开阶段包。",
            "",
            report["truth_boundary"],
            "",
        ]
    )


def render_material(report: dict[str, Any]) -> str:
    lines = [
        "# 68 正式提交填报工作台与人工门禁补全卡",
        "",
        "本文档把正式提交前必须由团队确认的信息收束到一个工作台，避免临场把队伍名、成员、公开视频地址、视频版本或真实试点效果写错。",
        "",
        "## 一、当前状态",
        "",
        f"- runtime：`{report['runtime']}`",
        f"- status：`{report['status']}`",
        f"- release gate：`{report['release_gate'].get('release_gate')}` / command_failures `{report['release_gate'].get('command_failures')}`",
        f"- 最终公开 URL：`{report['final_url_receipt'].get('url')}`",
        f"- 最终公开 URL 状态：`{report['final_url_receipt'].get('status')}`",
        f"- 上传 ZIP SHA256：`{report['upload_artifact'].get('zip_sha256')}`",
        f"- 阶段提交包元数据：`{report['package'].get('metadata_authority')}`",
        "",
        "## 二、人工门禁",
        "",
        "| 门禁 | 字段 | 负责人 | 证据 | 禁止事项 |",
        "| --- | --- | --- | --- | --- |",
    ]
    for gate in report["manual_gates"]:
        lines.append(
            f"| {gate['id']} | `{gate['field']}` | {gate['owner']} | {gate['required_evidence']} | {gate['must_not']} |"
        )
    lines.extend(
        [
            "",
            "## 三、生成的工作文件",
            "",
            f"- 待填画像草案：`{report['todo_profile']}`",
            f"- 人工清单：`{report['manual_checklist_md']}`",
            f"- 机器可读清单：`{report['manual_checklist_json']}`",
            f"- 阶段包安全副本：`{report['packaged_workspace']}`",
            "",
            "## 四、填完后执行",
            "",
            "```bash",
            *report["next_commands_after_manual_fill"],
            "```",
            "",
            "如果先拿到最终公网 URL，先执行：",
            "",
            "```bash",
            *report["commands_after_public_url_ready"],
            "```",
            "",
            "## 五、边界",
            "",
            report["truth_boundary"],
            "",
        ]
    )
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate the final submission manual workspace.")
    parser.add_argument("--write", action="store_true", help="Write material and submission workspace files.")
    args = parser.parse_args()

    report = build_report()
    if args.write:
        SUBMISSION.mkdir(parents=True, exist_ok=True)
        MATERIALS.mkdir(parents=True, exist_ok=True)
        PACKAGED_WORKSPACE.mkdir(parents=True, exist_ok=True)
        TODO_PROFILE.write_text(json.dumps(report["todo_profile_preview"], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        MANUAL_JSON.write_text(json.dumps({"runtime": report["runtime"], "status": report["status"], "manual_gates": report["manual_gates"], "checks": report["checks"]}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        MANUAL_MD.write_text(render_manual_checklist(report), encoding="utf-8")
        PACKAGED_TODO_PROFILE.write_text(json.dumps(report["todo_profile_preview"], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        PACKAGED_MANUAL_JSON.write_text(json.dumps({"runtime": report["runtime"], "status": report["status"], "manual_gates": report["manual_gates"], "checks": report["checks"]}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        PACKAGED_MANUAL_MD.write_text(render_manual_checklist(report), encoding="utf-8")
        PACKAGED_README.write_text(render_packaged_readme(report), encoding="utf-8")
        material_report = dict(report)
        material_report.pop("todo_profile_preview", None)
        MATERIAL_JSON.write_text(json.dumps(material_report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        MATERIAL_MD.write_text(render_material(material_report), encoding="utf-8")

    output = dict(report)
    output.pop("todo_profile_preview", None)
    print(json.dumps(output, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
