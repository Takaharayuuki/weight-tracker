const { client, middleware } = require('../config/line');
const userStore = require('../data/userStore');
const sheets = require('./sheets');
const messages = require('../utils/messages');
const calculations = require('../utils/calculations');
const { generateWeightGraph, generateTextHistory } = require('../utils/graphGenerator');
const userStateStore = require('../data/userStateStore');

// イベントハンドラー
async function handleEvent(event) {
  console.log(`イベント処理開始: ${event.type}`);
  
  // フォローイベント（友達登録）の処理
  if (event.type === 'follow') {
    console.log('友達登録イベント');
    const userId = event.source.userId;
    
    // 既存ユーザーかチェック
    let user = userStore.getUser(userId);
    if (!user) {
      // 新規ユーザーを作成
      userStore.createUser(userId);
      userStore.updateUser(userId, { registrationStep: 1 });
      
      return client.replyMessage(event.replyToken, messages.getWelcomeMessage());
    } else {
      // 既存ユーザーの場合は現在の状況に応じたメッセージ
      if (!user.isCompleted) {
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: '再び友達登録ありがとうございます！\n\n登録の続きから始めましょう。'
        });
      } else {
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: 'お帰りなさい！\n\n体重を数値で送信して記録しましょう。'
        });
      }
    }
  }
  
  // テキストメッセージのみ処理
  if (event.type !== 'message' || event.message.type !== 'text') {
    console.log('テキストメッセージ以外は無視');
    return Promise.resolve(null);
  }

  const userId = event.source.userId;
  const messageText = event.message.text.trim();
  console.log(`ユーザー: ${userId}, メッセージ: "${messageText}"`);

  try {
    // ユーザー情報を取得
    let user = userStore.getUser(userId);
    console.log(`ユーザー情報: ${user ? 'あり' : 'なし'}`);

    if (!user) {
      // 新規ユーザーの場合（友達登録していない場合）
      console.log('新規ユーザーの処理（メッセージから）');
      userStore.createUser(userId);
      userStore.updateUser(userId, { registrationStep: 1 });
      return client.replyMessage(event.replyToken, messages.getWelcomeMessage());
    } else if (!user.isCompleted || user.registrationStep < 6) {
      // 登録途中のユーザー
      console.log('登録フローの処理');
      return handleRegistrationFlow(event, userId, messageText, user);
    } else {
      // 登録済みユーザーの処理
      console.log('登録済みユーザーの処理');
      
      // ユーザーの状態をチェック
      const userState = userStateStore.getUserState(userId);
      
      // リッチメニューからのアクション処理（推奨テキスト）
      if (messageText === '体重記録' || messageText === '今日の体重を記録' || messageText === '記録') {
        return handleWeightInputRequest(event, userId, user);
      }
      
      if (messageText === 'グラフ' || messageText === 'グラフを表示') {
        return handleGraphRequest(event, userId, user);
      }
      
      if (messageText === '成果' || messageText === '今週の成果') {
        return handleWeeklyProgressRequest(event, userId, user);
      }
      
      if (messageText === '設定' || messageText === '設定メニュー' || messageText === '設定確認') {
        return handleSettingsMenuRequest(event, userId, user);
      }
      
      if (messageText === 'ヘルプ' || messageText === 'help') {
        return handleHelpRequest(event, userId, user);
      }
      
      if (messageText === '目標変更' || messageText === '目標を再設定' || messageText === '目標設定') {
        return handleGoalResetRequest(event, userId, user);
      }
      
      // 名前変更コマンド
      if (messageText === '名前を設定' || messageText === '名前変更') {
        return handleNameChangeRequest(event, userId, user);
      }
      
      // 「私は〇〇」「名前は〇〇」パターンでの名前変更
      if (messageText.startsWith('私は') || messageText.startsWith('名前は')) {
        return handleNameChange(event, userId, messageText, user);
      }
      
      // ユーザーが体重入力待ち状態の場合
      if (userState && userState.stateType === userStateStore.STATE_TYPES.WAITING_WEIGHT_INPUT) {
        userStateStore.clearUserState(userId); // 状態をクリア
        return handleWeightRecord(event, userId, messageText, user);
      }
      
      // ユーザーが目標体重変更待ち状態の場合
      if (userState && userState.stateType === userStateStore.STATE_TYPES.WAITING_GOAL_WEIGHT) {
        return handleGoalWeightChange(event, userId, messageText, user);
      }
      
      // ユーザーが名前変更待ち状態の場合
      if (userState && userState.stateType === userStateStore.STATE_TYPES.WAITING_NAME_CHANGE) {
        return handleNameChangeState(event, userId, messageText, user);
      }
      
      // 従来のコマンド処理（重複を避けた形で継続サポート）
      if (messageText === '進捗' || messageText === '進捗確認') {
        return handleProgressRequest(event, userId, user);
      }
      
      if (messageText === '推移' || messageText === '履歴') {
        return handleGraphRequest(event, userId, user);
      }
      
      if (messageText === 'ヒント') {
        return client.replyMessage(event.replyToken, messages.getTipMessage());
      }
      
      if (messageText === '設定変更') {
        return handleSettingsRequest(event, userId, user);
      }
      
      if (messageText === 'リセット' || messageText === '登録し直し' || messageText === '初期化') {
        return handleResetRequest(event, userId, user);
      }
      
      if (messageText === '使い方') {
        return handleHelpRequest(event, userId, user);
      }
      
      // 数値の場合は体重記録
      return handleWeightRecord(event, userId, messageText, user);
    }
  } catch (error) {
    console.error('イベント処理エラー:', error);
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: 'エラーが発生しました。もう一度お試しください。'
    });
  }
}

