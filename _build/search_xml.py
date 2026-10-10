# -*- coding: utf-8 -*-
"""在 docx 的 document.xml 中检索关键词，判断内容是否丢失。"""
import os, sys, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
name = sys.argv[1]
keys = sys.argv[2:]

with zipfile.ZipFile(os.path.join(ROOT, name)) as z:
    xml = z.read("word/document.xml").decode("utf-8")

for k in keys:
    print("%-34s %s" % (k, "FOUND" if k in xml else "MISSING"))
print("document.xml length:", len(xml))
