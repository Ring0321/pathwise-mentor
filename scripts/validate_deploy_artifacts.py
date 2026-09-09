from __future__ import annotations

import argparse
import hashlib
import json
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
CLOUD_APP = ROOT / "sepath-cloud-app"
MATERIALS = ROOT / "参赛提交材料包"
QA_REPORT = CLOUD_APP / "qa" / "deploy-artifacts-validation.json"
MATERIAL_MD = MATERIALS / "72_标准化部署配置与容器化验收说明.md"
MATERIAL_JSON = MATERIALS / "72_标准化部署配置与容器化验收说明_机器可读.json"
UPLOAD_MANIFEST = MATERIALS / "public-site-upload" / "PUBLIC_SITE_UPLOAD_MANIFEST.json"
UPLOAD_ZIP = MATERIALS / "public-site-upload" / "SE-Path学伴_公开静态站点上传包_v0.1.zip"


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def read_text(path: Path) -> str:
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8")


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


def row(label: str, ok: bool, path: Path, evidence: str) -> dict[str, str]:
    return {
        "label": label,
        "status": "PASS" if ok else "FAIL",
        "path": rel(path),
        "evidence": evidence,
    }


def summarize(rows: list[dict[str, str]]) -> dict[str, int]:
    summary = {"PASS": 0, "FAIL": 0, "rows": len(rows)}
    for item in rows:
        summary[item["status"]] = summary.get(item["status"], 0) + 1
    return summary


def all_tokens(text: str, tokens: list[str]) -> bool:
    return all(token in text for token in tokens)


