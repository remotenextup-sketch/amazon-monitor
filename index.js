// index.js
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
  for (const asin of allAsins) {
    const data = allData[asin];
    if (!data) continue;

    const productInfo = asinToProduct[asin];
    const timestamp = new Date().toISOString();

    // ステータスと危険度スコアを簡易計算
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
  }

  if (recordsToAdd.length > 0) {
    await sheetsManager.recordBatchData('履歴', recordsToAdd);
  }

  console.log('✅ データ記録完了');
  await scraper.close();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
