from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import zipfile
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SUBMISSION = ROOT / "submission"
PENDING_DIR = SUBMISSION / "v2_final_submission_pending_name"
FINAL_ROOT = SUBMISSION / "v2_final_named"
DEFAULT_PROFILE = SUBMISSION / "v2_final_submission_profile.template.json"
PLACEHOLDER_MARKERS = ("待填写", "TODO", "TBD", "请替换", "示例")
PLACEHOLDER_PREFIX = "队伍名待填写+SE-Path学伴"
REQUIRED_CONFIRMATIONS = (
    "team_name_confirmed",
    "work_name_confirmed",
    "members_confirmed",
    "platform_upload_mode_confirmed",
    "video_version_confirmed",
    "no_unverified_real_course_claims",
    "privacy_boundary_confirmed",
)


def sanitize_filename_part(value: str) -> str:
    cleaned = re.sub(r'[<>:"/\\|?*\x00-\x1F]', "", value.strip())
    cleaned = re.sub(r"\s+", "", cleaned)
    if not cleaned:
        raise ValueError("name becomes empty after sanitizing")
    return cleaned


def has_placeholder(value: Any) -> bool:
    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return True
        return any(marker in stripped for marker in PLACEHOLDER_MARKERS)
    if isinstance(value, list):
        return any(has_placeholder(item) for item in value)
    if isinstance(value, dict):
        return any(has_placeholder(item) for item in value.values())
    return False


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_profile(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def validate_profile(profile: dict[str, Any]) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    if profile.get("schema") != "sepath-v2-final-submission-profile.v1":
        errors.append("schema must be sepath-v2-final-submission-profile.v1")

    team = profile.get("team", {})
    work = profile.get("work", {})
    submission = profile.get("submission", {})
    confirmations = profile.get("confirmations", {})
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
                warnings.append(
                    f"team.members[{index}].contact_for_platform is missing or placeholder; "
                    "do not publish contact info unless the platform requires it"
                )

    upload_mode = str(submission.get("upload_mode", "")).strip()
    if upload_mode not in {"zip", "multi_file", "zip_or_multi_file_pending"}:
        warnings.append("submission.upload_mode should be zip, multi_file, or zip_or_multi_file_pending")
    if submission.get("need_public_url") is True and has_placeholder(submission.get("final_public_url")):
        errors.append("final_public_url is required when need_public_url is true")
    if submission.get("real_course_claim_policy") != "synthetic_replay_only_until_pilot":
        warnings.append("real_course_claim_policy should remain conservative unless real pilot evidence is attached")

    missing_confirmations = [key for key in REQUIRED_CONFIRMATIONS if confirmations.get(key) is not True]
    if missing_confirmations:
        errors.append("missing confirmations: " + ", ".join(missing_confirmations))

    return errors, warnings


def replace_text_in_file(path: Path, replacement: str) -> None:
    if path.suffix.lower() not in {".md", ".json", ".txt"}:
        return
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return
    path.write_text(text.replace(PLACEHOLDER_PREFIX, replacement), encoding="utf-8")


def safe_remove_tree(path: Path) -> None:
    resolved = path.resolve()
    root = FINAL_ROOT.resolve()
    if root not in resolved.parents and resolved != root:
        raise RuntimeError(f"refuse to remove outside final root: {path}")
    shutil.rmtree(resolved)


def build_manifest(package_dir: Path, profile: dict[str, Any]) -> dict[str, Any]:
    manifest_path = package_dir / "MANIFEST_SHA256.json"
    files = sorted(
        [path for path in package_dir.rglob("*") if path.is_file() and path != manifest_path],
        key=lambda item: item.relative_to(package_dir).as_posix(),
    )
    entries = [
        {
            "path": path.relative_to(package_dir).as_posix(),
            "size": path.stat().st_size,
            "sha256": sha256_file(path),
        }
        for path in files
    ]
    manifest = {
        "schema": "sepath-v2-final-named-submission-manifest.v1",
        "team_name": profile["team"]["name"],
        "work_name": profile["work"]["name"],
        "generated_at": "2026-08-24",
        "package_dir": str(package_dir),
        "file_count": len(entries),
        "total_bytes": sum(entry["size"] for entry in entries),
        "files": entries,
        "boundary": [
            "增值评价只做形成性诊断和学习支持",
            "不做排名、不做惩罚、不做就业预测",
            "AI 只生成候选建议，教师确认后发布",
            "证据不足时显示不确定或待补证",
        ],
    }
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return manifest


def make_zip(package_dir: Path, zip_path: Path) -> str:
    if zip_path.exists():
        zip_path.unlink()
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(package_dir.rglob("*"), key=lambda item: item.relative_to(package_dir).as_posix()):
            if path.is_file():
                archive.write(path, path.relative_to(package_dir).as_posix())
    return sha256_file(zip_path)


def prepare(profile_path: Path, *, check_only: bool, force: bool) -> dict[str, Any]:
    profile = load_profile(profile_path)
    errors, warnings = validate_profile(profile)
    if check_only:
        return {
            "status": "READY" if not errors else "BLOCKED_BY_HUMAN_INPUT",
            "errors": errors,
            "warnings": warnings,
            "profile": str(profile_path),
        }
    if errors:
        return {
            "status": "BLOCKED_BY_HUMAN_INPUT",
            "errors": errors,
            "warnings": warnings,
            "profile": str(profile_path),
        }

    if not PENDING_DIR.exists():
        raise FileNotFoundError(f"missing pending package dir: {PENDING_DIR}")

    team_name = sanitize_filename_part(str(profile["team"]["name"]))
    work_name = sanitize_filename_part(str(profile["work"]["name"]))
    name_prefix = f"{team_name}+{work_name}"
    package_dir = FINAL_ROOT / f"{name_prefix}_正式提交包"
    zip_path = SUBMISSION / f"{name_prefix}_正式提交包_2026-08-24.zip"

    if package_dir.exists():
        if not force:
            return {
                "status": "BLOCKED_EXISTING_OUTPUT",
                "errors": [f"output exists: {package_dir}; rerun with --force to replace this generated folder"],
                "warnings": warnings,
            }
        safe_remove_tree(package_dir)

    shutil.copytree(PENDING_DIR, package_dir)
    for path in sorted(package_dir.rglob("*"), key=lambda item: len(item.parts), reverse=True):
        replace_text_in_file(path, name_prefix)
        if PLACEHOLDER_PREFIX in path.name:
            path.rename(path.with_name(path.name.replace(PLACEHOLDER_PREFIX, name_prefix)))

    manifest = build_manifest(package_dir, profile)
    zip_sha256 = make_zip(package_dir, zip_path)
    return {
        "status": "PASS",
        "package_dir": str(package_dir),
        "zip": str(zip_path),
        "zip_size": zip_path.stat().st_size,
        "zip_sha256": zip_sha256,
        "manifest_file_count": manifest["file_count"],
        "warnings": warnings,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepare SE-Path v2 final named submission package.")
    parser.add_argument("--profile", type=Path, default=DEFAULT_PROFILE)
    parser.add_argument("--check", action="store_true", help="Only validate the profile; do not generate package.")
    parser.add_argument("--force", action="store_true", help="Replace generated output under submission/v2_final_named.")
    args = parser.parse_args()
    print(json.dumps(prepare(args.profile, check_only=args.check, force=args.force), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
