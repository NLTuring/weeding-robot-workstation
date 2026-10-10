# -*- coding: utf-8 -*-
"""裁剪 PDF 指定区域并放大保存，用于核对字型。用法：python zoom_pdf.py"""
import os
import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
pdf = os.path.join(HERE, "商业计划书_简版样板.pdf")
d = pymupdf.open(pdf)
pg = d[0]
# 封面标题区域
pg.get_pixmap(dpi=260, clip=pymupdf.Rect(70, 300, 620, 420)).save(
    os.path.join(HERE, "cover_title_zoom.png"))
# 封面下方元信息区域（非加粗），用于字型对比
pg.get_pixmap(dpi=260, clip=pymupdf.Rect(70, 560, 620, 680)).save(
    os.path.join(HERE, "cover_meta_zoom.png"))
print("ok")
