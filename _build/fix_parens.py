# -*- coding: utf-8 -*-
"""修正 gen_blueprint.js 中以 P("...") 形式调用时多写的一个右括号，
并逐行校验括号平衡，避免同类笔误再次进入生成脚本。"""
import io, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
TARGET = os.path.join(HERE, "gen_blueprint.js")

with io.open(TARGET, encoding="utf-8") as f:
    lines = f.read().split("\n")

fixed = 0
for i, ln in enumerate(lines):
    # 形如：P("...."));   —— P 后直接跟字符串字面量，正确结尾应为 ");
    if re.match(r'^\s*P\("', ln) and ln.rstrip().endswith('"));'):
        lines[i] = ln.rstrip()[:-1]
        fixed += 1

with io.open(TARGET, "w", encoding="utf-8") as f:
    f.write("\n".join(lines))
print("fixed lines:", fixed)

# 括号平衡校验（忽略字符串内部的括号需要更复杂的解析，此处按行做启发式检查）
bad = []
for i, ln in enumerate(lines, 1):
    stripped = ln.strip()
    if not stripped or stripped.startswith("//"):
        continue
    # 去掉字符串字面量内容后再数括号
    no_str = re.sub(r'"(?:[^"\\]|\\.)*"', '""', ln)
    no_str = re.sub(r"'(?:[^'\\]|\\.)*'", "''", no_str)
    bal = no_str.count("(") - no_str.count(")")
    if bal > 0 and stripped.endswith(";"):
        bad.append((i, bal, stripped[:80]))
    if bal < 0:
        bad.append((i, bal, stripped[:80]))

if bad:
    print("possible unbalanced lines:")
    for i, bal, t in bad:
        print("  L%-4d bal=%+d  %s" % (i, bal, t))
    sys.exit(1)
print("paren balance: OK")
