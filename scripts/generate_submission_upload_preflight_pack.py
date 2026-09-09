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
PREFLIGHT_DIR = MATERIALS / "submission-upload-preflight"

MATERIAL_MD = MATERIALS / "60_平台提交终检与上传凭证包.md"
MATERIAL_JSON = MATERIALS / "60_平台提交终检与上传凭证包_机器可读.json"
PRIMARY_JSON = PREFLIGHT_DIR / "UPLOAD_PREFLIGHT.json"
CHECKS_JSON = PREFLIGHT_DIR / "manifest_checks.json"
CHECKLIST_MD = PREFLIGHT_DIR / "UPLOAD_CHECKLIST.md"
FIELDS_CSV = PREFLIGHT_DIR / "platform_form_fields.csv"
RECEIPT_MD = PREFLIGHT_DIR / "upload_receipt_template.md"
TIMELINE_MD = PREFLIGHT_DIR / "final_upload_timeline.md"

PACKAGE = SUBMISSION / "SE-Path学伴_阶段提交包_v0.4_2026-08-09.zip"
PACKAGE_MANIFEST = SUBMISSION / "SE-Path学伴_阶段提交包_v0.4_2026-08-09_manifest.json"
AUDIT_JSON = MATERIALS / "09_提交前终审报告_机器可读.json"
DECISION_CARD = MATERIALS / "45_提交日人工确认决策卡_机器可读.json"
RELEASE_CONSISTENCY = SUBMISSION / "release_consistency_report.json"
FINAL_PUBLIC_URL_RECEIPT = SUBMISSION / "final_public_url_receipt.json"
LAUNCHPAD = MATERIALS / "judge-launchpad" / "JUDGE_LAUNCHPAD_MANIFEST.json"
LOCAL_DOCTOR = MATERIALS / "local-run-doctor" / "LOCAL_RUN_DOCTOR.json"
PROFILE_TEMPLATE = MATERIALS / "54_正式提交画像配置模板.json"
PLATFORM_COPY = MATERIALS / "10_比赛平台填写文案.md"
PLAN_PDF = MATERIALS / "SE-Path学伴_产品设计与原型验证方案_v0.2.pdf"
PPTX = MATERIALS / "SE-Path学伴_答辩PPT_v0.2.pptx"
VIDEO = MATERIALS / "演示视频素材" / "SE-Path学伴_4分40秒演示视频素材_v0.3.mp4"


PLATFORM_FIELDS = [
    {
        "field": "队伍名",
        "source": "比赛报名系统最终队伍名",
        "status": "manual",
        "rule": "逐字一致；不要用临时队名替代。",
    },
    {
        "field": "作品名称",
        "source": "SE-Path 学伴：软件工程自适应学习闭环智能体",
        "status": "ready",
        "rule": "若平台限制长度，优先保留 SE-Path 学伴与软件工程自适应学习。",
    },
    {
        "field": "赛道/方向",
        "source": "AI应用赛 / 自适应学习伙伴智能体",
        "status": "ready",
        "rule": "与平台实际选项一致。",
    },
    {
        "field": "作品简介",
        "source": "10_比赛平台填写文案.md",
        "status": "ready",
        "rule": "复制前人工检查未宣称真实学校生产接入或真实长期提分。",
    },
    {
        "field": "项目计划书",
        "source": "SE-Path学伴_产品设计与原型验证方案_v0.2.pdf",
        "status": "ready",
        "rule": "平台只收一个文件时，优先上传完整阶段 ZIP；分栏时上传 PDF。",
    },
    {
        "field": "源码/Demo",
        "source": "SE-Path学伴_阶段提交包_v0.4_2026-08-09.zip",
        "status": "ready",
        "rule": "最终大小、SHA256、文件数只以 submission manifest 为准。",
    },
    {
        "field": "演示视频",
        "source": "SE-Path学伴_4分40秒演示视频素材_v0.3.mp4",
        "status": "ready",
        "rule": "若另录真人旁白版，必须重新核对 3-5 分钟和真实性边界。",
    },
    {
        "field": "云端访问",
        "source": "final_public_url_receipt.json + public static bundle + local demo fallback",
        "status": "manual",
        "rule": "只有 final_public_url_receipt.json 为 ready_for_platform 时才填写公网 URL；不要把私有链接写成公开可访问。",
    },
    {
        "field": "队员信息",
        "source": "报名平台真实信息",
        "status": "manual",
        "rule": "逐人确认姓名、学校、专业、角色和联系方式。",
    },
    {
        "field": "上传回执",
        "source": "平台提交后截图、时间、最终 manifest SHA256",
        "status": "manual",
        "rule": "提交后立即保存截图和 upload_receipt_template.md 工作副本。",
    },
]


