import 'dotenv/config';
import GoogleSheets from './google-sheets.js';
import AmazonScraper from './amazon-scraper.js';
import { sendChatworkNotification } from './chatwork.js';

console.log('--- プログラム開始直後 ---');

async function main() {
  console.log('🚀 Amazon Monitor 起動');
  
  const sheets = new GoogleSheets();
  const scraper = new AmazonScraper();

  try {
    console.log('📡 Google Sheets 初期化開始...');
    await sheets.initialize();
    console.log('✓ Google Sheets 接続成功');

    const rows = await sheets.getConfigRows();
    console.log(`📊 スプレッドシートから ${rows.length} 行読み込みました`);

    const activeRows = rows.filter(row => String(row['Active']).trim() === '有効');
    console.log(`✅ 有効なデータ: ${activeRows.length} 件`);

    if (activeRows.length === 0) {
      console.log('⚠ 有効なデータがないため終了します');
      return;
    }

    console.log('🌐 ブラウザ起動開始...');
    if (!(await scraper.initialize())) {
      console.log('❌ ブラウザ起動失敗');
      return;
    }

    const allResults = [];
    for (const row of activeRows) {
      const keyword = row['商品名'];
      const targetAsins = [
        { type: '自社', id: row['自社ASIN'] },
        { type: '競合1', id: row['競合ASIN1'] },
        { type: '競合2', id: row['競合ASIN2'] }
      ].filter(item => item.id);

      const searchUrl = `https://www.amazon.co.jp/s?k=${encodeURIComponent(keyword)}`;
      console.log(`🔎 調査開始: ${keyword}`);

      const resultsMap = await scraper.getMultipleProductsInfo(targetAsins.map(a => a.id), searchUrl);

      for (const target of targetAsins) {
        const data = resultsMap[target.id] || { productName: '検索結果に不在', price: '0', bestsellerBadge: 'No', reviewCount: '0' };
        
        // 日本時間に変換してフォーマット
        const nowJst = new Intl.DateTimeFormat('ja-JP', {
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit',
          timeZone: 'Asia/Tokyo'
        }).format(new Date());

        allResults.push({
          date: nowJst,
          keyword: keyword,
          type: target.type,
          asin: target.id,
          ...data
        });
        console.log(`   [${target.type}] ${target.id}: ${data.price}円`);
      }
    }

    if (allResults.length > 0) {
      console.log('📝 スプレッドシートへ書き込み中...');
      await sheets.appendHistory(allResults);
      console.log('✓ 書き込み完了');
      
      const summary = allResults
        .filter(r => r.price !== '0')
        .map(r => `${r.keyword}(${r.type}): ￥${r.price}${r.bestsellerBadge === 'Yes' ? '👑' : ''}`)
        .join('\n');

      if (summary) {
        await sendChatworkNotification(`【Amazon調査完了】\n${summary}`);
      }
    }

  } catch (error) {
    console.error('❌ メインプロセスエラー:', error);
  } finally {
    await scraper.close();
    console.log('🏁 すべて終了');
  }
}

main().catch(err => console.error('致命的エラー:', err));
