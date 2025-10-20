#!/usr/bin/env node
import 'dotenv/config';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

class HabrPipelineClientSQLite {
  constructor() {
    this.client = new Client(
      {
        name: 'habr-pipeline-client-sqlite',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );
  }

  async connect() {
    const transport = new StdioClientTransport({
      command: 'node',
      args: ['src/mcp-server-sqlite.js'],
      env: process.env, // Передаем все переменные окружения
    });

    await this.client.connect(transport);
    return transport;
  }

  async callTool(name, args = {}) {
    const result = await this.client.callTool({ name, arguments: args });
    try {
      return JSON.parse(result.content[0].text);
    } catch (error) {
      console.error(`❌ Ошибка парсинга JSON для ${name}:`, result.content[0].text);
      throw new Error(`Invalid JSON response: ${result.content[0].text}`);
    }
  }

  async run() {
    console.log('🚀 Запуск обработки статей с Habr (SQLite)\n');
    await this.connect();

    try {
      // 1. Получаем список статей
      console.log('📥 Получение списка статей с Habr...');
      const articlesData = await this.callTool('get_habr_articles');
      const articles = articlesData.articles;
      
      if (articlesData.limit) {
        console.log(`✅ Найдено ${articlesData.total_found} статей, лимит: ${articlesData.limit}, будет обработано: ${articlesData.count}\n`);
      } else {
        console.log(`✅ Найдено ${articlesData.count} статей\n`);
      }

      // 2. Проверяем какие статьи новые
      console.log('🔍 Проверка новых статей в базе данных...');
      const checkData = await this.callTool('check_new_articles', {
        article_urls: articles,
      });
      const newArticles = checkData.new_articles;
      console.log(`✅ Новых статей: ${checkData.new_count}, Уже обработано: ${checkData.existing_count}\n`);

      if (newArticles.length === 0) {
        console.log('✨ Все статьи уже обработаны!');
        process.exit(0);
      }

      // 3. Обрабатываем каждую новую статью
      console.log(`📝 Обработка ${newArticles.length} новых статей...\n`);
      let processed = 0;

      for (const url of newArticles) {
        try {
          console.log(`\n${'='.repeat(80)}`);
          console.log(`Статья ${processed + 1}/${newArticles.length}: ${url}`);
          console.log('='.repeat(80));

          // 3.1. Получаем резюме
          const summaryData = await this.callTool('get_article_summary', {
            article_url: url,
          });
          console.log(`✅ Резюме создано: ${summaryData.title}`);

          // 3.2. Сохраняем на GitHub (если настроен)
          let githubUrl = null;
          try {
            const githubData = await this.callTool('save_to_github', {
              title: summaryData.title,
              content: summaryData.summary,
            });
            githubUrl = githubData.github_url;
            console.log(`✅ Сохранено на GitHub: ${githubUrl}`);
          } catch (error) {
            console.log(`⚠️ GitHub не настроен, пропускаю сохранение: ${error.message}`);
          }

          // 3.3. Сохраняем в БД
          await this.callTool('save_to_database', {
            habr_url: url,
            github_url: githubUrl,
            title: summaryData.title,
          });
          console.log(`✅ Сохранено в БД`);

          processed++;
        } catch (error) {
          console.error(`❌ Ошибка обработки статьи: ${error.message}`);
        }
      }

      // 4. Финальная статистика
      console.log(`\n\n${'='.repeat(80)}`);
      console.log(`\n✨ Обработка завершена!`);
      console.log(`📊 Обработано статей: ${processed}/${newArticles.length}\n`);

      const stats = await this.callTool('get_database_stats');
      console.log(`📚 Всего статей в базе: ${stats.total_articles}`);

    } catch (error) {
      console.error(`❌ Ошибка: ${error.message}`);
    } finally {
      process.exit(0);
    }
  }
}

const client = new HabrPipelineClientSQLite();
client.run().catch(console.error);
