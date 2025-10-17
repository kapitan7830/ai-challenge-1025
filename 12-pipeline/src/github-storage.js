import { Octokit } from '@octokit/rest';

export class GitHubStorage {
  constructor(token, owner, repo, branch = 'main') {
    if (!token || !owner || !repo) {
      throw new Error('GitHub token, owner и repo обязательны');
    }
    
    this.octokit = new Octokit({ auth: token });
    this.owner = owner;
    this.repo = repo;
    this.branch = branch;
  }

  sanitizeFilename(title) {
    return title
      .toLowerCase()
      .replace(/[^a-zа-яё0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 100);
  }

  async saveArticle(title, content, folder = 'articles') {
    try {
      const filename = this.sanitizeFilename(title);
      const filepath = `${folder}/${filename}.md`;
      
      console.log(`📤 Сохраняю на GitHub: ${filepath}`);

      // Проверяем существует ли файл
      let sha = null;
      try {
        const { data } = await this.octokit.repos.getContent({
          owner: this.owner,
          repo: this.repo,
          path: filepath,
          ref: this.branch,
        });
        sha = data.sha;
        console.log(`  Файл существует, обновляю...`);
      } catch (error) {
        if (error.status !== 404) throw error;
        console.log(`  Создаю новый файл...`);
      }

      // Создаем или обновляем файл
      const contentEncoded = Buffer.from(content, 'utf-8').toString('base64');
      
      const response = await this.octokit.repos.createOrUpdateFileContents({
        owner: this.owner,
        repo: this.repo,
        path: filepath,
        message: sha ? `Update: ${title}` : `Add: ${title}`,
        content: contentEncoded,
        branch: this.branch,
        ...(sha && { sha }),
      });

      const githubUrl = `https://github.com/${this.owner}/${this.repo}/blob/${this.branch}/${filepath}`;
      console.log(`✅ Сохранено: ${githubUrl}`);
      
      return githubUrl;
    } catch (error) {
      console.error(`❌ Ошибка сохранения на GitHub:`, error.message);
      throw error;
    }
  }

  async fileExists(filepath) {
    try {
      await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: filepath,
        ref: this.branch,
      });
      return true;
    } catch (error) {
      if (error.status === 404) return false;
      throw error;
    }
  }
}

