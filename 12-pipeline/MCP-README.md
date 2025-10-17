# MCP Архитектура

## Компоненты

**MCP Сервер** - предоставляет 6 инструментов через stdio
**MCP Клиент** - выполняет автоматический флоу обработки

## Использование

```bash
npm start
```

Клиент автоматически:
1. Запускает сервер
2. Получает список статей
3. Проверяет новые
4. Обрабатывает каждую
5. Выводит статистику
6. Завершает работу

## Доступные инструменты

### 1. `get_habr_articles`
Получить список ссылок на статьи с первой страницы Habr.

**Возвращает:**
```json
{
  "success": true,
  "count": 20,
  "articles": ["https://habr.com/...", ...]
}
```

### 2. `check_new_articles`
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

### 3. `get_article_summary`
Получить резюме статьи по URL.

**Параметры:**
- `article_url` (string) - URL статьи на Habr

**Возвращает:**
```json
{
  "success": true,
  "url": "https://habr.com/...",
  "title": "Заголовок статьи",
  "summary": "# Заголовок\n\n## Резюме...",
  "original_length": 15000,
  "summary_length": 2500
}
```

### 4. `save_to_github`
Сохранить markdown документ на GitHub.

**Параметры:**
- `title` (string) - заголовок для названия файла
- `content` (string) - markdown контент
- `folder` (string, optional) - папка в репозитории (по умолчанию "articles")

**Возвращает:**
```json
{
  "success": true,
  "github_url": "https://github.com/user/repo/blob/main/articles/..."
}
```

### 5. `save_to_database`
Сохранить информацию о статье в БД.

**Параметры:**
- `habr_url` (string) - URL статьи на Habr
- `github_url` (string, optional) - URL на GitHub
- `title` (string) - заголовок статьи

**Возвращает:**
```json
{
  "success": true,
  "id": 1,
  "habr_url": "https://habr.com/...",
  "github_url": "https://github.com/...",
  "title": "Заголовок"
}
```

### 6. `get_database_stats`
Получить статистику по обработанным статьям.

**Возвращает:**
```json
{
  "success": true,
  "total_articles": 42,
  "articles": [...]
}
```

## Пример использования

После запуска сервера через `./start.sh` или `npm run mcp`, MCP клиент может вызывать инструменты для обработки статей.

### Типичный флоу обработки:

1. **Получение списка статей:**
   ```
   get_habr_articles() → возвращает массив URL статей
   ```

2. **Проверка новых статей:**
   ```
   check_new_articles(urls) → возвращает список необработанных
   ```

3. **Для каждой новой статьи:**
   - `get_article_summary(url)` → создает AI резюме
   - `save_to_github(title, content)` → сохраняет .md на GitHub
   - `save_to_database(habr_url, github_url, title)` → записывает в БД

4. **Получение статистики:**
   ```
   get_database_stats() → показывает общую статистику
   ```

AI агент автоматически выполняет этот флоу и выводит отчет о результатах.

## Логирование

Все действия логируются в stderr с префиксом `[LOG]`:
- Получение статей
- Проверка БД
- Создание резюме
- Сохранение файлов
- Ошибки

## Troubleshooting

### Ошибка "OPENAI_API_KEY не настроен"
Убедись что в `.env` или в конфигурации MCP указан валидный ключ OpenAI.

### Ошибка "GitHub не настроен"
Проверь что указаны: `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`.

### База данных заблокирована
Убедись что не запущен другой процесс использующий `articles.db`.

