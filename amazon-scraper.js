import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';

chromium.use(stealth());

export default class AmazonScraper {
  constructor() {
    this.browser = null;
  }

  async initialize() {
    try {
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--lang=ja-JP,ja'
        ]
      });
      return true;
    } catch (e) { return false; }
  }

  async getProductInfo(asin) {
    // 毎回新しい指紋（Context）を作成して追跡を逃れる
    const context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      locale: 'ja-JP'
    });
    const page = await context.newPage();
    const url = `https://www.amazon.co.jp/s?k=${asin}&ref=nb_sb_noss`;

    try {
      // 1. ページ移動
      await page.goto(url, { waitUntil: 'commit', timeout: 60000 });
      await page.waitForTimeout(Math.random() * 3000 + 2000); // 人間味のある待機

      // 2. ロボット画面が出ていないかチェック
      const isRobot = await page.isVisible('form[action*="/errors/validateCaptcha"]');
      if (isRobot) {
        console.log(`⚠️ ${asin}: ロボット検知されました`);
        return null;
      }

      // 3. データ抽出
      const data = await page.evaluate(() => {
        const t = (s) => document.querySelector(s)?.innerText.trim() || '';
        
        // 価格（複数の場所を探す）
        const price = t('.a-price-whole') || t('.a-offscreen') || '0';
        
        // ランキング（詳細欄から正規表現でぶっこ抜く）
        const text = document.body.innerText;
        const bigRankMatch = text.match(/#([0-9,]+)\s*位\s*-\s*([^\n(]+)/);
        
        return {
          productName: t('#productTitle'),
          price: price.replace(/[^0-9]/g, ''),
          bestsellerBadge: document.body.innerText.includes('ベストセラー') ? 'Yes' : 'No',
          reviewCount: t('#acrCustomerReviewText').replace(/[^0-9]/g, '') || '0',
          bigRank: bigRankMatch ? bigRankMatch[1] + '位' : '',
          smallRank: text.match(/#([0-9,]+)\s*位\s*-\s*([^\n]+)/g)?.[1]?.replace(/.*#/, '') || ''
        };
      });

      console.log(`✅ ${asin} 取得完了: ${data.productName.substring(0, 10)}...`);
      return data;
    } catch (error) {
      return null;
    } finally {
      await page.close();
      await context.close();
    }
  }

  async close() { if (this.browser) await this.browser.close(); }
}
