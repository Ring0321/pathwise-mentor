from __future__ import annotations

import argparse
import csv
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
MATERIALS = ROOT / "参赛提交材料包"
PACK_DIR = MATERIALS / "reviewer-5min-drill"
PRIMARY_JSON = PACK_DIR / "REVIEWER_5MIN_DRILL.json"
CHECKS_JSON = PACK_DIR / "manifest_checks.json"
TRACE_JSON = PACK_DIR / "drill_trace.json"
SCORECARD_CSV = PACK_DIR / "drill_scorecard.csv"
README_MD = PACK_DIR / "README.md"
QUICK_START_MD = PACK_DIR / "quick_start.md"
FALLBACK_MD = PACK_DIR / "fallback_cards.md"
TEACHER_MD = PACK_DIR / "teacher_review_deep_dive.md"
BOUNDARY_MD = PACK_DIR / "boundary_and_claims.md"

MATERIAL_MD = MATERIALS / "50_评委5分钟实操演练与教师复核深潜说明.md"
MATERIAL_JSON = MATERIALS / "50_评委5分钟实操演练与教师复核深潜说明_机器可读.json"
REVIEWER_REPORT = ROOT / "sepath-cloud-app" / "qa" / "reviewer-drill-report.json"
SEED_MANIFEST = ROOT / "sepath-cloud-app" / "qa" / "demo-seed" / "JUDGE_DEMO_SEED_MANIFEST.json"
PUBLIC_TRIAL_MANIFEST = MATERIALS / "公开试用静态包" / "PUBLIC_TRIAL_MANIFEST.json"
PUBLIC_REVIEWER_REPORT = MATERIALS / "公开试用静态包" / "REVIEWER_DRILL_REPORT.json"


REQUIRED_ANCHORS = [
    "#student",
    "#teacher-report",
    "#value",
    "#cloud-slo",
    "#public-url-receipt",
    "#submission-closure",
    "#backend-status",
    "#judge-verification",
    "#claim-ledger",
    "#launch-loop",
]

