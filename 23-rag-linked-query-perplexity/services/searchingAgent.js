import OpenAI from 'openai';
import { logger } from '../utils/logger.js';

export class SearchingAgent {
  constructor(apiKey) {
    this.openai = new OpenAI({ apiKey });
    this.model = 'gpt-4o-mini';
  }

  /**
   * Ищет информацию по запросу пользователя через GPT
   */
  async searchInformation(userQuery) {
    try {
      logger.info(`Поиск информации через GPT: "${userQuery}"`);

      const systemPrompt = `Ты помощник, который помогает находить информацию по запросам пользователей.

Отвечай на вопросы пользователя на основе своих знаний, предоставляя точную и полезную информацию.`;

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

      logger.success('Информация найдена через GPT');
      return {
        found: true,
        content: response,
      };
    } catch (error) {
      logger.error('Ошибка при поиске информации:', error);
      throw error;
    }
  }

  close() {
    // Ничего не делаем, база не используется
  }
}

