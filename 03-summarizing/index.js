import { Telegraf } from 'telegraf';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Store user sessions
const userSessions = new Map();

const INTRO_MESSAGE = `👋 Привет! Я ваш Ассистент-Суммаризатор!

Я помогаю исследовать темы, задавая целевые вопросы, а затем предоставляю подробное резюме на основе ваших ответов.

Какую тему вы хотели бы исследовать сегодня?`;

function initializeSession(userId) {
  userSessions.set(userId, {
    state: 'waiting_for_theme',
    theme: null,
    conversationHistory: [],
    currentQuestionIndex: 0,
    botMessageIds: [],
  });
}

async function generateNextQuestion(conversationHistory, questionNumber) {
  const messages = [
    {
      role: 'system',
      content: 'Ты эксперт-интервьюер. Задавай ОДИН короткий, простой вопрос, чтобы лучше понять потребности пользователя. Вопросы должны быть краткими и понятными. Опирайся на предыдущие ответы. Общайся ТОЛЬКО на русском языке.',
    },
    ...conversationHistory,
    {
      role: 'user',
      content: `Задай мне вопрос ${questionNumber} из 5. Коротко и просто.`,
    },
  ];

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
  });

  return completion.choices[0].message.content.trim();
}

async function generateSummary(conversationHistory, theme) {
  const messages = [
    {
      role: 'system',
      content: 'Ты составляешь техническое задание для других людей. На основе разговора создай четкое, практичное ТЗ, объясняющее, что нужно человеку. Оформи это как спецификацию задачи, которую другие смогут понять и выполнить. Будь кратким и конкретным. Пиши ТОЛЬКО на русском языке. Не задавай никаких уточняющих вопросов в конце, не предлагай ничего за гранью разговора.',
    },
    ...conversationHistory,
    {
      role: 'user',
      content: 'На основе нашего разговора создай техническое задание, объясняющее, что мне нужно. Оно будет передано другим людям, которым нужно понять мои требования.',
    },
  ];

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
  });

  return completion.choices[0].message.content;
}

bot.start(async (ctx) => {
  const userId = ctx.from.id;
  initializeSession(userId);
  const msg = await ctx.reply(INTRO_MESSAGE);
  const session = userSessions.get(userId);
  session.botMessageIds.push(msg.message_id);
});

bot.command('reset', async (ctx) => {
  const userId = ctx.from.id;
  initializeSession(userId);
  const msg = await ctx.reply(INTRO_MESSAGE);
  const session = userSessions.get(userId);
  session.botMessageIds.push(msg.message_id);
});

bot.help((ctx) => {
  ctx.reply('Команды:\n/start - Запустить ассистента\n/reset - Сбросить и начать заново\n/clear - Очистить историю чата и сбросить\n/help - Показать это сообщение');
});

bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const userMessage = ctx.message.text;

  // Initialize session if doesn't exist
  if (!userSessions.has(userId)) {
    initializeSession(userId);
    const msg = await ctx.reply(INTRO_MESSAGE);
    const session = userSessions.get(userId);
    session.botMessageIds.push(msg.message_id);
    return;
  }

  const session = userSessions.get(userId);

  try {
    await ctx.sendChatAction('typing');

    if (session.state === 'waiting_for_theme') {
      // User provided theme
      session.theme = userMessage;
      session.state = 'asking_questions';
      
      // Add theme to conversation history
      session.conversationHistory.push({
        role: 'user',
        content: `Я хочу изучить тему: ${userMessage}`
      });
      
      const msg1 = await ctx.reply(`Отлично! Я задам вам 5 вопросов о "${userMessage}", чтобы собрать детальную информацию.`);
      session.botMessageIds.push(msg1.message_id);
      
      // Generate and ask first question
      const question = await generateNextQuestion(session.conversationHistory, 1);
      session.conversationHistory.push({
        role: 'assistant',
        content: question
      });
      
      const msg2 = await ctx.reply(`Вопрос 1: ${question}`);
      session.botMessageIds.push(msg2.message_id);

    } else if (session.state === 'asking_questions') {
      // Add user answer to conversation history
      session.conversationHistory.push({
        role: 'user',
        content: userMessage
      });
      
      session.currentQuestionIndex++;

      if (session.currentQuestionIndex < 5) {
        // Generate and ask next question based on conversation
        const question = await generateNextQuestion(session.conversationHistory, session.currentQuestionIndex + 1);
        session.conversationHistory.push({
          role: 'assistant',
          content: question
        });
        
        const msg = await ctx.reply(`Вопрос ${session.currentQuestionIndex + 1}: ${question}`);
        session.botMessageIds.push(msg.message_id);
      } else {
        // All questions answered, generate summary
        session.state = 'generating_summary';
        const msg1 = await ctx.reply('Спасибо! Создаю техническое задание на основе нашего разговора...');
        session.botMessageIds.push(msg1.message_id);
        
        const summary = await generateSummary(session.conversationHistory, session.theme);
        
        const msg2 = await ctx.reply(`📋 Техническое задание:\n\n${summary}`);
        session.botMessageIds.push(msg2.message_id);
        
        // Reset for next round
        const oldBotMessageIds = [...session.botMessageIds];
        initializeSession(userId);
        const newSession = userSessions.get(userId);
        newSession.botMessageIds = oldBotMessageIds;
        
        const msg3 = await ctx.reply('\n---\n\nГотов к новой теме? Просто отправьте тему или используйте /reset чтобы начать заново!');
        newSession.botMessageIds.push(msg3.message_id);
      }
    }

  } catch (error) {
    console.error('Error:', error);
    const msg = await ctx.reply('Извините, что-то пошло не так. Используйте /reset чтобы начать заново.');
    session.botMessageIds.push(msg.message_id);
  }
});

bot.launch();

console.log('Bot is running...');

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
