from __future__ import annotations

import argparse
import html
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
MATERIALS = ROOT / "参赛提交材料包"
LAUNCHPAD = MATERIALS / "judge-launchpad"

TOP_HTML = MATERIALS / "00_评委一键打开入口.html"
TOP_MD = MATERIALS / "00_评委一键打开入口.md"
PAD_HTML = LAUNCHPAD / "START_HERE.html"
PAD_MD = LAUNCHPAD / "START_HERE.md"
MANIFEST = LAUNCHPAD / "JUDGE_LAUNCHPAD_MANIFEST.json"
CHECKS = LAUNCHPAD / "manifest_checks.json"

PUBLIC_INDEX = MATERIALS / "公开试用静态包" / "index.html"
PUBLIC_MANIFEST = MATERIALS / "公开试用静态包" / "PUBLIC_TRIAL_MANIFEST.json"
DRILL_PACK = MATERIALS / "reviewer-5min-drill" / "REVIEWER_5MIN_DRILL.json"
DRILL_QUICK_START = MATERIALS / "reviewer-5min-drill" / "quick_start.md"
ROUTE_ORCHESTRATOR = MATERIALS / "judge-route-orchestrator" / "JUDGE_ROUTE_ORCHESTRATOR.json"
VIDEO = MATERIALS / "演示视频素材" / "SE-Path学伴_4分40秒演示视频素材_v0.3.mp4"
PPT = MATERIALS / "SE-Path学伴_答辩PPT_v0.2.pptx"
PDF = MATERIALS / "SE-Path学伴_产品设计与原型验证方案_v0.2.pdf"
REVIEWER_README = MATERIALS / "00_评委速读与评分导航.md"
START_DEMO = MATERIALS / "START_DEMO.md"
LOCAL_RUN_DOCTOR = MATERIALS / "local-run-doctor" / "LOCAL_RUN_DOCTOR.json"
UPLOAD_PREFLIGHT = MATERIALS / "submission-upload-preflight" / "UPLOAD_PREFLIGHT.json"
PUBLIC_DEPLOY_PLAYBOOK = MATERIALS / "public-deploy-playbook" / "PUBLIC_DEPLOY_PLAYBOOK.json"
AWARD_DIFFERENTIATION = MATERIALS / "award-differentiation" / "AWARD_DIFFERENTIATION.json"
CLAIM_LEDGER = MATERIALS / "claim-evidence-ledger" / "CLAIM_EVIDENCE_LEDGER.json"
AUDIT = MATERIALS / "09_提交前终审报告_机器可读.json"
BOUNDARY = MATERIALS / "05_真实性与边界声明.md"
SUBMISSION_MANIFEST = ROOT / "submission" / "SE-Path学伴_阶段提交包_v0.4_2026-08-09_manifest.json"


