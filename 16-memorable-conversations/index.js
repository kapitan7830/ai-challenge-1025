import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import { CharacterAnalyzerAgent } from './agents/CharacterAnalyzerAgent.js';
import { TokenCounter } from './utils/TokenCounter.js';
import { rateLimiter } from './utils/RateLimiter.js';
import { chunkProcessor } from './utils/ChunkProcessor.js';
import { DatabaseManager } from './utils/DatabaseManager.js';

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN, {
  handlerTimeout: 180000, // 3 минуты вместо 90 секунд
});
const analyzer = new CharacterAnalyzerAgent();
const db = new DatabaseManager();

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

📝 Команды:

1️⃣ /start - начать новую работу или продолжить незавершенную
2️⃣ /finish - завершить ввод и создать финальное досье
3️⃣ /cancel - отменить текущую сессию
4️⃣ /list - показать все работы (завершенные и незавершенные)
5️⃣ /get [ID] - получить финальное досье по ID работы
6️⃣ /stats - показать статистику rate limiting

💡 Возможности:
• Автоматическая обработка при достижении лимита токенов (2500)
• Проверка дубликатов текста по хэшу
• Все данные сохраняются в БД - можно продолжить прерванную работу
• Интеллектуальное разбиение длинных сообщений (лимит Telegram 4096 символов)
• Rate limiting: автоматическое управление лимитами OpenAI API

📊 Вы увидите полную статистику: токены, время работы, стоимость.

