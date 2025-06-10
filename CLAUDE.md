# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a weight tracking LINE bot system designed for personal trainers. Users record their weight via LINE messages, data is stored in Google Sheets, and daily reminders help maintain consistency.

## Key Commands

### Development
```bash
npm run dev          # Start development server with nodemon
npm start           # Start production server
npm test            # Run Jest tests
```

### Local Testing with LINE Webhook
```bash
ngrok http 3000     # Expose local server for LINE webhook testing
```

## Architecture

### Core Components
- **LINE Bot Handler** (`src/services/lineBot.js`): Processes incoming LINE messages, handles user registration and weight recording
- **User State Store** (`src/data/userStateStore.js`): Manages temporary user states for multi-step operations
- **Google Sheets Integration** (`src/services/sheets.js`): Manages data persistence to Google Sheets
- **Scheduler** (`src/services/scheduler.js`): Handles cron jobs for morning greetings and evening reminders
- **User Store** (`src/data/userStore.js`): In-memory user data management (Map-based, to be migrated to database)
- **Graph Generator** (`src/utils/graphGenerator.js`): Chart.js-based weight progress visualization

### Data Flow
1. User sends message to LINE bot
2. Webhook receives at `/webhook` endpoint
3. Message processed based on user state (new user vs registered)
4. Weight data saved to Google Sheets
5. Response with motivational message sent back

### Message Processing Logic
- New users: 4-step registration flow (goal weight, current weight, height, wake time)
- Registered users: Direct weight recording with validation
- Rich menu actions: Tap-based commands for common operations
- Graph commands: 「グラフ」「推移」「履歴」で visual chart generation
- State management: Temporary user states for multi-step operations
- Automatic reminders: Morning (at wake time) and evening (20:00) if no record

## Critical Implementation Notes

### LINE API Integration
- Webhook endpoint must be HTTPS (use ngrok for local testing)
- Handle both text and postback events
- Validate webhook signature for security

### Google Sheets Format
| Date | Time | User ID | Weight (kg) |
|------|------|---------|-------------|
| 2025/1/15 | 6:35:00 | U123... | 69.5 |

### User Data Structure
```javascript
{
  lineUserId: string,
  goalWeight: number,
  currentWeight: number,
  height: number,
  wakeTime: string (HH:MM format),
  lastRecordDate: Date
}
```

### Time Handling
- All times in JST (Japan Standard Time)
- Wake time stored as HH:MM string
- Cron jobs scheduled based on user's wake time

## Environment Setup Requirements

1. LINE Developers Console configuration
2. Google Cloud service account with Sheets API enabled
3. Environment variables in `.env`:
   - LINE_CHANNEL_ACCESS_TOKEN
   - LINE_CHANNEL_SECRET
   - GOOGLE_SHEET_ID
4. Google認証情報:
   - 開発環境: `credentials.json` ファイル（プロジェクトルート）
   - 本番環境: Render.com Secret Files (`/etc/secrets/credentials.json`)

## Rich Menu Actions

### Supported Rich Menu Commands (Recommended Texts)
- **"体重記録"**: Prompts for weight input with state management
- **"グラフ"**: Generates and displays weight progression chart  
- **"成果"**: Shows weekly statistics and progress analysis
- **"設定"**: Displays current user settings and BMI
- **"ヘルプ"**: Comprehensive usage guide with examples
- **"目標変更"**: Interactive goal weight modification

### Alternative Commands (Legacy Support)
- Weight input: "今日の体重を記録", "記録"
- Graph display: "グラフを表示", "推移", "履歴"
- Progress: "今週の成果", "進捗"
- Settings: "設定メニュー", "設定確認", "設定変更"
- Help: "help", "使い方"
- Goal change: "目標を再設定", "目標設定"

### State Management
- Temporary user states with 30-minute expiration
- Automatic cleanup of expired states
- Support for weight input and goal modification workflows

## Testing Approach

- Unit tests for calculation utilities
- Integration tests for LINE webhook handling
- Rich menu action testing with state transitions
- Mock Google Sheets API for testing
- Test edge cases: invalid weight values, timezone handling, message formatting