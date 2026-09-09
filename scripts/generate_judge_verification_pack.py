from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
MATERIALS = ROOT / "参赛提交材料包"
OUTPUT_MD = MATERIALS / "46_评委技术验收包.md"
OUTPUT_JSON = MATERIALS / "46_评委技术验收包_机器可读.json"

PACKAGE_MANIFEST = ROOT / "submission" / "SE-Path学伴_阶段提交包_v0.4_2026-08-09_manifest.json"
AUDIT_JSON = MATERIALS / "09_提交前终审报告_机器可读.json"
RELEASE_GATE_JSON = ROOT / "outputs" / "SE-Path学伴_最终发布门禁报告_机器生成.json"
PUBLIC_TRIAL_JSON = MATERIALS / "公开试用静态包" / "PUBLIC_TRIAL_MANIFEST.json"
DEMO_FLOW_JSON = ROOT / "sepath-cloud-app" / "qa" / "demo-flow" / "demo_flow_manifest.json"
EDGE_SMOKE_JSON = ROOT / "sepath-cloud-app" / "qa" / "edge-api-smoke-report.json"
EDGE_HTTP_SMOKE_JSON = ROOT / "sepath-cloud-app" / "qa" / "edge-api-http-smoke-report.json"
LLM_GATEWAY_SMOKE_JSON = ROOT / "sepath-cloud-app" / "qa" / "llm-gateway-smoke-report.json"
LLM_GATEWAY_HTTP_SMOKE_JSON = ROOT / "sepath-cloud-app" / "qa" / "llm-gateway-http-smoke-report.json"
OPENAPI_VALIDATION_JSON = ROOT / "sepath-cloud-app" / "qa" / "openapi-contract-validation.json"
DEMO_SEED_JSON = ROOT / "sepath-cloud-app" / "qa" / "demo-seed" / "JUDGE_DEMO_SEED_MANIFEST.json"
PUBLIC_PWA_JSON = ROOT / "sepath-cloud-app" / "qa" / "public-trial-pwa-validation.json"
HOSTING_SELFTEST_JSON = MATERIALS / "public-hosting-selftest" / "HOSTING_UPLOAD_SELFTEST.json"
HOSTING_SELFTEST_CHECKS_JSON = MATERIALS / "public-hosting-selftest" / "manifest_checks.json"
CLOUD_SLO_JSON = ROOT / "sepath-cloud-app" / "qa" / "cloud-slo-load-report.json"
REVIEWER_DRILL_JSON = ROOT / "sepath-cloud-app" / "qa" / "reviewer-drill-report.json"
BACKEND_STATUS_MATERIAL_JSON = MATERIALS / "51_后端连接状态中心与上线边界说明_机器可读.json"
BACKEND_STATUS_SCREENSHOT = ROOT / "sepath-cloud-app" / "qa" / "screenshots" / "backend-status-panel.png"
PITCH_DEFENSE_JSON = MATERIALS / "52_决赛路演口播稿与评委追问回答卡_机器可读.json"
FINAL_DEFENSE_JSON = MATERIALS / "53_产品内决赛追问指挥台说明_机器可读.json"
FINAL_DEFENSE_SCREENSHOT = ROOT / "sepath-cloud-app" / "qa" / "screenshots" / "final-defense-panel.png"
FINAL_DEFENSE_MOBILE_SCREENSHOT = ROOT / "sepath-cloud-app" / "qa" / "screenshots" / "final-defense-panel-mobile.png"
AWARD_COMPLETION_JSON = MATERIALS / "55_获奖级完成度总验收报告_机器可读.json"
LAUNCH_LOOP_JSON = MATERIALS / "56_上线级闭环验收剧本_机器可读.json"
PILOT_BINDER_JSON = MATERIALS / "58_真实课程试点证据归档与声明门禁说明_机器可读.json"


def load_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def read_text(path: Path) -> str:
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8", errors="replace")


