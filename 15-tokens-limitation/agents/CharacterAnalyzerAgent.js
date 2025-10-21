import OpenAI from 'openai';
import dotenv from 'dotenv';
import { TokenCounter } from '../utils/TokenCounter.js';
import { retryHandler } from '../utils/RetryHandler.js';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Агент для анализа персонажей в художественных текстах
 */
export class CharacterAnalyzerAgent {
  constructor() {
    this.name = 'Анализатор персонажей';
    this.model = 'gpt-4o-mini'; // Дешевая и быстрая модель
  }

  /**
   * Извлечь досье персонажей из фрагмента текста
   * @param {string} text - Фрагмент текста
   * @param {number} chunkIndex - Номер фрагмента
   * @returns {Promise<Object>} - Досье персонажей из этого фрагмента
   */
  async extractDossiers(text, chunkIndex) {
    const systemPrompt = `Ты - эксперт литературовед, специализирующийся на анализе персонажей.

Твоя задача - извлечь из данного фрагмента текста досье на всех упомянутых персонажей.

Верни JSON объект с полем "characters" - массив досье персонажей:
{
  "characters": [
    {
      "name": "Имя персонажа",
      "description": "Краткий рассказ о персонаже: кто он, его роль в сюжете, характер, мотивация, важные действия в этом фрагменте",
      "relationships": "Отношения с другими персонажами, упомянутые в этом фрагменте",
      "plot_impact": "Как этот персонаж влияет на развитие сюжета в данном фрагменте"
    }
  ]
}

ВАЖНО:
- Пиши живым языком, как краткое досье разведки
- НЕ используй смайлики и списки с эмодзи
- Каждое поле - связный текст из нескольких предложений
- Если персонаж только упомянут, но не действует - все равно создай досье
- Если в фрагменте НЕТ персонажей, верни {"characters": []}

Верни ТОЛЬКО валидный JSON объект.`;

    const startTime = Date.now();
    const estimatedTokens = TokenCounter.estimate(systemPrompt + text);

    console.log(`\n🎭 ${this.name} извлекает досье из фрагмента ${chunkIndex + 1}...`);
    console.log(`📊 Входные токены: ${estimatedTokens}`);

    try {
      const response = await retryHandler.executeOpenAIRequest(
        () => openai.chat.completions.create({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: text,
            },
          ],
          max_tokens: 4000,
          temperature: 0.3,
          response_format: { type: "json_object" },
        }),
        this.model,
        estimatedTokens
      );

      const content = response.choices[0].message.content;
      const endTime = Date.now();
      const responseTime = (endTime - startTime) / 1000;

      console.log(`⏱️  Время: ${responseTime.toFixed(2)}с`);
      console.log(`📊 Токены: ${response.usage.total_tokens}`);

      // Парсим JSON
      let dossiers = [];
      try {
        const parsed = JSON.parse(content);
        dossiers = parsed.characters || [];
        
        if (!Array.isArray(dossiers)) {
          console.warn('Ответ не является массивом, пытаюсь извлечь данные...');
          dossiers = [];
        }
      } catch (parseError) {
        console.error('❌ Ошибка парсинга JSON:', parseError.message);
        console.error('Ответ от модели:', content);
        // Не выбрасываем ошибку, просто возвращаем пустой массив
        dossiers = [];
      }

      console.log(`✅ Извлечено досье: ${dossiers.length} персонажей`);
      if (dossiers.length > 0) {
        dossiers.forEach((d, i) => {
          console.log(`\n   ${i + 1}. ${d.name || 'Безымянный персонаж'}`);
          console.log(`      ${d.description?.substring(0, 100)}...`);
        });
      }

