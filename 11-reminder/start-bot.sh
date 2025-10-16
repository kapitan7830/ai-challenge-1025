#!/bin/bash

# Start API server in background
echo "🚀 Starting API server..."
node src/api/server.js &
API_PID=$!

# Wait for API to start
sleep 2

# Start Telegram bot
echo "🤖 Starting Telegram bot..."
node mcp/telegram-bot.js

# When bot exits, kill API server
kill $API_PID

