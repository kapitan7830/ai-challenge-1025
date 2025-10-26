import dotenv from 'dotenv';
import { Telegraf } from 'telegraf';
import pino from 'pino';
import { WebParser } from './utils/webParser.js';
import { AnimalDetectorAgent } from './agents/animalDetectorAgent.js';
import { ZoologistAgent } from './agents/zoologistAgent.js';
import { PerplexitySearch } from './services/perplexitySearch.js';

dotenv.config();

// Логгер
const logger = pino({
  level: process.env.LOG_LEVEL || 'info'
});

// Инициализация бота
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Хранение состояний пользователей
const userStates = new Map();

// Константы состояний
const STATE = {
  IDLE: 'idle',
  WAITING_FOR_URL: 'waiting_for_url',
  SELECTING_ANIMAL_FROM_ARTICLE: 'selecting_animal_from_article',
  WAITING_FOR_ANIMAL_NAME: 'waiting_for_animal_name'
};

// Получить или создать состояние пользователя
function getUserState(chatId) {
  if (!userStates.has(chatId)) {
    userStates.set(chatId, {
      state: STATE.IDLE,
      animals: [],
      processedAnimals: []
    });
  }
  return userStates.get(chatId);
}

// Отправка сообщения с обработкой ошибок
async function safeSendMessage(ctx, text, options = {}) {
  try {
    await ctx.reply(text, options);
  } catch (error) {
    logger.error({ error: error.message, chatId: ctx.chat.id }, 'Failed to send message');
  }
}

// Команда /start
bot.command('start', async (ctx) => {
  const chatId = ctx.chat.id;
  logger.info({ chatId, username: ctx.from.username }, 'User started bot');
  
  const userState = getUserState(chatId);
  userState.state = STATE.IDLE;
  
  await safeSendMessage(
    ctx,
    '👋 Привет! Я бот для анализа информации о животных.\n\n' +
    'Выберите команду:\n' +
    '/article - Анализ животных из статьи по ссылке\n' +
    '/animal - Получить информацию о конкретном животном\n\n' +
    '/reset - Вернуться в главное меню'
  );
});

// Команда /reset
bot.command('reset', async (ctx) => {
  const chatId = ctx.chat.id;
  logger.info({ chatId }, 'User reset state');
  
  const userState = getUserState(chatId);
  userState.state = STATE.IDLE;
  userState.animals = [];
  userState.processedAnimals = [];
  
  await safeSendMessage(
    ctx,
    '🔄 Состояние сброшено.\n\n' +
    'Выберите команду:\n' +
    '/article - Анализ животных из статьи по ссылке\n' +
    '/animal - Получить информацию о конкретном животном'
  );
});

// Команда /article
bot.command('article', async (ctx) => {
  const chatId = ctx.chat.id;
  logger.info({ chatId }, 'User selected article command');
  
  const userState = getUserState(chatId);
  userState.state = STATE.WAITING_FOR_URL;
  userState.animals = [];
  userState.processedAnimals = [];
  
  await safeSendMessage(ctx, '📎 Отправьте ссылку на статью для анализа:');
});

// Команда /animal
bot.command('animal', async (ctx) => {
  const chatId = ctx.chat.id;
  logger.info({ chatId }, 'User selected animal command');
  
  const userState = getUserState(chatId);
  userState.state = STATE.WAITING_FOR_ANIMAL_NAME;
  userState.animals = [];
  userState.processedAnimals = [];
  
  await safeSendMessage(ctx, '🦁 Введите название животного:');
});

// Обработка текстовых сообщений
bot.on('text', async (ctx) => {
  const chatId = ctx.chat.id;
  const text = ctx.message.text;
  
  // Игнорируем команды
  if (text && text.startsWith('/')) {
    return;
  }
  
  const userState = getUserState(chatId);
  
  try {
    // Обработка URL для статьи
    if (userState.state === STATE.WAITING_FOR_URL) {
      await handleArticleUrl(ctx, text, userState);
    }
    // Выбор животного из списка (статья)
    else if (userState.state === STATE.SELECTING_ANIMAL_FROM_ARTICLE) {
      await handleAnimalSelection(ctx, text, userState);
    }
    // Ввод названия животного
    else if (userState.state === STATE.WAITING_FOR_ANIMAL_NAME) {
      await handleAnimalName(ctx, text, userState);
    }
    
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack, chatId }, 'Error processing message');
    await safeSendMessage(
      ctx,
      '❌ Возникла ошибка, попробуйте позже.'
    );
  }
});

