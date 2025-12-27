import axios from 'axios'; // require から変更

export default class ChatworkNotifier { // module.exports から変更
  constructor(apiToken, roomId) {
    this.apiToken = apiToken;
    this.roomId = roomId;
    this.baseUrl = 'https://api.chatwork.com/v2';
  }

  /**
   * メッセージを送信
   */
  async sendMessage(message) {
    try {
      // URLSearchParams を使って x-www-form-urlencoded 形式にする
      const params = new URLSearchParams();
      params.append('body', message);

      const response = await axios.post(
        `${this.baseUrl}/rooms/${this.roomId}/messages`,
        params, // ここに params を渡す
        {
          headers: {
            'X-ChatWorkToken': this.apiToken,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      console.log(`✓ Chatwork通知送信成功 (ID: ${response.data.message_id})`);
      return true;
    } catch (error) {
      // エラーハンドリングの強化
      const errorDetail = error.response?.data?.errors || error.message;
      console.error('✗ Chatwork通知送信失敗:', errorDetail);
      return false;
    }
  }

  /**
   * ベストセラーバッジ喪失通知
   */
  async notifyBestsellerLost(productName, currentRank, previousRank) {
    const message = `[info][title]⚠️ ベストセラーバッジ喪失[/title]
【${productName}】のベストセラーバッジが外れました。

📊 ランキング変動:
  前回: 小カテ ${previousRank}位
  現在: 小カテ ${currentRank}位

⚡ 早急な対応をお勧めします。[/info]`;
    
    return await this.sendMessage(message);
  }

  /**
   * 競合商品接近通知
   */
  async notifyCompetitorApproaching(productName, ourRank, competitorRank, competitorName, rankDiff) {
    const message = `[info][title]⚠️ 競合商品が接近[/title]
【${productName}】

🏆 当社商品: 小カテ ${ourRank}位
🔴 競合商品: 小カテ ${competitorRank}位
📏 順位差: ${rankDiff}位

競合商品が20位以内に迫っています。[/info]`;
    
    return await this.sendMessage(message);
  }

  /**
   * 複数の通知をまとめて送信
   */
  async sendBatchNotifications(notifications) {
    const results = [];
    for (const notification of notifications) {
      const result = await this.sendMessage(notification);
      results.push(result);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return results;
  }

  /**
   * テスト通知を送信
   */
  async sendTestNotification() {
    const message = `[info][title]✅ Amazon Product Monitor[/title]
システムが正常に動作しています。

タイムスタンプ: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}[/info]`;
    
    return await this.sendMessage(message);
  }
}
