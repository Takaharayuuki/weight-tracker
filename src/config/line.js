const line = require('@line/bot-sdk');

// LINE Bot設定
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

// 設定の検証
if (!config.channelAccessToken || !config.channelSecret) {
  console.error('LINE設定エラー: 環境変数が設定されていません');
  console.error('LINE_CHANNEL_ACCESS_TOKENとLINE_CHANNEL_SECRETを設定してください');
  process.exit(1);
}

// デバッグ用ログ
console.log('LINE設定を読み込みました');
console.log(`Channel Secret: ${config.channelSecret ? '設定済み' : '未設定'}`);
console.log(`Access Token: ${config.channelAccessToken ? '設定済み' : '未設定'}`);
console.log(`Channel Secret (最初の10文字): ${config.channelSecret ? config.channelSecret.substring(0, 10) + '...' : 'なし'}`);

// LINE Clientの作成
const client = new line.Client(config);

// カスタムミドルウェア（デバッグ用）
const customMiddleware = (req, res, next) => {
  console.log('リクエストヘッダー:');
  console.log(`  x-line-signature: ${req.headers['x-line-signature']}`);
  console.log(`  content-type: ${req.headers['content-type']}`);
  console.log(`  content-length: ${req.headers['content-length']}`);
  
  // 開発環境で署名検証をスキップするオプション
  if (process.env.SKIP_SIGNATURE_VALIDATION === 'true') {
    console.log('⚠️  署名検証をスキップしています（開発用）');
    return next();
  }
  
  // 元のミドルウェアを実行
  const originalMiddleware = line.middleware(config);
  originalMiddleware(req, res, next);
};

module.exports = {
  config,
  client,
  middleware: customMiddleware
};