def validate() -> dict[str, Any]:
    dockerfile = CLOUD_APP / "Dockerfile"
    nginx = CLOUD_APP / "nginx.conf"
    dockerignore = CLOUD_APP / ".dockerignore"
    compose = CLOUD_APP / "docker-compose.yml"
    env_example = CLOUD_APP / ".env.example"
    vercel = CLOUD_APP / "vercel.json"
    netlify = CLOUD_APP / "netlify.toml"

    dockerfile_text = read_text(dockerfile)
    nginx_text = read_text(nginx)
    dockerignore_text = read_text(dockerignore)
    compose_text = read_text(compose)
    env_text = read_text(env_example)
    vercel_data = read_json(vercel)
    netlify_text = read_text(netlify)
    upload_manifest = read_json(UPLOAD_MANIFEST)

    docker_tokens = [
        "FROM node:22-alpine AS build",
        "RUN npm ci",
        "RUN npm run build",
        "FROM nginx:1.27-alpine",
        "COPY nginx.conf /etc/nginx/conf.d/default.conf",
        "COPY --from=build /app/dist /usr/share/nginx/html",
        "EXPOSE 80",
    ]
    nginx_tokens = [
        "root /usr/share/nginx/html;",
        "index index.html;",
        "try_files $uri $uri/ /index.html;",
        "Cache-Control",
    ]
    dockerignore_tokens = [
        "node_modules",
        "dist",
        ".vite",
        ".vinext",
        ".wrangler",
        "qa",
        "*.log",
        ".env",
    ]
    compose_tokens = [
        "sepath-cloud-app:",
        "context: .",
        "dockerfile: Dockerfile",
        "8080:80",
        "healthcheck:",
        "wget -qO- http://127.0.0.1/",
        "restart: unless-stopped",
    ]
    env_tokens = [
        "VITE_APP_MODE=offline-demo",
        "VITE_AGENT_API_BASE=",
        "VITE_CLOUD_STORAGE_PROVIDER=localStorage",
    ]

    required_zip_entries = {
        "index.html",
        "manifest.webmanifest",
        "sw.js",
        "offline.html",
        "PUBLIC_HEALTH.json",
        "PUBLIC_RELEASE.json",
        "PUBLIC_TRIAL_MANIFEST.json",
        "_redirects",
        "_headers",
        "404.html",
        "vercel.json",
        "netlify.toml",
        "nginx.conf.example",
        "DEPLOY_TARGETS.md",
    }
    zip_entries: set[str] = set()
    zip_ok = False
    zip_sha = ""
    zip_size = 0
    if UPLOAD_ZIP.exists():
        zip_size = UPLOAD_ZIP.stat().st_size
        zip_sha = sha256_file(UPLOAD_ZIP)
        try:
            with zipfile.ZipFile(UPLOAD_ZIP, "r") as archive:
                zip_entries = set(archive.namelist())
                zip_ok = archive.testzip() is None
        except zipfile.BadZipFile:
            zip_ok = False

    missing_zip_entries = sorted(required_zip_entries - zip_entries)
    manifest_sha = str(upload_manifest.get("zip_sha256", ""))
    manifest_integrity = str(upload_manifest.get("zip_integrity", ""))
    manifest_deploy_files = set(upload_manifest.get("deploy_config_files", []))

    rows = [
        row("Dockerfile 使用 Node 构建与 Nginx 静态服务", all_tokens(dockerfile_text, docker_tokens), dockerfile, "node:22-alpine -> nginx:1.27-alpine"),
        row("Nginx 支持 SPA 回退与静态资源缓存", all_tokens(nginx_text, nginx_tokens), nginx, "root, index, try_files and cache headers"),
        row("Docker 构建上下文排除依赖、产物、日志和环境变量", all_tokens(dockerignore_text, dockerignore_tokens), dockerignore, f"{len([line for line in dockerignore_text.splitlines() if line.strip()])} ignore rules"),
        row("docker compose 可一键启动 8080 本地预览并带健康检查", all_tokens(compose_text, compose_tokens), compose, "docker compose up --build -> http://127.0.0.1:8080"),
        row("环境变量样例只保留离线演示占位且不含密钥", all_tokens(env_text, env_tokens) and "sk-" not in env_text and "SECRET" not in env_text, env_example, "offline-demo/localStorage/no secret token"),
        row("Vercel 配置指向 dist 并回退到 index.html", vercel_data.get("outputDirectory") == "dist" and any(item.get("destination") == "/index.html" for item in vercel_data.get("rewrites", [])), vercel, f"outputDirectory={vercel_data.get('outputDirectory')}"),
        row("Netlify 配置指向 dist 并提供 SPA redirect", "[build]" in netlify_text and 'publish = "dist"' in netlify_text and 'to = "/index.html"' in netlify_text, netlify, "publish=dist redirect=200"),
        row("公网静态上传 ZIP 完整且包含多平台部署文件", zip_ok and not missing_zip_entries, UPLOAD_ZIP, f"entries={len(zip_entries)} missing={missing_zip_entries[:3]}"),
        row("公网静态上传 manifest 与 ZIP SHA/完整性一致", bool(manifest_sha) and manifest_sha == zip_sha and manifest_integrity == "pass", UPLOAD_MANIFEST, f"sha={zip_sha[:12]} integrity={manifest_integrity}"),
        row("公网上传 manifest 声明 Vercel/Netlify/Nginx 部署配置", {"vercel.json", "netlify.toml", "nginx.conf.example", "DEPLOY_TARGETS.md"}.issubset(manifest_deploy_files), UPLOAD_MANIFEST, ",".join(sorted(manifest_deploy_files))),
    ]
    summary = summarize(rows)
    return {
        "runtime": "sepath-deploy-artifacts-validation.v1",
        "generated_at": now(),
        "status": "ready_for_standard_static_deploy" if summary["FAIL"] == 0 else "needs_fix",
        "summary": summary,
        "rows": rows,
        "artifacts": {
            "dockerfile": rel(dockerfile),
            "nginx": rel(nginx),
            "dockerignore": rel(dockerignore),
            "docker_compose": rel(compose),
            "env_example": rel(env_example),
            "vercel": rel(vercel),
            "netlify": rel(netlify),
            "public_site_upload_manifest": rel(UPLOAD_MANIFEST),
            "public_site_upload_zip": rel(UPLOAD_ZIP),
            "public_site_upload_zip_sha256": zip_sha,
            "public_site_upload_zip_size_bytes": zip_size,
        },
        "operator_commands": [
            "cd sepath-cloud-app && npm ci && npm run build",
            "cd sepath-cloud-app && docker compose up --build",
            "open http://127.0.0.1:8080",
            "rtk python scripts/validate_deploy_artifacts.py --write",
            "rtk python scripts/finalize_public_url_receipt.py --url <最终公网URL> --write --sync-platform-copy",
        ],
        "truth_boundary": "This validates deployment configuration and packaged static artifacts; it does not prove that an external public URL has already been deployed.",
    }


