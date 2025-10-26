import OpenAI from 'openai';
import { logger } from '../utils/logger.js';

export class ZoologistAgent {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.model = 'gpt-4o-mini';
  }
  
  async getReports(animals) {
    const reports = [];
    
    for (let i = 0; i < animals.length; i++) {
      logger.info(`🔬 Получение справки ${i + 1}/${animals.length}: ${animals[i].name}`);
      
      const report = await this.analyzeAnimal(animals[i]);
      reports.push(report);
    }
    
    return reports;
  }
  
  async analyzeAnimal(animal) {
    // Формируем информацию из Perplexity
    let perplexityInfo = 'Информация из Perplexity не найдена.';
    let hasPerplexityData = false;
    
    if (animal.perplexityResults && animal.perplexityResults.results) {
      const results = animal.perplexityResults.results;
      logger.info({ 
        animalName: animal.name, 
        resultsCount: results.length,
        firstResultTitle: results[0]?.title,
        firstResultSnippetLength: results[0]?.snippet?.length
      }, 'Perplexity results received');
      
      if (results.length > 0) {
        hasPerplexityData = true;
        perplexityInfo = results.map((result, index) => {
          const snippet = result.snippet || 'Нет контента';
          return `
Источник ${index + 1}:
Заголовок: ${result.title || 'Без заголовка'}
URL: ${result.url || 'N/A'}
Контент: ${snippet.substring(0, 2000)}
`;
        }).join('\n---\n');
        
        logger.info({ 
          animalName: animal.name,
          totalInfoLength: perplexityInfo.length
        }, 'Formatted Perplexity info');
      }
    } else {
      logger.warn({ animalName: animal.name }, 'No Perplexity results in animal object');
    }
    
    let prompt;
    
    if (hasPerplexityData) {
      prompt = `Ты биолог и зоолог. Проанализируй информацию о животном: ${animal.name}

ИНФОРМАЦИЯ ИЗ ИСТОЧНИКОВ:
${perplexityInfo}

Твоя задача - извлечь и обобщить информацию по следующим категориям:

1. ОПИСАНИЕ - Что это за животное? К какой группе относится? Основные характеристики.
2. МОРФОФИЗИОЛОГИЯ - Размеры, строение тела, внешний вид, физиологические особенности.
3. ПОВЕДЕНИЕ - Как питается, размножается, ведет себя, особенности образа жизни.
4. АРЕАЛ ОБИТАНИЯ - Где обитает или обитало, географическое распространение, среда обитания.

ИНСТРУКЦИИ:
- Внимательно прочитай ВСЮ информацию из источников
- Извлекай ЛЮБУЮ относящуюся к делу информацию для каждой категории
- Пиши на РУССКОМ языке, кратко (2-4 предложения на категорию)
- Если в источниках ДЕЙСТВИТЕЛЬНО нет информации по категории - только тогда пиши "Информация недостаточна"
- НЕ пиши "Информация недостаточна" если хоть что-то есть - используй ту информацию что есть

Верни результат в формате JSON:
{
  "animal": "${animal.name}",
  "description": "текст описания",
  "morphophysiology": "текст о морфологии и физиологии",
  "behavior": "текст о поведении",
  "habitat": "текст об ареале обитания"
}`;
    } else {
      // Fallback: используем общие знания модели если Perplexity не вернул данные
      prompt = `Ты биолог и зоолог. Предоставь краткую научную справку о животном: ${animal.name}

Контекст упоминания: ${animal.context}

Создай краткую научную справку по следующим аспектам:

1. **Описание**: краткое описание животного
2. **Морфофизиология**: строение тела, физиология, генетика (кратко)
3. **Поведение**: способы питания, размножения, общения
4. **Ареал обитания**: где живет или жило

ВАЖНО:
- Используй достоверную информацию из твоих знаний
- Если информации по какому-то пункту недостаточно - напиши "Информации недостаточно"
- Будь кратким но информативным (2-3 предложения на пункт максимум)
- Отвечай на русском языке

Верни результат СТРОГО в формате JSON:
{
  "animal": "Название",
  "description": "Описание или 'Информации недостаточно'",
  "morphophysiology": "Описание или 'Информации недостаточно'",
  "behavior": "Описание или 'Информации недостаточно'",
  "habitat": "Описание или 'Информации недостаточно'"
}`;
    }

    try {
      const systemPrompt = hasPerplexityData 
        ? 'Ты профессиональный биолог и зоолог. Ты ДОЛЖЕН тщательно извлечь ВСЮ полезную информацию из предоставленных источников. Твоя задача - найти и обобщить информацию по каждой запрошенной категории. НЕ отвечай "Информации нет" если в источниках есть хоть какие-то данные. Отвечай только в формате JSON на русском языке.'
        : 'Ты профессиональный биолог и зоолог. Предоставь краткую достоверную научную информацию на основе своих знаний. Будь кратким и точным. Отвечай только в формате JSON.';
      
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1500,
        response_format: { type: 'json_object' }
      });
      
      const content = response.choices[0].message.content;
      
      logger.info({
        animalName: animal.name,
        contentLength: content.length,
        contentPreview: content.substring(0, 200)
      }, 'GPT response received');
      
      // Парсим JSON
      let parsed;
      try {
        parsed = JSON.parse(content);
        logger.info({ 
          animalName: animal.name, 
          hasDescription: !!parsed.description,
          hasMorphophysiology: !!parsed.morphophysiology,
          hasBehavior: !!parsed.behavior,
          hasHabitat: !!parsed.habitat,
          descriptionLength: parsed.description?.length || 0,
          morphophysiologyLength: parsed.morphophysiology?.length || 0,
          behaviorLength: parsed.behavior?.length || 0,
          habitatLength: parsed.habitat?.length || 0
        }, 'Animal report generated');
      } catch (e) {
        logger.error({ error: e.message, animalName: animal.name, content }, 'JSON parsing error');
        return {
          animal: animal.name,
          error: 'Ошибка парсинга ответа'
        };
      }
      
      return parsed;
      
    } catch (error) {
      logger.error(`Ошибка при анализе ${animal.name}: ${error.message}`);
      return {
        animal: animal.name,
        error: error.message
      };
    }
  }
}

