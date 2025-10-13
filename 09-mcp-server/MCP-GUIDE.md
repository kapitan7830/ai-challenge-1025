# 🔥 MCP (Model Context Protocol) - Полное руководство

## 📖 Что такое MCP?

**Model Context Protocol (MCP)** - это открытый протокол от Anthropic, который стандартизирует способ предоставления контекста для больших языковых моделей.

### Простая аналогия
Представьте MCP как **USB-порт для AI**:
- USB позволяет подключить любое устройство к любому компьютеру
- MCP позволяет подключить любые инструменты/данные к любой AI-модели

## 🎯 Какие проблемы решает MCP?

### 1. **Фрагментация интеграций**
**Проблема:** Каждое AI-приложение создает свои собственные интеграции.
- Telegram бот с кастомными командами
- CLI утилита с собственным API
- Web приложение со своим форматом

**Решение MCP:** Один стандартный протокол для всех.
```
┌─────────────────┐
│  Ваши инструменты│ ← Написали один раз
└────────┬────────┘
         │ MCP Protocol
    ┌────┴────┬────────┬────────┐
    │         │        │        │
Claude    Telegram   CLI     WebApp
Desktop     Bot     Tool     
```

### 2. **Контекст для LLM**
**Проблема:** LLM нужен доступ к:
- 📁 Вашим файлам
- 🔧 Внешним API
- 💾 Базам данных
- 📊 Аналитике

**Решение MCP:** Универсальный способ предоставить контекст.

### 3. **Переиспользование**
**Проблема:** Написали анализатор персонажей для Telegram → теперь нужен для CLI → нужно переписывать.

**Решение MCP:** Пишете MCP-сервер один раз → используете везде.

## 🏗️ Архитектура MCP

```
┌──────────────────────────────────────────┐
│           MCP CLIENT                     │
│  (Claude Desktop, Custom App, CLI)       │
└────────────────┬─────────────────────────┘
                 │
                 │ JSON-RPC over stdio/HTTP
                 │
┌────────────────┴─────────────────────────┐
│           MCP SERVER                     │
│  • Список инструментов                   │
│  • Обработка вызовов                     │
│  • Управление ресурсами                  │
└────────────────┬─────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
┌───────▼──────┐  ┌──────▼────────┐
│   TOOLS      │  │  RESOURCES    │
│ (Функции)    │  │  (Данные)     │
└──────────────┘  └───────────────┘
```

## 🔧 Компоненты MCP

### 1. **Tools (Инструменты)**
Функции, которые LLM может вызывать.

**Пример:**
```javascript
{
  name: "analyze_characters",
  description: "Анализирует персонажей в тексте",
  inputSchema: {
    text: { type: "string", required: true }
  }
}
```

**В нашем проекте:**
- `analyze_characters` - анализ персонажей
- `summarize_text` - суммаризация
- `estimate_tokens` - подсчет токенов
- `check_token_limit` - проверка лимитов

### 2. **Resources (Ресурсы)**
Источники данных, к которым LLM имеет доступ.

**Примеры:**
- Файлы на диске
- Записи в БД
- API endpoints
- Документация

### 3. **Prompts (Промпты)**
Переиспользуемые шаблоны промптов.

## 💼 Применение в вашем проекте

### До MCP:
```javascript
// Telegram бот
bot.on('text', async (ctx) => {
  const result = await analyzer.analyzeCharacters(text);
  await ctx.reply(result);
});
```

**Проблемы:**
- ❌ Работает только в Telegram
- ❌ Нельзя использовать из Claude Desktop
- ❌ Нельзя вызвать из командной строки
- ❌ Нельзя интегрировать в другие приложения

### После MCP:
```javascript
// MCP Server
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'analyze_characters') {
    return await analyzer.analyzeCharacters(request.params.arguments.text);
  }
});
```

**Преимущества:**
- ✅ Работает везде, где есть MCP клиент
- ✅ Можно вызвать из Claude Desktop
- ✅ Можно использовать в CLI
- ✅ Легко интегрировать в любое приложение

## 🚀 Как это работает?

### 1. Запуск MCP сервера
```bash
npm run mcp-server
```

Сервер ждет команды через **stdio** (стандартный ввод/вывод).

### 2. Подключение клиента
```javascript
const client = new Client({ ... });
await client.connect(transport);
```

### 3. Получение списка инструментов
```javascript
const tools = await client.listTools();
// Возвращает: analyze_characters, summarize_text, ...
```

### 4. Вызов инструмента
```javascript
const result = await client.callTool({
  name: 'analyze_characters',
  arguments: { text: 'Маша и медведь...' }
});
```

## 📊 Сравнение подходов

