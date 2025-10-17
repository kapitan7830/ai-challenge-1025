# Habr Scraper Pipeline

Автоматическая обработка статей с Habr: скрейпинг → AI резюме → сохранение на GitHub → учет в БД.

## Установка

```bash
npm install
```

## Настройка

```bash
cp env.example .env
# Отредактируй .env, добавь OPENAI_API_KEY
```

Минимум:
```env
OPENAI_API_KEY=sk-...
```

Опционально (для GitHub):
```env
GITHUB_TOKEN=github_pat_...
GITHUB_OWNER=username
GITHUB_REPO=repo
```

## Запуск

```bash
./start.sh
# или
npm start
```

### Что происходит:

1. Получает список статей с Habr
2. Проверяет какие новые (не в БД)
3. Для каждой новой статьи:
   - Создает AI резюме
   - Сохраняет на GitHub (если настроен)
   - Записывает в БД
4. Выводит статистику

### Тест (одна статья):

```bash
./test-demo.sh
```

## Архитектура

**MCP Сервер** (`src/mcp-server.js`):
- 6 инструментов для управления обработкой
- Работает через stdio

**MCP Клиент** (`src/mcp-client.js`):
- Выполняет полный флоу обработки
- Вызывает инструменты сервера

**Модули:**
- `habr-scraper.js` - парсинг Habr (cheerio)
- `summary-agent.js` - AI суммаризация (OpenAI)
- `github-storage.js` - сохранение .md (Octokit)
- `database.js` - SQLite база

## База данных

`articles.db` (SQLite):
- habr_url (уникальный)
- github_url
- title
- created_at / updated_at

## MCP Инструменты

1. `get_habr_articles()` - список статей
2. `check_new_articles(urls)` - фильтр новых
3. `get_article_summary(url)` - создать резюме
4. `save_to_github(title, content)` - сохранить .md
5. `save_to_database(habr_url, github_url, title)` - записать в БД
6. `get_database_stats()` - статистика

Детали: [MCP-README.md](./MCP-README.md)
