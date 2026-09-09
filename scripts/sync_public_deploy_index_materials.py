from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
MATERIALS = ROOT / "参赛提交材料包"
PACK_DIR = MATERIALS / "public-deploy-playbook"
PLAYBOOK_JSON = PACK_DIR / "PUBLIC_DEPLOY_PLAYBOOK.json"
SYNC_REPORT = PACK_DIR / "INDEX_SYNC_REPORT.json"

README = MATERIALS / "README_提交材料总览.md"
START_DEMO = MATERIALS / "START_DEMO.md"
REVIEWER_NAV = MATERIALS / "00_评委速读与评分导航.md"

START = "<!-- SEPATH_PUBLIC_DEPLOY_INDEX_START -->"
END = "<!-- SEPATH_PUBLIC_DEPLOY_INDEX_END -->"


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def read_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def read_text(path: Path) -> tuple[str, bool]:
    text = path.read_text(encoding="utf-8-sig")
    raw = path.read_bytes()
    return text, raw.startswith(b"\xef\xbb\xbf")


def write_text(path: Path, text: str, had_bom: bool) -> None:
    payload = ("\ufeff" if had_bom else "") + text
    path.write_text(payload, encoding="utf-8")


def replace_block(text: str, block: str, fallback_anchor: str) -> tuple[str, str]:
    wrapped = f"{START}\n{block.rstrip()}\n{END}"
    if START in text and END in text:
        before = text.split(START, 1)[0].rstrip()
        after = text.split(END, 1)[1].lstrip()
        return f"{before}\n\n{wrapped}\n\n{after}".rstrip() + "\n", "updated"
    if fallback_anchor in text:
        return text.replace(fallback_anchor, f"{fallback_anchor}\n\n{wrapped}", 1).rstrip() + "\n", "inserted"
    return f"{text.rstrip()}\n\n{wrapped}\n", "appended"


def status_text(playbook: dict[str, Any]) -> str:
    status = playbook.get("status", "missing")
    final_url = playbook.get("final_url_status", "missing")
    sha = playbook.get("upload_zip_sha256", "missing")
    return f"当前状态 `{status}`，最终公网 URL 状态 `{final_url}`，公开上传包 SHA256 `{sha}`。"


def readme_block(playbook: dict[str, Any]) -> str:
    return "\n".join(
        [
            "### 公网部署实操与最终 URL 回执",
            "",
            f"- 公网部署实操包：`./70_公网部署实操包与回执封存说明.md`、`./70_公网部署实操包与回执封存说明_机器可读.json`。",
            "- 公网 URL 回填后的正式提交收口：`./71_公网URL回填后的正式提交收口说明.md`、`./71_公网URL回填后的正式提交收口说明_机器可读.json`。",
            "- 公网部署作战目录：`./public-deploy-playbook/`，包含 `PUBLIC_DEPLOY_PLAYBOOK.json`、平台矩阵、提交日清单、URL 回执封存说明、失败恢复卡和 `RUN_DEPLOY_PLAYBOOK.ps1/.cmd`。",
            "- 上传包来源：`./public-site-upload/SE-Path学伴_公开静态站点上传包_v0.1.zip`。",
            f"- 状态摘要：{status_text(playbook)}",
            "- 最终 URL 规则：只有 `submission/final_public_url_receipt.json` 变为 `ready_for_platform` 且 `validation_summary.FAIL=0` 后，才能把公网地址写入比赛平台；随后运行 71 号收口脚本，把 URL、平台文案、正式画像、命名副本和发布门禁统一复核。",
        ]
    )


def start_demo_block(playbook: dict[str, Any]) -> str:
    return "\n".join(
        [
            "## 0A. 公网部署与最终 URL 回执",
            "",
            "如果评审平台要求一个匿名可访问的公网 HTTPS Demo，先打开：",
            "",
            "```text",
            "参赛提交材料包/70_公网部署实操包与回执封存说明.md",
            "参赛提交材料包/71_公网URL回填后的正式提交收口说明.md",
            "参赛提交材料包/public-deploy-playbook/PUBLIC_DEPLOY_PLAYBOOK.json",
            "```",
            "",
            f"{status_text(playbook)}",
            "",
            "部署后必须运行：",
            "",
            "```powershell",
            "rtk python scripts/finalize_public_url_receipt.py --url https://your-public-demo.example --write",
            "rtk python scripts/finalize_public_url_receipt.py --url https://your-public-demo.example --write --sync-platform-copy",
            "rtk python scripts/finalize_submission_after_public_url.py --url https://your-public-demo.example --write --sync-platform-copy",
            "```",
            "",
            "在回执变为 `ready_for_platform` 之前，不要把 `PENDING_FINAL_PUBLIC_URL`、owner-only 私有云、localhost 或历史 Sites 链接写成最终公网地址；正式提交前再用 71 号收口报告确认 URL、平台文案、正式画像、命名副本、发布门禁和一致性检查没有互相打架。",
        ]
    )


