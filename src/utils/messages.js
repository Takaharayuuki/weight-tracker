// メッセージテンプレート

// ウェルカムメッセージ
function getWelcomeMessage() {
  return {
    type: 'text',
    text: `はじめまして！💪

パーソナルトレーナーBotです。
一緒に理想の体を目指しましょう！

まずはお名前を教えてください😊
（例: 田中）`
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
  const difference = currentWeight - goalWeight; // 現在 - 目標
  
  // デバッグログを追加
  console.log('目標判定:', {
    currentWeight,
    goalWeight,
    difference: difference,
    isReduction: difference > 0,
    isIncrease: difference < 0,
    isAchieved: difference === 0
  });
  
  // 初回登録時は専用メッセージ（目標の種類を判断）
  if (isInitialRegistration) {
    if (Math.abs(difference) > 20) {
      // 20kg以上の大きな差がある場合
      const changeAmount = Math.abs(difference).toFixed(1);
      const changeType = difference > 0 ? '減量' : '増量';
      return {
        type: 'text',
        text: `${changeAmount}kg${changeType}の大きな目標ですね！💪\n\n一歩ずつ確実に進めば必ず達成できます。\n私が全力でサポートしますので、\n一緒に頑張りましょう✨`
      };
    } else if (difference > 10) {
      return {
        type: 'text',
        text: `${difference.toFixed(1)}kg減量の目標ですね！💪\n\n一緒に目標に向かって頑張りましょう！\n小さな一歩の積み重ねが、\n大きな変化につながります✨`
      };
    } else if (difference > 0) {
      return {
        type: 'text',
        text: `目標まで${difference.toFixed(1)}kg！\n一緒に達成しましょう💪\n\n毎日の記録が成功への第一歩です✨`
      };
    } else if (difference < -10) {
      return {
        type: 'text',
        text: `${Math.abs(difference).toFixed(1)}kg増量の目標ですね！💪\n\n健康的に体重を増やしていきましょう。\n一緒に頑張ります✨`
      };
    } else if (difference < 0) {
      return {
        type: 'text',
        text: `目標まで${Math.abs(difference).toFixed(1)}kg増量！💪\n\n健康的に理想の体重を目指しましょう✨`
      };
    } else {
      return {
        type: 'text',
        text: '現在の体重をキープする目標ですね！💪\n\n理想的な状態を維持していきましょう✨'
      };
    }
  }
  
  // 日々の記録時のメッセージ
  let message;
  
  if (difference > 10) {
    message = `目標まで${difference.toFixed(1)}kg！\n焦らず慌てず、一歩ずつ進みましょう💪\n\n継続することで必ず結果はついてきます！\n私がサポートしますので安心してくださいね😊`;
  } else if (difference > 5) {
    message = `目標まで${difference.toFixed(1)}kg！\n素晴らしい！順調に目標に近づいています🎯\n\nこの調子で頂きまで一緒に進みましょう！\nあなたなら絶対にできます✨`;
  } else if (difference > 0) {
    message = `目標まであと${difference.toFixed(1)}kg！\nすごいです！もう少しで目標達成です✨\n\n最後の一踏ん張り、一緒に頑張りましょう！\nご自分を誇りに思ってください😊`;
  } else if (difference === 0) {
    message = 'おめでとうございます！🎉\n目標体重達成です！！\n\n継続した努力が実を結びましたね✨\n本当に素晴らしいです！';
  } else if (difference > -5) {
    message = `目標まで${Math.abs(difference).toFixed(1)}kg増量！\n健康的に体重を増やしていきましょう💪\n\nしっかり栄養を摂って理想の体を目指しましょう✨`;
  } else {
    message = `目標まで${Math.abs(difference).toFixed(1)}kg増量！\n健康的に体重を増やす目標ですね💪\n\n焦らずゆっくりと理想の体重を目指しましょう✨`;
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
    '💡 毎日同じ時間に測定すると、より正確な記録ができますよ。',
    '💡 起床後、トイレを済ませてからの測定がベストですね。',
    '💡 朝一番の体重が最も正確です。水分や食事の影響が少ないんです。',
    '💡 体重は日々変動するもの。長期的な視点で見ることが大切ですよ。',
    '💡 水分をしっかり摂ることも大切ですよ。',
    '💡 継続が何より大切。小さな一歩でも積み重ねれば大きな変化になります✨'
  ];
  
  return {
    type: 'text',
    text: tips[Math.floor(Math.random() * tips.length)]
  };
}

// 連続記録日数に応じた称賛メッセージ
function getCelebrationMessage(consecutiveDays) {
  if (consecutiveDays >= 30) {
    return {
      type: 'text',
      text: `🎆 素晴らしい！${consecutiveDays}日連続記録達成！\n\nあなたの継続力は本当に素晴らしいです。\nこの習慣が必ず結果につながります！✨`
    };
  } else if (consecutiveDays >= 14) {
    return {
      type: 'text',
      text: `🎉 すごい！${consecutiveDays}日連続記録！\n\n2週間継続できるなんて、\nあなたは本当に素晴らしいです！👏`
    };
  } else if (consecutiveDays >= 7) {
    return {
      type: 'text',
      text: `🎆 ${consecutiveDays}日連続記録達成！\n\n1週間続けられるなんて、\n本当に素晴らしい習慣ですね！✨`
    };
  } else if (consecutiveDays >= 3) {
    return {
      type: 'text',
      text: `😊 ${consecutiveDays}日連続記録！\n\n素晴らしい習慣ですね！\nこの調子で続けていきましょう💪`
    };
  }
  
  return null; // 3日未満は称賛メッセージなし
}

// 目標に近づいた時の特別メッセージ
function getGoalProgressMessage(currentWeight, goalWeight) {
  const difference = Math.abs(currentWeight - goalWeight);
  
  if (difference <= 0.5) {
    return {
      type: 'text',
      text: `🎆 もうすぐで目標達成！\n\n目標まであと${difference.toFixed(1)}kg！\n最後の一踏ん張り、一緒に頑張りましょう！✨`
    };
  } else if (difference <= 1.0) {
    return {
      type: 'text',
      text: `🎯 目標が見えてきました！\n\nあと${difference.toFixed(1)}kgで目標達成です！\nあなたなら絶対にできます💪`
    };
  }
  
  return null; // 1kg以上の差は特別メッセージなし
}

// 段階的登録用メッセージ
function getRegistrationStepMessage(step, data = {}) {
  switch (step) {
    case 1: // 目標体重
      return {
        type: 'text',
        text: `${data.name}さん、よろしくお願いします！😊

一緒に理想の体を目指しましょう！

まずは目標体重を教えてください🎯
（例: 65）`
      };

    case 2: // 現在の体重
      return {
        type: 'text',
        text: `${data.goalWeight}kg、いい目標ですね！🎯

次に現在の体重を教えてください。
（例: 70）`
      };

    case 3: // 身長
      const weightDiff = data.currentWeight - data.goalWeight; // 現在 - 目標
      let encouragement;
      
      if (weightDiff > 0) {
        // 減量が必要
        encouragement = `${weightDiff.toFixed(1)}kg減量、一緒に達成しましょう！💪`;
      } else if (weightDiff < 0) {
        // 増量が必要
        encouragement = `${Math.abs(weightDiff).toFixed(1)}kg増量、健康的に目指しましょう！💪`;
      } else {
        // 目標と同じ
        encouragement = `目標体重と同じですね！現状維持を目指しましょう！💪`;
      }
      
      return {
        type: 'text',
        text: `${data.currentWeight}kgですね。
${encouragement}

身長を教えてください📏
（例: 170）`
      };

    case 4: // 起床時間
      return {
        type: 'text',
        text: `身長: ${data.height}cm

最後に、起床時間を教えてください⏰

💡 なぜ起床時間？
朝一番の体重が最も正確だからです。
起床後、トイレを済ませた後の測定を
毎日同じ時間に行うことで、
正しい体重変化が分かります。

その時間に優しくリマインドしますね😊
（例: 6:30）`
      };

    default:
      return getWelcomeMessage();
  }
}

// 名前設定完了メッセージ
function getNameSetMessage(name) {
  return {
    type: 'text',
    text: `${name}さんですね！😊\nお名前を設定しました。`
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
  getNameSetMessage,
  getCelebrationMessage,
  getGoalProgressMessage
};