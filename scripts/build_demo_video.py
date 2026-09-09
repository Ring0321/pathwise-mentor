from __future__ import annotations

import json
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "sepath-cloud-app" / "qa" / "demo-flow"
OUT_DIR = ROOT / "参赛提交材料包" / "演示视频素材"
FRAME_DIR = OUT_DIR / "frames"
VIDEO_PATH = OUT_DIR / "SE-Path学伴_4分40秒演示视频素材_v0.3.mp4"
CONCAT_PATH = OUT_DIR / "ffmpeg_concat.txt"
CONTACT_SHEET_PATH = OUT_DIR / "storyboard_contact_sheet.jpg"

WIDTH = 1920
HEIGHT = 1080
SCREEN_W = 1550
SCREEN_H = 872
SCREEN_X = 185
SCREEN_Y = 120


SCENES = [
    {
        "id": "01-start",
        "duration": 16,
        "title": "00:00  开场：软件工程闭环智能体",
        "voice": "SE-Path 学伴面向软件工程项目式学习，把一次失败 PR 变成可诊断、可干预、可复核的学习证据链。",
    },
    {
        "id": "02-ci-failure",
        "duration": 20,
        "title": "00:16  提交失败 PR：证据进入账本",
        "voice": "学生提交 PR 后 CI 失败，系统把日志、任务和能力影响写入 EvidenceEvent，而不是只给一句泛泛建议。",
    },
    {
        "id": "03-direct-answer-risk",
        "duration": 20,
        "title": "00:36  学生索要完整代码：触发安全门",
        "voice": "当学生请求完整 service 层代码，系统识别替写风险，转入安全发布门，避免破坏学习真实性。",
    },
    {
        "id": "04-scaffold",
        "duration": 20,
        "title": "00:56  脚手架干预：只给检查清单和 mini lab",
        "voice": "AI 不替学生完成提交，而是提供异常路径检查清单、最小实验和可复核的下一步行动。",
    },
    {
        "id": "05-ci-pass",
        "duration": 20,
        "title": "01:16  修复并通过 CI：路径数字孪生更新",
        "voice": "新证据进入后，测试、协作和路径状态实时更新，系统把一次修复转成学习增值。",
    },
    {
        "id": "06-student-dialogue",
        "duration": 20,
        "title": "01:36  学生对话：意图识别、拒绝替写和证据写回",
        "voice": "学生对话实验台把自然语言求助转成意图、风险、脚手架回复和 EvidenceEvent 写回，让交互不再是一次性聊天。",
    },
    {
        "id": "07-integration-replay",
        "duration": 20,
        "title": "01:56  集成回放：Webhook 先影子运行再写入账本",
        "voice": "集成回放沙箱用 Git、CI、LMS 和飞书样例验证脱敏、幂等、契约匹配和 EvidenceEvent 映射，证明系统能接真实工具链。",
    },
    {
        "id": "08-course-authoring",
        "duration": 20,
        "title": "02:16  课程配置：Rubric、作业模板和 AI 边界可迁移",
        "voice": "课程配置与 Rubric Studio 把课程目标、能力矩阵、作业模板、AI 使用边界和课程 Manifest 做成可迁移配置。",
    },
    {
        "id": "09-teacher-report",
        "duration": 20,
        "title": "02:36  教师周报：把闭环沉淀成可带走复盘",
        "voice": "教师周报把学生阻塞、班级信号、下周行动、AI 边界和证据引用导出为 Markdown，直接服务课程试点。",
    },
    {
        "id": "10-value-uplift",
        "duration": 22,
        "title": "02:56  增值评估：证明有价值，也守住科研边界",
        "voice": "学习增值评估中心展示能力增量、SafeVOI 策略优势、风险拦截、教师工时和真实试点 Telemetry Contract，不提前夸大真实提分。",
    },
    {
        "id": "11-model-governance",
        "duration": 22,
        "title": "03:18  模型治理：算法注册、实验协议和发布门",
        "voice": "模型与实验治理中心把 SafeVOI、路径数字孪生、知识边界、红队样本、漂移监控和发布门纳入持续迭代。",
    },
    {
        "id": "12-award-readiness",
        "duration": 20,
        "title": "03:40  评审证据：把官方评分项映射到实现证明",
        "voice": "参赛评审证据面板把智能体架构、自适应策略、功能闭环、创新体验和商业价值逐项映射到可提交材料。",
    },
    {
        "id": "13-teacher-review",
        "duration": 20,
        "title": "04:00  教师复核：人类发布门兜底",
        "voice": "高风险建议不会自动推送，教师可以批准、退回、要求补证据或转成课堂讲解。",
    },
    {
        "id": "14-reflection-memory",
        "duration": 20,
        "title": "04:20  反思记忆：闭环沉淀到下一次学习",
        "voice": "学生反思、教师复核和 CI 结果回写长期证据账本，支撑下一次诊断和路径规划。",
    },
]


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        Path("C:/Windows/Fonts/msyhbd.ttc" if bold else "C:/Windows/Fonts/msyh.ttc"),
        Path("C:/Windows/Fonts/simhei.ttf"),
        Path("C:/Windows/Fonts/arial.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


FONT_TITLE = load_font(42, True)
FONT_BODY = load_font(30)
FONT_SMALL = load_font(22)
FONT_BADGE = load_font(24, True)


def wrap_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, max_width: int) -> list[str]:
    lines: list[str] = []
    current = ""
    for char in text:
        trial = current + char
        if draw.textbbox((0, 0), trial, font=font)[2] <= max_width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = char
    if current:
        lines.append(current)
    return lines


