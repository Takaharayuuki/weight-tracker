const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

// Google Sheets API認証設定
function createGoogleAuth() {
  console.log('========== Google認証情報の初期化開始 ==========');
  console.log(`現在の作業ディレクトリ: ${process.cwd()}`);
  console.log(`現在のファイルパス: ${__filename}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
  
  try {
    console.log('🔍 環境変数チェック:');
    console.log(`  - GOOGLE_SHEET_ID: ${process.env.GOOGLE_SHEET_ID || '未設定'}`);
    
    // 認証ファイルのパスを環境に応じて設定
    const credentialsPath = process.env.NODE_ENV === 'production' 
      ? '/etc/secrets/credentials.json' 
      : path.join(__dirname, '../../credentials.json');
    
    console.log(`📁 Google認証ファイルパス: ${credentialsPath}`);
    
    // ファイルの存在確認
    if (!fs.existsSync(credentialsPath)) {
      console.error(`❌ 認証ファイルが見つかりません: ${credentialsPath}`);
      throw new Error(`認証ファイルが見つかりません: ${credentialsPath}`);
    }
    
    console.log('✅ 認証ファイルが見つかりました');
    
    // ファイル内容の検証
    try {
      const fileContent = fs.readFileSync(credentialsPath, 'utf8');
      const credentialsJson = JSON.parse(fileContent);
      
      // 必要なフィールドの検証
      const requiredFields = ['type', 'project_id', 'private_key_id', 'private_key', 'client_email'];
      const missingFields = requiredFields.filter(field => !credentialsJson[field]);
      
      if (missingFields.length > 0) {
        throw new Error(`認証情報に必要なフィールドがありません: ${missingFields.join(', ')}`);
      }
      
      console.log(`📧 サービスアカウント: ${credentialsJson.client_email}`);
      console.log(`📁 プロジェクトID: ${credentialsJson.project_id}`);
      
    } catch (fileError) {
      console.error('❌ credentials.jsonファイルの読み取りまたはパースに失敗:', fileError.message);
      throw new Error(`credentials.jsonファイルが無効: ${fileError.message}`);
    }
    
    console.log('🔑 Google認証クライアントを作成します');
    return new google.auth.GoogleAuth({
      keyFile: credentialsPath,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
  } catch (error) {
    console.error('❌ Google認証情報の読み込みに失敗しました:', error.message);
    console.error('詳細エラー情報:', error);
    console.warn('⚠️  Google Sheets機能は無効になります。アプリケーションは続行しますが、データ保存機能は制限されます。');
    
    // デバッグ情報を出力
    console.log('🔍 デバッグ情報:');
    console.log(`   - NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
    console.log(`   - 作業ディレクトリ: ${process.cwd()}`);
    console.log(`   - スクリプトディレクトリ: ${__dirname}`);
    
    // ディレクトリ構造の確認
    console.log('📂 現在のディレクトリ構造:');
    try {
      const files = fs.readdirSync(process.cwd());
      files.forEach(file => console.log(`   - ${file}`));
    } catch (e) {
      console.error('   ディレクトリ読み取りエラー:', e.message);
    }
    
    // 本番環境では /etc/secrets/ ディレクトリの確認
    if (process.env.NODE_ENV === 'production') {
      console.log('📂 /etc/secrets/ ディレクトリ構造:');
      try {
        const secretFiles = fs.readdirSync('/etc/secrets/');
        secretFiles.forEach(file => console.log(`   - ${file}`));
      } catch (e) {
        console.error('   /etc/secrets/ ディレクトリ読み取りエラー:', e.message);
      }
    }
    
    return null;
  }
}

console.log('========== Google認証情報の初期化完了 ==========');

const auth = createGoogleAuth();

// スプレッドシートID
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
console.log(`📊 Google Sheet ID: ${SPREADSHEET_ID || '未設定'}`);

// Sheets APIクライアント
let sheets = null;

