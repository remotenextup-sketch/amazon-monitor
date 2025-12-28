import fetch from 'node-fetch';

export async function sendChatworkNotification(message) {
  const token = process.env.CHATWORK_API_TOKEN;
  const roomId = process.env.CHATWORK_ROOM_ID;

  if (!token || !roomId) {
    console.log('⚠ Chatwork設定が不足しているため通知をスキップします');
    return;
  }

  const url = `https://api.chatwork.com/v2/rooms/${roomId}/messages`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-ChatworkToken': token,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ body: message })
    });

    if (response.ok) {
      console.log('✓ Chatwork通知送信成功');
    } else {
      console.error('✗ Chatwork通知失敗:', await response.text());
    }
  } catch (error) {
    console.error('✗ Chatwork通知エラー:', error);
  }
}
