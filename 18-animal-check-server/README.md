# Анализатор упоминаний животных

Telegram бот для анализа информации о животных из веб-страниц с использованием OpenAI агентов и Perplexity API.

## Структура

- **bot.js** - Telegram бот на Telegraf
- **index.js** - CLI версия для анализа статей
- **agents/** - агенты OpenAI
  - `animalDetectorAgent.js` - поиск животных в тексте
  - `zoologistAgent.js` - научная справка по животным
- **services/** - внешние сервисы
  - `perplexitySearch.js` - поиск через Perplexity API
- **utils/** - вспомогательные модули
  - `webParser.js` - извлечение текста со страниц
  - `textChunker.js` - разбивка больших текстов
  - `logger.js` - логирование процесса

## Установка

```bash
npm install
```

Создай файл `.env`:
```
OPENAI_API_KEY=your_key_here
TELEGRAM_BOT_TOKEN=your_bot_token_here
PERPLEXITY_API_KEY=your_perplexity_key_here
LOG_LEVEL=info
```

## Использование

### Telegram бот
```bash
npm run bot
```

Команды бота:
- `/start` - начать работу
- `/article` - анализ животных из статьи по ссылке
- `/animal` - получить информацию о конкретном животном
- `/reset` - сбросить состояние

### CLI версия
```bash
npm start <URL>
```

Пример:
```bash
npm start https://example.com/article
```

## Как работает

1. **Telegram бот**: интерактивный анализ через команды
2. **Извлечение текста**: парсинг веб-страниц без HTML
3. **Агент 1**: поиск упоминаний животных с контекстом
4. **Perplexity API**: поиск научной информации о животных
5. **Агент 2**: анализ и формирование научной справки
6. **Результат**: подробная информация о морфологии, поведении и ареале обитания

## Технологии

- **Telegraf 4.16.3** - Telegram Bot API
- **OpenAI GPT-4o-mini** - для агентов анализа
- **Perplexity API** - поиск актуальной информации
- **JSDOM** - парсинг веб-страниц
- **Pino** - логирование

