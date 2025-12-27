import { google } from 'googleapis';

export default class GoogleSheetsManager {
  constructor(credentials) {
    this.credentials = credentials;
    this.sheetsClient = null;
    this.spreadsheetId = null;
  }

  async initialize(spreadsheetId) {
    try {
      const auth = new google.auth.GoogleAuth({
        credentials: this.credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      this.sheetsClient = google.sheets({ version: 'v4', auth });
      this.spreadsheetId = spreadsheetId;
      console.log('✓ Google Sheets 接続成功');
      return true;
    } catch (error) {
      console.error('✗ Google Sheets 接続失敗:', error.message);
      return false;
    }
  }

  async getProductConfig() {
    try {
      // 「設定」シートの A列:商品名, B列:自社ASIN, C列:競合1, D列:競合2
      const response = await this.sheetsClient.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: '設定!A:D' 
      });
      const rows = response.data.values || [];
      const config = [];
      for (let i = 1; i < rows.length; i++) {
        if (!rows[i][1]) continue;
        config.push({
          productName: rows[i][0],
          ownAsin: rows[i][1],
          competitors: rows.slice(i, i+1)[0].slice(2).filter(Boolean)
        });
      }
      return config;
    } catch (error) {
      console.error('✗ 設定取得失敗:', error.message);
      return [];
    }
  }

  async recordBatchData(sheetName, dataArray) {
    try {
      const values = dataArray.map(d => [
        new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
        d.productName,
        d.asin,
        d.title,
        d.price,
        d.hasBestSeller ? 'あり' : 'なし',
        d.rankInfo || '',
        d.status || '正常'
      ]);
      await this.sheetsClient.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A:H`,
        valueInputOption: 'RAW',
        resource: { values }
      });
      console.log(`✓ ${dataArray.length}件のデータを記録しました`);
    } catch (error) {
      console.error('✗ データ記録失敗:', error.message);
    }
  }
}
