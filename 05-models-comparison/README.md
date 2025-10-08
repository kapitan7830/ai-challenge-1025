# 🤖 AI Models Comparison Bot

Telegram bot for comparing responses from different AI models: small open-source models vs commercial models.

## What does it do?

This bot sends your question to three different AI models and shows their responses side-by-side:

- **🐭 SmolLM3-3B** - Small open-source model (3B parameters) from HuggingFace
- **🔀 Arch-Router-1.5B** - Routing model (1.5B parameters) from HuggingFace
- **🇷🇺 YandexGPT 5 Lite** - Lightweight commercial model from Yandex Cloud

## Why compare models?

See the difference between:
- **Quality**: How well each model understands and answers questions
- **Speed**: Response time from each model
- **Cost**: Token usage and pricing (free vs paid)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```bash
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
HUGGINGFACE_API_KEY=your_huggingface_api_key
YANDEX_API_KEY=your_yandex_api_key
YANDEX_FOLDER_ID=your_yandex_folder_id
```

3. Get API keys:
   - **TELEGRAM_BOT_TOKEN**: Get from [@BotFather](https://t.me/botfather)
   - **HUGGINGFACE_API_KEY**: Get from [HuggingFace Settings](https://huggingface.co/settings/tokens)
   - **YANDEX_API_KEY**: Create service account in [Yandex Cloud Console](https://console.yandex.cloud/folders?section=service-accounts)
   - **YANDEX_FOLDER_ID**: Find in Yandex Cloud Console (in the URL or folder page)

## Running

```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## Usage

1. Start the bot with `/start` command
2. Ask any question (e.g., "What is quantum physics?", "Explain machine learning", "Write a poem about AI")
3. Receive three responses from different models
4. Compare quality, speed, and cost

Each response shows:
- ⏱️ **Response time** in seconds
- 📊 **Token count** (input + output)
- 💰 **Cost** (free for HuggingFace models, ~₽0.04/1K tokens for Yandex)

## Commands

- `/start` - Welcome message and instructions
- `/help` - Show help

## Models

- **SmolLM3-3B** - Free open-source model via HuggingFace Inference Router
- **Arch-Router-1.5B** - Free routing model via HuggingFace Inference Router
- **YandexGPT 5 Lite** - Paid commercial model from Yandex Cloud

