import dotenv from 'dotenv';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MCP_SERVER_PATH = join(__dirname, '..', 'mcp', 'server.js');

/**
 * Агент для анализа данных об уровне воды в реке
 */
export class RiverLevelAgent {
  constructor() {
    this.name = 'Анализатор уровня воды';
    this.model = 'yandexgpt-lite';
    this.mcpClient = null;
  }

  /**
   * Подключиться к MCP серверу
   */
  async connectToMCP() {
    if (this.mcpClient) {
      return; // Уже подключены
    }

    const transport = new StdioClientTransport({
      command: 'node',
      args: [MCP_SERVER_PATH],
    });

    this.mcpClient = new Client(
      {
        name: 'river-level-agent',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    await this.mcpClient.connect(transport);
    console.log('✅ Подключен к MCP серверу');
  }

  /**
   * Получить данные об уровне воды через MCP
   */
  async getRiverLevel() {
    if (!this.mcpClient) {
      await this.connectToMCP();
    }

    try {
      console.log('📡 Вызываю MCP инструмент get_river_level...');
      const result = await this.mcpClient.callTool({
        name: 'get_river_level',
        arguments: {},
      });

      console.log('📦 Получен ответ от MCP:', JSON.stringify(result, null, 2));
      const data = JSON.parse(result.content[0].text);
      console.log('✅ Данные распарсены:', data.success ? 'успешно' : 'с ошибкой');
      return data;
    } catch (error) {
      console.error('❌ Ошибка в getRiverLevel:', error);
      throw new Error(`Ошибка получения данных: ${error.message}`);
    }
  }

  /**
   * Проанализировать вопрос пользователя и дать ответ на основе данных
   * @param {string} userQuestion - Вопрос пользователя
   * @returns {Promise<Object>} - Ответ с анализом
   */
  async analyzeWaterLevel(userQuestion) {
    console.log(`\n🌊 ${this.name} начинает работу...`);
    console.log(`❓ Вопрос: ${userQuestion}`);

    // Получаем данные об уровне воды
    const riverData = await this.getRiverLevel();

    console.log('📊 Статус данных:', riverData.success);
    
    if (!riverData || !riverData.success) {
      console.error('❌ Ошибка в данных:', riverData);
      throw new Error(`Не удалось получить данные об уровне воды: ${riverData?.error || 'неизвестная ошибка'}`);
    }

    const systemPrompt = `Ты - эксперт по анализу уровня воды в реках. 

Тебе предоставлены данные о текущем уровне воды в трёх городах: Сростки, Бийск и Барнаул за последние 7 дней.

Твоя задача - ответить на вопрос пользователя на основе этих данных.

Правила ответа:
1. Используй русский язык
2. Будь конкретным и информативным
3. Укажи конкретные цифры из данных
4. Объясни тренд (растёт/падает)
5. Если в вопросе упоминается конкретный город, сосредоточься на нём
6. Формат ответа должен быть понятным и структурированным

ВАЖНО: Отвечай только на основе предоставленных данных. Не придумывай информацию.`;

    const userPrompt = `ВОПРОС ПОЛЬЗОВАТЕЛЯ: ${userQuestion}

ДАННЫЕ ОБ УРОВНЕ ВОДЫ:
${riverData.data}

Проанализируй данные и ответь на вопрос пользователя.`;

    const startTime = Date.now();

    console.log(`📊 Отправляю запрос к YandexGPT...`);

    const response = await fetch(
      'https://llm.api.cloud.yandex.net/foundationModels/v1/completion',
      {
        method: 'POST',
        headers: {
          'Authorization': `Api-Key ${process.env.YANDEX_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          modelUri: `gpt://${process.env.YANDEX_FOLDER_ID}/${this.model}/latest`,
          completionOptions: {
            stream: false,
            temperature: 0.3,
            maxTokens: 2000,
          },
          messages: [
            {
              role: 'system',
              text: systemPrompt,
            },
            {
              role: 'user',
              text: userPrompt,
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Yandex API error: ${error}`);
    }

    const result = await response.json();
    const analysis = result.result.alternatives[0].message.text;

    const endTime = Date.now();
    const responseTime = (endTime - startTime) / 1000;

    console.log(`⏱️  Время анализа: ${responseTime.toFixed(2)}с`);
    console.log(`📊 Токены: ${result.result.usage.totalTokens}`);
    console.log(`✅ Анализ завершён`);

    return {
      answer: analysis,
      rawData: riverData.data,
      usage: {
        prompt_tokens: result.result.usage.inputTextTokens,
        completion_tokens: result.result.usage.completionTokens,
        total_tokens: result.result.usage.totalTokens,
      },
      responseTime,
      model: this.model,
      timestamp: riverData.timestamp,
      dataFetched: true,
    };
  }

  /**
   * Закрыть соединение с MCP
   */
  async close() {
    if (this.mcpClient) {
      await this.mcpClient.close();
      this.mcpClient = null;
      console.log('🔌 Отключен от MCP сервера');
    }
  }
}

