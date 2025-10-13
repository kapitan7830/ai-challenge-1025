# 🎭 Character Analyzer with MCP Support

Анализатор персонажей с поддержкой **Model Context Protocol (MCP)** - универсальный сервер для анализа текстов через стандартизированный протокол.

## 🔥 Что нового: MCP интеграция

Теперь весь функционал доступен через **MCP (Model Context Protocol)** - открытый стандарт от Anthropic для подключения инструментов к AI моделям.

### Зачем MCP?

**До MCP:**
- ❌ Каждый клиент (Telegram, CLI, Web) требует отдельной реализации
- ❌ Невозможно использовать инструменты в Claude Desktop
- ❌ Сложно интегрировать в другие приложения

**С MCP:**
- ✅ Один сервер - множество клиентов
- ✅ Работает с Claude Desktop из коробки
- ✅ Стандартный протокол для любых интеграций
- ✅ Автоматическая валидация и документация

## 🚀 Быстрый старт

### 1. Показать список MCP инструментов (без установки зависимостей)

```bash
node mcp/test-simple.js
```

**Вывод:**
```
🔧 MCP ИНСТРУМЕНТЫ - Character Analyzer

1. 📦 analyze_characters
   Анализирует персонажей в тексте
   
2. 📦 summarize_text
   Суммаризирует длинные тексты
   
3. 📦 estimate_tokens
   Оценивает количество токенов
   
4. 📦 check_token_limit
   Проверяет превышение лимита
```

### 2. Установить зависимости

```bash
npm install
```

### 3. Настроить переменные окружения

```bash
# Создайте .env файл
YANDEX_API_KEY=your_api_key
YANDEX_FOLDER_ID=your_folder_id
TELEGRAM_BOT_TOKEN=your_bot_token  # если используете Telegram
```

### 4. Запустить MCP сервер

```bash
npm run mcp-server
```

### 5. Протестировать MCP клиент

В другом терминале:
```bash
npm run mcp-client
```

**Результат:**
```
🔌 Подключение к MCP серверу...
✅ Подключено!

📋 ДОСТУПНЫЕ ИНСТРУМЕНТЫ MCP
━━━━━━━━━━━━━━━━━━━━━━━━━━

[Список всех инструментов с параметрами]

🎯 ДЕМОНСТРАЦИЯ: Вызов инструмента
━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 Тестовый текст: "Маша шла по лесу..."

🔍 Вызов: estimate_tokens
📊 Результат:
   Токенов: 24
   Символов: 60
   
🔍 Вызов: check_token_limit
📊 Результат:
   Токенов: 24 / 6000
   Использовано: 0.4%
   Превышен лимит: Нет ✅
```

## 🔧 Доступные MCP инструменты

### 1. `analyze_characters`

Полный анализ персонажей в тексте с психологическими портретами.

**Параметры:**
- `text` (string, обязательный) - текст рассказа
- `autoSummarize` (boolean, опционально) - автоматически суммаризировать длинные тексты (по умолчанию: true)

**Пример:**
```javascript
await client.callTool({
  name: 'analyze_characters',
  arguments: {
    text: 'Маша шла по лесу. Встретила волка по имени Серый...',
    autoSummarize: true
  }
});
```

**Результат:**
```json
{
  "success": true,
  "characters": "👤 Маша\n📝 Девочка\n🧠 Смелая и любопытная...",
  "statistics": {
    "originalTokens": 2500,
    "analysisTokens": 350,
    "totalTime": 2.5,
    "model": "yandexgpt-lite"
  }
}
```

### 2. `summarize_text`

Суммаризация длинных текстов с сохранением информации о персонажах.

**Параметры:**
- `text` (string, обязательный) - текст для суммаризации
- `chunkSize` (number, опционально) - размер частей в токенах (по умолчанию: 2000)

**Пример:**
```javascript
await client.callTool({
  name: 'summarize_text',
  arguments: {
    text: 'Очень длинный рассказ на 15000 символов...',
    chunkSize: 2000
  }
});
```

**Результат:**
```json
{
  "success": true,
  "summary": "Краткое содержание...",
  "statistics": {
    "originalTokens": 6000,
    "summaryTokens": 2100,
    "compressionRatio": 0.35,
    "chunks": 3,
    "totalTime": 8.5
  }
}
```

### 3. `estimate_tokens`

Оценка количества токенов в тексте.

**Параметры:**
- `text` (string, обязательный) - текст для оценки

**Результат:**
```json
{
  "success": true,
  "tokens": 240,
  "characters": 600,
  "ratio": "2.50",
  "estimatedCost": "0.07₽"
}
```

### 4. `check_token_limit`

Проверка превышения лимита токенов.

**Параметры:**
- `text` (string, обязательный) - текст для проверки
- `limit` (number, опционально) - лимит токенов (по умолчанию: 6000)

**Результат:**
```json
{
  "success": true,
  "tokens": 2400,
  "limit": 6000,
  "exceeds": false,
  "percentage": "40.0",
  "recommendation": "Текст помещается в лимит"
}
```

## 🐳 Запуск в Docker

### С Docker Compose:

```bash
# Создайте .env файл
echo "YANDEX_API_KEY=your_key" > .env
echo "YANDEX_FOLDER_ID=your_folder" >> .env

# Запустите
docker-compose -f docker-compose.mcp.yml up
```

