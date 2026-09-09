from __future__ import annotations

import json
import re
import shutil
import subprocess
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
MATERIALS = ROOT / "参赛提交材料包"
SUBMISSION = ROOT / "submission"
DESIGN = ROOT / "SE-Path学伴_软件工程自适应学习伙伴智能体_产品设计方案"
CLOUD_APP = ROOT / "sepath-cloud-app"
SITES_APP = ROOT / "sepath-sites-app"

PACKAGE = SUBMISSION / "SE-Path学伴_阶段提交包_v0.4_2026-08-09.zip"
MANIFEST = SUBMISSION / "SE-Path学伴_阶段提交包_v0.4_2026-08-09_manifest.json"
REPORT_MD = MATERIALS / "09_提交前终审报告.md"
REPORT_JSON = MATERIALS / "09_提交前终审报告_机器可读.json"

MAX_BYTES = 100 * 1024 * 1024


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(read_text(path))


def status(pass_condition: bool) -> str:
    return "PASS" if pass_condition else "FAIL"


def check_file(path: Path, label: str, min_bytes: int = 1) -> dict[str, Any]:
    exists = path.exists() and path.is_file()
    size = path.stat().st_size if exists else 0
    return {
        "label": label,
        "status": status(exists and size >= min_bytes),
        "path": rel(path) if path.exists() else rel(path),
        "evidence": f"{size} bytes" if exists else "missing",
    }


def load_manifest() -> dict[str, Any]:
    if not MANIFEST.exists():
        return {}
    return json.loads(read_text(MANIFEST))


def zip_checks() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    rows.append(
        {
            "label": "阶段提交 ZIP 存在",
            "status": status(PACKAGE.exists() and PACKAGE.is_file() and PACKAGE.stat().st_size >= 1024),
            "path": rel(PACKAGE),
            "evidence": "present; exact size and SHA are recorded in manifest",
        }
    )
    rows.append(
        {
            "label": "阶段提交 manifest 存在",
            "status": status(MANIFEST.exists() and MANIFEST.is_file() and MANIFEST.stat().st_size >= 1024),
            "path": rel(MANIFEST),
            "evidence": "present; authoritative package metadata",
        }
    )
    if PACKAGE.exists():
        with zipfile.ZipFile(PACKAGE) as archive:
            bad = archive.testzip()
            names = set(archive.namelist())
            rows.append(
                {
                    "label": "ZIP 完整性",
                    "status": "PASS" if bad is None else "FAIL",
                    "path": rel(PACKAGE),
                    "evidence": "zipfile.testzip() pass" if bad is None else f"bad entry: {bad}",
                }
            )
            required_entries = [
                "参赛提交材料包/00_评委速读与评分导航.md",
                "参赛提交材料包/00_评委一键打开入口.html",
                "参赛提交材料包/00_评委一键打开入口.md",
                "参赛提交材料包/README_提交材料总览.md",
                "参赛提交材料包/START_DEMO.md",
                "参赛提交材料包/SE-Path学伴_产品设计与原型验证方案_v0.2.pdf",
                "参赛提交材料包/SE-Path学伴_答辩PPT_v0.2.pptx",
                "参赛提交材料包/SE-Path学伴_答辩PPT_v0.2.pptx.inspect.ndjson",
                "参赛提交材料包/演示视频素材/SE-Path学伴_4分40秒演示视频素材_v0.3.mp4",
                "参赛提交材料包/演示视频素材/SE-Path学伴_正式旁白稿_v0.3.md",
                "参赛提交材料包/演示视频素材/SE-Path学伴_4分40秒旁白字幕_v0.3.srt",
                "参赛提交材料包/演示视频素材/SE-Path学伴_4分40秒旁白字幕_v0.3.vtt",
                "参赛提交材料包/演示视频素材/SE-Path学伴_v0.5复剪增补旁白.md",
                "参赛提交材料包/08_开源项目创新矩阵.md",
                "参赛提交材料包/10_比赛平台填写文案.md",
                "参赛提交材料包/11_上线试用与交付运维方案.md",
                "参赛提交材料包/12_最终发布门禁与一键验收说明.md",
                "参赛提交材料包/13_算法验证与科研证据说明.md",
                "参赛提交材料包/14_真实仓库接入与数据治理方案.md",
                "参赛提交材料包/15_班级GrowthOps与教师运营看板方案.md",
                "参赛提交材料包/16_公开试用发布包与云端迁移手册.md",
                "参赛提交材料包/17_策略实验室与SafeVOI对照仿真说明.md",
                "参赛提交材料包/18_课程试点上线工作台说明.md",
                "参赛提交材料包/19_证据账本导入恢复与工作空间迁移说明.md",
                "参赛提交材料包/20_权限与隐私治理中心说明.md",
                "参赛提交材料包/21_API与集成契约中心说明.md",
                "参赛提交材料包/22_模型与实验治理中心说明.md",
                "参赛提交材料包/23_课程配置与RubricStudio说明.md",
                "参赛提交材料包/24_教师周报与试点复盘中心说明.md",
                "参赛提交材料包/25_学生对话实验台与智能干预说明.md",
                "参赛提交材料包/26_集成回放沙箱与Webhook试运行说明.md",
                "参赛提交材料包/27_学习增值评估中心与科研算法融合说明.md",
                "参赛提交材料包/28_评委试用与交付控制台说明.md",
                "参赛提交材料包/29_AI Agent运行时与模型接入中心说明.md",
                "参赛提交材料包/30_课程开班向导与首周试点落地说明.md",
                "参赛提交材料包/31_比赛提交助手与材料封装说明.md",
                "参赛提交材料包/32_视频与路演导演说明.md",
                "参赛提交材料包/33_试点遥测与效果验证中心说明.md",
                "参赛提交材料包/34_多租户上云运营中心说明.md",
                "参赛提交材料包/35_教师标注与Rubric校准中心说明.md",
                "参赛提交材料包/36_科研算法融合与开源证据中台说明.md",
                "参赛提交材料包/37_推理网关与GraphRAG试验台说明.md",
                "参赛提交材料包/38_学校初始化与演示账号中心说明.md",
                "参赛提交材料包/39_生产数据平面与部署运维中心说明.md",
                "参赛提交材料包/40_最终提交上传作战手册.md",
                "参赛提交材料包/41_最终上传与路演控制台说明.md",
                "参赛提交材料包/42_干预发布与教学行动包中心说明.md",
                "参赛提交材料包/43_评委云端交付体检中心说明.md",
                "参赛提交材料包/44_EdgeAPI运行时与后端接口验收说明.md",
                "参赛提交材料包/45_提交日人工确认决策卡.md",
                "参赛提交材料包/45_提交日人工确认决策卡_机器可读.json",
                "参赛提交材料包/46_评委技术验收包.md",
                "参赛提交材料包/46_评委技术验收包_机器可读.json",
                "参赛提交材料包/47_评委试用账号与种子数据包.md",
                "参赛提交材料包/47_评委试用账号与种子数据包_机器可读.json",
                "参赛提交材料包/48_公开试用PWA离线容灾包说明.md",
                "参赛提交材料包/48_公开试用PWA离线容灾包说明_机器可读.json",
                "参赛提交材料包/49_云端SLO容量压测与成本预算说明.md",
                "参赛提交材料包/49_云端SLO容量压测与成本预算说明_机器可读.json",
                "参赛提交材料包/50_评委5分钟实操演练与教师复核深潜说明.md",
                "参赛提交材料包/50_评委5分钟实操演练与教师复核深潜说明_机器可读.json",
                "参赛提交材料包/reviewer-5min-drill/README.md",
                "参赛提交材料包/reviewer-5min-drill/REVIEWER_5MIN_DRILL.json",
                "参赛提交材料包/reviewer-5min-drill/manifest_checks.json",
                "参赛提交材料包/reviewer-5min-drill/drill_trace.json",
                "参赛提交材料包/reviewer-5min-drill/drill_scorecard.csv",
                "参赛提交材料包/reviewer-5min-drill/quick_start.md",
                "参赛提交材料包/reviewer-5min-drill/fallback_cards.md",
                "参赛提交材料包/reviewer-5min-drill/teacher_review_deep_dive.md",
                "参赛提交材料包/reviewer-5min-drill/boundary_and_claims.md",
                "参赛提交材料包/judge-launchpad/START_HERE.html",
                "参赛提交材料包/judge-launchpad/START_HERE.md",
                "参赛提交材料包/judge-launchpad/JUDGE_LAUNCHPAD_MANIFEST.json",
                "参赛提交材料包/judge-launchpad/manifest_checks.json",
                "参赛提交材料包/51_后端连接状态中心与上线边界说明.md",
                "参赛提交材料包/51_后端连接状态中心与上线边界说明_机器可读.json",
                "参赛提交材料包/52_决赛路演口播稿与评委追问回答卡.md",
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
                "参赛提交材料包/trial/anonymous-analysis-pack/README.md",
                "参赛提交材料包/trial/anonymous-analysis-pack/analysis_report.md",
                "参赛提交材料包/trial/anonymous-analysis-pack/analysis_summary.json",
                "参赛提交材料包/trial/anonymous-analysis-pack/trial-anonymous-events.csv",
                "参赛提交材料包/trial/anonymous-analysis-pack/trial-outcomes.csv",
                "参赛提交材料包/trial/anonymous-analysis-pack/trial-baseline.csv",
                "参赛提交材料包/trial/anonymous-analysis-pack/trial-teacher-anchors.csv",
                "参赛提交材料包/trial/anonymous-analysis-pack/trial-claim-snapshot.json",
                "参赛提交材料包/trial/anonymous-analysis-pack/charts/effect_summary.svg",
                "参赛提交材料包/公开试用静态包/index.html",
                "参赛提交材料包/公开试用静态包/README_公开试用.md",
                "参赛提交材料包/公开试用静态包/PUBLIC_TRIAL_MANIFEST.json",
                "参赛提交材料包/公开试用静态包/PUBLIC_HEALTH.json",
                "参赛提交材料包/公开试用静态包/PUBLIC_RELEASE.json",
                "参赛提交材料包/公开试用静态包/JUDGE_DEMO_SEED_MANIFEST.json",
                "参赛提交材料包/公开试用静态包/REVIEWER_DRILL_REPORT.json",
                "参赛提交材料包/公开试用静态包/reviewer-guide-overlay.png",
                "参赛提交材料包/公开试用静态包/reviewer-guide-claim-ledger.png",
                "参赛提交材料包/公开试用静态包/public-url-receipt-panel.png",
                "参赛提交材料包/公开试用静态包/submission-closure-panel.png",
                "参赛提交材料包/公开试用静态包/manifest.webmanifest",
                "参赛提交材料包/公开试用静态包/sw.js",
                "参赛提交材料包/公开试用静态包/offline.html",
                "参赛提交材料包/公开试用静态包/pwa-icon.svg",
                "参赛提交材料包/公开试用静态包/maskable-icon.svg",
                "sepath-cloud-app/qa/public-url-validator-local-smoke.json",
                "SE-Path学伴_软件工程自适应学习伙伴智能体_产品设计方案/figures/plantuml/11_AI Agent运行时与模型接入中心.puml",
                "SE-Path学伴_软件工程自适应学习伙伴智能体_产品设计方案/figures/plantuml/12_多租户上云运营中心.puml",
                "SE-Path学伴_软件工程自适应学习伙伴智能体_产品设计方案/figures/plantuml/13_教师标注与Rubric校准中心.puml",
                "SE-Path学伴_软件工程自适应学习伙伴智能体_产品设计方案/figures/plantuml/14_科研算法融合与开源证据中台.puml",
                "SE-Path学伴_软件工程自适应学习伙伴智能体_产品设计方案/figures/plantuml/15_推理网关与GraphRAG试验台.puml",
                "SE-Path学伴_软件工程自适应学习伙伴智能体_产品设计方案/figures/plantuml/16_学校初始化与演示账号中心.puml",
                "SE-Path学伴_软件工程自适应学习伙伴智能体_产品设计方案/figures/plantuml/17_生产数据平面与部署运维中心.puml",
                "SE-Path学伴_软件工程自适应学习伙伴智能体_产品设计方案/figures/plantuml/18_最终上传与路演控制台.puml",
                "SE-Path学伴_软件工程自适应学习伙伴智能体_产品设计方案/figures/plantuml/19_干预发布与教学行动包中心.puml",
                "SE-Path学伴_软件工程自适应学习伙伴智能体_产品设计方案/figures/plantuml/20_评委云端交付体检中心.puml",
                "SE-Path学伴_软件工程自适应学习伙伴智能体_产品设计方案/figures/plantuml/21_EdgeAPI运行时与后端接口验收.puml",
                "SE-Path学伴_软件工程自适应学习伙伴智能体_产品设计方案/figures/plantuml/22_云端SLO容量压测中心.puml",
                "SE-Path学伴_软件工程自适应学习伙伴智能体_产品设计方案/figures/plantuml/23_评委5分钟实操演练中心.puml",
                "SE-Path学伴_软件工程自适应学习伙伴智能体_产品设计方案/figures/plantuml/24_后端连接状态中心.puml",
                "SE-Path学伴_软件工程自适应学习伙伴智能体_产品设计方案/figures/plantuml/25_产品内决赛追问指挥台.puml",
                "scripts/release_gate.py",
                "scripts/build_public_trial_bundle.py",
                "scripts/build_public_site_upload_artifact.py",
                "scripts/generate_public_launch_commander.py",
                "scripts/generate_sites_publish_preflight.py",
                "scripts/generate_hosting_upload_selftest_pack.py",
                "scripts/generate_public_deploy_playbook_pack.py",
                "scripts/finalize_submission_after_public_url.py",
                "scripts/sync_public_deploy_index_materials.py",
                "scripts/generate_final_submission_workspace.py",
                "scripts/build_final_submission_profile.py",
                "scripts/prepare_final_named_submission.py",
                "scripts/generate_final_submission_decision_card.py",
                "scripts/generate_judge_verification_pack.py",
                "scripts/validate_openapi_contract.py",
                "scripts/generate_judge_demo_seed_pack.py",
                "scripts/validate_public_trial_pwa.py",
                "scripts/validate_public_url_release.py",
                "scripts/smoke_public_url_validator_local.py",
                "scripts/finalize_public_url_receipt.py",
                "scripts/validate_deploy_artifacts.py",
                "scripts/verify_release_consistency.py",
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
                "sepath-cloud-app/DEPLOY_PUBLIC.md",
                "sepath-cloud-app/public/manifest.webmanifest",
                "sepath-cloud-app/public/sw.js",
                "sepath-cloud-app/public/offline.html",
                "sepath-cloud-app/public/pwa-icon.svg",
                "sepath-cloud-app/public/maskable-icon.svg",
                "sepath-cloud-app/cloud/llm-gateway-worker.mjs",
                "sepath-cloud-app/cloud/llm-gateway-worker.ts",
                "sepath-cloud-app/cloud/serve_llm_gateway_worker.mjs",
                "sepath-cloud-app/cloud/README_LLM_GATEWAY.md",
                "sepath-cloud-app/cloud/openapi.sepath.json",
                "sepath-cloud-app/cloud/README_DATA_PLANE.md",
                "sepath-cloud-app/cloud/edge-api-auth.mjs",
                "sepath-cloud-app/cloud/edge-api-worker.mjs",
                "sepath-cloud-app/cloud/edge-api-store.mjs",
                "sepath-cloud-app/cloud/serve_edge_api_worker.mjs",
                "sepath-cloud-app/cloud/README_EDGE_API.md",
                "sepath-cloud-app/scripts/smoke_edge_api_worker.mjs",
                "sepath-cloud-app/scripts/smoke_edge_api_http.mjs",
                "sepath-cloud-app/scripts/smoke_llm_gateway_worker.mjs",
                "sepath-cloud-app/scripts/smoke_llm_gateway_http.mjs",
                "sepath-cloud-app/qa/edge-api-smoke-report.json",
                "sepath-cloud-app/qa/edge-api-http-smoke-report.json",
                "sepath-cloud-app/qa/llm-gateway-smoke-report.json",
                "sepath-cloud-app/qa/llm-gateway-http-smoke-report.json",
                "sepath-cloud-app/qa/openapi-contract-validation.json",
                "sepath-cloud-app/qa/public-trial-pwa-validation.json",
                "sepath-cloud-app/qa/cloud-slo-load-report.json",
                "sepath-cloud-app/qa/reviewer-drill-report.json",
                "sepath-cloud-app/qa/demo-seed/JUDGE_DEMO_SEED_MANIFEST.json",
                "sepath-cloud-app/cloud/sql/001_init_sepath_schema.sql",
                "sepath-cloud-app/cloud/sql/002_enable_rls.sql",
                "sepath-cloud-app/cloud/sql/003_evidence_indexes.sql",
                "sepath-cloud-app/vercel.json",
                "sepath-cloud-app/netlify.toml",
                "sepath-cloud-app/Dockerfile",
                "sepath-cloud-app/nginx.conf",
                "sepath-cloud-app/.env.example",
                "sepath-cloud-app/.dockerignore",
                "sepath-cloud-app/docker-compose.yml",
                "sepath-cloud-app/qa/deploy-artifacts-validation.json",
                "sepath-cloud-app/src/engine/awardReadiness.ts",
                "sepath-cloud-app/src/engine/knowledgeBoundary.ts",
                "sepath-cloud-app/src/engine/launchReadiness.ts",
                "sepath-cloud-app/src/engine/researchEvidence.ts",
                "sepath-cloud-app/src/engine/eventIngestion.ts",
                "sepath-cloud-app/src/engine/cohortOps.ts",
                "sepath-cloud-app/src/engine/strategyLab.ts",
                "sepath-cloud-app/src/engine/pilotReadiness.ts",
                "sepath-cloud-app/src/engine/ledgerExchange.ts",
                "sepath-cloud-app/src/engine/privacyGuard.ts",
                "sepath-cloud-app/src/engine/apiContract.ts",
                "sepath-cloud-app/src/engine/modelOps.ts",
                "sepath-cloud-app/src/engine/courseAuthoring.ts",
                "sepath-cloud-app/src/engine/teacherReport.ts",
                "sepath-cloud-app/src/engine/studentDialogue.ts",
                "sepath-cloud-app/src/engine/integrationSandbox.ts",
                "sepath-cloud-app/src/engine/valueUplift.ts",
                "sepath-cloud-app/src/engine/judgeTrial.ts",
                "sepath-cloud-app/src/engine/agentRuntime.ts",
                "sepath-cloud-app/src/engine/courseLaunch.ts",
                "sepath-cloud-app/src/engine/submissionOps.ts",
                "sepath-cloud-app/src/engine/pitchDirector.ts",
                "sepath-cloud-app/src/engine/trialTelemetry.ts",
                "sepath-cloud-app/src/engine/tenantOps.ts",
                "sepath-cloud-app/src/engine/rubricCalibration.ts",
                "sepath-cloud-app/src/engine/researchFusion.ts",
                "sepath-cloud-app/src/engine/inferenceGateway.ts",
                "sepath-cloud-app/src/engine/schoolProvisioning.ts",
                "sepath-cloud-app/src/engine/dataPlane.ts",
                "sepath-cloud-app/src/engine/finalDefense.ts",
                "sepath-cloud-app/src/engine/launchLoopAcceptance.ts",
                "sepath-cloud-app/src/engine/pilotEvidenceBinder.ts",
                "sepath-cloud-app/src/engine/claimEvidenceLedger.ts",
                "sepath-cloud-app/src/engine/finalSubmission.ts",
                "sepath-cloud-app/src/engine/submissionClosure.ts",
                "sepath-cloud-app/src/engine/interventionPlaybook.ts",
                "sepath-cloud-app/src/engine/cloudHandoff.ts",
                "sepath-cloud-app/src/engine/hostingSelftest.ts",
                "sepath-cloud-app/src/engine/competitionAlignment.ts",
                "sepath-cloud-app/src/engine/cloudSlo.ts",
                "sepath-cloud-app/src/engine/reviewerDrill.ts",
                "sepath-cloud-app/src/engine/safeVoi.ts",
                "sepath-cloud-app/scripts/capture_with_dev_server.mjs",
                "sepath-cloud-app/scripts/capture_screenshot.mjs",
                "sepath-cloud-app/scripts/capture_playwright_screenshot.mjs",
                "sepath-cloud-app/scripts/run_cloud_slo_load_test.mjs",
                "sepath-cloud-app/scripts/run_reviewer_drill_check.mjs",
                "sepath-cloud-app/src/components/LaunchReadinessPanel.tsx",
                "sepath-cloud-app/src/components/ResearchEvidencePanel.tsx",
                "sepath-cloud-app/src/components/RepositoryImportPanel.tsx",
                "sepath-cloud-app/src/components/CohortOpsPanel.tsx",
                "sepath-cloud-app/src/components/StrategyLabPanel.tsx",
                "sepath-cloud-app/src/components/PilotReadinessPanel.tsx",
                "sepath-cloud-app/src/components/PrivacyGuardPanel.tsx",
                "sepath-cloud-app/src/components/ApiContractPanel.tsx",
                "sepath-cloud-app/src/components/ModelOpsPanel.tsx",
                "sepath-cloud-app/src/components/CourseAuthoringPanel.tsx",
                "sepath-cloud-app/src/components/TeacherReportPanel.tsx",
                "sepath-cloud-app/src/components/StudentDialoguePanel.tsx",
                "sepath-cloud-app/src/components/IntegrationSandboxPanel.tsx",
                "sepath-cloud-app/src/components/ValueUpliftPanel.tsx",
                "sepath-cloud-app/src/components/JudgeTrialPanel.tsx",
                "sepath-cloud-app/src/components/AgentRuntimePanel.tsx",
                "sepath-cloud-app/src/components/CourseLaunchPanel.tsx",
                "sepath-cloud-app/src/components/SubmissionOpsPanel.tsx",
                "sepath-cloud-app/src/components/PitchDirectorPanel.tsx",
                "sepath-cloud-app/src/components/TrialTelemetryPanel.tsx",
                "sepath-cloud-app/src/components/TenantOpsPanel.tsx",
                "sepath-cloud-app/src/components/RubricCalibrationPanel.tsx",
                "sepath-cloud-app/src/components/ResearchFusionPanel.tsx",
                "sepath-cloud-app/src/components/InferenceGatewayPanel.tsx",
                "sepath-cloud-app/src/components/SchoolProvisioningPanel.tsx",
                "sepath-cloud-app/src/components/DataPlanePanel.tsx",
                "sepath-cloud-app/src/components/FinalDefensePanel.tsx",
                "sepath-cloud-app/src/components/LaunchLoopAcceptancePanel.tsx",
                "sepath-cloud-app/src/components/PilotEvidenceBinderPanel.tsx",
                "sepath-cloud-app/src/components/ClaimEvidenceLedgerPanel.tsx",
                "sepath-cloud-app/src/components/FinalSubmissionPanel.tsx",
                "sepath-cloud-app/src/components/SubmissionClosurePanel.tsx",
                "sepath-cloud-app/src/components/InterventionPlaybookPanel.tsx",
                "sepath-cloud-app/src/components/CloudHandoffPanel.tsx",
                "sepath-cloud-app/src/components/HostingSelftestPanel.tsx",
                "sepath-cloud-app/src/components/CompetitionAlignmentPanel.tsx",
                "sepath-cloud-app/src/components/CloudSloPanel.tsx",
                "sepath-cloud-app/src/components/ReviewerDrillPanel.tsx",
                "sepath-cloud-app/src/components/ReviewerGuideOverlay.tsx",
                "sepath-cloud-app/src/components/EvidenceCapturePanel.tsx",
                "sepath-cloud-app/qa/screenshots/data-plane-panel.png",
                "sepath-cloud-app/qa/screenshots/school-provisioning-panel.png",
                "sepath-cloud-app/qa/screenshots/inference-gateway-panel.png",
                "sepath-cloud-app/qa/screenshots/research-fusion-panel.png",
                "sepath-cloud-app/qa/screenshots/rubric-calibration-panel.png",
                "sepath-cloud-app/qa/screenshots/tenantops-panel.png",
                "sepath-cloud-app/qa/screenshots/trial-telemetry-panel.png",
                "sepath-cloud-app/qa/screenshots/pitch-director-panel.png",
                "sepath-cloud-app/qa/screenshots/submission-ops-panel.png",
                "sepath-cloud-app/qa/screenshots/final-submission-panel.png",
                "sepath-cloud-app/qa/screenshots/final-submission-panel-mobile.png",
                "sepath-cloud-app/qa/screenshots/public-url-receipt-panel.png",
                "sepath-cloud-app/qa/screenshots/public-url-receipt-panel-mobile.png",
                "sepath-cloud-app/qa/screenshots/submission-closure-panel.png",
                "sepath-cloud-app/qa/screenshots/submission-closure-panel-mobile.png",
                "sepath-cloud-app/qa/screenshots/competition-alignment-panel.png",
                "sepath-cloud-app/qa/screenshots/final-defense-panel.png",
                "sepath-cloud-app/qa/screenshots/final-defense-panel-mobile.png",
                "sepath-cloud-app/qa/screenshots/launch-loop-panel.png",
                "sepath-cloud-app/qa/screenshots/launch-loop-panel-mobile.png",
                "sepath-cloud-app/qa/screenshots/intervention-playbook-panel.png",
                "sepath-cloud-app/qa/screenshots/intervention-playbook-panel-mobile.png",
                "sepath-cloud-app/qa/screenshots/cloud-handoff-panel.png",
                "sepath-cloud-app/qa/screenshots/cloud-handoff-panel-mobile.png",
                "sepath-cloud-app/qa/screenshots/cloud-slo-panel.png",
                "sepath-cloud-app/qa/screenshots/reviewer-drill-panel.png",
                "sepath-cloud-app/qa/screenshots/reviewer-guide-overlay.png",
                "sepath-cloud-app/qa/screenshots/judge-verification-panel.png",
                "sepath-cloud-app/qa/screenshots/judge-verification-panel-mobile.png",
                "sepath-cloud-app/qa/screenshots/judge-trial-panel.png",
                "sepath-cloud-app/qa/screenshots/agent-runtime-panel.png",
                "sepath-cloud-app/qa/screenshots/course-launch-panel.png",
                "sepath-cloud-app/src/data/repositorySamples.ts",
                "sepath-sites-app/.openai/hosting.json",
                "sepath-sites-app/src/engine/strategyLab.ts",
                "sepath-sites-app/src/components/StrategyLabPanel.tsx",
                "sepath-sites-app/src/engine/pilotReadiness.ts",
                "sepath-sites-app/src/components/PilotReadinessPanel.tsx",
                "sepath-sites-app/src/engine/ledgerExchange.ts",
                "sepath-sites-app/src/engine/privacyGuard.ts",
                "sepath-sites-app/src/components/PrivacyGuardPanel.tsx",
                "sepath-sites-app/src/engine/apiContract.ts",
                "sepath-sites-app/src/components/ApiContractPanel.tsx",
                "sepath-sites-app/src/engine/modelOps.ts",
                "sepath-sites-app/src/components/ModelOpsPanel.tsx",
                "sepath-sites-app/src/engine/courseAuthoring.ts",
                "sepath-sites-app/src/components/CourseAuthoringPanel.tsx",
                "sepath-sites-app/src/engine/teacherReport.ts",
                "sepath-sites-app/src/components/TeacherReportPanel.tsx",
                "sepath-sites-app/src/engine/studentDialogue.ts",
                "sepath-sites-app/src/components/StudentDialoguePanel.tsx",
                "sepath-sites-app/src/engine/integrationSandbox.ts",
                "sepath-sites-app/src/engine/valueUplift.ts",
                "sepath-sites-app/src/engine/judgeTrial.ts",
                "sepath-sites-app/src/engine/agentRuntime.ts",
                "sepath-sites-app/src/engine/courseLaunch.ts",
                "sepath-sites-app/src/engine/submissionOps.ts",
                "sepath-sites-app/src/engine/pitchDirector.ts",
                "sepath-sites-app/src/engine/trialTelemetry.ts",
                "sepath-sites-app/src/engine/tenantOps.ts",
                "sepath-sites-app/src/engine/rubricCalibration.ts",
                "sepath-sites-app/src/engine/researchFusion.ts",
                "sepath-sites-app/src/engine/inferenceGateway.ts",
                "sepath-sites-app/src/engine/schoolProvisioning.ts",
                "sepath-sites-app/src/engine/dataPlane.ts",
                "sepath-sites-app/src/engine/finalDefense.ts",
                "sepath-sites-app/src/engine/launchLoopAcceptance.ts",
                "sepath-sites-app/src/engine/pilotEvidenceBinder.ts",
                "sepath-sites-app/src/engine/claimEvidenceLedger.ts",
                "sepath-sites-app/src/engine/finalSubmission.ts",
                "sepath-sites-app/src/engine/submissionClosure.ts",
                "sepath-sites-app/src/engine/interventionPlaybook.ts",
                "sepath-sites-app/src/engine/cloudHandoff.ts",
                "sepath-sites-app/src/engine/hostingSelftest.ts",
                "sepath-sites-app/src/engine/competitionAlignment.ts",
                "sepath-sites-app/src/engine/cloudSlo.ts",
                "sepath-sites-app/src/engine/reviewerDrill.ts",
                "sepath-sites-app/src/components/IntegrationSandboxPanel.tsx",
                "sepath-sites-app/src/components/ValueUpliftPanel.tsx",
                "sepath-sites-app/src/components/JudgeTrialPanel.tsx",
                "sepath-sites-app/src/components/AgentRuntimePanel.tsx",
                "sepath-sites-app/src/components/CourseLaunchPanel.tsx",
                "sepath-sites-app/src/components/SubmissionOpsPanel.tsx",
                "sepath-sites-app/src/components/PitchDirectorPanel.tsx",
                "sepath-sites-app/src/components/TrialTelemetryPanel.tsx",
                "sepath-sites-app/src/components/TenantOpsPanel.tsx",
                "sepath-sites-app/src/components/RubricCalibrationPanel.tsx",
                "sepath-sites-app/src/components/ResearchFusionPanel.tsx",
                "sepath-sites-app/src/components/InferenceGatewayPanel.tsx",
                "sepath-sites-app/src/components/SchoolProvisioningPanel.tsx",
                "sepath-sites-app/src/components/DataPlanePanel.tsx",
                "sepath-sites-app/src/components/FinalDefensePanel.tsx",
                "sepath-sites-app/src/components/LaunchLoopAcceptancePanel.tsx",
                "sepath-sites-app/src/components/PilotEvidenceBinderPanel.tsx",
                "sepath-sites-app/src/components/ClaimEvidenceLedgerPanel.tsx",
                "sepath-sites-app/src/components/FinalSubmissionPanel.tsx",
                "sepath-sites-app/src/components/SubmissionClosurePanel.tsx",
                "sepath-sites-app/src/components/InterventionPlaybookPanel.tsx",
                "sepath-sites-app/src/components/CloudHandoffPanel.tsx",
                "sepath-sites-app/src/components/HostingSelftestPanel.tsx",
                "sepath-sites-app/src/components/CompetitionAlignmentPanel.tsx",
                "sepath-sites-app/src/components/CloudSloPanel.tsx",
                "sepath-sites-app/src/components/ReviewerDrillPanel.tsx",
                "sepath-sites-app/src/components/ReviewerGuideOverlay.tsx",
            ]
            missing = [entry for entry in required_entries if entry not in names]
            rows.append(
                {
                    "label": "ZIP 关键条目齐全",
                    "status": "PASS" if not missing else "FAIL",
                    "path": rel(PACKAGE),
                    "evidence": "all required entries present" if not missing else ", ".join(missing),
                }
            )
    if MANIFEST.exists():
        manifest = load_manifest()
        checks = manifest.get("checks", {})
        rows.extend(
            [
                {
                    "label": "ZIP 小于 100MB",
                    "status": "PASS" if manifest.get("package_size_bytes", MAX_BYTES + 1) < MAX_BYTES else "FAIL",
                    "path": rel(MANIFEST),
                    "evidence": "pass; exact byte count is authoritative in manifest",
                },
                {
                    "label": "敏感信息扫描",
                    "status": "PASS" if not checks.get("secret_scan_hits") else "FAIL",
                    "path": rel(MANIFEST),
                    "evidence": "0 hits" if not checks.get("secret_scan_hits") else str(checks.get("secret_scan_hits")),
                },
            ]
        )
    return rows