ROUTE = [
    {
        "id": "open-trial",
        "minute": "00:00-00:35",
        "seconds": 35,
        "label": "打开可试用入口",
        "action": "打开公开静态包或本地 Demo，确认页面、PWA 离线说明、评委种子包和一键导览入口均可见。",
        "expected_signal": "顶部导航、学生闭环按钮、公开试用 Manifest 和评委路线可见。",
        "product_anchor": "#student",
        "material_anchor": "START_DEMO.md",
        "evidence": ["PUBLIC_TRIAL_MANIFEST.json", "JUDGE_DEMO_SEED_MANIFEST.json"],
        "judge_focus": "作品不是只能讲解，评委能直接进入可试用入口。",
    },
    {
        "id": "run-loop",
        "minute": "00:35-01:15",
        "seconds": 40,
        "label": "跑完学生闭环",
        "action": "连续点击主按钮，触发失败 PR、直接答案请求、脚手架干预、CI 通过、教师复核和反思记忆。",
        "expected_signal": "EvidenceEvent 数量增长，路径节点从 blocked 走向 completed。",
        "product_anchor": "#student",
        "material_anchor": "00_评委速读与评分导航.md",
        "evidence": ["ci_failed", "scaffold_recommended", "ci_passed", "teacher_reviewed", "reflection_submitted"],
        "judge_focus": "学情诊断、实时干预和记忆反思形成闭环。",
    },
    {
        "id": "inspect-teacher-gate",
        "minute": "01:15-01:50",
        "seconds": 35,
        "label": "查看教师复核发布门",
        "action": "切到教师周报、干预发布和教师复核台，检查高风险建议是否需要教师批准、退回或补证据。",
        "expected_signal": "教师行动计划、AI 使用边界、复核工单和不替写护栏同时出现。",
        "product_anchor": "#teacher-report",
        "material_anchor": "24_教师周报与试点复盘中心说明.md",
        "evidence": ["TeacherReport", "InterventionPlaybook", "ReviewTicket"],
        "judge_focus": "智能体不是替学生交作业，而是把高风险建议送入人工发布门。",
    },
    {
        "id": "inspect-algorithm",
        "minute": "01:50-02:30",
        "seconds": 40,
        "label": "核对算法创新",
        "action": "查看策略实验、增值评估、科研融合和知识边界，确认不是普通聊天框。",
        "expected_signal": "PathTwin、SafeVOI、Rubric 校准、GraphRAG 边界和增值估计有独立证据。",
        "product_anchor": "#value",
        "material_anchor": "27_学习增值评估中心与科研算法融合说明.md",
        "evidence": ["strategyLab", "valueUplift", "researchFusion", "knowledgeBoundary"],
        "judge_focus": "自适应路径由证据、策略和教师锚点共同驱动。",
    },
    {
        "id": "inspect-cloud",
        "minute": "02:30-02:55",
        "seconds": 25,
        "label": "检查上云与 SLO",
        "action": "查看云交付、SLO 容量压测、数据平面和 API 契约，确认它具备上线骨架。",
        "expected_signal": "P95、错误率、PWA 兜底、Edge API、OpenAPI、隐私门禁和真实边界可见。",
        "product_anchor": "#cloud-slo",
        "material_anchor": "49_云端SLO容量压测与成本预算说明.md",
        "evidence": ["cloud-slo-load-report.json", "edge-api-smoke-report.json"],
        "judge_focus": "不仅是前端样机，也能解释上云、降级和成本护栏。",
    },
    {
        "id": "inspect-public-url-receipt",
        "minute": "02:55-03:15",
        "seconds": 20,
        "label": "核对公网 URL 回执",
        "action": "切到公网 URL 回执验收台，确认候选 HTTPS 地址、health/release 探针、平台粘贴块、回执 JSON 和复跑门禁命令已经串联。",
        "expected_signal": "评委能看到公网 URL 仍需机器回执，不会把 owner-only、localhost 或历史 Sites 链接误写成公开地址。",
        "product_anchor": "#public-url-receipt",
        "material_anchor": "70_公网部署实操包与回执封存说明.md",
        "evidence": ["sepath-public-url-receipt-console.v1", "final_public_url_receipt.json"],
        "judge_focus": "把公网发布从人工口头说明变成产品内可交互、可回执、可复跑的上线闭环。",
    },
    {
        "id": "inspect-submission-closure",
        "minute": "03:15-03:35",
        "seconds": 20,
        "label": "检查正式提交收口",
        "action": "切到正式提交收口总控，确认公网回执、平台文案、团队画像、命名副本、release gate 和一致性验证被排成可执行闭环。",
        "expected_signal": "剩余人工门、下一步命令、平台粘贴块和 71 号材料入口均可见。",
        "product_anchor": "#submission-closure",
        "material_anchor": "71_公网URL回填后的正式提交收口说明.md",
        "evidence": ["sepath-submission-closure-console.v1", "finalize_submission_after_public_url.py"],
        "judge_focus": "把产品 Demo、公开 URL 和比赛平台最终上传收成一条可执行路线。",
    },
    {
        "id": "inspect-backend-status",
        "minute": "03:35-03:55",
        "seconds": 20,
        "label": "核对后端连接状态",
        "action": "查看后端连接状态中心，区分静态试用、Edge API、LLM Gateway、数据库授权、种子数据、遥测和降级模式。",
        "expected_signal": "online/static/degraded/manual/blocked 五类状态，以及每条链路的证据、命令和失败切换均可见。",
        "product_anchor": "#backend-status",
        "material_anchor": "51_后端连接状态中心与上线边界说明.md",
        "evidence": ["sepath-backend-status-center.v1"],
        "judge_focus": "把可用、降级、待授权和不可宣称的边界说清楚。",
    },
    {
        "id": "inspect-verification",
        "minute": "03:55-04:25",
        "seconds": 30,
        "label": "打开技术验收包",
        "action": "切到技术验收面板，确认评委要看的命令、报告、源码热点和安全边界被串成一张证据表。",
        "expected_signal": "release gate、终审、OpenAPI、LLM Gateway、SLO、PWA、种子包全部有路径。",
        "product_anchor": "#judge-verification",
        "material_anchor": "46_评委技术验收包.md",
        "evidence": ["sepath-judge-verification.v1"],
        "judge_focus": "评委可以按机器报告复查工程可信度。",
    },
    {
        "id": "inspect-claim-ledger",
        "minute": "04:25-04:40",
        "seconds": 15,
        "label": "核验主张证据账本",
        "action": "打开主张账本，逐条核对参赛亮点、声明等级、证据路径、禁止表述和产品锚点是否一致。",
        "expected_signal": "每条主张都有 L0-L3 等级、材料证据、源码证据、禁用口径和真实性边界。",
        "product_anchor": "#claim-ledger",
        "material_anchor": "62_主张证据账本与真实性核验包.md",
        "evidence": ["sepath-claim-evidence-ledger.v1", "forbidden_claim_crosscheck"],
        "judge_focus": "把参赛主张、可声明范围和禁用口径变成可点开的产品证据账本。",
    },
    {
        "id": "answer-boundary",
        "minute": "04:40-05:00",
        "seconds": 20,
        "label": "收口真实性边界",
        "action": "打开提交日人工确认卡和上线级闭环验收中心，说明哪些已机器验证，哪些必须等正式报名或真实试点。",
        "expected_signal": "队伍信息、公开访问、真人旁白和真实提分声明仍被保留为人工项。",
        "product_anchor": "#launch-loop",
        "material_anchor": "45_提交日人工确认决策卡.md + 56_上线级闭环验收剧本.md",
        "evidence": ["自动审计 0 FAIL", "5 MANUAL"],
        "judge_focus": "真实课程效果不提前夸大，产品用证据门禁自我约束。",
    },
]


