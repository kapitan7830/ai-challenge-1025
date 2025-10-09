import dotenv from 'dotenv';

dotenv.config();

export class RasskazogeneratorAgent {
  constructor() {
    this.name = 'Рассказогенератор';
    this.model = 'yandexgpt-lite';
  }

  async generateStory(words) {
    const systemPrompt = `Ты - писатель, который составляет короткие рассказы.
Твоя задача - составить рассказ из РОВНО 5 предложений.
В КАЖДОМ предложении должно быть использовано РОВНО 2 слова из списка, который даст пользователь.
Рассказ должен быть связным и логичным.
Отвечай ТОЛЬКО текстом рассказа, без дополнительных пояснений.`;

    const startTime = Date.now();

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
            temperature: 0.8,
            maxTokens: 1000,
          },
          messages: [
            {
              role: 'system',
              text: systemPrompt,
            },
            {
              role: 'user',
              text: `Список слов: ${words.join(', ')}`,
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
    const story = result.result.alternatives[0].message.text;

    const endTime = Date.now();
    const responseTime = (endTime - startTime) / 1000;

    return {
      story,
      usage: {
        prompt_tokens: result.result.usage.inputTextTokens,
        completion_tokens: result.result.usage.completionTokens,
        total_tokens: result.result.usage.totalTokens,
      },
      responseTime,
    };
  }
}

