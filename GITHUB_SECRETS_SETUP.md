# GitHub Secrets 設定ガイド

GitHub Actionsでシステムを動作させるために、以下のシークレットを設定する必要があります。

## 設定手順

1. GitHubリポジトリを開く
2. **Settings** タブをクリック
3. 左メニューから **Secrets and variables** → **Actions** をクリック
4. **New repository secret** ボタンをクリック

## 設定するシークレット

### 1. GOOGLE_SHEETS_ID

**説明**: Google Sheetsのスプレッドシート ID

**取得方法**:
- Google Sheetsを開く
- URLを確認：`https://docs.google.com/spreadsheets/d/【ここ】/edit`
- 【ここ】の部分がシートIDです

**例**: `1I7FDs1XujK_RADXnz7-gbZu7q6AFCspdT3ob7bNfsuc`

**設定**:
- Name: `GOOGLE_SHEETS_ID`
- Secret: スプレッドシートID

---

### 2. GOOGLE_SERVICE_ACCOUNT_KEY

**説明**: Google Cloud サービスアカウントの認証情報（JSON形式）

**取得方法**:
1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. プロジェクトを選択
3. 左メニュー「APIとサービス」→「認証情報」
4. サービスアカウントをクリック
5. 「キー」タブ → 「鍵を追加」 → 「新しい鍵を作成」
6. JSON形式を選択してダウンロード

**ファイル内容例**:
```json
{
  "type": "service_account",
  "project_id": "amazon-seo-checker-482510",
  "private_key_id": "33dd8c00d0900e7afc865c21303178182f9cc976",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "amazon-monitor@amazon-seo-checker-482510.iam.gserviceaccount.com",
  ...
}
```

**設定**:
- Name: `GOOGLE_SERVICE_ACCOUNT_KEY`
- Secret: JSONファイル全体の内容（改行を含める）

**⚠️ 重要**: JSONファイル全体をコピーしてください。一部だけではなく、`{`から`}`まですべてです。

---

### 3. CHATWORK_API_TOKEN

**説明**: Chatwork APIトークン

**取得方法**:
1. Chatworkにログイン
2. 右上のプロフィールアイコンをクリック
3. 「設定」を選択
4. 左メニューから「API」をクリック
5. 「APIトークン」をコピー

**例**: `1c625ed5115b673287529fbd41ec4338`

**設定**:
- Name: `CHATWORK_API_TOKEN`
- Secret: APIトークン

---

### 4. CHATWORK_ROOM_ID

**説明**: 通知を送信するChatworkルームID

**取得方法**:
1. Chatworkで通知を送りたいルームを開く
2. ルーム名の右側にある「i」アイコンをクリック
3. ルーム情報パネルでルームIDを確認

**例**: `248476377`

**設定**:
- Name: `CHATWORK_ROOM_ID`
- Secret: ルームID

---

### 5. SLACK_WEBHOOK_URL（オプション）

**説明**: エラー時にSlackに通知する場合のみ設定

**取得方法**:
1. Slackワークスペースの設定から Incoming Webhooks を作成
2. Webhook URLをコピー

**設定**:
- Name: `SLACK_WEBHOOK_URL`
- Secret: Webhook URL

---

## 設定確認

すべてのシークレットが正しく設定されたか確認：

1. リポジトリの **Actions** タブを開く
2. 「Amazon Product Monitor」ワークフローをクリック
3. **Run workflow** → **Run workflow** をクリック
4. 手動実行でテスト

## トラブルシューティング

### エラー: "GOOGLE_SHEETS_ID is not defined"
- Secretsに `GOOGLE_SHEETS_ID` が設定されているか確認
- 正しいシートIDを設定しているか確認

### エラー: "Permission denied"
- サービスアカウントのメールアドレスがスプレッドシートに共有されているか確認
- Google Sheets APIが有効になっているか確認

### エラー: "Invalid API token"
- Chatwork APIトークンが正しいか確認
- トークンが有効期限内か確認

## セキュリティに関する注意

- **シークレットは絶対に公開しないでください**
- GitHubのログには表示されません（マスクされます）
- リポジトリを公開する場合も、シークレットは安全です

## 参考リンク

- [GitHub Secrets ドキュメント](https://docs.github.com/ja/actions/security-guides/encrypted-secrets)
- [Google Cloud Console](https://console.cloud.google.com/)
- [Chatwork API ドキュメント](https://developer.chatwork.com/docs)
