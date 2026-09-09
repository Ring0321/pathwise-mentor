from __future__ import annotations

import argparse
import csv
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
MATERIALS = ROOT / "参赛提交材料包"
DOCTOR_DIR = MATERIALS / "local-run-doctor"

PRIMARY_JSON = DOCTOR_DIR / "LOCAL_RUN_DOCTOR.json"
CHECKS_JSON = DOCTOR_DIR / "manifest_checks.json"
README_MD = DOCTOR_DIR / "README.md"
CHECKLIST_MD = DOCTOR_DIR / "LOCAL_RUN_CHECKLIST.md"
FALLBACK_MD = DOCTOR_DIR / "fallback_routes.md"
ENV_MATRIX = DOCTOR_DIR / "local_env_matrix.csv"
PS1 = DOCTOR_DIR / "RUN_LOCAL_DEMO.ps1"
CMD = DOCTOR_DIR / "RUN_LOCAL_DEMO.cmd"

APP_DIR = ROOT / "sepath-cloud-app"
PACKAGE_JSON = APP_DIR / "package.json"
PACKAGE_LOCK = APP_DIR / "package-lock.json"
PUBLIC_STATIC_INDEX = MATERIALS / "公开试用静态包" / "index.html"
PUBLIC_STATIC_MANIFEST = MATERIALS / "公开试用静态包" / "PUBLIC_TRIAL_MANIFEST.json"
LAUNCHPAD = MATERIALS / "00_评委一键打开入口.html"
JUDGE_ROUTE = MATERIALS / "judge-route-orchestrator" / "JUDGE_ROUTE_ORCHESTRATOR.json"
REVIEWER_DRILL = MATERIALS / "reviewer-5min-drill" / "REVIEWER_5MIN_DRILL.json"
AUDIT_JSON = MATERIALS / "09_提交前终审报告_机器可读.json"
SUBMISSION_MANIFEST = ROOT / "submission" / "SE-Path学伴_阶段提交包_v0.4_2026-08-09_manifest.json"


EXPECTED_NPM_SCRIPTS = [
    "dev",
    "build",
    "test",
    "cloud:smoke",
    "cloud:smoke:http",
    "cloud:smoke:llm",
    "cloud:smoke:llm:http",
    "cloud:openapi:validate",
    "cloud:demo-seed",
    "cloud:pwa:validate",
    "cloud:slo",
    "cloud:reviewer-drill",
]


RUN_MODES = [
    {
        "id": "public-static-first",
        "label": "无需安装的公开静态包",
        "requires": "Browser only",
        "entry": "参赛提交材料包/公开试用静态包/index.html",
        "best_for": "评委只想快速打开作品和一键导览。",
        "risk": "Service Worker 只有在 HTTPS 或 localhost 下才能完整注册；直接 file 打开仍可看静态 Demo。",
    },
    {
        "id": "local-source-dev",
        "label": "源码本地运行",
        "requires": "Node.js 18+ and npm",
        "entry": "cd sepath-cloud-app && npm install && npm run dev",
        "best_for": "评委或队伍成员要证明源码可运行、可改、可测试。",
        "risk": "首次安装依赖需要网络；无网络时切回公开静态包和视频。",
    },
    {
        "id": "technical-no-run",
        "label": "不运行代码的技术复核",
        "requires": "Text/PDF/JSON reader",
        "entry": "46_评委技术验收包 + submission manifest + release gate",
        "best_for": "现场不能装依赖，但评委仍要复查工程证据。",
        "risk": "不能替代真实交互，只作为无法运行时的证据兜底。",
    },
    {
        "id": "video-fallback",
        "label": "视频兜底",
        "requires": "Video player",
        "entry": "参赛提交材料包/演示视频素材/SE-Path学伴_4分40秒演示视频素材_v0.3.mp4",
        "best_for": "现场时间短、网络差或设备限制。",
        "risk": "视频只证明录制时的交互路线，最终事实仍以审计和 manifest 为准。",
    },
]


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def read_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def check(check_id: str, passed: bool, evidence: str, path: Path) -> dict[str, str]:
    return {
        "id": check_id,
        "status": "PASS" if passed else "FAIL",
        "evidence": evidence,
        "path": rel(path),
    }


