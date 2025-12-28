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

  async getProductInfo(asin, searchUrl) {
    const context = await this.browser.newContext({ 
      userAgent: this.userAgent, 
      locale: 'ja-JP',
      viewport: { width: 1920, height: 1080 } // 画面を広くして全ての商品をロードさせる
    });
    const page = await context.newPage();

    try {
      console.log(`📡 検索開始: ${searchUrl}`);
      await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 60000 });
      
      // 画面を少しずつスクロールして、遅延読み込みされている商品を表示させる
      await page.evaluate(async () => {
        await new Promise(resolve => {
          let totalHeight = 0;
          let distance = 400;
          let timer = setInterval(() => {
            window.scrollBy(0, distance);
            totalHeight += distance;
            if(totalHeight >= document.body.scrollHeight || totalHeight > 5000){
              clearInterval(timer);
              resolve();
            }
          }, 100);
        });
      });

      await page.waitForTimeout(2000);

      const productData = await page.evaluate((targetAsin) => {
        // 全てのHTML要素の中からASINという文字列を持つものを探す
        const allElements = Array.from(document.querySelectorAll('.s-result-item'));
        
        for (const el of allElements) {
          // data-asin属性、もしくはHTMLの中身自体にASINが含まれているかチェック
          if (el.getAttribute('data-asin')?.toUpperCase() === targetAsin.toUpperCase() || el.innerHTML.includes(targetAsin)) {
            
            // 価格の抽出（複数のセレクタを試す）
            const priceEl = el.querySelector('.a-price-whole') || el.querySelector('.a-color-base');
            const price = priceEl ? priceEl.innerText.replace(/[^0-9]/g, '') : '0';

            // バッジの判定
            const hasBadge = el.innerText.includes('ベストセラー') || !!el.querySelector('.a-badge-text');

            // レビュー数
            const reviewEl = el.querySelector('span.a-size-base.s-underline-text');
            const reviews = reviewEl ? reviewEl.innerText.replace(/[^0-9]/g, '') : '0';

            // タイトル
            const titleEl = el.querySelector('h2 a span') || el.querySelector('.a-size-medium');

            return {
              productName: titleEl ? titleEl.innerText.trim() : '商品名取得失敗',
              price: price,
              bestsellerBadge: hasBadge ? 'Yes' : 'No',
              reviewCount: reviews
            };
          }
        }
        return null;
      }, asin);

      if (productData) {
        console.log(`✅ 発見: ${asin} - ￥${productData.price}`);
        return productData;
      } else {
        console.log(`❌ 不在: ${asin} (1ページ目に見当たりません)`);
        return { productName: '検索結果に不在', price: '0', bestsellerBadge: 'No', reviewCount: '0' };
      }

    } catch (error) {
      console.error(`⚠️ エラー: ${asin}`, error.message);
      return { productName: '通信エラー', price: '0', bestsellerBadge: 'No', reviewCount: '0' };
    } finally {
      await page.close();
      await context.close();
    }
  }

  async close() {
    if (this.browser) await this.browser.close();
  }
}
