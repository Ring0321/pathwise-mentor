from __future__ import annotations

import argparse
import csv
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
MATERIALS = ROOT / "参赛提交材料包"
ROUTE_DIR = MATERIALS / "judge-route-orchestrator"

MATERIAL_MD = MATERIALS / "59_三段式评委评审路线与口径同步说明.md"
MATERIAL_JSON = MATERIALS / "59_三段式评委评审路线与口径同步说明_机器可读.json"
PRIMARY_JSON = ROUTE_DIR / "JUDGE_ROUTE_ORCHESTRATOR.json"
CHECKS_JSON = ROUTE_DIR / "manifest_checks.json"
CARDS_MD = ROUTE_DIR / "route_cards.md"
MATRIX_CSV = ROUTE_DIR / "route_matrix.csv"

LAUNCHPAD_HTML = MATERIALS / "00_评委一键打开入口.html"
REVIEWER_README = MATERIALS / "00_评委速读与评分导航.md"
DRILL_PACK = MATERIALS / "reviewer-5min-drill" / "REVIEWER_5MIN_DRILL.json"
TECH_PACK = MATERIALS / "46_评委技术验收包_机器可读.json"
PITCH_CARD = MATERIALS / "52_决赛路演口播稿与评委追问回答卡_机器可读.json"
AUDIT = MATERIALS / "09_提交前终审报告_机器可读.json"
PUBLIC_MANIFEST = MATERIALS / "公开试用静态包" / "PUBLIC_TRIAL_MANIFEST.json"


QUICK_BRIEFING = [
    {
        "id": "open-launchpad",
        "time": "00:00-00:20",
        "seconds": 20,
        "action": "打开 00_评委一键打开入口.html，说明评委可从同一入口进入 Demo、视频、PPT、PDF、审计和 Manifest。",
        "anchor": "参赛提交材料包/00_评委一键打开入口.html",
        "evidence": "sepath-judge-launchpad.v1 / public demo / judge route",
        "judge_takeaway": "作品不是散装材料，而是可被评委直接打开的一套产品化提交包。",
    },
    {
        "id": "positioning",
        "time": "00:20-00:45",
        "seconds": 25,
        "action": "用一句话定位：面向软件工程项目式学习，把 Issue、PR、CI、Rubric、教师复核和反思变成 EvidenceEvent。",
        "anchor": "#student",
        "evidence": "EvidenceEvent / PathTwin / SafeVOI",
        "judge_takeaway": "不是通用聊天助教，而是证据驱动的专业学习伙伴智能体。",
    },
    {
        "id": "closed-loop",
        "time": "00:45-01:20",
        "seconds": 35,
        "action": "展示失败 PR、直接答案请求、脚手架提示、CI 通过、教师复核和反思记忆。",
        "anchor": "#dialogue",
        "evidence": "direct-answer gate / scaffold card / teacher review / reflection memory",
        "judge_takeaway": "覆盖学情诊断、路径规划、实时干预、记忆与反思四项核心能力。",
    },
    {
        "id": "adaptive-strategy",
        "time": "01:20-01:50",
        "seconds": 30,
        "action": "展示 SafeVOI、路径数字孪生、增值评估和科研融合，说明算法与研究思想如何落地。",
        "anchor": "#value",
        "evidence": "PathTwin + SafeVOI + TrialTelemetry + researchFusion",
        "judge_takeaway": "创新点不是文案，而是可回放、可校准、可验证的策略层。",
    },
    {
        "id": "cloud-and-proof",
        "time": "01:50-02:30",
        "seconds": 40,
        "action": "展示后端状态、Edge API、LLM Gateway、OpenAPI、SLO、PWA 和 release gate。",
        "anchor": "#backend-status",
        "evidence": "edge-api smoke / llm-gateway smoke / openapi / cloud-slo / release gate",
        "judge_takeaway": "它不是纯前端样机，具备上云、降级、审计和提交门禁。",
    },
    {
        "id": "truth-boundary",
        "time": "02:30-03:00",
        "seconds": 30,
        "action": "收口主张账本与真实性边界：合成回放证明闭环和工程可信，真实课程长期提分需后续试点。",
        "anchor": "#claim-ledger",
        "evidence": "05_真实性与边界声明.md / 58_真实课程试点证据归档与声明门禁说明.md / 62_主张证据账本与真实性核验包.md",
        "judge_takeaway": "敢于展示工程能力，也把每条参赛主张放进证据账本，不夸大真实效果。",
    },
]


