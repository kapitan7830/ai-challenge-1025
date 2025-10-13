#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import dotenv from 'dotenv';
import { CharacterAnalyzerAgent } from '../agents/CharacterAnalyzerAgent.js';
import { TextSummarizer } from '../utils/TextSummarizer.js';
import { TokenCounter } from '../utils/TokenCounter.js';

dotenv.config();

/**
 * MCP Server для анализа персонажей
 * Предоставляет инструменты для работы с текстами через Model Context Protocol
 */

// Инициализируем агентов
const analyzer = new CharacterAnalyzerAgent();
const summarizer = new TextSummarizer();

// Создаем MCP сервер
const server = new Server(
  {
    name: 'character-analyzer-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Определяем схемы для валидации инструментов
const AnalyzeCharactersSchema = z.object({
  text: z.string().describe('Текст рассказа для анализа персонажей'),
  autoSummarize: z
    .boolean()
    .optional()
    .describe('Автоматически суммаризировать текст если он слишком длинный (по умолчанию true)'),
});

const SummarizeTextSchema = z.object({
  text: z.string().describe('Текст для суммаризации'),
  chunkSize: z
    .number()
    .optional()
    .describe('Размер частей для разбиения (в токенах, по умолчанию 2000)'),
});

const EstimateTokensSchema = z.object({
  text: z.string().describe('Текст для оценки количества токенов'),
});

// Обработчик: список доступных инструментов
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'analyze_characters',
        description:
          'Анализирует текст рассказа и возвращает список всех персонажей с их характеристиками, психологическими портретами и ключевыми моментами. Автоматически обрабатывает длинные тексты через суммаризацию.',
        inputSchema: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'Текст рассказа для анализа',
            },
            autoSummarize: {
              type: 'boolean',
              description:
                'Автоматически суммаризировать если текст превышает лимит (по умолчанию true)',
              default: true,
            },
          },
          required: ['text'],
        },
      },
      {
        name: 'summarize_text',
        description:
          'Суммаризирует длинный текст, разбивая его на части, обрабатывая каждую и объединяя результаты. Сохраняет всех персонажей и ключевые детали сюжета.',
        inputSchema: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'Текст для суммаризации',
            },
            chunkSize: {
              type: 'number',
              description: 'Размер частей для разбиения в токенах (по умолчанию 2000)',
              default: 2000,
            },
          },
          required: ['text'],
        },
      },
      {
        name: 'estimate_tokens',
        description:
          'Оценивает количество токенов в тексте (для русского языка ~1 токен на 2.5 символа). Полезно для проверки, нужна ли суммаризация.',
        inputSchema: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'Текст для оценки',
            },
          },
          required: ['text'],
        },
      },
      {
        name: 'check_token_limit',
        description:
          'Проверяет, превышает ли текст указанный лимит токенов. Возвращает true/false и рекомендации.',
        inputSchema: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'Текст для проверки',
            },
            limit: {
              type: 'number',
              description: 'Лимит токенов (по умолчанию 6000)',
              default: 6000,
            },
          },
          required: ['text'],
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
      case 'analyze_characters': {
        const { text, autoSummarize = true } = AnalyzeCharactersSchema.parse(args);

        const startTime = Date.now();
        const originalTokens = TokenCounter.estimate(text);

        let textToAnalyze = text;
        let summarizationStats = null;

        // Проверяем, нужна ли суммаризация
        if (autoSummarize && TokenCounter.exceedsLimit(text, 6000)) {
          const summaryResult = await summarizer.summarize(text);
          textToAnalyze = summaryResult.summary;
          summarizationStats = summaryResult;
        }

        // Анализируем персонажей
        const analysisResult = await analyzer.analyzeCharacters(textToAnalyze);

        const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  characters: analysisResult.analysis,
                  noCharactersFound: analysisResult.noCharactersFound,
                  statistics: {
                    originalTokens,
                    processedTokens: summarizationStats
                      ? summarizationStats.summaryTokens
                      : originalTokens,
                    summarizationUsed: !!summarizationStats,
                    summarizationStats: summarizationStats
                      ? {
                          chunks: summarizationStats.chunks.length,
                          compressionRatio: summarizationStats.compressionRatio,
                          totalTime: summarizationStats.totalTime,
                        }
                      : null,
                    analysisTokens: analysisResult.usage.total_tokens,
                    totalTime: parseFloat(totalTime),
                    model: analysisResult.model,
                  },
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'summarize_text': {
        const { text, chunkSize = 2000 } = SummarizeTextSchema.parse(args);

        const originalTokens = TokenCounter.estimate(text);
        const result = await summarizer.summarize(text);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  summary: result.summary,
                  statistics: {
                    originalTokens,
                    summaryTokens: result.summaryTokens,
                    chunks: result.chunks.length,
                    compressionRatio: result.compressionRatio,
                    totalTime: result.totalTime,
                    chunkDetails: result.chunks.map((chunk) => ({
                      index: chunk.chunkIndex,
                      originalTokens: chunk.originalTokens,
                      summaryTokens: chunk.summaryTokens,
                      compressionRatio: (chunk.summaryTokens / chunk.originalTokens).toFixed(2),
                      time: chunk.responseTime.toFixed(2),
                    })),
                  },
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'estimate_tokens': {
        const { text } = EstimateTokensSchema.parse(args);

        const tokens = TokenCounter.estimate(text);
        const characters = text.length;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  tokens,
                  characters,
                  ratio: (characters / tokens).toFixed(2),
                  estimatedCost: TokenCounter.estimateCost(tokens),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'check_token_limit': {
        const schema = z.object({
          text: z.string(),
          limit: z.number().optional().default(6000),
        });

        const { text, limit } = schema.parse(args);

        const tokens = TokenCounter.estimate(text);
        const exceeds = TokenCounter.exceedsLimit(text, limit);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  tokens,
                  limit,
                  exceeds,
                  percentage: ((tokens / limit) * 100).toFixed(1),
                  recommendation: exceeds
                    ? 'Рекомендуется использовать суммаризацию'
                    : 'Текст помещается в лимит, суммаризация не требуется',
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
  console.error('  - analyze_characters: Анализ персонажей в тексте');
  console.error('  - summarize_text: Суммаризация длинных текстов');
  console.error('  - estimate_tokens: Оценка количества токенов');
  console.error('  - check_token_limit: Проверка превышения лимита');
  console.error('\n💡 Сервер ожидает команды через stdio...\n');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

