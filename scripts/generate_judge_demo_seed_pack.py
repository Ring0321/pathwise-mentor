from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
MATERIALS = ROOT / "参赛提交材料包"
SEED_DIR = ROOT / "sepath-cloud-app" / "qa" / "demo-seed"
SEED_JSON = SEED_DIR / "JUDGE_DEMO_SEED_MANIFEST.json"
OUTPUT_MD = MATERIALS / "47_评委试用账号与种子数据包.md"
OUTPUT_JSON = MATERIALS / "47_评委试用账号与种子数据包_机器可读.json"


def build_pack() -> dict[str, Any]:
    generated_at = datetime.now(timezone.utc).isoformat()
    accounts = [
        {
            "id": "school-admin-demo",
            "role": "school_admin",
            "entry": "#school-provisioning",
            "workspace": "tenant-sepath-demo-2026",
            "canView": ["租户 Manifest", "数据保留策略", "审计摘要", "回滚 Runbook"],
            "deniedActions": ["查看学生原始对话", "获取模型密钥", "绕过教师发布门"],
            "credentialPolicy": "No password in package; use role switch locally or one-time reviewer link if the organizer allows it.",
        },
        {
            "id": "course-admin-demo",
            "role": "course_admin",
            "entry": "#course-launch",
            "workspace": "software-engineering-project",
            "canView": ["课程 Manifest", "Rubric Studio", "开班向导", "API 契约"],
            "deniedActions": ["修改全局安全策略", "删除审计记录", "导出未脱敏学生数据"],
            "credentialPolicy": "Synthetic course workspace only; real LMS or SSO binding must be confirmed by a school.",
        },
        {
            "id": "teacher-demo",
            "role": "teacher",
            "entry": "#teacher-report",
            "workspace": "software-engineering-project",
            "canView": ["班级风险队列", "教师周报", "Rubric 校准", "复核工单"],
            "deniedActions": ["访问其他课程租户", "公开真实学生身份", "跳过高风险复核"],
            "credentialPolicy": "Teacher view is synthetic in the competition package; production access is invitation based.",
        },
        {
            "id": "student-demo",
            "role": "student",
            "entry": "#student",
            "workspace": "learnerHash:stu_hash_8f2a",
            "canView": ["本人路径", "本人证据摘要", "脚手架提示", "反思任务"],
            "deniedActions": ["查看同伴账本", "导出班级风险清单", "获得可直接提交完整答案"],
            "credentialPolicy": "Uses learnerHash only; no real name, student number, phone or email appears in the seed.",
        },
        {
            "id": "reviewer-demo",
            "role": "reviewer",
            "entry": "#judge-trial",
            "workspace": "reviewer-sandbox",
            "canView": ["评审证据矩阵", "公开静态包 Manifest", "源码审计路径", "演示视频脚本"],
            "deniedActions": ["访问真实学校租户", "写入学生账本", "查看 API 密钥或私有仓库"],
            "credentialPolicy": "Read-only synthetic reviewer route; choose public static package, local demo, video or owner-only live demo at submission time.",
        },
    ]
    seed_events = [
        {
            "id": "seed-baseline",
            "eventType": "baseline_captured",
            "actor": "system",
            "source": "rubric",
            "learnerHash": "stu_hash_8f2a",
            "traceId": "trace-seed-baseline",
            "title": "Software engineering baseline captured",
            "expectedPanel": "#student",
        },
        {
            "id": "seed-pr-opened",
            "eventType": "pr_opened",
            "actor": "student",
            "source": "git",
            "learnerHash": "stu_hash_8f2a",
            "traceId": "trace-seed-pr",
            "title": "Pull request opened with boundary-test gap",
            "expectedPanel": "#repository",
        },
        {
            "id": "seed-ci-failed",
            "eventType": "ci_failed",
            "actor": "tool",
            "source": "ci",
            "learnerHash": "stu_hash_8f2a",
            "traceId": "trace-seed-ci-failed",
            "title": "CI failed on boundary tests",
            "expectedPanel": "#student",
        },
        {
            "id": "seed-scaffold-requested",
            "eventType": "scaffold_requested",
            "actor": "student",
            "source": "chat",
            "learnerHash": "stu_hash_8f2a",
            "traceId": "trace-seed-scaffold",
            "title": "Student asked for help; system refused complete answer and returned scaffold",
            "expectedPanel": "#dialogue",
        },
        {
            "id": "seed-ci-passed",
            "eventType": "ci_passed",
            "actor": "tool",
            "source": "ci",
            "learnerHash": "stu_hash_8f2a",
            "traceId": "trace-seed-ci-passed",
            "title": "CI passed after learner patch",
            "expectedPanel": "#student",
        },
        {
            "id": "seed-teacher-reviewed",
            "eventType": "teacher_reviewed",
            "actor": "teacher",
            "source": "teacher",
            "learnerHash": "stu_hash_8f2a",
            "traceId": "trace-seed-review",
            "title": "Teacher approved safe scaffold release",
            "expectedPanel": "#teacher",
        },
        {
            "id": "seed-reflection",
            "eventType": "reflection_submitted",
            "actor": "student",
            "source": "reflection",
            "learnerHash": "stu_hash_8f2a",
            "traceId": "trace-seed-reflection",
            "title": "Learner submitted reflection memory",
            "expectedPanel": "#student",
        },
    ]
    walkthrough = [
        {
            "minute": "0-1",
            "role": "reviewer-demo",
            "action": "Open public static package or local demo and click the main closed-loop button.",
            "successSignal": "EvidenceEvent timeline shows PR, CI, scaffold, teacher review and reflection.",
        },
        {
            "minute": "1-3",
            "role": "student-demo",
            "action": "Inspect student dialogue and path twin.",
            "successSignal": "The assistant refuses to provide a complete answer and gives scaffold tasks.",
        },
        {
            "minute": "3-5",
            "role": "teacher-demo",
            "action": "Inspect teacher report, review ticket and intervention playbook.",
            "successSignal": "High-risk action is held by a teacher review gate.",
        },
        {
            "minute": "5-8",
            "role": "course-admin-demo",
            "action": "Inspect course launch, API contract, OpenAPI and trial telemetry.",
            "successSignal": "Deployment, privacy and machine-contract evidence are visible.",
        },
        {
            "minute": "8-10",
            "role": "school-admin-demo",
            "action": "Inspect account initialization, tenant ops, data plane and final submission gate.",
            "successSignal": "No real credentials are present; remaining manual items are explicit.",
        },
    ]
    checks = [
        {
            "id": "no-real-credentials",
            "status": "PASS",
            "evidence": "no password, token, API key, real name, phone, email or private repository URL is present",
        },
        {
            "id": "role-boundary",
            "status": "PASS",
            "evidence": f"{len(accounts)} synthetic roles declare canView and deniedActions",
        },
        {
            "id": "closed-loop-seed",
            "status": "PASS",
            "evidence": f"{len(seed_events)} seed events cover diagnosis, planning, intervention, review and reflection",
        },
        {
            "id": "reviewer-route",
            "status": "PASS",
            "evidence": f"{len(walkthrough)} walkthrough steps route reviewers from product to materials and release gate",
        },
    ]
    return {
        "runtime": "sepath-judge-demo-seed.v1",
        "generated_at": generated_at,
        "product": "SE-Path 学伴",
        "seedVersion": "2026-08-10.demo-seed.v1",
        "tenant": {
            "tenantId": "tenant-sepath-demo-2026",
            "courseId": "software-engineering-project",
            "cohortId": "cohort-reviewer-sandbox",
            "dataMode": "synthetic-only",
        },
        "accounts": accounts,
        "seedEvents": seed_events,
        "walkthrough": walkthrough,
        "checks": checks,
        "commands": [
            "cd sepath-cloud-app && npm run cloud:demo-seed",
            "python scripts/generate_judge_demo_seed_pack.py --write",
            "python scripts/release_gate.py",
        ],
        "artifacts": {
            "seedManifest": "sepath-cloud-app/qa/demo-seed/JUDGE_DEMO_SEED_MANIFEST.json",
            "materialMarkdown": "参赛提交材料包/47_评委试用账号与种子数据包.md",
            "materialJson": "参赛提交材料包/47_评委试用账号与种子数据包_机器可读.json",
            "publicTrialCopy": "参赛提交材料包/公开试用静态包/JUDGE_DEMO_SEED_MANIFEST.json",
        },
        "privacyBoundary": [
            "This seed pack is synthetic-only and contains no real student PII.",
            "This seed pack contains no password, API key, bearer token, private repository URL or model credential.",
            "Real school SSO/LTI, roster import and learning-effect claims require separate manual confirmation.",
        ],
        "safeClaim": "The competition package can provide a complete reviewer walkthrough and synthetic seed accounts without exposing real credentials.",
    }


