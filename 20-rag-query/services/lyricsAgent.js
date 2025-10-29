import OpenAI from 'openai';
import { logger } from '../utils/logger.js';

export class LyricsAgent {
  constructor(apiKey) {
    this.openai = new OpenAI({ apiKey });
    this.model = 'gpt-4o-mini';
  }

  /**
   * Ищет текст песни по запросу пользователя
   */
  async findLyrics(userQuery) {
    try {
      logger.info(`Поиск текста песни: "${userQuery}"`);

      const systemPrompt = `Ты помощник, который помогает найти тексты песен.

ВАЖНО:
- Если ты знаешь ТОЧНЫЙ и ПОЛНЫЙ текст песни по запросу пользователя, верни её в формате:
  Название: [название песни]
  Автор: [автор(ы)]
  
  Текст:
  [полный текст песни]

- Если ты НЕ знаешь точный и полный текст песни, верни ТОЛЬКО: "Текст песни не найден"
- НИКОГДА не выдумывай тексты песен
- НИКОГДА не пиши приблизительные или частичные тексты
- НИКОГДА не пиши что можешь помочь с поиском или предлагай альтернативы
- Отвечай ТОЛЬКО если уверен на 100% что знаешь ВЕСЬ текст песни целиком`;

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: userQuery,
          },
        ],
        temperature: 0.1,
      });

      const response = completion.choices[0].message.content.trim();

      // Проверяем, найдена ли песня
      if (
        response.includes('Текст песни не найден') ||
        response.includes('не найден') ||
        response.toLowerCase().includes('not found')
      ) {
        logger.info('Текст песни не найден');
        return {
          found: false,
          message: 'Текст песни не найден',
        };
      }

      logger.success('Текст песни найден');
      return {
        found: true,
        lyrics: response,
      };
    } catch (error) {
      logger.error('Ошибка при поиске текста песни:', error);
      throw error;
    }
  }

  close() {
    // Ничего не делаем, база не используется
  }
}

