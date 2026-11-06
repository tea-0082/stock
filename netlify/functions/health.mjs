import { authorize, getEnv, jsonResponse, optionsResponse } from "./_shared.mjs";

export default async (request, context) => {
  if (request.method === "OPTIONS") return optionsResponse(request, context.site?.url);
  const auth = authorize(request);
  if (!auth.allowed) return jsonResponse(request, { error: "需要 API 存取碼。" }, 401, context.site?.url);
  return jsonResponse(request, {
    ok: true,
    service: "taiwan-stock-lab-api",
    geminiConfigured: Boolean(getEnv("GEMINI_API_KEY")),
    accessCodeConfigured: Boolean(getEnv("APP_ACCESS_CODE")),
    newsAccessCodeRequired: Boolean(getEnv("GEMINI_API_KEY")),
    marketData: "TWSE/TPEx daily close snapshots; Yahoo Finance historical series",
    timestamp: new Date().toISOString(),
  }, 200, context.site?.url);
};

export const config = {
  path: "/api/health",
  method: ["GET", "OPTIONS"],
  rateLimit: { action: "rate_limit", aggregateBy: "ip", windowSize: 60, windowLimit: 30 },
};
