from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
MATERIALS = ROOT / "参赛提交材料包"
SUBMISSION = ROOT / "submission"
OUTPUT_MD = MATERIALS / "45_提交日人工确认决策卡.md"
OUTPUT_JSON = MATERIALS / "45_提交日人工确认决策卡_机器可读.json"

PACKAGE_MANIFEST = SUBMISSION / "SE-Path学伴_阶段提交包_v0.4_2026-08-09_manifest.json"
AUDIT_JSON = MATERIALS / "09_提交前终审报告_机器可读.json"
RELEASE_GATE_JSON = ROOT / "outputs" / "SE-Path学伴_最终发布门禁报告_机器生成.json"


MANUAL_GATES = [
    {
        "id": "team-naming",
        "label": "队伍名与文件命名",
        "decision_owner": "参赛队负责人",
        "must_decide": "报名平台上的最终队伍名、作品名，以及是否要求文件名使用“队伍名+作品名”。",
        "safe_options": [
            "未确定时保持阶段包原名，不改动源文件。",
            "确定后先填写正式提交画像，再运行正式命名脚本生成副本、上传说明和 SHA256 manifest。",
        ],
        "acceptance_criteria": "正式命名副本与报名平台队伍名逐字一致，manifest 中每个文件都有 SHA256，且原始阶段包仍保留。",
        "command": 'rtk python scripts/prepare_final_named_submission.py --profile "submission/final_submission_profile.json" --write',
    },
    {
        "id": "member-profile",
        "label": "队员信息准确性",
        "decision_owner": "全体队员",
        "must_decide": "姓名、学校、专业、联系方式和排序，以报名系统和真实证件信息为准。",
        "safe_options": [
            "平台填写前保留【待填写】占位。",
            "成员逐人确认后再复制到平台文案和封面。",
        ],
        "acceptance_criteria": "无未授权成员、无错别字、无虚构经历、无与报名平台不一致的信息。",
        "command": "打开 参赛提交材料包/10_比赛平台填写文案.md，替换【待填写】字段。",
    },
    {
        "id": "access-policy",
        "label": "公开视频/私有云访问策略",
        "decision_owner": "提交负责人",
        "must_decide": "正式提交时使用公开静态包、owner-only 私有云、本地 Demo、视频兜底，还是额外提供演示账号。",
        "safe_options": [
            "优先提交公开试用静态包，保证无需登录可打开。",
            "私有云保持 owner-only 时，明确写明这是访问控制生效，不把私有链接冒充公开地址。",
            "若主办方要求在线公开访问，再按平台要求切换权限或部署公开副本。",
        ],
        "acceptance_criteria": "评委至少有一条无需队伍现场协助也能复核的访问路线，且不暴露真实密钥或学生数据。",
        "command": "公开 URL 发布后运行 rtk python scripts/finalize_public_url_receipt.py --url <最终URL> --write；未发布前打开 16_公开试用发布包与云端迁移手册.md 和 64_最终公开URL验收器与回执模板.md。",
    },
    {
        "id": "voiceover-video",
        "label": "真人旁白版视频",
        "decision_owner": "路演负责人",
        "must_decide": "提交字幕素材版，还是叠加真人旁白后提交新版 MP4。",
        "safe_options": [
            "当前 4分40秒字幕素材版可直接提交。",
            "如录制真人旁白，必须完整重看，确认无口误、无夸大真实试点效果、无超时。",
        ],
        "acceptance_criteria": "视频时长仍在 3-5 分钟内，画面清晰，旁白不宣称未验证事实。",
        "command": "打开 参赛提交材料包/演示视频素材/旁白录制检查清单.md。",
    },
    {
        "id": "real-course-claim",
        "label": "真实课程效果声明",
        "decision_owner": "答辩主讲人",
        "must_decide": "所有材料和口头答辩都只声明已验证的合成回放、工程闭环和可试点能力。",
        "safe_options": [
            "可以说：已完成可运行 Demo、可上云、可审计、可接入真实课程试点。",
            "可以说：当前用合成样本和确定性回放验证策略优势。",
            "不能说：已经在真实学校显著提分、已经完成长期因果验证。",
        ],
        "acceptance_criteria": "平台文案、PPT、视频旁白、答辩口径均不包含未验证真实提分或真实学校接入。",
        "command": "打开 参赛提交材料包/05_真实性与边界声明.md 和 33_试点遥测与效果验证中心说明.md。",
    },
]