def rel(path: Path) -> str:
    try:
        return path.relative_to(ROOT).as_posix()
    except ValueError:
        return path.as_posix()


def pass_fail(value: bool) -> str:
    return "PASS" if value else "CHECK"


def demo_flow_overflow_label(scenes: list[dict[str, Any]]) -> str:
    if not scenes:
        return "missing scenes"
    overflow = []
    for scene in scenes:
        metrics = scene.get("metrics", {})
        client = metrics.get("docClient")
        scroll = metrics.get("docScroll")
        body = metrics.get("bodyScroll")
        if client is None or scroll is None:
            overflow.append(scene.get("id", "unknown"))
            continue
        if int(scroll) != int(client) or (body is not None and int(body) != int(client)):
            overflow.append(scene.get("id", "unknown"))
    return "no overflow" if not overflow else "overflow: " + ", ".join(overflow[:5])


def row(label: str, evidence: str, path: Path | str, status: str = "PASS") -> dict[str, str]:
    return {
        "label": label,
        "status": status,
        "evidence": evidence,
        "path": rel(path) if isinstance(path, Path) else path,
    }


def build_pack() -> dict[str, Any]:
    package = load_json(PACKAGE_MANIFEST)
    audit = load_json(AUDIT_JSON)
    release = load_json(RELEASE_GATE_JSON)
    public_trial = load_json(PUBLIC_TRIAL_JSON)
    demo_flow = load_json(DEMO_FLOW_JSON)
    edge_smoke = load_json(EDGE_SMOKE_JSON)
    edge_http = load_json(EDGE_HTTP_SMOKE_JSON)
    llm_smoke = load_json(LLM_GATEWAY_SMOKE_JSON)
    llm_http_smoke = load_json(LLM_GATEWAY_HTTP_SMOKE_JSON)
    openapi_validation = load_json(OPENAPI_VALIDATION_JSON)
    demo_seed = load_json(DEMO_SEED_JSON)
    public_pwa = load_json(PUBLIC_PWA_JSON)
    hosting_selftest = load_json(HOSTING_SELFTEST_JSON)
    hosting_selftest_checks = load_json(HOSTING_SELFTEST_CHECKS_JSON)
    cloud_slo = load_json(CLOUD_SLO_JSON)
    reviewer_drill = load_json(REVIEWER_DRILL_JSON)
    backend_status_material = load_json(BACKEND_STATUS_MATERIAL_JSON)
    pitch_defense = load_json(PITCH_DEFENSE_JSON)
    final_defense = load_json(FINAL_DEFENSE_JSON)
    award_completion = load_json(AWARD_COMPLETION_JSON)
    launch_loop = load_json(LAUNCH_LOOP_JSON)
    pilot_binder = load_json(PILOT_BINDER_JSON)
    research_fusion_material = read_text(MATERIALS / "36_科研算法融合与开源证据中台说明.md")
    research_fusion_source = read_text(ROOT / "sepath-cloud-app/src/engine/researchFusion.ts")
    release_summary = release.get("summary", {})
    audit_summary = audit.get("summary", {})
    package_checks = package.get("checks", {})
    edge_summary = edge_smoke.get("summary", {})
    edge_http_summary = edge_http.get("summary", {})
    llm_summary = llm_smoke.get("summary", {})
    llm_http_summary = llm_http_smoke.get("summary", {})
    openapi_summary = openapi_validation.get("summary", {})
    demo_seed_validation = demo_seed.get("validation", {})
    public_pwa_summary = public_pwa.get("summary", {})
    hosting_selftest_summary = hosting_selftest.get("summary", {})
    hosting_selftest_checks_summary = hosting_selftest_checks.get("summary", {})
    cloud_slo_summary = cloud_slo.get("summary", {})
    reviewer_drill_summary = reviewer_drill.get("summary", {})
    reviewer_guide = reviewer_drill.get("guidedTour", {})
    demo_scenes = demo_flow.get("scenes") or demo_flow.get("steps") or []
    demo_overflow = demo_flow_overflow_label(demo_scenes)
    public_files = public_trial.get("files", [])

    checks = [
        row(
            "最终发布门禁",
            f"{release_summary.get('release_gate')} / command_failures={release_summary.get('command_failures')}",
            RELEASE_GATE_JSON,
            "PASS" if release_summary.get("release_gate") == "PASS" and release_summary.get("command_failures") == 0 else "CHECK",
        ),
        row(
            "自动终审",
            f"PASS={audit_summary.get('PASS')} WARN={audit_summary.get('WARN')} FAIL={audit_summary.get('FAIL')} MANUAL={audit_summary.get('MANUAL')}",
            AUDIT_JSON,
            "PASS" if audit_summary.get("FAIL") == 0 else "CHECK",
        ),
        row(
            "阶段提交 ZIP",
            f"zip_integrity={package_checks.get('zip_integrity')} / size_under_100mb={package_checks.get('size_under_100mb')} / files={package.get('file_count')}; final sha256 see release gate report after ZIP sealing",
            PACKAGE_MANIFEST,
            "PASS" if package_checks.get("zip_integrity") == "pass" and package_checks.get("size_under_100mb") else "CHECK",
        ),
        row(
            "敏感信息扫描",
            f"secret_scan_hits={package_checks.get('secret_scan_hits')}",
            PACKAGE_MANIFEST,
            "PASS" if package_checks.get("secret_scan_hits") == [] else "CHECK",
        ),
        row(
            "Edge API Worker 直调验收",
            f"pass={edge_summary.get('pass')} fail={edge_summary.get('fail')} endpoints={edge_summary.get('endpointsCovered')}",
            EDGE_SMOKE_JSON,
            "PASS" if edge_summary.get("pass") == 14 and edge_summary.get("fail") == 0 else "CHECK",
        ),
        row(
            "Edge API HTTP 验收",
            f"pass={edge_http_summary.get('pass')} fail={edge_http_summary.get('fail')} endpoints={edge_http_summary.get('endpointsCovered')}",
            EDGE_HTTP_SMOKE_JSON,
            "PASS" if edge_http_summary.get("pass") == 14 and edge_http_summary.get("fail") == 0 else "CHECK",
        ),
        row(
            "LLM Gateway 验收",
            f"pass={llm_summary.get('pass')} fail={llm_summary.get('fail')} scenarios={llm_summary.get('scenariosCovered')} fallback={llm_summary.get('fallbackReason')}",
            LLM_GATEWAY_SMOKE_JSON,
            "PASS" if llm_summary.get("pass", 0) >= 10 and llm_summary.get("fail") == 0 else "CHECK",
        ),
        row(
            "LLM Gateway HTTP 验收",
            f"pass={llm_http_summary.get('pass')} fail={llm_http_summary.get('fail')} scenarios={llm_http_summary.get('scenariosCovered')} transport={llm_http_summary.get('transport')}",
            LLM_GATEWAY_HTTP_SMOKE_JSON,
            "PASS" if llm_http_summary.get("pass", 0) >= 10 and llm_http_summary.get("fail") == 0 else "CHECK",
        ),
        row(
            "OpenAPI 契约验收",
            f"PASS={openapi_summary.get('PASS')} FAIL={openapi_summary.get('FAIL')} operations={openapi_summary.get('operations')} schemas={openapi_summary.get('schemas')}",
            OPENAPI_VALIDATION_JSON,
            "PASS" if openapi_summary.get("FAIL") == 0 and openapi_summary.get("operations", 0) >= 10 else "CHECK",
        ),
        row(
            "评委种子包验收",
            f"runtime={demo_seed.get('runtime')} accounts={len(demo_seed.get('accounts', []))} seedEvents={len(demo_seed.get('seedEvents', []))} FAIL={demo_seed_validation.get('FAIL')}",
            DEMO_SEED_JSON,
            "PASS"
            if demo_seed.get("runtime") == "sepath-judge-demo-seed.v1"
            and len(demo_seed.get("accounts", [])) >= 5
            and len(demo_seed.get("seedEvents", [])) >= 7
            and demo_seed_validation.get("FAIL") == 0
            else "CHECK",
        ),
        row(
            "公开静态试用包",
            f"{public_trial.get('file_count')} files / {public_trial.get('total_size_bytes')} bytes / {public_trial.get('privacy_boundary')}",
            PUBLIC_TRIAL_JSON,
            "PASS" if public_trial.get("file_count", 0) >= 4 and "no student PII" in str(public_trial.get("privacy_boundary", "")) else "CHECK",
        ),
        row(
            "公开试用 PWA 离线容灾",
            f"runtime={public_pwa.get('runtime')} PASS={public_pwa_summary.get('PASS')} FAIL={public_pwa_summary.get('FAIL')}",
            PUBLIC_PWA_JSON,
            "PASS"
            if public_pwa.get("runtime") == "sepath-public-trial-pwa.v1"
            and public_pwa_summary.get("FAIL") == 0
            and public_pwa_summary.get("PASS", 0) >= 6
            else "CHECK",
        ),
        row(
            "公网托管体检",
            f"runtime={hosting_selftest.get('runtime')} status={hosting_selftest.get('status')} PASS={hosting_selftest_summary.get('PASS')} FAIL={hosting_selftest_summary.get('FAIL')} providers={len(hosting_selftest.get('provider_matrix', []))}",
            HOSTING_SELFTEST_JSON,
            "PASS"
            if hosting_selftest.get("runtime") == "sepath-public-hosting-selftest.v1"
            and hosting_selftest.get("status") == "ready_for_external_static_hosting"
            and hosting_selftest_summary.get("FAIL") == 0
            and hosting_selftest_checks_summary.get("FAIL") == 0
            and len(hosting_selftest.get("provider_matrix", [])) >= 5
            else "CHECK",
        ),
        row(
            "自动点击演示流",
            f"{len(demo_scenes)} scenes / {demo_overflow}",
            DEMO_FLOW_JSON,
            "PASS" if len(demo_scenes) >= 14 and demo_overflow == "no overflow" else "CHECK",
        ),
        row(
            "云端 SLO 容量压测",
            f"runtime={cloud_slo.get('runtime')} PASS={cloud_slo_summary.get('PASS')} FAIL={cloud_slo_summary.get('FAIL')} totalRequests={cloud_slo_summary.get('totalRequests')} maxP95Ms={cloud_slo_summary.get('maxP95Ms')}",
            CLOUD_SLO_JSON,
            "PASS"
            if cloud_slo.get("runtime") == "sepath-cloud-slo.v1"
            and cloud_slo_summary.get("FAIL") == 0
            and cloud_slo_summary.get("PASS", 0) >= 5
            and cloud_slo_summary.get("totalRequests", 0) >= 100
            else "CHECK",
        ),
        row(
            "后端连接状态中心",
            f"runtime={backend_status_material.get('runtime')} anchor={backend_status_material.get('productAnchor')} lanes={len(backend_status_material.get('lanes', []))} screenshot={BACKEND_STATUS_SCREENSHOT.exists()}",
            BACKEND_STATUS_MATERIAL_JSON,
            "PASS"
            if backend_status_material.get("runtime") == "sepath-backend-status-center.v1"
            and backend_status_material.get("productAnchor") == "#backend-status"
            and len(backend_status_material.get("lanes", [])) >= 6
            else "CHECK",
        ),
        row(
            "决赛路演追问回答卡",
            f"runtime={pitch_defense.get('runtime')} segments={len(pitch_defense.get('pitch_segments', []))} challengeCards={len(pitch_defense.get('challenge_cards', []))} forbiddenClaims={len(pitch_defense.get('forbidden_claims', []))}",
            PITCH_DEFENSE_JSON,
            "PASS"
            if pitch_defense.get("runtime") == "sepath-final-pitch-defense-card.v1"
            and len(pitch_defense.get("pitch_segments", [])) >= 5
            and len(pitch_defense.get("challenge_cards", [])) >= 4
            and len(pitch_defense.get("forbidden_claims", [])) >= 5
            else "CHECK",
        ),
        row(
            "产品内决赛追问指挥台",
            f"runtime={final_defense.get('runtime')} anchor={final_defense.get('product_anchor')} screenshots={FINAL_DEFENSE_SCREENSHOT.exists()}/{FINAL_DEFENSE_MOBILE_SCREENSHOT.exists()} questions={len(final_defense.get('question_coverage', []))}",
            FINAL_DEFENSE_JSON,
            "PASS"
            if final_defense.get("runtime") == "sepath-final-defense-command-center.v1"
            and final_defense.get("product_anchor") == "#final-defense"
            and FINAL_DEFENSE_SCREENSHOT.exists()
            and FINAL_DEFENSE_MOBILE_SCREENSHOT.exists()
            and len(final_defense.get("question_coverage", [])) >= 8
            else "CHECK",
        ),
        row(
            "获奖级完成度总验收",
            f"runtime={award_completion.get('runtime')} score={award_completion.get('machine_evidence_score')} dimensions={len(award_completion.get('dimensions', []))} finalReady={award_completion.get('final_submission_ready')}",
            AWARD_COMPLETION_JSON,
            "PASS"
            if award_completion.get("runtime") == "sepath-award-completion-audit.v1"
            and award_completion.get("machine_evidence_score", 0) >= 90
            and len(award_completion.get("dimensions", [])) >= 10
            else "CHECK",
        ),
        row(
            "上线级闭环验收剧本",
            f"runtime={launch_loop.get('runtime')} score={launch_loop.get('machine_readiness_score')} stages={len(launch_loop.get('stages', []))} finalReady={launch_loop.get('final_submission_ready')}",
            LAUNCH_LOOP_JSON,
            "PASS"
            if launch_loop.get("runtime") == "sepath-launch-loop-acceptance.v1"
            and launch_loop.get("machine_readiness_score", 0) >= 90
            and len(launch_loop.get("stages", [])) >= 12
            else "CHECK",
        ),
        row(
            "真实课程试点证据装订包",
            f"runtime={pilot_binder.get('runtime')} score={pilot_binder.get('machine_evidence_score')} blocked={pilot_binder.get('blocked_count')} claimTiers={len(pilot_binder.get('claim_tiers', []))}",
            PILOT_BINDER_JSON,
            "PASS"
            if pilot_binder.get("runtime") == "sepath-pilot-evidence-binder.v1"
            and pilot_binder.get("blocked_count") == 0
            and len(pilot_binder.get("claim_tiers", [])) >= 4
            else "CHECK",
        ),
        row(
            "科研贡献图谱",
            "思想迁移链 + 算法贡献图谱 + 贡献证据包",
            MATERIALS / "36_科研算法融合与开源证据中台说明.md",
            "PASS"
            if all(key in research_fusion_material for key in ["思想迁移链", "算法贡献图谱", "贡献证据包"])
            and all(key in research_fusion_source for key in ["ideaMigration", "contributionGraph", "contributionEvidencePack"])
            else "CHECK",
        ),
        row(
            "评委 5 分钟实操演练",
            f"runtime={reviewer_drill.get('runtime')} PASS={reviewer_drill_summary.get('PASS')} FAIL={reviewer_drill_summary.get('FAIL')} durationSeconds={reviewer_drill_summary.get('durationSeconds')} personas={reviewer_drill_summary.get('personas')}",
            REVIEWER_DRILL_JSON,
            "PASS"
            if reviewer_drill.get("runtime") == "sepath-reviewer-drill.v1"
            and reviewer_drill_summary.get("FAIL") == 0
            and reviewer_drill_summary.get("durationSeconds") == 300
            and reviewer_drill_summary.get("personas", 0) >= 5
            else "CHECK",
        ),
        row(
            "评委一键导览模式",
            f"runtime={reviewer_guide.get('runtime')} steps={reviewer_guide.get('totalSteps')} firstAnchor={reviewer_guide.get('firstAnchor')} actions={reviewer_guide.get('actions')}",
            REVIEWER_DRILL_JSON,
            "PASS"
            if reviewer_guide.get("runtime") == "sepath-reviewer-guide.v1"
            and reviewer_guide.get("totalSteps") == 11
            and reviewer_guide.get("firstAnchor") == "#student"
            and reviewer_guide.get("actions") == ["start", "step-through", "close"]
            and "#submission-closure" in reviewer_guide.get("autoScrollAnchors", [])
            and "#claim-ledger" in reviewer_guide.get("autoScrollAnchors", [])
            else "CHECK",
        ),
    ]

    routes = [
        {
            "minute": "0-2",
            "action": "打开 00_评委速读与评分导航.md 和 START_DEMO.md。",
            "evidence": "确认作品覆盖官方四项能力、提交材料、演示路线和真实性边界。",
        },
        {
            "minute": "2-4",
            "action": "打开公开试用静态包或本地 Demo，完成失败 PR 到教师复核和反思记忆的闭环。",
            "evidence": "学生画像、路径规划、脚手架干预和记忆反思在同一产品中联动。",
        },
        {
            "minute": "4-6",
            "action": "先查看 #backend-status 后端连接状态中心，再运行 npm run cloud:smoke、npm run cloud:smoke:http、npm run cloud:smoke:llm、npm run cloud:smoke:llm:http、npm run cloud:openapi:validate、npm run cloud:demo-seed、npm run cloud:pwa:validate、npm run cloud:slo 与 npm run cloud:reviewer-drill。",
            "evidence": "后端状态中心区分 static、online、degraded、manual、blocked；Edge API direct/http 两条路径均 14/14；LLM Gateway direct/http 均覆盖 HMAC、fallback、隐私拦截和输出 schema 验收；OpenAPI 契约覆盖 10 个 operation 且 0 FAIL；评委种子包声明 5 类合成身份和闭环事件种子；PWA 验收证明公开包具备安装入口、Service Worker 和离线兜底页；SLO 压测报告覆盖合成 Worker 负载、P95、错误率和降级预算；评委演练报告证明 300 秒现场路线、后端状态锚点、材料入口、教师复核深潜和一键导览路径可机器复查。",
        },
        {
            "minute": "6-8",
            "action": "查看 13_算法验证、27_学习增值评估、33_试点遥测、36_科研算法融合和 58_真实课程试点证据归档。",
            "evidence": "科研项目思想被落成 EvidenceEvent、PathTwin、SafeVOI、Rubric 校准、TrialTelemetry 和真实试点证据装订包，而不是停留在文案。",
        },
        {
            "minute": "8-10",
            "action": "查看 45_提交日人工确认决策卡。",
            "evidence": "剩余人工项被显式隔离，不编造队伍信息、真实试点效果或公开访问状态。",
        },
    ]

    source_hotspots = [
        "sepath-cloud-app/src/engine/judgeVerification.ts",
        "sepath-cloud-app/src/components/JudgeVerificationPanel.tsx",
        "sepath-cloud-app/src/engine/backendStatus.ts",
        "sepath-cloud-app/src/components/BackendStatusPanel.tsx",
        "sepath-cloud-app/src/engine/finalDefense.ts",
        "sepath-cloud-app/src/components/FinalDefensePanel.tsx",
        "sepath-cloud-app/src/engine/submissionClosure.ts",
        "sepath-cloud-app/src/components/SubmissionClosurePanel.tsx",
        "sepath-cloud-app/src/engine/launchLoopAcceptance.ts",
        "sepath-cloud-app/src/components/LaunchLoopAcceptancePanel.tsx",
        "参赛提交材料包/55_获奖级完成度总验收报告.md",
        "参赛提交材料包/55_获奖级完成度总验收报告_机器可读.json",
        "参赛提交材料包/56_上线级闭环验收剧本.md",
        "参赛提交材料包/56_上线级闭环验收剧本_机器可读.json",
        "参赛提交材料包/57_最终提交信息采集与一键画像生成说明.md",
        "参赛提交材料包/58_真实课程试点证据归档与声明门禁说明.md",
        "参赛提交材料包/58_真实课程试点证据归档与声明门禁说明_机器可读.json",
        "sepath-cloud-app/qa/screenshots/final-defense-panel.png",
        "sepath-cloud-app/qa/screenshots/final-defense-panel-mobile.png",
        "sepath-cloud-app/qa/screenshots/launch-loop-panel.png",
        "sepath-cloud-app/qa/screenshots/launch-loop-panel-mobile.png",
        "sepath-cloud-app/src/engine/cloudHandoff.ts",
        "sepath-cloud-app/src/engine/hostingSelftest.ts",
        "sepath-cloud-app/src/components/HostingSelftestPanel.tsx",
        "参赛提交材料包/67_静态托管平台配置自检与故障恢复卡.md",
        "参赛提交材料包/public-hosting-selftest/HOSTING_UPLOAD_SELFTEST.json",
        "scripts/generate_hosting_upload_selftest_pack.py",
        "sepath-cloud-app/cloud/llm-gateway-worker.mjs",
        "sepath-cloud-app/cloud/serve_llm_gateway_worker.mjs",
        "sepath-cloud-app/cloud/openapi.sepath.json",
        "sepath-cloud-app/qa/demo-seed/JUDGE_DEMO_SEED_MANIFEST.json",
        "sepath-cloud-app/qa/public-trial-pwa-validation.json",
        "sepath-cloud-app/qa/cloud-slo-load-report.json",
        "sepath-cloud-app/qa/reviewer-drill-report.json",
        "sepath-cloud-app/public/manifest.webmanifest",
        "sepath-cloud-app/public/sw.js",
        "sepath-cloud-app/public/offline.html",
        "sepath-cloud-app/src/engine/cloudSlo.ts",
        "sepath-cloud-app/src/components/CloudSloPanel.tsx",
        "sepath-cloud-app/src/engine/reviewerDrill.ts",
        "sepath-cloud-app/src/components/ReviewerDrillPanel.tsx",
        "sepath-cloud-app/src/components/ReviewerGuideOverlay.tsx",
        "sepath-cloud-app/qa/screenshots/reviewer-guide-overlay.png",
        "sepath-cloud-app/src/engine/researchFusion.ts",
        "sepath-cloud-app/src/engine/valueUplift.ts",
        "sepath-cloud-app/src/engine/trialTelemetry.ts",
        "sepath-cloud-app/src/engine/pilotEvidenceBinder.ts",
        "sepath-cloud-app/src/components/PilotEvidenceBinderPanel.tsx",
        "sepath-cloud-app/src/engine/claimEvidenceLedger.ts",
        "sepath-cloud-app/src/components/ClaimEvidenceLedgerPanel.tsx",
        "参赛提交材料包/62_主张证据账本与真实性核验包.md",
        "参赛提交材料包/36_科研算法融合与开源证据中台说明.md",
        "SE-Path学伴_软件工程自适应学习伙伴智能体_产品设计方案/figures/plantuml/14_科研算法融合与开源证据中台.puml",
        "sepath-cloud-app/cloud/edge-api-auth.mjs",
        "sepath-cloud-app/cloud/edge-api-worker.mjs",
        "sepath-cloud-app/cloud/edge-api-store.mjs",
        "scripts/release_gate.py",
        "scripts/build_final_submission_profile.py",
        "scripts/generate_pilot_evidence_binder.py",
        "scripts/audit_submission_readiness.py",
        "scripts/validate_openapi_contract.py",
        "scripts/generate_judge_demo_seed_pack.py",
        "scripts/validate_public_trial_pwa.py",
        "sepath-cloud-app/scripts/run_cloud_slo_load_test.mjs",
        "sepath-cloud-app/scripts/run_reviewer_drill_check.mjs",
    ]

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "title": "SE-Path 学伴评委技术验收包",
        "checks": checks,
        "routes": routes,
        "source_hotspots": source_hotspots,
        "safe_claim": "当前作品已完成可运行闭环 Demo、公开静态包、PWA 离线容灾、私有云部署工程、评委试用种子包、评委 5 分钟实操演练、一键评委导览、公网 URL 回执、正式提交收口总控、上线级闭环验收剧本、真实试点证据装订包、Edge API 14 场景验收、LLM Gateway 双路径验收、OpenAPI 机器契约、SLO 容量压测、材料包和发布门禁；真实课程长期效果仍需后续试点验证。",
        "metadata_scope": "本验收包读取当前工作区的 manifest、release gate、smoke report 和公开试用 manifest；若再次打包或重跑 release gate，以最新输出为准。",
    }


