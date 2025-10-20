import 'dotenv/config';
import { GitHubRepoAnalyzer } from './github-repo-analyzer.js';
import { StructureAnalyzer } from './structure-analyzer.js';
import { FileProcessor } from './file-processor.js';
import fs from 'fs/promises';
import path from 'path';

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  const githubToken = process.env.GITHUB_TOKEN;

  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY не задан в .env файле');
    process.exit(1);
  }

  // GitHub token опционален для публичных репозиториев
  const repoAnalyzer = new GitHubRepoAnalyzer(githubToken);
  const structureAnalyzer = new StructureAnalyzer(apiKey);
  const fileProcessor = new FileProcessor();

  // Получаем URL репозитория из аргументов командной строки
  const repoUrl = process.argv[2];
  
  if (!repoUrl) {
    console.error('❌ Укажи URL GitHub репозитория');
    console.log('\nИспользование:');
    console.log('  npm start https://github.com/owner/repo');
    console.log('  npm start owner/repo');
    process.exit(1);
  }

  try {
    console.log('🚀 GitHub Structure Analyzer');
    console.log('='.repeat(80));

    // Получаем структуру репозитория
    const { repoInfo, tree, treeText, importantFiles } = await repoAnalyzer.analyzeRepository(repoUrl);

    // Обрабатываем содержимое файлов
    const processedFiles = fileProcessor.processFiles(importantFiles);

    // Анализируем структуру через AI
    const analysis = await structureAnalyzer.analyzeStructure(
      repoInfo,
      treeText,
      tree.files,
      processedFiles
    );

    // Форматируем результат в markdown
    const markdown = structureAnalyzer.formatMarkdown(repoInfo, analysis, treeText);

    // Выводим результат
    console.log('\n' + '='.repeat(80));
    console.log('\n📋 РЕЗУЛЬТАТ АНАЛИЗА:\n');
    console.log(analysis);
    console.log('\n' + '='.repeat(80));

    // Сохраняем в файл
    const outputDir = path.join(process.cwd(), 'output');
    await fs.mkdir(outputDir, { recursive: true });
    
    const sanitizedName = repoInfo.fullName.replace('/', '-');
    const outputPath = path.join(outputDir, `${sanitizedName}-analysis.md`);
    
    await fs.writeFile(outputPath, markdown, 'utf-8');
    console.log(`\n💾 Результат сохранен в: ${outputPath}`);

  } catch (error) {
    console.error(`\n❌ Ошибка: ${error.message}`);
    process.exit(1);
  }
}

main().catch(console.error);
