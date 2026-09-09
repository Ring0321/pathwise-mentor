from __future__ import annotations

import argparse
import csv
import hashlib
import json
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
MATERIALS = ROOT / "参赛提交材料包"
UPLOAD_MANIFEST = MATERIALS / "public-site-upload" / "PUBLIC_SITE_UPLOAD_MANIFEST.json"
UPLOAD_ZIP = MATERIALS / "public-site-upload" / "SE-Path学伴_公开静态站点上传包_v0.1.zip"
PACK_DIR = MATERIALS / "public-hosting-selftest"
REPORT_MD = MATERIALS / "67_静态托管平台配置自检与故障恢复卡.md"
REPORT_JSON = MATERIALS / "67_静态托管平台配置自检与故障恢复卡_机器可读.json"

SELFTEST_JSON = PACK_DIR / "HOSTING_UPLOAD_SELFTEST.json"
MANIFEST_CHECKS = PACK_DIR / "manifest_checks.json"
README = PACK_DIR / "README.md"
PROVIDER_MATRIX = PACK_DIR / "HOSTING_PROVIDER_MATRIX.csv"
TROUBLESHOOTING = PACK_DIR / "HOSTING_TROUBLESHOOTING.md"
RUN_PS1 = PACK_DIR / "RUN_HOSTING_SELFTEST.ps1"
RUN_CMD = PACK_DIR / "RUN_HOSTING_SELFTEST.cmd"

REQUIRED_ZIP_ENTRIES = {
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
    "_redirects",
    "_headers",
    ".nojekyll",
    "404.html",
    "vercel.json",
    "netlify.toml",
    "nginx.conf.example",
    "DEPLOY_TARGETS.md",
    "PUBLIC_SITE_UPLOAD_MANIFEST.embedded.json",
}


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def read_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def check(check_id: str, passed: bool, evidence: str, path: Path | str) -> dict[str, str]:
    return {
        "id": check_id,
        "status": "PASS" if passed else "FAIL",
        "evidence": evidence,
        "path": rel(path) if isinstance(path, Path) and path.exists() else str(path),
    }


def provider_rows() -> list[dict[str, str]]:
    return [
        {
            "provider": "Netlify Drop",
            "upload_mode": "drag public-site-upload zip",
            "spa_fallback": "_redirects and netlify.toml must route /* to /index.html",
            "asset_header": "_headers and netlify.toml should be retained",
            "post_deploy_probe": "/PUBLIC_HEALTH.json and /PUBLIC_RELEASE.json return 200",
            "risk": "Nested directory upload makes root index missing.",
        },
        {
            "provider": "Cloudflare Pages Direct Upload",
            "upload_mode": "upload extracted folder or zip root",
            "spa_fallback": "single page app fallback to /index.html",
            "asset_header": "_headers may be ignored; keep static JSON public",
            "post_deploy_probe": "/manifest.webmanifest, /sw.js, /PUBLIC_HEALTH.json return 200",
            "risk": "Wrong project root or default framework build command.",
        },
        {
            "provider": "Vercel Static Project",
            "upload_mode": "import static output or use zip contents as root",
            "spa_fallback": "vercel.json rewrites route misses to /index.html",
            "asset_header": "vercel.json header hints must not block public JSON",
            "post_deploy_probe": "run finalize_public_url_receipt.py with https URL",
            "risk": "Vercel may treat repository as framework app if uploaded incorrectly.",
        },
        {
            "provider": "OpenAI Sites historical project recovery",
            "upload_mode": "recover appgprj_6a77745a9e58819186547db92121650b before saving a new version, or use the static upload ZIP",
            "spa_fallback": "do not create an untracked second Sites project while .openai/hosting.json keeps the historical project_id",
            "asset_header": "Sites packaging must preserve public JSON and PWA assets",
            "post_deploy_probe": "63_Sites preflight records project_not_found; seal the final public URL with finalize_public_url_receipt.py",
            "risk": "Historical version 3 cannot be described as the latest public deployment until a new version is saved and deployed.",
        },
        {
            "provider": "Nginx or school static server",
            "upload_mode": "extract zip to site root",
            "spa_fallback": "nginx.conf.example documents try_files $uri $uri/ /index.html",
            "asset_header": "application/json for public JSON files",
            "post_deploy_probe": "/assets/*.js and /assets/*.css reachable",
            "risk": "MIME type or fallback config blocks PWA files.",
        },
        {
            "provider": "GitHub Pages fallback",
            "upload_mode": "publish extracted root",
            "spa_fallback": ".nojekyll and 404.html root fallback copy retained",
            "asset_header": "default static headers",
            "post_deploy_probe": "root, static JSON, and screenshots reachable",
            "risk": "Project pages add a base path; final URL must include it.",
        },
    ]


