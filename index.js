// index.js
import { GoogleSpreadsheet } from "google-spreadsheet";
import { chromium } from "playwright";
import axios from "axios";
import fs from "fs";

// ================== 設定 ==================
const SHEET_ID = process.env.GOOGLE_SHEETS_ID; // Google Sheets ID
const SERVICE_ACCOUNT = JSON.parse(fs.readFileSync('./service_account.json', 'utf8'));
const CHATWORK_TOKEN = process.env.CHATWORK_TOKEN; // Chatwork API token
const CHATWORK_ROOM_ID = process.env.CHATWORK_ROOM_ID;

// 履歴シート列順
const HISTORY_COLUMNS = [
  "タイムスタンプ","商品名","ASIN","商品名（Amazon）","価格",
  "ベストセラーバッジ","小カテランキング","大カテランキング","レビュー数",
  "ステータス","スコア","タイプ"
];

// ================== Google Sheets 初期化 ==================
const doc = new GoogleSpreadsheet(SHEET_ID);

async function initSheet() {
  await doc.useServiceAccountAuth(SERVICE_ACCOUNT);
  await doc.loadInfo();
  const configSheet = doc.sheetsByTitle["設定"];
  const historySheet = doc.sheetsByTitle["履歴"];
  return { configSheet, historySheet };
}

// ================== Amazon Scraper ==================
class AmazonScraper {
  constructor() {}
  
  async launchBrowser() {
    this.browser = await chromium.launch({ headless: true });
  }

  async closeBrowser() {
    if (this.browser) await this.browser.close();
  }

  async getProductInfo(asin) {
    const page = await this.browser.newPage();
    const url = `https://www.amazon.co.jp/dp/${asin}`;
    await page.goto(url, { waitUntil: "domcontentloaded" });

    // 必要情報を取得
    const data = await page.evaluate(() => {
      const priceEl = document.querySelector("#priceblock_ourprice, #priceblock_dealprice");
      const price = priceEl ? priceEl.innerText.replace(/[^\d]/g,"") : null;
      const titleEl = document.querySelector("#productTitle");
      const title = titleEl ? titleEl.innerText.trim() : null;
      const badge = document.querySelector(".badge-link") ? "Yes" : "No";
      const smallRank = document.querySelector(".zg_hrsr .zg_hrsr_rank")?.innerText.replace(/[^\d]/g,"") || null;
      const largeRank = document.querySelector("#SalesRank")?.innerText.replace(/[^\d]/g,"") || null;
      const review = document.querySelector("#acrCustomerReviewText")?.innerText.replace(/[^\d]/g,"") || null;
      return { title, price, badge, smallRank, largeRank, review };
    });

    await page.close();
    return data;
  }
}

// ================== Chatwork通知 ==================
async function notifyChatwork(message) {
  try {
    await axios.post(
      `https://api.chatwork.com/v2/rooms/${CHATWORK_ROOM_ID}/messages`,
      { body: message },
      { headers: { "X-ChatWorkToken": CHATWORK_TOKEN } }
    );
  } catch (err) {
    console.error("Chatwork通知エラー:", err.message);
  }
}

// ================== メイン ==================
async function main() {
  console.log("========================================");
  console.log("🚀 Amazon Product Monitor 開始");
  console.log("========================================");
  
  const { configSheet, historySheet } = await initSheet();
  const scraper = new AmazonScraper();
  await scraper.launchBrowser();

  await configSheet.loadCells();
  const rows = await configSheet.getRows();
  const timestamp = new Date().toISOString();

  const historyBatch = [];

  for (const row of rows) {
    if (row.Active !== "TRUE") continue;

    const asins = [];
    if (row["自社ASIN"]) asins.push({ asin: row["自社ASIN"], type: "自社" });
    if (row["競合ASIN1"]) asins.push({ asin: row["競合ASIN1"], type: "競合" });
    if (row["競合ASIN2"]) asins.push({ asin: row["競合ASIN2"], type: "競合" });

    for (const item of asins) {
      try {
        const info = await scraper.getProductInfo(item.asin);
        const historyRow = HISTORY_COLUMNS.map(col => {
          switch(col) {
            case "タイムスタンプ": return timestamp;
            case "商品名": return row["商品名"];
            case "ASIN": return item.asin;
            case "商品名（Amazon）": return info.title;
            case "価格": return info.price;
            case "ベストセラーバッジ": return info.badge;
            case "小カテランキング": return info.smallRank;
            case "大カテランキング": return info.largeRank;
            case "レビュー数": return info.review;
            case "ステータス": return info.price ? "確認" : "取得失敗";
            case "スコア": return null;
            case "タイプ": return item.type;
            default: return null;
          }
        });
        historyBatch.push(historyRow.join("\t"));

        // 価格変動あればChatwork通知
        if (info.price && parseInt(info.price) < 5000) { // 例: 価格が5000未満
          await notifyChatwork(`商品: ${row["商品名"]} (${item.asin}) 価格下落: ${info.price}円`);
        }
      } catch (err) {
        console.error("商品取得エラー:", item.asin, err.message);
      }
    }
  }

  // 履歴書き込み
  if (historyBatch.length > 0) {
    await historySheet.addRows(historyBatch.map(line => {
      const vals = line.split("\t");
      const obj = {};
      HISTORY_COLUMNS.forEach((col, i) => obj[col] = vals[i]);
      return obj;
    }));
  }

  await scraper.closeBrowser();
  console.log("✅ 完了");
}

main().catch(err => console.error(err));