PERSONAS = [
    {
        "id": "competition-reviewer",
        "role": "competition_reviewer",
        "entry": "公开试用静态包/index.html 或本地 npm run dev",
        "success_signal": "无需真实学校账号即可看完学生闭环、教师复核、云交付和技术验收。",
    },
    {
        "id": "student-shadow",
        "role": "student_shadow",
        "entry": "#student / #dialogue / #knowledge",
        "success_signal": "直接索要完整答案会被转为脚手架、检查清单和反思任务。",
    },
    {
        "id": "teacher-reviewer",
        "role": "teacher",
        "entry": "#teacher-report / #intervention-playbook",
        "success_signal": "高风险建议进入人工发布门，教师可批准、退回或转为 mini lab。",
    },
    {
        "id": "course-admin",
        "role": "course_admin",
        "entry": "#course-launch / #school-provisioning",
        "success_signal": "开班、Rubric、演示账号、SSO/LTI 和试点边界可以被初始化和复核。",
    },
    {
        "id": "ops-auditor",
        "role": "ops_auditor",
        "entry": "#cloud-slo / #backend-status / #judge-verification",
        "success_signal": "release gate、OpenAPI、SLO、PWA、ZIP 和 smoke report 有机器证据。",
    },
]


SCORECARD = [
    {
        "criterion": "智能体架构设计",
        "weight": 30,
        "judge_question": "是否合理使用 Agent 的规划、记忆、工具和人工发布门？",
        "drill_steps": ["run-loop", "inspect-teacher-gate", "inspect-verification"],
        "product_proof": "AI 运行时、知识边界、教师复核、API 契约和技术验收在同一演练路线中串联。",
        "material_proof": "29_AI Agent运行时与模型接入中心说明.md; 46_评委技术验收包.md",
    },
    {
        "criterion": "自适应策略",
        "weight": 25,
        "judge_question": "学习路径是否根据画像、证据和反馈动态调整？",
        "drill_steps": ["run-loop", "inspect-algorithm"],
        "product_proof": "失败 PR 后触发诊断、SafeVOI 排序、脚手架、教师复核和反思记忆。",
        "material_proof": "13_算法验证与科研证据说明.md; 27_学习增值评估中心与科研算法融合说明.md",
    },
    {
        "criterion": "功能完整程度",
        "weight": 20,
        "judge_question": "是否覆盖诊断、规划、干预、复核、记忆和上云交付？",
        "drill_steps": ["open-trial", "run-loop", "inspect-cloud", "inspect-submission-closure", "inspect-backend-status"],
        "product_proof": "5 分钟演练把学生闭环、教师复核、云交付、SLO、正式提交收口和发布门禁一次跑完。",
        "material_proof": "START_DEMO.md; 50_评委5分钟实操演练与教师复核深潜说明.md",
    },
    {
        "criterion": "创新性与体验",
        "weight": 15,
        "judge_question": "评委是否能快速看出它不是普通答疑助手？",
        "drill_steps": ["inspect-algorithm", "inspect-claim-ledger", "answer-boundary"],
        "product_proof": "演练明确展示证据原生、路径数字孪生、增值估计、人工发布门、主张账本和真实性边界。",
        "material_proof": "00_评委速读与评分导航.md; 36_科研算法融合与开源证据中台说明.md",
    },
    {
        "criterion": "商业价值",
        "weight": 10,
        "judge_question": "是否具备真实课程、学校私有云和可运营试点路径？",
        "drill_steps": ["inspect-cloud", "inspect-backend-status", "inspect-claim-ledger", "answer-boundary"],
        "product_proof": "开班向导、账号初始化、数据平面、PWA、SLO、多租户运营和主张分级均有证据入口。",
        "material_proof": "34_多租户上云运营中心说明.md; 39_生产数据平面与部署运维中心说明.md",
    },
]


