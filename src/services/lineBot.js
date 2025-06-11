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
      try {
        // LINEプロフィール情報を取得
        const profile = await client.getProfile(userId);
        const displayName = profile.displayName;
        console.log(`LINEプロフィール取得: ${displayName}`);
        
        // 新規ユーザーを作成し、LINEの表示名を設定
        userStore.createUser(userId);
        userStore.updateUser(userId, { 
          name: displayName,
          registrationStep: 2  // 名前入力をスキップして目標体重から開始
        });
        
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: `${displayName}さん、はじめまして！💪\n\n` +
                `パーソナルトレーナーBotです。\n` +
                `一緒に理想の体を目指しましょう！\n\n` +
                `まず、目標体重を教えてください🎯\n（例: 65）`
        });
      } catch (error) {
        console.error('LINEプロフィール取得エラー:', error);
        // プロフィール取得に失敗した場合は従来の方式で名前入力から
        userStore.createUser(userId);
        userStore.updateUser(userId, { registrationStep: 1 });
        
        return client.replyMessage(event.replyToken, messages.getWelcomeMessage());
      }
    } else {
      // 既存ユーザーの場合は現在の状況に応じたメッセージ
      if (!user.isCompleted) {
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: `${user.name || 'ユーザー'}さん、お帰りなさい！😊\n\n登録の続きから始めましょう。`
        });
      } else {
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: `${user.name || 'ユーザー'}さん、お帰りなさい！😊\n\n今日の体重を数値で送信してください。`
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
      try {
        // LINEプロフィール情報を取得
        const profile = await client.getProfile(userId);
        const displayName = profile.displayName;
        console.log(`LINEプロフィール取得: ${displayName}`);
        
        userStore.createUser(userId);
        userStore.updateUser(userId, { 
          name: displayName,
          registrationStep: 2  // 名前入力をスキップ
        });
        
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: `${displayName}さん、はじめまして！💪\n\n` +
                `パーソナルトレーナーBotです。\n` +
                `一緒に理想の体を目指しましょう！\n\n` +
                `まず、目標体重を教えてください🎯\n（例: 65）`
        });
      } catch (error) {
        console.error('LINEプロフィール取得エラー:', error);
        userStore.createUser(userId);
        userStore.updateUser(userId, { registrationStep: 1 });
        return client.replyMessage(event.replyToken, messages.getWelcomeMessage());
      }
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
      
      // 「直接入力します」への対応
      if (messageText === '直接入力します') {
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: '📝 体重を数値で入力してください\n\n例: 64.5\n\n※20〜300kgの範囲でお願いします'
        });
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
      
      if (messageText === '健康データ' || messageText === '健康指標' || messageText === 'BMI') {
        return handleHealthDataRequest(event, userId, user);
      }
      
      if (messageText === '詳細健康データ') {
        return handleDetailedHealthDataRequest(event, userId, user);
      }
      
      if (messageText === '使い方') {
        return handleHelpRequest(event, userId, user);
      }
      
      // デバッグ用コマンド（開発環境のみ）
      if (messageText === 'テストリマインダー' && process.env.NODE_ENV !== 'production') {
        const scheduler = require('./scheduler');
        await scheduler.testReminderCheck();
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: '🧪 リマインダーテストを実行しました。コンソールログを確認してください。'
        });
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
          text: 'お名前は20文字以内でお願いします😊'
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
          text: '目標体重は30〜200kgの範囲で入力してくださいね😊\n（例: 65）'
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
          text: '体重は30〜300kgの範囲で入力してくださいね😊\n（例: 70）'
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
          text: '身長は100〜250cmの範囲で入力してくださいね😊\n（例: 170）'
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
          text: '時間はHH:MMの形式で入力してくださいね😊\n（例: 6:30）'
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
          text: `🎉 ${finalUser.name}さん、準備完了です！

一緒に頑張りましょう！💪

【あなたの目標】
🎯 目標体重: ${finalUser.goalWeight}kg
📊 現在の体重: ${finalUser.currentWeight}kg
📏 身長: ${finalUser.height}cm
⏰ 起床時間: ${finalUser.wakeTime}
📋 BMI: ${bmi.toFixed(1)} (${bmiStatus})

毎日${finalUser.wakeTime}におはようメッセージをお送りしますね😊`
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
  
  if (isNaN(weight)) {
    console.log('数値以外が入力された:', messageText);
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '数字で入力してくださいね😊\n（例: 64.5）\n\n数値のみでお願いします！',
      quickReply: {
        items: [
          {
            type: 'action',
            action: {
              type: 'message',
              label: 'もう一度入力',
              text: '体重記録'
            }
          }
        ]
      }
    });
  }
  
  if (weight < 20 || weight > 300) {
    console.log('範囲外の体重値:', messageText);
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: `本当に${weight}kgで合っていますか？🤔\n\n間違いなければもう一度入力してください。\n正しい範囲は20〜300kgです。`,
      quickReply: {
        items: [
          {
            type: 'action',
            action: {
              type: 'message',
              label: `${weight}kg（確定）`,
              text: weight.toString()
            }
          },
          {
            type: 'action',
            action: {
              type: 'message',
              label: '訂正する',
              text: '体重記録'
            }
          }
        ]
      }
    });
  }

  console.log('体重記録:', weight);
  
  // 最新の体重を更新
  userStore.updateUser(userId, { currentWeight: weight, lastRecordDate: new Date() });

  // 詳細フィードバック機能を実装
  const userName = user.name || 'ユーザー';
  const previousWeight = user.currentWeight;
  const weightDiff = previousWeight ? weight - previousWeight : 0;
  
  // 基本記録メッセージ
  let feedback = `${userName}さん、お疲れ様です！\n${weight}kg、しっかり記録しました📝\n\n`;

  // 前回との比較
  if (previousWeight) {
    if (Math.abs(weightDiff) < 0.1) {
      feedback += '📊 前回とほぼ同じ。安定していますね\n';
    } else if (weightDiff < 0) {
      feedback += `📉 前回より${Math.abs(weightDiff).toFixed(1)}kg減！素晴らしい！\n`;
    } else {
      feedback += `📈 前回より${weightDiff.toFixed(1)}kg増\n`;
    }
  }

  // 目標との差
  const toGoal = weight - user.goalWeight;
  if (toGoal > 0) {
    feedback += `🎯 目標まであと${toGoal.toFixed(1)}kg\n`;
  } else if (toGoal === 0) {
    feedback += `🎉 目標達成！おめでとうございます！\n`;
  } else {
    feedback += `✨ 目標を${Math.abs(toGoal).toFixed(1)}kg下回っています！\n`;
  }
  
  // BMIと基本健康指標を追加
  const bmi = calculations.calculateBMI(weight, user.height);
  const bmiStatus = calculations.getBMIStatus(bmi);
  const standardWeight = Math.round((user.height / 100) * (user.height / 100) * 22 * 10) / 10;
  const toStandard = Math.round((weight - standardWeight) * 10) / 10;
  
  feedback += `\n📊 BMI: ${bmi.toFixed(1)}（${bmiStatus}）`;
  
  if (Math.abs(toStandard) <= 1) {
    feedback += ` 👍`;
  } else if (toStandard > 1) {
    feedback += `\n📍 標準体重まで${toStandard.toFixed(1)}kg`;
  } else {
    feedback += `\n📍 標準体重まで+${Math.abs(toStandard).toFixed(1)}kg`;
  }
  
  // 応答メッセージを送信
  const response = client.replyMessage(event.replyToken, [
    {
      type: 'text',
      text: feedback
    },
    messages.getMotivationalMessage(weight, user.goalWeight)
  ]);

  // Google Sheetsへの記録、統計計算、連続記録チェックを非同期で実行
  Promise.all([
    sheets.appendWeight(userId, weight, userName),
    calculations.getWeeklyAverage(userId),
    sheets.getUserInfo(userId) // 連続記録日数取得用
  ]).then(([sheetsResult, weeklyAverage, userInfo]) => {
    console.log('Google Sheets記録結果:', sheetsResult);
    
    if (sheetsResult && !sheetsResult.success) {
      console.log('Google Sheetsエラー（ユーザーには通知しない）');
      return;
    }
    
    // 追加メッセージを準備
    const additionalMessages = [];
    
    // 週平均メッセージ
    if (weeklyAverage) {
      const weeklyChange = previousWeight ? weeklyAverage - previousWeight : 0;
      let weeklyMessage = `📊 今週の平均体重: ${weeklyAverage.toFixed(1)}kg`;
      
      if (Math.abs(weeklyChange) >= 0.1) {
        const changeText = weeklyChange > 0 ? `+${weeklyChange.toFixed(1)}kg` : `${weeklyChange.toFixed(1)}kg`;
        weeklyMessage += `\n📅 今週の変化: ${changeText}`;
      }
      
      additionalMessages.push({
        type: 'text',
        text: weeklyMessage
      });
    }
    
    // 連続記録のゲーミフィケーション
    if (userInfo && userInfo.consecutiveDays) {
      const streakMessage = getStreakMessage(userInfo.consecutiveDays);
      if (streakMessage) {
        additionalMessages.push({
          type: 'text',
          text: streakMessage
        });
      }
    }
    
    // まとめてメッセージ送信
    if (additionalMessages.length > 0) {
      client.pushMessage(userId, additionalMessages).catch(error => {
        console.error('追加メッセージ送信エラー:', error);
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
  
  // 前回の体重を基準にクイック返信ボタンを生成
  const lastWeight = user.currentWeight || 65.0;
  const baseWeight = Math.round(lastWeight * 10) / 10; // 0.1kg単位で丸める
  
  // クイック返信ボタンを生成（実用的な選択肢のみ）
  const quickReplyItems = [];
  
  // オプション1: よく使う体重値（0.5kg刻み）
  const commonWeights = [
    baseWeight - 1.0,
    baseWeight - 0.5,
    baseWeight,
    baseWeight + 0.5,
    baseWeight + 1.0
  ];
  
  // 有効な体重のみ追加
  commonWeights.forEach(w => {
    if (w >= 30 && w <= 300) {
      quickReplyItems.push({
        type: 'action',
        action: {
          type: 'message',
          label: `${w.toFixed(1)}kg`,
          text: w.toFixed(1)
        }
      });
    }
  });
  
  // 直接入力オプション
  quickReplyItems.push({
    type: 'action',
    action: {
      type: 'message',
      label: 'その他の値を入力',
      text: '直接入力します'
    }
  });
  
  // 日替わりモチベーションメッセージ
  const motivationalQuote = getMotivationalQuote();
  
  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: `${user.name}さん、おはようございます！☀️\n\n` +
          `今朝の体重を教えてください💪\n` +
          `（数値を直接入力してください）\n\n` +
          `前回の記録: ${lastWeight.toFixed(1)}kg\n\n` +
          `${motivationalQuote}`,
    quickReply: {
      items: quickReplyItems
    }
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

// 健康データリクエストの処理
async function handleHealthDataRequest(event, userId, user) {
  console.log('健康データリクエスト処理開始');
  
  try {
    // 包括的な健康指標を計算（30歳男性と仮定）
    const healthMetrics = calculations.calculateHealthMetrics(
      user.currentWeight, 
      user.height, 
      30, // 年齢（デフォルト）
      'male' // 性別（デフォルト）
    );
    
    // Flex Messageで見やすく表示
    const flexMessage = {
      type: 'flex',
      altText: `${user.name}さんの健康データ`,
      contents: {
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [{
            type: 'text',
            text: `📊 ${user.name}さんの健康データ`,
            weight: 'bold',
            size: 'lg',
            color: '#ffffff',
            align: 'center'
          }],
          backgroundColor: '#667eea',
          paddingAll: 'lg'
        },
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'md',
          contents: [
            // BMIセクション
            {
              type: 'box',
              layout: 'vertical',
              contents: [
                {
                  type: 'text',
                  text: 'BMI指標',
                  weight: 'bold',
                  size: 'md',
                  color: '#333333'
                },
                {
                  type: 'box',
                  layout: 'horizontal',
                  margin: 'sm',
                  contents: [
                    {
                      type: 'text',
                      text: `${healthMetrics.bmi.toFixed(1)}`,
                      weight: 'bold',
                      size: 'xxl',
                      color: getBMIStatusColor(healthMetrics.bmi),
                      flex: 2
                    },
                    {
                      type: 'text',
                      text: healthMetrics.bmiStatus,
                      size: 'lg',
                      color: getBMIStatusColor(healthMetrics.bmi),
                      align: 'end',
                      flex: 3
                    }
                  ]
                }
              ]
            },
            
            // セパレーター
            { type: 'separator', margin: 'lg' },
            
            // 体重セクション
            {
              type: 'text',
              text: '体重の目安',
              weight: 'bold',
              size: 'md',
              color: '#333333',
              margin: 'lg'
            },
            {
              type: 'box',
              layout: 'vertical',
              spacing: 'sm',
              margin: 'sm',
              contents: [
                createWeightRow('現在', user.currentWeight, '#667eea', true),
                createWeightRow('標準', healthMetrics.standardWeight, '#10b981'),
                createWeightRow('美容', healthMetrics.beautyWeight, '#f59e0b'),
                createWeightRow('健康範囲', `${healthMetrics.minHealthyWeight}〜${healthMetrics.maxHealthyWeight}`, '#6b7280')
              ]
            },
            
            // 基礎代謝セクション
            { type: 'separator', margin: 'lg' },
            {
              type: 'text',
              text: '基礎代謝量（推定）',
              weight: 'bold',
              size: 'md',
              color: '#333333',
              margin: 'lg'
            },
            {
              type: 'box',
              layout: 'horizontal',
              margin: 'sm',
              contents: [
                {
                  type: 'text',
                  text: `${healthMetrics.bmr}`,
                  size: 'xl',
                  weight: 'bold',
                  color: '#667eea',
                  flex: 2
                },
                {
                  type: 'text',
                  text: 'kcal/日',
                  size: 'md',
                  color: '#666666',
                  align: 'end',
                  flex: 1
                }
              ]
            },
            
            // 必要カロリー
            {
              type: 'text',
              text: '活動レベル別必要カロリー',
              weight: 'bold',
              size: 'sm',
              color: '#333333',
              margin: 'lg'
            },
            {
              type: 'box',
              layout: 'vertical',
              spacing: 'xs',
              margin: 'sm',
              contents: [
                createCalorieRow('軽い活動', healthMetrics.dailyCalories.sedentary),
                createCalorieRow('適度な運動', healthMetrics.dailyCalories.moderate),
                createCalorieRow('活発な運動', healthMetrics.dailyCalories.active)
              ]
            },
            
            // アドバイス
            { type: 'separator', margin: 'lg' },
            {
              type: 'text',
              text: getHealthAdvice(healthMetrics.bmi, user.goalWeight, user.currentWeight),
              wrap: true,
              size: 'sm',
              color: '#666666',
              margin: 'lg'
            }
          ]
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          contents: [
            {
              type: 'button',
              style: 'primary',
              height: 'sm',
              action: {
                type: 'message',
                label: '詳細な健康データを見る',
                text: '詳細健康データ'
              },
              color: '#667eea'
            }
          ]
        }
      }
    };
    
    return client.replyMessage(event.replyToken, flexMessage);
    
  } catch (error) {
    console.error('健康データ計算エラー:', error);
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '申し訳ございません。健康データの計算に失敗しました。\n\n後ほど再度お試しください。'
    });
  }
}

// 詳細健康データリクエストの処理（テキスト版）
async function handleDetailedHealthDataRequest(event, userId, user) {
  console.log('詳細健康データリクエスト処理開始');
  
  try {
    // 包括的な健康指標を計算（30歳男性と仮定）
    const healthMetrics = calculations.calculateHealthMetrics(
      user.currentWeight, 
      user.height, 
      30, // 年齢（デフォルト）
      'male' // 性別（デフォルト）
    );
    
    // 健康アドバイスを取得
    const advice = calculations.getHealthAdvice(healthMetrics);
    
    // メッセージを構築
    let healthMessage = `📊 ${user.name}さんの詳細健康データ\n\n`;
    
    // 基本指標
    healthMessage += `【基本指標】\n`;
    healthMessage += `BMI: ${healthMetrics.bmi}（${healthMetrics.bmiStatus}）\n`;
    healthMessage += `肥満度: ${healthMetrics.obesityRate}%（${healthMetrics.obesityStatus}）\n\n`;
    
    // 体重指標
    healthMessage += `【理想体重】\n`;
    healthMessage += `標準体重: ${healthMetrics.standardWeight}kg`;
    if (healthMetrics.toStandardWeight !== 0) {
      const diff = healthMetrics.toStandardWeight > 0 ? `+${healthMetrics.toStandardWeight}` : healthMetrics.toStandardWeight;
      healthMessage += `（現在との差: ${diff}kg）`;
    }
    healthMessage += `\n`;
    healthMessage += `美容体重: ${healthMetrics.beautyWeight}kg`;
    if (healthMetrics.toBeautyWeight !== 0) {
      const diff = healthMetrics.toBeautyWeight > 0 ? `+${healthMetrics.toBeautyWeight}` : healthMetrics.toBeautyWeight;
      healthMessage += `（現在との差: ${diff}kg）`;
    }
    healthMessage += `\n`;
    healthMessage += `健康体重範囲: ${healthMetrics.minHealthyWeight}〜${healthMetrics.maxHealthyWeight}kg\n\n`;
    
    // 代謝・カロリー
    healthMessage += `【代謝・カロリー】\n`;
    healthMessage += `基礎代謝量: 約${healthMetrics.bmr}kcal/日\n\n`;
    healthMessage += `1日の推定必要カロリー:\n`;
    healthMessage += `・運動しない: ${healthMetrics.dailyCalories.sedentary}kcal\n`;
    healthMessage += `・軽い運動: ${healthMetrics.dailyCalories.light}kcal\n`;
    healthMessage += `・適度な運動: ${healthMetrics.dailyCalories.moderate}kcal\n`;
    healthMessage += `・ハードな運動: ${healthMetrics.dailyCalories.active}kcal\n\n`;
    
    // 健康的な減量目標
    healthMessage += `【健康的な減量ペース】\n`;
    healthMessage += `週: ${healthMetrics.healthyWeightLoss.perWeek}kg\n`;
    healthMessage += `月: ${healthMetrics.healthyWeightLoss.perMonth}kg\n`;
    healthMessage += `（1日${healthMetrics.healthyWeightLoss.dailyCalorieDeficit}kcal減）\n\n`;
    
    // アドバイス
    healthMessage += `【アドバイス】\n`;
    advice.forEach(tip => {
      healthMessage += `${tip}\n`;
    });
    
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: healthMessage
    });
    
  } catch (error) {
    console.error('詳細健康データ計算エラー:', error);
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '申し訳ございません。健康データの計算に失敗しました。\n\n後ほど再度お試しください。'
    });
  }
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
    `• 健康データ: 「健康データ」「BMI」\n` +
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

