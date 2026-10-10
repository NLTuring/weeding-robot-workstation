# -*- coding: utf-8 -*-
import pymupdf, os, sys

PDF = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                   "除草机器人幼苗-杂草辨识与作业规划系统_项目简介.pdf")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "png")
os.makedirs(OUT, exist_ok=True)
d = pymupdf.open(PDF)
print("pages:", d.page_count)
for i in range(d.page_count):
    pix = d[i].get_pixmap(dpi=95)
    pix.save(os.path.join(OUT, "p%02d.png" % (i + 1)))
print("rendered ->", OUT)
# 逐页文字量统计，便于发现空白页
for i in range(d.page_count):
    t = d[i].get_text().strip()
    print("p%02d chars=%4d | %s" % (i + 1, len(t), t[:60].replace("\n", " ")))
