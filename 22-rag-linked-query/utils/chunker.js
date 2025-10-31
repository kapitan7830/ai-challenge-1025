import { logger } from './logger.js';

/**
 * Разбивает текст на семантические чанки с перекрытием
 */
export class SemanticChunker {
  constructor(chunkSize = 500, overlapPercent = 15) {
    this.chunkSize = chunkSize;
    this.overlapPercent = overlapPercent;
    this.overlapSize = Math.floor((chunkSize * overlapPercent) / 100);
  }

  /**
   * Разбивает текст на предложения
   */
  splitIntoSentences(text) {
    // Разделяем по точкам, восклицательным и вопросительным знакам
    // Учитываем сокращения и инициалы
    const sentenceRegex = /[^.!?]+[.!?]+["']?(?:\s|$)/g;
    const sentences = text.match(sentenceRegex) || [text];
    return sentences.map(s => s.trim()).filter(s => s.length > 0);
  }

  /**
   * Группирует предложения в чанки с учетом семантики
   */
  createSemanticChunks(sentences) {
    const chunks = [];
    let currentChunk = '';
    let currentSize = 0;

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const sentenceLength = sentence.length;

      // Если добавление предложения превышает размер чанка
      if (currentSize + sentenceLength > this.chunkSize && currentChunk) {
        chunks.push(currentChunk.trim());
        
        // Создаем перекрытие: берем последние предложения текущего чанка
        const overlapText = this.getOverlapText(currentChunk);
        currentChunk = overlapText;
        currentSize = overlapText.length;
      }

      currentChunk += ' ' + sentence;
      currentSize += sentenceLength;
    }

    // Добавляем последний чанк
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Получает текст для перекрытия (overlap)
   */
  getOverlapText(text) {
    if (text.length <= this.overlapSize) {
      return text;
    }

    // Берем последние N символов и пытаемся начать с начала предложения
    const overlapText = text.slice(-this.overlapSize);
    const firstSentenceEnd = overlapText.search(/[.!?]\s+/);
    
    if (firstSentenceEnd !== -1) {
      return overlapText.slice(firstSentenceEnd + 1).trim();
    }

    return overlapText.trim();
  }

  /**
   * Основной метод разбивки текста на чанки
   */
  chunk(text) {
    logger.info(`Начинаю разбивку текста на чанки`);
    logger.info(`Параметры: размер чанка = ${this.chunkSize}, перекрытие = ${this.overlapPercent}%`);

    const sentences = this.splitIntoSentences(text);
    logger.success(`Текст разбит на ${sentences.length} предложений`);

    const chunks = this.createSemanticChunks(sentences);
    logger.success(`Создано ${chunks.length} семантических чанков`);

    // Логируем статистику
    const stats = {
      totalChunks: chunks.length,
      avgChunkSize: Math.round(
        chunks.reduce((sum, c) => sum + c.length, 0) / chunks.length
      ),
      minChunkSize: Math.min(...chunks.map(c => c.length)),
      maxChunkSize: Math.max(...chunks.map(c => c.length)),
    };

    logger.info('Статистика чанков:', stats);

    return chunks.map((chunk, index) => ({
      id: index,
      text: chunk,
      size: chunk.length,
    }));
  }
}

