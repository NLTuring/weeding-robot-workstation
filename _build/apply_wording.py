# -*- coding: utf-8 -*-
"""应用 wording_fixes.py 中的替代表，并校验每个替代都命中。"""
import io, os, sys
from wording_fixes import REPL

HERE = os.path.dirname(os.path.abspath(__file__))
ok = True

for fname, pairs in REPL.items():
    path = os.path.join(HERE, fname)
    with io.open(path, encoding="utf-8") as f:
        src = f.read()
    for old, new in pairs:
        n = src.count(old)
        if n == 0:
            print("  MISS [%s] %s" % (fname, old[:40]))
            ok = False
            continue
        src = src.replace(old, new)
    with io.open(path, "w", encoding="utf-8") as f:
        f.write(src)
    print("%-20s applied %d rules" % (fname, len(pairs)))

sys.exit(0 if ok else 1)
