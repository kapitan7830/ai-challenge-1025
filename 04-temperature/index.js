import { Telegraf } from 'telegraf';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const TEMPERATURES = [0, 0.7, 1.2];

const WELCOME_MESSAGE = `🌡️ Демонстрация Temperature для OpenAI

Задайте любой вопрос, и бот ответит на него 3 раза с разными температурами (0, 0.7, 1.2).

Это позволит наглядно увидеть разницу:
❄️ Температура 0 - детерминированные, предсказуемые ответы
🌤️ Температура 0.7 - сбалансированный режим
🔥 Температура 1.2 - креативные, разнообразные ответы

Просто напишите вопрос и сравните ответы!`;

bot.start(async (ctx) => {
  await ctx.reply(WELCOME_MESSAGE);
});

bot.help(async (ctx) => {
  await ctx.reply(WELCOME_MESSAGE);
});

async function answerQuestion(question, temperature) {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Запрос превысил таймаут в 10 секунд')), 10000);
  });

  const apiPromise = openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'user',
        content: question,
      },
    ],
    temperature: temperature,
  });

  const completion = await Promise.race([apiPromise, timeoutPromise]);

  return {
    answer: completion.choices[0].message.content,
    usage: completion.usage,
  };
}

bot.on('text', async (ctx) => {
  const question = ctx.message.text;
  
  // Skip if it's a command
  if (question.startsWith('/')) {
    return;
  }
  
  try {
    await ctx.sendChatAction('typing');
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`❓ Question: ${question}`);
    console.log(`👤 User: ${ctx.from.username || ctx.from.id}`);
    
    await ctx.reply('⏳ Генерирую ответы с температурами 0, 0.7 и 1.2...');
    
    // Get answers with different temperatures
    for (const temp of TEMPERATURES) {
      await ctx.sendChatAction('typing');
      
      console.log(`\n🌡️  Answering with temperature: ${temp}`);
      
      const tempLabel = temp === 0 ? '❄️' : temp === 0.7 ? '🌤️' : '🔥';
      
      try {
        const { answer, usage } = await answerQuestion(question, temp);
        
        console.log(`📊 Tokens: prompt=${usage.prompt_tokens}, completion=${usage.completion_tokens}, total=${usage.total_tokens}`);
        console.log(`💬 Answer preview: ${answer.substring(0, 100)}...`);
        
        await ctx.reply(
          `${tempLabel} Температура ${temp}:\n\n${answer}`
        );
      } catch (error) {
        console.error(`❌ Error with temperature ${temp}:`, error.message);
        await ctx.reply(
          `${tempLabel} Температура ${temp}:\n\n❌ Ошибка: ${error.message}`
        );
      }
      
      // Small delay for better UX
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    await ctx.reply('\n✅ Готово! Задайте следующий вопрос для сравнения.');
    
  } catch (error) {
    console.error('Error:', error);
    await ctx.reply('Произошла ошибка. Попробуйте еще раз.');
  }
});

bot.launch();

console.log('🌡️ Temperature Demo Bot is running...');

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
