# Telegram OpenAI Bot

A simple Node.js Telegram bot that forwards messages to OpenAI and returns responses.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

3. Add your API keys to `.env`:
   - `TELEGRAM_BOT_TOKEN`: Get from [@BotFather](https://t.me/botfather) on Telegram
   - `OPENAI_API_KEY`: Get from [OpenAI Platform](https://platform.openai.com/api-keys)

## Running

```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## Features

- Maintains conversation history per user
- `/start` - Welcome message
- `/help` - Show help
- `/clear` - Clear conversation history
- Automatically limits history to last 20 messages to manage token usage

