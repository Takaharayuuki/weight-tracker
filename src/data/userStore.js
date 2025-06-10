// ユーザーデータの管理（インメモリストア）
// 将来的にはデータベースに移行予定

// ユーザーデータを保存するMap
const users = new Map();

// ユーザーデータのスキーマ
class User {
  constructor(lineUserId) {
    this.lineUserId = lineUserId;
    this.goalWeight = null;
    this.currentWeight = null;
    this.height = null;
    this.wakeTime = null;
    this.isCompleted = false;
    this.createdAt = new Date();
    this.lastRecordDate = null;
    this.name = null;
    // 段階的登録用
    this.registrationStep = 0; // 0: 未開始, 1: 名前, 2: 目標体重, 3: 現在体重, 4: 身長, 5: 起床時間
  }
}

// 新規ユーザーを作成
function createUser(lineUserId) {
  const user = new User(lineUserId);
  users.set(lineUserId, user);
  console.log(`新規ユーザーを作成しました: ${lineUserId}`);
  return user;
}

// ユーザー情報を取得
function getUser(lineUserId) {
  return users.get(lineUserId);
}

// ユーザー情報を更新
function updateUser(lineUserId, updates) {
  const user = users.get(lineUserId);
  if (!user) {
    console.error(`ユーザーが見つかりません: ${lineUserId}`);
    return null;
  }
  
  // 更新可能なフィールドのみ更新
  const allowedFields = [
    'goalWeight',
    'currentWeight',
    'height',
    'wakeTime',
    'isCompleted',
    'lastRecordDate',
    'name',
    'registrationStep'
  ];
  
  for (const field of allowedFields) {
    if (updates.hasOwnProperty(field)) {
      user[field] = updates[field];
    }
  }
  
  console.log(`ユーザー情報を更新しました: ${lineUserId}`, updates);
  return user;
}

// ユーザーを削除
function deleteUser(lineUserId) {
  const result = users.delete(lineUserId);
  if (result) {
    console.log(`ユーザーを削除しました: ${lineUserId}`);
  }
  return result;
}

// 全ユーザーを取得
function getAllUsers() {
  return users;
}

// 登録完了したユーザーのみ取得
function getCompletedUsers() {
  const completedUsers = new Map();
  for (const [userId, user] of users) {
    if (user.isCompleted) {
      completedUsers.set(userId, user);
    }
  }
  return completedUsers;
}

// ユーザー数を取得
function getUserCount() {
  return users.size;
}

// 特定の起床時間のユーザーを取得
function getUsersByWakeTime(wakeTime) {
  const matchingUsers = [];
  for (const [userId, user] of users) {
    if (user.isCompleted && user.wakeTime === wakeTime) {
      matchingUsers.push({ userId, user });
    }
  }
  return matchingUsers;
}

// 本日未記録のユーザーを取得
function getUsersWithoutTodayRecord() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const unrecordedUsers = [];
  for (const [userId, user] of users) {
    if (user.isCompleted) {
      if (!user.lastRecordDate || new Date(user.lastRecordDate) < today) {
        unrecordedUsers.push({ userId, user });
      }
    }
  }
  return unrecordedUsers;
}

// データの永続化（将来の実装のためのプレースホルダー）
async function saveToDatabase() {
  // TODO: データベースへの保存処理
  console.log('データベースへの保存機能は未実装です');
}

// データの復元（将来の実装のためのプレースホルダー）
async function loadFromDatabase() {
  // TODO: データベースからの読み込み処理
  console.log('データベースからの読み込み機能は未実装です');
}

// デバッグ用：全ユーザーデータを表示
function debugPrintAllUsers() {
  console.log('=== 全ユーザーデータ ===');
  for (const [userId, user] of users) {
    console.log(`UserID: ${userId}`);
    console.log(JSON.stringify(user, null, 2));
    console.log('---');
  }
  console.log(`総ユーザー数: ${users.size}`);
}

module.exports = {
  createUser,
  getUser,
  updateUser,
  deleteUser,
  getAllUsers,
  getCompletedUsers,
  getUserCount,
  getUsersByWakeTime,
  getUsersWithoutTodayRecord,
  saveToDatabase,
  loadFromDatabase,
  debugPrintAllUsers
};