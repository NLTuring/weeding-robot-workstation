# -*- coding: utf-8 -*-
"""列出 docx 中所有 Heading 1-3 段落，用于核对标题层级与目录条目是否完整。"""
import io, os, re, sys, zipfile
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"

name = sys.argv[1] if len(sys.argv) > 1 else "商业计划书_设计纲要.docx"
path = os.path.join(ROOT, name)

with zipfile.ZipFile(path) as z:
    root = ET.fromstring(z.read("word/document.xml"))

n = 0
for p in root.iter(W + "p"):
    ppr = p.find(W + "pPr")
    if ppr is None:
        continue
    st = ppr.find(W + "pStyle")
    if st is None:
        continue
    v = st.get(W + "val")
    if not re.match(r"Heading[123]$", v):
        continue
    txt = "".join(t.text or "" for t in p.iter(W + "t")).strip()
    if txt:
        n += 1
        print("%2d  %-9s %s" % (n, v, txt))
print("total headings:", n)
