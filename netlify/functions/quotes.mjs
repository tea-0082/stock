import { authorize, fetchJson, getStock, jsonResponse, optionsResponse, parseNumber, pickField } from "./_shared.mjs";

let cachedSnapshot = null;
let cachedAt = 0;
const CACHE_MS = 60_000;
const sources = [
  { market: "上市", url: "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL" },
  { market: "上櫃", url: "https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes" },
];

function normalizeRow(row, market) {
  const symbol = String(pickField(row, ["證券代號", "股票代號", "Code", "SecuritiesCompanyCode", "SecuritiesCompanyCode ", "代號"]) ?? "").trim().toUpperCase();
  const close = parseNumber(pickField(row, ["收盤價", "Close", "ClosingPrice", "Closing Price"]));
  if (!symbol || close === null) return null;
  const name = String(pickField(row, ["證券名稱", "股票名稱", "Name", "CompanyName", "SecuritiesCompanyName"]) ?? "").trim();
  const changeAmount = parseNumber(pickField(row, ["漲跌價差", "Change", "ChangePrice", "Change "]));
  const open = parseNumber(pickField(row, ["開盤價", "Open", "OpeningPrice"]));
  const high = parseNumber(pickField(row, ["最高價", "High", "HighestPrice"]));
  const low = parseNumber(pickField(row, ["最低價", "Low", "LowestPrice"]));
  const volume = parseNumber(pickField(row, ["成交股數", "TradingShares", "TradingVolume", "Volume"]));
  const date = String(pickField(row, ["日期", "Date", "TradeDate"]) ?? "").trim();
  return { symbol, name, market, close, changeAmount, open, high, low, volume, date };
}

async function getSnapshot() {
  if (cachedSnapshot && Date.now() - cachedAt < CACHE_MS) return cachedSnapshot;
  const results = await Promise.allSettled(sources.map(async (source) => {
    const rows = await fetchJson(source.url, 22000);
    if (!Array.isArray(rows)) throw new Error(`${source.market} API returned an unexpected response`);
    return rows.map((row) => normalizeRow(row, source.market)).filter(Boolean);
  }));
  const merged = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  if (!merged.length) throw new Error("TWSE 與 TPEx 暫時都無法提供行情資料。");
  cachedSnapshot = merged;
  cachedAt = Date.now();
  return merged;
}

export default async (request, context) => {
  if (request.method === "OPTIONS") return optionsResponse(request, context.site?.url);
  const auth = authorize(request);
  if (!auth.allowed) return jsonResponse(request, { error: "需要 API 存取碼。" }, 401, context.site?.url);

  const url = new URL(request.url);
  const symbols = [...new Set((url.searchParams.get("symbols") ?? "").split(",").map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))];
  if (!symbols.length || symbols.length > 11) return jsonResponse(request, { error: "一次請求需提供 1 至 11 檔股票代號。" }, 400, context.site?.url);
  const invalid = symbols.filter((symbol) => !getStock(symbol));
  if (invalid.length) return jsonResponse(request, { error: `找不到股票代號：${invalid.join(", ")}` }, 400, context.site?.url);

  try {
    const snapshot = await getSnapshot();
    const bySymbol = new Map(snapshot.map((row) => [row.symbol, row]));
    const quotes = symbols.map((symbol) => {
      const stock = getStock(symbol);
      const quote = bySymbol.get(symbol);
      if (!quote) return { symbol, name: stock.name, market: null, available: false };
      const percentage = quote.changeAmount !== null && quote.close - quote.changeAmount !== 0
        ? quote.changeAmount / (quote.close - quote.changeAmount) * 100
        : null;
      return { ...quote, name: quote.name || stock.name, changePercent: percentage, available: true };
    });
    const available = quotes.filter((quote) => quote.available);
    return jsonResponse(request, {
      quotes,
      source: [...new Set(available.map((quote) => quote.market))].join(" / "),
      tradingDate: available.map((quote) => quote.date).find(Boolean) ?? null,
      fetchedAt: new Date().toISOString(),
      freshness: "交易所最新可用收盤快照；非盤中即時報價",
    }, 200, context.site?.url);
  } catch {
    return jsonResponse(request, { error: "暫時無法取得交易所行情，請稍後再試。" }, 502, context.site?.url);
  }
};

export const config = {
  path: "/api/quotes",
  method: ["GET", "OPTIONS"],
  rateLimit: { action: "rate_limit", aggregateBy: "ip", windowSize: 60, windowLimit: 30 },
};
