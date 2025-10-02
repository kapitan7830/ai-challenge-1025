import { Telegraf } from 'telegraf';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Store conversation history per user
const conversations = new Map();

bot.start((ctx) => {
  ctx.reply('Hey! Send me any message and I\'ll forward it to OpenAI.');
});

bot.help((ctx) => {
  ctx.reply('Send me any text and I\'ll get a response from OpenAI.\nUse /clear to reset conversation history.');
});

bot.command('clear', (ctx) => {
  const userId = ctx.from.id;
  conversations.set(userId, [
    {
      role: 'system',
      content: 'You must respond ONLY in JSON format with the following structure: {"date": "dd.mm.yyyy HH:MM:SS", "answer": "text"}. The date should be the current date and time. Your answer must NOT exceed 400 characters. Do not include any other text, explanations, or formatting - only the JSON object.'
    }
  ]);
  ctx.reply('Conversation history cleared!');
});

bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const userMessage = ctx.message.text;

  // Get or initialize conversation history
  if (!conversations.has(userId)) {
    conversations.set(userId, [
      {
        role: 'system',
        content: 'You must respond ONLY in JSON format with the following structure: {"date": "dd.mm.yyyy HH:MM:SS", "answer": "text"}. The date should be the current date and time. Your answer must NOT exceed 400 characters. Do not include any other text, explanations, or formatting - only the JSON object.'
      }
    ]);
  }
  const history = conversations.get(userId);

  // Add user message to history
  history.push({ role: 'user', content: userMessage });

  try {
    // Show typing indicator
    await ctx.sendChatAction('typing');

    // Send to OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: history,
    });

    const assistantMessage = completion.choices[0].message.content;

    // Add assistant response to history
    history.push({ role: 'assistant', content: assistantMessage });

    // Keep only last 20 messages to avoid token limits
    if (history.length > 20) {
      history.splice(0, history.length - 20);
    }

    // Send response back to user as code block
    await ctx.reply(`\`\`\`json\n${assistantMessage}\n\`\`\``, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error:', error);
    ctx.reply('Sorry, something went wrong. Please try again.');
  }
});

bot.launch();

console.log('Bot is running...');

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