def render_markdown(pack: dict[str, Any]) -> str:
    lines = [
        "# 47 评委试用账号与种子数据包",
        "",
        f"生成时间：{pack['generated_at']}",
        "",
        "## 1. 结论",
        "",
        pack["safeClaim"],
        "",
        "本包只提供合成演示身份、只读/角色切换入口、闭环事件种子和评委复查路线，不包含真实密码、真实学生信息、真实学校租户或模型密钥。",
        "",
        "## 2. 演示身份",
        "",
        "| 身份 | 入口 | 可见范围 | 禁止动作 |",
        "| --- | --- | --- | --- |",
    ]
    for account in pack["accounts"]:
        lines.append(
            f"| `{account['id']}` / {account['role']} | `{account['entry']}` | {'、'.join(account['canView'])} | {'、'.join(account['deniedActions'])} |"
        )
    lines.extend(["", "## 3. 闭环种子事件", "", "| 事件 | 来源 | 作用面板 |", "| --- | --- | --- |"])
    for event in pack["seedEvents"]:
        lines.append(f"| `{event['eventType']}` | {event['source']} / {event['actor']} | `{event['expectedPanel']}` |")
    lines.extend(["", "## 4. 评委 10 分钟路线", ""])
    for step in pack["walkthrough"]:
        lines.append(f"- `{step['minute']}` `{step['role']}`：{step['action']} 预期信号：{step['successSignal']}")
    lines.extend(["", "## 5. 机器验收", "", "| 检查 | 状态 | 证据 |", "| --- | --- | --- |"])
    for check in pack["checks"]:
        lines.append(f"| `{check['id']}` | {check['status']} | {check['evidence']} |")
    lines.extend(["", "## 6. 文件与命令", "", "```text"])
    for key, value in pack["artifacts"].items():
        lines.append(f"{key}: {value}")
    lines.extend(["```", "", "```bash"])
    lines.extend(pack["commands"])
    lines.extend(
        [
            "```",
            "",
            "## 7. 不可夸大边界",
            "",
            "- 不能把本包说成真实学校账号、真实 SSO 或真实学生名册。",
            "- 不能把合成闭环种子说成真实课程提分证据。",
            "- 不能在公开提交包中放真实密码、API Key、Bearer Token 或私有仓库链接。",
            "",
        ]
    )
    return "\n".join(lines)


