import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class ArticleDatabase {
  constructor(dbPath = null) {
    const defaultPath = path.join(__dirname, '..', 'articles.db');
    this.db = new Database(dbPath || defaultPath);
    this.initDatabase();
  }

  initDatabase() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS articles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        habr_url TEXT UNIQUE NOT NULL,
        github_url TEXT,
        title TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ База данных инициализирована');
  }

  addArticle(habrUrl, githubUrl, title) {
    const stmt = this.db.prepare(`
      INSERT INTO articles (habr_url, github_url, title)
      VALUES (?, ?, ?)
      ON CONFLICT(habr_url) DO UPDATE SET
        github_url = excluded.github_url,
        title = excluded.title,
        updated_at = CURRENT_TIMESTAMP
    `);
    
    const result = stmt.run(habrUrl, githubUrl, title);
    return result.lastInsertRowid;
  }

  getArticleByHabrUrl(habrUrl) {
    const stmt = this.db.prepare('SELECT * FROM articles WHERE habr_url = ?');
    return stmt.get(habrUrl);
  }

  filterExistingArticles(habrUrls) {
    if (habrUrls.length === 0) return [];
    
    const placeholders = habrUrls.map(() => '?').join(',');
    const stmt = this.db.prepare(`
      SELECT habr_url FROM articles WHERE habr_url IN (${placeholders})
    `);
    
    const existing = stmt.all(...habrUrls);
    return existing.map(row => row.habr_url);
  }

  getNewArticles(habrUrls) {
    const existing = new Set(this.filterExistingArticles(habrUrls));
    return habrUrls.filter(url => !existing.has(url));
  }

  getAllArticles() {
    const stmt = this.db.prepare('SELECT * FROM articles ORDER BY created_at DESC');
    return stmt.all();
  }

  close() {
    this.db.close();
  }
}

