/**
 * ملف خدمة الذكاء الاصطناعي
 * يستخدم خدمة ai-multi-search المجانية بدون API Key
 */

import axios from 'axios';
import config from './config.js';
import { logger } from './utils.js';

// ======================== Firebase Auth Token ========================

let firebaseToken = null;
let tokenExpiry = 0;

/**
 * الحصول على Firebase Auth Token
 * يستخدم تسجيل دخول مجهول (Anonymous) من Firebase
 */
async function getFirebaseToken() {
  // إذا كان التوكن صالحاً، نُعيده مباشرة
  if (firebaseToken && Date.now() < tokenExpiry) {
    return firebaseToken;
  }

  try {
    const response = await axios.post(
      'https://www.googleapis.com/identitytoolkit/v3/relyingparty/signupNewUser?key=AIzaSyA27E7jUV8osRY7NzwP2fZwGoTkp5gJhZw',
      { returnSecureToken: true },
      { headers: { 'Content-Type': 'application/json' } }
    );

    firebaseToken = response.data.idToken;
    // التوكن صالح لمدة ساعة تقريباً، نحدّثه بعد 50 دقيقة
    tokenExpiry = Date.now() + 50 * 60 * 1000;

    logger.info('✅ تم الحصول على Firebase Token');
    return firebaseToken;
  } catch (error) {
    logger.error('❌ فشل الحصول على Firebase Token', { error: error.message });
    throw error;
  }
}

// ======================== نماذج الذكاء الاصطناعي ========================

/**
 * ترتيب النماذج المدعومة - يُجرب بالترتيب حتى ينجح أحدها
 */
const MODELS = [
  { name: 'gemini', provider: 'google' },
  { name: 'deepseek', provider: 'deepseek' },
  { name: 'openai', provider: 'openai' },
  { name: 'perplexity', provider: 'perplexity' },
  { name: 'claude', provider: 'anthropic' },
  { name: 'llama', provider: 'meta' },
];

// ======================== دالة الرد الأساسية ========================

/**
 * الحصول على رد من الذكاء الاصطناعي
 * يجرب النماذج بالترتيب حتى ينجح أحدها
 *
 * @param {Array} history - سجل المحادثة السابق
 * @param {string} question - سؤال المستخدم
 * @param {string} context - السياق من قاعدة المعرفة
 * @param {string} greetingInstruction - تعليمات الترحيب
 * @returns {Promise<string>} رد المساعد
 */
export async function getChatResponse(history, question, context, greetingInstruction) {
  const token = await getFirebaseToken();

  // بناء الـ System Prompt
  const systemPrompt = config.assistant.systemPromptTemplate
    .replace('{greeting_instruction}', greetingInstruction)
    .replace('{context}', context || 'لا توجد معلومات إضافية حالياً.')
    .replace('{question}', question);

  // بناء مصفوفة الرسائل
  const messages = [];

  // إضافة سجل المحادثة السابق
  if (history && history.length > 0) {
    for (const msg of history.slice(-10)) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  // إضافة رسالة النظام والسؤال الحالي
  messages.unshift({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: question });

  // تجربة النماذج بالترتيب
  for (const model of MODELS) {
    try {
      const response = await callAIModel(token, model, messages);
      if (response && response.length > 5) {
        logger.info(`✅ نجح النموذج: ${model.name}`);
        return response;
      }
    } catch (error) {
      logger.warn(`⚠️ فشل النموذج ${model.name}: ${error.message}`);
      continue;
    }
  }

  // إذا فشلت جميع النماذج
  logger.error('❌ فشلت جميع نماذج الذكاء الاصطناعي');
  return config.assistant.unknownMessage;
}

/**
 * استدعاء نموذج ذكاء اصطناعي محدد
 */
async function callAIModel(token, model, messages) {
  const response = await axios.post(
    'https://ai-multi-search-backend-321697147922.europe-west6.run.app/ask',
    {
      messages,
      model: model.name,
      provider: model.provider,
    },
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
  );

  if (response.data && response.data.response) {
    return response.data.response.trim();
  }

  if (response.data && response.data.choices && response.data.choices[0]) {
    return response.data.choices[0].message?.content?.trim() || '';
  }

  if (typeof response.data === 'string') {
    return response.data.trim();
  }

  return '';
}

/**
 * تحليل الصورة (رد بسيط حالياً)
 */
export async function analyzeImage(imagePath) {
  return 'أشكرك على الصورة! 😊 حالياً ما أقدر أحلل الصور بشكل مباشر. هل تقدر تكتب لي وصف للسؤال وأساعدك؟';
}
