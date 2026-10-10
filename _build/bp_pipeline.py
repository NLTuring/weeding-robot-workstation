# -*- coding: utf-8 -*-
"""通用两遍构建流水线（适用于任何由本目录 JS 脚本生成的文档）：

  第一遍：生成 docx → 注入占位目录 → 修页脚域 → 转 PDF，用于测量标题真实页码
  第二遍：重新生成 → 用实测页码回填目录 → 修页脚域 → 转 PDF → 后置检查

正文起始页由“页眉文字首次出现的页码”自动判定，因此不依赖固定的前置页数。

用法：python bp_pipeline.py <gen_script.js> <输出docx文件名> <页眉文字>
"""
import io, os, re, sys, json, zipfile, subprocess, time
import xml.etree.ElementTree as ET
import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SCRIPTS = r"C:\Users\Sgh\.zcode\cli\plugins\cache\zcode-plugins-official\document-skills\0.1.4\skills\docx\scripts"
SOFFICE = r"C:\Program Files\LibreOffice\program\soffice.exe"

sys.path.insert(0, SCRIPTS)
import add_toc_placeholders as atp  # noqa: E402

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
LEVEL_OF = {"Heading1": 1, "Heading2": 2, "Heading3": 3}


def norm(s):
    return re.sub(r"\s+", "", s)


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode != 0:
        print("FAILED:", " ".join(str(c) for c in cmd[:2]))
        print((r.stdout or "")[-1500:])
        print((r.stderr or "")[-1500:])
        sys.exit(1)
    return r.stdout


def _kill_soffice():
    # 不解码子进程输出：taskkill 在中文 Windows 上输出 GBK，解码会产生噪音
    for exe in ("soffice.bin", "soffice.exe"):
        subprocess.run(["taskkill", "/F", "/IM", exe, "/T"], capture_output=True)


def to_pdf(docx, pdf):
    """LibreOffice 连续调用时会因用户配置目录被占用而失败，
    因此每次转换前先清理残留进程，并以 PDF 产物是否生成作为成功判据。"""
    _kill_soffice()
    if os.path.exists(pdf):
        os.remove(pdf)
    for attempt in range(5):
        subprocess.run([SOFFICE, "--headless", "--convert-to", "pdf",
                        "--outdir", HERE, docx],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
        if os.path.exists(pdf) and os.path.getsize(pdf) > 20000:
            return
        print("  转换重试 %d/5 ..." % (attempt + 1))
        _kill_soffice()
        time.sleep(3)
    raise SystemExit("PDF 转换失败：%s" % pdf)


def head_entry(level, text, page):
    return {"level": level, "text": text, "page": str(page)}


def auto_entries(docx):
    return atp._extract_headings_from_docx(docx)


def docx_headings(docx):
    with zipfile.ZipFile(docx) as z:
        root = ET.fromstring(z.read("word/document.xml"))
    out = []
    for p in root.iter(W + "p"):
        ppr = p.find(W + "pPr")
        if ppr is None:
            continue
        st = ppr.find(W + "pStyle")
        if st is None or st.get(W + "val") not in LEVEL_OF:
            continue
        text = "".join(t.text or "" for t in p.iter(W + "t")).strip()
        if text:
            out.append({"level": LEVEL_OF[st.get(W + "val")], "text": text})
    return out


def measure(docx, pdf, header_text):
    """返回 (entries, front_pages)。front_pages = 正文第一页之前的页数。"""
    doc = pymupdf.open(pdf)
    pages = [norm(doc[i].get_text()) for i in range(doc.page_count)]
    key = norm(header_text)
    front = next((i for i, t in enumerate(pages) if key in t), None)
    if front is None:
        raise SystemExit("找不到页眉文字，无法判定正文起始页：%s" % header_text)

    entries, cursor, missing = [], front, []
    heads = docx_headings(docx)
    for h in heads:
        k = norm(h["text"])
        found = next((i for i in range(cursor, len(pages)) if k in pages[i]), None)
        if found is None:
            found = next((i for i in range(front, len(pages)) if k in pages[i]), None)
        if found is None:
            missing.append(h["text"])
            continue
        cursor = found
        entries.append(head_entry(h["level"], h["text"], found + 1 - front))
    return entries, front, missing, len(heads)


def main():
    gen_script, docx_name, header_text = sys.argv[1], sys.argv[2], sys.argv[3]
    docx = os.path.join(ROOT, docx_name)
    pdf = os.path.join(HERE, docx_name.replace(".docx", ".pdf"))
    os.chdir(HERE)

    print("── 第一遍：测量页码 ──")
    print(run(["node", gen_script]).strip())
    atp.add_toc_placeholders(docx, auto_entries(docx))
    run([sys.executable, os.path.join(SCRIPTS, "fix_footer_fields.py"), docx])
    to_pdf(docx, pdf)
    entries, front, missing, total = measure(docx, pdf, header_text)
    print("前置页数=%d  标题=%d  已定位=%d  未定位=%d" % (front, total, len(entries), len(missing)))
    for m in missing:
        print("  MISSING:", m)

    print("── 第二遍：回填实测页码 ──")
    print(run(["node", gen_script]).strip())
    atp.add_toc_placeholders(docx, entries)
    run([sys.executable, os.path.join(SCRIPTS, "fix_footer_fields.py"), docx])
    to_pdf(docx, pdf)

    print("── 检查 ──")
    out = run([sys.executable, os.path.join(SCRIPTS, "postcheck.py"), docx])
    for ln in out.splitlines():
        if any(k in ln for k in ("Passed", "❌", "✅", "⚠️")):
            print(ln)

    d = pymupdf.open(pdf)
    print("总页数: %d（前置 %d + 正文 %d）" % (d.page_count, front, d.page_count - front))
    print("已输出:", docx)


if __name__ == "__main__":
    main()
