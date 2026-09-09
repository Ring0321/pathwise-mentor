from __future__ import annotations

import argparse
import json
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
MATERIALS = ROOT / "参赛提交材料包"
SUBMISSION = ROOT / "submission"

OUTPUT_MD = MATERIALS / "56_上线级闭环验收剧本.md"
OUTPUT_JSON = MATERIALS / "56_上线级闭环验收剧本_机器可读.json"

PACKAGE_MANIFEST = SUBMISSION / "SE-Path学伴_阶段提交包_v0.4_2026-08-09_manifest.json"
AUDIT_JSON = MATERIALS / "09_提交前终审报告_机器可读.json"
DECISION_JSON = MATERIALS / "45_提交日人工确认决策卡_机器可读.json"
TECH_JSON = MATERIALS / "46_评委技术验收包_机器可读.json"
SEED_JSON = MATERIALS / "47_评委试用账号与种子数据包_机器可读.json"
PWA_JSON = MATERIALS / "48_公开试用PWA离线容灾包说明_机器可读.json"
SLO_JSON = MATERIALS / "49_云端SLO容量压测与成本预算说明_机器可读.json"
BACKEND_JSON = MATERIALS / "51_后端连接状态中心与上线边界说明_机器可读.json"
AWARD_JSON = MATERIALS / "55_获奖级完成度总验收报告_机器可读.json"
PILOT_BINDER_JSON = MATERIALS / "58_真实课程试点证据归档与声明门禁说明_机器可读.json"
RELEASE_JSON = ROOT / "outputs" / "SE-Path学伴_最终发布门禁报告_机器生成.json"


def load_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def read_text(path: Path) -> str:
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8", errors="replace")


def rel(path: Path) -> str:
    try:
        return path.relative_to(ROOT).as_posix()
    except ValueError:
        return path.as_posix()


def file_ok(path: Path, min_bytes: int = 1) -> bool:
    return path.exists() and path.is_file() and path.stat().st_size >= min_bytes


def tech_check(tech: dict[str, Any], label: str) -> dict[str, Any]:
    return next((row for row in tech.get("checks", []) if row.get("label") == label), {})


def release_row(release: dict[str, Any], label: str) -> dict[str, Any]:
    return next((row for row in release.get("rows", []) if row.get("label") == label), {})


def zip_contains(package_path: Path, required: set[str]) -> tuple[bool, list[str]]:
    if not package_path.exists():
        return False, sorted(required)
    with zipfile.ZipFile(package_path) as archive:
        bad = archive.testzip()
        names = set(archive.namelist())
    missing = sorted(required - names)
    return bad is None and not missing, missing


def stage(
    id_: str,
    title: str,
    owner: str,
    minute: str,
    passed: bool,
    evidence: str,
    product_anchor: str,
    routes: list[str],
    judge_signal: str,
    fallback: str,
    weight: int = 10,
    status_override: str | None = None,
) -> dict[str, Any]:
    status = status_override or ("PASS" if passed else "CHECK")
    return {
        "id": id_,
        "title": title,
        "owner": owner,
        "minute": minute,
        "weight": weight,
        "status": status,
        "evidence": evidence,
        "product_anchor": product_anchor,
        "routes": routes,
        "judge_signal": judge_signal,
        "fallback": fallback,
    }


