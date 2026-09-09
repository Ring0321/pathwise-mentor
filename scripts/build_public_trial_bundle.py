from __future__ import annotations

import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIST = ROOT / "sepath-cloud-app" / "dist"
TARGET = ROOT / "参赛提交材料包" / "公开试用静态包"
MANIFEST = TARGET / "PUBLIC_TRIAL_MANIFEST.json"
README = TARGET / "README_公开试用.md"
SEED_SOURCE = ROOT / "sepath-cloud-app" / "qa" / "demo-seed" / "JUDGE_DEMO_SEED_MANIFEST.json"
SEED_TARGET = TARGET / "JUDGE_DEMO_SEED_MANIFEST.json"
REVIEWER_REPORT_SOURCE = ROOT / "sepath-cloud-app" / "qa" / "reviewer-drill-report.json"
REVIEWER_REPORT_TARGET = TARGET / "REVIEWER_DRILL_REPORT.json"
GUIDE_SCREENSHOT_SOURCE = ROOT / "sepath-cloud-app" / "qa" / "screenshots" / "reviewer-guide-overlay.png"
GUIDE_SCREENSHOT_TARGET = TARGET / "reviewer-guide-overlay.png"
GUIDE_CLAIM_LEDGER_SCREENSHOT_SOURCE = ROOT / "sepath-cloud-app" / "qa" / "screenshots" / "reviewer-guide-claim-ledger.png"
GUIDE_CLAIM_LEDGER_SCREENSHOT_TARGET = TARGET / "reviewer-guide-claim-ledger.png"
PUBLIC_URL_RECEIPT_SCREENSHOT_SOURCE = ROOT / "sepath-cloud-app" / "qa" / "screenshots" / "public-url-receipt-panel.png"
PUBLIC_URL_RECEIPT_SCREENSHOT_TARGET = TARGET / "public-url-receipt-panel.png"
SUBMISSION_CLOSURE_SCREENSHOT_SOURCE = ROOT / "sepath-cloud-app" / "qa" / "screenshots" / "submission-closure-panel.png"
SUBMISSION_CLOSURE_SCREENSHOT_TARGET = TARGET / "submission-closure-panel.png"
PUBLIC_HEALTH = TARGET / "PUBLIC_HEALTH.json"
PUBLIC_RELEASE = TARGET / "PUBLIC_RELEASE.json"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def collect_files() -> list[dict[str, str | int]]:
    rows: list[dict[str, str | int]] = []
    for path in sorted(TARGET.rglob("*"), key=lambda item: item.relative_to(TARGET).as_posix()):
        if path.is_file() and path.name != MANIFEST.name:
            rows.append(
                {
                    "path": path.relative_to(TARGET).as_posix(),
                    "bytes": path.stat().st_size,
                    "sha256": sha256_file(path),
                }
            )
    return rows


def target_contains(*needles: str) -> bool:
    texts = []
    for path in TARGET.rglob("*"):
        if path.is_file() and path.suffix.lower() in {".html", ".js", ".css", ".json", ".md"}:
            texts.append(path.read_text(encoding="utf-8", errors="ignore"))
    joined = "\n".join(texts)
    return all(needle in joined for needle in needles)


def write_readme() -> None:
    README.write_text(
        """# SE-Path 学伴公开试用静态包

本目录是从 `sepath-cloud-app/dist` 生成的公开试用包，可整体上传到 Vercel、Netlify、Cloudflare Pages、OpenAI Sites、Nginx 或任意静态文件服务器。

## 使用方式

1. 将本目录完整上传到静态托管平台。
2. 将站点根目录指向本目录。
3. 若平台需要单页应用路由回退，请把所有路径回退到 `/index.html`。
4. 打开首页后，依次点击主按钮完成“提交失败 PR、学生请求完整代码、推送脚手架提示、学生修复并通过 CI、教师复核放行、生成反思记忆”六步闭环。
5. 通过顶部导航查看“科研融合、增值评估、试点遥测、试点证据、后端状态、评审证据、上线交付、教师复核”等面板。
6. 点击首屏或右下角“一键评委导览”，按固定导览条完成 300 秒评委路线。

## 验收标准

- 首页可以加载并显示 SE-Path 学伴。
- 桌面端与移动端无横向溢出。
- 应用不需要真实学生数据、API Key 或外部数据库。
- 所有演示数据均为合成样本，仅用于证明产品闭环。
- 如用于正式评审，请先确认访问策略是公开只读还是 owner-only 私有访问。

## 文件说明

- `index.html`：静态入口。
- `assets/`：Vite 构建后的 JS/CSS 资源。
- `PUBLIC_TRIAL_MANIFEST.json`：文件清单、大小和 SHA256，用于提交前核验。
- `JUDGE_DEMO_SEED_MANIFEST.json`：合成演示身份、评委 10 分钟路线、闭环种子事件和无真实密码边界。
- `REVIEWER_DRILL_REPORT.json`：评委 5 分钟实操演练和一键导览机器报告。
- `reviewer-guide-overlay.png`：一键评委导览模式截图。
- `reviewer-guide-claim-ledger.png`：一键导览跳转到主张证据账本的截图。
- `public-url-receipt-panel.png`：公网 URL 回执验收台截图。
- `submission-closure-panel.png`：正式提交收口总控截图。
- `manifest.webmanifest` / `sw.js` / `offline.html`：PWA 安装信息、离线缓存策略和网络异常兜底页。
""",
        encoding="utf-8",
    )