FALLBACK_CARDS = [
    {
        "trigger": "现场网络不稳定或云端私有链接打不开",
        "switch_to": "公开静态包、PWA 离线页或 4分40秒视频",
        "proof": "PUBLIC_TRIAL_MANIFEST.json; public-trial-pwa-validation.json",
    },
    {
        "trigger": "本地依赖安装慢或开发服务器启动失败",
        "switch_to": "技术验收包、截图 manifest、视频和最终 release gate JSON",
        "proof": "46_评委技术验收包.md; outputs/SE-Path学伴_最终发布门禁报告_机器生成.json",
    },
    {
        "trigger": "评委追问真实课程提分或长期因果效果",
        "switch_to": "真实性边界、试点遥测协议和声明分级",
        "proof": "05_真实性与边界声明.md; 33_试点遥测与效果验证中心说明.md; 58_真实课程试点证据归档与声明门禁说明.md; 62_主张证据账本与真实性核验包.md",
    },
    {
        "trigger": "评委要求教师视角深潜",
        "switch_to": "教师周报、干预发布、Rubric 校准和复核工单",
        "proof": "24_教师周报与试点复盘中心说明.md; 35_教师标注与Rubric校准中心说明.md; 42_干预发布与教学行动包中心说明.md",
    },
]


FORBIDDEN_CLAIMS = [
    "已经在真实学校完成长期提分验证",
    "提交包包含真实评委账号密码",
    "owner-only 私有云链接等同公开访问地址",
    "合成样本是真实学生数据",
    "模型建议可以绕过教师复核直接发布高风险教学行动",
]


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


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


def check(check_id: str, passed: bool, evidence: str, path: Path | None = None) -> dict[str, str]:
    return {
        "id": check_id,
        "status": "PASS" if passed else "FAIL",
        "evidence": evidence,
        "path": rel(path) if path else "",
    }


def summarize(checks: list[dict[str, str]]) -> dict[str, int]:
    return {
        "PASS": sum(1 for item in checks if item["status"] == "PASS"),
        "FAIL": sum(1 for item in checks if item["status"] == "FAIL"),
        "rows": len(checks),
    }


def artifact_rows() -> list[dict[str, str | int]]:
    rows: list[dict[str, str | int]] = []
    for path in sorted(PACK_DIR.glob("*"), key=lambda item: item.name):
        if path.is_file():
            rows.append(
                {
                    "path": rel(path),
                    "bytes": path.stat().st_size,
                    "sha256": sha256_file(path),
                }
            )
    return rows