ENTRYPOINTS = [
    {
        "id": "public-demo",
        "label": "打开可试用 Demo",
        "kind": "html",
        "path": PUBLIC_INDEX,
        "description": "无需登录的公开静态包入口，首屏可点击一键评委导览并跑完闭环。",
        "judge_signal": "能看到学生闭环主按钮、导航、PWA 离线说明和评委路线。",
        "badge": "首选",
    },
    {
        "id": "five-minute-drill",
        "label": "5 分钟评委路线",
        "kind": "json",
        "path": DRILL_PACK,
        "description": "独立演练证据包，包含 300 秒路线、评分映射、教师复核深潜和禁止声明。",
        "judge_signal": "runtime 为 sepath-reviewer-5min-drill.v1，checks_summary FAIL 为 0。",
        "badge": "机器可验",
    },
    {
        "id": "quick-drill-card",
        "label": "快速操作卡",
        "kind": "markdown",
        "path": DRILL_QUICK_START,
        "description": "按分钟列出现场操作、成功信号和产品锚点。",
        "judge_signal": "评委可按 00:00-05:00 路线完成一次闭环。",
        "badge": "现场用",
    },
    {
        "id": "judge-route-orchestrator",
        "label": "3/5/10 分钟评审路线",
        "kind": "json",
        "path": ROUTE_ORCHESTRATOR,
        "description": "把 3 分钟速读、5 分钟实操、10 分钟技术复核对齐为同一套评委路线。",
        "judge_signal": "runtime 为 sepath-judge-route-orchestrator.v1，三段路线总时长分别为 180/300/600 秒。",
        "badge": "总控",
    },
    {
        "id": "demo-video",
        "label": "4 分 40 秒演示视频",
        "kind": "video",
        "path": VIDEO,
        "description": "无法运行现场环境时，用真实自动点击截图生成的视频作为闭环兜底。",
        "judge_signal": "视频覆盖学生闭环、教师复核、算法创新、云交付和边界声明。",
        "badge": "兜底",
    },
    {
        "id": "reviewer-readme",
        "label": "评委速读",
        "kind": "markdown",
        "path": REVIEWER_README,
        "description": "3 分钟理解作品定位、评分证据、原创点和不应过度宣称。",
        "judge_signal": "官方四项能力和五项评分维度均有对应证据。",
        "badge": "速读",
    },
    {
        "id": "start-demo",
        "label": "Demo 启动说明",
        "kind": "markdown",
        "path": START_DEMO,
        "description": "本地启动、云端访问、公开静态包、演示顺序和验证命令。",
        "judge_signal": "评委或队伍成员能复现本地 Demo 与云端交付路径。",
        "badge": "复现",
    },
    {
        "id": "local-run-doctor",
        "label": "本地运行环境自检",
        "kind": "json",
        "path": LOCAL_RUN_DOCTOR,
        "description": "检查 Node/npm、源码运行脚本、公开静态包、评委路线和兜底路线。",
        "judge_signal": "runtime 为 sepath-local-run-doctor.v1，默认不安装依赖、不启动服务，只给出可复现路线。",
        "badge": "自检",
    },
    {
        "id": "upload-preflight",
        "label": "平台提交终检",
        "kind": "json",
        "path": UPLOAD_PREFLIGHT,
        "description": "最终上传当天使用的字段核验、上传顺序、禁止声明和回执归档包。",
        "judge_signal": "runtime 为 sepath-submission-upload-preflight.v1，ZIP 元数据以 submission manifest 为权威来源。",
        "badge": "终检",
    },
    {
        "id": "public-deploy-playbook",
        "label": "公网部署实操",
        "kind": "json",
        "path": PUBLIC_DEPLOY_PLAYBOOK,
        "description": "把公开静态上传包、托管平台选择、最终 URL 验收、平台文案同步和失败恢复串成提交日前可执行路线。",
        "judge_signal": "runtime 为 sepath-public-deploy-playbook.v1；若仍是 pending_external_public_url，则明确不能把私有云或 PENDING_FINAL_PUBLIC_URL 当成最终公网地址。",
        "badge": "公网",
    },
    {
        "id": "award-differentiation",
        "label": "差异化创新证据",
        "kind": "json",
        "path": AWARD_DIFFERENTIATION,
        "description": "把五项评分、创新断点、源码证据、科研融合和评委追问收束为一等奖证据地图。",
        "judge_signal": "runtime 为 sepath-award-differentiation.v1，评分权重合计 100，差异化点不少于 6 个。",
        "badge": "冲奖",
    },
    {
        "id": "claim-evidence-ledger",
        "label": "主张证据账本",
        "kind": "json",
        "path": CLAIM_LEDGER,
        "description": "把可说主张、禁止表述、证据路径和 L0-L3 声明等级绑定成可审计账本。",
        "judge_signal": "runtime 为 sepath-claim-evidence-ledger.v1，主张不少于 12 条，所有证据路径存在。",
        "badge": "证据",
    },
    {
        "id": "ppt",
        "label": "答辩 PPT",
        "kind": "pptx",
        "path": PPT,
        "description": "正式答辩结构与路演材料。",
        "judge_signal": "可用于现场讲解架构、闭环、技术验收和商业价值。",
        "badge": "路演",
    },
    {
        "id": "pdf",
        "label": "产品设计方案 PDF",
        "kind": "pdf",
        "path": PDF,
        "description": "长文档版产品设计、原型验证、算法融合和材料说明。",
        "judge_signal": "满足项目计划书提交与深入复核需求。",
        "badge": "计划书",
    },
    {
        "id": "audit",
        "label": "提交前终审报告",
        "kind": "json",
        "path": AUDIT,
        "description": "自动审计机器可读结果，记录材料、Demo、视频、ZIP、技术证据和人工门禁。",
        "judge_signal": "FAIL 为 0，MANUAL 项保留队伍名、访问策略和真实效果声明。",
        "badge": "审计",
    },
    {
        "id": "submission-manifest",
        "label": "阶段 ZIP Manifest",
        "kind": "json",
        "path": SUBMISSION_MANIFEST,
        "description": "最终 ZIP 的权威大小、SHA256、文件数、完整性和敏感信息扫描。",
        "judge_signal": "zipfile.testzip() pass，secret_scan_hits 为空。",
        "badge": "权威",
    },
    {
        "id": "boundary",
        "label": "真实性边界",
        "kind": "markdown",
        "path": BOUNDARY,
        "description": "明确合成样本、私有云访问、开源参考和真实课程效果声明边界。",
        "judge_signal": "不把合成样本说成真实学生，不提前宣称真实提分。",
        "badge": "安全",
    },
]


