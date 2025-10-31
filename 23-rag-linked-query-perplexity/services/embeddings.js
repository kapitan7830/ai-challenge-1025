import OpenAI from 'openai';
import { logger } from '../utils/logger.js';

export class EmbeddingsService {
  constructor(apiKey) {
    this.openai = new OpenAI({
      apiKey: apiKey,
    });
    this.model = 'text-embedding-3-small';
  }

  /**
   * Получает эмбеддинги для массива текстов
   * Автоматически разбивает на батчи для больших массивов
   */
  async getEmbeddings(texts) {
    const BATCH_SIZE = 500; // Безопасный размер батча для OpenAI API
    
    logger.info(
      `Запрашиваю эмбеддинги для ${texts.length} чанков через OpenAI (${this.model})`
    );

    // Если текстов меньше батча, отправляем одним запросом
    if (texts.length <= BATCH_SIZE) {
      return await this._getEmbeddingsBatch(texts);
    }

    // Иначе разбиваем на батчи
    const batches = [];
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      batches.push(texts.slice(i, i + BATCH_SIZE));
    }

    logger.info(`Разбито на ${batches.length} батчей по ${BATCH_SIZE} чанков`);

    const allEmbeddings = [];
    let totalUsage = { prompt_tokens: 0, total_tokens: 0 };

    for (let i = 0; i < batches.length; i++) {
      logger.info(`Обрабатываю батч ${i + 1}/${batches.length}...`);
      const result = await this._getEmbeddingsBatch(batches[i], i * BATCH_SIZE);
      allEmbeddings.push(...result.embeddings);
      totalUsage.prompt_tokens += result.usage.prompt_tokens;
      totalUsage.total_tokens += result.usage.total_tokens;
    }

    logger.success(`Все батчи обработаны. Всего использовано токенов: ${totalUsage.total_tokens}`);

    return allEmbeddings;
  }

  /**
   * Получает эмбеддинги для одного батча текстов
   */
  async _getEmbeddingsBatch(texts, startIndex = 0) {
    try {
      const startTime = Date.now();

      const response = await this.openai.embeddings.create({
        model: this.model,
        input: texts,
      });

      const duration = Date.now() - startTime;

      logger.success(
        `Получены эмбеддинги для ${response.data.length} чанков за ${duration}ms`
      );

      if (startIndex === 0) {
        logger.info('Информация о модели:', {
          model: response.model,
          dimensions: response.data[0]?.embedding.length,
          usage: response.usage,
        });
      }

      const embeddings = response.data.map(item => ({
        embedding: item.embedding,
        index: startIndex + item.index,
      }));

      return {
        embeddings,
        usage: response.usage,
      };
    } catch (error) {
      logger.error('Ошибка при получении эмбеддингов:', error);
      throw error;
    }
  }

  /**
   * Получает эмбеддинг для одного текста
   */
  async getEmbedding(text) {
    const result = await this._getEmbeddingsBatch([text]);
    return result.embeddings[0].embedding;
  }
}

