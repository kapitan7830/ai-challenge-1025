import { readFileSync } from 'fs';
import { resolve } from 'path';
import dotenv from 'dotenv';
import { logger } from './utils/logger.js';
import { SemanticChunker } from './utils/chunker.js';
import { EmbeddingsService } from './services/embeddings.js';
import { VectorStore } from './services/vectorStore.js';

dotenv.config();

async function main() {
  // Получаем путь к файлу из аргументов
  const filePath = process.argv[2];

  if (!filePath) {
    logger.error('Не указан путь к файлу');
    console.log('\nИспользование: npm start <путь к файлу>');
    console.log('Пример: npm start ./document.md');
    process.exit(1);
  }

  // Проверяем наличие API ключа
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logger.error('Не найден OPENAI_API_KEY в переменных окружения');
    logger.info('Создайте файл .env и добавьте: OPENAI_API_KEY=your_key_here');
    process.exit(1);
  }

  logger.separator();
  logger.info('🚀 Запуск пайплайна обработки документов');
  logger.separator();

  try {
    // ШАГ 1: Чтение файла
    logger.step(1, 5, 'Чтение файла');
    const absolutePath = resolve(filePath);
    const filename = absolutePath.split('/').pop();
    logger.info(`Читаю файл: ${filename}`);

    let content = readFileSync(absolutePath, 'utf-8');
    logger.success(`Файл прочитан успешно (${content.length} символов)`);
    
    // Если это HTML файл, вырезаем теги
    if (filename.endsWith('.html') || filename.endsWith('.htm')) {
      logger.info('Обнаружен HTML файл, удаляю теги...');
      content = content.replace(/<[^>]*>/g, ' ') // Удаляем HTML теги
                       .replace(/&nbsp;/g, ' ')   // Заменяем &nbsp; на пробел
                       .replace(/&lt;/g, '<')     // Декодируем HTML entities
                       .replace(/&gt;/g, '>')
                       .replace(/&amp;/g, '&')
                       .replace(/&quot;/g, '"')
                       .replace(/&#39;/g, "'")
                       .replace(/\s+/g, ' ')      // Множественные пробелы в один
                       .trim();
      logger.success(`HTML теги удалены, осталось ${content.length} символов`);
    }
    
    logger.separator();

    // ШАГ 2: Разбивка на чанки
    logger.step(2, 5, 'Разбивка текста на семантические чанки');
    const chunker = new SemanticChunker(2000, 15);
    const chunks = chunker.chunk(content);
    logger.separator();

    // ШАГ 3: Генерация эмбеддингов
    logger.step(3, 5, 'Генерация эмбеддингов через OpenAI');
    const embeddingsService = new EmbeddingsService(apiKey);
    const texts = chunks.map(chunk => chunk.text);
    const embeddings = await embeddingsService.getEmbeddings(texts);
    logger.separator();

    // ШАГ 4: Инициализация векторного хранилища
    logger.step(4, 5, 'Инициализация векторного хранилища (sqlite-vec)');
    const vectorStore = new VectorStore();
    vectorStore.initialize();
    logger.separator();

    // ШАГ 5: Сохранение в базу данных
    logger.step(5, 5, 'Сохранение данных в базу');
    const documentId = vectorStore.saveDocument(filename, chunks, embeddings);
    logger.separator();

    // Итоговая статистика
    logger.success('✨ Пайплайн успешно завершен!');
    logger.separator();
    
    const stats = vectorStore.getStats();
    logger.info('📊 Статистика базы данных:', stats);
    logger.info(`📄 Обработанный документ: ${filename} (ID: ${documentId})`);
    
    logger.separator();

    // Закрываем соединение
    vectorStore.close();
  } catch (error) {
    logger.separator();
    logger.error('❌ Ошибка при выполнении пайплайна:', error);
    process.exit(1);
  }
}

main();

