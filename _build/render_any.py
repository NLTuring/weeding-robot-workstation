# -*- coding: utf-8 -*-
"""把指定 PDF 渲染为 PNG，并打印每页正文前 60 字，便于快速判断内容是否完整。"""
import os, sys
import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
pdf_name = sys.argv[1]
outdir = sys.argv[2]
pdf = os.path.join(HERE, pdf_name)
out = os.path.join(HERE, outdir)
os.makedirs(out, exist_ok=True)

d = pymupdf.open(pdf)
print("pages:", d.page_count)
for i in range(d.page_count):
    d[i].get_pixmap(dpi=95).save(os.path.join(out, "%s%02d.png" % (outdir, i + 1)))
    t = d[i].get_text().strip().replace("\n", " ")
    print("p%02d chars=%4d | %s" % (i + 1, len(t), t[:70]))
print("rendered ->", out)
