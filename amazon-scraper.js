const { chromium } = require('playwright');

/**
 * Amazon商品スクレイパークラス（安全版）
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
      this.browser = null;
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
    if (!this.browser) {
      console.error(`✗ ブラウザ未初期化のため商品情報取得不可 (ASIN: ${asin})`);
      return null;
    }

    // Playwright 1.18以上の場合は createContext、古い場合は newContext
    const contextFn = typeof this.browser.newContext === 'function'
      ? this.browser.newContext.bind(this.browser)
      : this.browser.createContext.bind(this.browser);

    const context = await contextFn({ userAgent: this.userAgent });
    const page = await context.newPage();

    try {
      const url = `https://www.amazon.co.jp/dp/${asin}`;
      console.log(`📍 アクセス: ${url}`);

      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);

      const productData = await page.evaluate(() => {
        const productNameElement = document.querySelector('h1 span');
        const productName = productNameElement?.textContent?.trim() || 'N/A';

        const priceElement = document.querySelector('.a-price-whole');
        const price = priceElement?.textContent?.replace(/[^0-9]/g, '') || 'N/A';

        const bestsellerElements = Array.from(document.querySelectorAll('*')).filter(el =>
          el.textContent.includes('ベストセラー')
        );
        const bestsellerBadge = bestsellerElements.length > 0 ? 'Yes' : 'No';

        const reviewElement = document.querySelector('[data-hook="total-review-count"]');
        const reviewCount = reviewElement?.textContent?.match(/\d+/)?.[0] || '0';

        let smallCategoryRank = 'N/A';
        let largeCategoryRank = 'N/A';
        const rankingTexts = [];

        const rankElements = document.querySelectorAll('[data-feature-name="rank"]');
        rankElements.forEach(el => rankingTexts.push(el.textContent));

        const allElements = document.querySelectorAll('*');
        allElements.forEach(el => {
          if (el.textContent.includes('ランキング') && el.textContent.length < 200) {
            rankingTexts.push(el.textContent);
          }
        });

        const rankMatches = rankingTexts.join(' ').match(/#(\d+)/g);
        if (rankMatches && rankMatches.length > 0) {
          smallCategoryRank = rankMatches[0].replace('#', '');
          if (rankMatches.length > 1) largeCategoryRank = rankMatches[1].replace('#', '');
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
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    return results;
  }
}

module.exports = AmazonScraper;