// 登録フローの処理（段階的）
async function handleRegistrationFlow(event, userId, messageText, user) {
  console.log(`登録フロー - ステップ ${user.registrationStep}, メッセージ: "${messageText}"`);
  console.log('ユーザー状態:', JSON.stringify(user, null, 2));
  
  // 登録途中でもリセットできる
  if (messageText === 'リセット' || messageText === '登録し直し' || messageText === '初期化') {
    return handleResetRequest(event, userId, user);
  }
  
  const value = parseFloat(messageText);
  
  switch (user.registrationStep) {
    case 0: // 初回メッセージ後、名前入力待ち
    case 1: // 名前の入力
      if (messageText.length > 20) {
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: 'お名前は20文字以内で入力してください。'
        });
      }
      
      const updatedUser = userStore.updateUser(userId, { 
        name: messageText, 
        registrationStep: 2 
      });
      
      console.log('名前を保存しました:', messageText, 'ユーザー状態:', updatedUser);
      
      return client.replyMessage(event.replyToken, 
        messages.getRegistrationStepMessage(1, { name: messageText })
      );
      
    case 2: // 目標体重の入力
      if (isNaN(value) || value < 30 || value > 200) {
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: '正しい目標体重を入力してください（30〜200kg）'
        });
      }
      
      userStore.updateUser(userId, { 
        goalWeight: value, 
        registrationStep: 3 
      });
      
      console.log('目標体重を保存しました:', value);
      
      return client.replyMessage(event.replyToken, 
        messages.getRegistrationStepMessage(2, { goalWeight: value })
      );
      
    case 3: // 現在の体重の入力
      if (isNaN(value) || value < 30 || value > 300) {
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: '正しい現在の体重を入力してください（30〜300kg）'
        });
      }
      
      userStore.updateUser(userId, { 
        currentWeight: value, 
        registrationStep: 4 
      });
      
      return client.replyMessage(event.replyToken, 
        messages.getRegistrationStepMessage(3, { currentWeight: value })
      );
      
    case 4: // 身長の入力
      if (isNaN(value) || value < 100 || value > 250) {
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: '正しい身長を入力してください（100〜250cm）'
        });
      }
      
      userStore.updateUser(userId, { 
        height: value, 
        registrationStep: 5 
      });
      
      return client.replyMessage(event.replyToken, 
        messages.getRegistrationStepMessage(4, { height: value })
      );
      
    case 5: // 起床時間の入力
      const timePattern = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
      if (!timePattern.test(messageText)) {
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: '正しい時間形式で入力してください（HH:MM）\n例: 6:30'
        });
      }
      
      // 登録完了
      const finalUser = userStore.updateUser(userId, { 
        wakeTime: messageText, 
        registrationStep: 6,
        isCompleted: true 
      });
      
      // BMIを計算
      const bmi = calculations.calculateBMI(finalUser.currentWeight, finalUser.height);
      const bmiStatus = calculations.getBMIStatus(bmi);
      
      // 完了メッセージ
      const response = client.replyMessage(event.replyToken, [
        {
          type: 'text',
          text: `${finalUser.name}さん、登録完了です！

目標体重: ${finalUser.goalWeight}kg
現在の体重: ${finalUser.currentWeight}kg
身長: ${finalUser.height}cm
起床時間: ${finalUser.wakeTime}
BMI: ${bmi.toFixed(1)} (${bmiStatus})`
        },
        messages.getMotivationalMessage(finalUser.currentWeight, finalUser.goalWeight, true)
      ]);

      // Google Sheetsへの初回記録と ユーザー管理シートへの保存
      Promise.all([
        sheets.appendWeight(userId, finalUser.currentWeight, finalUser.name),
        sheets.saveUserInfo(userId, {
          name: finalUser.name,
          goalWeight: finalUser.goalWeight,
          currentWeight: finalUser.currentWeight,
          height: finalUser.height,
          wakeTime: finalUser.wakeTime,
          lastRecordDate: new Date().toISOString().split('T')[0].replace(/-/g, '/'),
          consecutiveDays: 1
        })
      ]).catch(error => {
        console.error('Google Sheets記録エラー（登録時）:', error);
      });

      return response;
      
    default:
      return handleNewUser(event, userId, messageText);
  }
}

