from __future__ import annotations

import hashlib
import json
import re
import zipfile
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "submission"
PACKAGE_NAME = "SE-Path学伴_阶段提交包_v0.4_2026-08-09.zip"
MANIFEST_NAME = "SE-Path学伴_阶段提交包_v0.4_2026-08-09_manifest.json"

INCLUDE_PATHS = [
    ROOT / "SE-Path学伴_软件工程自适应学习伙伴智能体_产品设计方案",
    ROOT / "sepath-cloud-app",
    ROOT / "sepath-sites-app",
    ROOT / "参赛提交材料包",
    ROOT / "scripts",
]

EXCLUDED_PARTS = {
    ".git",
    ".next",
    ".vinext",
    ".vite",
    ".wrangler",
    "__pycache__",
    ".pytest_cache",
    "node_modules",
    "outputs",
    "submission",
    "work",
}
EXCLUDED_SUFFIXES = {
    ".log",
    ".tsbuildinfo",
    ".tmp",
}
EXCLUDED_FILENAMES = {
    "SE-Path学伴_答辩PPT_v0.1.pptx",
    "SE-Path学伴_答辩PPT_v0.1.pptx.inspect.ndjson",
}
TEXT_SUFFIXES = {
    ".css",
    ".env",
    ".example",
    ".html",
    ".js",
    ".json",
    ".md",
    ".mjs",
    ".puml",
    ".ts",
    ".tsx",
    ".txt",
    ".yaml",
    ".yml",
}
TEXT_NAMES = {
    ".dockerignore",
    "Dockerfile",
    "nginx.conf",
}
SECRET_PATTERNS = [
    re.compile(r"sk-(?=[A-Za-z0-9_-]*\d)[A-Za-z0-9_-]{20,}"),
    re.compile(r"OPENAI_API_KEY\s*=\s*\S+"),
    re.compile(r"HUAWEICLOUD_(?:AK|SK)\s*=\s*\S+"),
    re.compile(r"AKIA[0-9A-Z]{16}"),
]


def should_exclude(path: Path) -> bool:
    relative = path.relative_to(ROOT)
    parts = set(relative.parts)
    if parts & EXCLUDED_PARTS:
        return True
    if any(part.startswith("chrome-profile") for part in relative.parts):
        return True
    if path.name in EXCLUDED_FILENAMES:
        return True
    if path.suffix in EXCLUDED_SUFFIXES:
        return True
    return False


def iter_files() -> list[Path]:
    files: list[Path] = []
    for item in INCLUDE_PATHS:
        if not item.exists():
            continue
        if item.is_file():
            if not should_exclude(item):
                files.append(item)
            continue
        for path in item.rglob("*"):
            if path.is_file() and not should_exclude(path):
                files.append(path)
    return sorted(set(files), key=lambda p: p.relative_to(ROOT).as_posix())


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def scan_secrets(files: list[Path]) -> list[dict[str, str | int]]:
    hits: list[dict[str, str | int]] = []
    for path in files:
        if path.suffix not in TEXT_SUFFIXES and path.name not in TEXT_NAMES:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for line_no, line in enumerate(text.splitlines(), 1):
            for pattern in SECRET_PATTERNS:
                if pattern.search(line):
                    hits.append(
                        {
                            "path": path.relative_to(ROOT).as_posix(),
                            "line": line_no,
                            "pattern": pattern.pattern,
                        }
                    )
    return hits


def main() -> None:
    OUT_DIR.mkdir(exist_ok=True)
    files = iter_files()
    package_path = OUT_DIR / PACKAGE_NAME
    manifest_path = OUT_DIR / MANIFEST_NAME

    secret_hits = scan_secrets(files)
    required_paths = {
        path.relative_to(ROOT).as_posix(): path.exists() for path in INCLUDE_PATHS
    }

    with zipfile.ZipFile(package_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in files:
            archive.write(path, path.relative_to(ROOT).as_posix())

    with zipfile.ZipFile(package_path) as archive:
        bad_entry = archive.testzip()

    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "package": package_path.name,
        "package_size_bytes": package_path.stat().st_size,
        "package_sha256": sha256_file(package_path),
        "file_count": len(files),
        "included_roots": [path.relative_to(ROOT).as_posix() for path in INCLUDE_PATHS],
        "excluded_parts": sorted(EXCLUDED_PARTS),
        "excluded_suffixes": sorted(EXCLUDED_SUFFIXES),
        "excluded_filenames": sorted(EXCLUDED_FILENAMES),
        "checks": {
            "required_paths": required_paths,
            "zip_integrity": "pass" if bad_entry is None else f"fail:{bad_entry}",
            "secret_scan_hits": secret_hits,
            "size_under_100mb": package_path.stat().st_size < 100 * 1024 * 1024,
        },
    }
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    if bad_entry is not None:
        raise SystemExit(f"ZIP integrity failed at {bad_entry}")
    if secret_hits:
        raise SystemExit("Secret scan found potential sensitive values.")
    if not manifest["checks"]["size_under_100mb"]:
        raise SystemExit("Package is larger than 100MB.")


if __name__ == "__main__":
    main()
