const AmazonScraper = require('./amazon-scraper');
const GoogleSheetsManager = require('./google-sheets-manager');
const ChatworkNotifier = require('./chatwork-notifier');

const GOOGLE_SHEETS_ID = process.env.GOOGLE_SHEETS_ID;
const GOOGLE_SERVICE_ACCOUNT_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
const CHATWORK_API_TOKEN = process.env.CHATWORK_API_TOKEN;
const CHATWORK_ROOM_ID = process.env.CHATWORK_ROOM_ID;

async function main() {
  console.log('\n========================================');
  console.log('🚀 Amazon Product Monitor 開始');
  console.log(`⏰ ${new Date().toISOString()}`);
  console.log('========================================\n');

  if (!GOOGLE_SHEETS_ID || !GOOGLE_SERVICE_ACCOUNT_KEY || !CHATWORK_API_TOKEN || !CHATWORK_ROOM_ID) {
    console.error('❌ 環境変数が不足しています');
    process.exit(1);
  }

  const credentials = JSON.parse(GOOGLE_SERVICE_ACCOUNT_KEY);
  const sheetsManager = new GoogleSheetsManager(credentials);
  await sheetsManager.initialize(GOOGLE_SHEETS_ID);
  const notifier = new ChatworkNotifier(CHATWORK_API_TOKEN, CHATWORK_ROOM_ID);
  const scraper = new AmazonScraper();
  await scraper.initialize();

  const productConfig = await sheetsManager.getProductConfig();
  if (Object.keys(productConfig).length === 0) return;

  const allAsins = [];
  const asinToProduct = {};
  for (const [name, config] of Object.entries(productConfig)) {
    allAsins.push(config.asin);
    asinToProduct[config.asin] = { name, type: 'own' };
    for (const cAsin of config.competitors) {
      allAsins.push(cAsin);
      asinToProduct[cAsin] = { name, type: 'competitor' };
    }
  }

  const allData = await scraper.getMultipleProducts(allAsins);

  const recordsToAdd = [];
  const notifications = [];

  for (const asin of allAsins) {
    const data = allData[asin];
    if (!data) continue;

    const productInfo = asinToProduct[asin];
    const timestamp = new Date().toISOString();

    // ステータスと危険度スコア
    const status = data.bestsellerBadge === 'No' ? '⚠️ ベストセラー外れ' : 'OK';
    let dangerScore = 0;
    if (!isNaN(parseInt(data.smallCategoryRank))) {
      dangerScore += parseInt(data.smallCategoryRank) <= 20 ? 50 : 0;
    }

    recordsToAdd.push([
      timestamp,
      productInfo.name,
      asin,
      data.productName,
      data.price,
      data.bestsellerBadge,
      data.smallCategoryRank,
      data.largeCategoryRank,
      data.reviewCount,
      status,
      dangerScore
    ]);

    // 通知判定（自社商品のみ）
    if (productInfo.type === 'own') {
      const prevRecord = await sheetsManager.getLastRecord('履歴', asin);

      // ベストセラー外れ通知
      if (prevRecord && prevRecord.bestsellerBadge === 'Yes' && data.bestsellerBadge === 'No') {
        notifications.push(
          `[info][title]⚠️ ベストセラーバッジ喪失[/title]
【${productInfo.name}】のベストセラーバッジが外れました。
📊 ランキング変動: 前回 ${prevRecord.smallCategoryRank}位 → 現在 ${data.smallCategoryRank}位
⚡ 早急な対応をお勧めします。[/info]`
        );
      }

      // 競合商品接近通知
      const config = productConfig[productInfo.name];
      for (const cAsin of config.competitors) {
        const competitorData = allData[cAsin];
        if (!competitorData) continue;
        const ourRank = parseInt(data.smallCategoryRank);
        const competitorRank = parseInt(competitorData.smallCategoryRank);
        if (!isNaN(ourRank) && !isNaN(competitorRank)) {
          const diff = Math.abs(ourRank - competitorRank);
          if (diff <= 20) {
            notifications.push(
              `[info][title]⚠️ 競合商品接近[/title]
【${productInfo.name}】
🏆 当社商品: 小カテ ${ourRank}位
🔴 競合商品: 小カテ ${competitorRank}位 (${competitorData.productName})
📏 順位差: ${diff}位
競合商品が20位以内に迫っています。[/info]`
            );
          }
        }
      }
    }
  }

  // シートに記録
  if (recordsToAdd.length > 0) {
    await sheetsManager.recordBatchData('履歴', recordsToAdd);
  }

  // 通知送信
  if (notifications.length > 0) {
    console.log(`🔔 ${notifications.length}件の通知を送信`);
    await notifier.sendBatchNotifications(notifications);
  }

  console.log('✅ 処理完了');
  await scraper.close();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