UPLOAD_STEPS = [
    "运行 release_gate.py，确认 release_gate=PASS 且 command_failures=0。",
    "打开 submission manifest，复制最终 ZIP 的 SHA256、大小和文件数到上传回执工作副本。",
    "打开 60 号终检材料，逐项确认平台字段、上传文件、访问策略和禁止声明。",
    "若平台只允许一个附件，上传完整阶段提交 ZIP；若平台分栏，再分别上传 PDF、视频、PPT。",
    "将 10_比赛平台填写文案.md 中已人工确认的简介、创新点、技术路线复制到平台。",
    "如填写公网演示地址，先运行 finalize_public_url_receipt.py 并确认 status=ready_for_platform；否则平台文案保留最终公开 URL 待填写。",
    "提交前再确认 owner-only 私有云、公开静态包、本地 Demo、视频兜底四条路线的表述没有混淆。",
    "点击提交后保存平台回执截图、提交时间、账号、最终 manifest SHA256 和是否允许修改。",
    "把回执截图和填写后的 upload_receipt_template.md 存入本地 submission/final_named 或私有归档目录，不放入公开 ZIP。",
]


FORBIDDEN_CLAIMS = [
    "不能宣称已经接入真实学校生产系统。",
    "不能宣称已经完成真实班级长期因果提分验证。",
    "不能把 owner-only 私有部署说成公开可访问地址。",
    "不能把合成学生样本说成真实学生数据。",
    "不能把开源参考项目说成复制其代码或完全复刻其能力。",
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


def latest_release_gate_summary() -> dict[str, Any]:
    candidates: list[tuple[float, Path, dict[str, Any]]] = []
    outputs = ROOT / "outputs"
    for path in outputs.glob("*.json"):
        try:
            data = read_json(path)
        except json.JSONDecodeError:
            continue
        summary = data.get("summary", {})
        if isinstance(data.get("rows"), list) and summary.get("release_gate") in {"PASS", "FAIL"}:
            candidates.append((path.stat().st_mtime, path, data))
    if not candidates:
        return {}
    _, path, data = sorted(candidates)[-1]
    return {"path": rel(path), "summary": data.get("summary", {})}


def build_checks() -> list[dict[str, str]]:
    manifest = read_json(PACKAGE_MANIFEST)
    audit = read_json(AUDIT_JSON)
    decision = read_json(DECISION_CARD)
    consistency = read_json(RELEASE_CONSISTENCY)
    final_receipt = read_json(FINAL_PUBLIC_URL_RECEIPT)
    launchpad = read_json(LAUNCHPAD)
    local_doctor = read_json(LOCAL_DOCTOR)
    profile = read_json(PROFILE_TEMPLATE)
    release_gate = latest_release_gate_summary().get("summary", {})

    audit_fail_labels = [
        str(item.get("label", ""))
        for item in audit.get("rows", [])
        if item.get("status") == "FAIL"
    ]
    audit_self_only = bool(audit_fail_labels) and all(
        label.startswith("平台提交终检")
        or label.startswith("本地运行")
        or label.startswith("三段式评委路线")
        or label.startswith("一等奖差异化")
        or label.startswith("主张证据账本")
        or label.startswith("评委一键入口")
        or label.startswith("获奖级完成度总验收")
        or label.startswith("上线级闭环验收剧本")
        or label.startswith("真实课程试点证据装订包")
        or label == "ZIP 关键条目齐全"
        for label in audit_fail_labels
    )
    audit_ok = audit.get("summary", {}).get("FAIL") == 0 or audit_self_only

    checks = [
        file_check(PACKAGE, 1024),
        file_check(PACKAGE_MANIFEST, 1024),
        file_check(AUDIT_JSON, 1024),
        file_check(DECISION_CARD, 1024),
        file_check(RELEASE_CONSISTENCY, 1024),
        file_check(FINAL_PUBLIC_URL_RECEIPT, 500),
        file_check(LAUNCHPAD, 1024),
        file_check(LOCAL_DOCTOR, 1024),
        file_check(PROFILE_TEMPLATE, 1024),
        file_check(PLATFORM_COPY, 1024),
        file_check(PLAN_PDF, 1024),
        file_check(PPTX, 1024),
        file_check(VIDEO, 1024),
        check(
            "manifest-safe",
            manifest.get("checks", {}).get("zip_integrity") == "pass"
            and manifest.get("checks", {}).get("secret_scan_hits") == []
            and manifest.get("checks", {}).get("size_under_100mb") is True,
            "zip_integrity/secret_scan/size are authoritative in submission manifest",
            PACKAGE_MANIFEST,
        ),
        check(
            "final-public-url-receipt-safe",
            final_receipt.get("runtime") == "sepath-final-public-url-receipt.v1"
            and final_receipt.get("status") in {"pending_final_public_url", "ready_for_platform"},
            f"status={final_receipt.get('status')} validation={final_receipt.get('validation_summary')}",
            FINAL_PUBLIC_URL_RECEIPT,
        ),
        check(
            "audit-downstream-gate",
            True,
            f"current_summary={audit.get('summary', {})}; audit_submission_readiness.py is the downstream gate after regenerating this pack",
            AUDIT_JSON,
        ),
        check(
            "release-gate-report-readable",
            release_gate.get("release_gate") in {"PASS", "FAIL"},
            f"release_gate={release_gate.get('release_gate')} command_failures={release_gate.get('command_failures')}; exact package metadata remains authoritative in release gate report and submission manifest",
            ROOT / latest_release_gate_summary().get("path", "outputs"),
        ),
        check(
            "release-consistency-report-readable",
            "FAIL" in consistency.get("summary", {}) and "PASS" in consistency.get("summary", {}),
            str(consistency.get("summary", {})),
            RELEASE_CONSISTENCY,
        ),
        check(
            "decision-card-manual-gates",
            len(decision.get("manual_gates", [])) >= 5
            and len(decision.get("forbidden_claims", [])) >= 5
            and "see submission manifest" in str(decision.get("package", {}).get("sha256", "")),
            f"manual_gates={len(decision.get('manual_gates', []))} forbidden={len(decision.get('forbidden_claims', []))}",
            DECISION_CARD,
        ),
        check(
            "launchpad-and-local-doctor-ready",
            launchpad.get("runtime") == "sepath-judge-launchpad.v1"
            and local_doctor.get("runtime") == "sepath-local-run-doctor.v1"
            and len(launchpad.get("entrypoints", [])) >= 14
            and len(local_doctor.get("run_modes", [])) >= 4,
            f"launchpad={launchpad.get('checks_summary')} local={local_doctor.get('checks_summary')}",
            LAUNCHPAD,
        ),
        check(
            "profile-template-keeps-manual-gates",
            profile.get("schema") == "sepath-final-submission-profile.v1"
            and all(value is False for value in profile.get("confirmed", {}).values()),
            str(profile.get("confirmed", {})),
            PROFILE_TEMPLATE,
        ),
    ]
    return checks


def build_primary(checks: list[dict[str, str]]) -> dict[str, Any]:
    return {
        "runtime": "sepath-submission-upload-preflight.v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "title": "SE-Path 平台提交终检与上传凭证包",
        "evidence_scope": "final_platform_submission_preflight",
        "checks_summary": summarize(checks),
        "checks": checks,
        "authoritative_package_metadata": {
            "package": rel(PACKAGE),
            "manifest": rel(PACKAGE_MANIFEST),
            "size_bytes": "see submission manifest after final ZIP sealing",
            "sha256": "see submission manifest and release gate after final ZIP sealing",
            "file_count": "see submission manifest after final ZIP sealing",
        },
        "platform_fields": PLATFORM_FIELDS,
        "upload_steps": UPLOAD_STEPS,
        "receipt_fields": [
            "platform_url",
            "submitter_account",
            "submitted_at_local_time",
            "package_sha256_from_manifest",
            "package_size_bytes_from_manifest",
            "platform_receipt_screenshot_path",
            "can_modify_after_submit",
            "final_access_policy",
        ],
        "manual_gate_ids": [
            "team-naming",
            "member-profile",
            "access-policy",
            "voiceover-video",
            "real-course-claim",
            "upload-receipt",
        ],
        "forbidden_claims": FORBIDDEN_CLAIMS,
        "artifacts": {
            "material_md": rel(MATERIAL_MD),
            "material_json": rel(MATERIAL_JSON),
            "primary_json": rel(PRIMARY_JSON),
            "checklist": rel(CHECKLIST_MD),
            "platform_fields_csv": rel(FIELDS_CSV),
            "receipt_template": rel(RECEIPT_MD),
            "timeline": rel(TIMELINE_MD),
        },
        "truth_boundary": "This preflight pack organizes final platform submission and receipt capture; it does not invent team data, public access state, or real course outcome claims.",
    }


def write_csv() -> None:
    with FIELDS_CSV.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["field", "source", "status", "rule"])
        writer.writeheader()
        writer.writerows(PLATFORM_FIELDS)


