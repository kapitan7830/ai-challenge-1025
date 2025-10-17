import OpenAI from 'openai';

export class SummaryAgent {
  constructor(apiKey) {
    this.openai = new OpenAI({ apiKey });
    // Для gpt-4o-mini контекст 128k токенов
    // Безопасный размер чанка: 6000 токенов (~18000 символов для русского)
    this.maxChunkTokens = 6000;
    this.charsPerToken = 3; // Для русского языка примерно 3 символа на токен
  }

  estimateTokens(text) {
    return Math.ceil(text.length / this.charsPerToken);
  }

  splitTextIntoChunks(text) {
    const maxChunkSize = this.maxChunkTokens * this.charsPerToken;
    
    if (this.estimateTokens(text) <= this.maxChunkTokens) {
      return [text];
    }

    const chunks = [];
    // Разбиваем на абзацы
    const paragraphs = text.split(/\n\n+/);
    
    let currentChunk = '';
    
    for (const paragraph of paragraphs) {
      const testChunk = currentChunk + (currentChunk ? '\n\n' : '') + paragraph;
      
      if (testChunk.length > maxChunkSize && currentChunk) {
        // Текущий чанк переполнен, сохраняем его
        chunks.push(currentChunk.trim());
        currentChunk = paragraph;
      } else {
        currentChunk = testChunk;
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    // Если абзацы слишком большие, разбиваем по предложениям
    const finalChunks = [];
    for (const chunk of chunks) {
      if (chunk.length > maxChunkSize) {
        const sentences = chunk.match(/[^.!?]+[.!?]+/g) || [chunk];
        let sentenceChunk = '';
        
        for (const sentence of sentences) {
          const testSentence = sentenceChunk + sentence;
          
          if (testSentence.length > maxChunkSize && sentenceChunk) {
            finalChunks.push(sentenceChunk.trim());
            sentenceChunk = sentence;
          } else {
            sentenceChunk = testSentence;
          }
        }
        
        if (sentenceChunk.trim()) {
          finalChunks.push(sentenceChunk.trim());
        }
      } else {
        finalChunks.push(chunk);
      }
    }
    
    return finalChunks;
  }

  async summarizeChunk(text, isRecursive = false) {
    const systemPrompt = isRecursive
      ? 'Ты помощник для объединения и суммаризации резюме текстов. Объедини представленные резюме в единое связное резюме на русском языке, сохраняя все ключевые выводы.'
      : 'Ты помощник для суммаризации технических статей. Создай краткое резюме текста на русском языке, выделяя главные выводы и ключевые идеи.';

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: text
        }
      ],
      temperature: 0.3,
    });

    return completion.choices[0].message.content;
  }

  async summarize(text, title = '', sourceUrl = '') {
    console.log(`\n📊 Анализ текста...`);
    const tokens = this.estimateTokens(text);
    console.log(`Размер текста: ${text.length} символов (~${tokens} токенов)`);

    let summaries = [];
    let level = 1;
    let currentText = text;

    // Рекурсивная суммаризация
    while (true) {
      const chunks = this.splitTextIntoChunks(currentText);
      console.log(`\n🔄 Уровень ${level}: разбито на ${chunks.length} частей`);

      if (chunks.length === 1) {
        // Финальная суммаризация
        console.log(`✨ Создание финального резюме...`);
        const finalSummary = await this.summarizeChunk(chunks[0], level > 1);
        summaries = [finalSummary];
        break;
      }

      // Суммаризируем каждый чанк
      const chunkSummaries = [];
      for (let i = 0; i < chunks.length; i++) {
        console.log(`  Обработка части ${i + 1}/${chunks.length}...`);
        const summary = await this.summarizeChunk(chunks[i], level > 1);
        chunkSummaries.push(summary);
      }

      // Объединяем резюме для следующего уровня
      currentText = chunkSummaries.join('\n\n');
      summaries = chunkSummaries;
      level++;
    }

    // Форматируем в markdown
    const markdown = this.formatMarkdown(title, summaries[0], sourceUrl);
    console.log(`\n✅ Резюме готово!`);
    
    return markdown;
  }

  formatMarkdown(title, summary, sourceUrl) {
    let md = '';
    
    if (title) {
      md += `# ${title}\n\n`;
    }
    
    md += `## Резюме статьи\n\n`;
    md += summary;
    
    if (sourceUrl) {
      md += `\n\n## Источник\n\n`;
      md += `[Оригинальная статья](${sourceUrl})`;
    }
    
    return md;
  }
}

