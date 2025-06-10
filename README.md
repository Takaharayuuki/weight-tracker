# 体重記録LINE Bot

パーソナルトレーナー向けの体重記録システム。LINEで簡単に体重を記録し、Googleスプレッドシートに保存。継続を重視したシンプルな設計。

## 🚀 主要機能

### 📱 LINE Bot機能
- **ニックネーム設定**: ユーザーが名前を設定可能（登録フロー・随時変更）
- **6段階登録フロー**: 名前 → 目標体重 → 現在体重 → 身長 → 起床時間
- **体重記録**: 数値送信だけで簡単記録
- **自動リマインダー**: 起床時間におはようメッセージ、未記録時の夜間リマインダー
- **応援メッセージ**: 目標達成度に応じた励ましメッセージ
- **リッチメニュー対応**: タップ操作での直感的な利用

### 📊 データ管理
- **Googleスプレッドシート連携**: 体重データと管理データの自動保存
- **ダブルシート構成**: 
  - メインシート（日別体重記録 + ニックネーム）
  - ユーザー管理シート（プロフィール・統計情報）
- **連続記録日数**: 自動計算・更新
- **統計情報**: 週平均、月平均、進捗率の自動計算

### 🎛️ 管理ダッシュボード
- **認証機能**: パスワード保護のダッシュボード
- **ユーザー管理**: 全ユーザーの一覧・検索・詳細表示
- **リアルタイム統計**: アクティブユーザー数、記録数、進捗率
- **レスポンシブデザイン**: PC・タブレット・スマホ対応
- **ダークモード**: ライト/ダークテーマ切り替え
- **自動更新**: 30秒間隔でのデータ更新

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

# ダッシュボード設定
DASHBOARD_PASSWORD=your_secure_password_here

# サーバー設定
PORT=3001
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

### 初回登録（6段階フロー）

1. LINE Bot を友達追加
2. 段階的に情報を入力：

```
1. 名前: 田中
2. 目標体重: 65
3. 現在の体重: 70
4. 身長: 170
5. 起床時間: 6:30
```

### 日々の記録

- **体重記録**: 数値を送信するだけ（例: `69.5`）
- **個人化メッセージ**: 「田中さん、70.5kg記録しました」
- **自動リマインダー**: 毎朝の起床時間におはようメッセージ
- **夜間リマインダー**: 未記録時は20:00にリマインダー送信

### 名前変更

- **コマンド**: 「名前を設定」
- **直接入力**: 「私は田中」「名前は田中」

### リッチメニュー（推奨）

```
┌─────────────┬─────────────┬─────────────┐
│  📝 体重記録  │  📊 グラフ   │  📈 成果    │
└─────────────┼─────────────┼─────────────┤
│  ⚙️ 設定    │  ❓ ヘルプ   │  🎯 目標変更  │
└─────────────┴─────────────┴─────────────┘
```

## 🏗️ アーキテクチャ

```
weight-tracker-linebot/
├── src/
│   ├── index.js          # メインサーバー + API エンドポイント
│   ├── config/
│   │   └── line.js       # LINE設定
│   ├── services/
│   │   ├── lineBot.js    # LINEメッセージ処理 + ニックネーム機能
│   │   ├── sheets.js     # Google Sheets連携 + ユーザー管理シート
│   │   └── scheduler.js  # Cronジョブ
│   ├── utils/
│   │   ├── messages.js   # メッセージテンプレート
│   │   ├── calculations.js # 計算ロジック
│   │   └── graphGenerator.js # グラフ生成
│   └── data/
│       ├── userStore.js  # ユーザーデータ管理
│       └── userStateStore.js # ユーザー状態管理
├── dashboard/
│   └── index.html        # 管理ダッシュボード（認証付き）
├── credentials.json      # Google認証情報
└── RICH_MENU_SETUP.md   # リッチメニュー設定ガイド
```

## 🔗 エンドポイント

### LINE Bot
- `POST /webhook` - LINE Bot Webhook
- `GET /webhook` - LINE Webhook検証用

