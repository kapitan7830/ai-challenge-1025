import fetch from 'node-fetch';
import { OPENAI_API_KEY } from '../constants.js';

/**
 * Агент для парсинга даты/времени через OpenAI
 * AI извлекает компоненты, JS делает расчет
 */
export async function parseDateTimeExpression(expression, currentTimestamp) {
  const currentDate = new Date(currentTimestamp);
  
  // Сначала AI извлекает компоненты времени
  const components = await extractTimeComponents(expression, currentDate);
  
  // Потом JS делает точный расчет
  return calculateTimestamp(components, currentTimestamp);
}

/**
 * AI извлекает компоненты времени из текста
 */
async function extractTimeComponents(expression, currentDate) {
  const systemPrompt = `Ты эксперт по парсингу дат и времени на русском языке.

Текущая дата: ${currentDate.toLocaleDateString('ru-RU')}
Текущее время: ${currentDate.toLocaleTimeString('ru-RU')}
Текущий день недели: ${currentDate.toLocaleDateString('ru-RU', { weekday: 'long' })}

Извлеки компоненты времени из текста и верни JSON.

ФОРМАТ ОТВЕТА (JSON):
{
  "type": "time|relative|relative_with_time|specific_date|weekday|today|tomorrow|day_after_tomorrow",
  "hour": число 0-23 (для типов с временем),
  "minute": число 0-59,
  "second": число 0-59 (опционально),
  "offset_seconds": число секунд (для type: relative, relative_with_time),
  "offset_minutes": число минут (для type: relative, relative_with_time),
  "offset_hours": число часов (для type: relative, relative_with_time),
  "offset_days": число дней (для type: relative, relative_with_time),
  "day": число 1-31 (для type: specific_date),
  "month": число 1-12 (для type: specific_date),
  "year": число (для type: specific_date),
  "weekday": "monday|tuesday|wednesday|thursday|friday|saturday|sunday" (для type: weekday),
  "next_week": true/false (для type: weekday)
}

ПРИМЕРЫ:

ТОЛЬКО ВРЕМЯ (если нет слов "сегодня", "завтра", дня недели или конкретной даты):
"09:20" → {"type": "time", "hour": 9, "minute": 20}
"в 9:20" → {"type": "time", "hour": 9, "minute": 20}
"10:10" → {"type": "time", "hour": 10, "minute": 10}
"в 10:15:30" → {"type": "time", "hour": 10, "minute": 15, "second": 30}
"12:50" → {"type": "time", "hour": 12, "minute": 50}
"18:45" → {"type": "time", "hour": 18, "minute": 45}
"в 20:30" → {"type": "time", "hour": 20, "minute": 30}
"22:15" → {"type": "time", "hour": 22, "minute": 15}
"в половине одиннадцатого" → {"type": "time", "hour": 10, "minute": 30}
"без четверти восемь" → {"type": "time", "hour": 7, "minute": 45}
"ровно в полдень" → {"type": "time", "hour": 12, "minute": 0}

ОТНОСИТЕЛЬНОЕ ВРЕМЯ (ключевое слово "через"):
"через 5 минут" → {"type": "relative", "offset_minutes": 5}
"через 2 часа" → {"type": "relative", "offset_hours": 2}
"через 15 минут" → {"type": "relative", "offset_minutes": 15}
"через 4 часа" → {"type": "relative", "offset_hours": 4}
"через 6 часов" → {"type": "relative", "offset_hours": 6}
"через 2 дня" → {"type": "relative", "offset_days": 2}

ОТНОСИТЕЛЬНОЕ + КОНКРЕТНОЕ ВРЕМЯ:
"через 2 дня в 12:00" → {"type": "relative_with_time", "offset_days": 2, "hour": 12, "minute": 0}
"через 2 дня в 19:00" → {"type": "relative_with_time", "offset_days": 2, "hour": 19, "minute": 0}

С КЛЮЧЕВЫМ СЛОВОМ (сегодня/завтра/послезавтра):
"сегодня в 15:00" → {"type": "today", "hour": 15, "minute": 0}
"завтра в 10:00" → {"type": "tomorrow", "hour": 10, "minute": 0}
"завтра в 09:10" → {"type": "tomorrow", "hour": 9, "minute": 10}
"послезавтра в 18:00" → {"type": "day_after_tomorrow", "hour": 18, "minute": 0}
"послезавтра в 08:50" → {"type": "day_after_tomorrow", "hour": 8, "minute": 50}

КОНКРЕТНАЯ ДАТА:
"16.10.2025 в 9:00" → {"type": "specific_date", "day": 16, "month": 10, "year": 2025, "hour": 9, "minute": 0}
"16 октября 2025 года в 09:10" → {"type": "specific_date", "day": 16, "month": 10, "year": 2025, "hour": 9, "minute": 10}

ДЕНЬ НЕДЕЛИ:
"в понедельник в 09:00" → {"type": "weekday", "weekday": "monday", "hour": 9, "minute": 0, "next_week": false}
"в следующий понедельник в 09:30" → {"type": "weekday", "weekday": "monday", "hour": 9, "minute": 30, "next_week": true}

Возвращай ТОЛЬКО валидный JSON, без текста!`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: `Извлеки компоненты: "${expression}"`
          }
        ],
        temperature: 0,
        max_tokens: 150,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[DateParserAgent] OpenAI API error:', error);
      throw new Error('Ошибка OpenAI API');
    }

    const data = await response.json();
    const resultText = data.choices[0].message.content.trim();
    
    const components = JSON.parse(resultText);
    console.log(`[DateParserAgent] Extracted components from "${expression}":`, components);
    
    return components;
  } catch (error) {
    console.error('[DateParserAgent] Error:', error);
    throw error;
  }
}

