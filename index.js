/**
 * DXN Telegram Assistant - نقطة البداية
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './config/index.js';
import { connection } from './database/index.js';
import telegramService from './services/telegram.js';
import { handleMessage } from './handlers/message.js';
import apiRoutes from './routes/api.js';
import logger from './utils/logger.js';
import { ensureDir } from './utils/helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  try {
    logger.info('🚀 بدء تشغيل مساعد DXN...');

    // 1) إنشاء المجلدات
    ensureDir(config.assistant.knowledgeDir);
    ensureDir(config.assistant.mediaDir);
    ensureDir(config.assistant.logsDir);

    // 2) الاتصال بقاعدة البيانات
    logger.info('📦 جاري الاتصال بقاعدة البيانات...');
    await connection.connect();
    logger.info('✅ تم الاتصال بقاعدة البيانات');

    // 3) تهيئة Telegram
    logger.info('📱 جاري تهيئة Telegram...');
    await telegramService.initialize();

    // 4) تسجيل معالج الرسائل
    telegramService.addMessageHandler(handleMessage);
    logger.info('✅ تم تسجيل معالج الرسائل');

    // 5) بدء لوحة التحكم
    const app = express();
    app.use(express.json());
    app.use(express.static(path.join(__dirname, 'public')));
    app.use('/', apiRoutes);

    const server = app.listen(config.dashboard.port, () => {
      logger.info(`🌐 لوحة التحكم متاحة على المنفذ ${config.dashboard.port}`);
    });

    // 6) معلومات المساعد
    const me = await telegramService.getMe();
    if (me) {
      logger.info(`🤖 المساعد يعمل باسم: ${me.firstName} (@${me.username || 'غير محدد'})`);
    }

    logger.info('✅ تم تشغيل المساعد بنجاح! اكتب له في تيليجرام.');

    // 7) التعامل مع الإغلاق
    const shutdown = async (signal) => {
      logger.info(`📴 تم استلامإشارة ${signal}. جاري الإغلاق...`);
      server.close();
      await telegramService.disconnect();
      await connection.disconnect();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('uncaughtException', (err) => {
      logger.error('خطأ غير متوقع', { error: err.message, stack: err.stack });
    });
    process.on('unhandledRejection', (reason) => {
      logger.error('Promise مرفوض', { reason: String(reason) });
    });

  } catch (error) {
    logger.error('❌ خطأ في بدء التشغيل', { error: error.message });
    process.exit(1);
  }
}

main();