def pdf_checks() -> list[dict[str, Any]]:
    pdf = MATERIALS / "SE-Path学伴_产品设计与原型验证方案_v0.2.pdf"
    rows = [check_file(pdf, "项目计划书 PDF 存在", 1024)]
    if pdf.exists():
        data = pdf.read_bytes()
        page_count = len(re.findall(rb"/Type\s*/Page\b", data))
        rows.extend(
            [
                {
                    "label": "PDF 文件头",
                    "status": "PASS" if data.startswith(b"%PDF-") else "FAIL",
                    "path": rel(pdf),
                    "evidence": data[:8].decode("ascii", errors="replace"),
                },
                {
                    "label": "PDF 页数达到 80+",
                    "status": "PASS" if page_count >= 80 else "FAIL",
                    "path": rel(pdf),
                    "evidence": f"{page_count} pages by /Type /Page scan",
                },
            ]
        )
    return rows


def ppt_checks() -> list[dict[str, Any]]:
    pptx = MATERIALS / "SE-Path学伴_答辩PPT_v0.2.pptx"
    inspect = MATERIALS / "SE-Path学伴_答辩PPT_v0.2.pptx.inspect.ndjson"
    rows = [check_file(pptx, "答辩 PPT 存在", 1024), check_file(inspect, "PPT 检查文件存在", 1024)]
    if pptx.exists():
        with zipfile.ZipFile(pptx) as archive:
            bad = archive.testzip()
            slide_count = len(
                [
                    name
                    for name in archive.namelist()
                    if name.startswith("ppt/slides/slide") and name.endswith(".xml")
                ]
            )
        rows.extend(
            [
                {
                    "label": "PPT ZIP 完整性",
                    "status": "PASS" if bad is None else "FAIL",
                    "path": rel(pptx),
                    "evidence": "zipfile.testzip() pass" if bad is None else f"bad entry: {bad}",
                },
                {
                    "label": "PPT 页数合理",
                    "status": "PASS" if 15 <= slide_count <= 25 else "WARN",
                    "path": rel(pptx),
                    "evidence": f"{slide_count} slides",
                },
            ]
        )
    return rows


def run_ffprobe(video: Path) -> dict[str, Any] | None:
    exe = shutil.which("ffprobe")
    if not exe or not video.exists():
        return None
    result = subprocess.run(
        [
            exe,
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=codec_name,width,height,duration",
            "-show_entries",
            "format=duration,size",
            "-of",
            "json",
            str(video),
        ],
        text=True,
        encoding="utf-8",
        errors="replace",
        capture_output=True,
        check=False,
    )
    if result.returncode != 0:
        return {"error": result.stderr.strip()}
    return json.loads(result.stdout)


def parse_mp4_fallback(video: Path) -> dict[str, Any] | None:
    if not video.exists():
        return None
    data = video.read_bytes()
    metadata: dict[str, Any] = {"width": 0, "height": 0, "duration": 0.0, "codec_name": "mp4"}

    def walk(start: int, end: int) -> None:
        offset = start
        while offset + 8 <= end and offset + 8 <= len(data):
            size = int.from_bytes(data[offset : offset + 4], "big")
            box_type = data[offset + 4 : offset + 8]
            header = 8
            if size == 1 and offset + 16 <= end:
                size = int.from_bytes(data[offset + 8 : offset + 16], "big")
                header = 16
            elif size == 0:
                size = end - offset
            if size < header or offset + size > len(data):
                break
            payload_start = offset + header
            payload_end = offset + size
            payload = data[payload_start:payload_end]
            if box_type == b"mvhd" and len(payload) >= 20:
                version = payload[0]
                if version == 1 and len(payload) >= 32:
                    timescale = int.from_bytes(payload[20:24], "big")
                    duration_units = int.from_bytes(payload[24:32], "big")
                else:
                    timescale = int.from_bytes(payload[12:16], "big")
                    duration_units = int.from_bytes(payload[16:20], "big")
                if timescale:
                    metadata["duration"] = duration_units / timescale
            elif box_type == b"tkhd" and len(payload) >= 8:
                width = int.from_bytes(payload[-8:-4], "big") >> 16
                height = int.from_bytes(payload[-4:], "big") >> 16
                if width * height > int(metadata["width"]) * int(metadata["height"]):
                    metadata["width"] = width
                    metadata["height"] = height
            elif box_type in {b"moov", b"trak", b"mdia", b"minf", b"stbl"}:
                walk(payload_start, payload_end)
            offset += size

    walk(0, len(data))
    if b"avc1" in data or b"avcC" in data:
        metadata["codec_name"] = "h264"
    if metadata["duration"] or (metadata["width"] and metadata["height"]):
        return metadata
    return None


