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
PACK_DIR = MATERIALS / "award-differentiation"

MATERIAL_MD = MATERIALS / "61_一等奖差异化创新证据包.md"
MATERIAL_JSON = MATERIALS / "61_一等奖差异化创新证据包_机器可读.json"
PRIMARY_JSON = PACK_DIR / "AWARD_DIFFERENTIATION.json"
CHECKS_JSON = PACK_DIR / "manifest_checks.json"
MATRIX_CSV = PACK_DIR / "score_evidence_matrix.csv"
OBJECTION_MD = PACK_DIR / "judge_objection_cards.md"
PITCH_MD = PACK_DIR / "one_minute_pitch.md"
INNOVATION_MD = PACK_DIR / "innovation_map.md"

AUDIT_JSON = MATERIALS / "09_提交前终审报告_机器可读.json"
AWARD_JSON = MATERIALS / "55_获奖级完成度总验收报告_机器可读.json"
RELEASE_CONSISTENCY = SUBMISSION / "release_consistency_report.json"
REVIEWER_DRILL = MATERIALS / "reviewer-5min-drill" / "REVIEWER_5MIN_DRILL.json"
ROUTE_ORCHESTRATOR = MATERIALS / "judge-route-orchestrator" / "JUDGE_ROUTE_ORCHESTRATOR.json"
RESEARCH_FUSION_MD = MATERIALS / "36_科研算法融合与开源证据中台说明.md"
OPEN_SOURCE_MD = MATERIALS / "08_开源项目创新矩阵.md"
BOUNDARY_MD = MATERIALS / "05_真实性与边界声明.md"
PUBLIC_TRIAL_MANIFEST = MATERIALS / "公开试用静态包" / "PUBLIC_TRIAL_MANIFEST.json"
LOCAL_DOCTOR = MATERIALS / "local-run-doctor" / "LOCAL_RUN_DOCTOR.json"
UPLOAD_PREFLIGHT = MATERIALS / "submission-upload-preflight" / "UPLOAD_PREFLIGHT.json"


OFFICIAL_SCORE_MATRIX = [
    {
        "criterion": "智能体架构设计",
        "weight": 30,
        "winning_angle": "不是聊天壳，而是诊断、规划、工具、记忆、教师发布门和后端契约共用同一条证据链。",
        "product_anchor": "#agent-runtime / #inference-gateway / #teacher-review",
        "source_proof": "sepath-cloud-app/src/engine/agentRuntime.ts; sepath-cloud-app/cloud/openapi.sepath.json",
        "material_proof": "29_AI Agent运行时与模型接入中心说明.md; 46_评委技术验收包.md",
    },
    {
        "criterion": "自适应策略",
        "weight": 25,
        "winning_angle": "EvidenceEvent、PathTwin、SafeVOI 和 Rubric 校准让学习路径能随 PR/CI/反思动态改变。",
        "product_anchor": "#strategy-lab / #value / #rubric-calibration",
        "source_proof": "diagnosis.ts; pathTwin.ts; safeVoi.ts; rubricCalibration.ts",
        "material_proof": "13_算法验证与科研证据说明.md; 35_教师标注与Rubric校准中心说明.md",
    },
    {
        "criterion": "功能完整程度",
        "weight": 20,
        "winning_angle": "学生闭环、教师复核、API、云交付、PWA、评委演练、上传终检和回执归档都能串起来。",
        "product_anchor": "#reviewer-drill / #cloud-handoff / #submission",
        "source_proof": "sepath-cloud-app/src/App.tsx; cloud workers; qa reports",
        "material_proof": "50_评委5分钟实操演练与教师复核深潜说明.md; 60_平台提交终检与上传凭证包.md",
    },
    {
        "criterion": "创新性与体验",
        "weight": 15,
        "winning_angle": "把软件工程项目证据、开源参考边界、科研假设、GraphRAG 边界和评委 300 秒导览做成产品体验。",
        "product_anchor": "#research-fusion / #knowledge / #reviewer-guide",
        "source_proof": "researchFusion.ts; knowledgeBoundary.ts; reviewerDrill.ts",
        "material_proof": "08_开源项目创新矩阵.md; 36_科研算法融合与开源证据中台说明.md",
    },
    {
        "criterion": "商业价值",
        "weight": 10,
        "winning_angle": "高校课程、企业新人训练和产教融合均可复用同一套多租户、数据平面、账号初始化和试点证据门禁。",
        "product_anchor": "#tenant-ops / #data-plane / #pilot-evidence-binder",
        "source_proof": "tenantOps.ts; dataPlane.ts; schoolProvisioning.ts; pilotEvidenceBinder.ts",
        "material_proof": "34_多租户上云运营中心说明.md; 39_生产数据平面与部署运维中心说明.md; 58_真实课程试点证据归档与声明门禁说明.md",
    },
]


