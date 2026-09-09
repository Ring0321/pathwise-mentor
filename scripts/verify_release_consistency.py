from __future__ import annotations

import json
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
MATERIALS = ROOT / "参赛提交材料包"
SUBMISSION = ROOT / "submission"
OUTPUTS = ROOT / "outputs"
REPORT = SUBMISSION / "release_consistency_report.json"


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def latest_release_gate() -> tuple[Path, dict[str, Any]]:
    candidates: list[tuple[float, Path, dict[str, Any]]] = []
    for path in OUTPUTS.glob("*.json"):
        try:
            data = load_json(path)
        except json.JSONDecodeError:
            continue
        summary = data.get("summary", {})
        if isinstance(data.get("rows"), list) and summary.get("release_gate") in {"PASS", "FAIL"}:
            candidates.append((path.stat().st_mtime, path, data))
    if not candidates:
        raise FileNotFoundError("release gate JSON report not found")
    _, path, data = sorted(candidates)[-1]
    return path, data


def find_one(directory: Path, pattern: str) -> Path:
    matches = sorted(path for path in directory.glob(pattern) if path.is_file())
    if not matches:
        raise FileNotFoundError(f"missing file matching {directory / pattern}")
    return matches[-1]


def row(label: str, passed: bool, evidence: str, path: Path | str) -> dict[str, str]:
    return {
        "label": label,
        "status": "PASS" if passed else "FAIL",
        "evidence": evidence,
        "path": path.relative_to(ROOT).as_posix() if isinstance(path, Path) else path,
    }


