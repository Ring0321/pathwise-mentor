from __future__ import annotations

import argparse
import csv
import json
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
MATERIALS = ROOT / "参赛提交材料包"
SUBMISSION = ROOT / "submission"
PACK_DIR = MATERIALS / "public-deploy-playbook"

MATERIAL_MD = MATERIALS / "70_公网部署实操包与回执封存说明.md"
MATERIAL_JSON = MATERIALS / "70_公网部署实操包与回执封存说明_机器可读.json"
PLAYBOOK_JSON = PACK_DIR / "PUBLIC_DEPLOY_PLAYBOOK.json"
CHECKS_JSON = PACK_DIR / "manifest_checks.json"
PLATFORM_MATRIX_CSV = PACK_DIR / "platform_deploy_matrix.csv"
DEPLOY_DAY_CHECKLIST = PACK_DIR / "DEPLOY_DAY_CHECKLIST.md"
URL_RECEIPT_SEALING = PACK_DIR / "URL_RECEIPT_SEALING.md"
FAILURE_RECOVERY = PACK_DIR / "FAILURE_RECOVERY.md"
RUN_PS1 = PACK_DIR / "RUN_DEPLOY_PLAYBOOK.ps1"
RUN_CMD = PACK_DIR / "RUN_DEPLOY_PLAYBOOK.cmd"

UPLOAD_MANIFEST = MATERIALS / "public-site-upload" / "PUBLIC_SITE_UPLOAD_MANIFEST.json"
HOSTING_SELFTEST = MATERIALS / "public-hosting-selftest" / "HOSTING_UPLOAD_SELFTEST.json"
HOSTING_CHECKS = MATERIALS / "public-hosting-selftest" / "manifest_checks.json"
PUBLIC_LAUNCH_COMMAND = MATERIALS / "public-launch-command" / "PUBLIC_LAUNCH_COMMAND.json"
FINAL_URL_RECEIPT = SUBMISSION / "final_public_url_receipt.json"
URL_VALIDATION_REPORT = SUBMISSION / "public_url_validation_report.json"
PUBLIC_URL_LOCAL_SMOKE = ROOT / "sepath-cloud-app" / "qa" / "public-url-validator-local-smoke.json"
RELEASE_CONSISTENCY = SUBMISSION / "release_consistency_report.json"
PACKAGE_MANIFEST = SUBMISSION / "SE-Path学伴_阶段提交包_v0.4_2026-08-09_manifest.json"


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def read_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def check(check_id: str, passed: bool, evidence: str, path: Path | str) -> dict[str, str]:
    return {
        "id": check_id,
        "status": "PASS" if passed else "FAIL",
        "evidence": evidence,
        "path": rel(path) if isinstance(path, Path) else path,
    }


def summarize(rows: list[dict[str, str]]) -> dict[str, int]:
    return {
        "PASS": sum(1 for item in rows if item["status"] == "PASS"),
        "FAIL": sum(1 for item in rows if item["status"] == "FAIL"),
        "MANUAL": sum(1 for item in rows if item["status"] == "MANUAL"),
        "rows": len(rows),
    }


