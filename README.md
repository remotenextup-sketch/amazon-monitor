# Amazon Product Monitor

Playwrightを使用してAmazon商品情報を自動監視し、Google Sheetsに記録し、Chatworkで通知するシステムです。

## 機能

- **自動スクレイピング**: Playwrightを使用したAmazon商品情報の自動抽出
- **データ記録**: Google Sheetsへの自動記録と履歴管理
- **通知機能**: 以下の条件でChatwork通知
  - ベストセラーバッジが外れた
  - 競合商品のランキングが20位以内に接近
- **定期実行**: GitHub Actionsで1時間ごとに自動実行
- **クラウド実行**: 自分のPCをつけっぱなしにする必要なし

## 監視対象

| 商品名 | 自社ASIN | 競合ASIN |
|---|---|---|
| 海外変換プラグ | B08574ZQT5 | B0CPXX388Y |
| 耐震ジェル | B082S3WPMM | B09SDC1SW3, B0DC5Z6RFX |

## 抽出情報

- 商品名
- 価格
- ベストセラーバッジ有無
- 小カテゴリランキング
- 大カテゴリランキング
- レビュー数

## セットアップ

詳細は [SETUP_GUIDE.md](./SETUP_GUIDE.md) を参照してください。

### クイックスタート

1. **Google Sheets APIの有効化**
   - [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成
   - Google Sheets APIを有効化
   - サービスアカウントキー（JSON）を取得

2. **GitHub Secretsの設定**
   - `GOOGLE_SHEETS_ID`: Google Sheets ID
   - `GOOGLE_SERVICE_ACCOUNT_KEY`: JSONキーの内容
   - `CHATWORK_API_TOKEN`: Chatwork APIトークン
   - `CHATWORK_ROOM_ID`: 通知先ルームID

3. **リポジトリへのプッシュ**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

4. **GitHub Actionsで自動実行開始**

## ローカルテスト

```bash
npm install
npm start
```

## ファイル構成

```
amazon-monitor/
├── index.js                    # メインスクリプト
├── package.json                # 依存関係
├── .gitignore                  # Git除外設定
├── .github/
│   └── workflows/
│       └── monitor.yml         # GitHub Actions設定
├── README.md                   # このファイル
└── SETUP_GUIDE.md              # セットアップガイド
```

## 実行スケジュール

デフォルト：毎時0分（UTC）

月間実行時間：約720分（無料枠3,000分内）

## トラブルシューティング

### エラーが発生した場合

1. GitHub Actions ログを確認
2. [SETUP_GUIDE.md](./SETUP_GUIDE.md) のトラブルシューティングセクションを参照

### Amazon ページ構造の変更

Amazonのページ構造が変更された場合、`index.js` の `getAmazonProductInfo()` 関数内のセレクタを更新してください。

## 注意事項

- Amazon利用規約を遵守してください
- スクレイピングの頻度に注意（アクセス制限の可能性）
- Google Sheets APIの利用制限に注意

## ライセンス

MIT

## 作成者

Manus
