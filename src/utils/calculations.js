const sheets = require('../services/sheets');

// BMIを計算
function calculateBMI(weight, height) {
  // 身長をメートルに変換
  const heightInMeters = height / 100;
  // BMI = 体重(kg) / (身長(m) * 身長(m))
  const bmi = weight / (heightInMeters * heightInMeters);
  return Math.round(bmi * 10) / 10;
}

// BMIの状態を判定
function getBMIStatus(bmi) {
  if (bmi < 18.5) {
    return '低体重';
  } else if (bmi < 25) {
    return '普通体重';
  } else if (bmi < 30) {
    return '肥満（1度）';
  } else if (bmi < 35) {
    return '肥満（2度）';
  } else if (bmi < 40) {
    return '肥満（3度）';
  } else {
    return '肥満（4度）';
  }
}

// 週平均を計算
async function getWeeklyAverage(userId) {
  try {
    // 過去7日間のデータを取得
    const history = await sheets.getUserWeightHistory(userId, 7);
    
    if (history.length === 0) {
      return null;
    }
    
    // 平均を計算
    const sum = history.reduce((acc, record) => acc + record.weight, 0);
    const average = sum / history.length;
    
    return Math.round(average * 10) / 10;
  } catch (error) {
    console.error('週平均の計算エラー:', error);
    return null;
  }
}

// 月平均を計算
async function getMonthlyAverage(userId) {
  try {
    // 過去30日間のデータを取得
    const history = await sheets.getUserWeightHistory(userId, 30);
    
    if (history.length === 0) {
      return null;
    }
    
    // 平均を計算
    const sum = history.reduce((acc, record) => acc + record.weight, 0);
    const average = sum / history.length;
    
    return Math.round(average * 10) / 10;
  } catch (error) {
    console.error('月平均の計算エラー:', error);
    return null;
  }
}

// 体重変化を計算
async function calculateWeightChange(userId, days = 7) {
  try {
    const history = await sheets.getUserWeightHistory(userId, days + 1);
    
    if (history.length < 2) {
      return null;
    }
    
    // 最新と指定日数前の体重を比較
    const latestWeight = history[history.length - 1].weight;
    const oldestWeight = history[0].weight;
    const change = latestWeight - oldestWeight;
    
    return {
      change: Math.round(change * 10) / 10,
      percentage: Math.round((change / oldestWeight) * 1000) / 10,
      latest: latestWeight,
      oldest: oldestWeight
    };
  } catch (error) {
    console.error('体重変化の計算エラー:', error);
    return null;
  }
}

// 目標達成予測
function predictGoalDate(currentWeight, goalWeight, weeklyChange) {
  if (weeklyChange === 0) {
    return null;
  }
  
  const totalChange = goalWeight - currentWeight;
  const weeksNeeded = Math.abs(totalChange / weeklyChange);
  
  if (weeksNeeded > 52) {
    // 1年以上かかる場合は予測しない
    return null;
  }
  
  const predictedDate = new Date();
  predictedDate.setDate(predictedDate.getDate() + (weeksNeeded * 7));
  
  return {
    date: predictedDate,
    weeksNeeded: Math.round(weeksNeeded),
    daysNeeded: Math.round(weeksNeeded * 7)
  };
}

// 理想体重を計算（BMI 22）
function calculateIdealWeight(height) {
  const heightInMeters = height / 100;
  const idealWeight = 22 * heightInMeters * heightInMeters;
  return Math.round(idealWeight * 10) / 10;
}

// 基礎代謝量を推定（簡易版）
function estimateBMR(weight, height, age = 30, gender = 'male') {
  let bmr;
  
  if (gender === 'male') {
    // 男性: (13.397 × 体重kg) + (4.799 × 身長cm) - (5.677 × 年齢) + 88.362
    bmr = (13.397 * weight) + (4.799 * height) - (5.677 * age) + 88.362;
  } else {
    // 女性: (9.247 × 体重kg) + (3.098 × 身長cm) - (4.330 × 年齢) + 447.593
    bmr = (9.247 * weight) + (3.098 * height) - (4.330 * age) + 447.593;
  }
  
  return Math.round(bmr);
}

