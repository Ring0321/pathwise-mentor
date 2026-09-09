from __future__ import annotations

import argparse
import json
import re
import ssl
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urljoin


ROOT = Path(__file__).resolve().parents[1]
MATERIALS = ROOT / "参赛提交材料包"
SUBMISSION = ROOT / "submission"
REPORT = SUBMISSION / "public_url_validation_report.json"

KEYWORDS = [
    "SE-Path",
    "SafeVOI",
    "EvidenceEvent",
    "主张证据账本",
    "学习增值",
    "评委",
    "不能宣称",
    "sepath-hosting-selftest-center.v1",
    "hosting-selftest",
]

STATIC_FILES = [
    "manifest.webmanifest",
    "sw.js",
    "offline.html",
    "PUBLIC_TRIAL_MANIFEST.json",
    "PUBLIC_HEALTH.json",
    "PUBLIC_RELEASE.json",
    "REVIEWER_DRILL_REPORT.json",
    "JUDGE_DEMO_SEED_MANIFEST.json",
    "reviewer-guide-overlay.png",
    "reviewer-guide-claim-ledger.png",
]


def fetch(url: str, timeout: int = 20) -> tuple[int | None, bytes, str]:
    request = urllib.request.Request(url, headers={"User-Agent": "SE-Path-public-url-validator/1.0"})
    context = ssl.create_default_context()
    try:
        with urllib.request.urlopen(request, timeout=timeout, context=context) as response:
            return response.status, response.read(), ""
    except urllib.error.HTTPError as exc:
        try:
            body = exc.read()
        except Exception:
            body = b""
        return exc.code, body, str(exc.reason)
    except Exception as exc:
        return None, b"", str(exc)


def row(check_id: str, passed: bool, evidence: str, url: str = "") -> dict[str, str]:
    return {
        "id": check_id,
        "status": "PASS" if passed else "FAIL",
        "evidence": evidence,
        "url": url,
    }


def summarize(rows: list[dict[str, str]]) -> dict[str, int]:
    return {
        "PASS": sum(1 for item in rows if item["status"] == "PASS"),
        "FAIL": sum(1 for item in rows if item["status"] == "FAIL"),
        "rows": len(rows),
    }


def asset_urls(base_url: str, html: str) -> list[str]:
    urls: list[str] = []
    for attr in ("src", "href"):
        for match in re.finditer(rf'{attr}=["\']([^"\']+)["\']', html):
            value = match.group(1)
            if value.startswith("data:") or value.startswith("#"):
                continue
            if value.endswith((".js", ".css")) or "/assets/" in value:
                urls.append(urljoin(base_url, value))
    return sorted(set(urls))


