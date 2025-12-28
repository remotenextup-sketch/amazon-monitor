import { JWT } from 'google-auth-library';
import { GoogleSpreadsheet } from 'google-spreadsheet';

export default class GoogleSheets {
  constructor() {
    this.doc = null;
  }

  async initialize() {
    const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    const serviceAccountAuth = new JWT({
      email: creds.client_email,
      key: creds.private_key.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    this.doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID, serviceAccountAuth);
    await this.doc.loadInfo();
  }

  async getConfigRows() {
    const sheet = this.doc.sheetsByTitle['設定'];
    await sheet.loadCells(); // セルを読み込む
    const rows = await sheet.getRows();
    
    // row.toObject() で取れない場合に備え、生データからマッピング
    return rows.map(row => {
      const data = row.toObject();
      return {
        '商品名': data['商品名'] || row._rawData[0],
        '自社ASIN': data['自社ASIN'] || row._rawData[1],
        '競合ASIN1': data['競合ASIN1'] || row._rawData[2],
        '競合ASIN2': data['競合ASIN2'] || row._rawData[3],
        'Active': data['Active'] || row._rawData[4]
      };
    });
  }

  async appendHistory(results) {
    const sheet = this.doc.sheetsByTitle['履歴'];
    
    // 履歴シートのヘッダー順序に厳密に合わせる
    const rows = results.map(res => ({
      'タイムスタンプ': res.date,
      '商品名': res.keyword,
      'ASIN': res.asin,
      '商品名（Amazon）': res.productName,
      '価格': res.price,
      'ベストセラーバッジ': res.bestsellerBadge,
      'レビュー数': res.reviewCount,
      'タイプ': res.type
      // 小カテ・大カテ・ステータス・スコアは今回取得していないので空欄になります
    }));

    await sheet.addRows(rows);
  }
}
