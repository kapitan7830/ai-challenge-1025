# 🧠 Chain-of-Thought Testing Bot

Telegram bot for comparing direct AI responses vs chain-of-thought reasoning with YandexGPT.

## What is Chain-of-Thought?

Chain-of-Thought (CoT) is a prompting technique where the AI model is asked to show its reasoning process step-by-step before giving the final answer. This often leads to better quality responses for complex questions.

## How does the bot work?

1. You ask any question in the chat
2. The bot sends **2 requests** to YandexGPT:
   - **Direct Answer**: Normal concise response
   - **Chain-of-Thought**: Model shows reasoning process then gives answer
3. Both responses are published sequentially with stats (time, tokens, cost)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```bash
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
YANDEX_API_KEY=your_yandex_api_key
YANDEX_FOLDER_ID=your_yandex_folder_id
```

3. API keys:
   - `TELEGRAM_BOT_TOKEN`: Get from [@BotFather](https://t.me/botfather)
   - `YANDEX_API_KEY`: Get from [Yandex Cloud Console](https://console.cloud.yandex.ru/)
   - `YANDEX_FOLDER_ID`: Your Yandex Cloud folder ID

## Run

```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## Usage

1. Start the bot with `/start` command
2. Ask any question (e.g., "Solve: If I have 5 apples and give away 2, how many do I have?", "What is quantum physics?", "Calculate 234 * 567")
3. You'll get two responses:
   - **🇷🇺 Direct Answer**: Quick, concise response
   - **🧠 Chain-of-Thought**: Step-by-step reasoning process then final answer
4. Compare: Chain-of-Thought typically provides better quality for complex questions but uses more tokens

## Commands

- `/start` - Welcome message and instructions
- `/help` - Show help

## Model

Uses **YandexGPT 5 Lite** - lightweight Russian model that demonstrates the difference between direct answering and chain-of-thought reasoning.