def video_checks() -> list[dict[str, Any]]:
    video = MATERIALS / "演示视频素材" / "SE-Path学伴_4分40秒演示视频素材_v0.3.mp4"
    rows = [check_file(video, "3-5 分钟演示视频存在", 1024)]
    rows.extend(
        [
            check_file(MATERIALS / "演示视频素材" / "SE-Path学伴_正式旁白稿_v0.3.md", "正式旁白稿存在", 500),
            check_file(MATERIALS / "演示视频素材" / "SE-Path学伴_4分40秒旁白字幕_v0.3.srt", "SRT 字幕存在", 500),
            check_file(MATERIALS / "演示视频素材" / "SE-Path学伴_4分40秒旁白字幕_v0.3.vtt", "VTT 字幕存在", 500),
            check_file(MATERIALS / "演示视频素材" / "旁白录制检查清单.md", "旁白录制检查清单存在", 500),
            check_file(MATERIALS / "演示视频素材" / "SE-Path学伴_v0.5复剪增补旁白.md", "决赛复剪增补旁白存在", 500),
        ]
    )
    probe = run_ffprobe(video)
    if probe is None:
        fallback = parse_mp4_fallback(video)
        if fallback is None:
            rows.append(
                {
                    "label": "视频技术参数",
                    "status": "WARN",
                    "path": rel(video),
                    "evidence": "ffprobe unavailable and MP4 fallback unavailable",
                }
            )
        else:
            duration = float(fallback.get("duration") or 0)
            rows.extend(
                [
                    {
                        "label": "视频时长 3-5 分钟",
                        "status": "PASS" if 180 <= duration <= 300 else "FAIL",
                        "path": rel(video),
                        "evidence": f"{duration:.0f} seconds by MP4 box fallback",
                    },
                    {
                        "label": "视频分辨率",
                        "status": "PASS" if fallback.get("width") == 1920 and fallback.get("height") == 1080 else "WARN",
                        "path": rel(video),
                        "evidence": f"{fallback.get('width')}x{fallback.get('height')}, {fallback.get('codec_name')} by MP4 box fallback",
                    },
                ]
            )
    elif "error" in probe:
        rows.append(
            {
                "label": "视频技术参数",
                "status": "FAIL",
                "path": rel(video),
                "evidence": probe["error"],
            }
        )
    else:
        stream = (probe.get("streams") or [{}])[0]
        duration = float(probe.get("format", {}).get("duration") or stream.get("duration") or 0)
        rows.extend(
            [
                {
                    "label": "视频时长 3-5 分钟",
                    "status": "PASS" if 180 <= duration <= 300 else "FAIL",
                    "path": rel(video),
                    "evidence": f"{duration:.0f} seconds",
                },
                {
                    "label": "视频分辨率",
                    "status": "PASS" if stream.get("width") == 1920 and stream.get("height") == 1080 else "WARN",
                    "path": rel(video),
                    "evidence": f"{stream.get('width')}x{stream.get('height')}, {stream.get('codec_name')}",
                },
            ]
        )
    return rows


def demo_checks() -> list[dict[str, Any]]:
    manifest = CLOUD_APP / "qa" / "demo-flow" / "demo_flow_manifest.json"
    rows = [
        check_file(CLOUD_APP / "package.json", "本地 Demo 工程存在", 1024),
        check_file(SITES_APP / ".openai" / "hosting.json", "Sites 云部署配置存在", 10),
        check_file(MATERIALS / "07_云端部署记录.md", "云端部署记录存在", 1024),
        check_file(manifest, "自动点击 Demo manifest 存在", 1024),
    ]
    if manifest.exists():
        data = json.loads(read_text(manifest))
        scenes = data.get("scenes", [])
        overflow = [
            scene.get("id")
            for scene in scenes
            if scene.get("metrics", {}).get("docScroll", 0) > scene.get("metrics", {}).get("docClient", 0) + 1
        ]
        rows.extend(
            [
                {
                    "label": "演示闭环镜头数量",
                    "status": "PASS" if len(scenes) == 14 else "FAIL",
                    "path": rel(manifest),
                    "evidence": f"{len(scenes)} scenes",
                },
                {
                    "label": "演示流无横向溢出",
                    "status": "PASS" if not overflow else "FAIL",
                    "path": rel(manifest),
                    "evidence": "no overflow" if not overflow else ", ".join(overflow),
                },
                {
                    "label": "包含评审证据面板",
                    "status": "PASS" if any(scene.get("id") == "12-award-readiness" for scene in scenes) else "FAIL",
                    "path": rel(manifest),
                    "evidence": "12-award-readiness scene present",
                },
                {
                    "label": "包含学习增值评估镜头",
                    "status": "PASS" if any(scene.get("id") == "10-value-uplift" for scene in scenes) else "FAIL",
                    "path": rel(manifest),
                    "evidence": "10-value-uplift scene present",
                },
            ]
        )
    deployment_text = read_text(MATERIALS / "07_云端部署记录.md") if (MATERIALS / "07_云端部署记录.md").exists() else ""
    rows.append(
        {
            "label": "历史云端 version 3 部署记录",
            "status": "PASS" if "version 3" in deployment_text and "succeeded" in deployment_text else "FAIL",
            "path": "参赛提交材料包/07_云端部署记录.md",
            "evidence": "version 3 / succeeded" if "version 3" in deployment_text and "succeeded" in deployment_text else "missing version 3 or succeeded",
        }
    )
    sites_preflight_text = read_text(MATERIALS / "63_Sites云端发布预检与替代上线路线.md") if (MATERIALS / "63_Sites云端发布预检与替代上线路线.md").exists() else ""
    rows.append(
        {
            "label": "最新版 Sites 发布预检边界",
            "status": "PASS"
            if "7f33ee7f663af9bd57e3f60d99eb79e0a09f8a7c" in sites_preflight_text
            and "NOT_FOUND" in sites_preflight_text
            and "SEC_E_NO_CREDENTIALS" in sites_preflight_text
            and "不能宣称最新版" in sites_preflight_text
            else "FAIL",
            "path": "参赛提交材料包/63_Sites云端发布预检与替代上线路线.md",
            "evidence": "latest commit + project_not_found + fallback boundary" if sites_preflight_text else "missing Sites preflight document",
        }
    )
    public_url_template_path = MATERIALS / "64_最终公开URL验收器与回执模板_机器可读.json"
    public_url_template = json.loads(read_text(public_url_template_path)) if public_url_template_path.exists() else {}
    rows.append(
        {
            "label": "最终公开 URL 验收器模板",
            "status": "PASS"
            if public_url_template.get("runtime") == "sepath-public-url-validation-template.v1"
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
            and (ROOT / "scripts" / "validate_public_url_release.py").exists()
            and (ROOT / "scripts" / "smoke_public_url_validator_local.py").exists()
            and (ROOT / "scripts" / "finalize_public_url_receipt.py").exists()
            else "FAIL",
            "path": "参赛提交材料包/64_最终公开URL验收器与回执模板_机器可读.json",
            "evidence": str(public_url_template.get("status", "missing")),
        }
    )
    final_url_receipt_path = SUBMISSION / "final_public_url_receipt.json"
    final_url_receipt = json.loads(read_text(final_url_receipt_path)) if final_url_receipt_path.exists() else {}
    rows.append(
        {
            "label": "最终公开 URL pending 回执",
            "status": "PASS"
            if final_url_receipt.get("runtime") == "sepath-final-public-url-receipt.v1"
            and final_url_receipt.get("status") in {"pending_final_public_url", "ready_for_platform"}
            and final_url_receipt.get("local_smoke", {}).get("summary", {}).get("FAIL") == 0
            else "FAIL",
            "path": "submission/final_public_url_receipt.json",
            "evidence": str(final_url_receipt.get("status", "missing")),
        }
    )
    return rows


def public_trial_checks() -> list[dict[str, Any]]:
    trial = MATERIALS / "公开试用静态包"
    manifest = trial / "PUBLIC_TRIAL_MANIFEST.json"
    public_health = trial / "PUBLIC_HEALTH.json"
    public_release = trial / "PUBLIC_RELEASE.json"
    readme = trial / "README_公开试用.md"
    index = trial / "index.html"
    webmanifest = trial / "manifest.webmanifest"
    service_worker = trial / "sw.js"
    offline = trial / "offline.html"
    pwa_validation = CLOUD_APP / "qa" / "public-trial-pwa-validation.json"
    local_url_smoke = CLOUD_APP / "qa" / "public-url-validator-local-smoke.json"
    deploy_validation = CLOUD_APP / "qa" / "deploy-artifacts-validation.json"
    upload_manifest = MATERIALS / "public-site-upload" / "PUBLIC_SITE_UPLOAD_MANIFEST.json"
    upload_zip = MATERIALS / "public-site-upload" / "SE-Path学伴_公开静态站点上传包_v0.1.zip"
    launch_command = MATERIALS / "public-launch-command" / "PUBLIC_LAUNCH_COMMAND.json"
    assets_dir = trial / "assets"
    rows = [
        check_file(index, "公开试用静态包入口存在", 300),
        check_file(readme, "公开试用说明存在", 500),
        check_file(manifest, "公开试用 manifest 存在", 500),
        check_file(public_health, "公开试用健康状态 JSON 存在", 500),
        check_file(public_release, "公开试用发布版本 JSON 存在", 500),
        check_file(webmanifest, "公开试用 PWA manifest 存在", 300),
        check_file(service_worker, "公开试用 Service Worker 存在", 800),
        check_file(offline, "公开试用离线兜底页存在", 800),
        check_file(pwa_validation, "公开试用 PWA 验收报告存在", 500),
        check_file(local_url_smoke, "公开 URL 验收器本地烟测报告存在", 500),
        check_file(upload_manifest, "公网静态上传包 manifest 存在", 500),
        check_file(upload_zip, "公网静态上传 ZIP 存在", 1000),
        check_file(launch_command, "公网发布指挥包存在", 1000),
        check_file(CLOUD_APP / "DEPLOY_PUBLIC.md", "公开部署说明存在", 500),
        check_file(CLOUD_APP / "vercel.json", "Vercel 静态部署配置存在", 100),
        check_file(CLOUD_APP / "netlify.toml", "Netlify 静态部署配置存在", 100),
        check_file(CLOUD_APP / "Dockerfile", "Docker/Nginx 容器构建配置存在", 100),
        check_file(CLOUD_APP / "nginx.conf", "Nginx SPA 静态服务配置存在", 100),
        check_file(CLOUD_APP / ".env.example", "环境变量样例存在且无密钥", 50),
        check_file(CLOUD_APP / ".dockerignore", "Docker 构建上下文排除清单存在", 50),
        check_file(CLOUD_APP / "docker-compose.yml", "Docker Compose 一键运行配置存在", 100),
        check_file(deploy_validation, "标准化部署配置机器验收报告存在", 500),
    ]
    assets = sorted(assets_dir.glob("*")) if assets_dir.exists() else []
    rows.append(
        {
            "label": "公开试用静态资源完整",
            "status": "PASS" if len([path for path in assets if path.is_file()]) >= 2 else "FAIL",
            "path": rel(assets_dir) if assets_dir.exists() else rel(assets_dir),
            "evidence": f"{len([path for path in assets if path.is_file()])} asset files",
        }
    )
    if manifest.exists():
        data = json.loads(read_text(manifest))
        files = data.get("files", [])
        file_paths = {item.get("path") for item in files}
        listed_missing = [item.get("path") for item in files if not (trial / str(item.get("path"))).exists()]
        has_js = any(str(path).startswith("assets/") and str(path).endswith(".js") for path in file_paths)
        has_css = any(str(path).startswith("assets/") and str(path).endswith(".css") for path in file_paths)
        pwa = data.get("pwa", {})
        reviewer_guide = data.get("reviewer_guide", {})
        public_runtime = data.get("public_runtime", {})
        has_pwa_assets = {"manifest.webmanifest", "sw.js", "offline.html", "pwa-icon.svg", "maskable-icon.svg"}.issubset(
            {str(path) for path in file_paths}
        )
        rows.extend(
            [
                {
                    "label": "公开试用 manifest 资源清单",
                    "status": "PASS"
                    if "index.html" in file_paths
                    and "JUDGE_DEMO_SEED_MANIFEST.json" in file_paths
                    and "PUBLIC_HEALTH.json" in file_paths
                    and "PUBLIC_RELEASE.json" in file_paths
                    and "public-url-receipt-panel.png" in file_paths
                    and "submission-closure-panel.png" in file_paths
                    and has_pwa_assets
                    and has_js
                    and has_css
                    else "FAIL",
                    "path": rel(manifest),
                    "evidence": f"{len(files)} files listed",
                },
                {
                    "label": "公开试用上线元数据声明",
                    "status": "PASS"
                    if public_runtime.get("health") == "PUBLIC_HEALTH.json"
                    and public_runtime.get("release") == "PUBLIC_RELEASE.json"
                    and public_runtime.get("health_runtime") == "sepath-public-health.v1"
                    and public_runtime.get("release_runtime") == "sepath-public-release.v1"
                    and public_runtime.get("status") == "ready_for_public_static_review"
                    else "FAIL",
                    "path": rel(manifest),
                    "evidence": json.dumps(public_runtime, ensure_ascii=False)[:180],
                },
                {
                    "label": "公开试用 manifest 指向文件存在",
                    "status": "PASS" if not listed_missing else "FAIL",
                    "path": rel(manifest),
                    "evidence": "all listed files exist" if not listed_missing else ", ".join(map(str, listed_missing[:5])),
                },
                {
                    "label": "公开试用包体积可上传",
                    "status": "PASS" if int(data.get("total_size_bytes", 0)) < 5 * 1024 * 1024 else "WARN",
                    "path": rel(manifest),
                    "evidence": f"{data.get('total_size_bytes', 0)} bytes",
                },
                {
                    "label": "公开试用隐私边界声明",
                    "status": "PASS" if "Synthetic demo data" in str(data.get("privacy_boundary", "")) else "FAIL",
                    "path": rel(manifest),
                    "evidence": str(data.get("privacy_boundary", ""))[:120],
                },
                {
                    "label": "公开试用评委种子包",
                    "status": "PASS" if "JUDGE_DEMO_SEED_MANIFEST.json" in file_paths else "FAIL",
                    "path": rel(manifest),
                    "evidence": "judge demo seed manifest listed" if "JUDGE_DEMO_SEED_MANIFEST.json" in file_paths else "missing",
                },
                {
                    "label": "公开试用 PWA 离线容灾声明",
                    "status": "PASS"
                    if pwa.get("installable") is True
                    and pwa.get("runtime") == "sepath-public-trial-pwa.v1"
                    and pwa.get("service_worker") == "sw.js"
                    else "FAIL",
                    "path": rel(manifest),
                    "evidence": json.dumps(pwa, ensure_ascii=False)[:180],
                },
                {
                    "label": "公开试用一键评委导览声明",
                    "status": "PASS"
                    if reviewer_guide.get("runtime") == "sepath-reviewer-guide.v1"
                    and reviewer_guide.get("enabled") is True
                    and reviewer_guide.get("report") == "REVIEWER_DRILL_REPORT.json"
                    and reviewer_guide.get("screenshot") == "reviewer-guide-overlay.png"
                    and reviewer_guide.get("public_url_receipt_screenshot") == "public-url-receipt-panel.png"
                    and reviewer_guide.get("submission_closure_screenshot") == "submission-closure-panel.png"
                    and "#submission-closure" in reviewer_guide.get("required_anchors", [])
                    and {
                        "REVIEWER_DRILL_REPORT.json",
                        "reviewer-guide-overlay.png",
                        "reviewer-guide-claim-ledger.png",
                        "public-url-receipt-panel.png",
                        "submission-closure-panel.png",
                    }.issubset(file_paths)
                    else "FAIL",
                    "path": rel(manifest),
                    "evidence": json.dumps(reviewer_guide, ensure_ascii=False)[:220],
                },
            ]
        )
    if pwa_validation.exists():
        pwa_data = json.loads(read_text(pwa_validation))
        pwa_summary = pwa_data.get("summary", {})
        rows.append(
            {
                "label": "公开试用 PWA 机器验收",
                "status": "PASS" if pwa_summary.get("FAIL") == 0 and pwa_summary.get("PASS", 0) >= 10 else "FAIL",
                "path": rel(pwa_validation),
                "evidence": f"PASS={pwa_summary.get('PASS')} FAIL={pwa_summary.get('FAIL')}",
            }
        )
    if local_url_smoke.exists():
        smoke_data = json.loads(read_text(local_url_smoke))
        smoke_summary = smoke_data.get("summary", {})
        rows.append(
            {
                "label": "公开 URL 验收器本地烟测",
                "status": "PASS"
                if smoke_data.get("runtime") == "sepath-public-url-validator-local-smoke.v1"
                and smoke_summary.get("FAIL") == 0
                and smoke_summary.get("PASS", 0) >= 15
                and smoke_data.get("source_dir") == "参赛提交材料包/公开试用静态包"
                else "FAIL",
                "path": rel(local_url_smoke),
                "evidence": f"PASS={smoke_summary.get('PASS')} FAIL={smoke_summary.get('FAIL')}",
            }
        )
    if deploy_validation.exists():
        deploy_data = json.loads(read_text(deploy_validation))
        deploy_summary = deploy_data.get("summary", {})
        deploy_artifacts = deploy_data.get("artifacts", {})
        rows.append(
            {
                "label": "标准化部署配置机器验收",
                "status": "PASS"
                if deploy_data.get("runtime") == "sepath-deploy-artifacts-validation.v1"
                and deploy_data.get("status") == "ready_for_standard_static_deploy"
                and deploy_summary.get("FAIL") == 0
                and deploy_summary.get("PASS", 0) >= 10
                and deploy_artifacts.get("docker_compose") == "sepath-cloud-app/docker-compose.yml"
                and deploy_artifacts.get("public_site_upload_zip_sha256")
                else "FAIL",
                "path": rel(deploy_validation),
                "evidence": f"PASS={deploy_summary.get('PASS')} FAIL={deploy_summary.get('FAIL')} sha={deploy_artifacts.get('public_site_upload_zip_sha256')}",
            }
        )
    if upload_manifest.exists():
        upload_data = json.loads(read_text(upload_manifest))
        upload_summary = upload_data.get("checks_summary", {})
        rows.append(
            {
                "label": "公网静态上传包机器验收",
                "status": "PASS"
                if upload_data.get("runtime") == "sepath-public-site-upload-artifact.v1"
                and upload_summary.get("FAIL") == 0
                and upload_data.get("zip_integrity") == "pass"
                and upload_data.get("zip_contains_root_index") is True
                and upload_data.get("required_missing") == []
                and upload_data.get("extra_missing") == []
                and {"PUBLIC_HEALTH.json", "PUBLIC_RELEASE.json"}.issubset(set(upload_data.get("required_static_files", [])))
                and upload_data.get("zip_size_bytes", 999999999) < 5 * 1024 * 1024
                else "FAIL",
                "path": rel(upload_manifest),
                "evidence": f"PASS={upload_summary.get('PASS')} FAIL={upload_summary.get('FAIL')} zip={upload_data.get('zip_size_bytes')} bytes",
            }
        )
    if upload_zip.exists():
        with zipfile.ZipFile(upload_zip) as archive:
            bad_entry = archive.testzip()
            names = set(archive.namelist())
        required_upload_entries = {
            "index.html",
            "manifest.webmanifest",
            "sw.js",
            "offline.html",
            "PUBLIC_TRIAL_MANIFEST.json",
            "PUBLIC_HEALTH.json",
            "PUBLIC_RELEASE.json",
            "JUDGE_DEMO_SEED_MANIFEST.json",
            "REVIEWER_DRILL_REPORT.json",
            "reviewer-guide-claim-ledger.png",
            "public-url-receipt-panel.png",
            "submission-closure-panel.png",
            "_redirects",
            "_headers",
            ".nojekyll",
            "404.html",
            "vercel.json",
            "netlify.toml",
            "nginx.conf.example",
            "DEPLOY_TARGETS.md",
        }
        missing_upload_entries = sorted(required_upload_entries - names)
        rows.append(
            {
                "label": "公网静态上传 ZIP 根目录可部署",
                "status": "PASS" if bad_entry is None and not missing_upload_entries else "FAIL",
                "path": rel(upload_zip),
                "evidence": "zip ok; root index and hosting config present"
                if bad_entry is None and not missing_upload_entries
                else f"bad={bad_entry} missing={', '.join(missing_upload_entries)}",
            }
        )
    if launch_command.exists():
        launch_data = json.loads(read_text(launch_command))
        launch_summary = launch_data.get("checks_summary", {})
        rows.append(
            {
                "label": "公网发布指挥台待外部 URL 状态",
                "status": "PASS"
                if launch_data.get("runtime") == "sepath-public-launch-commander.v1"
                and launch_data.get("status") in {"awaiting_external_public_url", "ready_for_platform"}
                and launch_summary.get("FAIL") == 0
                and launch_data.get("upload_zip") == "参赛提交材料包/public-site-upload/SE-Path学伴_公开静态站点上传包_v0.1.zip"
                else "FAIL",
                "path": rel(launch_command),
                "evidence": f"status={launch_data.get('status')} PASS={launch_summary.get('PASS')} FAIL={launch_summary.get('FAIL')}",
            }
        )
    return rows