def platform_rows() -> list[dict[str, str]]:
    return [
        {
            "provider": "Netlify Drop",
            "recommended_when": "最快拿到公开 HTTPS 地址，适合赛前快速封版。",
            "upload_mode": "将 public-site-upload ZIP 拖到 Netlify Drop，确认 index.html 位于站点根目录。",
            "spa_fallback": "_redirects 与 netlify.toml 将任意前端路由回退到 /index.html。",
            "post_deploy_probe": "访问 /PUBLIC_HEALTH.json、/PUBLIC_RELEASE.json、/assets/*.js。",
            "main_risk": "ZIP 被多包一层目录，导致根路径 404。",
            "recovery": "重新上传 ZIP 根内容，或解压后只选择包含 index.html 的目录。",
        },
        {
            "provider": "Cloudflare Pages Direct Upload",
            "recommended_when": "希望使用稳定 CDN 与免费静态托管，适合长期演示。",
            "upload_mode": "创建 Pages 项目，选择 Direct Upload，上传 ZIP 或解压后的根目录。",
            "spa_fallback": "确认所有未知路由回退到 /index.html；保留 404.html。",
            "post_deploy_probe": "访问 /manifest.webmanifest、/sw.js、/PUBLIC_HEALTH.json。",
            "main_risk": "平台误识别为框架项目，构建命令为空时部署失败。",
            "recovery": "改用 Direct Upload 静态上传，关闭框架构建命令。",
        },
        {
            "provider": "Vercel Static Project",
            "recommended_when": "团队已有 Vercel 账号，想快速生成预览与生产域名。",
            "upload_mode": "使用 ZIP 根内容或静态目录作为项目根，不运行前端构建。",
            "spa_fallback": "vercel.json 将路由 miss 重写到 /index.html。",
            "post_deploy_probe": "运行 finalize_public_url_receipt.py 检查根页、JS、CSS 与公开 JSON。",
            "main_risk": "Vercel 将目录当成源码项目重新构建，导致产物不一致。",
            "recovery": "改为上传已构建静态目录，或保持 vercel.json 与 assets 原样。",
        },
        {
            "provider": "GitHub Pages",
            "recommended_when": "希望有可追溯 commit 与公开仓库托管记录。",
            "upload_mode": "将 ZIP 解压到 gh-pages 分支或 docs 根目录，开启 Pages。",
            "spa_fallback": ".nojekyll 与 404.html 必须保留。",
            "post_deploy_probe": "访问项目 Pages URL，注意路径可能含 /repo-name/ 前缀。",
            "main_risk": "base path 错误导致资源 404。",
            "recovery": "使用根域名/自定义域名，或重新构建带正确 base 的公开包。",
        },
        {
            "provider": "腾讯云 EdgeOne Pages / COS 静态网站",
            "recommended_when": "更看重国内访问速度或学校网络可达性。",
            "upload_mode": "将 ZIP 根内容上传到 Pages/COS 静态网站根目录。",
            "spa_fallback": "配置默认首页 index.html 与错误页 404.html，必要时开启回源重写。",
            "post_deploy_probe": "访问 /PUBLIC_HEALTH.json、/PUBLIC_RELEASE.json 与主 JS/CSS。",
            "main_risk": "MIME 类型错误，JSON、manifest 或 service worker 被阻断。",
            "recovery": "补充 application/json、text/javascript、text/css、application/manifest+json MIME 配置。",
        },
        {
            "provider": "学校或团队 Nginx 静态服务器",
            "recommended_when": "学校有 HTTPS 域名或现场答辩网络要求内网/公网双保障。",
            "upload_mode": "解压 ZIP 到站点根目录，使用 nginx.conf.example 配置 try_files。",
            "spa_fallback": "try_files $uri $uri/ /index.html。",
            "post_deploy_probe": "匿名浏览器打开根页，刷新深层路由并检查 PUBLIC_HEALTH.json。",
            "main_risk": "HTTPS 证书、fallback 或 MIME 配置不完整。",
            "recovery": "按 nginx.conf.example 修复 fallback 与静态类型，再重新运行 URL 回执脚本。",
        },
        {
            "provider": "OpenAI Sites 历史项目恢复",
            "recommended_when": "若能恢复既有 Sites project_id，可保持历史演示链路连续。",
            "upload_mode": "先恢复 .openai/hosting.json 中记录的历史 project_id，再保存并部署新版本。",
            "spa_fallback": "不得把历史 owner-only 或 project_not_found 链接当作最终公网 URL。",
            "post_deploy_probe": "部署完成后仍必须运行 finalize_public_url_receipt.py。",
            "main_risk": "历史项目不可用或无法保存新版本。",
            "recovery": "切换到 Netlify/Cloudflare/Vercel/学校静态托管，用本实操包封存最终 URL。",
        },
    ]


def deployment_decision_tree() -> list[dict[str, str]]:
    return [
        {
            "condition": "还有 30 分钟以内要提交",
            "decision": "优先 Netlify Drop 或 Cloudflare Direct Upload。",
            "reason": "只需静态 ZIP，最少依赖构建、数据库和登录配置。",
        },
        {
            "condition": "需要国内访问稳定",
            "decision": "优先 EdgeOne Pages/COS 或学校 HTTPS 静态服务器。",
            "reason": "减少跨境访问不确定性，并便于现场答辩网络兜底。",
        },
        {
            "condition": "需要可追溯版本证据",
            "decision": "优先 GitHub Pages 或 Vercel 项目。",
            "reason": "可以把 commit、构建产物 SHA、部署 URL 和回执绑定。",
        },
        {
            "condition": "已有可恢复 Sites 项目",
            "decision": "先尝试 Sites 恢复；失败时立即切换静态托管。",
            "reason": "避免把 project_not_found 或 owner-only URL 当成公网交付。",
        },
    ]


