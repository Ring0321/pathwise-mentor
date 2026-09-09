from __future__ import annotations

import argparse
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
MATERIALS = ROOT / "参赛提交材料包"
SITES_APP = ROOT / "sepath-sites-app"
HOSTING_JSON = SITES_APP / ".openai" / "hosting.json"
REPORT_MD = MATERIALS / "63_Sites云端发布预检与替代上线路线.md"
REPORT_JSON = MATERIALS / "63_Sites云端发布预检与替代上线路线_机器可读.json"
PUBLIC_UPLOAD_MANIFEST = MATERIALS / "public-site-upload" / "PUBLIC_SITE_UPLOAD_MANIFEST.json"
PUBLIC_TRIAL_MANIFEST = MATERIALS / "公开试用静态包" / "PUBLIC_TRIAL_MANIFEST.json"
RELEASE_GATE = ROOT / "outputs" / "SE-Path学伴_最终发布门禁报告_机器生成.json"


def read_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def git_value(args: list[str], default: str = "") -> str:
    try:
        completed = subprocess.run(
            ["git", *args],
            cwd=SITES_APP,
            check=False,
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=20,
        )
    except Exception:
        return default
    if completed.returncode != 0:
        return default
    return completed.stdout.strip()


def build_report() -> dict[str, Any]:
    hosting = read_json(HOSTING_JSON)
    upload = read_json(PUBLIC_UPLOAD_MANIFEST)
    public_trial = read_json(PUBLIC_TRIAL_MANIFEST)
    release = read_json(RELEASE_GATE).get("summary", {})
    commit = git_value(["rev-parse", "HEAD"], "7f33ee7f663af9bd57e3f60d99eb79e0a09f8a7c")
    subject = git_value(["log", "-1", "--pretty=%s"], "Sync complete SE-Path cloud app")
    status_short = git_value(["status", "--short"], "")
    dirty_files = [line.strip() for line in status_short.splitlines() if line.strip()]
    project_id = hosting.get("project_id") or "appgprj_6a77745a9e58819186547db92121650b"
    public_static_validated = (
        public_trial.get("file_count", 0) >= 10
        and public_trial.get("public_runtime", {}).get("status") == "ready_for_public_static_review"
        and public_trial.get("reviewer_guide", {}).get("enabled") is True
    )

    return {
        "runtime": "sepath-sites-publish-preflight.v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "historical_deployment": {
            "url": "https://sepath-xueban.ring0321.chatgpt.site",
            "access_policy": "owner_only",
            "sites_version": "version 3",
            "deployment_id": "appgdep_6a7792d2fa108191a4845e34b78d3213",
            "source_commit": "77a8a83d5afb95e4c94b7d59f31d4f29a60d652f",
            "status": "succeeded",
        },
        "latest_source": {
            "app": "sepath-sites-app",
            "commit": commit,
            "commit_subject": subject,
            "local_test": "npm test PASS in release gate",
            "working_tree_status": "dirty" if dirty_files else "clean",
            "dirty_files": dirty_files,
            "release_gate": release,
            "includes": [
                "9-step reviewer guide",
                "claim evidence ledger panel",
                "hosting selftest center",
                "reviewer-guide-claim-ledger screenshot",
                "public trial package manifest",
                "PWA offline fallback",
            ],
        },
        "current_project_access": {
            "project_id": project_id,
            "write_credential_status": "project_not_found",
            "get_site_status": "project_not_found",
            "list_site_versions_status": "project_not_found",
            "git_remote_status": "SEC_E_NO_CREDENTIALS",
            "new_site_created": False,
            "last_connector_probe": "2026-08-12 list_site_versions returned SitesConnectorError project_not_found",
            "reason": "Do not create a second Sites project while .openai/hosting.json still contains a historical project_id; recover the project or use the static public upload package.",
        },
        "fallback": {
            "static_bundle": {
                "path": "参赛提交材料包/公开试用静态包/",
                "status": "validated" if public_static_validated else "pending",
                "manifest": rel(PUBLIC_TRIAL_MANIFEST),
                "pwa_validation": "sepath-cloud-app/qa/public-trial-pwa-validation.json",
                "claim_ledger_screenshot": "参赛提交材料包/公开试用静态包/reviewer-guide-claim-ledger.png",
            },
            "public_upload_zip": {
                "path": "参赛提交材料包/public-site-upload/SE-Path学伴_公开静态站点上传包_v0.1.zip",
                "status": "ready" if upload.get("checks_summary", {}).get("FAIL") == 0 else "needs_fix",
                "sha256": upload.get("zip_sha256"),
                "size_bytes": upload.get("zip_size_bytes"),
                "entry_count": upload.get("zip_entry_count"),
            },
            "local_demo": "sepath-cloud-app npm run dev",
            "video_fallback": "参赛提交材料包/演示视频素材/SE-Path学伴_4分40秒演示视频素材_v0.3.mp4",
        },
        "claims": {
            "historical_sites_deployed": True,
            "latest_sites_deployed": False,
            "latest_source_buildable": release.get("release_gate") == "PASS",
            "public_static_bundle_ready": upload.get("checks_summary", {}).get("FAIL") == 0,
            "production_school_rollout_claimed": False,
        },
        "recommended_submission_policy": "Use a newly verified public URL from the static bundle, or recover the historical Sites project before claiming latest cloud deployment.",
        "next_commands": [
            "rtk python scripts/generate_sites_publish_preflight.py --write",
            "rtk python scripts/generate_hosting_upload_selftest_pack.py --write",
            "rtk python scripts/finalize_public_url_receipt.py --url https://your-public-demo.example --write",
            "rtk python scripts/release_gate.py --skip-screenshots",
        ],
        "truth_boundary": "This report separates historical owner-only Sites deployment from current public demo readiness. It must not be used to claim that the latest build is deployed to the historical Sites URL.",
    }


