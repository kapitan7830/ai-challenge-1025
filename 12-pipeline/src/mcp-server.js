#!/usr/bin/env node
import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { HabrScraper } from './habr-scraper.js';
import { SummaryAgent } from './summary-agent.js';
import { GitHubStorage } from './github-storage.js';
import { ArticleDatabase } from './database.js';

class HabrMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'habr-scraper-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Инициализация компонентов
    this.scraper = new HabrScraper();
    this.summaryAgent = null;
    this.github = null;
    this.db = new ArticleDatabase();

    // Настройка GitHub если доступно
    const githubToken = process.env.GITHUB_TOKEN;
    const githubOwner = process.env.GITHUB_OWNER;
    const githubRepo = process.env.GITHUB_REPO;
    const githubBranch = process.env.GITHUB_BRANCH || 'main';

    if (githubToken && githubOwner && githubRepo) {
      this.github = new GitHubStorage(githubToken, githubOwner, githubRepo, githubBranch);
    }

    // Инициализация SummaryAgent
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.summaryAgent = new SummaryAgent(apiKey);
    }

    this.setupHandlers();
    
    // this.error = this.error.bind(this);
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      this.db.close();
      await this.server.close();
      process.exit(0);
    });
  }

  setupHandlers() {
    // Список доступных инструментов
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'get_habr_articles',
          description: 'Получить список ссылок на статьи с первой страницы Habr',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'check_new_articles',
          description: 'Проверить какие статьи из списка еще не обработаны (отсутствуют в базе данных)',
          inputSchema: {
            type: 'object',
            properties: {
              article_urls: {
                type: 'array',
                items: { type: 'string' },
                description: 'Массив URL статей для проверки',
              },
            },
            required: ['article_urls'],
          },
        },
        {
          name: 'get_article_summary',
          description: 'Получить резюме статьи по URL. Извлекает текст статьи с Habr и создает краткое резюме с ключевыми выводами.',
          inputSchema: {
            type: 'object',
            properties: {
              article_url: {
                type: 'string',
                description: 'URL статьи на Habr',
              },
            },
            required: ['article_url'],
          },
        },
        {
          name: 'save_to_github',
          description: 'Сохранить markdown документ на GitHub',
          inputSchema: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: 'Заголовок для названия файла',
              },
              content: {
                type: 'string',
                description: 'Markdown контент для сохранения',
              },
              folder: {
                type: 'string',
                description: 'Папка в репозитории (по умолчанию articles)',
              },
            },
            required: ['title', 'content'],
          },
        },
        {
          name: 'save_to_database',
          description: 'Сохранить информацию о статье в базу данных',
          inputSchema: {
            type: 'object',
            properties: {
              habr_url: {
                type: 'string',
                description: 'URL статьи на Habr',
              },
              github_url: {
                type: 'string',
                description: 'URL сохраненного файла на GitHub',
              },
              title: {
                type: 'string',
                description: 'Заголовок статьи',
              },
            },
            required: ['habr_url', 'title'],
          },
        },
        {
          name: 'get_database_stats',
          description: 'Получить статистику по обработанным статьям из базы данных',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
      ],
    }));

    // Обработчик вызова инструментов
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;

        switch (name) {
          case 'get_habr_articles':
            return await this.getHabrArticles();

          case 'check_new_articles':
            return await this.checkNewArticles(args.article_urls);

          case 'get_article_summary':
            return await this.getArticleSummary(args.article_url);

          case 'save_to_github':
            return await this.saveToGithub(args.title, args.content, args.folder);

          case 'save_to_database':
            return await this.saveToDatabase(args.habr_url, args.github_url, args.title);

          case 'get_database_stats':
            return await this.getDatabaseStats();

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  async getHabrArticles() {
    console.error('[LOG] Получение списка статей с Habr...');
    const links = await this.scraper.scrapeArticleLinks();
    console.error(`[LOG] Найдено статей: ${links.length}`);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            count: links.length,
            articles: links,
          }, null, 2),
        },
      ],
    };
  }

  async checkNewArticles(articleUrls) {
    console.error('[LOG] Проверка новых статей в базе данных...');
    const newArticles = this.db.getNewArticles(articleUrls);
    const existingCount = articleUrls.length - newArticles.length;
    
    console.error(`[LOG] Всего: ${articleUrls.length}, Новых: ${newArticles.length}, Обработано: ${existingCount}`);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            total: articleUrls.length,
            new_articles: newArticles,
            new_count: newArticles.length,
            existing_count: existingCount,
          }, null, 2),
        },
      ],
    };
  }

  async getArticleSummary(articleUrl) {
    console.error(`[LOG] Извлечение и суммаризация статьи: ${articleUrl}`);
    
    if (!this.summaryAgent) {
      throw new Error('OPENAI_API_KEY не настроен');
    }

    // Извлекаем статью
    const article = await this.scraper.scrapeArticle(articleUrl);
    console.error(`[LOG] Заголовок: ${article.title}`);
    console.error(`[LOG] Размер текста: ${article.content.length} символов`);

    // Создаем резюме
    const summary = await this.summaryAgent.summarize(article.content, article.title, articleUrl);
    console.error(`[LOG] Резюме создано (${summary.length} символов)`);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            url: articleUrl,
            title: article.title,
            summary: summary,
            original_length: article.content.length,
            summary_length: summary.length,
          }, null, 2),
        },
      ],
    };
  }

  async saveToGithub(title, content, folder = 'articles') {
    console.error(`[LOG] Сохранение на GitHub: ${title}`);
    
    if (!this.github) {
      throw new Error('GitHub не настроен. Укажите GITHUB_TOKEN, GITHUB_OWNER и GITHUB_REPO');
    }

    const githubUrl = await this.github.saveArticle(title, content, folder);
    console.error(`[LOG] Сохранено: ${githubUrl}`);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            github_url: githubUrl,
          }, null, 2),
        },
      ],
    };
  }

  async saveToDatabase(habrUrl, githubUrl, title) {
    console.error(`[LOG] Сохранение в БД: ${title}`);
    
    const id = this.db.addArticle(habrUrl, githubUrl, title);
    console.error(`[LOG] Сохранено с ID: ${id}`);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            id: id,
            habr_url: habrUrl,
            github_url: githubUrl,
            title: title,
          }, null, 2),
        },
      ],
    };
  }

  async getDatabaseStats() {
    console.error('[LOG] Получение статистики из БД...');
    
    const allArticles = this.db.getAllArticles();
    console.error(`[LOG] Всего статей в БД: ${allArticles.length}`);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            total_articles: allArticles.length,
            articles: allArticles.slice(0, 10), // Последние 10 статей
          }, null, 2),
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Habr Scraper MCP Server запущен');
  }
}

const server = new HabrMCPServer();
server.run().catch(console.error);

