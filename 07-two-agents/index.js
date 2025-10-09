import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import { SlovogeneratorAgent } from './agents/SlovogeneratorAgent.js';
import { RasskazogeneratorAgent } from './agents/RasskazogeneratorAgent.js';

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const slovogenerator = new SlovogeneratorAgent();
const rasskazogenerator = new RasskazogeneratorAgent();

const WELCOME_MESSAGE = `📚 Генератор слов и рассказов

Просто напиши любую тему, и бот:

1️⃣ Сгенерирует 10 слов на эту тему
2️⃣ Составит рассказ из 5 предложений, используя эти слова

Например: "космос", "природа", "город"

Давай попробуем! 🚀`;

bot.start(async (ctx) => {
  await ctx.reply(WELCOME_MESSAGE);
});

bot.help(async (ctx) => {
  await ctx.reply(WELCOME_MESSAGE);
});

bot.on('text', async (ctx) => {
  const topic = ctx.message.text;
  
  // Пропускаем команды
  if (topic.startsWith('/')) {
    return;
  }
  
  try {
    await ctx.sendChatAction('typing');
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📝 Тема: ${topic}`);
    console.log(`👤 Пользователь: ${ctx.from.username || ctx.from.id}`);
    
    // Этап 1: Генерация слов
    console.log('\n🔤 Этап 1: Словогенератор');
    await ctx.reply('🔤 Словогенератор генерирует 10 слов на вашу тему...');
    
    const { words, usage: wordsUsage, responseTime: wordsTime } = await slovogenerator.generateWords(topic);
    
    console.log(`⏱️  Время: ${wordsTime.toFixed(2)}с`);
    console.log(`📊 Токены: ${wordsUsage.total_tokens}`);
    console.log(`📝 Слова: ${words.join(', ')}`);
    
    const wordsMessage = `✅ Словогенератор сгенерировал слова:

${words.map((word, i) => `${i + 1}. ${word}`).join('\n')}

⏱️ Время: ${wordsTime.toFixed(2)}с | 📊 Токены: ${wordsUsage.total_tokens}

📤 Передаю слова Рассказогенератору...`;
    
    await ctx.reply(wordsMessage);
    
    // Небольшая задержка для UX
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Этап 2: Генерация рассказа
    console.log('\n📖 Этап 2: Рассказогенератор');
    await ctx.sendChatAction('typing');
    await ctx.reply('📖 Рассказогенератор составляет рассказ...');
    
    const { story, usage: storyUsage, responseTime: storyTime } = await rasskazogenerator.generateStory(words);
    
    console.log(`⏱️  Время: ${storyTime.toFixed(2)}с`);
    console.log(`📊 Токены: ${storyUsage.total_tokens}`);
    console.log(`📖 Рассказ:\n${story}`);
    
    const storyMessage = `📖 Рассказогенератор создал рассказ:

${story}

⏱️ Время: ${storyTime.toFixed(2)}с | 📊 Токены: ${storyUsage.total_tokens}

✨ Готово! Напиши другую тему для нового рассказа.`;
    
    await ctx.reply(storyMessage);
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
    await ctx.reply(`❌ Произошла ошибка: ${error.message}\nПопробуйте еще раз.`);
  }
});

bot.launch();

console.log('🤖 Бот запущен!');
console.log('📚 Генератор слов и рассказов');
console.log('🔤 Агент 1: Словогенератор');
console.log('📖 Агент 2: Рассказогенератор');

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
