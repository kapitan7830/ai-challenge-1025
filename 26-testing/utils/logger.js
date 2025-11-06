import chalk from 'chalk';

export const logger = {
  info: (...args) => console.log(chalk.blue('ℹ'), ...args),
  success: (...args) => console.log(chalk.green('✓'), ...args),
  warn: (...args) => console.log(chalk.yellow('⚠'), ...args),
  error: (...args) => console.log(chalk.red('✗'), ...args),
  separator: () => console.log(chalk.gray('─'.repeat(50))),
};

