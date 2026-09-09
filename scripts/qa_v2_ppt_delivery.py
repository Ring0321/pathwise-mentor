import json
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

from PIL import Image, ImageDraw


ROOT = Path(r"D:\相关比赛、论文\2026.8-自适应习路径决策与伴学")
PPTX = ROOT / "参赛提交材料包" / "SE-Path学伴_答辩PPT_v0.3_真实闭环版.pptx"
RENDER_DIR = ROOT / "outputs" / "pptx-build-v2" / "renders"
CONTACT_SHEET = ROOT / "outputs" / "pptx-build-v2" / "SE-Path学伴_答辩PPT_v0.3_真实闭环版_contact_sheet.jpg"
QA_JSON = ROOT / "参赛提交材料包" / "SE-Path学伴_答辩PPT_v0.3_真实闭环版_text_qa.json"

NS = {"a": "http://schemas.openxmlformats.org/drawingml/2006/main"}
BAD_PATTERNS = [
    "xxxx",
    "lorem",
    "ipsum",
    "TODO",
    "占位",
    "示例标题",
    "点击添加",
]


def slide_sort_key(name: str) -> int:
    match = re.search(r"slide(\d+)\.xml$", name)
    return int(match.group(1)) if match else 0


def extract_slide_text() -> list[dict]:
    slides: list[dict] = []
    with zipfile.ZipFile(PPTX) as zf:
        names = sorted(
            [n for n in zf.namelist() if re.match(r"ppt/slides/slide\d+\.xml$", n)],
            key=slide_sort_key,
        )
        for idx, name in enumerate(names, start=1):
            root = ET.fromstring(zf.read(name))
            text = "".join(node.text or "" for node in root.findall(".//a:t", NS))
            slides.append(
                {
                    "slide": idx,
                    "chars": len(text),
                    "text": text,
                    "bad_patterns": [p for p in BAD_PATTERNS if p.lower() in text.lower()],
                }
            )
    return slides


def build_contact_sheet() -> None:
    images = sorted(RENDER_DIR.glob("slide-*.png"))
    if not images:
        raise FileNotFoundError(f"No rendered slides found in {RENDER_DIR}")
    thumbs = []
    for img_path in images:
        img = Image.open(img_path).convert("RGB")
        img.thumbnail((360, 203))
        canvas = Image.new("RGB", (380, 238), "white")
        canvas.paste(img, ((380 - img.width) // 2, 18))
        draw = ImageDraw.Draw(canvas)
        draw.text((16, 214), img_path.stem, fill=(80, 90, 105))
        thumbs.append(canvas)
    cols = 3
    rows = (len(thumbs) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * 380, rows * 238), (246, 247, 243))
    for i, thumb in enumerate(thumbs):
        x = (i % cols) * 380
        y = (i // cols) * 238
        sheet.paste(thumb, (x, y))
    CONTACT_SHEET.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(CONTACT_SHEET, quality=92)


def main() -> None:
    slides = extract_slide_text()
    build_contact_sheet()
    qa = {
        "pptx": str(PPTX),
        "slides": len(slides),
        "total_chars": sum(s["chars"] for s in slides),
        "empty_slides": [s["slide"] for s in slides if s["chars"] == 0],
        "bad_pattern_hits": [
            {"slide": s["slide"], "patterns": s["bad_patterns"]}
            for s in slides
            if s["bad_patterns"]
        ],
        "contact_sheet": str(CONTACT_SHEET),
    }
    QA_JSON.write_text(json.dumps(qa, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(qa, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
