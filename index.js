// index.js
import { GoogleSpreadsheet } from 'google-spreadsheet';
import playwright from 'playwright';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

// ==== 環境変数 ====
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID;
const CHATWORK_TOKEN = process.env.CHATWORK_TOKEN;
const CHATWORK_ROOM_ID = process.env.CHATWORK_ROOM_ID;

// ==== Google認証情報 ====
const CREDENTIALS = JSON.parse(fs.readFileSync(path.resolve('./credentials.json')));

// ==== Amazon 商品スクレイパー ====
class AmazonScraper {
  constructor() {}
  
  async initBrowser() {
    this.browser = await playwright.chromium.launch({ headless: true });
    this.context = await this.browser.newContext();
    this.page = await this.context.newPage();
  }

  async closeBrowser() {
    await this.browser.close();
  }

  async getProductInfo(asin) {
    const url = `https://www.amazon.co.jp/dp/${asin}`;
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    const title = await this.page.locator('#productTitle').textContent().catch(() => '');
    const price = await this.page.locator('.a-price .a-offscreen').first().textContent().catch(() => '');
    const rating = await this.page.locator('span[data-hook="rating-out-of-text"]').textContent().catch(() => '');
    const reviews = await this.page.locator('#acrCustomerReviewText').textContent().catch(() => '');
    return { title: title?.trim(), price: price?.trim(), rating: rating?.trim(), reviews: reviews?.trim() };
  }
}

// ==== Google Spreadsheet 操作 ====
async function updateSheet(products) {
  const doc = new GoogleSpreadsheet(SPREADSHEET_ID);
  await doc.useServiceAccountAuth(CREDENTIALS);
  await doc.loadInfo();
  const sheet = doc.sheetsByTitle['履歴'];
  
  const rows = products.map(p => ({
    'タイムスタンプ': new Date().toISOString(),
    '商品名': p.name,
    'ASIN': p.asin,
    '商品名（Amazon）': p.info.title || '',
    '価格': p.info.price || '',
    'レビュー数': p.info.reviews || '',
    'ステータス': p.status || '',
    'スコア': p.score || '',
    'タイプ': p.type || ''
  }));
  
  await sheet.addRows(rows);
}

// ==== Chatwork 通知 ====
async function sendChatworkMessage(message) {
  if (!CHATWORK_TOKEN || !CHATWORK_ROOM_ID) return;
  await fetch(`https://api.chatwork.com/v2/rooms/${CHATWORK_ROOM_ID}/messages`, {
    method: 'POST',
    headers: {
      'X-ChatWorkToken': CHATWORK_TOKEN,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: `body=${encodeURIComponent(message)}`
  });
}

// ==== メイン ====
(async () => {
  console.log('🚀 Amazon Product Monitor 開始');
  const scraper = new AmazonScraper();
  await scraper.initBrowser();

  // ここで設定シートから自社・競合ASINを取得する想定
  const products = [
    { name: '自社商品A', asin: 'B000123456', type: '自社' },
    { name: '競合商品X', asin: 'B000654321', type: '競合' }
  ];

  for (let p of products) {
    try {
      p.info = await scraper.getProductInfo(p.asin);
      p.status = '取得成功';
      p.score = 100; // 適当にスコア計算
    } catch (err) {
      p.status = '取得失敗';
      p.score = 0;
    }
  }

  await updateSheet(products);
  await sendChatworkMessage('Amazon Monitor 完了 ✅');

  await scraper.closeBrowser();
})();