def write_public_runtime_metadata(generated_at: str) -> None:
    required_files = [
        "index.html",
        "manifest.webmanifest",
        "sw.js",
        "offline.html",
        "PUBLIC_TRIAL_MANIFEST.json",
        "JUDGE_DEMO_SEED_MANIFEST.json",
        "REVIEWER_DRILL_REPORT.json",
        "reviewer-guide-overlay.png",
        "reviewer-guide-claim-ledger.png",
        "public-url-receipt-panel.png",
        "submission-closure-panel.png",
        "PUBLIC_HEALTH.json",
        "PUBLIC_RELEASE.json",
    ]
    health = {
        "runtime": "sepath-public-health.v1",
        "generated_at": generated_at,
        "status": "ready_for_public_static_review",
        "product": "SE-Path companion",
        "entrypoint": "index.html",
        "deployment_mode": "static_public_trial",
        "source": SOURCE_DIST.relative_to(ROOT).as_posix(),
        "target": TARGET.relative_to(ROOT).as_posix(),
        "public_url_status": "pending_external_public_url_validation",
        "required_static_files": required_files,
        "checks": {
            "root_index": (TARGET / "index.html").exists(),
            "pwa_manifest": (TARGET / "manifest.webmanifest").exists(),
            "service_worker": (TARGET / "sw.js").exists(),
            "offline_fallback": (TARGET / "offline.html").exists(),
            "judge_seed": SEED_TARGET.exists(),
            "reviewer_drill": REVIEWER_REPORT_TARGET.exists(),
            "reviewer_screenshots": GUIDE_SCREENSHOT_TARGET.exists() and GUIDE_CLAIM_LEDGER_SCREENSHOT_TARGET.exists(),
            "public_url_receipt_screenshot": PUBLIC_URL_RECEIPT_SCREENSHOT_TARGET.exists(),
            "submission_closure_screenshot": SUBMISSION_CLOSURE_SCREENSHOT_TARGET.exists(),
        },
        "reviewer_probe": {
            "health_url": "/PUBLIC_HEALTH.json",
            "release_url": "/PUBLIC_RELEASE.json",
            "expected_status": "ready_for_public_static_review",
            "post_deploy_command": "rtk python scripts/finalize_public_url_receipt.py --url https://your-public-demo.example --write",
        },
        "truth_boundary": "Public static demo health only; it proves reachability of the submitted read-only artifact, not real school rollout.",
        "privacy_boundary": "Synthetic demo data only; no student PII, API key, external credential, or production database URL is included.",
    }
    release = {
        "runtime": "sepath-public-release.v1",
        "generated_at": generated_at,
        "release_channel": "competition-public-static",
        "release_version": "v0.4-public-trial",
        "product": "SE-Path companion for software engineering adaptive learning",
        "source": SOURCE_DIST.relative_to(ROOT).as_posix(),
        "target": TARGET.relative_to(ROOT).as_posix(),
        "core_loops": [
            "student diagnosis",
            "SafeVOI path decision",
            "scaffolded intervention",
            "CI and evidence replay",
            "teacher review",
            "reflection memory",
            "claim-evidence ledger",
        ],
        "reviewer_assets": {
            "manifest": "PUBLIC_TRIAL_MANIFEST.json",
            "seed": "JUDGE_DEMO_SEED_MANIFEST.json",
            "drill_report": "REVIEWER_DRILL_REPORT.json",
            "guide_overlay": "reviewer-guide-overlay.png",
            "claim_ledger": "reviewer-guide-claim-ledger.png",
            "public_url_receipt": "public-url-receipt-panel.png",
            "submission_closure": "submission-closure-panel.png",
        },
        "innovation_claims": [
            "agentic software-engineering learning loop",
            "value-added formative evaluation separated from causal claims",
            "SafeVOI action gate before interventions",
            "human teacher review gate",
            "machine-verifiable claim evidence ledger",
            "public URL receipt before platform submission",
            "final submission closure report before platform upload",
        ],
        "post_deploy_validation_command": "rtk python scripts/finalize_public_url_receipt.py --url https://your-public-demo.example --write",
        "truth_boundary": "Synthetic public demo and evidence replay; no production credential or real student data is shipped.",
    }
    PUBLIC_HEALTH.write_text(json.dumps(health, ensure_ascii=False, indent=2), encoding="utf-8")
    PUBLIC_RELEASE.write_text(json.dumps(release, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    index = SOURCE_DIST / "index.html"
    if not index.exists():
        raise SystemExit("Missing sepath-cloud-app/dist/index.html. Run `npm run build` first.")

    if TARGET.exists():
        shutil.rmtree(TARGET)
    TARGET.mkdir(parents=True, exist_ok=True)

    for item in SOURCE_DIST.iterdir():
        destination = TARGET / item.name
        if item.is_dir():
            shutil.copytree(item, destination)
        else:
            shutil.copy2(item, destination)

    if SEED_SOURCE.exists():
        shutil.copy2(SEED_SOURCE, SEED_TARGET)
    if REVIEWER_REPORT_SOURCE.exists():
        shutil.copy2(REVIEWER_REPORT_SOURCE, REVIEWER_REPORT_TARGET)
    if GUIDE_SCREENSHOT_SOURCE.exists():
        shutil.copy2(GUIDE_SCREENSHOT_SOURCE, GUIDE_SCREENSHOT_TARGET)
    if GUIDE_CLAIM_LEDGER_SCREENSHOT_SOURCE.exists():
        shutil.copy2(GUIDE_CLAIM_LEDGER_SCREENSHOT_SOURCE, GUIDE_CLAIM_LEDGER_SCREENSHOT_TARGET)
    if PUBLIC_URL_RECEIPT_SCREENSHOT_SOURCE.exists():
        shutil.copy2(PUBLIC_URL_RECEIPT_SCREENSHOT_SOURCE, PUBLIC_URL_RECEIPT_SCREENSHOT_TARGET)
    if SUBMISSION_CLOSURE_SCREENSHOT_SOURCE.exists():
        shutil.copy2(SUBMISSION_CLOSURE_SCREENSHOT_SOURCE, SUBMISSION_CLOSURE_SCREENSHOT_TARGET)

    generated_at = datetime.now(timezone.utc).isoformat()
    write_readme()
    write_public_runtime_metadata(generated_at)
    files = collect_files()
    guide_enabled = target_contains("一键评委导览", "sepath-reviewer-guide.v1")
    manifest = {
        "generated_at": generated_at,
        "source": SOURCE_DIST.relative_to(ROOT).as_posix(),
        "target": TARGET.relative_to(ROOT).as_posix(),
        "file_count": len(files),
        "total_size_bytes": sum(int(row["bytes"]) for row in files),
        "deploy_targets": [
            "Vercel",
            "Netlify",
            "Cloudflare Pages",
            "OpenAI Sites",
            "Nginx static hosting",
        ],
        "spa_fallback": "/index.html",
        "privacy_boundary": "Synthetic demo data only; no student PII, API key, or external credential is included.",
        "research_contribution": {
            "runtime": "sepath-research-fusion.v1",
            "anchors": ["#research-fusion", "#value", "#trial-telemetry", "#pilot-evidence-binder", "#claim-ledger"],
            "boundary": "Research and algorithm evidence is shown with synthetic replay and explicit real-pilot claim gates.",
        },
        "reviewer_guide": {
            "runtime": "sepath-reviewer-guide.v1",
            "source_runtime": "sepath-reviewer-drill.v1",
            "enabled": guide_enabled,
            "launch_text": "一键评委导览",
            "report": "REVIEWER_DRILL_REPORT.json",
            "screenshot": "reviewer-guide-overlay.png",
            "claim_ledger_screenshot": "reviewer-guide-claim-ledger.png",
            "public_url_receipt_screenshot": "public-url-receipt-panel.png",
            "submission_closure_screenshot": "submission-closure-panel.png",
            "required_actions": ["start", "step-through", "close"],
            "required_anchors": [
                "#student",
                "#teacher-report",
                "#value",
                "#research-fusion",
                "#trial-telemetry",
                "#pilot-evidence-binder",
                "#claim-ledger",
                "#cloud-slo",
                "#backend-status",
                "#public-url-receipt",
                "#submission-closure",
                "#judge-verification",
                "#launch-loop",
            ],
            "boundary": "The public trial exposes a guided synthetic reviewer walkthrough; it does not include real student data or credentials.",
        },
        "pwa": {
            "runtime": "sepath-public-trial-pwa.v1",
            "installable": (TARGET / "manifest.webmanifest").exists()
            and (TARGET / "sw.js").exists()
            and (TARGET / "offline.html").exists(),
            "manifest": "manifest.webmanifest",
            "service_worker": "sw.js",
            "offline_page": "offline.html",
            "icon": "pwa-icon.svg",
            "maskable_icon": "maskable-icon.svg",
            "offline_strategy": "network-first navigation fallback plus cache-first static assets; synthetic manifests only",
            "privacy_boundary": "The service worker caches static demo assets and synthetic manifests only.",
        },
        "public_runtime": {
            "health": "PUBLIC_HEALTH.json",
            "release": "PUBLIC_RELEASE.json",
            "health_runtime": "sepath-public-health.v1",
            "release_runtime": "sepath-public-release.v1",
            "status": "ready_for_public_static_review",
            "public_url_status": "pending_external_public_url_validation",
        },
        "files": files,
    }
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
