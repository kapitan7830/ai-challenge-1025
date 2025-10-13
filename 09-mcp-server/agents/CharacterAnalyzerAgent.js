import dotenv from 'dotenv';
import { TokenCounter } from '../utils/TokenCounter.js';

dotenv.config();

/**
 * Агент для анализа персонажей в художественных текстах
 */
export class CharacterAnalyzerAgent {
  constructor() {
    this.name = 'Анализатор персонажей';
    this.model = 'yandexgpt-lite';
  }

  /**
   * Проанализировать текст и извлечь персонажей
   * @param {string} text - Текст рассказа (возможно, уже суммаризированный)
   * @returns {Promise<Object>} - Результат с анализом и статистикой
   */
  async analyzeCharacters(text) {
    const systemPrompt = `Ты - эксперт литературовед, специализирующийся на анализе персонажей.

Твоя задача - проанализировать текст и составить список всех персонажей.

Для каждого персонажа укажи:
1. 👤 Имя (или описание, если имя не указано)
2. 📝 Краткая характеристика (роль, профессия, статус)
3. 🧠 Психологический портрет (характер, мотивация, особенности)
4. 💫 Ключевые моменты (что делает, важные действия)

Формат ответа:
👤 [Имя персонажа]
📝 [Характеристика]
🧠 [Психологический портрет]
💫 [Ключевые моменты]

(повторить для каждого персонажа)

ВАЖНО: Если в тексте НЕТ персонажей (описание природы, техническая статья и т.п.), ответь одним словом: "ПЕРСОНАЖИ_НЕ_НАЙДЕНЫ"`;

    const startTime = Date.now();
    const inputTokens = TokenCounter.estimate(systemPrompt + text);

    console.log(`\n🎭 ${this.name} начинает анализ...`);
    console.log(`📊 Входные токены: ${inputTokens}`);

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
            temperature: 0.5,
            maxTokens: 2000,
          },
          messages: [
            {
              role: 'system',
              text: systemPrompt,
            },
            {
              role: 'user',
              text: text,
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

    // Проверяем, найдены ли персонажи
    const noCharactersFound = analysis.includes('ПЕРСОНАЖИ_НЕ_НАЙДЕНЫ');

    console.log(`⏱️  Время анализа: ${responseTime.toFixed(2)}с`);
    console.log(`📊 Токены: ${result.result.usage.totalTokens}`);
    console.log(`✅ Персонажи ${noCharactersFound ? 'не найдены' : 'найдены'}`);

    return {
      analysis,
      noCharactersFound,
      usage: {
        prompt_tokens: result.result.usage.inputTextTokens,
        completion_tokens: result.result.usage.completionTokens,
        total_tokens: result.result.usage.totalTokens,
      },
      responseTime,
      model: this.model,
    };
  }
}

