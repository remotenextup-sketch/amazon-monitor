import { JWT } from 'google-auth-library';
import { GoogleSpreadsheet } from 'google-spreadsheet';

export default class GoogleSheets {
  constructor() {
    this.doc = null;
  }

  async initialize() {
    // 1. Secretsにある JSON文字列をパース
    const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);

    const serviceAccountAuth = new JWT({
      email: creds.client_email,
      key: creds.private_key.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    // 2. Secretsの GOOGLE_SHEETS_ID を使用
    this.doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID, serviceAccountAuth);
    await this.doc.loadInfo();
  }

  // 「設定」シートから読み込み
  async getConfigRows() {
    const sheet = this.doc.sheetsByTitle['設定'];
    const rows = await sheet.getRows();
    return rows.map(row => row.toObject());
  }

  // 「履歴」シートに書き込み
  async appendHistory(results) {
    const sheet = this.doc.sheetsByTitle['履歴'];
    const rows = results.map(res => ({
      '日時': res.date,
      'キーワード': res.keyword,
      '種別': res.type,
      'ASIN': res.asin,
      '商品名': res.productName,
      '価格': res.price,
      'バッジ': res.bestsellerBadge,
      'レビュー数': res.reviewCount
    }));
    await sheet.addRows(rows);
  }
}
