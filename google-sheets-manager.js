const { google } = require('googleapis');

/**
 * Google Sheets管理クラス
 */
class GoogleSheetsManager {
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
      console.log('✓ Google Sheets接続成功');
      return true;
    } catch (error) {
      console.error('✗ Google Sheets接続失敗:', error.message);
      return false;
    }
  }

  /**
   * 複数のデータを一括記録
   * dataArray の各要素は [timestamp, 商品名, ASIN, Amazon商品名, 価格, ベストセラーバッジ, 小カテランキング, 大カテランキング, レビュー数, ステータス, 危険度スコア]
   */
  async recordBatchData(sheetName, dataArray) {
    try {
      const response = await this.sheetsClient.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A:K`, // 列をA→Kに拡張
        valueInputOption: 'RAW',
        resource: { values: dataArray }
      });

      console.log(`✓ ${dataArray.length}件のデータを記録成功`);
      return true;
    } catch (error) {
      console.error('✗ 一括記録失敗:', error.message);
      return false;
    }
  }

  async getLastRecord(sheetName, asin) {
    try {
      const response = await this.sheetsClient.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A:K`
      });

      const rows = response.data.values || [];
      if (rows.length === 0) return null;

      for (let i = rows.length - 1; i >= 1; i--) {
        if (rows[i][2] === asin) {
          return {
            timestamp: rows[i][0],
            productName: rows[i][1],
            asin: rows[i][2],
            amazonProductName: rows[i][3],
            price: rows[i][4],
            bestsellerBadge: rows[i][5],
            smallCategoryRank: rows[i][6],
            largeCategoryRank: rows[i][7],
            reviewCount: rows[i][8],
            status: rows[i][9] || 'OK',
            dangerScore: rows[i][10] || 0
          };
        }
      }
      return null;
    } catch (error) {
      console.error('✗ データ取得失敗:', error.message);
      return null;
    }
  }

  async getProductConfig() {
    try {
      const response = await this.sheetsClient.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: '設定!A:E'
      });

      const rows = response.data.values || [];
      const products = {};

      for (let i = 1; i < rows.length; i++) {
        if (!rows[i][0]) continue;

        const productName = rows[i][0];
        const ownAsin = rows[i][1];
        const competitorAsins = [];

        if (rows[i][2]) competitorAsins.push(rows[i][2]);
        if (rows[i][3]) competitorAsins.push(rows[i][3]);

        products[productName] = {
          asin: ownAsin,
          competitors: competitorAsins
        };
      }

      console.log(`✓ 設定取得成功 (${Object.keys(products).length}商品)`);
      return products;
    } catch (error) {
      console.error('✗ 設定取得失敗:', error.message);
      return {};
    }
  }
}

module.exports = GoogleSheetsManager;
