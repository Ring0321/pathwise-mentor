from __future__ import annotations

import hashlib
import json
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PACKAGE_DIR = ROOT / "submission" / "v2_final_submission_pending_name"
ZIP_PATH = ROOT / "submission" / "SE-Path学伴_v2正式提交包_待队伍名替换_2026-08-24.zip"
MANIFEST_PATH = PACKAGE_DIR / "MANIFEST_SHA256.json"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def collect_files(*, include_manifest: bool) -> list[Path]:
    files = []
    for path in PACKAGE_DIR.rglob("*"):
        if not path.is_file():
            continue
        if not include_manifest and path == MANIFEST_PATH:
            continue
        files.append(path)
    return sorted(files, key=lambda item: item.relative_to(PACKAGE_DIR).as_posix())


def main() -> None:
    if not PACKAGE_DIR.exists():
        raise SystemExit(f"missing package directory: {PACKAGE_DIR}")

    files = collect_files(include_manifest=False)
    entries = [
        {
            "path": path.relative_to(PACKAGE_DIR).as_posix(),
            "size": path.stat().st_size,
            "sha256": sha256_file(path),
        }
        for path in files
    ]
    manifest = {
        "schema": "sepath-v2-final-submission-pending-manifest.v1",
        "generated_at": "2026-08-24",
        "package_dir": str(PACKAGE_DIR),
        "file_count": len(entries),
        "total_bytes": sum(entry["size"] for entry in entries),
        "files": entries,
        "remaining_human_inputs": [
            "队伍名",
            "作品正式名",
            "队员信息",
            "平台上传形式",
            "公网 URL 是否需要",
        ],
        "boundary": [
            "不做排名",
            "不做惩罚",
            "不做就业预测",
            "教师确认后发布",
            "证据不足显示待补证",
        ],
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    if ZIP_PATH.exists():
        ZIP_PATH.unlink()
    with zipfile.ZipFile(ZIP_PATH, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in collect_files(include_manifest=True):
            archive.write(path, path.relative_to(PACKAGE_DIR).as_posix())

    report = {
        "manifest": str(MANIFEST_PATH),
        "zip": str(ZIP_PATH),
        "file_count_without_manifest": len(entries),
        "zip_size": ZIP_PATH.stat().st_size,
        "zip_sha256": sha256_file(ZIP_PATH),
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