def zip_rows(manifest: dict[str, Any]) -> tuple[list[dict[str, str]], list[str]]:
    rows: list[dict[str, str]] = []
    names: set[str] = set()
    embedded: dict[str, Any] = {}
    bad_entry: str | None = None
    if UPLOAD_ZIP.exists():
        with zipfile.ZipFile(UPLOAD_ZIP) as archive:
            bad_entry = archive.testzip()
            names = set(archive.namelist())
            if "PUBLIC_SITE_UPLOAD_MANIFEST.embedded.json" in names:
                embedded = json.loads(archive.read("PUBLIC_SITE_UPLOAD_MANIFEST.embedded.json").decode("utf-8"))
    missing = sorted(REQUIRED_ZIP_ENTRIES - names)
    rows.extend(
        [
            check("upload-zip-exists", UPLOAD_ZIP.exists() and UPLOAD_ZIP.stat().st_size > 1000, f"{UPLOAD_ZIP.stat().st_size if UPLOAD_ZIP.exists() else 0} bytes", UPLOAD_ZIP),
            check("upload-zip-integrity", UPLOAD_ZIP.exists() and bad_entry is None, "zipfile.testzip pass" if bad_entry is None else f"bad={bad_entry}", UPLOAD_ZIP),
            check("upload-zip-root-index", "index.html" in names, "index.html at zip root" if "index.html" in names else "missing root index", UPLOAD_ZIP),
            check("upload-zip-required-files", not missing, "all required entries present" if not missing else ",".join(missing), UPLOAD_ZIP),
            check("upload-zip-no-nested-root", not any(name.count("/") == 1 and name.endswith("/index.html") for name in names), "root is not wrapped by an extra folder", UPLOAD_ZIP),
            check("upload-zip-size-budget", UPLOAD_ZIP.exists() and UPLOAD_ZIP.stat().st_size < 5 * 1024 * 1024, f"{UPLOAD_ZIP.stat().st_size if UPLOAD_ZIP.exists() else 0} bytes", UPLOAD_ZIP),
            check("upload-manifest-runtime", manifest.get("runtime") == "sepath-public-site-upload-artifact.v1", f"runtime={manifest.get('runtime')}", UPLOAD_MANIFEST),
            check("upload-manifest-sha-current", UPLOAD_ZIP.exists() and manifest.get("zip_sha256") == sha256_file(UPLOAD_ZIP), f"manifest={manifest.get('zip_sha256')} actual={sha256_file(UPLOAD_ZIP) if UPLOAD_ZIP.exists() else 'missing'}", UPLOAD_MANIFEST),
            check("upload-manifest-required-empty", manifest.get("required_missing") == [] and manifest.get("extra_missing") == [], f"required={manifest.get('required_missing')} extra={manifest.get('extra_missing')}", UPLOAD_MANIFEST),
            check("embedded-manifest-runtime", embedded.get("runtime") == "sepath-public-site-upload-artifact.v1", f"runtime={embedded.get('runtime')}", UPLOAD_ZIP),
            check(
                "hosting-config-files",
                {"_redirects", "_headers", ".nojekyll", "404.html", "vercel.json", "netlify.toml", "nginx.conf.example", "DEPLOY_TARGETS.md"}.issubset(names),
                "routing, header, fallback, and platform config files retained",
                UPLOAD_ZIP,
            ),
            check("public-runtime-files", {"PUBLIC_HEALTH.json", "PUBLIC_RELEASE.json"}.issubset(names), "health and release metadata retained", UPLOAD_ZIP),
        ]
    )
    return rows, missing