def load_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def extract_manual_rows(audit: dict[str, Any]) -> list[dict[str, Any]]:
    rows = audit.get("rows", [])
    return [row for row in rows if row.get("status") == "MANUAL"]


def build_card() -> dict[str, Any]:
    package = load_json(PACKAGE_MANIFEST)
    audit = load_json(AUDIT_JSON)
    release = load_json(RELEASE_GATE_JSON)
    release_summary = release.get("summary", {})
    generated_at = datetime.now(timezone.utc).isoformat()
    manual_rows = extract_manual_rows(audit)
    return {
        "generated_at": generated_at,
        "title": "SE-Path 学伴提交日人工确认决策卡",
        "package": {
            "path": (SUBMISSION / str(package.get("package", ""))).relative_to(ROOT).as_posix() if package.get("package") else "",
            "manifest_path": PACKAGE_MANIFEST.relative_to(ROOT).as_posix(),
            "size_bytes": "see submission manifest after final ZIP sealing",
            "sha256": "see submission manifest and release gate after final ZIP sealing",
            "file_count": "see submission manifest after final ZIP sealing",
            "zip_integrity": package.get("checks", {}).get("zip_integrity"),
            "secret_scan_hits": package.get("checks", {}).get("secret_scan_hits"),
            "metadata_scope": "本决策卡不嵌入易变化的最终 ZIP 大小、文件数或 SHA256；正式提交时以 submission manifest 和 release gate 输出为准。",
        },
        "release_gate": {
            "status": release_summary.get("release_gate"),
            "command_failures": release_summary.get("command_failures"),
            "audit_summary": audit.get("summary") or release_summary.get("audit_summary"),
            "screenshots_skipped": release_summary.get("screenshots_skipped"),
            "metadata_scope": "读取最近一次 release gate 输出；正式提交前以当前运行的 release_gate.py 终端输出和 outputs 报告为准。",
        },
        "manual_rows_from_audit": manual_rows,
        "manual_gates": MANUAL_GATES,
        "submit_order": [
            "先上传完整阶段提交 ZIP。",
            "若平台分栏，再上传项目计划书 PDF、演示视频、答辩 PPT。",
            "把 10_比赛平台填写文案.md 中已确认字段复制到平台。",
            "若填写公网演示地址，先确认 final_public_url_receipt.json 的 status=ready_for_platform。",
            "把云端访问策略写清楚：公开静态包、私有云、本地 Demo、视频兜底分别是什么。",
            "提交后保存平台回执截图、提交时间和最终 ZIP SHA256。",
        ],
        "safe_one_sentence": "SE-Path 学伴已经完成可运行、可上云、可审计的闭环 Demo 与参赛材料包；真实课程长期提分仍需后续试点数据验证。",
        "forbidden_claims": [
            "不能宣称已经接入真实学校生产系统。",
            "不能宣称已经验证真实班级长期成绩提升。",
            "不能把 owner-only 私有链接说成公开访问地址。",
            "不能把开源参考项目说成复制或自研其全部能力。",
            "不能把合成学生数据说成真实学生数据。",
        ],
        "commands": [
            "rtk python scripts/release_gate.py",
            "rtk python scripts/generate_final_submission_decision_card.py --write",
            "rtk python scripts/finalize_public_url_receipt.py --template --write",
            "rtk python scripts/finalize_public_url_receipt.py --url https://your-public-demo.example --write",
            'Copy-Item "参赛提交材料包/54_正式提交画像配置模板.json" "submission/final_submission_profile.json"',
            'rtk python scripts/prepare_final_named_submission.py --profile "submission/final_submission_profile.json" --dry-run',
            'rtk python scripts/prepare_final_named_submission.py --profile "submission/final_submission_profile.json" --write',
            'rtk python scripts/prepare_final_named_submission.py --team-name "队伍名" --work-name "SE-Path学伴" --dry-run',
            'rtk python scripts/prepare_final_named_submission.py --team-name "队伍名" --work-name "SE-Path学伴" --write',
            "Get-Content submission/final_named/*_manifest.json",
        ],
    }


