/* 웅덩이 트레이더 엔진 — 브라우저와 Node에서 같은 코드로 동작 (라이브 = 백테스트)
 * 규칙: i번째 값은 i번째 날까지의 데이터만 사용한다(룩어헤드 금지). 검증은 tools/test_engine.js 가 확인한다.
 * 유튜브 채널 규칙은 아래 LENS 의 가중치·임계값만 바꿔서 반영한다. */
(function (root) {
  'use strict';
  const E = { VERSION: 1 };

  // ── 설정: 채널 규칙은 여기만 수정 ─────────────────────────────
  E.LENS = {
    name: '기본(기술적 지표)',
    weights: { drawdown: 20, ma200: 12, wrsi: 16, rsi: 8, macd: 8, vix: 16 }, // 신호별 만점 가중치
    tiers: [40, 55, 70],          // 1·2·3차 점수 임계값 (검증 화면으로 조정)
    overheatWeeklyRsi: 70,        // 주봉 RSI가 이 값 이상이면 신규 매수 중단
    tierUse: [0.2, 0.3, 0.5],     // 차수별 사용 비율(현금 중)
  };

  // ── 지표 ─────────────────────────────────────────────────────
  function sma(a, n) {
    const o = new Array(a.length).fill(null); let s = 0;
    for (let i = 0; i < a.length; i++) { s += a[i]; if (i >= n) s -= a[i - n]; if (i >= n - 1) o[i] = s / n; }
    return o;
  }
  function ema(a, n) {
    const o = new Array(a.length).fill(null), k = 2 / (n + 1); let p = null;
    for (let i = 0; i < a.length; i++) { p = p === null ? a[i] : a[i] * k + p * (1 - k); o[i] = p; }
    return o;
  }
  function rsiWilder(c, n) {
    const o = new Array(c.length).fill(null); let ag = 0, al = 0;
    for (let i = 1; i < c.length; i++) {
      const ch = c[i] - c[i - 1], g = Math.max(ch, 0), l = Math.max(-ch, 0);
      if (i <= n) { ag += g; al += l; if (i === n) { ag /= n; al /= n; o[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al); } }
      else { ag = (ag * (n - 1) + g) / n; al = (al * (n - 1) + l) / n; o[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al); }
    }
    return o;
  }
  function macd(c) {
    const f = ema(c, 12), s = ema(c, 26), m = c.map((_, i) => f[i] - s[i]), sig = ema(m, 9);
    return { m, sig };
  }
  function weekKey(d) { // 월요일 시작 주 번호
    const t = Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 864e5;
    return Math.floor((t + 3) / 7);
  }
  // 주봉 RSI: 완료된 주는 확정 종가, 진행 중인 주는 '그 날 종가'로만 계산(미래 값 사용 안 함)
  function weeklyRsi(dates, c) {
    const out = new Array(c.length).fill(null);
    let lastWk = null, lastClose = null, prev = null, ag = null, al = null, cnt = 0, sg = 0, sl = 0;
    const fin = (x) => {
      if (prev !== null) {
        const ch = x - prev, g = Math.max(ch, 0), l = Math.max(-ch, 0);
        if (ag === null) { sg += g; sl += l; cnt++; if (cnt === 14) { ag = sg / 14; al = sl / 14; } }
        else { ag = (ag * 13 + g) / 14; al = (al * 13 + l) / 14; }
      }
      prev = x;
    };
    for (let i = 0; i < c.length; i++) {
      const wk = weekKey(dates[i]);
      if (lastWk !== null && wk !== lastWk) fin(lastClose);
      lastWk = wk; lastClose = c[i];
      if (prev === null) continue;
      const ch = c[i] - prev, g = Math.max(ch, 0), l = Math.max(-ch, 0);
      let a, b;
      if (ag === null) { if (cnt + 1 < 14) continue; a = (sg + g) / 14; b = (sl + l) / 14; }
      else { a = (ag * 13 + g) / 14; b = (al * 13 + l) / 14; }
      out[i] = b === 0 ? 100 : 100 - 100 / (1 + a / b);
    }
    return out;
  }

  // ── 신호 강도(0~1) ───────────────────────────────────────────
  const step = (v, rules) => { for (const [th, s] of rules) if (v >= th) return s; return 0; };

  // 분석: dates[i], c[i] 는 오름차순 일봉. vixMap = {날짜: VIX 종가} (선택)
  E.analyze = function (dates, c, vixMap, lens) {
    lens = lens || E.LENS;
    const n = c.length, W = lens.weights;
    const ma200 = sma(c, 200), rsi = rsiWilder(c, 14), wr = weeklyRsi(dates, c), mc = macd(c);
    const hi = new Array(n).fill(null); // 52주(252일) 롤링 최고가
    for (let i = 0; i < n; i++) { let m = -Infinity; for (let j = Math.max(0, i - 251); j <= i; j++) if (c[j] > m) m = c[j]; hi[i] = m; }
    let lastVix = null; const vix = new Array(n).fill(null);
    if (vixMap) for (let i = 0; i < n; i++) { if (vixMap[dates[i]] != null) lastVix = vixMap[dates[i]]; vix[i] = lastVix; }
    const cross = new Array(n).fill(-999); // 가장 최근 MACD 골든크로스 인덱스
    for (let i = 1; i < n; i++) {
      const up = mc.m[i] > mc.sig[i] && mc.m[i - 1] <= mc.sig[i - 1];
      cross[i] = up ? i : cross[i - 1];
    }
    const score = new Array(n).fill(null), tier = new Array(n).fill(0), halt = new Array(n).fill(false);

    function parts(i) {
      const p = {};
      if (ma200[i] === null || wr[i] === null) return null; // 지표 준비 전
      const dd = 1 - c[i] / hi[i];
      p.drawdown = { v: -dd, s: step(dd, [[.30, 1], [.20, .8], [.10, .48]]) };
      const gap = c[i] / ma200[i] - 1;
      p.ma200 = { v: gap, s: step(-gap, [[.15, 1], [.10, .75], [.05, .45]]) };
      p.wrsi = { v: wr[i], s: step(-wr[i], [[-30, 1], [-35, .8], [-45, .45]]) };
      p.rsi = { v: rsi[i], s: step(-rsi[i], [[-25, 1], [-30, .75], [-40, .4]]) };
      p.macd = { v: i - cross[i], s: (i - cross[i] <= 10 && mc.m[i] < 0) ? 1 : 0 };
      if (vix[i] !== null) p.vix = { v: vix[i], s: step(vix[i], [[40, 1], [30, .8], [25, .5]]) };
      return p;
    }
    E._parts = parts;
    for (let i = 0; i < n; i++) {
      const p = parts(i); if (!p) continue;
      let got = 0, tot = 0;
      for (const k in W) if (p[k]) { got += W[k] * p[k].s; tot += W[k]; } // 가용 신호 기준 정규화
      score[i] = tot ? 100 * got / tot : null;
      halt[i] = wr[i] >= lens.overheatWeeklyRsi;
      let t = 0; for (let k = 0; k < lens.tiers.length; k++) if (score[i] >= lens.tiers[k]) t = k + 1;
      tier[i] = halt[i] ? 0 : t;
    }
    return { dates, c, score, tier, halt, ma200, rsi, wr, vix, hi, parts, lens };
  };

  E.explain = function (a, i) { // 신호 체크리스트(근거 수치 포함)
    const p = a.parts(i); if (!p) return [];
    const L = {
      drawdown: ['52주 고점 대비 낙폭', (v) => (v * 100).toFixed(1) + '%'],
      ma200: ['200일선 이격', (v) => (v * 100).toFixed(1) + '%'],
      wrsi: ['주봉 RSI', (v) => v.toFixed(1)],
      rsi: ['일봉 RSI', (v) => v.toFixed(1)],
      macd: ['MACD 골든크로스(10일 내, 0선 아래)', (v) => (v <= 10 ? v + '일 전' : '없음')],
      vix: ['VIX', (v) => v.toFixed(1)],
    };
    return Object.keys(a.lens.weights).filter((k) => p[k]).map((k) => ({
      key: k, label: L[k][0], value: L[k][1](p[k].v), strength: p[k].s, weight: a.lens.weights[k],
    }));
  };

  // ── 이벤트 연구 ──────────────────────────────────────────────
  const H = [20, 60, 120, 250];
  // 신호일 다음 거래일 종가로 체결한다고 가정
  function fwd(c, i) {
    const e = i + 1; if (e >= c.length) return null;
    const r = {};
    H.forEach((h) => { r[h] = e + h < c.length ? c[e + h] / c[e] - 1 : null; });
    let mae = 0, ok = e + 60 < c.length;
    for (let j = e + 1; j <= Math.min(c.length - 1, e + 60); j++) mae = Math.min(mae, c[j] / c[e] - 1);
    r.mae = ok ? mae : null;
    return r;
  }
  // 웅덩이(연속 신호 구간)마다 차수별 최초 신호일 1회
  E.events = function (a, from, to) {
    const ev = []; let inP = false, got = 0, quiet = 0;
    for (let i = Math.max(0, from || 0); i < Math.min(a.c.length, to || a.c.length); i++) {
      if (a.score[i] === null) continue;
      const t = a.tier[i];
      if (!inP && t > 0) { inP = true; got = 0; quiet = 0; }
      if (inP) {
        if (t === 0) { if (++quiet >= 20) inP = false; } else quiet = 0;
        while (inP && got < t) { got++; const f = fwd(a.c, i); if (f) ev.push({ i, date: a.dates[i], tier: got, f }); }
      }
    }
    return ev;
  };
  E.baseline = function (a, from, to) {
    const out = [];
    for (let i = Math.max(0, from || 0); i < Math.min(a.c.length, to || a.c.length); i++) {
      if (a.score[i] === null) continue; const f = fwd(a.c, i); if (f) out.push({ f });
    }
    return out;
  };
  E.summarize = function (rows) {
    const s = { n: rows.length };
    H.concat(['mae']).forEach((h) => {
      const v = rows.map((r) => r.f[h]).filter((x) => x !== null && x !== undefined);
      s[h] = v.length ? { n: v.length, up: h === 'mae' ? null : v.filter((x) => x > 0).length / v.length, mean: v.reduce((x, y) => x + y, 0) / v.length } : null;
    });
    return s;
  };

  // ── 매매 시뮬레이션 ──────────────────────────────────────────
  // 초기 50% 보유 + 신호 차수별 추가 매수(다음 거래일 종가). 단순 보유·50% 방치와 비교.
  E.simulate = function (a, from, to) {
    const c = a.c; from = Math.max(from || 0, a.score.findIndex((x) => x !== null)); to = Math.min(to || c.length, c.length);
    if (from < 0 || to - from < 260) return null;
    const lens = a.lens, start = from + 1;
    const ev = E.events(a, from, to), buyAt = {};
    ev.forEach((e) => { const j = e.i + 1; if (j < to) buyAt[j] = (buyAt[j] || 0) + lens.tierUse[e.tier - 1]; });
    let cash = 0.5, sh = 0.5 / c[start], cashB = 0.5, shB = 0.5 / c[start];
    const eq = [], eqHold = [], eqHalf = []; let cashLeft = 0.5;
    for (let i = start; i < to; i++) {
      if (buyAt[i] && cashLeft > 0) { const use = Math.min(cashLeft, 0.5 * buyAt[i]); cashLeft -= use; cash -= use; sh += use / c[i]; }
      eq.push(cash + sh * c[i]); eqHold.push(c[i] / c[start]); eqHalf.push(cashB + shB * c[i]);
    }
    const yrs = (eq.length) / 252;
    const m = (e) => {
      let pk = -Infinity, mdd = 0; e.forEach((x) => { pk = Math.max(pk, x); mdd = Math.min(mdd, x / pk - 1); });
      const cagr = Math.pow(e[e.length - 1] / e[0], 1 / yrs) - 1; return { cagr, mdd, calmar: mdd < 0 ? cagr / -mdd : null };
    };
    return { strategy: m(eq), hold: m(eqHold), half: m(eqHalf), buys: ev.length, years: yrs };
  };

  // 추천 금액: 가용 현금(최소 유지 현금 제외) × 차수별 사용 비율
  E.sizing = function (cash, minCash, tier, lens) {
    lens = lens || E.LENS; const avail = Math.max(0, cash - minCash);
    return tier > 0 ? { avail, amount: avail * lens.tierUse[tier - 1] } : { avail, amount: 0 };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = E; else root.Engine = E;
})(typeof self !== 'undefined' ? self : this);
