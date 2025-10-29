import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import { LyricsAgent } from './services/lyricsAgent.js';
import { RagAgent } from './services/ragAgent.js';
import { logger } from './utils/logger.js';

dotenv.config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!BOT_TOKEN) {
  logger.error('Не найден TELEGRAM_BOT_TOKEN в переменных окружения');
  process.exit(1);
}

if (!OPENAI_API_KEY) {
  logger.error('Не найден OPENAI_API_KEY в переменных окружения');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const lyricsAgent = new LyricsAgent(OPENAI_API_KEY);
const ragAgent = new RagAgent(OPENAI_API_KEY);

// Хранилище режимов пользователей (обычный/rag)
const userModes = new Map(); // userId -> 'normal' | 'rag'

// Приветственное сообщение
const welcomeMessage = `🎵 Привет! Я бот для поиска текстов песен.

Я умею находить тексты песен по:
• Названию песни
• Имени исполнителя
• Отрывку из текста

📍 Режимы работы:
• Обычный режим - поиск через GPT-4o-mini
• /rag - переключение на поиск по базе данных (RAG)
• /reset - возврат в обычный режим

Просто отправь мне информацию о песне, и я постараюсь помочь!`;

// Команда /start
bot.start((ctx) => {
  const userId = ctx.from.id;
  userModes.set(userId, 'normal');
  logger.info(`Пользователь ${userId} запустил бота`);
  ctx.reply(welcomeMessage);
});

// Команда /help
bot.help((ctx) => {
  ctx.reply(welcomeMessage);
});

// Команда /rag - переключение на RAG режим
bot.command('rag', (ctx) => {
  const userId = ctx.from.id;
  userModes.set(userId, 'rag');
  logger.info(`Пользователь ${userId} переключился на RAG режим`);
  ctx.reply(
    '🔄 Режим переключен на RAG (поиск в базе данных)\n\nТеперь я буду искать тексты песен в векторной базе данных.\n\nДля возврата в обычный режим используй /reset'
  );
});

// Команда /reset - возврат в обычный режим
bot.command('reset', (ctx) => {
  const userId = ctx.from.id;
  userModes.set(userId, 'normal');
  logger.info(`Пользователь ${userId} вернулся в обычный режим`);
  ctx.reply(
    '🔄 Режим переключен на обычный поиск (GPT-4o-mini)\n\nТеперь я буду искать тексты песен используя свои знания.\n\nДля переключения на RAG используй /rag'
  );
});

// Обработка текстовых сообщений
bot.on('text', async (ctx) => {
  const userQuery = ctx.message.text;
  const userId = ctx.from.id;

  // Пропускаем команды
  if (userQuery.startsWith('/')) {
    return;
  }

  // Определяем режим пользователя (по умолчанию - обычный)
  const mode = userModes.get(userId) || 'normal';

  logger.info(`Получен запрос от ${userId} (режим: ${mode}): "${userQuery}"`);

  try {
    // Отправляем сообщение о поиске
    const searchMessage =
      mode === 'rag'
        ? '🔍 Ищу текст песни в базе данных...'
        : '🔍 Ищу текст песни...';
    await ctx.reply(searchMessage);

    // Выбираем агента в зависимости от режима
    const agent = mode === 'rag' ? ragAgent : lyricsAgent;
    const result = await agent.findLyrics(userQuery);

    if (result.found) {
      // Песня найдена - отправляем текст
      logger.success(`Текст найден для пользователя ${userId} (${mode})`);
      await ctx.reply(result.lyrics);
    } else {
      // Песня не найдена
      logger.info(`Текст не найден для пользователя ${userId} (${mode})`);
      const notFoundMessage =
        mode === 'rag'
          ? '😔 Текст песни не найден в базе данных.\n\nПопробуйте уточнить запрос или используйте /reset для переключения на обычный поиск.'
          : '😔 Текст песни не найден.\n\nВозможно, песня недостаточно известна или я не уверен в точности текста. Попробуйте уточнить запрос или используйте /rag для поиска в базе данных.';
      await ctx.reply(notFoundMessage);
    }
  } catch (error) {
    logger.error(`Ошибка при обработке запроса от ${userId}:`, error);
    await ctx.reply(
      '❌ Произошла ошибка при поиске. Попробуйте еще раз позже.'
    );
  }
});

// Обработка ошибок
bot.catch((err, ctx) => {
  logger.error('Ошибка в боте:', err);
  ctx.reply('❌ Произошла ошибка. Попробуйте еще раз позже.');
});

// Запуск бота
logger.separator();
logger.info('🤖 Запуск Telegram бота для поиска текстов песен');
logger.separator();

bot.launch().then(() => {
  logger.success('✅ Бот успешно запущен и готов к работе');
  logger.info('Нажмите Ctrl+C для остановки бота');
});

// Graceful shutdown
process.once('SIGINT', () => {
  logger.info('Получен сигнал SIGINT, останавливаю бота...');
  lyricsAgent.close();
  ragAgent.close();
  bot.stop('SIGINT');
});

process.once('SIGTERM', () => {
  logger.info('Получен сигнал SIGTERM, останавливаю бота...');
  lyricsAgent.close();
  ragAgent.close();
  bot.stop('SIGTERM');
});

