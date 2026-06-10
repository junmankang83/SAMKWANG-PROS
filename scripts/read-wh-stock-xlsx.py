"""One-off: read warehouse stock xlsx headers and sample rows."""
import json
import zipfile
import xml.etree.ElementTree as ET

XLSX = r"c:\Users\SAMKWNAG\Downloads\창고별 재고조회_20260609.xlsx"
OUT_JSON = r"e:\SAMKWANG AI\SAMKWANG-PROS\SAMKWANG-PROS\scripts\wh-stock-excel-headers.json"
NS = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def cell_text(c: ET.Element) -> str:
    is_el = c.find("x:is", NS)
    if is_el is not None:
        parts: list[str] = []
        for t in is_el.iter("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t"):
            parts.append(t.text or "")
        return "".join(parts)
    v = c.find("x:v", NS)
    return (v.text if v is not None and v.text else "") or ""


def main() -> None:
    z = zipfile.ZipFile(XLSX)
    root = ET.fromstring(z.read("xl/worksheets/sheet.xml"))
    rows = root.findall(".//x:sheetData/x:row", NS)
    by_row: dict[int, list[str]] = {}
    for ri, row in enumerate(rows, start=1):
        line: list[str] = []
        for ci, c in enumerate(row.findall("x:c", NS)):
            if ci > 41:
                break
            line.append(cell_text(c))
        while len(line) < 42:
            line.append("")
        by_row[ri] = line

    r2 = by_row.get(2, [])
    r3 = by_row.get(3, [])
    wh_unique: list[str] = []
    for i in range(12, 41, 2):
        t = (r2[i] or "").strip()
        if t:
            wh_unique.append(t)
    payload = {
        "title_row1_colA": (by_row.get(1, [""])[0] or "").strip(),
        "fixed_headers_row2_A_J": [x.strip() for x in r2[:10]],
        "row2_K": (r2[10] or "").strip(),
        "row2_L": (r2[11] or "").strip(),
        "warehouse_headers_15": wh_unique,
        "row3_L_sub": (r3[11] or "").strip(),
        "total_row4_sample": by_row.get(4, [])[:15],
        "data_row5_sample": by_row.get(5, [])[:15],
    }
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print("wrote", OUT_JSON, "warehouses", len(wh_unique))


if __name__ == "__main__":
    main()
