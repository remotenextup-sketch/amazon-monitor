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
    } catch (e) {
      console.error('ブラウザ起動失敗:', e);
      return false;
    }
  }

  async getProductInfo(asin, searchUrl) {
    const context = await this.browser.newContext({ userAgent: this.userAgent, locale: 'ja-JP' });
    const page = await context.newPage();

    try {
      console.log(`📡 アクセス中: ${searchUrl}`);
      await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(3000); // 描画待ち

      const productData = await page.evaluate((targetAsin) => {
        // 全ての商品ブロックを取得
        const items = Array.from(document.querySelectorAll('[data-asin]'));
        // 指定したASINと一致するタイルを探す
        const item = items.find(el => el.getAttribute('data-asin')?.toUpperCase() === targetAsin.toUpperCase());

        if (!item) return null;

        // --- 検索結果画面専用のセレクタ ---
        const titleEl = item.querySelector('h2 a span');
        const priceEl = item.querySelector('.a-price-whole');
        const badgeEl = item.querySelector('.a-badge-text');
        const reviewEl = item.querySelector('span.a-size-base.s-underline-text');

        return {
          productName: titleEl?.innerText.trim() || 'N/A',
          price: priceEl?.innerText.replace(/[^0-9]/g, '') || '0',
          bestsellerBadge: (badgeEl || item.innerText.includes('ベストセラー')) ? 'Yes' : 'No',
          reviewCount: reviewEl?.innerText.replace(/[^0-9]/g, '') || '0'
        };
      }, asin);

      if (productData) {
        console.log(`✓ 抽出成功: ${productData.productName} (￥${productData.price})`);
        return productData;
      } else {
        console.log(`✗ 検索結果内に ASIN:${asin} が見つかりませんでした。`);
        return { productName: '検索結果に不在', price: '0', bestsellerBadge: 'No', reviewCount: '0' };
      }

    } catch (error) {
      console.error(`✗ エラー: ${error.message}`);
      return { productName: 'エラー', price: '0', bestsellerBadge: 'No', reviewCount: '0' };
    } finally {
      await page.close();
      await context.close();
    }
  }

  async close() {
    if (this.browser) await this.browser.close();
  }
}
