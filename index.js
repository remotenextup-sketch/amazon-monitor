import { GoogleSpreadsheet } from 'google-spreadsheet';
import AmazonScraper from './amazon-scraper.js';
import fetch from 'node-fetch';

const creds = JSON.parse(process.env.GOOGLE_CREDS_JSON);
const CHATWORK_TOKEN = process.env.CHATWORK_TOKEN;
const CHATWORK_ROOM_ID = process.env.CHATWORK_ROOM_ID || 'YOUR_ROOM_ID'; // ChatworkルームID

async function sendChatworkMessage(message) {
  if (!CHATWORK_TOKEN) return;
  const url = `https://api.chatwork.com/v2/rooms/${CHATWORK_ROOM_ID}/messages`;
  await fetch(url, {
    method: 'POST',
    headers: {
      'X-ChatWorkToken': CHATWORK_TOKEN,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: `body=${encodeURIComponent(message)}`
  });
}

async function main() {
  console.log('🚀 Amazon Product Monitor 開始');
  await sendChatworkMessage('Amazon Monitor 開始しました 🛒');

  try {
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID);
    await doc.useServiceAccountAuth(creds);
    await doc.loadInfo();
    console.log('✓ Google Sheets接続成功');

    const sheet = doc.sheetsByTitle['履歴'];
    const monitor = new AmazonScraper();
    const configSheet = doc.sheetsByTitle['設定'];
    const products = await configSheet.getRows();

    for (const p of products) {
      const asins = [p['自社ASIN'], p['競合ASIN1'], p['競合ASIN2']].filter(Boolean);
      for (const asin of asins) {
        const data = await monitor.getProductInfo(asin);
        await sheet.addRow({
          タイムスタンプ: new Date().toISOString(),
          商品名: p['商品名'],
          ASIN: asin,
          '商品名（Amazon）': data.title,
          価格: data.price,
          'ベストセラーバッジ': data.bestSeller,
          '小カテランキング': data.smallCategoryRank,
          '大カテランキング': data.largeCategoryRank,
          'レビュー数': data.reviews,
          ステータス: data.status,
          スコア: data.score,
          タイプ: p['自社ASIN'] === asin ? '自社' : '競合'
        });
        console.log(`✓ ${asin} 書き込み完了`);
      }
    }

    console.log('✅ すべて完了');
    await sendChatworkMessage('Amazon Monitor 完了 ✅');
  } catch (err) {
    console.error('❌ エラーが発生しました:', err);
    await sendChatworkMessage(`❌ Amazon Monitor エラー:\n${err.message}`);
  }
}

main();
