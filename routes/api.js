/**
 * مسارات API للوحة التحكم
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { getStats } from '../database/index.js';
import ragService from '../services/rag.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// الصفحة الرئيسية
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// API: الإحصائيات
router.get('/api/stats', async (req, res) => {
  try {
    const stats = await getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('خطأ في جلب الإحصائيات', { error: error.message });
    res.status(500).json({ success: false, error: 'خطأ في الخادم' });
  }
});

// API: حالة الخادم
router.get('/api/health', (req, res) => {
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

// API: إعادة بناء المعرفة
router.post('/api/rebuild', async (req, res) => {
  try {
    await ragService.buildKnowledgeBase();
    res.json({ success: true, message: 'تم إعادة بناء قاعدة المعرفة' });
  } catch (error) {
    logger.error('خطأ في إعادة البناء', { error: error.message });
    res.status(500).json({ success: false, error: 'خطأ في إعادة البناء' });
  }
});

// API: معلومات المساعد
router.get('/api/assistant', (req, res) => {
  res.json({
    success: true,
    data: {
      name: config.assistant.name,
      provider: config.ai.provider,
      maxMemory: config.assistant.maxMemory,
      topK: config.assistant.topK,
      chunkSize: config.assistant.chunkSize,
    },
  });
});

export default router;