// 今週の成果を計算
async function getWeeklyProgress(userId) {
  try {
    const userStore = require('../data/userStore');
    
    // ユーザーデータを取得
    const userData = userStore.getUser(userId);
    if (!userData) {
      throw new Error('ユーザーデータが見つかりません');
    }
    
    // 過去7日間のデータを取得
    const weightHistory = await sheets.getUserWeightHistory(userId, 7);
    
    if (weightHistory.length === 0) {
      return {
        hasData: false,
        message: '今週の記録がありません。体重を記録してから確認してください。'
      };
    }
    
    // 今週の統計を計算
    const weights = weightHistory.map(record => record.weight);
    const maxWeight = Math.max(...weights);
    const minWeight = Math.min(...weights);
    const currentWeight = weights[weights.length - 1];
    const firstWeight = weights[0];
    const weeklyAverage = weights.reduce((sum, weight) => sum + weight, 0) / weights.length;
    
    // 変化量を計算
    const weeklyChange = currentWeight - firstWeight;
    const goalWeight = userData.goalWeight;
    const goalDifference = currentWeight - goalWeight;
    
    // 連続記録日数を計算
    const consecutiveDays = calculateConsecutiveDays(weightHistory);
    
    return {
      hasData: true,
      recordCount: weightHistory.length,
      currentWeight,
      maxWeight,
      minWeight,
      weeklyAverage,
      weeklyChange,
      goalWeight,
      goalDifference,
      consecutiveDays,
      weightHistory
    };
    
  } catch (error) {
    console.error('今週の成果計算エラー:', error);
    return {
      hasData: false,
      error: error.message,
      message: '成果の計算に失敗しました。'
    };
  }
}

