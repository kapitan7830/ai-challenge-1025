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
    const prompt = `Ты биолог и зоолог. Предоставь краткую научную справку о животном: ${animal.name}

Контекст упоминания: ${animal.context}

Предоставь информацию по следующим аспектам:

1. **Статус**: вымерло или нет
2. **Морфофизиология**: строение тела, физиология, генетика (кратко)
3. **Биохимия**: особенности метаболизма (если есть данные)
4. **Поведение**: способы питания, размножения, общения
5. **Ареал обитания**: где живет или жило
6. **Скрещивание**: способность к взаимоскрещиванию с образованием плодовитого потомства

ВАЖНО:
- Используй только достоверную информацию
- Если информации по какому-то пункту нет - напиши "информации нет"
- Не выдумывай данные
- Будь кратким но информативным

Верни результат СТРОГО в формате JSON:
{
  "animal": "название",
  "status": "вымершее/современное",
  "morphophysiology": "описание или 'информации нет'",
  "biochemistry": "описание или 'информации нет'",
  "behavior": "описание или 'информации нет'",
  "habitat": "описание или 'информации нет'",
  "crossbreeding": "описание или 'информации нет'"
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'Ты профессиональный биолог и зоолог. Предоставляешь только достоверную информацию. Отвечай только в формате JSON.'
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
      
      // Парсим JSON
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch (e) {
        logger.error(`Ошибка парсинга JSON для ${animal.name}: ${e.message}`);
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

