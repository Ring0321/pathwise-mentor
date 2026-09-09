from __future__ import annotations

import importlib.util
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
VIDEO_SCRIPT = ROOT / "scripts" / "build_demo_video.py"
OUT_DIR = ROOT / "参赛提交材料包" / "演示视频素材"

NARRATION_MD = OUT_DIR / "SE-Path学伴_正式旁白稿_v0.3.md"
SRT_PATH = OUT_DIR / "SE-Path学伴_4分40秒旁白字幕_v0.3.srt"
VTT_PATH = OUT_DIR / "SE-Path学伴_4分40秒旁白字幕_v0.3.vtt"
CHECKLIST_PATH = OUT_DIR / "旁白录制检查清单.md"
RECUT_PATH = OUT_DIR / "SE-Path学伴_v0.5复剪增补旁白.md"


def load_scenes() -> list[dict[str, Any]]:
    spec = importlib.util.spec_from_file_location("build_demo_video", VIDEO_SCRIPT)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {VIDEO_SCRIPT}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return list(module.SCENES)


def timestamp(seconds: int, sep: str = ",") -> str:
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    return f"{hours:02}:{minutes:02}:{secs:02}{sep}000"


def clean_title(raw: str) -> str:
    return raw.split("  ", 1)[-1].strip()


def build_timed_scenes() -> list[dict[str, Any]]:
    current = 0
    timed = []
    for scene in load_scenes():
        duration = int(scene["duration"])
        timed.append(
            {
                **scene,
                "start": current,
                "end": current + duration,
                "plain_title": clean_title(str(scene["title"])),
            }
        )
        current += duration
    return timed


def render_markdown(scenes: list[dict[str, Any]]) -> str:
    total = scenes[-1]["end"] if scenes else 0
    lines = [
        "# SE-Path 学伴正式旁白稿 v0.3",
        "",
        f"适配视频：`SE-Path学伴_4分40秒演示视频素材_v0.3.mp4`",
        f"总时长：{total} 秒",
        "",
        "## 录制口径",
        "",
        "- 语速建议：每分钟 180-220 个中文字符，稳一点，不要像念广告。",
        "- 语气建议：评审路演风格，先讲问题，再讲证据，再讲为什么可信。",
        "- 录制建议：每个分镜单独录一段，后期按 SRT 时间轴贴齐。",
        "- 不要额外宣称真实学校试点、真实提分或已公开访问；这些在真实性声明中仍是边界。",
        "",
        "## 分镜旁白",
        "",
        "| 时间 | 画面 | 正式旁白 |",
        "| --- | --- | --- |",
    ]
    for scene in scenes:
        lines.append(
            f"| {timestamp(scene['start'], ':')[:8]}-{timestamp(scene['end'], ':')[:8]} | "
            f"{scene['plain_title']} | {scene['voice']} |"
        )
    lines.extend(
        [
            "",
            "## 连续版旁白",
            "",
            *[f"{index}. {scene['voice']}" for index, scene in enumerate(scenes, 1)],
            "",
            "## 结尾补充句",
            "",
            "如果视频最后还有 5-8 秒空白，可补一句：SE-Path 的重点不是替学生写代码，而是让学习过程有证据、有边界、有复核，并能持续进入下一次路径规划。",
            "",
        ]
    )
    return "\n".join(lines)


def render_srt(scenes: list[dict[str, Any]]) -> str:
    blocks = []
    for index, scene in enumerate(scenes, 1):
        blocks.append(
            "\n".join(
                [
                    str(index),
                    f"{timestamp(scene['start'])} --> {timestamp(scene['end'])}",
                    str(scene["voice"]),
                ]
            )
        )
    return "\n\n".join(blocks) + "\n"


def render_vtt(scenes: list[dict[str, Any]]) -> str:
    blocks = ["WEBVTT", ""]
    for scene in scenes:
        blocks.extend(
            [
                f"{timestamp(scene['start'], '.')} --> {timestamp(scene['end'], '.')}",
                str(scene["voice"]),
                "",
            ]
        )
    return "\n".join(blocks)


