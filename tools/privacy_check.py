#!/usr/bin/env python3
"""배포 전 점검: 이메일·키 형태·로컬 경로·비밀 파일이 있으면 실패(종료코드 1)."""
import os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP_DIR = {".git", "node_modules", ".wrangler", "px"}
PAT = {
    "이메일": re.compile(r"[A-Za-z0-9._%+-]+@(?!users\.noreply\.github\.com)[A-Za-z0-9.-]+\.[A-Za-z]{2,}"),
    "키 형태": re.compile(r"(sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|api[_-]?key\s*[:=]\s*['\"][^'\"]{12,})", re.I),
    "로컬 경로": re.compile(r"(C:\\Users\\|/Users/[A-Za-z]|/home/[a-z])"),
}
SECRET_FILES = {".env", "config.json"}
bad = []
for d, ds, fs in os.walk(ROOT):
    ds[:] = [x for x in ds if x not in SKIP_DIR]
    for f in fs:
        p = os.path.join(d, f)
        if f in SECRET_FILES or f.endswith(".db"):
            bad.append((p, "비밀 파일"))
            continue
        if f == "privacy_check.py" or not f.endswith((".js", ".py", ".html", ".css", ".json", ".md", ".yml", ".webmanifest", ".svg")):
            continue
        t = open(p, encoding="utf8", errors="replace").read()
        for k, r in PAT.items():
            m = r.search(t)
            if m:
                bad.append((p, k + ": " + m.group(0)[:30]))
for p, why in bad:
    print("발견:", os.path.relpath(p, ROOT), why)
print("개인정보 점검", "실패" if bad else "통과")
sys.exit(1 if bad else 0)