def build_checks(material: dict[str, Any], report: dict[str, Any], seed: dict[str, Any], public_manifest: dict[str, Any]) -> list[dict[str, str]]:
    route_seconds = sum(int(step["seconds"]) for step in ROUTE)
    route_ids = [step["id"] for step in ROUTE]
    route_anchors = sorted({step["product_anchor"] for step in ROUTE})
    material_steps = material.get("steps", [])
    material_anchors = material.get("anchors", [])
    report_summary = report.get("summary", {})
    report_guide = report.get("guidedTour", {})
    public_guide = public_manifest.get("reviewer_guide", {})
    checks = [
        check("material-json-runtime", material.get("runtime") == "sepath-reviewer-drill.v1", str(material.get("runtime")), MATERIAL_JSON),
        check("source-report-runtime", report.get("runtime") == "sepath-reviewer-drill.v1", str(report.get("runtime")), REVIEWER_REPORT),
        check("duration-300", route_seconds == 300 and material.get("durationSeconds") == 300, f"route={route_seconds} material={material.get('durationSeconds')}", MATERIAL_JSON),
        check("route-step-parity", route_ids == material_steps, " / ".join(route_ids), MATERIAL_JSON),
        check(
            "anchor-coverage",
            all(anchor in material_anchors for anchor in REQUIRED_ANCHORS) and all(anchor in route_anchors for anchor in REQUIRED_ANCHORS),
            " / ".join(REQUIRED_ANCHORS),
            MATERIAL_JSON,
        ),
        check(
            "source-report-pass",
            report_summary.get("FAIL") == 0 and report_summary.get("durationSeconds") == 300,
            f"PASS={report_summary.get('PASS')} FAIL={report_summary.get('FAIL')} duration={report_summary.get('durationSeconds')}",
            REVIEWER_REPORT,
        ),
        check(
            "guided-tour-runtime",
            report_guide.get("runtime") == "sepath-reviewer-guide.v1"
            and report_guide.get("totalSteps") == 11
            and "#submission-closure" in report_guide.get("autoScrollAnchors", []),
            f"runtime={report_guide.get('runtime')} steps={report_guide.get('totalSteps')}",
            REVIEWER_REPORT,
        ),
        check(
            "seed-personas",
            seed.get("runtime") == "sepath-judge-demo-seed.v1" and len(seed.get("accounts", [])) >= 5,
            f"runtime={seed.get('runtime')} accounts={len(seed.get('accounts', []))}",
            SEED_MANIFEST,
        ),
        check(
            "public-trial-guide",
            public_guide.get("runtime") == "sepath-reviewer-guide.v1"
            and public_guide.get("enabled") is True
            and public_guide.get("report") == "REVIEWER_DRILL_REPORT.json",
            json.dumps(public_guide, ensure_ascii=False)[:220],
            PUBLIC_TRIAL_MANIFEST,
        ),
        check(
            "truth-boundary",
            "synthetic" in str(material.get("truthBoundary", "")) and "real course" in str(material.get("truthBoundary", "")),
            str(material.get("truthBoundary", "")),
            MATERIAL_JSON,
        ),
        check("material-md-present", MATERIAL_MD.exists() and MATERIAL_MD.stat().st_size > 800, f"{MATERIAL_MD.stat().st_size if MATERIAL_MD.exists() else 0} bytes", MATERIAL_MD),
        check(
            "public-reviewer-report-copy",
            PUBLIC_REVIEWER_REPORT.exists() and PUBLIC_REVIEWER_REPORT.stat().st_size > 500,
            f"{PUBLIC_REVIEWER_REPORT.stat().st_size if PUBLIC_REVIEWER_REPORT.exists() else 0} bytes",
            PUBLIC_REVIEWER_REPORT,
        ),
    ]
    return checks


def write_json(path: Path, data: dict[str, Any]) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def sync_material_json(material: dict[str, Any]) -> dict[str, Any]:
    synced = dict(material)
    route_ids = [step["id"] for step in ROUTE]
    route_anchors = []
    for step in ROUTE:
        anchor = step["product_anchor"]
        if anchor not in route_anchors:
            route_anchors.append(anchor)
    synced.update(
        {
            "runtime": "sepath-reviewer-drill.v1",
            "durationSeconds": sum(int(step["seconds"]) for step in ROUTE),
            "steps": route_ids,
            "anchors": route_anchors,
            "publicUrlReceiptAnchor": "#public-url-receipt",
            "submissionClosureAnchor": "#submission-closure",
            "route_sync_note": "Reviewer route includes the product-side public URL receipt console and final submission closure console before platform upload.",
        }
    )
    return synced


def write_scorecard() -> None:
    with SCORECARD_CSV.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["criterion", "weight", "judge_question", "drill_steps", "product_proof", "material_proof"],
        )
        writer.writeheader()
        for row in SCORECARD:
            writer.writerow({**row, "drill_steps": "; ".join(row["drill_steps"])})


