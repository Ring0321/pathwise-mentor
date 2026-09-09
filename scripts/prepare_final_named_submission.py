from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
MATERIALS = ROOT / "参赛提交材料包"
SUBMISSION = ROOT / "submission"
OUT_DIR = SUBMISSION / "final_named"
PROFILE_SCHEMA = "sepath-final-submission-profile.v1"
PROFILE_TEMPLATE = MATERIALS / "54_正式提交画像配置模板.json"
PLACEHOLDER_MARKERS = ("待填写", "TODO", "TBD", "请替换", "示例")
ALLOWED_ACCESS_POLICIES = {
    "public_static_bundle",
    "owner_only_cloud_plus_public_static_bundle",
    "local_demo_plus_video_fallback",
    "public_cloud_after_permission_switch",
}
ALLOWED_VIDEO_POLICIES = {
    "caption_material_v0.3",
    "human_voiceover_rebuilt_and_rewatched",
}
ALLOWED_CLAIM_POLICIES = {
    "synthetic_replay_only_until_pilot",
    "pilot_evidence_attached",
}


SOURCE_FILES = [
    {
        "key": "package",
        "label": "阶段提交完整包",
        "path": SUBMISSION / "SE-Path学伴_阶段提交包_v0.4_2026-08-09.zip",
        "suffix": "完整提交包.zip",
    },
    {
        "key": "plan_pdf",
        "label": "项目计划书 PDF",
        "path": MATERIALS / "SE-Path学伴_产品设计与原型验证方案_v0.2.pdf",
        "suffix": "项目计划书.pdf",
    },
    {
        "key": "defense_ppt",
        "label": "答辩 PPT",
        "path": MATERIALS / "SE-Path学伴_答辩PPT_v0.2.pptx",
        "suffix": "答辩PPT.pptx",
    },
    {
        "key": "demo_video",
        "label": "演示视频",
        "path": MATERIALS / "演示视频素材" / "SE-Path学伴_4分40秒演示视频素材_v0.3.mp4",
        "suffix": "演示视频.mp4",
    },
    {
        "key": "upload_manual",
        "label": "最终上传作战手册",
        "path": MATERIALS / "40_最终提交上传作战手册.md",
        "suffix": "最终上传作战手册.md",
    },
]


def sanitize_filename_part(value: str) -> str:
    cleaned = re.sub(r'[<>:"/\\|?*\x00-\x1F]', "", value.strip())
    cleaned = re.sub(r"\s+", "", cleaned)
    if not cleaned:
        raise ValueError("team name and work name cannot be empty after sanitizing")
    return cleaned


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def has_placeholder(value: Any) -> bool:
    if isinstance(value, str):
        stripped = value.strip()
        return not stripped or any(marker in stripped for marker in PLACEHOLDER_MARKERS)
    if isinstance(value, list):
        return any(has_placeholder(item) for item in value)
    if isinstance(value, dict):
        return any(has_placeholder(item) for item in value.values())
    return False


def profile_values(profile: dict[str, Any]) -> tuple[str, str]:
    team_name = str(profile.get("team", {}).get("name", "")).strip()
    work_name = str(profile.get("work", {}).get("name", "SE-Path学伴")).strip() or "SE-Path学伴"
    return team_name, work_name