/**
 * Рассчитывает timestamp на основе компонентов
 */
function calculateTimestamp(components, currentTimestamp) {
  const now = new Date(currentTimestamp);
  let result = new Date(currentTimestamp);
  
  switch (components.type) {
    case 'time': {
      // Просто время - ставим на сегодня, если прошло - на завтра
      result.setHours(components.hour, components.minute || 0, components.second || 0, 0);
      if (result.getTime() < currentTimestamp) {
        result.setDate(result.getDate() + 1);
      }
      break;
    }
    
    case 'relative': {
      // Относительное время
      let offsetMs = 0;
      if (components.offset_seconds) offsetMs += components.offset_seconds * 1000;
      if (components.offset_minutes) offsetMs += components.offset_minutes * 60 * 1000;
      if (components.offset_hours) offsetMs += components.offset_hours * 60 * 60 * 1000;
      if (components.offset_days) offsetMs += components.offset_days * 24 * 60 * 60 * 1000;
      result = new Date(currentTimestamp + offsetMs);
      break;
    }
    
    case 'relative_with_time': {
      // Относительное время + конкретное время (например "через 2 дня в 12:00")
      let offsetMs = 0;
      if (components.offset_seconds) offsetMs += components.offset_seconds * 1000;
      if (components.offset_minutes) offsetMs += components.offset_minutes * 60 * 1000;
      if (components.offset_hours) offsetMs += components.offset_hours * 60 * 60 * 1000;
      if (components.offset_days) offsetMs += components.offset_days * 24 * 60 * 60 * 1000;
      
      result = new Date(currentTimestamp + offsetMs);
      result.setHours(components.hour, components.minute || 0, components.second || 0, 0);
      break;
    }
    
    case 'today': {
      // Сегодня в указанное время
      result.setHours(components.hour, components.minute || 0, components.second || 0, 0);
      break;
    }
    
    case 'tomorrow': {
      // Завтра в указанное время
      result.setDate(result.getDate() + 1);
      result.setHours(components.hour, components.minute || 0, components.second || 0, 0);
      break;
    }
    
    case 'day_after_tomorrow': {
      // Послезавтра в указанное время
      result.setDate(result.getDate() + 2);
      result.setHours(components.hour, components.minute || 0, components.second || 0, 0);
      break;
    }
    
    case 'specific_date': {
      // Конкретная дата
      result = new Date(components.year, components.month - 1, components.day, 
                        components.hour || 0, components.minute || 0, components.second || 0, 0);
      break;
    }
    
    case 'weekday': {
      // День недели
      const weekdayMap = {
        'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4,
        'friday': 5, 'saturday': 6, 'sunday': 0
      };
      const targetWeekday = weekdayMap[components.weekday];
      const currentWeekday = now.getDay();
      
      let daysUntilTarget = targetWeekday - currentWeekday;
      if (daysUntilTarget <= 0) daysUntilTarget += 7;
      if (components.next_week) daysUntilTarget += 7;
      
      result.setDate(result.getDate() + daysUntilTarget);
      result.setHours(components.hour, components.minute || 0, components.second || 0, 0);
      break;
    }
    
    default:
      throw new Error(`Unknown type: ${components.type}`);
  }
  
  const timestamp = result.getTime();
  console.log(`[DateParserAgent] Calculated timestamp: ${timestamp} (${result.toLocaleString('ru-RU', { timeZone: 'Asia/Krasnoyarsk' })})`);
  
  return timestamp;
}
