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
    const rows = await sheet.getRows();
    return rows.map(row => row.toObject());
  }

  async appendHistory(results) {
    const sheet = this.doc.sheetsByTitle['履歴'];
    const rows = results.map(res => ({
      'タイムスタンプ': res.date,
      '商品名': res.keyword,
      'ASIN': res.asin,
      '商品名（Amazon）': res.productName,
      '価格': res.price,
      'ベストセラーバッジ': res.bestsellerBadge,
      'レビュー数': res.reviewCount,
      'タイプ': res.type
    }));
    await sheet.addRows(rows);
  }
}
