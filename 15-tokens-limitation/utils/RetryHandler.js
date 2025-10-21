import { rateLimiter } from './RateLimiter.js';

/**
 * Обработчик повторных попыток для OpenAI API
 */
export class RetryHandler {
  constructor() {
    this.maxRetries = 3;
    this.baseDelay = 1000; // 1 секунда
    this.maxDelay = 30000; // 30 секунд
  }

  /**
   * Проверить, является ли ошибка временной (можно повторить)
   */
  isRetryableError(error) {
    if (!error) return false;

    const message = error.message?.toLowerCase() || '';
    const status = error.status || error.statusCode;

    // Rate limit ошибки
    if (status === 429 || message.includes('rate limit')) {
      return true;
    }

    // Временные ошибки сервера
    if (status >= 500 && status < 600) {
      return true;
    }

    // Таймауты
    if (message.includes('timeout') || message.includes('econnreset')) {
      return true;
    }

    // Ошибки сети
    if (message.includes('network') || message.includes('connection')) {
      return true;
    }

    return false;
  }

  /**
   * Вычислить задержку с экспоненциальным backoff
   */
  calculateDelay(attempt) {
    const delay = this.baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 1000; // добавляем случайность
    return Math.min(delay + jitter, this.maxDelay);
  }

  /**
   * Извлечь время ожидания из rate limit ошибки
   */
  extractRetryAfter(error) {
    const message = error.message || '';
    
    // Ищем "retry after" в сообщении
    const retryAfterMatch = message.match(/retry after (\d+)/i);
    if (retryAfterMatch) {
      return parseInt(retryAfterMatch[1]) * 1000; // конвертируем в миллисекунды
    }

    // Ищем время в секундах
    const secondsMatch = message.match(/(\d+)\s*seconds?/i);
    if (secondsMatch) {
      return parseInt(secondsMatch[1]) * 1000;
    }

    return null;
  }

  /**
   * Выполнить функцию с повторными попытками
   */
  async executeWithRetry(fn, context = '') {
    let lastError;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        console.log(`❌ Попытка ${attempt}/${this.maxRetries} неудачна${context ? ` (${context})` : ''}: ${error.message}`);
        
        // Если это не временная ошибка, не повторяем
        if (!this.isRetryableError(error)) {
          console.log(`❌ Ошибка не временная, прекращаем попытки`);
          throw error;
        }

        // Если это последняя попытка, выбрасываем ошибку
        if (attempt === this.maxRetries) {
          console.log(`❌ Исчерпаны все попытки (${this.maxRetries})`);
          throw error;
        }

        // Вычисляем задержку
        let delay = this.calculateDelay(attempt);
        
        // Если это rate limit ошибка, используем время из ошибки
        if (error.status === 429 || error.message?.toLowerCase().includes('rate limit')) {
          const retryAfter = this.extractRetryAfter(error);
          if (retryAfter) {
            delay = retryAfter;
            console.log(`⏳ Rate limit: ожидание ${(delay / 1000).toFixed(1)}с`);
          }
        }

        console.log(`⏳ Повторная попытка через ${(delay / 1000).toFixed(1)}с...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  /**
   * Выполнить запрос к OpenAI с rate limiting и повторными попытками
   */
  async executeOpenAIRequest(openaiCall, model = 'gpt-3.5-turbo', estimatedTokens = 0) {
    return await this.executeWithRetry(async () => {
      // Ждем доступности rate limiter
      await rateLimiter.waitForAvailability(model, estimatedTokens);
      
      // Выполняем запрос
      const result = await openaiCall();
      
      // Записываем использование в rate limiter
      const actualTokens = result.usage?.total_tokens || estimatedTokens;
      rateLimiter.recordRequest(actualTokens);
      
      return result;
    }, `OpenAI ${model}`);
  }
}

// Глобальный экземпляр retry handler
export const retryHandler = new RetryHandler();
