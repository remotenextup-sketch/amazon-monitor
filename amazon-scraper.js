const { chromium } = require('playwright');

/**
 * Amazon商品スクレイパークラス
 */
class AmazonScraper {
  constructor() {
    this.browser = null;
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
  }

  /**
   * ブラウザを初期化
   */
  async initialize() {
    try {
      this.browser = await chromium.launch({
        headless: true,
        args: ['--disable-blink-features=AutomationControlled']
      });
      console.log('✓ Playwrightブラウザ起動');
      return true;
    } catch (error) {
      console.error('✗ ブラウザ起動失敗:', error.message);
      return false;
    }
  }

  /**
   * ブラウザを終了
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('✓ ブラウザ終了');
    }
  }

  /**
   * 商品情報を取得
   */
  async getProductInfo(asin) {
    const context = await this.browser.newContext({
      userAgent: this.userAgent,
      viewport: { width: 1280, height: 800 }
    });
    const page = await context.newPage();

    try {
      const url = `https://www.amazon.co.jp/dp/${asin}`;
      console.log(`📍 アクセス: ${url}`);

      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);

      // 商品情報を抽出
      const productData = await page.evaluate(() => {
        const getText = (selector) => {
          const el = document.querySelector(selector);
          return el?.textContent?.trim() || null;
        };

        // 商品名
        const productName = getText('#productTitle') || 'N/A';

        // 価格
        const priceEl = document.querySelector('#priceblock_ourprice, #priceblock_dealprice, .a-price .a-offscreen');
        const price = priceEl?.textContent.replace(/[^0-9]/g,'') || 'N/A';

        // ベストセラーバッジ
        const bestsellerBadge = Array.from(document.querySelectorAll('span')).some(el => el.textContent.includes('ベストセラー')) ? 'Yes' : 'No';

        // レビュー数
        const reviewCountEl = document.querySelector('#acrCustomerReviewText');
        const reviewCount = reviewCountEl?.textContent.replace(/[^0-9]/g,'') || '0';

        // ランキング情報
        let smallCategoryRank = 'N/A';
        let largeCategoryRank = 'N/A';
        const rankingTextEl = document.querySelector('#detailBulletsWrapper_feature_div, #productDetails_detailBullets_sections1');
        const rankingText = rankingTextEl?.textContent || '';
        const rankMatches = rankingText.match(/#([\d,]+)\s+in\s+(.+?)(?:\n|#|$)/g);
        if (rankMatches?.length) {
          smallCategoryRank = rankMatches[0].match(/#([\d,]+)/)?.[1] || 'N/A';
          if (rankMatches[1]) largeCategoryRank = rankMatches[1].match(/#([\d,]+)/)?.[1] || 'N/A';
        }

        return {
          productName,
          price,
          bestsellerBadge,
          reviewCount,
          smallCategoryRank,
          largeCategoryRank
        };
      });

      console.log(`✓ 抽出成功: ${productData.productName}`);
      return productData;
    } catch (error) {
      console.error(`✗ 抽出失敗 (${asin}):`, error.message);
      return null;
    } finally {
      await context.close();
    }
  }

  /**
   * 複数の商品情報を取得
   */
  async getMultipleProducts(asins) {
    const results = {};
    
    for (const asin of asins) {
      const data = await this.getProductInfo(asin);
      if (data) results[asin] = data;
      // リクエスト制限対策：2秒待機
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return results;
  }
}

module.exports = AmazonScraper;