def build_report() -> dict[str, Any]:
    generated_at = datetime.now(timezone.utc).isoformat()
    manifest = read_json(UPLOAD_MANIFEST)
    rows, missing = zip_rows(manifest)
    summary = {
        "PASS": sum(1 for item in rows if item["status"] == "PASS"),
        "FAIL": sum(1 for item in rows if item["status"] == "FAIL"),
        "rows": len(rows),
    }
    return {
        "runtime": "sepath-public-hosting-selftest.v1",
        "generated_at": generated_at,
        "status": "ready_for_external_static_hosting" if summary["FAIL"] == 0 else "needs_fix_before_upload",
        "upload_zip": rel(UPLOAD_ZIP),
        "upload_manifest": rel(UPLOAD_MANIFEST),
        "zip_sha256": manifest.get("zip_sha256"),
        "zip_size_bytes": manifest.get("zip_size_bytes"),
        "zip_entry_count": manifest.get("zip_entry_count"),
        "summary": summary,
        "rows": rows,
        "missing_required_zip_entries": missing,
        "provider_matrix": provider_rows(),
        "after_deploy_validation": [
            "Open the generated HTTPS URL in an anonymous browser session.",
            "Run rtk python scripts/finalize_public_url_receipt.py --url https://your-public-demo.example --write.",
            "Only copy the URL into the competition platform when status=ready_for_platform and validation_summary.FAIL=0.",
            "Keep submission/final_public_url_receipt.json and submission/public_url_validation_report.json as evidence.",
        ],
        "sites_recovery_boundary": {
            "project_id": "appgprj_6a77745a9e58819186547db92121650b",
            "status": "project_not_found_requires_recovery_or_static_public_url",
            "material": "参赛提交材料包/63_Sites云端发布预检与替代上线路线.md",
            "forbidden_claim": "Do not claim the latest build is deployed to the historical Sites URL before a new Sites version is saved and deployed.",
        },
        "truth_boundary": "This selftest proves the upload artifact is structurally ready for static hosting. It does not prove the external public URL is already deployed.",
        "privacy_boundary": "Synthetic demo data only; the upload artifact contains no production credentials.",
    }


def render_readme(report: dict[str, Any]) -> str:
    return f"""# Public Hosting Selftest

This folder is the operator-facing check pack for deploying the SE-Path public static demo.

## Current Artifact

- Upload ZIP: `{report["upload_zip"]}`
- ZIP SHA256: `{report.get("zip_sha256")}`
- ZIP entries: `{report.get("zip_entry_count")}`
- Selftest: `PASS={report["summary"]["PASS"]}, FAIL={report["summary"]["FAIL"]}`

## Run

```powershell
rtk python scripts/generate_hosting_upload_selftest_pack.py --write
rtk python scripts/finalize_public_url_receipt.py --url https://your-public-demo.example --write
```

The first command checks the local upload artifact. The second command checks the real public URL after deployment.
"""


