require('dotenv').config();
const express = require('express');
const lineBot = require('./services/lineBot');
const scheduler = require('./services/scheduler');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Webhookエンドポイント - GETリクエスト（LINE検証用）
app.get('/webhook', (req, res) => {
  res.status(200).send('OK');
});

// Webhookエンドポイント - POSTリクエスト（実際のメッセージ処理）
app.post('/webhook', lineBot.middleware, (req, res) => {
  console.log('Webhook受信:', JSON.stringify(req.body, null, 2));
  
  if (!req.body.events || req.body.events.length === 0) {
    console.log('イベントが空です');
    return res.status(200).send('OK');
  }
  
  // タイムアウト付きでイベント処理
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Webhook処理タイムアウト')), 15000)
  );
  
  Promise.race([
    Promise.all(req.body.events.map(lineBot.handleEvent)),
    timeoutPromise
  ])
    .then((result) => {
      console.log('Webhook処理完了:', result);
      res.status(200).send('OK');
    })
    .catch((err) => {
      console.error('Webhook処理エラー:', err);
      // タイムアウトエラーでも200を返す（LINEに再送防止）
      res.status(200).send('OK');
    });
});

// ダッシュボード用の静的ファイル配信
app.use('/dashboard', express.static(path.join(__dirname, '../dashboard')));

// ヘルスチェックエンドポイント
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ルートエンドポイント
app.get('/', (req, res) => {
  res.json({ 
    message: '体重記録LINE Bot is running',
    version: '1.0.0'
  });
});

// エラーハンドリングミドルウェア
app.use((err, req, res, next) => {
  console.error('Express エラー:', err);
  
  if (err.name === 'SignatureValidationFailed') {
    console.error('LINE署名検証エラー:', err.message);
    return res.status(401).send('Unauthorized');
  }
  
  res.status(500).send('Internal Server Error');
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`サーバーが起動しました。ポート: ${PORT}`);
  console.log(`環境: ${process.env.NODE_ENV || 'development'}`);
  
  // スケジューラーの開始
  scheduler.startSchedulers();
});