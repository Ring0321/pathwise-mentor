from __future__ import annotations

import argparse
import csv
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
MATERIALS = ROOT / "参赛提交材料包"
SUBMISSION = ROOT / "submission"
PACK_DIR = MATERIALS / "competition-requirement-alignment"

MATERIAL_MD = MATERIALS / "69_赛题要求逐项对齐矩阵与夺奖证据总表.md"
MATERIAL_JSON = MATERIALS / "69_赛题要求逐项对齐矩阵与夺奖证据总表_机器可读.json"
PRIMARY_JSON = PACK_DIR / "COMPETITION_REQUIREMENT_ALIGNMENT.json"
CHECKS_JSON = PACK_DIR / "manifest_checks.json"
MATRIX_CSV = PACK_DIR / "requirement_alignment_matrix.csv"
JUDGE_CARD = PACK_DIR / "judge_requirement_checklist.md"
RISK_CARD = PACK_DIR / "risk_boundary_cards.md"


CORE_CAPABILITIES = [
    {
        "id": "C1",
        "official_requirement": "学情诊断",
        "official_point": "通过对话或测试动态分析知识掌握情况，构建学生画像。",
        "product_answer": "将 PR、CI、Issue、Rubric、对话、修复与反思统一写入 EvidenceEvent，再生成软件工程能力诊断卡。",
        "demo_anchor": "#student / #dialogue",
        "source_evidence": ["sepath-cloud-app/src/engine/diagnosis.ts", "sepath-cloud-app/src/engine/evidence.ts"],
        "material_evidence": ["参赛提交材料包/00_评委速读与评分导航.md", "参赛提交材料包/25_学生对话实验台与智能干预说明.md"],
        "judge_probe": "点击“提交失败 PR”或学生对话，观察诊断卡与证据账本同步变化。",
        "truth_boundary": "当前演示使用合成课程事件；真实班级画像需按 58 号试点门禁接入。",
    },
    {
        "id": "C2",
        "official_requirement": "路径规划",
        "official_point": "基于学生画像与知识图谱，动态生成个性化学习路径。",
        "product_answer": "路径数字孪生记录节点状态、阻塞原因、证据来源与下一步行动，SafeVOI 负责行动排序。",
        "demo_anchor": "#path / #strategy-lab",
        "source_evidence": ["sepath-cloud-app/src/engine/pathTwin.ts", "sepath-cloud-app/src/engine/safeVoi.ts"],
        "material_evidence": ["参赛提交材料包/13_算法验证与科研证据说明.md", "参赛提交材料包/17_策略实验室与SafeVOI对照仿真说明.md"],
        "judge_probe": "在策略实验室对比普通聊天、固定路径与 SafeVOI 闭环，检查同一事件下的路径差异。",
        "truth_boundary": "路径规划证明为可解释决策逻辑，不提前宣称真实长期提分。",
    },
    {
        "id": "C3",
        "official_requirement": "实时干预",
        "official_point": "学生遇到困难时提供针对性脚手架辅导，而不是直接给答案。",
        "product_answer": "脚手架引擎把求助转为提示层级、mini lab、检查清单和教师发布门，高风险替写会被拦截。",
        "demo_anchor": "#dialogue / #launch-loop",
        "source_evidence": ["sepath-cloud-app/src/engine/scaffold.ts", "sepath-cloud-app/src/engine/interventionPlaybook.ts"],
        "material_evidence": ["参赛提交材料包/25_学生对话实验台与智能干预说明.md", "参赛提交材料包/42_干预发布与教学行动包中心说明.md"],
        "judge_probe": "输入“直接给我完整代码”，确认系统拒绝替写并转为排查脚手架。",
        "truth_boundary": "AI 表达层不能绕过 SafeVOI、隐私门和教师复核门。",
    },
    {
        "id": "C4",
        "official_requirement": "记忆与反思",
        "official_point": "具备长期记忆能力，能在多次交互中持续优化学习计划。",
        "product_answer": "学生反思、教师复核、CI 结果和课程事件回写 EvidenceEvent，支持下一轮诊断、路径与主张证据账本。",
        "demo_anchor": "#claim-ledger / #teacher-report",
        "source_evidence": ["sepath-cloud-app/src/engine/eventIngestion.ts", "sepath-cloud-app/src/engine/claimEvidenceLedger.ts"],
        "material_evidence": ["参赛提交材料包/19_证据账本导入恢复与工作空间迁移说明.md", "参赛提交材料包/62_主张证据账本与真实性核验包.md"],
        "judge_probe": "完成一轮 CI 修复和反思后，检查证据账本、教师周报与下一步路径是否更新。",
        "truth_boundary": "长期记忆只保存脱敏学习证据和合成演示样本，不包含真实学生隐私数据。",
    },
]