def render_checklist(scenes: list[dict[str, Any]]) -> str:
    return "\n".join(
        [
            "# 旁白录制检查清单",
            "",
            "## 录制前",
            "",
            "- 打开 `SE-Path学伴_正式旁白稿_v0.3.md`，确认术语读法一致。",
            "- 先完整播放 `SE-Path学伴_4分40秒演示视频素材_v0.3.mp4`，熟悉 14 个镜头切换。",
            "- 录音环境保持安静，建议 48kHz WAV 或高码率 MP3，后期再压制到 MP4。",
            "- 不加入未验证承诺，例如真实提分、真实学校已接入、完全自动评分替代教师。",
            "",
            "## 录制中",
            "",
            "- 每个镜头单独录制一段，允许中间停顿。",
            "- 重点词保持清楚：EvidenceEvent、路径数字孪生、SafeVOI、知识边界、教师复核。",
            "- 评审证据镜头要明确说出五项评分维度。",
            "",
            "## 时间轴",
            "",
            "| 顺序 | 时间 | 镜头 |",
            "| --- | --- | --- |",
            *[
                f"| {index} | {timestamp(scene['start'], ':')[:8]}-{timestamp(scene['end'], ':')[:8]} | {scene['plain_title']} |"
                for index, scene in enumerate(scenes, 1)
            ],
            "",
            "## 导出后",
            "",
            "- 视频总时长保持 3-5 分钟。",
            "- 抽查开头、中段、结尾三处音画同步。",
            "- 保留当前无配音素材版作为可复核底稿。",
            "- 若重新生成带配音版，文件名建议使用 `SE-Path学伴_4分40秒正式旁白版_v1.0.mp4`。",
            "",
        ]
    )


def render_recut_plan() -> str:
    return "\n".join(
        [
            "# SE-Path 学伴 v0.5 复剪增补旁白",
            "",
            "用途：在保留 `SE-Path学伴_4分40秒演示视频素材_v0.3.mp4` 已校验闭环的基础上，供决赛或二次录屏时增补“研究贡献图谱 + 试点证据归档 + 学校初始化 + 生产数据平面”四段生产化证据。",
            "",
            "## 复剪原则",
            "",
            "- 不直接修改 v0.3 正式旁白稿、SRT/VTT 和已校验 MP4，避免音画不一致。",
            "- 初赛仍可提交 v0.3；若决赛需要强调可上线程度，可用本文件替换或压缩原 2-3 个镜头。",
            "- 新增镜头只讲工程证据，不宣称真实学校已经接入或真实提分已经验证。",
            "",
            "## 建议新增镜头",
            "",
            "| 建议时长 | 画面 | 增补旁白 |",
            "| --- | --- | --- |",
            "| 10 秒 | 科研算法融合与研究贡献图谱 | 系统把路径增值引擎的动态画像、SafeVOI、安全发布门和试点证据阶梯迁移到软件工程课程，并在产品内展示思想迁移链、算法贡献图谱和证据包。 |",
            "| 10 秒 | 真实试点证据归档中心 | 真实课程效果不能靠 Demo 自证，系统把授权、知情、脱敏、预注册、教师签收和 L0-L3 声明分级做成试点门禁。 |",
            "| 10 秒 | 学校初始化与演示账号中心 | 系统不只是一套前端页面，还把学校、课程、教师、学生和评委角色做成初始化向导，方便评审试用，也为真实课程试点留下账号和权限边界。 |",
            "| 10 秒 | 生产数据平面与部署运维中心 | 生产数据平面展示 Postgres/Supabase 表结构、RLS 租户隔离、备份策略、写入干跑和部署探针，证明 Demo 具备向真实云端试点演进的工程骨架。 |",
            "",
            "## 可替换位置",
            "",
            "优先替换 v0.3 视频中 03:40-04:00 的评审证据镜头，或压缩 02:36-03:18 的周报/增值/模型治理三段，每段减少 6-8 秒。若只补两个镜头，优先补 `#research-fusion` 和 `#pilot-evidence-binder`，因为它们最直接回应“创新从哪里来、真实效果能不能证明”的评委追问。",
            "",
            "## 连续版结尾口径",
            "",
            "SE-Path 的重点不是把 AI 助教包装成会聊天的工具，而是把软件工程学习证据、路径增值思想、教师复核、试点证据、账号权限、租户隔离和数据运维放进同一个闭环，让它具备真实课程试点前需要的上线骨架。",
            "",
        ]
    )


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    scenes = build_timed_scenes()
    NARRATION_MD.write_text(render_markdown(scenes), encoding="utf-8")
    SRT_PATH.write_text(render_srt(scenes), encoding="utf-8")
    VTT_PATH.write_text(render_vtt(scenes), encoding="utf-8")
    CHECKLIST_PATH.write_text(render_checklist(scenes), encoding="utf-8")
    RECUT_PATH.write_text(render_recut_plan(), encoding="utf-8")
    print(
        {
            "narration": str(NARRATION_MD),
            "srt": str(SRT_PATH),
            "vtt": str(VTT_PATH),
            "checklist": str(CHECKLIST_PATH),
            "recut": str(RECUT_PATH),
            "scenes": len(scenes),
            "seconds": scenes[-1]["end"] if scenes else 0,
        }
    )


if __name__ == "__main__":
    main()
