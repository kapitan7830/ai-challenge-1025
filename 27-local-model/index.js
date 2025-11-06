import { Telegraf } from 'telegraf';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Store conversation history per user
const conversations = new Map();

// Logging helper
function log(message, data = '') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`, data);
}

// Agent for OpenAI
async function getOpenAIResponse(messages) {
  log('📤 Отправка запроса в OpenAI...');
  const startTime = Date.now();
  
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: messages,
  });
  
  const duration = Date.now() - startTime;
  log(`✅ OpenAI ответил за ${duration}ms`);
  
  return completion.choices[0].message.content;
}

// Agent for Ollama
async function getOllamaResponse(messages) {
  log('📤 Отправка запроса в Ollama...');
  const startTime = Date.now();
  
  const response = await fetch('http://localhost:11434/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama3.2:3b',
      messages: messages,
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status}`);
  }

  const data = await response.json();
  const duration = Date.now() - startTime;
  log(`✅ Ollama ответил за ${duration}ms`);
  
  return data.message.content;
}

bot.start((ctx) => {
  log(`👤 Пользователь ${ctx.from.id} (@${ctx.from.username || 'unknown'}) запустил бота`);
  ctx.reply('Hey! Send me any message and I\'ll forward it to both OpenAI and Ollama.');
});

bot.help((ctx) => {
  log(`❓ Пользователь ${ctx.from.id} запросил помощь`);
  ctx.reply('Send me any text and I\'ll get responses from both OpenAI and Ollama.\nUse /clear to reset conversation history.');
});

bot.command('clear', (ctx) => {
  const userId = ctx.from.id;
  const historyLength = conversations.get(userId)?.length || 0;
  conversations.delete(userId);
  log(`🗑️  Пользователь ${userId} очистил историю (было ${historyLength} сообщений)`);
  ctx.reply('Conversation history cleared!');
});

bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const userMessage = ctx.message.text;
  const username = ctx.from.username || 'unknown';

  log(`💬 Получено сообщение от ${userId} (@${username}): "${userMessage.substring(0, 50)}${userMessage.length > 50 ? '...' : ''}"`);

  // Get or initialize conversation history
  if (!conversations.has(userId)) {
    conversations.set(userId, []);
    log(`📝 Создана новая история для пользователя ${userId}`);
  }
  const history = conversations.get(userId);

  // Add user message to history
  history.push({ role: 'user', content: userMessage });
  log(`📊 История: ${history.length} сообщений`);

  try {
    // Show typing indicator
    await ctx.sendChatAction('typing');

    // Send to both OpenAI and Ollama in parallel
    log('🚀 Запуск параллельных запросов к OpenAI и Ollama...');
    const startTime = Date.now();
    
    const [openaiResponse, ollamaResponse] = await Promise.allSettled([
      getOpenAIResponse(history),
      getOllamaResponse(history),
    ]);

    const totalDuration = Date.now() - startTime;
    log(`⏱️  Общее время обработки: ${totalDuration}ms`);

    // Handle OpenAI response
    if (openaiResponse.status === 'fulfilled') {
      log(`✉️  Отправка ответа OpenAI пользователю ${userId}`);
      await ctx.reply(`🤖 OpenAI (gpt-4o-mini):\n\n${openaiResponse.value}`);
    } else {
      log(`❌ Ошибка OpenAI для ${userId}:`, openaiResponse.reason.message);
      await ctx.reply('❌ OpenAI: Error getting response');
    }

    // Handle Ollama response
    if (ollamaResponse.status === 'fulfilled') {
      log(`✉️  Отправка ответа Ollama пользователю ${userId}`);
      await ctx.reply(`🦙 Ollama (llama3.2:3b):\n\n${ollamaResponse.value}`);
    } else {
      log(`❌ Ошибка Ollama для ${userId}:`, ollamaResponse.reason.message);
      await ctx.reply('❌ Ollama: Error getting response (is Ollama running?)');
    }

    // Add assistant response to history (using OpenAI's response if available)
    if (openaiResponse.status === 'fulfilled') {
      history.push({ role: 'assistant', content: openaiResponse.value });
    }

    // Keep only last 20 messages to avoid token limits
    if (history.length > 20) {
      const removed = history.length - 20;
      history.splice(0, removed);
      log(`🧹 Очищено ${removed} старых сообщений из истории`);
    }
    
    log(`✅ Обработка завершена для ${userId}`);
  } catch (error) {
    log(`🚨 Критическая ошибка для ${userId}:`, error.message);
    console.error('Error:', error);
    ctx.reply('Sorry, something went wrong. Please try again.');
  }
});

bot.launch();

log('🚀 Бот успешно запущен и готов к работе');
log('📡 Ожидание сообщений...');

// Enable graceful stop
process.once('SIGINT', () => {
  log('⚠️  Получен сигнал SIGINT, останавливаем бота...');
  bot.stop('SIGINT');
});
process.once('SIGTERM', () => {
  log('⚠️  Получен сигнал SIGTERM, останавливаем бота...');
  bot.stop('SIGTERM');
});