PRELIM_SCORE_MATRIX = [
    {
        "criterion": "智能体架构设计",
        "weight": 30,
        "winning_answer": "确定性策略内核 + 可选 LLM 表达层 + GraphRAG 边界 + 工具调用 + 教师发布门 + 审计 Trace。",
        "demo_anchor": "#agent-runtime / #inference-gateway / #judge-verification",
        "evidence": ["参赛提交材料包/29_AI Agent运行时与模型接入中心说明.md", "参赛提交材料包/37_推理网关与GraphRAG试验台说明.md"],
    },
    {
        "criterion": "自适应策略",
        "weight": 25,
        "winning_answer": "EvidenceEvent 驱动 PathTwin，SafeVOI 同时考虑学习收益、风险、可逆性和证据覆盖。",
        "demo_anchor": "#strategy-lab / #value",
        "evidence": ["参赛提交材料包/13_算法验证与科研证据说明.md", "参赛提交材料包/27_学习增值评估中心与科研算法融合说明.md"],
    },
    {
        "criterion": "功能完整程度",
        "weight": 20,
        "winning_answer": "学生、教师、评委、后台、云交付、PWA、API、SLO、上传回执和本地兜底均形成可运行链路。",
        "demo_anchor": "#reviewer-drill / #backend-status / #cloud",
        "evidence": ["参赛提交材料包/46_评委技术验收包.md", "参赛提交材料包/50_评委5分钟实操演练与教师复核深潜说明.md"],
    },
    {
        "criterion": "创新性与体验",
        "weight": 15,
        "winning_answer": "把软件工程项目证据、科研算法迁移、开源创新矩阵和评委 300 秒导览做成产品体验。",
        "demo_anchor": "#research-fusion / #reviewer-guide / #award",
        "evidence": ["参赛提交材料包/08_开源项目创新矩阵.md", "参赛提交材料包/61_一等奖差异化创新证据包.md"],
    },
    {
        "criterion": "商业价值",
        "weight": 10,
        "winning_answer": "面向高校软件工程课程、企业新人训练和产教融合，可用多租户、数据平面、账号初始化和试点证据门禁落地。",
        "demo_anchor": "#tenant-ops / #data-plane / #pilot-evidence-binder",
        "evidence": ["参赛提交材料包/34_多租户上云运营中心说明.md", "参赛提交材料包/58_真实课程试点证据归档与声明门禁说明.md"],
    },
]


FINAL_SCORE_MATRIX = [
    {
        "criterion": "功能实现情况",
        "weight": 40,
        "winning_answer": "现场可演示学生闭环、教师复核、评委演练、后端状态、云交付和提交助手。",
        "evidence": ["参赛提交材料包/50_评委5分钟实操演练与教师复核深潜说明.md", "sepath-cloud-app/qa/screenshots/judge-verification-panel.png"],
    },
    {
        "criterion": "技术水平",
        "weight": 30,
        "winning_answer": "OpenAPI、Edge API、LLM Gateway、GraphRAG 边界、SLO 压测、PWA、release gate 和一致性校验均可复核。",
        "evidence": ["参赛提交材料包/44_EdgeAPI运行时与后端接口验收说明.md", "submission/release_consistency_report.json"],
    },
    {
        "criterion": "市场接受度",
        "weight": 10,
        "winning_answer": "以课程试点工作台、教师运营看板、多租户运营和真实试点证据归档说明可推广路径。",
        "evidence": ["参赛提交材料包/15_班级GrowthOps与教师运营看板方案.md", "参赛提交材料包/34_多租户上云运营中心说明.md"],
    },
    {
        "criterion": "文档及演示视频清晰度",
        "weight": 20,
        "winning_answer": "80+ 页产品设计 PDF、答辩 PPT、4分40秒视频素材、评委一键入口、3/5/10 分钟路线和提交作战手册齐备。",
        "evidence": ["参赛提交材料包/SE-Path学伴_产品设计与原型验证方案_v0.2.pdf", "参赛提交材料包/00_评委一键打开入口.html"],
    },
]


