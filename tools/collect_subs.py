#!/usr/bin/env python3
"""유튜브 채널의 한국어 자동 자막을 받아 txt 로 저장한다. (사용자 PC에서 직접 실행)
사용: pip install yt-dlp ; python tools/collect_subs.py <채널주소> <저장폴더>
- 이어받기: 이미 받은 영상은 건너뛴다(archive 파일).
- 요청 제한(429 등)이 감지되면 5분 대기 후 자동 재개한다. 쿠키·프록시 등 우회는 하지 않는다.
- 저장 폴더는 OneDrive 같은 동기화 폴더 밖을 권장한다.
"""
import glob, os, re, subprocess, sys, time

WAIT = 300


def vtt_to_txt(path):
    out, prev = [], ""
    for line in open(path, encoding="utf8", errors="replace"):
        line = line.strip()
        if not line or line.startswith(("WEBVTT", "Kind:", "Language:")) or "-->" in line or line.isdigit():
            continue
        line = re.sub(r"<[^>]+>", "", line)
        if line and line != prev:
            out.append(line)
            prev = line
    return " ".join(out)


def run(url, out):
    cmd = ["yt-dlp", "--skip-download", "--write-auto-subs", "--sub-langs", "ko", "--sub-format", "vtt",
           "--write-info-json", "--download-archive", os.path.join(out, "archive.txt"),
           "--ignore-errors", "--sleep-requests", "1", "-o", os.path.join(out, "%(id)s.%(ext)s"), url]
    p = subprocess.run(cmd, capture_output=True, text=True, encoding="utf8", errors="replace")
    text = (p.stdout or "") + (p.stderr or "")
    limited = bool(re.search(r"HTTP Error 429|Too Many Requests|rate.?limit", text, re.I))
    return p.returncode, limited


def convert(out):
    n = 0
    for v in glob.glob(os.path.join(out, "*.ko.vtt")):
        t = os.path.join(out, os.path.basename(v)[:-7] + ".txt")
        if not os.path.exists(t):
            open(t, "w", encoding="utf8").write(vtt_to_txt(v))
            n += 1
    return n


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        return 2
    url, out = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)
    for attempt in range(1, 30):
        rc, limited = run(url, out)
        print("시도 %d: 종료코드 %s, txt 누적 %d" % (attempt, rc, convert(out) or len(glob.glob(os.path.join(out, "*.txt")))))
        if not limited:
            break
        print("요청 제한 감지 — %d분 대기 후 이어받습니다." % (WAIT // 60))
        time.sleep(WAIT)
    print("완료. 영상 메타 %d개 / 자막 txt %d개" % (len(glob.glob(os.path.join(out, "*.info.json"))), len(glob.glob(os.path.join(out, "*.txt")))))
    return 0


if __name__ == "__main__":
    sys.exit(main())
