// index.js
const AmazonScraper = require('./amazon-scraper');
const GoogleSheetsManager = require('./google-sheets-manager');
const ChatworkNotifier = require('./chatwork-notifier');

// 環境変数
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

  let scraper = null;
  let sheetsManager = null;
  let notifier = null;

  try {
    // 初期化
    console.log('📝 初期化中...\n');

    const credentials = JSON.parse(GOOGLE_SERVICE_ACCOUNT_KEY);
    sheetsManager = new GoogleSheetsManager(credentials);
    await sheetsManager.initialize(GOOGLE_SHEETS_ID);

    notifier = new ChatworkNotifier(CHATWORK_API_TOKEN, CHATWORK_ROOM_ID);

    scraper = new AmazonScraper();
    const browserOk = await scraper.initialize();
    if (!browserOk) {
      console.error('✗ ブラウザ起動失敗。処理を中断します');
      return;
    }

    console.log('\n📋 設定を読み込み中...');
    const productConfig = await sheetsManager.getProductConfig();
    if (Object.keys(productConfig).length === 0) {
      console.warn('⚠️ 監視対象の商品がありません');
      return;
    }
    console.log(`✓ ${Object.keys(productConfig).length}商品を検出\n`);

    // ASINリスト作成
    const allAsins = [];
    const asinToProduct = {};
    for (const [productName, config] of Object.entries(productConfig)) {
      if (config.active !== 'TRUE') continue; // Active チェック

      allAsins.push(config.ownAsin);
      asinToProduct[config.ownAsin] = { name: productName, type: '自社' };

      for (const competitorAsin of config.competitors) {
        if (!competitorAsin) continue;
        allAsins.push(competitorAsin);
        asinToProduct[competitorAsin] = { name: productName, type: '競合' };
      }
    }

    // 商品情報取得
    console.log('🔍 Amazon から商品情報を取得中...\n');
    const allProductData = await scraper.getMultipleProducts(allAsins);

    // Google Sheetsに記録
    console.log('\n💾 Google Sheets に記録中...\n');
    const recordsToAdd = [];
    for (const asin of allAsins) {
      if (!allProductData[asin]) continue;
      const productInfo = asinToProduct[asin];
      const data = allProductData[asin];

      const record = [
        new Date().toISOString(),
        productInfo.name,
        asin,
        data.productName,
        data.price,
        data.bestsellerBadge,
        data.smallCategoryRank,
        data.largeCategoryRank,
        data.reviewCount,
        '', // ステータス空欄
        '', // スコア空欄
        productInfo.type
      ];
      recordsToAdd.push(record);
    }

    if (recordsToAdd.length > 0) {
      await sheetsManager.recordBatchData('履歴', recordsToAdd);
    }

    // 通知チェック
    console.log('\n🔔 通知条件をチェック中...\n');
    for (const [productName, config] of Object.entries(productConfig)) {
      if (config.active !== 'TRUE') continue;

      const ownAsin = config.ownAsin;
      const currentData = allProductData[ownAsin];
      if (!currentData) continue;

      const previousData = await sheetsManager.getLastRecord('履歴', ownAsin);

      // ベストセラーバッジ喪失
      if (previousData && previousData.bestsellerBadge === 'Yes' && currentData.bestsellerBadge === 'No') {
        await notifier.notifyBestsellerLost(
          productName,
          currentData.smallCategoryRank,
          previousData.smallCategoryRank
        );
      }

      // 競合接近チェック
      for (const competitorAsin of config.competitors) {
        if (!competitorAsin) continue;
        const competitorData = allProductData[competitorAsin];
        if (!competitorData) continue;

        const ourRank = parseInt(currentData.smallCategoryRank);
        const competitorRank = parseInt(competitorData.smallCategoryRank);

        if (!isNaN(ourRank) && !isNaN(competitorRank)) {
          const rankDiff = Math.abs(ourRank - competitorRank);
          if (rankDiff <= 20) {
            await notifier.notifyCompetitorApproaching(
              productName,
              ourRank,
              competitorRank,
              competitorData.productName,
              rankDiff
            );
          }
        }
      }
    }

    console.log('\n✅ 処理完了\n');

  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
  } finally {
    if (scraper) await scraper.close();
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