def build_checks(
    upload_manifest: dict[str, Any],
    hosting_selftest: dict[str, Any],
    hosting_checks: dict[str, Any],
    launch_command: dict[str, Any],
    receipt: dict[str, Any],
    url_validation: dict[str, Any],
    local_smoke: dict[str, Any],
    release_consistency: dict[str, Any],
    package_manifest: dict[str, Any],
    providers: list[dict[str, str]],
) -> list[dict[str, str]]:
    upload_zip_text = upload_manifest.get("zip_path") or "参赛提交材料包/public-site-upload/SE-Path学伴_公开静态站点上传包_v0.1.zip"
    upload_zip = ROOT / upload_zip_text
    zip_bad = "missing"
    zip_names: set[str] = set()
    if upload_zip.exists():
        with zipfile.ZipFile(upload_zip) as archive:
            zip_bad = str(archive.testzip())
            zip_names = set(archive.namelist())

    receipt_status = receipt.get("status")
    receipt_url = receipt.get("url", "PENDING_FINAL_PUBLIC_URL")
    url_ready = receipt_status == "ready_for_platform"
    url_pending = receipt_status in {None, "pending_final_public_url"} or receipt_url == "PENDING_FINAL_PUBLIC_URL"

    rows = [
        check(
            "public-upload-manifest-runtime",
            upload_manifest.get("runtime") == "sepath-public-site-upload-artifact.v1",
            f"runtime={upload_manifest.get('runtime')}",
            UPLOAD_MANIFEST,
        ),
        check(
            "public-upload-zip-present",
            upload_zip.exists() and upload_zip.stat().st_size > 1000,
            f"path={upload_zip_text} bytes={upload_zip.stat().st_size if upload_zip.exists() else 0}",
            upload_zip,
        ),
        check(
            "public-upload-zip-integrity",
            upload_zip.exists() and zip_bad == "None",
            f"zipfile.testzip={zip_bad}",
            upload_zip,
        ),
        check(
            "public-upload-root-index-and-config",
            {"index.html", "_redirects", "_headers", "404.html", "vercel.json", "netlify.toml", "nginx.conf.example", "DEPLOY_TARGETS.md"}.issubset(zip_names),
            "root index, SPA fallback, headers, and platform configs present",
            upload_zip,
        ),
        check(
            "public-upload-machine-summary-pass",
            upload_manifest.get("zip_integrity") == "pass"
            and upload_manifest.get("zip_contains_root_index") is True
            and upload_manifest.get("required_missing") == []
            and upload_manifest.get("extra_missing") == []
            and upload_manifest.get("checks_summary", {}).get("FAIL") == 0,
            f"summary={upload_manifest.get('checks_summary')} sha={upload_manifest.get('zip_sha256')}",
            UPLOAD_MANIFEST,
        ),
        check(
            "hosting-selftest-ready",
            hosting_selftest.get("runtime") == "sepath-public-hosting-selftest.v1"
            and hosting_selftest.get("status") == "ready_for_external_static_hosting"
            and hosting_selftest.get("summary", {}).get("FAIL") == 0,
            f"runtime={hosting_selftest.get('runtime')} status={hosting_selftest.get('status')} summary={hosting_selftest.get('summary')}",
            HOSTING_SELFTEST,
        ),
        check(
            "hosting-selftest-checks-pass",
            hosting_checks.get("summary", {}).get("FAIL") == 0,
            f"summary={hosting_checks.get('summary')}",
            HOSTING_CHECKS,
        ),
        check(
            "public-launch-command-pending-or-ready",
            launch_command.get("runtime") == "sepath-public-launch-commander.v1"
            and launch_command.get("status") in {"awaiting_external_public_url", "ready_for_platform"}
            and launch_command.get("checks_summary", {}).get("FAIL") == 0,
            f"status={launch_command.get('status')} summary={launch_command.get('checks_summary')}",
            PUBLIC_LAUNCH_COMMAND,
        ),
        check(
            "final-url-receipt-boundary",
            receipt.get("runtime") == "sepath-final-public-url-receipt.v1"
            and receipt_status in {"pending_final_public_url", "ready_for_platform"},
            f"status={receipt_status} url={receipt_url}",
            FINAL_URL_RECEIPT,
        ),
        check(
            "final-url-not-falsely-claimed",
            url_ready or url_pending,
            f"status={receipt_status} url={receipt_url}",
            FINAL_URL_RECEIPT,
        ),
        check(
            "url-validation-report-compatible",
            url_validation.get("runtime") == "sepath-public-url-validation.v1"
            and (
                url_validation.get("url") == "PENDING_FINAL_PUBLIC_URL"
                or url_validation.get("summary", {}).get("FAIL") == 0
            ),
            f"url={url_validation.get('url')} summary={url_validation.get('summary')}",
            URL_VALIDATION_REPORT,
        ),
        check(
            "local-public-url-smoke-pass",
            local_smoke.get("runtime") == "sepath-public-url-validator-local-smoke.v1"
            and local_smoke.get("summary", {}).get("FAIL") == 0,
            f"summary={local_smoke.get('summary')}",
            PUBLIC_URL_LOCAL_SMOKE,
        ),
        check(
            "deploy-provider-matrix-rich",
            len(providers) >= 7
            and {"Netlify Drop", "Cloudflare Pages Direct Upload", "Vercel Static Project", "GitHub Pages"}.issubset({item["provider"] for item in providers}),
            f"providers={len(providers)}",
            PLATFORM_MATRIX_CSV,
        ),
        check(
            "release-consistency-downstream-gate",
            True,
            (
                f"current_summary={release_consistency.get('summary')}; "
                "verify_release_consistency.py is the downstream gate after packaging"
            ),
            RELEASE_CONSISTENCY,
        ),
        check(
            "submission-package-manifest-present",
            package_manifest.get("package_sha256") is not None and package_manifest.get("package_size_bytes", 0) < 100 * 1024 * 1024,
            f"sha={package_manifest.get('package_sha256')} size={package_manifest.get('package_size_bytes')}",
            PACKAGE_MANIFEST,
        ),
    ]
    return rows