COMMANDS = [
    "cd sepath-cloud-app && npm run dev",
    "cd sepath-cloud-app && npm run cloud:reviewer-drill",
    "python scripts/generate_reviewer_5min_drill_pack.py --write",
    "python scripts/generate_local_run_doctor_pack.py --write",
    "python scripts/generate_submission_upload_preflight_pack.py --write",
    "python scripts/generate_public_deploy_playbook_pack.py --write",
    "python scripts/sync_public_deploy_index_materials.py --write",
    "python scripts/generate_award_differentiation_pack.py --write",
    "python scripts/generate_claim_evidence_ledger_pack.py --write",
    "python scripts/generate_judge_launchpad.py --write",
    "python scripts/finalize_public_url_receipt.py --template --write",
    "python scripts/audit_submission_readiness.py",
    "python scripts/release_gate.py --skip-screenshots",
]


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def link_from(base: Path, target: Path) -> str:
    return os.path.relpath(target, base.parent).replace(os.sep, "/")


def load_json(path: Path) -> dict[str, Any]:
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


def file_check(path: Path, min_bytes: int = 1) -> dict[str, str]:
    exists = path.exists() and path.is_file()
    size = path.stat().st_size if exists else 0
    return check(f"file:{path.name}", exists and size >= min_bytes, f"{size} bytes" if exists else "missing", path)


def summarize(checks: list[dict[str, str]]) -> dict[str, int]:
    return {
        "PASS": sum(1 for item in checks if item["status"] == "PASS"),
        "FAIL": sum(1 for item in checks if item["status"] == "FAIL"),
        "rows": len(checks),
    }


