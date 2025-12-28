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
        args: [
          '--disable-blink-features=AutomationControlled',
          '--no-sandbox',
          '--disable-setuid-sandbox'
        ]
      });
      console.log('✓ Playwrightブラウザ起動');
      return true;
    } catch (error) {
      console.error('✗ ブラウザ起動失敗:', error.message);
      return false;
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('✓ ブラウザ終了');
    }
  }

  async getProductInfo(asin) {
    if (!this.browser) return null;

    const context = await this.browser.newContext({ userAgent: this.userAgent });
    const page = await context.newPage();

    try {
      const url = `https://www.amazon.co.jp/dp/${asin}`;
      console.log(`📍 アクセス: ${url}`);

      // 読み込み待ちの設定
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(4000); // 描画までしっかり待つ

      const productData = await page.evaluate(() => {
        const getT = (selectors) => {
          for (const s of selectors) {
            const el = document.querySelector(s);
            if (el && el.innerText.trim()) return el.innerText.trim();
          }
          return '';
        };

        // 1. 商品名 (複数の候補から探す)
        const productName = getT(['#productTitle', '.qa-title-text', 'h1', '.a-size-large']);

        // 2. 価格 (複数の候補から数字だけ抜く)
        const rawPrice = getT([
          '.a-price-whole', 
          '#priceblock_ourprice', 
          '#priceblock_dealprice',
          '.a-offscreen',
          '.priceToPay'
        ]);
        const price = rawPrice.replace(/[^0-9]/g, '') || '0';

        // 3. ベストセラーバッジ
        // 特定の要素があるか、またはテキスト内に「ベストセラー」が含まれるか
        const bBadge = !!(
          document.querySelector('.badge-link') || 
          document.querySelector('.p13n-best-seller-badge') || 
          document.body.innerText.includes('ベストセラー')
        );

        // 4. レビュー数
        const reviewText = getT(['#acrCustomerReviewText', '[data-hook="total-review-count"]']);
        const reviewCount = reviewText.replace(/[^0-9]/g, '') || '0';

        // 5. ランキング (正規表現で「数字+位」を抜く)
        let smallRank = 'N/A';
        let largeRank = 'N/A';
        const bodyText = document.body.innerText;
        const rankMatches = bodyText.match(/(\d+)位/g);
        if (rankMatches) {
          largeRank = rankMatches[0].replace('位', '');
          if (rankMatches[1]) smallRank = rankMatches[1].replace('位', '');
        }

        return {
          productName: productName || 'N/A',
          price,
          bestsellerBadge: bBadge ? 'Yes' : 'No',
          reviewCount,
          smallCategoryRank: smallRank,
          largeCategoryRank: largeRank
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
}