def main() -> int:
    release_path, release = latest_release_gate()
    manifest_path = find_one(SUBMISSION, "*v0.4_2026-08-09_manifest.json")
    audit_path = find_one(MATERIALS, "09_*机器可读.json")
    tech_path = find_one(MATERIALS, "46_*机器可读.json")
    pitch_card_path = find_one(MATERIALS, "52_*机器可读.json")
    final_defense_path = find_one(MATERIALS, "53_*机器可读.json")
    final_profile_template_path = MATERIALS / "54_正式提交画像配置模板.json"
    final_submission_workspace_path = MATERIALS / "68_正式提交填报工作台与人工门禁补全卡_机器可读.json"
    final_submission_todo_profile_path = SUBMISSION / "final_submission_profile.todo.json"
    final_submission_manual_checklist_path = SUBMISSION / "final_submission_manual_checklist.json"
    award_completion_path = MATERIALS / "55_获奖级完成度总验收报告_机器可读.json"
    launch_loop_path = MATERIALS / "56_上线级闭环验收剧本_机器可读.json"
    pilot_binder_path = MATERIALS / "58_真实课程试点证据归档与声明门禁说明_机器可读.json"
    trial_analysis_path = MATERIALS / "trial/anonymous-analysis-pack/analysis_summary.json"
    reviewer_drill_pack_path = MATERIALS / "reviewer-5min-drill/REVIEWER_5MIN_DRILL.json"
    judge_route_path = MATERIALS / "judge-route-orchestrator/JUDGE_ROUTE_ORCHESTRATOR.json"
    local_doctor_path = MATERIALS / "local-run-doctor/LOCAL_RUN_DOCTOR.json"
    upload_preflight_path = MATERIALS / "submission-upload-preflight/UPLOAD_PREFLIGHT.json"
    award_differentiation_path = MATERIALS / "award-differentiation/AWARD_DIFFERENTIATION.json"
    claim_ledger_path = MATERIALS / "claim-evidence-ledger/CLAIM_EVIDENCE_LEDGER.json"
    competition_alignment_path = MATERIALS / "competition-requirement-alignment/COMPETITION_REQUIREMENT_ALIGNMENT.json"
    judge_launchpad_path = MATERIALS / "judge-launchpad/JUDGE_LAUNCHPAD_MANIFEST.json"
    sites_preflight_path = MATERIALS / "63_Sites云端发布预检与替代上线路线_机器可读.json"
    public_url_template_path = MATERIALS / "64_最终公开URL验收器与回执模板_机器可读.json"
    public_site_upload_path = MATERIALS / "public-site-upload" / "PUBLIC_SITE_UPLOAD_MANIFEST.json"
    standard_deploy_validation_path = ROOT / "sepath-cloud-app" / "qa" / "deploy-artifacts-validation.json"
    standard_deploy_material_path = MATERIALS / "72_标准化部署配置与容器化验收说明_机器可读.json"
    public_launch_material_path = MATERIALS / "66_公网发布指挥台与提交日操作卡_机器可读.json"
    public_launch_command_path = MATERIALS / "public-launch-command" / "PUBLIC_LAUNCH_COMMAND.json"
    hosting_selftest_path = MATERIALS / "public-hosting-selftest" / "HOSTING_UPLOAD_SELFTEST.json"
    hosting_selftest_checks_path = MATERIALS / "public-hosting-selftest" / "manifest_checks.json"
    hosting_selftest_material_path = MATERIALS / "67_静态托管平台配置自检与故障恢复卡_机器可读.json"
    public_deploy_playbook_path = MATERIALS / "public-deploy-playbook" / "PUBLIC_DEPLOY_PLAYBOOK.json"
    public_deploy_playbook_checks_path = MATERIALS / "public-deploy-playbook" / "manifest_checks.json"
    public_deploy_playbook_material_path = MATERIALS / "70_公网部署实操包与回执封存说明_机器可读.json"
    public_deploy_index_sync_path = MATERIALS / "public-deploy-playbook" / "INDEX_SYNC_REPORT.json"
    public_submission_closure_path = MATERIALS / "71_公网URL回填后的正式提交收口说明_机器可读.json"
    public_url_smoke_path = ROOT / "sepath-cloud-app" / "qa" / "public-url-validator-local-smoke.json"
    final_public_url_receipt_path = SUBMISSION / "final_public_url_receipt.json"
    platform_copy_path = MATERIALS / "10_比赛平台填写文案.md"

    manifest = load_json(manifest_path)
    audit = load_json(audit_path)
    tech = load_json(tech_path)
    pitch_card = load_json(pitch_card_path)
    final_defense = load_json(final_defense_path)
    final_profile_template = load_json(final_profile_template_path)
    final_submission_workspace = load_json(final_submission_workspace_path)
    final_submission_todo_profile = load_json(final_submission_todo_profile_path)
    final_submission_manual_checklist = load_json(final_submission_manual_checklist_path)
    award_completion = load_json(award_completion_path)
    launch_loop = load_json(launch_loop_path)
    pilot_binder = load_json(pilot_binder_path)
    trial_analysis = load_json(trial_analysis_path)
    reviewer_drill_pack = load_json(reviewer_drill_pack_path)
    judge_route = load_json(judge_route_path)
    local_doctor = load_json(local_doctor_path)
    upload_preflight = load_json(upload_preflight_path)
    award_differentiation = load_json(award_differentiation_path)
    claim_ledger = load_json(claim_ledger_path)
    competition_alignment = load_json(competition_alignment_path)
    judge_launchpad = load_json(judge_launchpad_path)
    sites_preflight = load_json(sites_preflight_path)
    public_url_template = load_json(public_url_template_path)
    public_site_upload = load_json(public_site_upload_path)
    standard_deploy_validation = load_json(standard_deploy_validation_path)
    standard_deploy_material = load_json(standard_deploy_material_path)
    public_launch_material = load_json(public_launch_material_path)
    public_launch_command = load_json(public_launch_command_path)
    hosting_selftest = load_json(hosting_selftest_path)
    hosting_selftest_checks = load_json(hosting_selftest_checks_path)
    hosting_selftest_material = load_json(hosting_selftest_material_path)
    public_deploy_playbook = load_json(public_deploy_playbook_path)
    public_deploy_playbook_checks = load_json(public_deploy_playbook_checks_path)
    public_deploy_playbook_material = load_json(public_deploy_playbook_material_path)
    public_deploy_index_sync = load_json(public_deploy_index_sync_path)
    public_submission_closure = load_json(public_submission_closure_path)
    public_url_smoke = load_json(public_url_smoke_path)
    final_public_url_receipt = load_json(final_public_url_receipt_path)
    platform_copy_text = platform_copy_path.read_text(encoding="utf-8", errors="replace")
    cloud_url_row = next((line for line in platform_copy_text.splitlines() if line.startswith("| 云端演示地址 |")), "")
    index_texts = "\n".join(
        [
            (MATERIALS / "README_提交材料总览.md").read_text(encoding="utf-8", errors="replace"),
            (MATERIALS / "START_DEMO.md").read_text(encoding="utf-8", errors="replace"),
            (MATERIALS / "00_评委速读与评分导航.md").read_text(encoding="utf-8-sig", errors="replace"),
        ]
    )
    release_summary = release.get("summary", {})
    audit_summary = audit.get("summary", {})
    package_path = SUBMISSION / manifest.get("package", "")

    rows: list[dict[str, str]] = []
    rows.append(
        row(
            "release gate pass",
            release_summary.get("release_gate") == "PASS" and release_summary.get("command_failures") == 0,
            f"release_gate={release_summary.get('release_gate')} command_failures={release_summary.get('command_failures')}",
            release_path,
        )
    )
    rows.append(
        row(
            "audit summary current",
            audit_summary.get("PASS", 0) >= 125 and audit_summary.get("WARN") == 0 and audit_summary.get("FAIL") == 0,
            f"PASS={audit_summary.get('PASS')} WARN={audit_summary.get('WARN')} FAIL={audit_summary.get('FAIL')} MANUAL={audit_summary.get('MANUAL')}",
            audit_path,
        )
    )
    rows.append(
        row(
            "release gate audit matches audit report",
            release_summary.get("audit_summary") == audit_summary,
            f"release={release_summary.get('audit_summary')} audit={audit_summary}",
            release_path,
        )
    )
    rows.append(
        row(
            "release gate package matches manifest",
            all(
                [
                    release_summary.get("package") == manifest.get("package"),
                    release_summary.get("package_size_bytes") == manifest.get("package_size_bytes"),
                    release_summary.get("package_sha256") == manifest.get("package_sha256"),
                    release_summary.get("file_count") == manifest.get("file_count"),
                ]
            ),
            f"sha={manifest.get('package_sha256')} size={manifest.get('package_size_bytes')} files={manifest.get('file_count')}",
            manifest_path,
        )
    )

    dry_run = next((item for item in release.get("rows", []) if item.get("label") == "正式命名脚本预演"), {})
    dry_tail = dry_run.get("tail", "")
    rows.append(
        row(
            "final naming dry-run is current",
            dry_run.get("status") == "PASS"
            and str(manifest.get("package_sha256")) in dry_tail
            and "source_sha256" in dry_tail
            and "待填写队伍名" in dry_tail,
            f"status={dry_run.get('status')} contains_current_sha={str(manifest.get('package_sha256')) in dry_tail}",
            release_path,
        )
    )

    tech_checks = tech.get("checks", [])
    pitch_check = next((item for item in tech_checks if item.get("label") == "决赛路演追问回答卡"), {})
    rows.append(
        row(
            "judge verification includes final pitch card",
            pitch_check.get("status") == "PASS",
            pitch_check.get("evidence", "missing"),
            tech_path,
        )
    )
    rows.append(
        row(
            "final pitch card schema",
            pitch_card.get("runtime") == "sepath-final-pitch-defense-card.v1"
            and len(pitch_card.get("pitch_segments", [])) >= 5
            and len(pitch_card.get("challenge_cards", [])) >= 4
            and len(pitch_card.get("forbidden_claims", [])) >= 5,
            f"runtime={pitch_card.get('runtime')} segments={len(pitch_card.get('pitch_segments', []))} challengeCards={len(pitch_card.get('challenge_cards', []))}",
            pitch_card_path,
        )
    )
    rows.append(
        row(
            "product final defense command center schema",
            final_defense.get("runtime") == "sepath-final-defense-command-center.v1"
            and final_defense.get("product_anchor") == "#final-defense"
            and len(final_defense.get("question_coverage", [])) >= 8,
            f"runtime={final_defense.get('runtime')} anchor={final_defense.get('product_anchor')} questions={len(final_defense.get('question_coverage', []))}",
            final_defense_path,
        )
    )
    rows.append(
        row(
            "final submission profile template schema",
            final_profile_template.get("schema") == "sepath-final-submission-profile.v1"
            and final_profile_template.get("submission", {}).get("access_policy") in {
                "public_static_bundle",
                "owner_only_cloud_plus_public_static_bundle",
                "local_demo_plus_video_fallback",
                "public_cloud_after_permission_switch",
            }
            and all(value is False for value in final_profile_template.get("confirmed", {}).values()),
            f"schema={final_profile_template.get('schema')} confirmations={final_profile_template.get('confirmed')}",
            final_profile_template_path,
        )
    )
    rows.append(
        row(
            "final submission workspace schema",
            final_submission_workspace.get("runtime") == "sepath-final-submission-workspace.v1"
            and final_submission_workspace.get("status") in {"manual_required", "ready_for_named_submission"}
            and len(final_submission_workspace.get("manual_gates", [])) >= 6
            and final_submission_workspace.get("todo_profile") == "submission/final_submission_profile.todo.json"
            and "invent team members" in str(final_submission_workspace.get("truth_boundary", "")),
            f"runtime={final_submission_workspace.get('runtime')} status={final_submission_workspace.get('status')} gates={len(final_submission_workspace.get('manual_gates', []))}",
            final_submission_workspace_path,
        )
    )
    rows.append(
        row(
            "final submission todo profile manual confirmations",
            final_submission_todo_profile.get("schema") == "sepath-final-submission-profile.v1"
            and all(value is False for value in final_submission_todo_profile.get("confirmed", {}).values())
            and "PENDING_FINAL_PUBLIC_URL" in json.dumps(final_submission_todo_profile, ensure_ascii=False),
            f"schema={final_submission_todo_profile.get('schema')} confirmations={final_submission_todo_profile.get('confirmed')}",
            final_submission_todo_profile_path,
        )
    )
    rows.append(
        row(
            "final submission manual checklist schema",
            final_submission_manual_checklist.get("runtime") == "sepath-final-submission-workspace.v1"
            and final_submission_manual_checklist.get("status") in {"manual_required", "ready_for_named_submission"}
            and len(final_submission_manual_checklist.get("manual_gates", [])) >= 6,
            f"runtime={final_submission_manual_checklist.get('runtime')} status={final_submission_manual_checklist.get('status')} gates={len(final_submission_manual_checklist.get('manual_gates', []))}",
            final_submission_manual_checklist_path,
        )
    )
    rows.append(
        row(
            "award completion audit schema",
            award_completion.get("runtime") == "sepath-award-completion-audit.v1"
            and award_completion.get("machine_evidence_score", 0) >= 90
            and len(award_completion.get("dimensions", [])) >= 10
            and award_completion.get("machine_summary", {}).get("audit_summary") == audit_summary,
            f"runtime={award_completion.get('runtime')} score={award_completion.get('machine_evidence_score')} dimensions={len(award_completion.get('dimensions', []))}",
            award_completion_path,
        )
    )
    rows.append(
        row(
            "launch loop acceptance schema",
            launch_loop.get("runtime") == "sepath-launch-loop-acceptance.v1"
            and launch_loop.get("machine_readiness_score", 0) >= 90
            and len(launch_loop.get("stages", [])) >= 12
            and launch_loop.get("machine_summary", {}).get("audit_summary") == audit_summary,
            f"runtime={launch_loop.get('runtime')} score={launch_loop.get('machine_readiness_score')} stages={len(launch_loop.get('stages', []))}",
            launch_loop_path,
        )
    )
    rows.append(
        row(
            "real pilot evidence binder schema",
            pilot_binder.get("runtime") == "sepath-pilot-evidence-binder.v1"
            and pilot_binder.get("blocked_count", 1) == 0
            and len(pilot_binder.get("claim_tiers", [])) >= 4,
            f"runtime={pilot_binder.get('runtime')} score={pilot_binder.get('machine_evidence_score')} claimTiers={len(pilot_binder.get('claim_tiers', []))}",
            pilot_binder_path,
        )
    )
    rows.append(
        row(
            "trial anonymous analysis pack schema",
            trial_analysis.get("runtime") == "sepath-trial-analysis-pack.v1"
            and trial_analysis.get("evidence_scope") == "synthetic_replay_sample"
            and trial_analysis.get("pii_scan", {}).get("status") == "PASS"
            and len(trial_analysis.get("files", [])) >= 7,
            f"runtime={trial_analysis.get('runtime')} scope={trial_analysis.get('evidence_scope')} files={len(trial_analysis.get('files', []))}",
            trial_analysis_path,
        )
    )
    rows.append(
        row(
            "reviewer 5min drill pack schema",
            reviewer_drill_pack.get("runtime") == "sepath-reviewer-5min-drill.v1"
            and reviewer_drill_pack.get("duration_seconds") == 300
            and reviewer_drill_pack.get("checks_summary", {}).get("FAIL") == 0
            and len(reviewer_drill_pack.get("route", [])) == 11
            and "inspect-public-url-receipt" in {step.get("id") for step in reviewer_drill_pack.get("route", [])}
            and "inspect-submission-closure" in {step.get("id") for step in reviewer_drill_pack.get("route", [])}
            and len(reviewer_drill_pack.get("scorecard", [])) >= 5
            and reviewer_drill_pack.get("evidence_scope") == "synthetic_reviewer_walkthrough",
            f"runtime={reviewer_drill_pack.get('runtime')} duration={reviewer_drill_pack.get('duration_seconds')} checks={reviewer_drill_pack.get('checks_summary')}",
            reviewer_drill_pack_path,
        )
    )
    route_totals = {
        route.get("id"): sum(int(step.get("seconds") or 0) for step in route.get("steps", []))
        for route in judge_route.get("routes", [])
    }
    rows.append(
        row(
            "judge route orchestrator schema",
            judge_route.get("runtime") == "sepath-judge-route-orchestrator.v1"
            and judge_route.get("checks_summary", {}).get("FAIL") == 0
            and route_totals.get("briefing-3min") == 180
            and route_totals.get("hands-on-5min") == 300
            and route_totals.get("technical-10min") == 600
            and len(judge_route.get("score_matrix", [])) >= 5,
            f"runtime={judge_route.get('runtime')} checks={judge_route.get('checks_summary')} totals={route_totals}",
            judge_route_path,
        )
    )
    local_expected_scripts = set(local_doctor.get("expected_npm_scripts", []))
    rows.append(
        row(
            "local run doctor schema",
            local_doctor.get("runtime") == "sepath-local-run-doctor.v1"
            and local_doctor.get("checks_summary", {}).get("FAIL") == 0
            and len(local_doctor.get("run_modes", [])) >= 4
            and all(item in local_expected_scripts for item in ["dev", "build", "test", "cloud:reviewer-drill"]),
            f"runtime={local_doctor.get('runtime')} checks={local_doctor.get('checks_summary')} scripts={len(local_expected_scripts)} modes={len(local_doctor.get('run_modes', []))}",
            local_doctor_path,
        )
    )
    rows.append(
        row(
            "submission upload preflight schema",
            upload_preflight.get("runtime") == "sepath-submission-upload-preflight.v1"
            and upload_preflight.get("checks_summary", {}).get("FAIL") == 0
            and len(upload_preflight.get("platform_fields", [])) >= 10
            and len(upload_preflight.get("upload_steps", [])) >= 8
            and "see submission manifest" in str(upload_preflight.get("authoritative_package_metadata", {}).get("sha256", "")),
            f"runtime={upload_preflight.get('runtime')} checks={upload_preflight.get('checks_summary')} fields={len(upload_preflight.get('platform_fields', []))}",
            upload_preflight_path,
        )
    )
    rows.append(
        row(
            "award differentiation schema",
            award_differentiation.get("runtime") == "sepath-award-differentiation.v1"
            and award_differentiation.get("checks_summary", {}).get("FAIL") == 0
            and sum(int(item.get("weight", 0)) for item in award_differentiation.get("official_score_matrix", [])) == 100
            and len(award_differentiation.get("differentiators", [])) >= 6
            and len(award_differentiation.get("objection_cards", [])) >= 5,
            f"runtime={award_differentiation.get('runtime')} checks={award_differentiation.get('checks_summary')} differentiators={len(award_differentiation.get('differentiators', []))}",
            award_differentiation_path,
        )
    )
    rows.append(
        row(
            "claim evidence ledger schema",
            claim_ledger.get("runtime") == "sepath-claim-evidence-ledger.v1"
            and claim_ledger.get("checks_summary", {}).get("FAIL") == 0
            and claim_ledger.get("product_anchor") == "#claim-ledger"
            and len(claim_ledger.get("claims", [])) >= 12
            and len(claim_ledger.get("claim_tiers", [])) == 4
            and "does not upgrade L0/L1" in str(claim_ledger.get("truth_boundary", "")),
            f"runtime={claim_ledger.get('runtime')} anchor={claim_ledger.get('product_anchor')} checks={claim_ledger.get('checks_summary')} claims={len(claim_ledger.get('claims', []))} tiers={len(claim_ledger.get('claim_tiers', []))}",
            claim_ledger_path,
        )
    )
    rows.append(
        row(
            "competition requirement alignment schema",
            competition_alignment.get("runtime") == "sepath-competition-requirement-alignment.v1"
            and competition_alignment.get("checks_summary", {}).get("FAIL") == 0
            and competition_alignment.get("status") == "ready_for_judge_requirement_review"
            and {item.get("official_requirement") for item in competition_alignment.get("official_core_capabilities", [])}
            == {"学情诊断", "路径规划", "实时干预", "记忆与反思"}
            and sum(int(item.get("weight", 0)) for item in competition_alignment.get("preliminary_score_matrix", [])) == 100
            and sum(int(item.get("weight", 0)) for item in competition_alignment.get("final_roadshow_score_matrix", [])) == 100
            and len(competition_alignment.get("submission_requirements", [])) >= 6
            and len(competition_alignment.get("evidence_paths", [])) >= 25,
            f"runtime={competition_alignment.get('runtime')} checks={competition_alignment.get('checks_summary')} evidence_paths={len(competition_alignment.get('evidence_paths', []))}",
            competition_alignment_path,
        )
    )
    rows.append(
        row(
            "judge launchpad schema",
            judge_launchpad.get("runtime") == "sepath-judge-launchpad.v1"
            and judge_launchpad.get("checks_summary", {}).get("FAIL") == 0
            and len(judge_launchpad.get("entrypoints", [])) >= 14
            and judge_launchpad.get("primary_entry") == "参赛提交材料包/00_评委一键打开入口.html"
            and judge_launchpad.get("evidence_scope") == "synthetic_demo_plus_machine_evidence",
            f"runtime={judge_launchpad.get('runtime')} checks={judge_launchpad.get('checks_summary')} entrypoints={len(judge_launchpad.get('entrypoints', []))}",
            judge_launchpad_path,
        )
    )
    rows.append(
        row(
            "sites publish preflight schema",
            sites_preflight.get("runtime") == "sepath-sites-publish-preflight.v1"
            and sites_preflight.get("latest_source", {}).get("commit") == "7f33ee7f663af9bd57e3f60d99eb79e0a09f8a7c"
            and sites_preflight.get("current_project_access", {}).get("write_credential_status") == "project_not_found"
            and sites_preflight.get("current_project_access", {}).get("get_site_status") == "project_not_found"
            and sites_preflight.get("fallback", {}).get("static_bundle", {}).get("status") == "validated"
            and sites_preflight.get("claims", {}).get("latest_sites_deployed") is False
            and sites_preflight.get("claims", {}).get("public_static_bundle_ready") is True,
            f"runtime={sites_preflight.get('runtime')} latest={sites_preflight.get('latest_source', {}).get('commit')} project={sites_preflight.get('current_project_access', {}).get('project_id')}",
            sites_preflight_path,
        )
    )
    rows.append(
        row(
            "public url validator template schema",
            public_url_template.get("runtime") == "sepath-public-url-validation-template.v1"
            and public_url_template.get("status") == "pending_final_public_url"
            and public_url_template.get("script") == "scripts/validate_public_url_release.py"
            and public_url_template.get("receipt_script") == "scripts/finalize_public_url_receipt.py"
            and public_url_template.get("local_smoke_script") == "scripts/smoke_public_url_validator_local.py"
            and public_url_template.get("receipt_json") == "submission/final_public_url_receipt.json"
            and public_url_template.get("receipt_md") == "submission/final_public_url_receipt.md"
            and public_url_template.get("local_smoke_report") == "sepath-cloud-app/qa/public-url-validator-local-smoke.json"
            and "reviewer-guide-claim-ledger.png" in public_url_template.get("required_assets", [])
            and "PUBLIC_HEALTH.json" in public_url_template.get("required_assets", [])
            and "PUBLIC_RELEASE.json" in public_url_template.get("required_assets", [])
            and public_url_template.get("required_summary", {}).get("FAIL") == 0,
            f"runtime={public_url_template.get('runtime')} status={public_url_template.get('status')} assets={len(public_url_template.get('required_assets', []))}",
            public_url_template_path,
        )
    )
    rows.append(
        row(
            "public url validator local smoke",
            public_url_smoke.get("runtime") == "sepath-public-url-validator-local-smoke.v1"
            and public_url_smoke.get("summary", {}).get("FAIL") == 0
            and public_url_smoke.get("summary", {}).get("PASS", 0) >= 15
            and public_url_smoke.get("source_dir") == "参赛提交材料包/公开试用静态包",
            f"runtime={public_url_smoke.get('runtime')} summary={public_url_smoke.get('summary')} source={public_url_smoke.get('source_dir')}",
            public_url_smoke_path,
        )
    )
    rows.append(
        row(
            "public site upload artifact schema",
            public_site_upload.get("runtime") == "sepath-public-site-upload-artifact.v1"
            and public_site_upload.get("checks_summary", {}).get("FAIL") == 0
            and public_site_upload.get("zip_integrity") == "pass"
            and public_site_upload.get("zip_contains_root_index") is True
            and public_site_upload.get("required_missing") == []
            and public_site_upload.get("extra_missing") == []
            and "_redirects" in public_site_upload.get("extra_files", [])
            and "_headers" in public_site_upload.get("extra_files", [])
            and {"404.html", "vercel.json", "netlify.toml", "nginx.conf.example", "DEPLOY_TARGETS.md"}.issubset(
                set(public_site_upload.get("deploy_config_files", []))
            )
            and public_site_upload.get("deploy_config_missing") == []
            and {"PUBLIC_HEALTH.json", "PUBLIC_RELEASE.json"}.issubset(set(public_site_upload.get("required_static_files", [])))
            and public_site_upload.get("zip_size_bytes", 999999999) < 5 * 1024 * 1024,
            f"runtime={public_site_upload.get('runtime')} summary={public_site_upload.get('checks_summary')} zip={public_site_upload.get('zip_size_bytes')} sha={public_site_upload.get('zip_sha256')}",
            public_site_upload_path,
        )
    )
    rows.append(
        row(
            "standard deployment artifact validation schema",
            standard_deploy_validation.get("runtime") == "sepath-deploy-artifacts-validation.v1"
            and standard_deploy_validation.get("status") == "ready_for_standard_static_deploy"
            and standard_deploy_validation.get("summary", {}).get("FAIL") == 0
            and standard_deploy_validation.get("summary", {}).get("PASS", 0) >= 10
            and standard_deploy_validation.get("artifacts", {}).get("public_site_upload_zip_sha256")
            == public_site_upload.get("zip_sha256")
            and standard_deploy_validation.get("artifacts", {}).get("docker_compose") == "sepath-cloud-app/docker-compose.yml",
            f"runtime={standard_deploy_validation.get('runtime')} status={standard_deploy_validation.get('status')} summary={standard_deploy_validation.get('summary')} sha={standard_deploy_validation.get('artifacts', {}).get('public_site_upload_zip_sha256')}",
            standard_deploy_validation_path,
        )
    )
    rows.append(
        row(
            "standard deployment material mirrors QA validation",
            standard_deploy_material.get("runtime") == "sepath-standard-deploy-validation-material.v1"
            and standard_deploy_material.get("status") == standard_deploy_validation.get("status")
            and standard_deploy_material.get("summary", {}).get("FAIL") == 0
            and standard_deploy_material.get("source_report") == "sepath-cloud-app/qa/deploy-artifacts-validation.json"
            and standard_deploy_material.get("artifacts", {}).get("public_site_upload_zip_sha256")
            == public_site_upload.get("zip_sha256"),
            f"runtime={standard_deploy_material.get('runtime')} status={standard_deploy_material.get('status')} summary={standard_deploy_material.get('summary')} sha={standard_deploy_material.get('artifacts', {}).get('public_site_upload_zip_sha256')}",
            standard_deploy_material_path,
        )
    )
    rows.append(
        row(
            "public launch commander material schema",
            public_launch_material.get("runtime") == "sepath-public-launch-commander-material.v1"
            and public_launch_material.get("status") in {"awaiting_external_public_url", "ready_for_platform"}
            and public_launch_material.get("checks_summary", {}).get("FAIL") == 0
            and public_launch_material.get("upload_zip_sha256") == public_site_upload.get("zip_sha256")
            and public_launch_material.get("command_pack") == "参赛提交材料包/public-launch-command/PUBLIC_LAUNCH_COMMAND.json",
            f"runtime={public_launch_material.get('runtime')} status={public_launch_material.get('status')} checks={public_launch_material.get('checks_summary')} sha={public_launch_material.get('upload_zip_sha256')}",
            public_launch_material_path,
        )
    )
    rows.append(
        row(
            "public launch commander command pack",
            public_launch_command.get("runtime") == "sepath-public-launch-commander.v1"
            and public_launch_command.get("status") in {"awaiting_external_public_url", "ready_for_platform"}
            and public_launch_command.get("checks_summary", {}).get("FAIL") == 0
            and public_launch_command.get("upload_zip_sha256") == public_site_upload.get("zip_sha256")
            and public_launch_command.get("receipt_json") == "submission/final_public_url_receipt.json",
            f"runtime={public_launch_command.get('runtime')} status={public_launch_command.get('status')} checks={public_launch_command.get('checks_summary')} sha={public_launch_command.get('upload_zip_sha256')}",
            public_launch_command_path,
        )
    )
    rows.append(
        row(
            "public hosting selftest schema",
            hosting_selftest.get("runtime") == "sepath-public-hosting-selftest.v1"
            and hosting_selftest.get("status") == "ready_for_external_static_hosting"
            and hosting_selftest.get("summary", {}).get("FAIL") == 0
            and hosting_selftest.get("summary", {}).get("PASS", 0) >= 10
            and hosting_selftest.get("zip_sha256") == public_site_upload.get("zip_sha256")
            and hosting_selftest.get("missing_required_zip_entries") == [],
            f"runtime={hosting_selftest.get('runtime')} status={hosting_selftest.get('status')} summary={hosting_selftest.get('summary')} sha={hosting_selftest.get('zip_sha256')}",
            hosting_selftest_path,
        )
    )
    rows.append(
        row(
            "public hosting selftest material and checks",
            hosting_selftest_material.get("runtime") == "sepath-public-hosting-selftest.v1"
            and hosting_selftest_material.get("summary", {}).get("FAIL") == 0
            and hosting_selftest_checks.get("runtime") == "sepath-public-hosting-selftest-checks.v1"
            and hosting_selftest_checks.get("summary", {}).get("FAIL") == 0,
            f"material={hosting_selftest_material.get('summary')} checks={hosting_selftest_checks.get('summary')}",
            hosting_selftest_material_path,
        )
    )
    rows.append(
        row(
            "public deploy playbook schema",
            public_deploy_playbook.get("runtime") == "sepath-public-deploy-playbook.v1"
            and public_deploy_playbook.get("status") in {"ready_for_human_public_deploy", "ready_for_platform_submission"}
            and public_deploy_playbook.get("final_url_status") in {"pending_external_public_url", "ready_for_platform"}
            and public_deploy_playbook.get("checks_summary", {}).get("FAIL") == 0
            and public_deploy_playbook.get("checks_summary", {}).get("PASS", 0) >= 12
            and public_deploy_playbook.get("upload_zip_sha256") == public_site_upload.get("zip_sha256")
            and public_deploy_playbook.get("final_public_url_receipt") == "submission/final_public_url_receipt.json",
            f"runtime={public_deploy_playbook.get('runtime')} status={public_deploy_playbook.get('status')} final_url={public_deploy_playbook.get('final_url_status')} checks={public_deploy_playbook.get('checks_summary')} sha={public_deploy_playbook.get('upload_zip_sha256')}",
            public_deploy_playbook_path,
        )
    )
    rows.append(
        row(
            "public deploy playbook material and checks",
            public_deploy_playbook_material.get("runtime") == "sepath-public-deploy-playbook-material.v1"
            and public_deploy_playbook_material.get("status") == public_deploy_playbook.get("status")
            and public_deploy_playbook_material.get("final_url_status") == public_deploy_playbook.get("final_url_status")
            and public_deploy_playbook_material.get("checks_summary", {}).get("FAIL") == 0
            and public_deploy_playbook_checks.get("runtime") == "sepath-public-deploy-playbook-checks.v1"
            and public_deploy_playbook_checks.get("summary", {}).get("FAIL") == 0,
            f"material={public_deploy_playbook_material.get('checks_summary')} checks={public_deploy_playbook_checks.get('summary')}",
            public_deploy_playbook_material_path,
        )
    )
    rows.append(
        row(
            "public deploy playbook platform and boundary",
            len(public_deploy_playbook.get("platform_matrix", [])) >= 7
            and public_deploy_playbook.get("manual_gate") in {"external_static_hosting_url_required", "external_url_sealed"}
            and (
                public_deploy_playbook.get("final_url_status") == "ready_for_platform"
                or public_deploy_playbook.get("final_public_url") == "PENDING_FINAL_PUBLIC_URL"
            )
            and "不能宣称已经拥有最终公网 URL" in str(public_deploy_playbook.get("truth_boundary", "")),
            f"providers={len(public_deploy_playbook.get('platform_matrix', []))} gate={public_deploy_playbook.get('manual_gate')} url={public_deploy_playbook.get('final_public_url')}",
            public_deploy_playbook_path,
        )
    )
    rows.append(
        row(
            "public deploy index sync",
            public_deploy_index_sync.get("runtime") == "sepath-public-deploy-index-sync.v1"
            and public_deploy_index_sync.get("summary", {}).get("FAIL") == 0
            and index_texts.count("70_公网部署实操包与回执封存说明.md") >= 3
            and index_texts.count("71_公网URL回填后的正式提交收口说明.md") >= 3
            and index_texts.count("public-deploy-playbook") >= 3,
            f"runtime={public_deploy_index_sync.get('runtime')} summary={public_deploy_index_sync.get('summary')} material70_refs={index_texts.count('70_公网部署实操包与回执封存说明.md')} material71_refs={index_texts.count('71_公网URL回填后的正式提交收口说明.md')} pack_refs={index_texts.count('public-deploy-playbook')}",
            public_deploy_index_sync_path,
        )
    )
    closure_check_ids = {item.get("id") for item in public_submission_closure.get("checks", [])}
    rows.append(
        row(
            "public url final submission closure schema",
            public_submission_closure.get("runtime") == "sepath-public-url-submission-closure.v1"
            and public_submission_closure.get("status") in {
                "manual_gates_remaining",
                "ready_with_watch_items",
                "ready_for_final_platform_submission",
            }
            and public_submission_closure.get("checks_summary", {}).get("FAIL") == 0
            and public_submission_closure.get("receipt", {}).get("path") == "submission/final_public_url_receipt.json"
            and public_submission_closure.get("outputs", {}).get("material_json")
            == "参赛提交材料包/71_公网URL回填后的正式提交收口说明_机器可读.json",
            f"runtime={public_submission_closure.get('runtime')} status={public_submission_closure.get('status')} summary={public_submission_closure.get('checks_summary')}",
            public_submission_closure_path,
        )
    )
    rows.append(
        row(
            "public url final submission closure gates",
            {"final-public-url-receipt", "public-url-platform-copy", "final-submission-profile", "final-named-submission-copies"}.issubset(
                closure_check_ids
            )
            and len(public_submission_closure.get("next_commands", [])) >= 6
            and "invent real team members" in str(public_submission_closure.get("truth_boundary", "")),
            f"gates={','.join(sorted(str(item) for item in closure_check_ids))} next={len(public_submission_closure.get('next_commands', []))}",
            public_submission_closure_path,
        )
    )
    rows.append(
        row(
            "final public url receipt pending schema",
            final_public_url_receipt.get("runtime") == "sepath-final-public-url-receipt.v1"
            and final_public_url_receipt.get("status") in {"pending_final_public_url", "ready_for_platform"}
            and final_public_url_receipt.get("local_smoke", {}).get("summary", {}).get("FAIL") == 0,
            f"status={final_public_url_receipt.get('status')} validation={final_public_url_receipt.get('validation_summary')} local={final_public_url_receipt.get('local_smoke', {}).get('summary')}",
            final_public_url_receipt_path,
        )
    )
    rows.append(
        row(
            "platform cloud url row safe",
            "【待填写：最终公开 URL" in cloud_url_row
            or (
                final_public_url_receipt.get("status") == "ready_for_platform"
                and final_public_url_receipt.get("public_https_check") is True
                and str(final_public_url_receipt.get("url", "")) in cloud_url_row
            ),
            cloud_url_row or "missing cloud demo URL row",
            platform_copy_path,
        )
    )

    if package_path.exists():
        with zipfile.ZipFile(package_path) as archive:
            bad = archive.testzip()
            names = set(archive.namelist())
            required = {
                "参赛提交材料包/52_决赛路演口播稿与评委追问回答卡.md",
                "参赛提交材料包/00_评委一键打开入口.html",
                "参赛提交材料包/00_评委一键打开入口.md",
                "参赛提交材料包/52_决赛路演口播稿与评委追问回答卡_机器可读.json",
                "参赛提交材料包/53_产品内决赛追问指挥台说明.md",
                "参赛提交材料包/53_产品内决赛追问指挥台说明_机器可读.json",
                "参赛提交材料包/54_正式提交画像与命名副本生成说明.md",
                "参赛提交材料包/54_正式提交画像配置模板.json",
                "参赛提交材料包/55_获奖级完成度总验收报告.md",
                "参赛提交材料包/55_获奖级完成度总验收报告_机器可读.json",
                "参赛提交材料包/56_上线级闭环验收剧本.md",
                "参赛提交材料包/56_上线级闭环验收剧本_机器可读.json",
                "参赛提交材料包/57_最终提交信息采集与一键画像生成说明.md",
                "参赛提交材料包/58_真实课程试点证据归档与声明门禁说明.md",
                "参赛提交材料包/58_真实课程试点证据归档与声明门禁说明_机器可读.json",
                "参赛提交材料包/59_三段式评委评审路线与口径同步说明.md",
                "参赛提交材料包/59_三段式评委评审路线与口径同步说明_机器可读.json",
                "参赛提交材料包/60_平台提交终检与上传凭证包.md",
                "参赛提交材料包/60_平台提交终检与上传凭证包_机器可读.json",
                "参赛提交材料包/61_一等奖差异化创新证据包.md",
                "参赛提交材料包/61_一等奖差异化创新证据包_机器可读.json",
                "参赛提交材料包/62_主张证据账本与真实性核验包.md",
                "参赛提交材料包/62_主张证据账本与真实性核验包_机器可读.json",
                "参赛提交材料包/63_Sites云端发布预检与替代上线路线.md",
                "参赛提交材料包/63_Sites云端发布预检与替代上线路线_机器可读.json",
                "参赛提交材料包/64_最终公开URL验收器与回执模板.md",
                "参赛提交材料包/64_最终公开URL验收器与回执模板_机器可读.json",
                "参赛提交材料包/65_公网静态站点上传包与验收说明.md",
                "参赛提交材料包/65_公网静态站点上传包与验收说明_机器可读.json",
                "参赛提交材料包/public-site-upload/README_公网静态上传包.md",
                "参赛提交材料包/public-site-upload/PUBLIC_SITE_UPLOAD_MANIFEST.json",
                "参赛提交材料包/public-site-upload/SE-Path学伴_公开静态站点上传包_v0.1.zip",
                "参赛提交材料包/66_公网发布指挥台与提交日操作卡.md",
                "参赛提交材料包/66_公网发布指挥台与提交日操作卡_机器可读.json",
                "参赛提交材料包/public-launch-command/PUBLIC_LAUNCH_COMMAND.json",
                "参赛提交材料包/public-launch-command/LAUNCH_STEPS.md",
                "参赛提交材料包/public-launch-command/RUN_AFTER_DEPLOY.ps1",
                "参赛提交材料包/public-launch-command/RUN_AFTER_DEPLOY.cmd",
                "参赛提交材料包/67_静态托管平台配置自检与故障恢复卡.md",
                "参赛提交材料包/67_静态托管平台配置自检与故障恢复卡_机器可读.json",
                "参赛提交材料包/68_正式提交填报工作台与人工门禁补全卡.md",
                "参赛提交材料包/68_正式提交填报工作台与人工门禁补全卡_机器可读.json",
                "参赛提交材料包/69_赛题要求逐项对齐矩阵与夺奖证据总表.md",
                "参赛提交材料包/69_赛题要求逐项对齐矩阵与夺奖证据总表_机器可读.json",
                "参赛提交材料包/competition-requirement-alignment/COMPETITION_REQUIREMENT_ALIGNMENT.json",
                "参赛提交材料包/competition-requirement-alignment/manifest_checks.json",
                "参赛提交材料包/competition-requirement-alignment/requirement_alignment_matrix.csv",
                "参赛提交材料包/competition-requirement-alignment/judge_requirement_checklist.md",
                "参赛提交材料包/competition-requirement-alignment/risk_boundary_cards.md",
                "参赛提交材料包/70_公网部署实操包与回执封存说明.md",
                "参赛提交材料包/70_公网部署实操包与回执封存说明_机器可读.json",
                "参赛提交材料包/71_公网URL回填后的正式提交收口说明.md",
                "参赛提交材料包/71_公网URL回填后的正式提交收口说明_机器可读.json",
                "参赛提交材料包/72_标准化部署配置与容器化验收说明.md",
                "参赛提交材料包/72_标准化部署配置与容器化验收说明_机器可读.json",
                "参赛提交材料包/public-deploy-playbook/PUBLIC_DEPLOY_PLAYBOOK.json",
                "参赛提交材料包/public-deploy-playbook/manifest_checks.json",
                "参赛提交材料包/public-deploy-playbook/platform_deploy_matrix.csv",
                "参赛提交材料包/public-deploy-playbook/DEPLOY_DAY_CHECKLIST.md",
                "参赛提交材料包/public-deploy-playbook/URL_RECEIPT_SEALING.md",
                "参赛提交材料包/public-deploy-playbook/FAILURE_RECOVERY.md",
                "参赛提交材料包/public-deploy-playbook/INDEX_SYNC_REPORT.json",
                "参赛提交材料包/public-deploy-playbook/RUN_DEPLOY_PLAYBOOK.ps1",
                "参赛提交材料包/public-deploy-playbook/RUN_DEPLOY_PLAYBOOK.cmd",
                "参赛提交材料包/final-submission-workspace/README.md",
                "参赛提交材料包/final-submission-workspace/final_submission_profile.todo.json",
                "参赛提交材料包/final-submission-workspace/final_submission_manual_checklist.md",
                "参赛提交材料包/final-submission-workspace/final_submission_manual_checklist.json",
                "参赛提交材料包/public-hosting-selftest/HOSTING_UPLOAD_SELFTEST.json",
                "参赛提交材料包/public-hosting-selftest/manifest_checks.json",
                "参赛提交材料包/public-hosting-selftest/README.md",
                "参赛提交材料包/public-hosting-selftest/HOSTING_PROVIDER_MATRIX.csv",
                "参赛提交材料包/public-hosting-selftest/HOSTING_TROUBLESHOOTING.md",
                "参赛提交材料包/public-hosting-selftest/RUN_HOSTING_SELFTEST.ps1",
                "参赛提交材料包/public-hosting-selftest/RUN_HOSTING_SELFTEST.cmd",
                "参赛提交材料包/trial/anonymous-analysis-pack/analysis_summary.json",
                "参赛提交材料包/trial/anonymous-analysis-pack/analysis_report.md",
                "参赛提交材料包/trial/anonymous-analysis-pack/trial-anonymous-events.csv",
                "参赛提交材料包/trial/anonymous-analysis-pack/trial-outcomes.csv",
                "参赛提交材料包/trial/anonymous-analysis-pack/trial-baseline.csv",
                "参赛提交材料包/trial/anonymous-analysis-pack/trial-teacher-anchors.csv",
                "参赛提交材料包/trial/anonymous-analysis-pack/trial-claim-snapshot.json",
                "参赛提交材料包/reviewer-5min-drill/README.md",
                "参赛提交材料包/reviewer-5min-drill/REVIEWER_5MIN_DRILL.json",
                "参赛提交材料包/reviewer-5min-drill/manifest_checks.json",
                "参赛提交材料包/reviewer-5min-drill/drill_trace.json",
                "参赛提交材料包/reviewer-5min-drill/drill_scorecard.csv",
                "参赛提交材料包/reviewer-5min-drill/quick_start.md",
                "参赛提交材料包/reviewer-5min-drill/fallback_cards.md",
                "参赛提交材料包/reviewer-5min-drill/teacher_review_deep_dive.md",
                "参赛提交材料包/reviewer-5min-drill/boundary_and_claims.md",
                "参赛提交材料包/judge-route-orchestrator/JUDGE_ROUTE_ORCHESTRATOR.json",
                "参赛提交材料包/judge-route-orchestrator/manifest_checks.json",
                "参赛提交材料包/judge-route-orchestrator/route_cards.md",
                "参赛提交材料包/judge-route-orchestrator/route_matrix.csv",
                "参赛提交材料包/local-run-doctor/LOCAL_RUN_DOCTOR.json",
                "参赛提交材料包/local-run-doctor/manifest_checks.json",
                "参赛提交材料包/local-run-doctor/README.md",
                "参赛提交材料包/local-run-doctor/LOCAL_RUN_CHECKLIST.md",
                "参赛提交材料包/local-run-doctor/fallback_routes.md",
                "参赛提交材料包/local-run-doctor/local_env_matrix.csv",
                "参赛提交材料包/local-run-doctor/RUN_LOCAL_DEMO.ps1",
                "参赛提交材料包/local-run-doctor/RUN_LOCAL_DEMO.cmd",
                "参赛提交材料包/submission-upload-preflight/UPLOAD_PREFLIGHT.json",
                "参赛提交材料包/submission-upload-preflight/manifest_checks.json",
                "参赛提交材料包/submission-upload-preflight/UPLOAD_CHECKLIST.md",
                "参赛提交材料包/submission-upload-preflight/platform_form_fields.csv",
                "参赛提交材料包/submission-upload-preflight/upload_receipt_template.md",
                "参赛提交材料包/submission-upload-preflight/final_upload_timeline.md",
                "参赛提交材料包/award-differentiation/AWARD_DIFFERENTIATION.json",
                "参赛提交材料包/award-differentiation/manifest_checks.json",
                "参赛提交材料包/award-differentiation/score_evidence_matrix.csv",
                "参赛提交材料包/award-differentiation/judge_objection_cards.md",
                "参赛提交材料包/award-differentiation/one_minute_pitch.md",
                "参赛提交材料包/award-differentiation/innovation_map.md",
                "参赛提交材料包/claim-evidence-ledger/CLAIM_EVIDENCE_LEDGER.json",
                "参赛提交材料包/claim-evidence-ledger/manifest_checks.json",
                "参赛提交材料包/claim-evidence-ledger/claim_evidence_matrix.csv",
                "参赛提交材料包/claim-evidence-ledger/claim_tier_map.md",
                "参赛提交材料包/claim-evidence-ledger/forbidden_claims_crosscheck.md",
                "参赛提交材料包/claim-evidence-ledger/evidence_paths_index.csv",
                "参赛提交材料包/公开试用静态包/PUBLIC_HEALTH.json",
                "参赛提交材料包/公开试用静态包/PUBLIC_RELEASE.json",
                "参赛提交材料包/公开试用静态包/reviewer-guide-claim-ledger.png",
                "参赛提交材料包/公开试用静态包/public-url-receipt-panel.png",
                "参赛提交材料包/公开试用静态包/submission-closure-panel.png",
                "sepath-cloud-app/qa/public-url-validator-local-smoke.json",
                "参赛提交材料包/judge-launchpad/START_HERE.html",
                "参赛提交材料包/judge-launchpad/START_HERE.md",
                "参赛提交材料包/judge-launchpad/JUDGE_LAUNCHPAD_MANIFEST.json",
                "参赛提交材料包/judge-launchpad/manifest_checks.json",
                "SE-Path学伴_软件工程自适应学习伙伴智能体_产品设计方案/figures/plantuml/25_产品内决赛追问指挥台.puml",
                "sepath-cloud-app/src/engine/finalDefense.ts",
                "sepath-cloud-app/src/components/FinalDefensePanel.tsx",
                "sepath-cloud-app/src/engine/launchLoopAcceptance.ts",
                "sepath-cloud-app/src/components/LaunchLoopAcceptancePanel.tsx",
                "sepath-cloud-app/src/engine/pilotEvidenceBinder.ts",
                "sepath-cloud-app/src/components/PilotEvidenceBinderPanel.tsx",
                "sepath-cloud-app/src/engine/claimEvidenceLedger.ts",
                "sepath-cloud-app/src/components/ClaimEvidenceLedgerPanel.tsx",
                "sepath-cloud-app/src/engine/hostingSelftest.ts",
                "sepath-cloud-app/src/components/HostingSelftestPanel.tsx",
                "sepath-cloud-app/src/engine/competitionAlignment.ts",
                "sepath-cloud-app/src/components/CompetitionAlignmentPanel.tsx",
                "sepath-cloud-app/src/engine/submissionClosure.ts",
                "sepath-cloud-app/src/components/SubmissionClosurePanel.tsx",
                "sepath-sites-app/src/engine/submissionClosure.ts",
                "sepath-sites-app/src/components/SubmissionClosurePanel.tsx",
                "sepath-cloud-app/qa/screenshots/launch-loop-panel.png",
                "sepath-cloud-app/qa/screenshots/launch-loop-panel-mobile.png",
                "sepath-cloud-app/qa/screenshots/competition-alignment-panel.png",
                "sepath-cloud-app/qa/screenshots/public-url-receipt-panel.png",
                "sepath-cloud-app/qa/screenshots/public-url-receipt-panel-mobile.png",
                "sepath-cloud-app/qa/screenshots/submission-closure-panel.png",
                "sepath-cloud-app/qa/screenshots/submission-closure-panel-mobile.png",
                "sepath-cloud-app/DEPLOY_PUBLIC.md",
                "sepath-cloud-app/vercel.json",
                "sepath-cloud-app/netlify.toml",
                "sepath-cloud-app/Dockerfile",
                "sepath-cloud-app/nginx.conf",
                "sepath-cloud-app/.env.example",
                "sepath-cloud-app/.dockerignore",
                "sepath-cloud-app/docker-compose.yml",
                "sepath-cloud-app/qa/deploy-artifacts-validation.json",
                "scripts/verify_release_consistency.py",
                "scripts/release_gate.py",
                "scripts/validate_deploy_artifacts.py",
                "scripts/build_final_submission_profile.py",
                "scripts/prepare_final_named_submission.py",
                "scripts/generate_award_completion_audit.py",
                "scripts/generate_launch_loop_acceptance.py",
                "scripts/generate_pilot_evidence_binder.py",
                "scripts/generate_trial_analysis_pack.py",
                "scripts/generate_reviewer_5min_drill_pack.py",
                "scripts/generate_judge_route_orchestrator.py",
                "scripts/generate_local_run_doctor_pack.py",
                "scripts/generate_submission_upload_preflight_pack.py",
                "scripts/generate_award_differentiation_pack.py",
                "scripts/generate_claim_evidence_ledger_pack.py",
                "scripts/generate_competition_requirement_alignment_pack.py",
                "scripts/generate_judge_launchpad.py",
                "scripts/build_public_site_upload_artifact.py",
                "scripts/generate_public_launch_commander.py",
                "scripts/generate_sites_publish_preflight.py",
                "scripts/generate_final_submission_workspace.py",
                "scripts/generate_hosting_upload_selftest_pack.py",
                "scripts/generate_public_deploy_playbook_pack.py",
                "scripts/sync_public_deploy_index_materials.py",
                "scripts/validate_public_url_release.py",
                "scripts/smoke_public_url_validator_local.py",
                "scripts/finalize_public_url_receipt.py",
                "scripts/finalize_submission_after_public_url.py",
            }
            missing = sorted(required - names)
        rows.append(
            row(
                "zip contains final defense and release scripts",
                bad is None and not missing,
                "zipfile.testzip() pass; missing=" + ",".join(missing),
                package_path,
            )
        )
    else:
        rows.append(row("zip contains final defense and release scripts", False, "package missing", package_path))

    release_text = release_path.read_text(encoding="utf-8", errors="replace")
    rows.append(
        row(
            "release report has no mojibake markers",
            "����" not in release_text and "\ufffd" not in release_text,
            "checked common replacement markers",
            release_path,
        )
    )

    summary = {
        "PASS": sum(1 for item in rows if item["status"] == "PASS"),
        "FAIL": sum(1 for item in rows if item["status"] == "FAIL"),
    }
    result = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": summary,
        "rows": rows,
        "package": {
            "path": package_path.relative_to(ROOT).as_posix(),
            "sha256": manifest.get("package_sha256"),
            "bytes": manifest.get("package_size_bytes"),
            "file_count": manifest.get("file_count"),
        },
    }
    REPORT.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result["summary"], ensure_ascii=False, indent=2))
    print(f"report: {REPORT.relative_to(ROOT).as_posix()}")
    return 0 if summary["FAIL"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
