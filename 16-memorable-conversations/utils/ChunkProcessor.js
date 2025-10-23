import { TokenCounter } from './TokenCounter.js';

/**
 * Класс для разбиения текста на куски
 */
export class ChunkProcessor {
  constructor() {
    this.chunkSize = 3000; // токенов на один чанк
  }

  /**
   * Интеллектуальное разбиение текста на части
   * Приоритет: новые строки → предложения → символы
   * @param {string} text - Исходный текст
   * @param {number} maxTokensPerChunk - Максимум токенов в одной части
   * @returns {string[]} - Массив частей текста
   */
  splitIntoChunks(text, maxTokensPerChunk = this.chunkSize) {
    const chunks = [];
    let currentChunk = '';
    
    // 1. Пробуем разбить по новым строкам (абзацам)
    const lines = text.split('\n');
    
    for (const line of lines) {
      const testChunk = currentChunk + (currentChunk ? '\n' : '') + line;
      const tokens = TokenCounter.estimate(testChunk);
      
      if (tokens > maxTokensPerChunk && currentChunk) {
        // Текущий чанк заполнен, сохраняем его
        chunks.push(currentChunk.trim());
        currentChunk = line;
      } else {
        currentChunk = testChunk;
      }
    }
    
    // Если последний чанк слишком большой, разбиваем по предложениям
    if (currentChunk && TokenCounter.estimate(currentChunk) > maxTokensPerChunk) {
      // Разбиваем по предложениям
      const sentences = currentChunk.match(/[^.!?]+[.!?]+/g) || [currentChunk];
      let sentenceChunk = '';
      
      for (const sentence of sentences) {
        const testSentenceChunk = sentenceChunk + sentence;
        const tokens = TokenCounter.estimate(testSentenceChunk);
        
        if (tokens > maxTokensPerChunk && sentenceChunk) {
          chunks.push(sentenceChunk.trim());
          sentenceChunk = sentence;
        } else {
          sentenceChunk = testSentenceChunk;
        }
      }
      
      if (sentenceChunk.trim()) {
        chunks.push(sentenceChunk.trim());
      }
    } else if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    // Если все еще есть слишком большие чанки, разбиваем по символам
    const finalChunks = [];
    for (const chunk of chunks) {
      if (TokenCounter.estimate(chunk) <= maxTokensPerChunk) {
        finalChunks.push(chunk);
      } else {
        // Разбиваем по символам
        const charLimit = Math.floor(maxTokensPerChunk * 2.5); // примерное соотношение
        for (let i = 0; i < chunk.length; i += charLimit) {
          finalChunks.push(chunk.slice(i, i + charLimit));
        }
      }
    }
    
    return finalChunks.filter(chunk => chunk.trim().length > 0);
  }
}

export const chunkProcessor = new ChunkProcessor();

