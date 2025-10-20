# MCP Архитектура

## Компоненты

**MCP Сервер** - предоставляет 8 инструментов через stdio
**MCP Клиент** - выполняет автоматический флоу обработки
**Docker** - PostgreSQL в контейнере с автоматическим управлением

## Использование

```bash
npm run flow
```

Клиент автоматически:
1. Запускает PostgreSQL контейнер
2. Ждет готовности БД
3. Получает список статей
4. Проверяет новые
5. Обрабатывает каждую
6. Выводит статистику
7. Останавливает и удаляет контейнер

## Доступные инструменты

### 1. `start_postgres_container`
Запустить PostgreSQL контейнер через docker-compose и дождаться готовности.

**Возвращает:**
```json
{
  "success": true,
  "message": "PostgreSQL контейнер запущен и готов",
  "container": "habr-scraper-postgres",
  "port": 5432
}
```

### 2. `stop_postgres_container`
Остановить и удалить PostgreSQL контейнер вместе с volume.

**Возвращает:**
```json
{
  "success": true,
  "message": "PostgreSQL контейнер остановлен, volume удален"
}
```

### 3. `get_habr_articles`
Получить список ссылок на статьи с первой страницы Habr.

**Возвращает:**
```json
{
  "success": true,
  "count": 20,
  "articles": ["https://habr.com/...", ...]
}
```

### 4. `check_new_articles`
Проверить какие статьи новые (не в БД).

**Параметры:**
- `article_urls` (array) - массив URL статей

**Возвращает:**
```json
{
  "success": true,
  "total": 20,
  "new_articles": ["https://habr.com/...", ...],
  "new_count": 5,
  "existing_count": 15
}
```

### 5. `get_article_summary`
Получить резюме статьи по URL.

**Параметры:**
- `article_url` (string) - URL статьи на Habr

**Возвращает:**
```json
{
  "success": true,
  "title": "Заголовок статьи",
  "summary": "Резюме статьи...",
  "article_url": "https://habr.com/..."
}
```

### 6. `save_to_github`
Сохранить резюме на GitHub (опционально).

**Параметры:**
- `title` (string) - заголовок статьи
- `content` (string) - содержимое резюме
- `article_url` (string) - URL оригинальной статьи

**Возвращает:**
```json
{
  "success": true,
  "github_url": "https://github.com/..."
}
```

### 7. `save_to_database`
Сохранить информацию о статье в PostgreSQL БД.

**Параметры:**
- `habr_url` (string) - URL статьи на Habr
- `github_url` (string, optional) - URL резюме на GitHub
- `title` (string) - заголовок статьи

**Возвращает:**
```json
{
  "success": true,
  "message": "Статья сохранена в БД"
}
```

### 8. `get_database_stats`
Получить статистику по обработанным статьям.

**Возвращает:**
```json
{
  "success": true,
  "stats": {
    "total": 50,
    "with_github": 45,
    "without_github": 5
  }
}
```

## Жизненный цикл PostgreSQL

1. **Запуск**: `start_postgres_container`
   - Выполняет `docker-compose up -d`
   - Ждет health check (до 30 секунд)
   - Проверяет статус через `docker-compose ps`

2. **Работа**: Обработка статей
   - Инициализация таблиц
   - Вставка/обновление данных
   - Запросы статистики

3. **Остановка**: `stop_postgres_container`
   - Выполняет `docker-compose down -v`
   - Удаляет контейнер и volume
   - Гарантирует чистое состояние

## Error Handling

Клиент автоматически останавливает контейнер даже при ошибках:

```javascript
try {
  await runPipeline();
} catch (error) {
  await callTool('stop_postgres_container');
  throw error;
}
```

## Ручное использование

Запустить только сервер:
```bash
npm run server
```

Подключиться из другого клиента и вызывать инструменты.