def slo_checks() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    report = CLOUD_APP / "qa" / "cloud-slo-load-report.json"
    rows.append(check_file(report, "云端 SLO 容量压测报告存在", 500))
    if report.exists():
        data = json.loads(read_text(report))
        summary = data.get("summary", {})
        rows.extend(
            [
                {
                    "label": "云端 SLO runtime",
                    "status": "PASS" if data.get("runtime") == "sepath-cloud-slo.v1" else "FAIL",
                    "path": rel(report),
                    "evidence": str(data.get("runtime")),
                },
                {
                    "label": "云端 SLO 机器压测达标",
                    "status": "PASS"
                    if summary.get("FAIL") == 0
                    and summary.get("PASS", 0) >= 5
                    and summary.get("totalRequests", 0) >= 100
                    and summary.get("maxP95Ms", 999999) <= data.get("slo", {}).get("p95TargetMs", 1400)
                    else "FAIL",
                    "path": rel(report),
                    "evidence": f"PASS={summary.get('PASS')} FAIL={summary.get('FAIL')} totalRequests={summary.get('totalRequests')} maxP95Ms={summary.get('maxP95Ms')}",
                },
                {
                    "label": "云端 SLO 真实性边界",
                    "status": "PASS" if "Synthetic" in str(data.get("scope")) or "synthetic" in str(data.get("scope")) else "FAIL",
                    "path": rel(report),
                    "evidence": str(data.get("scope")),
                },
            ]
        )
    return rows


def reviewer_drill_checks() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    report = CLOUD_APP / "qa" / "reviewer-drill-report.json"
    rows.append(check_file(report, "评委 5 分钟实操演练报告存在", 500))
    if report.exists():
        data = json.loads(read_text(report))
        summary = data.get("summary", {})
        anchors = summary.get("anchors", [])
        guided_tour = data.get("guidedTour", {})
        rows.extend(
            [
                {
                    "label": "评委演练 runtime",
                    "status": "PASS" if data.get("runtime") == "sepath-reviewer-drill.v1" else "FAIL",
                    "path": rel(report),
                    "evidence": str(data.get("runtime")),
                },
                {
                    "label": "评委演练 5 分钟路线达标",
                    "status": "PASS"
                    if summary.get("FAIL") == 0
                    and summary.get("PASS", 0) >= 7
                    and summary.get("durationSeconds") == 300
                    and summary.get("personas", 0) >= 5
                    else "FAIL",
                    "path": rel(report),
                    "evidence": f"PASS={summary.get('PASS')} FAIL={summary.get('FAIL')} durationSeconds={summary.get('durationSeconds')} personas={summary.get('personas')}",
                },
                {
                    "label": "评委演练关键锚点覆盖",
                    "status": "PASS"
                    if all(
                        anchor in anchors
                        for anchor in [
                            "#student",
                            "#teacher-report",
                            "#value",
                            "#cloud-slo",
                            "#backend-status",
                            "#judge-verification",
                            "#claim-ledger",
                            "#launch-loop",
                        ]
                    )
                    else "FAIL",
                    "path": rel(report),
                    "evidence": " / ".join(anchors),
                },
                {
                    "label": "评委演练真实性边界",
                    "status": "PASS" if "synthetic" in str(data.get("scope")) and "real course" in str(data.get("scope")) else "FAIL",
                    "path": rel(report),
                    "evidence": str(data.get("scope")),
                },
                {
                    "label": "评委一键导览 runtime",
                    "status": "PASS" if guided_tour.get("runtime") == "sepath-reviewer-guide.v1" else "FAIL",
                    "path": rel(report),
                    "evidence": str(guided_tour.get("runtime")),
                },
                {
                    "label": "评委一键导览锚点和动作",
                    "status": "PASS"
                    if guided_tour.get("totalSteps") == 11
                    and guided_tour.get("firstAnchor") == "#student"
                    and guided_tour.get("actions") == ["start", "step-through", "close"]
                    and "#cloud-slo" in guided_tour.get("autoScrollAnchors", [])
                    and "#backend-status" in guided_tour.get("autoScrollAnchors", [])
                    and "#public-url-receipt" in guided_tour.get("autoScrollAnchors", [])
                    and "#submission-closure" in guided_tour.get("autoScrollAnchors", [])
                    and "#claim-ledger" in guided_tour.get("autoScrollAnchors", [])
                    else "FAIL",
                    "path": rel(report),
                    "evidence": f"steps={guided_tour.get('totalSteps')} first={guided_tour.get('firstAnchor')} actions={guided_tour.get('actions')}",
                },
            ]
        )
    return rows


def reviewer_5min_pack_checks() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    pack = MATERIALS / "reviewer-5min-drill"
    manifest = pack / "REVIEWER_5MIN_DRILL.json"
    checks_path = pack / "manifest_checks.json"
    trace = pack / "drill_trace.json"
    scorecard = pack / "drill_scorecard.csv"
    quick_start = pack / "quick_start.md"
    fallback = pack / "fallback_cards.md"
    teacher = pack / "teacher_review_deep_dive.md"
    boundary = pack / "boundary_and_claims.md"
    rows.extend(
        [
            check_file(manifest, "评委 5 分钟独立演练包总清单", 1000),
            check_file(checks_path, "评委 5 分钟独立演练包校验清单", 500),
            check_file(trace, "评委 5 分钟独立演练轨迹", 500),
            check_file(scorecard, "评委 5 分钟评分映射 CSV", 200),
            check_file(quick_start, "评委 5 分钟快速开始卡", 500),
            check_file(fallback, "评委 5 分钟异常兜底卡", 300),
            check_file(teacher, "教师复核深潜卡", 500),
            check_file(boundary, "评委演练真实性边界卡", 500),
        ]
    )
    if manifest.exists():
        data = json.loads(read_text(manifest))
        route = data.get("route", [])
        route_ids = {item.get("id") for item in route}
        anchors = {item.get("product_anchor") for item in route}
        scorecard_rows = data.get("scorecard", [])
        forbidden_claims = data.get("forbidden_claims", [])
        checks_summary = data.get("checks_summary", {})
        artifact_files = data.get("artifact_files", [])
        rows.extend(
            [
                {
                    "label": "评委独立演练包 runtime",
                    "status": "PASS" if data.get("runtime") == "sepath-reviewer-5min-drill.v1" else "FAIL",
                    "path": rel(manifest),
                    "evidence": str(data.get("runtime")),
                },
                {
                    "label": "评委独立演练包 300 秒路线",
                    "status": "PASS"
                    if data.get("duration_seconds") == 300
                    and len(route) == 11
                    and all(
                        key in route_ids
                        for key in [
                            "open-trial",
                            "run-loop",
                            "inspect-teacher-gate",
                            "inspect-algorithm",
                            "inspect-cloud",
                            "inspect-public-url-receipt",
                            "inspect-submission-closure",
                            "inspect-backend-status",
                            "inspect-verification",
                            "inspect-claim-ledger",
                            "answer-boundary",
                        ]
                    )
                    else "FAIL",
                    "path": rel(manifest),
                    "evidence": f"duration={data.get('duration_seconds')} steps={len(route)}",
                },
                {
                    "label": "评委独立演练包关键锚点覆盖",
                    "status": "PASS"
                    if all(
                        anchor in anchors
                        for anchor in [
                            "#student",
                            "#teacher-report",
                            "#value",
                            "#cloud-slo",
                            "#backend-status",
                            "#public-url-receipt",
                            "#submission-closure",
                            "#judge-verification",
                            "#claim-ledger",
                            "#launch-loop",
                        ]
                    )
                    else "FAIL",
                    "path": rel(manifest),
                    "evidence": " / ".join(sorted(str(anchor) for anchor in anchors)),
                },
                {
                    "label": "评委独立演练包评分映射完整",
                    "status": "PASS"
                    if len(scorecard_rows) >= 5 and sum(int(item.get("weight", 0)) for item in scorecard_rows) == 100
                    else "FAIL",
                    "path": rel(manifest),
                    "evidence": f"rows={len(scorecard_rows)} weight={sum(int(item.get('weight', 0)) for item in scorecard_rows)}",
                },
                {
                    "label": "评委独立演练包真实性边界",
                    "status": "PASS"
                    if data.get("evidence_scope") == "synthetic_reviewer_walkthrough"
                    and len(forbidden_claims) >= 5
                    and "real course causal gains" in str(data.get("truth_boundary", ""))
                    else "FAIL",
                    "path": rel(manifest),
                    "evidence": f"scope={data.get('evidence_scope')} forbidden={len(forbidden_claims)}",
                },
                {
                    "label": "评委独立演练包自检全通过",
                    "status": "PASS" if checks_summary.get("FAIL") == 0 and checks_summary.get("PASS", 0) >= 10 else "FAIL",
                    "path": rel(checks_path),
                    "evidence": f"PASS={checks_summary.get('PASS')} FAIL={checks_summary.get('FAIL')}",
                },
                {
                    "label": "评委独立演练包产物清单",
                    "status": "PASS" if len(artifact_files) >= 8 else "FAIL",
                    "path": rel(manifest),
                    "evidence": f"files={len(artifact_files)}",
                },
            ]
        )
    return rows


def judge_route_orchestrator_checks() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    material_md = MATERIALS / "59_三段式评委评审路线与口径同步说明.md"
    material_json = MATERIALS / "59_三段式评委评审路线与口径同步说明_机器可读.json"
    route_dir = MATERIALS / "judge-route-orchestrator"
    manifest = route_dir / "JUDGE_ROUTE_ORCHESTRATOR.json"
    checks_path = route_dir / "manifest_checks.json"
    cards = route_dir / "route_cards.md"
    matrix_csv = route_dir / "route_matrix.csv"
    rows.extend(
        [
            check_file(material_md, "三段式评委路线说明", 1000),
            check_file(material_json, "三段式评委路线机器可读版", 1000),
            check_file(manifest, "三段式评委路线总控 JSON", 1000),
            check_file(checks_path, "三段式评委路线校验清单", 500),
            check_file(cards, "三段式评委路线卡", 500),
            check_file(matrix_csv, "三段式评委路线评分矩阵", 200),
        ]
    )
    if manifest.exists():
        data = json.loads(read_text(manifest))
        routes = data.get("routes", [])
        route_by_id = {item.get("id"): item for item in routes}
        totals = {
            route_id: sum(int(step.get("seconds") or 0) for step in route.get("steps", []))
            for route_id, route in route_by_id.items()
        }
        dimensions = {item.get("dimension") for item in data.get("score_matrix", [])}
        rows.extend(
            [
                {
                    "label": "三段式评委路线 runtime",
                    "status": "PASS" if data.get("runtime") == "sepath-judge-route-orchestrator.v1" else "FAIL",
                    "path": rel(manifest),
                    "evidence": str(data.get("runtime")),
                },
                {
                    "label": "三段式评委路线时长",
                    "status": "PASS"
                    if totals.get("briefing-3min") == 180
                    and totals.get("hands-on-5min") == 300
                    and totals.get("technical-10min") == 600
                    else "FAIL",
                    "path": rel(manifest),
                    "evidence": str(totals),
                },
                {
                    "label": "三段式评委路线评分维度覆盖",
                    "status": "PASS"
                    if all(
                        item in dimensions
                        for item in ["智能体架构设计", "自适应策略", "功能完整程度", "创新性与体验", "商业价值"]
                    )
                    else "FAIL",
                    "path": rel(manifest),
                    "evidence": " / ".join(sorted(str(item) for item in dimensions)),
                },
                {
                    "label": "三段式评委路线自检全通过",
                    "status": "PASS" if data.get("checks_summary", {}).get("FAIL") == 0 and data.get("checks_summary", {}).get("PASS", 0) >= 10 else "FAIL",
                    "path": rel(checks_path),
                    "evidence": f"PASS={data.get('checks_summary', {}).get('PASS')} FAIL={data.get('checks_summary', {}).get('FAIL')}",
                },
                {
                    "label": "三段式评委路线真实性边界",
                    "status": "PASS"
                    if data.get("evidence_scope") == "synthetic_demo_plus_machine_evidence"
                    and "real course causal gains" in str(data.get("truth_boundary", ""))
                    and len(data.get("forbidden_claims", [])) >= 5
                    else "FAIL",
                    "path": rel(manifest),
                    "evidence": f"scope={data.get('evidence_scope')} forbidden={len(data.get('forbidden_claims', []))}",
                },
            ]
        )
    return rows


def local_run_doctor_checks() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    doctor_dir = MATERIALS / "local-run-doctor"
    manifest = doctor_dir / "LOCAL_RUN_DOCTOR.json"
    checks_path = doctor_dir / "manifest_checks.json"
    readme = doctor_dir / "README.md"
    checklist = doctor_dir / "LOCAL_RUN_CHECKLIST.md"
    fallback = doctor_dir / "fallback_routes.md"
    matrix = doctor_dir / "local_env_matrix.csv"
    ps1 = doctor_dir / "RUN_LOCAL_DEMO.ps1"
    cmd = doctor_dir / "RUN_LOCAL_DEMO.cmd"
    rows.extend(
        [
            check_file(manifest, "本地运行环境自检包 JSON", 1000),
            check_file(checks_path, "本地运行环境自检校验清单", 500),
            check_file(readme, "本地运行环境自检说明", 500),
            check_file(checklist, "本地运行检查清单", 500),
            check_file(fallback, "本地运行失败兜底路线", 500),
            check_file(matrix, "本地运行环境矩阵", 200),
            check_file(ps1, "本地运行 PowerShell 自检脚本", 500),
            check_file(cmd, "本地运行 CMD 包装脚本", 50),
            check_file(ROOT / "scripts/generate_local_run_doctor_pack.py", "本地运行自检包生成脚本", 1000),
        ]
    )
    if manifest.exists():
        data = json.loads(read_text(manifest))
        expected_scripts = set(data.get("expected_npm_scripts", []))
        run_mode_ids = {item.get("id") for item in data.get("run_modes", [])}
        checks_summary = data.get("checks_summary", {})
        ps1_text = read_text(ps1) if ps1.exists() else ""
        rows.extend(
            [
                {
                    "label": "本地运行自检 runtime",
                    "status": "PASS" if data.get("runtime") == "sepath-local-run-doctor.v1" else "FAIL",
                    "path": rel(manifest),
                    "evidence": str(data.get("runtime")),
                },
                {
                    "label": "本地运行自检 npm 脚本覆盖",
                    "status": "PASS"
                    if len(expected_scripts) >= 10
                    and all(item in expected_scripts for item in ["dev", "build", "test", "cloud:reviewer-drill"])
                    else "FAIL",
                    "path": rel(manifest),
                    "evidence": " / ".join(sorted(expected_scripts)),
                },
                {
                    "label": "本地运行自检兜底模式覆盖",
                    "status": "PASS"
                    if len(run_mode_ids) >= 4
                    and all(
                        item in run_mode_ids
                        for item in ["public-static-first", "local-source-dev", "technical-no-run", "video-fallback"]
                    )
                    else "FAIL",
                    "path": rel(manifest),
                    "evidence": " / ".join(sorted(str(item) for item in run_mode_ids)),
                },
                {
                    "label": "本地运行自检全通过",
                    "status": "PASS" if checks_summary.get("FAIL") == 0 and checks_summary.get("PASS", 0) >= 8 else "FAIL",
                    "path": rel(checks_path),
                    "evidence": f"PASS={checks_summary.get('PASS')} FAIL={checks_summary.get('FAIL')}",
                },
                {
                    "label": "本地运行自检真实性边界",
                    "status": "PASS" if "does not install dependencies" in str(data.get("truth_boundary", "")) else "FAIL",
                    "path": rel(manifest),
                    "evidence": str(data.get("truth_boundary", "")),
                },
                {
                    "label": "本地运行自检脚本默认安全",
                    "status": "PASS"
                    if all(key in ps1_text for key in ["param(", "-Install", "-Start", "-OpenStatic", "npm run dev"])
                    else "FAIL",
                    "path": rel(ps1),
                    "evidence": "param/-Install/-Start/-OpenStatic/npm run dev",
                },
            ]
        )
    return rows


