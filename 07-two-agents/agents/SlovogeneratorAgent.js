import dotenv from 'dotenv';

dotenv.config();

export class SlovogeneratorAgent {
  constructor() {
    this.name = 'Словогенератор';
    this.model = 'yandexgpt-lite';
  }

  async generateWords(topic) {
    const systemPrompt = `Ты - помощник, генерирующий слова по заданной теме. 
Твоя задача - сгенерировать ровно 10 слов на тему, которую даст пользователь.
Слова должны быть связаны с темой и разнообразны.
Отвечай ТОЛЬКО списком из 10 слов через запятую, без нумерации и дополнительных пояснений.`;

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
            temperature: 0.9,
            maxTokens: 500,
          },
          messages: [
            {
              role: 'system',
              text: systemPrompt,
            },
            {
              role: 'user',
              text: `Тема: ${topic}`,
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
    const wordsText = result.result.alternatives[0].message.text;
    
    // Парсим слова из ответа
    const words = wordsText
      .split(',')
      .map(word => word.trim())
      .filter(word => word.length > 0)
      .slice(0, 10); // На всякий случай ограничим 10 словами

    const endTime = Date.now();
    const responseTime = (endTime - startTime) / 1000;

    return {
      words,
      usage: {
        prompt_tokens: result.result.usage.inputTextTokens,
        completion_tokens: result.result.usage.completionTokens,
        total_tokens: result.result.usage.totalTokens,
      },
      responseTime,
    };
  }
}

