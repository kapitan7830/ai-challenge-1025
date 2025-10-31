import OpenAI from 'openai';
import { EmbeddingsService } from './embeddings.js';
import { VectorStore } from './vectorStore.js';
import { logger } from '../utils/logger.js';
import { PerplexityAdapter } from './perplexity/perplexity.adapter.js';

export class RagAgent {
  constructor(apiKey, perplexityApiKey = null) {
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
    this.perplexityAdapter = perplexityApiKey
      ? new PerplexityAdapter(perplexityApiKey)
      : null;
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

  /**
   * Ищет информацию с fallback в Perplexity
   * Если не найдено в базе - ищет в Perplexity, добавляет в базу и возвращает результат
   */
  async searchWithPerplexityFallback(userQuery) {
    try {
      logger.info(`Поиск с Perplexity fallback: "${userQuery}"`);

      // Получаем эмбеддинг запроса
      const queryEmbedding = await this.embeddingsService.getEmbedding(
        userQuery
      );

      // Ищем похожие чанки для последующей фильтрации
      const initialResults = this.vectorStore.search(queryEmbedding, 10);

      // Фильтруем по порогу релевантности (distance < threshold)
      const relevantResults = initialResults.filter(
        (r) => r.distance < this.relevanceThreshold
      );

      // Если нашли релевантные результаты в базе - работаем как обычно
      if (relevantResults.length > 0) {
        logger.info(
          `Найдено ${relevantResults.length} релевантных результатов в базе (distance < ${this.relevanceThreshold})`
        );

        const topResults = relevantResults.slice(0, 3);
        const bestResult = topResults[0];

        logger.info(`Топ ${topResults.length} результатов:`);
        topResults.forEach((r, i) => {
          logger.info(
            `  ${i + 1}. distance=${r.distance.toFixed(4)} из "${r.filename}"`
          );
        });

        const maxQuoteLength = 300;
        let quote = bestResult.text;
        if (quote.length > maxQuoteLength) {
          quote = quote.substring(0, maxQuoteLength) + '...';
        }

        const context = topResults
          .map((r, i) => `Фрагмент ${i + 1}:\n${r.text}`)
          .join('\n\n---\n\n');

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

        logger.success(
          `Информация найдена из документа "${bestResult.filename}"`
        );
        return {
          found: true,
          content: response,
          source: {
            filename: bestResult.filename,
            quote: quote,
            type: 'database',
          },
        };
      }

      // Если в базе ничего не нашли (или результаты нерелевантны)
      if (initialResults.length > 0) {
        logger.info(
          `Найдено ${initialResults.length} результатов, но все нерелевантны (distance >= ${this.relevanceThreshold})`
        );
        initialResults.slice(0, 3).forEach((r, i) => {
          logger.info(
            `  ${i + 1}. distance=${r.distance.toFixed(4)} из "${r.filename}"`
          );
        });
      } else {
        logger.info('В базе данных ничего не найдено');
      }

      if (!this.perplexityAdapter) {
        logger.info('Perplexity не настроен');
        return {
          found: false,
          message: 'Информация не найдена в базе данных',
        };
      }

      logger.info('Ищу в Perplexity...');

      // Ищем в Perplexity
      const perplexityResults = await this.perplexityAdapter.search({
        query: userQuery,
        max_results: 5,
      });

      if (!perplexityResults.results || perplexityResults.results.length === 0) {
        logger.info('Ничего не найдено в Perplexity');
        return {
          found: false,
          message: 'Информация не найдена ни в базе данных, ни в Perplexity',
        };
      }

      // Берем первый (наиболее релевантный) результат
      const bestPerplexityResult = perplexityResults.results[0];
      logger.info(`Найден результат в Perplexity: ${bestPerplexityResult.title}`);

      // Формируем текст для сохранения
      const textToSave = `${bestPerplexityResult.title}\n\n${bestPerplexityResult.snippet}`;

      // Создаем эмбеддинг для нового текста
      logger.info('Создаю эмбеддинг для результата из Perplexity...');
      const embedding = await this.embeddingsService.getEmbedding(textToSave);

      // Сохраняем в базу
      logger.info('Сохраняю результат в базу данных...');
      const chunk = {
        id: 0,
        text: textToSave,
        size: textToSave.length,
      };

      this.vectorStore.saveDocument(
        `perplexity_${bestPerplexityResult.url}`,
        [chunk],
        [{ embedding }]
      );

      logger.success('Результат из Perplexity сохранен в базу данных');

      // Формируем ответ на основе snippet
      const systemPrompt = `Ты помощник, который помогает находить информацию.

ВАЖНО:
- Используй информацию из предоставленного контекста
- Отвечай на вопрос пользователя структурированно и понятно
- Если информации недостаточно, так и скажи`;

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Вопрос: "${userQuery}"\n\nКонтекст из Perplexity:\n${textToSave}`,
          },
        ],
        temperature: 0.1,
      });

      const response = completion.choices[0].message.content.trim();

      logger.success('Ответ сформирован на основе данных из Perplexity');
      return {
        found: true,
        content: response,
        source: {
          filename: bestPerplexityResult.title,
          url: bestPerplexityResult.url,
          quote: bestPerplexityResult.snippet.substring(0, 300),
          type: 'perplexity',
        },
      };
    } catch (error) {
      logger.error('Ошибка при поиске с Perplexity fallback:', error);
      throw error;
    }
  }

  close() {
    this.vectorStore.close();
  }
}

