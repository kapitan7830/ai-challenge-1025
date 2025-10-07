import { Telegraf } from 'telegraf';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const hfClient = new OpenAI({
  baseURL: 'https://router.huggingface.co/v1',
  apiKey: process.env.HUGGINGFACE_API_KEY,
});

const MODELS = [
  {
    name: 'SmolLM3-3B',
    type: 'huggingface',
    model: 'HuggingFaceTB/SmolLM3-3B:hf-inference',
    icon: '🐭',
    description: 'Small open model (3B parameters)',
    price: 'free',
  },
  {
    name: 'Arch-Router-1.5B',
    type: 'huggingface',
    model: 'katanemo/Arch-Router-1.5B:hf-inference',
    icon: '🔀',
    description: 'Routing model (1.5B parameters)',
    price: 'free',
  },
  {
    name: 'YandexGPT 5 Lite',
    type: 'yandex',
    model: 'yandexgpt-lite',
    icon: '🇷🇺',
    description: 'Lightweight Russian model',
    price: '~₽0.04/1K tokens',
  },
];

const WELCOME_MESSAGE = `🤖 AI Models Comparison Bot

Ask any question and the bot will send it to three different models:

🐭 SmolLM3-3B - small open model (3B parameters)
🔀 Arch-Router-1.5B - routing model (1.5B parameters)
🇷🇺 YandexGPT 5 Lite - lightweight Russian model

For each model you'll see:
⏱️ Response time
📊 Token count
💰 Request cost (where applicable)

Just write your question and compare the results!`;

bot.start(async (ctx) => {
  await ctx.reply(WELCOME_MESSAGE);
});

bot.help(async (ctx) => {
  await ctx.reply(WELCOME_MESSAGE);
});

function calculateCost(usage, inputPrice, outputPrice) {
  const inputCost = (usage.prompt_tokens / 1_000_000) * inputPrice;
  const outputCost = (usage.completion_tokens / 1_000_000) * outputPrice;
  return inputCost + outputCost;
}

async function callHuggingFace(question, modelConfig) {
  const completion = await hfClient.chat.completions.create({
    model: modelConfig.model,
    messages: [
      {
        role: 'system',
        content: '/no_think\nYou are a helpful assistant. Answer in English.',
      },
      {
        role: 'user',
        content: question,
      },
    ],
    temperature: 0.7,
    max_tokens: 500,
  });

  let answer = completion.choices[0].message.content;
  
  // Remove <think>...</think> block if present
  answer = answer.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

  return {
    answer,
    usage: completion.usage,
  };
}

async function callYandex(question, modelConfig) {
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
            text: 'You are a helpful assistant. Answer in English.',
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


async function answerQuestion(question, modelConfig) {
  const startTime = Date.now();

  let result;
  
  switch (modelConfig.type) {
    case 'huggingface':
      result = await callHuggingFace(question, modelConfig);
      break;
    case 'yandex':
      result = await callYandex(question, modelConfig);
      break;
    default:
      throw new Error(`Unknown model type: ${modelConfig.type}`);
  }

  const endTime = Date.now();
  const responseTime = (endTime - startTime) / 1000; // в секундах

  let cost = null;
  if (modelConfig.inputPrice !== undefined && modelConfig.outputPrice !== undefined) {
    cost = calculateCost(result.usage, modelConfig.inputPrice, modelConfig.outputPrice);
  }

  return {
    answer: result.answer,
    usage: result.usage,
    responseTime,
    cost,
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
    
    await ctx.reply('⏳ Sending request to three models...');
    
    // Get answers from different models
    for (const modelConfig of MODELS) {
      await ctx.sendChatAction('typing');
      
      console.log(`\n🤖 Answering with model: ${modelConfig.name}`);
      
      try {
        const { answer, usage, responseTime, cost } = await answerQuestion(question, modelConfig);
        
        console.log(`⏱️  Response time: ${responseTime.toFixed(2)}s`);
        console.log(`📊 Tokens: prompt=${usage.prompt_tokens}, completion=${usage.completion_tokens}, total=${usage.total_tokens}`);
        if (cost !== null) {
          console.log(`💰 Cost: $${cost.toFixed(6)}`);
        }
        console.log(`💬 Answer preview: ${answer.substring(0, 100)}...`);
        
        let statsText = `⏱️ Time: ${responseTime.toFixed(2)}s\n📊 Tokens: ${usage.prompt_tokens} (in) + ${usage.completion_tokens} (out) = ${usage.total_tokens}`;
        
        if (cost !== null) {
          statsText += `\n💰 Cost: $${cost.toFixed(6)}`;
        } else if (modelConfig.price) {
          statsText += `\n💰 ${modelConfig.price}`;
        }
        
        await ctx.reply(
          `${modelConfig.icon} ${modelConfig.name}\n\n${answer}\n\n${statsText}`
        );
      } catch (error) {
        console.error(`❌ Error with model ${modelConfig.name}:`, error.message);
        await ctx.reply(
          `${modelConfig.icon} ${modelConfig.name}\n\n❌ Error: ${error.message}`
        );
      }
      
      // Small delay for better UX
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    await ctx.reply('✅ Done! Ask another question to compare.');
    
  } catch (error) {
    console.error('Error:', error);
    await ctx.reply('An error occurred. Please try again.');
  }
});

bot.launch();

console.log('🤖 Models Comparison Bot is running...');
console.log('Models: SmolLM3-3B, Arch-Router-1.5B, YandexGPT 5 Lite');

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
