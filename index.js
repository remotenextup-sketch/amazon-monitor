import 'dotenv/config';
import GoogleSheetsManager from './google-sheets-manager.js';
import AmazonScraper from './amazon-scraper.js';
import ChatworkNotifier from './chatwork-notifier.js';

async function monitor() {
  console.log('🚀 Amazon Monitor 起動');

  let gsm;
  try {
    // SecretsからJSONをパース
    const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    
    gsm = new GoogleSheetsManager({
      client_email: serviceAccount.client_email,
      private_key: serviceAccount.private_key,
    });
  } catch (err) {
    console.error('❌ Google Service Account Key のパースに失敗しました。JSON形式が正しいか確認してください。');
    return;
  }

  const scraper = new AmazonScraper();
  const notifier = new ChatworkNotifier(
    process.env.CHATWORK_API_TOKEN,
    process.env.CHATWORK_ROOM_ID
  );

  try {
    // 2. 準備（スプレッドシート接続 ＆ ブラウザ起動）
    if (!(await gsm.initialize(process.env.GOOGLE_SHEETS_ID))) return;
    if (!(await scraper.initialize())) return;

    // 3. 設定シートから監視対象を取得
    const productsConfig = await gsm.getProductConfig();
    let allResults = [];
    let alerts = [];

    // 4. メインループ
    for (const item of productsConfig) {
      console.log(`--- 監視対象: ${item.productName} ---`);

      const targets = [
        { asin: item.ownAsin, type: '自社' },
        ...item.competitors.map(asin => ({ asin, type: '競合' }))
      ];

      for (const target of targets) {
        const data = await scraper.getProductInfo(target.asin);

        if (data) {
          const result = {
            ...data,
            asin: target.asin,
            productName: item.productName,
            type: target.type
          };
          allResults.push(result);

          // 5. 異常検知ロジック
          if (target.type === '自社' && data.bestsellerBadge === 'No') {
            alerts.push(`🚨【ベストセラー消失】${item.productName} (${target.asin})`);
          }
        }
        // 連続アクセス対策
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    // 6. 履歴の保存
    if (allResults.length > 0) {
      await gsm.recordBatchData('履歴', allResults);
    }

    // 7. Chatwork通知
    if (alerts.length > 0) {
      const message = `[info][title]Amazon Product Monitor アラート[/title]${alerts.join('\n')}[/info]`;
      await notifier.sendMessage(message);
    }

  } catch (error) {
    console.error('❌ メインプロセスでエラー発生:', error);
  } finally {
    await scraper.close();
    console.log('🏁 すべてのプロセスが終了しました');
  }
}

monitor();