Готов работать! 🚀`;

// Команда /start
bot.start(async (ctx) => {
  const userId = ctx.from.id;
  
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🆕 Запрос старта: ${ctx.from.username || ctx.from.id}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  await ctx.reply(WELCOME_MESSAGE);

  // Проверяем незавершенные работы
  const unfinishedTitles = db.getUnfinishedTitles();
  
  if (unfinishedTitles.length > 0) {
    let message = '📚 Найдены незавершенные работы:\n\n';
    unfinishedTitles.forEach((title, index) => {
      const dossiers = db.getDossiersByTitle(title.id);
      const chunks = db.getChunksByTitle(title.id);
      message += `${index + 1}. ${title.name} (ID: ${title.id})\n`;
      message += `   📊 Досье: ${dossiers.length}`;
      if (chunks.length > 0) {
        message += `, необработанных: ${chunks.length}`;
      }
      message += `\n`;
    });
    message += `\nОтправь ID работы для продолжения или "новая" для создания новой работы.`;
    
    await ctx.reply(message);
    
    // Устанавливаем состояние ожидания выбора
    userSessions.set(userId, {
      state: 'waiting_for_choice',
      unfinishedTitles,
    });
  } else {
    // Если незавершенных нет, сразу просим название
    await ctx.reply('📖 Введи название книги/рассказа:');
    userSessions.set(userId, {
      state: 'waiting_for_title',
    });
  }
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

// Команда /list - показать все работы
bot.command('list', async (ctx) => {
  try {
    const unfinished = db.getUnfinishedTitles();
    const allTitles = db.db.prepare('SELECT * FROM titles ORDER BY created_at DESC LIMIT 20').all();
    
    let message = '📚 Список работ:\n\n';
    
    if (allTitles.length === 0) {
      message += 'Пока нет ни одной работы.';
    } else {
      for (const title of allTitles) {
        const status = title.is_finished ? '✅' : '⏳';
        const dossiers = db.getDossiersByTitle(title.id);
        const chunks = db.getChunksByTitle(title.id);
        const finalDossier = db.getFinalDossier(title.id);
        
        message += `${status} ${title.name} (ID: ${title.id})\n`;
        message += `   📊 Частей: ${dossiers.length}`;
        if (chunks.length > 0) {
          message += `, необработанных: ${chunks.length}`;
        }
        if (finalDossier) {
          message += `, финальное досье: ${(finalDossier.text.length / 1024).toFixed(1)} KB`;
        }
        message += `\n\n`;
      }
    }
    
    await ctx.reply(message);
  } catch (error) {
    console.error('Ошибка в /list:', error);
    await ctx.reply('❌ Ошибка при получении списка работ.');
  }
});

// Команда /get - получить финальное досье по ID
bot.command('get', async (ctx) => {
  try {
    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
      await ctx.reply('❌ Укажи ID работы. Пример: /get 1');
      return;
    }
    
    const titleId = parseInt(args[1]);
    if (isNaN(titleId)) {
      await ctx.reply('❌ ID должен быть числом.');
      return;
    }
    
    const title = db.getTitle(titleId);
    if (!title) {
      await ctx.reply('❌ Работа с таким ID не найдена.');
      return;
    }
    
    const finalDossier = db.getFinalDossier(titleId);
    if (!finalDossier) {
      await ctx.reply(`❌ Для работы "${title.name}" еще нет финального досье.\n\nИспользуй /finish чтобы создать его.`);
      return;
    }
    
    await ctx.reply(`📖 Финальное досье: "${title.name}"\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    // Разбиваем длинное сообщение на части (Telegram лимит 4096 символов)
    const MAX_MESSAGE_LENGTH = 4000;
    const text = finalDossier.text;
    
    if (text.length <= MAX_MESSAGE_LENGTH) {
      await ctx.reply(text);
    } else {
      // Разбиваем на части
      const parts = [];
      let currentPart = '';
      const sections = text.split(/\n{2,}|---+/);
      
      for (const section of sections) {
        const sectionWithSep = section.trim() + '\n\n';
        
        if (sectionWithSep.length > MAX_MESSAGE_LENGTH) {
          if (currentPart) {
            parts.push(currentPart.trim());
            currentPart = '';
          }
          
          const sentences = sectionWithSep.split(/(?<=[.!?])\s+/);
          for (const sentence of sentences) {
            if (currentPart.length + sentence.length > MAX_MESSAGE_LENGTH && currentPart) {
              parts.push(currentPart.trim());
              currentPart = sentence;
            } else {
              currentPart += (currentPart ? ' ' : '') + sentence;
            }
          }
        } else if (currentPart.length + sectionWithSep.length > MAX_MESSAGE_LENGTH) {
          if (currentPart) {
            parts.push(currentPart.trim());
          }
          currentPart = sectionWithSep;
        } else {
          currentPart += sectionWithSep;
        }
      }
      
      if (currentPart.trim()) {
        parts.push(currentPart.trim());
      }
      
      for (let i = 0; i < parts.length; i++) {
        await ctx.reply(`📖 Часть ${i + 1}/${parts.length}:\n\n${parts[i]}`);
        if (i < parts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
    }
    
  } catch (error) {
    console.error('Ошибка в /get:', error);
    await ctx.reply('❌ Ошибка при получении досье.');
  }
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
        
        // Сохраняем в БД
        const dossierText = JSON.stringify(dossierResult.dossiers);
        db.saveDossier(session.titleId, dossierText, false);
        
        session.stats.chunksProcessed++;
        session.stats.dossiersExtracted.push(dossierResult);
        
        await ctx.reply(`✅ Последний кусок обработан!
👤 Найдено персонажей: ${dossierResult.dossiers.length}`);
      }
    }

    // Загружаем все досье из БД (не только из текущей сессии)
    const dbDossiers = db.getDossiersByTitle(session.titleId);
    const allDossiers = [];
    
    for (const dbDossier of dbDossiers) {
      try {
        const parsed = JSON.parse(dbDossier.text);
        if (Array.isArray(parsed)) {
          allDossiers.push(...parsed);
        }
      } catch (e) {
        console.error('Ошибка парсинга досье из БД:', e);
      }
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
    
    // Сохраняем финальное досье в БД
    db.saveDossier(session.titleId, analysisResult.analysis, true);
    
    // Очищаем chunks после создания финального досье
    db.clearChunks(session.titleId);
    console.log(`🗑️ Chunks очищены для title ${session.titleId}`);
    
    // Отмечаем title как завершенный
    db.finishTitle(session.titleId);
    console.log(`✅ Title ${session.titleId} отмечен как завершенный`);

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
      
      // Функция для разбиения текста на части
      const splitMessage = (text, maxLength) => {
        const parts = [];
        let currentPart = '';
        
        // Сначала пробуем разбить по разделителям --- или двойным переносам
        const sections = text.split(/\n{2,}|---+/);
        
        for (const section of sections) {
          const sectionWithSep = section.trim() + '\n\n';
          
          // Если секция сама по себе слишком большая, разбиваем по предложениям
          if (sectionWithSep.length > maxLength) {
            if (currentPart) {
              parts.push(currentPart.trim());
              currentPart = '';
            }
            
            // Разбиваем большую секцию на куски
            const sentences = sectionWithSep.split(/(?<=[.!?])\s+/);
            for (const sentence of sentences) {
              if (currentPart.length + sentence.length > maxLength && currentPart) {
                parts.push(currentPart.trim());
                currentPart = sentence;
              } else {
                currentPart += (currentPart ? ' ' : '') + sentence;
              }
            }
          } else if (currentPart.length + sectionWithSep.length > maxLength) {
            // Текущая часть + секция превысят лимит
            if (currentPart) {
              parts.push(currentPart.trim());
            }
            currentPart = sectionWithSep;
          } else {
            currentPart += sectionWithSep;
          }
        }
        
        if (currentPart.trim()) {
          parts.push(currentPart.trim());
        }
        
        return parts;
      };
      
      if (analysis.length <= MAX_MESSAGE_LENGTH) {
        // Если анализ короткий, отправляем одним сообщением
        await ctx.reply(`${analysis}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      } else {
        // Разбиваем на части
        const parts = splitMessage(analysis, MAX_MESSAGE_LENGTH);
        
        for (let i = 0; i < parts.length; i++) {
          const partNumber = i + 1;
          const totalParts = parts.length;
          
          if (i === parts.length - 1) {
            // Последняя часть
            await ctx.reply(`📖 Часть ${partNumber}/${totalParts}:\n\n${parts[i]}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          } else {
            await ctx.reply(`📖 Часть ${partNumber}/${totalParts}:\n\n${parts[i]}`);
          }
          
          // Задержка между сообщениями
          if (i < parts.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
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

  if (!session) {
    await ctx.reply('❌ Сессия не активна. Используй /start для начала.');
    return;
  }

  // Обработка состояния ожидания выбора (продолжить/новая)
  if (session.state === 'waiting_for_choice') {
    if (text.toLowerCase() === 'новая') {
      await ctx.reply('📖 Введи название новой книги/рассказа:');
      userSessions.set(userId, {
        state: 'waiting_for_title',
      });
      return;
    }
    
    // Пытаемся распарсить как ID
    const titleId = parseInt(text);
    if (isNaN(titleId)) {
      await ctx.reply('❌ Неверный формат. Отправь ID работы (число) или "новая" для создания новой.');
      return;
    }
    
    const title = db.getTitle(titleId);
    if (!title) {
      await ctx.reply('❌ Работа с таким ID не найдена. Попробуй еще раз или отправь "новая".');
      return;
    }
    
    if (title.is_finished) {
      await ctx.reply('❌ Эта работа уже завершена. Отправь ID другой работы или "новая".');
      return;
    }
    
    // Загружаем существующую сессию
    const existingDossiers = db.getDossiersByTitle(titleId);
    const existingChunks = db.getChunksByTitle(titleId);
    
    // Восстанавливаем необработанные сообщения
    const restoredMessages = existingChunks.map(chunk => chunk.text);
    
    userSessions.set(userId, {
      titleId,
      titleName: title.name,
      messages: restoredMessages,
      startTime: Date.now(),
      active: true,
      isProcessing: false,
      pendingMessages: [],
      stats: {
        totalOriginalTokens: 0,
        totalOriginalLength: 0,
        chunksProcessed: existingDossiers.length,
        dossiersExtracted: [],
      },
    });
    
    let infoMessage = `✅ Продолжаем работу с "${title.name}"
📊 Уже обработано частей: ${existingDossiers.length}`;
    
    if (existingChunks.length > 0) {
      const restoredText = restoredMessages.join('\n');
      const restoredTokens = TokenCounter.estimate(restoredText);
      infoMessage += `\n💾 Восстановлено необработанных сообщений: ${existingChunks.length} (~${restoredTokens} токенов)`;
    }
    
    infoMessage += `\n\nОтправляй текст рассказа. Когда закончишь - нажми /finish`;
    
    await ctx.reply(infoMessage);
    console.log(`💾 Восстановлено ${existingChunks.length} необработанных сообщений для title ${titleId}`);
    return;
  }

  // Обработка состояния ожидания названия
  if (session.state === 'waiting_for_title') {
    const titleName = text.trim();
    if (!titleName) {
      await ctx.reply('❌ Название не может быть пустым. Попробуй еще раз:');
      return;
    }
    
    // Создаем новый title в БД
    const titleId = db.createTitle(titleName);
    
    // Создаем рабочую сессию
    userSessions.set(userId, {
      titleId,
      titleName,
      messages: [],
      startTime: Date.now(),
      active: true,
      isProcessing: false,
      pendingMessages: [],
      stats: {
        totalOriginalTokens: 0,
        totalOriginalLength: 0,
        chunksProcessed: 0,
        dossiersExtracted: [],
      },
    });
    
    console.log(`📖 Создан новый title: "${titleName}" (ID: ${titleId})`);
    
    await ctx.reply(`✅ Начата работа с "${titleName}" (ID: ${titleId})
    
Отправляй текст рассказа. Когда закончишь - нажми /finish`);
    return;
  }

  // Проверяем активную сессию
  if (!session.active) {
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

  // Проверяем существует ли chunk с таким текстом
  const textHash = DatabaseManager.generateHash(text);
  if (db.chunkExists(session.titleId, textHash)) {
    console.log(`⚠️ Дубликат сообщения для title ${session.titleId}, хэш: ${textHash.substring(0, 16)}...`);
    await ctx.reply(`⚠️ Это сообщение уже было отправлено ранее. Дубликат пропущен.

Отправь новый текст или используй /finish для завершения.`, {
      reply_parameters: { message_id: ctx.message.message_id }
    });
    return;
  }
  
  // Добавляем сообщение в сессию
  session.messages.push(text);
  
  // Сохраняем кусок в БД
  const chunkId = db.saveChunk(session.titleId, text);
  console.log(`💾 Кусок текста сохранен в БД (ID: ${chunkId})`);
  
  const currentLength = session.messages.join('\n\n').length;
  const currentTokens = TokenCounter.estimate(session.messages.join('\n\n'));

  console.log(`📩 Сообщение получено от ${ctx.from.username || ctx.from.id}:`);
  console.log(`   📏 +${text.length} символов (всего: ${currentLength})`);
  console.log(`   📊 ~${currentTokens} токенов`);

  // Проверяем, нужно ли извлечь досье из текущего куска
  if (currentTokens >= MAX_TOKENS_PER_CHUNK || session.messages.length >= MAX_MESSAGES_PER_CHUNK) {
    // Устанавливаем флаг обработки
    session.isProcessing = true;

    try {
      const currentText = session.messages.join('\n');
      
      // Проверяем, что текст не пустой
      if (!currentText.trim()) {
        await ctx.reply(`❌ Пустой текст, пропускаю.
Продолжай отправлять текст или нажми /finish для анализа.`);
        session.isProcessing = false;
        return;
      }
      
      await ctx.reply(`⚠️ Достигнут лимит токенов (${currentTokens.toLocaleString()})!

🔍 Извлекаю досье персонажей из текущего куска...`);
      
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
      
      // Сохраняем досье в БД
      const dossierText = JSON.stringify(dossierResult.dossiers);
      const dossierId = db.saveDossier(session.titleId, dossierText, false);
      console.log(`💾 Досье сохранено в БД (ID: ${dossierId})`);
      
      session.stats.chunksProcessed++;
      session.stats.dossiersExtracted.push(dossierResult);
      
      // Очищаем chunks после успешной обработки
      db.clearChunks(session.titleId);
      console.log(`🗑️ Chunks очищены для title ${session.titleId} (обработан кусок)`);
      
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
  
  // Формируем человекочитаемое сообщение
  let userMessage = '';
  
  try {
    if (err.message?.includes('timed out') || err.message?.includes('timeout')) {
      userMessage = `❌ Превышено время ожидания ответа от OpenAI (>90 сек).

Это может быть из-за:
• Слишком большого объема данных
• Перегрузки OpenAI API
• Проблем с сетью

⚠️ Твоя сессия и все данные сохранены в БД!

Попробуй:
• Подождать 1-2 минуты и повторить команду
• Если не поможет - используй /cancel и начни заново с /start`;
    } else if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.code === 'SQLITE_CONSTRAINT') {
      userMessage = `⚠️ Попытка сохранить дублирующиеся данные.

Это может быть техническая проблема. Твои данные в безопасности.

Попробуй:
• Продолжить отправку нового текста
• Использовать /finish для завершения
• Если проблема повторяется - /cancel и начать заново`;
    } else if (err.message?.includes('OPENAI') || err.message?.includes('API')) {
      userMessage = `❌ Ошибка OpenAI API.

Проблема: ${err.message}

⚠️ Твоя сессия сохранена!

Попробуй:
• Подождать несколько секунд и повторить
• Проверить лимиты API в /stats
• Если не поможет - /cancel и начать заново`;
    } else {
      // Общая ошибка с кратким описанием
      const shortMessage = err.message.length > 100 
        ? err.message.substring(0, 100) + '...' 
        : err.message;
      
      userMessage = `❌ Произошла техническая ошибка.

Проблема: ${shortMessage}

⚠️ Все твои данные сохранены в БД!

Попробуй:
• Подождать немного и повторить команду
• Использовать /list для проверки состояния работ
• Если не поможет - /cancel для отмены текущей сессии`;
    }
    
    await ctx.reply(userMessage);
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
process.once('SIGINT', () => {
  console.log('\n🛑 Получен сигнал SIGINT, завершаю работу...');
  db.close();
  bot.stop('SIGINT');
});
process.once('SIGTERM', () => {
  console.log('\n🛑 Получен сигнал SIGTERM, завершаю работу...');
  db.close();
  bot.stop('SIGTERM');
});
