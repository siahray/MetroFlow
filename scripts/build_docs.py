#!/usr/bin/env python3
"""Build the Word deliverables from the Markdown sources.

Each generated document starts from the matching Word template, so page size,
margins, fonts, headers and footers survive. The template's body content is
removed and replaced with the content of the Markdown file; the template files
themselves are never modified.

Usage (from the repository root):

    python3 -m venv .docx-venv
    . .docx-venv/bin/activate
    pip install python-docx
    python scripts/build_docs.py

Requires python-docx.
"""

from __future__ import annotations

import re
import sys
from datetime import UTC, datetime
from pathlib import Path

try:
    from docx import Document
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.shared import Pt, RGBColor
except ImportError:  # pragma: no cover - operator guidance
    sys.exit("python-docx is required: pip install python-docx")

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
TEMPLATES = DOCS / "docx"
OUTPUT = TEMPLATES / "generated"

DOCUMENTS = [
    ("PROJECT_CHARTER.md", "Project_Charter.docx"),
    ("BRD.md", "BRD.docx"),
    ("BUSINESS_CASE.md", "Business_Case.docx"),
    ("FSD.md", "FSD.docx"),
    ("TSD.md", "TSD.docx"),
    ("PROJ_MANAGEMENT_PLAN.md", "Project-Management-Plan.docx"),
]

INLINE = re.compile(r"(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*|\[[^\]]+\]\([^)]+\))")


def unescape(text: str) -> str:
    return text.replace("\\*", "*").replace("\\|", "|").replace("\\_", "_")


def add_runs(paragraph, text: str, *, size: float | None = None) -> None:
    """Add text to a paragraph, honouring **bold**, `code`, *italic* and links."""
    for part in INLINE.split(unescape(text)):
        if not part:
            continue
        if part.startswith("**") and part.endswith("**"):
            run = paragraph.add_run(part[2:-2])
            run.bold = True
        elif part.startswith("`") and part.endswith("`"):
            run = paragraph.add_run(part[1:-1])
            run.font.name = "Consolas"
            run.font.size = Pt((size or 10) - 0.5)
        elif part.startswith("*") and part.endswith("*") and len(part) > 2:
            run = paragraph.add_run(part[1:-1])
            run.italic = True
        elif part.startswith("[") and "](" in part:
            label = part[1 : part.index("]")]
            run = paragraph.add_run(label)
            run.italic = True
        else:
            run = paragraph.add_run(part)
        if size:
            run.font.size = Pt(size)


def split_table_row(line: str) -> list[str]:
    line = line.strip().strip("|")
    return [unescape(cell.strip()) for cell in line.split("|")]


def is_separator(line: str) -> bool:
    return bool(re.fullmatch(r"\|?[\s:|-]+\|?", line.strip())) and "-" in line


def add_code_block(doc, lines: list[str]) -> None:
    for line in lines or [""]:
        paragraph = doc.add_paragraph()
        paragraph.paragraph_format.space_after = Pt(0)
        paragraph.paragraph_format.space_before = Pt(0)
        run = paragraph.add_run(line if line else " ")
        run.font.name = "Consolas"
        run.font.size = Pt(8.5)
        run.font.color.rgb = RGBColor(0x1F, 0x29, 0x37)


def add_table(doc, rows: list[list[str]], style_name: str) -> None:
    columns = max(len(row) for row in rows)
    table = doc.add_table(rows=len(rows), cols=columns)
    table.style = style_name
    table.autofit = True
    font_size = 8 if columns >= 5 else 9

    for row_index, row in enumerate(rows):
        cells = table.rows[row_index].cells
        for column_index in range(columns):
            text = row[column_index] if column_index < len(row) else ""
            paragraph = cells[column_index].paragraphs[0]
            paragraph.paragraph_format.space_after = Pt(0)
            add_runs(paragraph, text, size=font_size)
            if row_index == 0:
                for run in paragraph.runs:
                    run.bold = True

    # Repeat the header row when the table crosses a page boundary.
    header = table.rows[0]._tr
    properties = header.get_or_add_trPr()
    repeat = properties.makeelement(
        "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tblHeader", {}
    )
    properties.append(repeat)

    spacer = doc.add_paragraph()
    spacer.paragraph_format.space_after = Pt(4)