### ダッシュボード
- `GET /dashboard/index.html` - 管理ダッシュボード
- `POST /api/auth` - ダッシュボード認証
- `GET /api/users` - 全ユーザー一覧（認証必須）
- `GET /api/users/:userId` - ユーザー詳細（認証必須）
- `GET /api/dashboard-stats` - 統計情報（認証必須）

### システム
- `GET /health` - ヘルスチェック + 統計情報
- `GET /` - API情報
- `GET /temp/:filename` - 一時ファイル配信（グラフ画像）

## 🚀 デプロイ

### 本番環境用のGoogle認証情報準備

```bash
# macOS/Linux: credentials.jsonをBase64エンコード（改行なし）
base64 -i credentials.json | tr -d '\n'

# または、1行で出力
base64 -w 0 credentials.json  # Linux
base64 -b 0 credentials.json  # macOS

# Windows (PowerShell)
[Convert]::ToBase64String([IO.File]::ReadAllBytes("credentials.json"))

# 出力された文字列（改行なし）をGOOGLE_CREDENTIALS_BASE64環境変数に設定
# ⚠️ 重要: 改行文字は含めないでください

# 検証コマンド（デコードして確認）
echo $GOOGLE_CREDENTIALS_BASE64 | base64 -d | jq .
```

**例**:
```bash
# エンコード例
$ base64 -i credentials.json
eyJ0eXBlIjoic2VydmljZV9hY2NvdW50IiwicHJvamVjdF9pZCI6Im15LXByb2plY3QiLCJwcml2YXRlX2tleV9pZCI6IjEyMzQ1NiIsInByaXZhdGVfa2V5IjoiLS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tXG5NSUlFdlFJQkFEQU5CZ2txaGtpRzl3MEJBUUVGQUFTQ0JLY3dnZ1NqQWdFQUFvSUJBUURCaXZNdjJtWi4uLlxuLS0tLS1FTkQgUFJJVkFURSBLRVktLS0tLVxuIiwiY2xpZW50X2VtYWlsIjoibXktc2VydmljZUBteS1wcm9qZWN0LmlhbS5nc2VydmljZWFjY291bnQuY29tIiwiY2xpZW50X2lkIjoiMTIzNDU2Nzg5MCIsImF1dGhfdXJpIjoiaHR0cHM6Ly9hY2NvdW50cy5nb29nbGUuY29tL28vb2F1dGgyL2F1dGgiLCJ0b2tlbl91cmkiOiJodHRwczovL29hdXRoMi5nb29nbGVhcGlzLmNvbS90b2tlbiJ9

# この文字列をコピーして環境変数に設定
```

### Heroku

```bash
heroku create your-app-name
heroku config:set LINE_CHANNEL_ACCESS_TOKEN=xxx
heroku config:set LINE_CHANNEL_SECRET=xxx  
heroku config:set GOOGLE_SHEET_ID=xxx
heroku config:set GOOGLE_CREDENTIALS_BASE64="$(base64 -i credentials.json)"
git push heroku main
```

### Render.com

1. **GitHubリポジトリをRender.comに接続**

2. **Secret Files設定** (推奨):
   - Render.com Dashboard → Service → Secret Files
   - ファイル名: `credentials.json`
   - ファイル内容: Google Cloud Service Accountの認証情報
   - パス: `/etc/secrets/credentials.json` （自動設定）

3. **Environment Variables設定**:
   ```
   LINE_CHANNEL_ACCESS_TOKEN=your_line_access_token
   LINE_CHANNEL_SECRET=your_line_channel_secret
   GOOGLE_SHEET_ID=your_spreadsheet_id
   NODE_ENV=production
   ```

4. **Build & Start Commands**:
   ```
   Build Command: npm install
   Start Command: npm start
   ```

### Google Cloud Run

```bash
# 環境変数を設定してデプロイ
gcloud run deploy weight-tracking-bot \
  --source . \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --set-env-vars LINE_CHANNEL_ACCESS_TOKEN=xxx \
  --set-env-vars LINE_CHANNEL_SECRET=xxx \
  --set-env-vars GOOGLE_SHEET_ID=xxx \
  --set-env-vars GOOGLE_CREDENTIALS_BASE64="$(base64 -i credentials.json)"
```

## 🧪 テスト

```bash
npm test
```

## 📊 データ形式

