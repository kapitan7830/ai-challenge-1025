#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { parseDateTimeExpression } from "../src/services/dateParserAgent.js";

const API_URL = process.env.API_URL || "http://localhost:3000/api";

function log(message, data = null) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [MCP] ${message}`, data ? JSON.stringify(data) : '');
}

const server = new Server(
  {
    name: "task-manager-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "calculate_date",
        description: "Вычисляет timestamp для выражений даты/времени на русском языке. ВСЕГДА используй перед созданием/обновлением задач. Понимает все форматы: цифровой (в 9:00), разговорный (в половине одиннадцатого), относительный (через 2 часа), с датой (16.10.2025 в 14:30), день недели (в понедельник в 09:00). Возвращает timestamp в миллисекундах.",
        inputSchema: {
          type: "object",
          properties: {
            expression: {
              type: "string",
              description: "Выражение даты/времени на русском языке. Передавай точно как написал пользователь. Примеры: 'в 9:00', 'в половине второго', 'через 15 минут', 'завтра в 10 утра', '16 октября 2025 года в 09:10', 'в понедельник в 09:00', 'через неделю', 'без четверти восемь', 'послезавтра в 18:00'"
            }
          },
          required: ["expression"],
        },
      },
      {
        name: "create_task",
        description: "Создать новую задачу. ОБЯЗАТЕЛЬНО вызывай для создания задач. Параметры: name (string), date (number - Unix timestamp в мс), description (опционально string).",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Название задачи (обязательно)",
            },
            description: {
              type: "string",
              description: "Описание задачи (опционально)",
            },
            date: {
              type: "number",
              description: "Дата/время задачи как Unix timestamp в миллисекундах. Получи из calculate_date.",
            },
          },
          required: ["name", "date"],
        },
      },
      {
        name: "get_tasks_for_date",
        description: "Получить ВСЕ задачи на конкретную дату (включая просроченные задачи этой даты). Используй когда пользователь просит 'задачи на сегодня', 'задачи на завтра', 'задачи на дату'. Возвращает задачи которые можно суммаризировать.",
        inputSchema: {
          type: "object",
          properties: {
            date: {
              type: "string",
              description: "Дата в ISO формате или timestamp в мс. Для 'сегодня' используй текущую дату, для 'завтра' - следующий день.",
            },
          },
          required: ["date"],
        },
      },
      {
        name: "get_all_tasks",
        description: "Получить задачи из системы, отсортированные по дате. По умолчанию возвращает только невыполненные. Используй когда пользователь просит показать/вывести задачи.",
        inputSchema: {
          type: "object",
          properties: {
            include_completed: {
              type: "boolean",
              description: "Включить выполненные задачи. По умолчанию false (только невыполненные). Используй true только если пользователь явно просит показать все/выполненные задачи.",
            },
          },
          required: [],
        },
      },
      {
        name: "update_task",
        description: "Обновить детали задачи (название, описание или дату). Используй когда пользователь хочет изменить задачу. Параметры: id (number), и любые из: name, description, date.",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "number",
              description: "ID задачи для обновления",
            },
            name: {
              type: "string",
              description: "Новое название задачи (опционально)",
            },
            description: {
              type: "string",
              description: "Новое описание задачи (опционально)",
            },
            date: {
              type: "number",
              description: "Новая дата задачи как Unix timestamp в мс (опционально). Получи из calculate_date.",
            },
          },
          required: ["id"],
        },
      },
      {
        name: "complete_task",
        description: "Отметить задачу выполненной. Используй когда пользователь говорит что задача выполнена. Параметр: id (number).",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "number",
              description: "ID задачи",
            },
          },
          required: ["id"],
        },
      },
      {
        name: "uncomplete_task",
        description: "Снять отметку о выполнении задачи. Используй когда пользователь хочет вернуть задачу в невыполненные. Параметр: id (number).",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "number",
              description: "ID задачи",
            },
          },
          required: ["id"],
        },
      },
      {
        name: "delete_task",
        description: "Удалить задачу навсегда. Используй когда пользователь хочет удалить/убрать задачу. Параметр: id (number).",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "number",
              description: "ID задачи для удаления",
            },
          },
          required: ["id"],
        },
      },
    ],
  };
});

// Функция расчета даты удалена - теперь используется AI агент parseDateTimeExpression

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  log(`Tool called: ${name}`, args);

  try {
    switch (name) {
      case "calculate_date": {
        const { expression } = args;
        
        if (!expression) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: "Missing expression",
                  message: "Provide date/time expression"
                }),
              },
            ],
          };
        }
        
        try {
          const currentTimestamp = Date.now();
          log(`Parsing date expression: "${expression}" (current time: ${new Date(currentTimestamp).toISOString()})`);
          
          const timestamp = await parseDateTimeExpression(expression, currentTimestamp);
          const date = new Date(timestamp);
          
          log(`Parsed "${expression}" -> ${timestamp} (${date.toISOString()})`);
          
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: true,
                  timestamp,
                  readable: date.toISOString(),
                  expression
                }),
              },
            ],
          };
        } catch (error) {
          log(`Error parsing date expression: ${error.message}`);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: "Date parsing failed",
                  message: error.message,
                  expression
                }),
              },
            ],
          };
        }
      }

      case "create_task": {
        const { name: taskName, description, date } = args;
        
        if (!taskName || !date) {
          log(`Missing required fields for create_task`, { taskName, date });
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: "Missing required information",
                  missing: [
                    !taskName && "name",
                    !date && "date/time"
                  ].filter(Boolean),
                  message: "Please provide the missing information to create the task"
                }),
              },
            ],
          };
        }

        // Parse date to timestamp
        let timestamp;
        if (!isNaN(date)) {
          timestamp = parseInt(date);
        } else {
          timestamp = new Date(date).getTime();
        }

        if (isNaN(timestamp)) {
          log(`Invalid date format: ${date}`);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: "Invalid date format",
                  message: "Please provide a valid date in ISO format or timestamp"
                }),
              },
            ],
          };
        }

        log(`Creating task via API`, { name: taskName, description, date: timestamp });
        const response = await fetch(`${API_URL}/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: taskName, description: description || "", date: timestamp })
        });

        if (!response.ok) {
          const error = await response.json();
          log(`API error creating task`, error);
          throw new Error(error.error || 'Failed to create task');
        }

        const task = await response.json();
        log(`Task created successfully`, task);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                task,
                message: "Task created successfully"
              }),
            },
          ],
        };
      }

      case "get_tasks_for_date": {
        const { date } = args;
        
        let timestamp;
        if (!isNaN(date)) {
          timestamp = parseInt(date);
        } else {
          timestamp = new Date(date).getTime();
        }

        log(`Getting tasks for date via API`, { date: timestamp });
        const response = await fetch(`${API_URL}/tasks?day=${timestamp}`);
        
        if (!response.ok) {
          const error = await response.json();
          log(`API error getting tasks`, error);
          throw new Error(error.error || 'Failed to get tasks');
        }

        const data = await response.json();
        log(`Retrieved ${data.count} tasks for date`);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                tasks: data.tasks,
                count: data.count,
                date: new Date(timestamp).toISOString()
              }),
            },
          ],
        };
      }

      case "get_all_tasks": {
        const includeCompleted = args.include_completed || false;
        log(`Getting tasks via API (include_completed: ${includeCompleted})`);
        const url = `${API_URL}/tasks?completed=${includeCompleted}`;
        const response = await fetch(url);
        
        if (!response.ok) {
          const error = await response.json();
          log(`API error getting tasks`, error);
          throw new Error(error.error || 'Failed to get tasks');
        }

        const data = await response.json();
        log(`Retrieved ${data.count} tasks`);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                tasks: data.tasks,
                count: data.count
              }),
            },
          ],
        };
      }

      case "update_task": {
        const { id, name, description, date } = args;
        
        const updates = {};
        if (name !== undefined) updates.name = name;
        if (description !== undefined) updates.description = description;
        if (date !== undefined) updates.date = date;
        
        log(`Updating task ${id} via API`, updates);
        const response = await fetch(`${API_URL}/tasks/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates)
        });
        
        if (!response.ok) {
          const error = await response.json();
          log(`API error updating task`, error);
          throw new Error(error.error || 'Failed to update task');
        }

        const task = await response.json();
        log(`Task ${id} updated successfully`);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                task,
                message: "Task updated successfully"
              }),
            },
          ],
        };
      }

      case "complete_task": {
        const { id } = args;
        
        log(`Отметка задачи ${id} выполненной через API`);
        const response = await fetch(`${API_URL}/tasks/${id}/complete`, {
          method: 'PATCH'
        });
        
        if (!response.ok) {
          const error = await response.json();
          log(`Ошибка API при отметке задачи`, error);
          throw new Error(error.error || 'Не удалось отметить задачу');
        }

        const task = await response.json();
        log(`Задача ${id} отмечена выполненной`);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                task,
                message: "Задача отмечена выполненной"
              }),
            },
          ],
        };
      }

      case "uncomplete_task": {
        const { id } = args;
        
        log(`Снятие отметки о выполнении задачи ${id} через API`);
        const response = await fetch(`${API_URL}/tasks/${id}/uncomplete`, {
          method: 'PATCH'
        });
        
        if (!response.ok) {
          const error = await response.json();
          log(`Ошибка API при снятии отметки`, error);
          throw new Error(error.error || 'Не удалось снять отметку');
        }

        const task = await response.json();
        log(`У задачи ${id} снята отметка о выполнении`);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                task,
                message: "Отметка о выполнении снята"
              }),
            },
          ],
        };
      }

      case "delete_task": {
        const { id } = args;
        
        log(`Удаление задачи ${id} через API`);
        const response = await fetch(`${API_URL}/tasks/${id}`, {
          method: 'DELETE'
        });
        
        if (!response.ok) {
          const error = await response.json();
          log(`Ошибка API при удалении задачи`, error);
          throw new Error(error.error || 'Не удалось удалить задачу');
        }

        log(`Задача ${id} успешно удалена`);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                message: "Задача успешно удалена"
              }),
            },
          ],
        };
      }

      default:
        log(`Unknown tool: ${name}`);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: `Unknown tool: ${name}` }),
            },
          ],
        };
    }
  } catch (error) {
    log(`Error in tool ${name}`, { error: error.message });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: error.message,
            success: false
          }),
        },
      ],
    };
  }
});

// Запуск сервера
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log("MCP сервер управления задачами запущен на stdio");
  log(`API URL: ${API_URL}`);
}

main().catch((error) => {
  log("Ошибка сервера", { error: error.message });
  console.error("Ошибка сервера:", error);
  process.exit(1);
});