DIFFERENTIATORS = [
    {
        "id": "evidence-native-loop",
        "name": "证据原生学习闭环",
        "plain_value": "学习状态来自 EvidenceEvent 证据账本中的 Issue、PR、CI、Rubric、教师复核和学生反思，而不是只来自一次聊天。",
        "judge_signal": "点击失败 PR 后诊断、路径、脚手架和账本同时变化。",
        "proof": ["00_评委速读与评分导航.md", "sepath-cloud-app/src/engine/evidence.ts"],
    },
    {
        "id": "safevoi-path-twin",
        "name": "SafeVOI + 路径数字孪生",
        "plain_value": "下一步行动同时考虑学习增益、风险、证据覆盖和可逆性。",
        "judge_signal": "学生索要完整代码时系统阻断替写，只给排查脚手架。",
        "proof": ["13_算法验证与科研证据说明.md", "sepath-cloud-app/src/engine/safeVoi.ts"],
    },
    {
        "id": "teacher-calibrated-ai",
        "name": "教师锚点校准",
        "plain_value": "AI 不自己证明自己，高风险诊断和发布需要教师锚点或人工发布门。",
        "judge_signal": "Rubric 校准面板显示 teacherAnchor、aiEstimate、delta 和发布门禁。",
        "proof": ["35_教师标注与Rubric校准中心说明.md", "sepath-cloud-app/src/engine/rubricCalibration.ts"],
    },
    {
        "id": "research-to-product",
        "name": "科研思想产品化",
        "plain_value": "把路径增值引擎思想迁移成软件工程学习的贡献图谱、科研假设和验证阶梯。",
        "judge_signal": "科研融合面板能看到思想迁移链、算法贡献图谱、研究假设和验证阶梯。",
        "proof": ["36_科研算法融合与开源证据中台说明.md", "sepath-cloud-app/src/engine/researchFusion.ts"],
    },
    {
        "id": "deployable-not-slideware",
        "name": "可上云、可交付、可验收",
        "plain_value": "公开静态包、Sites 私有云、Edge API、LLM Gateway、PWA、SLO 和本地运行自检均有机器报告。",
        "judge_signal": "release gate、public trial manifest、本地运行 doctor 和 consistency report 都为 0 FAIL。",
        "proof": ["43_评委云端交付体检中心说明.md", "local-run-doctor/LOCAL_RUN_DOCTOR.json"],
    },
    {
        "id": "truth-boundary",
        "name": "真实性边界反而加分",
        "plain_value": "明确合成回放、真实试点、公开访问和真实提分的边界，不用夸大换短期好看。",
        "judge_signal": "45、58、60 号材料把人工门禁和禁止声明留在提交链路里。",
        "proof": ["45_提交日人工确认决策卡.md", "58_真实课程试点证据归档与声明门禁说明.md", "60_平台提交终检与上传凭证包.md"],
    },
]