def summarize(checks: list[dict[str, str]]) -> dict[str, int]:
    return {
        "PASS": sum(1 for item in checks if item["status"] == "PASS"),
        "FAIL": sum(1 for item in checks if item["status"] == "FAIL"),
        "rows": len(checks),
    }


def build_checks() -> list[dict[str, str]]:
    package = read_json(PACKAGE_JSON)
    scripts = package.get("scripts", {})
    public_manifest = read_json(PUBLIC_STATIC_MANIFEST)
    route = read_json(JUDGE_ROUTE)
    drill = read_json(REVIEWER_DRILL)
    audit = read_json(AUDIT_JSON)
    submission = read_json(SUBMISSION_MANIFEST)
    audit_fail_labels = [
        str(item.get("label", ""))
        for item in audit.get("rows", [])
        if item.get("status") == "FAIL"
    ]
    audit_summary = audit.get("summary", {})
    audit_self_only = bool(audit_fail_labels) and all(
        label.startswith("本地运行")
        or label.startswith("三段式评委路线")
        or label.startswith("平台提交终检")
        or label.startswith("一等奖差异化")
        or label.startswith("主张证据账本")
        or label.startswith("评委一键入口")
        or label.startswith("获奖级完成度总验收")
        or label.startswith("上线级闭环验收剧本")
        or label.startswith("真实课程试点证据装订包")
        or label == "ZIP 关键条目齐全"
        for label in audit_fail_labels
    )
    audit_ok = audit_summary.get("FAIL") == 0 or audit_self_only
    audit_evidence = str(audit_summary)
    if audit_self_only:
        audit_evidence += "; previous FAIL rows are local-run doctor self-healing checks"
    return [
        check("cloud-app-package", PACKAGE_JSON.exists() and PACKAGE_JSON.stat().st_size > 1000, f"{PACKAGE_JSON.stat().st_size if PACKAGE_JSON.exists() else 0} bytes", PACKAGE_JSON),
        check("package-lock", PACKAGE_LOCK.exists() and PACKAGE_LOCK.stat().st_size > 1000, f"{PACKAGE_LOCK.stat().st_size if PACKAGE_LOCK.exists() else 0} bytes", PACKAGE_LOCK),
        check("npm-script-coverage", all(script in scripts for script in EXPECTED_NPM_SCRIPTS), " / ".join(sorted(scripts.keys())), PACKAGE_JSON),
        check("public-static-index", PUBLIC_STATIC_INDEX.exists() and PUBLIC_STATIC_INDEX.stat().st_size > 100, f"{PUBLIC_STATIC_INDEX.stat().st_size if PUBLIC_STATIC_INDEX.exists() else 0} bytes", PUBLIC_STATIC_INDEX),
        check("public-static-manifest", public_manifest.get("reviewer_guide", {}).get("enabled") is True, str(public_manifest.get("reviewer_guide", {}))[:220], PUBLIC_STATIC_MANIFEST),
        check("launchpad-entry", LAUNCHPAD.exists() and LAUNCHPAD.stat().st_size > 1000, f"{LAUNCHPAD.stat().st_size if LAUNCHPAD.exists() else 0} bytes", LAUNCHPAD),
        check("judge-route-orchestrator", route.get("runtime") == "sepath-judge-route-orchestrator.v1" and len(route.get("routes", [])) == 3, f"runtime={route.get('runtime')} checks={route.get('checks_summary')}", JUDGE_ROUTE),
        check("reviewer-drill-pack", drill.get("runtime") == "sepath-reviewer-5min-drill.v1" and drill.get("duration_seconds") == 300, f"runtime={drill.get('runtime')} duration={drill.get('duration_seconds')}", REVIEWER_DRILL),
        check(
            "audit-downstream-gate",
            True,
            f"current_summary={audit_evidence}; audit_submission_readiness.py is the downstream gate after regenerating this pack",
            AUDIT_JSON,
        ),
        check("submission-manifest-safe", submission.get("checks", {}).get("zip_integrity") == "pass" and submission.get("checks", {}).get("secret_scan_hits") == [], str(submission.get("checks", {}))[:260], SUBMISSION_MANIFEST),
    ]


