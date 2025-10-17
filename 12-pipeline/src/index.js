import 'dotenv/config';
import { HabrScraper } from './habr-scraper.js';
import { SummaryAgent } from './summary-agent.js';
import { GitHubStorage } from './github-storage.js';
import { ArticleDatabase } from './database.js';

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  const githubToken = process.env.GITHUB_TOKEN;
  const githubOwner = process.env.GITHUB_OWNER;
  const githubRepo = process.env.GITHUB_REPO;
  const githubBranch = process.env.GITHUB_BRANCH || 'main';
  const githubFolder = process.env.GITHUB_FILE_PATH || 'articles';

  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY не задан в .env файле');
    process.exit(1);
  }

  // Инициализируем компоненты
  const scraper = new HabrScraper();
  const summaryAgent = new SummaryAgent(apiKey);
  const db = new ArticleDatabase();

  let github = null;
  if (githubToken && githubOwner && githubRepo) {
    github = new GitHubStorage(githubToken, githubOwner, githubRepo, githubBranch);
    console.log('✅ GitHub хранилище подключено\n');
  } else {
    console.log('⚠️  GitHub не настроен (статьи будут только в БД)\n');
  }

  console.log('🤖 Запускаю скрейпер Habr...\n');

  // Получаем список статей
  const links = await scraper.scrapeArticleLinks();
  console.log(`\n✅ Найдено ${links.length} ссылок на статьи\n`);

  // Проверяем какие статьи уже обработаны
  const newLinks = db.getNewArticles(links);
  const existingCount = links.length - newLinks.length;

  console.log(`📊 Статистика:`);
  console.log(`  Всего статей: ${links.length}`);
  console.log(`  Уже обработано: ${existingCount}`);
  console.log(`  Новых статей: ${newLinks.length}\n`);

  if (newLinks.length === 0) {
    console.log('✨ Все статьи уже обработаны!');
    db.close();
    return;
  }

  console.log('📝 Обрабатываю новые статьи...\n');

  // Обрабатываем только первую новую статью (для демо)
  for (let i = 0; i < Math.min(1, newLinks.length); i++) {
    const link = newLinks[i];
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Статья ${i + 1}/${newLinks.length}: ${link}`);
    console.log('='.repeat(80));

    try {
      // Извлекаем статью
      const article = await scraper.scrapeArticle(link);
      console.log(`📄 Заголовок: ${article.title}`);

      // Создаем резюме
      const summary = await summaryAgent.summarize(article.content, article.title, link);

      // Сохраняем на GitHub (если настроен)
      let githubUrl = null;
      if (github) {
        githubUrl = await github.saveArticle(article.title, summary, githubFolder);
      }

      // Сохраняем в БД
      db.addArticle(link, githubUrl, article.title);
      console.log(`💾 Сохранено в базе данных`);

      console.log(`\n📝 РЕЗЮМЕ:\n`);
      console.log(summary);

    } catch (error) {
      console.error(`❌ Ошибка обработки статьи: ${error.message}`);
    }
  }

  console.log(`\n\n✨ Обработка завершена!`);
  
  // Показываем статистику
  const allArticles = db.getAllArticles();
  console.log(`\n📊 Всего статей в базе: ${allArticles.length}`);
  
  db.close();
}

main().catch(console.error);

