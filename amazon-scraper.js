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
        args: ['--disable-blink-features=AutomationControlled', '--no-sandbox']
      });
      console.log('✓ Playwrightブラウザ起動');
      return true;
    } catch (error) {
      console.error('✗ ブラウザ起動失敗:', error.message);
      return false;
    }
  }

  async close() {
    if (this.browser) await this.browser.close();
  }

  async getProductInfo(asin) {
    const context = await this.browser.newContext({ userAgent: this.userAgent });
    const page = await context.newPage();

    try {
      const url = `https://www.amazon.co.jp/dp/${asin}`;
      console.log(`📍 アクセス: ${url}`);

      // タイムアウトを長めに設定し、完全に読み込む
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(3000); 

      const productData = await page.evaluate(() => {
        const getT = (selectors) => {
          for (const s of selectors) {
            const el = document.querySelector(s);
            if (el && el.innerText.trim()) return el.innerText.trim();
          }
          return '';
        };

        // 1. 商品名 (h1 span と既存の候補)
        const productName = getT(['h1 span', '#productTitle', '.a-size-large']);

        // 2. 価格 (整数部と小数部を合体させる最新方式)
        const whole = document.querySelector('.a-price-whole')?.innerText.trim() || '';
        const fraction = document.querySelector('.a-price-fraction')?.innerText.trim() || '';
        const symbol = document.querySelector('.a-price-symbol')?.innerText.trim() || '';
        
        // 数字だけを抽出（USD 18.25 -> 18.25 / ￥1,980 -> 1980）
        let price = (whole + fraction).replace(/[^0-9.]/g, '');
        if (!price) {
          // 従来の価格セレクタも予備でチェック
          price = getT(['.a-offscreen', '#priceblock_ourprice']).replace(/[^0-9]/g, '');
        }

        // 3. ベストセラーバッジ (日本語・英語両対応)
        const bodyText = document.body.innerText;
        const hasBestSeller = /Amazon Bestseller|ベストセラー/i.test(bodyText) || 
                              !!document.querySelector('.rio-badge-style-best_seller');

        // 4. レビュー数
        const reviewText = getT(['[data-hook="total-review-count"]', '#acrCustomerReviewText']);
        const reviewCount = reviewText.replace(/[^0-9]/g, '') || '0';

        // 5. ランキング (正規表現で #1 や #77 を抽出)
        const rankingMatches = bodyText.match(/#(\d+)\s+in\s+([^\n]+)/g);
        let smallRank = 'N/A';
        let largeRank = 'N/A';

        if (rankingMatches) {
          largeRank = rankingMatches[0].match(/#(\d+)/)?.[1] || 'N/A';
          if (rankingMatches[1]) {
            smallRank = rankingMatches[1].match(/#(\d+)/)?.[1] || 'N/A';
          }
        } else {
          // 日本語形式の「n位」も予備でチェック
          const jpRankMatches = bodyText.match(/(\d+)位/g);
          if (jpRankMatches) {
            largeRank = jpRankMatches[0].replace('位', '');
            if (jpRankMatches[1]) smallRank = jpRankMatches[1].replace('位', '');
          }
        }

        return {
          productName: productName || 'N/A',
          price: price || '0',
          bestsellerBadge: hasBestSeller ? 'Yes' : 'No',
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