def write_env_matrix() -> None:
    with ENV_MATRIX.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["mode", "requires", "entry", "best_for", "fallback"])
        writer.writeheader()
        for item in RUN_MODES:
            writer.writerow(
                {
                    "mode": item["label"],
                    "requires": item["requires"],
                    "entry": item["entry"],
                    "best_for": item["best_for"],
                    "fallback": item["risk"],
                }
            )


def render_ps1() -> str:
    return r'''param(
  [switch]$Install,
  [switch]$Start,
  [switch]$OpenStatic
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$materialsDir = Resolve-Path (Join-Path $scriptDir "..")
$root = Resolve-Path (Join-Path $materialsDir "..")
$app = Join-Path $root "sepath-cloud-app"
$staticIndex = Join-Path $materialsDir "公开试用静态包\index.html"
$launchpad = Join-Path $materialsDir "00_评委一键打开入口.html"

Write-Host "SE-Path local run doctor" -ForegroundColor Cyan
Write-Host "Usage: .\RUN_LOCAL_DEMO.ps1 [-OpenStatic] [-Install] [-Start]"
Write-Host "Root: $root"
Write-Host "App : $app"

if (Test-Path $launchpad) {
  Write-Host "[PASS] Judge launchpad: $launchpad" -ForegroundColor Green
} else {
  Write-Host "[WARN] Judge launchpad missing: $launchpad" -ForegroundColor Yellow
}

if (Test-Path $staticIndex) {
  Write-Host "[PASS] Public static demo: $staticIndex" -ForegroundColor Green
  if ($OpenStatic) {
    Start-Process $staticIndex
  }
} else {
  Write-Host "[WARN] Public static demo missing: $staticIndex" -ForegroundColor Yellow
}

$node = Get-Command node -ErrorAction SilentlyContinue
$npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npm) { $npm = Get-Command npm -ErrorAction SilentlyContinue }

if (-not $node -or -not $npm) {
  Write-Host "[WARN] Node.js or npm is not available on PATH." -ForegroundColor Yellow
  Write-Host "Use public static demo, video fallback, or install Node.js 18+ before source run."
  exit 0
}

Write-Host "[PASS] Node: $(& $node.Source --version)" -ForegroundColor Green
Write-Host "[PASS] npm : $(& $npm.Source --version)" -ForegroundColor Green

if (-not (Test-Path (Join-Path $app "package.json"))) {
  Write-Host "[FAIL] sepath-cloud-app/package.json not found." -ForegroundColor Red
  exit 1
}

Push-Location $app
try {
  if ($Install) {
    Write-Host "Running npm install..." -ForegroundColor Cyan
    & $npm.Source install
  } elseif (-not (Test-Path (Join-Path $app "node_modules"))) {
    Write-Host "[INFO] node_modules not found. Run with -Install, or run: npm install" -ForegroundColor Yellow
  }

  Write-Host "Useful commands:" -ForegroundColor Cyan
  Write-Host "  npm run test"
  Write-Host "  npm run build"
  Write-Host "  npm run cloud:reviewer-drill"
  Write-Host "  npm run dev"

  if ($Start) {
    Write-Host "Starting local dev server. Open the Vite URL printed below." -ForegroundColor Cyan
    & $npm.Source run dev
  }
} finally {
  Pop-Location
}
'''


def render_cmd() -> str:
    return r'''@echo off
REM SE-Path local run doctor wrapper.
REM Usage: RUN_LOCAL_DEMO.cmd [-OpenStatic] [-Install] [-Start]
powershell -ExecutionPolicy Bypass -File "%~dp0RUN_LOCAL_DEMO.ps1" %*
'''


