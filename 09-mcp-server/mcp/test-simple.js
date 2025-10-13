#!/usr/bin/env node

/**
 * Простой тест MCP без подключения к серверу
 * Демонстрирует какие инструменты будут доступны
 */

const tools = [
  {
    name: 'analyze_characters',
    description:
      'Анализирует текст рассказа и возвращает список всех персонажей с их характеристиками, психологическими портретами и ключевыми моментами.',
    parameters: {
      text: { type: 'string', required: true, description: 'Текст рассказа для анализа' },
      autoSummarize: {
        type: 'boolean',
        required: false,
        default: true,
        description: 'Автоматически суммаризировать если текст превышает лимит',
      },
    },
  },
  {
    name: 'summarize_text',
    description:
      'Суммаризирует длинный текст, разбивая его на части, обрабатывая каждую и объединяя результаты.',
    parameters: {
      text: { type: 'string', required: true, description: 'Текст для суммаризации' },
      chunkSize: {
        type: 'number',
        required: false,
        default: 2000,
        description: 'Размер частей для разбиения в токенах',
      },
    },
  },
  {
    name: 'estimate_tokens',
    description: 'Оценивает количество токенов в тексте (для русского языка ~1 токен на 2.5 символа).',
    parameters: {
      text: { type: 'string', required: true, description: 'Текст для оценки' },
    },
  },
  {
    name: 'check_token_limit',
    description: 'Проверяет, превышает ли текст указанный лимит токенов.',
    parameters: {
      text: { type: 'string', required: true, description: 'Текст для проверки' },
      limit: {
        type: 'number',
        required: false,
        default: 6000,
        description: 'Лимит токенов',
      },
    },
  },
];

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔧 MCP ИНСТРУМЕНТЫ - Character Analyzer');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

tools.forEach((tool, index) => {
  console.log(`${index + 1}. 📦 ${tool.name}`);
  console.log(`   📝 ${tool.description}\n`);

  console.log('   📊 Параметры:');
  Object.entries(tool.parameters).forEach(([key, param]) => {
    const required = param.required ? '⚠️ обязательный' : '✅ опциональный';
    const defaultValue = param.default !== undefined ? ` (по умолчанию: ${param.default})` : '';
    console.log(`      • ${key} (${param.type}) - ${required}${defaultValue}`);
    console.log(`        ${param.description}`);
  });
  console.log('');
});

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`✨ Всего инструментов: ${tools.length}\n`);

console.log('💡 Примеры использования:\n');

console.log('1️⃣ Анализ персонажей:');
console.log(`   {
     "tool": "analyze_characters",
     "arguments": {
       "text": "Маша и волк встретились в лесу..."
     }
   }\n`);

console.log('2️⃣ Суммаризация текста:');
console.log(`   {
     "tool": "summarize_text",
     "arguments": {
       "text": "Очень длинный текст рассказа..."
     }
   }\n`);

console.log('3️⃣ Оценка токенов:');
console.log(`   {
     "tool": "estimate_tokens",
     "arguments": {
       "text": "Любой текст для оценки"
     }
   }\n`);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('🚀 Для запуска полноценного MCP сервера:');
console.log('   npm run mcp-server\n');
console.log('🧪 Для тестирования с клиентом:');
console.log('   npm run mcp-client\n');

