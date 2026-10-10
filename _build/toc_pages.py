# -*- coding: utf-8 -*-
"""从渲染后的 PDF 中提取各级标题的真实正文页码，生成 TOC 条目 JSON。
用于把这些条目回填给 add_toc_placeholders.py --entries，
使目录页码在用户不手动“更新域”的情况下也是正确的。"""
import os, re, json, zipfile
import xml.etree.ElementTree as ET
import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
DOCX = os.path.join(HERE, "..", "除草机器人幼苗-杂草辨识与作业规划系统_项目简介.docx")
PDF = os.path.join(HERE, "除草机器人幼苗-杂草辨识与作业规划系统_项目简介.pdf")

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
FRONT_PAGES = 4          # 封面 1 页 + 目录 3 页，正文从 PDF 第 5 页开始
LEVEL_OF = {"Heading1": 1, "Heading2": 2, "Heading3": 3}


def norm(s):
    return re.sub(r"\s+", "", s)


def read_headings(docx_path):
    with zipfile.ZipFile(docx_path) as z:
        xml = z.read("word/document.xml")
    root = ET.fromstring(xml)
    out = []
    for p in root.iter(W + "p"):
        ppr = p.find(W + "pPr")
        if ppr is None:
            continue
        st = ppr.find(W + "pStyle")
        if st is None:
            continue
        val = st.get(W + "val")
        if val not in LEVEL_OF:
            continue
        text = "".join(t.text or "" for t in p.iter(W + "t"))
        if text.strip():
            out.append({"level": LEVEL_OF[val], "text": text.strip()})
    return out


def main():
    headings = read_headings(DOCX)
    doc = pymupdf.open(PDF)
    pages = [norm(doc[i].get_text()) for i in range(doc.page_count)]

    entries = []
    cursor = FRONT_PAGES          # 只向前搜索，保证标题顺序与页码单调
    missing = []
    for h in headings:
        key = norm(h["text"])
        found = None
        for i in range(cursor, len(pages)):
            if key in pages[i]:
                found = i
                break
        if found is None:                      # 回退：全文档搜索
            for i in range(FRONT_PAGES, len(pages)):
                if key in pages[i]:
                    found = i
                    break
        if found is None:
            missing.append(h["text"])
            continue
        cursor = found
        entries.append({
            "level": h["level"],
            "text": h["text"],
            "page": str(found + 1 - FRONT_PAGES),
        })

    out = os.path.join(HERE, "toc_entries.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False)
    print("headings=%d  entries=%d  missing=%d" % (len(headings), len(entries), len(missing)))
    for m in missing:
        print("  MISSING:", m)
    print("last entry:", entries[-1] if entries else None)
    print("written ->", out)


if __name__ == "__main__":
    main()
