import { authorize, getStockUniverse, jsonResponse, optionsResponse } from "./_shared.mjs";

export default async (request, context) => {
  if (request.method === "OPTIONS") return optionsResponse(request, context.site?.url);
  const auth = authorize(request);
  if (!auth.allowed) return jsonResponse(request, { error: "需要 API 存取碼。" }, 401, context.site?.url);

  const query = new URL(request.url).searchParams.get("q")?.trim().toLocaleLowerCase("zh-TW") ?? "";
  if (query.length < 1 || query.length > 32) return jsonResponse(request, { stocks: [], error: "請輸入 1 至 32 個字元的股票代號或名稱。" }, 400, context.site?.url);
  const stocks = getStockUniverse()
    .filter((stock) => stock.symbol.toLocaleLowerCase("en-US").includes(query) || stock.name.toLocaleLowerCase("zh-TW").includes(query))
    .slice(0, 20);
  return jsonResponse(request, { stocks }, 200, context.site?.url);
};

export const config = {
  path: "/api/stocks",
  method: ["GET", "OPTIONS"],
  rateLimit: { action: "rate_limit", aggregateBy: "ip", windowSize: 60, windowLimit: 60 },
};
