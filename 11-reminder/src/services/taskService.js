import db from '../db/database.js';

class TaskService {
  /**
   * Добавить новую задачу
   * @param {string} name - Название задачи
   * @param {string} description - Описание задачи
   * @param {number} date - Дата задачи timestamp (ms)
   * @returns {object} Созданная задача
   */
  addTask(name, description, date) {
    const stmt = db.prepare(`
      INSERT INTO tasks (name, description, date, created_at)
      VALUES (?, ?, ?, ?)
    `);
    
    const info = stmt.run(name, description, date, Date.now());
    
    return this.getTaskById(info.lastInsertRowid);
  }

  /**
   * Обновить задачу
   * @param {number} id - Идентификатор задачи
   * @param {object} updates - Поля для обновления (name, description, date)
   * @returns {object} Обновленная задача
   */
  updateTask(id, updates) {
    const fields = [];
    const values = [];
    
    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }
    if (updates.date !== undefined) {
      fields.push('date = ?');
      values.push(updates.date);
    }
    
    if (fields.length === 0) {
      throw new Error('Нет полей для обновления');
    }
    
    values.push(id);
    const stmt = db.prepare(`
      UPDATE tasks
      SET ${fields.join(', ')}
      WHERE id = ?
    `);
    
    const info = stmt.run(...values);
    
    if (info.changes === 0) {
      throw new Error(`Задача с id ${id} не найдена`);
    }
    
    return this.getTaskById(id);
  }

  /**
   * Отметить задачу выполненной
   * @param {number} id - Идентификатор задачи
   * @returns {object} Обновленная задача
   */
  completeTask(id) {
    const stmt = db.prepare(`
      UPDATE tasks
      SET completed_at = ?
      WHERE id = ?
    `);
    
    const info = stmt.run(Date.now(), id);
    
    if (info.changes === 0) {
      throw new Error(`Задача с id ${id} не найдена`);
    }
    
    return this.getTaskById(id);
  }

  /**
   * Uncomplete a task by ID (снять отметку о выполнении)
   * @param {number} id - Идентификатор задачи
   * @returns {object} Обновленная задача
   */
  uncompleteTask(id) {
    const stmt = db.prepare(`
      UPDATE tasks
      SET completed_at = NULL
      WHERE id = ?
    `);
    
    const info = stmt.run(id);
    
    if (info.changes === 0) {
      throw new Error(`Задача с id ${id} не найдена`);
    }
    
    return this.getTaskById(id);
  }

  /**
   * Удалить задачу
   * @param {number} id - Идентификатор задачи
   * @returns {boolean} True если удалена
   */
  deleteTask(id) {
    const stmt = db.prepare('DELETE FROM tasks WHERE id = ?');
    const info = stmt.run(id);
    
    if (info.changes === 0) {
      throw new Error(`Задача с id ${id} не найдена`);
    }
    
    return true;
  }

  /**
   * Получить задачу по ID
   * @param {number} id - Идентификатор задачи
   * @returns {object|null} Объект задачи
   */
  getTaskById(id) {
    const stmt = db.prepare('SELECT * FROM tasks WHERE id = ?');
    return stmt.get(id);
  }

  /**
   * Получить все задачи или задачи на определенный день
   * @param {number|null} dayTimestamp - Опционально: timestamp для конкретного дня (ms)
   * @param {boolean} includeCompleted - Включить выполненные задачи (по умолчанию false)
   * @returns {array} Список задач
   */
  getTasks(dayTimestamp = null, includeCompleted = false) {
    if (dayTimestamp !== null) {
      // Get start and end of day
      const date = new Date(dayTimestamp);
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
      const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1;
      
      const completedFilter = includeCompleted ? '' : 'AND completed_at IS NULL';
      const stmt = db.prepare(`
        SELECT * FROM tasks
        WHERE date >= ? AND date <= ? ${completedFilter}
        ORDER BY date ASC
      `);
      
      return stmt.all(startOfDay, endOfDay);
    }
    
    const completedFilter = includeCompleted ? '' : 'WHERE completed_at IS NULL';
    const stmt = db.prepare(`SELECT * FROM tasks ${completedFilter} ORDER BY date ASC`);
    return stmt.all();
  }
}

export default new TaskService();