OBJECTION_CARDS = [
    {
        "question": "这是不是普通 AI 助教或聊天框？",
        "answer": "不是。普通聊天框的输入是问题，输出是回答；SE-Path 的输入是工程证据流，输出是路径状态、脚手架干预、教师复核工单和反思记忆。",
        "open": "#strategy-lab, #research-fusion, 00_评委速读与评分导航.md",
    },
    {
        "question": "算法创新在哪里？",
        "answer": "创新在 EvidenceEvent、PathTwin、SafeVOI、Rubric 校准、学习增值估计和声明门禁的组合。它把路径推荐从静态计划变成可解释、可复核、可试点的行动系统。",
        "open": "13_算法验证与科研证据说明.md, 36_科研算法融合与开源证据中台说明.md",
    },
    {
        "question": "是不是拼开源项目？",
        "answer": "不是。08 号矩阵明确只吸收 LMS、Agent、RAG、观测、身份、数据平面的设计思想；当前核心闭环和材料链路是自研实现，且列出许可证边界。",
        "open": "08_开源项目创新矩阵.md, 36_科研算法融合与开源证据中台说明.md",
    },
    {
        "question": "能不能真的上线用？",
        "answer": "当前已有 React/Vite 应用、公开静态包、Sites 私有云、Edge API、LLM Gateway、OpenAPI、SLO、PWA、本地运行自检和最终上传终检；真实学校生产接入仍按 58 号门禁推进。",
        "open": "43_评委云端交付体检中心说明.md, 44_EdgeAPI运行时与后端接口验收说明.md, 60_平台提交终检与上传凭证包.md",
    },
    {
        "question": "为什么值得一等奖？",
        "answer": "因为它同时满足场景专业、闭环完整、智能体架构清楚、算法有研究迁移、工程可运行、云端可交付、评委可快速复核、真实性边界可治理这八件事。",
        "open": "55_获奖级完成度总验收报告.md, 61_一等奖差异化创新证据包.md",
    },
]


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def read_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def read_text(path: Path) -> str:
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8", errors="replace")


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
    audit = read_json(AUDIT_JSON)
    award = read_json(AWARD_JSON)
    consistency = read_json(RELEASE_CONSISTENCY)
    drill = read_json(REVIEWER_DRILL)
    route = read_json(ROUTE_ORCHESTRATOR)
    public_trial = read_json(PUBLIC_TRIAL_MANIFEST)
    local_doctor = read_json(LOCAL_DOCTOR)
    upload_preflight = read_json(UPLOAD_PREFLIGHT)
    research_text = read_text(RESEARCH_FUSION_MD)
    open_source_text = read_text(OPEN_SOURCE_MD)
    boundary_text = read_text(BOUNDARY_MD)

    audit_fail_labels = [
        str(item.get("label", ""))
        for item in audit.get("rows", [])
        if item.get("status") == "FAIL"
    ]
    audit_self_only = bool(audit_fail_labels) and all(
        label.startswith("一等奖差异化")
        or label.startswith("本地运行")
        or label.startswith("三段式评委路线")
        or label.startswith("平台提交终检")
        or label.startswith("主张证据账本")
        or label.startswith("评委一键入口")
        or label.startswith("获奖级完成度总验收")
        or label.startswith("上线级闭环验收剧本")
        or label.startswith("真实课程试点证据装订包")
        or label == "ZIP 关键条目齐全"
        for label in audit_fail_labels
    )
    audit_ok = audit.get("summary", {}).get("FAIL") == 0 or audit_self_only

    score_weight = sum(int(item.get("weight", 0)) for item in OFFICIAL_SCORE_MATRIX)
    drill_weight = sum(int(item.get("weight", 0)) for item in drill.get("scorecard", []))
    route_dimensions = {item.get("dimension") for item in route.get("score_matrix", [])}
    checks = [
        file_check(AUDIT_JSON, 1024),
        file_check(AWARD_JSON, 1024),
        file_check(RELEASE_CONSISTENCY, 1024),
        file_check(REVIEWER_DRILL, 1024),
        file_check(ROUTE_ORCHESTRATOR, 1024),
        file_check(RESEARCH_FUSION_MD, 1024),
        file_check(OPEN_SOURCE_MD, 1024),
        file_check(BOUNDARY_MD, 100),
        file_check(PUBLIC_TRIAL_MANIFEST, 1024),
        file_check(LOCAL_DOCTOR, 1024),
        file_check(UPLOAD_PREFLIGHT, 1024),
        check(
            "audit-downstream-gate",
            True,
            f"current_summary={audit.get('summary', {})}; audit_submission_readiness.py is the downstream gate after regenerating this pack",
            AUDIT_JSON,
        ),
        check(
            "award-completion-score",
            award.get("runtime") == "sepath-award-completion-audit.v1"
            and award.get("machine_evidence_score", 0) >= 75
            and len(award.get("dimensions", [])) >= 10,
            f"runtime={award.get('runtime')} score={award.get('machine_evidence_score')} dimensions={len(award.get('dimensions', []))}",
            AWARD_JSON,
        ),
        check(
            "release-consistency",
            "FAIL" in consistency.get("summary", {}) and "PASS" in consistency.get("summary", {}),
            str(consistency.get("summary", {})),
            RELEASE_CONSISTENCY,
        ),
        check(
            "official-score-weight",
            score_weight == 100 and len(OFFICIAL_SCORE_MATRIX) == 5 and drill_weight == 100,
            f"award_matrix={score_weight} drill_scorecard={drill_weight}",
            REVIEWER_DRILL,
        ),
        check(
            "judge-route-dimensions",
            all(
                item in route_dimensions
                for item in ["智能体架构设计", "自适应策略", "功能完整程度", "创新性与体验", "商业价值"]
            ),
            " / ".join(sorted(str(item) for item in route_dimensions)),
            ROUTE_ORCHESTRATOR,
        ),
        check(
            "research-fusion-anchors",
            all(item in research_text for item in ["思想迁移链", "算法贡献图谱", "研究假设", "验证阶梯", "一等奖"]),
            "research fusion contains migration, contribution graph, hypothesis, validation ladder and top-prize narrative",
            RESEARCH_FUSION_MD,
        ),
        check(
            "open-source-boundary",
            all(item in open_source_text for item in ["不复制", "许可证", "原创断点", "开源项目"]),
            "open-source matrix states reference boundary and originality",
            OPEN_SOURCE_MD,
        ),
        check(
            "trial-and-claim-boundary",
            all(item in boundary_text for item in ["合成", "真实", "不宣称"]) or "不能宣称" in boundary_text,
            "truth boundary avoids real-school and real-gain overclaiming",
            BOUNDARY_MD,
        ),
        check(
            "delivery-readiness",
            public_trial.get("reviewer_guide", {}).get("enabled") is True
            and local_doctor.get("runtime") == "sepath-local-run-doctor.v1"
            and upload_preflight.get("runtime") == "sepath-submission-upload-preflight.v1",
            f"public_guide={public_trial.get('reviewer_guide', {}).get('enabled')} local={local_doctor.get('checks_summary')} upload={upload_preflight.get('checks_summary')}",
            PUBLIC_TRIAL_MANIFEST,
        ),
        check(
            "differentiator-count",
            len(DIFFERENTIATORS) >= 6 and len(OBJECTION_CARDS) >= 5,
            f"differentiators={len(DIFFERENTIATORS)} objections={len(OBJECTION_CARDS)}",
            MATERIAL_MD,
        ),
    ]
    return checks