def render_material(report: dict[str, Any]) -> str:
    lines = [
        "# 67 静态托管平台配置自检与故障恢复卡",
        "",
        "本材料用于把公开静态 Demo 从“有 ZIP”推进到“可上传、可回滚、可公网验收”。它重点覆盖静态托管平台最常见的三类错误：根目录多包一层、SPA fallback 缺失、PWA/JSON 静态文件被拦截。",
        "",
        "## 一、当前自检摘要",
        "",
        f"- runtime：`{report['runtime']}`",
        f"- status：`{report['status']}`",
        f"- 上传 ZIP：`{report['upload_zip']}`",
        f"- ZIP SHA256：`{report.get('zip_sha256')}`",
        f"- ZIP 大小：`{report.get('zip_size_bytes')}` bytes",
        f"- ZIP 条目数：`{report.get('zip_entry_count')}`",
        f"- 自检：`PASS={report['summary']['PASS']}, FAIL={report['summary']['FAIL']}`",
        f"- Sites 恢复边界：`{report['sites_recovery_boundary']['status']}`",
        "",
        "## 二、提交日标准操作",
        "",
        "1. 打开 `参赛提交材料包/public-site-upload/`。",
        "2. 上传 `SE-Path学伴_公开静态站点上传包_v0.1.zip`，确保 ZIP 根目录直接就是 `index.html`。",
        "3. 若平台需要解压上传，选择解压后的根目录，不要再多选上一层文件夹。",
        "4. 部署完成后，先访问 `/PUBLIC_HEALTH.json` 和 `/PUBLIC_RELEASE.json`。",
        "5. 再运行 `rtk python scripts/finalize_public_url_receipt.py --url https://your-public-demo.example --write`。",
        "6. 只有 `status=ready_for_platform` 且 `validation_summary.FAIL=0` 时，才把 URL 填入比赛平台。",
        "",
        "## 三、平台配置矩阵",
        "",
        "| 平台 | 上传方式 | SPA fallback | 发布后探针 | 主要风险 |",
        "| --- | --- | --- | --- | --- |",
    ]
    for item in report["provider_matrix"]:
        lines.append(
            f"| {item['provider']} | {item['upload_mode']} | {item['spa_fallback']} | {item['post_deploy_probe']} | {item['risk']} |"
        )
    lines.extend(
        [
            "",
            "## 四、故障恢复",
            "",
            "- 首页 404：检查 ZIP 是否多包了一层目录，根目录必须有 `index.html`。",
            "- 页面能开但刷新 404：配置 SPA fallback，把所有路由回退到 `/index.html`。",
            "- PWA 或 JSON 404：检查 `manifest.webmanifest`、`sw.js`、`PUBLIC_HEALTH.json`、`PUBLIC_RELEASE.json` 是否在站点根目录。",
            "- 评委截图缺失：检查 `reviewer-guide-overlay.png` 和 `reviewer-guide-claim-ledger.png` 是否可访问。",
            "- 验收器关键字失败：不要手动删改 `assets/` 里的构建文件，重新运行 release gate 后再上传。",
            "",
            "## 五、边界声明",
            "",
            report["truth_boundary"],
            report["privacy_boundary"],
            "",
        ]
    )
    return "\n".join(lines)


def write_outputs(report: dict[str, Any]) -> None:
    PACK_DIR.mkdir(parents=True, exist_ok=True)
    SELFTEST_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    MANIFEST_CHECKS.write_text(json.dumps({"runtime": "sepath-public-hosting-selftest-checks.v1", "summary": report["summary"], "rows": report["rows"]}, ensure_ascii=False, indent=2), encoding="utf-8")
    README.write_text(render_readme(report), encoding="utf-8")
    TROUBLESHOOTING.write_text(render_material(report), encoding="utf-8")
    REPORT_MD.write_text(render_material(report), encoding="utf-8")
    REPORT_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    with PROVIDER_MATRIX.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=["provider", "upload_mode", "spa_fallback", "asset_header", "post_deploy_probe", "risk"])
        writer.writeheader()
        writer.writerows(report["provider_matrix"])
    RUN_PS1.write_text(
        """param(
  [string]$Url = ""
)
$ErrorActionPreference = "Stop"
rtk python scripts/generate_hosting_upload_selftest_pack.py --write
if ($Url -ne "") {
  rtk python scripts/finalize_public_url_receipt.py --url $Url --write
}
""",
        encoding="utf-8",
    )
    RUN_CMD.write_text(
        """@echo off
rtk python scripts/generate_hosting_upload_selftest_pack.py --write
if not "%~1"=="" rtk python scripts/finalize_public_url_receipt.py --url "%~1" --write
""",
        encoding="utf-8",
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate SE-Path public hosting upload selftest pack.")
    parser.add_argument("--write", action="store_true", help="Write material and selftest files.")
    args = parser.parse_args()
    report = build_report()
    if args.write:
        write_outputs(report)
    print(json.dumps({"runtime": report["runtime"], "status": report["status"], "summary": report["summary"], "upload_zip": report["upload_zip"]}, ensure_ascii=False, indent=2))
    return 0 if report["summary"]["FAIL"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
