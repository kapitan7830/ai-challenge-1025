#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import { exec } from 'child_process';
import { promisify } from 'util';

dotenv.config();

const execAsync = promisify(exec);

/**
 * MCP Server для получения данных об уровне воды
 * Предоставляет инструменты для работы с данными о реке через Model Context Protocol
 */

// Создаем MCP сервер
const server = new Server(
  {
    name: 'river-level-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Обработчик: список доступных инструментов
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_river_level',
        description:
          'Получает текущие данные об уровне воды в реке (Сростки, Бийск, Барнаул) за последние 7 дней, включая прогноз и тренд.',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    ],
  };
});

// Обработчик: вызов инструментов
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'get_river_level': {
        // Выполняем команду через переменную окружения или алиас в shell
        const riverCommand = process.env.RIVER_COMMAND;
        
        console.error(`🌊 Выполняю команду...`);
        const { stdout, stderr } = await execAsync(riverCommand, { 
          shell: process.env.SHELL || '/bin/zsh'
        });

        if (stderr) {
          console.error('Stderr:', stderr);
        }
        
        console.error(`✅ Данные получены, длина: ${stdout.length} символов`);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  data: stdout,
                  timestamp: new Date().toISOString(),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: error.message,
              stack: error.stack,
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
});

// Запускаем сервер
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('🚀 MCP Server запущен!');
  console.error('📊 Доступные инструменты:');
  console.error('  - get_river_level: Получение данных об уровне воды');
  console.error('\n💡 Сервер ожидает команды через stdio...\n');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

