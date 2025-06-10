// メッセージテンプレート

// ウェルカムメッセージ
function getWelcomeMessage() {
  return {
    type: 'text',
    text: `体重記録Botです📊

まずはお名前を教えてください。
例: 田中`
  };
}

// おはようメッセージ
function getMorningMessage(userName = '') {
  const namePrefix = userName ? `${userName}さん、` : '';
  
  const greetings = [
    `☀️ ${namePrefix}おはようございます！`,
    `🌅 ${namePrefix}おはようございます！今日も素敵な一日を！`,
    `🌞 ${namePrefix}おはようございます！新しい一日の始まりです！`
  ];
  
  const prompts = [
    '今朝の体重を教えてください。',
    '体重を測定して数値を送信してください。',
    '今日の体重はどうでしたか？'
  ];
  
  const greeting = greetings[Math.floor(Math.random() * greetings.length)];
  const prompt = prompts[Math.floor(Math.random() * prompts.length)];
  
  return {
    type: 'text',
    text: `${greeting}\n\n${prompt}`
  };
}

// 応援メッセージ
function getMotivationalMessage(currentWeight, goalWeight, isInitialRegistration = false) {
  // 初回登録時は専用メッセージ
  if (isInitialRegistration) {
    return {
      type: 'text',
      text: '目標に向かって頑張りましょう💪\n毎日の記録が成功への第一歩です！'
    };
  }
  
  const difference = currentWeight - goalWeight;
  let message;
  
  if (difference > 10) {
    message = '一歩ずつ確実に進みましょう💪\n継続は力なり！';
  } else if (difference > 5) {
    message = '順調に近づいています🎯\nこの調子で頑張りましょう！';
  } else if (difference > 0) {
    message = 'もう少しです✨\n目標まであと一息！';
  } else if (difference === 0) {
    message = 'おめでとうございます！目標達成です🎉\n素晴らしい成果です！';
  } else {
    message = '目標を達成されています！👏\nこの状態をキープしましょう！';
  }
  
  return {
    type: 'text',
    text: message
  };
}

// エラーメッセージ
function getErrorMessage(errorType) {
  const messages = {
    invalidWeight: '体重は20〜300kgの範囲で入力してください。',
    invalidFormat: '正しい形式で入力してください。',
    systemError: 'システムエラーが発生しました。しばらくしてからお試しください。',
    notRegistered: 'まだ登録が完了していません。初期設定を行ってください。'
  };
  
  return {
    type: 'text',
    text: messages[errorType] || messages.systemError
  };
}

// 進捗レポートメッセージ
function getProgressReport(weeklyAverage, monthlyAverage, totalLoss) {
  let report = '📊 進捗レポート\n\n';
  
  if (weeklyAverage) {
    report += `週平均: ${weeklyAverage.toFixed(1)}kg\n`;
  }
  
  if (monthlyAverage) {
    report += `月平均: ${monthlyAverage.toFixed(1)}kg\n`;
  }
  
  if (totalLoss) {
    if (totalLoss > 0) {
      report += `開始時から: -${totalLoss.toFixed(1)}kg 🎯`;
    } else {
      report += `開始時から: +${Math.abs(totalLoss).toFixed(1)}kg`;
    }
  }
  
  return {
    type: 'text',
    text: report
  };
}

// ヒントメッセージ
function getTipMessage() {
  const tips = [
    '💡 毎日同じ時間に測定すると、より正確な記録ができます。',
    '💡 起床後、トイレを済ませてから測定するのがおすすめです。',
    '💡 水分や食事の影響を受けにくい朝の測定が理想的です。',
    '💡 体重は日々変動します。週単位での変化を見ることが大切です。',
    '💡 記録を続けることが、目標達成への第一歩です。'
  ];
  
  return {
    type: 'text',
    text: tips[Math.floor(Math.random() * tips.length)]
  };
}

// 段階的登録用メッセージ
function getRegistrationStepMessage(step, data = {}) {
  switch (step) {
    case 1: // 目標体重
      return {
        type: 'text',
        text: `${data.name}さん、よろしくお願いします！

目標体重を入力してください。
例: 65`
      };

    case 2: // 現在の体重
      return {
        type: 'text',
        text: `目標体重: ${data.goalWeight}kg

現在の体重を入力してください。
例: 70`
      };

    case 3: // 身長
      return {
        type: 'text',
        text: `現在の体重: ${data.currentWeight}kg

身長を入力してください。
例: 170`
      };

    case 4: // 起床時間
      return {
        type: 'text',
        text: `身長: ${data.height}cm

起床時間を入力してください。
例: 6:30`
      };

    default:
      return getWelcomeMessage();
  }
}

// 名前設定完了メッセージ
function getNameSetMessage(name) {
  return {
    type: 'text',
    text: `${name}さんですね！\n名前を設定しました。`
  };
}

module.exports = {
  getWelcomeMessage,
  getMorningMessage,
  getMotivationalMessage,
  getErrorMessage,
  getProgressReport,
  getTipMessage,
  getRegistrationStepMessage,
  getNameSetMessage
};