// 日替わりモチベーションメッセージ
function getMotivationalQuote() {
  const quotes = [
    '💭 小さな一歩が大きな変化を生みます',
    '🌱 今日の努力は明日の自分への贈り物',
    '⭐ 継続は力なり！素晴らしい習慣です',
    '🎯 目標に向かって、今日も一歩前進',
    '💪 あなたの頑張りを応援しています',
    '🌈 体重の変化は波があるもの。長期的な視点で',
    '✨ 記録することが成功への第一歩',
    '🏃 健康的な体作り、一緒に頑張りましょう'
  ];
  
  const today = new Date().getDay();
  return quotes[today % quotes.length];
}

// 連続記録日数に応じた特別メッセージとバッジ
function getStreakMessage(streakDays) {
  if (streakDays === 3) {
    return '🥉 3日連続達成！素晴らしいスタートです！';
  } else if (streakDays === 7) {
    return '🥈 1週間連続達成！習慣化されてきましたね！';
  } else if (streakDays === 14) {
    return '🥇 2週間連続達成！もう習慣の一部ですね！';
  } else if (streakDays === 30) {
    return '🏆 1ヶ月連続達成！本当に素晴らしい！！';
  } else if (streakDays === 100) {
    return '💎 100日連続達成！レジェンド級です！！！';
  } else if (streakDays > 0 && streakDays % 10 === 0) {
    return `🎊 ${streakDays}日連続記録中！amazing！`;
  }
  return null;
}

