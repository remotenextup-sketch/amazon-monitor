import { GoogleSpreadsheet } from 'google-spreadsheet';
import fetch from 'node-fetch';
import { chromium } from 'playwright';
import dotenv from 'dotenv';
dotenv.config();

// Google Sheets 初期化
const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID);
await doc.useServiceAccountAuth({
  client_email: process.env.GOOGLE_CLIENT_EMAIL,
  private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
});
await doc.loadInfo();

// Amazon 商品監視
async function monitorAmazon() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // ここで商品URLリストを読み込む
  const sheet = doc.sheetsByIndex[0];
  await sheet.loadCells('A1:A10'); // 仮

  for (let i = 0; i < 10; i++) {
    const url = sheet.getCell(i, 0).value;
    if (!url) continue;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const price = await page.$eval('#priceblock_ourprice', el => el.innerText).catch(() => 'N/A');

    console.log(`URL: ${url}, Price: ${price}`);

    // Chatwork通知
    await fetch(`https://api.chatwork.com/v2/rooms/${process.env.CHATWORK_ROOM_ID}/messages`, {
      method: 'POST',
      headers: {
        'X-ChatWorkToken': process.env.CHATWORK_TOKEN,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `body=Amazon Monitor: ${url} Price=${price}`
    });
  }

  await browser.close();
}

monitorAmazon().catch(console.error);
