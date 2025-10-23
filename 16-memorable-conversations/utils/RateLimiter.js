/**
 * Rate Limiter для OpenAI API
 * 
 * Лимиты OpenAI GPT-3.5-turbo:
 * - 3,500 запросов в минуту
 * - 90,000 токенов в минуту
 * 
 * Лимиты OpenAI GPT-4:
 * - 500 запросов в минуту
 * - 10,000 токенов в минуту
 */

export class RateLimiter {
  constructor() {
    this.requests = new Map(); // timestamp -> count
    this.tokens = new Map(); // timestamp -> count
    this.windowSize = 60 * 1000; // 1 минута в миллисекундах
    
    // Лимиты для разных моделей
    this.limits = {
      'gpt-3.5-turbo': {
        requestsPerMinute: 3000, // оставляем запас
        tokensPerMinute: 80000,  // оставляем запас
      },
      'gpt-4': {
        requestsPerMinute: 400,  // оставляем запас
        tokensPerMinute: 8000,   // оставляем запас
      },
      'gpt-4o': {
        requestsPerMinute: 400,  // оставляем запас
        tokensPerMinute: 25000,  // GPT-4o имеет больший лимит
      },
      'gpt-4o-mini': {
        requestsPerMinute: 400,  // оставляем запас
        tokensPerMinute: 150000, // GPT-4o-mini имеет огромный лимит токенов
      }
    };
  }

  /**
   * Очистить старые записи (старше 1 минуты)
   */
  cleanup() {
    const now = Date.now();
    const cutoff = now - this.windowSize;

    // Очищаем старые запросы
    for (const [timestamp] of this.requests) {
      if (timestamp < cutoff) {
        this.requests.delete(timestamp);
      }
    }

    // Очищаем старые токены
    for (const [timestamp] of this.tokens) {
      if (timestamp < cutoff) {
        this.tokens.delete(timestamp);
      }
    }
  }

  /**
   * Получить текущее количество запросов в окне
   */
  getCurrentRequests() {
    this.cleanup();
    return Array.from(this.requests.values()).reduce((sum, count) => sum + count, 0);
  }

  /**
   * Получить текущее количество токенов в окне
   */
  getCurrentTokens() {
    this.cleanup();
    return Array.from(this.tokens.values()).reduce((sum, count) => sum + count, 0);
  }

  /**
   * Зарегистрировать запрос
   */
  recordRequest(tokens = 0) {
    const now = Date.now();
    
    // Записываем запрос
    this.requests.set(now, (this.requests.get(now) || 0) + 1);
    
    // Записываем токены
    if (tokens > 0) {
      this.tokens.set(now, (this.tokens.get(now) || 0) + tokens);
    }
  }

  /**
   * Проверить, можно ли сделать запрос
   */
  canMakeRequest(model = 'gpt-3.5-turbo', estimatedTokens = 0) {
    this.cleanup();
    
    const limit = this.limits[model] || this.limits['gpt-3.5-turbo'];
    const currentRequests = this.getCurrentRequests();
    const currentTokens = this.getCurrentTokens();

    return {
      canRequest: currentRequests < limit.requestsPerMinute,
      canTokens: (currentTokens + estimatedTokens) < limit.tokensPerMinute,
      currentRequests,
      currentTokens,
      limit
    };
  }

  /**
   * Получить время ожидания до следующего доступного слота
   */
  getWaitTime(model = 'gpt-3.5-turbo', estimatedTokens = 0) {
    const check = this.canMakeRequest(model, estimatedTokens);
    
    if (check.canRequest && check.canTokens) {
      return 0; // Можно делать запрос сейчас
    }

    // Находим самый старый запрос в окне
    const oldestRequest = Math.min(...Array.from(this.requests.keys()));
    const oldestTokens = Math.min(...Array.from(this.tokens.keys()));
    
    const oldest = Math.min(oldestRequest, oldestTokens);
    const waitTime = (oldest + this.windowSize) - Date.now();
    
    return Math.max(0, waitTime);
  }

  /**
   * Ожидать доступности для запроса
   */
  async waitForAvailability(model = 'gpt-3.5-turbo', estimatedTokens = 0) {
    const waitTime = this.getWaitTime(model, estimatedTokens);
    
    if (waitTime > 0) {
      console.log(`⏳ Rate limit: ожидание ${(waitTime / 1000).toFixed(1)}с для модели ${model}`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  /**
   * Получить статистику использования
   */
  getStats(model = 'gpt-3.5-turbo') {
    this.cleanup();
    const limit = this.limits[model] || this.limits['gpt-3.5-turbo'];
    
    return {
      requests: {
        current: this.getCurrentRequests(),
        limit: limit.requestsPerMinute,
        percentage: (this.getCurrentRequests() / limit.requestsPerMinute * 100).toFixed(1)
      },
      tokens: {
        current: this.getCurrentTokens(),
        limit: limit.tokensPerMinute,
        percentage: (this.getCurrentTokens() / limit.tokensPerMinute * 100).toFixed(1)
      }
    };
  }
}

// Глобальный экземпляр rate limiter
export const rateLimiter = new RateLimiter();
