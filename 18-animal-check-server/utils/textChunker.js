export class TextChunker {
  constructor(maxTokens = 8000) {
    // Примерно 4 символа = 1 токен для русского текста
    this.maxChars = maxTokens * 4;
  }
  
  splitText(text) {
    if (text.length <= this.maxChars) {
      return [text];
    }
    
    const chunks = [];
    const paragraphs = text.split(/\n\n+/);
    let currentChunk = '';
    
    for (const paragraph of paragraphs) {
      if ((currentChunk.length + paragraph.length) > this.maxChars) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = paragraph;
        } else {
          // Параграф сам по себе слишком большой
          const sentences = paragraph.split(/\. /);
          for (const sentence of sentences) {
            if ((currentChunk.length + sentence.length) > this.maxChars) {
              if (currentChunk) {
                chunks.push(currentChunk.trim());
              }
              currentChunk = sentence;
            } else {
              currentChunk += (currentChunk ? '. ' : '') + sentence;
            }
          }
        }
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }
  
  estimateTokens(text) {
    // Грубая оценка: 1 токен ≈ 4 символа для русского текста
    return Math.ceil(text.length / 4);
  }
}