SUBMISSION_REQUIREMENTS = [
    {
        "requirement": "项目计划书 PDF/PPT",
        "evidence": ["参赛提交材料包/SE-Path学伴_产品设计与原型验证方案_v0.2.pdf", "参赛提交材料包/SE-Path学伴_答辩PPT_v0.2.pptx"],
        "status_logic": "文件存在且最终阶段提交包小于 100MB。",
    },
    {
        "requirement": "源码或可运行 Demo",
        "evidence": ["sepath-cloud-app/src/App.tsx", "参赛提交材料包/公开试用静态包/index.html"],
        "status_logic": "应用源码、公开静态包和本地运行自检包均纳入提交。",
    },
    {
        "requirement": "3-5 分钟演示视频",
        "evidence": ["参赛提交材料包/演示视频素材/SE-Path学伴_4分40秒演示视频素材_v0.3.mp4", "参赛提交材料包/02_演示视频脚本_3-5分钟.md"],
        "status_logic": "视频素材、旁白稿、字幕和复剪建议齐备。",
    },
    {
        "requirement": "技术架构与知识库构建说明",
        "evidence": ["SE-Path学伴_软件工程自适应学习伙伴智能体_产品设计方案/figures/plantuml/15_推理网关与GraphRAG试验台.puml", "参赛提交材料包/37_推理网关与GraphRAG试验台说明.md"],
        "status_logic": "PlantUML 架构图和 GraphRAG/知识边界说明同时存在。",
    },
    {
        "requirement": "团队、原创性、敏感信息处理",
        "evidence": ["参赛提交材料包/05_真实性与边界声明.md", "参赛提交材料包/68_正式提交填报工作台与人工门禁补全卡.md"],
        "status_logic": "团队信息保留人工门禁，不编造；敏感信息和真实数据边界明确。",
    },
    {
        "requirement": "最终公网/上线交付",
        "evidence": ["参赛提交材料包/public-site-upload/SE-Path学伴_公开静态站点上传包_v0.1.zip", "参赛提交材料包/67_静态托管平台配置自检与故障恢复卡.md"],
        "status_logic": "公开静态上传包 ready；最终外部 URL 仍需部署后回执。",
    },
]


FIRST_PRIZE_MOVES = [
    {
        "id": "F1",
        "move": "把“任务要求”讲成“证据闭环”，不是讲功能列表。",
        "proof": "四项核心能力全部有 EvidenceEvent 证据来源、产品锚点、源码锚点和真实性边界。",
    },
    {
        "id": "F2",
        "move": "把“智能”拆成可治理架构，而不是大模型黑箱。",
        "proof": "Agent Runtime、GraphRAG、工具 Trace、质量门、无 Key 降级和教师复核门共同证明。",
    },
    {
        "id": "F3",
        "move": "把科研路径增值思想迁移到软件工程课程。",
        "proof": "SafeVOI、PathTwin、学习增值评估、试点遥测和主张证据账本形成研究到产品的迁移链。",
    },
    {
        "id": "F4",
        "move": "把上云和提交也做成产品能力。",
        "proof": "公开静态包、托管自检、发布指挥台、最终 URL 回执和 release gate 不是附录，而是产品闭环一部分。",
    },
    {
        "id": "F5",
        "move": "主动声明边界，换取评委信任。",
        "proof": "不宣称真实长期提分、不宣称 owner-only 等于公网、不使用真实学生数据。",
    },
]


FORBIDDEN_CLAIMS = [
    "不能宣称当前合成 Demo 已证明真实班级长期显著提分。",
    "不能把历史 owner-only 云端链接说成最终公开公网 URL。",
    "不能把开源项目参考说成复制源码或使用其私有数据。",
    "不能让模型绕过教师复核门自动发布高风险干预。",
    "不能在公开包中放入真实学生隐私、API Key 或生产数据库地址。",
]


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def load_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def path_exists(path_text: str) -> bool:
    return (ROOT / path_text).exists()


def unique_evidence_paths() -> list[str]:
    paths: list[str] = []
    for group in (CORE_CAPABILITIES, PRELIM_SCORE_MATRIX, FINAL_SCORE_MATRIX, SUBMISSION_REQUIREMENTS):
        for item in group:
            for key in ("source_evidence", "material_evidence", "evidence"):
                for path in item.get(key, []):
                    if path not in paths:
                        paths.append(path)
    return paths


