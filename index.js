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
    console.error('❌ 環境変数が不足しています。');
    process.exit(1);
  }

  let scraper = null, sheetsManager = null, notifier = null;

  try {
    // Google Sheets
    const credentials = JSON.parse(GOOGLE_SERVICE_ACCOUNT_KEY);
    sheetsManager = new GoogleSheetsManager(credentials);
    await sheetsManager.initialize(GOOGLE_SHEETS_ID);

    // Chatwork
    notifier = new ChatworkNotifier(CHATWORK_API_TOKEN, CHATWORK_ROOM_ID);

    // Amazonスクレイパー
    scraper = new AmazonScraper();
    await scraper.initialize();

    // 設定取得
    const productConfig = await sheetsManager.getProductConfig();
    if (Object.keys(productConfig).length === 0) {
      console.warn('⚠️ 監視対象の商品が見つかりません。');
      return;
    }

    const allAsins = [];
    const asinToProduct = {};
    for (const [productName, config] of Object.entries(productConfig)) {
      allAsins.push(config.asin);
      asinToProduct[config.asin] = { name: productName, type: 'own' };
      for (const competitorAsin of config.competitors) {
        allAsins.push(competitorAsin);
        asinToProduct[competitorAsin] = { name: productName, type: 'competitor' };
      }
    }

    // 商品情報取得
    const allProductData = await scraper.getMultipleProducts(allAsins);

    // データ整形・危険度スコア計算
    const recordsToAdd = [];
    for (const asin of allAsins) {
      const data = allProductData[asin];
      if (!data) continue;

      const productInfo = asinToProduct[asin];
      const timestamp = new Date().toISOString();

      // 危険度スコア: ベストセラー外れ=50, 小カテ20位以内接近=30
      let dangerScore = 0;
      let status = '正常';

      const ourData = allProductData[productConfig[productInfo.name]?.asin];
      if (ourData) {
        if (ourData.bestsellerBadge === 'No') dangerScore += 50;
        for (const competitorAsin of productConfig[productInfo.name]?.competitors || []) {
          const competitorRank = parseInt(allProductData[competitorAsin]?.smallCategoryRank);
          const ourRank = parseInt(ourData.smallCategoryRank);
          if (!isNaN(ourRank) && !isNaN(competitorRank) && Math.abs(ourRank - competitorRank) <= 20) {
            dangerScore += 30;
          }
        }
      }

      if (dangerScore >= 50) status = '危険';
      else if (dangerScore >= 30) status = '注意';

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
        dangerScore,
        status
      ]);
    }

    if (recordsToAdd.length > 0) {
      await sheetsManager.recordBatchData('履歴', recordsToAdd);
    }

    // 通知判定
    for (const [productName, config] of Object.entries(productConfig)) {
      const ourAsin = config.asin;
      const currentData = allProductData[ourAsin];
      if (!currentData) continue;

      const previousData = await sheetsManager.getLastRecord('履歴', ourAsin);

      // ベストセラーバッジ喪失
      if (previousData?.bestsellerBadge === 'Yes' && currentData.bestsellerBadge === 'No') {
        await notifier.notifyBestsellerLost(productName, currentData.smallCategoryRank, previousData.smallCategoryRank);
      }

      // 競合接近
      for (const competitorAsin of config.competitors) {
        const competitorData = allProductData[competitorAsin];
        if (!competitorData) continue;
        const ourRank = parseInt(currentData.smallCategoryRank);
        const competitorRank = parseInt(competitorData.smallCategoryRank);
        if (!isNaN(ourRank) && !isNaN(competitorRank) && Math.abs(ourRank - competitorRank) <= 20) {
          await notifier.notifyCompetitorApproaching(
            productName,
            ourRank,
            competitorRank,
            competitorData.productName,
            Math.abs(ourRank - competitorRank)
          );
        }
      }
    }

    console.log('\n✅ 完了');

  } catch (error) {
    console.error('\n❌ エラー:', error);
  } finally {
    if (scraper) await scraper.close();
  }
}

main().catch(e => console.error('Fatal error:', e));
