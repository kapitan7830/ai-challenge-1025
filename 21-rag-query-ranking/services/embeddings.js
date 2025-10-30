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
   */
  async getEmbeddings(texts) {
    logger.info(
      `Запрашиваю эмбеддинги для ${texts.length} чанков через OpenAI (${this.model})`
    );

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

      logger.info('Информация о модели:', {
        model: response.model,
        dimensions: response.data[0]?.embedding.length,
        usage: response.usage,
      });

      return response.data.map(item => ({
        embedding: item.embedding,
        index: item.index,
      }));
    } catch (error) {
      logger.error('Ошибка при получении эмбеддингов:', error);
      throw error;
    }
  }

  /**
   * Получает эмбеддинг для одного текста
   */
  async getEmbedding(text) {
    const embeddings = await this.getEmbeddings([text]);
    return embeddings[0].embedding;
  }
}

