
import { chromium } from 'playwright';

export default class AmazonScraper {
  constructor() {
    this.browser = null;
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  }

  async initialize() {
    try {
      this.browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
      return true;
    } catch (e) { return false; }
  }

  async getProductInfo(asin) {
    const context = await this.browser.newContext({ userAgent: this.userAgent, locale: 'ja-JP' });
    const page = await context.newPage();

    try {
      // 💡 商品ページではなく、SEO順位取得と同じ「検索画面」へ
      // 検索ワードをASINにすることで、確実にその商品をヒットさせる
      const url = `https://www.amazon.co.jp/s?k=${asin}`;
      console.log(`🔎 検索画面から情報を抽出中: ${url}`);

      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(3000); 

      const productData = await page.evaluate((targetAsin) => {
        // 全ての商品ブロックを取得
        const items = Array.from(document.querySelectorAll('[data-asin]'));
        // 対象のASINを持つブロックを特定
        const item = items.find(el => el.getAttribute('data-asin')?.toUpperCase() === targetAsin.toUpperCase());

        if (!item) return null;

        // --- 検索結果画面専用のセレクタで抽出 ---
        
        // 1. タイトル
        const titleEl = item.querySelector('h2 a span');
        const productName = titleEl?.innerText.trim() || 'N/A';

        // 2. 価格 (.a-price-whole は検索画面でも共通)
        const priceEl = item.querySelector('.a-price-whole');
        const price = priceEl?.innerText.replace(/[^0-9]/g, '') || '0';

        // 3. ベストセラーバッジ
        // 検索画面では 'a-badge-text' クラスによく入っています
        const badgeEl = item.querySelector('.a-badge-text');
        const hasBadge = !!(badgeEl || item.innerText.includes('ベストセラー') || item.innerText.includes('Bestseller'));

        // 4. レビュー数
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
        console.log(`✓ 抽出成功: ${productData.productName} / 価格: ${productData.price}`);
        return productData;
      } else {
        // 検索で出ない場合の最終バックアップ（一応詳細ページも試す）
        console.log(`⚠️ 検索結果にASINが見つかりません。詳細ページを試行します。`);
        await page.goto(`https://www.amazon.co.jp/dp/${asin}`, { waitUntil: 'load' });
        const title = await page.title();
        return { productName: title.includes('Amazon.co.jp') ? '取得失敗(ボット検知)' : title, price: '0', bestsellerBadge: 'No', reviewCount: '0' };
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
