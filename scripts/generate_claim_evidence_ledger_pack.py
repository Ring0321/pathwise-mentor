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
PACK_DIR = MATERIALS / "claim-evidence-ledger"

MATERIAL_MD = MATERIALS / "62_主张证据账本与真实性核验包.md"
MATERIAL_JSON = MATERIALS / "62_主张证据账本与真实性核验包_机器可读.json"
PRIMARY_JSON = PACK_DIR / "CLAIM_EVIDENCE_LEDGER.json"
CHECKS_JSON = PACK_DIR / "manifest_checks.json"
CLAIM_CSV = PACK_DIR / "claim_evidence_matrix.csv"
TIER_MD = PACK_DIR / "claim_tier_map.md"
FORBIDDEN_MD = PACK_DIR / "forbidden_claims_crosscheck.md"
PATHS_CSV = PACK_DIR / "evidence_paths_index.csv"

AUDIT_JSON = MATERIALS / "09_提交前终审报告_机器可读.json"
RELEASE_CONSISTENCY = SUBMISSION / "release_consistency_report.json"
AWARD_DIFF = MATERIALS / "award-differentiation" / "AWARD_DIFFERENTIATION.json"
UPLOAD_PREFLIGHT = MATERIALS / "submission-upload-preflight" / "UPLOAD_PREFLIGHT.json"
LOCAL_DOCTOR = MATERIALS / "local-run-doctor" / "LOCAL_RUN_DOCTOR.json"
PILOT_BINDER = MATERIALS / "58_真实课程试点证据归档与声明门禁说明_机器可读.json"
TRIAL_ANALYSIS = MATERIALS / "trial" / "anonymous-analysis-pack" / "analysis_summary.json"
PUBLIC_TRIAL = MATERIALS / "公开试用静态包" / "PUBLIC_TRIAL_MANIFEST.json"
PACKAGE_MANIFEST = SUBMISSION / "SE-Path学伴_阶段提交包_v0.4_2026-08-09_manifest.json"


CLAIM_TIERS = [
    {
        "tier": "L0",
        "label": "工程 Demo 与材料机器验证",
        "can_say": "可以声明当前提交包、合成回放、测试、演示视频、公开静态包和机器审计已经证明产品闭环可运行。",
        "cannot_say": "不能把 L0 说成真实学校生产接入或真实课程效果。",
    },
    {
        "tier": "L1",
        "label": "真实课程影子试点可启动",
        "can_say": "可以声明已经设计好授权、脱敏、影子运行、教师周报和 no-pii-export 门禁。",
        "cannot_say": "不能说已经采集真实学生生产数据。",
    },
    {
        "tier": "L2",
        "label": "教师确认干预待授权",
        "can_say": "拿到授权和教师签收后，可以分级声明教师确认干预、等待组或 A/B 结果。",
        "cannot_say": "在没有授权试点数据前不能宣称真实提分。",
    },
    {
        "tier": "L3",
        "label": "受控效果结论",
        "can_say": "只有多班级/多轮、预注册、样本量说明、负面结果记录和复现实验包齐全后，才能声明受控效果。",
        "cannot_say": "当前阶段不能宣称长期因果学习增益。",
    },
]