// 初期化
async function initialize() {
  console.log('📝 Google Sheets APIクライアントを初期化中...');
  
  if (!auth) {
    console.error('❌ Google認証が設定されていません');
    throw new Error('Google認証が設定されていません。credentials.jsonファイルを確認してください。');
  }
  
  if (!SPREADSHEET_ID) {
    console.error('❌ GOOGLE_SHEET_IDが設定されていません');
    throw new Error('環境変数GOOGLE_SHEET_IDが設定されていません');
  }
  
  if (!sheets) {
    try {
      console.log('🔐 認証クライアントを取得中...');
      const authClient = await auth.getClient();
      console.log('✅ 認証クライアント取得成功');
      
      console.log('📊 Google Sheets APIクライアントを作成中...');
      sheets = google.sheets({ version: 'v4', auth: authClient });
      console.log('✅ Google Sheets APIクライアント作成成功');
    } catch (initError) {
      console.error('❌ 初期化エラー:', initError);
      throw initError;
    }
  }
  return sheets;
}

// シート名の自動検出（日本語対応）
async function getMainSheetName() {
  try {
    await initialize();
    
    const response = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID
    });
    
    const sheetNames = response.data.sheets.map(sheet => sheet.properties.title);
    console.log('利用可能なシート名:', sheetNames);
    
    // 優先順位: 「シート1」 > 「Sheet1」 > 最初のシート
    if (sheetNames.includes('シート1')) {
      return 'シート1';
    } else if (sheetNames.includes('Sheet1')) {
      return 'Sheet1';
    } else {
      return sheetNames[0];
    }
  } catch (error) {
    console.error('シート名取得エラー:', error);
    return 'Sheet1'; // デフォルト
  }
}

// ユーザー管理シートの存在確認と作成
async function ensureUserManagementSheet() {
  try {
    await initialize();
    
    const response = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID
    });
    
    const sheetNames = response.data.sheets.map(sheet => sheet.properties.title);
    
    if (!sheetNames.includes('ユーザー管理')) {
      console.log('ユーザー管理シートを作成中...');
      
      // シートを追加
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        resource: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: 'ユーザー管理'
                }
              }
            }
          ]
        }
      });
      
      // ヘッダー行を追加
      const headers = [['ユーザーID', '名前', '目標体重', '現在体重', '身長', '起床時間', '登録日', '最終記録日', '連続記録日数']];
      
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'ユーザー管理!A1:I1',
        valueInputOption: 'USER_ENTERED',
        resource: { values: headers }
      });
      
      console.log('ユーザー管理シートを作成しました');
    }
    
    return true;
  } catch (error) {
    console.error('ユーザー管理シート確認エラー:', error);
    return false;
  }
}

