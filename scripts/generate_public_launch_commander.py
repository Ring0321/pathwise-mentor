from __future__ import annotations

import argparse
import json
import zipfile
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


ROOT = Path(__file__).resolve().parents[1]
MATERIALS = ROOT / "参赛提交材料包"
COMMAND_DIR = MATERIALS / "public-launch-command"
UPLOAD_MANIFEST = MATERIALS / "public-site-upload" / "PUBLIC_SITE_UPLOAD_MANIFEST.json"
PLATFORM_COPY = MATERIALS / "10_比赛平台填写文案.md"

MATERIAL_MD = MATERIALS / "66_公网发布指挥台与提交日操作卡.md"
MATERIAL_JSON = MATERIALS / "66_公网发布指挥台与提交日操作卡_机器可读.json"
COMMAND_JSON = COMMAND_DIR / "PUBLIC_LAUNCH_COMMAND.json"
LAUNCH_STEPS_MD = COMMAND_DIR / "LAUNCH_STEPS.md"
RUN_PS1 = COMMAND_DIR / "RUN_AFTER_DEPLOY.ps1"
RUN_CMD = COMMAND_DIR / "RUN_AFTER_DEPLOY.cmd"
REPORT_JSON = SUBMISSION / "public_launch_command_report.json"


def load_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def check(label: str, passed: bool, evidence: str, path: Path | str) -> dict[str, str]:
    return {
        "label": label,
        "status": "PASS" if passed else "FAIL",
        "evidence": evidence,
        "path": rel(path) if isinstance(path, Path) else path,
    }


def summarize(rows: list[dict[str, str]]) -> dict[str, int]:
    return {
        "PASS": sum(1 for row in rows if row["status"] == "PASS"),
        "FAIL": sum(1 for row in rows if row["status"] == "FAIL"),
        "rows": len(rows),
    }


def upload_zip_check(upload_manifest: dict[str, Any]) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    zip_path_text = upload_manifest.get("zip_path", "")
    upload_zip = ROOT / zip_path_text if zip_path_text else MATERIALS / "public-site-upload" / "SE-Path学伴_公开静态站点上传包_v0.1.zip"
    rows.append(
        check(
            "公网静态上传 manifest 可读",
            upload_manifest.get("runtime") == "sepath-public-site-upload-artifact.v1",
            f"runtime={upload_manifest.get('runtime')}",
            UPLOAD_MANIFEST,
        )
    )
    rows.append(
        check(
            "公网静态上传 ZIP 存在",
            upload_zip.exists() and upload_zip.stat().st_size > 1000,
            f"{upload_zip.stat().st_size if upload_zip.exists() else 0} bytes",
            upload_zip,
        )
    )
    if upload_zip.exists():
        with zipfile.ZipFile(upload_zip) as archive:
            bad = archive.testzip()
            names = set(archive.namelist())
        required = {
            "index.html",
            "_redirects",
            "_headers",
            ".nojekyll",
            "404.html",
            "vercel.json",
            "netlify.toml",
            "nginx.conf.example",
            "DEPLOY_TARGETS.md",
            "manifest.webmanifest",
            "sw.js",
            "offline.html",
            "PUBLIC_TRIAL_MANIFEST.json",
            "PUBLIC_HEALTH.json",
            "PUBLIC_RELEASE.json",
            "JUDGE_DEMO_SEED_MANIFEST.json",
            "REVIEWER_DRILL_REPORT.json",
            "reviewer-guide-claim-ledger.png",
        }
        missing = sorted(required - names)
        rows.append(
            check(
                "公网静态上传 ZIP 根目录可部署",
                bad is None and not missing,
                "zip ok; root assets and hosting config present" if bad is None and not missing else f"bad={bad} missing={','.join(missing)}",
                upload_zip,
            )
        )
    else:
        rows.append(check("公网静态上传 ZIP 根目录可部署", False, "upload zip missing", upload_zip))
    rows.append(
        check(
            "公网静态上传包机器摘要通过",
            upload_manifest.get("checks_summary", {}).get("FAIL") == 0
            and upload_manifest.get("zip_integrity") == "pass"
            and upload_manifest.get("zip_contains_root_index") is True
            and upload_manifest.get("required_missing") == []
            and upload_manifest.get("extra_missing") == [],
            f"summary={upload_manifest.get('checks_summary')} sha={upload_manifest.get('zip_sha256')}",
            UPLOAD_MANIFEST,
        )
    )
    return rows


