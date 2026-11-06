import { authorize, getStock, jsonResponse, optionsResponse } from "./_shared.mjs";

const rangeMap = { "1M": "1mo", "3M": "3mo", "6M": "6mo", "1Y": "1y" };

async function loadHistory(symbol, range, suffix) {
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol + suffix)}`);
  url.searchParams.set("range", range);
  url.searchParams.set("interval", "1d");
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; TaiwanStockLab/1.0)" },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error("Historical data source unavailable");
  const json = await response.json();
  const result = json?.chart?.result?.[0];
  if (!result?.timestamp?.length) throw new Error("No historical data");
  const quote = result.indicators?.quote?.[0] ?? {};
  return result.timestamp.map((timestamp, index) => ({
    date: new Date(timestamp * 1000).toISOString().slice(0, 10),
    open: quote.open?.[index] ?? null,
    high: quote.high?.[index] ?? null,
    low: quote.low?.[index] ?? null,
    close: quote.close?.[index] ?? null,
    volume: quote.volume?.[index] ?? null,
  })).filter((row) => Number.isFinite(row.close));
}

export default async (request, context) => {
  if (request.method === "OPTIONS") return optionsResponse(request, context.site?.url);
  const auth = authorize(request);
  if (!auth.allowed) return jsonResponse(request, { error: "需要 API 存取碼。" }, 401, context.site?.url);
  const url = new URL(request.url);
  const symbol = (url.searchParams.get("symbol") ?? "").trim().toUpperCase();
  const stock = getStock(symbol);
  const rangeKey = (url.searchParams.get("range") ?? "3M").toUpperCase();
  const range = rangeMap[rangeKey];
  if (!stock || !range) return jsonResponse(request, { error: "請提供有效的股票代號與期間。" }, 400, context.site?.url);

  try {
    let rows;
    let marketSuffix = ".TW";
    try {
      rows = await loadHistory(symbol, range, marketSuffix);
    } catch {
      marketSuffix = ".TWO";
      rows = await loadHistory(symbol, range, marketSuffix);
    }
    return jsonResponse(request, {
      symbol,
      name: stock.name,
      range: rangeKey,
      rows,
      source: `Yahoo Finance (${marketSuffix})`,
      fetchedAt: new Date().toISOString(),
      freshness: "可能延遲或有缺值，請以交易所資料為準",
    }, 200, context.site?.url);
  } catch {
    return jsonResponse(request, { error: "暫時無法取得歷史資料，請稍後再試。" }, 502, context.site?.url);
  }
};

export const config = {
  path: "/api/history",
  method: ["GET", "OPTIONS"],
  rateLimit: { action: "rate_limit", aggregateBy: "ip", windowSize: 60, windowLimit: 30 },
};
