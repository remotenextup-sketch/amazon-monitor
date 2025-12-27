# Amazon Product Monitor - セットアップガイド

このガイドでは、Amazon商品監視システムをGitHub Actionsで動作させるための手順を説明します。

## 前提条件

- GitHub アカウント
- Google Cloud プロジェクト（Google Sheets API有効化済み）
- Chatwork APIトークン
- Node.js 18以上（ローカルテスト用）

## ステップ1: Google Sheetsの準備

### 1.1 スプレッドシートの作成

1. [Google Sheets](https://sheets.google.com)にアクセス
2. 新しいスプレッドシートを作成
3. シート名を以下のように設定：
   - **シート1**: 「設定」
   - **シート2**: 「履歴」

### 1.2 「設定」シートの構成

以下の列を作成してください：

| 列 | 内容 | 例 |
|---|---|---|
| A | 商品名 | 海外変換プラグ |
| B | 自社ASIN | B08574ZQT5 |
| C | 競合ASIN1 | B0CPXX388Y |
| D | 競合ASIN2 | （空白） |
| E | 監視状態 | 有効 |

### 1.3 「履歴」シートの構成

以下の列を作成してください：

| 列 | 内容 |
|---|---|
| A | タイムスタンプ |
| B | 商品名 |
| C | ASIN |
| D | 商品名（Amazon） |
| E | 価格 |
| F | ベストセラーバッジ |
| G | 小カテランキング |
| H | 大カテランキング |
| I | レビュー数 |

### 1.4 サービスアカウントの共有設定

1. ダウンロードしたJSONファイルから `client_email` をコピー
2. スプレッドシートを開く
3. 右上の「共有」ボタンをクリック
4. `client_email` を入力して「編集」権限で共有

## ステップ2: GitHub Secretsの設定

1. GitHubリポジトリを開く
2. **Settings** → **Secrets and variables** → **Actions**
3. 以下のシークレットを追加：

### 2.1 GOOGLE_SHEETS_ID
- Google Sheetsの URL から取得
- 例：`https://docs.google.com/spreadsheets/d/【ここ】/edit`

### 2.2 GOOGLE_SERVICE_ACCOUNT_KEY
- ダウンロードしたJSONファイル全体をコピー
- 改行を含めて、そのまま貼り付け

### 2.3 CHATWORK_API_TOKEN
- Chatwork APIトークン

### 2.4 CHATWORK_ROOM_ID
- 通知を送りたいChatworkルームID

## ステップ3: リポジトリへのプッシュ

```bash
# リポジトリをクローン
git clone https://github.com/remotenextup-sketch/amazon-monitor.git
cd amazon-monitor

# ファイルをコピー
# （このプロジェクトのファイルをコピー）

# Gitに追加
git add .
git commit -m "Initial commit: Amazon product monitoring system"
git push origin main
```

## ステップ4: GitHub Actionsの確認

1. リポジトリの **Actions** タブを開く
2. 「Amazon Product Monitor」ワークフローが表示される
3. 「Run workflow」をクリックして手動実行をテスト

## トラブルシューティング

### エラー: "GOOGLE_SHEETS_ID is not defined"
- GitHub Secretsに `GOOGLE_SHEETS_ID` が正しく設定されているか確認
- Sheets URLから正しいIDを抽出しているか確認

### エラー: "Permission denied"
- サービスアカウントのメールアドレスがスプレッドシートに共有されているか確認
- Google Sheets APIが有効になっているか確認

### エラー: "Chatwork notification failed"
- Chatwork APIトークンが正しいか確認
- ルームIDが正しいか確認

### Playwrightエラー
- GitHub Actions環境では自動的にブラウザがインストールされます
- ローカルテストの場合：`npx playwright install`

## ローカルテスト

```bash
# 依存関係をインストール
npm install

# 環境変数を設定
export GOOGLE_SHEETS_ID="your-sheet-id"
export GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
export CHATWORK_API_TOKEN="your-token"
export CHATWORK_ROOM_ID="your-room-id"

# スクリプトを実行
npm start
```

## 実行スケジュール

デフォルトでは毎時0分（UTC）に実行されます。

### スケジュール変更方法

`.github/workflows/monitor.yml` の `cron` 値を変更：

```yaml
schedule:
  - cron: '0 * * * *'  # 毎時0分
  # 例：毎日9時（JST）に実行
  # - cron: '0 0 * * *'  # UTC 0時 = JST 9時
```

## 月間実行時間の計算

- 1時間ごと実行：約1分/回 × 24回 = 24分/日
- 月間：24分 × 30日 = 720分（無料枠3,000分内）

## サポート

問題が発生した場合は、以下を確認してください：

1. GitHub Actions ログを確認
2. Google Sheets のアクセス権限を確認
3. Chatwork APIトークンの有効性を確認
4. Amazon ページの構造が変更されていないか確認