def submission_upload_preflight_checks() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    material_md = MATERIALS / "60_平台提交终检与上传凭证包.md"
    material_json = MATERIALS / "60_平台提交终检与上传凭证包_机器可读.json"
    preflight_dir = MATERIALS / "submission-upload-preflight"
    manifest = preflight_dir / "UPLOAD_PREFLIGHT.json"
    checks_path = preflight_dir / "manifest_checks.json"
    checklist = preflight_dir / "UPLOAD_CHECKLIST.md"
    fields_csv = preflight_dir / "platform_form_fields.csv"
    receipt = preflight_dir / "upload_receipt_template.md"
    timeline = preflight_dir / "final_upload_timeline.md"
    generator = ROOT / "scripts/generate_submission_upload_preflight_pack.py"
    rows.extend(
        [
            check_file(material_md, "平台提交终检与上传凭证包", 1000),
            check_file(material_json, "平台提交终检机器可读版", 1000),
            check_file(manifest, "平台提交终检 JSON", 1000),
            check_file(checks_path, "平台提交终检校验清单", 500),
            check_file(checklist, "平台提交终检清单", 1000),
            check_file(fields_csv, "平台提交字段矩阵", 200),
            check_file(receipt, "上传回执模板", 300),
            check_file(timeline, "最终上传时间线", 300),
            check_file(generator, "平台提交终检生成脚本", 1000),
        ]
    )
    if manifest.exists():
        data = json.loads(read_text(manifest))
        summary = data.get("checks_summary", {})
        authority = data.get("authoritative_package_metadata", {})
        fields = data.get("platform_fields", [])
        steps = data.get("upload_steps", [])
        receipt_fields = data.get("receipt_fields", [])
        rows.extend(
            [
                {
                    "label": "平台提交终检 runtime",
                    "status": "PASS" if data.get("runtime") == "sepath-submission-upload-preflight.v1" else "FAIL",
                    "path": rel(manifest),
                    "evidence": str(data.get("runtime")),
                },
                {
                    "label": "平台提交终检全通过",
                    "status": "PASS" if summary.get("FAIL") == 0 and summary.get("PASS", 0) >= 18 else "FAIL",
                    "path": rel(checks_path),
                    "evidence": f"PASS={summary.get('PASS')} FAIL={summary.get('FAIL')}",
                },
                {
                    "label": "平台提交终检字段覆盖",
                    "status": "PASS"
                    if len(fields) >= 10
                    and all(item in {field.get("field") for field in fields} for item in ["队伍名", "作品名称", "源码/Demo", "上传回执"])
                    else "FAIL",
                    "path": rel(manifest),
                    "evidence": f"fields={len(fields)}",
                },
                {
                    "label": "平台提交终检上传步骤",
                    "status": "PASS" if len(steps) >= 8 and any("提交后保存平台回执" in step for step in steps) else "FAIL",
                    "path": rel(manifest),
                    "evidence": f"steps={len(steps)}",
                },
                {
                    "label": "平台提交终检回执字段",
                    "status": "PASS"
                    if all(item in receipt_fields for item in ["package_sha256_from_manifest", "platform_receipt_screenshot_path", "final_access_policy"])
                    else "FAIL",
                    "path": rel(manifest),
                    "evidence": " / ".join(str(item) for item in receipt_fields),
                },
                {
                    "label": "平台提交终检不嵌入易变 ZIP 元数据",
                    "status": "PASS"
                    if all(
                        "see submission manifest" in str(authority.get(key, ""))
                        for key in ["size_bytes", "sha256", "file_count"]
                    )
                    else "FAIL",
                    "path": rel(manifest),
                    "evidence": str(authority),
                },
                {
                    "label": "平台提交终检真实性边界",
                    "status": "PASS"
                    if "does not invent team data" in str(data.get("truth_boundary", ""))
                    and len(data.get("forbidden_claims", [])) >= 5
                    else "FAIL",
                    "path": rel(manifest),
                    "evidence": str(data.get("truth_boundary", "")),
                },
            ]
        )
    return rows


def award_differentiation_checks() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    material_md = MATERIALS / "61_一等奖差异化创新证据包.md"
    material_json = MATERIALS / "61_一等奖差异化创新证据包_机器可读.json"
    pack = MATERIALS / "award-differentiation"
    manifest = pack / "AWARD_DIFFERENTIATION.json"
    checks_path = pack / "manifest_checks.json"
    matrix_csv = pack / "score_evidence_matrix.csv"
    objection_cards = pack / "judge_objection_cards.md"
    pitch = pack / "one_minute_pitch.md"
    innovation_map = pack / "innovation_map.md"
    generator = ROOT / "scripts/generate_award_differentiation_pack.py"
    rows.extend(
        [
            check_file(material_md, "一等奖差异化创新证据包", 1000),
            check_file(material_json, "一等奖差异化创新机器可读版", 1000),
            check_file(manifest, "一等奖差异化创新 JSON", 1000),
            check_file(checks_path, "一等奖差异化创新校验清单", 500),
            check_file(matrix_csv, "一等奖评分证据矩阵", 300),
            check_file(objection_cards, "一等奖评委追问回答卡", 500),
            check_file(pitch, "一等奖 60 秒主讲口径", 300),
            check_file(innovation_map, "一等奖创新地图", 500),
            check_file(generator, "一等奖差异化证据生成脚本", 1000),
        ]
    )
    if manifest.exists():
        data = json.loads(read_text(manifest))
        summary = data.get("checks_summary", {})
        score_matrix = data.get("official_score_matrix", [])
        total_weight = sum(int(item.get("weight", 0)) for item in score_matrix)
        criteria = {item.get("criterion") for item in score_matrix}
        differentientiators = data.get("differentiators", [])
        objections = data.get("objection_cards", [])
        pitch_lines = data.get("one_minute_pitch", [])
        rows.extend(
            [
                {
                    "label": "一等奖差异化 runtime",
                    "status": "PASS" if data.get("runtime") == "sepath-award-differentiation.v1" else "FAIL",
                    "path": rel(manifest),
                    "evidence": str(data.get("runtime")),
                },
                {
                    "label": "一等奖差异化自检全通过",
                    "status": "PASS" if summary.get("FAIL") == 0 and summary.get("PASS", 0) >= 20 else "FAIL",
                    "path": rel(checks_path),
                    "evidence": f"PASS={summary.get('PASS')} FAIL={summary.get('FAIL')}",
                },
                {
                    "label": "一等奖差异化评分权重",
                    "status": "PASS"
                    if total_weight == 100
                    and all(
                        item in criteria
                        for item in ["智能体架构设计", "自适应策略", "功能完整程度", "创新性与体验", "商业价值"]
                    )
                    else "FAIL",
                    "path": rel(matrix_csv),
                    "evidence": f"weight={total_weight} criteria={' / '.join(sorted(str(item) for item in criteria))}",
                },
                {
                    "label": "一等奖差异化创新断点",
                    "status": "PASS"
                    if len(differentientiators) >= 6
                    and all(key in " ".join(str(item) for item in differentientiators) for key in ["EvidenceEvent", "SafeVOI", "教师"])
                    and ("科研" in " ".join(str(item) for item in differentientiators) or "研究" in " ".join(str(item) for item in differentientiators))
                    else "FAIL",
                    "path": rel(manifest),
                    "evidence": f"differentiators={len(differentientiators)}",
                },
                {
                    "label": "一等奖差异化追问卡",
                    "status": "PASS" if len(objections) >= 5 and any("普通 AI" in item.get("question", "") for item in objections) else "FAIL",
                    "path": rel(objection_cards),
                    "evidence": f"objections={len(objections)}",
                },
                {
                    "label": "一等奖差异化 60 秒口径",
                    "status": "PASS" if len(pitch_lines) >= 5 and any("不是普通 AI" in line for line in pitch_lines) else "FAIL",
                    "path": rel(pitch),
                    "evidence": f"pitch_lines={len(pitch_lines)}",
                },
                {
                    "label": "一等奖差异化真实性边界",
                    "status": "PASS"
                    if "does not claim real school production deployment" in str(data.get("truth_boundary", ""))
                    else "FAIL",
                    "path": rel(manifest),
                    "evidence": str(data.get("truth_boundary", "")),
                },
            ]
        )
    return rows


def claim_evidence_ledger_checks() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    material_md = MATERIALS / "62_主张证据账本与真实性核验包.md"
    material_json = MATERIALS / "62_主张证据账本与真实性核验包_机器可读.json"
    pack = MATERIALS / "claim-evidence-ledger"
    manifest = pack / "CLAIM_EVIDENCE_LEDGER.json"
    checks_path = pack / "manifest_checks.json"
    matrix_csv = pack / "claim_evidence_matrix.csv"
    tier_map = pack / "claim_tier_map.md"
    forbidden = pack / "forbidden_claims_crosscheck.md"
    evidence_index = pack / "evidence_paths_index.csv"
    generator = ROOT / "scripts/generate_claim_evidence_ledger_pack.py"
    product_engine = ROOT / "sepath-cloud-app/src/engine/claimEvidenceLedger.ts"
    product_panel = ROOT / "sepath-cloud-app/src/components/ClaimEvidenceLedgerPanel.tsx"
    rows.extend(
        [
            check_file(material_md, "主张证据账本与真实性核验包", 1000),
            check_file(material_json, "主张证据账本机器可读版", 1000),
            check_file(manifest, "主张证据账本 JSON", 1000),
            check_file(checks_path, "主张证据账本校验清单", 500),
            check_file(matrix_csv, "主张证据矩阵", 300),
            check_file(tier_map, "主张声明等级表", 300),
            check_file(forbidden, "禁止声明交叉检查", 300),
            check_file(evidence_index, "主张证据路径索引", 300),
            check_file(generator, "主张证据账本生成脚本", 1000),
            check_file(product_engine, "产品内主张账本引擎", 1000),
            check_file(product_panel, "产品内主张账本面板", 1000),
        ]
    )
    if manifest.exists():
        data = json.loads(read_text(manifest))
        summary = data.get("checks_summary", {})
        claims = data.get("claims", [])
        tiers = {item.get("tier") for item in data.get("claim_tiers", [])}
        rows.extend(
            [
                {
                    "label": "主张证据账本 runtime",
                    "status": "PASS" if data.get("runtime") == "sepath-claim-evidence-ledger.v1" else "FAIL",
                    "path": rel(manifest),
                    "evidence": str(data.get("runtime")),
                },
                {
                    "label": "主张证据账本自检全通过",
                    "status": "PASS" if summary.get("FAIL") == 0 and summary.get("PASS", 0) >= 17 else "FAIL",
                    "path": rel(checks_path),
                    "evidence": f"PASS={summary.get('PASS')} FAIL={summary.get('FAIL')}",
                },
                {
                    "label": "主张证据账本声明等级完整",
                    "status": "PASS" if {"L0", "L1", "L2", "L3"} <= tiers and len(tiers) == 4 else "FAIL",
                    "path": rel(tier_map),
                    "evidence": " / ".join(sorted(str(item) for item in tiers)),
                },
                {
                    "label": "主张证据账本覆盖核心主张",
                    "status": "PASS"
                    if len(claims) >= 12
                    and all(len(item.get("evidence_paths", [])) >= 3 and item.get("forbidden_wording") for item in claims)
                    else "FAIL",
                    "path": rel(matrix_csv),
                    "evidence": f"claims={len(claims)}",
                },
                {
                    "label": "主张证据账本真实性边界",
                    "status": "PASS"
                    if "does not upgrade L0/L1" in str(data.get("truth_boundary", ""))
                    and len(data.get("forbidden_claims", [])) >= 8
                    else "FAIL",
                    "path": rel(forbidden),
                    "evidence": str(data.get("truth_boundary", "")),
                },
                {
                    "label": "主张证据账本产品内可查",
                    "status": "PASS"
                    if data.get("product_anchor") == "#claim-ledger"
                    and data.get("artifacts", {}).get("product_engine") == "sepath-cloud-app/src/engine/claimEvidenceLedger.ts"
                    and data.get("artifacts", {}).get("product_panel")
                    == "sepath-cloud-app/src/components/ClaimEvidenceLedgerPanel.tsx"
                    else "FAIL",
                    "path": rel(manifest),
                    "evidence": f"anchor={data.get('product_anchor')} artifacts={data.get('artifacts', {})}",
                },
            ]
        )
    return rows


def judge_launchpad_checks() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    root_html = MATERIALS / "00_评委一键打开入口.html"
    root_md = MATERIALS / "00_评委一键打开入口.md"
    launchpad = MATERIALS / "judge-launchpad"
    html_path = launchpad / "START_HERE.html"
    md_path = launchpad / "START_HERE.md"
    manifest_path = launchpad / "JUDGE_LAUNCHPAD_MANIFEST.json"
    checks_path = launchpad / "manifest_checks.json"
    rows.extend(
        [
            check_file(root_html, "评委一键打开入口 HTML", 1000),
            check_file(root_md, "评委一键打开入口 Markdown", 500),
            check_file(html_path, "评委一键启动入口包 HTML", 1000),
            check_file(md_path, "评委一键启动入口包 Markdown", 500),
            check_file(manifest_path, "评委一键启动入口包 manifest", 1000),
            check_file(checks_path, "评委一键启动入口包校验清单", 500),
        ]
    )
    if manifest_path.exists():
        data = json.loads(read_text(manifest_path))
        entrypoints = data.get("entrypoints", [])
        entry_ids = {item.get("id") for item in entrypoints}
        checks_summary = data.get("checks_summary", {})
        rows.extend(
            [
                {
                    "label": "评委一键入口 runtime",
                    "status": "PASS" if data.get("runtime") == "sepath-judge-launchpad.v1" else "FAIL",
                    "path": rel(manifest_path),
                    "evidence": str(data.get("runtime")),
                },
                {
                    "label": "评委一键入口关键入口覆盖",
                    "status": "PASS"
                    if all(
                        key in entry_ids
                        for key in [
                            "public-demo",
                            "five-minute-drill",
                            "quick-drill-card",
                            "judge-route-orchestrator",
                            "demo-video",
                            "reviewer-readme",
                            "start-demo",
                            "local-run-doctor",
                            "upload-preflight",
                            "award-differentiation",
                            "claim-evidence-ledger",
                            "ppt",
                            "pdf",
                            "audit",
                            "submission-manifest",
                            "boundary",
                        ]
                    )
                    else "FAIL",
                    "path": rel(manifest_path),
                    "evidence": " / ".join(sorted(str(item) for item in entry_ids)),
                },
                {
                    "label": "评委一键入口自检全通过",
                    "status": "PASS" if checks_summary.get("FAIL") == 0 and checks_summary.get("PASS", 0) >= 19 else "FAIL",
                    "path": rel(checks_path),
                    "evidence": f"PASS={checks_summary.get('PASS')} FAIL={checks_summary.get('FAIL')}",
                },
                {
                    "label": "评委一键入口真实性边界",
                    "status": "PASS"
                    if data.get("evidence_scope") == "synthetic_demo_plus_machine_evidence"
                    and "real course causal gains" in str(data.get("truth_boundary", ""))
                    else "FAIL",
                    "path": rel(manifest_path),
                    "evidence": f"scope={data.get('evidence_scope')}",
                },
                {
                    "label": "评委一键入口 HTML 可直达公开 Demo",
                    "status": "PASS"
                    if "公开试用静态包/index.html" in read_text(root_html)
                    and "reviewer-5min-drill/REVIEWER_5MIN_DRILL.json" in read_text(root_html)
                    and "../submission/SE-Path学伴_阶段提交包_v0.4_2026-08-09_manifest.json" in read_text(root_html)
                    else "FAIL",
                    "path": rel(root_html),
                    "evidence": "links public demo, drill pack and submission manifest",
                },
            ]
        )
    return rows