// 連続記録日数を計算
function calculateConsecutiveDays(weightHistory) {
  if (weightHistory.length === 0) return 0;
  
  // 日付を降順にソート（最新が最初）
  const sortedHistory = [...weightHistory].sort((a, b) => {
    const dateA = new Date(a.date.replace(/\//g, '-'));
    const dateB = new Date(b.date.replace(/\//g, '-'));
    return dateB - dateA;
  });
  
  let consecutiveDays = 1; // 最新の記録があるので1からスタート
  
  // 最新の記録から遡って連続日数をカウント
  for (let i = 1; i < sortedHistory.length; i++) {
    const currentDate = new Date(sortedHistory[i].date.replace(/\//g, '-'));
    const previousDate = new Date(sortedHistory[i-1].date.replace(/\//g, '-'));
    
    currentDate.setHours(0, 0, 0, 0);
    previousDate.setHours(0, 0, 0, 0);
    
    // 前日かチェック
    const diffTime = previousDate - currentDate;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      consecutiveDays++;
    } else {
      break; // 連続が途切れた
    }
  }
  
  return consecutiveDays;
}

// 包括的な健康指標を計算
function calculateHealthMetrics(weight, height, age = 30, gender = 'male') {
  const heightM = height / 100;
  
  // BMI
  const bmi = calculateBMI(weight, height);
  const bmiStatus = getBMIStatus(bmi);
  
  // 各種体重
  const standardWeight = heightM * heightM * 22; // BMI 22
  const beautyWeight = heightM * heightM * 20;   // BMI 20
  const modelWeight = heightM * heightM * 18;    // BMI 18
  const maxHealthyWeight = heightM * heightM * 24.9; // BMI上限
  const minHealthyWeight = heightM * heightM * 18.5; // BMI下限
  
  // 肥満度
  const obesityRate = ((weight - standardWeight) / standardWeight) * 100;
  
  // 基礎代謝量
  const bmr = estimateBMR(weight, height, age, gender);
  
  // 1日の推定必要カロリー
  const dailyCalories = {
    sedentary: Math.round(bmr * 1.2),    // ほぼ運動しない
    light: Math.round(bmr * 1.375),      // 軽い運動（週1-3日）
    moderate: Math.round(bmr * 1.55),    // 適度な運動（週3-5日）
    active: Math.round(bmr * 1.725),     // ハードな運動（週6-7日）
    veryActive: Math.round(bmr * 1.9)    // 非常にハード（週2回/日）
  };
  
  // 健康的な減量目標
  const healthyWeightLossPerWeek = weight * 0.005; // 体重の0.5%/週
  const healthyWeightLossPerMonth = healthyWeightLossPerWeek * 4;
  
  // 1kg減らすのに必要なカロリー削減量
  const caloriesPerKg = 7200; // 1kg = 約7200kcal
  const dailyCalorieDeficitFor1kgPerMonth = caloriesPerKg / 30;
  
  return {
    // 基本指標
    bmi: Number(bmi),
    bmiStatus,
    
    // 体重指標
    currentWeight: weight,
    standardWeight: Math.round(standardWeight * 10) / 10,
    beautyWeight: Math.round(beautyWeight * 10) / 10,
    modelWeight: Math.round(modelWeight * 10) / 10,
    maxHealthyWeight: Math.round(maxHealthyWeight * 10) / 10,
    minHealthyWeight: Math.round(minHealthyWeight * 10) / 10,
    
    // 差分
    toStandardWeight: Math.round((weight - standardWeight) * 10) / 10,
    toBeautyWeight: Math.round((weight - beautyWeight) * 10) / 10,
    toHealthyRange: weight > maxHealthyWeight ? 
      Math.round((weight - maxHealthyWeight) * 10) / 10 : 
      weight < minHealthyWeight ? 
      Math.round((minHealthyWeight - weight) * 10) / 10 : 0,
    
    // 肥満度
    obesityRate: Math.round(obesityRate * 10) / 10,
    obesityStatus: getObesityStatus(obesityRate),
    
    // 代謝・カロリー
    bmr,
    dailyCalories,
    
    // 健康的な減量目標
    healthyWeightLoss: {
      perWeek: Math.round(healthyWeightLossPerWeek * 10) / 10,
      perMonth: Math.round(healthyWeightLossPerMonth * 10) / 10,
      dailyCalorieDeficit: Math.round(dailyCalorieDeficitFor1kgPerMonth)
    }
  };
}

// 肥満度の状態を判定
function getObesityStatus(obesityRate) {
  if (obesityRate <= -10) {
    return 'やせ';
  } else if (obesityRate <= 10) {
    return '正常';
  } else if (obesityRate <= 20) {
    return '過体重';
  } else {
    return '肥満';
  }
}

// 健康指標の評価コメント
function getHealthAdvice(metrics) {
  const { bmi, obesityRate, toStandardWeight } = metrics;
  let advice = [];
  
  // BMIによるアドバイス
  if (bmi < 18.5) {
    advice.push('🔸 BMIが低体重の範囲です。適度な筋力トレーニングと栄養バランスの良い食事を心がけましょう。');
  } else if (bmi >= 18.5 && bmi < 25) {
    advice.push('✅ BMIが理想的な範囲内です。現在の生活習慣を維持しましょう。');
  } else if (bmi >= 25 && bmi < 30) {
    advice.push('🔸 BMIがやや高めです。食事管理と運動で健康的な減量を心がけましょう。');
  } else {
    advice.push('⚠️ BMIが肥満の範囲です。医師と相談しながら計画的な減量をおすすめします。');
  }
  
  // 標準体重との差によるアドバイス
  if (Math.abs(toStandardWeight) <= 3) {
    advice.push('🎯 標準体重に近い良好な状態です。');
  } else if (toStandardWeight > 3) {
    advice.push(`📉 標準体重まで${Math.abs(toStandardWeight).toFixed(1)}kg。月1-2kgのペースで減量しましょう。`);
  } else {
    advice.push(`📈 標準体重まで${Math.abs(toStandardWeight).toFixed(1)}kg。筋力アップと栄養補給を重視しましょう。`);
  }
  
  return advice;
}

module.exports = {
  calculateBMI,
  getBMIStatus,
  getWeeklyAverage,
  getMonthlyAverage,
  calculateWeightChange,
  predictGoalDate,
  calculateIdealWeight,
  estimateBMR,
  getWeeklyProgress,
  calculateConsecutiveDays,
  calculateHealthMetrics,
  getObesityStatus,
  getHealthAdvice
};