// BMIステータスに応じた色を取得
function getBMIStatusColor(bmi) {
  if (bmi < 18.5) {
    return '#3b82f6'; // 青色（低体重）
  } else if (bmi < 25) {
    return '#10b981'; // 緑色（普通体重）
  } else if (bmi < 30) {
    return '#f59e0b'; // オレンジ色（肥満1度）
  } else {
    return '#ef4444'; // 赤色（肥満2度以上）
  }
}

// 体重行を作成
function createWeightRow(label, value, color, isEmphasis = false) {
  return {
    type: 'box',
    layout: 'horizontal',
    contents: [
      {
        type: 'text',
        text: label,
        size: 'sm',
        color: '#666666',
        flex: 2
      },
      {
        type: 'text',
        text: typeof value === 'number' ? `${value}kg` : `${value}kg`,
        size: isEmphasis ? 'md' : 'sm',
        weight: isEmphasis ? 'bold' : 'regular',
        color: color,
        align: 'end',
        flex: 3
      }
    ]
  };
}

// カロリー行を作成
function createCalorieRow(label, calories) {
  return {
    type: 'box',
    layout: 'horizontal',
    contents: [
      {
        type: 'text',
        text: label,
        size: 'xs',
        color: '#666666',
        flex: 3
      },
      {
        type: 'text',
        text: `${calories}kcal`,
        size: 'xs',
        color: '#333333',
        align: 'end',
        flex: 2
      }
    ]
  };
}

// 健康アドバイスを取得
function getHealthAdvice(bmi, goalWeight, currentWeight) {
  if (bmi < 18.5) {
    return '💡 低体重です。健康的に体重を増やすことを検討してください。栄養バランスの良い食事と適度な筋力トレーニングをおすすめします。';
  } else if (bmi >= 30) {
    return '⚠️ 肥満の範囲です。医師と相談しながら計画的な減量をおすすめします。食事管理と運動を組み合わせて健康的に取り組みましょう。';
  } else if (bmi >= 25) {
    return '💡 健康リスクを減らすため、適度な減量をおすすめします。月1-2kgのペースで、無理のない範囲で取り組みましょう。';
  } else if (Math.abs(currentWeight - goalWeight) < 1) {
    return '✨ 目標達成！この健康的な状態を維持しましょう。継続的な運動と栄養バランスの良い食事を心がけてください。';
  } else {
    return '💡 健康的な範囲内です。目標に向けて継続しましょう。小さな変化の積み重ねが大きな成果につながります。';
  }
}

module.exports = {
  middleware,
  handleEvent,
  pushMessage
};