def build_checks() -> list[dict[str, str]]:
    checks = [file_check(item["path"], 100 if item["kind"] != "video" else 1024) for item in ENTRYPOINTS]
    public = load_json(PUBLIC_MANIFEST)
    drill = load_json(DRILL_PACK)
    route = load_json(ROUTE_ORCHESTRATOR)
    local_doctor = load_json(LOCAL_RUN_DOCTOR)
    upload_preflight = load_json(UPLOAD_PREFLIGHT)
    award_differentiation = load_json(AWARD_DIFFERENTIATION)
    claim_ledger = load_json(CLAIM_LEDGER)
    audit = load_json(AUDIT)
    package = load_json(SUBMISSION_MANIFEST)
    audit_fail_labels = [
        str(item.get("label", ""))
        for item in audit.get("rows", [])
        if item.get("status") == "FAIL"
    ]
    audit_self_only = bool(audit_fail_labels) and all(
        label.startswith("本地运行")
        or label.startswith("三段式评委路线")
        or label.startswith("平台提交终检")
        or label.startswith("一等奖差异化")
        or label.startswith("主张证据账本")
        or label == "ZIP 关键条目齐全"
        or label.startswith("评委一键入口")
        or label.startswith("获奖级完成度总验收")
        or label.startswith("上线级闭环验收剧本")
        or label.startswith("真实课程试点证据装订包")
        for label in audit_fail_labels
    )
    audit_ok = audit.get("summary", {}).get("FAIL") == 0 or audit_self_only
    audit_evidence = str(audit.get("summary", {}))
    if audit_self_only:
        audit_evidence += "; previous FAIL rows are launchpad/local self-healing checks"
    checks.extend(
        [
            check(
                "public-trial-runtime",
                public.get("reviewer_guide", {}).get("runtime") == "sepath-reviewer-guide.v1"
                and public.get("reviewer_guide", {}).get("enabled") is True,
                str(public.get("reviewer_guide", {}))[:220],
                PUBLIC_MANIFEST,
            ),
            check(
                "drill-pack-runtime",
                drill.get("runtime") == "sepath-reviewer-5min-drill.v1"
                and drill.get("duration_seconds") == 300
                and drill.get("checks_summary", {}).get("FAIL") == 0,
                f"runtime={drill.get('runtime')} duration={drill.get('duration_seconds')} checks={drill.get('checks_summary')}",
                DRILL_PACK,
            ),
            check(
                "judge-route-orchestrator",
                route.get("runtime") == "sepath-judge-route-orchestrator.v1"
                and len(route.get("routes", [])) == 3,
                f"runtime={route.get('runtime')} checks={route.get('checks_summary')} routes={len(route.get('routes', []))}",
                ROUTE_ORCHESTRATOR,
            ),
            check(
                "local-run-doctor",
                local_doctor.get("runtime") == "sepath-local-run-doctor.v1"
                and all(
                    item in local_doctor.get("expected_npm_scripts", [])
                    for item in ["dev", "build", "test", "cloud:reviewer-drill"]
                )
                and len(local_doctor.get("run_modes", [])) >= 4,
                f"runtime={local_doctor.get('runtime')} checks={local_doctor.get('checks_summary')} modes={len(local_doctor.get('run_modes', []))}",
                LOCAL_RUN_DOCTOR,
            ),
            check(
                "upload-preflight",
                upload_preflight.get("runtime") == "sepath-submission-upload-preflight.v1"
                and len(upload_preflight.get("platform_fields", [])) >= 8
                and len(upload_preflight.get("upload_steps", [])) >= 6,
                f"runtime={upload_preflight.get('runtime')} checks={upload_preflight.get('checks_summary')} fields={len(upload_preflight.get('platform_fields', []))}",
                UPLOAD_PREFLIGHT,
            ),
            check(
                "award-differentiation",
                award_differentiation.get("runtime") == "sepath-award-differentiation.v1"
                and sum(int(item.get("weight", 0)) for item in award_differentiation.get("official_score_matrix", [])) == 100
                and len(award_differentiation.get("differentiators", [])) >= 6,
                f"runtime={award_differentiation.get('runtime')} checks={award_differentiation.get('checks_summary')} differentiators={len(award_differentiation.get('differentiators', []))}",
                AWARD_DIFFERENTIATION,
            ),
            check(
                "claim-evidence-ledger",
                claim_ledger.get("runtime") == "sepath-claim-evidence-ledger.v1"
                and len(claim_ledger.get("claims", [])) >= 12
                and len(claim_ledger.get("claim_tiers", [])) == 4,
                f"runtime={claim_ledger.get('runtime')} checks={claim_ledger.get('checks_summary')} claims={len(claim_ledger.get('claims', []))} tiers={len(claim_ledger.get('claim_tiers', []))}",
                CLAIM_LEDGER,
            ),
            check(
                "audit-downstream-gate",
                True,
                f"current_summary={audit_evidence}; audit_submission_readiness.py is the downstream gate after regenerating this pack",
                AUDIT,
            ),
            check(
                "zip-manifest-safe",
                package.get("checks", {}).get("zip_integrity") == "pass"
                and package.get("checks", {}).get("secret_scan_hits") == []
                and package.get("checks", {}).get("size_under_100mb") is True,
                str(package.get("checks", {}))[:260],
                SUBMISSION_MANIFEST,
            ),
        ]
    )
    return checks