def write_markdown_files(primary: dict[str, Any]) -> None:
    check_summary = primary["checks_summary"]
    README_MD.write_text(
        "\n".join(
            [
                "# SE-Path 评委 5 分钟独立演练包",
                "",
                "本目录把产品内 `sepath-reviewer-drill.v1` 演练中心封装成可离线复核的提交附件。",
                "评委无需阅读全部源码，也能用本包核对 300 秒路线、评分映射、教师复核深潜、异常兜底和真实性边界。",
                "",
                "## 核心文件",
                "",
                "- `REVIEWER_5MIN_DRILL.json`：机器可读总清单、路线、评分映射和校验结果。",
                "- `quick_start.md`：按分钟执行的现场操作卡。",
                "- `drill_trace.json`：9 步路线和可复核事件轨迹。",
                "- `drill_scorecard.csv`：官方评分项到产品证据的映射。",
                "- `teacher_review_deep_dive.md`：教师复核发布门深潜。",
                "- `fallback_cards.md`：网络、依赖、真实效果追问等异常兜底。",
                "- `boundary_and_claims.md`：禁止表述和可声明范围。",
                "",
                "## 当前校验",
                "",
                f"- PASS：{check_summary['PASS']}",
                f"- FAIL：{check_summary['FAIL']}",
                "- 证据范围：synthetic_reviewer_walkthrough，不宣称真实课程因果提分。",
                "",
            ]
        ),
        encoding="utf-8",
    )
    QUICK_START_MD.write_text(
        "\n".join(
            [
                "# 5 分钟现场快速开始",
                "",
                "入口优先级：公开试用静态包 -> 本地 `npm run dev` -> 演示视频与截图证据。",
                "",
                "| 时间 | 操作 | 成功信号 | 锚点 |",
                "| --- | --- | --- | --- |",
                *[
                    f"| {step['minute']} | {step['action']} | {step['expected_signal']} | `{step['product_anchor']}` |"
                    for step in ROUTE
                ],
                "",
                "终端自检命令：",
                "",
                "```powershell",
                "rtk npm run cloud:reviewer-drill",
                "rtk python scripts/generate_reviewer_5min_drill_pack.py --write",
                "```",
                "",
            ]
        ),
        encoding="utf-8",
    )
    FALLBACK_MD.write_text(
        "\n".join(
            [
                "# 评委现场异常兜底卡",
                "",
                "| 触发情况 | 切换路线 | 证据 |",
                "| --- | --- | --- |",
                *[f"| {card['trigger']} | {card['switch_to']} | {card['proof']} |" for card in FALLBACK_CARDS],
                "",
            ]
        ),
        encoding="utf-8",
    )
    TEACHER_MD.write_text(
        "\n".join(
            [
                "# 教师复核深潜",
                "",
                "教师复核不是给产品贴一个人工确认标签，而是 SE-Path 的教学安全阀。",
                "",
                "## 触发条件",
                "",
                "- 证据覆盖不足或诊断置信度低。",
                "- 学生直接索要完整答案或可能产生代写风险。",
                "- AI 建议将影响 Rubric、课程节奏或班级级行动。",
                "- 需要把个体问题转为课堂 mini lab。",
                "",
                "## 教师动作",
                "",
                "- 批准：低风险脚手架或已满足证据门的行动进入学生侧。",
                "- 退回：证据不足或提示过度时要求系统补证据。",
                "- 转课堂：高频错误改为班级 mini lab 或讲解。",
                "- 回写：教师决策写回 EvidenceEvent，进入下一轮路径规划。",
                "",
                "## 评委检查",
                "",
                "在 `#teacher-report`、`#intervention-playbook`、`#rubric-calibration` 三个锚点查看教师是否能理解、修改、阻断和追踪 AI 建议。",
                "",
            ]
        ),
        encoding="utf-8",
    )
    BOUNDARY_MD.write_text(
        "\n".join(
            [
                "# 真实性边界与禁止声明",
                "",
                "本演练包的证据范围是 `synthetic_reviewer_walkthrough`。它证明产品闭环、工程门禁和评委路线可复核，不证明真实学校长期提分。",
                "",
                "## 禁止表述",
                "",
                *[f"- {claim}" for claim in FORBIDDEN_CLAIMS],
                "",
                "## 可声明范围",
                "",
                "- 可声明：已完成可运行 Demo、公开静态包、本地演练、机器审计、SLO 合成压测和教师复核设计。",
                "- 可声明：合成回放覆盖失败 PR、脚手架干预、教师复核、反思记忆和上线边界。",
                "- 可声明：主张证据账本已经把参赛亮点、证据路径、源码热点和禁止表述同步到产品内 `#claim-ledger`。",
                "- 不可声明：真实学生数据、真实学校生产访问、长期因果提分或无教师门禁的高风险自动发布。",
                "",
            ]
        ),
        encoding="utf-8",
    )