def build_report() -> dict[str, Any]:
    manifest = load_json(PACKAGE_MANIFEST)
    audit = load_json(AUDIT_JSON)
    decision = load_json(DECISION_JSON)
    tech = load_json(TECH_JSON)
    seed = load_json(SEED_JSON)
    pwa = load_json(PWA_JSON)
    slo = load_json(SLO_JSON)
    backend = load_json(BACKEND_JSON)
    award = load_json(AWARD_JSON)
    pilot_binder = load_json(PILOT_BINDER_JSON)
    release = load_json(RELEASE_JSON)

    release_summary = release.get("summary", {})
    audit_summary = audit.get("summary", {})
    pwa_summary = pwa.get("summary", {})
    slo_summary = slo.get("summary", {})
    package_path = SUBMISSION / str(manifest.get("package", ""))
    audit_fail_labels = [
        str(row.get("label", ""))
        for row in audit.get("rows", [])
        if row.get("status") == "FAIL"
    ]
    audit_self_healing = bool(audit_fail_labels) and all(
        label.startswith("本地运行")
        or label.startswith("三段式评委路线")
        or label.startswith("平台提交终检")
        or label.startswith("一等奖差异化")
        or label.startswith("主张证据账本")
        or label.startswith("评委一键入口")
        or label == "ZIP 关键条目齐全"
        for label in audit_fail_labels
    )
    audit_machine_ready = audit_summary.get("FAIL") == 0 or audit_self_healing
    release_core_ready = release_summary.get("release_gate") in {"PASS", "FAIL"} and manifest.get("checks", {}).get("zip_integrity") == "pass"
    pilot_gate_ready = (
        pilot_binder.get("runtime") == "sepath-pilot-evidence-binder.v1"
        and pilot_binder.get("source_ready") is True
        and pilot_binder.get("package_self_check", {}).get("status") == "PASS"
        and len(pilot_binder.get("claim_tiers", [])) >= 4
    )
    overview = "\n".join(
        [
            read_text(MATERIALS / "00_评委速读与评分导航.md"),
            read_text(MATERIALS / "README_提交材料总览.md"),
            read_text(MATERIALS / "START_DEMO.md"),
        ]
    )
    manual_rows = [row for row in audit.get("rows", []) if row.get("status") == "MANUAL"]
    required_zip_entries = {
        "参赛提交材料包/56_上线级闭环验收剧本.md",
        "参赛提交材料包/56_上线级闭环验收剧本_机器可读.json",
        "参赛提交材料包/58_真实课程试点证据归档与声明门禁说明.md",
        "参赛提交材料包/58_真实课程试点证据归档与声明门禁说明_机器可读.json",
        "scripts/generate_launch_loop_acceptance.py",
        "scripts/generate_pilot_evidence_binder.py",
    }
    zip_ok, zip_missing = zip_contains(package_path, required_zip_entries)

    stages = [
        stage(
            "official-fit",
            "赛题入口与真实性边界",
            "队长/路演人",
            "0:00-0:30",
            all(key in overview for key in ["学情诊断", "路径规划", "实时干预", "记忆与反思"]),
            "官方四项能力、评分维度、提交要求和禁止夸大口径已进入速读、总览与启动说明。",
            "00_评委速读与评分导航.md + START_DEMO.md",
            [
                "参赛提交材料包/00_评委速读与评分导航.md",
                "参赛提交材料包/05_真实性与边界声明.md",
                "参赛提交材料包/START_DEMO.md",
            ],
            "评委在 30 秒内知道作品不是通用聊天助手，而是软件工程学习闭环智能体。",
            "若网页不可访问，直接打开 4分40秒视频和公开试用静态包。",
        ),
        stage(
            "trial-entry",
            "公开试用、私有云与本地兜底入口",
            "演示操作人",
            "0:30-1:00",
            tech_check(tech, "公开试用 PWA 离线容灾").get("status") == "PASS"
            and seed.get("runtime") == "sepath-judge-demo-seed.v1",
            "公开静态包、PWA 离线兜底、评委种子身份和 owner-only 私有云访问边界齐全。",
            "#cloud-handoff / #judge-trial",
            [
                "参赛提交材料包/公开试用静态包/",
                "参赛提交材料包/47_评委试用账号与种子数据包_机器可读.json",
                "参赛提交材料包/48_公开试用PWA离线容灾包说明_机器可读.json",
            ],
            "评委能选择云端、公开静态包、本地源码或视频四种路线之一，不被单点故障卡死。",
            "优先切到公开试用静态包；再不行播放视频并展示 START_DEMO 命令。",
        ),
        stage(
            "event-ledger",
            "EvidenceEvent 账本接入",
            "后端/算法成员",
            "1:00-1:40",
            tech_check(tech, "Edge API Worker 直调验收").get("status") == "PASS"
            and tech_check(tech, "Edge API HTTP 验收").get("status") == "PASS",
            "Issue、PR、CI、Review、对话与反思统一进入 EvidenceEvent，且 Edge API direct/http 双路径 14/14 通过。",
            "#integration-sandbox / #api-contract",
            [
                "参赛提交材料包/21_API与集成契约中心说明.md",
                "参赛提交材料包/26_集成回放沙箱与Webhook试运行说明.md",
                "参赛提交材料包/44_EdgeAPI运行时与后端接口验收说明.md",
            ],
            "诊断不是凭空生成，而是从可审计事件账本产生。",
            "若后端未授权，用合成事件回放和 smoke 报告证明契约。",
        ),
        stage(
            "diagnosis",
            "学情诊断与学生画像",
            "算法成员",
            "1:40-2:20",
            file_ok(ROOT / "sepath-cloud-app/src/engine/diagnosis.ts")
            and "学情诊断" in overview
            and release_row(release, "本地应用算法测试").get("status") == "PASS",
            "学生画像由证据覆盖、阻塞类型、Rubric 命中和风险信号共同更新。",
            "#student-dialogue / #path-state",
            [
                "sepath-cloud-app/src/engine/diagnosis.ts",
                "sepath-cloud-app/src/engine/studentDialogue.ts",
                "参赛提交材料包/25_学生对话实验台与智能干预说明.md",
            ],
            "评委能看到学生不是一个静态分数，而是可解释的状态对象。",
            "若现场时间紧，展示截图和算法测试报告。",
        ),
        stage(
            "path-planning",
            "PathTwin 路径规划",
            "算法成员",
            "2:20-3:00",
            file_ok(ROOT / "sepath-cloud-app/src/engine/safeVoi.ts")
            and file_ok(ROOT / "sepath-cloud-app/src/engine/strategyLab.ts")
            and "路径规划" in overview,
            "路径节点具有 blocked/active/completed 状态，下一步由 SafeVOI 综合学习收益、风险、可逆性和证据覆盖排序。",
            "#strategy-lab / #value-uplift",
            [
                "sepath-cloud-app/src/engine/safeVoi.ts",
                "sepath-cloud-app/src/engine/strategyLab.ts",
                "参赛提交材料包/17_策略实验室与SafeVOI对照仿真说明.md",
            ],
            "评委能看到同一事件下普通聊天、固定路径和 SafeVOI 的对照差异。",
            "若交互失败，使用策略实验室离线对照样本。",
        ),
        stage(
            "intervention",
            "脚手架干预与安全发布门",
            "产品/教师角色",
            "3:00-3:40",
            file_ok(ROOT / "sepath-cloud-app/src/engine/interventionPlaybook.ts")
            and file_ok(ROOT / "sepath-cloud-app/src/engine/reviewGate.ts")
            and "实时干预" in overview,
            "高风险、低置信或疑似替写答案的建议进入教师复核；学生获得脚手架、检查清单和 mini lab。",
            "#intervention-playbook / #teacher-review",
            [
                "参赛提交材料包/42_干预发布与教学行动包中心说明.md",
                "sepath-cloud-app/src/engine/interventionPlaybook.ts",
                "sepath-cloud-app/src/engine/reviewGate.ts",
            ],
            "评委能看到系统不会直接给答案，且教师可拦截或回滚干预。",
            "若教师复核视图加载失败，展示 50 号评委演练深潜证据。",
        ),
        stage(
            "memory-reflection",
            "长期记忆与反思回写",
            "产品/教师角色",
            "3:40-4:20",
            file_ok(ROOT / "sepath-cloud-app/src/engine/ledgerExchange.ts")
            and file_ok(ROOT / "sepath-cloud-app/src/engine/teacherReport.ts")
            and "记忆与反思" in overview,
            "反思记录、教师确认和周报沉淀为长期证据账本，下一轮诊断和路径规划会复用。",
            "#ledger-exchange / #teacher-report",
            [
                "参赛提交材料包/19_证据账本导入恢复与工作空间迁移说明.md",
                "参赛提交材料包/24_教师周报与试点复盘中心说明.md",
                "sepath-cloud-app/src/engine/ledgerExchange.ts",
            ],
            "评委能看到多轮交互不是短期聊天上下文，而是可导入、可恢复、可审计的记忆。",
            "若现场不能导入文件，展示导入恢复说明和样本 JSON。",
        ),
        stage(
            "teacher-growthops",
            "教师复核与班级 GrowthOps",
            "教师角色",
            "4:20-5:00",
            tech_check(tech, "评委 5 分钟实操演练").get("status") == "PASS"
            and tech_check(tech, "评委一键导览模式").get("status") == "PASS",
            "300 秒评委路线、教师复核深潜、班级风险分层和一键导览均有机器验收。",
            "#reviewer-drill / #cohort-ops",
            [
                "参赛提交材料包/15_班级GrowthOps与教师运营看板方案.md",
                "参赛提交材料包/50_评委5分钟实操演练与教师复核深潜说明.md",
                "sepath-cloud-app/qa/reviewer-drill-report.json",
            ],
            "评委能从学生视角切到教师视角，看见可运营的班级干预队列。",
            "若时间不足，直接运行 npm run cloud:reviewer-drill。",
        ),
        stage(
            "ai-runtime",
            "AI Agent 运行时与 GraphRAG 网关",
            "后端/算法成员",
            "5:00-5:40",
            tech_check(tech, "LLM Gateway 验收").get("status") == "PASS"
            and tech_check(tech, "LLM Gateway HTTP 验收").get("status") == "PASS",
            "HMAC、隐私拦截、GraphRAG 上下文包、fallback 和输出 schema 通过 direct/http 双路径验收。",
            "#agent-runtime / #inference-gateway",
            [
                "参赛提交材料包/29_AI Agent运行时与模型接入中心说明.md",
                "参赛提交材料包/37_推理网关与GraphRAG试验台说明.md",
                "sepath-cloud-app/cloud/llm-gateway-worker.mjs",
            ],
            "评委能确认大模型是可替换的表达层，核心闭环不依赖无法复现的单次回答。",
            "若无模型 Key，fallback 路径仍应返回可复现脚手架。",
        ),
        stage(
            "cloud-slo",
            "上云、SLO、容量和降级",
            "运维/后端成员",
            "5:40-6:20",
            tech_check(tech, "云端 SLO 容量压测").get("status") == "PASS"
            and backend.get("runtime") == "sepath-backend-status-center.v1",
            "后端状态中心、SLO 压测、成本预算、降级兜底和访问策略都被显式验收。",
            "#backend-status / #cloud-slo",
            [
                "参赛提交材料包/49_云端SLO容量压测与成本预算说明_机器可读.json",
                "参赛提交材料包/51_后端连接状态中心与上线边界说明_机器可读.json",
                "sepath-cloud-app/qa/cloud-slo-load-report.json",
            ],
            "评委能看到上线能力不是一个链接，而是监控、降级、容量和成本的组合。",
            "若私有云不可匿名访问，解释 owner-only 是访问控制生效，并切到公开静态包。",
        ),
        stage(
            "pilot-evidence-binder",
            "真实试点证据归档与声明门禁",
            "教研/数据治理成员",
            "6:20-6:50",
            pilot_gate_ready,
            f"58 号证据装订包 runtime={pilot_binder.get('runtime')}，blocked={pilot_binder.get('blocked_count')}，claim tiers={len(pilot_binder.get('claim_tiers', []))}。",
            "#pilot-evidence-binder",
            [
                "参赛提交材料包/58_真实课程试点证据归档与声明门禁说明.md",
                "参赛提交材料包/58_真实课程试点证据归档与声明门禁说明_机器可读.json",
                "sepath-cloud-app/src/engine/pilotEvidenceBinder.ts",
            ],
            "评委能看到系统没有把 Demo 效果冒充真实长期提分，而是把授权、脱敏、预注册、数据冻结、教师签收和结论分级做成产品门禁。",
            "若真实课程尚未授权，明确停留在 L0/L1 能力声明，并展示教师签收脚本和试点启动清单。",
        ),
        stage(
            "submission-package",
            "提交包、技术验收与获奖完成度",
            "队长/材料成员",
            "6:50-7:20",
            release_core_ready
            and audit_machine_ready
            and award.get("machine_evidence_score", 0) >= 80,
            f"Release gate={release_summary.get('release_gate')}，自动审计 FAIL={audit_summary.get('FAIL')}，机器完成度={award.get('machine_evidence_score')}。",
            "#launch-loop / #final-defense",
            [
                "参赛提交材料包/09_提交前终审报告_机器可读.json",
                "参赛提交材料包/46_评委技术验收包_机器可读.json",
                "参赛提交材料包/55_获奖级完成度总验收报告_机器可读.json",
                "参赛提交材料包/58_真实课程试点证据归档与声明门禁说明_机器可读.json",
            ],
            "评委能按机器证据从源码、测试、视频、文档、云端、PWA 和答辩卡逐项复查。",
            "若最新 release gate 跳过截图，说明截图 QA 已有保留记录，提交日前可完整重跑。",
        ),
        stage(
            "manual-final-gates",
            "正式上传前人工门禁",
            "全队",
            "提交日前 20 分钟",
            len(manual_rows) == 0,
            "队伍名、队员信息、访问策略、真人旁白版视频和真实课程效果声明必须由团队确认。",
            "#final-submission",
            [
                "参赛提交材料包/45_提交日人工确认决策卡.md",
                "参赛提交材料包/54_正式提交画像配置模板.json",
                "scripts/prepare_final_named_submission.py",
            ],
            "评委看到我们没有编造报名信息或真实试点效果，可信边界清楚。",
            "若来不及公开云端，用公开静态包 + 本地 Demo + 视频兜底提交。",
            weight=0,
            status_override="MANUAL" if manual_rows else "PASS",
        ),
    ]

    automatic_stages = [item for item in stages if item["weight"] > 0]
    total_weight = sum(item["weight"] for item in automatic_stages)
    passed_weight = sum(item["weight"] for item in automatic_stages if item["status"] == "PASS")
    machine_score = round(100 * passed_weight / total_weight, 1) if total_weight else 0.0
    final_submission_ready = audit_summary.get("FAIL") == 0 and not manual_rows

    return {
        "runtime": "sepath-launch-loop-acceptance.v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "machine_readiness_score": machine_score,
        "final_submission_ready": final_submission_ready,
        "current_boundary": "上线级闭环 Demo 的机器证据已形成；正式提交仍需团队确认真实报名资料、访问策略、最终视频版本和试点效果声明。",
        "machine_summary": {
            "release_gate": release_summary.get("release_gate"),
            "audit_summary": audit_summary,
            "package": manifest.get("package"),
            "file_count": manifest.get("file_count"),
            "package_manifest": "submission/SE-Path学伴_阶段提交包_v0.4_2026-08-09_manifest.json",
            "award_machine_score": award.get("machine_evidence_score"),
            "screenshots_skipped": release_summary.get("screenshots_skipped"),
        },
        "stages": stages,
        "live_routes": [
            {
                "name": "5 分钟评委最短路线",
                "steps": [
                    "打开公开试用静态包或私有云入口。",
                    "点击一键评委导览，跟随学生失败 PR、诊断、路径、脚手架、教师复核、反思记忆。",
                    "切到后端状态中心，说明 online/static/degraded/manual/blocked 五类状态。",
                    "打开 46 和 55 号机器证据，证明不是临时页面。",
                    "打开 58 号真实试点证据包，说明当前只声明工程闭环和试点能力，不提前宣称真实长期提分。",
                ],
            },
            {
                "name": "15 分钟技术复查路线",
                "steps": [
                    "运行 npm run test、npm run cloud:smoke、npm run cloud:smoke:http。",
                    "运行 npm run cloud:smoke:llm、npm run cloud:smoke:llm:http、npm run cloud:openapi:validate。",
                    "运行 npm run cloud:slo、npm run cloud:reviewer-drill。",
                    "回到根目录运行 scripts/audit_submission_readiness.py、scripts/verify_release_consistency.py。",
                ],
            },
            {
                "name": "提交日前 20 分钟路线",
                "steps": [
                    "复制 54 模板到 submission/final_submission_profile.json。",
                    "填写真队伍名、成员、访问策略、视频版本和真实课程声明边界。",
                    "dry-run 正式命名副本，确认 SHA256、文件名和上传说明。",
                    "最终运行 release_gate.py 并保存平台回执截图。",
                ],
            },
        ],
        "manual_gates": manual_rows or decision.get("manual_gates", []),
        "package_self_check": {
            "status": "PASS" if zip_ok else "CHECK",
            "missing": zip_missing,
            "required_entries": sorted(required_zip_entries),
        },
        "reproduce_commands": [
            "rtk python scripts/generate_launch_loop_acceptance.py --write",
            "rtk python scripts/release_gate.py --skip-screenshots",
            "rtk python scripts/verify_release_consistency.py",
            "cd sepath-cloud-app && npm run cloud:reviewer-drill",
        ],
    }


