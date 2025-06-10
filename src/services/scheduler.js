const cron = require('node-cron');
const userStore = require('../data/userStore');
const lineBot = require('./lineBot');
const messages = require('../utils/messages');

// アクティブなジョブを管理
const activeJobs = new Map();

// スケジューラーを開始
function startSchedulers() {
  console.log('スケジューラーを開始しました');
  
  // 毎分実行して、起床時間のユーザーにメッセージを送信
  cron.schedule('* * * * *', async () => {
    await checkAndSendMorningMessages();
  });
  
  // 毎日20:00に未記録のユーザーにリマインダーを送信
  cron.schedule('0 20 * * *', async () => {
    await sendEveningReminders();
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
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const users = userStore.getAllUsers();
  
  for (const [userId, user] of users) {
    if (user.isCompleted && user.lastRecordDate) {
      const lastRecord = new Date(user.lastRecordDate);
      lastRecord.setHours(0, 0, 0, 0);
      
      // 今日記録していない場合
      if (lastRecord.getTime() < today.getTime()) {
        await sendReminderMessage(userId);
      }
    } else if (user.isCompleted && !user.lastRecordDate) {
      // 一度も記録していない場合
      await sendReminderMessage(userId);
    }
  }
}

// リマインダーメッセージを送信
async function sendReminderMessage(userId) {
  try {
    const reminderMessage = {
      type: 'text',
      text: '🌙 今日の体重はまだ記録されていません。\n\n忘れずに記録しましょう！\n数値を送信するだけで記録できます。'
    };
    await lineBot.pushMessage(userId, reminderMessage);
    console.log(`リマインダーメッセージを送信しました: ${userId}`);
  } catch (error) {
    console.error(`リマインダーメッセージの送信に失敗しました: ${userId}`, error);
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

module.exports = {
  startSchedulers,
  scheduleUserMessage,
  cancelScheduledJob
};