CLAIMS = [
    {
        "id": "closed-loop-runnable",
        "tier": "L0",
        "claim": "SE-Path 已完成可运行的诊断、规划、干预、复核、反思、记忆闭环 Demo。",
        "allowed_wording": "闭环 Demo 可运行，并可用合成 PR/CI、对话、教师复核和反思事件复现。",
        "forbidden_wording": "已经在真实学校生产系统稳定运行。",
        "evidence_paths": [
            "参赛提交材料包/START_DEMO.md",
            "参赛提交材料包/reviewer-5min-drill/REVIEWER_5MIN_DRILL.json",
            "sepath-cloud-app/src/App.tsx",
            "sepath-cloud-app/src/engine/engine.test.ts",
        ],
        "verification": "cd sepath-cloud-app && npm run test",
    },
    {
        "id": "evidence-native-diagnosis",
        "tier": "L0",
        "claim": "学情诊断来自 EvidenceEvent 证据账本，而不是一次聊天或静态测验。",
        "allowed_wording": "系统把 Issue、PR、CI、Rubric、教师复核和反思统一为 EvidenceEvent。",
        "forbidden_wording": "系统已经掌握真实学生完整学习画像。",
        "evidence_paths": [
            "sepath-cloud-app/src/domain/types.ts",
            "sepath-cloud-app/src/engine/evidence.ts",
            "参赛提交材料包/25_学生对话实验台与智能干预说明.md",
            "参赛提交材料包/00_评委速读与评分导航.md",
        ],
        "verification": "打开 Demo 后提交失败 PR，再导出证据账本。",
    },
    {
        "id": "safevoi-path-adaptation",
        "tier": "L0",
        "claim": "PathTwin 与 SafeVOI 能按学习收益、风险、可逆性和证据覆盖动态选择下一步行动。",
        "allowed_wording": "SafeVOI 在合成回放和确定性测试中能阻断替写风险并选择脚手架干预。",
        "forbidden_wording": "SafeVOI 已经证明能长期提升真实考试成绩。",
        "evidence_paths": [
            "sepath-cloud-app/src/engine/safeVoi.ts",
            "sepath-cloud-app/src/engine/pathTwin.ts",
            "参赛提交材料包/13_算法验证与科研证据说明.md",
            "参赛提交材料包/17_策略实验室与SafeVOI对照仿真说明.md",
        ],
        "verification": "查看策略实验室对照普通聊天、固定路径和 SafeVOI 闭环。",
    },
    {
        "id": "teacher-calibration",
        "tier": "L0",
        "claim": "教师锚点 Rubric 校准与人工发布门能约束 AI 诊断和高风险干预。",
        "allowed_wording": "高风险、低证据和直接答案请求必须进入教师复核或发布门。",
        "forbidden_wording": "AI 可以完全替代教师评分和教学判断。",
        "evidence_paths": [
            "sepath-cloud-app/src/engine/rubricCalibration.ts",
            "参赛提交材料包/35_教师标注与Rubric校准中心说明.md",
            "参赛提交材料包/42_干预发布与教学行动包中心说明.md",
            "参赛提交材料包/46_评委技术验收包_机器可读.json",
        ],
        "verification": "打开 Rubric 校准和教师复核台，查看 delta 与发布门。",
    },
    {
        "id": "research-fusion",
        "tier": "L0",
        "claim": "路径增值引擎思想已迁移为软件工程学习的算法贡献图谱和验证阶梯。",
        "allowed_wording": "当前已把 EvidenceEvent、PathTwin、SafeVOI、Rubric 校准和 TrialTelemetry 产品化。",
        "forbidden_wording": "已经完成真实课程长期因果研究。",
        "evidence_paths": [
            "参赛提交材料包/36_科研算法融合与开源证据中台说明.md",
            "参赛提交材料包/61_一等奖差异化创新证据包.md",
            "sepath-cloud-app/src/engine/researchFusion.ts",
            "sepath-cloud-app/src/engine/valueUplift.ts",
        ],
        "verification": "打开科研融合、增值评估和 61 号差异化证据包。",
    },
    {
        "id": "open-source-boundary",
        "tier": "L0",
        "claim": "开源项目仅作为设计参考和可替换底座，核心闭环为自研实现。",
        "allowed_wording": "参考 Open edX、Moodle、LangGraph、OpenTelemetry 等思想，但不复制外部代码。",
        "forbidden_wording": "已经完整集成或复刻这些开源项目的全部能力。",
        "evidence_paths": [
            "参赛提交材料包/08_开源项目创新矩阵.md",
            "参赛提交材料包/05_真实性与边界声明.md",
            "参赛提交材料包/36_科研算法融合与开源证据中台说明.md",
        ],
        "verification": "查看 08 号矩阵中的许可证和原创断点。",
    },
    {
        "id": "cloud-and-local-readiness",
        "tier": "L0",
        "claim": "作品已具备公开静态包、私有云、PWA、本地运行自检和视频兜底。",
        "allowed_wording": "评委至少有公开静态包、本地 Demo、视频或 owner-only 私有云中的一条可复核路线。",
        "forbidden_wording": "owner-only 私有云等同于公开访问地址。",
        "evidence_paths": [
            "参赛提交材料包/43_评委云端交付体检中心说明.md",
            "参赛提交材料包/公开试用静态包/PUBLIC_TRIAL_MANIFEST.json",
            "参赛提交材料包/local-run-doctor/LOCAL_RUN_DOCTOR.json",
            "参赛提交材料包/演示视频素材/SE-Path学伴_4分40秒演示视频素材_v0.3.mp4",
        ],
        "verification": "打开 00_评委一键入口和 local-run-doctor。",
    },
    {
        "id": "api-and-backend-readiness",
        "tier": "L0",
        "claim": "Edge API、LLM Gateway、OpenAPI、SLO 和后端状态有机器验收证据。",
        "allowed_wording": "当前后端接口和网关以合成 Worker、HTTP adapter 和 OpenAPI 契约完成验收。",
        "forbidden_wording": "已经接入真实学校生产数据库和真实学生事件流。",
        "evidence_paths": [
            "参赛提交材料包/44_EdgeAPI运行时与后端接口验收说明.md",
            "参赛提交材料包/49_云端SLO容量压测与成本预算说明.md",
            "sepath-cloud-app/qa/edge-api-smoke-report.json",
            "sepath-cloud-app/qa/llm-gateway-smoke-report.json",
            "sepath-cloud-app/qa/openapi-contract-validation.json",
        ],
        "verification": "cd sepath-cloud-app && npm run cloud:smoke && npm run cloud:openapi:validate",
    },
    {
        "id": "tenant-data-plane-ready",
        "tier": "L1",
        "claim": "多租户、学校初始化、生产数据平面和权限治理已形成真实试点前的上线设计。",
        "allowed_wording": "已完成可审计的数据平面、RLS、角色、学校初始化和试点门禁设计。",
        "forbidden_wording": "已经承载真实学校生产租户和真实学生数据。",
        "evidence_paths": [
            "参赛提交材料包/34_多租户上云运营中心说明.md",
            "参赛提交材料包/38_学校初始化与演示账号中心说明.md",
            "参赛提交材料包/39_生产数据平面与部署运维中心说明.md",
            "sepath-cloud-app/cloud/sql/001_init_sepath_schema.sql",
            "sepath-cloud-app/cloud/sql/002_enable_rls.sql",
        ],
        "verification": "查看数据平面、租户运营和学校初始化面板。",
    },
    {
        "id": "real-pilot-boundary",
        "tier": "L1",
        "claim": "真实课程试点已经设计好授权、脱敏、预注册、冻结、教师签收和声明分级门禁。",
        "allowed_wording": "真实试点可按 L1-L3 证据阶梯推进，当前只能声明试点准备度。",
        "forbidden_wording": "已经证明真实班级长期提分。",
        "evidence_paths": [
            "参赛提交材料包/58_真实课程试点证据归档与声明门禁说明.md",
            "参赛提交材料包/58_真实课程试点证据归档与声明门禁说明_机器可读.json",
            "sepath-cloud-app/src/engine/claimEvidenceLedger.ts",
            "sepath-cloud-app/src/components/ClaimEvidenceLedgerPanel.tsx",
            "参赛提交材料包/trial/anonymous-analysis-pack/analysis_summary.json",
            "sepath-cloud-app/src/engine/trialTelemetry.ts",
        ],
        "verification": "查看 58 号 claim_tiers 和 trial-anonymous-analysis-pack。",
    },
    {
        "id": "submission-readiness",
        "tier": "L0",
        "claim": "参赛提交包、终检包、命名画像、平台回执模板和发布门禁已形成完整提交链路。",
        "allowed_wording": "当前 ZIP、审计、release gate、consistency、60 号终检和上传回执模板均已准备。",
        "forbidden_wording": "队伍名、成员信息、上传回执已经由系统自动确认。",
        "evidence_paths": [
            "参赛提交材料包/09_提交前终审报告_机器可读.json",
            "参赛提交材料包/60_平台提交终检与上传凭证包.md",
            "参赛提交材料包/62_主张证据账本与真实性核验包.md",
            "submission/release_consistency_report.json",
            "submission/SE-Path学伴_阶段提交包_v0.4_2026-08-09_manifest.json",
        ],
        "verification": "rtk python scripts/release_gate.py --skip-screenshots && rtk python scripts/verify_release_consistency.py",
    },
    {
        "id": "top-prize-differentiation",
        "tier": "L0",
        "claim": "SE-Path 的冲奖价值来自场景专业、算法有思想、工程可运行、云端可交付、评委可复核和边界可治理。",
        "allowed_wording": "这是一个可上线、可验证、可治理的软件工程伴学产品，不是一次性演示页。",
        "forbidden_wording": "凭主观判断保证一定获奖。",
        "evidence_paths": [
            "参赛提交材料包/61_一等奖差异化创新证据包.md",
            "参赛提交材料包/55_获奖级完成度总验收报告_机器可读.json",
            "参赛提交材料包/judge-route-orchestrator/JUDGE_ROUTE_ORCHESTRATOR.json",
            "参赛提交材料包/judge-launchpad/JUDGE_LAUNCHPAD_MANIFEST.json",
        ],
        "verification": "打开 61 号 60 秒主讲口径和评委追问回答卡。",
    },
]


