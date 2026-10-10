# -*- coding: utf-8 -*-
"""用实测页码重写 TOC 占位条目。
通过直接 import 技能脚本的 add_toc_placeholders() 函数，
避免在 Windows 命令行上传递 4KB JSON 字符串的转义问题。"""
import os, sys, json

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = r"C:\Users\Sgh\.zcode\cli\plugins\cache\zcode-plugins-official\document-skills\0.1.4\skills\docx\scripts"
sys.path.insert(0, SCRIPTS)

import add_toc_placeholders as atp

DOCX = os.path.join(HERE, "..", "除草机器人幼苗-杂草辨识与作业规划系统_项目简介.docx")
ENTRIES = os.path.join(HERE, "toc_entries.json")

with open(ENTRIES, encoding="utf-8") as f:
    entries = json.load(f)
print("entries:", len(entries))

atp.add_toc_placeholders(DOCX, entries)
print("TOC placeholders rewritten with measured page numbers")
