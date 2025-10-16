// Скрипт для ручного тестирования ежедневного саммари
import { sendSummaryNow } from '../src/cron/daily-summary.js';

console.log('Отправка тестового саммари...');

sendSummaryNow()
  .then(() => {
    console.log('✓ Саммари отправлено');
    process.exit(0);
  })
  .catch((error) => {
    console.error('✗ Ошибка:', error);
    process.exit(1);
  });