// 体重記録の処理
async function handleWeightRecord(event, userId, messageText, user) {
  console.log('体重記録処理開始');
  
  // 数値として解析
  const weight = parseFloat(messageText);
  
  if (isNaN(weight) || weight < 20 || weight > 300) {
    console.log('無効な体重値:', messageText);
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '体重を数値で入力してください（例: 69.5）'
    });
  }

  console.log('体重記録:', weight);
  
  // 最新の体重を更新
  userStore.updateUser(userId, { currentWeight: weight, lastRecordDate: new Date() });

  // 先にユーザーに応答を返す（週平均計算は後で非同期実行）
  const userName = user.name || 'ユーザー';
  const response = client.replyMessage(event.replyToken, [
    {
      type: 'text',
      text: `${userName}さん、${weight}kg記録しました`
    },
    messages.getMotivationalMessage(weight, user.goalWeight)
  ]);

  // Google Sheetsへの記録と週平均計算は非同期で実行
  Promise.all([
    sheets.appendWeight(userId, weight, userName),
    calculations.getWeeklyAverage(userId)
  ]).then(([sheetsResult, weeklyAverage]) => {
    console.log('Google Sheets記録結果:', sheetsResult);
    
    // 週平均のみ通知（エラーメッセージは簡略化）
    if (sheetsResult && !sheetsResult.success) {
      console.log('Google Sheetsエラー（ユーザーには通知しない）');
    }
    
    // 週平均が計算できた場合、追加メッセージを送信
    if (weeklyAverage) {
      client.pushMessage(userId, {
        type: 'text',
        text: `週平均: ${weeklyAverage.toFixed(1)}kg`
      }).catch(error => {
        console.error('週平均メッセージ送信エラー:', error);
      });
    }
  }).catch(error => {
    console.error('体重記録の非同期処理エラー:', error);
  });

  return response;
}

