import { chromium } from 'playwright';

export default class AmazonScraper {
  constructor() {
    this.browser = null;
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
  }

  async initialize() {
    try {
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
      });
      return true;
    } catch (e) { return false; }
  }

  async getProductInfo(asin) {
    const context = await this.browser.newContext({ userAgent: this.userAgent, locale: 'ja-JP' });
    const page = await context.newPage();
    const url = `https://www.amazon.co.jp/dp/${asin}`;

    try {
      console.log(`📡 商品ページ解析中: ${asin}`);
      await page.goto(url, { waitUntil: 'load', timeout: 60000 });
      await page.waitForTimeout(2000);

      const data = await page.evaluate(() => {
        const getT = (s) => document.querySelector(s)?.innerText.trim() || '';
        
        // 価格
        const price = getT('.a-price-whole').replace(/[^0-9]/g, '') || '0';
        // レビュー数
        const reviews = getT('#acrCustomerReviewText').replace(/[^0-9]/g, '') || '0';
        // ベストセラー
        const isBestseller = !!document.querySelector('.badge-link') || document.body.innerText.includes('ベストセラー');
        // ランキング（大・小をテキストから抽出）
        const rankText = document.querySelector('#detailBullets_feature_div')?.innerText || document.querySelector('#productDetails_db_sections')?.innerText || '';

        return {
          productName: getT('#productTitle'),
          price: price,
          bestsellerBadge: isBestseller ? 'Yes' : 'No',
          reviewCount: reviews,
          rankText: rankText
        };
      });

      return data;
    } catch (error) {
      return null;
    } finally {
      await page.close();
      await context.close();
    }
  }

  async close() { if (this.browser) await this.browser.close(); }
}