def competition_requirement_alignment_checks() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    material_md = MATERIALS / "69_赛题要求逐项对齐矩阵与夺奖证据总表.md"
    material_json = MATERIALS / "69_赛题要求逐项对齐矩阵与夺奖证据总表_机器可读.json"
    pack = MATERIALS / "competition-requirement-alignment"
    primary_json = pack / "COMPETITION_REQUIREMENT_ALIGNMENT.json"
    checks_json = pack / "manifest_checks.json"
    matrix_csv = pack / "requirement_alignment_matrix.csv"
    judge_card = pack / "judge_requirement_checklist.md"
    risk_card = pack / "risk_boundary_cards.md"
    generator = ROOT / "scripts/generate_competition_requirement_alignment_pack.py"
    rows.extend(
        [
            check_file(material_md, "赛题要求逐项对齐矩阵", 1000),
            check_file(material_json, "赛题要求逐项对齐机器可读版", 1000),
            check_file(primary_json, "赛题要求对齐总控 JSON", 1000),
            check_file(checks_json, "赛题要求对齐校验清单", 500),
            check_file(matrix_csv, "赛题要求对齐 CSV", 300),
            check_file(judge_card, "赛题要求评委检查卡", 500),
            check_file(risk_card, "赛题要求风险边界卡", 300),
            check_file(generator, "赛题要求对齐生成脚本", 1000),
        ]
    )
    if primary_json.exists():
        data = json.loads(read_text(primary_json))
        checks_summary = data.get("checks_summary", {})
        core = data.get("official_core_capabilities", [])
        prelim = data.get("preliminary_score_matrix", [])
        final = data.get("final_roadshow_score_matrix", [])
        submission = data.get("submission_requirements", [])
        evidence_paths = data.get("evidence_paths", [])
        rows.extend(
            [
                {
                    "label": "赛题要求对齐 runtime",
                    "status": "PASS" if data.get("runtime") == "sepath-competition-requirement-alignment.v1" else "FAIL",
                    "path": rel(primary_json),
                    "evidence": str(data.get("runtime")),
                },
                {
                    "label": "赛题四项核心能力覆盖",
                    "status": "PASS"
                    if {item.get("official_requirement") for item in core}
                    == {"学情诊断", "路径规划", "实时干预", "记忆与反思"}
                    else "FAIL",
                    "path": rel(primary_json),
                    "evidence": " / ".join(str(item.get("official_requirement")) for item in core),
                },
                {
                    "label": "赛题初赛评分权重",
                    "status": "PASS" if sum(int(item.get("weight", 0)) for item in prelim) == 100 else "FAIL",
                    "path": rel(primary_json),
                    "evidence": str(sum(int(item.get("weight", 0)) for item in prelim)),
                },
                {
                    "label": "赛题决赛评分权重",
                    "status": "PASS" if sum(int(item.get("weight", 0)) for item in final) == 100 else "FAIL",
                    "path": rel(primary_json),
                    "evidence": str(sum(int(item.get("weight", 0)) for item in final)),
                },
                {
                    "label": "赛题提交要求覆盖",
                    "status": "PASS" if len(submission) >= 6 else "FAIL",
                    "path": rel(primary_json),
                    "evidence": str(len(submission)),
                },
                {
                    "label": "赛题对齐证据路径可复核",
                    "status": "PASS" if len(evidence_paths) >= 25 else "FAIL",
                    "path": rel(matrix_csv),
                    "evidence": str(len(evidence_paths)),
                },
                {
                    "label": "赛题对齐自检全通过",
                    "status": "PASS" if checks_summary.get("FAIL") == 0 and checks_summary.get("PASS", 0) >= 10 else "FAIL",
                    "path": rel(checks_json),
                    "evidence": f"PASS={checks_summary.get('PASS')} FAIL={checks_summary.get('FAIL')}",
                },
                {
                    "label": "赛题对齐保留真实性边界",
                    "status": "PASS"
                    if "final human confirmation" in str(data.get("truth_boundary", ""))
                    and any("不能宣称" in str(item) for item in data.get("forbidden_claims", []))
                    else "FAIL",
                    "path": rel(risk_card),
                    "evidence": "truth boundary and forbidden claims retained",
                },
            ]
        )
    return rows


def hosting_upload_selftest_checks() -> list[dict[str, Any]]:
    pack = MATERIALS / "public-hosting-selftest"
    report_md = MATERIALS / "67_静态托管平台配置自检与故障恢复卡.md"
    report_json = MATERIALS / "67_静态托管平台配置自检与故障恢复卡_机器可读.json"
    selftest = pack / "HOSTING_UPLOAD_SELFTEST.json"
    manifest_checks = pack / "manifest_checks.json"
    provider_matrix = pack / "HOSTING_PROVIDER_MATRIX.csv"
    troubleshooting = pack / "HOSTING_TROUBLESHOOTING.md"
    run_ps1 = pack / "RUN_HOSTING_SELFTEST.ps1"
    run_cmd = pack / "RUN_HOSTING_SELFTEST.cmd"
    rows = [
        check_file(report_md, "静态托管平台配置自检说明", 1000),
        check_file(report_json, "静态托管平台配置自检机器可读版", 1000),
        check_file(selftest, "静态托管上传自检包 JSON", 1000),
        check_file(manifest_checks, "静态托管上传自检校验清单", 500),
        check_file(provider_matrix, "静态托管平台矩阵", 300),
        check_file(troubleshooting, "静态托管故障恢复卡", 1000),
        check_file(run_ps1, "静态托管 PowerShell 自检脚本", 100),
        check_file(run_cmd, "静态托管 CMD 自检脚本", 80),
    ]
    data = read_json(selftest) if selftest.exists() else {}
    checks = read_json(manifest_checks) if manifest_checks.exists() else {}
    rows.extend(
        [
            {
                "label": "静态托管自检 schema",
                "status": "PASS"
                if data.get("runtime") == "sepath-public-hosting-selftest.v1"
                and data.get("status") == "ready_for_external_static_hosting"
                and data.get("summary", {}).get("FAIL") == 0
                and data.get("summary", {}).get("PASS", 0) >= 10
                else "FAIL",
                "path": rel(selftest),
                "evidence": f"runtime={data.get('runtime')} status={data.get('status')} summary={data.get('summary')}",
            },
            {
                "label": "静态托管平台矩阵覆盖",
                "status": "PASS"
                if len(data.get("provider_matrix", [])) >= 5
                and all(
                    key in {item.get("provider") for item in data.get("provider_matrix", [])}
                    for key in ["Netlify Drop", "Cloudflare Pages Direct Upload", "Vercel Static Project"]
                )
                else "FAIL",
                "path": rel(selftest),
                "evidence": f"providers={len(data.get('provider_matrix', []))}",
            },
            {
                "label": "静态托管 ZIP 元数据一致",
                "status": "PASS"
                if data.get("upload_zip") == "参赛提交材料包/public-site-upload/SE-Path学伴_公开静态站点上传包_v0.1.zip"
                and data.get("zip_entry_count", 0) >= 20
                and data.get("missing_required_zip_entries") == []
                else "FAIL",
                "path": rel(selftest),
                "evidence": f"zip={data.get('upload_zip')} entries={data.get('zip_entry_count')} missing={data.get('missing_required_zip_entries')}",
            },
            {
                "label": "静态托管自检边界声明",
                "status": "PASS"
                if "does not prove the external public URL is already deployed" in str(data.get("truth_boundary", ""))
                and "Synthetic demo data" in str(data.get("privacy_boundary", ""))
                else "FAIL",
                "path": rel(selftest),
                "evidence": str(data.get("truth_boundary", ""))[:180],
            },
            {
                "label": "静态托管自检清单全通过",
                "status": "PASS"
                if checks.get("runtime") == "sepath-public-hosting-selftest-checks.v1"
                and checks.get("summary", {}).get("FAIL") == 0
                and checks.get("summary", {}).get("PASS", 0) >= 10
                else "FAIL",
                "path": rel(manifest_checks),
                "evidence": f"PASS={checks.get('summary', {}).get('PASS')} FAIL={checks.get('summary', {}).get('FAIL')}",
            },
        ]
    )
    return rows


def public_deploy_playbook_checks() -> list[dict[str, Any]]:
    pack = MATERIALS / "public-deploy-playbook"
    material_md = MATERIALS / "70_公网部署实操包与回执封存说明.md"
    material_json = MATERIALS / "70_公网部署实操包与回执封存说明_机器可读.json"
    primary_json = pack / "PUBLIC_DEPLOY_PLAYBOOK.json"
    manifest_checks = pack / "manifest_checks.json"
    matrix_csv = pack / "platform_deploy_matrix.csv"
    deploy_day_checklist = pack / "DEPLOY_DAY_CHECKLIST.md"
    receipt_sealing = pack / "URL_RECEIPT_SEALING.md"
    failure_recovery = pack / "FAILURE_RECOVERY.md"
    index_sync = pack / "INDEX_SYNC_REPORT.json"
    run_ps1 = pack / "RUN_DEPLOY_PLAYBOOK.ps1"
    run_cmd = pack / "RUN_DEPLOY_PLAYBOOK.cmd"
    generator = ROOT / "scripts/generate_public_deploy_playbook_pack.py"
    index_sync_script = ROOT / "scripts/sync_public_deploy_index_materials.py"
    rows = [
        check_file(material_md, "公网部署实操包与回执封存说明", 1000),
        check_file(material_json, "公网部署实操包机器可读版", 1000),
        check_file(primary_json, "公网部署实操总控 JSON", 1000),
        check_file(manifest_checks, "公网部署实操校验清单", 500),
        check_file(matrix_csv, "公网部署平台矩阵", 300),
        check_file(deploy_day_checklist, "公网部署提交日清单", 300),
        check_file(receipt_sealing, "公网 URL 回执封存说明", 300),
        check_file(failure_recovery, "公网部署失败恢复卡", 600),
        check_file(index_sync, "公网部署索引同步报告", 300),
        check_file(run_ps1, "公网部署 PowerShell 实操脚本", 100),
        check_file(run_cmd, "公网部署 CMD 实操脚本", 100),
        check_file(generator, "公网部署实操包生成脚本", 1000),
        check_file(index_sync_script, "公网部署索引同步脚本", 1000),
    ]
    data = read_json(primary_json) if primary_json.exists() else {}
    material = read_json(material_json) if material_json.exists() else {}
    checks = read_json(manifest_checks) if manifest_checks.exists() else {}
    index_sync_data = read_json(index_sync) if index_sync.exists() else {}
    providers = data.get("platform_matrix", [])
    provider_names = {item.get("provider") for item in providers}
    index_texts = "\n".join(
        [
            read_text(MATERIALS / "README_提交材料总览.md"),
            read_text(MATERIALS / "START_DEMO.md"),
            read_text(MATERIALS / "00_评委速读与评分导航.md"),
        ]
    )
    rows.extend(
        [
            {
                "label": "公网部署实操包 schema",
                "status": "PASS"
                if data.get("runtime") == "sepath-public-deploy-playbook.v1"
                and data.get("status") in {"ready_for_human_public_deploy", "ready_for_platform_submission"}
                and data.get("final_url_status") in {"pending_external_public_url", "ready_for_platform"}
                and data.get("checks_summary", {}).get("FAIL") == 0
                and data.get("checks_summary", {}).get("PASS", 0) >= 12
                else "FAIL",
                "path": rel(primary_json),
                "evidence": f"runtime={data.get('runtime')} status={data.get('status')} final_url={data.get('final_url_status')} summary={data.get('checks_summary')}",
            },
            {
                "label": "公网部署平台路线覆盖",
                "status": "PASS"
                if len(providers) >= 7
                and {"Netlify Drop", "Cloudflare Pages Direct Upload", "Vercel Static Project", "GitHub Pages"}.issubset(provider_names)
                else "FAIL",
                "path": rel(matrix_csv),
                "evidence": f"providers={len(providers)} names={' / '.join(sorted(str(name) for name in provider_names))}",
            },
            {
                "label": "公网部署 URL 状态未越界",
                "status": "PASS"
                if (
                    data.get("final_url_status") == "ready_for_platform"
                    and data.get("manual_gate") == "external_url_sealed"
                )
                or (
                    data.get("final_url_status") == "pending_external_public_url"
                    and data.get("manual_gate") == "external_static_hosting_url_required"
                    and data.get("final_public_url") == "PENDING_FINAL_PUBLIC_URL"
                )
                else "FAIL",
                "path": rel(primary_json),
                "evidence": f"gate={data.get('manual_gate')} url={data.get('final_public_url')}",
            },
            {
                "label": "公网部署上传包 SHA 继承",
                "status": "PASS"
                if data.get("upload_zip_sha256")
                and data.get("upload_zip_sha256") == read_json(MATERIALS / "public-site-upload/PUBLIC_SITE_UPLOAD_MANIFEST.json").get("zip_sha256")
                else "FAIL",
                "path": rel(primary_json),
                "evidence": f"sha={data.get('upload_zip_sha256')}",
            },
            {
                "label": "公网部署回执命令齐备",
                "status": "PASS"
                if data.get("final_validation_command") == "rtk python scripts/finalize_public_url_receipt.py --url https://your-public-demo.example --write"
                and data.get("sync_platform_copy_command") == "rtk python scripts/finalize_public_url_receipt.py --url https://your-public-demo.example --write --sync-platform-copy"
                and data.get("final_public_url_receipt") == "submission/final_public_url_receipt.json"
                else "FAIL",
                "path": rel(receipt_sealing),
                "evidence": f"validation={data.get('final_validation_command')} sync={data.get('sync_platform_copy_command')}",
            },
            {
                "label": "公网部署边界声明",
                "status": "PASS"
                if "不能宣称已经拥有最终公网 URL" in str(data.get("truth_boundary", ""))
                and "真实学生隐私" in str(data.get("privacy_boundary", ""))
                else "FAIL",
                "path": rel(material_md),
                "evidence": str(data.get("truth_boundary", ""))[:180],
            },
            {
                "label": "公网部署材料机器可读版一致",
                "status": "PASS"
                if material.get("runtime") == "sepath-public-deploy-playbook-material.v1"
                and material.get("status") == data.get("status")
                and material.get("final_url_status") == data.get("final_url_status")
                and material.get("playbook_json") == "参赛提交材料包/public-deploy-playbook/PUBLIC_DEPLOY_PLAYBOOK.json"
                else "FAIL",
                "path": rel(material_json),
                "evidence": f"runtime={material.get('runtime')} status={material.get('status')} final_url={material.get('final_url_status')}",
            },
            {
                "label": "公网部署校验清单全通过",
                "status": "PASS"
                if checks.get("runtime") == "sepath-public-deploy-playbook-checks.v1"
                and checks.get("summary", {}).get("FAIL") == 0
                and checks.get("summary", {}).get("PASS", 0) >= 12
                else "FAIL",
                "path": rel(manifest_checks),
                "evidence": f"runtime={checks.get('runtime')} summary={checks.get('summary')}",
            },
            {
                "label": "公网部署评委索引已同步",
                "status": "PASS"
                if index_sync_data.get("runtime") == "sepath-public-deploy-index-sync.v1"
                and index_sync_data.get("summary", {}).get("FAIL") == 0
                and index_texts.count("70_公网部署实操包与回执封存说明.md") >= 3
                and index_texts.count("71_公网URL回填后的正式提交收口说明.md") >= 3
                and index_texts.count("public-deploy-playbook") >= 3
                else "FAIL",
                "path": rel(index_sync),
                "evidence": f"runtime={index_sync_data.get('runtime')} summary={index_sync_data.get('summary')} material70_refs={index_texts.count('70_公网部署实操包与回执封存说明.md')} material71_refs={index_texts.count('71_公网URL回填后的正式提交收口说明.md')} pack_refs={index_texts.count('public-deploy-playbook')}",
            },
        ]
    )
    return rows