def platform_steps(platform: str) -> list[dict[str, str]]:
    common_zip = "参赛提交材料包/public-site-upload/SE-Path学伴_公开静态站点上传包_v0.1.zip"
    steps = [
        {
            "id": "prepare",
            "title": "确认上传包",
            "action": f"打开 {common_zip}，确认 ZIP 根目录就是 index.html。",
            "evidence": "PUBLIC_SITE_UPLOAD_MANIFEST.json 中 zip_integrity=pass。",
        },
        {
            "id": "upload",
            "title": "上传到静态托管平台",
            "action": {
                "netlify": "将 ZIP 拖到 Netlify Drop 或站点 Deploys 上传区。",
                "cloudflare": "在 Cloudflare Pages 选择 Direct Upload，将 ZIP 或解压后的目录作为站点根目录上传。",
                "vercel": "创建静态前端项目，使用 ZIP 内容作为站点根目录或上传解压目录。",
                "school": "上传到学校 HTTPS 静态服务器，配置所有路径回退到 /index.html。",
                "manual": "上传到任意 HTTPS 静态托管平台，保证根目录包含 index.html。",
            }.get(platform, "上传到任意 HTTPS 静态托管平台，保证根目录包含 index.html。"),
            "evidence": "平台生成一个 https:// 开头的公开 URL。",
        },
        {
            "id": "validate",
            "title": "运行公网机器验收",
            "action": "rtk python scripts/finalize_public_url_receipt.py --url <最终URL> --write",
            "evidence": "submission/final_public_url_receipt.json status=ready_for_platform。",
        },
        {
            "id": "sync",
            "title": "同步比赛平台文案",
            "action": "rtk python scripts/finalize_public_url_receipt.py --url <最终URL> --write --sync-platform-copy",
            "evidence": "10_比赛平台填写文案.md 的云端演示地址与回执 URL 完全一致。",
        },
        {
            "id": "submit",
            "title": "提交平台",
            "action": "复制 final_public_url_receipt.md 的比赛平台粘贴块，并保存平台回执截图。",
            "evidence": "平台回执、最终 URL 回执、主提交包 SHA256 均归档。",
        },
    ]
    return steps


def render_steps_md(report: dict[str, Any]) -> str:
    lines = [
        "# 公网发布提交日操作卡",
        "",
        f"生成时间：{report['generated_at']}",
        f"当前状态：`{report['status']}`",
        f"目标平台：`{report['platform']}`",
        f"最终 URL：`{report['url']}`",
        "",
        "## 上传包",
        "",
        f"- 上传 ZIP：`{report['upload_zip']}`",
        f"- 上传 ZIP SHA256：`{report['upload_zip_sha256']}`",
        f"- 上传 ZIP 大小：`{report['upload_zip_size_bytes']}` bytes",
        "",
        "## 操作步骤",
        "",
    ]
    for index, step in enumerate(report["steps"], 1):
        lines.append(f"{index}. {step['title']}：{step['action']}")
        lines.append(f"   验收证据：{step['evidence']}")
    lines.extend(
        [
            "",
            "## 平台粘贴块",
            "",
            "```text",
            *report["platform_paste_block"],
            "```",
            "",
            "## 边界",
            "",
            report["truth_boundary"],
            "",
        ]
    )
    return "\n".join(lines)


