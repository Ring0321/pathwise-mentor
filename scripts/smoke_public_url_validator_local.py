from __future__ import annotations

import argparse
import functools
import json
import threading
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

from validate_public_url_release import validate


ROOT = Path(__file__).resolve().parents[1]
STATIC_DIR = ROOT / "参赛提交材料包" / "公开试用静态包"
REPORT = ROOT / "sepath-cloud-app" / "qa" / "public-url-validator-local-smoke.json"


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args: Any) -> None:
        return


def run_smoke(static_dir: Path) -> dict[str, Any]:
    handler = functools.partial(QuietHandler, directory=str(static_dir))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    host, port = server.server_address
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        report = validate(f"http://{host}:{port}/")
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)

    report["runtime"] = "sepath-public-url-validator-local-smoke.v1"
    report["source_dir"] = static_dir.relative_to(ROOT).as_posix()
    report["generated_at"] = datetime.now(timezone.utc).isoformat()
    report["truth_boundary"] = (
        "This local smoke test proves that the static public trial bundle can be served over HTTP "
        "and satisfies the same URL validator checks. It is not a public internet deployment receipt."
    )
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description="Smoke-test the public URL validator against the local static bundle.")
    parser.add_argument("--write", action="store_true", help="Write sepath-cloud-app/qa/public-url-validator-local-smoke.json.")
    args = parser.parse_args()

    if not STATIC_DIR.exists():
        raise FileNotFoundError(f"static public trial bundle not found: {STATIC_DIR}")

    report = run_smoke(STATIC_DIR)
    if args.write:
        REPORT.parent.mkdir(parents=True, exist_ok=True)
        REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(
        json.dumps(
            {
                "runtime": report["runtime"],
                "summary": report["summary"],
                "source_dir": report["source_dir"],
                "report": REPORT.relative_to(ROOT).as_posix(),
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0 if report["summary"]["FAIL"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
