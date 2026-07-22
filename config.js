/**
 * ملف الإعدادات الرئيسي
 * يقرأ المتغيرات البيئية ويُصدرها ككائن منظم
 */

import dotenv from 'dotenv';
dotenv.config();

const config = {
  // ======================== Telegram ========================
  telegram: {
    apiId: parseInt(process.env.TELEGRAM_API_ID || '0'),
    apiHash: process.env.TELEGRAM_API_HASH || '',
    phoneNumber: process.env.TELEGRAM_PHONE || '',
    password: process.env.TELEGRAM_PASSWORD || '',
  },

  // ======================== MongoDB ========================
  mongodb: {
    uri: process.env.MONGODB_URI || '',
  },

  // ======================== المساعد الذكي ========================
  assistant: {
    name: 'أحمد',
    welcomeMessage: 'مرحباً! 👋 أنا أحمد، موظف خدمة العملاء في DXN. كيف أقدر أساعدك اليوم؟',
    maxMemoryMessages: 20,
    knowledgeDir: process.env.KNOWLEDGE_DIR || './knowledge',
    ragTopK: 3,
    unknownMessage: 'المعلومة هذه غير موجودة عندي حالياً. تواصل مع الدعم الفني وهم يساعدونك إن شاء الله 🙏',
    outOfScopeMessage: 'أنا أحمد من DXN، اختصاصي يقتصر على معلومات الشركة ومنتجاتها. هل عندك سؤال عن DXN؟ 😊',
    systemPromptTemplate: `أنت أحمد، موظف خدمة عملاء يمني في DXN، بشوش وخبير. قواعد صارمة: ردودك قصيرة (10-30 كلمة). إذا كان الجواب طويلاً، قسمه. استخدم لغة تحفيزية. لا تذكر أنك ذكاء اصطناعي.
{greeting_instruction}
المعرفة: {context}
سؤال العميل: {question}
أحمد:`,
  },

  // ======================== Dashboard ========================
  dashboard: {
    port: parseInt(process.env.PORT || '3004'),
  },
};

export default config;
