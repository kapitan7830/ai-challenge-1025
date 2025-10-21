import OpenAI from 'openai';
import dotenv from 'dotenv';
import { retryHandler } from './RetryHandler.js';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Утилита для подсчета токенов с использованием OpenAI API
 */
export class TokenCounter {
  /**
   * Точный подсчет токенов через OpenAI API с rate limiting
   * @param {string} text - Текст для подсчета
   * @returns {Promise<number>} - Точное количество токенов
   */
  static async countTokens(text) {
    if (!text) return 0;
    
    try {
      const response = await retryHandler.executeOpenAIRequest(
        () => openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: text }],
          max_tokens: 1,
        }),
        'gpt-3.5-turbo',
        this.estimate(text)
      );
      
      return response.usage.prompt_tokens;
    } catch (error) {
      console.warn('Ошибка точного подсчета токенов, используем оценку:', error.message);
      return this.estimate(text);
    }
  }

  /**
   * Быстрая оценка количества токенов в тексте
   * @param {string} text - Текст для подсчета
   * @returns {number} - Приблизительное количество токенов
   */
  static estimate(text) {
    if (!text) return 0;
    
    // Для русского текста: ~2.5 символа на токен
    // Для английского: ~4 символа на токен
    // Используем среднее значение с учетом смешанного контента
    const CHARS_PER_TOKEN = 2.5;
    
    return Math.ceil(text.length / CHARS_PER_TOKEN);
  }

  /**
   * Проверка, превышает ли текст лимит
   * @param {string} text - Текст для проверки
   * @param {number} maxTokens - Максимальное количество токенов
   * @returns {boolean}
   */
  static exceedsLimit(text, maxTokens) {
    return this.estimate(text) > maxTokens;
  }

  /**
   * Форматирование статистики токенов
   * @param {Object} usage - Объект с данными о токенах
   * @returns {string}
   */
  static formatUsage(usage) {
    const { prompt_tokens, completion_tokens, total_tokens } = usage;
    return `📊 Вход: ${prompt_tokens} | Выход: ${completion_tokens} | Всего: ${total_tokens}`;
  }

  /**
   * Рассчитать примерную стоимость (для справки)
   * GPT-4: ~$0.03 за 1K токенов входа, ~$0.06 за 1K токенов выхода
   * GPT-3.5-turbo: ~$0.0015 за 1K токенов входа, ~$0.002 за 1K токенов выхода
   * GPT-4o: ~$0.005 за 1K токенов входа, ~$0.015 за 1K токенов выхода
   * GPT-4o-mini: ~$0.00015 за 1K токенов входа, ~$0.0006 за 1K токенов выхода
   */
  static estimateCost(usage, model = 'gpt-3.5-turbo') {
    const costs = {
      'gpt-4': { input: 0.03, output: 0.06 },
      'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
      'gpt-4o': { input: 0.005, output: 0.015 },
      'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    };
    
    const cost = costs[model] || costs['gpt-3.5-turbo'];
    const inputCost = (usage.prompt_tokens / 1000) * cost.input;
    const outputCost = (usage.completion_tokens / 1000) * cost.output;
    
    return (inputCost + outputCost).toFixed(4);
  }
}

