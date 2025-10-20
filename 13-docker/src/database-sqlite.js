import sqlite3 from 'sqlite3';
import { promisify } from 'util';

export class ArticleDatabaseSQLite {
  constructor(dbPath = 'articles.db') {
    this.db = new sqlite3.Database(dbPath);
    this.initialized = false;
  }

  async initDatabase() {
    if (this.initialized) return;

    return new Promise((resolve, reject) => {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS articles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          habr_url TEXT UNIQUE NOT NULL,
          github_url TEXT,
          title TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          console.error('❌ Ошибка инициализации БД:', err.message);
          reject(err);
        } else {
          console.log('✅ База данных SQLite инициализирована');
          this.initialized = true;
          resolve();
        }
      });
    });
  }

  async addArticle(habrUrl, githubUrl, title) {
    await this.initDatabase();

    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO articles (habr_url, github_url, title)
         VALUES (?, ?, ?)
         ON CONFLICT (habr_url) 
         DO UPDATE SET
           github_url = excluded.github_url,
           title = excluded.title,
           updated_at = CURRENT_TIMESTAMP`,
        [habrUrl, githubUrl, title],
        function(err) {
          if (err) {
            console.error('❌ Ошибка добавления статьи:', err.message);
            reject(err);
          } else {
            resolve(this.lastID);
          }
        }
      );
    });
  }

  async getArticleByHabrUrl(habrUrl) {
    await this.initDatabase();

    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM articles WHERE habr_url = ?', [habrUrl], (err, row) => {
        if (err) {
          console.error('❌ Ошибка получения статьи:', err.message);
          reject(err);
        } else {
          resolve(row || null);
        }
      });
    });
  }

  async filterExistingArticles(habrUrls) {
    if (habrUrls.length === 0) return [];
    await this.initDatabase();

    const placeholders = habrUrls.map(() => '?').join(',');
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT habr_url FROM articles WHERE habr_url IN (${placeholders})`,
        habrUrls,
        (err, rows) => {
          if (err) {
            console.error('❌ Ошибка фильтрации статей:', err.message);
            reject(err);
          } else {
            resolve(rows.map((row) => row.habr_url));
          }
        }
      );
    });
  }

  async getNewArticles(habrUrls) {
    const existing = new Set(await this.filterExistingArticles(habrUrls));
    return habrUrls.filter((url) => !existing.has(url));
  }

  async getAllArticles() {
    await this.initDatabase();

    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM articles ORDER BY created_at DESC', (err, rows) => {
        if (err) {
          console.error('❌ Ошибка получения всех статей:', err.message);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async close() {
    return new Promise((resolve) => {
      this.db.close(resolve);
    });
  }
}
