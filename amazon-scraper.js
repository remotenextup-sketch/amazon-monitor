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
    } catch (e) { return false; }
  }

  async getMultipleProductsInfo(asinList, searchUrl) {
    const context = await this.browser.newContext({ userAgent: this.userAgent, locale: 'ja-JP', viewport: { width: 1920, height: 1200 } });
    const page = await context.newPage();
    const results = {};

    try {
      console.log(`📡 検索開始: ${searchUrl}`);
      await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 60000 });
      
      // ページ全体をしっかりロード
      await page.evaluate(async () => {
        for (let i = 0; i < 5; i++) {
          window.scrollBy(0, 1000);
          await new Promise(r => setTimeout(r, 500));
        }
      });

      const pageData = await page.evaluate((asins) => {
        const foundData = {};
        // 商品タイルを網羅的に取得
        const items = Array.from(document.querySelectorAll('.s-result-item, [data-asin], .s-card-container'));
        
        asins.forEach(targetAsin => {
          const item = items.find(el => {
            const attrAsin = el.getAttribute('data-asin');
            return (attrAsin && attrAsin.toUpperCase() === targetAsin.toUpperCase()) || el.innerHTML.includes(targetAsin);
          });

          if (item) {
            // 1. 価格 (a-price-wholeを優先、なければa-offscreen)
            const priceEl = item.querySelector('.a-price-whole') || item.querySelector('.a-price .a-offscreen');
            const price = priceEl ? priceEl.innerText.replace(/[^0-9]/g, '') : '0';

            // 2. レビュー数 (s-underline-text または 親要素から判定)
            const reviewEl = item.querySelector('span.a-size-base.s-underline-text') || item.querySelector('.a-size-small .a-size-base');
            const reviews = reviewEl ? reviewEl.innerText.replace(/[^0-9]/g, '') : '0';

            // 3. ベストセラー判定
            const isBestseller = item.innerText.includes('ベストセラー') || !!item.querySelector('.a-badge-text');

            // 4. ランキング情報の簡易抽出 (検索結果に表示されている場合のみ)
            // 通常、検索結果には「過去1ヶ月に1000点以上購入されました」などの情報はありますが、
            // 詳細なランキング順位は商品ページにしかないので、ここでは「表示があるか」をチェック
            const badgeText = item.querySelector('.a-badge-label-contains-ranking')?.innerText || '';

            foundData[targetAsin] = {
              productName: item.querySelector('h2 a span')?.innerText.trim() || '商品名不明',
              price: price,
              bestsellerBadge: isBestseller ? 'Yes' : 'No',
              reviewCount: reviews,
              rankInfo: badgeText 
            };
          }
        });
        return foundData;
      }, asinList);

      Object.assign(results, pageData);
    } catch (error) {
      console.error(`⚠️ エラー:`, error.message);
    } finally {
      await page.close();
      await context.close();
    }
    return results;
  }

  async close() { if (this.browser) await this.browser.close(); }
}