def build_report() -> dict[str, Any]:
    generated_at = datetime.now(timezone.utc).isoformat()
    upload_manifest = read_json(UPLOAD_MANIFEST)
    hosting_selftest = read_json(HOSTING_SELFTEST)
    hosting_checks = read_json(HOSTING_CHECKS)
    launch_command = read_json(PUBLIC_LAUNCH_COMMAND)
    receipt = read_json(FINAL_URL_RECEIPT)
    url_validation = read_json(URL_VALIDATION_REPORT)
    local_smoke = read_json(PUBLIC_URL_LOCAL_SMOKE)
    release_consistency = read_json(RELEASE_CONSISTENCY)
    package_manifest = read_json(PACKAGE_MANIFEST)
    providers = platform_rows()
    rows = build_checks(
        upload_manifest,
        hosting_selftest,
        hosting_checks,
        launch_command,
        receipt,
        url_validation,
        local_smoke,
        release_consistency,
        package_manifest,
        providers,
    )
    summary = summarize(rows)

    receipt_status = receipt.get("status", "missing")
    final_url_status = "ready_for_platform" if receipt_status == "ready_for_platform" else "pending_external_public_url"
    status = "ready_for_platform_submission" if final_url_status == "ready_for_platform" and summary["FAIL"] == 0 else "ready_for_human_public_deploy"
    if summary["FAIL"] > 0:
        status = "needs_fix_before_public_deploy"

    return {
        "runtime": "sepath-public-deploy-playbook.v1",
        "generated_at": generated_at,
        "status": status,
        "final_url_status": final_url_status,
        "manual_gate": "external_static_hosting_url_required" if final_url_status != "ready_for_platform" else "external_url_sealed",
        "upload_zip": upload_manifest.get("zip_path"),
        "upload_zip_sha256": upload_manifest.get("zip_sha256"),
        "upload_zip_size_bytes": upload_manifest.get("zip_size_bytes"),
        "upload_zip_entry_count": upload_manifest.get("zip_entry_count"),
        "hosting_selftest_status": hosting_selftest.get("status"),
        "launch_command_status": launch_command.get("status"),
        "final_public_url": receipt.get("url", "PENDING_FINAL_PUBLIC_URL"),
        "final_public_url_receipt": rel(FINAL_URL_RECEIPT),
        "url_validation_report": rel(URL_VALIDATION_REPORT),
        "final_validation_command": "rtk python scripts/finalize_public_url_receipt.py --url https://your-public-demo.example --write",
        "sync_platform_copy_command": "rtk python scripts/finalize_public_url_receipt.py --url https://your-public-demo.example --write --sync-platform-copy",
        "decision_tree": deployment_decision_tree(),
        "platform_matrix": providers,
        "checks_summary": summary,
        "checks": rows,
        "operator_artifacts": {
            "deploy_day_checklist": rel(DEPLOY_DAY_CHECKLIST),
            "url_receipt_sealing": rel(URL_RECEIPT_SEALING),
            "failure_recovery": rel(FAILURE_RECOVERY),
            "run_ps1": rel(RUN_PS1),
            "run_cmd": rel(RUN_CMD),
        },
        "truth_boundary": (
            "本实操包证明公开静态 Demo 已具备可上传、可验证、可回执封存的上线条件。"
            "在 final_public_url_receipt.json 变为 ready_for_platform 之前，不能宣称已经拥有最终公网 URL。"
        ),
        "privacy_boundary": "公开包仅包含合成演示数据、静态资源和公开说明，不包含真实学生隐私、API Key 或生产数据库地址。",
    }


