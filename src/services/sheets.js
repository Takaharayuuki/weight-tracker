const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

// Google Sheets API認証設定
function createGoogleAuth() {
  console.log('Google認証情報の初期化を開始します...');
  
  try {
    // 本番環境（Render.com等）では環境変数からBase64デコードした認証情報を使用
    if (process.env.GOOGLE_CREDENTIALS_BASE64) {
      console.log('🔑 環境変数GOOGLE_CREDENTIALS_BASE64からGoogle認証情報を読み込みます');
      
      // Base64デコード
      let credentialsJson;
      try {
        const decodedCredentials = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('utf8');
        credentialsJson = JSON.parse(decodedCredentials);
        console.log('✅ Base64デコードと JSON パースが成功しました');
      } catch (decodeError) {
        console.error('❌ Base64デコードまたはJSONパースに失敗しました:', decodeError.message);
        throw new Error(`認証情報のデコードに失敗: ${decodeError.message}`);
      }
      
      // 必要なフィールドの検証
      const requiredFields = ['type', 'project_id', 'private_key_id', 'private_key', 'client_email'];
      const missingFields = requiredFields.filter(field => !credentialsJson[field]);
      
      if (missingFields.length > 0) {
        throw new Error(`認証情報に必要なフィールドがありません: ${missingFields.join(', ')}`);
      }
      
      console.log(`📧 サービスアカウント: ${credentialsJson.client_email}`);
      console.log(`📁 プロジェクトID: ${credentialsJson.project_id}`);
      
      return new google.auth.GoogleAuth({
        credentials: credentialsJson,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });
    } 
    // 開発環境ではcredentials.jsonファイルを使用
    else {
      console.log('📁 credentials.jsonファイルからGoogle認証情報を読み込みます');
      const credentialsPath = path.join(__dirname, '../../credentials.json');
      
      // ファイルの存在確認
      if (!fs.existsSync(credentialsPath)) {
        const warningMsg = `credentials.jsonファイルが見つかりません: ${credentialsPath}`;
        console.warn(`⚠️  ${warningMsg}`);
        console.warn('💡 本番環境では GOOGLE_CREDENTIALS_BASE64 環境変数を設定してください');
        throw new Error(warningMsg);
      }
      
      // ファイル内容の検証
      try {
        const fileContent = fs.readFileSync(credentialsPath, 'utf8');
        const credentialsJson = JSON.parse(fileContent);
        console.log(`📧 サービスアカウント: ${credentialsJson.client_email}`);
        console.log(`📁 プロジェクトID: ${credentialsJson.project_id}`);
      } catch (fileError) {
        console.error('❌ credentials.jsonファイルの読み取りまたはパースに失敗:', fileError.message);
        throw new Error(`credentials.jsonファイルが無効: ${fileError.message}`);
      }
      
      return new google.auth.GoogleAuth({
        keyFile: credentialsPath,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });
    }
  } catch (error) {
    console.error('❌ Google認証情報の読み込みに失敗しました:', error.message);
    console.warn('⚠️  Google Sheets機能は無効になります。アプリケーションは続行しますが、データ保存機能は制限されます。');
    
    // デバッグ情報を出力
    console.log('🔍 デバッグ情報:');
    console.log(`   - NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
    console.log(`   - GOOGLE_CREDENTIALS_BASE64: ${process.env.GOOGLE_CREDENTIALS_BASE64 ? '設定済み' : '未設定'}`);
    console.log(`   - credentials.json: ${fs.existsSync(path.join(__dirname, '../../credentials.json')) ? '存在' : '不存在'}`);
    
    return null;
  }
}

const auth = createGoogleAuth();

// スプレッドシートID
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

// Sheets APIクライアント
let sheets = null;

// 初期化
async function initialize() {
  if (!auth) {
    throw new Error('Google認証が設定されていません');
  }
  
  if (!sheets) {
    const authClient = await auth.getClient();
    sheets = google.sheets({ version: 'v4', auth: authClient });
  }
  return sheets;
}

// 体重データを追加
async function appendWeight(userId, weight) {
  console.log(`Google Sheetsに体重データを記録開始: ${userId} - ${weight}kg`);
  
  try {
    await initialize();
    
    const now = new Date();
    const jstDate = new Date(now.getTime() + 9 * 60 * 60 * 1000); // JSTに変換
    const dateStr = jstDate.toISOString().split('T')[0].replace(/-/g, '/');
    const timeStr = jstDate.toISOString().split('T')[1].split('.')[0];
    
    const values = [[dateStr, timeStr, userId, weight]];
    
    const resource = {
      values,
    };
    
    console.log('Google Sheets API呼び出し開始...');
    const result = await Promise.race([
      sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Sheet1!A:D',
        valueInputOption: 'USER_ENTERED',
        resource,
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Google Sheets API タイムアウト')), 10000)
      )
    ]);
    
    console.log(`体重データを記録しました: ${userId} - ${weight}kg`);
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
    
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet1!A:D',
    });
    
    const rows = result.data.values || [];
    const userRows = rows.filter(row => row[2] === userId);
    
    // 最新のデータから指定日数分を取得
    const recentRows = userRows.slice(-days);
    
    return recentRows.map(row => ({
      date: row[0],
      time: row[1],
      weight: parseFloat(row[3])
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
    
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet1!A:D',
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
          weight: parseFloat(row[3])
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
    
    const headers = [['日付', '時刻', 'ユーザーID', '体重(kg)']];
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet1!A1:D1',
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
  initializeSheet
};