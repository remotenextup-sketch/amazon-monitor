// index.js
import { google } from 'googleapis';
import dotenv from 'dotenv';
import AmazonScraper from './amazon-scraper.js';

dotenv.config();

const SHEETS_ID = process.env.GOOGLE_SHEETS_ID;

(async () => {
  console.log('🚀 Amazon Product Monitor 開始', new Date().toISOString());

  // Google Sheets 初期化
  let sheets;
  try {
    const credentials = JSON.parse(
      process.env.GOOGLE_SERVICE_ACCOUNT_KEY.replace(/\\n/g, '\n')
    );
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    sheets = google.sheets({ version: 'v4', auth });
    console.log('✓ Google Sheets接続成功');
  } catch (err) {
    console.error('❌ Google Sheets接続エラー:', err);
    process.exit(1);
  }

  // 設定シート読み込み
  const getSettings = async () => {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEETS_ID,
      range: '設定!A2:F',
    });
    return (res.data.values || []).map(row => ({
      name: row[0],
      selfASIN: row[1],
      competitorASINs: [row[2], row[3]].filter(Boolean),
      active: row[4] === 'TRUE',
      type: row[5] || '自社',
    }));
  };

  // 履歴追記
  const appendHistory = async (data) => {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEETS_ID,
      range: '履歴!A1',
      valueInputOption: 'RAW',
      requestBody: { values: data },
    });
  };

  // Amazon Scraper 初期化
  const scraper = new AmazonScraper();

  try {
    const settings = await getSettings();

    const allResults = [];

    for (const s of settings) {
      if (!s.active) continue;

      const asins = [s.selfASIN, ...s.competitorASINs];

      for (const asin of asins) {
        const type = asin === s.selfASIN ? '自社' : '競合';
        const info = await scraper.getProductInfo(asin);

        const row = [
          new Date().toISOString(),
          s.name,
          asin,
          info.title || '',
          info.price || '',
          info.bestsellerBadge || '',
          info.smallRank || '',
          info.largeRank || '',
          info.reviewCount || '',
          info.status || '',
          info.score || '',
          type
        ];

        allResults.push(row);
      }
    }

    if (allResults.length > 0) await appendHistory(allResults);

    console.log(`✅ ${allResults.length} 件のデータを履歴シートに追記`);
  } catch (err) {
    console.error('❌ 処理エラー:', err);
  }
})();
