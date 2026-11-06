# 台股研究室

整合市場總覽、個股搜尋、歷史行情、新聞情緒與預測教學的網頁。靜態前端仍可由 GitHub Pages 提供，API 由 Netlify Functions 執行。

## 功能與資料來源

- 個股搜尋使用專案內的台灣股票代號清單（1,002 檔）。
- 最新可用收盤資料由 TWSE 與 TPEx 官方 OpenAPI 提供；不是盤中即時報價。
- 歷史日線由 Yahoo Finance 提供，可能延遲、缺值或改變服務方式。
- 新聞標題由 Google News RSS 提供；若設定 Gemini，後端會分類情緒與影響程度。
- 喜愛清單上限 10 檔，存在瀏覽器 `localStorage`，不會上傳帳號或同步到其他裝置。
- 預測模型頁仍是教學示意，不會執行原 Notebook 的神經網路模型。

## GitHub Pages 前端

網站檔案在倉庫根目錄。GitHub Pages 選 **Deploy from a branch**、`main`、`/(root)` 即可發布。前端預設呼叫 `https://taiwan-stock-lab-api.netlify.app`；若更換後端網址，可在「資料服務設定」修改，網址只保存在目前瀏覽器。

## Netlify Functions 後端

Netlify 專案使用根目錄的 `netlify.toml`：建置命令 `node scripts/prepare-netlify.mjs`、發佈目錄 `dist`、Functions 目錄 `netlify/functions`。在 Netlify 將此 GitHub 倉庫連接到 `taiwan-stock-lab-api` 專案，部署來源選 `main`。

Functions 路由：

- `GET /api/health`：檢查服務與 Gemini 設定狀態。
- `GET /api/stocks?q=台積電`：搜尋股票代號或名稱。
- `GET /api/quotes?symbols=2330,2317`：查詢最多 11 檔的最新可用收盤行情。
- `GET /api/history?symbol=2330&range=3M`：取得個股歷史日線。
- `GET /api/news?symbol=2330`：抓取相關新聞，並在已設定 Gemini 時進行情緒分析。

### Netlify 環境變數

在 **Project configuration → Environment variables** 設定變數，scope 至少包含 **Functions**；修改後重新部署才會套用。

- `GEMINI_API_KEY`：Gemini API 金鑰；只能存在 Netlify，不可放進 `app.js`、`backend-config.js`、GitHub 或瀏覽器設定。
- `APP_ACCESS_CODE`：建議設定一組個人存取碼。若啟用 Gemini 卻未設定存取碼，新聞 AI API 會拒絕呼叫，避免公開網站任意消耗您的 Gemini 額度。使用者在前端「資料服務設定」輸入；只保留在目前瀏覽器工作階段。
- `GEMINI_MODEL`：可選，預設 `gemini-3.8-flash`。
- `CORS_ALLOWED_ORIGINS`：可選，預設允許 `https://tea-0082.github.io` 與 Netlify 站台網址。

不要把真實機密填進 `.env.example`。本機 `.env` 已列入 `.gitignore`。

## 只以靜態方式預覽

若 Functions 尚未部署，個股搜尋、行情與歷史資料無法連線；預測與市場摘要保留示意內容。Functions 部署後，API 金鑰仍須以 Netlify 環境變數管理。
