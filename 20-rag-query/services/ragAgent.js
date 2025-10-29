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
  }

  /**
   * Ищет текст песни используя RAG (поиск в БД + GPT)
   */
  async findLyrics(userQuery) {
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
          message: 'Текст песни не найден в базе данных',
        };
      }

      logger.info(`Найдено ${results.length} релевантных фрагментов`);

      // Формируем контекст для GPT
      const context = results
        .map((r, i) => `Фрагмент ${i + 1}:\n${r.text}`)
        .join('\n\n---\n\n');

      // Запрос к GPT с контекстом из БД
      const systemPrompt = `Ты помощник, который помогает найти тексты песен. 
У тебя есть доступ к базе данных с текстами песен.

ВАЖНО:
- Используй ТОЛЬКО информацию из предоставленного контекста
- Если в контексте есть текст песни, которая соответствует запросу, верни её в формате:
  Название: [название песни]
  Автор: [автор(ы)]
  
  Текст:
  [полный текст песни из контекста]

- Если текст песни не найден или информация неполная, верни ТОЛЬКО: "Текст песни не найден"
- НЕ выдумывай тексты песен
- НЕ используй свои знания, ТОЛЬКО контекст из базы`;

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Найди текст песни по запросу: "${userQuery}"\n\nКонтекст из базы данных:\n${context}`,
          },
        ],
        temperature: 0.1,
      });

      const response = completion.choices[0].message.content.trim();

      // Проверяем, найдена ли песня
      if (
        response.includes('Текст песни не найден') ||
        response.includes('не найден') ||
        response.toLowerCase().includes('not found')
      ) {
        logger.info('В базе данных не найдена подходящая песня');
        return {
          found: false,
          message: 'Текст песни не найден в базе данных',
        };
      }

      logger.success('Текст песни найден через RAG');
      return {
        found: true,
        lyrics: response,
      };
    } catch (error) {
      logger.error('Ошибка при RAG поиске:', error);
      throw error;
    }
  }

  close() {
    this.vectorStore.close();
  }
}

