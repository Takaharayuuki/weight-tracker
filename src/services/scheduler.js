const cron = require('node-cron');
const userStore = require('../data/userStore');
const lineBot = require('./lineBot');
const messages = require('../utils/messages');

// アクティブなジョブを管理
const activeJobs = new Map();

// スケジューラーを開始
function startSchedulers() {
  console.log('スケジューラーを開始しました');
  console.log('現在時刻:', new Date().toString());
  
  // 毎分実行して、起床時間のユーザーにメッセージを送信
  cron.schedule('* * * * *', async () => {
    await checkAndSendMorningMessages();
  });
  
  // 毎日20:00に未記録のユーザーにリマインダーを送信（JST）
  cron.schedule('0 20 * * *', async () => {
    console.log('📅 夜のリマインダー実行開始:', new Date().toString());
    await sendEveningReminders();
  }, {
    timezone: "Asia/Tokyo"
  });
  
  // デバッグ用: 毎分チェック（後で削除）
  cron.schedule('* * * * *', async () => {
    const now = new Date();
    if (now.getMinutes() % 5 === 0) { // 5分おきにログ出力
      console.log(`📊 スケジューラー動作中: ${now.toString()}`);
      console.log(`登録済みユーザー数: ${userStore.getUserCount()}`);
    }
  });
}

// 起床時間のチェックとメッセージ送信
async function checkAndSendMorningMessages() {
  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  
  const users = userStore.getAllUsers();
  
  for (const [userId, user] of users) {
    if (user.isCompleted && user.wakeTime === currentTime) {
      // 既に今日送信済みかチェック
      const lastSentKey = `morning_${userId}_${now.toDateString()}`;
      if (!activeJobs.has(lastSentKey)) {
        activeJobs.set(lastSentKey, true);
        await sendMorningMessage(userId, user);
      }
    }
  }
}

// おはようメッセージを送信
async function sendMorningMessage(userId, user) {
  try {
    const morningMessages = messages.getMorningMessage(user.name || 'ユーザー');
    await lineBot.pushMessage(userId, morningMessages);
    console.log(`おはようメッセージを送信しました: ${userId}`);
  } catch (error) {
    console.error(`おはようメッセージの送信に失敗しました: ${userId}`, error);
  }
}

// 夜のリマインダーを送信
async function sendEveningReminders() {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  
  console.log(`📅 リマインダーチェック開始: ${now.toString()}`);
  console.log(`📅 今日の日付: ${today.toString()}`);
  
  const users = userStore.getAllUsers();
  console.log(`📊 チェック対象ユーザー数: ${users.size}`);
  
  let remindersSent = 0;
  
  for (const [userId, user] of users) {
    if (user.isCompleted) {
      console.log(`👤 ユーザーチェック: ${user.name} (${userId})`);
      console.log(`  - 最終記録日: ${user.lastRecordDate}`);
      
      let shouldSendReminder = false;
      
      if (user.lastRecordDate) {
        const lastRecord = new Date(user.lastRecordDate);
        lastRecord.setHours(0, 0, 0, 0);
        console.log(`  - 最終記録日(正規化): ${lastRecord.toString()}`);
        
        // 今日記録していない場合
        if (lastRecord.getTime() < today.getTime()) {
          console.log(`  - 今日未記録: リマインダー送信対象`);
          shouldSendReminder = true;
        } else {
          console.log(`  - 今日記録済み: リマインダー不要`);
        }
      } else {
        // 一度も記録していない場合
        console.log(`  - 記録なし: リマインダー送信対象`);
        shouldSendReminder = true;
      }
      
      if (shouldSendReminder) {
        await sendReminderMessage(userId, user.name);
        remindersSent++;
      }
    }
  }
  
  console.log(`📅 リマインダー送信完了: ${remindersSent}件送信`);
}

// リマインダーメッセージを送信
async function sendReminderMessage(userId, userName = 'ユーザー') {
  try {
    const reminderMessage = {
      type: 'text',
      text: `🌙 ${userName}さん、お疲れ様です！\n\n今日の体重はまだ記録されていません。\n\n忘れずに記録しましょう！💪\n数値を送信するだけで記録できます。`,
      quickReply: {
        items: [
          {
            type: 'action',
            action: {
              type: 'message',
              label: '体重記録',
              text: '体重記録'
            }
          }
        ]
      }
    };
    await lineBot.pushMessage(userId, reminderMessage);
    console.log(`✅ リマインダーメッセージを送信しました: ${userName} (${userId})`);
  } catch (error) {
    console.error(`❌ リマインダーメッセージの送信に失敗しました: ${userName} (${userId})`, error);
  }
}

// 特定のユーザーに対してスケジュールされたメッセージを送信（将来の拡張用）
function scheduleUserMessage(userId, cronExpression, messageCallback) {
  const jobKey = `user_${userId}_${Date.now()}`;
  const job = cron.schedule(cronExpression, async () => {
    await messageCallback(userId);
  });
  
  activeJobs.set(jobKey, job);
  return jobKey;
}

// スケジュールされたジョブをキャンセル
function cancelScheduledJob(jobKey) {
  const job = activeJobs.get(jobKey);
  if (job && typeof job.stop === 'function') {
    job.stop();
    activeJobs.delete(jobKey);
    return true;
  }
  return false;
}

// テスト用: 即座にリマインダーをチェック（デバッグ用）
async function testReminderCheck() {
  console.log('🧪 テスト用リマインダーチェック開始');
  await sendEveningReminders();
}

module.exports = {
  startSchedulers,
  scheduleUserMessage,
  cancelScheduledJob,
  testReminderCheck,
  sendEveningReminders
};