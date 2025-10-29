import chalk from 'chalk';

class Logger {
  info(message, data = null) {
    console.log(chalk.blue('ℹ'), chalk.white(message));
    if (data) {
      console.log(chalk.gray(JSON.stringify(data, null, 2)));
    }
  }

  success(message, data = null) {
    console.log(chalk.green('✓'), chalk.white(message));
    if (data) {
      console.log(chalk.gray(JSON.stringify(data, null, 2)));
    }
  }

  error(message, error = null) {
    console.log(chalk.red('✗'), chalk.white(message));
    if (error) {
      console.log(chalk.red(error.message || error));
      if (error.stack) {
        console.log(chalk.gray(error.stack));
      }
    }
  }

  warning(message, data = null) {
    console.log(chalk.yellow('⚠'), chalk.white(message));
    if (data) {
      console.log(chalk.gray(JSON.stringify(data, null, 2)));
    }
  }

  step(stepNumber, totalSteps, message) {
    console.log(
      chalk.cyan(`[${stepNumber}/${totalSteps}]`),
      chalk.white(message)
    );
  }

  separator() {
    console.log(chalk.gray('─'.repeat(60)));
  }
}

export const logger = new Logger();