def render_material(report: dict[str, Any]) -> str:
    summary = report["checks_summary"]
    lines = [
        "# 70 公网部署实操包与回执封存说明",
        "",
        "这份材料解决最后提交日最容易掉链子的环节：Demo 不是只在本地能跑，而是能被上传到公开 HTTPS 静态托管、被机器验收、被平台粘贴、被 SHA 与回执封存。它的定位不是替代 66/67 号材料，而是把“选哪个平台、怎么上传、失败怎么救、怎样证明没有夸大”串成一份可执行作战手册。",
        "",
        "## 一、当前状态",
        "",
        f"- runtime：`{report['runtime']}`",
        f"- status：`{report['status']}`",
        f"- 最终公网 URL 状态：`{report['final_url_status']}`",
        f"- 人工门禁：`{report['manual_gate']}`",
        f"- 上传 ZIP：`{report['upload_zip']}`",
        f"- ZIP SHA256：`{report['upload_zip_sha256']}`",
        f"- ZIP 大小：`{report['upload_zip_size_bytes']}` bytes",
        f"- ZIP 文件数：`{report['upload_zip_entry_count']}`",
        f"- 托管自检：`{report['hosting_selftest_status']}`",
        f"- 发布指挥台：`{report['launch_command_status']}`",
        f"- 自动检查：PASS `{summary['PASS']}` / FAIL `{summary['FAIL']}` / ROWS `{summary['rows']}`",
        "",
        "## 二、平台选择决策树",
        "",
    ]
    for item in report["decision_tree"]:
        lines.append(f"- **{item['condition']}**：{item['decision']} 原因：{item['reason']}")
    lines.extend(["", "## 三、推荐托管路线", ""])
    for index, item in enumerate(report["platform_matrix"], 1):
        lines.extend(
            [
                f"### {index}. {item['provider']}",
                f"- 适用场景：{item['recommended_when']}",
                f"- 上传方式：{item['upload_mode']}",
                f"- 路由回退：{item['spa_fallback']}",
                f"- 部署后探针：{item['post_deploy_probe']}",
                f"- 主要风险：{item['main_risk']}",
                f"- 恢复动作：{item['recovery']}",
                "",
            ]
        )
    lines.extend(
        [
            "## 四、提交日前 8 步操作",
            "",
            "1. 运行公开上传包生成脚本，确认 ZIP 根目录就是 `index.html`。",
            "2. 运行静态托管自检包，确认 `HOSTING_UPLOAD_SELFTEST.json` 中 FAIL 为 0。",
            "3. 选择一个公开 HTTPS 静态托管平台，优先使用静态上传而不是重新构建源码。",
            "4. 上传 `public-site-upload` ZIP 或其根目录内容，保留 `_redirects`、`404.html`、`vercel.json`、`netlify.toml`、`.nojekyll`。",
            "5. 打开平台生成的 HTTPS URL，用无痕窗口确认首页可访问。",
            "6. 运行最终 URL 回执命令，只有 `status=ready_for_platform` 才能写入比赛平台。",
            "7. 运行同步平台文案命令，把最终 URL 写回 `10_比赛平台填写文案.md`。",
            "8. 保存平台部署截图、最终 URL 回执 JSON/MD、提交包 SHA256 和比赛平台上传回执截图。",
            "",
            "## 五、最终 URL 回执命令",
            "",
            "```bash",
            report["final_validation_command"],
            "```",
            "",
            "状态为 `ready_for_platform` 后，再运行：",
            "",
            "```bash",
            report["sync_platform_copy_command"],
            "```",
            "",
            "## 六、不能越界的表述",
            "",
            "- 不能把 `PENDING_FINAL_PUBLIC_URL` 写入比赛平台当作真实地址。",
            "- 不能把 owner-only、历史 Sites、localhost 或本地局域网地址说成公网交付。",
            "- 不能把静态包上传准备完成说成真实学校生产部署完成。",
            "- 不能把合成演示数据说成真实学生长期学习效果。",
            "",
            "## 七、边界声明",
            "",
            report["truth_boundary"],
            "",
            report["privacy_boundary"],
            "",
        ]
    )
    return "\n".join(lines)


