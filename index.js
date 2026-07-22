/**
 * الملف الرئيسي - نقطة البداية
 * تهيئة الاتصالات وتشغيل المساعد
 */

import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { NewMessage } from 'telegram/events/index.js';
import config from './config.js';
import { connectDB, saveSession, loadSession } from './database.js';
import { handleMessage } from './handlers.js';
import { buildKnowledgeBase } from './rag.js';
import { startDashboard } from './dashboard.js';
import { logger } from './utils.js';

// ======================== المتغيرات العامة ========================
let client = null;

// ======================== إعدادات العميل ========================
const stringSession = new StringSession('');

/**
 * بدء تشغيل العميل
 */
async function startClient(sessionData) {
  const session = sessionData ? new StringSession(sessionData) : new StringSession('');

  client = new TelegramClient(
    session,
    config.telegram.apiId,
    config.telegram.apiHash,
    {
      connectionRetries: 5,
      retryDelay: 1000,
      autoReconnect: true,
      useWSS: true,
      timeout: 30000,
    }
  );

  // تسجيل الدخول
  if (!sessionData) {
    logger.info('🔐 جاري تسجيل الدخول...');
    await client.start({
      phoneNumber: async () => config.telegram.phoneNumber,
      password: async () => {
        const password = config.telegram.password;
        if (password) return password;
        throw new Error('المصادقة الثنائية مفعلة. أدخل كلمة المرور في .env');
      },
      phoneCode: async () => {
        const readline = await import('readline');
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        return new Promise((resolve) => {
          rl.question('📝 أدخل كود التحقق: ', (code) => {
            rl.close();
            resolve(code.trim());
          });
        });
      },
      onError: (err) => logger.error('خطأ في تسجيل الدخول', { error: err.message }),
    });

    // حفظ الجلسة
    const newSession = client.session.save();
    await saveSession(newSession);
    logger.info('✅ تم تسجيل الدخول وحفظ الجلسة');
  } else {
    await client.connect();
    logger.info('✅ تم الاتصال بالخادم بجلسة محفوظة');
  }

  // إضافة معالج الرسائل
  client.addEventHandler(handleMessage, new NewMessage({ incoming: true }));

  // معلومات الحساب
  const me = await client.getMe();
  logger.info(`🤖 المساعد يعمل باسم: ${me.firstName} (@${me.username || 'غير محدد'})`);

  return client;
}

// ======================== التشغيل الرئيسي ========================

async function main() {
  logger.info('🚀 جاري بدء تشغيل المساعد...');

  try {
    // 1. الاتصال بقاعدة البيانات
    await connectDB();

    // 2. بناء قاعدة المعرفة
    await buildKnowledgeBase();

    // 3. تحميل الجلسة المحفوظة
    const savedSession = await loadSession();

    // 4. بدء العميل
    await startClient(savedSession);

    // 5. تشغيل لوحة التحكم
    startDashboard();

    logger.info('✅ تم تشغيل المساعد بنجاح!');

  } catch (error) {
    logger.error('❌ خطأ في بدء التشغيل', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

// ======================== معالجة الإنهاء ========================

process.on('SIGINT', async () => {
  logger.info('🔄 جاري إيقاف المساعد...');
  if (client) {
    const sessionData = client.session.save();
    await saveSession(sessionData);
    await client.disconnect();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('🔄 جاري إيقاف المساعد...');
  if (client) {
    const sessionData = client.session.save();
    await saveSession(sessionData);
    await client.disconnect();
  }
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('❌ خطأ غير متوقع', { reason: reason?.message || reason });
});

// ======================== بدء التشغيل ========================
main();
