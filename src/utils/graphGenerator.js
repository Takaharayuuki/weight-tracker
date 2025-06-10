const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const { getUserWeightHistory } = require('../services/sheets');
const { getUser } = require('../data/userStore');

// Chart.jsの設定
const width = 800;
const height = 400;
const backgroundColour = 'white';

const chartJSNodeCanvas = new ChartJSNodeCanvas({
  width,
  height,
  backgroundColour
});

// 体重推移グラフを生成
async function generateWeightGraph(userId, days = 30) {
  console.log(`体重推移グラフを生成開始: ${userId} (${days}日間)`);
  
  try {
    // ユーザーデータを取得
    const userData = getUser(userId);
    if (!userData) {
      throw new Error('ユーザーデータが見つかりません');
    }
    
    // 体重履歴を取得
    const weightHistory = await getUserWeightHistory(userId, days);
    console.log(`取得した履歴データ数: ${weightHistory.length}`);
    
    if (weightHistory.length < 2) {
      throw new Error('グラフ生成に必要なデータが不足しています（最低2日分必要）');
    }
    
    // データの準備
    const labels = [];
    const weights = [];
    const dates = [];
    
    weightHistory.forEach(record => {
      const dateStr = record.date; // YYYY/MM/DD形式
      const weight = record.weight;
      
      labels.push(dateStr);
      weights.push(weight);
      dates.push(new Date(dateStr.replace(/\//g, '-')));
    });
    
    // 週平均の計算
    const weeklyAverages = calculateWeeklyAverages(weightHistory);
    
    // 統計情報の計算
    const maxWeight = Math.max(...weights);
    const minWeight = Math.min(...weights);
    const currentWeight = weights[weights.length - 1];
    const goalWeight = userData.goalWeight;
    
    console.log(`統計情報 - 最大: ${maxWeight}kg, 最小: ${minWeight}kg, 現在: ${currentWeight}kg, 目標: ${goalWeight}kg`);
    
    // Chart.jsの設定
    const configuration = {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: '体重',
            data: weights,
            borderColor: '#667eea',
            backgroundColor: 'rgba(102, 126, 234, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.1,
            pointBackgroundColor: '#667eea',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointRadius: 5
          },
          {
            label: '目標体重',
            data: Array(weights.length).fill(goalWeight),
            borderColor: '#f59e0b',
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [5, 5],
            fill: false,
            pointRadius: 0,
            tension: 0
          },
          {
            label: '週平均',
            data: weeklyAverages,
            borderColor: '#10b981',
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [3, 3],
            fill: false,
            pointRadius: 3,
            pointBackgroundColor: '#10b981',
            tension: 0.1
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: `${days}日間の体重推移`,
            font: {
              size: 20,
              weight: 'bold'
            },
            padding: 20
          },
          legend: {
            display: true,
            position: 'top',
            labels: {
              font: {
                size: 14
              },
              usePointStyle: true,
              padding: 20
            }
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleColor: 'white',
            bodyColor: 'white',
            borderColor: '#667eea',
            borderWidth: 1,
            callbacks: {
              label: function(context) {
                const label = context.dataset.label || '';
                const value = context.parsed.y;
                if (label === '体重' || label === '週平均') {
                  return `${label}: ${value.toFixed(1)}kg`;
                } else if (label === '目標体重') {
                  return `${label}: ${value.toFixed(1)}kg`;
                }
                return `${label}: ${value}`;
              }
            }
          }
        },
        scales: {
          x: {
            display: true,
            title: {
              display: true,
              text: '日付',
              font: {
                size: 14,
                weight: 'bold'
              }
            },
            ticks: {
              font: {
                size: 12
              },
              maxTicksLimit: 10 // 表示する日付の最大数を制限
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.1)'
            }
          },
          y: {
            display: true,
            title: {
              display: true,
              text: '体重 (kg)',
              font: {
                size: 14,
                weight: 'bold'
              }
            },
            ticks: {
              font: {
                size: 12
              },
              callback: function(value) {
                return value.toFixed(1) + 'kg';
              }
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.1)'
            },
            // Y軸の範囲を適切に設定
            min: Math.max(0, minWeight - 2),
            max: Math.max(maxWeight + 2, goalWeight + 2)
          }
        },
        interaction: {
          mode: 'nearest',
          axis: 'x',
          intersect: false
        }
      }
    };
    
    console.log('グラフの画像生成を開始...');
    const imageBuffer = await chartJSNodeCanvas.renderToBuffer(configuration);
    console.log('グラフの画像生成が完了しました');
    
    // 統計情報を含むメタデータを返す
    const metadata = {
      days,
      recordCount: weightHistory.length,
      maxWeight,
      minWeight,
      currentWeight,
      goalWeight,
      difference: currentWeight - goalWeight,
      progress: goalWeight > currentWeight ? 
        `目標まで${(goalWeight - currentWeight).toFixed(1)}kg` : 
        `目標を${(currentWeight - goalWeight).toFixed(1)}kg上回っています`
    };
    
    return {
      imageBuffer,
      metadata
    };
    
  } catch (error) {
    console.error('グラフ生成エラー:', error);
    throw error;
  }
}

// 週平均を計算する関数
function calculateWeeklyAverages(weightHistory) {
  if (weightHistory.length < 7) {
    // データが7日未満の場合は全体の平均を返す
    const total = weightHistory.reduce((sum, record) => sum + record.weight, 0);
    const average = total / weightHistory.length;
    return Array(weightHistory.length).fill(average);
  }
  
  const averages = [];
  
  for (let i = 0; i < weightHistory.length; i++) {
    // 過去7日間（または利用可能なデータ）の平均を計算
    const startIndex = Math.max(0, i - 6);
    const endIndex = i + 1;
    const recentData = weightHistory.slice(startIndex, endIndex);
    
    const total = recentData.reduce((sum, record) => sum + record.weight, 0);
    const average = total / recentData.length;
    averages.push(average);
  }
  
  return averages;
}

// 軽量版のテキスト履歴を生成（フォールバック用）
function generateTextHistory(weightHistory, userData) {
  if (weightHistory.length === 0) {
    return '記録がありません。体重を記録してから「グラフ」と送信してください。';
  }
  
  const recentRecords = weightHistory.slice(-7); // 最新7日分
  const currentWeight = recentRecords[recentRecords.length - 1].weight;
  const goalWeight = userData.goalWeight;
  
  let message = `📊 最近の体重記録\n\n`;
  
  recentRecords.forEach(record => {
    message += `${record.date}: ${record.weight}kg\n`;
  });
  
  message += `\n🎯 目標体重: ${goalWeight}kg\n`;
  message += `📈 現在の体重: ${currentWeight}kg\n`;
  
  if (currentWeight <= goalWeight) {
    message += `✅ 目標達成！おめでとうございます！`;
  } else {
    const diff = currentWeight - goalWeight;
    message += `📍 目標まで: ${diff.toFixed(1)}kg`;
  }
  
  return message;
}

module.exports = {
  generateWeightGraph,
  generateTextHistory
};