def material_checks() -> list[dict[str, Any]]:
    files = [
        ("评委一键打开入口 HTML", MATERIALS / "00_评委一键打开入口.html"),
        ("评委一键打开入口说明", MATERIALS / "00_评委一键打开入口.md"),
        ("评委速读与评分导航", MATERIALS / "00_评委速读与评分导航.md"),
        ("材料总览", MATERIALS / "README_提交材料总览.md"),
        ("项目计划书导出清单", MATERIALS / "01_项目计划书_PDF导出清单.md"),
        ("演示视频脚本", MATERIALS / "02_演示视频脚本_3-5分钟.md"),
        ("源码与上云部署说明", MATERIALS / "03_源码与上云部署说明.md"),
        ("答辩 PPT 结构", MATERIALS / "04_答辩PPT结构.md"),
        ("真实性与边界声明", MATERIALS / "05_真实性与边界声明.md"),
        ("答辩问答准备", MATERIALS / "06_答辩问答准备.md"),
        ("开源项目创新矩阵", MATERIALS / "08_开源项目创新矩阵.md"),
        ("比赛平台填写文案", MATERIALS / "10_比赛平台填写文案.md"),
        ("上线试用与交付运维方案", MATERIALS / "11_上线试用与交付运维方案.md"),
        ("最终发布门禁与一键验收说明", MATERIALS / "12_最终发布门禁与一键验收说明.md"),
        ("算法验证与科研证据说明", MATERIALS / "13_算法验证与科研证据说明.md"),
        ("真实仓库接入与数据治理方案", MATERIALS / "14_真实仓库接入与数据治理方案.md"),
        ("班级 GrowthOps 与教师运营看板方案", MATERIALS / "15_班级GrowthOps与教师运营看板方案.md"),
        ("公开试用发布包与云端迁移手册", MATERIALS / "16_公开试用发布包与云端迁移手册.md"),
        ("策略实验室与 SafeVOI 对照仿真说明", MATERIALS / "17_策略实验室与SafeVOI对照仿真说明.md"),
        ("课程试点上线工作台说明", MATERIALS / "18_课程试点上线工作台说明.md"),
        ("证据账本导入恢复与工作空间迁移说明", MATERIALS / "19_证据账本导入恢复与工作空间迁移说明.md"),
        ("权限与隐私治理中心说明", MATERIALS / "20_权限与隐私治理中心说明.md"),
        ("API 与集成契约中心说明", MATERIALS / "21_API与集成契约中心说明.md"),
        ("模型与实验治理中心说明", MATERIALS / "22_模型与实验治理中心说明.md"),
        ("课程配置与 Rubric Studio 说明", MATERIALS / "23_课程配置与RubricStudio说明.md"),
        ("教师周报与试点复盘中心说明", MATERIALS / "24_教师周报与试点复盘中心说明.md"),
        ("学生对话实验台与智能干预说明", MATERIALS / "25_学生对话实验台与智能干预说明.md"),
        ("集成回放沙箱与 Webhook 试运行说明", MATERIALS / "26_集成回放沙箱与Webhook试运行说明.md"),
        ("学习增值评估中心与科研算法融合说明", MATERIALS / "27_学习增值评估中心与科研算法融合说明.md"),
        ("评委试用与交付控制台说明", MATERIALS / "28_评委试用与交付控制台说明.md"),
        ("AI Agent 运行时与模型接入中心说明", MATERIALS / "29_AI Agent运行时与模型接入中心说明.md"),
        ("课程开班向导与首周试点落地说明", MATERIALS / "30_课程开班向导与首周试点落地说明.md"),
        ("比赛提交助手与材料封装说明", MATERIALS / "31_比赛提交助手与材料封装说明.md"),
        ("视频与路演导演说明", MATERIALS / "32_视频与路演导演说明.md"),
        ("试点遥测与效果验证中心说明", MATERIALS / "33_试点遥测与效果验证中心说明.md"),
        ("多租户上云运营中心说明", MATERIALS / "34_多租户上云运营中心说明.md"),
        ("教师标注与 Rubric 校准中心说明", MATERIALS / "35_教师标注与Rubric校准中心说明.md"),
        ("科研算法融合与开源证据中台说明", MATERIALS / "36_科研算法融合与开源证据中台说明.md"),
        ("推理网关与 GraphRAG 试验台说明", MATERIALS / "37_推理网关与GraphRAG试验台说明.md"),
        ("学校初始化与演示账号中心说明", MATERIALS / "38_学校初始化与演示账号中心说明.md"),
        ("生产数据平面与部署运维中心说明", MATERIALS / "39_生产数据平面与部署运维中心说明.md"),
        ("最终提交上传作战手册", MATERIALS / "40_最终提交上传作战手册.md"),
        ("最终上传与路演控制台说明", MATERIALS / "41_最终上传与路演控制台说明.md"),
        ("干预发布与教学行动包中心说明", MATERIALS / "42_干预发布与教学行动包中心说明.md"),
        ("评委云端交付体检中心说明", MATERIALS / "43_评委云端交付体检中心说明.md"),
        ("Edge API 运行时与后端接口验收说明", MATERIALS / "44_EdgeAPI运行时与后端接口验收说明.md"),
        ("提交日人工确认决策卡", MATERIALS / "45_提交日人工确认决策卡.md"),
        ("提交日人工确认决策卡机器可读版", MATERIALS / "45_提交日人工确认决策卡_机器可读.json"),
        ("评委技术验收包", MATERIALS / "46_评委技术验收包.md"),
        ("评委技术验收包机器可读版", MATERIALS / "46_评委技术验收包_机器可读.json"),
        ("评委试用账号与种子数据包", MATERIALS / "47_评委试用账号与种子数据包.md"),
        ("评委试用账号与种子数据包机器可读版", MATERIALS / "47_评委试用账号与种子数据包_机器可读.json"),
        ("公开试用 PWA 离线容灾包说明", MATERIALS / "48_公开试用PWA离线容灾包说明.md"),
        ("公开试用 PWA 离线容灾包机器可读版", MATERIALS / "48_公开试用PWA离线容灾包说明_机器可读.json"),
        ("云端 SLO 容量压测与成本预算说明", MATERIALS / "49_云端SLO容量压测与成本预算说明.md"),
        ("云端 SLO 容量压测与成本预算机器可读版", MATERIALS / "49_云端SLO容量压测与成本预算说明_机器可读.json"),
        ("评委 5 分钟实操演练与教师复核深潜说明", MATERIALS / "50_评委5分钟实操演练与教师复核深潜说明.md"),
        ("评委 5 分钟实操演练机器可读版", MATERIALS / "50_评委5分钟实操演练与教师复核深潜说明_机器可读.json"),
        ("后端连接状态中心与上线边界说明", MATERIALS / "51_后端连接状态中心与上线边界说明.md"),
        ("后端连接状态中心机器可读版", MATERIALS / "51_后端连接状态中心与上线边界说明_机器可读.json"),
        ("决赛路演口播稿与评委追问回答卡", MATERIALS / "52_决赛路演口播稿与评委追问回答卡.md"),
        ("决赛路演口播稿机器可读版", MATERIALS / "52_决赛路演口播稿与评委追问回答卡_机器可读.json"),
        ("产品内决赛追问指挥台说明", MATERIALS / "53_产品内决赛追问指挥台说明.md"),
        ("产品内决赛追问指挥台机器可读版", MATERIALS / "53_产品内决赛追问指挥台说明_机器可读.json"),
        ("正式提交画像与命名副本生成说明", MATERIALS / "54_正式提交画像与命名副本生成说明.md"),
        ("正式提交画像配置模板", MATERIALS / "54_正式提交画像配置模板.json"),
        ("获奖级完成度总验收报告", MATERIALS / "55_获奖级完成度总验收报告.md"),
        ("获奖级完成度总验收报告机器可读版", MATERIALS / "55_获奖级完成度总验收报告_机器可读.json"),
        ("上线级闭环验收剧本", MATERIALS / "56_上线级闭环验收剧本.md"),
        ("上线级闭环验收剧本机器可读版", MATERIALS / "56_上线级闭环验收剧本_机器可读.json"),
        ("最终提交信息采集与一键画像生成说明", MATERIALS / "57_最终提交信息采集与一键画像生成说明.md"),
        ("真实课程试点证据归档与声明门禁说明", MATERIALS / "58_真实课程试点证据归档与声明门禁说明.md"),
        ("真实课程试点证据归档机器可读版", MATERIALS / "58_真实课程试点证据归档与声明门禁说明_机器可读.json"),
        ("三段式评委评审路线与口径同步说明", MATERIALS / "59_三段式评委评审路线与口径同步说明.md"),
        ("三段式评委评审路线机器可读版", MATERIALS / "59_三段式评委评审路线与口径同步说明_机器可读.json"),
        ("平台提交终检与上传凭证包", MATERIALS / "60_平台提交终检与上传凭证包.md"),
        ("平台提交终检机器可读版", MATERIALS / "60_平台提交终检与上传凭证包_机器可读.json"),
        ("一等奖差异化创新证据包", MATERIALS / "61_一等奖差异化创新证据包.md"),
        ("一等奖差异化创新机器可读版", MATERIALS / "61_一等奖差异化创新证据包_机器可读.json"),
        ("主张证据账本与真实性核验包", MATERIALS / "62_主张证据账本与真实性核验包.md"),
        ("主张证据账本机器可读版", MATERIALS / "62_主张证据账本与真实性核验包_机器可读.json"),
        ("Sites 云端发布预检与替代上线路线", MATERIALS / "63_Sites云端发布预检与替代上线路线.md"),
        ("Sites 云端发布预检机器可读版", MATERIALS / "63_Sites云端发布预检与替代上线路线_机器可读.json"),
        ("最终公开 URL 验收器与回执模板", MATERIALS / "64_最终公开URL验收器与回执模板.md"),
        ("最终公开 URL 验收器机器可读版", MATERIALS / "64_最终公开URL验收器与回执模板_机器可读.json"),
        ("公网静态站点上传包与验收说明", MATERIALS / "65_公网静态站点上传包与验收说明.md"),
        ("公网静态站点上传包机器可读版", MATERIALS / "65_公网静态站点上传包与验收说明_机器可读.json"),
        ("公网静态上传包 README", MATERIALS / "public-site-upload/README_公网静态上传包.md"),
        ("公网静态上传包 manifest", MATERIALS / "public-site-upload/PUBLIC_SITE_UPLOAD_MANIFEST.json"),
        ("公网静态上传 ZIP", MATERIALS / "public-site-upload/SE-Path学伴_公开静态站点上传包_v0.1.zip"),
        ("公网发布指挥台与提交日操作卡", MATERIALS / "66_公网发布指挥台与提交日操作卡.md"),
        ("公网发布指挥台机器可读版", MATERIALS / "66_公网发布指挥台与提交日操作卡_机器可读.json"),
        ("公网发布指挥包 JSON", MATERIALS / "public-launch-command/PUBLIC_LAUNCH_COMMAND.json"),
        ("公网发布步骤卡", MATERIALS / "public-launch-command/LAUNCH_STEPS.md"),
        ("公网部署后 PowerShell 验收脚本", MATERIALS / "public-launch-command/RUN_AFTER_DEPLOY.ps1"),
        ("公网部署后 CMD 验收脚本", MATERIALS / "public-launch-command/RUN_AFTER_DEPLOY.cmd"),
        ("静态托管平台配置自检与故障恢复卡", MATERIALS / "67_静态托管平台配置自检与故障恢复卡.md"),
        ("静态托管平台配置自检机器可读版", MATERIALS / "67_静态托管平台配置自检与故障恢复卡_机器可读.json"),
        ("正式提交填报工作台与人工门禁补全卡", MATERIALS / "68_正式提交填报工作台与人工门禁补全卡.md"),
        ("正式提交填报工作台机器可读版", MATERIALS / "68_正式提交填报工作台与人工门禁补全卡_机器可读.json"),
        ("赛题要求逐项对齐矩阵与夺奖证据总表", MATERIALS / "69_赛题要求逐项对齐矩阵与夺奖证据总表.md"),
        ("赛题要求逐项对齐矩阵机器可读版", MATERIALS / "69_赛题要求逐项对齐矩阵与夺奖证据总表_机器可读.json"),
        ("赛题要求对齐总控 JSON", MATERIALS / "competition-requirement-alignment/COMPETITION_REQUIREMENT_ALIGNMENT.json"),
        ("赛题要求对齐校验清单", MATERIALS / "competition-requirement-alignment/manifest_checks.json"),
        ("赛题要求对齐 CSV", MATERIALS / "competition-requirement-alignment/requirement_alignment_matrix.csv"),
        ("赛题要求评委检查卡", MATERIALS / "competition-requirement-alignment/judge_requirement_checklist.md"),
        ("赛题要求风险边界卡", MATERIALS / "competition-requirement-alignment/risk_boundary_cards.md"),
        ("公网部署实操包与回执封存说明", MATERIALS / "70_公网部署实操包与回执封存说明.md"),
        ("公网部署实操包机器可读版", MATERIALS / "70_公网部署实操包与回执封存说明_机器可读.json"),
        ("公网部署实操总控 JSON", MATERIALS / "public-deploy-playbook/PUBLIC_DEPLOY_PLAYBOOK.json"),
        ("公网部署实操校验清单", MATERIALS / "public-deploy-playbook/manifest_checks.json"),
        ("公网部署平台矩阵", MATERIALS / "public-deploy-playbook/platform_deploy_matrix.csv"),
        ("公网部署提交日清单", MATERIALS / "public-deploy-playbook/DEPLOY_DAY_CHECKLIST.md"),
        ("公网 URL 回执封存说明", MATERIALS / "public-deploy-playbook/URL_RECEIPT_SEALING.md"),
        ("公网部署失败恢复卡", MATERIALS / "public-deploy-playbook/FAILURE_RECOVERY.md"),
        ("公网部署索引同步报告", MATERIALS / "public-deploy-playbook/INDEX_SYNC_REPORT.json"),
        ("公网部署 PowerShell 实操脚本", MATERIALS / "public-deploy-playbook/RUN_DEPLOY_PLAYBOOK.ps1"),
        ("公网部署 CMD 实操脚本", MATERIALS / "public-deploy-playbook/RUN_DEPLOY_PLAYBOOK.cmd"),
        ("公网 URL 回填后的正式提交收口说明", MATERIALS / "71_公网URL回填后的正式提交收口说明.md"),
        ("公网 URL 回填正式提交收口机器可读版", MATERIALS / "71_公网URL回填后的正式提交收口说明_机器可读.json"),
        ("标准化部署配置与容器化验收说明", MATERIALS / "72_标准化部署配置与容器化验收说明.md"),
        ("标准化部署配置与容器化验收机器可读版", MATERIALS / "72_标准化部署配置与容器化验收说明_机器可读.json"),
        ("正式提交填报工作台安全副本说明", MATERIALS / "final-submission-workspace/README.md"),
        ("正式提交待填画像安全副本", MATERIALS / "final-submission-workspace/final_submission_profile.todo.json"),
        ("正式提交人工门禁清单安全副本", MATERIALS / "final-submission-workspace/final_submission_manual_checklist.md"),
        ("正式提交人工门禁机器清单安全副本", MATERIALS / "final-submission-workspace/final_submission_manual_checklist.json"),
        ("正式提交待填画像草案", SUBMISSION / "final_submission_profile.todo.json"),
        ("正式提交人工门禁清单", SUBMISSION / "final_submission_manual_checklist.md"),
        ("正式提交人工门禁机器清单", SUBMISSION / "final_submission_manual_checklist.json"),
        ("静态托管上传自检包 JSON", MATERIALS / "public-hosting-selftest/HOSTING_UPLOAD_SELFTEST.json"),
        ("静态托管上传自检校验清单", MATERIALS / "public-hosting-selftest/manifest_checks.json"),
        ("静态托管上传自检说明", MATERIALS / "public-hosting-selftest/README.md"),
        ("静态托管平台矩阵", MATERIALS / "public-hosting-selftest/HOSTING_PROVIDER_MATRIX.csv"),
        ("静态托管故障恢复卡", MATERIALS / "public-hosting-selftest/HOSTING_TROUBLESHOOTING.md"),
        ("静态托管 PowerShell 自检脚本", MATERIALS / "public-hosting-selftest/RUN_HOSTING_SELFTEST.ps1"),
        ("静态托管 CMD 自检脚本", MATERIALS / "public-hosting-selftest/RUN_HOSTING_SELFTEST.cmd"),
        ("三段式评委评审路线总控 JSON", MATERIALS / "judge-route-orchestrator/JUDGE_ROUTE_ORCHESTRATOR.json"),
        ("三段式评委评审路线校验清单", MATERIALS / "judge-route-orchestrator/manifest_checks.json"),
        ("三段式评委评审路线卡", MATERIALS / "judge-route-orchestrator/route_cards.md"),
        ("三段式评委评审路线评分矩阵", MATERIALS / "judge-route-orchestrator/route_matrix.csv"),
        ("本地运行环境自检包 JSON", MATERIALS / "local-run-doctor/LOCAL_RUN_DOCTOR.json"),
        ("本地运行环境自检校验清单", MATERIALS / "local-run-doctor/manifest_checks.json"),
        ("本地运行环境自检说明", MATERIALS / "local-run-doctor/README.md"),
        ("本地运行检查清单", MATERIALS / "local-run-doctor/LOCAL_RUN_CHECKLIST.md"),
        ("本地运行失败兜底路线", MATERIALS / "local-run-doctor/fallback_routes.md"),
        ("本地运行环境矩阵", MATERIALS / "local-run-doctor/local_env_matrix.csv"),
        ("本地运行 PowerShell 自检脚本", MATERIALS / "local-run-doctor/RUN_LOCAL_DEMO.ps1"),
        ("本地运行 CMD 包装脚本", MATERIALS / "local-run-doctor/RUN_LOCAL_DEMO.cmd"),
        ("平台提交终检 JSON", MATERIALS / "submission-upload-preflight/UPLOAD_PREFLIGHT.json"),
        ("平台提交终检校验清单", MATERIALS / "submission-upload-preflight/manifest_checks.json"),
        ("平台提交终检清单", MATERIALS / "submission-upload-preflight/UPLOAD_CHECKLIST.md"),
        ("平台提交字段矩阵", MATERIALS / "submission-upload-preflight/platform_form_fields.csv"),
        ("上传回执模板", MATERIALS / "submission-upload-preflight/upload_receipt_template.md"),
        ("最终上传时间线", MATERIALS / "submission-upload-preflight/final_upload_timeline.md"),
        ("一等奖差异化创新 JSON", MATERIALS / "award-differentiation/AWARD_DIFFERENTIATION.json"),
        ("一等奖差异化创新校验清单", MATERIALS / "award-differentiation/manifest_checks.json"),
        ("一等奖评分证据矩阵", MATERIALS / "award-differentiation/score_evidence_matrix.csv"),
        ("一等奖评委追问回答卡", MATERIALS / "award-differentiation/judge_objection_cards.md"),
        ("一等奖 60 秒主讲口径", MATERIALS / "award-differentiation/one_minute_pitch.md"),
        ("一等奖创新地图", MATERIALS / "award-differentiation/innovation_map.md"),
        ("主张证据账本 JSON", MATERIALS / "claim-evidence-ledger/CLAIM_EVIDENCE_LEDGER.json"),
        ("主张证据账本校验清单", MATERIALS / "claim-evidence-ledger/manifest_checks.json"),
        ("主张证据矩阵", MATERIALS / "claim-evidence-ledger/claim_evidence_matrix.csv"),
        ("主张声明等级表", MATERIALS / "claim-evidence-ledger/claim_tier_map.md"),
        ("禁止声明交叉检查", MATERIALS / "claim-evidence-ledger/forbidden_claims_crosscheck.md"),
        ("主张证据路径索引", MATERIALS / "claim-evidence-ledger/evidence_paths_index.csv"),
        ("评委一键启动入口包 HTML", MATERIALS / "judge-launchpad/START_HERE.html"),
        ("评委一键启动入口包说明", MATERIALS / "judge-launchpad/START_HERE.md"),
        ("评委一键启动入口包 manifest", MATERIALS / "judge-launchpad/JUDGE_LAUNCHPAD_MANIFEST.json"),
        ("评委一键启动入口包校验清单", MATERIALS / "judge-launchpad/manifest_checks.json"),
        ("启动说明", MATERIALS / "START_DEMO.md"),
    ]
    rows = [check_file(path, label, 100) for label, path in files]
    final_profile_template = read_json(MATERIALS / "54_正式提交画像配置模板.json")
    final_profile_builder = read_text(ROOT / "scripts/build_final_submission_profile.py")
    final_submission_workspace = read_json(MATERIALS / "68_正式提交填报工作台与人工门禁补全卡_机器可读.json")
    final_submission_todo_profile = read_json(SUBMISSION / "final_submission_profile.todo.json")
    final_submission_manual_checklist = read_json(SUBMISSION / "final_submission_manual_checklist.json")
    final_submission_packaged_todo = read_json(MATERIALS / "final-submission-workspace/final_submission_profile.todo.json")
    final_submission_packaged_checklist = read_json(MATERIALS / "final-submission-workspace/final_submission_manual_checklist.json")
    award_completion = read_json(MATERIALS / "55_获奖级完成度总验收报告_机器可读.json")
    launch_loop = read_json(MATERIALS / "56_上线级闭环验收剧本_机器可读.json")
    pilot_binder = read_json(MATERIALS / "58_真实课程试点证据归档与声明门禁说明_机器可读.json")
    trial_analysis_pack = read_json(MATERIALS / "trial/anonymous-analysis-pack/analysis_summary.json")
    trial_telemetry_material = read_text(MATERIALS / "33_试点遥测与效果验证中心说明.md")
    trial_telemetry_source = read_text(ROOT / "sepath-cloud-app/src/engine/trialTelemetry.ts")
    research_fusion_material = read_text(MATERIALS / "36_科研算法融合与开源证据中台说明.md")
    research_fusion_source = read_text(ROOT / "sepath-cloud-app/src/engine/researchFusion.ts")
    final_submission_material = read_text(MATERIALS / "41_最终上传与路演控制台说明.md")
    final_submission_source = read_text(ROOT / "sepath-cloud-app/src/engine/finalSubmission.ts")
    platform_copy_text = read_text(MATERIALS / "10_比赛平台填写文案.md")
    cloud_url_row = next((line for line in platform_copy_text.splitlines() if line.startswith("| 云端演示地址 |")), "")
    final_url_receipt_path = SUBMISSION / "final_public_url_receipt.json"
    final_url_receipt = read_json(final_url_receipt_path) if final_url_receipt_path.exists() else {}
    final_closure = read_json(MATERIALS / "71_公网URL回填后的正式提交收口说明_机器可读.json")
    final_closure_script = read_text(ROOT / "scripts/finalize_submission_after_public_url.py")
    text = "\n".join(read_text(path) for _, path in files if path.exists())
    rows.extend(
        [
            {
                "label": "覆盖官方四项核心能力",
                "status": "PASS"
                if all(key in text for key in ["学情诊断", "路径规划", "实时干预", "记忆与反思"])
                else "FAIL",
                "path": "参赛提交材料包/*.md",
                "evidence": "学情诊断/路径规划/实时干预/记忆与反思",
            },
            {
                "label": "覆盖评审五项评分维度",
                "status": "PASS"
                if all(key in text for key in ["智能体架构", "自适应策略", "功能完整", "创新", "商业价值"])
                else "FAIL",
                "path": "参赛提交材料包/*.md",
                "evidence": "架构/策略/功能/创新/商业价值",
            },
            {
                "label": "开源真实性边界",
                "status": "PASS" if "不代表复制其代码" in text and "许可证" in text else "FAIL",
                "path": "参赛提交材料包/05_真实性与边界声明.md",
                "evidence": "open-source boundary stated",
            },
            {
                "label": "报名信息未被编造",
                "status": "PASS" if "【待填写" in platform_copy_text else "FAIL",
                "path": "参赛提交材料包/10_比赛平台填写文案.md",
                "evidence": "manual placeholders retained",
            },
            {
                "label": "平台云端演示地址安全占位",
                "status": "PASS"
                if "【待填写：最终公开 URL" in cloud_url_row
                or (
                    final_url_receipt.get("status") == "ready_for_platform"
                    and final_url_receipt.get("public_https_check") is True
                    and str(final_url_receipt.get("url", "")) in cloud_url_row
                )
                else "FAIL",
                "path": "参赛提交材料包/10_比赛平台填写文案.md",
                "evidence": cloud_url_row or "missing cloud demo URL row",
            },
            {
                "label": "公网 URL 正式提交收口 schema",
                "status": "PASS"
                if final_closure.get("runtime") == "sepath-public-url-submission-closure.v1"
                and final_closure.get("status")
                in {"manual_gates_remaining", "ready_with_watch_items", "ready_for_final_platform_submission"}
                and final_closure.get("checks_summary", {}).get("FAIL") == 0
                and len(final_closure.get("next_commands", [])) >= 6
                else "FAIL",
                "path": "参赛提交材料包/71_公网URL回填后的正式提交收口说明_机器可读.json",
                "evidence": f"runtime={final_closure.get('runtime')} status={final_closure.get('status')} summary={final_closure.get('checks_summary')}",
            },
            {
                "label": "公网 URL 收口门禁覆盖",
                "status": "PASS"
                if {"final-public-url-receipt", "public-url-platform-copy", "final-submission-profile", "final-named-submission-copies"}.issubset(
                    {item.get("id") for item in final_closure.get("checks", [])}
                )
                and all(
                    token in final_closure_script
                    for token in ["finalize_public_url_receipt", "prepare_final_named_submission", "--sync-platform-copy"]
                )
                else "FAIL",
                "path": "scripts/finalize_submission_after_public_url.py",
                "evidence": "closure script links URL receipt, platform copy, profile validation, and final named copies",
            },
            {
                "label": "正式提交画像模板 schema",
                "status": "PASS"
                if final_profile_template.get("schema") == "sepath-final-submission-profile.v1"
                and "team" in final_profile_template
                and "submission" in final_profile_template
                and "confirmed" in final_profile_template
                else "FAIL",
                "path": "参赛提交材料包/54_正式提交画像配置模板.json",
                "evidence": final_profile_template.get("schema", "missing schema"),
            },
            {
                "label": "正式提交画像保留人工门禁",
                "status": "PASS"
                if all(value is False for value in final_profile_template.get("confirmed", {}).values())
                and "【待填写" in json.dumps(final_profile_template, ensure_ascii=False)
                else "FAIL",
                "path": "参赛提交材料包/54_正式提交画像配置模板.json",
                "evidence": "template keeps confirmations false until the team fills real platform data",
            },
            {
                "label": "最终提交画像生成链路",
                "status": "PASS"
                if all(key in final_profile_builder for key in ["--member", "--confirm-all", "final_submission_profile.json", "validate_profile"])
                and "build_final_submission_profile.py" in read_text(MATERIALS / "57_最终提交信息采集与一键画像生成说明.md")
                else "FAIL",
                "path": "scripts/build_final_submission_profile.py",
                "evidence": "profile generator can build local final_submission_profile.json without publishing private contact data",
            },
            {
                "label": "正式提交填报工作台 schema",
                "status": "PASS"
                if final_submission_workspace.get("runtime") == "sepath-final-submission-workspace.v1"
                and final_submission_workspace.get("status") in {"manual_required", "ready_for_named_submission"}
                and len(final_submission_workspace.get("manual_gates", [])) >= 6
                and final_submission_workspace.get("todo_profile") == "submission/final_submission_profile.todo.json"
                and final_submission_workspace.get("truth_boundary")
                else "FAIL",
                "path": "参赛提交材料包/68_正式提交填报工作台与人工门禁补全卡_机器可读.json",
                "evidence": f"runtime={final_submission_workspace.get('runtime')} status={final_submission_workspace.get('status')} gates={len(final_submission_workspace.get('manual_gates', []))}",
            },
            {
                "label": "正式提交待填画像保留人工确认",
                "status": "PASS"
                if final_submission_todo_profile.get("schema") == "sepath-final-submission-profile.v1"
                and all(value is False for value in final_submission_todo_profile.get("confirmed", {}).values())
                and "PENDING_FINAL_PUBLIC_URL" in json.dumps(final_submission_todo_profile, ensure_ascii=False)
                else "FAIL",
                "path": "submission/final_submission_profile.todo.json",
                "evidence": "todo profile keeps confirmations false and final URL pending until human confirmation",
            },
            {
                "label": "正式提交阶段包安全副本保留人工确认",
                "status": "PASS"
                if final_submission_packaged_todo.get("schema") == "sepath-final-submission-profile.v1"
                and all(value is False for value in final_submission_packaged_todo.get("confirmed", {}).values())
                and final_submission_packaged_checklist.get("runtime") == "sepath-final-submission-workspace.v1"
                and len(final_submission_packaged_checklist.get("manual_gates", [])) >= 6
                else "FAIL",
                "path": "参赛提交材料包/final-submission-workspace/",
                "evidence": "packaged safe copy keeps placeholders and does not include real private contact data",
            },
            {
                "label": "正式提交人工门禁清单 schema",
                "status": "PASS"
                if final_submission_manual_checklist.get("runtime") == "sepath-final-submission-workspace.v1"
                and final_submission_manual_checklist.get("status") in {"manual_required", "ready_for_named_submission"}
                and len(final_submission_manual_checklist.get("manual_gates", [])) >= 6
                and all(item.get("status") in {"PASS", "MANUAL", "WATCH"} for item in final_submission_manual_checklist.get("checks", []))
                else "FAIL",
                "path": "submission/final_submission_manual_checklist.json",
                "evidence": f"status={final_submission_manual_checklist.get('status')} gates={len(final_submission_manual_checklist.get('manual_gates', []))}",
            },
            {
                "label": "获奖级完成度总验收 schema",
                "status": "PASS"
                if award_completion.get("runtime") == "sepath-award-completion-audit.v1"
                and len(award_completion.get("dimensions", [])) >= 10
                and award_completion.get("package_self_check", {}).get("status") == "PASS"
                and len(award_completion.get("manual_gates", [])) >= 5
                else "FAIL",
                "path": "参赛提交材料包/55_获奖级完成度总验收报告_机器可读.json",
                "evidence": f"runtime={award_completion.get('runtime')} score={award_completion.get('machine_evidence_score')} dimensions={len(award_completion.get('dimensions', []))}",
            },
            {
                "label": "上线级闭环验收剧本 schema",
                "status": "PASS"
                if launch_loop.get("runtime") == "sepath-launch-loop-acceptance.v1"
                and len(launch_loop.get("stages", [])) >= 12
                and launch_loop.get("package_self_check", {}).get("status") == "PASS"
                and len(launch_loop.get("manual_gates", [])) >= 5
                else "FAIL",
                "path": "参赛提交材料包/56_上线级闭环验收剧本_机器可读.json",
                "evidence": f"runtime={launch_loop.get('runtime')} score={launch_loop.get('machine_readiness_score')} stages={len(launch_loop.get('stages', []))}",
            },
            {
                "label": "真实课程试点证据装订包 schema",
                "status": "PASS"
                if pilot_binder.get("runtime") == "sepath-pilot-evidence-binder.v1"
                and len(pilot_binder.get("claim_tiers", [])) >= 4
                and pilot_binder.get("source_ready") is True
                and pilot_binder.get("package_self_check", {}).get("status") == "PASS"
                and pilot_binder.get("trial_analysis_workbench", {}).get("status") == "PASS"
                else "FAIL",
                "path": "参赛提交材料包/58_真实课程试点证据归档与声明门禁说明_机器可读.json",
                "evidence": f"runtime={pilot_binder.get('runtime')} score={pilot_binder.get('machine_evidence_score')} claimTiers={len(pilot_binder.get('claim_tiers', []))}",
            },
            {
                "label": "真实试点声明不被提前夸大",
                "status": "PASS"
                if "不能宣称已证明真实班级长期显著提分" in json.dumps(pilot_binder, ensure_ascii=False)
                and "school-authorization" in json.dumps(pilot_binder, ensure_ascii=False)
                and "teacher-release-gate" in json.dumps(pilot_binder, ensure_ascii=False)
                else "FAIL",
                "path": "参赛提交材料包/58_真实课程试点证据归档与声明门禁说明_机器可读.json",
                "evidence": "pilot binder keeps school authorization, teacher gate and controlled-effect claim boundary",
            },
            {
                "label": "试点匿名分析工作台进入产品",
                "status": "PASS"
                if all(
                    key in trial_telemetry_source
                    for key in [
                        "analysisDataset",
                        "analysisChecks",
                        "effectDecisionRules",
                        "trial-outcomes.csv",
                        "no-pii-export",
                        "claim-tier-mapping",
                        "controlled-effect",
                    ]
                )
                else "FAIL",
                "path": "sepath-cloud-app/src/engine/trialTelemetry.ts",
                "evidence": "TrialTelemetry exposes anonymous datasets, quality checks and L0-L3 decision rules",
            },
            {
                "label": "试点匿名分析材料闭环",
                "status": "PASS"
                if all(
                    key in trial_telemetry_material
                    for key in ["匿名分析数据包", "分析质量检查", "效果结论分级规则", "no-pii-export", "claim-tier-mapping"]
                )
                else "FAIL",
                "path": "参赛提交材料包/33_试点遥测与效果验证中心说明.md",
                "evidence": "material 33 documents dataset exports, analysis gates and effect claim tiers",
            },
            {
                "label": "试点匿名分析包可复现",
                "status": "PASS"
                if trial_analysis_pack.get("runtime") == "sepath-trial-analysis-pack.v1"
                and trial_analysis_pack.get("evidence_scope") == "synthetic_replay_sample"
                and trial_analysis_pack.get("pii_scan", {}).get("status") == "PASS"
                and len(trial_analysis_pack.get("files", [])) >= 7
                else "FAIL",
                "path": "参赛提交材料包/trial/anonymous-analysis-pack/analysis_summary.json",
                "evidence": f"runtime={trial_analysis_pack.get('runtime')} scope={trial_analysis_pack.get('evidence_scope')} files={len(trial_analysis_pack.get('files', []))}",
            },
            {
                "label": "试点匿名分析质量门",
                "status": "PASS"
                if all(
                    check_id in {item.get("id") for item in trial_analysis_pack.get("checks", []) if item.get("status") == "PASS"}
                    for check_id in ["no-pii-export", "minimum-coverage", "event-pairing", "teacher-agreement", "claim-tier-mapping"]
                )
                else "FAIL",
                "path": "参赛提交材料包/trial/anonymous-analysis-pack/analysis_summary.json",
                "evidence": "no-pii-export/minimum-coverage/event-pairing/teacher-agreement/claim-tier-mapping",
            },
            {
                "label": "科研贡献图谱进入产品与材料",
                "status": "PASS"
                if all(key in research_fusion_material for key in ["思想迁移链", "算法贡献图谱", "贡献证据包"])
                and all(key in research_fusion_source for key in ["ideaMigration", "contributionGraph", "contributionEvidencePack"])
                else "FAIL",
                "path": "参赛提交材料包/36_科研算法融合与开源证据中台说明.md",
                "evidence": "research fusion links prior path-value ideas to product evidence graph",
            },
            {
                "label": "最终上传总控事实快照",
                "status": "PASS"
                if all(
                    key in final_submission_material
                    for key in ["提交包事实快照", "一等奖冲刺路线", "package_sha256", "v0.2.pdf"]
                )
                and all(key in final_submission_source for key in ["packageSnapshot", "awardSprint", "packageSha256", "awardSprintIds"])
                else "FAIL",
                "path": "参赛提交材料包/41_最终上传与路演控制台说明.md",
                "evidence": "final submission panel exposes package SHA, v0.2 PDF, manual gates and award sprint route",
            },
        ]
    )
    return rows


