import { Octokit } from '@octokit/rest';

export class GitHubRepoAnalyzer {
  constructor(token) {
    this.octokit = new Octokit({ auth: token });
  }

  parseRepoUrl(url) {
    // Поддержка форматов:
    // https://github.com/owner/repo
    // https://github.com/owner/repo.git
    // github.com/owner/repo
    // owner/repo
    const fullUrlMatch = url.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([^\/]+)\/([^\/\.]+)(?:\.git)?/);
    const shortMatch = url.match(/^([^\/\s]+)\/([^\/\s]+)$/);
    
    if (fullUrlMatch) {
      return {
        owner: fullUrlMatch[1],
        repo: fullUrlMatch[2]
      };
    }
    
    if (shortMatch) {
      return {
        owner: shortMatch[1],
        repo: shortMatch[2]
      };
    }
    
    throw new Error('Неверный формат GitHub URL. Используй: https://github.com/owner/repo или owner/repo');
  }

  async getRepoInfo(owner, repo) {
    try {
      const { data } = await this.octokit.repos.get({
        owner,
        repo
      });
      
      return {
        name: data.name,
        fullName: data.full_name,
        description: data.description,
        language: data.language,
        stars: data.stargazers_count,
        forks: data.forks_count,
        defaultBranch: data.default_branch,
        url: data.html_url
      };
    } catch (error) {
      if (error.status === 404) {
        throw new Error('Репозиторий не найден или недоступен');
      }
      throw error;
    }
  }

  async getRepoTree(owner, repo, branch = 'main') {
    try {
      const { data } = await this.octokit.git.getTree({
        owner,
        repo,
        tree_sha: branch,
        recursive: 'true'
      });

      return data.tree;
    } catch (error) {
      // Пробуем 'master' если 'main' не существует
      if (error.status === 404 && branch === 'main') {
        return this.getRepoTree(owner, repo, 'master');
      }
      throw error;
    }
  }

  formatTree(tree) {
    // Группируем по типу и форматируем
    const directories = tree.filter(item => item.type === 'tree');
    const files = tree.filter(item => item.type === 'blob');

    return {
      totalFiles: files.length,
      totalDirs: directories.length,
      files: files.map(f => f.path),
      directories: directories.map(d => d.path)
    };
  }

  buildTreeStructure(tree) {
    // Строим дерево директорий с файлами
    const structure = {};
    
    tree.forEach(item => {
      const parts = item.path.split('/');
      let current = structure;
      
      parts.forEach((part, index) => {
        if (index === parts.length - 1) {
          // Это файл или конечная директория
          if (item.type === 'blob') {
            if (!current._files) current._files = [];
            current._files.push(part);
          } else {
            if (!current[part]) current[part] = {};
          }
        } else {
          // Это директория в пути
          if (!current[part]) current[part] = {};
          current = current[part];
        }
      });
    });

    return structure;
  }

  formatTreeAsText(structure, indent = 0, prefix = '') {
    let result = '';
    const entries = Object.entries(structure).filter(([key]) => key !== '_files');
    const files = structure._files || [];

    // Сначала директории
    entries.forEach(([name, content], index) => {
      const isLast = index === entries.length - 1 && files.length === 0;
      const connector = isLast ? '└── ' : '├── ';
      result += `${prefix}${connector}${name}/\n`;
      
      const newPrefix = prefix + (isLast ? '    ' : '│   ');
      result += this.formatTreeAsText(content, indent + 1, newPrefix);
    });

    // Потом файлы
    files.forEach((file, index) => {
      const isLast = index === files.length - 1;
      const connector = isLast ? '└── ' : '├── ';
      result += `${prefix}${connector}${file}\n`;
    });

    return result;
  }

  async getFileContent(owner, repo, filePath, branch = 'main') {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner,
        repo,
        path: filePath,
        ref: branch
      });

      if (data.type === 'file' && data.content) {
        return Buffer.from(data.content, 'base64').toString('utf-8');
      }
      return null;
    } catch (error) {
      if (error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  isCodeFile(filePath) {
    const codeExtensions = [
      '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', '.h', '.hpp',
      '.cs', '.php', '.rb', '.go', '.rs', '.swift', '.kt', '.scala', '.r',
      '.m', '.mm', '.vue', '.svelte', '.dart', '.elm', '.clj', '.hs', '.ml',
      '.fs', '.vb', '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd',
      '.sql', '.html', '.css', '.scss', '.sass', '.less', '.xml', '.yaml',
      '.yml', '.json', '.toml', '.ini', '.cfg', '.conf', '.env', '.dockerfile',
      '.makefile', '.cmake', '.gradle', '.maven', '.pom', '.sbt', '.cabal',
      '.haskell', '.elm', '.ex', '.exs', '.erl', '.hrl', '.lua', '.tcl',
      '.pl', '.pm', '.rkt', '.scm', '.lisp', '.cl', '.jl', '.nim', '.zig',
      '.v', '.sv', '.vhd', '.vhdl', '.verilog', '.systemverilog'
    ];
    
    const ext = filePath.toLowerCase().substring(filePath.lastIndexOf('.'));
    return codeExtensions.includes(ext);
  }

  isConfigFile(filePath) {
    const configFiles = [
      'package.json', 'composer.json', 'pom.xml', 'build.gradle', 'cargo.toml',
      'go.mod', 'requirements.txt', 'pipfile', 'poetry.lock', 'yarn.lock',
      'package-lock.json', 'bower.json', 'webpack.config.js', 'rollup.config.js',
      'vite.config.js', 'next.config.js', 'nuxt.config.js', 'vue.config.js',
      'angular.json', 'tsconfig.json', 'jsconfig.json', 'babel.config.js',
      '.babelrc', '.eslintrc', '.prettierrc', 'eslint.config.js', 'prettier.config.js',
      'tailwind.config.js', 'postcss.config.js', 'sass.config.js', 'less.config.js',
      'jest.config.js', 'vitest.config.js', 'cypress.config.js', 'playwright.config.js',
      'karma.conf.js', 'protractor.conf.js', 'nightwatch.conf.js', 'wdio.conf.js',
      'docker-compose.yml', 'docker-compose.yaml', 'dockerfile', 'dockerfile.dev',
      'dockerfile.prod', 'dockerfile.staging', '.dockerignore', 'dockerignore',
      'kubernetes.yaml', 'k8s.yaml', 'helm.yaml', 'terraform.tf', 'terragrunt.hcl',
      'ansible.yml', 'ansible.yaml', 'playbook.yml', 'inventory.yml',
      'vagrantfile', 'vagrantfile.rb', 'chef.rb', 'puppet.pp', 'salt.sls',
      'travis.yml', 'circle.yml', 'appveyor.yml', 'azure-pipelines.yml',
      'github/workflows', 'gitlab-ci.yml', 'bitbucket-pipelines.yml',
      'jenkinsfile', 'jenkinsfile.groovy', 'buildkite.yml', 'drone.yml',
      'wercker.yml', 'codeship.yml', 'semaphore.yml', 'bamboo.yml',
      'teamcity.xml', 'hudson.xml', 'cruisecontrol.xml', 'go.cd.xml',
      'appveyor.yml', 'azure-pipelines.yml', 'bitrise.yml', 'buddy.yml',
      'codefresh.yml', 'concourse.yml', 'deploy.yml', 'deployment.yml',
      'service.yml', 'ingress.yml', 'configmap.yml', 'secret.yml',
      'pvc.yml', 'pv.yml', 'rbac.yml', 'clusterrole.yml', 'role.yml',
      'serviceaccount.yml', 'networkpolicy.yml', 'podsecuritypolicy.yml',
      'cronjob.yml', 'job.yml', 'daemonset.yml', 'replicaset.yml',
      'statefulset.yml', 'deployment.yml', 'service.yml', 'ingress.yml'
    ];

    const fileName = filePath.split('/').pop().toLowerCase();
    return configFiles.includes(fileName) || configFiles.some(config => 
      filePath.toLowerCase().includes(config.toLowerCase())
    );
  }

  async getImportantFiles(owner, repo, tree, branch = 'main', maxFiles = 50) {
    console.log(`\n📄 Анализирую содержимое файлов...`);
    
    const files = tree.filter(item => item.type === 'blob');
    const importantFiles = [];
    
    // Приоритетные файлы (конфиги, основные файлы)
    const priorityFiles = files.filter(file => 
      this.isConfigFile(file.path) || 
      file.path.includes('README') ||
      file.path.includes('LICENSE') ||
      file.path.includes('CHANGELOG') ||
      file.path.includes('CONTRIBUTING') ||
      file.path.includes('index.') ||
      file.path.includes('main.') ||
      file.path.includes('app.') ||
      file.path.includes('src/') ||
      file.path.includes('lib/') ||
      file.path.includes('components/') ||
      file.path.includes('pages/') ||
      file.path.includes('routes/') ||
      file.path.includes('controllers/') ||
      file.path.includes('models/') ||
      file.path.includes('views/') ||
      file.path.includes('utils/') ||
      file.path.includes('helpers/') ||
      file.path.includes('services/') ||
      file.path.includes('api/')
    );

    // Остальные код файлы
    const codeFiles = files.filter(file => 
      this.isCodeFile(file.path) && 
      !priorityFiles.includes(file)
    );

    // Объединяем и ограничиваем количество
    const selectedFiles = [...priorityFiles, ...codeFiles].slice(0, maxFiles);
    
    console.log(`📊 Выбрано ${selectedFiles.length} файлов для анализа`);

    for (const file of selectedFiles) {
      try {
        console.log(`  Читаю: ${file.path}`);
        const content = await this.getFileContent(owner, repo, file.path, branch);
        
        if (content) {
          importantFiles.push({
            path: file.path,
            size: content.length,
            content: content,
            isConfig: this.isConfigFile(file.path),
            isCode: this.isCodeFile(file.path)
          });
        }
      } catch (error) {
        console.log(`  ⚠️  Ошибка чтения ${file.path}: ${error.message}`);
      }
    }

    return importantFiles;
  }

  async analyzeRepository(repoUrl) {
    console.log(`\n🔍 Анализирую репозиторий: ${repoUrl}\n`);

    const { owner, repo } = this.parseRepoUrl(repoUrl);
    
    console.log(`📦 Получаю информацию о репозитории...`);
    const repoInfo = await this.getRepoInfo(owner, repo);
    
    console.log(`✅ Репозиторий: ${repoInfo.fullName}`);
    if (repoInfo.description) {
      console.log(`📝 Описание: ${repoInfo.description}`);
    }
    console.log(`⭐ Звезд: ${repoInfo.stars} | 🍴 Форков: ${repoInfo.forks}`);
    if (repoInfo.language) {
      console.log(`💻 Язык: ${repoInfo.language}`);
    }

    console.log(`\n🌲 Получаю дерево файлов...`);
    const tree = await this.getRepoTree(owner, repo, repoInfo.defaultBranch);
    
    const formatted = this.formatTree(tree);
    console.log(`📊 Всего файлов: ${formatted.totalFiles}`);
    console.log(`📁 Всего директорий: ${formatted.totalDirs}`);

    const structure = this.buildTreeStructure(tree);
    const treeText = this.formatTreeAsText(structure);

    // Получаем содержимое важных файлов
    const importantFiles = await this.getImportantFiles(owner, repo, tree, repoInfo.defaultBranch);

    return {
      repoInfo,
      tree: formatted,
      structure,
      treeText,
      importantFiles
    };
  }
}