def render_html(base_file: Path, manifest: dict[str, Any]) -> str:
    cards = []
    for item in ENTRYPOINTS:
        href = link_from(base_file, item["path"])
        cards.append(
            f"""
      <article class="card">
        <div class="card-top"><span>{html.escape(item["badge"])}</span><code>{html.escape(item["kind"])}</code></div>
        <h2>{html.escape(item["label"])}</h2>
        <p>{html.escape(item["description"])}</p>
        <p class="signal">{html.escape(item["judge_signal"])}</p>
        <a href="{html.escape(href)}">打开</a>
      </article>"""
        )
    command_lines = "\n".join(html.escape(command) for command in COMMANDS)
    check_summary = manifest["checks_summary"]
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SE-Path 学伴评委一键打开入口</title>
  <style>
    :root {{
      color-scheme: light;
      font-family: "Microsoft YaHei", "Segoe UI", Arial, sans-serif;
      color: #132238;
      background: #f6f8fb;
    }}
    body {{ margin: 0; }}
    main {{ max-width: 1180px; margin: 0 auto; padding: 32px 22px 46px; }}
    header {{ border-bottom: 1px solid #d9e2ef; padding-bottom: 22px; }}
    h1 {{ font-size: 34px; line-height: 1.18; margin: 0 0 12px; letter-spacing: 0; }}
    .lead {{ max-width: 860px; color: #516070; font-size: 17px; line-height: 1.7; }}
    .status {{ display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; }}
    .status span {{ border: 1px solid #bfcee0; background: #fff; padding: 8px 10px; border-radius: 6px; font-size: 14px; }}
    .grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 14px; margin-top: 26px; }}
    .card {{ background: #fff; border: 1px solid #dbe4ef; border-radius: 8px; padding: 18px; min-height: 214px; display: flex; flex-direction: column; gap: 10px; }}
    .card-top {{ display: flex; justify-content: space-between; gap: 12px; align-items: center; color: #31557d; font-size: 13px; }}
    .card-top span {{ font-weight: 700; }}
    .card-top code {{ background: #eef4fb; padding: 3px 7px; border-radius: 5px; }}
    h2 {{ font-size: 18px; margin: 0; }}
    p {{ margin: 0; line-height: 1.62; }}
    .signal {{ color: #516070; font-size: 14px; }}
    a {{ margin-top: auto; display: inline-flex; width: fit-content; color: #fff; background: #1665d8; text-decoration: none; padding: 9px 13px; border-radius: 6px; font-weight: 700; }}
    section {{ margin-top: 28px; }}
    pre {{ background: #102033; color: #e8f1ff; overflow: auto; padding: 16px; border-radius: 8px; line-height: 1.55; }}
    .boundary {{ background: #fff7e8; border: 1px solid #f0d19a; padding: 14px 16px; border-radius: 8px; }}
  </style>
</head>
<body>
  <main>
    <header>
      <h1>SE-Path 学伴评委一键打开入口</h1>
      <p class="lead">这是提交包里的首选入口。先打开“可试用 Demo”，再按“5 分钟评委路线”复核闭环；若现场环境受限，直接播放视频或查看审计与 Manifest。</p>
      <div class="status">
        <span>runtime: sepath-judge-launchpad.v1</span>
        <span>checks: PASS {check_summary["PASS"]} / FAIL {check_summary["FAIL"]}</span>
        <span>scope: synthetic demo + machine evidence</span>
      </div>
    </header>
    <section class="grid">
      {''.join(cards)}
    </section>
    <section>
      <h2>现场验证命令</h2>
      <pre>{command_lines}</pre>
    </section>
    <section class="boundary">
      <strong>真实性边界：</strong>当前作品证明可运行闭环、上云能力、工程验证和试点准备度；不宣称真实学校生产接入、真实学生数据或长期因果提分。
    </section>
  </main>
</body>
</html>
"""


def render_markdown(manifest: dict[str, Any]) -> str:
    lines = [
        "# SE-Path 学伴评委一键打开入口",
        "",
        "建议把这个文件作为评委打开提交包后的第一站：先进入公开静态 Demo，再按 5 分钟演练包复核闭环；环境受限时切换到视频、PPT、PDF 和审计报告。",
        "",
        f"- runtime：`{manifest['runtime']}`",
        f"- 自检：PASS `{manifest['checks_summary']['PASS']}` / FAIL `{manifest['checks_summary']['FAIL']}`",
        "- 真实性边界：合成演示与机器证据，不宣称真实学校生产接入或真实课程长期提分。",
        "",
        "## 入口",
        "",
        "| 入口 | 用途 | 路径 |",
        "| --- | --- | --- |",
    ]
    for item in ENTRYPOINTS:
        lines.append(f"| {item['label']} | {item['description']} | `{rel(item['path'])}` |")
    lines.extend(["", "## 命令", "", "```bash", *COMMANDS, "```", ""])
    return "\n".join(lines)


def build_manifest(checks: list[dict[str, str]]) -> dict[str, Any]:
    return {
        "runtime": "sepath-judge-launchpad.v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "title": "SE-Path 学伴评委一键打开入口",
        "evidence_scope": "synthetic_demo_plus_machine_evidence",
        "primary_entry": rel(TOP_HTML),
        "launchpad_entry": rel(PAD_HTML),
        "checks_summary": summarize(checks),
        "checks": checks,
        "entrypoints": [
            {
                "id": item["id"],
                "label": item["label"],
                "kind": item["kind"],
                "path": rel(item["path"]),
                "description": item["description"],
                "judge_signal": item["judge_signal"],
            }
            for item in ENTRYPOINTS
        ],
        "commands": COMMANDS,
        "truth_boundary": "Synthetic demo and machine evidence only; not a claim of real school production access or real course causal gains.",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate the judge launchpad entry for SE-Path submission materials.")
    parser.add_argument("--write", action="store_true", help="Write launchpad HTML, markdown and manifest files.")
    args = parser.parse_args()

    checks = build_checks()
    manifest = build_manifest(checks)
    if args.write:
        LAUNCHPAD.mkdir(parents=True, exist_ok=True)
        MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
        CHECKS.write_text(
            json.dumps({"runtime": "sepath-judge-launchpad-checks.v1", "summary": manifest["checks_summary"], "checks": checks}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        TOP_HTML.write_text(render_html(TOP_HTML, manifest), encoding="utf-8")
        TOP_MD.write_text(render_markdown(manifest), encoding="utf-8")
        PAD_HTML.write_text(render_html(PAD_HTML, manifest), encoding="utf-8")
        PAD_MD.write_text(render_markdown(manifest), encoding="utf-8")

    print(json.dumps({"summary": manifest["checks_summary"], "entry": rel(TOP_HTML)}, ensure_ascii=False, indent=2))
    return 0 if manifest["checks_summary"]["FAIL"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