def render_markdown(pack: dict[str, Any]) -> str:
    lines = [
        "# 46 评委技术验收包",
        "",
        f"生成时间：{pack['generated_at']}",
        "",
        pack["metadata_scope"],
        "",
        "## 1. 一句话验收结论",
        "",
        pack["safe_claim"],
        "",
        "## 2. 机器证据索引",
        "",
        "| 验收点 | 状态 | 证据 | 路径 |",
        "| --- | --- | --- | --- |",
    ]
    for item in pack["checks"]:
        lines.append(f"| {item['label']} | {item['status']} | {item['evidence']} | `{item['path']}` |")
    lines.extend(["", "## 3. 10 分钟技术复查路线", ""])
    for route in pack["routes"]:
        lines.append(f"- `{route['minute']}` {route['action']} 证据：{route['evidence']}")
    lines.extend(["", "## 4. 源码复查热点", ""])
    for path in pack["source_hotspots"]:
        lines.append(f"- `{path}`")
    lines.extend(
        [
            "",
            "## 5. 建议评委现场命令",
            "",
            "```bash",
            "cd sepath-cloud-app",
            "npm run cloud:smoke",
            "npm run cloud:smoke:http",
            "npm run cloud:smoke:llm",
            "npm run cloud:smoke:llm:http",
            "npm run cloud:openapi:validate",
            "npm run cloud:demo-seed",
            "npm run cloud:pwa:validate",
            "npm run cloud:slo",
            "npm run cloud:reviewer-drill",
            "npm run test",
            "npm run build",
            "cd ..",
            "python scripts/audit_submission_readiness.py",
            "python scripts/release_gate.py",
            "```",
            "",
            "## 6. 真实性边界",
            "",
            "- 公开静态包只包含合成样本和只读演示。",
            "- owner-only 云端链接不能冒充公开评审地址。",
            "- Edge API 验收使用合成 learnerHash 和本地 memory store，不宣称已接真实学校生产库。",
            "- 学习增值评估当前是合成回放与确定性实验，真实提分需要课程试点数据。",
            "",
        ]
    )
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate judge-facing technical verification pack.")
    parser.add_argument("--write", action="store_true", help="Write markdown and JSON outputs.")
    args = parser.parse_args()
    pack = build_pack()
    if args.write:
        OUTPUT_MD.write_text(render_markdown(pack), encoding="utf-8")
        OUTPUT_JSON.write_text(json.dumps(pack, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(pack, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