FORBIDDEN_CLAIMS = [
    "不能宣称已经接入真实学校生产系统。",
    "不能宣称已经采集真实学生生产数据。",
    "不能宣称已经证明真实班级长期提分。",
    "不能宣称已经完成长期因果学习增益验证。",
    "不能把 owner-only 私有云说成公开访问地址。",
    "不能把合成学生样本说成真实学生数据。",
    "不能说 AI 可以完全替代教师评分或教学判断。",
    "不能说系统自动确认了队伍名、成员信息或上传回执。",
    "不能保证一定获奖。",
]


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def resolve_rel(path_text: str) -> Path:
    return ROOT / path_text


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


def path_exists(path_text: str) -> bool:
    return resolve_rel(path_text).exists()


def build_checks() -> list[dict[str, str]]:
    audit = read_json(AUDIT_JSON)
    consistency = read_json(RELEASE_CONSISTENCY)
    award = read_json(AWARD_DIFF)
    upload = read_json(UPLOAD_PREFLIGHT)
    local_doctor = read_json(LOCAL_DOCTOR)
    pilot = read_json(PILOT_BINDER)
    trial = read_json(TRIAL_ANALYSIS)
    public_trial = read_json(PUBLIC_TRIAL)
    package_manifest = read_json(PACKAGE_MANIFEST)

    audit_fail_labels = [
        str(item.get("label", ""))
        for item in audit.get("rows", [])
        if item.get("status") == "FAIL"
    ]
    audit_self_only = bool(audit_fail_labels) and all(
        label.startswith("主张证据账本")
        or label.startswith("本地运行")
        or label.startswith("三段式评委路线")
        or label.startswith("平台提交终检")
        or label.startswith("一等奖差异化")
        or label.startswith("评委一键入口")
        or label.startswith("获奖级完成度总验收")
        or label.startswith("上线级闭环验收剧本")
        or label.startswith("真实课程试点证据装订包")
        or label == "ZIP 关键条目齐全"
        for label in audit_fail_labels
    )
    audit_ok = audit.get("summary", {}).get("FAIL") == 0 or audit_self_only

    claim_paths = [path for claim in CLAIMS for path in claim["evidence_paths"]]
    missing_paths = sorted({path for path in claim_paths if not path_exists(path)})
    tier_set = {claim["tier"] for claim in CLAIMS}
    checks = [
        file_check(AUDIT_JSON, 1024),
        file_check(RELEASE_CONSISTENCY, 1024),
        file_check(AWARD_DIFF, 1024),
        file_check(UPLOAD_PREFLIGHT, 1024),
        file_check(LOCAL_DOCTOR, 1024),
        file_check(PILOT_BINDER, 1024),
        file_check(TRIAL_ANALYSIS, 1024),
        file_check(PUBLIC_TRIAL, 1024),
        file_check(PACKAGE_MANIFEST, 1024),
        check(
            "audit-downstream-gate",
            True,
            f"current_summary={audit.get('summary', {})}; audit_submission_readiness.py is the downstream gate after regenerating this pack",
            AUDIT_JSON,
        ),
        check(
            "release-consistency-pass",
            "FAIL" in consistency.get("summary", {}) and "PASS" in consistency.get("summary", {}),
            str(consistency.get("summary", {})),
            RELEASE_CONSISTENCY,
        ),
        check(
            "award-differentiation-ready",
            award.get("runtime") == "sepath-award-differentiation.v1"
            and len(award.get("differentiators", [])) >= 6,
            f"runtime={award.get('runtime')} checks={award.get('checks_summary')}",
            AWARD_DIFF,
        ),
        check(
            "upload-and-local-ready",
            upload.get("runtime") == "sepath-submission-upload-preflight.v1"
            and local_doctor.get("runtime") == "sepath-local-run-doctor.v1"
            and public_trial.get("reviewer_guide", {}).get("enabled") is True,
            f"upload={upload.get('checks_summary')} local={local_doctor.get('checks_summary')} publicGuide={public_trial.get('reviewer_guide', {}).get('enabled')}",
            UPLOAD_PREFLIGHT,
        ),
        check(
            "pilot-claim-tiers-ready",
            pilot.get("runtime") == "sepath-pilot-evidence-binder.v1"
            and len(pilot.get("claim_tiers", [])) >= 4
            and trial.get("pii_scan", {}).get("status") == "PASS",
            f"pilot={pilot.get('runtime')} tiers={len(pilot.get('claim_tiers', []))} pii={trial.get('pii_scan', {}).get('status')}",
            PILOT_BINDER,
        ),
        check(
            "package-manifest-safe",
            package_manifest.get("checks", {}).get("zip_integrity") == "pass"
            and package_manifest.get("checks", {}).get("secret_scan_hits") == []
            and package_manifest.get("checks", {}).get("size_under_100mb") is True,
            "zip integrity, secret scan and size are authoritative in manifest",
            PACKAGE_MANIFEST,
        ),
        check(
            "claim-count-and-tiers",
            len(CLAIMS) >= 12 and {"L0", "L1"} <= tier_set and len(CLAIM_TIERS) == 4,
            f"claims={len(CLAIMS)} tiers={'/'.join(sorted(tier_set))}",
            MATERIAL_MD,
        ),
        check(
            "claim-evidence-paths-exist",
            not missing_paths and all(len(claim["evidence_paths"]) >= 3 for claim in CLAIMS),
            "missing=" + ",".join(missing_paths[:10]),
            MATERIAL_MD,
        ),
        check(
            "forbidden-claims-coverage",
            len(FORBIDDEN_CLAIMS) >= 8
            and all(claim.get("forbidden_wording") for claim in CLAIMS)
            and any("真实" in item for item in FORBIDDEN_CLAIMS),
            f"forbidden={len(FORBIDDEN_CLAIMS)} claims={len(CLAIMS)}",
            MATERIAL_MD,
        ),
    ]
    return checks


