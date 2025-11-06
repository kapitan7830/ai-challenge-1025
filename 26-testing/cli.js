#!/usr/bin/env node
import { resolve, basename, extname } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { logger } from './utils/logger.js';

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  logger.error('Не найден OPENAI_API_KEY в переменных окружения');
  process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// Создаем директории если их нет
const sourceDir = resolve('./source');
const testDir = resolve('./test');

if (!existsSync(sourceDir)) {
  mkdirSync(sourceDir, { recursive: true });
  writeFileSync(resolve(sourceDir, '.gitkeep'), '');
}

if (!existsSync(testDir)) {
  mkdirSync(testDir, { recursive: true });
  writeFileSync(resolve(testDir, '.gitkeep'), '');
}

async function generateTests(filePath) {
  logger.separator();
  logger.info(`📂 Анализирую файл: ${filePath}`);
  
  if (!existsSync(filePath)) {
    logger.error(`Файл не найден: ${filePath}`);
    process.exit(1);
  }

  // Читаем содержимое файла
  const code = readFileSync(filePath, 'utf-8');
  logger.success('Файл прочитан');

  // Генерируем тесты с помощью GPT-4
  logger.info('🤖 Генерирую юнит-тесты...');
  
  const fileName = basename(filePath, extname(filePath));
  const relativePath = `../source/${fileName}.js`;
  
  const prompt = `Проанализируй следующий JavaScript код и создай полный набор юнит-тестов для него используя Jest.

Требования:
1. Тесты должны покрывать все функции и методы
2. Включай edge cases и error handling
3. Используй jest.mock() если нужны моки
4. Тесты должны быть готовы к запуску без изменений
5. Верни ТОЛЬКО код тестов, без объяснений и markdown
6. ВАЖНО: Импорт модуля должен быть: import { ... } from '${relativePath}';

Код для тестирования:
\`\`\`javascript
${code}
\`\`\`

Верни готовые тесты:`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'Ты эксперт по написанию юнит-тестов для JavaScript. Пиши качественные, полные тесты используя Jest.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.3,
  });

  let testCode = completion.choices[0].message.content;
  
  // Убираем markdown если есть
  testCode = testCode.replace(/```javascript\n?/g, '').replace(/```\n?/g, '').trim();
  
  // Убеждаемся что импорт правильный
  testCode = testCode.replace(
    /from ['"]\.\/path\/to\/your\/module['"];?/g,
    `from '${relativePath}';`
  );
  
  logger.success('Тесты сгенерированы');

  // Сохраняем тесты
  const testFilePath = resolve(testDir, `${fileName}.test.js`);
  
  writeFileSync(testFilePath, testCode, 'utf-8');
  logger.success(`💾 Тесты сохранены: ${testFilePath}`);

  return testFilePath;
}

async function runTests(testFilePath) {
  logger.separator();
  logger.info('🧪 Запускаю тесты...');
  logger.separator();
  
  try {
    const output = execSync(`npx jest ${testFilePath} --verbose`, {
      encoding: 'utf-8',
      stdio: 'inherit',
    });
    
    logger.separator();
    logger.success('✅ Все тесты пройдены!');
  } catch (error) {
    logger.separator();
    logger.error('❌ Тесты завершились с ошибками');
    process.exit(1);
  }
}

// Main
const filePath = process.argv[2];

if (!filePath) {
  logger.error('Использование: node cli.js <путь_к_файлу>');
  logger.info('Пример: node cli.js ./source/calculator.js');
  process.exit(1);
}

const resolvedPath = resolve(filePath);

(async () => {
  try {
    const testFilePath = await generateTests(resolvedPath);
    await runTests(testFilePath);
  } catch (error) {
    logger.error('Произошла ошибка:', error.message);
    process.exit(1);
  }
})();

