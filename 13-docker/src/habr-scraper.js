import axios from 'axios';
import * as cheerio from 'cheerio';

export class HabrScraper {
  async scrapeArticleLinks() {
    const url = 'https://habr.com/ru/hubs/nodejs/articles/';
    try {
      // Получаем HTML страницы
      console.log(`Загружаю страницу: ${url}`);
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      });
      
      const html = response.data;
      console.log(`Получен HTML (${html.length} символов)`);

      // Парсим HTML
      console.log('Парсинг страницы...');
      const $ = cheerio.load(html);
      
      const links = new Set();
      
      // Ищем ссылки на статьи
      // На Habr статьи имеют паттерн /ru/articles/XXXXXX/
      $('a').each((i, elem) => {
        const href = $(elem).attr('href');
        if (href && href.match(/^\/ru\/articles\/\d+\/?$/)) {
          links.add(`https://habr.com${href}`);
        }
      });
      
      const result = Array.from(links);
      console.log(`Найдено ${result.length} уникальных ссылок на статьи`);
      return result;
      
    } catch (error) {
      console.error('Ошибка при скрейпинге:', error.message);
      throw error;
    }
  }

  async scrapeArticle(url) {
    try {
      console.log(`\nЗагружаю статью: ${url}`);
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      });
      
      const html = response.data;
      const $ = cheerio.load(html);
      
      // Заголовок статьи
      const title = $('.tm-title.tm-title_h1').first().text().trim();
      
      // Текст статьи
      const articleBody = $('.article-formatted-body').first();
      const content = articleBody.text().trim();
      
      console.log(`Извлечен заголовок: ${title}`);
      console.log(`Длина текста: ${content.length} символов`);
      
      return {
        url,
        title,
        content
      };
      
    } catch (error) {
      console.error(`Ошибка при скрейпинге статьи ${url}:`, error.message);
      throw error;
    }
  }
}

