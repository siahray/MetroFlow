"""Checks the Markdown-to-Word flattening helpers in scripts/build_docs.py.

The LaTeX converter is the one place the doc build can silently corrupt a
submitted document, so its two failure modes get a test: a math span rendered as
literal TeX, and a US-dollar price mangled into math.
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

from build_docs import inline_math, latex_to_text  # noqa: E402


def test_display_math_becomes_readable_text() -> None:
    assert latex_to_text(r"$\ge 0.143.5$") == "≥ 0.143.5"
    assert latex_to_text(r"$(0, 200]$") == "(0, 200]"
    assert latex_to_text(r"$\pm 90$") == "± 90"
    assert latex_to_text(r"$\mathcal{O}(E \log V)$") == "O(E log V)"


def test_cases_environment_collapses_to_one_sentence() -> None:
    rendered = latex_to_text(
        r"$\text{Status} = \begin{cases} \text{SUBMERGED} & \text{if } \text{depth} \ge \text{clearance} \\ "
        r"\text{PASSABLE} & \text{otherwise} \end{cases}$"
    )
    assert "SUBMERGED" in rendered and "PASSABLE" in rendered
    assert "\\begin" not in rendered and "&" not in rendered


def test_inline_math_spans_convert_but_prices_do_not() -> None:
    assert inline_math(r"returns $A^*$ paths") == "returns A* paths"
    price = "Pro $25/mo base, then $10/mo credit"
    assert inline_math(price) == price
