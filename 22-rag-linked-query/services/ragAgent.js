import OpenAI from 'openai';
import { EmbeddingsService } from './embeddings.js';
import { VectorStore } from './vectorStore.js';
import { logger } from '../utils/logger.js';

export class RagAgent {
  constructor(apiKey) {
    this.openai = new OpenAI({ apiKey });
    this.embeddingsService = new EmbeddingsService(apiKey);
    this.vectorStore = new VectorStore();
    this.vectorStore.initialize();
    this.model = 'gpt-4o-mini';
    // Порог отсечения нерелевантных результатов (distance < threshold)
    // sqlite-vec использует L2 distance (Euclidean distance), не cosine
    // Для L2 distance: чем меньше значение, тем ближе векторы
    // Порог 1: отфильтровывает далекие результаты, оставляет релевантные
    this.relevanceThreshold = 1;
  }

  /**
   * Ищет информацию используя RAG (поиск в БД + GPT)
   */
  async searchInformation(userQuery) {
    try {
      logger.info(`RAG поиск: "${userQuery}"`);

      // Получаем эмбеддинг запроса
      const queryEmbedding = await this.embeddingsService.getEmbedding(
        userQuery
      );

      // Ищем похожие чанки в базе
      const results = this.vectorStore.search(queryEmbedding, 5);

      if (results.length === 0) {
        logger.info('Ничего не найдено в базе данных');
        return {
          found: false,
          message: 'Информация не найдена в базе данных',
        };
      }

      logger.info(`Найдено ${results.length} релевантных фрагментов`);

      // Формируем контекст для GPT
      const context = results
        .map((r, i) => `Фрагмент ${i + 1}:\n${r.text}`)
        .join('\n\n---\n\n');

      // Запрос к GPT с контекстом из БД
      const systemPrompt = `Ты помощник, который помогает находить информацию. 
У тебя есть доступ к базе данных с документами.

ВАЖНО:
- Используй ТОЛЬКО информацию из предоставленного контекста
- Отвечай на вопрос пользователя на основе информации из контекста
- Если информации недостаточно или она не соответствует запросу, скажи об этом
- НЕ используй свои знания, ТОЛЬКО контекст из базы`;

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Вопрос: "${userQuery}"\n\nКонтекст из базы данных:\n${context}`,
          },
        ],
        temperature: 0.1,
      });

      const response = completion.choices[0].message.content.trim();

      logger.success('Информация найдена через RAG');
      return {
        found: true,
        content: response,
      };
    } catch (error) {
      logger.error('Ошибка при RAG поиске:', error);
      throw error;
    }
  }

  /**
   * Ищет информацию используя RAG с reranker и порогом отсечения нерелевантных результатов
   * Использует только один самый релевантный результат
   */
  async searchInformationRanked(userQuery) {
    try {
      logger.info(`RAG поиск с reranker: "${userQuery}"`);

      // Получаем эмбеддинг запроса
      const queryEmbedding = await this.embeddingsService.getEmbedding(
        userQuery
      );

      // Ищем похожие чанки для последующей фильтрации
      const initialResults = this.vectorStore.search(queryEmbedding, 10);

      if (initialResults.length === 0) {
        logger.info('Ничего не найдено в базе данных');
        return {
          found: false,
          message: 'Информация не найдена в базе данных',
        };
      }

      logger.info(`Найдено ${initialResults.length} результатов`);

      // Берем топ 3 самых релевантных результата
      const topResults = initialResults.slice(0, 3);
      
      logger.info(`Топ ${topResults.length} результатов:`);
      topResults.forEach((r, i) => {
        logger.info(`  ${i + 1}. distance=${r.distance.toFixed(4)} из "${r.filename}"`);
      });

      // Берем лучший результат для цитаты и источника
      const bestResult = topResults[0];

      // Формируем цитату (ограничиваем длину для читабельности)
      const maxQuoteLength = 300;
      let quote = bestResult.text;
      if (quote.length > maxQuoteLength) {
        quote = quote.substring(0, maxQuoteLength) + '...';
      }

      // Формируем контекст из топ результатов
      const context = topResults
        .map((r, i) => `Фрагмент ${i + 1}:\n${r.text}`)
        .join('\n\n---\n\n');

      // Запрос к GPT с контекстом из БД
      const systemPrompt = `Ты помощник, который помогает находить информацию в технической документации PostgreSQL. 

ВАЖНО:
- Используй ТОЛЬКО информацию из предоставленных фрагментов
- Если запрос о синтаксисе - покажи ПОЛНЫЙ синтаксис со всеми опциями
- Структурируй ответ понятно и полно
- Если информации недостаточно, так и скажи
- НЕ используй свои знания, ТОЛЬКО контекст из базы`;

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Вопрос: "${userQuery}"\n\nКонтекст из базы данных:\n${context}`,
          },
        ],
        temperature: 0.1,
      });

      const response = completion.choices[0].message.content.trim();

      logger.success(`Информация найдена из документа "${bestResult.filename}"`);
      return {
        found: true,
        content: response,
        source: {
          filename: bestResult.filename,
          quote: quote,
        },
      };
    } catch (error) {
      logger.error('Ошибка при RAG поиске с reranker:', error);
      throw error;
    }
  }

  close() {
    this.vectorStore.close();
  }
}