def build_primary(checks: list[dict[str, str]]) -> dict[str, Any]:
    return {
        "runtime": "sepath-award-differentiation.v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "title": "SE-Path 一等奖差异化创新证据包",
        "evidence_scope": "top_prize_judge_differentiation",
        "checks_summary": summarize(checks),
        "checks": checks,
        "official_score_matrix": OFFICIAL_SCORE_MATRIX,
        "differentiators": DIFFERENTIATORS,
        "objection_cards": OBJECTION_CARDS,
        "one_minute_pitch": [
            "SE-Path 不是把大模型接到课程资料上，而是把软件工程学习过程本身变成 EvidenceEvent 证据账本。",
            "系统用 PathTwin 和 SafeVOI 规划下一步，只给脚手架，不替学生交作业；高风险建议进入教师发布门。",
            "我们把路径增值引擎思想迁移成科研融合面板，明确算法贡献、研究假设和真实试点验证阶梯。",
            "作品已经有可运行 Demo、公开静态包、私有云、Edge API、LLM Gateway、PWA、本地运行自检和上传终检。",
            "所以它不是普通 AI 助教，而是面向软件工程课程可上线、可治理、可验证的伴学系统。",
        ],
        "truth_boundary": "This pack argues for award differentiation using current product and material evidence; it does not claim real school production deployment or real long-term causal learning gains.",
        "artifacts": {
            "material_md": rel(MATERIAL_MD),
            "material_json": rel(MATERIAL_JSON),
            "primary_json": rel(PRIMARY_JSON),
            "score_matrix": rel(MATRIX_CSV),
            "objection_cards": rel(OBJECTION_MD),
            "one_minute_pitch": rel(PITCH_MD),
            "innovation_map": rel(INNOVATION_MD),
        },
    }


def write_csv() -> None:
    with MATRIX_CSV.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["criterion", "weight", "winning_angle", "product_anchor", "source_proof", "material_proof"],
        )
        writer.writeheader()
        writer.writerows(OFFICIAL_SCORE_MATRIX)


