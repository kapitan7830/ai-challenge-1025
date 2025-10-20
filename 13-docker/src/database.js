import pg from 'pg';
const { Pool } = pg;

export class ArticleDatabase {
  constructor(config = null) {
    const defaultConfig = {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: process.env.POSTGRES_PORT || 5432,
      database: process.env.POSTGRES_DB,
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
    };

    this.pool = new Pool(config || defaultConfig);
    this.initialized = false;
    
    // Обработка ошибок соединения
    this.pool.on('error', (err) => {
      // Игнорируем ошибки закрытия соединения при остановке контейнера
      if (!err.message.includes('terminating connection due to administrator command')) {
        console.error('[LOG] Предупреждение: ошибка в пуле соединений БД:', err.message);
      }
    });
    
    // Не инициализируем БД сразу - только когда понадобится
  }

  async initDatabase() {
    if (this.initialized) return;

    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS articles (
          id SERIAL PRIMARY KEY,
          habr_url TEXT UNIQUE NOT NULL,
          github_url TEXT,
          title TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ База данных PostgreSQL инициализирована');
      this.initialized = true;
    } catch (error) {
      console.error('❌ Ошибка инициализации БД:', error.message);
      throw error;
    }
  }

  async addArticle(habrUrl, githubUrl, title) {
    await this.initDatabase();

    try {
      const result = await this.pool.query(
        `INSERT INTO articles (habr_url, github_url, title)
         VALUES ($1, $2, $3)
         ON CONFLICT (habr_url) 
         DO UPDATE SET
           github_url = EXCLUDED.github_url,
           title = EXCLUDED.title,
           updated_at = CURRENT_TIMESTAMP
         RETURNING id`,
        [habrUrl, githubUrl, title]
      );

      return result.rows[0].id;
    } catch (error) {
      console.error('❌ Ошибка добавления статьи:', error.message);
      throw error;
    }
  }

  async getArticleByHabrUrl(habrUrl) {
    await this.initDatabase();

    try {
      const result = await this.pool.query('SELECT * FROM articles WHERE habr_url = $1', [habrUrl]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('❌ Ошибка получения статьи:', error.message);
      throw error;
    }
  }

  async filterExistingArticles(habrUrls) {
    if (habrUrls.length === 0) return [];
    await this.initDatabase();

    try {
      const placeholders = habrUrls.map((_, i) => `$${i + 1}`).join(',');
      const result = await this.pool.query(
        `SELECT habr_url FROM articles WHERE habr_url IN (${placeholders})`,
        habrUrls
      );
      return result.rows.map((row) => row.habr_url);
    } catch (error) {
      console.error('❌ Ошибка фильтрации статей:', error.message);
      throw error;
    }
  }

  async getNewArticles(habrUrls) {
    const existing = new Set(await this.filterExistingArticles(habrUrls));
    return habrUrls.filter((url) => !existing.has(url));
  }

  async getAllArticles() {
    await this.initDatabase();

    try {
      const result = await this.pool.query('SELECT * FROM articles ORDER BY created_at DESC');
      return result.rows;
    } catch (error) {
      console.error('❌ Ошибка получения всех статей:', error.message);
      throw error;
    }
  }

  async close() {
    try {
      await this.pool.end();
    } catch (error) {
      // Игнорируем ошибки при закрытии соединения
      console.error('[LOG] Предупреждение при закрытии БД:', error.message);
    }
  }
}
