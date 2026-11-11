(function () {
  'use strict';
  const E = Engine, $ = (s) => document.querySelector(s), view = $('#view');
  const S = { uni: null, man: null, data: {}, an: {}, tab: 'today', sel: null, bt: null };
  const pct = (x, d = 1) => (x == null ? '-' : (x * 100).toFixed(d) + '%');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const J = (u) => fetch(u, { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error(u); return r.json(); });
  const store = { get: (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };

  async function load() {
    S.uni = await J('data/universe.json');
    try { S.man = await J('data/manifest.json'); } catch (e) { S.man = null; }
    try { S.bt = await J('data/backtest.json'); } catch (e) { S.bt = null; }
    let vixMap = null;
    try { const v = await J('data/px/VIX.json'); vixMap = {}; v.d.forEach((d, i) => (vixMap[d] = v.c[i])); } catch (e) {}
    await Promise.all(S.uni.symbols.map(async (u) => {
      try { const p = await J('data/px/' + u.sym + '.json'); S.data[u.sym] = p; S.an[u.sym] = E.analyze(p.d, p.c, vixMap); } catch (e) {}
    }));
    if (!S.sel) S.sel = (S.uni.symbols.find((u) => S.an[u.sym]) || {}).sym;
  }

  function chip() {
    const c = $('#chip'); $('#demo').hidden = !(S.man && S.man.demo);
    if (!S.man) { c.textContent = '데이터 없음'; c.className = 'chip old'; return; }
    const last = Object.values(S.man.symbols || {}).map((x) => x.last).sort().pop();
    const age = last ? (Date.now() - Date.parse(last + 'T00:00:00Z')) / 864e5 : 99;
    const st = String(S.man.status || '');
    let cls = 'ok', tx = '정상';
    if (st.startsWith('blocked')) { cls = 'late'; tx = '수집 제한·이전 데이터'; }
    else if (age > 6) { cls = 'old'; tx = '오래됨'; } else if (age > 3.5) { cls = 'late'; tx = '지연'; }
    c.className = 'chip ' + cls; c.textContent = (S.man.demo ? '데모 · ' : '') + tx + (last ? ' · ' + last.slice(5) : '');
  }

  const last = (a) => a.c.length - 1;
  const tierLabel = (a, i) => (a.halt[i] ? '과열: 신규 매수 중단' : a.tier[i] ? a.tier[i] + '차' : '신호 없음');
  const tierCls = (a, i) => (a.halt[i] ? 'halt' : a.tier[i] ? 't' + a.tier[i] : '');
  function gauge(score, th) { return `<div class="gauge" role="img" aria-label="점수 ${Math.round(score)}"><i style="width:${Math.max(2, Math.min(100, score))}%"></i>${th.map((t) => `<b style="left:${t}%"></b>`).join('')}</div>`; }

  function today() {
    const th = E.LENS.tiers, rows = S.uni.symbols.filter((u) => S.an[u.sym]).map((u) => { const a = S.an[u.sym], i = last(a); return { u, a, i, sc: a.score[i] }; }).filter((r) => r.sc !== null).sort((x, y) => y.sc - x.sc);
    if (!rows.length) return '<p class="note">표시할 데이터가 없습니다. 설정의 시세 수집(GitHub Actions)을 먼저 실행하세요.</p>';
    const act = rows.filter((r) => r.a.tier[r.i] > 0 && !r.a.halt[r.i]), top = rows[0];
    const vix = top.a.vix[top.i];
    const hero = `<section class="hero"><div class="note">오늘 규칙상 매수 구간에 든 종목</div>
      <div class="big">${act.length}개 <span class="note">/ ${rows.length}</span></div>
      ${gauge(top.sc, th)}<div class="ticks">${th.map((t, k) => `<span style="left:${t}%">${k + 1}차 ${t}</span>`).join('')}</div>
      <p class="note">가장 깊은 곳: ${esc(top.u.name)} ${Math.round(top.sc)}점 · ${tierLabel(top.a, top.i)}${vix != null ? ' · VIX ' + vix.toFixed(1) : ''}</p></section>`;
    return hero + '<div class="rows">' + rows.map((r) => `<button class="row" data-sym="${r.u.sym}"><span class="nm">${esc(r.u.name)} <span class="sub">${r.u.sym}</span></span><span class="badge ${tierCls(r.a, r.i)}">${tierLabel(r.a, r.i)}</span>${gauge(r.sc, th)}<span class="sub">${Math.round(r.sc)}점 · 낙폭 ${pct(-(1 - r.a.c[r.i] / r.a.hi[r.i]))}</span><span class="sub">${r.a.dates[r.i]}</span></button>`).join('') + '</div>' + foot();
  }

  function chart(a) {
    const n = Math.min(520, a.c.length), s = a.c.length - n, W = 360, H = 190, P = 6;
    const ys = a.c.slice(s).concat(a.ma200.slice(s).filter((x) => x !== null)); const lo = Math.min(...ys), hi = Math.max(...ys);
    const X = (k) => P + (k * (W - 2 * P)) / (n - 1), Y = (v) => H - P - ((v - lo) / (hi - lo || 1)) * (H - 2 * P);
    const path = (arr) => arr.slice(s).map((v, k) => (v === null ? '' : (k && arr[s + k - 1] !== null ? 'L' : 'M') + X(k).toFixed(1) + ' ' + Y(v).toFixed(1))).join('');
    const ev = E.events(a, s).map((e) => `<circle cx="${X(e.i - s).toFixed(1)}" cy="${Y(a.c[e.i]).toFixed(1)}" r="${3 + e.tier}" fill="${['', 'var(--water)', 'var(--amber)', 'var(--alert)'][e.tier]}" opacity=".85"><title>${e.date} ${e.tier}차</title></circle>`).join('');
    return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="가격과 200일선, 과거 신호"><path d="${path(a.ma200)}" fill="none" stroke="var(--mute)" stroke-width="1" stroke-dasharray="3 3"/><path d="${path(a.c)}" fill="none" stroke="var(--ink)" stroke-width="1.5"/>${ev}</svg>
    <div class="scale"><span>${a.dates[s]}</span><span>${a.dates[a.c.length - 1]}</span></div></div><p class="note">큰 점 = 과거 신호(1·2·3차 최초일), 점선 = 200일선</p>`;
  }

  function stock() {
    const syms = S.uni.symbols.filter((u) => S.an[u.sym]);
    const a = S.an[S.sel]; if (!a) return '<p class="note">데이터가 없습니다.</p>';
    const i = last(a), u = S.uni.symbols.find((x) => x.sym === S.sel), ex = E.explain(a, i), sc = a.score[i];
    const chips = '<div class="chips" role="group" aria-label="종목">' + syms.map((x) => `<button data-pick="${x.sym}" aria-pressed="${x.sym === S.sel}">${esc(x.name)}</button>`).join('') + '</div>';
    const list = '<ul class="list">' + ex.map((e) => `<li><span>${esc(e.label)}</span><b>${esc(e.value)}</b><div class="meter"><i style="width:${e.strength * 100}%"></i></div></li>`).join('') + '</ul>';
    const hist = E.events(a).slice(-6).reverse().map((e) => `<tr><td>${e.date}</td><td>${e.tier}차</td><td>${pct(e.f[60])}</td><td>${pct(e.f.mae)}</td></tr>`).join('');
    return chips + `<h2>${esc(u.name)} · ${sc == null ? '-' : Math.round(sc) + '점'} · ${tierLabel(a, i)}</h2>` + chart(a) +
      '<h2>신호 체크리스트</h2>' + list +
      '<h2>이 종목의 최근 신호와 이후 60일</h2><div class="scroll"><table><tr><th>신호일</th><th>차수</th><th>60일 수익</th><th>60일 내 최대낙폭</th></tr>' + (hist || '<tr><td colspan="4">신호 이력 없음</td></tr>') + '</table></div><p class="note">수익은 신호 다음 거래일 종가 체결 가정입니다. 아직 60일이 지나지 않은 신호는 비어 있습니다.</p>' + foot();
  }

  function check() {
    const b = S.bt; if (!b) return '<p class="note">검증 결과가 없습니다. <code>node tools/backtest.js</code> 를 실행하세요.</p>';
    const row = (n, x, y) => `<tr><td>${n}</td><td>${x ? x.n : '-'}</td><td>${pct(x && x[60] && x[60].up)}</td><td>${pct(y && y[60] && y[60].up)}</td><td>${pct(x && x[120] && x[120].up)}</td><td>${pct(y && y[120] && y[120].up)}</td></tr>`;
    const sim = b.sim;
    return (b.demo ? '<div class="banner">아래는 합성 데이터 결과라 의미가 없습니다.</div>' : '') +
      `<h2>신호 vs 아무 날 매수</h2><p class="note">신호 후 상승 확률입니다. 기준선보다 확실히 높아야 의미가 있고, 120일 이후까지 이어지는지도 봅니다.</p><div class="scroll"><table><tr><th>구분</th><th>건수</th><th>60일 신호</th><th>60일 기준</th><th>120일 신호</th><th>120일 기준</th></tr>` +
      row('전체', b.signal, b.baseline) + b.byTier.map((t, k) => row((k + 1) + '차', t, b.baseline)).join('') + row('표본 외(뒤 30%)', b.oos.signal, b.oos.baseline) + row('지수·섹터 ETF만', b.neutral.signal, b.neutral.baseline) + '</table></div>' +
      `<h2>매매 시뮬레이션 (${sim.n}종목 평균)</h2><div class="scroll"><table><tr><th>전략</th><th>연수익률</th><th>최대낙폭</th><th>칼마</th></tr>` +
      [['신호 매수(초기 50%+추가)', sim.strategy], ['단순 보유', sim.hold], ['50% 방치', sim.half]].map(([n, m]) => `<tr><td>${n}</td><td>${pct(m.cagr)}</td><td>${pct(m.mdd)}</td><td>${m.calmar == null ? '-' : m.calmar.toFixed(2)}</td></tr>`).join('') + '</table></div>' +
      `<p class="note">엔진 v${b.version} · ${esc(b.generated.slice(0, 10))} 생성 · 종목 ${b.symbols.length}개${b.skipped.length ? ' · 이력 부족 제외: ' + esc(b.skipped.join(', ')) : ''}. 과거 검증은 미래를 보장하지 않으며, 결과가 기준선과 비슷하면 그렇다고 읽어야 합니다.</p>` + foot();
  }

  function acct() {
    const v = store.get('acct', { cash: '', min: '' });
    return `<h2>내 계좌</h2><p class="note">입력값은 이 기기 안에만 저장되고 서버로 전송되지 않습니다.</p>
      <label for="cash">현금</label><input id="cash" inputmode="decimal" value="${esc(v.cash)}" placeholder="예: 10000">
      <label for="min">최소 유지 현금</label><input id="min" inputmode="decimal" value="${esc(v.min)}" placeholder="예: 2000">
      <div class="result" id="res"></div>` + foot();
  }
  function calcAcct() {
    const cash = parseFloat($('#cash').value) || 0, min = parseFloat($('#min').value) || 0; store.set('acct', { cash: $('#cash').value, min: $('#min').value });
    const act = S.uni.symbols.filter((u) => S.an[u.sym]).map((u) => { const a = S.an[u.sym], i = last(a); return { u, t: a.halt[i] ? 0 : a.tier[i] }; }).filter((r) => r.t > 0);
    const av = Math.max(0, cash - min);
    $('#res').innerHTML = `가용 현금 <b>${av.toLocaleString()}</b><br>` + (act.length ? act.map((r) => `${esc(r.u.name)}: ${r.t}차 구간 → 규칙상 배분 ${E.sizing(cash, min, r.t).amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`).join('<br>') : '규칙상 매수 구간에 든 종목이 없습니다.') +
      '<p class="note">종목별 금액은 각각 가용 현금 기준이라 합치면 현금을 넘을 수 있습니다. 한 번에 쓰지 말고 비중 한도를 따로 두세요.</p>';
  }
  const foot = () => '<p class="foot">이 앱은 규칙 기반 참고 정보이며 투자 권유나 수익 보장이 아닙니다. 투자 판단과 책임은 본인에게 있습니다.</p>';

  function render() {
    view.innerHTML = { today, stock, check, acct }[S.tab]();
    document.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-current', b.dataset.tab === S.tab ? 'page' : 'false'));
    if (S.tab === 'acct') { calcAcct(); view.querySelectorAll('input').forEach((i) => i.addEventListener('input', calcAcct)); }
  }
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab],[data-sym],[data-pick]'); if (!t) return;
    if (t.dataset.tab) S.tab = t.dataset.tab; if (t.dataset.sym) { S.sel = t.dataset.sym; S.tab = 'stock'; } if (t.dataset.pick) S.sel = t.dataset.pick;
    render(); window.scrollTo(0, 0);
  });
  async function refresh() { $('#chip').textContent = '갱신 중'; try { await load(); } catch (e) {} chip(); if (document.activeElement.tagName !== 'INPUT') render(); }
  $('#refresh').addEventListener('click', refresh);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  setInterval(() => { if (!document.hidden) refresh(); }, 10 * 60 * 1000);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  refresh();
})();
