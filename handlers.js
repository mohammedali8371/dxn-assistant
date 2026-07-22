/**
 * ملف المعالجات الرئيسي
 * يحتوي على معالجة الرسائل والأوامر
 */

import { Api } from 'telegram';
import { getChatResponse, analyzeImage } from './ai.js';
import { searchKnowledge } from './rag.js';
import config from './config.js';
import {
  getUserHistory,
  addMessageToHistory,
  shouldGreet,
  updateGreetingTime,
  upsertUser,
  getAccessHash,
  recordStats,
} from './database.js';
import { logger, splitMessage, sleep, downloadMedia, deleteFile } from './utils.js';

// ======================== الحالة المؤقتة ========================
const processingUsers = new Set();

// ======================== معالجة الرسائل الرئيسية ========================

/**
 * معالجة رسالة جديدة من المستخدم
 */
export async function handleMessage(event) {
  const message = event.message;
  if (!message || !message.message) return;

  const chatId = event.chatId?.valueOf() || message.chatId?.valueOf();
  if (!chatId) return;

  const userId = message.senderId?.valueOf();
  const text = message.message.trim();

  // تجاهل الرسائل الفارغة
  if (!text) return;

  // منع التكرار
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

    // تسجيل إحصائيات
    await recordStats('message');

    // ======================== معالجة الأوامر ========================
    if (text.startsWith('/')) {
      await handleCommand(event, chatId, text);
      return;
    }

    // ======================== معالجة الوسائط ========================
    if (message.media) {
      await handleMedia(event, chatId, message);
      return;
    }

    // ======================== معالجة الرسائل العادية ========================
    await handleTextMessage(event, chatId, userId, text);

  } catch (error) {
    logger.error('خطأ في معالجة الرسالة', { error: error.message, chatId });
    await recordStats('error');
    await safeSendMessage(event.client, chatId, 'حدث خطأ مؤقت. حاول مرة ثانية أو تواصل مع الدعم الفني 🙏');
  } finally {
    processingUsers.delete(msgKey);
  }
}

// ======================== معالجة النصوص ========================

/**
 * معالجة رسالة نصية عادية
 */
async function handleTextMessage(event, chatId, userId, text) {
  const client = event.client;

  // إظهار مؤشر الكتابة
  try {
    await client.invoke(new Api.messages.SetTypingRequest({
      peer: chatId,
      action: new Api.SendMessageTypingAction(),
    }));
  } catch (e) {
    // تجاهل خطأ الكتابة
  }

  // التحقق من الترحيب
  const greet = userId ? await shouldGreet(userId) : false;
  const greetingInstruction = greet
    ? 'ابدأ بترحيب ودي قصير ثم أجب على السؤال.'
    : '';

  if (greet && userId) {
    await updateGreetingTime(userId);
  }

  // جلب سجل المحادثة
  const history = userId ? await getUserHistory(userId) : [];

  // البحث في قاعدة المعرفة
  const ragContext = await searchKnowledge(text);

  // الحصول على الرد
  const reply = await getChatResponse(history, text, ragContext, greetingInstruction);

  // حفظ في السجل
  if (userId) {
    await addMessageToHistory(userId, 'user', text);
    await addMessageToHistory(userId, 'assistant', reply);
  }

  // إرسال الرد مقسّم
  await sendReply(client, chatId, reply, message);
}

// ======================== معالجة الأوامر ========================

/**
 * معالجة الأوامر "/"
 */
async function handleCommand(event, chatId, text) {
  const client = event.client;
  const parts = text.split(' ');
  const command = parts[0].toLowerCase();
  const args = parts.slice(1).join(' ');

  switch (command) {
    case '/start':
      await sendReply(client, chatId, config.assistant.welcomeMessage);
      break;

    case '/help':
      await sendReply(client, chatId,
        `📋 أوامر المساعد:\n\n` +
        `/start - بدء المحادثة\n` +
        `/help - عرض المساعدة\n` +
        `/info - معلومات عن DXN\n` +
        `/products - منتجات DXN\n` +
        `/ask [سؤال] - سؤال مباشر\n\n` +
        `اكتب أي سؤال عادي وأنا أساعدك 😊`
      );
      break;

    case '/info':
      await sendReply(client, chatId,
        `🏢 DXN هي شركة ماليزية متخصصة في المنتجات الصحية والتغذوية.\n\n` +
        `📌 تأسست عام 1993\n` +
        `🌍 تعمل في أكثر من 180 دولة\n` +
        `🌿 متخصصة في منتجات السبيرولينا والأعشاب\n\n` +
        `اكتب /products لمعرفة المنتجات`
      );
      break;

    case '/products':
      await sendReply(client, chatId,
        `🛒 أبرز منتجات DXN:\n\n` +
        `1️⃣ سوبر غلوثا - صحة الكبد\n` +
        `2️⃣ رينغولد - مكافحة الشيخوخة\n` +
        `3️⃣ فور إيفير رينج - العناية بالبشرة\n` +
        `4️⃣ مورينغا - مكمل غذائي\n` +
        `5️⃣ قهوة DXN - المشروب الصحي\n\n` +
        `اكتب سؤالك عن أي منتج وأنا أساعدك!`
      );
      break;

    case '/ask':
      if (args) {
        await handleTextMessage(event, chatId, null, args);
      } else {
        await sendReply(client, chatId, 'اكتب سؤالك بعد الأمر:\n/ask كيف أحول للعضو؟');
      }
      break;

    default:
      await sendReply(client, chatId, `أمر غير معروف. اكتب /help لعرض الأوامر المتاحة.`);
  }
}

