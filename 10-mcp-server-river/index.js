import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import { RiverLevelAgent } from './agents/RiverLevelAgent.js';

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const agent = new RiverLevelAgent();

const WELCOME_MESSAGE = `🌊 Бот-помощник по гидрологии и погоде

Я могу общаться на темы:
• 💧 Гидрология и уровень воды в реках
• 🌦️ Погода и климат
• 🌍 Природные явления
• 📊 Прогнозы и тренды

Особая возможность:
Я могу получить текущие данные об уровне воды в Сростках, Бийске и Барнауле.

📝 Примеры вопросов:
• "Что там по уровню воды в Сростках?"
• "Какой сейчас уровень в Барнауле?"
• "Как погода влияет на уровень воды?"
• "Что такое гидрологический прогноз?"

Готов к общению! 🚀`;

/**
 * Проверяет, нужны ли конкретные данные об уровне воды из MCP
 */
function needsRiverLevelData(text) {
  const lower = text.toLowerCase();
  
  // Должен упоминаться один из городов
  const cities = ['сростк', 'бийск', 'барнаул'];
  const hasCityMention = cities.some(city => lower.includes(city));
  
  if (!hasCityMention) {
    return false;
  }
  
  // И должен быть вопрос про текущий уровень/состояние
  const levelKeywords = [
    'уров', 'сейчас', 'текущ', 'актуальн',
    'что там', 'как там', 'какой',
    'растёт', 'падает', 'поднялась', 'опустилась',
    'см', 'сантиметр', 'данные', 'прогноз'
  ];
  
  const hasLevelQuestion = levelKeywords.some(keyword => lower.includes(keyword));
  
  return hasCityMention && hasLevelQuestion;
}

/**
 * Общается с пользователем через YandexGPT на общие темы
 */
async function chatWithUser(userMessage) {
  const systemPrompt = `Ты - дружелюбный эксперт по гидрологии, метеорологии и природным явлениям.

Ты можешь:
- Объяснять гидрологические процессы
- Рассказывать о влиянии погоды на реки
- Обсуждать климатические явления
- Давать общую информацию о природе

Ты НЕ можешь (без специальных данных):
- Предоставлять точные текущие данные об уровне воды
- Давать точные прогнозы погоды

Если пользователь спрашивает конкретно про уровень воды в Сростках, Бийске или Барнауле - 
напомни, что для этого нужно спросить: "Какой уровень воды в [город]?"

Отвечай на русском, будь кратким и информативным (не более 5-7 предложений).`;

  const response = await fetch(
    'https://llm.api.cloud.yandex.net/foundationModels/v1/completion',
    {
      method: 'POST',
      headers: {
        'Authorization': `Api-Key ${process.env.YANDEX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        modelUri: `gpt://${process.env.YANDEX_FOLDER_ID}/yandexgpt-lite/latest`,
        completionOptions: {
          stream: false,
          temperature: 0.7,
          maxTokens: 1000,
        },
        messages: [
          {
            role: 'system',
            text: systemPrompt,
          },
          {
            role: 'user',
            text: userMessage,
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Yandex API error: ${error}`);
  }

  const result = await response.json();
  return {
    answer: result.result.alternatives[0].message.text,
    usage: {
      prompt_tokens: result.result.usage.inputTextTokens,
      completion_tokens: result.result.usage.completionTokens,
      total_tokens: result.result.usage.totalTokens,
    },
  };
}

// Команда /start
bot.start(async (ctx) => {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🆕 Новый пользователь: ${ctx.from.username || ctx.from.id}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  await ctx.reply(WELCOME_MESSAGE);
});

// Команда /help
bot.help(async (ctx) => {
  await ctx.reply(WELCOME_MESSAGE);
});

// Обработка текстовых сообщений
bot.on('text', async (ctx) => {
  const text = ctx.message.text;

  // Пропускаем команды
  if (text.startsWith('/')) {
    return;
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`❓ Сообщение от ${ctx.from.username || ctx.from.id}: ${text}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  try {
    await ctx.sendChatAction('typing');
    
    // Проверяем, нужны ли конкретные данные об уровне воды
    const needsData = needsRiverLevelData(text);
    console.log(`🔍 Требуется MCP агент: ${needsData ? 'ДА' : 'НЕТ'}`);
    
    if (needsData) {
      // Вызываем MCP агента для получения актуальных данных
      console.log(`📡 Вызов MCP агента...`);
      const result = await agent.analyzeWaterLevel(text);

      let responseText = `${result.answer}`;
      
      // Добавляем статистику если данные были получены
      if (result.dataFetched) {
        responseText += `

━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Статистика:
⏱️  Время: ${result.responseTime.toFixed(2)}с
📊 Токены: ${result.usage.total_tokens}
🤖 Модель: ${result.model}
🕐 Данные от: ${new Date(result.timestamp).toLocaleString('ru-RU')}
━━━━━━━━━━━━━━━━━━━━━━━━━━`;
      }

      await ctx.reply(responseText);
      console.log(`✅ Ответ с данными отправлен\n`);
      
    } else {
      // Общаемся на общие темы
      console.log(`💬 Общение на общие темы...`);
      const result = await chatWithUser(text);
      
      await ctx.reply(result.answer);
      console.log(`✅ Ответ отправлен (${result.usage.total_tokens} токенов)\n`);
    }

  } catch (error) {
    console.error('❌ Ошибка:', error);
    await ctx.reply(`❌ Произошла ошибка: ${error.message}\n\nПопробуй ещё раз.`);
  }
});

// Запускаем бота
bot.launch();

console.log('🤖 Бот запущен!');
console.log('🌊 Помощник по гидрологии и погоде');
console.log('📊 С поддержкой MCP для данных об уровне воды');
console.log('💬 Умею общаться на общие темы');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Graceful shutdown
process.once('SIGINT', async () => {
  await agent.close();
  bot.stop('SIGINT');
});
process.once('SIGTERM', async () => {
  await agent.close();
  bot.stop('SIGTERM');
});
