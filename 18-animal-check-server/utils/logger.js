import pino from 'pino';

const pinoLogger = pino({
  level: process.env.LOG_LEVEL || 'info'
});

class Logger {
  info(message) {
    pinoLogger.info({ msg: message });
  }
  
  success(message) {
    pinoLogger.info({ msg: message, level: 'success' });
  }
  
  error(message) {
    pinoLogger.error({ msg: message });
  }
  
  warning(message) {
    pinoLogger.warn({ msg: message });
  }
  
  animals(animals) {
    pinoLogger.info({
      msg: 'Animals found',
      count: animals.length,
      animals: animals.map(a => ({ name: a.name, context: a.context }))
    });
  }
  
  reports(reports) {
    pinoLogger.info({
      msg: 'Reports generated',
      count: reports.length,
      reports: reports.map(r => ({
        animal: r.animal,
        description: r.description,
        morphophysiology: r.morphophysiology,
        behavior: r.behavior,
        habitat: r.habitat,
        error: r.error
      }))
    });
  }
}

export const logger = new Logger();

