class Logger {
  constructor() {
    this.logs = [];
  }
  
  _log(level, message) {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, level, message };
    this.logs.push(logEntry);
    
    const icon = {
      'INFO': 'ℹ️',
      'SUCCESS': '✅',
      'ERROR': '❌',
      'WARNING': '⚠️'
    }[level] || '';
    
    console.log(`[${timestamp}] ${icon} ${message}`);
  }
  
  info(message) {
    this._log('INFO', message);
  }
  
  success(message) {
    this._log('SUCCESS', message);
  }
  
  error(message) {
    this._log('ERROR', message);
  }
  
  warning(message) {
    this._log('WARNING', message);
  }
  
  animals(animals) {
    console.log('\n📋 СПИСОК НАЙДЕННЫХ ЖИВОТНЫХ:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    animals.forEach((animal, index) => {
      console.log(`\n${index + 1}. ${animal.name}`);
      console.log(`   Контекст: ${animal.context}`);
    });
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    this._log('INFO', `Список животных: ${animals.length} шт.`);
  }
  
  reports(reports) {
    console.log('\n🔬 НАУЧНЫЕ СПРАВКИ:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    reports.forEach((report, index) => {
      console.log(`\n${index + 1}. ${report.animal}`);
      
      if (report.error) {
        console.log(`   ❌ Ошибка: ${report.error}`);
        return;
      }
      
      console.log(`   📊 Статус: ${report.status || 'информации нет'}`);
      console.log(`   🧬 Морфофизиология: ${report.morphophysiology || 'информации нет'}`);
      console.log(`   ⚗️  Биохимия: ${report.biochemistry || 'информации нет'}`);
      console.log(`   🎭 Поведение: ${report.behavior || 'информации нет'}`);
      console.log(`   🌍 Ареал: ${report.habitat || 'информации нет'}`);
      console.log(`   🧪 Скрещивание: ${report.crossbreeding || 'информации нет'}`);
    });
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    this._log('INFO', `Научные справки: ${reports.length} шт.`);
  }
  
  getLogs() {
    return this.logs;
  }
}

export const logger = new Logger();

