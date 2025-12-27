import { GoogleSpreadsheet } from 'google-spreadsheet';
import playwright from 'playwright';
import fetch from 'node-fetch';

console.log('========================================');
console.log('🚀 Amazon Product Monitor 開始');
console.log('========================================');

try {
  // Google Sheets 初期化
  const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID);
  await doc.useServiceAccountAuth({
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
  });
  await doc.loadInfo();
  console.log(`📄 Loaded sheet: ${doc.title}`);

  // Amazon Monitor 処理
  const browser = await playwright.chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://www.amazon.co.jp/');
  console.log('✅ Amazonページを開きました');

  // ここに商品監視ロジック（例: 商品URL取得・価格チェック）を追加
  // 例:
  // const price = await page.locator('セレクタ').innerText();
  // console.log(`価格: ${price}`);

  await browser.close();

  // Chatwork通知例（APIトークンは secrets に設定）
  if (process.env.CHATWORK_API_TOKEN && process.env.CHATWORK_ROOM_ID) {
    const message = `[info][title]Amazon Monitor[/title]監視完了[/info]`;
    await fetch(`https://api.chatwork.com/v2/rooms/${process.env.CHATWORK_ROOM_ID}/messages`, {
      method: 'POST',
      headers: {
        'X-ChatWorkToken': process.env.CHATWORK_API_TOKEN,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `body=${encodeURIComponent(message)}`
    });
    console.log('📩 Chatworkに通知しました');
  }

  console.log('========================================');
  console.log('🚀 完了');
  console.log('========================================');

} catch (error) {
  console.error('❌ エラーが発生しました:', error);
  process.exit(1);
}
