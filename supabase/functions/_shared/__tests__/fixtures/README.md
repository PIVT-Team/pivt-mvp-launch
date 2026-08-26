# Extraction fixtures

Real Office files, produced by `openpyxl` and `python-docx` rather than written
by hand. Hand-built fixtures only test the parser against the same assumptions
that produced it — that is how the CID-font PDF bug survived a passing suite.

- `captable.xlsx` — three sheets, percent and date number formats, a formula
  cell, a total row, and a row with gaps between populated columns.
- `spa.docx` — headings, numbered sections, smart quotes, and a party table.
- `nested.docx` — a table inside a table cell, which naive `<w:tbl>` matching
  splices into surrounding text.

Regenerate with `scripts/make-extraction-fixtures.py` (needs openpyxl and
python-docx).
