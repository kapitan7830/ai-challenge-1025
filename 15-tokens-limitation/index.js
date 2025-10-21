import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import { CharacterAnalyzerAgent } from './agents/CharacterAnalyzerAgent.js';
import { TokenCounter } from './utils/TokenCounter.js';
import { rateLimiter } from './utils/RateLimiter.js';
import { chunkProcessor } from './utils/ChunkProcessor.js';

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN, {
  handlerTimeout: 180000, // 3 минуты вместо 90 секунд
});
const analyzer = new CharacterAnalyzerAgent();

// Хранилище сессий пользователей
const userSessions = new Map();

// Константы для нового флоу
const MAX_TOKENS_PER_CHUNK = 2500; // лимит токенов на кусок (уменьшен для избежания timeout)
const MAX_MESSAGES_PER_CHUNK = 50; // максимум сообщений в одном куске

/**
 * Поддерживает "typing" статус во время длительной операции
 * @param {*} ctx - Telegraf context
 * @param {Promise} promise - Promise для ожидания
 * @param {number} interval - Интервал отправки typing (мс)
 * @returns {Promise} Результат promise
 */
async function withTypingIndicator(ctx, promise, interval = 5000) {
  let isComplete = false;
  
  // Запускаем периодическую отправку typing
  const typingInterval = setInterval(async () => {
    if (!isComplete) {
      try {
        await ctx.sendChatAction('typing');
      } catch (error) {
        // Игнорируем ошибки отправки typing
      }
    }
  }, interval);
  
  try {
    const result = await promise;
    isComplete = true;
    clearInterval(typingInterval);
    return result;
  } catch (error) {
    isComplete = true;
    clearInterval(typingInterval);
    throw error;
  }
}

const WELCOME_MESSAGE = `🎭 Анализатор персонажей рассказов

Я анализирую тексты и нахожу всех персонажей с их подробными характеристиками, отношениями и психологическими портретами.

📝 Как использовать:

1️⃣ /start - начать новую сессию
2️⃣ Отправь мне текст рассказа (можно несколькими сообщениями)
3️⃣ /finish - завершить ввод и начать анализ
4️⃣ /cancel - отменить текущую сессию
5️⃣ /stats - показать статистику rate limiting

💡 Новый флоу работы:
• Сообщения собираются в куски до лимита токенов (3000)
• При достижении лимита автоматически запускается суммаризация
• Саммари объединяются и снова суммаризируются для финального анализа
• Интеллектуальное разбиение: абзацы → предложения → символы
• Rate limiting: автоматическое управление лимитами OpenAI API

📊 Вы увидите полную статистику: токены, время работы, стоимость, степень сжатия.

Готов работать! 🚀`;

