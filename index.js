import 'dotenv/config';
import GoogleSheets from './google-sheets.js';
import AmazonScraper from './amazon-scraper.js';

async function main() {
  console.log('🚀 Amazon Monitor (詳細ページ直接取得版) 起動');
  const sheets = new GoogleSheets();
  const scraper = new AmazonScraper();

  try {
    await sheets.initialize();
    const rows = await sheets.getConfigRows();
    const activeRows = rows.filter(row => String(row['Active']).trim() === '有効');

    if (activeRows.length === 0 || !(await scraper.initialize())) return;

    const allResults = [];
    for (const row of activeRows) {
      const keyword = row['商品名'];
      const targetAsins = [
        { type: '自社', id: row['自社ASIN'] },
        { type: '競合1', id: row['競合ASIN1'] },
        { type: '競合2', id: row['競合ASIN2'] }
      ].filter(item => item.id);

      for (const target of targetAsins) {
        const data = await scraper.getProductInfo(target.id);
        
        const nowJst = new Intl.DateTimeFormat('ja-JP', {
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit',
          timeZone: 'Asia/Tokyo'
        }).format(new Date());

        if (data) {
          allResults.push({
            date: nowJst,
            keyword: keyword,
            type: target.type,
            asin: target.id,
            ...data
          });
          console.log(`✅ ${target.id}: ￥${data.price} (${data.bestsellerBadge === 'Yes' ? 'BS' : '通常'})`);
        }
        await new Promise(r => setTimeout(r, 3000)); // 連続アクセスを避けるための休憩
      }
    }

    if (allResults.length > 0) {
      await sheets.appendHistory(allResults);
      console.log('✓ スプレッドシート記録完了');
    }
  } catch (error) {
    console.error('エラー:', error);
  } finally {
    await scraper.close();
  }
}
main();