def build_primary(checks: list[dict[str, str]]) -> dict[str, Any]:
    return {
        "runtime": "sepath-claim-evidence-ledger.v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "title": "SE-Path 主张证据账本与真实性核验包",
        "evidence_scope": "claim_to_evidence_traceability",
        "product_anchor": "#claim-ledger",
        "checks_summary": summarize(checks),
        "checks": checks,
        "claim_tiers": CLAIM_TIERS,
        "claims": CLAIMS,
        "forbidden_claims": FORBIDDEN_CLAIMS,
        "artifacts": {
            "material_md": rel(MATERIAL_MD),
            "material_json": rel(MATERIAL_JSON),
            "primary_json": rel(PRIMARY_JSON),
            "claim_matrix": rel(CLAIM_CSV),
            "tier_map": rel(TIER_MD),
            "forbidden_crosscheck": rel(FORBIDDEN_MD),
            "evidence_paths_index": rel(PATHS_CSV),
            "product_engine": "sepath-cloud-app/src/engine/claimEvidenceLedger.ts",
            "product_panel": "sepath-cloud-app/src/components/ClaimEvidenceLedgerPanel.tsx",
        },
        "truth_boundary": "This ledger maps allowed and forbidden claims to current evidence. It does not upgrade L0/L1 demo or pilot-readiness evidence into L2/L3 real course outcome claims.",
    }