def render_material(report: dict[str, Any]) -> str:
    summary = report["checks_summary"]
    lines = [
        "# 66 公网发布指挥台与提交日操作卡",
        "",
        "本文档把公网静态上传包、最终 URL 机器验收、平台文案同步和提交后回执归档串成一条可执行路线。它解决的是提交日最容易出错的一步：地址能不能匿名打开，以及能不能被机器证明。",
        "",
        "## 一、当前状态",
        "",
        f"- runtime：`{report['runtime']}`",
        f"- 状态：`{report['status']}`",
        f"- 目标平台：`{report['platform']}`",
        f"- 最终 URL：`{report['url']}`",
        f"- 自动检查：PASS `{summary['PASS']}` / FAIL `{summary['FAIL']}` / ROWS `{summary['rows']}`",
        f"- 上传 ZIP：`{report['upload_zip']}`",
        f"- 上传 ZIP SHA256：`{report['upload_zip_sha256']}`",
        "",
        "## 二、提交日五步",
        "",
    ]
    for index, step in enumerate(report["steps"], 1):
        lines.append(f"{index}. **{step['title']}**：{step['action']}")
        lines.append(f"   证据：{step['evidence']}")
    lines.extend(
        [
            "",
            "## 三、最终验收命令",
            "",
            "```bash",
            report["url_validation_command"],
            "```",
            "",
            "同步平台文案：",
            "",
            "```bash",
            report["sync_platform_copy_command"],
            "```",
            "",
            "## 四、边界声明",
            "",
            report["truth_boundary"],
            "",
        ]
    )
    return "\n".join(lines)


def write_run_scripts() -> None:
    RUN_PS1.write_text(
        """param(
  [Parameter(Mandatory=$true)]
  [string]$Url
)

rtk python scripts\\finalize_public_url_receipt.py --url $Url --write
Write-Host "If status is ready_for_platform, run:" -ForegroundColor Cyan
Write-Host "rtk python scripts\\finalize_public_url_receipt.py --url $Url --write --sync-platform-copy"
""",
        encoding="utf-8",
    )
    RUN_CMD.write_text(
        """@echo off
if "%~1"=="" (
  echo Usage: RUN_AFTER_DEPLOY.cmd https://your-public-demo.example
  exit /b 2
)
rtk python scripts\\finalize_public_url_receipt.py --url "%~1" --write
echo If status is ready_for_platform, run:
echo rtk python scripts\\finalize_public_url_receipt.py --url "%~1" --write --sync-platform-copy
""",
        encoding="utf-8",
    )


