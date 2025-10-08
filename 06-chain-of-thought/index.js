import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

const MODEL = {
  name: 'YandexGPT 5 Lite',
  type: 'yandex',
  model: 'yandexgpt-lite',
  icon: '🇷🇺',
  description: 'Lightweight Russian model',
  price: '~₽0.04/1K tokens',
};

const WELCOME_MESSAGE = `🤖 Chain-of-Thought Testing Bot

Ask any question and the bot will respond with two approaches:

🇷🇺 Direct Answer - YandexGPT answers directly
🧠 Chain-of-Thought - YandexGPT thinks step-by-step

For each approach you'll see:
⏱️ Response time
📊 Token count
💰 Request cost

Just write your question and compare the results!`;

bot.start(async (ctx) => {
  await ctx.reply(WELCOME_MESSAGE);
});

bot.help(async (ctx) => {
  await ctx.reply(WELCOME_MESSAGE);
});

async function callYandex(question, modelConfig, useChainOfThought = false) {
  const systemPrompt = useChainOfThought
    ? 'You are a helpful assistant. Think step by step and show your reasoning process before giving the final answer. Structure your response as: "Thinking: [your reasoning]" followed by "Answer: [final answer]". Answer in English.'
    : 'You are a helpful assistant. Give a direct, concise answer. Answer in English.';
  
  
  const response = await fetch(
    'https://llm.api.cloud.yandex.net/foundationModels/v1/completion',
    {
      method: 'POST',
      headers: {
        'Authorization': `Api-Key ${process.env.YANDEX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        modelUri: `gpt://${process.env.YANDEX_FOLDER_ID}/${modelConfig.model}/latest`,
        completionOptions: {
          stream: false,
          temperature: 0.7,
          maxTokens: 2000,
        },
        messages: [
          {
            role: 'system',
            text: systemPrompt,
          },
          {
            role: 'user',
            text: question,
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Yandex API error: ${error}`);
  }

  const result = await response.json();
  const answer = result.result.alternatives[0].message.text;
  
  return {
    answer,
    usage: {
      prompt_tokens: result.result.usage.inputTextTokens,
      completion_tokens: result.result.usage.completionTokens,
      total_tokens: result.result.usage.totalTokens,
    },
  };
}


async function answerQuestion(question, modelConfig, useChainOfThought = false) {
  const startTime = Date.now();

  const result = await callYandex(question, modelConfig, useChainOfThought);

  const endTime = Date.now();
  const responseTime = (endTime - startTime) / 1000;

  return {
    answer: result.answer,
    usage: result.usage,
    responseTime,
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
    
    await ctx.reply('⏳ Processing with two approaches: Direct and Chain-of-Thought...');
    
    // Approach 1: Direct answer (without chain of thought)
    await ctx.sendChatAction('typing');
    console.log('\n🤖 Approach 1: Direct Answer');
    
    try {
      const { answer, usage, responseTime } = await answerQuestion(question, MODEL, false);
      
      console.log(`⏱️  Response time: ${responseTime.toFixed(2)}s`);
      console.log(`📊 Tokens: prompt=${usage.prompt_tokens}, completion=${usage.completion_tokens}, total=${usage.total_tokens}`);
      console.log(`💬 Answer preview: ${answer.substring(0, 100)}...`);
      
      const statsText = `⏱️ Time: ${responseTime.toFixed(2)}s\n📊 Tokens: ${usage.prompt_tokens} (in) + ${usage.completion_tokens} (out) = ${usage.total_tokens}\n💰 ${MODEL.price}`;
      
      await ctx.reply(
        `🇷🇺 Direct Answer\n\n${answer}\n\n${statsText}`
      );
    } catch (error) {
      console.error(`❌ Error with direct answer:`, error.message);
      await ctx.reply(
        `🇷🇺 Direct Answer\n\n❌ Error: ${error.message}`
      );
    }
    
    // Small delay for better UX
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Approach 2: Chain-of-Thought
    await ctx.sendChatAction('typing');
    console.log('\n🧠 Approach 2: Chain-of-Thought');
    
    try {
      const { answer, usage, responseTime } = await answerQuestion(question, MODEL, true);
      
      console.log(`⏱️  Response time: ${responseTime.toFixed(2)}s`);
      console.log(`📊 Tokens: prompt=${usage.prompt_tokens}, completion=${usage.completion_tokens}, total=${usage.total_tokens}`);
      console.log(`💬 Answer preview: ${answer.substring(0, 100)}...`);
      
      const statsText = `⏱️ Time: ${responseTime.toFixed(2)}s\n📊 Tokens: ${usage.prompt_tokens} (in) + ${usage.completion_tokens} (out) = ${usage.total_tokens}\n💰 ${MODEL.price}`;
      
      await ctx.reply(
        `🧠 Chain-of-Thought\n\n${answer}\n\n${statsText}`
      );
    } catch (error) {
      console.error(`❌ Error with chain-of-thought:`, error.message);
      await ctx.reply(
        `🧠 Chain-of-Thought\n\n❌ Error: ${error.message}`
      );
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    await ctx.reply('✅ Done! Ask another question to compare.');
    
  } catch (error) {
    console.error('Error:', error);
    await ctx.reply('An error occurred. Please try again.');
  }
});

bot.launch();

console.log('🤖 Chain-of-Thought Testing Bot is running...');
console.log('Model: YandexGPT 5 Lite');
console.log('Testing: Direct Answer vs Chain-of-Thought');

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
