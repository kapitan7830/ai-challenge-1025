import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { logger } from '../utils/logger.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class VectorStore {
  constructor(dbPath = null) {
    this.dbPath = dbPath || join(__dirname, '../embeddings.db');
    this.db = null;
  }

  /**
   * Инициализирует базу данных и загружает sqlite-vec
   */
  initialize() {
    logger.info(`Инициализирую базу данных: ${this.dbPath.split('/').pop()}`);

    this.db = new Database(this.dbPath);
    
    // Загружаем sqlite-vec расширение
    sqliteVec.load(this.db);

    logger.success('Расширение sqlite-vec загружено');

    // Создаем таблицы
    this.createTables();
  }

  /**
   * Создает необходимые таблицы
   */
  createTables() {
    logger.info('Создаю таблицы в базе данных');

    // Таблица для документов
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Таблица для чанков
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chunks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER NOT NULL,
        chunk_index INTEGER NOT NULL,
        text TEXT NOT NULL,
        size INTEGER NOT NULL,
        vec_rowid INTEGER,
        FOREIGN KEY (document_id) REFERENCES documents(id)
      );
    `);

    // Виртуальная таблица для векторов
    // В sqlite-vec rowid генерируется автоматически
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS vec_chunks USING vec0(
        embedding FLOAT[1536]
      );
    `);

    logger.success('Таблицы созданы успешно');
  }

  /**
   * Сохраняет документ и его чанки с эмбеддингами
   */
  saveDocument(filename, chunks, embeddings) {
    logger.info(`Сохраняю документ "${filename}" с ${chunks.length} чанками`);

    const insertDocument = this.db.prepare(
      'INSERT INTO documents (filename) VALUES (?)'
    );
    const insertChunk = this.db.prepare(`
      INSERT INTO chunks (document_id, chunk_index, text, size, vec_rowid)
      VALUES (?, ?, ?, ?, ?)
    `);
    const insertVector = this.db.prepare(`
      INSERT INTO vec_chunks (embedding) VALUES (vec_f32(?))
    `);

    // Транзакция для атомарности
    const transaction = this.db.transaction(() => {
      // Сохраняем документ
      const result = insertDocument.run(filename);
      const documentId = result.lastInsertRowid;

      logger.info(`Документ сохранен с ID: ${documentId}`);

      // Сохраняем чанки и их векторы
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = embeddings[i];

        // Сначала сохраняем вектор и получаем его rowid
        const embeddingArray = new Float32Array(embedding.embedding);
        const embeddingBuffer = Buffer.from(embeddingArray.buffer);
        const vecResult = insertVector.run(embeddingBuffer);
        const vecRowid = vecResult.lastInsertRowid;

        // Затем сохраняем чанк с ссылкой на вектор
        insertChunk.run(
          documentId,
          chunk.id,
          chunk.text,
          chunk.size,
          vecRowid
        );

        if ((i + 1) % 10 === 0 || i === chunks.length - 1) {
          logger.info(
            `Сохранено ${i + 1}/${chunks.length} чанков с эмбеддингами`
          );
        }
      }

      return documentId;
    });

    const documentId = transaction();

    logger.success(`Документ и все чанки сохранены успешно (ID: ${documentId})`);

    return documentId;
  }

  /**
   * Получает статистику базы данных
   */
  getStats() {
    const documentsCount = this.db
      .prepare('SELECT COUNT(*) as count FROM documents')
      .get().count;

    const chunksCount = this.db
      .prepare('SELECT COUNT(*) as count FROM chunks')
      .get().count;

    const vectorsCount = this.db
      .prepare('SELECT COUNT(*) as count FROM vec_chunks')
      .get().count;

    return {
      documents: documentsCount,
      chunks: chunksCount,
      vectors: vectorsCount,
    };
  }

  /**
   * Закрывает соединение с базой данных
   */
  close() {
    if (this.db) {
      this.db.close();
      logger.info('Соединение с базой данных закрыто');
    }
  }
}