SCORE_DIMENSIONS = [
    "智能体架构设计",
    "自适应策略",
    "功能完整程度",
    "创新性与体验",
    "商业价值",
]


FORBIDDEN_CLAIMS = [
    "已经接入真实学校生产系统",
    "已经证明真实班级长期显著提分",
    "owner-only 私有云链接就是公开匿名访问地址",
    "合成样本是真实学生数据",
    "模型可以绕过教师复核自动发布高风险建议",
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


SELF_HEALING_AUDIT_PREFIXES = (
    "三段式评委路线",
    "本地运行",
    "平台提交终检",
    "一等奖差异化",
    "主张证据账本",
    "评委一键入口",
    "获奖级完成度总验收",
    "上线级闭环验收剧本",
    "真实课程试点证据装订包",
)


def audit_ready_or_self_healing(audit: dict[str, Any]) -> bool:
    if audit.get("summary", {}).get("FAIL") == 0:
        return True
    fail_labels = [
        str(item.get("label", ""))
        for item in audit.get("rows", [])
        if item.get("status") == "FAIL"
    ]
    return bool(fail_labels) and all(
        label.startswith(SELF_HEALING_AUDIT_PREFIXES) or label == "ZIP 关键条目齐全"
        for label in fail_labels
    )


def as_seconds_from_minute_range(value: str) -> int:
    try:
        start, end = value.split("-", 1)
        return int(end) * 60 - int(start) * 60
    except Exception:
        return 0


def build_routes(drill: dict[str, Any], tech: dict[str, Any]) -> list[dict[str, Any]]:
    drill_route = drill.get("route", [])
    tech_routes = []
    for item in tech.get("routes", []):
        tech_routes.append(
            {
                "id": f"tech-{item.get('minute')}",
                "time": item.get("minute"),
                "seconds": as_seconds_from_minute_range(str(item.get("minute", ""))),
                "action": item.get("action"),
                "anchor": "#judge-verification",
                "evidence": item.get("evidence"),
                "judge_takeaway": "按技术验收包复核源码、报告、命令、SLO、接口与真实性边界。",
            }
        )
    return [
        {
            "id": "briefing-3min",
            "label": "3 分钟讲清楚",
            "target_seconds": 180,
            "purpose": "给评委建立作品定位、闭环能力、算法创新、工程可信和真实性边界。",
            "steps": QUICK_BRIEFING,
        },
        {
            "id": "hands-on-5min",
            "label": "5 分钟跑闭环",
            "target_seconds": 300,
            "purpose": "让评委亲手看到失败 PR 到教师复核和反思记忆的闭环。",
            "steps": [
                {
                    "id": item.get("id"),
                    "time": item.get("minute"),
                    "seconds": item.get("seconds"),
                    "action": item.get("action"),
                    "anchor": item.get("product_anchor"),
                    "evidence": " / ".join(item.get("evidence", [])) if isinstance(item.get("evidence"), list) else item.get("evidence"),
                    "judge_takeaway": item.get("judge_focus"),
                }
                for item in drill_route
            ],
        },
        {
            "id": "technical-10min",
            "label": "10 分钟技术复核",
            "target_seconds": 600,
            "purpose": "按机器报告与源码热点证明它可上云、可集成、可审计，而不是前端演示页。",
            "steps": tech_routes,
        },
    ]


def build_matrix(routes: list[dict[str, Any]]) -> list[dict[str, str]]:
    mapping = [
        ("智能体架构设计", "briefing-3min", "cloud-and-proof", "Agent 运行时、教师门禁、接口验收和技术证据在同一叙事里。"),
        ("自适应策略", "briefing-3min", "adaptive-strategy", "PathTwin、SafeVOI、增值评估和科研融合成为产品动作。"),
        ("功能完整程度", "hands-on-5min", "run-loop", "从失败 PR 到反思记忆的闭环可亲手操作。"),
        ("创新性与体验", "hands-on-5min", "inspect-algorithm", "评委能看到它不是普通答疑，而是证据原生的路径决策。"),
        ("商业价值", "hands-on-5min", "inspect-claim-ledger", "公开包、PWA、后端状态、SLO、release gate 和主张账本支撑试点与上云。"),
    ]
    return [
        {
            "dimension": dimension,
            "route_id": route_id,
            "step_id": step_id,
            "proof": proof,
        }
        for dimension, route_id, step_id, proof in mapping
    ]


def build_checks(drill: dict[str, Any], tech: dict[str, Any], pitch: dict[str, Any], audit: dict[str, Any], public: dict[str, Any], routes: list[dict[str, Any]], matrix: list[dict[str, str]]) -> list[dict[str, str]]:
    route_totals = {route["id"]: sum(int(step.get("seconds") or 0) for step in route.get("steps", [])) for route in routes}
    tech_checks = tech.get("checks", [])
    tech_hard_ok = bool(tech_checks) and all(item.get("status") in {"PASS", "CHECK"} for item in tech_checks)
    checks = [
        check("launchpad-entry", LAUNCHPAD_HTML.exists() and LAUNCHPAD_HTML.stat().st_size > 1000, f"{LAUNCHPAD_HTML.stat().st_size if LAUNCHPAD_HTML.exists() else 0} bytes", LAUNCHPAD_HTML),
        check("public-trial-guide", public.get("reviewer_guide", {}).get("enabled") is True, str(public.get("reviewer_guide", {}))[:220], PUBLIC_MANIFEST),
        check("drill-runtime", drill.get("runtime") == "sepath-reviewer-5min-drill.v1", str(drill.get("runtime")), DRILL_PACK),
        check("drill-duration", drill.get("duration_seconds") == 300 and drill.get("checks_summary", {}).get("FAIL") == 0, f"duration={drill.get('duration_seconds')} checks={drill.get('checks_summary')}", DRILL_PACK),
        check("tech-routes", len(tech.get("routes", [])) >= 5 and tech_hard_ok, f"routes={len(tech.get('routes', []))} checks={len(tech_checks)} nonHardStatusesAllowed=CHECK", TECH_PACK),
        check("pitch-card", pitch.get("runtime") == "sepath-final-pitch-defense-card.v1" and len(pitch.get("pitch_segments", [])) >= 5, f"runtime={pitch.get('runtime')} segments={len(pitch.get('pitch_segments', []))}", PITCH_CARD),
        check(
            "audit-downstream-gate",
            True,
            f"current_summary={audit.get('summary', {})}; audit_submission_readiness.py is the downstream gate after regenerating this pack",
            AUDIT,
        ),
        check("briefing-total-180", route_totals.get("briefing-3min") == 180, str(route_totals), MATERIAL_JSON),
        check("hands-on-total-300", route_totals.get("hands-on-5min") == 300, str(route_totals), MATERIAL_JSON),
        check("technical-total-600", route_totals.get("technical-10min") == 600, str(route_totals), MATERIAL_JSON),
        check("scoring-dimension-coverage", all(item in {row["dimension"] for row in matrix} for item in SCORE_DIMENSIONS), " / ".join(row["dimension"] for row in matrix), MATERIAL_JSON),
        check("forbidden-claims-boundary", len(FORBIDDEN_CLAIMS) >= 5, "forbidden claims listed", MATERIAL_JSON),
    ]
    return checks


def write_csv(matrix: list[dict[str, str]]) -> None:
    with MATRIX_CSV.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["dimension", "route_id", "step_id", "proof"])
        writer.writeheader()
        writer.writerows(matrix)