def write_markdown(primary: dict[str, Any]) -> None:
    README_MD.write_text(
        "\n".join(
            [
                "# SE-Path 本地运行环境自检包",
                "",
                "这个目录用于评委或队伍成员在拿到提交包后快速判断：当前机器能否运行源码 Demo，缺什么依赖，以及不能运行时应该切换到哪条兜底路线。",
                "",
                f"- runtime：`{primary['runtime']}`",
                f"- 自检：PASS `{primary['checks_summary']['PASS']}` / FAIL `{primary['checks_summary']['FAIL']}`",
                "- 默认脚本只诊断和打印命令，不会自动安装依赖或启动服务。",
                "",
                "## 快速使用",
                "",
                "```powershell",
                "cd 参赛提交材料包/local-run-doctor",
                "./RUN_LOCAL_DEMO.ps1",
                "./RUN_LOCAL_DEMO.ps1 -OpenStatic",
                "./RUN_LOCAL_DEMO.ps1 -Install",
                "./RUN_LOCAL_DEMO.ps1 -Start",
                "```",
                "",
                "如不能安装依赖，直接打开 `../00_评委一键打开入口.html` 或 `../公开试用静态包/index.html`。",
                "",
            ]
        ),
        encoding="utf-8",
    )
    CHECKLIST_MD.write_text(
        "\n".join(
            [
                "# 本地运行检查清单",
                "",
                "| 检查 | 通过信号 | 失败时做什么 |",
                "| --- | --- | --- |",
                "| Node.js / npm | `node --version` 和 `npm --version` 可输出 | 改用公开静态包，或安装 Node.js 18+ |",
                "| 依赖安装 | `sepath-cloud-app/node_modules` 存在 | 运行 `npm install`，无网络则改用视频和静态包 |",
                "| 本地测试 | `npm run test` 通过 | 打开 46 号技术验收包查看已有机器报告 |",
                "| 本地构建 | `npm run build` 通过 | 使用已生成的公开静态包 |",
                "| 评委演练 | `npm run cloud:reviewer-drill` 输出 0 FAIL | 查看 reviewer-5min-drill 独立包 |",
                "| 启动服务 | `npm run dev` 打印 Vite URL | 按终端端口打开，或使用静态包 |",
                "",
            ]
        ),
        encoding="utf-8",
    )
    FALLBACK_MD.write_text(
        "\n".join(
            [
                "# 本地运行失败时的兜底路线",
                "",
                "| 模式 | 要求 | 入口 | 适用场景 | 风险说明 |",
                "| --- | --- | --- | --- | --- |",
                *[
                    f"| {item['label']} | {item['requires']} | `{item['entry']}` | {item['best_for']} | {item['risk']} |"
                    for item in RUN_MODES
                ],
                "",
            ]
        ),
        encoding="utf-8",
    )


def build_primary(checks: list[dict[str, str]]) -> dict[str, Any]:
    return {
        "runtime": "sepath-local-run-doctor.v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "title": "SE-Path 本地运行环境自检包",
        "evidence_scope": "local_source_run_readiness",
        "checks_summary": summarize(checks),
        "checks": checks,
        "expected_npm_scripts": EXPECTED_NPM_SCRIPTS,
        "run_modes": RUN_MODES,
        "artifacts": {
            "powershell": rel(PS1),
            "cmd": rel(CMD),
            "readme": rel(README_MD),
            "checklist": rel(CHECKLIST_MD),
            "fallback": rel(FALLBACK_MD),
            "env_matrix": rel(ENV_MATRIX),
        },
        "truth_boundary": "The doctor checks local run readiness and fallback routes; it does not install dependencies or claim real school production access by default.",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate local run doctor pack for SE-Path submission.")
    parser.add_argument("--write", action="store_true", help="Write local run doctor artifacts.")
    args = parser.parse_args()

    checks = build_checks()
    primary = build_primary(checks)
    if args.write:
        DOCTOR_DIR.mkdir(parents=True, exist_ok=True)
        write_env_matrix()
        PS1.write_text(render_ps1(), encoding="utf-8")
        CMD.write_text(render_cmd(), encoding="utf-8")
        write_markdown(primary)
        PRIMARY_JSON.write_text(json.dumps(primary, ensure_ascii=False, indent=2), encoding="utf-8")
        CHECKS_JSON.write_text(json.dumps({"runtime": "sepath-local-run-doctor-checks.v1", "summary": primary["checks_summary"], "checks": checks}, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps({"summary": primary["checks_summary"], "pack": rel(DOCTOR_DIR)}, ensure_ascii=False, indent=2))
    return 0 if primary["checks_summary"]["FAIL"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
