import cron from 'node-cron';
import { Telegraf } from 'telegraf';
import fetch from 'node-fetch';
import { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, CRON_SCHEDULE, API_URL, OPENAI_API_KEY } from '../constants.js';

const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

function log(message, data = null) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [CRON] ${message}`, data || '');
}

// Функция для получения задач на сегодня
async function getTodayTasks() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const timestamp = today.getTime();
    
    const response = await fetch(`${API_URL}/tasks?day=${timestamp}`);
    
    if (!response.ok) {
      throw new Error('Ошибка получения задач');
    }
    
    const data = await response.json();
    return data.tasks;
  } catch (error) {
    console.error('[CRON] Ошибка получения задач:', error);
    return [];
  }
}

// Функция для создания саммари через OpenAI
async function generateSummary(tasks) {
  if (tasks.length === 0) {
    return '📭 На сегодня задач не запланировано.';
  }
  
  try {
    const now = Date.now();
    const tasksText = tasks.map((task, index) => {
      const date = new Date(task.date);
      const dateStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
      
      let statusEmoji;
      if (task.completed_at) {
        statusEmoji = '✅';
      } else if (task.date < now) {
        statusEmoji = '🔴';
      } else {
        statusEmoji = '⏳';
      }
      
      return `${index + 1}. ${statusEmoji} ${task.name} - ${dateStr}${task.description ? `\n   ${task.description}` : ''}`;
    }).join('\n\n');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Ты ассистент для управления задачами. Создай краткое саммари по списку задач на сегодня. Будь кратким и позитивным. Отвечай на русском.'
          },
          {
            role: 'user',
            content: `Создай краткое саммари по задачам на сегодня:\n\n${tasksText}\n\nВключи:\n- Общее количество задач\n- Сколько уже выполнено/просрочено/предстоит\n- Краткий обзор основных дел`
          }
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });
    
    if (!response.ok) {
      throw new Error('Ошибка OpenAI API');
    }
    
    const data = await response.json();
    const summary = data.choices[0].message.content;
    
    return `📋 Ежедневное саммари\n\n${summary}\n\n${tasksText}`;
  } catch (error) {
    console.error('[CRON] Ошибка создания саммари:', error);
    // Если OpenAI не сработал, вернем простой список
    const now = Date.now();
    const completed = tasks.filter(t => t.completed_at).length;
    const overdue = tasks.filter(t => !t.completed_at && t.date < now).length;
    const upcoming = tasks.filter(t => !t.completed_at && t.date >= now).length;
    
    return `📋 Задачи на сегодня (${tasks.length})\n\n` +
           `✅ Выполнено: ${completed}\n` +
           `🔴 Просрочено: ${overdue}\n` +
           `⏳ Предстоит: ${upcoming}`;
  }
}

// Функция отправки саммари
async function sendDailySummary() {
  log('⏰ Запуск ежедневного саммари...');
  
  if (!TELEGRAM_CHAT_ID) {
    log('❌ TELEGRAM_CHAT_ID не указан в .env');
    return;
  }
  
  try {
    const tasks = await getTodayTasks();
    log(`📋 Получено задач на сегодня: ${tasks.length}`);
    
    const summary = await generateSummary(tasks);
    log(`📝 Саммари сгенерировано, отправка...`);
    
    await bot.telegram.sendMessage(TELEGRAM_CHAT_ID, summary);
    log('✅ Саммари отправлено успешно');
  } catch (error) {
    log('❌ Ошибка отправки саммари:', error);
  }
}

// Запуск крон-задачи
export function startDailySummaryCron() {
  if (!TELEGRAM_CHAT_ID) {
    log('⚠️  TELEGRAM_CHAT_ID не указан. Ежедневное саммари отключено.');
    log('Добавьте TELEGRAM_CHAT_ID в .env для включения.');
    return null;
  }

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const now = new Date();
  
  log(`⏰ Ежедневное саммари настроено: ${CRON_SCHEDULE}`);
  log(`📍 Часовой пояс: ${timezone}`);
  log(`🕐 Текущее время: ${now.toLocaleString('ru-RU', { timeZone: timezone })}`);
  log(`📨 Саммари будет отправляться в Telegram`);
  
  const task = cron.schedule(CRON_SCHEDULE, () => {
    log(`⏰ Запуск крона в ${new Date().toLocaleString('ru-RU')}`);
    sendDailySummary();
  }, {
    timezone: timezone
  });
  
  log('✅ Крон-задача запущена и ждёт расписания');
  
  return task;
}

// Для ручного вызова (тестирование)
export async function sendSummaryNow() {
  await sendDailySummary();
}