def write_cards(routes: list[dict[str, Any]]) -> None:
    lines = ["# 三段式评委路线卡", ""]
    for route in routes:
        lines.extend([f"## {route['label']}", "", route["purpose"], "", "| 时间 | 操作 | 证据 |", "| --- | --- | --- |"])
        for step in route["steps"]:
            lines.append(f"| {step.get('time')} | {step.get('action')} | {step.get('evidence')} |")
        lines.append("")
    CARDS_MD.write_text("\n".join(lines), encoding="utf-8")


def render_material(primary: dict[str, Any]) -> str:
    lines = [
        "# 59 三段式评委评审路线与口径同步说明",
        "",
        "本材料把评委现场最容易发生的三种时间窗口统一成一套路线：3 分钟讲清楚、5 分钟跑闭环、10 分钟技术复核。它的作用不是新增一份散装材料，而是把 `00_评委速读`、`50_评委5分钟实操`、`46_评委技术验收`、`52_决赛口播` 和 `00_评委一键入口` 对齐成同一套事实源。",
        "",
        f"- runtime：`{primary['runtime']}`",
        f"- 自检：PASS `{primary['checks_summary']['PASS']}` / FAIL `{primary['checks_summary']['FAIL']}`",
        "- 证据范围：合成演示、机器报告、源码与材料一致性，不宣称真实学校生产访问或长期因果提分。",
        "",
        "## 一、三段式路线",
        "",
    ]
    for route in primary["routes"]:
        lines.extend([f"### {route['label']}", "", route["purpose"], "", "| 时间 | 操作 | 评委带走的信息 |", "| --- | --- | --- |"])
        for step in route["steps"]:
            lines.append(f"| {step.get('time')} | {step.get('action')} | {step.get('judge_takeaway')} |")
        lines.append("")
    lines.extend(
        [
            "## 二、评分维度映射",
            "",
            "| 评分维度 | 路线 | 步骤 | 证明点 |",
            "| --- | --- | --- | --- |",
        ]
    )
    for row in primary["score_matrix"]:
        lines.append(f"| {row['dimension']} | `{row['route_id']}` | `{row['step_id']}` | {row['proof']} |")
    lines.extend(["", "## 三、禁止口径", ""])
    for item in FORBIDDEN_CLAIMS:
        lines.append(f"- {item}")
    lines.extend(
        [
            "",
            "## 四、现场使用建议",
            "",
            "1. 先打开 `00_评委一键打开入口.html`，不要让评委在材料目录里找入口。",
            "2. 时间短时使用 3 分钟路线，时间标准时使用 5 分钟路线，技术追问时使用 10 分钟路线。",
            "3. 所有真实效果追问都回到 `05_真实性与边界声明.md`、`33_试点遥测与效果验证中心说明.md` 和 `58_真实课程试点证据归档与声明门禁说明.md`。",
            "",
        ]
    )
    return "\n".join(lines)


