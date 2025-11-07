import { Telegraf, Markup } from 'telegraf';
import dotenv from 'dotenv';

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

bot.start((ctx) => {
  ctx.reply(
    'Привет! Я бот, который умеет делать ВСЁ! 🎯',
    Markup.keyboard([
      ['Сделать все']
    ]).resize()
  );
});

bot.hears('Сделать все', async (ctx) => {
  await doEverything(ctx);
});

async function doEverything(ctx) {
  console.log('Делаю все');
  
  // Показываем статус "печатает"
  await ctx.sendChatAction('typing');
  
  // Индикатор прогресса за 5 секунд
  const totalTime = 5000;
  const steps = 20;
  const stepTime = totalTime / steps;
  
  for (let i = 0; i <= steps; i++) {
    const progress = Math.round((i / steps) * 100);
    process.stdout.write(`\rПрогресс: ${progress}%`);
    
    if (i < steps) {
      // Продолжаем показывать "печатает" каждые 5 секунд
      if (i % 2 === 0) {
        await ctx.sendChatAction('typing');
      }
      await new Promise(resolve => setTimeout(resolve, stepTime));
    }
  }
  
  console.log('\nВсе готово');
  await ctx.reply('Все готово 👍');
}

bot.launch();

console.log('🚀 Бот успешно запущен и готов к работе');
console.log('📡 Ожидание сообщений...');

// Enable graceful stop
process.once('SIGINT', () => {
  console.log('\n⚠️  Получен сигнал SIGINT, останавливаем бота...');
  bot.stop('SIGINT');
});
process.once('SIGTERM', () => {
  console.log('\n⚠️  Получен сигнал SIGTERM, останавливаем бота...');
  bot.stop('SIGTERM');
});

