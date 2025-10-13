import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import { CharacterAnalyzerAgent } from './agents/CharacterAnalyzerAgent.js';
import { TextSummarizer } from './utils/TextSummarizer.js';
import { TokenCounter } from './utils/TokenCounter.js';

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const analyzer = new CharacterAnalyzerAgent();
const summarizer = new TextSummarizer();

// Хранилище сессий пользователей
const userSessions = new Map();

const WELCOME_MESSAGE = `🎭 Анализатор персонажей рассказов

Я анализирую тексты и нахожу всех персонажей с их характеристиками и психологическими портретами.

📝 Как использовать:

1️⃣ /start - начать новую сессию
2️⃣ Отправь мне текст рассказа (можно несколькими сообщениями)
3️⃣ /finish - завершить ввод и начать анализ
4️⃣ /cancel - отменить текущую сессию

💡 Я работаю с длинными текстами! Если текст превышает лимит модели (8000 токенов), я автоматически разобью его на части, суммаризирую и проанализирую.

📊 Вы увидите полную статистику: токены, время работы, степень сжатия текста.

Готов работать! 🚀`;

// Команда /start
bot.start(async (ctx) => {
  const userId = ctx.from.id;
  
  // Создаем новую сессию
  userSessions.set(userId, {
    messages: [],
    startTime: Date.now(),
    active: true,
  });

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🆕 Новая сессия: ${ctx.from.username || ctx.from.id}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  await ctx.reply(WELCOME_MESSAGE);
  await ctx.reply('✅ Сессия начата! Отправляй текст рассказа. Когда закончишь - нажми /finish');
});

// Команда /help
bot.help(async (ctx) => {
  await ctx.reply(WELCOME_MESSAGE);
});

// Команда /cancel
bot.command('cancel', async (ctx) => {
  const userId = ctx.from.id;
  const session = userSessions.get(userId);

  if (!session || !session.active) {
    await ctx.reply('❌ Нет активной сессии. Используй /start для начала.');
    return;
  }

  userSessions.delete(userId);
  console.log(`🚫 Сессия отменена: ${ctx.from.username || ctx.from.id}`);

  await ctx.reply('❌ Сессия отменена. Используй /start для новой сессии.');
});

