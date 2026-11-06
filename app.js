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
  const savedFavorites = readList('tw-stock-favorites-v1').slice(0, 10);
  let favorites = [...new Set(savedFavorites.map((item) => typeof item === 'string' ? item : item.id).filter(Boolean))].slice(0, 10);
  let favoriteNames = new Map(savedFavorites.filter((item) => item && typeof item === 'object' && item.id).map((item) => [item.id, item.name || item.id]));
  let selectedSymbol = localStorage.getItem('tw-stock-selected-v1') || '2330';
  let latestQuotes = new Map();
  let apiBase = localStorage.getItem('tw-stock-api-base-v1') || window.STOCK_API_BASE_URL || '';
  let accessCode = sessionStorage.getItem('tw-stock-access-code-v1') || '';
  let liveNews = [];
  let liveNewsError = '';
  let liveNewsSymbol = '';
  let liveNewsFetchedAt = 0;
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

  function readList(key) {
    try { const value = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value : []; }
    catch { return []; }
  }

  function apiUrl(path) {
    const base = apiBase || (location.hostname.endsWith('.netlify.app') ? location.origin : '');
    if (!base) return null;
    return `${base.replace(/\/$/, '')}${path}`;
  }

  async function apiGet(path) {
    const url = apiUrl(path);
    if (!url) throw new Error('尚未設定後端服務網址。');
    const headers = accessCode ? { 'X-App-Access-Code': accessCode } : {};
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(25000) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `API 錯誤 (${response.status})`);
    return payload;
  }

  function favoriteStockList() {
    return favorites.map((id) => stocks.find((stock) => stock.id === id) || fallbackStocks.find((stock) => stock.id === id) || { id, name: favoriteNames.get(id) || id });
  }

  async function loadStocks() {
    try {
      const payload = await apiGet('/api/stocks?q=2330');
      if (payload.stocks?.length) stocks = [...new Map([...fallbackStocks, ...payload.stocks.map((stock) => ({ id: stock.symbol, name: stock.name }))].map((stock) => [stock.id, stock])).values()];
    } catch { /* Search can still use the built-in sample symbols before API setup. */ }
    renderStocks();
    renderFavoriteManager();
    await refreshQuotes();
    await refreshApiHealth();
  }

  function quoteMarkup(stock) {
    const quote = latestQuotes.get(stock.id);
    const price = quote?.close ?? getPrice(stock.id);
    const change = quote?.available ? quote.changePercent : getChange(stock.id);
    const delta = quote?.available ? quote.changeAmount : price * change / 100;
    return `<div class="quote-dialog" role="dialog" aria-modal="true" aria-labelledby="quoteTitle">
      <button class="dialog-close" aria-label="關閉">×</button>
      <div class="eyebrow"><span class="eyebrow-line"></span>${quote?.available ? esc(quote.market || '交易所資料') : '示範報價'}</div>
      <h2 id="quoteTitle">${esc(stock.name)} <span class="ticker">${esc(stock.id)}</span></h2>
      <div class="dialog-price">NT$ ${number(price)}</div>
      <div class="dialog-change ${changeClass(change)}">${change === null ? '漲跌資料暫缺' : `${change >= 0 ? '▲' : '▼'} ${number(Math.abs(delta))} (${change >= 0 ? '+' : ''}${number(change)}%)`}</div>
      <p>${quote?.available ? `交易日：${esc(quote.date || '最新可用')}。此為收盤快照，非盤中即時報價。` : '後端尚未連線，這是介面示範值，並非市場行情。'}</p>
      <div class="dialog-foot">資料來源：${quote?.available ? 'TWSE / TPEx' : '本機示範'} · 請以交易所資料為準</div>
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
    const ids = [...new Set([...(favorites.length ? favorites : ['2330', '2317', '2454', '2308', '2382'])])].slice(0, 5);
    document.querySelector('#moverList').innerHTML = ids.map((id, index) => {
      const stock = stocks.find((item) => item.id === id) || fallbackStocks.find((item) => item.id === id);
      const quote = latestQuotes.get(id);
      const rate = quote?.available ? quote.changePercent : getChange(id);
      const price = quote?.close ?? getPrice(id);
      return `<div class="mover-row" data-stock="${esc(id)}" role="button" tabindex="0"><span class="rank">0${index + 1}</span><span class="mover-name"><b>${esc(stock?.name || id)}</b><small>${esc(id)}</small></span><span class="mover-price">${number(price)}</span><span class="change-pill ${rate !== null && rate < 0 ? 'down' : ''}">${rate === null ? '—' : `${rate > 0 ? '+' : ''}${number(rate)}%`}</span></div>`;
    }).join('');
    document.querySelectorAll('.mover-row').forEach((row) => {
      const open = () => { const stock = stocks.find((item) => item.id === row.dataset.stock) || fallbackStocks.find((item) => item.id === row.dataset.stock) || { id: row.dataset.stock, name: row.dataset.stock }; setSelectedStock(stock); showQuote(stock); };
      row.addEventListener('click', open);
      row.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } });
    });
  }

  function renderWatchlist() {
    const ids = favorites;
    if (!ids.length) {
      document.querySelector('#watchlist').innerHTML = '<div class="empty-state">加入喜愛股票後，這裡會顯示您的清單。</div>';
      return;
    }
    document.querySelector('#watchlist').innerHTML = ids.map((id) => {
      const stock = stocks.find((item) => item.id === id) || fallbackStocks.find((item) => item.id === id) || { id, name: favoriteNames.get(id) || id };
      const quote = latestQuotes.get(id);
      const rate = quote?.available ? quote.changePercent : getChange(id);
      return `<div class="watch-item" data-stock="${esc(id)}" role="button" tabindex="0"><div><b>${esc(stock.name)}</b><small>${esc(id)} · 台灣</small></div><div class="watch-right"><strong>${number(quote?.close ?? getPrice(id))}</strong><em class="${rate === null ? 'muted' : changeClass(rate)}">${rate === null ? '—' : `${rate > 0 ? '+' : ''}${number(rate)}%`}</em></div></div>`;
    }).join('');
    document.querySelectorAll('.watch-item').forEach((row) => {
      const open = () => { const stock = stocks.find((item) => item.id === row.dataset.stock) || fallbackStocks.find((item) => item.id === row.dataset.stock) || { id: row.dataset.stock, name: row.dataset.stock }; setSelectedStock(stock); showQuote(stock); };
      row.addEventListener('click', open);
      row.addEventListener('keydown', (event) => { if (event.key === 'Enter') open(); });
    });
  }

  async function renderStocks(query = '') {
    const normalized = query.trim().toLocaleLowerCase();
    let list = normalized ? stocks.filter((stock) => stock.name.toLocaleLowerCase().includes(normalized) || stock.id.toLocaleLowerCase().includes(normalized)).slice(0, 20) : [];
    if (normalized && apiUrl('/api/stocks')) {
      try {
        const payload = await apiGet(`/api/stocks?q=${encodeURIComponent(query.trim())}`);
        if (payload.stocks) list = payload.stocks.map((stock) => ({ id: stock.symbol, name: stock.name }));
      } catch { /* Keep matching fallback entries when the backend is offline. */ }
    }
    const results = document.querySelector('#searchResults');
    results.innerHTML = list.length ? list.map((stock) => `<div class="search-result" data-stock="${esc(stock.id)}" role="option"><b>${esc(stock.name)}</b><span>${esc(stock.id)}</span><button class="favorite-action" data-add-favorite="${esc(stock.id)}" type="button">${favorites.includes(stock.id) ? '已加入' : '加入喜愛'}</button></div>`).join('') : (normalized ? '<div class="empty-state">沒有找到符合的股票</div>' : '');
    results.classList.toggle('show', Boolean(normalized));
    results.querySelectorAll('.search-result').forEach((row) => row.addEventListener('click', (event) => {
      if (event.target.closest('[data-add-favorite]')) return;
      const stock = stocks.find((item) => item.id === row.dataset.stock);
      const match = list.find((item) => item.id === row.dataset.stock) || stock || { id: row.dataset.stock, name: row.querySelector('b')?.textContent || row.dataset.stock };
      if (match) { setSelectedStock(match); showQuote(match); }
    }));
    results.querySelectorAll('[data-add-favorite]').forEach((button) => button.addEventListener('click', (event) => { event.stopPropagation(); const stock = list.find((item) => item.id === button.dataset.addFavorite); if (stock) addFavorite(stock); }));
    const featuredIds = [...new Set([...favorites, '2330', '2317', '2454', '2308', '2382', '2881'])].slice(0, 6);
    const featured = featuredIds.map((id) => stocks.find((stock) => stock.id === id) || fallbackStocks.find((stock) => stock.id === id) || { id, name: id });
    document.querySelector('#stockCards').innerHTML = featured.map((stock) => {
      const quote = latestQuotes.get(stock.id);
      const rate = quote?.available ? quote.changePercent : getChange(stock.id);
      return `<article class="panel stock-card" data-stock="${esc(stock.id)}" tabindex="0" role="button"><div class="stock-card-top"><span class="stock-card-name"><b>${esc(stock.name)}</b><small>${esc(stock.id)} · 台灣</small></span><span class="metric-icon ${rate !== null && rate < 0 ? 'amber' : 'green'}">${rate !== null && rate < 0 ? '↘' : '↗'}</span></div><div class="stock-card-price">${number(quote?.close ?? getPrice(stock.id))}</div><div class="stock-card-bottom"><span>${quote?.available ? esc(quote.market + '收盤') : '示範收盤價'}</span><b class="${rate === null ? 'muted' : changeClass(rate)}">${rate === null ? '—' : `${rate > 0 ? '+' : ''}${number(rate)}%`}</b></div></article>`;
    }).join('');
    document.querySelectorAll('.stock-card').forEach((card) => {
      const open = () => { const stock = stocks.find((item) => item.id === card.dataset.stock) || fallbackStocks.find((item) => item.id === card.dataset.stock) || { id: card.dataset.stock, name: card.querySelector('.stock-card-name b')?.textContent || card.dataset.stock }; setSelectedStock(stock); showQuote(stock); };
      card.addEventListener('click', open);
      card.addEventListener('keydown', (event) => { if (event.key === 'Enter') open(); });
    });
    renderMovers(); renderWatchlist(); renderFavoriteManager();
  }

  function saveFavorites() {
    localStorage.setItem('tw-stock-favorites-v1', JSON.stringify(favorites.map((id) => ({ id, name: favoriteNames.get(id) || stocks.find((stock) => stock.id === id)?.name || id }))));
    renderFavoriteManager(); renderWatchlist(); renderMovers();
    refreshQuotes();
  }

  function addFavorite(stock) {
    if (favorites.includes(stock.id)) return;
    if (favorites.length >= 10) {
      document.querySelector('#favoriteCount').classList.add('favorites-full');
      document.querySelector('#favoriteEmpty').textContent = '已達 10 檔上限；請先移除一檔再新增。';
      return;
    }
    if (!stocks.some((item) => item.id === stock.id)) stocks.push(stock);
    favoriteNames.set(stock.id, stock.name);
    favorites = [...favorites, stock.id];
    saveFavorites(); renderStocks(document.querySelector('#stockSearch').value);
  }

  function removeFavorite(symbol) {
    favorites = favorites.filter((id) => id !== symbol);
    favoriteNames.delete(symbol);
    saveFavorites(); renderStocks(document.querySelector('#stockSearch').value);
  }

  function renderFavoriteManager() {
    const list = document.querySelector('#favoriteManagerList');
    if (!list) return;
    document.querySelector('#favoriteCount').textContent = `${favorites.length} / 10`;
    document.querySelector('#favoriteCount').classList.toggle('favorites-full', favorites.length >= 10);
    document.querySelector('#favoriteEmpty').hidden = favorites.length > 0;
    list.innerHTML = favoriteStockList().map((stock) => `<div class="favorite-chip"><div class="favorite-main" data-select-stock="${esc(stock.id)}"><b>${esc(stock.name)}</b><small>${esc(stock.id)}</small></div><button type="button" data-remove-favorite="${esc(stock.id)}" aria-label="移除 ${esc(stock.name)}">×</button></div>`).join('');
    list.querySelectorAll('[data-select-stock]').forEach((item) => item.addEventListener('click', () => {
      const stock = favoriteStockList().find((entry) => entry.id === item.dataset.selectStock);
      if (stock) { setSelectedStock(stock); showQuote(stock); }
    }));
    list.querySelectorAll('[data-remove-favorite]').forEach((button) => button.addEventListener('click', () => removeFavorite(button.dataset.removeFavorite)));
  }

  function setSelectedStock(stock) {
    selectedSymbol = stock.id;
    localStorage.setItem('tw-stock-selected-v1', selectedSymbol);
    if (!stocks.some((item) => item.id === stock.id)) stocks.push(stock);
    document.querySelector('#overviewStockName').textContent = stock.name;
    document.querySelector('#overviewStockSymbol').textContent = stock.id;
    document.querySelector('#overviewPrice').textContent = '…';
    renderMainChart();
    refreshQuotes();
  }

  async function refreshQuotes() {
    const ids = [...new Set([selectedSymbol, ...favorites])].slice(0, 11);
    if (!apiUrl('/api/quotes') || !ids.length) return;
    try {
      const payload = await apiGet(`/api/quotes?symbols=${encodeURIComponent(ids.join(','))}`);
      for (const quote of payload.quotes ?? []) latestQuotes.set(quote.symbol, quote);
      updateSelectedQuote(payload);
      renderStocks(document.querySelector('#stockSearch')?.value ?? '');
    } catch (error) {
      const label = error.message.includes('存取碼') ? 'API 存取碼錯誤' : '行情服務暫不可用';
      document.querySelector('#quoteTimestamp').textContent = label;
    }
  }

  function updateSelectedQuote(payload = {}) {
    const quote = latestQuotes.get(selectedSymbol);
    const stock = stocks.find((item) => item.id === selectedSymbol) || fallbackStocks.find((item) => item.id === selectedSymbol) || { id: selectedSymbol, name: favoriteNames.get(selectedSymbol) || selectedSymbol };
    if (!stock) return;
    document.querySelector('#overviewStockName').textContent = stock.name;
    document.querySelector('#overviewStockSymbol').textContent = stock.id;
    if (!quote?.available) {
      document.querySelector('#overviewPrice').textContent = number(getPrice(selectedSymbol));
      document.querySelector('#overviewChange').textContent = '示範值';
      document.querySelector('#overviewChange').className = 'muted';
      document.querySelector('#quoteTimestamp').textContent = '後端尚未連線';
      document.querySelector('#quoteSource').innerHTML = '<span>歷史行情來源</span><span>設定後端網址後載入</span>';
      return;
    }
    const rate = quote.changePercent;
    document.querySelector('#overviewPrice').textContent = number(quote.close);
    document.querySelector('#overviewChange').textContent = rate === null ? '漲跌幅暫缺' : `${rate >= 0 ? '▲' : '▼'} ${number(Math.abs(quote.changeAmount ?? 0))} (${rate >= 0 ? '+' : ''}${number(rate)}%)`;
    document.querySelector('#overviewChange').className = rate === null ? 'muted' : changeClass(rate);
    document.querySelector('#overviewStockMarket').textContent = `${quote.market || '台灣市場'}・收盤資料`;
    document.querySelector('#quoteTimestamp').textContent = `交易日 ${quote.date || payload.tradingDate || '最新可用'}`;
    document.querySelector('#quoteSource').innerHTML = `<span>${esc(payload.source || quote.market || 'TWSE / TPEx')}</span><span>${esc(payload.freshness || '最新可用收盤快照')}</span>`;
  }

  async function refreshApiHealth() {
    const status = document.querySelector('#apiStatus');
    const details = document.querySelector('#apiStatusDetails');
    if (!apiUrl('/api/health')) {
      if (status) { status.textContent = '尚未設定後端網址'; status.className = 'api-status'; }
      if (details) details.textContent = '輸入 Netlify Functions 網址後，可使用交易所收盤快照、歷史行情與新聞搜尋。';
      document.querySelector('#overviewDataMode').textContent = '示範模式';
      document.querySelector('#overviewDataMessage').textContent = '目前顯示合成數值。到「資料服務設定」輸入後端網址即可連線。';
      return null;
    }
    try {
      const health = await apiGet('/api/health');
      if (status) { status.textContent = '後端已連線'; status.className = 'api-status ok'; }
      if (details) details.innerHTML = `行情來源：TWSE / TPEx 最新可用收盤快照<br>歷史行情：Yahoo Finance（可能延遲）<br>新聞：Google News RSS<br>Gemini：${health.geminiConfigured ? '已設定' : '尚未設定 GEMINI_API_KEY'}<br>API 存取碼：${health.accessCodeConfigured ? '已設定' : '未設定'}${health.newsAccessCodeRequired && !health.accessCodeConfigured ? '（設定 Gemini 前必須先設定）' : ''}`;
      document.querySelector('#overviewDataMode').textContent = '後端已連線';
      document.querySelector('#overviewDataMessage').textContent = '個股收盤行情與歷史走勢已連線；新聞情緒分析需要 Netlify 設定 Gemini 金鑰。';
      return health;
    } catch (error) {
      if (status) { status.textContent = error.message.includes('存取碼') ? '存取碼錯誤' : '連線失敗'; status.className = 'api-status error'; }
      if (details) details.textContent = error.message;
      return null;
    }
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

  async function renderMainChart() {
    const symbol = selectedSymbol;
    const multiplier = { '1M': 22, '3M': 65, '6M': 130, '1Y': 250 }[currentPeriod];
    const fallback = series(multiplier, getPrice(symbol) * .93, Math.max(1, getPrice(symbol) * .007), hash(symbol + currentPeriod), getPrice(symbol) * .0005).slice(-72);
    drawChart(document.querySelector('#priceChart'), [{ values: fallback, color: '#aab5e7', fill: true }]);
    try {
      const payload = await apiGet(`/api/history?symbol=${encodeURIComponent(symbol)}&range=${currentPeriod}`);
      if (symbol !== selectedSymbol || !payload.rows?.length) return;
      const rows = payload.rows;
      const values = rows.map((row) => row.close);
      const avg = values.map((_, i) => values.slice(Math.max(0, i - 11), i + 1).reduce((a, b) => a + b, 0) / Math.min(i + 1, 12));
      drawChart(document.querySelector('#priceChart'), [{ values, color: '#6b82eb', fill: true }, { values: avg, color: '#c5ceee' }]);
      document.querySelector('#quoteSource').innerHTML = `<span>${esc(payload.source)}</span><span>${esc(payload.freshness)}</span>`;
    } catch { /* Keep the chart visibly available as a labelled local sample. */ }
  }

  async function renderHistory() {
    const metric = document.querySelector('#historyMetric')?.value || 'close';
    const symbol = selectedSymbol;
    const fallback = series(90, getPrice(symbol) * .9, Math.max(1, getPrice(symbol) * .008), hash(symbol + metric), getPrice(symbol) * .0005);
    drawChart(document.querySelector('#historyChart'), [{ values: fallback, color: '#aab5e7', fill: true }]);
    try {
      const payload = await apiGet(`/api/history?symbol=${encodeURIComponent(symbol)}&range=1Y`);
      if (symbol !== selectedSymbol || !payload.rows?.length) return;
      const rows = payload.rows;
      const closes = rows.map((row) => row.close);
      const returns = closes.map((value, i) => i ? (value / closes[i - 1] - 1) * 100 : 0);
      const values = metric === 'return' ? returns : metric === 'volume' ? rows.map((row) => row.volume ?? 0) : closes;
      const avg = values.map((_, i) => values.slice(Math.max(0, i - 11), i + 1).reduce((a, b) => a + b, 0) / Math.min(i + 1, 12));
      drawChart(document.querySelector('#historyChart'), [{ values, color: '#6b82eb', fill: true }, { values: avg, color: '#c5ceee' }]);
      const totalReturn = closes.length > 1 ? (closes.at(-1) / closes[0] - 1) * 100 : 0;
      const mean = returns.reduce((a, b) => a + b, 0) / Math.max(1, returns.length);
      const volatility = Math.sqrt(returns.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / Math.max(1, returns.length - 1)) * Math.sqrt(252);
      let peak = closes[0], maxDrawdown = 0;
      closes.forEach((value) => { peak = Math.max(peak, value); maxDrawdown = Math.min(maxDrawdown, (value / peak - 1) * 100); });
      const metrics = document.querySelectorAll('.history-summary b');
      metrics[0].textContent = `${totalReturn >= 0 ? '+' : ''}${totalReturn.toFixed(2)}%`;
      metrics[0].className = changeClass(totalReturn);
      metrics[1].textContent = `${volatility.toFixed(2)}%`;
      metrics[2].textContent = `−${Math.abs(maxDrawdown).toFixed(2)}%`;
      metrics[3].textContent = `${rows.length} 個交易日`;
      document.querySelector('#view-history .section-title-row h2').textContent = `${payload.name}・${payload.symbol}`;
      document.querySelector('#view-history .section-title-row p').textContent = `資料來源：${payload.source}；近一年每日資料`;
    } catch { /* Keep the example chart visible until a backend is configured. */ }
  }

  function renderForecast() {
    const past = series(46, 1362, 8, 233012, .75);
    const future = [past[past.length - 1], past[past.length - 1] + 4, past[past.length - 1] + 8];
    const paddedPast = past.concat([null, null]);
    const futureLine = Array(past.length - 1).fill(null).concat(future);
    drawChart(document.querySelector('#forecastChart'), [{ values: paddedPast, color: '#7187eb' }, { values: futureLine, color: '#7187eb', dashed: true }], { markerAt: past.length - 1 });
  }

  async function renderNews(filter = selectedFilter) {
    selectedFilter = filter;
    const host = document.querySelector('#newsList');
    if (apiUrl('/api/news') && (liveNewsSymbol !== selectedSymbol || Date.now() - liveNewsFetchedAt > 5 * 60 * 1000)) {
      host.innerHTML = '<div class="panel empty-state">正在取得新聞與分析結果…</div>';
      try {
        const payload = await apiGet(`/api/news?symbol=${encodeURIComponent(selectedSymbol)}`);
        if (payload.symbol !== selectedSymbol) return;
        liveNewsError = '';
        liveNewsSymbol = payload.symbol;
        liveNewsFetchedAt = Date.now();
        liveNews = (payload.news || []).map((item) => ({
          ticker: payload.symbol, company: payload.name, sentiment: item.sentiment || '中性',
          impact: item.impact ? `${item.impact}影響` : '尚未分析',
          time: item.publishedAt ? new Date(item.publishedAt).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' }) : '發布時間不明',
          title: item.title, summary: item.reason || item.description || '此新聞尚無摘要。', link: item.link,
          source: item.source || 'Google News', aiMissing: !item.sentiment,
        }));
        if (!payload.aiConfigured) liveNewsError = payload.aiNotice || 'Gemini 金鑰尚未設定；新聞會顯示但不會分類。';
      } catch (error) { liveNewsError = error.message; liveNews = []; liveNewsSymbol = ''; }
    } else if (!apiUrl('/api/news')) {
      liveNews = news.map((item) => ({ ...item, aiMissing: false, link: '', source: '示範資料' }));
      liveNewsError = '尚未連線後端；以下為虛構新聞示範。';
    }
    const visible = liveNews.filter((item) => filter === 'all' || item.sentiment === filter);
    const notice = liveNewsError ? `<div class="news-ai-notice">${esc(liveNewsError)}</div>` : '';
    host.innerHTML = notice + (visible.map((item) => {
      const label = item.aiMissing ? '未分類' : item.sentiment;
      const href = item.link && /^https:\/\//i.test(item.link) ? item.link : '';
      const title = href ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer"><h3>${esc(item.title)}</h3></a>` : `<h3>${esc(item.title)}</h3>`;
      return `<article class="panel news-card"><div class="news-card-top"><span class="news-tag ${label === '未分類' ? '中性' : esc(label)}">${esc(label)}</span><span class="impact-tag">${esc(item.impact || '尚未分析')}</span></div>${title}<p>${esc(item.summary || '')}</p><div class="news-card-foot"><span><b>${esc(item.company)}・${esc(item.ticker)}</b></span><span>${esc(item.time)} · ${esc(item.source || '新聞來源')}</span></div></article>`;
    }).join('') || '<div class="panel empty-state">目前沒有符合條件的新聞。</div>');
    document.querySelectorAll('.filter-pill').forEach((pill) => pill.classList.toggle('active', pill.dataset.filter === filter));
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
      if (name === 'stocks') requestAnimationFrame(() => renderStocks(document.querySelector('#stockSearch').value));
      if (name === 'history') requestAnimationFrame(renderHistory);
      if (name === 'news') renderNews();
      if (name === 'forecast') requestAnimationFrame(renderForecast);
      if (name === 'settings') {
        document.querySelector('#apiBaseInput').value = apiBase;
        document.querySelector('#accessCodeInput').value = accessCode;
        refreshApiHealth();
      }
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
    let searchTimer;
    document.querySelector('#stockSearch').addEventListener('input', (event) => { clearTimeout(searchTimer); searchTimer = setTimeout(() => renderStocks(event.target.value), 180); });
    document.querySelector('#stockSearch').addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { event.currentTarget.value = ''; renderStocks(); }
      if (event.key === 'Enter') document.querySelector('#searchResults .search-result')?.click();
    });
    document.addEventListener('keydown', (event) => { if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) { event.preventDefault(); document.querySelector('#stockSearch').focus(); document.querySelector('.nav-link[data-view="stocks"]').click(); } });
    document.querySelectorAll('.filter-pill').forEach((pill) => pill.addEventListener('click', () => renderNews(pill.dataset.filter)));
    document.querySelector('#newsFilterButton').addEventListener('click', () => { const values = ['all', '看漲', '中性', '看跌']; const next = values[(values.indexOf(selectedFilter) + 1) % values.length]; renderNews(next); document.querySelector('.filter-pills').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
    document.querySelector('#refreshButton').addEventListener('click', async (event) => {
      const button = event.currentTarget;
      button.disabled = true; button.innerHTML = '<span class="refresh-icon">↻</span>更新中…';
      await refreshQuotes(); await renderMainChart();
      button.disabled = false; button.innerHTML = '<span class="refresh-icon">↻</span>更新資料';
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
    document.querySelector('#clearFavorites').addEventListener('click', () => { favorites = []; favoriteNames.clear(); saveFavorites(); });
    document.querySelector('#showAccessCode').addEventListener('click', (event) => {
      const input = document.querySelector('#accessCodeInput');
      input.type = input.type === 'password' ? 'text' : 'password';
      event.currentTarget.textContent = input.type === 'password' ? '顯示' : '隱藏';
    });
    document.querySelector('#saveApiSettings').addEventListener('click', async () => {
      const input = document.querySelector('#apiBaseInput');
      const status = document.querySelector('#apiStatus');
      let nextBase = input.value.trim().replace(/\/$/, '');
      if (nextBase) {
        try {
          const parsed = new URL(nextBase);
          const local = ['localhost', '127.0.0.1'].includes(parsed.hostname);
          if ((!local && parsed.protocol !== 'https:') || parsed.pathname !== '/' || parsed.search || parsed.hash) throw new Error('請輸入 Netlify 網址的 origin，例如 https://your-site.netlify.app');
        } catch (error) { status.textContent = error.message || '後端網址格式不正確'; status.className = 'api-status error'; return; }
      }
      apiBase = nextBase;
      accessCode = document.querySelector('#accessCodeInput').value.trim();
      localStorage.setItem('tw-stock-api-base-v1', apiBase);
      if (accessCode) sessionStorage.setItem('tw-stock-access-code-v1', accessCode); else sessionStorage.removeItem('tw-stock-access-code-v1');
      status.textContent = '正在測試連線…'; status.className = 'api-status';
      await refreshApiHealth();
      if (apiBase && status.className.includes('ok')) {
        await renderStocks(); await refreshQuotes(); await renderMainChart();
      }
    });
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
  renderFavoriteManager();
  renderHistogram();
  renderMainChart();
  renderForecast();
  loadStocks();
})();