// 登録データの解析
function parseRegistrationData(text) {
  const lines = text.split('\n');
  const data = {};
  
  const patterns = {
    goalWeight: /目標体重[：:]?\s*(\d+\.?\d*)/,
    currentWeight: /現在の体重[：:]?\s*(\d+\.?\d*)/,
    height: /身長[：:]?\s*(\d+\.?\d*)/,
    wakeTime: /起床時間[：:]?\s*(\d{1,2}[:：]\d{2})/
  };

  for (const line of lines) {
    for (const [key, pattern] of Object.entries(patterns)) {
      const match = line.match(pattern);
      if (match) {
        if (key === 'wakeTime') {
          data[key] = match[1].replace('：', ':');
        } else {
          data[key] = parseFloat(match[1]);
        }
      }
    }
  }

  // すべての必須項目が揃っているか確認
  const requiredKeys = Object.keys(patterns);
  const hasAllKeys = requiredKeys.every(key => data.hasOwnProperty(key));
  
  return hasAllKeys ? data : null;
}

// 進捗確認リクエストの処理
async function handleProgressRequest(event, userId, user) {
  try {
    const [weeklyAverage, monthlyAverage] = await Promise.all([
      calculations.getWeeklyAverage(userId),
      calculations.getMonthlyAverage(userId)
    ]);
    
    const bmi = calculations.calculateBMI(user.currentWeight, user.height);
    const weightDiff = user.currentWeight - user.goalWeight;
    
    let progressText = `📊 あなたの進捗\n\n`;
    progressText += `現在の体重: ${user.currentWeight}kg\n`;
    progressText += `目標体重: ${user.goalWeight}kg\n`;
    progressText += `目標まで: ${weightDiff > 0 ? `あと${weightDiff.toFixed(1)}kg` : '目標達成🎉'}\n`;
    progressText += `BMI: ${bmi.toFixed(1)}\n\n`;
    
    if (weeklyAverage) {
      progressText += `週平均: ${weeklyAverage.toFixed(1)}kg\n`;
    }
    if (monthlyAverage) {
      progressText += `月平均: ${monthlyAverage.toFixed(1)}kg\n`;
    }
    
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: progressText
    });
  } catch (error) {
    console.error('進捗確認エラー:', error);
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '進捗情報の取得に失敗しました。'
    });
  }
}

// 設定変更リクエストの処理
async function handleSettingsRequest(event, userId, user) {
  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: `現在の設定

目標体重: ${user.goalWeight}kg
現在の体重: ${user.currentWeight}kg
身長: ${user.height}cm
起床時間: ${user.wakeTime}

登録をやり直す場合は「リセット」と送信してください。`
  });
}

// 登録リセットリクエストの処理
async function handleResetRequest(event, userId, user) {
  // ユーザーデータをリセット
  userStore.deleteUser(userId);
  
  // 新規ユーザーとして再作成
  userStore.createUser(userId);
  userStore.updateUser(userId, { registrationStep: 1 });
  
  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: `登録をリセットしました。

目標体重を入力してください。
例: 65`
  });
}

// 体重入力リクエストの処理（リッチメニュー用）
async function handleWeightInputRequest(event, userId, user) {
  console.log('体重入力リクエスト処理開始');
  
  // ユーザーを体重入力待ち状態に設定
  userStateStore.setUserState(userId, userStateStore.STATE_TYPES.WAITING_WEIGHT_INPUT, {
    requestedAt: new Date()
  });
  
  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: '📝 今日の体重を数値で入力してください\n\n例: 70.5\n\n※30分以内に入力してください'
  });
}

