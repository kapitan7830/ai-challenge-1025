/**
 * Утилита для подсчета токенов
 * Для русского языка используем приблизительную оценку:
 * 1 токен ≈ 2.5 символа (кириллица менее эффективна чем латиница)
 */
export class TokenCounter {
  /**
   * Оценка количества токенов в тексте
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
   * YandexGPT-lite: ~0.3₽ за 1000 токенов
   */
  static estimateCost(tokens) {
    const costPerThousand = 0.3; // рубли
    return ((tokens / 1000) * costPerThousand).toFixed(4);
  }
}

