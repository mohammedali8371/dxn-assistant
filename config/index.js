/**
 * ملف الإعدادات الرئيسي
 * يقرأ المتغيرات البيئية من .env ويُصدرها ككائن منظم
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const config = {
  // ======================== Telegram ========================
  telegram: {
    apiId: parseInt(process.env.TELEGRAM_API_ID || '0'),
    apiHash: process.env.TELEGRAM_API_HASH || '',
    phoneNumber: process.env.TELEGRAM_PHONE || '',
    password: process.env.TELEGRAM_PASSWORD || '',
    sessionsDir: path.join(__dirname, '..', 'sessions'),
  },

  // ======================== AI Provider ========================
  ai: {
    provider: process.env.AI_PROVIDER || 'openai',
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY || '',
    },
    deepseek: {
      apiKey: process.env.DEEPSEEK_API_KEY || '',
    },
    temperature: parseFloat(process.env.TEMPERATURE || '0.7'),
  },

  // ======================== MongoDB ========================
  mongodb: {
    uri: process.env.MONGODB_URI || '',
  },

  // ======================== المساعد الذكي ========================
  assistant: {
    name: process.env.ASSISTANT_NAME || 'أحمد',
    topK: parseInt(process.env.TOP_K || '3'),
    chunkSize: parseInt(process.env.CHUNK_SIZE || '1000'),
    chunkOverlap: parseInt(process.env.CHUNK_OVERLAP || '200'),
    maxMemory: parseInt(process.env.MAX_MEMORY || '20'),
    knowledgeDir: path.join(__dirname, '..', 'knowledge'),
    mediaDir: path.join(__dirname, '..', 'media'),
    logsDir: path.join(__dirname, '..', 'logs'),
  },

  // ======================== Dashboard ========================
  dashboard: {
    port: parseInt(process.env.PORT || '3004'),
    password: process.env.DASHBOARD_PASSWORD || 'admin123',
  },

  // ======================== Environment ========================
  env: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
};

export default config;
