// 사용: node tools/test_engine.js — 룩어헤드 금지와 기본 동작을 합성 데이터로 점검한다.
const E = require('../engine.js');
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
function synth(n, seed) {
  let x = seed, p = 100; const d = [], c = []; let t = Date.UTC(2010, 0, 4);
  const r = () => ((x = (x * 1664525 + 1013904223) % 4294967296) / 4294967296);
  for (let i = 0; i < n; i++) { do { t += 864e5; } while ([0, 6].includes(new Date(t).getUTCDay())); p *= 1 + (r() - 0.48) * 0.03; d.push(new Date(t).toISOString().slice(0, 10)); c.push(p); }
  return { d, c };
}
const { d, c } = synth(1500, 7), vix = {}; d.forEach((x, i) => (vix[x] = 15 + 10 * Math.abs(Math.sin(i / 40))));
const full = E.analyze(d, c, vix);
let same = true;
for (const k of [400, 700, 1100, 1400]) {
  const part = E.analyze(d.slice(0, k + 1), c.slice(0, k + 1), vix);
  if (Math.abs((part.score[k] ?? -1) - (full.score[k] ?? -1)) > 1e-9 || part.tier[k] !== full.tier[k]) same = false;
}
ok(same, '룩어헤드 없음: 미래를 잘라도 같은 날 점수·차수 동일');
const sc = full.score.filter((x) => x !== null);
ok(sc.length > 1000 && sc.every((x) => x >= 0 && x <= 100), '점수가 0~100 범위');
const ev = E.events(full); ok(ev.length > 0 && ev.every((e) => e.tier >= 1 && e.tier <= 3), '이벤트 생성: ' + ev.length + '건');
const t1 = ev.filter((e) => e.tier === 1).length, t2 = ev.filter((e) => e.tier === 2).length;
ok(t1 >= t2, '차수 단조성: 1차 ≥ 2차 건수 (' + t1 + ' ≥ ' + t2 + ')');
const sim = E.simulate(full); ok(sim && isFinite(sim.strategy.cagr), '시뮬레이션 실행');
const s = E.sizing(1000, 200, 2); ok(Math.abs(s.amount - 240) < 1e-9, '추천 금액: (1000-200)×0.3=240');
const dd = c.map((x, i) => (i < 600 ? 100 + i * 0.1 : 160 * Math.pow(0.996, i - 600)));
const a2 = E.analyze(d.slice(0, 900), dd.slice(0, 900));
ok(a2.score[899] > a2.score[620], '급락 후 점수 상승(낙폭 신호 작동)');
process.exit(fail ? 1 : 0);
