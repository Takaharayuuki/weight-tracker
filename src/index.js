require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const lineBot = require('./services/lineBot');
const scheduler = require('./services/scheduler');
const userStore = require('./data/userStore');
const sheets = require('./services/sheets');
const calculations = require('./utils/calculations');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS設定（ローカル開発用）
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'],
  credentials: true
}));

// JSON解析用
app.use(express.json());

// ダッシュボード用API認証
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || 'default-password';
const sessions = new Map(); // 簡易セッション管理

// 認証チェック用ミドルウェア
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const session = sessions.get(token);
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return res.status(401).json({ error: 'Token expired' });
  }
  
  next();
}

// API認証エンドポイント
app.post('/api/auth', (req, res) => {
  const { password } = req.body;
  
  if (password !== DASHBOARD_PASSWORD) {
    return res.status(401).json({ error: 'Invalid password' });
  }
  
  // 簡易トークン生成（24時間有効）
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24時間
  
  sessions.set(token, { expiresAt });
  
  res.json({ 
    token,
    expiresAt: new Date(expiresAt).toISOString()
  });
});

// 全ユーザー一覧API
app.get('/api/users', requireAuth, async (req, res) => {
  try {
    console.log('ダッシュボードAPI: 全ユーザー一覧取得開始');
    
    // インメモリのユーザー情報を取得
    const allUsers = userStore.getAllUsers();
    const users = [];
    
    for (const [userId, user] of allUsers) {
      if (user.isCompleted) {
        try {
          // Google Sheetsからユーザー管理情報を取得
          const sheetUserInfo = await sheets.getUserInfo(userId);
          
          // 進捗計算
          const weightDiff = user.goalWeight - user.currentWeight;
          const totalTarget = user.goalWeight - (sheetUserInfo?.currentWeight || user.currentWeight);
          const progress = totalTarget === 0 ? 100 : Math.max(0, Math.min(100, 
            ((totalTarget - weightDiff) / totalTarget) * 100
          ));
          
          users.push({
            userId: userId,
            name: user.name || sheetUserInfo?.name || 'ユーザー',
            currentWeight: user.currentWeight,
            goalWeight: user.goalWeight,
            height: user.height,
            wakeTime: user.wakeTime,
            progress: Math.round(progress),
            lastRecord: sheetUserInfo?.lastRecordDate || user.lastRecordDate?.toISOString().split('T')[0].replace(/-/g, '/') || '',
            streak: sheetUserInfo?.consecutiveDays || 0,
            registrationDate: sheetUserInfo?.registrationDate || ''
          });
        } catch (userError) {
          console.error(`ユーザー${userId}の情報取得エラー:`, userError);
          // エラーが発生してもユーザーリストに含める
          users.push({
            userId: userId,
            name: user.name || 'ユーザー',
            currentWeight: user.currentWeight,
            goalWeight: user.goalWeight,
            height: user.height,
            wakeTime: user.wakeTime,
            progress: 0,
            lastRecord: '',
            streak: 0,
            registrationDate: ''
          });
        }
      }
    }
    
    console.log(`ダッシュボードAPI: ${users.length}人のユーザー情報を返却`);
    res.json({ users });
    
  } catch (error) {
    console.error('ダッシュボードAPI: 全ユーザー取得エラー:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// 特定ユーザー詳細API
app.get('/api/users/:userId', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`ダッシュボードAPI: ユーザー詳細取得 ${userId}`);
    
    const user = userStore.getUser(userId);
    if (!user || !user.isCompleted) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Google Sheetsからの詳細情報
    const [sheetUserInfo, weightHistory] = await Promise.all([
      sheets.getUserInfo(userId),
      sheets.getUserWeightHistory(userId, 30)
    ]);
    
    // 統計計算
    const weeklyAverage = await calculations.getWeeklyAverage(userId);
    const monthlyAverage = await calculations.getMonthlyAverage(userId);
    
    // 進捗計算
    const weightDiff = user.goalWeight - user.currentWeight;
    const initialWeight = weightHistory.length > 0 ? weightHistory[0].weight : user.currentWeight;
    const totalTarget = user.goalWeight - initialWeight;
    const progress = totalTarget === 0 ? 100 : Math.max(0, Math.min(100, 
      ((totalTarget - weightDiff) / totalTarget) * 100
    ));
    
    const userDetail = {
      userId: userId,
      name: user.name || sheetUserInfo?.name || 'ユーザー',
      currentWeight: user.currentWeight,
      goalWeight: user.goalWeight,
      height: user.height,
      wakeTime: user.wakeTime,
      progress: Math.round(progress),
      lastRecord: sheetUserInfo?.lastRecordDate || '',
      streak: sheetUserInfo?.consecutiveDays || 0,
      registrationDate: sheetUserInfo?.registrationDate || '',
      statistics: {
        weeklyAverage: weeklyAverage ? Math.round(weeklyAverage * 10) / 10 : null,
        monthlyAverage: monthlyAverage ? Math.round(monthlyAverage * 10) / 10 : null,
        totalRecords: weightHistory.length,
        weightChange: initialWeight ? Math.round((user.currentWeight - initialWeight) * 10) / 10 : 0
      },
      recentHistory: weightHistory.slice(-7).map(record => ({
        date: record.date,
        weight: record.weight,
        name: record.name
      }))
    };
    
    console.log(`ダッシュボードAPI: ユーザー詳細を返却 ${userId}`);
    res.json(userDetail);
    
  } catch (error) {
    console.error('ダッシュボードAPI: ユーザー詳細取得エラー:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// 統計情報API
app.get('/api/dashboard-stats', requireAuth, async (req, res) => {
  try {
    console.log('ダッシュボードAPI: 統計情報取得開始');
    
    const allUsers = userStore.getAllUsers();
    const completedUsers = Array.from(allUsers.values()).filter(user => user.isCompleted);
    
    // 基本統計
    const totalUsers = completedUsers.length;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let usersRecordedToday = 0;
    let activeUsers = 0; // 7日以内に記録があるユーザー
    let totalProgress = 0;
    
    for (const user of completedUsers) {
      // Google Sheetsから最新情報を取得
      try {
        const sheetUserInfo = await sheets.getUserInfo(user.lineUserId);
        
        // 今日記録したユーザー数
        if (sheetUserInfo?.lastRecordDate) {
          const lastRecordDate = new Date(sheetUserInfo.lastRecordDate.replace(/\//g, '-'));
          lastRecordDate.setHours(0, 0, 0, 0);
          if (lastRecordDate.getTime() === today.getTime()) {
            usersRecordedToday++;
          }
          
          // アクティブユーザー（7日以内）
          const daysDiff = (today - lastRecordDate) / (24 * 60 * 60 * 1000);
          if (daysDiff <= 7) {
            activeUsers++;
          }
        }
        
        // 進捗計算
        const weightDiff = user.goalWeight - user.currentWeight;
        const initialWeight = user.currentWeight; // 簡易計算
        const targetDiff = user.goalWeight - initialWeight;
        const progress = targetDiff === 0 ? 100 : Math.max(0, Math.min(100, 
          ((targetDiff - weightDiff) / targetDiff) * 100
        ));
        totalProgress += progress;
        
      } catch (userError) {
        console.error(`統計計算エラー (${user.lineUserId}):`, userError);
      }
    }
    
    const averageProgress = totalUsers > 0 ? Math.round(totalProgress / totalUsers) : 0;
    
    // Google Sheetsから全体統計
    let totalRecords = 0;
    try {
      const allUsersData = await sheets.getAllUsersData();
      totalRecords = Object.values(allUsersData).reduce((sum, records) => sum + records.length, 0);
    } catch (error) {
      console.error('Google Sheets統計取得エラー:', error);
    }
    
    const stats = {
      totalUsers,
      activeUsers,
      usersRecordedToday,
      totalRecords,
      averageProgress,
      lastUpdated: new Date().toISOString()
    };
    
    console.log('ダッシュボードAPI: 統計情報を返却', stats);
    res.json(stats);
    
  } catch (error) {
    console.error('ダッシュボードAPI: 統計情報取得エラー:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

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

// 一時ファイル（グラフ画像）配信
app.use('/temp', express.static(path.join(__dirname, '../temp')));

// ヘルスチェックエンドポイント
app.get('/health', (req, res) => {
  const googleAuth = process.env.NODE_ENV === 'production' ? 
    (require('fs').existsSync('/etc/secrets/credentials.json') ? 'file' : 'none') :
    (require('fs').existsSync(require('path').join(__dirname, '../credentials.json')) ? 'file' : 'none');
  
  // ユーザー状態統計を取得
  const userStateStore = require('./data/userStateStore');
  const userStore = require('./data/userStore');
  const stateStats = userStateStore.getStateStats();
  const userCount = userStore.getUserCount();
  
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    googleAuth: googleAuth,
    lineConfigured: !!(process.env.LINE_CHANNEL_ACCESS_TOKEN && process.env.LINE_CHANNEL_SECRET),
    userStats: {
      totalUsers: userCount,
      activeStates: stateStats.total,
      stateBreakdown: stateStats.byType
    }
  });
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
  console.log(`ダッシュボードパスワード: ${DASHBOARD_PASSWORD !== 'default-password' ? '設定済み' : 'デフォルト'}`);
  console.log('ダッシュボードAPI エンドポイント:');
  console.log('  POST /api/auth - 認証');
  console.log('  GET  /api/users - 全ユーザー一覧');
  console.log('  GET  /api/users/:userId - ユーザー詳細');
  console.log('  GET  /api/dashboard-stats - 統計情報');
  
  // スケジューラーの開始
  scheduler.startSchedulers();
});