// 今週の成果リクエストの処理
async function handleWeeklyProgressRequest(event, userId, user) {
  console.log('今週の成果リクエスト処理開始');
  
  try {
    const progress = await calculations.getWeeklyProgress(userId);
    
    if (!progress.hasData) {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: progress.message
      });
    }
    
    // 成果メッセージを作成
    let progressMessage = `📊 今週の成果 (${progress.recordCount}日分の記録)\n\n`;
    progressMessage += `📍 現在の体重: ${progress.currentWeight.toFixed(1)}kg\n`;
    progressMessage += `📈 最高値: ${progress.maxWeight.toFixed(1)}kg\n`;
    progressMessage += `📉 最低値: ${progress.minWeight.toFixed(1)}kg\n`;
    progressMessage += `📊 平均: ${progress.weeklyAverage.toFixed(1)}kg\n\n`;
    
    // 変化量の表示
    if (Math.abs(progress.weeklyChange) >= 0.1) {
      const changeText = progress.weeklyChange > 0 ? 
        `📈 +${progress.weeklyChange.toFixed(1)}kg` : 
        `📉 ${progress.weeklyChange.toFixed(1)}kg`;
      progressMessage += `🔄 週間変化: ${changeText}\n`;
    } else {
      progressMessage += `🔄 週間変化: ほぼ変化なし\n`;
    }
    
    // 目標との差
    if (progress.goalDifference <= 0) {
      progressMessage += `🎯 目標達成！目標を${Math.abs(progress.goalDifference).toFixed(1)}kg下回っています\n`;
    } else {
      progressMessage += `🎯 目標まで: あと${progress.goalDifference.toFixed(1)}kg\n`;
    }
    
    // 連続記録日数
    progressMessage += `🔥 連続記録: ${progress.consecutiveDays}日\n\n`;
    
    // 励ましメッセージ
    if (progress.weeklyChange < -0.5) {
      progressMessage += `🎉 素晴らしい成果です！この調子で続けましょう！`;
    } else if (progress.weeklyChange > 0.5) {
      progressMessage += `💪 体重が増加していますが、焦らず継続しましょう。`;
    } else {
      progressMessage += `📈 着実に進歩しています。継続が力になります！`;
    }
    
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: progressMessage
    });
    
  } catch (error) {
    console.error('今週の成果計算エラー:', error);
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '申し訳ございません。成果の計算に失敗しました。\n\n後ほど再度お試しください。'
    });
  }
}

// 設定メニューリクエストの処理
async function handleSettingsMenuRequest(event, userId, user) {
  console.log('設定メニューリクエスト処理開始');
  
  const bmi = calculations.calculateBMI(user.currentWeight, user.height);
  const bmiStatus = calculations.getBMIStatus(bmi);
  
  const userName = user.name || '未設定';
  const settingsMessage = `⚙️ 現在の設定\n\n` +
    `👤 名前: ${userName}\n` +
    `🎯 目標体重: ${user.goalWeight}kg\n` +
    `📍 現在の体重: ${user.currentWeight}kg\n` +
    `📏 身長: ${user.height}cm\n` +
    `⏰ 起床時間: ${user.wakeTime}\n` +
    `📊 BMI: ${bmi.toFixed(1)} (${bmiStatus})\n\n` +
    `💡 設定を変更したい場合は以下をお試しください：\n` +
    `• 名前変更: 「名前を設定」\n` +
    `• 目標体重変更: 「目標を再設定」\n` +
    `• 完全リセット: 「リセット」`;
  
  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: settingsMessage
  });
}

// ヘルプリクエストの処理
async function handleHelpRequest(event, userId, user) {
  console.log('ヘルプリクエスト処理開始');
  
  const helpMessage = `📚 使い方ガイド\n\n` +
    `【リッチメニュー（推奨）】\n` +
    `下部のメニューからワンタップで操作：\n` +
    `• 📝 体重記録: 体重入力をサポート\n` +
    `• 📊 グラフ: 30日間の推移を表示\n` +
    `• 📈 成果: 今週の詳細な成果\n` +
    `• ⚙️ 設定: 現在の設定を確認\n` +
    `• ❓ ヘルプ: このガイドを表示\n` +
    `• 🎯 目標変更: 目標体重を変更\n\n` +
    `【基本の使い方】\n` +
    `• 体重記録: 数値を送信（例: 70.5）\n` +
    `• 直接コマンド: 上記の日本語でも操作可能\n\n` +
    `【従来のコマンド】\n` +
    `• 進捗確認: 「進捗」\n` +
    `• グラフ表示: 「推移」「履歴」\n` +
    `• 完全リセット: 「リセット」\n` +
    `• ヒント: 「ヒント」\n\n` +
    `【自動機能】\n` +
    `• 毎朝の挨拶メッセージ\n` +
    `• 記録忘れの夜間リマインダー\n\n` +
    `💡 リッチメニューが最も使いやすくておすすめです！`;
  
  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: helpMessage
  });
}

