import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import { TranscriptionService } from './services/transcription.js';
import { logger } from './utils/logger.js';
import { resolve } from 'path';
import { mkdirSync, existsSync } from 'fs';
import OpenAI from 'openai';

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
const transcriptionService = new TranscriptionService(OPENAI_API_KEY);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// Создаем папку для временных файлов
const tmpDir = resolve('./tmp/voice');
if (!existsSync(tmpDir)) {
  mkdirSync(tmpDir, { recursive: true });
}

// Приветственное сообщение
const welcomeMessage = `🎤 Привет! Отправь мне голосовое сообщение, и я отвечу на него!`;

// Команда /start
bot.start((ctx) => {
  logger.info(`Пользователь запустил бота`);
  ctx.reply(welcomeMessage);
});

// Команда /help
bot.help((ctx) => {
  ctx.reply(welcomeMessage);
});

// Обработка голосовых сообщений
bot.on('voice', async (ctx) => {
  logger.info('Получено голосовое сообщение');
  
  const voiceFileId = ctx.message.voice.file_id;
  const timestamp = Date.now();
  const tmpFilePath = resolve(tmpDir, `voice_${timestamp}.ogg`);

  try {
    await ctx.reply('🎤 Распознаю голосовое сообщение...');

    // Получаем ссылку на файл
    const file = await ctx.telegram.getFile(voiceFileId);
    const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;

    // Скачиваем файл
    await transcriptionService.downloadVoiceFile(fileUrl, tmpFilePath);

    // Транскрибируем
    const transcribedText = await transcriptionService.transcribe(tmpFilePath);

    // Удаляем временный файл
    transcriptionService.cleanupFile(tmpFilePath);

    // Отправляем распознанный текст пользователю
    await ctx.reply(`📝 Распознано: "${transcribedText}"`);

    // Отправляем в модель для получения ответа
    logger.info('Отправляю запрос в GPT-4o-mini...');
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: transcribedText,
        },
      ],
    });

    const answer = completion.choices[0].message.content;
    logger.success('Получен ответ от модели');

    // Отправляем ответ пользователю
    await ctx.reply(answer);

  } catch (error) {
    logger.error('Ошибка при обработке голосового сообщения:', error);
    
    // Удаляем временный файл в случае ошибки
    transcriptionService.cleanupFile(tmpFilePath);
    
    await ctx.reply('❌ Произошла ошибка при обработке. Попробуйте еще раз.');
  }
});

// Обработка ошибок
bot.catch((err, ctx) => {
  logger.error('Ошибка в боте:', err);
  ctx.reply('❌ Произошла ошибка. Попробуйте еще раз позже.');
});

// Запуск бота
logger.separator();
logger.info('🤖 Запуск Telegram бота с распознаванием речи');
logger.separator();

bot.launch().then(() => {
  logger.success('✅ Бот успешно запущен и готов к работе');
  logger.info('Нажмите Ctrl+C для остановки бота');
});

// Graceful shutdown
process.once('SIGINT', () => {
  logger.info('Получен сигнал SIGINT, останавливаю бота...');
  bot.stop('SIGINT');
});

process.once('SIGTERM', () => {
  logger.info('Получен сигнал SIGTERM, останавливаю бота...');
  bot.stop('SIGTERM');
});

