(() => {
  const fallbackStocks = [
    { id: '2330', name: '台積電' }, { id: '2317', name: '鴻海' },
    { id: '2454', name: '聯發科' }, { id: '2308', name: '台達電' },
    { id: '2382', name: '廣達' }, { id: '2881', name: '富邦金' }
  ];
  const prices = { '2330': 1485, '2317': 224.5, '2454': 1410, '2308': 1165, '2382': 298, '2881': 92.6 };
  const changeRates = { '2330': 1.02, '2317': 1.81, '2454': -0.7, '2308': 0.86, '2382': 2.23, '2881': -0.43 };
  const news = [
    { ticker: '2330', company: '台積電', sentiment: '看漲', impact: '高影響', time: '09:42', title: '【示範新聞】先進製程需求維持穩健，市場關注產能布局', summary: '此為介面示意文字，並非真實新聞。示範情緒分類：正向；練習檢視需求、供給與資本支出的關聯。' },
    { ticker: '2317', company: '鴻海', sentiment: '中性', impact: '中影響', time: '09:18', title: '【示範新聞】電子代工產業進入新一季觀察期', summary: '此為介面示意文字，並非真實新聞。資訊需搭配公司公告、財報與產業資料交叉確認。' },
    { ticker: '2454', company: '聯發科', sentiment: '看跌', impact: '中影響', time: '08:55', title: '【示範新聞】市場評估消費性電子需求變化', summary: '此為介面示意文字，並非真實新聞。示範分類提醒使用者留意需求變動與營運展望的不確定性。' },
    { ticker: '2308', company: '台達電', sentiment: '看漲', impact: '高影響', time: '昨日 16:20', title: '【示範新聞】資料中心電力解決方案受市場關注', summary: '此為介面示意文字，並非真實新聞。分析時應回查原始來源及實際營收占比。' },
    { ticker: '2382', company: '廣達', sentiment: '中性', impact: '低影響', time: '昨日 15:46', title: '【示範新聞】法人觀察伺服器供應鏈後續展望', summary: '此為介面示意文字，並非真實新聞。單一觀點不應視為已確認的營運事實。' },
    { ticker: '2881', company: '富邦金', sentiment: '看跌', impact: '低影響', time: '昨日 14:33', title: '【示範新聞】利率環境變化引發金融股評價討論', summary: '此為介面示意文字，並非真實新聞。利率、匯率和市場價格均可能影響金融業表現。' }
  ];
  let stocks = fallbackStocks;
  let currentPeriod = '3M';
  let selectedFilter = 'all';

  const number = (value, digits = 2) => Number(value).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const hash = (value) => [...String(value)].reduce((sum, char) => ((sum * 31) + char.charCodeAt(0)) >>> 0, 7);
  const seeded = (seed) => {
    let n = seed >>> 0;
    return () => { n = (n * 1664525 + 1013904223) >>> 0; return n / 4294967296; };
  };
  const fallbackPrice = (id) => 45 + (hash(id) % 975) / 3;
  const getPrice = (id) => prices[id] || fallbackPrice(id);
  const getChange = (id) => changeRates[id] ?? ((hash(id) % 900 - 450) / 100);
  const changeClass = (v) => v >= 0 ? 'positive' : 'negative';
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  async function loadStocks() {
    try {
      const response = await fetch('stockidname.csv');
      if (!response.ok) return;
      const csv = await response.text();
      const rows = csv.replace(/^\uFEFF/, '').trim().split(/\r?\n/).slice(1);
      const parsed = rows.map((row) => {
        const comma = row.indexOf(',');
        return comma < 0 ? null : { id: row.slice(0, comma).replaceAll('"', '').trim(), name: row.slice(comma + 1).replaceAll('"', '').trim() };
      }).filter((stock) => stock?.id && stock?.name);
      if (parsed.length) stocks = parsed;
      renderStocks();
    } catch { /* Static fallback keeps the demo usable from a local preview. */ }
  }

  function quoteMarkup(stock) {
    const price = getPrice(stock.id);
    const change = getChange(stock.id);
    const delta = price * change / 100;
    return `<div class="quote-dialog" role="dialog" aria-modal="true" aria-labelledby="quoteTitle">
      <button class="dialog-close" aria-label="關閉">×</button>
      <div class="eyebrow"><span class="eyebrow-line"></span>示範報價</div>
      <h2 id="quoteTitle">${esc(stock.name)} <span class="ticker">${esc(stock.id)}</span></h2>
      <div class="dialog-price">NT$ ${number(price)}</div>
      <div class="dialog-change ${changeClass(change)}">${change >= 0 ? '▲' : '▼'} ${number(Math.abs(delta))} (${change >= 0 ? '+' : ''}${number(change)}%)</div>
      <p>此報價由示範資料產生，沒有連線至市場行情服務。</p>
      <div class="dialog-foot">示範介面 · 僅供學習，請勿作為交易依據</div>
    </div>`;
  }

  function showQuote(stock) {
    const backdrop = document.createElement('div');
    backdrop.className = 'dialog-backdrop';
    backdrop.innerHTML = quoteMarkup(stock);
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop || event.target.closest('.dialog-close')) backdrop.remove();
    });
    document.body.append(backdrop);
    backdrop.querySelector('.dialog-close').focus();
  }

  function renderMovers() {
    const ids = ['2330', '2317', '2454', '2308', '2382'];
    document.querySelector('#moverList').innerHTML = ids.map((id, index) => {
      const stock = stocks.find((item) => item.id === id) || fallbackStocks.find((item) => item.id === id);
      const rate = getChange(id);
      const price = getPrice(id);
      return `<div class="mover-row" data-stock="${id}" role="button" tabindex="0"><span class="rank">0${index + 1}</span><span class="mover-name"><b>${esc(stock.name)}</b><small>${id}</small></span><span class="mover-price">${number(price)}</span><span class="change-pill ${rate < 0 ? 'down' : ''}">${rate > 0 ? '+' : ''}${number(rate)}%</span></div>`;
    }).join('');
    document.querySelectorAll('.mover-row').forEach((row) => {
      const open = () => { const stock = stocks.find((item) => item.id === row.dataset.stock) || fallbackStocks.find((item) => item.id === row.dataset.stock); showQuote(stock); };
      row.addEventListener('click', open);
      row.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } });
    });
  }

  function renderWatchlist() {
    const ids = ['2330', '2317', '2454', '2881'];
    document.querySelector('#watchlist').innerHTML = ids.map((id) => {
      const stock = stocks.find((item) => item.id === id) || fallbackStocks.find((item) => item.id === id);
      const rate = getChange(id);
      return `<div class="watch-item" data-stock="${id}" role="button" tabindex="0"><div><b>${esc(stock.name)}</b><small>${id} · 台灣</small></div><div class="watch-right"><strong>${number(getPrice(id))}</strong><em class="${changeClass(rate)}">${rate > 0 ? '+' : ''}${number(rate)}%</em></div></div>`;
    }).join('');
    document.querySelectorAll('.watch-item').forEach((row) => {
      const open = () => showQuote(stocks.find((item) => item.id === row.dataset.stock) || fallbackStocks.find((item) => item.id === row.dataset.stock));
      row.addEventListener('click', open);
      row.addEventListener('keydown', (event) => { if (event.key === 'Enter') open(); });
    });
  }

  function renderStocks(query = '') {
    const normalized = query.trim().toLocaleLowerCase();
    const list = normalized ? stocks.filter((stock) => stock.name.toLocaleLowerCase().includes(normalized) || stock.id.includes(normalized)).slice(0, 40) : [];
    const results = document.querySelector('#searchResults');
    results.innerHTML = list.length ? list.map((stock) => `<div class="search-result" data-stock="${esc(stock.id)}" role="option"><b>${esc(stock.name)}</b><span>${esc(stock.id)}</span></div>`).join('') : (normalized ? '<div class="empty-state">沒有找到符合的股票</div>' : '');
    results.classList.toggle('show', Boolean(normalized));
    results.querySelectorAll('.search-result').forEach((row) => row.addEventListener('click', () => {
      const stock = stocks.find((item) => item.id === row.dataset.stock);
      if (stock) showQuote(stock);
    }));
    const featured = ['2330', '2317', '2454', '2308', '2382', '2881'].map((id) => stocks.find((stock) => stock.id === id) || fallbackStocks.find((stock) => stock.id === id)).filter(Boolean);
    document.querySelector('#stockCards').innerHTML = featured.map((stock) => {
      const rate = getChange(stock.id);
      return `<article class="panel stock-card" data-stock="${esc(stock.id)}" tabindex="0" role="button"><div class="stock-card-top"><span class="stock-card-name"><b>${esc(stock.name)}</b><small>${esc(stock.id)} · TW</small></span><span class="metric-icon ${rate < 0 ? 'amber' : 'green'}">${rate < 0 ? '↘' : '↗'}</span></div><div class="stock-card-price">${number(getPrice(stock.id))}</div><div class="stock-card-bottom"><span>模擬收盤價</span><b class="${changeClass(rate)}">${rate > 0 ? '+' : ''}${number(rate)}%</b></div></article>`;
    }).join('');
    document.querySelectorAll('.stock-card').forEach((card) => {
      const open = () => showQuote(stocks.find((stock) => stock.id === card.dataset.stock) || fallbackStocks.find((stock) => stock.id === card.dataset.stock));
      card.addEventListener('click', open);
      card.addEventListener('keydown', (event) => { if (event.key === 'Enter') open(); });
    });
    renderMovers(); renderWatchlist();
  }

  function series(count, start, volatility, seed, trend = 0) {
    const random = seeded(seed);
    const values = [];
    let value = start;
    for (let i = 0; i < count; i += 1) {
      value += (random() - .49) * volatility + trend;
      values.push(value);
    }
    return values;
  }

  function drawChart(canvas, datasets, options = {}) {
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(bounds.width * ratio);
    canvas.height = Math.round(bounds.height * ratio);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const w = bounds.width, h = bounds.height;
    const pad = { top: 10, right: 3, bottom: 8, left: 3 };
    const all = datasets.flatMap((d) => d.values).filter((value) => Number.isFinite(value));
    let min = Math.min(...all), max = Math.max(...all);
    const spread = Math.max(max - min, 1);
    min -= spread * .16; max += spread * .16;
    const px = (i, len) => pad.left + (i / Math.max(1, len - 1)) * (w - pad.left - pad.right);
    const py = (value) => h - pad.bottom - ((value - min) / (max - min)) * (h - pad.top - pad.bottom);
    ctx.strokeStyle = '#edf0f5'; ctx.lineWidth = 1;
    for (let i = 0; i < 5; i += 1) { const y = pad.top + (i / 4) * (h - pad.top - pad.bottom); ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke(); }
    datasets.forEach((dataset, datasetIndex) => {
      const values = dataset.values;
      if (!values.length) return;
      ctx.beginPath();
      let segmentStart = 0, segmentEnd = values.length - 1;
      values.forEach((value, index) => {
        if (!Number.isFinite(value)) return;
        const x = px(index, values.length), y = py(value);
        if (index === 0 || !Number.isFinite(values[index - 1])) { ctx.moveTo(x, y); if (index < segmentStart || !Number.isFinite(values[index - 1])) segmentStart = index; }
        else ctx.lineTo(x, y);
        if (index > segmentEnd || index === values.length - 1) segmentEnd = index;
      });
      if (dataset.fill) { const finiteIndexes = values.map((value, index) => Number.isFinite(value) ? index : -1).filter((index) => index >= 0); const first = finiteIndexes[0], last = finiteIndexes.at(-1); ctx.lineTo(px(last, values.length), h - pad.bottom); ctx.lineTo(px(first, values.length), h - pad.bottom); ctx.closePath(); const fill = ctx.createLinearGradient(0, pad.top, 0, h); fill.addColorStop(0, 'rgba(103,128,235,.16)'); fill.addColorStop(1, 'rgba(103,128,235,0)'); ctx.fillStyle = fill; ctx.fill(); ctx.beginPath(); values.forEach((value, index) => { if (!Number.isFinite(value)) return; const x = px(index, values.length), y = py(value); if (index === 0 || !Number.isFinite(values[index - 1])) ctx.moveTo(x, y); else ctx.lineTo(x, y); }); }
      ctx.setLineDash(dataset.dashed ? [5, 5] : []); ctx.strokeStyle = dataset.color; ctx.lineWidth = datasetIndex === 0 ? 2 : 1.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); ctx.setLineDash([]);
    });
    if (options.markerAt !== undefined) {
      const ds = datasets[0], x = px(options.markerAt, ds.values.length), y = py(ds.values[options.markerAt]);
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#6b82eb'; ctx.stroke();
    }
  }

  function renderMainChart() {
    const multiplier = { '1M': 22, '3M': 65, '6M': 130, '1Y': 250 }[currentPeriod];
    const all = series(multiplier, 1390, 10, 2330, .72);
    const shown = all.slice(-Math.min(72, all.length));
    const avg = shown.map((_, i) => shown.slice(Math.max(0, i - 7), i + 1).reduce((a, b) => a + b, 0) / Math.min(i + 1, 8));
    document.querySelector('#overviewPrice').textContent = number(1485 + (hash(currentPeriod) % 9));
    drawChart(document.querySelector('#priceChart'), [{ values: shown, color: '#6b82eb', fill: true }, { values: avg, color: '#c5ceee' }]);
  }

  function renderHistory() {
    const metric = document.querySelector('#historyMetric')?.value || 'close';
    const base = series(90, 1370, metric === 'return' ? 1.6 : 9, 2330 + hash(metric), metric === 'return' ? .02 : .88);
    const values = metric === 'return' ? base.map((value, index) => index ? ((value - base[index - 1]) / base[index - 1]) * 100 : 0) : base;
    const average = values.map((_, i) => values.slice(Math.max(0, i - 11), i + 1).reduce((a, b) => a + b, 0) / Math.min(i + 1, 12));
    drawChart(document.querySelector('#historyChart'), [{ values, color: '#6b82eb', fill: true }, { values: average, color: '#c5ceee' }]);
  }

  function renderForecast() {
    const past = series(46, 1362, 8, 233012, .75);
    const future = [past[past.length - 1], past[past.length - 1] + 4, past[past.length - 1] + 8];
    const paddedPast = past.concat([null, null]);
    const futureLine = Array(past.length - 1).fill(null).concat(future);
    drawChart(document.querySelector('#forecastChart'), [{ values: paddedPast, color: '#7187eb' }, { values: futureLine, color: '#7187eb', dashed: true }], { markerAt: past.length - 1 });
  }

  function renderNews(filter = selectedFilter) {
    selectedFilter = filter;
    const visible = news.filter((item) => filter === 'all' || item.sentiment === filter);
    document.querySelector('#newsList').innerHTML = visible.map((item) => `<article class="panel news-card"><div class="news-card-top"><span class="news-tag ${item.sentiment}">${item.sentiment}</span><span class="impact-tag">${item.impact}</span></div><h3>${item.title}</h3><p>${item.summary}</p><div class="news-card-foot"><span><b>${item.company}・${item.ticker}</b></span><span>${item.time} · 示範資料</span></div></article>`).join('') || '<div class="panel empty-state">目前沒有符合條件的項目</div>';
    document.querySelectorAll('.filter-pill').forEach((pill) => pill.classList.toggle('active', (pill.dataset.filter === filter)));
  }

  function setupNavigation() {
    const setView = (name) => {
      const target = document.querySelector(`#view-${name}`);
      if (!target) return;
      document.querySelectorAll('.view-section').forEach((section) => section.classList.toggle('active', section === target));
      document.querySelectorAll('.nav-link').forEach((link) => link.classList.toggle('active', link.dataset.view === name));
      document.querySelector('#crumbTitle').textContent = target.dataset.title;
      document.title = `${target.dataset.title}｜台股研究室`;
      history.replaceState(null, '', `#${name}`);
      document.querySelector('#sidebar').classList.remove('open');
      if (name === 'history') requestAnimationFrame(renderHistory);
      if (name === 'forecast') requestAnimationFrame(renderForecast);
    };
    document.querySelectorAll('.nav-link').forEach((link) => link.addEventListener('click', (event) => { event.preventDefault(); setView(link.dataset.view); }));
    document.querySelectorAll('[data-go]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.go)));
    const initial = location.hash.slice(1);
    if (document.querySelector(`#view-${initial}`)) setView(initial);
    window.addEventListener('hashchange', () => { const name = location.hash.slice(1); if (document.querySelector(`#view-${name}`)) setView(name); });
  }

  function setupInteractions() {
    document.querySelector('#menuToggle').addEventListener('click', () => document.querySelector('#sidebar').classList.toggle('open'));
    document.querySelectorAll('.notice-close').forEach((button) => button.addEventListener('click', () => button.closest('.notice-banner').remove()));
    document.querySelectorAll('.period-button').forEach((button) => button.addEventListener('click', () => {
      currentPeriod = button.dataset.period;
      document.querySelectorAll('.period-button').forEach((item) => item.classList.toggle('active', item === button));
      renderMainChart();
    }));
    document.querySelector('#historyMetric').addEventListener('change', renderHistory);
    document.querySelector('#stockSearch').addEventListener('input', (event) => renderStocks(event.target.value));
    document.querySelector('#stockSearch').addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { event.currentTarget.value = ''; renderStocks(); }
      if (event.key === 'Enter') document.querySelector('#searchResults .search-result')?.click();
    });
    document.addEventListener('keydown', (event) => { if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) { event.preventDefault(); document.querySelector('#stockSearch').focus(); document.querySelector('.nav-link[data-view="stocks"]').click(); } });
    document.querySelectorAll('.filter-pill').forEach((pill) => pill.addEventListener('click', () => renderNews(pill.dataset.filter)));
    document.querySelector('#newsFilterButton').addEventListener('click', () => { const values = ['all', '看漲', '中性', '看跌']; const next = values[(values.indexOf(selectedFilter) + 1) % values.length]; renderNews(next); document.querySelector('.filter-pills').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
    document.querySelector('#refreshButton').addEventListener('click', (event) => {
      const button = event.currentTarget;
      button.disabled = true; button.innerHTML = '<span class="refresh-icon">↻</span>示範更新中…';
      setTimeout(() => { renderMainChart(); button.disabled = false; button.innerHTML = '<span class="refresh-icon">↻</span>更新示範資料'; }, 500);
    });
    document.querySelector('#runModel').addEventListener('click', (event) => {
      const button = event.currentTarget;
      button.disabled = true; button.textContent = '產生示範結果…';
      setTimeout(() => { renderForecast(); button.disabled = false; button.textContent = '再次執行示範'; }, 550);
    });
    document.querySelector('#exportButton').addEventListener('click', () => {
      const rows = ['注意：以下為合成示範資料，不是實際歷史行情。', 'day,close_demo,return_demo_percent'];
      const values = series(90, 1370, 9, 2330, .88);
      values.forEach((value, i) => rows.push(`${i + 1},${value.toFixed(2)},${(i ? ((value - values[i - 1]) / values[i - 1] * 100) : 0).toFixed(3)}`));
      const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
      const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'stock_demo_synthetic.csv'; link.click(); URL.revokeObjectURL(link.href);
    });
    document.addEventListener('click', (event) => { if (!event.target.closest('.search-panel')) document.querySelector('#searchResults').classList.remove('show'); });
    window.addEventListener('resize', () => { renderMainChart(); if (document.querySelector('#view-history').classList.contains('active')) renderHistory(); if (document.querySelector('#view-forecast').classList.contains('active')) renderForecast(); });
  }

  function renderHistogram() {
    const heights = [20, 31, 46, 59, 70, 79, 88, 96, 100, 94, 82, 71, 55, 43, 32, 23, 16];
    document.querySelector('#histogram').innerHTML = heights.map((height) => `<i style="height:${height}%"></i>`).join('');
    document.querySelector('#yearList').innerHTML = [['2026', 16.4], ['2025', 23.8], ['2024', 35.2], ['2023', 27.1], ['2022', -18.6]].map(([year, value]) => `<div class="year-row"><span>${year}</span><span class="year-bar"><i style="width:${Math.min(Math.abs(value) * 2.6, 100)}%;${value < 0 ? 'background:#e58b95' : ''}"></i></span><b class="${changeClass(value)}">${value > 0 ? '+' : ''}${value.toFixed(1)}%</b></div>`).join('');
  }

  setupNavigation();
  setupInteractions();
  renderStocks();
  renderNews();
  renderHistogram();
  renderMainChart();
  renderForecast();
  loadStocks();
})();