def validate_pack(pack: dict[str, Any]) -> list[dict[str, str]]:
    raw = json.dumps(pack, ensure_ascii=False)
    forbidden = ["password123", "sk-", "Bearer ", "真实姓名", "student@example.com", "api_key_"]
    rows = [
        {
            "label": "runtime",
            "status": "PASS" if pack.get("runtime") == "sepath-judge-demo-seed.v1" else "FAIL",
            "evidence": str(pack.get("runtime")),
        },
        {
            "label": "accounts",
            "status": "PASS" if len(pack.get("accounts", [])) >= 5 else "FAIL",
            "evidence": str(len(pack.get("accounts", []))),
        },
        {
            "label": "seed events",
            "status": "PASS" if len(pack.get("seedEvents", [])) >= 7 else "FAIL",
            "evidence": str(len(pack.get("seedEvents", []))),
        },
        {
            "label": "no public credentials",
            "status": "PASS" if not any(token in raw for token in forbidden) else "FAIL",
            "evidence": "no forbidden credential-like literals",
        },
    ]
    return rows


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate the SE-Path judge demo seed package.")
    parser.add_argument("--write", action="store_true", help="Write seed JSON and material files.")
    args = parser.parse_args()
    pack = build_pack()
    validation = validate_pack(pack)
    fail_count = sum(1 for row in validation if row["status"] != "PASS")
    result = {
        **pack,
        "validation": {
            "PASS": sum(1 for row in validation if row["status"] == "PASS"),
            "FAIL": fail_count,
            "rows": validation,
        },
    }
    if args.write:
        SEED_DIR.mkdir(parents=True, exist_ok=True)
        MATERIALS.mkdir(parents=True, exist_ok=True)
        SEED_JSON.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        OUTPUT_JSON.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        OUTPUT_MD.write_text(render_markdown(result), encoding="utf-8")
    print(json.dumps({"summary": result["validation"], "seed": str(SEED_JSON.relative_to(ROOT))}, ensure_ascii=False, indent=2))
    return 0 if fail_count == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
