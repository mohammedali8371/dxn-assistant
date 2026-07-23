/**
 * معالج الأوامر
 */

import telegramService from '../services/telegram.js';
import ragService from '../services/rag.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';

/**
 * معالجة الأوامر "/"
 */
export async function handleCommand(event, chatId, text) {
  const parts = text.split(' ');
  const command = parts[0].toLowerCase();
  const args = parts.slice(1).join(' ');

  switch (command) {
    case '/start':
      await telegramService.sendReply(chatId,
        `مرحباً! 👋\n\nأنا ${config.assistant.name}، موظف خدمة العملاء في DXN.\n\nكيف أقدر أساعدك اليوم؟ 😊`
      );
      break;

    case '/help':
      await telegramService.sendReply(chatId,
        `📋 أوامر المساعد:\n\n` +
        `/start - بدء المحادثة\n` +
        `/help - عرض المساعدة\n` +
        `/info - معلومات عن DXN\n` +
        `/products - منتجات DXN\n` +
        `/ask [سؤال] - سؤال مباشر\n` +
        `/rebuild - إعادة بناء المعرفة\n\n` +
        `اكتب أي سؤال عادي وأنا أساعدك 😊`
      );
      break;

    case '/info':
      await telegramService.sendReply(chatId,
        `🏢 DXN هي شركة ماليزية متخصصة في المنتجات الصحية والتغذوية.\n\n` +
        `📌 تأسست عام 1993\n` +
        `🌍 تعمل في أكثر من 180 دولة\n` +
        `🌿 متخصصة في منتجات السبيرولينا والأعشاب\n\n` +
        `اكتب /products لمعرفة المنتجات`
      );
      break;

    case '/products':
      await telegramService.sendReply(chatId,
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
        // معالجة كسؤال مباشر
        const event2 = { ...event, message: { ...event.message, message: args } };
        const { handleTextMessage } = await import('./message.js');
        // استدعاء معالجة النص مباشرة
        await telegramService.setTyping(chatId);
        const ragContext = await ragService.search(args);
        const messages = [
          { role: 'system', content: `أنت ${config.assistant.name}، موظف خدمة عملاء يمني في DXN. رد قصير (10-30 كلمة).\n\n${ragContext ? 'المعرفة: ' + ragContext : ''}` },
          { role: 'user', content: args },
        ];
        const reply = await (await import('../services/ai-providers/index.js')).default.chat(messages);
        await telegramService.sendReply(chatId, reply, event.message);
      } else {
        await telegramService.sendReply(chatId,
          'اكتب سؤالك بعد الأمر:\n/ask كيف أحول للعضو؟'
        );
      }
      break;

    case '/rebuild':
      await telegramService.sendReply(chatId, '🔨 جاري إعادة بناء قاعدة المعرفة...');
      try {
        await ragService.buildKnowledgeBase();
        await telegramService.sendReply(chatId, '✅ تم إعادة بناء قاعدة المعرفة بنجاح!');
      } catch (error) {
        await telegramService.sendReply(chatId, '❌ حدث خطأ أثناء إعادة البناء.');
      }
      break;

    default:
      await telegramService.sendReply(chatId,
        'أمر غير معروف. اكتب /help لعرض الأوامر المتاحة.'
      );
  }
}