def render_material(report: dict[str, Any]) -> str:
    summary = report["summary"]
    rows = report["rows"]
    lines = [
        "# 72 标准化部署配置与容器化验收说明",
        "",
        "## 验收目标",
        "",
        "本材料用于证明 SE-Path 学伴 Demo 已具备标准静态站点上线条件：可通过 Vercel、Netlify、Nginx 静态托管或 Docker Compose 运行。该验收只确认部署配置、构建产物和公开上传包完整性，不宣称最终公网 URL 已经完成发布。",
        "",
        "## 可上线交付件",
        "",
        "| 类别 | 文件 | 用途 |",
        "| --- | --- | --- |",
        "| 容器构建 | `sepath-cloud-app/Dockerfile` | Node 构建前端产物，再由 Nginx 提供静态服务 |",
        "| 容器运行 | `sepath-cloud-app/docker-compose.yml` | 本地或服务器一条命令启动 `8080:80` 预览并健康检查 |",
        "| 构建上下文 | `sepath-cloud-app/.dockerignore` | 排除依赖、产物、日志、QA 截图和环境变量，降低上传风险 |",
        "| SPA 服务 | `sepath-cloud-app/nginx.conf` | 支持 `index.html` 回退和静态资源缓存 |",
        "| 云平台 | `sepath-cloud-app/vercel.json`、`sepath-cloud-app/netlify.toml` | 直接对接 Vercel/Netlify 的静态部署规则 |",
        "| 公开上传包 | `参赛提交材料包/public-site-upload/SE-Path学伴_公开静态站点上传包_v0.1.zip` | 可拖拽上传到 Netlify Drop、Cloudflare Pages、学校静态服务器等平台 |",
        "| 机器验收 | `sepath-cloud-app/qa/deploy-artifacts-validation.json` | 记录部署配置、ZIP 完整性和 manifest 一致性 |",
        "",
        "## 一键运行路径",
        "",
        "```powershell",
        "cd sepath-cloud-app",
        "docker compose up --build",
        "```",
        "",
        "本地浏览器打开 `http://127.0.0.1:8080` 后，评委可直接进入公开试用闭环、评委 5 分钟导览、提交收口总控和各类机器可读报告。",
        "",
        "## 提交前机器验收",
        "",
        "```powershell",
        "rtk python scripts/validate_deploy_artifacts.py --write",
        "rtk python scripts/release_gate.py --skip-screenshots",
        "rtk python scripts/verify_release_consistency.py",
        "```",
        "",
        f"- 当前验收结论：`{report['status']}`",
        f"- 机器检查：PASS={summary.get('PASS', 0)}，FAIL={summary.get('FAIL', 0)}，ROWS={summary.get('rows', 0)}",
        f"- 最新上传 ZIP SHA-256：`{report['artifacts'].get('public_site_upload_zip_sha256', '')}`",
        "",
        "## 检查明细",
        "",
        "| 状态 | 检查项 | 证据 |",
        "| --- | --- | --- |",
    ]
    for item in rows:
        lines.append(f"| {item['status']} | {item['label']} | {item['evidence']} |")
    lines.extend(
        [
            "",
            "## 边界说明",
            "",
            "该材料证明当前源码和公开静态包满足标准部署前置条件；最终比赛平台需要填写的公网 URL 仍以提交日前实际发布结果和回执文件为准。若未能使用历史 Sites 项目，可直接使用公开静态上传包完成替代发布。",
            "",
        ]
    )
    return "\n".join(lines)


def build_material_json(report: dict[str, Any]) -> dict[str, Any]:
    return {
        "runtime": "sepath-standard-deploy-validation-material.v1",
        "generated_at": now(),
        "status": report["status"],
        "source_report": rel(QA_REPORT),
        "summary": report["summary"],
        "artifacts": report["artifacts"],
        "operator_commands": report["operator_commands"],
        "truth_boundary": report["truth_boundary"],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate SE-Path standard deployment artifacts.")
    parser.add_argument("--write", action="store_true", help="Write QA report and material 72 files.")
    args = parser.parse_args()

    report = validate()
    if args.write:
        QA_REPORT.parent.mkdir(parents=True, exist_ok=True)
        MATERIALS.mkdir(parents=True, exist_ok=True)
        QA_REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        MATERIAL_MD.write_text(render_material(report), encoding="utf-8")
        MATERIAL_JSON.write_text(json.dumps(build_material_json(report), ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"status": report["status"], "summary": report["summary"], "report": rel(QA_REPORT)}, ensure_ascii=False))
    return 0 if report["summary"]["FAIL"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
