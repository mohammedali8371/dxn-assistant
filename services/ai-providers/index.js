/**
 * فهرس مزودي الذكاء الاصطناعي
 * يدير التبديل بين المزودين حسب الإعدادات
 */

import config from '../../config/index.js';
import logger from '../../utils/logger.js';
import openaiProvider from './openai.js';
import geminiProvider from './gemini.js';
import deepseekProvider from './deepseek.js';
import groqProvider from './groq.js';
import multiSearchProvider from './multi-search.js';

class AIProviderManager {
  constructor() {
    this.providers = {};
    this.activeProvider = null;
  }

  /**
   * تهيئة المزود النشط
   */
  initialize() {
    this.providers.openai = openaiProvider;
    this.providers.gemini = geminiProvider;
    this.providers.deepseek = deepseekProvider;
    this.providers.groq = groqProvider;
    this.providers.multiSearch = multiSearchProvider;

    // تهيئة جميع المزودين
    for (const [name, provider] of Object.entries(this.providers)) {
      provider.initialize();
    }

    // تحديد المزود النشط
    const providerName = config.ai.provider;
    this.activeProvider = this.providers[providerName];

    if (!this.activeProvider || !this.activeProvider.isAvailable) {
      // محاولة العثور على مزود متاح
      for (const [name, provider] of Object.entries(this.providers)) {
        if (provider.isAvailable) {
          this.activeProvider = provider;
          logger.info(`🔄 تم التبديل إلى مزود ${name}`);
          break;
        }
      }
    }

    if (!this.activeProvider || !this.activeProvider.isAvailable) {
      logger.error('❌ لا يوجد مزود AI متاح');
    } else {
      logger.info(`✅ المزود النشط: ${providerName}`);
    }
  }

  /**
   * إرسال رسالة
   */
  async chat(messages, options = {}) {
    if (!this.activeProvider || !this.activeProvider.isAvailable) {
      return 'الذكاء الاصطناعي غير متاح حالياً. تواصل مع الدعم الفني.';
    }

    try {
      return await this.activeProvider.chat(messages, options);
    } catch (error) {
      logger.error(`خطأ في المزود`, { error: error.message });

      // محاولة التبديل لمزود آخر
      for (const [name, provider] of Object.entries(this.providers)) {
        if (provider.isAvailable && provider !== this.activeProvider) {
          try {
            logger.info(`🔄 التبديل إلى ${name} بعد الخطأ`);
            return await provider.chat(messages, options);
          } catch (e) {
            continue;
          }
        }
      }

      return 'حدث خطأ في الذكاء الاصطناعي. حاول مرة ثانية.';
    }
  }

  /**
   * إنشاء Embedding
   */
  async createEmbedding(text) {
    if (this.providers.openai?.isAvailable) {
      return await this.providers.openai.createEmbedding(text);
    }
    return null;
  }

  /**
   * إنشاء Embeddings
   */
  async createEmbeddings(texts) {
    if (this.providers.openai?.isAvailable) {
      return await this.providers.openai.createEmbeddings(texts);
    }
    return [];
  }
}

export default new AIProviderManager();
