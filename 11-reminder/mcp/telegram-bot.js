import { Telegraf } from "telegraf";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { TELEGRAM_BOT_TOKEN, OPENAI_API_KEY } from "../src/constants.js";
import { startDailySummaryCron } from "../src/cron/daily-summary.js";

function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
}

class TaskManagerBot {
  constructor() {
    if (!TELEGRAM_BOT_TOKEN) {
      throw new Error("TELEGRAM_BOT_TOKEN not set in environment");
    }
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not set in environment");
    }

    this.bot = new Telegraf(TELEGRAM_BOT_TOKEN);
    this.mcpClient = null;
    this.userSessions = new Map();
  }

  async connectMCP() {
    log('INFO', 'Connecting to MCP server...');
    const transport = new StdioClientTransport({
      command: "node",
      args: ["mcp/server.js"],
    });

    this.mcpClient = new Client(
      {
        name: "telegram-bot-client",
        version: "1.0.0",
      },
      {
        capabilities: {},
      }
    );

    await this.mcpClient.connect(transport);
    log('INFO', '✓ Connected to MCP server');
  }

  async callOpenAI(messages, tools = null) {
    const openaiMessages = messages.map(msg => {
      if (msg.role === 'system') {
        return { role: 'system', content: msg.text };
      } else if (msg.role === 'user') {
        return { role: 'user', content: msg.text };
      } else if (msg.role === 'assistant') {
        if (msg.toolCallList?.toolCalls) {
          return {
            role: 'assistant',
            content: null,
            tool_calls: msg.toolCallList.toolCalls.map(tc => ({
              id: tc.id,
              type: 'function',
              function: {
                name: tc.functionCall.name,
                arguments: JSON.stringify(tc.functionCall.arguments)
              }
            }))
          };
        }
        return { role: 'assistant', content: msg.text };
      } else if (msg.role === 'tool') {
        return {
          role: 'tool',
          tool_call_id: msg.tool_call_id,
          content: msg.content
        };
      }
      return { role: 'user', content: msg.text };
    });

    const payload = {
      model: "gpt-4o-mini",
      messages: openaiMessages,
      temperature: 0.7,
      max_tokens: 1000,
    };

    if (tools) {
      payload.tools = tools.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema,
        },
      }));
    }

    log('DEBUG', 'Calling OpenAI', { 
      messageCount: messages.length, 
      toolsCount: tools?.length || 0 
    });

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      log('ERROR', 'OpenAI API error', { error });
      throw new Error(`OpenAI API error: ${error}`);
    }

    const result = await response.json();
    log('DEBUG', 'OpenAI response received');
    return result;
  }

  async processMessage(chatId, userMessage) {
    log('INFO', `Processing message from chat ${chatId}`, { message: userMessage });

    const toolsList = await this.mcpClient.listTools();
    const tools = toolsList.tools;

    let messages = this.userSessions.get(chatId) || [];
    
    if (messages.length === 0) {
      messages.push({
        role: "system",
        text: `Ты ассистент для управления задачами. Используй доступные функции для выполнения действий.

ВАЖНО ПРО ДАТЫ:
- НИКОГДА не считай timestamp сам!
- ВСЕГДА используй функцию calculate_date для расчета дат
- calculate_date понимает ВС�Е форматы времени на русском языке:
  * Цифровой формат: "в 9:00", "в 10:15:30"
  * Разговорный: "в половине одиннадцатого", "без четверти восемь", "ровно в полдень"
  * Относительный: "через 5 минут", "через 2 часа", "через неделю", "через месяц"
  * С датой: "16 октября 2025 года в 09:10", "16.10.2025 в 14:30"
  * День недели: "в понедельник в 09:00", "в следующую среду в 15:00"
  * Простые: "сегодня в 15:00", "завтра в 10:00", "послезавтра"
- Передавай выражение точно как написал пользователь, без изменений

АЛГОРИТМ создания задачи:
1. Вызови calculate_date с выражением даты
2. Получи timestamp из результата
3. Вызови create_task с этим timestamp

АЛГОРИТМ обновления задачи:
1. Если нужна новая дата - вызови calculate_date
2. Вызови update_task с id задачи и новыми данными (name/description/date)
3. НЕ удаляй и не создавай заново - используй update_task!

ВАЖНО ПРО ОТОБРАЖЕНИЕ ЗАДАЧ:
- Если пользователь просит "задачи на сегодня", "на завтра", "на дату" - используй get_tasks_for_date с timestamp нужного дня
  Для получения timestamp дня используй calculate_date: "сегодня", "завтра", и т.д.
  get_tasks_for_date покажет ВСЕ задачи этого дня (и предстоящие, и просроченные)
- Если пользователь просит просто "список задач", "мои задачи", "покажи задачи" - используй get_all_tasks БЕЗ параметра (только невыполненные)
- Только если явно просит "все задачи" или "выполненные задачи" - используй get_all_tasks с include_completed: true

Правила:
- Отвечай кратко на русском
- Не проси подтверждений
- После вызова функции сообщи результат`,
      });
    }

    messages.push({
      role: "user",
      text: userMessage,
    });

    let maxIterations = 5;
    let iteration = 0;

    while (iteration < maxIterations) {
      iteration++;

      const aiResponse = await this.callOpenAI(messages, tools);
      const choice = aiResponse.choices[0];
      const message = choice.message;

      log('DEBUG', `AI response type`, { 
        hasContent: !!message.content, 
        hasToolCalls: !!message.tool_calls?.length,
        toolCalls: message.tool_calls?.map(t => t.function?.name) || []
      });

      // Add assistant message to history
      if (message.tool_calls) {
        messages.push({
          role: 'assistant',
          text: null,
          toolCallList: {
            toolCalls: message.tool_calls.map(tc => ({
              id: tc.id,
              functionCall: {
                name: tc.function.name,
                arguments: JSON.parse(tc.function.arguments)
              }
            }))
          }
        });
      } else {
        messages.push({
          role: 'assistant',
          text: message.content
        });
      }

      if (message.tool_calls) {
        for (const toolCall of message.tool_calls) {
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);

          log('INFO', `AI calling tool: ${functionName}`, functionArgs);

          const result = await this.mcpClient.callTool({
            name: functionName,
            arguments: functionArgs,
          });

          const resultText = result.content[0].text;
          log('INFO', `Tool ${functionName} result`, { result: resultText });

          // Parse and format task results
          let formattedResult = resultText;
          try {
            const parsed = JSON.parse(resultText);
            
            if (functionName === 'calculate_date' && parsed.success && parsed.timestamp) {
              // For date calculation, return just timestamp for AI to use
              formattedResult = `Timestamp: ${parsed.timestamp}`;
            } else if (parsed.success && parsed.tasks) {
              if (parsed.count === 0) {
                formattedResult = "📭 Задач не найдено";
              } else {
                const now = Date.now();
                const formatted = parsed.tasks.map((task, index) => {
                  const date = new Date(task.date);
                  const dateStr = `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
                  
                  let statusEmoji;
                  if (task.completed_at) {
                    statusEmoji = '✅';
                  } else if (task.date < now) {
                    statusEmoji = '🔴'; // просрочена
                  } else {
                    statusEmoji = '⏳';
                  }
                  
                  return `${index + 1}. ${statusEmoji} ${task.name}\n   📅 ${dateStr} (ID: ${task.id})`;
                }).join('\n\n');
                formattedResult = `📋 Найдено задач: ${parsed.count}\n\n${formatted}`;
              }
            } else if (parsed.success && parsed.task) {
              const task = parsed.task;
              const date = new Date(task.date);
              const dateStr = `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
              
              if (functionName === 'create_task') {
                formattedResult = `✨ Задача "${task.name}" создана\n📅 ${dateStr}`;
              } else if (functionName === 'update_task') {
                formattedResult = `✏️ Задача "${task.name}" обновлена\n📅 ${dateStr}`;
              } else if (functionName === 'complete_task') {
                formattedResult = `✅ Задача "${task.name}" выполнена`;
              } else if (functionName === 'uncomplete_task') {
                formattedResult = `↩️ У задачи "${task.name}" снята отметка о выполнении`;
              }
            } else if (parsed.success && functionName === 'delete_task') {
              formattedResult = `🗑️ Задача удалена`;
            }
          } catch (e) {
            // Keep original
          }

          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: formattedResult
          });
        }

        continue;
      }

      if (message.content) {
        this.userSessions.set(chatId, messages);
        log('INFO', `Responding to chat ${chatId}`, { response: message.content });
        return message.content;
      }

      break;
    }

    log('WARN', `Could not complete request for chat ${chatId}`);
    return "I couldn't complete the request. Please try again.";
  }

  setupHandlers() {
    this.bot.command("start", (ctx) => {
      const chatId = ctx.chat.id;
      this.userSessions.delete(chatId);
      ctx.reply(
        `👋 Welcome to Task Manager Bot!

I can help you manage your tasks using natural language.

Examples:
• "Add a task to finish report tomorrow at 3pm"
• "Show me tasks for today"
• "Mark task 5 as completed"
• "Delete task 3"

Just send me a message!`
      );
    });

    this.bot.command("clear", (ctx) => {
      const chatId = ctx.chat.id;
      this.userSessions.delete(chatId);
      ctx.reply("✓ Conversation cleared.");
    });

    this.bot.on("text", async (ctx) => {
      if (ctx.message.text.startsWith("/")) return;

      const chatId = ctx.chat.id;
      const text = ctx.message.text;
      const username = ctx.from.username || ctx.from.id;

      log('INFO', `Message from user @${username} (${chatId})`, { text });

      try {
        await ctx.sendChatAction("typing");
        const response = await this.processMessage(chatId, text);
        await ctx.reply(response);
        log('INFO', `Response sent to @${username}`);
      } catch (error) {
        log('ERROR', `Error processing message from @${username}`, { error: error.message, stack: error.stack });
        await ctx.reply(`❌ Error: ${error.message}`);
      }
    });
  }

  async start() {
    log('INFO', 'Starting bot...');
    
    await this.connectMCP();
    log('INFO', 'Setting up handlers...');
    
    this.setupHandlers();
    log('INFO', 'Launching bot...');
    
    // Launch with timeout
    const launchPromise = this.bot.launch();
    log('INFO', '✓ Ready to receive messages');
    log('INFO', 'Initializing cron task...');
    // Запуск крон-задачи для ежедневного саммари
    const cronTask = startDailySummaryCron();
    if (cronTask) {
      log('INFO', '✓ Daily summary cron job started');
    } else {
      log('WARN', 'Cron task not started (TELEGRAM_CHAT_ID missing?)');
    }

    process.once("SIGINT", () => {
      log('INFO', 'Received SIGINT, stopping bot...');
      if (cronTask) cronTask.stop();
      this.bot.stop("SIGINT");
    });
    process.once("SIGTERM", () => {
      log('INFO', 'Received SIGTERM, stopping bot...');
      if (cronTask) cronTask.stop();
      this.bot.stop("SIGTERM");
    });
  }
}

const bot = new TaskManagerBot();
bot.start().catch((error) => {
  log('ERROR', 'Bot startup error', { error: error.message, stack: error.stack });
  console.error("Bot error:", error);
  process.exit(1);
});

