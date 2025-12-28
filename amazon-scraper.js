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
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      return true;
    } catch (e) {
      console.error('ブラウザ起動失敗:', e);
      return false;
    }
  }

  async getProductInfo(asin, searchUrl) {
    const context = await this.browser.newContext({ userAgent: this.userAgent, locale: 'ja-JP' });
    const page = await context.newPage();

    try {
      console.log(`📡 検索中: ${searchUrl}`);
      await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(3000); // 描画を待つ

      let productData = await page.evaluate((targetAsin) => {
        // 全ての商品タイル（広告枠含む）を広く取得
        const cards = Array.from(document.querySelectorAll('.s-result-item, [data-component-type="s-search-result"], .s-card-container'));
        
        // 枠内のHTMLにターゲットASINが含まれているものを探す
        const item = cards.find(el => el.innerHTML.includes(targetAsin));
        
        if (!item) return null;

        // 値を取得するための汎用関数
        const getT = (parent, selectors) => {
          for (const s of selectors) {
            const el = parent.querySelector(s);
            if (el && el.innerText.trim()) return el.innerText.trim();
          }
          return '';
        };

        return {
          productName: getT(item, ['h2 a span', '.a-size-medium', '.a-size-base-plus']) || 'N/A',
          price: getT(item, ['.a-price-whole'])?.replace(/[^0-9]/g, '') || '0',
          bestsellerBadge: (item.querySelector('.a-badge-text') || item.innerText.includes('ベストセラー')) ? 'Yes' : 'No',
          reviewCount: getT(item, ['span.a-size-base.s-underline-text', '.a-size-small .a-size-base'])?.replace(/[^0-9]/g, '') || '0'
        };
      }, asin);

      // バックアップ：見つからない場合は個別ページへ
      if (!productData) {
        console.log(`⚠️ 検索結果に見当たらないため、個別ページを試行: ${asin}`);
        await page.goto(`https://www.amazon.co.jp/dp/${asin}`, { waitUntil: 'load' });
        await page.waitForTimeout(2000);
        
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

      return productData;

    } catch (error) {
      console.error(`✗ エラー発生 (${asin}):`, error.message);
      return null;
    } finally {
      await page.close();
      await context.close();
    }
  }

  async close() {
    if (this.browser) await this.browser.close();
  }
}
