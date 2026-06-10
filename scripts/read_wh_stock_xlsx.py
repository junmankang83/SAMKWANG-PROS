"""Dump header row from 창고별수불집계조회_skkr xlsx (run from repo)."""

from __future__ import annotations

import glob
import json
import os
import re
import sys
import zipfile
import xml.etree.ElementTree as ET


def col_letters_to_index(col: str) -> int:
    n = 0
    for c in col:
        n = n * 26 + (ord(c.upper()) - ord("A") + 1)
    return n - 1


def parse_cell_ref(ref: str) -> tuple[int, int]:
    m = re.match(r"^([A-Z]+)(\d+)$", ref, re.I)
    if not m:
        return 0, 0
    return int(m.group(2)) - 1, col_letters_to_index(m.group(1))


def load_shared_strings(z: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in z.namelist():
        return []
    root = ET.fromstring(z.read("xl/sharedStrings.xml"))
    ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    out: list[str] = []
    for si in root.findall("m:si", ns):
        out.append("".join(si.itertext()))
    return out


def main() -> None:
    pattern = r"C:\Users\SAMKWNAG\Downloads\*20260609*.xlsx"
    cands = [p for p in glob.glob(pattern) if "~$" not in os.path.basename(p)]
    if not cands:
        print("No file", file=sys.stderr)
        sys.exit(1)
    path = cands[0]
    print("file:", path, file=sys.stderr)
    with zipfile.ZipFile(path) as z:
        strings = load_shared_strings(z)
        sheet = "xl/worksheets/sheet1.xml"
        if sheet not in z.namelist():
            sheet = [n for n in z.namelist() if n.startswith("xl/worksheets/sheet")][0]
        root = ET.fromstring(z.read(sheet))
        ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
        rows = root.findall(".//m:sheetData/m:row", ns)
        grid: dict[tuple[int, int], str] = {}
        max_r, max_c = 0, 0
        for row in rows[:30]:
            row_num = int(row.get("r", "1")) - 1
            col_cursor = -1
            for c in row.findall("m:c", ns):
                ref = c.get("r")
                if ref:
                    row_num, col_cursor = parse_cell_ref(ref)
                else:
                    col_cursor += 1
                t = c.get("t")
                is_el = c.find("m:is", ns)
                v_el = c.find("m:v", ns)
                val = ""
                if is_el is not None:
                    val = "".join(is_el.itertext())
                elif v_el is not None and v_el.text is not None:
                    if t == "s":
                        val = strings[int(v_el.text)] if strings else v_el.text
                    else:
                        val = v_el.text
                grid[(row_num, col_cursor)] = val
                max_r = max(max_r, row_num)
                max_c = max(max_c, col_cursor)
        for header_row in (1, 0, 2):
            headers = [grid.get((header_row, c), "") for c in range(max_c + 1)]
            while headers and headers[-1] == "":
                headers.pop()
            if any(h.strip() for h in headers):
                print(json.dumps({"path": path, "headerRow": header_row, "headers": headers}, ensure_ascii=False, indent=2))
                return
        print(json.dumps({"path": path, "error": "no headers", "max_r": max_r, "max_c": max_c, "sample": str(grid)[:500]}, indent=2))


if __name__ == "__main__":
    main()