def validate_profile(profile: dict[str, Any], *, require_confirmed: bool) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []
    if profile.get("schema") != PROFILE_SCHEMA:
        errors.append(f"profile.schema must be {PROFILE_SCHEMA}")

    team = profile.get("team", {})
    work = profile.get("work", {})
    submission = profile.get("submission", {})
    confirmed = profile.get("confirmed", {})
    members = team.get("members", [])

    if has_placeholder(team.get("name")):
        errors.append("team.name is empty or still contains a placeholder")
    if has_placeholder(work.get("name")):
        errors.append("work.name is empty or still contains a placeholder")
    if not isinstance(members, list) or not members:
        errors.append("team.members must contain at least one member")
    else:
        for index, member in enumerate(members, 1):
            for field in ("name", "school", "major", "role"):
                if has_placeholder(member.get(field)):
                    errors.append(f"team.members[{index}].{field} is missing or placeholder")
            if has_placeholder(member.get("contact_for_platform")):
                warnings.append(f"team.members[{index}].contact_for_platform is still placeholder; keep it out of public materials if privacy sensitive")

    access_policy = submission.get("access_policy")
    video_policy = submission.get("video_policy")
    claim_policy = submission.get("real_course_claim_policy")
    if access_policy not in ALLOWED_ACCESS_POLICIES:
        errors.append(f"submission.access_policy must be one of {sorted(ALLOWED_ACCESS_POLICIES)}")
    if video_policy not in ALLOWED_VIDEO_POLICIES:
        errors.append(f"submission.video_policy must be one of {sorted(ALLOWED_VIDEO_POLICIES)}")
    if claim_policy not in ALLOWED_CLAIM_POLICIES:
        errors.append(f"submission.real_course_claim_policy must be one of {sorted(ALLOWED_CLAIM_POLICIES)}")
    if claim_policy == "pilot_evidence_attached" and has_placeholder(submission.get("pilot_evidence_path")):
        errors.append("pilot_evidence_path is required when pilot_evidence_attached is selected")

    required_confirmations = [
        "team_name_matches_platform",
        "members_match_platform",
        "access_policy_confirmed",
        "video_version_confirmed",
        "no_unverified_real_course_claims",
        "sha256_saved_after_upload",
    ]
    missing_confirmations = [key for key in required_confirmations if confirmed.get(key) is not True]
    if missing_confirmations:
        message = "missing confirmations: " + ", ".join(missing_confirmations)
        if require_confirmed:
            errors.append(message)
        else:
            warnings.append(message)

    return {
        "schema": profile.get("schema"),
        "errors": errors,
        "warnings": warnings,
        "ready_for_write": not errors and (not require_confirmed or not missing_confirmations),
        "access_policy": access_policy,
        "video_policy": video_policy,
        "real_course_claim_policy": claim_policy,
        "member_count": len(members) if isinstance(members, list) else 0,
    }


def plan_outputs(team_name: str, work_name: str) -> list[dict[str, Any]]:
    team = sanitize_filename_part(team_name)
    work = sanitize_filename_part(work_name)
    prefix = f"{team}+{work}"
    rows: list[dict[str, Any]] = []
    for item in SOURCE_FILES:
        source = item["path"]
        target = OUT_DIR / f"{prefix}_{item['suffix']}"
        rows.append(
            {
                "key": item["key"],
                "label": item["label"],
                "source": source,
                "target": target,
                "source_exists": source.exists() and source.is_file(),
                "bytes": source.stat().st_size if source.exists() and source.is_file() else 0,
                "source_sha256": sha256_file(source) if source.exists() and source.is_file() else "",
            }
        )
    return rows


def render_readme(
    team_name: str,
    work_name: str,
    rows: list[dict[str, Any]],
    profile_validation: dict[str, Any] | None,
) -> str:
    lines = [
        f"# {team_name}+{work_name} 正式命名材料包",
        "",
        f"生成时间：{datetime.now(timezone.utc).isoformat()}",
        "",
        "本目录由 `scripts/prepare_final_named_submission.py` 生成，只包含正式提交时便于上传的命名副本；原始材料不被修改。",
        "",
        "## 文件清单",
        "",
        "| 材料 | 文件名 | 大小 | SHA256 |",
        "| --- | --- | --- | --- |",
    ]
    for row in rows:
        lines.append(f"| {row['label']} | `{row['target'].name}` | {row['bytes']} bytes | `{row['source_sha256']}` |")
    lines.extend(
        [
            "",
            "## 使用建议",
            "",
            "1. 若平台只能上传一个文件，优先上传完整提交包 ZIP。",
            "2. 若平台分栏上传，按项目计划书 PDF、演示视频、答辩 PPT、完整提交包 ZIP 的顺序上传。",
            "3. 上传前仍需人工核对队伍名、队员信息、云端访问策略和真实效果声明边界。",
            "",
            "## 提交画像校验",
            "",
        ]
    )
    if profile_validation:
        lines.extend(
            [
                f"- 画像 schema：`{profile_validation.get('schema')}`",
                f"- 访问策略：`{profile_validation.get('access_policy')}`",
                f"- 视频策略：`{profile_validation.get('video_policy')}`",
                f"- 效果声明策略：`{profile_validation.get('real_course_claim_policy')}`",
                f"- 队员数量：`{profile_validation.get('member_count')}`",
                f"- 错误数：`{len(profile_validation.get('errors', []))}`",
                f"- 提醒数：`{len(profile_validation.get('warnings', []))}`",
                "",
            ]
        )
    else:
        lines.extend(
            [
                "- 本次未使用 `--profile`，仅按命令行队伍名和作品名生成命名副本。",
                f"- 建议复制 `{PROFILE_TEMPLATE.relative_to(ROOT).as_posix()}` 到 `submission/final_submission_profile.json`，补齐后用 `--profile` 生成正式版。",
                "",
            ]
        )
    return "\n".join(lines)


