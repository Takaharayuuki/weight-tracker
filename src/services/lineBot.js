const { client, middleware } = require('../config/line');
const userStore = require('../data/userStore');
const sheets = require('./sheets');
const messages = require('../utils/messages');
const calculations = require('../utils/calculations');
const { generateWeightGraph, generateTextHistory } = require('../utils/graphGenerator');

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
    } else if (!user.isCompleted || user.registrationStep < 5) {
      // 登録途中のユーザー
      console.log('登録フローの処理');
      return handleRegistrationFlow(event, userId, messageText, user);
    } else {
      // 登録済みユーザーの処理
      console.log('登録済みユーザーの処理');
      
      // 特殊コマンドの処理
      if (messageText === '進捗' || messageText === '進捗確認') {
        return handleProgressRequest(event, userId, user);
      }
      
      if (messageText === 'グラフ' || messageText === '推移' || messageText === '履歴') {
        return handleGraphRequest(event, userId, user);
      }
      
      if (messageText === 'ヒント') {
        return client.replyMessage(event.replyToken, messages.getTipMessage());
      }
      
      if (messageText === '設定' || messageText === '設定変更') {
        return handleSettingsRequest(event, userId, user);
      }
      
      if (messageText === 'リセット' || messageText === '登録し直し' || messageText === '初期化') {
        return handleResetRequest(event, userId, user);
      }
      
      if (messageText === 'ヘルプ' || messageText === 'help' || messageText === '使い方') {
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: `使い方

体重記録: 数値を送信（例: 69.5）
進捗確認: 「進捗」と送信
グラフ表示: 「グラフ」「推移」「履歴」のいずれかを送信
設定確認: 「設定」と送信  
登録リセット: 「リセット」と送信
ヒント: 「ヒント」と送信`
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
    case 0: // 初回メッセージ後、目標体重入力待ち
    case 1: // 目標体重の入力
      if (messageText === 'その他の目標体重を入力します') {
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: '目標体重を数値で入力してください。\n例: 65'
        });
      }
      
      if (isNaN(value) || value < 30 || value > 200) {
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: '正しい目標体重を入力してください（30〜200kg）'
        });
      }
      
      const updatedUser = userStore.updateUser(userId, { 
        goalWeight: value, 
        registrationStep: 2 
      });
      
      console.log('目標体重を保存しました:', value, 'ユーザー状態:', updatedUser);
      
      return client.replyMessage(event.replyToken, 
        messages.getRegistrationStepMessage(1, { goalWeight: value })
      );
      
    case 2: // 現在の体重の入力
      if (isNaN(value) || value < 30 || value > 300) {
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: '正しい現在の体重を入力してください（30〜300kg）'
        });
      }
      
      userStore.updateUser(userId, { 
        currentWeight: value, 
        registrationStep: 3 
      });
      
      return client.replyMessage(event.replyToken, 
        messages.getRegistrationStepMessage(2, { currentWeight: value })
      );
      
    case 3: // 身長の入力
      if (isNaN(value) || value < 100 || value > 250) {
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: '正しい身長を入力してください（100〜250cm）'
        });
      }
      
      userStore.updateUser(userId, { 
        height: value, 
        registrationStep: 4 
      });
      
      return client.replyMessage(event.replyToken, 
        messages.getRegistrationStepMessage(3, { height: value })
      );
      
    case 4: // 起床時間の入力
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
        registrationStep: 5,
        isCompleted: true 
      });
      
      // BMIを計算
      const bmi = calculations.calculateBMI(finalUser.currentWeight, finalUser.height);
      const bmiStatus = calculations.getBMIStatus(bmi);
      
      // 完了メッセージ
      const response = client.replyMessage(event.replyToken, [
        {
          type: 'text',
          text: `登録完了

目標体重: ${finalUser.goalWeight}kg
現在の体重: ${finalUser.currentWeight}kg
身長: ${finalUser.height}cm
起床時間: ${finalUser.wakeTime}
BMI: ${bmi.toFixed(1)} (${bmiStatus})`
        },
        messages.getMotivationalMessage(finalUser.currentWeight, finalUser.goalWeight, true)
      ]);

      // Google Sheetsへの初回記録は非同期で実行
      sheets.appendWeight(userId, finalUser.currentWeight).catch(error => {
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
  const response = client.replyMessage(event.replyToken, [
    {
      type: 'text',
      text: `${weight}kg記録しました`
    },
    messages.getMotivationalMessage(weight, user.goalWeight)
  ]);

  // Google Sheetsへの記録と週平均計算は非同期で実行
  Promise.all([
    sheets.appendWeight(userId, weight),
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