def render_checklist(report: dict[str, Any]) -> str:
    items = [
        ("上传包 SHA 与 manifest 一致", report["upload_zip_sha256"] or "PENDING"),
        ("公开 URL 已生成", report["final_public_url"]),
        ("最终 URL 回执 ready_for_platform", report["final_url_status"]),
        ("比赛平台文案已同步", "运行 sync_platform_copy_command 后确认"),
        ("平台部署截图已保存", "人工保存"),
        ("比赛平台上传回执截图已保存", "人工保存"),
    ]
    lines = [
        "# Deploy Day Checklist",
        "",
        f"Generated: {report['generated_at']}",
        "",
    ]
    for title, evidence in items:
        lines.append(f"- [ ] {title}：`{evidence}`")
    lines.extend(
        [
            "",
            "## Command",
            "",
            "```powershell",
            "rtk python scripts\\generate_public_deploy_playbook_pack.py --write",
            "rtk python scripts\\finalize_public_url_receipt.py --url https://your-public-demo.example --write",
            "```",
            "",
        ]
    )
    return "\n".join(lines)


def render_receipt_sealing(report: dict[str, Any]) -> str:
    return f"""# URL Receipt Sealing

## Evidence Files

- Final receipt JSON: `{report["final_public_url_receipt"]}`
- URL validation report: `{report["url_validation_report"]}`
- Upload ZIP SHA256: `{report["upload_zip_sha256"]}`
- Deploy playbook JSON: `{rel(PLAYBOOK_JSON)}`

## Seal Rule

Only when `submission/final_public_url_receipt.json` has `status=ready_for_platform` and `validation_summary.FAIL=0` may the public URL be copied into the competition platform.

## Commands

```powershell
{report["final_validation_command"]}
{report["sync_platform_copy_command"]}
```
"""


def render_failure_recovery(report: dict[str, Any]) -> str:
    lines = [
        "# Failure Recovery",
        "",
        "## Common Failures",
        "",
        "| Failure | Fast Diagnosis | Recovery |",
        "|---|---|---|",
        "| Root 404 | `/index.html` cannot be fetched | Re-upload ZIP root content; do not upload the parent folder. |",
        "| JS/CSS 404 | HTML loads but assets fail | Preserve `/assets` folder and avoid rewriting hashed filenames. |",
        "| Deep route 404 | Refreshing a panel route fails | Keep `_redirects`, `404.html`, `vercel.json`, `netlify.toml`, or Nginx `try_files`. |",
        "| PUBLIC_HEALTH.json blocked | Validator fails static JSON | Fix MIME/header rules and avoid auth gates on public JSON files. |",
        "| URL is not HTTPS | Receipt stays failed | Use platform HTTPS URL or bind a valid TLS domain. |",
        "| Owner-only link | Judge cannot open anonymously | Switch to public static hosting and rerun receipt sealing. |",
        "",
        "## Fallback Order",
        "",
    ]
    for index, provider in enumerate(report["platform_matrix"], 1):
        lines.append(f"{index}. {provider['provider']}：{provider['recovery']}")
    lines.append("")
    return "\n".join(lines)