// ユーザー情報を保存/更新
async function saveUserInfo(userId, userInfo) {
  console.log(`ユーザー情報をGoogle Sheetsに保存: ${userId}`);
  
  try {
    await initialize();
    await ensureUserManagementSheet();
    
    // 既存のユーザー情報を確認
    const existingUser = await getUserInfo(userId);
    const now = new Date();
    const jstDate = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const dateStr = jstDate.toISOString().split('T')[0].replace(/-/g, '/');
    
    const values = [[
      userId,
      userInfo.name || '',
      userInfo.goalWeight || '',
      userInfo.currentWeight || '',
      userInfo.height || '',
      userInfo.wakeTime || '',
      existingUser ? existingUser.registrationDate : dateStr, // 登録日は既存のものを保持
      userInfo.lastRecordDate || '',
      userInfo.consecutiveDays || 0
    ]];
    
    if (existingUser) {
      // 既存ユーザーの更新
      const rowIndex = existingUser.rowIndex;
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `ユーザー管理!A${rowIndex}:I${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        resource: { values }
      });
      console.log(`ユーザー情報を更新しました: ${userId}`);
    } else {
      // 新規ユーザーの追加
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'ユーザー管理!A:I',
        valueInputOption: 'USER_ENTERED',
        resource: { values }
      });
      console.log(`新規ユーザー情報を保存しました: ${userId}`);
    }
    
    return { success: true };
  } catch (error) {
    console.error('ユーザー情報保存エラー:', error);
    return { success: false, error: error.message };
  }
}

// ユーザー情報を取得
async function getUserInfo(userId) {
  try {
    await initialize();
    
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'ユーザー管理!A:I',
    });
    
    const rows = result.data.values || [];
    
    for (let i = 1; i < rows.length; i++) { // ヘッダー行をスキップ
      const row = rows[i];
      if (row[0] === userId) {
        return {
          userId: row[0],
          name: row[1] || '',
          goalWeight: row[2] ? parseFloat(row[2]) : null,
          currentWeight: row[3] ? parseFloat(row[3]) : null,
          height: row[4] ? parseFloat(row[4]) : null,
          wakeTime: row[5] || '',
          registrationDate: row[6] || '',
          lastRecordDate: row[7] || '',
          consecutiveDays: row[8] ? parseInt(row[8]) : 0,
          rowIndex: i + 1 // スプレッドシートの行番号（1ベース）
        };
      }
    }
    
    return null; // ユーザーが見つからない場合
  } catch (error) {
    console.error('ユーザー情報取得エラー:', error);
    return null;
  }
}

// 全ユーザー一覧を取得
async function getAllUsers() {
  try {
    await initialize();
    
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'ユーザー管理!A:I',
    });
    
    const rows = result.data.values || [];
    const users = [];
    
    for (let i = 1; i < rows.length; i++) { // ヘッダー行をスキップ
      const row = rows[i];
      if (row[0]) { // ユーザーIDが存在する場合
        users.push({
          userId: row[0],
          name: row[1] || '',
          goalWeight: row[2] ? parseFloat(row[2]) : null,
          currentWeight: row[3] ? parseFloat(row[3]) : null,
          height: row[4] ? parseFloat(row[4]) : null,
          wakeTime: row[5] || '',
          registrationDate: row[6] || '',
          lastRecordDate: row[7] || '',
          consecutiveDays: row[8] ? parseInt(row[8]) : 0
        });
      }
    }
    
    return users;
  } catch (error) {
    console.error('全ユーザー取得エラー:', error);
    return [];
  }
}

// 名前のみ更新
async function updateUserName(userId, name) {
  console.log(`ユーザー名を更新: ${userId} -> ${name}`);
  
  try {
    const userInfo = await getUserInfo(userId);
    if (!userInfo) {
      console.log('ユーザーが見つからないため、名前のみで新規作成');
      return await saveUserInfo(userId, { name });
    }
    
    // 既存情報に名前を更新
    userInfo.name = name;
    return await saveUserInfo(userId, userInfo);
  } catch (error) {
    console.error('ユーザー名更新エラー:', error);
    return { success: false, error: error.message };
  }
}

// 連続記録日数を計算
function calculateConsecutiveDays(weightHistory) {
  if (!weightHistory || weightHistory.length === 0) {
    return 0;
  }
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // 日付でグループ化
  const recordDates = [...new Set(weightHistory.map(record => {
    const recordDate = new Date(record.date.replace(/\//g, '-'));
    recordDate.setHours(0, 0, 0, 0);
    return recordDate.getTime();
  }))].sort((a, b) => b - a); // 降順ソート
  
  let consecutiveDays = 0;
  let currentDate = today.getTime();
  
  for (const recordDate of recordDates) {
    if (recordDate === currentDate || recordDate === currentDate - 24 * 60 * 60 * 1000) {
      consecutiveDays++;
      currentDate = recordDate - 24 * 60 * 60 * 1000; // 前日にセット
    } else {
      break;
    }
  }
  
  return consecutiveDays;
}

// 体重データを追加（ニックネーム付き）
async function appendWeight(userId, weight, userName = '') {
  console.log(`Google Sheetsに体重データを記録開始: ${userId} - ${weight}kg (${userName})`);
  
  try {
    await initialize();
    const mainSheetName = await getMainSheetName();
    
    const now = new Date();
    const jstDate = new Date(now.getTime() + 9 * 60 * 60 * 1000); // JSTに変換
    const dateStr = jstDate.toISOString().split('T')[0].replace(/-/g, '/');
    const timeStr = jstDate.toISOString().split('T')[1].split('.')[0];
    
    const values = [[dateStr, timeStr, userId, weight, userName || '']];
    
    const resource = {
      values,
    };
    
    console.log('Google Sheets API呼び出し開始...');
    const result = await Promise.race([
      sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${mainSheetName}!A:E`,
        valueInputOption: 'USER_ENTERED',
        resource,
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Google Sheets API タイムアウト')), 10000)
      )
    ]);
    
    // ユーザー管理シートの更新
    try {
      const weightHistory = await getUserWeightHistory(userId, 30); // 30日分の履歴を取得
      const consecutiveDays = calculateConsecutiveDays(weightHistory);
      
      const userInfo = await getUserInfo(userId);
      if (userInfo) {
        userInfo.currentWeight = weight;
        userInfo.lastRecordDate = dateStr;
        userInfo.consecutiveDays = consecutiveDays;
        if (userName && !userInfo.name) {
          userInfo.name = userName;
        }
        await saveUserInfo(userId, userInfo);
      }
    } catch (userUpdateError) {
      console.error('ユーザー管理シート更新エラー:', userUpdateError);
      // 体重記録は成功しているので、エラーを投げない
    }
    
    console.log(`体重データを記録しました: ${userId} - ${weight}kg (${userName})`);
    return result;
  } catch (error) {
    console.error('Google Sheetsへの記録エラー:', error);
    
    // Google Sheets API関連のエラーの場合、処理を続行
    if (error.message.includes('タイムアウト') || 
        error.code >= 500 || 
        error.code === 403 ||
        error.message.includes('API has not been used') ||
        error.message.includes('accessNotConfigured')) {
      console.log('Google Sheetsエラーですが、処理を続行します');
      console.log('エラー詳細:', error.message);
      return { success: false, error: error.message };
    }
    
    throw error;
  }
}

