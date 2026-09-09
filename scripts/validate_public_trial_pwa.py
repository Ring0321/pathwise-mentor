from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
TRIAL = ROOT / "参赛提交材料包" / "公开试用静态包"
REPORT = ROOT / "sepath-cloud-app" / "qa" / "public-trial-pwa-validation.json"


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8") if path.exists() else ""


def row(label: str, passed: bool, evidence: str, path: Path) -> dict[str, Any]:
    return {
        "label": label,
        "status": "PASS" if passed else "FAIL",
        "evidence": evidence,
        "path": path.relative_to(ROOT).as_posix() if path.exists() or path.is_absolute() else str(path),
    }


def load_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def bundle_contains(*needles: str) -> bool:
    texts = []
    for path in TRIAL.rglob("*"):
        if path.is_file() and path.suffix.lower() in {".html", ".js", ".css", ".json", ".md"}:
            texts.append(path.read_text(encoding="utf-8", errors="ignore"))
    joined = "\n".join(texts)
    return all(needle in joined for needle in needles)


def validate() -> dict[str, Any]:
    index = TRIAL / "index.html"
    webmanifest = TRIAL / "manifest.webmanifest"
    service_worker = TRIAL / "sw.js"
    offline = TRIAL / "offline.html"
    public_manifest = TRIAL / "PUBLIC_TRIAL_MANIFEST.json"
    public_health = TRIAL / "PUBLIC_HEALTH.json"
    public_release = TRIAL / "PUBLIC_RELEASE.json"
    seed_manifest = TRIAL / "JUDGE_DEMO_SEED_MANIFEST.json"
    reviewer_report = TRIAL / "REVIEWER_DRILL_REPORT.json"
    guide_screenshot = TRIAL / "reviewer-guide-overlay.png"
    guide_claim_ledger_screenshot = TRIAL / "reviewer-guide-claim-ledger.png"
    public_url_receipt_screenshot = TRIAL / "public-url-receipt-panel.png"
    submission_closure_screenshot = TRIAL / "submission-closure-panel.png"
    icon = TRIAL / "pwa-icon.svg"
    maskable_icon = TRIAL / "maskable-icon.svg"

    index_text = read_text(index)
    sw_text = read_text(service_worker)
    manifest = load_json(webmanifest)
    public_trial = load_json(public_manifest)
    health = load_json(public_health)
    release = load_json(public_release)
    reviewer_drill = load_json(reviewer_report)
    public_files = {str(item.get("path")) for item in public_trial.get("files", [])}
    pwa = public_trial.get("pwa", {})
    reviewer_guide = public_trial.get("reviewer_guide", {})
    guided_tour = reviewer_drill.get("guidedTour", {})

    required_files = [
        index,
        webmanifest,
        service_worker,
        offline,
        public_manifest,
        public_health,
        public_release,
        seed_manifest,
        icon,
        maskable_icon,
    ]

    rows = [
        row(
            "required pwa files",
            all(path.exists() and path.stat().st_size > 100 for path in required_files),
            ", ".join(path.name for path in required_files if path.exists()),
            TRIAL,
        ),
        row(
            "index manifest link",
            'rel="manifest"' in index_text and "manifest.webmanifest" in index_text,
            "index.html links manifest.webmanifest" if "manifest.webmanifest" in index_text else "missing manifest link",
            index,
        ),
        row(
            "webmanifest install metadata",
            manifest.get("display") == "standalone"
            and manifest.get("start_url") == "/"
            and manifest.get("scope") == "/"
            and len(manifest.get("icons", [])) >= 2,
            f"display={manifest.get('display')} icons={len(manifest.get('icons', []))}",
            webmanifest,
        ),
        row(
            "service worker runtime cache",
            "sepath-public-trial-v1" in sw_text
            and "offline.html" in sw_text
            and "fetch" in sw_text
            and "caches.open" in sw_text,
            "service worker handles cache, fetch and offline fallback",
            service_worker,
        ),
        row(
            "public manifest pwa declaration",
            pwa.get("installable") is True
            and pwa.get("service_worker") == "sw.js"
            and pwa.get("offline_page") == "offline.html",
            json.dumps(pwa, ensure_ascii=False),
            public_manifest,
        ),
        row(
            "public manifest lists pwa assets",
            {"manifest.webmanifest", "sw.js", "offline.html", "pwa-icon.svg", "maskable-icon.svg"}.issubset(public_files),
            f"{len(public_files)} files listed",
            public_manifest,
        ),
        row(
            "public runtime health declaration",
            health.get("runtime") == "sepath-public-health.v1"
            and health.get("status") == "ready_for_public_static_review"
            and {
                "PUBLIC_RELEASE.json",
                "public-url-receipt-panel.png",
                "submission-closure-panel.png",
            }.issubset(set(health.get("required_static_files", [])))
            and health.get("checks", {}).get("public_url_receipt_screenshot") is True
            and health.get("checks", {}).get("submission_closure_screenshot") is True
            and "Synthetic demo data" in str(health.get("privacy_boundary", "")),
            f"runtime={health.get('runtime')} status={health.get('status')}",
            public_health,
        ),
        row(
            "public release declaration",
            release.get("runtime") == "sepath-public-release.v1"
            and release.get("release_channel") == "competition-public-static"
            and len(release.get("innovation_claims", [])) >= 5
            and release.get("reviewer_assets", {}).get("public_url_receipt") == "public-url-receipt-panel.png"
            and release.get("reviewer_assets", {}).get("submission_closure") == "submission-closure-panel.png"
            and "real student data" in str(release.get("truth_boundary", "")),
            f"runtime={release.get('runtime')} claims={len(release.get('innovation_claims', []))}",
            public_release,
        ),
        row(
            "public manifest lists runtime metadata",
            {"PUBLIC_HEALTH.json", "PUBLIC_RELEASE.json"}.issubset(public_files)
            and public_trial.get("public_runtime", {}).get("health_runtime") == "sepath-public-health.v1"
            and public_trial.get("public_runtime", {}).get("release_runtime") == "sepath-public-release.v1",
            json.dumps(public_trial.get("public_runtime", {}), ensure_ascii=False),
            public_manifest,
        ),
        row(
            "judge seed retained",
            seed_manifest.exists() and "JUDGE_DEMO_SEED_MANIFEST.json" in public_files,
            "judge seed manifest remains in public trial package",
            seed_manifest,
        ),
        row(
            "reviewer guide manifest declaration",
            reviewer_guide.get("runtime") == "sepath-reviewer-guide.v1"
            and reviewer_guide.get("enabled") is True
            and reviewer_guide.get("report") == "REVIEWER_DRILL_REPORT.json"
            and reviewer_guide.get("screenshot") == "reviewer-guide-overlay.png"
            and reviewer_guide.get("claim_ledger_screenshot") == "reviewer-guide-claim-ledger.png"
            and reviewer_guide.get("public_url_receipt_screenshot") == "public-url-receipt-panel.png"
            and reviewer_guide.get("submission_closure_screenshot") == "submission-closure-panel.png",
            json.dumps(reviewer_guide, ensure_ascii=False),
            public_manifest,
        ),
        row(
            "reviewer guide evidence retained",
            reviewer_report.exists()
            and guide_screenshot.exists()
            and guide_claim_ledger_screenshot.exists()
            and public_url_receipt_screenshot.exists()
            and submission_closure_screenshot.exists()
            and {
                "REVIEWER_DRILL_REPORT.json",
                "reviewer-guide-overlay.png",
                "reviewer-guide-claim-ledger.png",
                "public-url-receipt-panel.png",
                "submission-closure-panel.png",
            }.issubset(public_files),
            "reviewer drill report and all guide screenshots remain in public trial package",
            public_manifest,
        ),
        row(
            "reviewer guide claim ledger anchor",
            "#claim-ledger" in reviewer_guide.get("required_anchors", [])
            and "#claim-ledger" in guided_tour.get("autoScrollAnchors", []),
            f"manifest={reviewer_guide.get('required_anchors')} report={guided_tour.get('autoScrollAnchors')}",
            public_manifest,
        ),
        row(
            "reviewer guide final submission anchors",
            "#public-url-receipt" in reviewer_guide.get("required_anchors", [])
            and "#submission-closure" in reviewer_guide.get("required_anchors", [])
            and "#public-url-receipt" in guided_tour.get("autoScrollAnchors", [])
            and "#submission-closure" in guided_tour.get("autoScrollAnchors", []),
            f"manifest={reviewer_guide.get('required_anchors')} report={guided_tour.get('autoScrollAnchors')}",
            public_manifest,
        ),
        row(
            "reviewer guide runtime report",
            reviewer_drill.get("runtime") == "sepath-reviewer-drill.v1"
            and guided_tour.get("runtime") == "sepath-reviewer-guide.v1"
            and guided_tour.get("totalSteps") == 11,
            f"drill={reviewer_drill.get('runtime')} guide={guided_tour.get('runtime')} steps={guided_tour.get('totalSteps')}",
            reviewer_report,
        ),
        row(
            "public bundle exposes reviewer guide",
            bundle_contains("一键评委导览", "正式提交收口", "sepath-reviewer-guide.v1", "sepath-submission-closure-console.v1"),
            "public assets include guide launch text, final closure text, and runtime markers",
            TRIAL,
        ),
    ]
    summary = {
        "PASS": sum(1 for item in rows if item["status"] == "PASS"),
        "FAIL": sum(1 for item in rows if item["status"] == "FAIL"),
        "rows": len(rows),
    }
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "runtime": "sepath-public-trial-pwa.v1",
        "summary": summary,
        "rows": rows,
    }


def main() -> None:
    report = validate()
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"summary": report["summary"], "report": REPORT.relative_to(ROOT).as_posix()}, ensure_ascii=False, indent=2))
    raise SystemExit(0 if report["summary"]["FAIL"] == 0 else 1)


if __name__ == "__main__":
    main()