def build_report(platform: str, url: str | None, sync_platform_copy_flag: bool, write_receipt: bool = False) -> dict[str, Any]:
    upload_manifest = load_json(UPLOAD_MANIFEST)
    receipt = build_receipt(url) if url else build_receipt(None)
    validation = receipt.pop("validation")
    if url or write_receipt:
        SUBMISSION.mkdir(parents=True, exist_ok=True)
        VALIDATION_REPORT.write_text(json.dumps(validation, ensure_ascii=False, indent=2), encoding="utf-8")
        RECEIPT_JSON.write_text(json.dumps(receipt, ensure_ascii=False, indent=2), encoding="utf-8")
        RECEIPT_MD.write_text(render_receipt_markdown(receipt), encoding="utf-8")
        if sync_platform_copy_flag:
            sync_platform_copy(receipt)

    rows = upload_zip_check(upload_manifest)
    rows.append(
        check(
            "最终 URL 回执状态合法",
            receipt.get("status") in {"pending_final_public_url", "ready_for_platform"},
            f"status={receipt.get('status')} validation={receipt.get('validation_summary')}",
            RECEIPT_JSON,
        )
    )
    platform_copy = PLATFORM_COPY.read_text(encoding="utf-8", errors="replace") if PLATFORM_COPY.exists() else ""
    cloud_url_row = next((line for line in platform_copy.splitlines() if line.startswith("| 云端演示地址 |")), "")
    rows.append(
        check(
            "平台云端演示地址安全",
            "【待填写：最终公开 URL" in cloud_url_row
            or (
                receipt.get("status") == "ready_for_platform"
                and receipt.get("public_https_check") is True
                and str(receipt.get("url", "")) in cloud_url_row
            ),
            cloud_url_row or "missing cloud URL row",
            PLATFORM_COPY,
        )
    )
    status = "ready_for_platform" if receipt.get("status") == "ready_for_platform" and summarize(rows)["FAIL"] == 0 else "awaiting_external_public_url"
    if url and receipt.get("status") != "ready_for_platform":
        status = "failed_public_url_validation"

    return {
        "runtime": "sepath-public-launch-commander.v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "status": status,
        "platform": platform,
        "url": receipt.get("url"),
        "upload_zip": upload_manifest.get("zip_path"),
        "upload_zip_sha256": upload_manifest.get("zip_sha256"),
        "upload_zip_size_bytes": upload_manifest.get("zip_size_bytes"),
        "upload_manifest": rel(UPLOAD_MANIFEST),
        "receipt_json": rel(RECEIPT_JSON),
        "receipt_md": rel(RECEIPT_MD),
        "url_validation_command": "rtk python scripts/finalize_public_url_receipt.py --url https://your-public-demo.example --write",
        "sync_platform_copy_command": "rtk python scripts/finalize_public_url_receipt.py --url https://your-public-demo.example --write --sync-platform-copy",
        "steps": platform_steps(platform),
        "checks_summary": summarize(rows),
        "checks": rows,
        "platform_paste_block": receipt.get("platform_paste_block", []),
        "truth_boundary": (
            "The launch commander proves upload readiness and, after a real public URL is supplied, URL reachability. "
            "It does not prove real school production rollout or real-course causal learning gains."
        ),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate a public launch command pack for SE-Path.")
    parser.add_argument("--platform", default="manual", choices=["manual", "netlify", "cloudflare", "vercel", "school"])
    parser.add_argument("--url", help="Final public demo URL after uploading the public-site-upload ZIP.")
    parser.add_argument("--sync-platform-copy", action="store_true", help="Sync platform copy when URL receipt is ready.")
    parser.add_argument("--write", action="store_true", help="Write material and command pack files.")
    args = parser.parse_args()

    report = build_report(args.platform, args.url, args.sync_platform_copy, write_receipt=args.write)
    if args.write:
        COMMAND_DIR.mkdir(parents=True, exist_ok=True)
        SUBMISSION.mkdir(parents=True, exist_ok=True)
        REPORT_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        COMMAND_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        LAUNCH_STEPS_MD.write_text(render_steps_md(report), encoding="utf-8")
        MATERIAL_MD.write_text(render_material(report), encoding="utf-8")
        MATERIAL_JSON.write_text(
            json.dumps(
                {
                    "runtime": "sepath-public-launch-commander-material.v1",
                    "generated_at": report["generated_at"],
                    "status": report["status"],
                    "platform": report["platform"],
                    "upload_zip": report["upload_zip"],
                    "upload_zip_sha256": report["upload_zip_sha256"],
                    "checks_summary": report["checks_summary"],
                    "command_pack": rel(COMMAND_JSON),
                    "steps": rel(LAUNCH_STEPS_MD),
                    "run_ps1": rel(RUN_PS1),
                    "run_cmd": rel(RUN_CMD),
                    "report": rel(REPORT_JSON),
                    "truth_boundary": report["truth_boundary"],
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        write_run_scripts()

    print(
        json.dumps(
            {
                "runtime": report["runtime"],
                "status": report["status"],
                "checks_summary": report["checks_summary"],
                "upload_zip": report["upload_zip"],
                "url": report["url"],
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0 if report["status"] in {"awaiting_external_public_url", "ready_for_platform"} else 1


if __name__ == "__main__":
    raise SystemExit(main())
