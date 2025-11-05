import OpenAI from 'openai';
import { createWriteStream, unlinkSync } from 'fs';
import { pipeline } from 'stream/promises';
import { logger } from '../utils/logger.js';
import axios from 'axios';
import { createReadStream } from 'fs';

export class TranscriptionService {
  constructor(apiKey) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Скачивает голосовое сообщение из Telegram
   * @param {string} fileUrl - URL файла в Telegram
   * @param {string} filePath - Путь для сохранения файла
   */
  async downloadVoiceFile(fileUrl, filePath) {
    const response = await axios({
      method: 'get',
      url: fileUrl,
      responseType: 'stream',
    });

    await pipeline(response.data, createWriteStream(filePath));
    logger.info(`Голосовое сообщение скачано: ${filePath}`);
  }

  /**
   * Транскрибирует аудио файл в текст с помощью OpenAI Whisper
   * @param {string} filePath - Путь к аудио файлу
   * @returns {Promise<string>} - Распознанный текст
   */
  async transcribe(filePath) {
    try {
      logger.info('Отправка файла на транскрипцию в OpenAI Whisper...');

      const transcription = await this.openai.audio.transcriptions.create({
        file: createReadStream(filePath),
        model: 'whisper-1',
        language: 'ru', // Русский язык
      });

      logger.success(`Транскрипция завершена: "${transcription.text}"`);
      return transcription.text;
    } catch (error) {
      logger.error('Ошибка при транскрипции:', error);
      throw error;
    }
  }

  /**
   * Удаляет временный файл
   * @param {string} filePath - Путь к файлу
   */
  cleanupFile(filePath) {
    try {
      unlinkSync(filePath);
      logger.info(`Временный файл удален: ${filePath}`);
    } catch (error) {
      logger.error(`Ошибка при удалении файла ${filePath}:`, error);
    }
  }
}