// Обработка URL статьи
async function handleArticleUrl(ctx, url, userState) {
  const chatId = ctx.chat.id;
  logger.info({ chatId, url }, 'Processing article URL');
  
  await safeSendMessage(ctx, '⏳ Загружаю страницу...');
  
  try {
    // Парсим страницу
    const parser = new WebParser();
    const pageText = await parser.fetchText(url);
    
    if (!pageText || pageText.trim().length === 0) {
      await safeSendMessage(ctx, '❌ Не удалось извлечь текст со страницы\n\n📎 Отправьте другую ссылку на статью для анализа:');
      userState.state = STATE.WAITING_FOR_URL;
      return;
    }
    
    await safeSendMessage(ctx, `✅ Текст получен: ${pageText.length} символов`);
    
    // Ищем животных
    await safeSendMessage(ctx, '🔍 Анализирую текст на упоминания животных...');
    
    const detector = new AnimalDetectorAgent();
    const animals = await detector.findAnimals(pageText);
    
    if (!animals || animals.length === 0) {
      await safeSendMessage(ctx, '❌ Животные не найдены в тексте\n\n📎 Отправьте другую ссылку на статью для анализа:');
      userState.state = STATE.WAITING_FOR_URL;
      return;
    }
    
    // Сохраняем список животных
    userState.animals = animals;
    userState.state = STATE.SELECTING_ANIMAL_FROM_ARTICLE;
    
    // Формируем список
    let message = `✅ Найдено животных: ${animals.length}\n\n`;
    animals.forEach((animal, index) => {
      message += `${index + 1}. ${animal.name}\n`;
    });
    message += '\n📝 Введите номер животного для получения подробной информации:';
    
    await safeSendMessage(ctx, message);
    
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack, chatId }, 'Error handling article URL');
    await safeSendMessage(ctx, '❌ Возникла ошибка при обработке статьи, попробуйте позже.\n\n📎 Отправьте другую ссылку на статью для анализа:');
    userState.state = STATE.WAITING_FOR_URL;
  }
}

// Обработка выбора животного из списка
async function handleAnimalSelection(ctx, text, userState) {
  const chatId = ctx.chat.id;
  const selectedNumber = parseInt(text);
  
  if (isNaN(selectedNumber) || selectedNumber < 1 || selectedNumber > userState.animals.length) {
    await safeSendMessage(ctx, '❌ Неверный номер. Введите число от 1 до ' + userState.animals.length);
    return;
  }
  
  const animal = userState.animals[selectedNumber - 1];
  logger.info({ chatId, animalName: animal.name }, 'User selected animal from article');
  
  // Получаем информацию о животном
  await getAnimalInfo(ctx, animal, userState);
  
  // Отмечаем животное как обработанное
  userState.processedAnimals.push(selectedNumber - 1);
  
  // Предлагаем выбрать еще животное
  const remainingAnimals = userState.animals.filter((_, index) => !userState.processedAnimals.includes(index));
  
  if (remainingAnimals.length > 0) {
    let message = '\n📋 Оставшиеся животные:\n\n';
    userState.animals.forEach((animal, index) => {
      if (!userState.processedAnimals.includes(index)) {
        message += `${index + 1}. ${animal.name}\n`;
      }
    });
    message += '\n📝 Введите номер для получения информации или /reset для возврата в меню:';
    
    await safeSendMessage(ctx, message);
  } else {
    await safeSendMessage(
      ctx,
      '✅ Все животные обработаны!\n\nИспользуйте /reset для возврата в меню.'
    );
    userState.state = STATE.IDLE;
  }
}