| Критерий | Без MCP | С MCP |
|----------|---------|-------|
| Переиспользование | ❌ Для каждого клиента свой код | ✅ Один сервер для всех |
| Интеграция | ❌ Кастомный API каждый раз | ✅ Стандартный протокол |
| Совместимость | ❌ Работает только где реализовано | ✅ Работает везде где есть MCP |
| Документация | ❌ Нужно писать вручную | ✅ Автоматически из схемы |
| Валидация | ❌ Нужно писать вручную | ✅ Автоматически через Zod |

## 🎓 Наш MCP сервер

### Доступные инструменты:

#### 1. `analyze_characters`
Анализирует текст и находит всех персонажей.

**Вход:**
```json
{
  "text": "Рассказ о Маше и Волке...",
  "autoSummarize": true
}
```

**Выход:**
```json
{
  "success": true,
  "characters": "👤 Маша\n📝 Девочка...",
  "statistics": {
    "originalTokens": 2500,
    "analysisTokens": 350,
    "totalTime": 3.5
  }
}
```

#### 2. `summarize_text`
Суммаризирует длинные тексты.

**Вход:**
```json
{
  "text": "Очень длинный рассказ...",
  "chunkSize": 2000
}
```

**Выход:**
```json
{
  "success": true,
  "summary": "Краткий пересказ...",
  "statistics": {
    "compressionRatio": 0.35,
    "chunks": 4
  }
}
```

#### 3. `estimate_tokens`
Оценивает количество токенов.

#### 4. `check_token_limit`
Проверяет превышение лимита.

## 🐳 Запуск в Docker

### Зачем Docker?
- ✅ Изолированное окружение
- ✅ Не зависит от локальной установки Node.js
- ✅ Легко деплоить
- ✅ Одинаково работает везде

### Запуск:
```bash
# Создать .env файл с ключами
echo "YANDEX_API_KEY=your_key" > .env
echo "YANDEX_FOLDER_ID=your_folder" >> .env

# Запустить в Docker
docker-compose -f docker-compose.mcp.yml up
```

## 🔌 Интеграция с Claude Desktop

MCP изначально создан для работы с Claude Desktop.

### Конфигурация:
```json
{
  "mcpServers": {
    "character-analyzer": {
      "command": "node",
      "args": ["/path/to/mcp/server.js"],
      "env": {
        "YANDEX_API_KEY": "your_key",
        "YANDEX_FOLDER_ID": "your_folder"
      }
    }
  }
}
```

После этого Claude будет иметь доступ к вашим инструментам анализа!

## 🎯 Практические сценарии

### Сценарий 1: Telegram бот (текущий)
```
Пользователь → Telegram → Бот → MCP Server → YandexGPT
```

### Сценарий 2: Claude Desktop
```
Пользователь → Claude Desktop → MCP Server → YandexGPT
```

### Сценарий 3: CLI утилита
```
Пользователь → CLI → MCP Client → MCP Server → YandexGPT
```

### Сценарий 4: Web приложение
```
Пользователь → React App → API → MCP Client → MCP Server → YandexGPT
```

## 📈 Масштабирование

### Один MCP сервер → много клиентов
```
             ┌─── Claude Desktop
             │
MCP Server ──┼─── Telegram Bot
             │
             ├─── CLI Tool
             │
             └─── Web App
```

### Много MCP серверов → один клиент
```
Character Analyzer ──┐
                     │
File System MCP ─────┼─── Claude Desktop
                     │
Database MCP ────────┘
```

## 🔒 Безопасность

MCP предоставляет:
- ✅ Контроль доступа к инструментам
- ✅ Валидация входных данных (Zod)
- ✅ Изоляция процессов
- ✅ Аудит вызовов

## 🚀 Следующие шаги

1. **Расширение инструментов**
   - Добавить работу с файлами
   - Интеграция с другими LLM
   - Добавить кэширование

2. **Новые клиенты**
   - Web интерфейс
   - VS Code расширение
   - Mobile приложение

3. **Оптимизация**
   - Параллельная обработка
   - Стриминг результатов
   - Rate limiting

## 📚 Ресурсы

- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [MCP SDK Documentation](https://github.com/modelcontextprotocol/sdk)
- [Examples](https://github.com/modelcontextprotocol/servers)

## 🎓 Выводы

**MCP решает ключевую проблему:** делает AI-приложения модульными и переиспользуемыми.

**Для вашего проекта:** вместо создания отдельных интеграций для каждого канала (Telegram, CLI, Web), вы создаете один MCP сервер и используете его везде.

**Это как REST API, но для AI** - стандартный способ взаимодействия с инструментами и данными.

