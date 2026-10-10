# -*- coding: utf-8 -*-
"""把 JS 生成脚本中 P("<字符串>") 这类单行调用的结尾统一规范为 ");
即：字符串结束引号之后只保留一个右括号和分号，去掉重复的右括号。
用法：python fix_parens2.py [文件1 文件2 ...]   （默认处理 gen_blueprint.js）"""
import io, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
targets = sys.argv[1:] or ["gen_blueprint.js"]

for name in targets:
    path = name if os.path.isabs(name) else os.path.join(HERE, name)
    with io.open(path, encoding="utf-8") as f:
        lines = f.read().split("\n")
    fixed = 0
    for i, ln in enumerate(lines):
        if not re.match(r'^\s*P\("', ln):
            continue
        trail = ln.rstrip()
        last_q = trail.rfind('"')
        if last_q == -1:
            continue
        if trail[last_q + 1:] in (');', '))', '));', ';', ''):
            newline = trail[:last_q + 1] + ');'
            if newline != trail:
                fixed += 1
                lines[i] = newline
    with io.open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print("%-22s normalized lines: %d" % (os.path.basename(path), fixed))
