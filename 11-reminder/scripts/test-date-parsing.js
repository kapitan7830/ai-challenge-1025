// Тестовый скрипт для проверки парсинга дат
import { parseDateTimeExpression } from '../src/services/dateParserAgent.js';

const testExpressions = [
  // Точное время
  'в 9:00',
  'в 10:15',
  'в 09:00:00',
  
  // Разговорные варианты
  'ровно в девять',
  'в половине одиннадцатого',
  'без пятнадцати двенадцать',
  'ровно в полдень',
  'без четверти восемь',
  'без пяти полночь',
  
  // Относительное время
  'через 5 минут',
  'через 2 часа',
  'через 1 час 15 минут',
  'через неделю',
  'через месяц',
  
  // С датой
  '16 октября 2025 года в 09:10',
  '16.10.2025 в 14:30',
  '17 октября в 10:00',
  
  // День недели
  'в понедельник в 09:00',
  'в следующую среду в 15:00',
  
  // Простые
  'сегодня в 15:00',
  'завтра в 10:00',
  'послезавтра в 18:00',
  
  // Комбинированные
  'послезавтра в половине одиннадцатого',
  'через 3 дня в без четверти пять',
];

console.log('🧪 Тест парсинга дат\n');
console.log(`Текущее время: ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Krasnoyarsk' })}\n`);

async function testAll() {
  const currentTimestamp = Date.now();
  
  for (const expression of testExpressions) {
    try {
      const timestamp = await parseDateTimeExpression(expression, currentTimestamp);
      const date = new Date(timestamp);
      const readable = date.toLocaleString('ru-RU', { 
        timeZone: 'Asia/Krasnoyarsk',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      
      console.log(`✅ "${expression}"`);
      console.log(`   → ${readable}\n`);
    } catch (error) {
      console.log(`❌ "${expression}"`);
      console.log(`   → Ошибка: ${error.message}\n`);
    }
  }
}

testAll()
  .then(() => {
    console.log('✓ Тест завершён');
    process.exit(0);
  })
  .catch((error) => {
    console.error('✗ Ошибка:', error);
    process.exit(1);
  });