// ======================== معالجة الوسائط ========================

/**
 * معالجة الوسائط (صور، فيديو، مستندات)
 */
async function handleMedia(event, chatId, message) {
  const client = event.client;
  const className = message.media?.className || '';

  if (className === 'MessageMediaPhoto') {
    // تحليل الصورة
    await sendReply(client, chatId, '🔍 جاري تحليل الصورة...');
    const downloadedPath = await downloadMedia(client, message);
    if (downloadedPath) {
      const reply = await analyzeImage(downloadedPath);
      await sendReply(client, chatId, reply);
      deleteFile(downloadedPath);
    }
  } else if (className === 'MessageMediaDocument') {
    const doc = message.media.document;
    if (doc) {
      const mimeType = doc.mimeType || '';
      if (mimeType.includes('pdf')) {
        await sendReply(client, chatId, '📄 جاري قراءة ملف PDF...');
        // يمكن إضافة معالجة PDF لاحقاً
        await sendReply(client, chatId, 'تم استلام الملف. حالياً أستطيع قراءة الملفات النصية فقط. اكتب سؤالك وأنا أساعدك!');
      } else if (mimeType.includes('video')) {
        await sendReply(client, chatId, '🎬 شكراً على الفيديو! حالياً لا أستطيع تحليل الفيديو. اكتب وصفاً لسؤالك وأنا أساعدك.');
      } else if (mimeType.includes('audio') || mimeType.includes('ogg')) {
        await sendReply(client, chatId, '🎙️ شكراً على المقطع الصوتي! حالياً لا أستطيع تحليل الصوت. اكتب سؤالك وأنا أساعدك.');
      } else {
        await sendReply(client, chatId, '📎 تم استلام الملف. اكتب سؤالك وأنا أساعدك!');
      }
    }
  } else {
    await sendReply(client, chatId, '📎 تم استلام الوسائط. اكتب سؤالك وأنا أساعدك!');
  }
}

// ======================== إرسال الرسائل ========================

/**
 * إرسال رد مع تجربة طرق متعددة (sendReply fallback chain)
 * 1. الرد مع الرسالة الأصلية (replyTo)
 * 2. الرد بدون replyTo
 * 3. الرد عبر getInputEntity
 * 4. الرد عبر sender/chat
 */
export async function sendReply(client, chatId, text, originalMessage = null) {
  const parts = splitMessage(text, 30);

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    // محاولة 1: الرد على الرسالة الأصلية
    if (originalMessage && i === 0) {
      try {
        await client.sendMessage(chatId, {
          message: part,
          replyTo: originalMessage.id,
        });
        await sleep(1500);
        continue;
      } catch (error) {
        logger.warn('فشلت المحاولة الأولى (replyTo)', { error: error.message });
      }
    }

    // محاولة 2: إرسال عادي
    try {
      await client.sendMessage(chatId, { message: part });
      await sleep(1500);
      continue;
    } catch (error) {
      logger.warn('فشلت المحاولة الثانية (عادي)', { error: error.message });
    }

    // محاولة 3: عبر getInputEntity
    try {
      const entity = await client.getInputEntity(chatId);
      await client.sendMessage(entity, { message: part });
      await sleep(1500);
      continue;
    } catch (error) {
      logger.warn('فشلت المحاولة الثالثة (getInputEntity)', { error: error.message });
    }

    // محاولة 4: عبر sender
    if (originalMessage?.sender) {
      try {
        await client.sendMessage(originalMessage.sender, { message: part });
        await sleep(1500);
        continue;
      } catch (error) {
        logger.warn('فشلت المحاولة الرابعة (sender)', { error: error.message });
      }
    }

    // محاولة 5: عبر InputPeerUser بدون replyTo
    try {
      const inputPeer = new Api.InputPeerUser({
        userId: chatId,
        accessHash: BigInt(0),
      });
      await client.sendMessage(inputPeer, { message: part });
      await sleep(1500);
    } catch (error) {
      logger.error('فشلت جميع محاولات الإرسال', { chatId, error: error.message });
    }
  }
}

/**
 * إرسال رسالة بأمان (بدون خطأ)
 */
async function safeSendMessage(client, chatId, text) {
  try {
    await sendReply(client, chatId, text);
  } catch (error) {
    logger.error('خطأ في إرسال رسالة الخطأ', { error: error.message });
  }
}
