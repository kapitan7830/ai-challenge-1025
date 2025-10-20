export class FileProcessor {
  constructor() {
    // Максимальный размер файла для полного анализа (100KB)
    this.maxFileSize = 100 * 1024;
    // Максимальный размер чанка для AI (20KB)
    this.maxChunkSize = 20 * 1024;
    // Максимальное количество строк для показа
    this.maxLinesToShow = 100;
  }

  shouldProcessFile(file) {
    // Обрабатываем только код файлы и конфиги
    return file.isCode || file.isConfig;
  }

  truncateContent(content, maxSize = this.maxFileSize) {
    if (content.length <= maxSize) {
      return content;
    }
    
    // Обрезаем по строкам, чтобы не обрывать в середине
    const lines = content.split('\n');
    let result = '';
    let currentSize = 0;
    
    for (const line of lines) {
      if (currentSize + line.length + 1 > maxSize) {
        break;
      }
      result += line + '\n';
      currentSize += line.length + 1;
    }
    
    return result + '\n... (файл обрезан)';
  }

  extractKeyParts(content, filePath) {
    const lines = content.split('\n');
    const keyParts = [];
    
    // Извлекаем ключевые части в зависимости от типа файла
    if (filePath.endsWith('.json')) {
      return this.extractJsonKeyParts(content);
    }
    
    if (filePath.endsWith('.js') || filePath.endsWith('.ts') || filePath.endsWith('.jsx') || filePath.endsWith('.tsx')) {
      return this.extractJSKeyParts(content);
    }
    
    if (filePath.endsWith('.py')) {
      return this.extractPythonKeyParts(content);
    }
    
    if (filePath.endsWith('.java')) {
      return this.extractJavaKeyParts(content);
    }
    
    if (filePath.endsWith('.go')) {
      return this.extractGoKeyParts(content);
    }
    
    if (filePath.endsWith('.rs')) {
      return this.extractRustKeyParts(content);
    }
    
    // Общий подход для других языков
    return this.extractGenericKeyParts(content);
  }

  extractJsonKeyParts(content) {
    try {
      const parsed = JSON.parse(content);
      const keyParts = [];
      
      // Для package.json
      if (parsed.name) keyParts.push(`name: ${parsed.name}`);
      if (parsed.version) keyParts.push(`version: ${parsed.version}`);
      if (parsed.description) keyParts.push(`description: ${parsed.description}`);
      if (parsed.scripts) keyParts.push(`scripts: ${Object.keys(parsed.scripts).join(', ')}`);
      if (parsed.dependencies) keyParts.push(`dependencies: ${Object.keys(parsed.dependencies).length} packages`);
      if (parsed.devDependencies) keyParts.push(`devDependencies: ${Object.keys(parsed.devDependencies).length} packages`);
      
      return keyParts.join('\n');
    } catch {
      return content.substring(0, 500) + (content.length > 500 ? '...' : '');
    }
  }

  extractJSKeyParts(content) {
    const keyParts = [];
    const lines = content.split('\n');
    
    // Ищем импорты
    const imports = lines.filter(line => 
      line.trim().startsWith('import ') || 
      line.trim().startsWith('const ') && line.includes('require(') ||
      line.trim().startsWith('var ') && line.includes('require(')
    ).slice(0, 10);
    
    if (imports.length > 0) {
      keyParts.push('// Imports:');
      keyParts.push(...imports);
    }
    
    // Ищем экспорты
    const exports = lines.filter(line => 
      line.trim().startsWith('export ') ||
      line.trim().startsWith('module.exports') ||
      line.trim().startsWith('exports.')
    ).slice(0, 5);
    
    if (exports.length > 0) {
      keyParts.push('\n// Exports:');
      keyParts.push(...exports);
    }
    
    // Ищем классы и функции
    const classes = lines.filter(line => 
      line.trim().startsWith('class ') ||
      line.trim().includes('class ')
    ).slice(0, 5);
    
    if (classes.length > 0) {
      keyParts.push('\n// Classes:');
      keyParts.push(...classes);
    }
    
    const functions = lines.filter(line => 
      line.trim().startsWith('function ') ||
      line.trim().includes('function ') ||
      line.trim().includes('=>') ||
      line.trim().startsWith('const ') && line.includes('=')
    ).slice(0, 10);
    
    if (functions.length > 0) {
      keyParts.push('\n// Functions:');
      keyParts.push(...functions);
    }
    
    return keyParts.join('\n');
  }

  extractPythonKeyParts(content) {
    const keyParts = [];
    const lines = content.split('\n');
    
    // Импорты
    const imports = lines.filter(line => 
      line.trim().startsWith('import ') || 
      line.trim().startsWith('from ')
    ).slice(0, 10);
    
    if (imports.length > 0) {
      keyParts.push('# Imports:');
      keyParts.push(...imports);
    }
    
    // Классы
    const classes = lines.filter(line => 
      line.trim().startsWith('class ')
    ).slice(0, 5);
    
    if (classes.length > 0) {
      keyParts.push('\n# Classes:');
      keyParts.push(...classes);
    }
    
    // Функции
    const functions = lines.filter(line => 
      line.trim().startsWith('def ')
    ).slice(0, 10);
    
    if (functions.length > 0) {
      keyParts.push('\n# Functions:');
      keyParts.push(...functions);
    }
    
    return keyParts.join('\n');
  }

  extractJavaKeyParts(content) {
    const keyParts = [];
    const lines = content.split('\n');
    
    // Импорты
    const imports = lines.filter(line => 
      line.trim().startsWith('import ')
    ).slice(0, 10);
    
    if (imports.length > 0) {
      keyParts.push('// Imports:');
      keyParts.push(...imports);
    }
    
    // Классы
    const classes = lines.filter(line => 
      line.trim().startsWith('public class ') ||
      line.trim().startsWith('class ') ||
      line.trim().startsWith('public interface ') ||
      line.trim().startsWith('interface ')
    ).slice(0, 5);
    
    if (classes.length > 0) {
      keyParts.push('\n// Classes/Interfaces:');
      keyParts.push(...classes);
    }
    
    // Методы
    const methods = lines.filter(line => 
      line.trim().startsWith('public ') && line.includes('(') ||
      line.trim().startsWith('private ') && line.includes('(') ||
      line.trim().startsWith('protected ') && line.includes('(')
    ).slice(0, 10);
    
    if (methods.length > 0) {
      keyParts.push('\n// Methods:');
      keyParts.push(...methods);
    }
    
    return keyParts.join('\n');
  }

  extractGoKeyParts(content) {
    const keyParts = [];
    const lines = content.split('\n');
    
    // Импорты
    const imports = lines.filter(line => 
      line.trim().startsWith('import ')
    ).slice(0, 10);
    
    if (imports.length > 0) {
      keyParts.push('// Imports:');
      keyParts.push(...imports);
    }
    
    // Пакет
    const packageLine = lines.find(line => line.trim().startsWith('package '));
    if (packageLine) {
      keyParts.push(packageLine);
    }
    
    // Функции
    const functions = lines.filter(line => 
      line.trim().startsWith('func ')
    ).slice(0, 10);
    
    if (functions.length > 0) {
      keyParts.push('\n// Functions:');
      keyParts.push(...functions);
    }
    
    // Структуры
    const structs = lines.filter(line => 
      line.trim().startsWith('type ') && line.includes('struct')
    ).slice(0, 5);
    
    if (structs.length > 0) {
      keyParts.push('\n// Structs:');
      keyParts.push(...structs);
    }
    
    return keyParts.join('\n');
  }

  extractRustKeyParts(content) {
    const keyParts = [];
    const lines = content.split('\n');
    
    // Импорты
    const imports = lines.filter(line => 
      line.trim().startsWith('use ')
    ).slice(0, 10);
    
    if (imports.length > 0) {
      keyParts.push('// Imports:');
      keyParts.push(...imports);
    }
    
    // Функции
    const functions = lines.filter(line => 
      line.trim().startsWith('fn ') ||
      line.trim().startsWith('pub fn ')
    ).slice(0, 10);
    
    if (functions.length > 0) {
      keyParts.push('\n// Functions:');
      keyParts.push(...functions);
    }
    
    // Структуры
    const structs = lines.filter(line => 
      line.trim().startsWith('struct ') ||
      line.trim().startsWith('pub struct ')
    ).slice(0, 5);
    
    if (structs.length > 0) {
      keyParts.push('\n// Structs:');
      keyParts.push(...structs);
    }
    
    return keyParts.join('\n');
  }

  extractGenericKeyParts(content) {
    const lines = content.split('\n');
    const keyParts = [];
    
    // Первые 20 строк
    keyParts.push(...lines.slice(0, 20));
    
    // Если файл большой, добавляем последние 10 строк
    if (lines.length > 30) {
      keyParts.push('\n... (пропущено) ...\n');
      keyParts.push(...lines.slice(-10));
    }
    
    return keyParts.join('\n');
  }

  processFile(file) {
    if (!this.shouldProcessFile(file)) {
      return null;
    }

    const processed = {
      path: file.path,
      size: file.size,
      isConfig: file.isConfig,
      isCode: file.isCode,
      content: null,
      keyParts: null,
      isTruncated: false
    };

    // Если файл большой, обрезаем его
    if (file.content.length > this.maxFileSize) {
      processed.content = this.truncateContent(file.content);
      processed.isTruncated = true;
    } else {
      processed.content = file.content;
    }

    // Извлекаем ключевые части
    processed.keyParts = this.extractKeyParts(processed.content, file.path);

    return processed;
  }

  processFiles(files) {
    console.log(`\n🔧 Обрабатываю содержимое файлов...`);
    
    const processedFiles = [];
    let totalSize = 0;
    let truncatedCount = 0;

    for (const file of files) {
      const processed = this.processFile(file);
      if (processed) {
        processedFiles.push(processed);
        totalSize += processed.size;
        if (processed.isTruncated) {
          truncatedCount++;
        }
      }
    }

    console.log(`📊 Обработано файлов: ${processedFiles.length}`);
    console.log(`📏 Общий размер: ${(totalSize / 1024).toFixed(1)} KB`);
    if (truncatedCount > 0) {
      console.log(`✂️  Обрезано файлов: ${truncatedCount}`);
    }

    return processedFiles;
  }
}