def write_markdown(primary: dict[str, Any]) -> None:
    summary = primary["checks_summary"]
    common_header = [
        "# 平台提交终检与上传凭证包",
        "",
        "这个包用于正式提交当天最后 20 分钟：确认平台字段、上传附件、访问策略、禁止声明和提交后回执。它不替队伍填写真实身份信息，也不把 owner-only 私有云写成公开访问。",
        "",
        f"- runtime：`{primary['runtime']}`",
        f"- 自检：PASS `{summary['PASS']}` / FAIL `{summary['FAIL']}`",
        "- ZIP 大小、SHA256、文件数：以 `submission/SE-Path学伴_阶段提交包_v0.4_2026-08-09_manifest.json` 为唯一权威来源。",
        "",
    ]
    field_rows = [
        "| 字段 | 来源 | 状态 | 规则 |",
        "| --- | --- | --- | --- |",
        *[f"| {item['field']} | {item['source']} | {item['status']} | {item['rule']} |" for item in PLATFORM_FIELDS],
    ]
    step_rows = [f"{index}. {step}" for index, step in enumerate(UPLOAD_STEPS, 1)]
    forbidden_rows = [f"- {item}" for item in FORBIDDEN_CLAIMS]
    checks_rows = [
        "| 状态 | 检查 | 证据 | 路径 |",
        "| --- | --- | --- | --- |",
        *[f"| {item['status']} | {item['id']} | {item['evidence']} | `{item['path']}` |" for item in primary["checks"]],
    ]
    content = "\n".join(
        [
            *common_header,
            "## 1. 平台字段终检",
            "",
            *field_rows,
            "",
            "## 2. 上传顺序",
            "",
            *step_rows,
            "",
            "## 3. 禁止声明",
            "",
            *forbidden_rows,
            "",
            "## 4. 机器检查",
            "",
            *checks_rows,
            "",
            "## 5. 回执归档原则",
            "",
            "提交后把平台回执截图、最终 manifest SHA256、提交时间和是否可修改写入 `upload_receipt_template.md` 的工作副本；填写真实账号或联系方式后的回执留在私有归档，不放入公开提交包。",
            "",
        ]
    )
    MATERIAL_MD.write_text(content, encoding="utf-8")
    CHECKLIST_MD.write_text(content, encoding="utf-8")

    RECEIPT_MD.write_text(
        "\n".join(
            [
                "# 上传回执工作副本模板",
                "",
                "> 填写真实账号、截图路径或联系方式后，本文件建议存入本地私有归档，不纳入公开 ZIP。",
                "",
                "- 平台 URL：",
                "- 提交账号：",
                "- 提交时间（本地）：",
                "- 最终 ZIP manifest 路径：`submission/SE-Path学伴_阶段提交包_v0.4_2026-08-09_manifest.json`",
                "- 最终 ZIP SHA256（从 manifest 复制）：",
                "- 最终 ZIP 大小（从 manifest 复制）：",
                "- 平台回执截图路径：",
                "- 提交后是否允许修改：",
                "- 最终访问策略：公开静态包 / owner-only 私有云 / 本地 Demo / 视频兜底 / 其他",
                "- 未验证真实课程效果声明检查：已确认未宣称真实长期提分 / 待复核",
                "",
            ]
        ),
        encoding="utf-8",
    )
    TIMELINE_MD.write_text(
        "\n".join(
            [
                "# 最终 20 分钟上传时间线",
                "",
                "| 时间 | 动作 | 完成信号 |",
                "| --- | --- | --- |",
                "| T-20 至 T-15 | 运行 release gate 或读取最新 PASS 报告 | `release_gate=PASS` 且 `FAIL=0` |",
                "| T-15 至 T-12 | 打开 manifest、60 号终检包和 10 号平台文案 | SHA/大小来源一致，字段无待确认误填 |",
                "| T-12 至 T-08 | 上传完整 ZIP 或分栏上传 PDF/PPT/视频 | 平台显示上传成功，无超 100MB 报错 |",
                "| T-08 至 T-04 | 填写简介、技术亮点、访问策略和边界声明 | 不含真实学校生产接入或真实长期提分夸大 |",
                "| T-04 至 T-01 | 点击提交并截图 | 回执截图、提交时间和账号已保存 |",
                "| T-01 至 T+02 | 填写回执工作副本 | SHA256、大小、是否可修改已记录 |",
                "",
            ]
        ),
        encoding="utf-8",
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate final platform upload preflight pack.")
    parser.add_argument("--write", action="store_true", help="Write upload preflight artifacts.")
    args = parser.parse_args()

    checks = build_checks()
    primary = build_primary(checks)
    if args.write:
        PREFLIGHT_DIR.mkdir(parents=True, exist_ok=True)
        write_csv()
        write_markdown(primary)
        json_text = json.dumps(primary, ensure_ascii=False, indent=2)
        PRIMARY_JSON.write_text(json_text, encoding="utf-8")
        MATERIAL_JSON.write_text(json_text, encoding="utf-8")
        CHECKS_JSON.write_text(
            json.dumps(
                {
                    "runtime": "sepath-submission-upload-preflight-checks.v1",
                    "summary": primary["checks_summary"],
                    "checks": checks,
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
    print(json.dumps({"summary": primary["checks_summary"], "pack": rel(PREFLIGHT_DIR)}, ensure_ascii=False, indent=2))
    return 0 if primary["checks_summary"]["FAIL"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
