import OpenAI from 'openai';
import { TextChunker } from '../utils/textChunker.js';
import { logger } from '../utils/logger.js';

export class AnimalDetectorAgent {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.model = 'gpt-4o-mini';
    this.chunker = new TextChunker();
  }
  
  async findAnimals(text) {
    const chunks = this.chunker.splitText(text);
    
    if (chunks.length > 1) {
      logger.info(`📦 Текст разбит на ${chunks.length} частей для обработки`);
    }
    
    const allAnimals = [];
    
    for (let i = 0; i < chunks.length; i++) {
      logger.info(`🔍 Обработка части ${i + 1}/${chunks.length}...`);
      
      const animals = await this.analyzeChunk(chunks[i], i + 1);
      
      if (animals && animals.length > 0) {
        allAnimals.push(...animals);
        logger.info(`   Найдено животных: ${animals.length}`);
      }
    }
    
    // Объединяем и убираем дубликаты
    const uniqueAnimals = this.mergeAnimals(allAnimals);
    
    return uniqueAnimals;
  }
  
  async analyzeChunk(text, chunkNumber) {
    const prompt = `Проанализируй текст и найди все упоминания животных.

Под "животными" понимаются все живые существа кроме человека: млекопитающие, птицы, рыбы, насекомые, пауки, моллюски, черви, рептилии, амфибии и т.д.

Для каждого найденного животного укажи:
1. Название животного (на русском)
2. Контекст упоминания (1-3 предложения)

Верни результат СТРОГО в формате JSON:
[
  {
    "name": "название животного",
    "context": "краткое описание контекста"
  }
]

Если животных нет - верни пустой массив: []

Текст для анализа:
${text}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'Ты эксперт по анализу текстов и поиску упоминаний животных. Отвечай только в формате JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });
      
      const content = response.choices[0].message.content;
      
      // Парсим JSON
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch (e) {
        logger.error(`Ошибка парсинга JSON в части ${chunkNumber}: ${e.message}`);
        return [];
      }
      
      // Проверяем формат
      if (Array.isArray(parsed)) {
        return parsed;
      } else if (parsed.animals && Array.isArray(parsed.animals)) {
        return parsed.animals;
      } else if (parsed.result && Array.isArray(parsed.result)) {
        return parsed.result;
      }
      
      return [];
      
    } catch (error) {
      logger.error(`Ошибка при анализе части ${chunkNumber}: ${error.message}`);
      throw error;
    }
  }
  
  mergeAnimals(animals) {
    const merged = new Map();
    
    for (const animal of animals) {
      const name = animal.name.toLowerCase().trim();
      
      if (merged.has(name)) {
        // Объединяем контексты
        const existing = merged.get(name);
        existing.context += ' ' + animal.context;
      } else {
        merged.set(name, {
          name: animal.name,
          context: animal.context
        });
      }
    }
    
    const result = Array.from(merged.values());
    
    if (animals.length > result.length) {
      logger.info(`🔄 Объединены дубликаты: ${animals.length} → ${result.length}`);
    }
    
    return result;
  }
}