// Команда /finish
bot.command('finish', async (ctx) => {
  const userId = ctx.from.id;
  const session = userSessions.get(userId);

  if (!session || !session.active) {
    await ctx.reply('❌ Нет активной сессии. Используй /start для начала.');
    return;
  }

  if (session.messages.length === 0) {
    await ctx.reply('❌ Ты не отправил ни одного сообщения. Сначала отправь текст рассказа.');
    return;
  }

  // Деактивируем сессию
  session.active = false;

  try {
    await ctx.sendChatAction('typing');
    
    console.log(`\n🎬 Начинаю обработку сессии: ${ctx.from.username || ctx.from.id}`);
    
    // Объединяем все сообщения
    const fullText = session.messages.join('\n\n');
    const originalTokens = TokenCounter.estimate(fullText);
    const originalLength = fullText.length;

    console.log(`📏 Длина текста: ${originalLength} символов`);
    console.log(`📊 Оценка токенов: ${originalTokens}`);

    await ctx.reply(`🎬 Начинаю анализ!

📊 Статистика входного текста:
━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 Сообщений: ${session.messages.length}
📏 Символов: ${originalLength.toLocaleString()}
📊 Токенов (оценка): ${originalTokens.toLocaleString()}
━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    let textToAnalyze = fullText;
    let summarizationStats = null;

    // Проверяем, нужна ли суммаризация
    const needsSummarization = TokenCounter.exceedsLimit(fullText, 6000);

    if (needsSummarization) {
      await ctx.reply('⚠️ Текст превышает рекомендуемый лимит!\n\n🔄 Запускаю процесс суммаризации...');
      
      // Суммаризируем текст
      const summaryResult = await summarizer.summarize(fullText);
      textToAnalyze = summaryResult.summary;
      summarizationStats = summaryResult;

      // Отправляем статистику по суммаризации
      const summaryMessage = `✅ Суммаризация завершена!

📊 Статистика суммаризации:
━━━━━━━━━━━━━━━━━━━━━━━━━━
✂️  Частей текста: ${summaryResult.chunks.length}
📉 Сжатие: ${originalTokens.toLocaleString()} → ${summaryResult.summaryTokens.toLocaleString()} токенов
📊 Коэффициент: ${(summaryResult.compressionRatio * 100).toFixed(1)}%
⏱️  Время: ${summaryResult.totalTime.toFixed(2)}с

💰 Стоимость суммаризации:
   ${TokenCounter.formatUsage(summaryResult.totalUsage)}
   ~${TokenCounter.estimateCost(summaryResult.totalUsage.total_tokens)}₽

━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      await ctx.reply(summaryMessage);

      // Детализация по каждой части
      if (summaryResult.chunks.length > 1) {
        let chunksDetail = '📋 Детализация по частям:\n\n';
        summaryResult.chunks.forEach((chunk) => {
          chunksDetail += `📄 Часть ${chunk.chunkIndex + 1}:
   📊 ${chunk.originalTokens} → ${chunk.summaryTokens} токенов
   📉 Сжатие: ${((1 - chunk.summaryTokens / chunk.originalTokens) * 100).toFixed(1)}%
   ⏱️  ${chunk.responseTime.toFixed(2)}с
   💰 ${chunk.usage.total_tokens} токенов (~${TokenCounter.estimateCost(chunk.usage.total_tokens)}₽)

`;
        });
        await ctx.reply(chunksDetail);
      }
    }

    // Анализируем персонажей
    await ctx.sendChatAction('typing');
    await ctx.reply('🎭 Анализирую персонажей...');

    const analysisResult = await analyzer.analyzeCharacters(textToAnalyze);

    // Формируем итоговый ответ
    const totalTime = ((Date.now() - session.startTime) / 1000).toFixed(2);

    if (analysisResult.noCharactersFound) {
      await ctx.reply(`❌ Персонажи не найдены!

🤔 В предоставленном тексте не обнаружено персонажей. 
Возможно, это:
• Описание природы/пейзажа
• Техническая статья
• Философский текст без действующих лиц

📊 Статистика анализа:
━━━━━━━━━━━━━━━━━━━━━━━━━━
⏱️  Время анализа: ${analysisResult.responseTime.toFixed(2)}с
${TokenCounter.formatUsage(analysisResult.usage)}
💰 Стоимость: ~${TokenCounter.estimateCost(analysisResult.usage.total_tokens)}₽
━━━━━━━━━━━━━━━━━━━━━━━━━━

⏱️  Общее время: ${totalTime}с`);
    } else {
      await ctx.reply(`🎭 Анализ персонажей завершен!

${analysisResult.analysis}

━━━━━━━━━━━━━━━━━━━━━━━━━━`);

      // Итоговая статистика
      let totalTokensUsed = analysisResult.usage.total_tokens;
      let totalCost = TokenCounter.estimateCost(totalTokensUsed);

      if (summarizationStats) {
        totalTokensUsed += summarizationStats.totalUsage.total_tokens;
        totalCost = TokenCounter.estimateCost(totalTokensUsed);
      }

      const statsMessage = `📊 Итоговая статистика:
━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 Исходный текст: ${originalLength.toLocaleString()} символов, ${originalTokens.toLocaleString()} токенов
${summarizationStats ? `🔄 Суммаризация: ${summarizationStats.chunks.length} частей, ${summarizationStats.totalUsage.total_tokens} токенов` : '✅ Суммаризация не требовалась'}
🎭 Анализ: ${analysisResult.usage.total_tokens} токенов
⏱️  Общее время: ${totalTime}с

💰 Общая стоимость:
   📊 Всего токенов: ${totalTokensUsed.toLocaleString()}
   💵 Примерная цена: ~${totalCost}₽
   
📱 Модель: ${analysisResult.model}
━━━━━━━━━━━━━━━━━━━━━━━━━━

✨ Готово! Используй /start для нового анализа.`;

      await ctx.reply(statsMessage);
    }

    // Удаляем сессию
    userSessions.delete(userId);
    console.log(`✅ Сессия завершена: ${ctx.from.username || ctx.from.id}\n`);

  } catch (error) {
    console.error('❌ Ошибка:', error);
    await ctx.reply(`❌ Произошла ошибка: ${error.message}\n\nИспользуй /start для новой попытки.`);
    userSessions.delete(userId);
  }
});

// Обработка текстовых сообщений
bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const text = ctx.message.text;

  // Пропускаем команды
  if (text.startsWith('/')) {
    return;
  }

  const session = userSessions.get(userId);

  if (!session || !session.active) {
    await ctx.reply('❌ Сессия не активна. Используй /start для начала.');
    return;
  }

  // Добавляем сообщение в сессию
  session.messages.push(text);
  
  const currentLength = session.messages.join('\n\n').length;
  const currentTokens = TokenCounter.estimate(session.messages.join('\n\n'));

  console.log(`📩 Сообщение получено от ${ctx.from.username || ctx.from.id}:`);
  console.log(`   📏 +${text.length} символов (всего: ${currentLength})`);
  console.log(`   📊 ~${currentTokens} токенов`);

  await ctx.reply(`✅ Принято! (${session.messages.length} сообщ., ~${currentTokens.toLocaleString()} токенов)

Продолжай отправлять текст или нажми /finish для анализа.`, {
    reply_parameters: { message_id: ctx.message.message_id }
  });
});

bot.launch();

console.log('🤖 Бот запущен!');
console.log('🎭 Анализатор персонажей');
console.log('📊 С подсчетом токенов и суммаризацией длинных текстов');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
