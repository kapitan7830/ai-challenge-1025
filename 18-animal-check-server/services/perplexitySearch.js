import dotenv from 'dotenv';

dotenv.config();

export class PerplexitySearch {
  constructor() {
    this.apiKey = process.env.PERPLEXITY_API_KEY;
    this.baseUrl = 'https://api.perplexity.ai/search';
  }

  /**
   * Выполняет поисковый запрос через Perplexity API
   * @param {string} query - Поисковый запрос
   * @param {Object} options - Дополнительные параметры
   * @param {number} options.max_results - Максимальное количество результатов (по умолчанию 5)
   * @param {string[]} options.search_domain_filter - Фильтр доменов для поиска
   * @param {number} options.max_tokens_per_page - Максимальное количество токенов на страницу (по умолчанию 1024)
   * @param {string} options.country - Код страны (по умолчанию "US")
   * @returns {Promise<Object>} - Результаты поиска
   */
  async search(query, options = {}) {
    if (!query) {
      throw new Error('Query is required');
    }

    if (!this.apiKey) {
      throw new Error('PERPLEXITY_API_KEY is not set in environment variables');
    }

    const requestBody = {
      query,
      max_results: options.max_results || 5,
      max_tokens_per_page: options.max_tokens_per_page || 1024,
      country: options.country || 'RU'
    };

    // Добавляем фильтр доменов только если он указан
    if (options.search_domain_filter && options.search_domain_filter.length > 0) {
      requestBody.search_domain_filter = options.search_domain_filter;
    }

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Perplexity API Error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      return data;

    } catch (error) {
      throw new Error(`Failed to search via Perplexity: ${error.message}`);
    }
  }
}

