/**
 * مزود Groq المجاني
 * Llama 3.3 70B - مجاني بدون بطاقة ائتمان
 * https://console.groq.com
 */

import OpenAI from 'openai';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';

class GroqProvider {
  constructor() {
    this.client = null;
    this.isAvailable = false;
  }

  initialize() {
    if (!config.ai.groq.apiKey) {
      logger.warn('⚠️ مفتاح Groq غير متوفر');
      return;
    }
    this.client = new OpenAI({
      apiKey: config.ai.groq.apiKey,
      baseURL: 'https://api.groq.com/openai/v1',
    });
    this.isAvailable = true;
    logger.info('✅ تم تهيئة Groq (مجاني)');
  }

  async chat(messages, options = {}) {
    if (!this.isAvailable) throw new Error('Groq غير متاح');
    const response = await this.client.chat.completions.create({
      model: options.model || 'llama-3.3-70b-versatile',
      messages,
      temperature: options.temperature || config.ai.temperature,
      max_tokens: options.maxTokens || 500,
    });
    return response.choices[0]?.message?.content || '';
  }
}

export default new GroqProvider();