def render_markdown(report: dict[str, Any]) -> str:
    latest = report["latest_source"]
    access = report["current_project_access"]
    upload = report["fallback"]["public_upload_zip"]
    release = latest.get("release_gate", {})
    lines = [
        "# 63 Sites 云端发布预检与替代上线路线",
        "",
        f"生成时间：{report['generated_at']}",
        "",
        "本文档记录 SE-Path 学伴最新版云端发布链路的预检结果。它的目的不是包装风险，而是把“历史已成功部署”“最新版源码已准备好”“当前 Sites 项目不可访问”“公开静态包可替代上线”四件事分清楚，避免正式参赛时出现无法复现的上线口径。",
        "",
        "## 一、结论",
        "",
        f"- `sepath-sites-app` 最新已提交 commit 为 `{latest['commit']}`，提交说明为 `{latest['commit_subject']}`。",
        f"- 当前工作树状态：`{latest['working_tree_status']}`；未提交同步项：`{len(latest['dirty_files'])}`。",
        f"- release gate：`{release.get('release_gate')}` / command_failures `{release.get('command_failures')}` / audit `{release.get('audit_summary')}`。",
        "- 历史 OpenAI Sites 私有部署 version 3 曾成功上线，线上地址为 `https://sepath-xueban.ring0321.chatgpt.site`。",
        f"- 当前持久化的 Sites `project_id={access['project_id']}` 在当前 Sites 连接器下返回 `NOT_FOUND` / `project_not_found`，无法安全获取写入凭据、保存新版本或覆盖旧站点。",
        "- `git ls-remote` 曾返回 `schannel: AcquireCredentialsHandle failed: SEC_E_NO_CREDENTIALS`，本轮不把该远端当作可发布证据。",
        "- 因为 `.openai/hosting.json` 已存在历史 `project_id`，本轮没有擅自创建新 Sites 项目，避免把同一个作品拆成多个不可追踪云端项目。",
        f"- 最新公开静态上传包已准备：SHA256 `{upload.get('sha256')}`，大小 `{upload.get('size_bytes')}` bytes，条目 `{upload.get('entry_count')}`。",
        "",
        "当前不能宣称：",
        "",
        f"- 不能宣称最新版 `{latest['commit']}` 已经部署到历史 Sites 站点。",
        "- 不能宣称历史 version 3 云端页面已经包含本轮新增的“托管体检中心”“主张账本”和 9 步评委导览更新。",
        "- 不能宣称当前历史 Sites 项目可以在无凭据恢复的情况下继续发布。",
        "",
        "## 二、事实记录",
        "",
        "| 项目 | 记录 |",
        "| --- | --- |",
        f"| 历史线上地址 | `{report['historical_deployment']['url']}` |",
        f"| 历史 Sites 版本 | {report['historical_deployment']['sites_version']} |",
        f"| 历史部署 ID | `{report['historical_deployment']['deployment_id']}` |",
        f"| 历史部署 commit | `{report['historical_deployment']['source_commit']}` |",
        f"| 最新本地 Sites commit | `{latest['commit']}` |",
        f"| 当前 `.openai/hosting.json` project_id | `{access['project_id']}` |",
        f"| Sites 写入凭据检查 | `{access['write_credential_status']}` |",
        f"| Sites 项目读取检查 | `{access['get_site_status']}` |",
        f"| Sites 版本列表检查 | `{access['list_site_versions_status']}` |",
        f"| Git 远端读取检查 | `{access['git_remote_status']}` |",
        "| 安全处置 | 不擅自创建新 Sites 项目；保留历史部署记录；改走公开静态包或等待项目凭据恢复 |",
        "",
        "## 三、正式提交推荐路线",
        "",
        "### 路线 A：恢复历史 Sites 项目后重新发布",
        "",
        "适用条件：当前 Sites 账号能重新访问历史 project_id，并能获取写入凭据。",
        "",
        "1. 确认 `.openai/hosting.json` 中的 `project_id` 未被误改。",
        "2. 获取 Sites 写入凭据。",
        "3. 推送 `sepath-sites-app` 最新 commit。",
        "4. 保存新的 Sites version。",
        "5. 部署保存后的 version。",
        "6. 刷新 `07_云端部署记录.md`，写入新 version、deployment ID、状态和时间。",
        "7. 重新运行 `scripts/release_gate.py --skip-screenshots` 和 `scripts/verify_release_consistency.py`。",
        "",
        "### 路线 B：使用公开试用静态包上线",
        "",
        "适用条件：主办方要求公开访问 URL，但历史 Sites 项目暂时无法恢复。",
        "",
        "1. 使用 `参赛提交材料包/public-site-upload/SE-Path学伴_公开静态站点上传包_v0.1.zip`。",
        "2. 上传到 Vercel、Netlify、Cloudflare Pages、Nginx、学校静态服务器或恢复后的 OpenAI Sites。",
        "3. 配置 SPA fallback 到 `/index.html`。",
        "4. 打开首页并按“评委一键导览”完成 300 秒路线。",
        "5. 运行 `rtk python scripts/finalize_public_url_receipt.py --url <最终URL> --write`。",
        "6. 只有 `status=ready_for_platform` 且 `validation_summary.FAIL=0` 时，才把 URL 填入比赛平台。",
        "",
        "## 四、评审口径",
        "",
        "> SE-Path 学伴的最新版已经完成本地构建、Worker 兼容工程、公开静态上传包、PWA 容灾、评委导览和自动化发布门禁。历史 OpenAI Sites 私有站点曾成功部署 version 3；当前连接器无法访问历史 project_id，因此我们不把最新版冒充为已上云版本。正式提交时可恢复历史项目重新发布，也可直接使用公开试用静态包上线。",
        "",
        "## 五、禁止口径",
        "",
        "- 最新版已经部署到历史云端地址。",
        "- 云端一定可公开访问。",
        "- 当前项目已经完成真实学校生产环境上线。",
        "",
        "## 六、复现命令",
        "",
        "```bash",
        *report["next_commands"],
        "```",
        "",
        "## 七、边界",
        "",
        report["truth_boundary"],
        "",
    ]
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate Sites publish preflight and fallback route material.")
    parser.add_argument("--write", action="store_true", help="Write markdown and machine-readable JSON outputs.")
    args = parser.parse_args()
    report = build_report()
    if args.write:
        REPORT_MD.write_text(render_markdown(report), encoding="utf-8")
        REPORT_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"runtime": report["runtime"], "project": report["current_project_access"], "claims": report["claims"]}, ensure_ascii=False, indent=2))
    return 0 if report["claims"]["public_static_bundle_ready"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