def validate(url: str) -> dict[str, Any]:
    base_url = url.rstrip("/") + "/"
    rows: list[dict[str, str]] = []
    rows.append(row("public-url-provided", base_url.startswith(("https://", "http://")), base_url, base_url))

    status, body, error = fetch(base_url)
    html = body.decode("utf-8", errors="replace")
    rows.append(row("root-http-ok", status is not None and 200 <= status < 400, f"status={status} error={error}", base_url))
    rows.append(row("root-html-nonempty", len(html) > 200 and ("root" in html or "assets/" in html), f"bytes={len(body)}", base_url))

    assets = asset_urls(base_url, html)
    js_assets = [item for item in assets if item.endswith(".js")]
    css_assets = [item for item in assets if item.endswith(".css")]
    rows.append(row("js-asset-discovered", bool(js_assets), " / ".join(js_assets[:3]) or "missing", base_url))
    rows.append(row("css-asset-discovered", bool(css_assets), " / ".join(css_assets[:3]) or "missing", base_url))

    combined_text = html
    for asset_url in assets:
        asset_status, asset_body, asset_error = fetch(asset_url)
        rows.append(row(f"asset:{asset_url.rsplit('/', 1)[-1]}", asset_status is not None and 200 <= asset_status < 400, f"status={asset_status} bytes={len(asset_body)} error={asset_error}", asset_url))
        if asset_url.endswith(".js") or asset_url.endswith(".css"):
            combined_text += "\n" + asset_body.decode("utf-8", errors="replace")

    static_payloads: dict[str, bytes] = {}
    for path in STATIC_FILES:
        file_url = urljoin(base_url, path)
        file_status, file_body, file_error = fetch(file_url)
        file_ok = file_status is not None and 200 <= file_status < 400
        rows.append(row(f"static:{path}", file_ok, f"status={file_status} bytes={len(file_body)} error={file_error}", file_url))
        if file_ok:
            static_payloads[path] = file_body

    try:
        health = json.loads(static_payloads.get("PUBLIC_HEALTH.json", b"{}").decode("utf-8", errors="replace"))
    except json.JSONDecodeError:
        health = {}
    try:
        release = json.loads(static_payloads.get("PUBLIC_RELEASE.json", b"{}").decode("utf-8", errors="replace"))
    except json.JSONDecodeError:
        release = {}
    rows.append(
        row(
            "public-health-runtime",
            health.get("runtime") == "sepath-public-health.v1"
            and health.get("status") == "ready_for_public_static_review"
            and health.get("public_url_status") in {"pending_external_public_url_validation", "ready_for_platform"},
            f"runtime={health.get('runtime')} status={health.get('status')} public_url_status={health.get('public_url_status')}",
            urljoin(base_url, "PUBLIC_HEALTH.json"),
        )
    )
    rows.append(
        row(
            "public-health-privacy-boundary",
            "Synthetic demo data" in str(health.get("privacy_boundary", ""))
            and "PUBLIC_RELEASE.json" in health.get("required_static_files", []),
            str(health.get("privacy_boundary", ""))[:180],
            urljoin(base_url, "PUBLIC_HEALTH.json"),
        )
    )
    rows.append(
        row(
            "public-release-runtime",
            release.get("runtime") == "sepath-public-release.v1"
            and release.get("release_channel") == "competition-public-static"
            and "post_deploy_validation_command" in release,
            f"runtime={release.get('runtime')} channel={release.get('release_channel')}",
            urljoin(base_url, "PUBLIC_RELEASE.json"),
        )
    )
    rows.append(
        row(
            "public-release-claim-boundary",
            "real student data" in str(release.get("truth_boundary", ""))
            and len(release.get("innovation_claims", [])) >= 5,
            f"claims={len(release.get('innovation_claims', []))} boundary={str(release.get('truth_boundary', ''))[:120]}",
            urljoin(base_url, "PUBLIC_RELEASE.json"),
        )
    )

    missing_keywords = [keyword for keyword in KEYWORDS if keyword not in combined_text]
    rows.append(row("key-product-copy", not missing_keywords, "missing=" + ",".join(missing_keywords), base_url))
    rows.append(row("https-or-localhost", base_url.startswith("https://") or "localhost" in base_url or "127.0.0.1" in base_url, base_url, base_url))

    return {
        "runtime": "sepath-public-url-validation.v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "url": base_url,
        "summary": summarize(rows),
        "rows": rows,
        "evidence_scope": "public URL smoke test; does not prove real school production rollout",
        "truth_boundary": "A passing public URL check proves the submitted read-only demo is reachable and contains required SE-Path assets. It does not prove authenticated production deployment or real-course learning gains.",
    }


def template() -> dict[str, Any]:
    return {
        "runtime": "sepath-public-url-validation.v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "url": "PENDING_FINAL_PUBLIC_URL",
        "summary": {"PASS": 0, "FAIL": 0, "rows": 0},
        "required_command": "rtk python scripts/validate_public_url_release.py --url https://your-public-demo.example --write",
        "expected_checks": [
            "root-http-ok",
            "js-asset-discovered",
            "css-asset-discovered",
            "manifest.webmanifest",
            "sw.js",
            "offline.html",
            "PUBLIC_HEALTH.json",
            "PUBLIC_RELEASE.json",
            "REVIEWER_DRILL_REPORT.json",
            "reviewer-guide-claim-ledger.png",
            "public-health-runtime",
            "public-release-runtime",
            "key-product-copy",
        ],
        "submission_policy": "Run after the final public URL is chosen. Keep this template when no public URL has been selected yet.",
        "truth_boundary": "Do not claim latest cloud deployment until this report is regenerated with a real reachable URL.",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate the final public SE-Path demo URL.")
    parser.add_argument("--url", help="Final public demo URL to validate.")
    parser.add_argument("--write", action="store_true", help="Write submission/public_url_validation_report.json.")
    parser.add_argument("--template", action="store_true", help="Write a pending public URL validation template.")
    args = parser.parse_args()

    if args.template or not args.url:
        report = template()
        exit_code = 0
    else:
        report = validate(args.url)
        exit_code = 0 if report["summary"]["FAIL"] == 0 else 1

    if args.write or args.template:
        REPORT.parent.mkdir(parents=True, exist_ok=True)
        REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps(report if args.url else {"summary": report["summary"], "url": report["url"], "required_command": report["required_command"]}, ensure_ascii=False, indent=2))
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
