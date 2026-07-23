/**
 * مزود DeepSeek
 */

import OpenAI from 'openai';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';

class DeepSeekProvider {
  constructor() {
    this.client = null;
    this.isAvailable = false;
  }

  initialize() {
    if (!config.ai.deepseek.apiKey) {
      logger.warn('⚠️ مفتاح DeepSeek غير متوفر');
      return;
    }
    this.client = new OpenAI({
      apiKey: config.ai.deepseek.apiKey,
      baseURL: 'https://api.deepseek.com',
    });
    this.isAvailable = true;
    logger.info('✅ تم تهيئة DeepSeek');
  }

  async chat(messages, options = {}) {
    if (!this.isAvailable) throw new Error('DeepSeek غير متاح');
    const response = await this.client.chat.completions.create({
      model: options.model || 'deepseek-chat',
      messages,
      temperature: options.temperature || config.ai.temperature,
      max_tokens: options.maxTokens || 500,
    });
    return response.choices[0]?.message?.content || '';
  }
}

export default new DeepSeekProvider();
