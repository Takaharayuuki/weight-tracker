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

module.exports = {
  calculateBMI,
  getBMIStatus,
  getWeeklyAverage,
  getMonthlyAverage,
  calculateWeightChange,
  predictGoalDate,
  calculateIdealWeight,
  estimateBMR
};