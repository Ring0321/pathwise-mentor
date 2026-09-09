from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from validate_public_url_release import template, validate


ROOT = Path(__file__).resolve().parents[1]
MATERIALS = ROOT / "参赛提交材料包"
SUBMISSION = ROOT / "submission"

PLATFORM_COPY = MATERIALS / "10_比赛平台填写文案.md"
LOCAL_SMOKE = ROOT / "sepath-cloud-app" / "qa" / "public-url-validator-local-smoke.json"
VALIDATION_REPORT = SUBMISSION / "public_url_validation_report.json"
RECEIPT_JSON = SUBMISSION / "final_public_url_receipt.json"
RECEIPT_MD = SUBMISSION / "final_public_url_receipt.md"


def load_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def is_public_https_url(url: str) -> bool:
    parsed = urlparse(url)
    host = parsed.hostname or ""
    private_hosts = {"localhost", "127.0.0.1", "0.0.0.0", "::1"}
    return parsed.scheme == "https" and host not in private_hosts and "." in host


def python_invocation() -> str:
    executable = str(Path(sys.executable))
    if " " in executable:
        executable = f'"{executable}"'
    return f"rtk {executable}"


def platform_rows(url: str, status: str) -> dict[str, str]:
    if status == "ready_for_platform":
        return {
            "云端演示地址": url,
            "云端访问说明": (
                "最终公开 URL 已通过机器验收，summary.FAIL=0；评委可匿名打开只读 Demo。"
                "Demo 使用合成样本，不包含真实学生数据、API Key 或生产数据库凭据。"
            ),
        }
    return {
        "云端演示地址": "【待填写：最终公开 URL；未验收前不要填写 owner-only 私有地址】",
        "云端访问说明": (
            "最终公开 URL 待发布和验收；当前可使用公开试用静态包、本地 Demo、视频兜底或 owner-only 私有云现场演示，"
            "不能把私有链接说成公开访问地址。"
        ),
    }


def build_receipt(url: str | None, allow_local: bool = False) -> dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()
    local_smoke = load_json(LOCAL_SMOKE)
    if url:
        validation = validate(url)
        validation_fail = validation.get("summary", {}).get("FAIL")
        public_ok = is_public_https_url(validation.get("url", url)) or allow_local
        status = "ready_for_platform" if validation_fail == 0 and public_ok else "failed_public_url_validation"
        url_value = validation.get("url", url)
    else:
        validation = template()
        public_ok = False
        status = "pending_final_public_url"
        url_value = "PENDING_FINAL_PUBLIC_URL"

    rows = platform_rows(url_value, status)
    return {
        "runtime": "sepath-final-public-url-receipt.v1",
        "generated_at": now,
        "status": status,
        "url": url_value,
        "public_https_required": True,
        "public_https_check": public_ok,
        "validation_report": VALIDATION_REPORT.relative_to(ROOT).as_posix(),
        "receipt_json": RECEIPT_JSON.relative_to(ROOT).as_posix(),
        "receipt_md": RECEIPT_MD.relative_to(ROOT).as_posix(),
        "validation_summary": validation.get("summary", {}),
        "validation_runtime": validation.get("runtime"),
        "local_smoke": {
            "path": LOCAL_SMOKE.relative_to(ROOT).as_posix(),
            "runtime": local_smoke.get("runtime"),
            "summary": local_smoke.get("summary"),
            "source_dir": local_smoke.get("source_dir"),
        },
        "platform_rows": rows,
        "platform_paste_block": [
            f"云端演示地址：{rows['云端演示地址']}",
            f"云端访问说明：{rows['云端访问说明']}",
        ],
        "required_next_command": f"{python_invocation()} scripts/finalize_public_url_receipt.py --url https://your-public-demo.example --write",
        "sync_materials_command": f"{python_invocation()} scripts/finalize_public_url_receipt.py --url https://your-public-demo.example --write --sync-platform-copy",
        "portable_command_note": "If a normal Python executable is already on PATH, the shorter `rtk python ...` form is also acceptable.",
        "truth_boundary": (
            "A ready receipt proves only that the final public read-only demo URL passed the machine URL validator. "
            "It does not prove real school production rollout, real student data access, or causal learning gains."
        ),
        "validation": validation,
    }


