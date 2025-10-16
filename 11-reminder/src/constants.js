import dotenv from "dotenv";

dotenv.config();

export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
export const PORT = process.env.PORT || 3000;
export const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
export const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 8 * * *';
export const API_URL = process.env.API_URL || `http://localhost:${process.env.PORT || 3000}/api`;

