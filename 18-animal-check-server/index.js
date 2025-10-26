import dotenv from 'dotenv';
import { WebParser } from './utils/webParser.js';
import { AnimalDetectorAgent } from './agents/animalDetectorAgent.js';
import { ZoologistAgent } from './agents/zoologistAgent.js';
import { PerplexitySearch } from './services/perplexitySearch.js';
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
    
    // Шаг 3: Поиск информации через Perplexity
    logger.info('🔄 Шаг 3: Поиск научной информации о животных...');
    const perplexity = new PerplexitySearch();
    const animalsWithInfo = [];
    
    for (let i = 0; i < animals.length; i++) {
      const animal = animals[i];
      logger.info(`🔍 Поиск информации ${i + 1}/${animals.length}: ${animal.name}`);
      
      try {
        const query = `${animal.name} - морфология, биохимия, поведение, ареал обитания`;
        const searchResults = await perplexity.search(query, {
          max_results: 5,
          max_tokens_per_page: 1024,
          country: 'RU'
        });
        
        animalsWithInfo.push({
          ...animal,
          perplexityResults: searchResults
        });
        
        logger.success(`✅ Информация получена для ${animal.name}`);
      } catch (error) {
        logger.error(`❌ Ошибка поиска для ${animal.name}: ${error.message}`);
        animalsWithInfo.push({
          ...animal,
          perplexityResults: null
        });
      }
    }
    
    // Шаг 4: Получение научной справки (агент 2)
    logger.info('🔄 Шаг 4: Анализ и обобщение информации о животных...');
    const zoologist = new ZoologistAgent();
    const reports = await zoologist.getReports(animalsWithInfo);
    
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
