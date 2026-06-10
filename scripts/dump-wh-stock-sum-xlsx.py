"""One-off: dump 창고별수불집계 xlsx headers (run with path as argv[1])."""
import sys
import zipfile
import re
from pathlib import Path

import openpyxl


def main() -> None:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    if not path or not path.is_file():
        print("usage: python dump-wh-stock-sum-xlsx.py <file.xlsx>", file=sys.stderr)
        sys.exit(1)

    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb.active
    for ri in range(1, 6):
        row = list(ws.iter_rows(min_row=ri, max_row=ri, values_only=True))[0]
        vals = [v for v in row if v is not None]
        print(f"ROW{ri} n={len(vals)}")
        for i, v in enumerate(row):
            if v is None:
                continue
            print(f"  {i}: {v!r}")


if __name__ == "__main__":
    main()
