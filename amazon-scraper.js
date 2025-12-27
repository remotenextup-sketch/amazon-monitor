import { chromium } from 'playwright';

/**
 * Amazon商品スクレイパークラス（安全版）
 */
export default class AmazonScraper {
  constructor() {
    this.browser = null;
    // より標準的な最新ブラウザのUser-Agentに設定
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  }

  /**
   * ブラウザを初期化
   */
  async initialize() {
    try {
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--no-sandbox',                // Linux環境（GitHub Actions）で必須
          '--disable-setuid-sandbox'
        ]
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

    // ES Modules環境では this.browser.newContext() をそのまま使用
    const context = await this.browser.newContext({ userAgent: this.userAgent });
    const page = await context.newPage();

    try {
      const url = `https://www.amazon.co.jp/dp/${asin}`;
      console.log(`📍 アクセス: ${url}`);

      // タイムアウトを少し長めに設定し、ネットワークが落ち着くまで待機
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(3000); // 描画待ち

      const productData = await page.evaluate(() => {
        // 商品名
        const productNameElement = document.querySelector('#productTitle');
        const productName = productNameElement?.textContent?.trim() || 'N/A';

        // 価格 (複数のセレクタに対応)
        const priceElement = document.querySelector('.a-price-whole') || document.querySelector('.a-offscreen');
        const price = priceElement?.textContent?.replace(/[^0-9]/g, '') || '0';

        // ベストセラーバッジ
        // 特定のクラス名やテキスト、アイコンから判定
        const bBadge = !!(document.querySelector('.badge-link') || 
                          document.querySelector('.p13n-best-seller-badge') ||
                          document.body.innerText.includes('ベストセラー'));
        const bestsellerBadge = bBadge ? 'Yes' : 'No';

        // レビュー数
        const reviewElement = document.querySelector('#acrCustomerReviewText');
        const reviewCount = reviewElement?.textContent?.match(/\d+/)?.[0] || '0';

        // ランキング取得 (正規表現で抽出)
        let smallCategoryRank = 'N/A';
        let largeCategoryRank = 'N/A';
        
        const rankText = document.querySelector('#SalesRank')?.innerText || document.body.innerText;
        const rankMatches = rankText.match(/#(\d+)/g);
        
        if (rankMatches && rankMatches.length > 0) {
          smallCategoryRank = rankMatches[0].replace('#', '');
          if (rankMatches.length > 1) {
            largeCategoryRank = rankMatches[1].replace('#', '');
          }
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
      await page.close();
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
      // Amazonの連続アクセス制限を避けるため待機
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    return results;
  }
}