def build(markdown_path: Path, template_path: Path, output_path: Path) -> None:
    doc = Document(template_path)
    body = doc.element.body
    for child in list(body):
        if child.tag.endswith("}sectPr"):
            continue
        body.remove(child)

    style_name = "Table Grid"
    if doc.tables:
        style_name = doc.tables[0].style.name or style_name
    # The template's tables were removed with the body; keep the style name only.

    lines = markdown_path.read_text(encoding="utf-8").splitlines()
    index = 0
    first_heading = True
    subtitle_pending = True

    while index < len(lines):
        line = lines[index]
        stripped = line.strip()

        if not stripped:
            index += 1
            continue

        if stripped.startswith("```"):
            index += 1
            block: list[str] = []
            while index < len(lines) and not lines[index].strip().startswith("```"):
                block.append(lines[index].rstrip("\n"))
                index += 1
            index += 1
            add_code_block(doc, block)
            continue

        if stripped.startswith("#"):
            match = re.match(r"^(#{1,4})\s+(.*)$", stripped)
            if match:
                level = len(match.group(1))
                text = match.group(2).strip()
                if level == 1 and first_heading:
                    paragraph = doc.add_paragraph(style="Title")
                    add_runs(paragraph, text)
                    first_heading = False
                elif level == 2 and subtitle_pending:
                    paragraph = doc.add_paragraph(style="Subtitle")
                    add_runs(paragraph, text)
                    subtitle_pending = False
                else:
                    subtitle_pending = False
                    # Markdown uses "#" for the document title, so "##" is the
                    # template's Heading 1. Shift one level to match.
                    heading = doc.add_heading(level=min(max(level - 1, 1), 4))
                    add_runs(heading, text)
                index += 1
                continue

        if stripped.startswith("|"):
            rows: list[list[str]] = []
            while index < len(lines) and lines[index].strip().startswith("|"):
                if not is_separator(lines[index]):
                    rows.append(split_table_row(lines[index]))
                index += 1
            if rows:
                add_table(doc, rows, style_name)
            continue

        if stripped.startswith("- "):
            paragraph = doc.add_paragraph(style="List Bullet")
            add_runs(paragraph, stripped[2:])
            index += 1
            continue

        if re.match(r"^\d+\.\s", stripped):
            paragraph = doc.add_paragraph(style="List Number")
            add_runs(paragraph, re.sub(r"^\d+\.\s", "", stripped))
            index += 1
            continue

        if stripped.startswith(">"):
            paragraph = doc.add_paragraph()
            paragraph.paragraph_format.left_indent = Pt(18)
            add_runs(paragraph, stripped.lstrip("> ").strip())
            index += 1
            continue

        if stripped in {"---", "***", "___"}:
            index += 1
            continue

        paragraph_lines = [stripped]
        index += 1
        while index < len(lines):
            candidate = lines[index].strip()
            if (
                not candidate
                or candidate.startswith(("#", "|", "- ", ">", "```"))
                or re.match(r"^\d+\.\s", candidate)
            ):
                break
            paragraph_lines.append(candidate)
            index += 1

        paragraph = doc.add_paragraph()
        add_runs(paragraph, " ".join(paragraph_lines))

    doc.core_properties.title = markdown_path.stem.replace("_", " ").title()
    doc.core_properties.comments = (
        f"Generated from docs/{markdown_path.name} on "
        f"{datetime.now(UTC).date().isoformat()}."
    )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    doc.save(output_path)
    print(f"{markdown_path.name} -> {output_path.relative_to(ROOT)}")


def main() -> int:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for markdown_name, template_name in DOCUMENTS:
        markdown_path = DOCS / markdown_name
        template_path = TEMPLATES / template_name
        if not markdown_path.exists():
            print(f"skip: {markdown_path} missing")
            continue
        if not template_path.exists():
            print(f"skip: {template_path} missing")
            continue
        build(markdown_path, template_path, OUTPUT / template_name)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