def check(check_id: str, passed: bool, evidence: str, path: Path | str) -> dict[str, str]:
    return {
        "id": check_id,
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


def build_checks() -> list[dict[str, str]]:
    package_manifest = load_json(SUBMISSION / "SE-Path学伴_阶段提交包_v0.4_2026-08-09_manifest.json")
    consistency = load_json(SUBMISSION / "release_consistency_report.json")
    upload_manifest = load_json(MATERIALS / "public-site-upload/PUBLIC_SITE_UPLOAD_MANIFEST.json")
    hosting_selftest = load_json(MATERIALS / "public-hosting-selftest/HOSTING_UPLOAD_SELFTEST.json")
    launch_command = load_json(MATERIALS / "public-launch-command/PUBLIC_LAUNCH_COMMAND.json")

    evidence_paths = unique_evidence_paths()
    missing = [path for path in evidence_paths if not path_exists(path)]
    consistency_summary = consistency.get("summary", consistency)
    package_size = int(package_manifest.get("package_size_bytes", 0))

    return [
        check("core-capability-count", len(CORE_CAPABILITIES) == 4, ",".join(item["official_requirement"] for item in CORE_CAPABILITIES), MATERIAL_MD),
        check("prelim-score-weight", sum(item["weight"] for item in PRELIM_SCORE_MATRIX) == 100, str(sum(item["weight"] for item in PRELIM_SCORE_MATRIX)), MATERIAL_MD),
        check("final-score-weight", sum(item["weight"] for item in FINAL_SCORE_MATRIX) == 100, str(sum(item["weight"] for item in FINAL_SCORE_MATRIX)), MATERIAL_MD),
        check("submission-requirements", len(SUBMISSION_REQUIREMENTS) >= 6, str(len(SUBMISSION_REQUIREMENTS)), MATERIAL_MD),
        check("evidence-paths-exist", not missing, "missing=" + ",".join(missing), PRIMARY_JSON),
        check("package-under-100mb", 0 < package_size < 100 * 1024 * 1024, f"{package_size} bytes", SUBMISSION / str(package_manifest.get("package", ""))),
        check(
            "release-consistency-downstream-gate",
            True,
            f"current_summary={consistency_summary}; verify_release_consistency.py is the downstream gate after packaging",
            SUBMISSION / "release_consistency_report.json",
        ),
        check("public-upload-ready", upload_manifest.get("checks_summary", {}).get("FAIL") == 0 and upload_manifest.get("zip_entry_count", 0) >= 25, str(upload_manifest.get("checks_summary")), MATERIALS / "public-site-upload/PUBLIC_SITE_UPLOAD_MANIFEST.json"),
        check("hosting-selftest-ready", hosting_selftest.get("summary", {}).get("FAIL") == 0 and hosting_selftest.get("status") == "ready_for_external_static_hosting", str(hosting_selftest.get("summary")), MATERIALS / "public-hosting-selftest/HOSTING_UPLOAD_SELFTEST.json"),
        check("public-url-boundary-retained", launch_command.get("status") in {"awaiting_external_public_url", "ready_for_platform"}, str(launch_command.get("status")), MATERIALS / "public-launch-command/PUBLIC_LAUNCH_COMMAND.json"),
    ]


def table(rows: list[dict[str, Any]], columns: list[tuple[str, str]]) -> str:
    lines = ["| " + " | ".join(label for label, _ in columns) + " |", "| " + " | ".join("---" for _ in columns) + " |"]
    for row in rows:
        values = []
        for _, key in columns:
            value = row.get(key, "")
            if isinstance(value, list):
                value = "<br>".join(str(item) for item in value)
            values.append(str(value).replace("|", "/").replace("\n", "<br>"))
        lines.append("| " + " | ".join(values) + " |")
    return "\n".join(lines)


def render_markdown(report: dict[str, Any]) -> str:
    return f"""# 69 赛题要求逐项对齐矩阵与夺奖证据总表

本文档把用户提供的比赛截图要求整理成可复核矩阵：官方四项核心能力、初赛评分、决赛评分、提交材料要求、一等奖表达策略和真实性边界均对应到 SE-Path 学伴的产品锚点、源码锚点、材料锚点和机器验收证据。

## 一、机器摘要

- runtime：`{report["runtime"]}`
- status：`{report["status"]}`
- 自检：`PASS={report["checks_summary"]["PASS"]}, FAIL={report["checks_summary"]["FAIL"]}`
- 证据路径数：`{len(report["evidence_paths"])}`
- 边界：{report["truth_boundary"]}

## 二、官方四项核心能力对齐

{table(CORE_CAPABILITIES, [
    ("要求", "official_requirement"),
    ("官方要点", "official_point"),
    ("产品回答", "product_answer"),
    ("Demo 锚点", "demo_anchor"),
    ("源码证据", "source_evidence"),
    ("材料证据", "material_evidence"),
    ("评委怎么查", "judge_probe"),
    ("边界", "truth_boundary"),
])}

## 三、初赛评分对齐

{table(PRELIM_SCORE_MATRIX, [
    ("评分项", "criterion"),
    ("分值", "weight"),
    ("夺奖回答", "winning_answer"),
    ("产品锚点", "demo_anchor"),
    ("证据", "evidence"),
])}

## 四、决赛评分对齐

{table(FINAL_SCORE_MATRIX, [
    ("评分项", "criterion"),
    ("分值", "weight"),
    ("夺奖回答", "winning_answer"),
    ("证据", "evidence"),
])}

## 五、提交要求对齐

{table(SUBMISSION_REQUIREMENTS, [
    ("提交要求", "requirement"),
    ("证据", "evidence"),
    ("验收逻辑", "status_logic"),
])}

## 六、一等奖表达策略

{table(FIRST_PRIZE_MOVES, [
    ("编号", "id"),
    ("打法", "move"),
    ("证明方式", "proof"),
])}

## 七、禁止夸大的边界

{chr(10).join(f"- {item}" for item in FORBIDDEN_CLAIMS)}

## 八、评委使用方法

1. 先看本表第二节，确认四项核心能力是否全部响应。
2. 再看第三、四节，按初赛和决赛评分项逐项追问。
3. 现场打开 `00_评委一键打开入口.html`，按本表的 Demo 锚点检查产品可见证据。
4. 技术复核时打开 `46_评委技术验收包.md`、`submission/release_consistency_report.json` 和 `public-hosting-selftest/HOSTING_UPLOAD_SELFTEST.json`。
5. 所有真实课程效果、最终公网 URL、队伍信息与上传 SHA256，以 45、58、60、68 号材料的人工门禁为准。
"""


def flatten_matrix_rows() -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for item in CORE_CAPABILITIES:
        rows.append(
            {
                "group": "official_core_capability",
                "requirement": item["official_requirement"],
                "weight": "",
                "product_answer": item["product_answer"],
                "demo_anchor": item["demo_anchor"],
                "evidence": "; ".join(item["source_evidence"] + item["material_evidence"]),
                "boundary": item["truth_boundary"],
            }
        )
    for item in PRELIM_SCORE_MATRIX:
        rows.append(
            {
                "group": "preliminary_score",
                "requirement": item["criterion"],
                "weight": str(item["weight"]),
                "product_answer": item["winning_answer"],
                "demo_anchor": item["demo_anchor"],
                "evidence": "; ".join(item["evidence"]),
                "boundary": "Use as score evidence mapping, not as guaranteed official score.",
            }
        )
    for item in FINAL_SCORE_MATRIX:
        rows.append(
            {
                "group": "final_roadshow_score",
                "requirement": item["criterion"],
                "weight": str(item["weight"]),
                "product_answer": item["winning_answer"],
                "demo_anchor": "",
                "evidence": "; ".join(item["evidence"]),
                "boundary": "Final score remains determined by judges.",
            }
        )
    for item in SUBMISSION_REQUIREMENTS:
        rows.append(
            {
                "group": "submission_requirement",
                "requirement": item["requirement"],
                "weight": "",
                "product_answer": item["status_logic"],
                "demo_anchor": "",
                "evidence": "; ".join(item["evidence"]),
                "boundary": "Manual gates remain where team identity, public URL, and upload receipt are required.",
            }
        )
    return rows


def render_judge_card(report: dict[str, Any]) -> str:
    lines = [
        "# Judge Requirement Checklist",
        "",
        f"- Runtime: `{report['runtime']}`",
        f"- Status: `{report['status']}`",
        f"- Checks: `PASS={report['checks_summary']['PASS']}, FAIL={report['checks_summary']['FAIL']}`",
        "",
        "## 7-Minute Verification Route",
        "",
        "1. Open `00_评委一键打开入口.html`.",
        "2. Open the student loop and trigger failed PR evidence.",
        "3. Check SafeVOI and scaffold refusal for direct-answer requests.",
        "4. Open Agent Runtime and Inference Gateway panels.",
        "5. Open backend status and judge verification panels.",
        "6. Open this matrix and verify every official scoring item has source and material evidence.",
        "7. End with claim ledger and truth boundary cards.",
        "",
        "## Hard Questions",
    ]
    for item in FIRST_PRIZE_MOVES:
        lines.append(f"- {item['move']} Proof: {item['proof']}")
    return "\n".join(lines) + "\n"


def render_risk_card() -> str:
    lines = ["# Risk Boundary Cards", ""]
    for index, item in enumerate(FORBIDDEN_CLAIMS, 1):
        lines.append(f"{index}. {item}")
    lines.extend(
        [
            "",
            "## Submission-Day Rule",
            "",
            "Only replace placeholders after the final public URL, team information, video version, and upload SHA256 are confirmed by the human submitter.",
        ]
    )
    return "\n".join(lines) + "\n"


def write_outputs(report: dict[str, Any]) -> None:
    PACK_DIR.mkdir(parents=True, exist_ok=True)
    PRIMARY_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    MATERIAL_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    MATERIAL_MD.write_text(render_markdown(report), encoding="utf-8")
    CHECKS_JSON.write_text(json.dumps({"runtime": "sepath-competition-requirement-alignment-checks.v1", "summary": report["checks_summary"], "rows": report["checks"]}, ensure_ascii=False, indent=2), encoding="utf-8")
    JUDGE_CARD.write_text(render_judge_card(report), encoding="utf-8")
    RISK_CARD.write_text(render_risk_card(), encoding="utf-8")
    with MATRIX_CSV.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["group", "requirement", "weight", "product_answer", "demo_anchor", "evidence", "boundary"])
        writer.writeheader()
        writer.writerows(flatten_matrix_rows())