// 目標再設定リクエストの処理
async function handleGoalResetRequest(event, userId, user) {
  console.log('目標再設定リクエスト処理開始');
  
  // ユーザーを目標体重変更待ち状態に設定
  userStateStore.setUserState(userId, userStateStore.STATE_TYPES.WAITING_GOAL_WEIGHT, {
    currentGoal: user.goalWeight,
    requestedAt: new Date()
  });
  
  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: `🎯 目標体重の変更\n\n現在の目標体重: ${user.goalWeight}kg\n\n新しい目標体重を数値で入力してください（30〜200kg）\n\n例: 65\n\n※キャンセルしたい場合は「キャンセル」と入力してください`
  });
}

// 目標体重変更の処理
async function handleGoalWeightChange(event, userId, messageText, user) {
  console.log('目標体重変更処理開始');
  
  // キャンセル処理
  if (messageText === 'キャンセル' || messageText === 'cancel') {
    userStateStore.clearUserState(userId);
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '目標体重の変更をキャンセルしました。'
    });
  }
  
  // 数値検証
  const newGoalWeight = parseFloat(messageText);
  if (isNaN(newGoalWeight) || newGoalWeight < 30 || newGoalWeight > 200) {
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '正しい目標体重を入力してください（30〜200kg）\n\n例: 65\n\nキャンセルしたい場合は「キャンセル」と入力してください'
    });
  }
  
  // 目標体重を更新
  const oldGoalWeight = user.goalWeight;
  userStore.updateUser(userId, { goalWeight: newGoalWeight });
  userStateStore.clearUserState(userId);
  
  const changeMessage = `🎯 目標体重を更新しました\n\n` +
    `変更前: ${oldGoalWeight}kg\n` +
    `変更後: ${newGoalWeight}kg\n\n` +
    `新しい目標に向けて一緒に頑張りましょう！`;
  
  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: changeMessage
  });
}

// 名前変更リクエストの処理
async function handleNameChangeRequest(event, userId, user) {
  console.log('名前変更リクエスト処理開始');
  
  // ユーザーを名前変更待ち状態に設定
  userStateStore.setUserState(userId, userStateStore.STATE_TYPES.WAITING_NAME_CHANGE, {
    currentName: user.name,
    requestedAt: new Date()
  });
  
  const currentNameText = user.name ? `現在の名前: ${user.name}` : '現在名前が設定されていません';
  
  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: `📝 名前の変更\n\n${currentNameText}\n\n新しい名前を入力してください（20文字以内）\n\n例: 田中\n\n※キャンセルしたい場合は「キャンセル」と入力してください`
  });
}

// 「私は〇〇」「名前は〇〇」での名前変更処理
async function handleNameChange(event, userId, messageText, user) {
  console.log('名前変更処理開始:', messageText);
  
  let newName = '';
  if (messageText.startsWith('私は')) {
    newName = messageText.substring(2).trim();
  } else if (messageText.startsWith('名前は')) {
    newName = messageText.substring(3).trim();
  }
  
  // 名前の検証
  if (!newName || newName.length > 20) {
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '名前は20文字以内で入力してください。\n\n例: 私は田中\n例: 名前は田中'
    });
  }
  
  // 名前を更新
  const oldName = user.name;
  userStore.updateUser(userId, { name: newName });
  
  // Google Sheetsのユーザー管理シートも更新
  sheets.updateUserName(userId, newName).catch(error => {
    console.error('Google Sheetsユーザー名更新エラー:', error);
  });
  
  const changeMessage = oldName ? 
    `📝 名前を変更しました\n\n変更前: ${oldName}\n変更後: ${newName}\n\nよろしくお願いします、${newName}さん！` :
    `📝 名前を設定しました\n\n${newName}さん、よろしくお願いします！`;
  
  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: changeMessage
  });
}

