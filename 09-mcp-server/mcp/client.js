#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * MCP Client для подключения к серверу анализа персонажей
 * Демонстрирует как получить список доступных инструментов
 */

async function main() {
  console.log('🔌 Подключение к MCP серверу...\n');

  // Путь к MCP серверу
  const serverPath = join(__dirname, 'server.js');

  // Создаем транспорт для общения с сервером
  const transport = new StdioClientTransport({
    command: 'node',
    args: [serverPath],
  });

  // Создаем MCP клиент
  const client = new Client(
    {
      name: 'character-analyzer-mcp-client',
      version: '1.0.0',
    },
    {
      capabilities: {},
    }
  );

  try {
    // Подключаемся к серверу
    await client.connect(transport);
    console.log('✅ Подключено к MCP серверу!\n');

    // Получаем список доступных инструментов
    console.log('📋 Получение списка инструментов...\n');
    const toolsResponse = await client.listTools();

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔧 ДОСТУПНЫЕ ИНСТРУМЕНТЫ MCP');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (toolsResponse.tools && toolsResponse.tools.length > 0) {
      toolsResponse.tools.forEach((tool, index) => {
        console.log(`${index + 1}. 📦 ${tool.name}`);
        console.log(`   📝 Описание: ${tool.description}`);
        console.log(`   📊 Параметры:`);

        const schema = tool.inputSchema;
        if (schema && schema.properties) {
          Object.entries(schema.properties).forEach(([key, value]) => {
            const required = schema.required?.includes(key) ? '⚠️ обязательный' : 'опциональный';
            console.log(`      • ${key} (${value.type}) - ${required}`);
            console.log(`        ${value.description}`);
            if (value.default !== undefined) {
              console.log(`        По умолчанию: ${value.default}`);
            }
          });
        }
        console.log('');
      });

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`\n✨ Всего инструментов: ${toolsResponse.tools.length}\n`);

      // Пример использования инструмента
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🎯 ДЕМОНСТРАЦИЯ: Вызов инструмента');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      const testText = 'Маша шла по лесу. Вдруг она встретила волка по имени Серый.';

      console.log('📝 Тестовый текст:');
      console.log(`   "${testText}"\n`);

      // Вызываем estimate_tokens
      console.log('🔍 Вызов: estimate_tokens\n');
      const tokensResult = await client.callTool({
        name: 'estimate_tokens',
        arguments: {
          text: testText,
        },
      });

      const tokensData = JSON.parse(tokensResult.content[0].text);
      console.log('📊 Результат:');
      console.log(`   Токенов: ${tokensData.tokens}`);
      console.log(`   Символов: ${tokensData.characters}`);
      console.log(`   Соотношение: ${tokensData.ratio} символов/токен`);
      console.log(`   Примерная стоимость: ${tokensData.estimatedCost}₽\n`);

      // Вызываем check_token_limit
      console.log('🔍 Вызов: check_token_limit\n');
      const limitResult = await client.callTool({
        name: 'check_token_limit',
        arguments: {
          text: testText,
          limit: 6000,
        },
      });

      const limitData = JSON.parse(limitResult.content[0].text);
      console.log('📊 Результат:');
      console.log(`   Токенов: ${limitData.tokens} / ${limitData.limit}`);
      console.log(`   Использовано: ${limitData.percentage}%`);
      console.log(`   Превышен лимит: ${limitData.exceeds ? 'Да ⚠️' : 'Нет ✅'}`);
      console.log(`   Рекомендация: ${limitData.recommendation}\n`);

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ Демонстрация завершена!\n');
      console.log('💡 Для полного анализа персонажей используйте:');
      console.log('   await client.callTool({ name: "analyze_characters", arguments: { text: "..." } })\n');
    } else {
      console.log('⚠️  Инструменты не найдены\n');
    }
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error(error.stack);
  } finally {
    // Закрываем соединение
    await client.close();
    console.log('🔌 Соединение закрыто');
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

