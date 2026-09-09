from __future__ import annotations

import hashlib
import json
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
MATERIALS = ROOT / "参赛提交材料包"
STATIC_DIR = MATERIALS / "公开试用静态包"
UPLOAD_DIR = MATERIALS / "public-site-upload"

ZIP_NAME = "SE-Path学伴_公开静态站点上传包_v0.1.zip"
UPLOAD_ZIP = UPLOAD_DIR / ZIP_NAME
UPLOAD_MANIFEST = UPLOAD_DIR / "PUBLIC_SITE_UPLOAD_MANIFEST.json"
UPLOAD_README = UPLOAD_DIR / "README_公网静态上传包.md"
MATERIAL_MD = MATERIALS / "65_公网静态站点上传包与验收说明.md"
MATERIAL_JSON = MATERIALS / "65_公网静态站点上传包与验收说明_机器可读.json"

BASE_EXTRA_FILES = {
    "_redirects": "/* /index.html 200\n",
    "_headers": (
        "/assets/*\n"
        "  Cache-Control: public, max-age=604800, immutable\n"
        "\n"
        "/*\n"
        "  X-Content-Type-Options: nosniff\n"
        "  Referrer-Policy: no-referrer\n"
    ),
    ".nojekyll": "",
}


DEPLOY_CONFIG_FILES = {
    "404.html",
    "vercel.json",
    "netlify.toml",
    "nginx.conf.example",
    "DEPLOY_TARGETS.md",
}

REQUIRED_STATIC_FILES = [
    "index.html",
    "manifest.webmanifest",
    "sw.js",
    "offline.html",
    "PUBLIC_TRIAL_MANIFEST.json",
    "PUBLIC_HEALTH.json",
    "PUBLIC_RELEASE.json",
    "JUDGE_DEMO_SEED_MANIFEST.json",
    "REVIEWER_DRILL_REPORT.json",
    "reviewer-guide-overlay.png",
    "reviewer-guide-claim-ledger.png",
    "public-url-receipt-panel.png",
    "submission-closure-panel.png",
]


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def collect_static_files() -> list[Path]:
    return sorted((path for path in STATIC_DIR.rglob("*") if path.is_file()), key=lambda item: item.relative_to(STATIC_DIR).as_posix())


def render_deploy_targets_md() -> str:
    return f"""# SE-Path Static Hosting Targets

This folder is intentionally host-neutral. Upload the ZIP root directly; the root must contain `index.html`.

## Included routing files

- `_redirects`: Netlify and Cloudflare Pages single-page app fallback.
- `_headers`: cache and browser safety headers for static hosts that support it.
- `.nojekyll`: GitHub Pages should not process the bundle through Jekyll.
- `404.html`: GitHub Pages route fallback copy of `index.html`.
- `vercel.json`: Vercel static rewrite and header hints.
- `netlify.toml`: Netlify redirect/header fallback when the platform reads TOML config.
- `nginx.conf.example`: school or self-hosted Nginx reference config.

## Required post-deploy validation

```powershell
rtk python scripts/finalize_public_url_receipt.py --url https://your-public-demo.example --write
```

Only submit the public URL after `status=ready_for_platform` and `validation_summary.FAIL=0`.

Package name: `{ZIP_NAME}`
"""


