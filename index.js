import GoogleSheets from './google-sheets.js';
import AmazonScraper from './amazon-scraper.js';
import { sendChatworkNotification } from './chatwork.js';
import 'dotenv/config';

async function main() {
  console.log('🚀 Amazon Monitor 起動');
  
  const sheets = new GoogleSheets();
  const scraper = new AmazonScraper();

  try {
    // 1. スプレッドシートから設定読み込み
    await sheets.initialize();
    const rows = await sheets.getConfigRows(); // Active列が「有効」な行を取得する想定
    console.log('✓ Google Sheets 接続成功');

    // 2. ブラウザ起動
    if (!(await scraper.initialize())) return;

    const allResults = [];

    for (const row of rows) {
      if (row['Active'] !== '有効') continue;

      const keyword = row['商品名'];
      const targetAsins = [
        { type: '自社', id: row['自社ASIN'] },
        { type: '競合1', id: row['競合ASIN1'] },
        { type: '競合2', id: row['競合ASIN2'] }
      ];

      // 💡 キーワードから検索URLを生成
      const searchUrl = `https://www.amazon.co.jp/s?k=${encodeURIComponent(keyword)}`;
      console.log(`--- 監視キーワード: ${keyword} ---`);

      for (const target of targetAsins) {
        if (!target.id) continue;

        console.log(`🔎 調査中: ${target.type} (${target.id})`);
        const data = await scraper.getProductInfo(target.id, searchUrl);

        if (data) {
          allResults.push({
            date: new Date().toLocaleString('ja-JP'),
            keyword: keyword,
            type: target.type,
            asin: target.id,
            ...data
          });
        }
      }
    }

    // 3. スプレッドシートの「履歴」シートに保存
    if (allResults.length > 0) {
      await sheets.appendHistory(allResults);
      console.log(`✓ ${allResults.length}件のデータを記録しました`);

      // 4. Chatwork通知 (任意でカスタマイズ)
      const summary = allResults.map(r => `${r.keyword}(${r.type}): ￥${r.price} バッジ:${r.bestsellerBadge}`).join('\n');
      await sendChatworkNotification(`【Amazon調査完了】\n${summary}`);
    }

  } catch (error) {
    console.error('メインプロセスでエラー発生:', error);
  } finally {
    await scraper.close();
    console.log('🏁 すべてのプロセスが終了しました');
  }
}

main();