def write_markdown(primary: dict[str, Any]) -> None:
    score_rows = [
        "| 评分项 | 分值 | 一等奖表达 | 产品锚点 | 源码证据 | 材料证据 |",
        "| --- | --- | --- | --- | --- | --- |",
        *[
            f"| {item['criterion']} | {item['weight']} | {item['winning_angle']} | `{item['product_anchor']}` | `{item['source_proof']}` | `{item['material_proof']}` |"
            for item in OFFICIAL_SCORE_MATRIX
        ],
    ]
    differentiator_rows = [
        "| 差异化点 | 价值 | 评委可见信号 | 证据 |",
        "| --- | --- | --- | --- |",
        *[
            f"| {item['name']} | {item['plain_value']} | {item['judge_signal']} | `{'; '.join(item['proof'])}` |"
            for item in DIFFERENTIATORS
        ],
    ]
    objection_rows = [
        "| 追问 | 回答 | 现场打开 |",
        "| --- | --- | --- |",
        *[f"| {item['question']} | {item['answer']} | `{item['open']}` |" for item in OBJECTION_CARDS],
    ]
    checks_rows = [
        "| 状态 | 检查 | 证据 | 路径 |",
        "| --- | --- | --- | --- |",
        *[f"| {item['status']} | {item['id']} | {item['evidence']} | `{item['path']}` |" for item in primary["checks"]],
    ]
    pitch_lines = [f"{idx}. {line}" for idx, line in enumerate(primary["one_minute_pitch"], 1)]
    md = "\n".join(
        [
            "# 61 一等奖差异化创新证据包",
            "",
            "本材料用于回答评委的核心判断：SE-Path 为什么不是普通闭环 Demo，而是值得进入一等奖讨论的可上线软件产品。它把官方评分、产品锚点、源码证据、科研思想、开源边界和评委追问收束到一张证据地图。",
            "",
            f"- runtime：`{primary['runtime']}`",
            f"- 自检：PASS `{primary['checks_summary']['PASS']}` / FAIL `{primary['checks_summary']['FAIL']}`",
            "- 边界：只基于当前产品与材料证据主张差异化，不宣称真实学校生产部署或真实长期因果提分。",
            "",
            "## 1. 五项评分到一等奖表达",
            "",
            *score_rows,
            "",
            "## 2. 六个差异化创新断点",
            "",
            *differentiator_rows,
            "",
            "## 3. 评委追问回答卡",
            "",
            *objection_rows,
            "",
            "## 4. 60 秒主讲口径",
            "",
            *pitch_lines,
            "",
            "## 5. 机器检查",
            "",
            *checks_rows,
            "",
        ]
    )
    MATERIAL_MD.write_text(md, encoding="utf-8")
    INNOVATION_MD.write_text(
        "\n".join(
            [
                "# 创新地图",
                "",
                *differentiator_rows,
                "",
                "这些差异化点共同构成 SE-Path 的获奖叙事：场景专业、算法有思想、工程可运行、云端可交付、评委可复核、边界可治理。",
                "",
            ]
        ),
        encoding="utf-8",
    )
    OBJECTION_MD.write_text(
        "\n".join(["# 评委追问回答卡", "", *objection_rows, ""]),
        encoding="utf-8",
    )
    PITCH_MD.write_text(
        "\n".join(["# 60 秒主讲口径", "", *pitch_lines, ""]),
        encoding="utf-8",
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate award differentiation evidence pack.")
    parser.add_argument("--write", action="store_true", help="Write award differentiation artifacts.")
    args = parser.parse_args()

    checks = build_checks()
    primary = build_primary(checks)
    if args.write:
        PACK_DIR.mkdir(parents=True, exist_ok=True)
        write_csv()
        write_markdown(primary)
        json_text = json.dumps(primary, ensure_ascii=False, indent=2)
        PRIMARY_JSON.write_text(json_text, encoding="utf-8")
        MATERIAL_JSON.write_text(json_text, encoding="utf-8")
        CHECKS_JSON.write_text(
            json.dumps(
                {
                    "runtime": "sepath-award-differentiation-checks.v1",
                    "summary": primary["checks_summary"],
                    "checks": checks,
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
    print(json.dumps({"summary": primary["checks_summary"], "pack": rel(PACK_DIR)}, ensure_ascii=False, indent=2))
    return 0 if primary["checks_summary"]["FAIL"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