def render_markdown(receipt: dict[str, Any]) -> str:
    summary = receipt.get("validation_summary", {})
    local_smoke = receipt.get("local_smoke", {})
    lines = [
        "# 最终公开 URL 回执",
        "",
        f"生成时间：{receipt['generated_at']}",
        f"状态：`{receipt['status']}`",
        f"URL：`{receipt['url']}`",
        "",
        "## 机器验收",
        "",
        f"- 最终 URL 验收：PASS `{summary.get('PASS', 0)}` / FAIL `{summary.get('FAIL', 0)}` / ROWS `{summary.get('rows', 0)}`",
        f"- 公网 HTTPS 检查：`{receipt.get('public_https_check')}`",
        f"- 验收报告：`{receipt['validation_report']}`",
        f"- 本地 URL 烟测：`{local_smoke.get('runtime')}`，summary `{local_smoke.get('summary')}`",
        "",
        "## 比赛平台粘贴块",
        "",
        "```text",
        *receipt["platform_paste_block"],
        "```",
        "",
        "## 使用说明",
        "",
        "没有最终公开 URL 时保留 pending 回执；正式 URL 发布后运行：",
        "",
        "```bash",
        receipt["required_next_command"],
        "```",
        "",
        "如果验收通过且需要同步 `10_比赛平台填写文案.md`，再运行：",
        "",
        "```bash",
        receipt["sync_materials_command"],
        "```",
        "",
        "## 边界",
        "",
        receipt["truth_boundary"],
        "",
    ]
    return "\n".join(lines)


def replace_platform_row(text: str, field: str, value: str) -> str:
    pattern = re.compile(rf"^\| {re.escape(field)} \| .* \|$", re.MULTILINE)
    replacement = f"| {field} | {value} |"
    if not pattern.search(text):
        raise ValueError(f"platform copy row not found: {field}")
    return pattern.sub(replacement, text)


def sync_platform_copy(receipt: dict[str, Any]) -> None:
    if receipt.get("status") != "ready_for_platform":
        raise ValueError("refusing to sync platform copy until the final public URL receipt is ready_for_platform")
    text = PLATFORM_COPY.read_text(encoding="utf-8")
    for field, value in receipt["platform_rows"].items():
        text = replace_platform_row(text, field, value)
    PLATFORM_COPY.write_text(text, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate the final public URL receipt and platform paste block.")
    parser.add_argument("--url", help="Final public demo URL. Must be a public HTTPS URL unless --allow-local is set.")
    parser.add_argument("--template", action="store_true", help="Generate a pending final public URL receipt.")
    parser.add_argument("--allow-local", action="store_true", help="Allow localhost URLs for internal testing only.")
    parser.add_argument("--write", action="store_true", help="Write receipt files under submission/.")
    parser.add_argument("--sync-platform-copy", action="store_true", help="Update 10_比赛平台填写文案.md after URL validation passes.")
    args = parser.parse_args()

    if not args.url and not args.template:
        args.template = True

    receipt = build_receipt(args.url, allow_local=args.allow_local)
    validation = receipt.pop("validation")

    if args.write or args.sync_platform_copy:
        SUBMISSION.mkdir(parents=True, exist_ok=True)
        VALIDATION_REPORT.write_text(json.dumps(validation, ensure_ascii=False, indent=2), encoding="utf-8")
        RECEIPT_JSON.write_text(json.dumps(receipt, ensure_ascii=False, indent=2), encoding="utf-8")
        RECEIPT_MD.write_text(render_markdown(receipt), encoding="utf-8")

    if args.sync_platform_copy:
        sync_platform_copy(receipt)

    print(
        json.dumps(
            {
                "runtime": receipt["runtime"],
                "status": receipt["status"],
                "url": receipt["url"],
                "validation_summary": receipt["validation_summary"],
                "receipt_json": receipt["receipt_json"],
                "receipt_md": receipt["receipt_md"],
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0 if receipt["status"] in {"pending_final_public_url", "ready_for_platform"} else 1


if __name__ == "__main__":
    raise SystemExit(main())
