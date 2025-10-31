import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
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
const ragAgent = new RagAgent(OPENAI_API_KEY);

// Приветственное сообщение
const welcomeMessage = `🔍 Привет! Я бот для поиска информации в базе знаний.

Просто отправь мне вопрос, и я найду ответ в документах!`;

// Команда /start
bot.start((ctx) => {
  logger.info(`Пользователь запустил бота`);
  ctx.reply(welcomeMessage);
});

// Команда /help
bot.help((ctx) => {
  ctx.reply(welcomeMessage);
});

// Обработка текстовых сообщений
bot.on('text', async (ctx) => {
  const userQuery = ctx.message.text;

  // Пропускаем команды
  if (userQuery.startsWith('/')) {
    return;
  }

  logger.info(`Получен запрос: "${userQuery}"`);

  try {
    await ctx.reply('🔍 Ищу информацию в базе данных...');

    const result = await ragAgent.searchInformationRanked(userQuery);

    if (result.found) {
      logger.success(`Информация найдена`);
      
      // Формируем ответ с источником и цитатой
      let responseText = `${result.content}\n\n`;
      responseText += `📄 Источник: ${result.source.filename}\n`;
      responseText += `📝 Цитата:\n"${result.source.quote}"`;
      
      await ctx.reply(responseText);
    } else {
      logger.info(`Информация не найдена`);
      await ctx.reply('😔 Информация не найдена в базе данных.\n\nПопробуйте уточнить запрос.');
    }
  } catch (error) {
    logger.error(`Ошибка при обработке запроса:`, error);
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
logger.info('🤖 Запуск Telegram бота для поиска информации');
logger.separator();

bot.launch().then(() => {
  logger.success('✅ Бот успешно запущен и готов к работе');
  logger.info('Нажмите Ctrl+C для остановки бота');
});

// Graceful shutdown
process.once('SIGINT', () => {
  logger.info('Получен сигнал SIGINT, останавливаю бота...');
  ragAgent.close();
  bot.stop('SIGINT');
});

process.once('SIGTERM', () => {
  logger.info('Получен сигнал SIGTERM, останавливаю бота...');
  ragAgent.close();
  bot.stop('SIGTERM');
});

