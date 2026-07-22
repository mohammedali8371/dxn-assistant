/**
 * ملف لوحة التحكم (Dashboard)
 * واجهة ويب للمراقبة والإحصائيات
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './config.js';
import { getStats } from './database.js';
import { logger } from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ======================== الإعدادات ========================
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ======================== Routes ========================

/**
 * الصفحة الرئيسية - لوحة التحكم
 */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/**
 * API: الإحصائيات
 */
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('خطأ في جلب الإحصائيات', { error: error.message });
    res.status(500).json({ success: false, error: 'خطأ في الخادم' });
  }
});

/**
 * API: حالة الخادم
 */
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'running',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
    },
  });
});

/**
 * API: معلومات المساعد
 */
app.get('/api/assistant', (req, res) => {
  res.json({
    success: true,
    data: {
      name: config.assistant.name,
      maxMemoryMessages: config.assistant.maxMemoryMessages,
      ragTopK: config.assistant.ragTopK,
    },
  });
});

// ======================== تشغيل الخادم ========================

/**
 * بدء تشغيل لوحة التحكم
 */
export function startDashboard() {
  const port = config.dashboard.port;

  const server = app.listen(port, '0.0.0.0', () => {
    logger.info(`🌐 لوحة التحكم تعمل على http://localhost:${port}`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      logger.warn(`⚠️ المنفذ ${port} مستخدم بالفعل، محاولة المنفذ التالي...`);
      app.listen(port + 1, '0.0.0.0', () => {
        logger.info(`🌐 لوحة التحكم تعمل على http://localhost:${port + 1}`);
      });
    } else {
      logger.error('خطأ في تشغيل لوحة التحكم', { error: error.message });
    }
  });

  return server;
}
