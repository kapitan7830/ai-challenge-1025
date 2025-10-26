import { JSDOM } from 'jsdom';
import { logger } from './logger.js';

export class WebParser {
  async fetchText(url) {
    try {
      logger.info(`📥 Загрузка страницы: ${url}`);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const html = await response.text();
      
      // Парсим HTML и извлекаем текст
      const dom = new JSDOM(html);
      const document = dom.window.document;
      
      // Удаляем скрипты, стили и другие нетекстовые элементы
      const unwantedSelectors = ['script', 'style', 'nav', 'footer', 'header', 'aside', 'iframe', 'noscript'];
      unwantedSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => el.remove());
      });
      
      // Извлекаем текст
      let text = document.body.textContent || '';
      
      // Очищаем текст
      text = text
        .replace(/\s+/g, ' ')  // Убираем множественные пробелы
        .replace(/\n\s*\n/g, '\n\n')  // Убираем пустые строки
        .trim();
      
      logger.info(`✅ Страница загружена и обработана`);
      
      return text;
      
    } catch (error) {
      logger.error(`Ошибка загрузки страницы: ${error.message}`);
      throw error;
    }
  }
}

