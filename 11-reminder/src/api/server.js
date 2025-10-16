import express from 'express';
import taskService from '../services/taskService.js';

const app = express();
app.use(express.json());

// Добавить новую задачу
app.post('/api/tasks', (req, res) => {
  try {
    const { name, description, date } = req.body;
    
    if (!name || !date) {
      return res.status(400).json({ error: 'Необходимы название и дата' });
    }
    
    const task = taskService.addTask(name, description, date);
    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Получить все задачи или задачи на конкретный день (по умолчанию только невыполненные)
app.get('/api/tasks', (req, res) => {
  try {
    const { day, completed } = req.query;
    const dayTimestamp = day ? parseInt(day) : null;
    const includeCompleted = completed === 'true';
    
    const tasks = taskService.getTasks(dayTimestamp, includeCompleted);
    res.json({ tasks, count: tasks.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Получить задачу по ID
app.get('/api/tasks/:id', (req, res) => {
  try {
    const task = taskService.getTaskById(parseInt(req.params.id));
    
    if (!task) {
      return res.status(404).json({ error: 'Задача не найдена' });
    }
    
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Обновить задачу
app.patch('/api/tasks/:id', (req, res) => {
  try {
    const { name, description, date } = req.body;
    const updates = {};
    
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (date !== undefined) updates.date = date;
    
    const task = taskService.updateTask(parseInt(req.params.id), updates);
    res.json(task);
  } catch (error) {
    if (error.message.includes('не найдена')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

// Отметить задачу выполненной
app.patch('/api/tasks/:id/complete', (req, res) => {
  try {
    const task = taskService.completeTask(parseInt(req.params.id));
    res.json(task);
  } catch (error) {
    if (error.message.includes('не найдена')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

// Снять отметку о выполнении
app.patch('/api/tasks/:id/uncomplete', (req, res) => {
  try {
    const task = taskService.uncompleteTask(parseInt(req.params.id));
    res.json(task);
  } catch (error) {
    if (error.message.includes('не найдена')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

// Удалить задачу
app.delete('/api/tasks/:id', (req, res) => {
  try {
    taskService.deleteTask(parseInt(req.params.id));
    res.status(204).send();
  } catch (error) {
    if (error.message.includes('не найдена')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API сервер задач запущен на порту ${PORT}`);
});

export default app;