def render_markdown(card: dict[str, Any]) -> str:
    package = card["package"]
    release = card["release_gate"]
    audit_summary = release.get("audit_summary") or {}
    lines = [
        "# 45 提交日人工确认决策卡",
        "",
        f"生成时间：{card['generated_at']}",
        "",
        "这张卡用于正式提交前最后 20 分钟。它只整理已验证证据和必须由参赛队确认的事实，不替队伍编造报名信息、访问策略或真实课程效果。",
        "",
        "## 1. 当前机器证据",
        "",
        f"- Release gate：`{release.get('status')}`",
        f"- 命令失败数：`{release.get('command_failures')}`",
        f"- 自动审计：PASS `{audit_summary.get('PASS')}` / WARN `{audit_summary.get('WARN')}` / FAIL `{audit_summary.get('FAIL')}` / MANUAL `{audit_summary.get('MANUAL')}`",
        f"- 截图 QA 是否跳过：`{release.get('screenshots_skipped')}`",
        f"- Release gate 口径：{release.get('metadata_scope')}",
        f"- 阶段包：`{package.get('path')}`",
        f"- 阶段包 manifest：`{package.get('manifest_path')}`",
        f"- 阶段包大小：`{package.get('size_bytes')}`",
        f"- 阶段包文件数：`{package.get('file_count')}`",
        f"- 阶段包 SHA256：`{package.get('sha256')}`",
        f"- ZIP 完整性：`{package.get('zip_integrity')}`",
        f"- 敏感信息扫描：`{package.get('secret_scan_hits')}`",
        f"- 元数据口径：{package.get('metadata_scope')}",
        "",
        "## 2. 五个人工门禁",
        "",
        "| 人工项 | 负责人 | 必须确认 | 可接受策略 | 通过标准 | 命令/材料 |",
        "| --- | --- | --- | --- | --- | --- |",
    ]
    for gate in card["manual_gates"]:
        options = "<br>".join(gate["safe_options"])
        lines.append(
            "| "
            + " | ".join(
                [
                    gate["label"],
                    gate["decision_owner"],
                    gate["must_decide"],
                    options,
                    gate["acceptance_criteria"],
                    f"`{gate['command']}`",
                ]
            )
            + " |"
        )
    lines.extend(
        [
            "",
            "## 3. 提交顺序",
            "",
        ]
    )
    for index, item in enumerate(card["submit_order"], 1):
        lines.append(f"{index}. {item}")
    lines.extend(
        [
            "",
            "## 4. 一句话安全口径",
            "",
            card["safe_one_sentence"],
            "",
            "## 5. 禁止口径",
            "",
        ]
    )
    for item in card["forbidden_claims"]:
        lines.append(f"- {item}")
    lines.extend(
        [
            "",
            "## 6. 可直接运行命令",
            "",
            "```bash",
            *card["commands"],
            "```",
            "",
        ]
    )
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate the final manual decision card for competition submission day.")
    parser.add_argument("--write", action="store_true", help="Write markdown and machine-readable JSON outputs.")
    args = parser.parse_args()

    card = build_card()
    if args.write:
        OUTPUT_MD.write_text(render_markdown(card), encoding="utf-8")
        OUTPUT_JSON.write_text(json.dumps(card, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(card, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
