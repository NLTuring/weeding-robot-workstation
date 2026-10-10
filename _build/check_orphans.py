# -*- coding: utf-8 -*-
"""检测 PDF 中“末行只剩 1 个汉字”的孤字行，并还原其所在单元格的完整文本。
用法：python check_orphans.py [pdf文件名] [--cells]
不带 --cells 时只统计与列出孤字位置；带 --cells 时额外输出单元格原文。
可排除合法的单字单元格（如风险表“影响”列的高/中/低）。"""
import os, re, sys, json
import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
CJK = re.compile(r"[\u4e00-\u9fff]")

args = [a for a in sys.argv[1:] if not a.startswith("--")]
pdf_name = args[0] if args else "除草机器人幼苗-杂草辨识与作业规划系统_项目简介.pdf"
show_cells = "--cells" in sys.argv[1:]
pdf = os.path.join(HERE, pdf_name)

# 这些词是合法的单字取值，不属于排版缺陷
LEGIT = {"高", "中", "低", "是", "否", "优", "良", "差"}


def main():
    doc = pymupdf.open(pdf)
    rows = []
    for pi in range(doc.page_count):
        for blk in doc[pi].get_text("dict").get("blocks", []):
            if blk.get("type") != 0:
                continue
            for ln in blk.get("lines", []):
                t = "".join(s.get("text", "") for s in ln.get("spans", [])).strip()
                if t:
                    rows.append((pi + 1, ln["bbox"][1], ln["bbox"][0], t))

    by_page = {}
    for r in rows:
        by_page.setdefault(r[0], []).append(r)

    hits = []
    for pi, y, x0, t in rows:
        if len(t) != 1 or not CJK.match(t):
            continue
        parts, cy = [t], y
        while True:
            cands = [r for r in by_page[pi] if abs(r[2] - x0) < 6 and 0 < cy - r[1] < 22]
            if not cands:
                break
            nxt = max(cands, key=lambda r: r[1])
            parts.insert(0, nxt[3])
            cy = nxt[1]
        cell = "".join(parts)
        hits.append({"page": pi, "y": round(y), "x": round(x0), "cell": cell,
                     "legit": len(cell) == 1 and cell in LEGIT})

    real = [h for h in hits if not h["legit"]]
    print("单字行=%d  其中合法单字单元格=%d  需修复=%d" % (len(hits), len(hits) - len(real), len(real)))
    for h in real:
        print("  p%02d x=%4d  %s" % (h["page"], h["x"], h["cell"] if show_cells else h["cell"][-1]))
    if show_cells:
        out = os.path.join(HERE, "orphan_cells_%s.json" % re.sub(r"\W+", "", pdf_name)[:20])
        with open(out, "w", encoding="utf-8") as f:
            json.dump(real, f, ensure_ascii=False, indent=1)
        print("written ->", out)


if __name__ == "__main__":
    main()
