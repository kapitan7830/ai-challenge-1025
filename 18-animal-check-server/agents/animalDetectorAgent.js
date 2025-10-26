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
    const uniqueAnimals = await this.mergeAnimals(allAnimals);
    
    return uniqueAnimals;
  }
  
  async analyzeChunk(text, chunkNumber) {
    const prompt = `Проанализируй текст и найди все упоминания животных.

Под "животными" понимаются все живые существа кроме человека: млекопитающие, птицы, рыбы, насекомые, пауки, моллюски, черви, рептилии, амфибии и т.д.

Для каждого найденного животного укажи:
1. Название животного (на русском)
2. Контекст упоминания (1-3 предложения)

КРИТИЧЕСКИ ВАЖНО: 
- Включай ТОЛЬКО реальные названия животных (существительные), которые обозначают живые существа
- НЕ включай слова, которые не являются названиями животных: наречия (например "действительно"), прилагательные, глаголы, части речи
- НЕ включай названия частей тела или особенностей (например, "бивень", "хвост", "клык" - НЕТ, "слон" - ДА)
- НЕ включай общие категории (например: "птицы", "млекопитающие", "рептилии")
- Указывай только конкретные названия видов и родов (например: "гривистый волк", "голубь", "орангутанг", "велоцираптор")
- Если в тексте только общие упоминания без конкретных видов - верни пустой массив

Примеры ПРАВИЛЬНЫХ названий: "слон", "велоцираптор", "тираннозавр рекс", "кошка", "муха"
Примеры НЕПРАВИЛЬНЫХ (НЕ включай): "действительно", "красиво", "большой", "бивень", "животные", "млекопитающие"

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
            content: 'Ты эксперт-зоолог по анализу текстов и поиску упоминаний животных. Ты умеешь отличать названия животных от других слов. Включай в результат ТОЛЬКО существительные, которые являются названиями конкретных животных. Отвечай только в формате JSON.'
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
  
  async mergeAnimals(animals) {
    if (animals.length === 0) return [];
    if (animals.length === 1) return animals;
    
    // Шаг 1: Убираем точные дубликаты
    const uniqueByName = new Map();
    
    for (const animal of animals) {
      const name = animal.name.toLowerCase().trim();
      
      if (uniqueByName.has(name)) {
        const existing = uniqueByName.get(name);
        existing.context += ' ' + animal.context;
      } else {
        uniqueByName.set(name, {
          name: animal.name,
          context: animal.context
        });
      }
    }
    
    const afterExactMerge = Array.from(uniqueByName.values());
    
    if (afterExactMerge.length === 1) return afterExactMerge;
    
    // Шаг 2: Убираем семантические дубликаты через AI
    try {
      const names = afterExactMerge.map(a => a.name).join('\n');
      
      const prompt = `Проанализируй список животных и определи, какие из них являются вариантами ОДНОГО И ТОГО ЖЕ вида или группы.

Список животных:
${names}

ПРАВИЛА:
- Убери дубликаты: если есть "медведь" и "бурый медведь" - оставь только "бурый медведь" (более конкретное)
- Убери возрастные/половые варианты: "медведица", "медвежонок", "медвежата" - это все "медведь"
- Если указан конкретный вид (например "бурый медведь") - оставь его, а не общее "медведь"
- Если есть общее и конкретное название одного животного - оставь конкретное
- Разные виды оставь все (например "волк" и "медведь" - это разные животные)

Верни ТОЛЬКО уникальные виды животных в формате JSON:
{
  "animals": ["название1", "название2", ...]
}

Оставляй самые конкретные названия видов.`;

      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'Ты эксперт-зоолог. Твоя задача - убрать дубликаты и варианты одних и тех же видов животных из списка. Отвечай только в формате JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' }
      });
      
      const content = response.choices[0].message.content;
      const parsed = JSON.parse(content);
      
      if (parsed.animals && Array.isArray(parsed.animals)) {
        const uniqueNames = parsed.animals;
        const result = afterExactMerge.filter(animal => 
          uniqueNames.some(name => name.toLowerCase() === animal.name.toLowerCase())
        );
        
        logger.info({ 
          original: animals.length,
          afterExact: afterExactMerge.length,
          afterSemantic: result.length
        }, 'Animals merged');
        
        return result;
      }
    } catch (error) {
      logger.error({ error: error.message }, 'Error in semantic merge, using exact merge only');
    }
    
    // Если AI merge не сработал, возвращаем результат точного merge
    if (animals.length > afterExactMerge.length) {
      logger.info({ original: animals.length, merged: afterExactMerge.length }, 'Exact duplicates merged');
    }
    
    return afterExactMerge;
  }
  
  async validateAnimalName(name) {
    const prompt = `Проанализируй, является ли следующее слово или фраза названием животного.

Слово/фраза: "${name}"

КРИТЕРИИ ПРОВЕРКИ:
- Является ли это существительным, обозначающим живое существо (животное)?
- Включает: млекопитающие, птицы, рыбы, насекомые, пауки, моллюски, черви, рептилии, амфибии и т.д.
- НЕ включает: наречия (например "действительно"), прилагательные, глаголы, части речи
- НЕ включает: части тела (например "бивень", "хвост", "клык")
- НЕ включает: общие категории без конкретного вида (например "животные", "млекопитающие", "птицы")

Примеры ЖИВОТНЫХ: "слон", "велоцираптор", "тираннозавр рекс", "кошка", "муха", "снежный барс"
Примеры НЕ ЖИВОТНЫХ: "действительно", "красиво", "большой", "бивень", "животные", "млекопитающие"

Верни результат СТРОГО в формате JSON:
{
  "isAnimal": true или false,
  "reason": "краткое объяснение почему"
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'Ты эксперт-зоолог, который определяет, является ли слово или фраза названием животного. Отвечай только в формате JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' }
      });
      
      const content = response.choices[0].message.content;
      const parsed = JSON.parse(content);
      
      return parsed.isAnimal === true;
      
    } catch (error) {
      logger.error(`Ошибка при валидации названия животного: ${error.message}`);
      // В случае ошибки, лучше вернуть true чтобы не блокировать пользователя
      return true;
    }
  }
}