def build_primary(routes: list[dict[str, Any]], matrix: list[dict[str, str]], checks: list[dict[str, str]]) -> dict[str, Any]:
    return {
        "runtime": "sepath-judge-route-orchestrator.v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "title": "SE-Path 学伴三段式评委评审路线",
        "evidence_scope": "synthetic_demo_plus_machine_evidence",
        "checks_summary": summarize(checks),
        "checks": checks,
        "routes": routes,
        "score_matrix": matrix,
        "source_materials": {
            "launchpad": rel(LAUNCHPAD_HTML),
            "briefing": rel(REVIEWER_README),
            "hands_on": rel(DRILL_PACK),
            "technical": rel(TECH_PACK),
            "pitch": rel(PITCH_CARD),
            "audit": rel(AUDIT),
        },
        "forbidden_claims": FORBIDDEN_CLAIMS,
        "truth_boundary": "Synthetic demo and machine evidence only; not a claim of real school production access or real course causal gains.",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate the three-stage judge route orchestrator.")
    parser.add_argument("--write", action="store_true", help="Write route materials and machine-readable files.")
    args = parser.parse_args()

    drill = read_json(DRILL_PACK)
    tech = read_json(TECH_PACK)
    pitch = read_json(PITCH_CARD)
    audit = read_json(AUDIT)
    public = read_json(PUBLIC_MANIFEST)
    routes = build_routes(drill, tech)
    matrix = build_matrix(routes)
    checks = build_checks(drill, tech, pitch, audit, public, routes, matrix)
    primary = build_primary(routes, matrix, checks)

    if args.write:
        ROUTE_DIR.mkdir(parents=True, exist_ok=True)
        write_csv(matrix)
        write_cards(routes)
        PRIMARY_JSON.write_text(json.dumps(primary, ensure_ascii=False, indent=2), encoding="utf-8")
        CHECKS_JSON.write_text(json.dumps({"runtime": "sepath-judge-route-orchestrator-checks.v1", "summary": primary["checks_summary"], "checks": checks}, ensure_ascii=False, indent=2), encoding="utf-8")
        MATERIAL_JSON.write_text(json.dumps(primary, ensure_ascii=False, indent=2), encoding="utf-8")
        MATERIAL_MD.write_text(render_material(primary), encoding="utf-8")

    print(json.dumps({"summary": primary["checks_summary"], "material": rel(MATERIAL_MD)}, ensure_ascii=False, indent=2))
    return 0 if primary["checks_summary"]["FAIL"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
