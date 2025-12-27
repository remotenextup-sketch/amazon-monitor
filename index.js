import 'dotenv/config';
import GoogleSheetsManager from './google-sheets-manager.js';
import AmazonScraper from './amazon-scraper.js';
import ChatworkNotifier from './chatwork-notifier.js';

async function monitor() {
  console.log('🚀 Amazon Monitor 起動');

  // 1. 各クラスの初期化
  const gsm = new GoogleSheetsManager({
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  });

  const scraper = new AmazonScraper();
  const notifier = new ChatworkNotifier(
    process.env.CHATWORK_API_TOKEN,
    process.env.CHATWORK_ROOM_ID
  );

  try {
    // 2. 準備（スプレッドシート接続 ＆ ブラウザ起動）
    if (!(await gsm.initialize(process.env.GOOGLE_SHEET_ID))) return;
    if (!(await scraper.initialize())) return;

    // 3. 設定シートから監視対象を取得
    const productsConfig = await gsm.getProductConfig();
    let allResults = [];
    let alerts = [];

    // 4. メインループ
    for (const item of productsConfig) {
      console.log(`--- 監視対象: ${item.productName} ---`);

      // 自社と競合をまとめる
      const targets = [
        { asin: item.ownAsin, type: '自社' },
        ...item.competitors.map(asin => ({ asin, type: '競合' }))
      ];

      for (const target of targets) {
        // AmazonScraper.js の高度な取得ロジックを使用
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
            // スプレッドシート側の「前回の状態」と比較して通知するのが理想ですが、
            // まずは「バッジがない＝アラート」として処理
            alerts.push(`🚨【ベストセラー消失】${item.productName} (${target.asin})`);
          }

          // 競合が安すぎる場合の例（必要に応じて）
          if (target.type === '競合' && parseInt(data.price) < 1000 && data.price !== '0') {
            alerts.push(`💰【安値警告】競合が1000円を切りました: ${target.asin}`);
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
    // 8. 後片付け
    await scraper.close();
    console.log('🏁 すべてのプロセスが終了しました');
  }
}

monitor();
