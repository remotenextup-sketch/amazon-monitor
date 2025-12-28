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
    // 日本語環境をシミュレート
    const context = await this.browser.newContext({
      userAgent: this.userAgent,
      locale: 'ja-JP',
      viewport: { width: 1280, height: 800 }
    });
    const page = await context.newPage();

    try {
      // 1. まずAmazonトップを開いて配送先を設定する
      console.log(`📍 配送先を日本に設定中...`);
      await page.goto('https://www.amazon.co.jp/', { waitUntil: 'networkidle' });
      
      // 配送先変更ボタンをクリックして100-0001を入力
      try {
        await page.click('#nav-global-location-slot', { timeout: 5000 });
        await page.waitForSelector('#GLUXZipUpdateInput', { timeout: 5000 });
        await page.fill('#GLUXZipUpdateInput', '1000001'); // 東京の郵便番号
        await page.click('#GLUXZipUpdate .a-button-input');
        await page.waitForTimeout(2000); // 反映待ち
        await page.reload(); // 設定反映のためにリロード
      } catch (e) {
        console.log("配送先設定スキップ（既に日本設定の可能性あり）");
      }

      // 2. ASINで検索
      const url = `https://www.amazon.co.jp/s?k=${asin}&ref=nb_sb_noss`;
      console.log(`🔎 検索実行: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(3000);

      // 3. データ抽出
      const productData = await page.evaluate((targetAsin) => {
        const items = Array.from(document.querySelectorAll('[data-asin]'));
        const item = items.find(el => el.getAttribute('data-asin')?.toUpperCase() === targetAsin.toUpperCase());

        if (!item) return null;

        return {
          productName: item.querySelector('h2 a span')?.innerText.trim() || 'N/A',
          price: item.querySelector('.a-price-whole')?.innerText.replace(/[^0-9]/g, '') || '0',
          bestsellerBadge: item.innerText.includes('ベストセラー') || item.innerText.includes('Bestseller') ? 'Yes' : 'No',
          reviewCount: item.querySelector('span.a-size-base.s-underline-text')?.innerText.replace(/[^0-9]/g, '') || '0'
        };
      }, asin);

      if (productData && productData.productName !== 'N/A') {
        console.log(`✓ 抽出成功: ${productData.productName}`);
        return productData;
      }

      // 4. 検索でダメなら最終手段：商品ページ直撃
      console.log(`⚠️ 検索失敗。商品詳細ページを直接試行します...`);
      await page.goto(`https://www.amazon.co.jp/dp/${asin}`, { waitUntil: 'networkidle' });
      // (詳細ページ用の抽出ロジックは前のバージョンと同様...)
      // ここはシンプルに「タイトルが取れるか」だけ確認
      const directTitle = await page.title();
      console.log(`[DEBUG] 直撃後のページタイトル: ${directTitle}`);

      return { productName: '取得失敗', price: '0', bestsellerBadge: 'No', reviewCount: '0' };

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
