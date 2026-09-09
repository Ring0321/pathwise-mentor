from __future__ import annotations

import argparse
import json
import sys
from copy import deepcopy
from pathlib import Path
from typing import Any

from prepare_final_named_submission import (
    ALLOWED_ACCESS_POLICIES,
    ALLOWED_CLAIM_POLICIES,
    ALLOWED_VIDEO_POLICIES,
    PROFILE_SCHEMA,
    PROFILE_TEMPLATE,
    ROOT,
    SUBMISSION,
    load_json,
    validate_profile,
)


DEFAULT_OUTPUT = SUBMISSION / "final_submission_profile.json"
CONFIRMATION_KEYS = [
    "team_name_matches_platform",
    "members_match_platform",
    "access_policy_confirmed",
    "video_version_confirmed",
    "no_unverified_real_course_claims",
    "sha256_saved_after_upload",
]


def parse_member(raw: str) -> dict[str, str]:
    parts = [part.strip() for part in raw.split("|")]
    if len(parts) not in (4, 5):
        raise argparse.ArgumentTypeError(
            "--member must use name|school|major|role or name|school|major|role|contact_for_platform"
        )
    name, school, major, role = parts[:4]
    contact = parts[4] if len(parts) == 5 else ""
    return {
        "name": name,
        "school": school,
        "major": major,
        "role": role,
        "contact_for_platform": contact,
    }


def rel(path: Path) -> str:
    try:
        return path.resolve().relative_to(ROOT).as_posix()
    except ValueError:
        return str(path)


def set_if_present(target: dict[str, Any], key: str, value: Any) -> None:
    if value is not None:
        target[key] = value


def build_profile(args: argparse.Namespace) -> dict[str, Any]:
    base_path = args.base_profile.resolve()
    profile = deepcopy(load_json(base_path))
    profile["schema"] = PROFILE_SCHEMA

    team = profile.setdefault("team", {})
    work = profile.setdefault("work", {})
    submission = profile.setdefault("submission", {})
    confirmed = profile.setdefault("confirmed", {})

    set_if_present(team, "name", args.team_name)
    if args.member:
        team["members"] = args.member

    set_if_present(work, "name", args.work_name)
    set_if_present(work, "official_title", args.official_title)
    set_if_present(work, "competition_track", args.competition_track)
    set_if_present(work, "one_sentence", args.one_sentence)

    set_if_present(submission, "access_policy", args.access_policy)
    set_if_present(submission, "public_static_bundle", args.public_static_bundle)
    set_if_present(submission, "cloud_url", args.cloud_url)
    set_if_present(submission, "video_policy", args.video_policy)
    set_if_present(submission, "demo_video", args.demo_video)
    set_if_present(submission, "real_course_claim_policy", args.claim_policy)
    set_if_present(submission, "pilot_evidence_path", args.pilot_evidence_path)
    set_if_present(submission, "final_package_manifest", args.final_package_manifest)

    for key in CONFIRMATION_KEYS:
        confirmed.setdefault(key, False)
    if args.confirm_all:
        for key in CONFIRMATION_KEYS:
            confirmed[key] = True
    for key in args.confirm or []:
        confirmed[key] = True

    return profile


def next_commands(output: Path, ready_for_named_write: bool) -> list[str]:
    profile_arg = rel(output)
    commands = [
        f'rtk python scripts/prepare_final_named_submission.py --profile "{profile_arg}" --dry-run',
    ]
    if ready_for_named_write:
        commands.append(f'rtk python scripts/prepare_final_named_submission.py --profile "{profile_arg}" --write')
    else:
        commands.append(f'rtk python scripts/build_final_submission_profile.py --base-profile "{profile_arg}" --confirm-all --write')
    commands.append("rtk python scripts/release_gate.py --skip-screenshots")
    return commands


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Build a local final_submission_profile.json from real competition submission facts."
    )
    parser.add_argument("--base-profile", type=Path, default=PROFILE_TEMPLATE, help="Profile/template to start from.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="Target JSON profile path.")
    parser.add_argument("--team-name", help="Official team name from the competition platform.")
    parser.add_argument("--work-name", help="Official work name. Defaults to the template value.")
    parser.add_argument("--official-title", help="Long official product title.")
    parser.add_argument("--competition-track", help="Competition track shown on the platform.")
    parser.add_argument("--one-sentence", help="One-sentence product description.")
    parser.add_argument("--member", action="append", type=parse_member, help="Repeatable: name|school|major|role|contact.")
    parser.add_argument("--access-policy", choices=sorted(ALLOWED_ACCESS_POLICIES), help="Final access strategy.")
    parser.add_argument("--public-static-bundle", help="Path to the public static trial bundle.")
    parser.add_argument("--cloud-url", help="Cloud demo URL if it can be shared.")
    parser.add_argument("--video-policy", choices=sorted(ALLOWED_VIDEO_POLICIES), help="Final video submission strategy.")
    parser.add_argument("--demo-video", help="Path to final demo video.")
    parser.add_argument("--claim-policy", choices=sorted(ALLOWED_CLAIM_POLICIES), help="Truth boundary for real-course claims.")
    parser.add_argument("--pilot-evidence-path", help="Required only when pilot_evidence_attached is selected.")
    parser.add_argument("--final-package-manifest", help="Path to the latest package manifest.")
    parser.add_argument("--confirm", action="append", choices=CONFIRMATION_KEYS, help="Mark one confirmation key as true.")
    parser.add_argument("--confirm-all", action="store_true", help="Mark all confirmation keys as true after manual review.")
    parser.add_argument("--write", action="store_true", help="Write the profile JSON. Without this flag, only prints a preview.")
    parser.add_argument("--strict", action="store_true", help="Return non-zero on validation errors even in preview mode.")
    parser.add_argument("--print-next-commands", action="store_true", help="Print the next release commands in the JSON output.")
    args = parser.parse_args()

    if not args.base_profile.exists():
        parser.error(f"base profile not found: {args.base_profile}")

    profile = build_profile(args)
    validation = validate_profile(profile, require_confirmed=False)
    output = args.output.resolve()
    confirmations_ready = all(profile.get("confirmed", {}).get(key) is True for key in CONFIRMATION_KEYS)
    ready_for_named_write = not validation["errors"] and confirmations_ready
    result = {
        "schema": PROFILE_SCHEMA,
        "mode": "write" if args.write else "preview",
        "base_profile": rel(args.base_profile),
        "output": rel(output),
        "validation": validation,
        "ready_for_named_write": ready_for_named_write,
        "manual_gates_retained": [
            "team_name_and_members_must_match_competition_platform",
            "access_policy_must_be_confirmed_before_public_submission",
            "video_version_must_be_rewatched_if_rebuilt",
            "real_course_effect_claims_need_pilot_evidence",
            "final_package_sha256_must_be_saved_after_upload",
        ],
        "profile": profile,
    }
    if args.print_next_commands or args.write:
        result["next_commands"] = next_commands(output, ready_for_named_write)

    if args.write:
        if validation["errors"]:
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return 2
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(profile, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        result["written"] = True

    print(json.dumps(result, ensure_ascii=False, indent=2))
    if args.strict and validation["errors"]:
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