// Обработка названия животного (команда /animal)
async function handleAnimalName(ctx, animalName, userState) {
  const chatId = ctx.chat.id;
  logger.info({ chatId, animalName }, 'User entered animal name');
  
  try {
    // Проверяем, является ли это животным
    await safeSendMessage(ctx, '🔍 Проверяю запрос...');
    
    const detector = new AnimalDetectorAgent();
    const isAnimal = await detector.validateAnimalName(animalName);
    
    if (!isAnimal) {
      logger.info({ chatId, animalName }, 'Invalid animal name entered');
      await safeSendMessage(
        ctx,
        '❌ Запрос не является названием животного.\n\n' +
        'Пожалуйста, введите корректное название животного (например: "слон", "кошка", "велоцираптор") или /reset для возврата в меню.'
      );
      return;
    }
    
    const animal = {
      name: animalName,
      context: 'Запрос пользователя'
    };
    
    await getAnimalInfo(ctx, animal, userState);
    
    // Предлагаем ввести еще животное
    await safeSendMessage(
      ctx,
      '\n🦁 Введите название другого животного или /reset для возврата в меню:'
    );
    
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack, chatId, animalName }, 'Error validating animal name');
    await safeSendMessage(ctx, '❌ Возникла ошибка при проверке запроса, попробуйте позже.\n\n🦁 Введите название животного или /reset для возврата в меню:');
    userState.state = STATE.WAITING_FOR_ANIMAL_NAME;
  }
}

// Получение информации о животном через Perplexity и агента-зоолога
async function getAnimalInfo(ctx, animal, userState) {
  const chatId = ctx.chat.id;
  try {
    await safeSendMessage(ctx, `🔍 Ищу информацию о: ${animal.name}...`);
    
    // Поиск через Perplexity
    const perplexity = new PerplexitySearch();
    const query = `${animal.name} - морфология, биохимия, поведение, ареал обитания`;
    
    const searchResults = await perplexity.search(query, {
      max_results: 5,
      max_tokens_per_page: 2048,
      country: 'RU'
    });
    
    logger.info({ 
      chatId, 
      animalName: animal.name,
      resultsCount: searchResults?.results?.length || 0,
      hasResults: !!(searchResults && searchResults.results)
    }, 'Perplexity search completed');
    
    await safeSendMessage(ctx, '✅ Информация из источников получена');
    
    // Анализ через агента-зоолога
    await safeSendMessage(ctx, '🔬 Анализирую информацию...');
    
    const animalWithInfo = {
      ...animal,
      perplexityResults: searchResults
    };
    
    const zoologist = new ZoologistAgent();
    const report = await zoologist.analyzeAnimal(animalWithInfo);
    
    // Форматируем результат
    let message = `📊 *Научная справка о: ${report.animal || animal.name}*\n\n`;
    
    if (report.error) {
      message += `❌ Ошибка: ${report.error}`;
    } else {
      message += `📝 *Описание:*\n${report.description || 'Информации нет'}\n\n`;
      message += `🧬 *Морфофизиология:*\n${report.morphophysiology || 'Информации нет'}\n\n`;
      message += `🐾 *Поведение:*\n${report.behavior || 'Информации нет'}\n\n`;
      message += `🌍 *Ареал обитания:*\n${report.habitat || 'Информации нет'}`;
    }
    
    await safeSendMessage(ctx, message, { parse_mode: 'Markdown' });
    
    logger.info({ chatId, animalName: animal.name }, 'Successfully processed animal info');
    
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack, chatId, animalName: animal.name }, 'Error getting animal info');
    await safeSendMessage(ctx, '❌ Возникла ошибка при получении информации, попробуйте позже.');
  }
}

// Обработка ошибок
bot.catch((err, ctx) => {
  logger.error({ error: err.message, stack: err.stack, chatId: ctx.chat?.id }, 'Bot error');
});

// Graceful shutdown
process.once('SIGINT', () => {
  logger.info('Bot stopping...');
  bot.stop('SIGINT');
});

process.once('SIGTERM', () => {
  logger.info('Bot stopping...');
  bot.stop('SIGTERM');
});

// Запуск бота
bot.launch();
logger.info('Bot started successfully');