def manual_items() -> list[dict[str, str]]:
    return [
        {
            "label": "队伍名与文件命名",
            "status": "MANUAL",
            "evidence": "正式报名后将文件名替换为“队伍名+作品名”。",
        },
        {
            "label": "队员信息准确性",
            "status": "MANUAL",
            "evidence": "比赛平台报名信息只能由参赛队确认。",
        },
        {
            "label": "公开视频/私有云访问策略",
            "status": "MANUAL",
            "evidence": "当前 Sites 为 owner-only，正式提交前按主办方要求决定是否公开。",
        },
        {
            "label": "真人旁白版视频",
            "status": "MANUAL",
            "evidence": "当前视频为字幕素材版，可直接提交，也可叠加真人旁白。",
        },
        {
            "label": "真实课程效果声明",
            "status": "MANUAL",
            "evidence": "当前不能宣称真实试点提升成绩，需等后续试点数据。",
        },
    ]


def summarize(rows: list[dict[str, Any]]) -> dict[str, int]:
    result = {"PASS": 0, "WARN": 0, "FAIL": 0, "MANUAL": 0}
    for row in rows:
        result[row["status"]] = result.get(row["status"], 0) + 1
    return result


def render_markdown(rows: list[dict[str, Any]], summary: dict[str, int]) -> str:
    generated = datetime.now(timezone.utc).isoformat()
    lines = [
        "# 09 提交前终审报告",
        "",
        f"生成时间：{generated}",
        "",
        "## 总体结论",
        "",
        f"- 自动检查 PASS：{summary.get('PASS', 0)} 项",
        f"- 自动检查 WARN：{summary.get('WARN', 0)} 项",
        f"- 自动检查 FAIL：{summary.get('FAIL', 0)} 项",
        f"- 需要人工确认：{summary.get('MANUAL', 0)} 项",
        "",
        "当前自动审计结论："
        + ("可以作为阶段提交包继续准备正式提交；仍需人工确认队伍名、报名信息、访问策略和最终旁白。" if summary.get("FAIL", 0) == 0 else "存在 FAIL 项，需修复后重新打包。"),
        "",
        "## 自动审计明细",
        "",
        "| 状态 | 检查项 | 证据 | 路径 |",
        "| --- | --- | --- | --- |",
    ]
    for row in rows:
        evidence = str(row.get("evidence", "")).replace("|", "\\|")
        path = str(row.get("path", "")).replace("|", "\\|")
        lines.append(f"| {row['status']} | {row['label']} | {evidence} | `{path}` |")
    lines.extend(
        [
            "",
            "## 正式提交前人工确认清单",
            "",
            "1. 按最终报名信息统一队伍名、作品名、作者信息和文件名。",
            "2. 决定云端站点是否保持私有，若历史 Sites 项目仍不可访问，则使用公开试用静态包发布最终 URL。",
            "3. 最终公开 URL 选定后运行 `rtk python scripts/finalize_public_url_receipt.py --url <最终URL> --write`，并保留 `submission/public_url_validation_report.json` 与 `submission/final_public_url_receipt.json`。",
            "4. 播放完整 MP4，确认无黑屏、无乱码、无超时，必要时叠加真人旁白。",
            "5. 最后一次运行 `npm run test`、`npm run build`、`npm test` 和本审计脚本。",
            "6. 提交前不要宣称真实课程提分、真实学校接入或长期因果效果。",
            "",
            "## 一句话复核口径",
            "",
            "SE-Path 学伴已经具备项目计划书、可运行 Demo、3-5 分钟视频、源码、历史云端部署、公开静态试用包、最终公开 URL 验收器、开源创新矩阵、真实性声明和自动化审计证据；当前仍需人工确认最终报名信息与最终公开访问策略。",
            "",
        ]
    )
    return "\n".join(lines)


def main() -> None:
    rows: list[dict[str, Any]] = []
    rows.extend(zip_checks())
    rows.extend(pdf_checks())
    rows.extend(ppt_checks())
    rows.extend(video_checks())
    rows.extend(demo_checks())
    rows.extend(public_trial_checks())
    rows.extend(slo_checks())
    rows.extend(reviewer_drill_checks())
    rows.extend(reviewer_5min_pack_checks())
    rows.extend(judge_route_orchestrator_checks())
    rows.extend(local_run_doctor_checks())
    rows.extend(submission_upload_preflight_checks())
    rows.extend(award_differentiation_checks())
    rows.extend(claim_evidence_ledger_checks())
    rows.extend(competition_requirement_alignment_checks())
    rows.extend(judge_launchpad_checks())
    rows.extend(hosting_upload_selftest_checks())
    rows.extend(public_deploy_playbook_checks())
    rows.extend(material_checks())
    rows.extend(manual_items())
    summary = summarize(rows)

    REPORT_MD.write_text(render_markdown(rows, summary), encoding="utf-8")
    REPORT_JSON.write_text(
        json.dumps(
            {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "summary": summary,
                "rows": rows,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(json.dumps({"summary": summary, "report": rel(REPORT_MD), "json": rel(REPORT_JSON)}, ensure_ascii=False, indent=2))
    if summary.get("FAIL", 0):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
