import Database from 'better-sqlite3';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Менеджер базы данных для хранения titles и dossiers
 */
export class DatabaseManager {
  constructor(dbPath = null) {
    // Если путь не указан, используем ./data/bot.db
    const defaultPath = path.join(__dirname, '..', 'data', 'bot.db');
    this.db = new Database(dbPath || defaultPath);
    this.initTables();
  }

  /**
   * Инициализация таблиц
   */
  initTables() {
    // Таблица titles
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS titles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        is_finished INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Таблица dossiers
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS dossiers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title_id INTEGER NOT NULL,
        text TEXT NOT NULL,
        is_full INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (title_id) REFERENCES titles(id)
      )
    `);

    // Таблица chunks - необработанные куски текста
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chunks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title_id INTEGER NOT NULL,
        hash TEXT NOT NULL,
        text TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (title_id) REFERENCES titles(id),
        UNIQUE(title_id, hash)
      )
    `);

    console.log('✅ БД инициализирована');
  }

  /**
   * Создать новый title
   * @param {string} name - Название
   * @returns {number} - ID созданного title
   */
  createTitle(name) {
    const stmt = this.db.prepare('INSERT INTO titles (name) VALUES (?)');
    const result = stmt.run(name);
    return result.lastInsertRowid;
  }

  /**
   * Получить title по ID
   * @param {number} titleId
   * @returns {Object|null}
   */
  getTitle(titleId) {
    const stmt = this.db.prepare('SELECT * FROM titles WHERE id = ?');
    return stmt.get(titleId);
  }

  /**
   * Получить все незавершенные titles
   * @returns {Array}
   */
  getUnfinishedTitles() {
    const stmt = this.db.prepare('SELECT * FROM titles WHERE is_finished = 0 ORDER BY created_at DESC');
    return stmt.all();
  }

  /**
   * Отметить title как завершенный
   * @param {number} titleId
   */
  finishTitle(titleId) {
    const stmt = this.db.prepare('UPDATE titles SET is_finished = 1 WHERE id = ?');
    stmt.run(titleId);
  }

  /**
   * Генерировать хэш из текста
   * @param {string} text
   * @returns {string}
   */
  static generateHash(text) {
    return crypto.createHash('sha256').update(text).digest('hex');
  }

  /**
   * Сохранить досье
   * @param {number} titleId
   * @param {string} text - Текст досье
   * @param {boolean} isFull - Финальное ли это досье
   * @returns {number} - ID созданного досье
   */
  saveDossier(titleId, text, isFull = false) {
    const stmt = this.db.prepare(
      'INSERT INTO dossiers (title_id, text, is_full) VALUES (?, ?, ?)'
    );
    const result = stmt.run(titleId, text, isFull ? 1 : 0);
    return result.lastInsertRowid;
  }

  /**
   * Получить все досье (не финальные) для title
   * @param {number} titleId
   * @returns {Array}
   */
  getDossiersByTitle(titleId) {
    const stmt = this.db.prepare(
      'SELECT * FROM dossiers WHERE title_id = ? AND is_full = 0 ORDER BY created_at'
    );
    return stmt.all(titleId);
  }

  /**
   * Получить финальное досье для title
   * @param {number} titleId
   * @returns {Object|null}
   */
  getFinalDossier(titleId) {
    const stmt = this.db.prepare(
      'SELECT * FROM dossiers WHERE title_id = ? AND is_full = 1 ORDER BY created_at DESC LIMIT 1'
    );
    return stmt.get(titleId);
  }

  /**
   * Проверить существует ли chunk с таким хэшем для данного title
   * @param {number} titleId
   * @param {string} hash
   * @returns {boolean}
   */
  chunkExists(titleId, hash) {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM chunks WHERE title_id = ? AND hash = ?');
    const result = stmt.get(titleId, hash);
    return result.count > 0;
  }

  /**
   * Сохранить кусок текста (необработанное сообщение)
   * @param {number} titleId
   * @param {string} text
   * @returns {number} - ID созданного куска
   */
  saveChunk(titleId, text) {
    const hash = DatabaseManager.generateHash(text);
    
    const stmt = this.db.prepare(
      'INSERT INTO chunks (title_id, hash, text) VALUES (?, ?, ?)'
    );
    const result = stmt.run(titleId, hash, text);
    return result.lastInsertRowid;
  }

  /**
   * Получить все куски текста для title
   * @param {number} titleId
   * @returns {Array}
   */
  getChunksByTitle(titleId) {
    const stmt = this.db.prepare(
      'SELECT * FROM chunks WHERE title_id = ? ORDER BY created_at'
    );
    return stmt.all(titleId);
  }

  /**
   * Очистить все куски текста для title
   * @param {number} titleId
   */
  clearChunks(titleId) {
    const stmt = this.db.prepare('DELETE FROM chunks WHERE title_id = ?');
    stmt.run(titleId);
  }

  /**
   * Закрыть соединение с БД
   */
  close() {
    this.db.close();
  }
}