def build_primary(material: dict[str, Any], report: dict[str, Any], seed: dict[str, Any], public_manifest: dict[str, Any], checks: list[dict[str, str]]) -> dict[str, Any]:
    return {
        "runtime": "sepath-reviewer-5min-drill.v1",
        "source_runtime": "sepath-reviewer-drill.v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "material_id": "50",
        "title": "SE-Path 学伴评委 5 分钟独立演练包",
        "evidence_scope": "synthetic_reviewer_walkthrough",
        "duration_seconds": sum(int(step["seconds"]) for step in ROUTE),
        "entrypoints": [
            "参赛提交材料包/公开试用静态包/index.html",
            "sepath-cloud-app npm run dev",
            "#reviewer-drill",
        ],
        "source_reports": {
            "material": rel(MATERIAL_JSON),
            "product_report": rel(REVIEWER_REPORT),
            "public_trial_manifest": rel(PUBLIC_TRIAL_MANIFEST),
            "seed_manifest": rel(SEED_MANIFEST),
        },
        "source_summary": {
            "material_runtime": material.get("runtime"),
            "product_report_runtime": report.get("runtime"),
            "product_report_summary": report.get("summary", {}),
            "seed_accounts": len(seed.get("accounts", [])),
            "public_guide": public_manifest.get("reviewer_guide", {}),
        },
        "checks_summary": summarize(checks),
        "checks": checks,
        "personas": PERSONAS,
        "route": ROUTE,
        "scorecard": SCORECARD,
        "fallback_cards": FALLBACK_CARDS,
        "forbidden_claims": FORBIDDEN_CLAIMS,
        "teacher_review_deep_dive": {
            "trigger_policy": "evidence gap, direct-answer risk, low confidence diagnosis, high impact intervention",
            "teacher_actions": ["approve", "reject", "request_more_evidence", "convert_to_mini_lab"],
            "writeback": "teacher decision becomes EvidenceEvent and affects the next path plan",
            "anchors": ["#teacher-report", "#intervention-playbook", "#rubric-calibration"],
        },
        "truth_boundary": "Synthetic reviewer walkthrough only; not a claim of real school production access or real course causal gains.",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate a standalone 5-minute reviewer drill evidence pack.")
    parser.add_argument("--write", action="store_true", help="Write the evidence pack files.")
    args = parser.parse_args()

    material = sync_material_json(read_json(MATERIAL_JSON))
    report = read_json(REVIEWER_REPORT)
    seed = read_json(SEED_MANIFEST)
    public_manifest = read_json(PUBLIC_TRIAL_MANIFEST)
    checks = build_checks(material, report, seed, public_manifest)
    primary = build_primary(material, report, seed, public_manifest, checks)

    if args.write:
        PACK_DIR.mkdir(parents=True, exist_ok=True)
        write_json(MATERIAL_JSON, material)
        write_json(TRACE_JSON, {"runtime": "sepath-reviewer-5min-drill-trace.v1", "route": ROUTE, "personas": PERSONAS})
        write_scorecard()
        write_json(CHECKS_JSON, {"runtime": "sepath-reviewer-5min-drill-checks.v1", "summary": primary["checks_summary"], "checks": checks})
        write_markdown_files(primary)
        write_json(PRIMARY_JSON, primary)
        primary["artifact_files"] = artifact_rows()
        write_json(PRIMARY_JSON, primary)

    print(json.dumps({"summary": primary["checks_summary"], "pack": rel(PACK_DIR)}, ensure_ascii=False, indent=2))
    if primary["checks_summary"]["FAIL"] > 0:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
