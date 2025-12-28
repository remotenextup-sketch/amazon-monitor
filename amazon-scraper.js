import { chromium } from 'playwright';

export default class AmazonScraper {
  constructor() {
    this.browser = null;
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
  }

  async initialize() {
    try {
      this.browser = await chromium.launch({
        headless: true, // headless: false にしたいところですがGAではtrueのみ
        args: [
          '--disable-blink-features=AutomationControlled',
          '--no-sandbox',
          '--lang=ja-JP'
        ]
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  async getProductInfo(asin) {
    // 1. 言語設定と解像度を固定してコンテキスト作成
    const context = await this.browser.newContext({
      userAgent: this.userAgent,
      viewport: { width: 1920, height: 1080 },
      locale: 'ja-JP',
      extraHTTPHeaders: { 'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8' }
    });

    // 2. Cookieをセット（「私は日本にいて日本語で見たい」と宣言する）
    await context.addCookies([
      { name: 'lc-main-av', value: 'ja_JP', domain: '.amazon.co.jp', path: '/' },
      { name: 'i18n-prefs', value: 'JPY', domain: '.amazon.co.jp', path: '/' }
    ]);

    const page = await context.newPage();

    try {
      const url = `https://www.amazon.co.jp/dp/${asin}?th=1&psc=1`;
      console.log(`📍 アクセス: ${url}`);

      // 3. 画面遷移と待機を慎重に
      await page.goto(url, { waitUntil: 'load', timeout: 60000 });
      
      // Amazonがボット判定してくるのを避けるために少し待つ
      await page.waitForTimeout(5000); 

      const productData = await page.evaluate(() => {
        const getT = (sels) => {
          for (const s of sels) {
            const el = document.querySelector(s);
            if (el && el.innerText.trim()) return el.innerText.trim();
          }
          return '';
        };

        // --- あなたが提供してくれた最強セレクタを適用 ---
        const productName = getT(['h1 span', '#productTitle', '.sc-product-title']);
        
        // 価格（整数＋小数を合体）
        const whole = document.querySelector('.a-price-whole')?.innerText.replace(/[^0-9]/g, '') || '';
        const fraction = document.querySelector('.a-price-fraction')?.innerText.replace(/[^0-9]/g, '') || '';
        const price = (whole + fraction) || '0';

        // ベストセラーバッジ
        const bodyText = document.body.innerText;
        const hasBestSeller = /ベストセラー|Bestseller/i.test(bodyText) || 
                              !!document.querySelector('.rio-badge-style-best_seller');

        // レビュー数
        const reviews = getT(['[data-hook="total-review-count"]', '#acrCustomerReviewText']).replace(/[^0-9]/g, '') || '0';

        return {
          productName: productName || '取得失敗',
          price,
          bestsellerBadge: hasBestSeller ? 'Yes' : 'No',
          reviewCount: reviews
        };
      });

      console.log(`✓ 抽出結果: ${productData.productName}`);
      return productData;

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