def make_frame(scene: dict[str, str | int]) -> Path:
    source = SOURCE_DIR / f"{scene['id']}.png"
    if not source.exists():
        raise FileNotFoundError(source)

    screenshot = Image.open(source).convert("RGB")
    screenshot.thumbnail((SCREEN_W, SCREEN_H), Image.Resampling.LANCZOS)

    canvas = Image.new("RGB", (WIDTH, HEIGHT), "#F5F7FA")
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((0, 0, WIDTH, 92), fill="#0B2B5C")
    draw.text((70, 26), "SE-Path 学伴 | 软件工程自适应学习闭环 Demo", fill="#FFFFFF", font=FONT_BADGE)
    draw.rounded_rectangle((WIDTH - 320, 24, WIDTH - 70, 68), radius=18, fill="#EAFBF7")
    draw.text((WIDTH - 286, 31), "AI 应用赛演示素材", fill="#087B68", font=FONT_SMALL)

    sx = SCREEN_X + (SCREEN_W - screenshot.width) // 2
    sy = SCREEN_Y + (SCREEN_H - screenshot.height) // 2
    draw.rounded_rectangle(
        (sx - 16, sy - 16, sx + screenshot.width + 16, sy + screenshot.height + 16),
        radius=18,
        fill="#FFFFFF",
        outline="#D7E1ED",
        width=2,
    )
    canvas.paste(screenshot, (sx, sy))

    draw.rounded_rectangle((70, 900, WIDTH - 70, 1030), radius=18, fill="#FFFFFF", outline="#D7E1ED")
    draw.text((102, 922), str(scene["title"]), fill="#07111F", font=FONT_TITLE)
    y = 976
    for line in wrap_text(draw, str(scene["voice"]), FONT_BODY, WIDTH - 230):
        draw.text((104, y), line, fill="#344054", font=FONT_BODY)
        y += 38

    frame = FRAME_DIR / f"{scene['id']}.png"
    canvas.save(frame, quality=95)
    return frame


