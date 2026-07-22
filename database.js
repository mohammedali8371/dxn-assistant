/**
 * ملف قاعدة البيانات
 * يحتوي على اتصال MongoDB والنماذج والدوال الأساسية
 */

import mongoose from 'mongoose';
import config from './config.js';
import { logger } from './utils.js';

// ======================== نموذج المستخدم ========================
const userSchema = new mongoose.Schema({
  userId: { type: Number, required: true, unique: true, index: true },
  firstName: { type: String, default: '' },
  lastName: { type: String, default: '' },
  username: { type: String, default: '' },
  phone: { type: String, default: '' },
  accessHash: { type: String, default: '' },
  lastGreetedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const User = mongoose.model('User', userSchema);

// ======================== نموذج المحادثة ========================
const conversationSchema = new mongoose.Schema({
  userId: { type: Number, required: true, index: true },
  messages: [{
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const Conversation = mongoose.model('Conversation', conversationSchema);

// ======================== نموذج الجلسة ========================
const sessionSchema = new mongoose.Schema({
  key: { type: String, default: 'main', unique: true },
  sessionData: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const Session = mongoose.model('Session', sessionSchema);

// ======================== نموذج الإحصائيات ========================
const statsSchema = new mongoose.Schema({
  date: { type: String, required: true, unique: true },
  totalMessages: { type: Number, default: 0 },
  totalUsers: { type: Number, default: 0 },
  errors: { type: Number, default: 0 },
});

const Stats = mongoose.model('Stats', statsSchema);

// ======================== اتصال قاعدة البيانات ========================

/**
 * الاتصال بقاعدة البيانات
 */
export async function connectDB() {
  try {
    await mongoose.connect(config.mongodb.uri);
    logger.info('✅ تم الاتصال بقاعدة البيانات بنجاح');
  } catch (error) {
    logger.error('❌ فشل الاتصال بقاعدة البيانات', { error: error.message });
    throw error;
  }
}

// ======================== دوال المستخدمين ========================

/**
 * إنشاء أو تحديث مستخدم
 */
export async function upsertUser(userData) {
  try {
    const update = {
      firstName: userData.firstName || '',
      lastName: userData.lastName || '',
      username: userData.username || '',
      accessHash: userData.accessHash || '',
      updatedAt: new Date(),
    };
    if (userData.phone) update.phone = userData.phone;

    return await User.findOneAndUpdate(
      { userId: userData.userId },
      { $set: update, $setOnInsert: { createdAt: new Date() } },
      { upsert: true, new: true }
    );
  } catch (error) {
    logger.error('خطأ في تحديث المستخدم', { error: error.message });
    return null;
  }
}

/**
 * الحصول على مستخدم بالـ userId
 */
export async function getUser(userId) {
  try {
    return await User.findOne({ userId });
  } catch (error) {
    logger.error('خطأ في جلب المستخدم', { error: error.message });
    return null;
  }
}

/**
 * الحصول على accessHash للمستخدم
 */
export async function getAccessHash(userId) {
  try {
    const user = await User.findOne({ userId }).select('accessHash');
    return user ? user.accessHash : null;
  } catch (error) {
    logger.error('خطأ في جلب accessHash', { error: error.message });
    return null;
  }
}

// ======================== دوال المحادثات ========================

/**
 * الحصول على آخر 20 رسالة للمستخدم
 */
export async function getUserHistory(userId) {
  try {
    const conversation = await Conversation.findOne({ userId });
    if (!conversation) return [];
    const messages = conversation.messages.slice(-config.assistant.maxMemoryMessages);
    return messages.map(m => ({ role: m.role, content: m.content }));
  } catch (error) {
    logger.error('خطأ في جلب سجل المحادثة', { error: error.message });
    return [];
  }
}

/**
 * إضافة رسالة إلى سجل المحادثة
 */
export async function addMessageToHistory(userId, role, content) {
  try {
    await Conversation.findOneAndUpdate(
      { userId },
      {
        $push: {
          messages: {
            $each: [{ role, content, timestamp: new Date() }],
            $slice: -config.assistant.maxMemoryMessages,
          },
        },
        $set: { updatedAt: new Date() },
      },
      { upsert: true }
    );
  } catch (error) {
    logger.error('خطأ في حفظ الرسالة', { error: error.message });
  }
}

// ======================== دوال الترحيب ========================

/**
 * التحقق مما إذا كان يجب الترحيب بالمستخدم
 * يرجع true إذا لم يتم الترحيب من قبل أو مرت 10 ساعات
 */
export async function shouldGreet(userId) {
  try {
    const user = await User.findOne({ userId });
    if (!user || !user.lastGreetedAt) return true;

    const hoursSinceLastGreet = (Date.now() - user.lastGreetedAt.getTime()) / (1000 * 60 * 60);
    return hoursSinceLastGreet >= 10;
  } catch (error) {
    logger.error('خطأ في التحقق من الترحيب', { error: error.message });
    return true;
  }
}

/**
 * تحديث وقت آخر ترحيب
 */
export async function updateGreetingTime(userId) {
  try {
    await User.findOneAndUpdate(
      { userId },
      { $set: { lastGreetedAt: new Date(), updatedAt: new Date() } }
    );
  } catch (error) {
    logger.error('خطأ في تحديث وقت الترحيب', { error: error.message });
  }
}

// ======================== دوال الإحصائيات ========================

/**
 * تسجيل إحصائيات يومية
 */
export async function recordStats(type) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const update = { $inc: { totalMessages: 1 }, $set: { date: today } };
    if (type === 'newUser') update.$inc.totalUsers = 1;
    if (type === 'error') update.$inc.errors = 1;
    await Stats.findOneAndUpdate({ date: today }, update, { upsert: true });
  } catch (error) {
    logger.error('خطأ في تسجيل الإحصائيات', { error: error.message });
  }
}

/**
 * جلب الإحصائيات
 */
export async function getStats() {
  try {
    const totalUsers = await User.countDocuments();
    const today = new Date().toISOString().split('T')[0];
    const todayStats = await Stats.findOne({ date: today });
    const totalConversations = await Conversation.countDocuments();
    return {
      totalUsers,
      todayMessages: todayStats?.totalMessages || 0,
      todayErrors: todayStats?.errors || 0,
      totalConversations,
    };
  } catch (error) {
    return { totalUsers: 0, todayMessages: 0, todayErrors: 0, totalConversations: 0 };
  }
}

// ======================== دوال الجلسة ========================

/**
 * حفظ جلسة Telegram
 */
export async function saveSession(sessionData) {
  try {
    await Session.findOneAndUpdate(
      { key: 'main' },
      { $set: { sessionData, updatedAt: new Date() } },
      { upsert: true }
    );
    logger.info('✅ تم حفظ الجلسة');
  } catch (error) {
    logger.error('خطأ في حفظ الجلسة', { error: error.message });
  }
}

/**
 * استرجاع جلسة Telegram
 */
export async function loadSession() {
  try {
    const session = await Session.findOne({ key: 'main' });
    return session ? session.sessionData : null;
  } catch (error) {
    logger.error('خطأ في تحميل الجلسة', { error: error.message });
    return null;
  }
}
