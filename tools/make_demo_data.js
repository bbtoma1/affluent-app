// 화면 확인용 합성(가짜) 데이터 생성. 실제 시세가 아니며 manifest.demo=true 로 표시된다.
// 첫 update_data.py 실행 시 자동으로 실제 데이터로 교체된다.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), uni = JSON.parse(fs.readFileSync(path.join(root, 'data/universe.json'), 'utf8'));
let seed = 12345; const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const N = 2600, dates = []; let t = Date.UTC(2015, 0, 5);
while (dates.length < N) { t += 864e5; const w = new Date(t).getUTCDay(); if (w !== 0 && w !== 6) dates.push(new Date(t).toISOString().slice(0, 10)); }
const mk = (vol, drift) => { let p = 100; const c = [], r = []; for (let i = 0; i < N; i++) { const shock = (rnd() - 0.5) * 2 * vol + drift; r.push(shock); p *= 1 + shock; c.push(+p.toFixed(4)); } return { c, r }; };
const base = mk(0.011, 0.0004);
const vix = base.r.map((x, i) => 14 + Math.max(0, -base.r.slice(Math.max(0, i - 15), i + 1).reduce((a, b) => a + b, 0)) * 220);
fs.mkdirSync(path.join(root, 'data/px'), { recursive: true });
const save = (sym, c) => fs.writeFileSync(path.join(root, 'data/px', sym + '.json'), JSON.stringify({ s: sym, d: dates, c, t: Math.floor(Date.now() / 1000), mt: 0 }));
const man = { demo: true, symbols: {}, fails: [], status: 'demo', updated: Math.floor(Date.now() / 1000) };
uni.symbols.forEach((u, k) => { const own = mk(0.007 + 0.002 * (k % 3), 0.0001); const c = base.c.map((x, i) => +(100 * Math.exp(Math.log(x / 100) * (0.7 + 0.1 * (k % 4)) + Math.log(own.c[i] / 100))).toFixed(4)); save(u.sym, c); man.symbols[u.sym] = { n: N, last: dates[N - 1], t: man.updated }; });
save('VIX', vix.map((x) => +x.toFixed(2))); man.symbols.VIX = { n: N, last: dates[N - 1], t: man.updated };
fs.writeFileSync(path.join(root, 'data/manifest.json'), JSON.stringify(man));
console.log('데모 데이터 생성:', Object.keys(man.symbols).length, '개');
