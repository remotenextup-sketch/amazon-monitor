import { chromium } from 'playwright';

export default class AmazonScraper {
  constructor() {
    this.browser = null;
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  }

  async initialize() {
    try {
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      return true;
    } catch (e) { return false; }
  }

  async getProductInfo(asin) {
    const context = await this.browser.newContext({ userAgent: this.userAgent });
    const page = await context.newPage();

    try {
      // 💡 商品ページではなく、あえて「そのASINを検索した結果画面」へ行く
      const url = `https://www.amazon.co.jp/s?k=${asin}`;
      console.log(`🔎 検索画面へアクセス: ${url}`);

      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(3000); // 描画待ち

      // 参考コードのロジックを活用してDOM解析
      const productData = await page.evaluate((targetAsin) => {
        // data-asin属性を持つ要素（商品ブロック）をすべて探す
        const items = Array.from(document.querySelectorAll('[data-asin]'));
        const item = items.find(el => el.getAttribute('data-asin')?.toUpperCase() === targetAsin.toUpperCase());

        if (!item) return null;

        // タイトル
        const titleEl = item.querySelector('h2 a span');
        const productName = titleEl?.innerText || 'N/A';

        // 価格 (整数部分を優先的に取得)
        const priceEl = item.querySelector('.a-price-whole');
        const price = priceEl?.innerText.replace(/[^0-9]/g, '') || '0';

        // ベストセラー (ラベルの有無)
        const hasBadge = !!(
          item.querySelector('.a-badge-text') || 
          item.innerText.includes('ベストセラー') ||
          item.innerText.includes('Bestseller')
        );

        // レビュー数
        const reviewEl = item.querySelector('span.a-size-base.s-underline-text');
        const reviewCount = reviewEl?.innerText.replace(/[^0-9]/g, '') || '0';

        return {
          productName,
          price,
          bestsellerBadge: hasBadge ? 'Yes' : 'No',
          reviewCount
        };
      }, asin);

      if (productData) {
        console.log(`✓ 抽出成功: ${productData.productName}`);
        return productData;
      } else {
        console.log(`✗ 商品が見つかりませんでした (ASIN: ${asin})`);
        return { productName: '取得失敗', price: '0', bestsellerBadge: 'No', reviewCount: '0' };
      }

    } catch (error) {
      console.error(`✗ エラー: ${error.message}`);
      return null;
    } finally {
      await page.close();
      await context.close();
    }
  }

  async close() { if (this.browser) await this.browser.close(); }
}
