import 'dotenv/config';
import GoogleSheets from './google-sheets.js';
import AmazonScraper from './amazon-scraper.js';
import { sendChatworkNotification } from './chatwork.js';

async function main() {
  const sheets = new GoogleSheets();
  const scraper = new AmazonScraper();

  try {
    await sheets.initialize();
    const rows = await sheets.getConfigRows();
    const activeRows = rows.filter(row => String(row['Active']).trim() === '有効');

    if (activeRows.length === 0 || !(await scraper.initialize())) return;

    const allResults = [];
    let report = '【Amazon価格・バッジ監視】\n';

    for (const row of activeRows) {
      const keyword = row['商品名'];
      const targetAsins = [
        { type: '自社', id: row['自社ASIN'] },
        { type: '競合1', id: row['競合ASIN1'] },
        { type: '競合2', id: row['競合ASIN2'] }
      ].filter(item => item.id);

      let jishaPrice = 0;
      let jishaBS = false;

      for (const target of targetAsins) {
        const data = await scraper.getProductInfo(target.id);
        if (!data) continue;

        const nowJst = new Intl.DateTimeFormat('ja-JP', {
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit',
          timeZone: 'Asia/Tokyo'
        }).format(new Date());

        const result = { date: nowJst, keyword: keyword, type: target.type, asin: target.id, ...data };
        allResults.push(result);

        if (target.type === '自社') {
          jishaPrice = Number(data.price);
          jishaBS = data.bestsellerBadge === 'Yes';
        } else {
          // 競合との比較通知
          if (jishaPrice > Number(data.price) && jishaPrice > 0) {
            report += `⚠️ 競合(${target.id})より高いです! (自社:${jishaPrice}円 vs 競合:${data.price}円)\n`;
          }
        }
      }
      if (!jishaBS && keyword.includes('自社')) {
        report += `🚨 ${keyword} のベストセラーバッジが消えました!\n`;
      }
    }

    if (allResults.length > 0) {
      await sheets.appendHistory(allResults);
      if (report.length > 20) await sendChatworkNotification(report);
      console.log('✓ 処理完了');
    }
  } catch (e) { console.error(e); } finally { await scraper.close(); }
}
main();
