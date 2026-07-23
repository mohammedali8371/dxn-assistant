/**
 * فهرس قاعدة البيانات
 */

import connection from './connection.js';
import User from './models/User.js';
import Conversation from './models/Conversation.js';
import Knowledge from './models/Knowledge.js';
import Stats from './models/Stats.js';
import Settings from './models/Settings.js';
import logger from '../utils/logger.js';

// ======================== دوال المستخدمين ========================

export async function upsertUser(userData) {
  try {
    const update = {
      firstName: userData.firstName || '',
      lastName: userData.lastName || '',
      username: userData.username || '',
      accessHash: userData.accessHash || '',
      lastInteractionAt: new Date(),
      $inc: { messageCount: 1 },
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

export async function getUser(userId) {
  try {
    return await User.findOne({ userId });
  } catch (error) {
    return null;
  }
}

export async function shouldGreet(userId) {
  try {
    const user = await User.findOne({ userId });
    if (!user || !user.lastGreetedAt) return true;
    const hoursSince = (Date.now() - user.lastGreetedAt.getTime()) / (1000 * 60 * 60);
    return hoursSince >= 10;
  } catch (error) {
    return true;
  }
}

export async function updateGreetingTime(userId) {
  try {
    await User.findOneAndUpdate({ userId }, { $set: { lastGreetedAt: new Date() } });
  } catch (error) {
    logger.error('خطأ في تحديث وقت الترحيب', { error: error.message });
  }
}

// ======================== دوال المحادثات ========================

export async function getUserHistory(userId) {
  try {
    const conversation = await Conversation.findOne({ userId });
    if (!conversation) return [];
    return conversation.messages.map(m => ({ role: m.role, content: m.content }));
  } catch (error) {
    return [];
  }
}

export async function addMessageToHistory(userId, role, content, type = 'text') {
  try {
    let conversation = await Conversation.findOne({ userId });
    if (!conversation) {
      conversation = new Conversation({ userId, messages: [] });
    }
    await conversation.addMessage(role, content, type);
  } catch (error) {
    logger.error('خطأ في حفظ الرسالة', { error: error.message });
  }
}

// ======================== دوال الإحصائيات ========================

export async function recordStats(type) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const update = { $inc: { [type]: 1 } };
    await Stats.findOneAndUpdate({ date: today }, update, { upsert: true });
  } catch (error) {
    logger.error('خطأ في تسجيل الإحصائيات', { error: error.message });
  }
}

export async function getStats() {
  try {
    const totalUsers = await User.countDocuments();
    const today = new Date().toISOString().split('T')[0];
    const todayStats = await Stats.findOne({ date: today });
    const totalConversations = await Conversation.countDocuments();
    const totalKnowledge = await Knowledge.countDocuments();

    return {
      totalUsers,
      todayMessages: todayStats?.totalMessages || 0,
      todayErrors: todayStats?.errors || 0,
      totalConversations,
      totalKnowledge,
      today: todayStats || {},
    };
  } catch (error) {
    return { totalUsers: 0, todayMessages: 0, todayErrors: 0, totalConversations: 0, totalKnowledge: 0 };
  }
}

// ======================== دوال الجلسة ========================

export async function saveSession(sessionData) {
  try {
    await Settings.setSetting('telegram_session', sessionData, 'Telegram session string');
    logger.info('✅ تم حفظ الجلسة');
  } catch (error) {
    logger.error('خطأ في حفظ الجلسة', { error: error.message });
  }
}

export async function loadSession() {
  try {
    return await Settings.getSetting('telegram_session', null);
  } catch (error) {
    return null;
  }
}

export { connection, User, Conversation, Knowledge, Stats, Settings };