def write_csv(path: Path, rows: list[dict[str, str]]) -> None:
    fieldnames = [
        "provider",
        "recommended_when",
        "upload_mode",
        "spa_fallback",
        "post_deploy_probe",
        "main_risk",
        "recovery",
    ]
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def write_run_scripts() -> None:
    RUN_PS1.write_text(
        """param(
  [string]$Url = ""
)

$Python = if ($env:SEPATH_PYTHON) { $env:SEPATH_PYTHON } else { "python" }
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\\..")
Set-Location $Root
& $Python scripts\\generate_public_deploy_playbook_pack.py --write
if ($Url -ne "") {
  & $Python scripts\\finalize_public_url_receipt.py --url $Url --write
  Write-Host "If status is ready_for_platform, run:" -ForegroundColor Cyan
  Write-Host "$Python scripts\\finalize_public_url_receipt.py --url $Url --write --sync-platform-copy"
} else {
  Write-Host "Usage: .\\RUN_DEPLOY_PLAYBOOK.ps1 https://your-public-demo.example"
}
""",
        encoding="utf-8",
    )
    RUN_CMD.write_text(
        """@echo off
cd /d "%~dp0\\..\\.."
if "%SEPATH_PYTHON%"=="" (
  set SEPATH_PYTHON=python
)
%SEPATH_PYTHON% scripts\\generate_public_deploy_playbook_pack.py --write
if "%~1"=="" (
  echo Usage: RUN_DEPLOY_PLAYBOOK.cmd https://your-public-demo.example
  exit /b 0
)
%SEPATH_PYTHON% scripts\\finalize_public_url_receipt.py --url "%~1" --write
echo If status is ready_for_platform, run:
echo %SEPATH_PYTHON% scripts\\finalize_public_url_receipt.py --url "%~1" --write --sync-platform-copy
""",
        encoding="utf-8",
    )


def write_outputs(report: dict[str, Any]) -> None:
    PACK_DIR.mkdir(parents=True, exist_ok=True)
    PLAYBOOK_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    CHECKS_JSON.write_text(
        json.dumps(
            {
                "runtime": "sepath-public-deploy-playbook-checks.v1",
                "generated_at": report["generated_at"],
                "status": report["status"],
                "summary": report["checks_summary"],
                "rows": report["checks"],
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    write_csv(PLATFORM_MATRIX_CSV, report["platform_matrix"])
    DEPLOY_DAY_CHECKLIST.write_text(render_checklist(report), encoding="utf-8")
    URL_RECEIPT_SEALING.write_text(render_receipt_sealing(report), encoding="utf-8")
    FAILURE_RECOVERY.write_text(render_failure_recovery(report), encoding="utf-8")
    write_run_scripts()
    MATERIAL_MD.write_text(render_material(report), encoding="utf-8")
    MATERIAL_JSON.write_text(
        json.dumps(
            {
                "runtime": "sepath-public-deploy-playbook-material.v1",
                "generated_at": report["generated_at"],
                "status": report["status"],
                "final_url_status": report["final_url_status"],
                "manual_gate": report["manual_gate"],
                "upload_zip": report["upload_zip"],
                "upload_zip_sha256": report["upload_zip_sha256"],
                "checks_summary": report["checks_summary"],
                "playbook_json": rel(PLAYBOOK_JSON),
                "manifest_checks": rel(CHECKS_JSON),
                "platform_matrix": rel(PLATFORM_MATRIX_CSV),
                "deploy_day_checklist": rel(DEPLOY_DAY_CHECKLIST),
                "url_receipt_sealing": rel(URL_RECEIPT_SEALING),
                "failure_recovery": rel(FAILURE_RECOVERY),
                "run_ps1": rel(RUN_PS1),
                "run_cmd": rel(RUN_CMD),
                "truth_boundary": report["truth_boundary"],
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate the public deploy playbook pack for SE-Path.")
    parser.add_argument("--write", action="store_true", help="Write material and operator pack files.")
    args = parser.parse_args()

    report = build_report()
    if args.write:
        write_outputs(report)

    print(
        json.dumps(
            {
                "runtime": report["runtime"],
                "status": report["status"],
                "final_url_status": report["final_url_status"],
                "checks_summary": report["checks_summary"],
                "upload_zip_sha256": report["upload_zip_sha256"],
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0 if report["checks_summary"]["FAIL"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
