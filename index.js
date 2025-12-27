import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import playwright from 'playwright';
import fetch from 'node-fetch';

console.log('========================================');
console.log('🚀 Amazon Product Monitor 開始');
console.log('========================================');

async function run() {
  try {
    // 1. Google Sheets 認証設定 (v4以降の書き方)
    const serviceAccountAuth = new JWT({
      email: process.env.GOOGLE_CLIENT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();
    console.log(`📄 Loaded sheet: ${doc.title}`);
    const sheet = doc.sheetsByIndex[0]; // 最初のシートを取得

    // 2. ブラウザ起動 (Stealthに近い設定)
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    // 3. 商品チェックロジック (例: スプレッドシートからASINを読み込む場合)
    const rows = await sheet.getRows();
    let notifications = [];

    for (const row of rows) {
      const asin = row.get('ASIN'); // シートに「ASIN」列がある前提
      if (!asin) continue;

      console.log(`🔎 Checking ASIN: ${asin}`);
      await page.goto(`https://www.amazon.co.jp/dp/${asin}`, { waitUntil: 'networkidle', timeout: 60000 });

      // ベストセラーバッジと価格の取得
      const data = await page.evaluate(() => {
        const bBadge = !!document.querySelector('.badge-link, .p13n-best-seller-badge');
        const pElem = document.querySelector('.a-price-whole');
        return {
          hasBestSeller: bBadge,
          price: pElem ? pElem.innerText.replace(/[^0-9]/g, '') : '取得失敗'
        };
      });

      // 異常判定 (例: 前回の価格やバッジ状態と比較)
      if (!data.hasBestSeller && row.get('LastBestSeller') === 'TRUE') {
        notifications.push(`⚠️ 【ベストセラー消失】${asin}`);
      }
      
      // シートを更新
      row.set('CurrentPrice', data.price);
      row.set('LastBestSeller', data.hasBestSeller ? 'TRUE' : 'FALSE');
      await row.save();
      
      await page.waitForTimeout(2000); // 連続アクセス対策
    }

    await browser.close();

    // 4. Chatwork通知
    if (notifications.length > 0 && process.env.CHATWORK_API_TOKEN) {
      const bodyText = `[info][title]Amazon 異常検知[/title]${notifications.join('\n')}[/info]`;
      const params = new URLSearchParams();
      params.append('body', bodyText);

      await fetch(`https://api.chatwork.com/v2/rooms/${process.env.CHATWORK_ROOM_ID}/messages`, {
        method: 'POST',
        headers: {
          'X-ChatWorkToken': process.env.CHATWORK_API_TOKEN,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params
      });
      console.log('📩 Chatworkに通知しました');
    }

    console.log('✅ すべての処理が完了しました');

  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    process.exit(1);
  }
}

run();