### Обычный Docker:

```bash
docker build -f Dockerfile.mcp -t character-analyzer-mcp .

docker run -it \
  -e YANDEX_API_KEY=your_key \
  -e YANDEX_FOLDER_ID=your_folder \
  character-analyzer-mcp
```

## 🔌 Интеграция с Claude Desktop

1. Откройте конфигурацию Claude Desktop:
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`

2. Добавьте MCP сервер:

```json
{
  "mcpServers": {
    "character-analyzer": {
      "command": "node",
      "args": ["/absolute/path/to/mcp/server.js"],
      "env": {
        "YANDEX_API_KEY": "your_api_key",
        "YANDEX_FOLDER_ID": "your_folder_id"
      }
    }
  }
}
```

3. Перезапустите Claude Desktop

4. Теперь Claude имеет доступ к инструментам анализа! Попробуйте:

```
Проанализируй персонажей в этом тексте:
"Маша шла по лесу..."
```

Claude автоматически вызовет `analyze_characters`.

## 📚 Структура проекта

```
.
├── index.js                  # Telegram бот (старая версия)
├── agents/
│   └── CharacterAnalyzerAgent.js  # Агент анализа
├── utils/
│   ├── TextSummarizer.js     # Суммаризация
│   └── TokenCounter.js       # Подсчет токенов
├── mcp/
│   ├── server.js            # 🔥 MCP сервер
│   ├── client.js            # 🔥 Тестовый MCP клиент
│   └── test-simple.js       # 🔥 Демо без зависимостей
├── Dockerfile.mcp           # 🔥 Docker для MCP
├── docker-compose.mcp.yml   # 🔥 Docker Compose
├── MCP-GUIDE.md             # 🔥 Полное руководство по MCP
└── README-MCP.md            # 🔥 Этот файл
```

## 🎯 Сценарии использования

### 1. Standalone MCP сервер
```bash
npm run mcp-server
```
Используйте из любого MCP клиента.

### 2. Telegram бот (legacy)
```bash
npm start
```
Работает как раньше через Telegram.

### 3. Claude Desktop
Настройте в `claude_desktop_config.json`, используйте через чат.

### 4. Кастомный клиент
```javascript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

const client = new Client({...});
await client.connect(transport);
const tools = await client.listTools();
```

### 5. Docker
```bash
docker-compose -f docker-compose.mcp.yml up
```

## 📊 Сравнение режимов работы

| Режим | Преимущества | Когда использовать |
|-------|--------------|-------------------|
| **MCP Server** | Универсальность, стандартизация | Интеграция с Claude, множественные клиенты |
| **Telegram Bot** | Простота для пользователей | Публичный доступ, мессенджер |
| **Docker** | Изоляция, легкий деплой | Продакшн, CI/CD |
| **Claude Desktop** | Нативная интеграция | Личное использование |

## 🧪 Примеры использования

### Пример 1: Короткий текст

**Запрос:**
```javascript
{
  name: 'analyze_characters',
  arguments: {
    text: 'Маша встретила волка. Волк был голоден.'
  }
}
```

**Результат:**
- Время: ~1.5 сек
- Токены: ~150
- Персонажи: Маша, Волк

### Пример 2: Длинный текст

**Запрос:**
```javascript
{
  name: 'analyze_characters',
  arguments: {
    text: '[рассказ на 15000 символов]',
    autoSummarize: true
  }
}
```

**Результат:**
- Суммаризация: 6000 → 2100 токенов
- Время: ~12 сек
- Все персонажи найдены

## 🔐 Безопасность

MCP обеспечивает:
- ✅ Валидация входных данных через Zod
- ✅ Изоляция процессов
- ✅ Контроль доступа к инструментам
- ✅ Логирование всех вызовов

## 📈 Производительность

| Длина текста | Токены | Время обработки | MCP overhead |
|--------------|--------|-----------------|--------------|
| Короткий     | ~200   | 1-2 сек        | +0.1 сек     |
| Средний      | ~2000  | 3-5 сек        | +0.1 сек     |
| Длинный      | ~6000  | 10-15 сек      | +0.2 сек     |

MCP добавляет минимальный overhead на JSON-RPC коммуникацию.

## 🚀 Roadmap

- [ ] Streaming ответов
- [ ] Batch обработка
- [ ] Кэширование результатов
- [ ] WebSocket транспорт
- [ ] HTTP API endpoints
- [ ] Больше инструментов (файлы, БД)

## 📖 Документация

- [MCP-GUIDE.md](./MCP-GUIDE.md) - Полное руководство по MCP
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Архитектура проекта
- [test-examples.md](./test-examples.md) - Примеры тестов

## 🤝 Вклад

Проект демонстрирует интеграцию MCP в существующее AI-приложение.

## 📝 Лицензия

ISC

---

## ✨ Главные преимущества MCP

1. **Универсальность** - одна реализация для всех клиентов
2. **Стандартизация** - следует открытому протоколу
3. **Расширяемость** - легко добавлять новые инструменты
4. **Совместимость** - работает с Claude Desktop и другими MCP клиентами
5. **Безопасность** - встроенная валидация и контроль доступа

**MCP превращает ваш проект из Telegram-бота в универсальную платформу для AI-инструментов.** 🚀

