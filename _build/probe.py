# -*- coding: utf-8 -*-
"""针对指定关键词，打印其在 PDF 中所在行与相邻行，用于核实是否存在孤字。"""
import os, sys
import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
PDF = os.path.join(HERE, "除草机器人幼苗-杂草辨识与作业规划系统_项目简介.pdf")

KEYS = sys.argv[1:] or ["一句话亮"]


def main():
    doc = pymupdf.open(PDF)
    for pi in range(doc.page_count):
        d = doc[pi].get_text("dict")
        lines = []
        for blk in d.get("blocks", []):
            if blk.get("type") != 0:
                continue
            for ln in blk.get("lines", []):
                txt = "".join(sp.get("text", "") for sp in ln.get("spans", []))
                if txt.strip():
                    lines.append((round(ln["bbox"][0]), round(ln["bbox"][1]), txt.strip()))
        for k in KEYS:
            for i, (x, y, t) in enumerate(lines):
                if k in t:
                    print("pdf_p%02d  x=%4d y=%4d  %r" % (pi + 1, x, y, t))
                    for j in range(i + 1, min(i + 4, len(lines))):
                        nx, ny, nt = lines[j]
                        if abs(nx - x) < 8 and 0 < ny - y < 22:
                            print("        next-line: x=%4d  %r" % (nx, nt))
                        else:
                            break
                    print()


if __name__ == "__main__":
    main()