def render_manifest(
    team_name: str,
    work_name: str,
    rows: list[dict[str, Any]],
    readme: Path,
    profile_path: Path | None,
    profile_validation: dict[str, Any] | None,
) -> dict[str, Any]:
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "team_name": team_name,
        "work_name": work_name,
        "profile": {
            "path": str(profile_path) if profile_path else "",
            "validation": profile_validation,
            "privacy_note": "真实成员联系方式建议只保存在 submission/final_submission_profile.json，不纳入公开阶段提交 ZIP。",
        },
        "output_dir": str(OUT_DIR),
        "readme": str(readme),
        "files": [
            {
                "key": row["key"],
                "label": row["label"],
                "source": str(row["source"]),
                "target": str(row["target"]),
                "bytes": row["target"].stat().st_size if row["target"].exists() else row["bytes"],
                "source_sha256": row["source_sha256"],
                "target_sha256": sha256_file(row["target"]) if row["target"].exists() else "",
            }
            for row in rows
        ],
        "manual_gates_retained": [
            "team_name_and_member_info_must_match_competition_platform",
            "access_policy_must_be_confirmed_before_public_submission",
            "voiceover_video_is_optional_but_must_be_rewatched_if_rebuilt",
            "real_course_effect_claims_require_later_pilot_evidence",
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Create final submission copies named as team+work.")
    parser.add_argument("--profile", type=Path, help="JSON profile with final team/member/access/video confirmation.")
    parser.add_argument("--team-name", help="Official team name from the competition platform.")
    parser.add_argument("--work-name", help="Official work/product name.")
    parser.add_argument("--dry-run", action="store_true", help="Only print the planned output files.")
    parser.add_argument("--write", action="store_true", help="Create final named copies under submission/final_named.")
    args = parser.parse_args()

    if args.dry_run and args.write:
        parser.error("--dry-run and --write cannot be used together")

    profile_path = args.profile.resolve() if args.profile else None
    profile: dict[str, Any] | None = None
    profile_validation: dict[str, Any] | None = None
    profile_team = ""
    profile_work = ""
    if profile_path:
        if not profile_path.exists():
            parser.error(f"profile not found: {profile_path}")
        profile = load_json(profile_path)
        profile_team, profile_work = profile_values(profile)
        profile_validation = validate_profile(profile, require_confirmed=args.write)

    team_name = args.team_name or profile_team
    work_name = args.work_name or profile_work or "SE-Path学伴"
    if not team_name:
        parser.error("--team-name is required unless --profile supplies team.name")

    rows = plan_outputs(team_name, work_name)
    missing = [row for row in rows if not row["source_exists"]]
    result = {
        "team_name": team_name,
        "work_name": work_name,
        "mode": "write" if args.write else "dry-run",
        "output_dir": str(OUT_DIR),
        "profile": {
            "path": str(profile_path) if profile_path else "",
            "validation": profile_validation,
        },
        "missing": [{"label": row["label"], "source": str(row["source"])} for row in missing],
        "files": [
            {
                "label": row["label"],
                "source": str(row["source"]),
                "target": str(row["target"]),
                "bytes": row["bytes"],
                "source_sha256": row["source_sha256"],
            }
            for row in rows
        ],
    }
    if missing:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 1
    if args.write and profile_validation and profile_validation["errors"]:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 2

    if args.write:
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        for row in rows:
            shutil.copy2(row["source"], row["target"])
        readme = OUT_DIR / f"{sanitize_filename_part(team_name)}+{sanitize_filename_part(work_name)}_上传说明.md"
        readme.write_text(render_readme(team_name, work_name, rows, profile_validation), encoding="utf-8")
        manifest = OUT_DIR / f"{sanitize_filename_part(team_name)}+{sanitize_filename_part(work_name)}_manifest.json"
        manifest.write_text(
            json.dumps(
                render_manifest(team_name, work_name, rows, readme, profile_path, profile_validation),
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        result["readme"] = str(readme)
        result["manifest"] = str(manifest)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