// Команда /start
bot.start(async (ctx) => {
  const userId = ctx.from.id;
  
  // Создаем новую сессию
  userSessions.set(userId, {
    messages: [],
    dossiers: [], // Массив досье из всех кусков
    startTime: Date.now(),
    active: true,
    isProcessing: false, // Флаг обработки куска
    pendingMessages: [], // Буфер сообщений во время обработки
    stats: {
      totalOriginalTokens: 0,
      totalOriginalLength: 0,
      chunksProcessed: 0,
      dossiersExtracted: [],
    },
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

// Команда /stats - показать статистику rate limiting
bot.command('stats', async (ctx) => {
  const gpt35Stats = rateLimiter.getStats('gpt-3.5-turbo');
  const gpt4Stats = rateLimiter.getStats('gpt-4');
  
  const statsMessage = `📊 Статистика Rate Limiting:

🤖 GPT-3.5-turbo:
   📝 Запросы: ${gpt35Stats.requests.current}/${gpt35Stats.requests.limit} (${gpt35Stats.requests.percentage}%)
   🎯 Токены: ${gpt35Stats.tokens.current.toLocaleString()}/${gpt35Stats.tokens.limit.toLocaleString()} (${gpt35Stats.tokens.percentage}%)

🚀 GPT-4:
   📝 Запросы: ${gpt4Stats.requests.current}/${gpt4Stats.requests.limit} (${gpt4Stats.requests.percentage}%)
   🎯 Токены: ${gpt4Stats.tokens.current.toLocaleString()}/${gpt4Stats.tokens.limit.toLocaleString()} (${gpt4Stats.tokens.percentage}%)

⏰ Окно: 1 минута
🔄 Автоочистка: включена`;

  await ctx.reply(statsMessage);
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

  // Если идет обработка, предупреждаем
  if (session.isProcessing) {
    await ctx.reply(`⏳ Подожди, идет обработка текущего куска. Попробуй через несколько секунд.`);
    return;
  }

  if (session.messages.length === 0 && session.stats.dossiersExtracted.length === 0) {
    await ctx.reply('❌ Ты не отправил ни одного сообщения. Сначала отправь текст рассказа.');
    return;
  }

  // Деактивируем сессию
  session.active = false;

  try {
    await ctx.sendChatAction('typing');
    
    console.log(`\n🎬 Начинаю обработку сессии: ${ctx.from.username || ctx.from.id}`);
    
    // Если есть необработанные сообщения, извлекаем из них досье
    if (session.messages.length > 0) {
      const currentText = session.messages.join('\n');
      const chunkTokens = TokenCounter.estimate(currentText);
      const chunkLength = currentText.length;
      session.stats.totalOriginalLength += chunkLength;
      session.stats.totalOriginalTokens += chunkTokens;
      
      if (currentText.trim()) {
        await ctx.reply('🔍 Извлекаю досье из последнего куска...');
        
        const chunkIndex = session.stats.chunksProcessed;
        const dossierResult = await withTypingIndicator(
          ctx,
          analyzer.extractDossiers(currentText, chunkIndex),
          5000
        );
        
        session.stats.chunksProcessed++;
        session.stats.dossiersExtracted.push(dossierResult);
        
        await ctx.reply(`✅ Последний кусок обработан!
👤 Найдено персонажей: ${dossierResult.dossiers.length}`);
      }
    }

    // Собираем все досье из всех кусков
    const allDossiers = [];
    for (const dossierResult of session.stats.dossiersExtracted) {
      allDossiers.push(...dossierResult.dossiers);
    }

    await ctx.reply(`🎬 Начинаю объединение досье!

📊 Статистика обработки:
━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 Обработано кусков: ${session.stats.chunksProcessed}
📏 Символов: ${session.stats.totalOriginalLength.toLocaleString()}
📊 Токенов: ${session.stats.totalOriginalTokens.toLocaleString()}
👤 Всего досье: ${allDossiers.length}
━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    if (allDossiers.length === 0) {
      await ctx.reply(`❌ Персонажи не найдены!

🤔 В предоставленном тексте не обнаружено персонажей.
Возможно, это описание природы, техническая статья или философский текст без действующих лиц.`);
      
      userSessions.delete(userId);
      return;
    }

    // Объединяем досье
    await ctx.sendChatAction('typing');
    await ctx.reply(`🔄 Объединяю досье персонажей из всех фрагментов...
    
📊 Всего досье для объединения: ${allDossiers.length}
⏳ Это может занять 1-2 минуты...

💡 Бот работает, просто GPT-4o долго думает. Жди статус "печатает..." в чате.`);

    console.log(`🔄 Начинаю объединение ${allDossiers.length} досье...`);
    const analysisResult = await withTypingIndicator(
      ctx,
      analyzer.mergeDossiers(allDossiers),
      5000 // Отправляем typing каждые 5 секунд
    );
    console.log(`✅ Объединение завершено за ${analysisResult.responseTime.toFixed(1)}с`);

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
💰 Стоимость: ~$${TokenCounter.estimateCost(analysisResult.usage, analysisResult.model)}
━━━━━━━━━━━━━━━━━━━━━━━━━━

⏱️  Общее время: ${totalTime}с`);
    } else {
      // Разбиваем длинное сообщение на части (Telegram лимит 4096 символов)
      const MAX_MESSAGE_LENGTH = 4000; // Оставляем запас для заголовков
      const analysis = analysisResult.analysis;
      
      await ctx.reply(`🎭 Анализ персонажей завершен!`);
      
      if (analysis.length <= MAX_MESSAGE_LENGTH) {
        // Если анализ короткий, отправляем одним сообщением
        await ctx.reply(`${analysis}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      } else {
        // Разбиваем по персонажам (каждый персонаж начинается с **)
        const characterSections = analysis.split(/(?=\*\*[^\*]+\*\*)/);
        let currentMessage = '';
        let partNumber = 1;
        
        for (const section of characterSections) {
          if (!section.trim()) continue;
          
          // Если добавление секции превысит лимит, отправляем текущее сообщение
          if (currentMessage.length + section.length > MAX_MESSAGE_LENGTH && currentMessage.length > 0) {
            await ctx.reply(`📖 Часть ${partNumber}:\n\n${currentMessage}`);
            currentMessage = section;
            partNumber++;
            await new Promise(resolve => setTimeout(resolve, 100)); // Небольшая задержка между сообщениями
          } else {
            currentMessage += section;
          }
        }
        
        // Отправляем последнюю часть
        if (currentMessage.trim()) {
          await ctx.reply(`📖 Часть ${partNumber}:\n\n${currentMessage}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        }
      }

      // Итоговая статистика
      let totalTokensUsed = analysisResult.usage.total_tokens;
      let totalCost = parseFloat(TokenCounter.estimateCost(analysisResult.usage, analysisResult.model));

      // Суммируем токены из всех извлечений досье
      let totalExtractionTokens = 0;
      for (const dossierResult of session.stats.dossiersExtracted) {
        totalExtractionTokens += dossierResult.usage.total_tokens;
      }
      
      if (totalExtractionTokens > 0) {
        totalTokensUsed += totalExtractionTokens;
        totalCost += parseFloat(TokenCounter.estimateCost({ 
          prompt_tokens: 0, 
          completion_tokens: 0, 
          total_tokens: totalExtractionTokens 
        }, analysisResult.model));
      }

      const statsMessage = `📊 Итоговая статистика:
━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 Исходный текст: ${session.stats.totalOriginalLength.toLocaleString()} символов, ${session.stats.totalOriginalTokens.toLocaleString()} токенов
🔍 Извлечено досье: ${session.stats.chunksProcessed} кусков, ${totalExtractionTokens.toLocaleString()} токенов
🔄 Объединение: ${analysisResult.usage.total_tokens} токенов
⏱️  Общее время: ${totalTime}с

💰 Общая стоимость:
   📊 Всего токенов: ${totalTokensUsed.toLocaleString()}
   💵 Примерная цена: ~$${totalCost.toFixed(4)}
   
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

  // Если идет обработка, складываем в буфер
  if (session.isProcessing) {
    const isFirstInBuffer = session.pendingMessages.length === 0;
    session.pendingMessages.push(text);
    console.log(`📥 Сообщение ${session.pendingMessages.length} добавлено в буфер (идет обработка куска)`);
    
    // Уведомляем только о первом сообщении в буфере
    if (isFirstInBuffer) {
      await ctx.reply(`📥 Сообщение добавлено в очередь. Дождись завершения обработки текущего куска.`, {
        reply_parameters: { message_id: ctx.message.message_id }
      });
    }
    return;
  }

  // Добавляем сообщение в сессию
  session.messages.push(text);
  
  const currentLength = session.messages.join('\n\n').length;
  const currentTokens = TokenCounter.estimate(session.messages.join('\n\n'));

  console.log(`📩 Сообщение получено от ${ctx.from.username || ctx.from.id}:`);
  console.log(`   📏 +${text.length} символов (всего: ${currentLength})`);
  console.log(`   📊 ~${currentTokens} токенов`);

  // Проверяем, нужно ли извлечь досье из текущего куска
  if (currentTokens >= MAX_TOKENS_PER_CHUNK || session.messages.length >= MAX_MESSAGES_PER_CHUNK) {
    // Устанавливаем флаг обработки
    session.isProcessing = true;
    await ctx.reply(`⚠️ Достигнут лимит токенов (${currentTokens.toLocaleString()})!

🔍 Извлекаю досье персонажей из текущего куска...`);

    try {
      const currentText = session.messages.join('\n');
      
      // Проверяем, что текст не пустой
      if (!currentText.trim()) {
        await ctx.reply(`❌ Пустой текст, пропускаю.
Продолжай отправлять текст или нажми /finish для анализа.`);
        return;
      }
      
      // Сохраняем токены из этого куска
      const chunkTokens = TokenCounter.estimate(currentText);
      const chunkLength = currentText.length;
      session.stats.totalOriginalTokens += chunkTokens;
      session.stats.totalOriginalLength += chunkLength;
      
      // Извлекаем досье персонажей из этого куска
      const chunkIndex = session.stats.chunksProcessed;
      const dossierResult = await withTypingIndicator(
        ctx,
        analyzer.extractDossiers(currentText, chunkIndex),
        5000
      );
      
      session.stats.chunksProcessed++;
      session.stats.dossiersExtracted.push(dossierResult);
      
      if (dossierResult.dossiers.length > 0) {
        await ctx.reply(`✅ Кусок ${chunkIndex + 1} обработан!
👤 Найдено персонажей: ${dossierResult.dossiers.length}
⏱️ Время: ${dossierResult.responseTime.toFixed(1)}с

Продолжай отправлять текст для следующего куска или нажми /finish для объединения всех досье.`);
      } else {
        await ctx.reply(`✅ Кусок ${chunkIndex + 1} обработан!
👤 В этом куске персонажей не найдено.

Продолжай отправлять текст или нажми /finish для анализа.`);
      }
      
      // Очищаем сообщения для следующего куска
      session.messages = [];
      
      // Снимаем флаг обработки
      session.isProcessing = false;
      
      // Обрабатываем буфер ожидающих сообщений
      if (session.pendingMessages.length > 0) {
        console.log(`📦 Перемещаю ${session.pendingMessages.length} сообщений из буфера в текущий кусок`);
        session.messages = [...session.pendingMessages];
        session.pendingMessages = [];
        
        const bufferTokens = TokenCounter.estimate(session.messages.join('\n\n'));
        console.log(`✅ Из буфера перенесено ${session.messages.length} сообщений (~${bufferTokens} токенов)`);
      }
      
    } catch (error) {
      console.error('❌ Ошибка извлечения досье:', error);
      console.error('Stack:', error.stack);
      
      // Снимаем флаг обработки даже при ошибке
      session.isProcessing = false;
      
      await ctx.reply(`❌ Ошибка извлечения досье: ${error.message}
Попробуй отправить меньше текста или нажми /finish для анализа.`);
    }
  } else {
    await ctx.reply(`✅ Принято! (${session.messages.length} сообщ., ~${currentTokens.toLocaleString()} токенов)

Продолжай отправлять текст или нажми /finish для анализа.`, {
      reply_parameters: { message_id: ctx.message.message_id }
    });
  }
});

// Обработчик необработанных ошибок
bot.catch(async (err, ctx) => {
  console.error(`❌ Необработанная ошибка для пользователя ${ctx.from?.username || ctx.from?.id}:`);
  console.error('Ошибка:', err);
  console.error('Stack:', err.stack);
  
  try {
    if (err.message?.includes('timed out') || err.message?.includes('timeout')) {
      await ctx.reply(`❌ Превышено время ожидания ответа от OpenAI (>90 сек).

Это может быть из-за:
• Слишком большого объема данных для объединения
• Перегрузки OpenAI API
• Проблем с сетью

⚠️ Твоя сессия сохранена!

Попробуй:
• Подождать 1-2 минуты и нажать /finish снова
• Если не поможет - используй /cancel и начни заново с /start`);
    } else {
      await ctx.reply(`❌ Произошла ошибка: ${err.message}

⚠️ Твоя сессия сохранена!

Попробуй:
• Подождать немного и повторить команду
• Если не поможет - используй /cancel для отмены сессии`);
    }
  } catch (replyError) {
    console.error('Не удалось отправить сообщение об ошибке:', replyError);
  }
  
  // НЕ очищаем сессию - пользователь может повторить попытку
  const userId = ctx.from?.id;
  const session = userSessions.get(userId);
  if (session && session.isProcessing) {
    // Сбрасываем флаг обработки, чтобы можно было повторить
    session.isProcessing = false;
    console.log(`🔓 Флаг обработки сброшен для пользователя ${userId}, сессия сохранена`);
  }
});

bot.launch();

console.log('🤖 Бот запущен!');
console.log('🎭 Анализатор персонажей');
console.log('📊 С извлечением досье персонажей');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