// 名前変更待ち状態での処理
async function handleNameChangeState(event, userId, messageText, user) {
  console.log('名前変更待ち状態処理開始');
  
  // キャンセル処理
  if (messageText === 'キャンセル' || messageText === 'cancel') {
    userStateStore.clearUserState(userId);
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '名前の変更をキャンセルしました。'
    });
  }
  
  // 名前の検証
  if (messageText.length > 20) {
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '名前は20文字以内で入力してください。\n\n例: 田中\n\nキャンセルしたい場合は「キャンセル」と入力してください'
    });
  }
  
  // 名前を更新
  const oldName = user.name;
  userStore.updateUser(userId, { name: messageText });
  userStateStore.clearUserState(userId);
  
  // Google Sheetsのユーザー管理シートも更新
  sheets.updateUserName(userId, messageText).catch(error => {
    console.error('Google Sheetsユーザー名更新エラー:', error);
  });
  
  const changeMessage = oldName ? 
    `📝 名前を変更しました\n\n変更前: ${oldName}\n変更後: ${messageText}\n\nよろしくお願いします、${messageText}さん！` :
    `📝 名前を設定しました\n\n${messageText}さん、よろしくお願いします！`;
  
  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: changeMessage
  });
}

// グラフリクエストの処理
async function handleGraphRequest(event, userId, user) {
  console.log('グラフリクエスト処理開始');
  
  try {
    // まず処理開始のメッセージを送信
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: '📊 体重推移グラフを生成中です...\n少々お待ちください。'
    });
    
    try {
      // グラフを生成
      const result = await generateWeightGraph(userId, 30);
      const { imageBuffer, metadata } = result;
      
      console.log('グラフ生成成功:', metadata);
      
      // 統計情報のテキストメッセージを作成
      const statsMessage = `📈 ${metadata.days}日間の体重推移
      
📊 記録数: ${metadata.recordCount}日分
📍 現在: ${metadata.currentWeight}kg
🎯 目標: ${metadata.goalWeight}kg
📈 最高: ${metadata.maxWeight}kg
📉 最低: ${metadata.minWeight}kg

${metadata.progress}`;

      // 一時的に画像を保存し、URLを生成（簡易実装）
      const fs = require('fs');
      const path = require('path');
      
      // 一時ディレクトリに画像を保存
      const tempDir = path.join(__dirname, '../../temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const fileName = `graph_${userId}_${Date.now()}.png`;
      const filePath = path.join(tempDir, fileName);
      fs.writeFileSync(filePath, imageBuffer);
      
      // 公開URL（本番環境では外部URLが必要）
      const publicUrl = `${process.env.BASE_URL || 'http://localhost:3001'}/temp/${fileName}`;
      
      console.log(`画像を保存しました: ${filePath}`);
      console.log(`公開URL: ${publicUrl}`);
      
      // 画像メッセージと統計メッセージを送信
      await client.pushMessage(userId, [
        {
          type: 'image',
          originalContentUrl: publicUrl,
          previewImageUrl: publicUrl
        },
        {
          type: 'text',
          text: statsMessage
        }
      ]);
      
      // 5分後に一時ファイルを削除
      setTimeout(() => {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`一時ファイルを削除しました: ${filePath}`);
          }
        } catch (deleteError) {
          console.error('一時ファイル削除エラー:', deleteError);
        }
      }, 5 * 60 * 1000);
      
    } catch (graphError) {
      console.error('グラフ生成エラー:', graphError);
      
      // フォールバック: テキストで履歴を表示
      const weightHistory = await sheets.getUserWeightHistory(userId, 7);
      const textHistory = generateTextHistory(weightHistory, user);
      
      await client.pushMessage(userId, {
        type: 'text',
        text: textHistory + '\n\n💡 グラフ機能は記録が増えてから利用できます（最低2日分の記録が必要）'
      });
    }
    
  } catch (error) {
    console.error('グラフリクエスト処理エラー:', error);
    
    // エラー時のフォールバック
    return client.pushMessage(userId, {
      type: 'text',
      text: '申し訳ございません。グラフの生成に失敗しました。\n\n「進捗」コマンドで数値による進捗を確認できます。'
    });
  }
}

// ユーザーにメッセージを送信
async function pushMessage(userId, messages) {
  return client.pushMessage(userId, messages);
}

module.exports = {
  middleware,
  handleEvent,
  pushMessage
};