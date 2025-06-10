# 体重記録LINE Bot

パーソナルトレーナー向けの体重記録システム。LINEで簡単に体重を記録し、Googleスプレッドシートに保存。継続を重視したシンプルな設計。

## 🚀 機能概要

- **LINE Bot統合**: LINEメッセージで簡単に体重記録
- **自動リマインダー**: 起床時間とおはようメッセージ、未記録時の夜間リマインダー
- **Googleスプレッドシート連携**: データの永続化とバックアップ
- **応援メッセージ**: 目標達成度に応じた自動的な励ましメッセージ
- **週平均計算**: 体重の変動を分析
- **ダッシュボード**: ブラウザでの体重推移の可視化

## 📋 動作環境

- Node.js 16.x以上
- LINE Developers アカウント
- Google Cloud Platform アカウント
- Googleスプレッドシート

## 🔧 セットアップ

### 1. プロジェクトのクローンと初期設定

```bash
git clone <repository-url>
cd weight-tracker-linebot
npm install
```

### 2. 環境変数の設定

```bash
cp .env.example .env
```

`.env`ファイルを編集して必要な情報を入力：

```env
# LINE設定
LINE_CHANNEL_ACCESS_TOKEN=your_channel_access_token_here
LINE_CHANNEL_SECRET=your_channel_secret_here

# Google Sheets設定
GOOGLE_SHEET_ID=your_spreadsheet_id_here

# サーバー設定
PORT=3000
NODE_ENV=development
```

### 3. LINE Developers設定

1. [LINE Developers](https://developers.line.biz/)にアクセス
2. プロバイダー作成 → チャンネル作成（Messaging API）
3. Channel Secret と Channel Access Token を取得
4. Webhook URL設定: `https://your-domain.com/webhook`
5. Webhook利用: ON、応答メッセージ: OFF

### 4. Google Cloud設定

1. [Google Cloud Console](https://console.cloud.google.com/)でプロジェクト作成
2. Google Sheets API を有効化
3. サービスアカウント作成 → JSON認証情報をダウンロード
4. `credentials.json`として保存
5. Googleスプレッドシート作成
6. サービスアカウントのメールアドレスに編集権限付与

## 🏃‍♂️ 起動方法

### 開発環境

```bash
npm run dev
```

### 本番環境

```bash
npm start
```

### ローカルテスト（ngrok使用）

```bash
# 別ターミナルで
ngrok http 3000

# 発行されたHTTPS URLをLINE DevelopersのWebhook URLに設定
```

## 📱 使用方法

### 初回登録

1. LINE Bot を友達追加
2. 以下の形式で情報を送信：

```
目標体重: 65
現在の体重: 70
身長: 170
起床時間: 6:30
```

### 日々の記録

- 体重の数値を送信するだけ（例: `69.5`）
- 毎朝の起床時間におはようメッセージが届く
- 未記録時は20:00にリマインダーが送信される

## 🏗️ アーキテクチャ

```
weight-tracker-linebot/
├── src/
│   ├── index.js          # メインサーバー
│   ├── config/
│   │   └── line.js       # LINE設定
│   ├── services/
│   │   ├── lineBot.js    # LINEメッセージ処理
│   │   ├── sheets.js     # Google Sheets連携
│   │   └── scheduler.js  # Cronジョブ
│   ├── utils/
│   │   ├── messages.js   # メッセージテンプレート
│   │   └── calculations.js # 計算ロジック
│   └── data/
│       └── userStore.js  # ユーザーデータ管理
├── dashboard/
│   └── index.html        # ダッシュボード
└── credentials.json      # Google認証情報
```

## 🔗 エンドポイント

- `POST /webhook` - LINE Bot Webhook
- `GET /health` - ヘルスチェック
- `GET /dashboard` - ダッシュボード
- `GET /` - API情報

## 🚀 デプロイ

### Heroku

```bash
heroku create your-app-name
heroku config:set LINE_CHANNEL_ACCESS_TOKEN=xxx
heroku config:set LINE_CHANNEL_SECRET=xxx  
heroku config:set GOOGLE_SHEET_ID=xxx
git push heroku main
```

### Google Cloud Run

```bash
gcloud run deploy weight-tracking-bot \
  --source . \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated
```

## 🧪 テスト

```bash
npm test
```

## 📊 データ形式

### Googleスプレッドシート

| 日付 | 時刻 | ユーザーID | 体重(kg) |
|------|------|------------|----------|
| 2025/1/15 | 6:35:00 | U123... | 69.5 |

### ユーザーデータ構造

```javascript
{
  lineUserId: string,
  goalWeight: number,
  currentWeight: number,
  height: number,
  wakeTime: string, // HH:MM format
  isCompleted: boolean,
  lastRecordDate: Date
}
```

## 🔮 今後の拡張予定

1. **Phase 2**: React ダッシュボード
2. **Phase 3**: マクロ栄養素記録
3. **Phase 4**: パーソナルトレーニング予約システム統合
4. **データベース移行**: Map → PostgreSQL/MongoDB

## ⚠️ 注意事項

- ユーザーデータは現在メモリ上に保存（再起動時にリセット）
- LINE Messaging API制限: 1000通/分
- Google Sheets API制限: 100リクエスト/100秒
- タイムゾーンはJST固定

## 📝 ライセンス

ISC

## 🤝 コントリビューション

Issue報告やPull Requestを歓迎します。

## 📞 サポート

プロジェクトに関する質問や問題は、GitHubのIssueでお知らせください。