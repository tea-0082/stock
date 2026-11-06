import { stockUniverse } from "../data/stock-universe.mjs";

const stockBySymbol = new Map(stockUniverse.map((stock) => [stock.symbol.toUpperCase(), stock]));

export function getEnv(name) {
  return globalThis.Netlify?.env?.get(name) ?? process.env[name] ?? "";
}

export function getStock(symbol) {
  if (!symbol || !/^[A-Z0-9]{2,6}$/i.test(symbol)) return null;
  return stockBySymbol.get(symbol.toUpperCase()) ?? null;
}

export function getStockUniverse() {
  return stockUniverse;
}

function isAllowedOrigin(origin, siteUrl = "") {
  if (!origin) return false;
  const configuredValue = getEnv("CORS_ALLOWED_ORIGINS");
  const configured = (configuredValue || "https://tea-0082.github.io,https://taiwan-stock-lab-api.netlify.app").split(",").map((value) => value.trim()).filter(Boolean);
  if (configured.includes(origin) || (siteUrl && origin === siteUrl.replace(/\/$/, ""))) return true;
  try {
    const url = new URL(origin);
    return url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
  } catch {
    return false;
  }
}

export function corsHeaders(request, siteUrl = "") {
  const origin = request.headers.get("origin") ?? "";
  const headers = new Headers({
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-App-Access-Code",
    "Access-Control-Max-Age": "600",
    "Cache-Control": "no-store",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff",
  });
  if (isAllowedOrigin(origin, siteUrl)) headers.set("Access-Control-Allow-Origin", origin);
  return headers;
}

export function jsonResponse(request, payload, status = 200, siteUrl = "") {
  const headers = corsHeaders(request, siteUrl);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(payload), { status, headers });
}

export function optionsResponse(request, siteUrl = "") {
  return new Response(null, { status: 204, headers: corsHeaders(request, siteUrl) });
}

export function authorize(request, { protectAi = false } = {}) {
  const configuredCode = getEnv("APP_ACCESS_CODE");
  if (!configuredCode) {
    const required = protectAi && Boolean(getEnv("GEMINI_API_KEY"));
    return { allowed: !required, required, missing: required };
  }
  const provided = request.headers.get("x-app-access-code") ?? "";
  return { allowed: provided.length > 0 && provided === configuredCode, required: true, missing: false };
}

export function parseNumber(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).replace(/,/g, "").replace(/[%\s]/g, "").trim();
  if (!normalized || ["-", "--", "X", "NaN"].includes(normalized)) return null;
  const result = Number(normalized);
  return Number.isFinite(result) ? result : null;
}

export function pickField(row, names) {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== null && String(row[name]).trim() !== "") return row[name];
  }
  const keys = Object.keys(row);
  const key = keys.find((candidate) => names.some((name) => candidate.toLowerCase() === name.toLowerCase()));
  return key ? row[key] : null;
}

export async function fetchJson(url, timeoutMs = 15000) {
  const response = await fetch(url, {
    headers: { "User-Agent": "TaiwanStockLab/1.0 (educational project)" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`Upstream responded ${response.status}`);
  return response.json();
}
