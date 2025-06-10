// ユーザーの一時的な状態管理
// リッチメニューからのアクション後の状態を管理

// ユーザーの一時状態を保存するMap
const userStates = new Map();

// 状態の種類
const STATE_TYPES = {
  WAITING_WEIGHT_INPUT: 'WAITING_WEIGHT_INPUT',        // 体重入力待ち
  WAITING_GOAL_WEIGHT: 'WAITING_GOAL_WEIGHT',          // 目標体重変更待ち
  NORMAL: 'NORMAL'                                     // 通常状態
};

// ユーザー状態のスキーマ
class UserState {
  constructor(userId, stateType = STATE_TYPES.NORMAL) {
    this.userId = userId;
    this.stateType = stateType;
    this.createdAt = new Date();
    this.expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30分で期限切れ
    this.metadata = {}; // 追加のデータ
  }
}

// ユーザーの状態を設定
function setUserState(userId, stateType, metadata = {}) {
  const state = new UserState(userId, stateType);
  state.metadata = metadata;
  userStates.set(userId, state);
  
  console.log(`ユーザー状態を設定: ${userId} -> ${stateType}`, metadata);
  
  // 自動で期限切れのクリーンアップ
  setTimeout(() => {
    if (userStates.has(userId)) {
      const currentState = userStates.get(userId);
      if (currentState.expiresAt <= new Date()) {
        userStates.delete(userId);
        console.log(`ユーザー状態を期限切れで削除: ${userId}`);
      }
    }
  }, 30 * 60 * 1000);
  
  return state;
}

// ユーザーの状態を取得
function getUserState(userId) {
  const state = userStates.get(userId);
  
  if (!state) {
    return null;
  }
  
  // 期限切れチェック
  if (state.expiresAt <= new Date()) {
    userStates.delete(userId);
    console.log(`期限切れのユーザー状態を削除: ${userId}`);
    return null;
  }
  
  return state;
}

// ユーザーの状態をクリア
function clearUserState(userId) {
  const deleted = userStates.delete(userId);
  if (deleted) {
    console.log(`ユーザー状態をクリア: ${userId}`);
  }
  return deleted;
}

// ユーザーが特定の状態かチェック
function isUserInState(userId, stateType) {
  const state = getUserState(userId);
  return state && state.stateType === stateType;
}

// 通常状態に戻す
function setNormalState(userId) {
  return setUserState(userId, STATE_TYPES.NORMAL);
}

// すべての期限切れ状態をクリーンアップ
function cleanupExpiredStates() {
  const now = new Date();
  let cleanedCount = 0;
  
  for (const [userId, state] of userStates.entries()) {
    if (state.expiresAt <= now) {
      userStates.delete(userId);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`期限切れ状態を${cleanedCount}件クリーンアップしました`);
  }
  
  return cleanedCount;
}

// 統計情報を取得
function getStateStats() {
  cleanupExpiredStates(); // クリーンアップしてから統計取得
  
  const stats = {
    total: userStates.size,
    byType: {}
  };
  
  for (const state of userStates.values()) {
    if (!stats.byType[state.stateType]) {
      stats.byType[state.stateType] = 0;
    }
    stats.byType[state.stateType]++;
  }
  
  return stats;
}

// 定期的なクリーンアップ（10分ごと）
setInterval(cleanupExpiredStates, 10 * 60 * 1000);

module.exports = {
  STATE_TYPES,
  setUserState,
  getUserState,
  clearUserState,
  isUserInState,
  setNormalState,
  cleanupExpiredStates,
  getStateStats
};