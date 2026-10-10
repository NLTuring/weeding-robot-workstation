# -*- coding: utf-8 -*-
"""完整重建流水线（两遍法）：
  第一遍：生成 → 占位目录 → 修页脚 → 转 PDF，用于测量各级标题的真实页码
  第二遍：生成 → 用实测页码回填目录 → 修页脚 → 转 PDF → 渲染 → 检查
两遍使用同一份生成代码，故第一遍测得的页码在第二遍依然有效。"""
import os, subprocess, sys, json

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DOCX = os.path.join(ROOT, "除草机器人幼苗-杂草辨识与作业规划系统_项目简介.docx")
SCRIPTS = r"C:\Users\Sgh\.zcode\cli\plugins\cache\zcode-plugins-official\document-skills\0.1.4\skills\docx\scripts"
SOFFICE = r"C:\Program Files\LibreOffice\program\soffice.exe"


def run(cmd, tail=1):
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8",
                       errors="replace")
    if r.returncode != 0:
        print("FAILED:", " ".join(str(c) for c in cmd[:2]))
        print(r.stdout[-1500:])
        print(r.stderr[-1500:])
        sys.exit(1)
    lines = [l for l in r.stdout.strip().splitlines() if l.strip()]
    return "\n".join(lines[-tail:]) if lines else ""


def pdf():
    run([SOFFICE, "--headless", "--convert-to", "pdf", "--outdir", HERE, DOCX], tail=0)


def main():
    os.chdir(HERE)

    # ── 第一遍：测量页码 ──
    print(run(["node", "generate.js"]))
    run([sys.executable, os.path.join(SCRIPTS, "add_toc_placeholders.py"), DOCX, "--auto"], tail=0)
    run([sys.executable, os.path.join(SCRIPTS, "fix_footer_fields.py"), DOCX], tail=0)
    pdf()
    print(run([sys.executable, "toc_pages.py"], tail=0))
    with open(os.path.join(HERE, "toc_entries.json"), encoding="utf-8") as f:
        n = len(json.load(f))
    print("measured toc entries:", n)

    # ── 第二遍：回填实测页码并定稿 ──
    print(run(["node", "generate.js"]))
    print(run([sys.executable, "apply_toc.py"], tail=1))
    run([sys.executable, os.path.join(SCRIPTS, "fix_footer_fields.py"), DOCX], tail=0)
    pdf()

    print(run([sys.executable, os.path.join(SCRIPTS, "postcheck.py"), DOCX], tail=6))
    print(run([sys.executable, "check_orphans.py"]))
    print(run([sys.executable, "render.py"]))


if __name__ == "__main__":
    main()
