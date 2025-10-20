import OpenAI from 'openai';

export class StructureAnalyzer {
  constructor(apiKey) {
    this.openai = new OpenAI({ apiKey });
  }

  async analyzeStructure(repoInfo, treeText, filesList, processedFiles = []) {
    console.log(`\n🤖 Анализирую структуру проекта через AI...\n`);

    // Ограничиваем список файлов для контекста
    const maxFiles = 500;
    const filesContext = filesList.slice(0, maxFiles).join('\n');
    const truncatedNote = filesList.length > maxFiles 
      ? `\n... (показано ${maxFiles} из ${filesList.length} файлов)`
      : '';

    // Подготавливаем контекст с содержимым файлов
    let codeContext = '';
    if (processedFiles.length > 0) {
      console.log(`📄 Анализирую содержимое ${processedFiles.length} файлов...`);
      
      const configFiles = processedFiles.filter(f => f.isConfig);
      const codeFiles = processedFiles.filter(f => f.isCode);
      
      if (configFiles.length > 0) {
        codeContext += '\n## Конфигурационные файлы:\n\n';
        for (const file of configFiles.slice(0, 10)) {
          codeContext += `### ${file.path}\n`;
          codeContext += '```\n';
          codeContext += file.keyParts || file.content.substring(0, 1000);
          codeContext += '\n```\n\n';
        }
      }
      
      if (codeFiles.length > 0) {
        codeContext += '\n## Ключевые файлы кода:\n\n';
        for (const file of codeFiles.slice(0, 15)) {
          codeContext += `### ${file.path}\n`;
          codeContext += `*Размер: ${(file.size / 1024).toFixed(1)} KB${file.isTruncated ? ' (обрезан)' : ''}*\n\n`;
          codeContext += '```\n';
          codeContext += file.keyParts || file.content.substring(0, 1000);
          codeContext += '\n```\n\n';
        }
      }
    }

    const prompt = `Проанализируй структуру GitHub репозитория и дай подробный ответ на русском языке.

## Информация о репозитории:
- Название: ${repoInfo.fullName}
- Описание: ${repoInfo.description || 'Нет описания'}
- Основной язык: ${repoInfo.language || 'Не указан'}
- Звезд: ${repoInfo.stars}

## Дерево директорий:
${treeText}

## Список всех файлов:
${filesContext}${truncatedNote}

${codeContext}

Проанализируй структуру проекта и ответь на следующие вопросы:

1. **Тип проекта**: Что это за проект? (веб-приложение, библиотека, API, мобильное приложение, и т.д.)

2. **Технологический стек**: 
   - Какие фреймворки/библиотеки используются?
   - Какие языки программирования?
   - Какие инструменты сборки/управления зависимостями?

3. **Архитектура проекта**:
   - Какая архитектурная структура используется? (MVC, микросервисы, монолит, и т.д.)
   - Как организованы основные компоненты?
   - Какие паттерны проектирования используются?

4. **Ключевые директории**:
   - Перечисли главные директории и их назначение
   - Есть ли стандартная структура для данного типа проекта?

5. **Конфигурация и инфраструктура**:
   - Какие конфигурационные файлы присутствуют?
   - Есть ли Docker, CI/CD, тесты?
   - Какие инструменты разработки используются?

6. **Анализ кода**:
   - Какие основные модули/компоненты есть в коде?
   - Какие функции/классы являются ключевыми?
   - Есть ли интересные архитектурные решения?

7. **Особенности и интересные моменты**:
   - Что необычного или интересного в структуре?
   - Насколько хорошо организован проект?
   - Есть ли проблемы в архитектуре?

Представь анализ в структурированном формате, удобном для чтения.`;

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Ты опытный software architect и tech lead. Твоя задача - анализировать структуру проектов и давать понятные, структурированные объяснения на русском языке. Особое внимание уделяй анализу кода и архитектурным решениям.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
    });

    const analysis = completion.choices[0].message.content;
    console.log(`✅ Анализ завершен!\n`);
    
    return analysis;
  }

  formatMarkdown(repoInfo, analysis, treeText) {
    let md = `# ${repoInfo.fullName}\n\n`;
    
    if (repoInfo.description) {
      md += `> ${repoInfo.description}\n\n`;
    }

    md += `## Метаинформация\n\n`;
    md += `- **URL**: ${repoInfo.url}\n`;
    if (repoInfo.language) {
      md += `- **Основной язык**: ${repoInfo.language}\n`;
    }
    md += `- **Звезд**: ${repoInfo.stars}\n`;
    md += `- **Форков**: ${repoInfo.forks}\n`;
    md += `- **Ветка по умолчанию**: ${repoInfo.defaultBranch}\n\n`;

    md += `## Анализ структуры проекта\n\n`;
    md += analysis;
    
    md += `\n\n## Структура директорий\n\n`;
    md += '```\n';
    md += treeText;
    md += '```\n';

    return md;
  }
}