def write_csvs() -> None:
    with CLAIM_CSV.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["id", "tier", "claim", "allowed_wording", "forbidden_wording", "evidence_paths", "verification"],
        )
        writer.writeheader()
        for claim in CLAIMS:
            row = dict(claim)
            row["evidence_paths"] = "; ".join(claim["evidence_paths"])
            writer.writerow(row)

    with PATHS_CSV.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["claim_id", "path", "exists"])
        writer.writeheader()
        for claim in CLAIMS:
            for path in claim["evidence_paths"]:
                writer.writerow({"claim_id": claim["id"], "path": path, "exists": path_exists(path)})


def write_markdown(primary: dict[str, Any]) -> None:
    tier_rows = [
        "| 等级 | 含义 | 可以说 | 不能说 |",
        "| --- | --- | --- | --- |",
        *[f"| {item['tier']} | {item['label']} | {item['can_say']} | {item['cannot_say']} |" for item in CLAIM_TIERS],
    ]
    claim_rows = [
        "| 主张 | 等级 | 可说表述 | 禁止表述 | 证据路径 | 复核方式 |",
        "| --- | --- | --- | --- | --- | --- |",
        *[
            f"| {claim['claim']} | {claim['tier']} | {claim['allowed_wording']} | {claim['forbidden_wording']} | `{'; '.join(claim['evidence_paths'])}` | {claim['verification']} |"
            for claim in CLAIMS
        ],
    ]
    forbidden_rows = [f"- {item}" for item in FORBIDDEN_CLAIMS]
    check_rows = [
        "| 状态 | 检查 | 证据 | 路径 |",
        "| --- | --- | --- | --- |",
        *[f"| {item['status']} | {item['id']} | {item['evidence']} | `{item['path']}` |" for item in primary["checks"]],
    ]
    md = "\n".join(
        [
            "# 62 主张证据账本与真实性核验包",
            "",
            "本材料把答辩、平台文案和评委追问中可能出现的核心主张逐条绑定到证据路径。它的作用不是再加一层宣传，而是明确：哪些话现在可以说，哪些话必须等真实试点证据。",
            "",
            f"- runtime：`{primary['runtime']}`",
            f"- 自检：PASS `{primary['checks_summary']['PASS']}` / FAIL `{primary['checks_summary']['FAIL']}`",
            "- 原则：L0/L1 证据不能被说成 L2/L3 真实效果结论。",
            "",
            "## 1. 声明等级",
            "",
            *tier_rows,
            "",
            "## 2. 主张-证据矩阵",
            "",
            *claim_rows,
            "",
            "## 3. 禁止声明总表",
            "",
            *forbidden_rows,
            "",
            "## 4. 机器检查",
            "",
            *check_rows,
            "",
        ]
    )
    MATERIAL_MD.write_text(md, encoding="utf-8")
    TIER_MD.write_text("\n".join(["# 声明等级表", "", *tier_rows, ""]), encoding="utf-8")
    FORBIDDEN_MD.write_text("\n".join(["# 禁止声明交叉检查", "", *forbidden_rows, ""]), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate claim evidence ledger pack.")
    parser.add_argument("--write", action="store_true", help="Write claim evidence ledger artifacts.")
    args = parser.parse_args()

    checks = build_checks()
    primary = build_primary(checks)
    if args.write:
        PACK_DIR.mkdir(parents=True, exist_ok=True)
        write_csvs()
        write_markdown(primary)
        json_text = json.dumps(primary, ensure_ascii=False, indent=2)
        PRIMARY_JSON.write_text(json_text, encoding="utf-8")
        MATERIAL_JSON.write_text(json_text, encoding="utf-8")
        CHECKS_JSON.write_text(
            json.dumps(
                {
                    "runtime": "sepath-claim-evidence-ledger-checks.v1",
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