def build_extra_files() -> dict[str, bytes]:
    index_path = STATIC_DIR / "index.html"
    index_bytes = index_path.read_bytes() if index_path.exists() else b""
    vercel_config = {
        "cleanUrls": True,
        "trailingSlash": False,
        "headers": [
            {
                "source": "/assets/(.*)",
                "headers": [
                    {"key": "Cache-Control", "value": "public, max-age=604800, immutable"},
                    {"key": "X-Content-Type-Options", "value": "nosniff"},
                ],
            },
            {
                "source": "/(.*)",
                "headers": [
                    {"key": "Referrer-Policy", "value": "no-referrer"},
                    {"key": "X-Content-Type-Options", "value": "nosniff"},
                ],
            },
        ],
        "rewrites": [{"source": "/(.*)", "destination": "/index.html"}],
    }
    netlify_toml = """[[redirects]]
from = "/*"
to = "/index.html"
status = 200

[[headers]]
for = "/assets/*"
[headers.values]
Cache-Control = "public, max-age=604800, immutable"
X-Content-Type-Options = "nosniff"

[[headers]]
for = "/*"
[headers.values]
Referrer-Policy = "no-referrer"
X-Content-Type-Options = "nosniff"
"""
    nginx_conf = """# Copy these blocks into a server block whose root points at the extracted ZIP root.
location / {
    try_files $uri $uri/ /index.html;
}

location ~* \\.(js|css|png|svg|webmanifest)$ {
    try_files $uri =404;
    add_header Cache-Control "public, max-age=604800, immutable";
    add_header X-Content-Type-Options "nosniff";
}

location ~* \\.(json|html|js)$ {
    add_header Referrer-Policy "no-referrer";
    add_header X-Content-Type-Options "nosniff";
}
"""
    files = {name: content.encode("utf-8") for name, content in BASE_EXTRA_FILES.items()}
    files.update(
        {
            "404.html": index_bytes,
            "vercel.json": (json.dumps(vercel_config, ensure_ascii=False, indent=2) + "\n").encode("utf-8"),
            "netlify.toml": netlify_toml.encode("utf-8"),
            "nginx.conf.example": nginx_conf.encode("utf-8"),
            "DEPLOY_TARGETS.md": render_deploy_targets_md().encode("utf-8"),
        }
    )
    return files


