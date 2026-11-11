#!/usr/bin/env python3
"""야후 차트(비공식)에서 일봉을 받아 data/px/<심볼>.json 으로 저장한다. 표준 라이브러리만 사용.
- 기존 파일이 있으면 최근 1개월만 받아 병합(실패해도 기존 값 유지), 없으면 전체 이력(period1=0).
- 403/429/봇 차단을 만나면 우회하지 않고 즉시 중단한다. 이전 데이터는 유지하고 manifest 에 상태를 남긴다.
"""
import json, os, sys, time, urllib.parse, urllib.request, urllib.error, datetime as dt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PX = os.path.join(ROOT, "data", "px")
HOSTS = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"]
UA = "puddle-trader/1.0 (personal research; contact via repository)"  # 브라우저로 위장하지 않는다


class Blocked(Exception):
    pass


def fetch(yf, recent):
    q = "range=1mo&interval=1d" if recent else "period1=0&period2=%d&interval=1d" % int(time.time())
    err = None
    for h in HOSTS:
        url = "https://%s/v8/finance/chart/%s?%s" % (h, urllib.parse.quote(yf), q)
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=20) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code in (401, 403, 418, 429):
                raise Blocked("HTTP %d" % e.code)
            err = e
        except Exception as e:
            err = e
    raise RuntimeError(str(err))


def parse(j):
    r = j["chart"]["result"][0]
    ts, cl = r["timestamp"], r["indicators"]["quote"][0]["close"]
    off = r["meta"].get("gmtoffset", 0)
    rows = {}
    for t, c in zip(ts, cl):
        if c is None:
            continue
        rows[dt.datetime.utcfromtimestamp(t + off).strftime("%Y-%m-%d")] = round(float(c), 4)
    return rows, r["meta"].get("regularMarketTime", 0)


def main():
    os.makedirs(PX, exist_ok=True)
    uni = json.load(open(os.path.join(ROOT, "data", "universe.json"), encoding="utf8"))
    mpath = os.path.join(ROOT, "data", "manifest.json")
    man = json.load(open(mpath, encoding="utf8")) if os.path.exists(mpath) else {}
    demo = man.get("demo", False)  # 데모(합성) 데이터는 병합하지 않고 통째로 교체한다
    man = {"symbols": {} if demo else man.get("symbols", {}), "fails": [], "status": "ok"}
    items = [(s["sym"], s.get("yf", s["sym"])) for s in uni["symbols"] + uni.get("context", [])]
    for sym, yf in items:
        path = os.path.join(PX, sym + ".json")
        old = None
        if os.path.exists(path) and not demo:
            old = json.load(open(path, encoding="utf8"))
        try:
            rows, mt = parse(fetch(yf, recent=old is not None))
        except Blocked as e:
            man["status"] = "blocked: " + str(e)
            man["fails"].append(sym)
            print("접근 제한(%s) — 중단합니다. 이전 데이터는 유지됩니다." % e)
            break  # 우회 금지: 즉시 중단
        except Exception as e:
            man["fails"].append(sym)
            print("실패", sym, e)
            continue
        merged = dict(zip(old["d"], old["c"])) if old else {}
        merged.update(rows)
        d = sorted(merged)
        out = {"s": sym, "d": d, "c": [merged[x] for x in d], "t": int(time.time()), "mt": mt}
        json.dump(out, open(path, "w", encoding="utf8"), separators=(",", ":"))
        man["symbols"][sym] = {"n": len(d), "last": d[-1], "t": out["t"]}
        print("ok", sym, len(d), d[-1])
        time.sleep(0.4)
    man["updated"] = int(time.time())
    json.dump(man, open(mpath, "w", encoding="utf8"), ensure_ascii=False)
    return 0 if man["status"] == "ok" and not man["fails"] else 1


if __name__ == "__main__":
    sys.exit(main())
