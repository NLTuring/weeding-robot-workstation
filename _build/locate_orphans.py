# -*- coding: utf-8 -*-
"""定位“末行仅 1 个汉字”的表格单元格，并还原该单元格的完整文本。
原理：同一单元格的各行 x 起点相同、行距连续；自孤字行向上回溯即可还原整格文字。
输出可直接在 generate.js 中检索的原文，便于逐条精简措辞。"""
import os, re, json
import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
PDF = os.path.join(HERE, "除草机器人幼苗-杂草辨识与作业规划系统_项目简介.pdf")
CJK = re.compile(r"[\u4e00-\u9fff]")


def collect(doc):
    rows = []          # (page, y, x0, text)
    for pi in range(doc.page_count):
        d = doc[pi].get_text("dict")
        for blk in d.get("blocks", []):
            if blk.get("type") != 0:
                continue
            for ln in blk.get("lines", []):
                txt = "".join(sp.get("text", "") for sp in ln.get("spans", []))
                if not txt.strip():
                    continue
                rows.append((pi + 1, ln["bbox"][1], ln["bbox"][0], txt.strip()))
    return rows


def main():
    doc = pymupdf.open(PDF)
    rows = collect(doc)
    by_page = {}
    for r in rows:
        by_page.setdefault(r[0], []).append(r)

    cells = []
    for pi, y, x0, txt in rows:
        if len(txt) != 1 or not CJK.match(txt):
            continue
        # 向上回溯同一单元格的其余行
        parts = [txt]
        cy = y
        while True:
            cands = [r for r in by_page[pi]
                     if abs(r[2] - x0) < 6 and 0 < cy - r[1] < 22]
            if not cands:
                break
            nxt = max(cands, key=lambda r: r[1])
            # 上一行若已是另一格的起始（x 相同但文本很短且间距偏大），停止
            parts.insert(0, nxt[3])
            cy = nxt[1]
        cell = "".join(parts)
        if len(cell) > 1:                      # 排除“高/中/低”这类合法单字单元格
            cells.append({"pdf_page": pi, "body_page": pi - 4,
                          "x": round(x0), "cell": cell})

    # 去重（同一单元格可能因多行命中而重复）
    seen, uniq = set(), []
    for c in cells:
        key = (c["pdf_page"], c["x"], c["cell"])
        if key in seen:
            continue
        seen.add(key)
        uniq.append(c)

    print("offending cells: %d" % len(uniq))
    for c in uniq:
        print("  p%02d(body %2d) x=%4d  %s" % (c["pdf_page"], c["body_page"], c["x"], c["cell"]))

    out = os.path.join(HERE, "orphan_cells.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(uniq, f, ensure_ascii=False, indent=1)
    print("written ->", out)


if __name__ == "__main__":
    main()