### Googleスプレッドシート

#### メインシート（体重記録）
| 日付 | 時刻 | ユーザーID | 体重(kg) | ニックネーム |
|------|------|------------|----------|------------|
| 2025/06/11 | 07:35:00 | U123... | 69.5 | 田中 |

#### ユーザー管理シート
| ユーザーID | 名前 | 目標体重 | 現在体重 | 身長 | 起床時間 | 登録日 | 最終記録日 | 連続記録日数 |
|-----------|------|----------|----------|------|----------|--------|------------|------------|
| U123... | 田中 | 65 | 69.5 | 170 | 06:30 | 2025/06/01 | 2025/06/11 | 7 |

### インメモリユーザーデータ構造

```javascript
{
  lineUserId: string,
  name: string,           // 追加: ユーザーニックネーム
  goalWeight: number,
  currentWeight: number,
  height: number,
  wakeTime: string,       // HH:MM format
  isCompleted: boolean,
  lastRecordDate: Date,
  registrationStep: number // 0-6: 登録進行状況
}
```

### API レスポンス形式

```javascript
// GET /api/users レスポンス
{
  "users": [
    {
      "userId": "U123...",
      "name": "田中",
      "currentWeight": 70.5,
      "goalWeight": 65,
      "progress": 45,        // 進捗率（%）
      "lastRecord": "2025/06/11",
      "streak": 7,           // 連続記録日数
      "registrationDate": "2025/06/01"
    }
  ]
}

// GET /api/dashboard-stats レスポンス
{
  "totalUsers": 15,
  "activeUsers": 12,       // 7日以内に記録があるユーザー
  "usersRecordedToday": 8,
  "totalRecords": 450,
  "averageProgress": 67,   // 平均進捗率（%）
  "lastUpdated": "2025-06-11T10:00:00.000Z"
}
```

## 🛠️ 設定ガイド

### ダッシュボード設定

1. **アクセス**: `http://localhost:3001/dashboard/index.html`
2. **デフォルトパスワード**: `default-password`
3. **セキュリティ**: 本番環境では`DASHBOARD_PASSWORD`環境変数を設定
4. **機能**:
   - ユーザー一覧・検索
   - 個別ユーザー詳細（統計・履歴）
   - リアルタイム統計情報
   - レスポンシブデザイン
   - ダークモード対応

### リッチメニュー設定

詳細は `RICH_MENU_SETUP.md` を参照：
- 推奨サイズ: 2500×1686px
- 6分割レイアウト（3×2）
- LINE Developers Console での設定手順

## 🔮 今後の拡張予定

### Phase 2: 高度なユーザー管理
- ✅ ニックネーム機能
- ✅ 管理ダッシュボード
- 🔄 チーム・グループ管理
- 🔄 目標設定のカスタマイズ

### Phase 3: データ分析強化
- 🔄 体重推移グラフの高度化
- 🔄 マクロ栄養素記録
- 🔄 AI による食事提案
- 🔄 週次・月次レポート

### Phase 4: システム統合
- 🔄 パーソナルトレーニング予約システム統合
- 🔄 外部フィットネスアプリ連携
- 🔄 データベース移行（Map → PostgreSQL/MongoDB）
- 🔄 マルチテナント対応

## ⚠️ 注意事項

### データ保存について
- **インメモリ**: ユーザーデータはメモリ上に保存（再起動時にリセット）
- **永続化**: Google Sheetsに体重記録とユーザー管理情報を保存
- **バックアップ**: Google Sheetsが実質的なデータベースの役割

### API制限
- **LINE Messaging API**: 1000通/分
- **Google Sheets API**: 100リクエスト/100秒/ユーザー
- **ダッシュボード**: 同時接続数に制限なし（セッション管理）

### セキュリティ
- **ダッシュボード**: パスワード認証 + 24時間有効トークン
- **LINE データ**: ユーザーIDのみ保存（個人情報なし）
- **Google Sheets**: サービスアカウント認証

## 📝 ライセンス

ISC

## 🤝 コントリビューション

Issue報告やPull Requestを歓迎します。

## 📞 サポート

プロジェクトに関する質問や問題は、GitHubのIssueでお知らせください。