// ユーザーの体重履歴を取得
async function getUserWeightHistory(userId, days = 7) {
  try {
    await initialize();
    const mainSheetName = await getMainSheetName();
    
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${mainSheetName}!A:E`,
    });
    
    const rows = result.data.values || [];
    const userRows = rows.filter(row => row[2] === userId);
    
    // 最新のデータから指定日数分を取得
    const recentRows = userRows.slice(-days);
    
    return recentRows.map(row => ({
      date: row[0],
      time: row[1],
      weight: parseFloat(row[3]),
      name: row[4] || ''
    }));
  } catch (error) {
    console.error('Google Sheetsからの読み取りエラー:', error);
    console.log('Google Sheets APIエラーのため、空の履歴を返します');
    return [];
  }
}

// 全ユーザーのデータを取得（ダッシュボード用）
async function getAllUsersData() {
  try {
    await initialize();
    const mainSheetName = await getMainSheetName();
    
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${mainSheetName}!A:E`,
    });
    
    const rows = result.data.values || [];
    
    // ユーザーごとにデータを整理
    const userData = {};
    
    rows.forEach(row => {
      if (row.length >= 4) {
        const userId = row[2];
        const record = {
          date: row[0],
          time: row[1],
          weight: parseFloat(row[3]),
          name: row[4] || ''
        };
        
        if (!userData[userId]) {
          userData[userId] = [];
        }
        userData[userId].push(record);
      }
    });
    
    return userData;
  } catch (error) {
    console.error('Google Sheetsからの読み取りエラー:', error);
    return {};
  }
}

// スプレッドシートの初期設定（ヘッダー行の追加）
async function initializeSheet() {
  try {
    await initialize();
    const mainSheetName = await getMainSheetName();
    
    const headers = [['日付', '時刻', 'ユーザーID', '体重(kg)', 'ニックネーム']];
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${mainSheetName}!A1:E1`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: headers }
    });
    
    console.log('スプレッドシートの初期設定が完了しました');
  } catch (error) {
    console.error('スプレッドシートの初期設定エラー:', error);
  }
}

module.exports = {
  appendWeight,
  getUserWeightHistory,
  getAllUsersData,
  initializeSheet,
  saveUserInfo,
  getUserInfo,
  getAllUsers,
  updateUserName,
  ensureUserManagementSheet,
  getMainSheetName
};