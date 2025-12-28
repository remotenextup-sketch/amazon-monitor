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
      await page.goto(url, { waitUntil: 'load', timeout: 60000 });
      await page.waitForTimeout(2000);

      const data = await page.evaluate(() => {
        const getT = (s) => document.querySelector(s)?.innerText.trim() || '';
        
        // 1. 価格・レビュー
        const price = getT('.a-price-whole').replace(/[^0-9]/g, '') || '0';
        const reviewCount = getT('#acrCustomerReviewText').replace(/[^0-9]/g, '') || '0';
        
        // 2. ベストセラー
        const isBS = !!document.querySelector('.badge-link') || document.body.innerText.includes('ベストセラー');

        // 3. ランキング抽出 (大・小カテゴリ)
        const bodyText = document.body.innerText;
        const rankMatch = bodyText.match(/Amazon 売れ筋ランキング:?\s*([^\n]+)/);
        let bigRank = '', smallRank = '';
        
        if (rankMatch) {
          const lines = bodyText.split('\n');
          const rankLine = lines.find(l => l.includes(' - ') && l.includes('位'));
          if (rankLine) {
            const parts = rankLine.split(' - ');
            bigRank = parts[0].replace(/[^0-9]/g, '') + '位';
            smallRank = (parts[1] || '').replace(/[^0-9]/g, '') + '位';
          }
        }

        return {
          productName: getT('#productTitle'),
          price: price,
          bestsellerBadge: isBS ? 'Yes' : 'No',
          reviewCount: reviewCount,
          bigRank: bigRank,
          smallRank: smallRank
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