def make_contact_sheet(frames: list[Path]) -> None:
    thumb_w = 420
    thumb_h = 236
    margin = 22
    label_h = 42
    cols = 4
    rows = (len(frames) + cols - 1) // cols
    sheet = Image.new(
        "RGB",
        (cols * thumb_w + (cols + 1) * margin, rows * (thumb_h + label_h) + (rows + 1) * margin),
        "#F5F7FA",
    )
    draw = ImageDraw.Draw(sheet)
    for index, frame in enumerate(frames):
      image = Image.open(frame).convert("RGB")
      image.thumbnail((thumb_w, thumb_h), Image.Resampling.LANCZOS)
      x = margin + (index % cols) * (thumb_w + margin)
      y = margin + (index // cols) * (thumb_h + label_h + margin)
      draw.rounded_rectangle((x - 6, y - 6, x + thumb_w + 6, y + thumb_h + label_h), radius=12, fill="#FFFFFF")
      sheet.paste(image, (x + (thumb_w - image.width) // 2, y))
      label = f"{index + 1:02}. {SCENES[index]['title']}"
      label_lines = wrap_text(draw, label, FONT_SMALL, thumb_w - 10)[:2]
      for line_index, line in enumerate(label_lines):
          draw.text((x, y + thumb_h + 6 + line_index * 24), line, fill="#102033", font=FONT_SMALL)
    sheet.save(CONTACT_SHEET_PATH, quality=92)


def main() -> None:
    manifest_path = SOURCE_DIR / "demo_flow_manifest.json"
    if not manifest_path.exists():
        raise FileNotFoundError(manifest_path)
    json.loads(manifest_path.read_text(encoding="utf-8"))

    FRAME_DIR.mkdir(parents=True, exist_ok=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    frames = [make_frame(scene) for scene in SCENES]
    make_contact_sheet(frames)
    total_seconds = sum(int(scene["duration"]) for scene in SCENES)
    with CONCAT_PATH.open("w", encoding="utf-8", newline="\n") as handle:
        for frame, scene in zip(frames, SCENES):
            handle.write(f"file '{frame.as_posix()}'\n")
            handle.write(f"duration {scene['duration']}\n")
        handle.write(f"file '{frames[-1].as_posix()}'\n")

    cmd = [
        "ffmpeg",
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        str(CONCAT_PATH),
        "-f",
        "lavfi",
        "-i",
        "anullsrc=channel_layout=stereo:sample_rate=44100",
        "-shortest",
        "-t",
        str(total_seconds),
        "-vf",
        "fps=30,format=yuv420p",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "20",
        "-c:a",
        "aac",
        "-movflags",
        "+faststart",
        str(VIDEO_PATH),
    ]
    result = subprocess.run(
        cmd,
        cwd=ROOT,
        text=True,
        encoding="utf-8",
        errors="replace",
        capture_output=True,
    )
    if result.returncode != 0:
        raise SystemExit(result.stderr)

    sidecar = OUT_DIR / "演示视频素材说明.md"
    sidecar.write_text(
        "\n".join(
            [
                "# SE-Path 学伴演示视频素材说明",
                "",
                f"- 视频文件：`{VIDEO_PATH.name}`",
                f"- 分镜联系表：`{CONTACT_SHEET_PATH.name}`",
                f"- 总时长：{total_seconds} 秒",
                "- 版本：v0.3，当前为无配音字幕素材版，可直接作为剪辑底稿，也可叠加真人旁白。",
                "- 画面来源：真实运行的 `sepath-cloud-app` 自动点击闭环截图。",
                "",
                "## 分镜",
                "",
                "| 顺序 | 时长 | 标题 | 旁白稿 |",
                "| --- | ---: | --- | --- |",
                *[
                    f"| {index} | {scene['duration']}s | {scene['title']} | {scene['voice']} |"
                    for index, scene in enumerate(SCENES, 1)
                ],
                "",
                "## 后续录屏建议",
                "",
                "正式提交前建议用真人旁白重录一版，保留本素材中的节奏和术语。",
            ]
        ),
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "video": str(VIDEO_PATH),
                "bytes": VIDEO_PATH.stat().st_size,
                "seconds": total_seconds,
                "frames": len(frames),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
