// 사용: node tools/backtest.js  → data/backtest.json
// 모든 종목에 같은 엔진을 적용하고, '아무 날 매수' 기준선과 비교한다. 결과가 나빠도 그대로 기록한다.
const fs = require('fs'), path = require('path');
const E = require('../engine.js');
const root = path.join(__dirname, '..');
const uni = JSON.parse(fs.readFileSync(path.join(root, 'data/universe.json'), 'utf8'));
const load = (f) => { try { return JSON.parse(fs.readFileSync(path.join(root, 'data/px', f + '.json'), 'utf8')); } catch (e) { return null; } };
const vx = load('VIX'); const vixMap = {}; if (vx) vx.d.forEach((d, i) => (vixMap[d] = vx.c[i]));
const manifest = (() => { try { return JSON.parse(fs.readFileSync(path.join(root, 'data/manifest.json'), 'utf8')); } catch (e) { return {}; } })();

const pool = { ev: [], base: [], oosEv: [], oosBase: [], neutralEv: [], neutralBase: [], sim: [] };
const used = [], skipped = [];
for (const u of uni.symbols) {
  const px = load(u.file || u.sym); if (!px || px.c.length < 400) { skipped.push(u.sym); continue; }
  const a = E.analyze(px.d, px.c, vixMap), n = px.c.length, cut = Math.floor(n * 0.7);
  const ev = E.events(a), base = E.baseline(a);
  pool.ev.push(...ev); pool.base.push(...base);
  pool.oosEv.push(...E.events(a, cut)); pool.oosBase.push(...E.baseline(a, cut));
  if (u.neutral) { pool.neutralEv.push(...ev); pool.neutralBase.push(...base); }
  const s = E.simulate(a); if (s) pool.sim.push(Object.assign({ sym: u.sym }, s));
  used.push(u.sym);
}
const S = E.summarize;
const avg = (k, f) => { const v = pool.sim.map((x) => x[k][f]).filter((x) => x !== null); return v.length ? v.reduce((p, q) => p + q, 0) / v.length : null; };
const out = {
  version: E.VERSION, generated: new Date().toISOString(), demo: !!manifest.demo, symbols: used, skipped,
  baseline: S(pool.base), signal: S(pool.ev),
  byTier: [1, 2, 3].map((t) => S(pool.ev.filter((e) => e.tier === t))),
  oos: { signal: S(pool.oosEv), baseline: S(pool.oosBase) },
  neutral: { signal: S(pool.neutralEv), baseline: S(pool.neutralBase) },
  sim: { n: pool.sim.length, strategy: { cagr: avg('strategy', 'cagr'), mdd: avg('strategy', 'mdd'), calmar: avg('strategy', 'calmar') },
    hold: { cagr: avg('hold', 'cagr'), mdd: avg('hold', 'mdd'), calmar: avg('hold', 'calmar') },
    half: { cagr: avg('half', 'cagr'), mdd: avg('half', 'mdd'), calmar: avg('half', 'calmar') } },
};
fs.writeFileSync(path.join(root, 'data/backtest.json'), JSON.stringify(out));
const f = (x) => (x == null ? '-' : (x * 100).toFixed(1) + '%');
console.log('종목', used.length, '| 건너뜀', skipped.join(',') || '-', '| 신호 건수', pool.ev.length);
console.log('60일 상승확률  신호', f(out.signal[60] && out.signal[60].up), ' 기준선', f(out.baseline[60] && out.baseline[60].up));
console.log('표본 외        신호', f(out.oos.signal[60] && out.oos.signal[60].up), ' 기준선', f(out.oos.baseline[60] && out.oos.baseline[60].up));
console.log('시뮬 CAGR 전략', f(out.sim.strategy.cagr), ' 보유', f(out.sim.hold.cagr), ' 50%방치', f(out.sim.half.cagr));
