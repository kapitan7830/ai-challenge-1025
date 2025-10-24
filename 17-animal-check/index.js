import dotenv from 'dotenv';
import { WebParser } from './utils/webParser.js';
import { AnimalDetectorAgent } from './agents/animalDetectorAgent.js';
import { ZoologistAgent } from './agents/zoologistAgent.js';
import { logger } from './utils/logger.js';

dotenv.config();

async function main() {
  const url = process.argv[2];
  
  if (!url) {
    console.error('❌ Ошибка: не указана ссылка');
    console.log('Использование: npm start <URL>');
    process.exit(1);
  }
  
  logger.info('🚀 Запуск анализа животных с веб-страницы');
  logger.info(`📎 URL: ${url}`);
  
  try {
    // Шаг 1: Извлечение текста со страницы
    logger.info('🔄 Шаг 1: Извлечение текста со страницы...');
    const parser = new WebParser();
    const pageText = await parser.fetchText(url);
    
    if (!pageText || pageText.trim().length === 0) {
      logger.error('❌ Не удалось извлечь текст со страницы');
      process.exit(1);
    }
    
    logger.success(`✅ Текст извлечен: ${pageText.length} символов`);
    
    // Шаг 2: Поиск животных в тексте (агент 1)
    logger.info('🔄 Шаг 2: Анализ текста на упоминания животных...');
    const detector = new AnimalDetectorAgent();
    const animals = await detector.findAnimals(pageText);
    
    if (!animals || animals.length === 0) {
      logger.info('❌ Животные не найдены в тексте');
      logger.info('🛑 Процесс прерван');
      process.exit(0);
    }
    
    logger.success(`✅ Найдено животных: ${animals.length}`);
    logger.animals(animals);
    
    // Шаг 3: Получение научной справки (агент 2)
    logger.info('🔄 Шаг 3: Получение научных справок по животным...');
    const zoologist = new ZoologistAgent();
    const reports = await zoologist.getReports(animals);
    
    logger.success('✅ Научные справки получены');
    logger.reports(reports);
    
    logger.info('🎉 Анализ завершен успешно');
    
  } catch (error) {
    logger.error(`❌ Ошибка: ${error.message}`);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
