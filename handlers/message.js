/**
 * معالج الرسائل الرئيسي
 */

import telegramService from '../services/telegram.js';
import aiProviders from '../services/ai-providers/index.js';
import ragService from '../services/rag.js';
import { SYSTEM_PROMPT, GREETING_INSTRUCTION } from '../prompts/system.js';
import config from '../config/index.js';
import {
  upsertUser,
  getUserHistory,
  addMessageToHistory,
  shouldGreet,
  updateGreetingTime,
  recordStats,
} from '../database/index.js';
import logger from '../utils/logger.js';
import { downloadMedia, deleteFile, isCommand } from '../utils/helpers.js';
import { handleCommand } from './command.js';

// منع التكرار
const processingUsers = new Set();

/**
 * معالجة رسالة جديدة
 */
export async function handleMessage(event) {
  const message = event.message;
  if (!message || !message.message) return;

  const chatId = event.chatId?.valueOf() || message.chatId?.valueOf();
  if (!chatId) return;

  const userId = message.senderId?.valueOf();
  const text = message.message.trim();

  if (!text && !message.media) return;

  const msgKey = `${chatId}_${message.id}`;
  if (processingUsers.has(msgKey)) return;
  processingUsers.add(msgKey);

  try {
    // حفظ معلومات المستخدم
    if (userId) {
      const sender = message.sender;
      await upsertUser({
        userId,
        firstName: sender?.firstName || '',
        lastName: sender?.lastName || '',
        username: sender?.username || '',
        accessHash: sender?.accessHash?.toString() || '',
      });
    }

    await recordStats('totalMessages');

    // معالجة الأوامر
    if (isCommand(text)) {
      await handleCommand(event, chatId, text);
      return;
    }

    // معالجة الوسائط
    if (message.media && !text) {
      await handleMedia(event, chatId, message);
      return;
    }

    // معالجة النصوص
    await handleTextMessage(event, chatId, userId, text);

  } catch (error) {
    logger.error('خطأ في معالجة الرسالة', { error: error.message, chatId });
    await recordStats('errors');
    await telegramService.sendReply(chatId, 'حدث خطأ مؤقت. حاول مرة ثانية 🙏');
  } finally {
    processingUsers.delete(msgKey);
  }
}

/**
 * معالجة رسالة نصية
 */
async function handleTextMessage(event, chatId, userId, text) {
  await telegramService.setTyping(chatId);

  // التحقق من الترحيب
  const greet = userId ? await shouldGreet(userId) : false;
  const greetingInstruction = greet ? GREETING_INSTRUCTION : '';

  if (greet && userId) {
    await updateGreetingTime(userId);
  }

  // جلب السجل
  const history = userId ? await getUserHistory(userId) : [];

  // البحث في قاعدة المعرفة
  const ragContext = await ragService.search(text);

  // بناء الرسائل
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.slice(-10).map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: text },
  ];

  if (ragContext && ragContext !== '') {
    messages[0].content += `\n\nالمعرفة المتوفرة:\n${ragContext}`;
  }

  if (greetingInstruction) {
    messages[0].content += `\n\n${greetingInstruction}`;
  }

  // الحصول على الرد
  const reply = await aiProviders.chat(messages);

  // حفظ في السجل
  if (userId) {
    await addMessageToHistory(userId, 'user', text);
    await addMessageToHistory(userId, 'assistant', reply);
    await recordStats('totalReplies');
  }

  // إرسال الرد
  await telegramService.sendReply(chatId, reply, event.message);
}

/**
 * معالجة الوسائط
 */
async function handleMedia(event, chatId, message) {
  const className = message.media?.className || '';

  if (className === 'MessageMediaPhoto') {
    await telegramService.sendReply(chatId, '🔍 جاري تحليل الصورة...');
    const downloadedPath = await telegramService.downloadMedia(message);
    if (downloadedPath) {
      // تحليل الصورة باستخدام Vision
      await telegramService.sendReply(chatId, 'حالياً لا أستطيع تحليل الصور بشكل مباشر. اكتب وصفاً لسؤالك وأنا أساعدك! 😊');
      deleteFile(downloadedPath);
    }
  } else if (className === 'MessageMediaDocument') {
    await telegramService.sendReply(chatId, '📎 تم استلام الملف. اكتب سؤالك وأنا أساعدك!');
  } else {
    await telegramService.sendReply(chatId, '📎 تم استلام الوسائط. اكتب سؤالك وأنا أساعدك!');
  }
}