def reviewer_nav_block(playbook: dict[str, Any]) -> str:
    return "\n".join(
        [
            "## 0A. 提交前公网发布路线",
            "",
            "| 场景 | 优先打开 | 评委应看到的边界 |",
            "| --- | --- | --- |",
            "| 需要匿名公网 Demo | `70_公网部署实操包与回执封存说明.md` | Netlify、Cloudflare Pages、Vercel、GitHub Pages、学校/Nginx 静态托管路线均可执行；上传包 SHA 可复核 |",
            "| 需要最终 URL 回执 | `public-deploy-playbook/URL_RECEIPT_SEALING.md` | 只有 `final_public_url_receipt.json` 为 `ready_for_platform` 才能写入比赛平台 |",
            "| 需要正式提交收口 | `71_公网URL回填后的正式提交收口说明.md` | URL、平台文案、正式画像、命名副本、发布门禁和一致性检查被同一份机器报告串联 |",
            "| 公网部署失败 | `public-deploy-playbook/FAILURE_RECOVERY.md` | 可快速切换托管平台，不把 owner-only 或历史 Sites 地址说成公网 |",
            "",
            f"状态摘要：{status_text(playbook)}",
        ]
    )


TARGETS = [
    {
        "path": README,
        "anchor": "## 当前阶段包校验结果",
        "builder": readme_block,
    },
    {
        "path": START_DEMO,
        "anchor": "## 1. 推荐演示路径",
        "builder": start_demo_block,
    },
    {
        "path": REVIEWER_NAV,
        "anchor": "## 1. 一句话定位",
        "builder": reviewer_nav_block,
    },
]


def sync(write: bool) -> dict[str, Any]:
    playbook = read_json(PLAYBOOK_JSON)
    rows: list[dict[str, str]] = []
    for target in TARGETS:
        path = target["path"]
        text, had_bom = read_text(path)
        block = target["builder"](playbook)
        new_text, action = replace_block(text, block, target["anchor"])
        changed = new_text != text
        if write and changed:
            write_text(path, new_text, had_bom)
        rows.append(
            {
                "path": rel(path),
                "status": "PASS"
                if "70_公网部署实操包与回执封存说明.md" in new_text
                and "71_公网URL回填后的正式提交收口说明.md" in new_text
                and "public-deploy-playbook" in new_text
                else "FAIL",
                "action": action if changed else "unchanged",
                "contains_public_deploy_material": str("70_公网部署实操包与回执封存说明.md" in new_text),
                "contains_public_closure_material": str("71_公网URL回填后的正式提交收口说明.md" in new_text),
                "contains_public_deploy_pack": str("public-deploy-playbook" in new_text),
            }
        )
    summary = {
        "PASS": sum(1 for row in rows if row["status"] == "PASS"),
        "FAIL": sum(1 for row in rows if row["status"] == "FAIL"),
        "rows": len(rows),
    }
    report = {
        "runtime": "sepath-public-deploy-index-sync.v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "playbook": rel(PLAYBOOK_JSON),
        "playbook_status": playbook.get("status"),
        "final_url_status": playbook.get("final_url_status"),
        "summary": summary,
        "rows": rows,
        "truth_boundary": "This sync only updates judge-facing index pointers. It does not claim the final public URL is deployed.",
    }
    if write:
        PACK_DIR.mkdir(parents=True, exist_ok=True)
        SYNC_REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync public deploy playbook pointers into judge-facing index materials.")
    parser.add_argument("--write", action="store_true", help="Write index materials and sync report.")
    args = parser.parse_args()
    report = sync(args.write)
    print(json.dumps({"runtime": report["runtime"], "summary": report["summary"], "report": rel(SYNC_REPORT)}, ensure_ascii=False, indent=2))
    return 0 if report["summary"]["FAIL"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