def build_zip(static_files: list[Path], embedded_manifest: dict[str, Any], extra_files: dict[str, bytes]) -> None:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(UPLOAD_ZIP, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in static_files:
            archive.write(path, path.relative_to(STATIC_DIR).as_posix())
        for name, content in extra_files.items():
            archive.writestr(name, content)
        archive.writestr(
            "PUBLIC_SITE_UPLOAD_MANIFEST.embedded.json",
            json.dumps(embedded_manifest, ensure_ascii=False, indent=2),
        )


def zip_names() -> set[str]:
    with zipfile.ZipFile(UPLOAD_ZIP) as archive:
        return set(archive.namelist())


def zip_integrity() -> str:
    with zipfile.ZipFile(UPLOAD_ZIP) as archive:
        bad = archive.testzip()
    return "pass" if bad is None else f"fail:{bad}"


def render_upload_readme(manifest: dict[str, Any]) -> str:
    return f"""# SE-Path 学伴公网静态站点上传包

本目录用于正式提交前的公网部署。`{ZIP_NAME}` 的根目录就是 `index.html`，可直接上传到 Netlify Drop、Cloudflare Pages Direct Upload、Vercel 静态项目、学校静态服务器或任意 Nginx 静态站点。

## 文件

- `{ZIP_NAME}`：可直接上传的静态站点 ZIP。
- `PUBLIC_SITE_UPLOAD_MANIFEST.json`：上传包 SHA256、文件清单、托管配置和验收命令。

## 上传后必须做的验收

```bash
rtk python scripts/finalize_public_url_receipt.py --url https://your-public-demo.example --write
```

如果报告为 `ready_for_platform`，再同步比赛平台文案：

```bash
rtk python scripts/finalize_public_url_receipt.py --url https://your-public-demo.example --write --sync-platform-copy
```

## 当前包信息

- ZIP SHA256：`{manifest["zip_sha256"]}`
- ZIP 大小：`{manifest["zip_size_bytes"]}` bytes
- ZIP 文件数：`{manifest["zip_entry_count"]}`
- 静态源目录：`{manifest["source_dir"]}`

## 边界

该上传包只包含合成演示数据、PWA 文件、评委导览报告、种子数据和主张账本截图，不包含真实学生数据、API Key、生产数据库地址或私有账号密码。
"""


def render_material_md(manifest: dict[str, Any]) -> str:
    return f"""# 65 公网静态站点上传包与验收说明

本文档用于把 SE-Path 学伴从“可本地打开的公开静态包”推进到“可拖拽上传、可公网验收、可复制到比赛平台”的交付形态。

## 一、上传包位置

```text
参赛提交材料包/public-site-upload/{ZIP_NAME}
```

上传包根目录直接包含 `index.html`，并附带 `_redirects`、`_headers` 和 `.nojekyll`，用于降低 Netlify、Cloudflare Pages、GitHub Pages、Nginx 等静态托管平台的 SPA 路由和缓存配置风险。

## 二、机器摘要

| 项 | 值 |
| --- | --- |
| runtime | `{manifest["runtime"]}` |
| ZIP SHA256 | `{manifest["zip_sha256"]}` |
| ZIP 大小 | `{manifest["zip_size_bytes"]}` bytes |
| ZIP 条目数 | `{manifest["zip_entry_count"]}` |
| ZIP 完整性 | `{manifest["zip_integrity"]}` |
| 静态源目录 | `{manifest["source_dir"]}` |
| 隐私边界 | {manifest["privacy_boundary"]} |

## 三、推荐上传路线

1. 打开 `参赛提交材料包/public-site-upload/`。
2. 将 `{ZIP_NAME}` 上传到静态托管平台。
3. 确认站点根目录是 ZIP 根目录，而不是多包了一层文件夹。
4. 打开平台生成的 HTTPS URL。
5. 运行最终公网回执：

```bash
rtk python scripts/finalize_public_url_receipt.py --url https://your-public-demo.example --write
```

6. 只有当回执 `status=ready_for_platform` 且 `validation_summary.FAIL=0` 时，才把该 URL 填入比赛平台。
7. 如需同步平台文案，运行：

```bash
rtk python scripts/finalize_public_url_receipt.py --url https://your-public-demo.example --write --sync-platform-copy
```

## 四、验收范围

- 首页返回 2xx/3xx。
- JS/CSS 构建资产可访问。
- `manifest.webmanifest`、`sw.js`、`offline.html` 可访问。
- `PUBLIC_TRIAL_MANIFEST.json`、`PUBLIC_HEALTH.json`、`PUBLIC_RELEASE.json`、`JUDGE_DEMO_SEED_MANIFEST.json`、`REVIEWER_DRILL_REPORT.json` 可访问。
- `reviewer-guide-overlay.png`、`reviewer-guide-claim-ledger.png`、`public-url-receipt-panel.png` 与 `submission-closure-panel.png` 可访问。
- 页面或构建资产包含 SE-Path、SafeVOI、EvidenceEvent、主张证据账本、学习增值、评委、不能宣称等关键产品文案。

## 五、边界声明

该上传包证明作品具备公开只读静态部署和评委试用能力；它不证明真实学校生产系统已经接入，也不证明真实课程长期提分。真实课程效果仍需要后续试点、教师确认 A/B、脱敏遥测和因果验证。
"""


def build_manifest() -> dict[str, Any]:
    if not STATIC_DIR.exists():
        raise FileNotFoundError(f"public static bundle not found: {STATIC_DIR}")

    static_files = collect_static_files()
    static_file_rows = [
        {
            "path": path.relative_to(STATIC_DIR).as_posix(),
            "bytes": path.stat().st_size,
            "sha256": sha256_file(path),
        }
        for path in static_files
    ]
    generated_at = datetime.now(timezone.utc).isoformat()
    extra_files = build_extra_files()
    embedded_manifest = {
        "runtime": "sepath-public-site-upload-artifact.v1",
        "generated_at": generated_at,
        "source_dir": STATIC_DIR.relative_to(ROOT).as_posix(),
        "extra_files": sorted(extra_files),
        "deploy_config_files": sorted(DEPLOY_CONFIG_FILES),
        "required_static_files": REQUIRED_STATIC_FILES,
        "public_runtime_files": ["PUBLIC_HEALTH.json", "PUBLIC_RELEASE.json"],
        "truth_boundary": "Synthetic public demo only; no real student data or production credentials.",
    }
    build_zip(static_files, embedded_manifest, extra_files)
    names = zip_names()
    required_missing = [name for name in REQUIRED_STATIC_FILES if name not in names]
    extra_missing = [name for name in extra_files if name not in names]
    deploy_config_missing = sorted(DEPLOY_CONFIG_FILES - names)
    manifest = {
        **embedded_manifest,
        "zip_path": UPLOAD_ZIP.relative_to(ROOT).as_posix(),
        "zip_size_bytes": UPLOAD_ZIP.stat().st_size,
        "zip_sha256": sha256_file(UPLOAD_ZIP),
        "zip_integrity": zip_integrity(),
        "zip_entry_count": len(names),
        "zip_contains_root_index": "index.html" in names,
        "required_missing": required_missing,
        "extra_missing": extra_missing,
        "deploy_config_missing": deploy_config_missing,
        "deploy_targets": [
            "Netlify Drop",
            "Cloudflare Pages Direct Upload",
            "Vercel static project",
            "GitHub Pages",
            "OpenAI Sites fallback source",
            "Nginx static hosting",
            "school static server",
        ],
        "post_deploy_validation_command": "rtk python scripts/finalize_public_url_receipt.py --url https://your-public-demo.example --write",
        "sync_platform_copy_command": "rtk python scripts/finalize_public_url_receipt.py --url https://your-public-demo.example --write --sync-platform-copy",
        "privacy_boundary": "Synthetic demo data only; no student PII, API key, external credential, or production database URL is included.",
        "static_files": static_file_rows,
        "extra_file_hashes": {name: sha256_bytes(content) for name, content in extra_files.items()},
        "checks_summary": {
            "PASS": sum(
                [
                    zip_integrity() == "pass",
                    "index.html" in names,
                    not required_missing,
                    not extra_missing,
                    not deploy_config_missing,
                    UPLOAD_ZIP.stat().st_size < 5 * 1024 * 1024,
                ]
            ),
            "FAIL": sum(
                [
                    zip_integrity() != "pass",
                    "index.html" not in names,
                    bool(required_missing),
                    bool(extra_missing),
                    bool(deploy_config_missing),
                    UPLOAD_ZIP.stat().st_size >= 5 * 1024 * 1024,
                ]
            ),
            "rows": 6,
        },
    }
    return manifest


def main() -> int:
    manifest = build_manifest()
    UPLOAD_MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    UPLOAD_README.write_text(render_upload_readme(manifest), encoding="utf-8")
    MATERIAL_MD.write_text(render_material_md(manifest), encoding="utf-8")
    material_json = {
        "runtime": "sepath-public-site-upload-material.v1",
        "generated_at": manifest["generated_at"],
        "upload_manifest": UPLOAD_MANIFEST.relative_to(ROOT).as_posix(),
        "upload_zip": UPLOAD_ZIP.relative_to(ROOT).as_posix(),
        "upload_readme": UPLOAD_README.relative_to(ROOT).as_posix(),
        "zip_sha256": manifest["zip_sha256"],
        "zip_size_bytes": manifest["zip_size_bytes"],
        "zip_entry_count": manifest["zip_entry_count"],
        "checks_summary": manifest["checks_summary"],
        "post_deploy_validation_command": manifest["post_deploy_validation_command"],
        "sync_platform_copy_command": manifest["sync_platform_copy_command"],
        "truth_boundary": manifest["truth_boundary"],
    }
    MATERIAL_JSON.write_text(json.dumps(material_json, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(material_json, ensure_ascii=False, indent=2))
    return 0 if manifest["checks_summary"]["FAIL"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
