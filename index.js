const AmazonScraper = require('./amazon-scraper');
const GoogleSheetsManager = require('./google-sheets-manager');
const ChatworkNotifier = require('./chatwork-notifier');

// 環境変数から設定を読み込み
const GOOGLE_SHEETS_ID = process.env.GOOGLE_SHEETS_ID;
const GOOGLE_SERVICE_ACCOUNT_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
const CHATWORK_API_TOKEN = process.env.CHATWORK_API_TOKEN;
const CHATWORK_ROOM_ID = process.env.CHATWORK_ROOM_ID;

/**
 * メイン処理
 */
async function main() {
  console.log('\n========================================');
  console.log('🚀 Amazon Product Monitor 開始');
  console.log(`⏰ ${new Date().toISOString()}`);
  console.log('========================================\n');

  // 環境変数の確認
  if (!GOOGLE_SHEETS_ID || !GOOGLE_SERVICE_ACCOUNT_KEY || !CHATWORK_API_TOKEN || !CHATWORK_ROOM_ID) {
    console.error('❌ 環境変数が不足しています。以下を確認してください：');
    console.error('  - GOOGLE_SHEETS_ID');
    console.error('  - GOOGLE_SERVICE_ACCOUNT_KEY');
    console.error('  - CHATWORK_API_TOKEN');
    console.error('  - CHATWORK_ROOM_ID');
    process.exit(1);
  }

  let scraper = null;
  let sheetsManager = null;
  let notifier = null;

  try {
    // 初期化
    console.log('📝 初期化中...\n');

    // Google Sheetsマネージャーを初期化
    const credentials = JSON.parse(GOOGLE_SERVICE_ACCOUNT_KEY);
    sheetsManager = new GoogleSheetsManager(credentials);
    await sheetsManager.initialize(GOOGLE_SHEETS_ID);

    // Chatwork通知を初期化
    notifier = new ChatworkNotifier(CHATWORK_API_TOKEN, CHATWORK_ROOM_ID);

    // Amazon スクレイパーを初期化
    scraper = new AmazonScraper();
    await scraper.initialize();

    // 設定から商品情報を取得
    console.log('\n📋 設定を読み込み中...');
    const productConfig = await sheetsManager.getProductConfig();

    if (Object.keys(productConfig).length === 0) {
      console.warn('⚠️  監視対象の商品が見つかりません。設定シートを確認してください。');
      return;
    }

    console.log(`✓ ${Object.keys(productConfig).length}個の商品を検出\n`);

    // すべてのASINを収集
    const allAsins = [];
    const asinToProduct = {}; // ASIN → 商品情報のマッピング

    for (const [productName, config] of Object.entries(productConfig)) {
      allAsins.push(config.asin);
      asinToProduct[config.asin] = {
        name: productName,
        type: 'own'
      };

      for (const competitorAsin of config.competitors) {
        allAsins.push(competitorAsin);
        asinToProduct[competitorAsin] = {
          name: productName,
          type: 'competitor'
        };
      }
    }

    // 商品情報を取得
    console.log('🔍 Amazon から商品情報を取得中...\n');
    const allProductData = await scraper.getMultipleProducts(allAsins);

    // データをGoogle Sheetsに記録
    console.log('\n💾 Google Sheets に記録中...\n');
    const recordsToAdd = [];

    for (const asin of allAsins) {
      if (allProductData[asin]) {
        const productInfo = asinToProduct[asin];
        const data = allProductData[asin];
        const timestamp = new Date().toISOString();

        const record = [
          timestamp,
          productInfo.name,
          asin,
          data.productName,
          data.price,
          data.bestsellerBadge,
          data.smallCategoryRank,
          data.largeCategoryRank,
          data.reviewCount
        ];

        recordsToAdd.push(record);
      }
    }

    if (recordsToAdd.length > 0) {
      await sheetsManager.recordBatchData('履歴', recordsToAdd);
    }

    // 通知判定
    console.log('\n🔔 通知条件をチェック中...\n');
    const notifications = [];

    for (const [productName, config] of Object.entries(productConfig)) {
      const ownAsin = config.asin;
      const currentData = allProductData[ownAsin];

      if (!currentData) continue;

      // 前回のデータを取得
      const previousData = await sheetsManager.getLastRecord('履歴', ownAsin);

      // ベストセラーバッジが外れた場合
      if (previousData && previousData.bestsellerBadge === 'Yes' && currentData.bestsellerBadge === 'No') {
        console.log(`⚠️  【${productName}】ベストセラーバッジが外れました`);
        await notifier.notifyBestsellerLost(
          productName,
          currentData.smallCategoryRank,
          previousData.smallCategoryRank
        );
      }

      // 競合商品のランキングをチェック
      for (const competitorAsin of config.competitors) {
        const competitorData = allProductData[competitorAsin];
        if (!competitorData) continue;

        const ourRank = parseInt(currentData.smallCategoryRank);
        const competitorRank = parseInt(competitorData.smallCategoryRank);

        if (!isNaN(ourRank) && !isNaN(competitorRank)) {
          const rankDifference = Math.abs(ourRank - competitorRank);

          if (rankDifference <= 20) {
            console.log(`⚠️  【${productName}】競合商品が接近 (順位差: ${rankDifference}位)`);
            await notifier.notifyCompetitorApproaching(
              productName,
              ourRank,
              competitorRank,
              competitorData.productName,
              rankDifference
            );
          }
        }
      }
    }

    console.log('\n✅ 処理完了\n');

  } catch (error) {
    console.error('\n❌ エラーが発生しました:', error);
    process.exit(1);
  } finally {
    // クリーンアップ
    if (scraper) {
      await scraper.close();
    }
  }
}

// エラーハンドリング
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