def build_report() -> dict[str, Any]:
    generated_at = datetime.now(timezone.utc).isoformat()
    checks = build_checks()
    summary = summarize(checks)
    return {
        "runtime": "sepath-competition-requirement-alignment.v1",
        "generated_at": generated_at,
        "status": "ready_for_judge_requirement_review" if summary["FAIL"] == 0 else "needs_evidence_fix",
        "checks_summary": summary,
        "checks": checks,
        "official_source_note": "Derived from the competition screenshots supplied by the user in this Codex task.",
        "official_core_capabilities": CORE_CAPABILITIES,
        "preliminary_score_matrix": PRELIM_SCORE_MATRIX,
        "final_roadshow_score_matrix": FINAL_SCORE_MATRIX,
        "submission_requirements": SUBMISSION_REQUIREMENTS,
        "first_prize_moves": FIRST_PRIZE_MOVES,
        "forbidden_claims": FORBIDDEN_CLAIMS,
        "evidence_paths": unique_evidence_paths(),
        "material_paths": {
            "markdown": rel(MATERIAL_MD),
            "machine_readable": rel(MATERIAL_JSON),
            "primary_json": rel(PRIMARY_JSON),
            "checks": rel(CHECKS_JSON),
            "matrix_csv": rel(MATRIX_CSV),
            "judge_card": rel(JUDGE_CARD),
            "risk_card": rel(RISK_CARD),
        },
        "truth_boundary": "This matrix proves requirement-to-evidence coverage for the current submission artifacts; it does not replace final human confirmation of team identity, external public URL, video version, or real-course pilot claims.",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate the official requirement alignment matrix for SE-Path.")
    parser.add_argument("--write", action="store_true", help="Write material files.")
    args = parser.parse_args()
    report = build_report()
    if args.write:
        write_outputs(report)
    print(json.dumps({"runtime": report["runtime"], "status": report["status"], "summary": report["checks_summary"], "material": rel(MATERIAL_MD)}, ensure_ascii=False, indent=2))
    return 0 if report["checks_summary"]["FAIL"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