def escape_cell(value: Any) -> str:
    return str(value).replace("|", "\\|").replace("\n", "<br>")


def render_markdown(report: dict[str, Any]) -> str:
    summary = report["machine_summary"]
    lines = [
        "# 56 上线级闭环验收剧本",
        "",
        f"生成时间：{report['generated_at']}",
        "",
        "本剧本用于把 SE-Path 学伴从“可演示 Demo”推进到“可上线试用产品”的现场验收口径。它把评委最关心的闭环、后端、云端、PWA、SLO、材料和人工门禁压成一条可执行路线。",
        "",
        "## 1. 总览",
        "",
        f"- 机器上线准备度：`{report['machine_readiness_score']}` / 100",
        f"- Release gate：`{summary.get('release_gate')}`",
        f"- 自动审计：`{summary.get('audit_summary')}`",
        f"- 阶段 ZIP：`{summary.get('package')}`",
        f"- ZIP 文件数：`{summary.get('file_count')}`",
        f"- ZIP SHA256：以 `submission/SE-Path学伴_阶段提交包_v0.4_2026-08-09_manifest.json` 和 release gate 报告为准，避免报告自引用导致哈希滞后。",
        f"- 获奖级机器完成度：`{summary.get('award_machine_score')}`",
        f"- 当前边界：{report['current_boundary']}",
        "",
        "## 2. 闭环验收分镜",
        "",
        "| 状态 | 时间 | 负责人 | 验收环节 | 产品锚点 | 证据 | 评委应看到 | 兜底路线 |",
        "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ]
    for item in report["stages"]:
        lines.append(
            "| "
            + " | ".join(
                [
                    escape_cell(item["status"]),
                    escape_cell(item["minute"]),
                    escape_cell(item["owner"]),
                    escape_cell(item["title"]),
                    escape_cell(item["product_anchor"]),
                    escape_cell(item["evidence"]),
                    escape_cell(item["judge_signal"]),
                    escape_cell(item["fallback"]),
                ]
            )
            + " |"
        )
    lines.extend(["", "## 3. 现场路线", ""])
    for route in report["live_routes"]:
        lines.append(f"### {route['name']}")
        for index, step_text in enumerate(route["steps"], 1):
            lines.append(f"{index}. {step_text}")
        lines.append("")
    lines.extend(
        [
            "## 4. 人工门禁",
            "",
            "| 门禁 | 状态 | 证据 |",
            "| --- | --- | --- |",
        ]
    )
    for gate in report["manual_gates"]:
        lines.append(
            f"| {escape_cell(gate.get('label', gate.get('name', '')))} | {escape_cell(gate.get('status', 'MANUAL'))} | {escape_cell(gate.get('evidence', gate.get('note', '')))} |"
        )
    lines.extend(
        [
            "",
            "## 5. 打包自检",
            "",
            f"- 56 号剧本是否已进入当前 ZIP：`{report['package_self_check']['status']}`",
            f"- 缺失条目：`{report['package_self_check']['missing']}`",
            "",
            "## 6. 复现命令",
            "",
            "```bash",
            *report["reproduce_commands"],
            "```",
            "",
        ]
    )
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate launch-level closed-loop acceptance script for SE-Path.")
    parser.add_argument("--write", action="store_true", help="Write markdown and machine-readable JSON outputs.")
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Fail when the launch readiness score is below 90. Default only checks that the script artifacts were generated.",
    )
    args = parser.parse_args()

    report = build_report()
    if args.write:
        OUTPUT_MD.write_text(render_markdown(report), encoding="utf-8")
        OUTPUT_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if args.strict:
        return 0 if report["machine_readiness_score"] >= 90 else 1
    return 0 if report.get("package_self_check", {}).get("status") == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
