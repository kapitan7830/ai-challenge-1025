import dotenv from 'dotenv';
import { TokenCounter } from './TokenCounter.js';

dotenv.config();

/**
 * Класс для суммаризации длинных текстов
 * Разбивает текст на части, суммаризирует каждую, затем объединяет
 */
export class TextSummarizer {
  constructor() {
    this.model = 'yandexgpt-lite';
    this.chunkSize = 2000; // токенов на один чанк
    this.maxTokensPerRequest = 7000; // безопасный лимит для yandexgpt-lite
  }

  /**
   * Разбить текст на части по предложениям
   * @param {string} text - Исходный текст
   * @param {number} maxTokensPerChunk - Максимум токенов в одной части
   * @returns {string[]} - Массив частей текста
   */
  splitIntoChunks(text, maxTokensPerChunk = this.chunkSize) {
    // Разбиваем по предложениям
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    
    const chunks = [];
    let currentChunk = '';
    
    for (const sentence of sentences) {
      const testChunk = currentChunk + sentence;
      const tokens = TokenCounter.estimate(testChunk);
      
      if (tokens > maxTokensPerChunk && currentChunk) {
        // Текущий чанк заполнен, сохраняем его
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk = testChunk;
      }
    }
    
    // Добавляем последний чанк
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }

  /**
   * Суммаризировать один чанк текста
   * @param {string} chunk - Часть текста
   * @param {number} chunkIndex - Номер части
   * @returns {Promise<Object>} - Результат с summary и статистикой
   */
  async summarizeChunk(chunk, chunkIndex) {
    const systemPrompt = `Ты - эксперт по анализу художественных текстов.
Твоя задача - кратко пересказать данный фрагмент текста, сохранив:
1. Всех упомянутых персонажей
2. Их действия и характеристики
3. Важные детали сюжета

Сократи текст примерно в 3 раза, сохранив всю ключевую информацию о персонажах.`;

    const startTime = Date.now();

    const response = await fetch(
      'https://llm.api.cloud.yandex.net/foundationModels/v1/completion',
      {
        method: 'POST',
        headers: {
          'Authorization': `Api-Key ${process.env.YANDEX_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          modelUri: `gpt://${process.env.YANDEX_FOLDER_ID}/${this.model}/latest`,
          completionOptions: {
            stream: false,
            temperature: 0.3, // Низкая температура для точности
            maxTokens: 1500,
          },
          messages: [
            {
              role: 'system',
              text: systemPrompt,
            },
            {
              role: 'user',
              text: `Фрагмент ${chunkIndex + 1}:\n\n${chunk}`,
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Yandex API error on chunk ${chunkIndex + 1}: ${error}`);
    }

    const result = await response.json();
    const summary = result.result.alternatives[0].message.text;

    const endTime = Date.now();
    const responseTime = (endTime - startTime) / 1000;

    return {
      summary,
      chunkIndex,
      originalTokens: TokenCounter.estimate(chunk),
      summaryTokens: TokenCounter.estimate(summary),
      usage: {
        prompt_tokens: result.result.usage.inputTextTokens,
        completion_tokens: result.result.usage.completionTokens,
        total_tokens: result.result.usage.totalTokens,
      },
      responseTime,
    };
  }

  /**
   * Суммаризировать длинный текст целиком
   * @param {string} text - Исходный текст
   * @returns {Promise<Object>} - Результат с итоговым summary и подробной статистикой
   */
  async summarize(text) {
    const totalStartTime = Date.now();
    const originalTokens = TokenCounter.estimate(text);

    console.log(`\n🔍 Начинаю суммаризацию текста:`);
    console.log(`📏 Исходный размер: ${text.length} символов`);
    console.log(`📊 Оценка токенов: ${originalTokens}`);

    // Проверяем, нужна ли суммаризация
    if (originalTokens <= this.maxTokensPerRequest - 1000) {
      console.log(`✅ Текст помещается в лимит, суммаризация не требуется`);
      return {
        summary: text,
        originalTokens,
        summaryTokens: originalTokens,
        chunks: [],
        totalUsage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
        },
        totalTime: 0,
        compressionRatio: 1,
      };
    }

    // Разбиваем на части
    const chunks = this.splitIntoChunks(text);
    console.log(`✂️  Разбил текст на ${chunks.length} частей`);

    // Суммаризируем каждую часть
    const chunkResults = [];
    let totalUsage = {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    };

    for (let i = 0; i < chunks.length; i++) {
      console.log(`\n📝 Обрабатываю часть ${i + 1}/${chunks.length}...`);
      const result = await this.summarizeChunk(chunks[i], i);
      chunkResults.push(result);

      totalUsage.prompt_tokens += result.usage.prompt_tokens;
      totalUsage.completion_tokens += result.usage.completion_tokens;
      totalUsage.total_tokens += result.usage.total_tokens;

      console.log(`   ⏱️  Время: ${result.responseTime.toFixed(2)}с`);
      console.log(`   📊 Токены: ${result.originalTokens} → ${result.summaryTokens}`);
      console.log(`   📉 Сжатие: ${((1 - result.summaryTokens / result.originalTokens) * 100).toFixed(1)}%`);
    }

    // Объединяем все саммари
    const combinedSummary = chunkResults
      .map((r) => `[Часть ${r.chunkIndex + 1}]\n${r.summary}`)
      .join('\n\n');

    const summaryTokens = TokenCounter.estimate(combinedSummary);
    const totalTime = (Date.now() - totalStartTime) / 1000;
    const compressionRatio = summaryTokens / originalTokens;

    console.log(`\n✅ Суммаризация завершена:`);
    console.log(`📊 ${originalTokens} токенов → ${summaryTokens} токенов`);
    console.log(`📉 Коэффициент сжатия: ${(compressionRatio * 100).toFixed(1)}%`);
    console.log(`⏱️  Общее время: ${totalTime.toFixed(2)}с`);

    return {
      summary: combinedSummary,
      originalTokens,
      summaryTokens,
      chunks: chunkResults,
      totalUsage,
      totalTime,
      compressionRatio,
    };
  }
}

