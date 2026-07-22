/**
 * ملف الأدوات المساعدة
 * يحتوي على Logger ودوال مساعدة متنوعة
 */

import winston from 'winston';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ======================== Logger ========================

/**
 * إعداد نظام السجلات باستخدام Winston
 */
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length ? ` | ${JSON.stringify(meta)}` : '';
      return `${timestamp} [${level.toUpperCase()}]: ${message}${metaStr}`;
    })
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message }) => {
          return `${timestamp} ${level}: ${message}`;
        })
      ),
    }),
    new winston.transports.File({
      filename: path.join(__dirname, 'logs', 'error.log'),
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(__dirname, 'logs', 'combined.log'),
      maxsize: 5242880,
      maxFiles: 5,
    }),
  ],
});

// إنشاء مجلد السجلات
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// ======================== دوال مساعدة ========================

/**
 * تقسيم الرسالة الطويلة إلى أجزاء قصيرة (30 كلمة كحد أقصى)
 * يُقسم بناءً على علامات الترقيم
 */
export function splitMessage(text, maxWords = 30) {
  if (!text) return [];

  const parts = [];
  // تقسيم أولاً بنقطة الفصل
  const sentences = text.split(/(?<=[.!؟\n])\s*/);
  let currentPart = '';

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    const wordsInPart = currentPart.split(/\s+/).filter(Boolean).length;
    const wordsInSentence = trimmed.split(/\s+/).filter(Boolean).length;

    if (wordsInPart + wordsInSentence > maxWords && currentPart) {
      parts.push(currentPart.trim());
      currentPart = trimmed;
    } else {
      currentPart = currentPart ? currentPart + ' ' + trimmed : trimmed;
    }
  }

  if (currentPart.trim()) {
    parts.push(currentPart.trim());
  }

  return parts.length > 0 ? parts : [text];
}

/**
 * تأخير التنفيذ
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * إنشاء مجلد إذا لم يكن موجوداً
 */
export function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * تنزيل ملف وسائط من Telegram وحفظه محلياً
 * @param {object} client - عميل Telegram
 * @param {object} message - الرسالة
 * @returns {Promise<string|null>} مسار الملف المحمل
 */
export async function downloadMedia(client, message) {
  try {
    if (!message.media) return null;

    const mediaDir = path.join(__dirname, 'media');
    ensureDir(mediaDir);

    const buffer = await client.downloadMedia(message);
    if (!buffer) return null;

    const ext = getMediaExtension(message);
    const fileName = `media_${Date.now()}${ext}`;
    const filePath = path.join(mediaDir, fileName);

    fs.writeFileSync(filePath, buffer);
    logger.info(`تم تنزيل الوسائط: ${filePath}`);
    return filePath;
  } catch (error) {
    logger.error('خطأ في تنزيل الوسائط', { error: error.message });
    return null;
  }
}

/**
 * حذف ملف
 */
export function deleteFile(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.info(`تم حذف الملف: ${filePath}`);
    }
  } catch (error) {
    logger.error('خطأ في حذف الملف', { error: error.message });
  }
}

/**
 * تحديد امتداد الوسائط من نوع الرسالة
 */
function getMediaExtension(message) {
  if (!message.media) return '.bin';

  const className = message.media.className || '';

  if (className === 'MessageMediaPhoto') return '.jpg';
  if (className === 'MessageMediaDocument') {
    const doc = message.media.document;
    if (doc && doc.mimeType) {
      if (doc.mimeType.includes('video')) return '.mp4';
      if (doc.mimeType.includes('audio') || doc.mimeType.includes('ogg')) return '.ogg';
      if (doc.mimeType.includes('pdf')) return '.pdf';
    }
  }

  return '.bin';
}
