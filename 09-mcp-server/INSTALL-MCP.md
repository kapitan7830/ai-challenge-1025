# 🔧 Установка MCP - Пошаговое руководство

## ⚡ Быстрый старт (БЕЗ установки)

Посмотреть список MCP инструментов можно сразу:

```bash
node mcp/test-simple.js
```

Это покажет все 4 доступных инструмента без установки зависимостей.

## 📦 Полная установка

### Шаг 1: Установка зависимостей

```bash
npm install
```

**Если возникла ошибка с npm cache:**

```bash
# Очистите кэш с правами администратора
sudo npm cache clean --force

# Или измените владельца кэша
sudo chown -R $(whoami) ~/.npm

# Попробуйте снова
npm install
```

### Шаг 2: Настройка окружения

Создайте файл `.env`:

```bash
YANDEX_API_KEY=your_yandex_api_key_here
YANDEX_FOLDER_ID=your_yandex_folder_id_here
TELEGRAM_BOT_TOKEN=your_telegram_token_here  # опционально
```

### Шаг 3: Проверка установки

```bash
# Запустите тестовый скрипт
node mcp/test-simple.js
```

Вы должны увидеть список из 4 MCP инструментов.

## 🚀 Запуск MCP сервера

### Вариант 1: Локально

```bash
npm run mcp-server
```

Сервер запустится и будет ждать команды через stdio.

### Вариант 2: Docker (рекомендуется для продакшна)

```bash
# Соберите образ
docker build -f Dockerfile.mcp -t character-analyzer-mcp .

# Запустите
docker run -it \
  -e YANDEX_API_KEY=$YANDEX_API_KEY \
  -e YANDEX_FOLDER_ID=$YANDEX_FOLDER_ID \
  character-analyzer-mcp
```

### Вариант 3: Docker Compose (самый простой)

```bash
# Убедитесь что .env файл создан
docker-compose -f docker-compose.mcp.yml up
```

## 🧪 Тестирование

### Тест 1: Простой (без подключения)

```bash
node mcp/test-simple.js
```

Покажет список инструментов в человекочитаемом формате.

### Тест 2: Полный (с подключением к серверу)

Откройте два терминала:

**Терминал 1 (сервер):**
```bash
npm run mcp-server
```

**Терминал 2 (клиент):**
```bash
npm run mcp-client
```

Клиент подключится к серверу, получит список инструментов и выполнит демо-вызовы.

## 🔌 Настройка Claude Desktop

### macOS

1. Найдите конфиг:
```bash
open ~/Library/Application\ Support/Claude/
```

2. Отредактируйте `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "character-analyzer": {
      "command": "node",
      "args": ["/Users/ваш-пользователь/Projects/ai-challenge/09-mcp-server/mcp/server.js"],
      "env": {
        "YANDEX_API_KEY": "ваш_ключ",
        "YANDEX_FOLDER_ID": "ваш_folder_id"
      }
    }
  }
}
```

**Важно:** Укажите абсолютный путь к `server.js`!

3. Перезапустите Claude Desktop

4. Проверьте что инструменты доступны:
   - Откройте Claude
   - В правом нижнем углу должен быть значок инструментов
   - Попробуйте: "Проанализируй персонажей в тексте о Маше и волке"

### Windows

1. Найдите конфиг:
```
%APPDATA%\Claude\claude_desktop_config.json
```

2. Настройте аналогично macOS, но используйте Windows путь:
```json
{
  "mcpServers": {
    "character-analyzer": {
      "command": "node",
      "args": ["C:\\Users\\Ваше_имя\\Projects\\ai-challenge\\09-mcp-server\\mcp\\server.js"],
      "env": {
        "YANDEX_API_KEY": "ваш_ключ",
        "YANDEX_FOLDER_ID": "ваш_folder_id"
      }
    }
  }
}
```

## 🐛 Решение проблем

### Проблема 1: npm cache errors

**Симптомы:**
```
npm error code EEXIST
npm error syscall rename
```

**Решение:**
```bash
# macOS/Linux
sudo chown -R $(whoami) ~/.npm
npm cache clean --force
npm install

# Windows (PowerShell как администратор)
npm cache clean --force
npm install
```

### Проблема 2: MCP клиент не подключается

**Проверьте:**
1. Сервер запущен: `npm run mcp-server`
2. Порты не заняты
3. Переменные окружения установлены

**Решение:**
```bash
# Проверьте .env файл
cat .env

# Перезапустите сервер
npm run mcp-server
```

### Проблема 3: Claude Desktop не видит инструменты

**Проверьте:**
1. Путь к `server.js` абсолютный
2. Node.js установлен и доступен в PATH
3. API ключи в конфиге правильные
4. Claude Desktop перезапущен после изменения конфига

**Отладка:**
```bash
# Проверьте что server.js запускается
node /полный/путь/к/mcp/server.js

# Должно вывести:
# 🚀 MCP Server запущен!
# 📊 Доступные инструменты: ...
```

### Проблема 4: Docker не запускается

**Решение:**
```bash
# Проверьте Docker
docker --version

# Проверьте .env файл
cat .env

# Пересоберите образ
docker-compose -f docker-compose.mcp.yml build --no-cache

# Запустите
docker-compose -f docker-compose.mcp.yml up
```

## ✅ Проверка успешной установки

После установки вы должны успешно выполнить:

```bash
# 1. Простой тест
node mcp/test-simple.js
# ✅ Выводит 4 инструмента

# 2. MCP сервер
npm run mcp-server
# ✅ Выводит "MCP Server запущен!"

# 3. MCP клиент (в другом терминале)
npm run mcp-client
# ✅ Подключается и показывает инструменты + демо

# 4. Docker (опционально)
docker-compose -f docker-compose.mcp.yml up
# ✅ Сервер запускается в контейнере
```

## 📊 Что дальше?

После успешной установки:

1. **Прочитайте документацию:**
   - `MCP-GUIDE.md` - что такое MCP и зачем
   - `README-MCP.md` - как использовать
   - `MCP-SUMMARY.md` - краткое резюме

2. **Попробуйте инструменты:**
   - Запустите `npm run mcp-client`
   - Изучите примеры вызовов
   - Попробуйте свои тексты

3. **Интегрируйте в Claude Desktop:**
   - Настройте конфиг
   - Используйте в повседневной работе

4. **Расширьте функционал:**
   - Добавьте свои инструменты
   - Создайте новые ресурсы
   - Интегрируйте в свои приложения

## 🆘 Получить помощь

1. Проверьте логи:
   ```bash
   # Логи сервера
   npm run mcp-server 2>&1 | tee mcp-server.log
   
   # Логи клиента
   npm run mcp-client 2>&1 | tee mcp-client.log
   ```

2. Проверьте версии:
   ```bash
   node --version  # должно быть >= 18
   npm --version   # должно быть >= 9
   docker --version  # для Docker варианта
   ```

3. Изучите примеры в коде:
   - `mcp/server.js` - реализация сервера
   - `mcp/client.js` - пример клиента
   - `mcp/test-simple.js` - простая демонстрация

## 🎓 Готово!

Теперь у вас есть полностью настроенный MCP сервер с инструментами анализа персонажей. Используйте его в Claude Desktop, через CLI, или интегрируйте в свои приложения! 🚀