      return {
        dossiers,
        chunkIndex,
        usage: response.usage,
        responseTime,
      };
    } catch (error) {
      console.error(`❌ Ошибка в extractDossiers для фрагмента ${chunkIndex + 1}:`, error.message);
      throw error;
    }
  }

  /**
   * Объединить досье персонажей из разных фрагментов
   * @param {Array} allDossiers - Массив массивов досье
   * @returns {Promise<Object>} - Финальный анализ
   */
  async mergeDossiers(allDossiers) {
    const systemPrompt = `Ты - эксперт литературовед, специализирующийся на анализе персонажей.

Тебе предоставлены досье на персонажей, извлеченные из разных фрагментов текста. Твоя задача - объединить информацию о каждом персонаже и создать финальное досье.

Для каждого персонажа напиши:
1. Имя персонажа
2. Полное досье - краткий, но содержательный рассказ (2-4 абзаца) о персонаже, который включает:
   - Кто он и его роль в произведении
   - Его характер, мотивация, интеллектуальные способности
   - Отношения с другими персонажами
   - Как он влияет на развитие сюжета
   - Важность для произведения

ВАЖНО:
- Пиши живым языком, как литературоведческий анализ
- НЕ используй смайлики, списки с эмодзи, или построчное оформление
- Текст должен быть связным и читаемым
- Объедини информацию из всех фрагментов
- Если один персонаж упомянут в нескольких фрагментах - объедини информацию о нем

Формат ответа для каждого персонажа:
[ИМЯ ПЕРСОНАЖА]

[Досье - связный текст]

---`;

    const dossiersText = JSON.stringify(allDossiers, null, 2);
    
    const startTime = Date.now();

    try {
      const estimatedTokens = TokenCounter.estimate(systemPrompt + dossiersText);
      
      const response = await retryHandler.executeOpenAIRequest(
        () => openai.chat.completions.create({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: dossiersText,
            },
          ],
          max_tokens: 6000,
          temperature: 0.4,
        }),
        this.model,
        estimatedTokens
      );

      const analysis = response.choices[0].message.content;
      const endTime = Date.now();
      const responseTime = (endTime - startTime) / 1000;

      const noCharactersFound = !analysis || analysis.trim().length < 50;

      console.log(`⏱️  Время объединения: ${responseTime.toFixed(2)}с`);
      console.log(`📊 Токены: ${response.usage.total_tokens}`);

      return {
        analysis,
        noCharactersFound,
        usage: response.usage,
        responseTime,
        model: this.model,
      };
    } catch (error) {
      throw new Error(`OpenAI API error in merging: ${error.message}`);
    }
  }

  /**
   * Проанализировать текст и извлечь персонажей (старый метод для совместимости)
   * @param {string} text - Текст рассказа
   * @returns {Promise<Object>} - Результат с анализом и статистикой
   */
  async analyzeCharacters(text) {
    const systemPrompt = `Ты - эксперт литературовед, специализирующийся на анализе персонажей.

Проанализируй текст и для каждого персонажа напиши краткое досье (2-3 абзаца):
- Кто он и его роль
- Характер и мотивация
- Отношения с другими
- Влияние на сюжет

Пиши живым языком без смайликов и списков.

Если персонажей нет, ответь: "ПЕРСОНАЖИ_НЕ_НАЙДЕНЫ"`;

    const startTime = Date.now();
    const inputTokens = TokenCounter.estimate(systemPrompt + text);

    console.log(`\n🎭 ${this.name} начинает анализ...`);
    console.log(`📊 Входные токены: ${inputTokens}`);

    try {
      const estimatedTokens = TokenCounter.estimate(systemPrompt + text);
      
      const response = await retryHandler.executeOpenAIRequest(
        () => openai.chat.completions.create({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: text,
            },
          ],
          max_tokens: 4000,
          temperature: 0.4,
        }),
        this.model,
        estimatedTokens
      );

      const analysis = response.choices[0].message.content;
      const endTime = Date.now();
      const responseTime = (endTime - startTime) / 1000;

      // Проверяем, найдены ли персонажи
      const noCharactersFound = analysis.includes('ПЕРСОНАЖИ_НЕ_НАЙДЕНЫ');

      console.log(`⏱️  Время анализа: ${responseTime.toFixed(2)}с`);
      console.log(`📊 Токены: ${response.usage.total_tokens}`);
      console.log(`✅ Персонажи ${noCharactersFound ? 'не найдены' : 'найдены'}`);

      return {
        analysis,
        noCharactersFound,
        usage: response.usage,
        responseTime,
        model: this.model,
      };
    } catch (error) {
      throw new Error(`OpenAI API error: ${error.message}`);
    }
  }
}

