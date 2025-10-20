# Habr Scraper Pipeline

Автоматическая обработка статей с Habr: скрейпинг → AI резюме → сохранение на GitHub → учет в PostgreSQL БД.

## Требования

- Node.js 18+
- Docker и Docker Compose

## Установка

```bash
npm install
```

## Настройка

```bash
cp .env.example .env
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

PostgreSQL настройки (уже заданы по умолчанию):
```env
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=habr_scraper
POSTGRES_USER=habr_user
POSTGRES_PASSWORD=habr_password
```

## Запуск

```bash
npm run flow
```

### Что происходит:

1. **Запускает PostgreSQL контейнер** в Docker
2. Ожидает готовности БД (health check)
3. Получает список статей с Habr
4. Проверяет какие новые (не в БД)
5. Для каждой новой статьи:
   - Создает AI резюме
   - Сохраняет на GitHub (если настроен)
   - Записывает в PostgreSQL БД
6. Выводит статистику
7. **Останавливает и удаляет PostgreSQL контейнер**

## Архитектура

**Docker Compose** (`docker-compose.yml`):
- PostgreSQL 16 Alpine
- Health check для готовности
- Порт 5432
- Volume удаляется при остановке

**MCP Сервер** (`src/mcp-server.js`):
- 8 инструментов для управления обработкой
- Управление Docker контейнером
- Работает через stdio

**MCP Клиент** (`src/mcp-client.js`):
- Выполняет полный флоу обработки
- Управляет жизненным циклом PostgreSQL
- Вызывает инструменты сервера

**Модули:**
- `habr-scraper.js` - парсинг Habr
- `summary-agent.js` - AI резюме через OpenAI
- `github-storage.js` - сохранение на GitHub
- `database.js` - работа с PostgreSQL

## MCP Инструменты

1. **start_postgres_container** - Запуск PostgreSQL в Docker
2. **stop_postgres_container** - Остановка и удаление контейнера
3. **get_habr_articles** - Получить список статей
4. **check_new_articles** - Проверить новые статьи
5. **get_article_summary** - Получить AI резюме
6. **save_to_github** - Сохранить на GitHub
7. **save_to_database** - Сохранить в PostgreSQL
8. **get_database_stats** - Статистика по статьям

## Ручное управление

Запустить только MCP сервер:
```bash
npm run server
```

Управление PostgreSQL вручную:
```bash
# Запуск
docker-compose up -d

# Остановка с удалением volume
docker-compose down -v

# Проверка статуса
docker-compose ps
```

Подключение к БД:
```bash
docker exec -it habr-scraper-postgres psql -U habr_user -d habr_scraper
```

## База данных

Таблица `articles`:
- `id` - serial primary key
- `habr_url` - уникальный URL статьи на Habr
- `github_url` - URL резюме на GitHub (может быть null)
- `title` - заголовок статьи
- `created_at` - дата создания записи
- `updated_at` - дата обновления записи

## Troubleshooting

**PostgreSQL не запускается:**
```bash
docker-compose logs postgres
```

**Порт 5432 занят:**
Измени порт в `docker-compose.yml` и `.env`

**Ошибки подключения к БД:**
Проверь что контейнер запущен и healthy:
```bash
docker-compose ps
```

**Контейнер не удаляется:**
```bash
docker-compose down -v --remove-orphans
```
