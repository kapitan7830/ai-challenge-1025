import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import { SearchingAgent } from './services/searchingAgent.js';
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
const searchingAgent = new SearchingAgent(OPENAI_API_KEY);
const ragAgent = new RagAgent(OPENAI_API_KEY);

// Хранилище режимов пользователей
const userModes = new Map(); // userId -> 'normal' | 'rag' | 'ranked'

// Приветственное сообщение
const welcomeMessage = `🔍 Привет! Я бот для поиска информации.

📍 Режимы работы:
• Обычный режим - поиск через GPT-4o-mini
• /rag - переключение на поиск по базе данных (RAG)
• /ranked - поиск с reranker и фильтром релевантности
• /reset - возврат в обычный режим

Просто отправь мне вопрос, и я постараюсь помочь!`;

// Команда /start
bot.start((ctx) => {
  const userId = ctx.from.id;
  userModes.set(userId, 'normal');
  logger.info(`Пользователь запустил бота`);
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
  logger.info(`Пользователь переключился на RAG режим`);
  ctx.reply(
    '🔄 Режим переключен на RAG (поиск в базе данных)\n\nТеперь я буду искать информацию в векторной базе данных.\n\nДля возврата в обычный режим используй /reset'
  );
});

// Команда /ranked - переключение на режим с reranker
bot.command('ranked', (ctx) => {
  const userId = ctx.from.id;
  userModes.set(userId, 'ranked');
  logger.info(`Пользователь переключился на ranked режим`);
  ctx.reply(
    '🔄 Режим переключен на Ranked (поиск с фильтром релевантности)\n\nТеперь я буду искать информацию в базе данных с фильтрацией по релевантности.\n\nДля возврата в обычный режим используй /reset'
  );
});

// Команда /reset - возврат в обычный режим
bot.command('reset', (ctx) => {
  const userId = ctx.from.id;
  userModes.set(userId, 'normal');
  logger.info(`Пользователь вернулся в обычный режим`);
  ctx.reply(
    '🔄 Режим переключен на обычный поиск (GPT-4o-mini)\n\nТеперь я буду искать информацию используя свои знания.\n\nДля переключения на другие режимы используй /rag или /ranked'
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

  logger.info(`Получен запрос (режим: ${mode}): "${userQuery}"`);

  try {
    // Отправляем сообщение о поиске
    let searchMessage;
    if (mode === 'rag') {
      searchMessage = '🔍 Ищу информацию в базе данных...';
    } else if (mode === 'ranked') {
      searchMessage = '🔍 Ищу информацию с фильтром релевантности...';
    } else {
      searchMessage = '🔍 Ищу информацию...';
    }
    await ctx.reply(searchMessage);

    // Выбираем обработчик в зависимости от режима
    let result;
    if (mode === 'ranked') {
      result = await ragAgent.searchInformationRanked(userQuery);
    } else if (mode === 'rag') {
      result = await ragAgent.searchInformation(userQuery);
    } else {
      result = await searchingAgent.searchInformation(userQuery);
    }

    if (result.found) {
      // Информация найдена - отправляем ответ
      logger.success(`Информация найдена (${mode})`);
      let responseText = result.content;
      
      // Добавляем статистику для ranked режима
      if (mode === 'ranked' && result.stats) {
        responseText += `\n\n📊 Статистика поиска:\n`;
        responseText += `• Найдено результатов: ${result.stats.initialResults}\n`;
        responseText += `• Прошло фильтр: ${result.stats.filteredResults}\n`;
        responseText += `• Использовано: ${result.stats.finalResults}\n`;
        responseText += `• Порог релевантности: ${result.stats.threshold}`;
      }
      
      await ctx.reply(responseText);
    } else {
      // Информация не найдена
      logger.info(`Информация не найдена (${mode})`);
      let notFoundMessage;
      if (mode === 'rag') {
        notFoundMessage = '😔 Информация не найдена в базе данных.\n\nПопробуйте уточнить запрос или используйте /reset для переключения на обычный поиск.';
      } else if (mode === 'ranked') {
        notFoundMessage = '😔 Информация не найдена в базе данных с учетом фильтра релевантности.\n\nПопробуйте уточнить запрос или используйте /reset для переключения на обычный поиск.';
      } else {
        notFoundMessage = '😔 Информация не найдена.\n\nПопробуйте уточнить запрос или используйте /rag или /ranked для поиска в базе данных.';
      }
      await ctx.reply(notFoundMessage);
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
  searchingAgent.close();
  ragAgent.close();
  bot.stop('SIGINT');
});

process.once('SIGTERM', () => {
  logger.info('Получен сигнал SIGTERM, останавливаю бота...');
  searchingAgent.close();
  ragAgent.close();
  bot.stop('SIGTERM');
});

