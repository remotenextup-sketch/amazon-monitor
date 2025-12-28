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
      return false;
    }
  }

  async getMultipleProductsInfo(asinList, searchUrl) {
    const context = await this.browser.newContext({ 
      userAgent: this.userAgent, 
      locale: 'ja-JP',
      viewport: { width: 1920, height: 1080 }
    });
    const page = await context.newPage();
    const results = {};

    try {
      console.log(`📡 検索開始: ${searchUrl}`);
      await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 60000 });
      
      // 画面全体を読み込ませるためのスクロール
      await page.evaluate(async () => {
        await new Promise(resolve => {
          let totalHeight = 0;
          let distance = 600;
          let timer = setInterval(() => {
            window.scrollBy(0, distance);
            totalHeight += distance;
            if(totalHeight >= document.body.scrollHeight || totalHeight > 6000){
              clearInterval(timer);
              resolve();
            }
          }, 150);
        });
      });

      await page.waitForTimeout(2000);

      // ページ内の全商品タイルを取得
      const pageData = await page.evaluate((asins) => {
        const foundData = {};
        const cards = Array.from(document.querySelectorAll('.s-result-item, [data-asin]'));
        
        asins.forEach(targetAsin => {
          const item = cards.find(el => {
            const attrAsin = el.getAttribute('data-asin');
            return (attrAsin && attrAsin.toUpperCase() === targetAsin.toUpperCase()) || el.innerHTML.includes(targetAsin);
          });

          if (item) {
            const priceEl = item.querySelector('.a-price-whole');
            const badgeEl = item.querySelector('.a-badge-text') || item.innerText.includes('ベストセラー');
            const reviewEl = item.querySelector('span.a-size-base.s-underline-text');
            const titleEl = item.querySelector('h2 a span');

            foundData[targetAsin] = {
              productName: titleEl ? titleEl.innerText.trim() : '商品名不明',
              price: priceEl ? priceEl.innerText.replace(/[^0-9]/g, '') : '0',
              bestsellerBadge: badgeEl ? 'Yes' : 'No',
              reviewCount: reviewEl ? reviewEl.innerText.replace(/[^0-9]/g, '') : '0'
            };
          }
        });
        return foundData;
      }, asinList);

      Object.assign(results, pageData);

    } catch (error) {
      console.error(`⚠️ スクレイピングエラー:`, error.message);
    } finally {
      await page.close();
      await context.close();
    }
    return results;
  }

  async close() {
    if (this.browser) await this.browser.close();
  }
}
