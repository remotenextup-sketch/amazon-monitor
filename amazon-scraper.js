// amazon-scraper.js
import { chromium } from 'playwright';

export default class AmazonScraper {
  constructor() {
    this.browser = null;
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
  }

  async initialize() {
    this.browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    return true;
  }

  async getProductInfo(asin, searchUrl) {
    const context = await this.browser.newContext({ userAgent: this.userAgent, locale: 'ja-JP' });
    const page = await context.newPage();

    try {
      console.log(`📡 検索中: ${searchUrl}`);
      await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(2000);

      let productData = await page.evaluate((targetAsin) => {
        const items = Array.from(document.querySelectorAll('[data-asin]'));
        const item = items.find(el => el.getAttribute('data-asin')?.toUpperCase() === targetAsin.toUpperCase());
        if (!item) return null;

        return {
          productName: item.querySelector('h2 a span')?.innerText.trim() || 'N/A',
          price: item.querySelector('.a-price-whole')?.innerText.replace(/[^0-9]/g, '') || '0',
          bestsellerBadge: item.innerText.includes('ベストセラー') ? 'Yes' : 'No',
          reviewCount: item.querySelector('span.a-size-base.s-underline-text')?.innerText.replace(/[^0-9]/g, '') || '0'
        };
      }, asin);

      // 💡 1ページ目に見つからない場合、直接商品ページへ（バックアップ）
      if (!productData) {
        console.log(`⚠️ 検索結果に不在のため直行します: https://www.amazon.co.jp/dp/${asin}`);
        await page.goto(`https://www.amazon.co.jp/dp/${asin}`, { waitUntil: 'load' });
        
        productData = await page.evaluate(() => {
          const title = document.querySelector('#productTitle')?.innerText.trim();
          if (!title || title.includes('Robot Check')) return null;

          return {
            productName: title,
            price: document.querySelector('.a-price-whole')?.innerText.replace(/[^0-9]/g, '') || '0',
            bestsellerBadge: document.body.innerText.includes('ベストセラー') ? 'Yes' : 'No',
            reviewCount: document.querySelector('#acrCustomerReviewText')?.innerText.replace(/[^0-9]/g, '') || '0'
          };
        });
      }

      return productData || { productName: '取得失敗(要確認)', price: '0', bestsellerBadge: 'No', reviewCount: '0' };

    } catch (error) {
      return { productName: 'エラー', price: '0', bestsellerBadge: 'No', reviewCount: '0' };
    } finally {
      await page.close();
      await context.close();
    }
  }

  async close() { if (this.browser) await this.browser.close(); }
}
