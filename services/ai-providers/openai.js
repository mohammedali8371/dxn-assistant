/**
 * مزود OpenAI
 */

import OpenAI from 'openai';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';

class OpenAIProvider {
  constructor() {
    this.client = null;
    this.isAvailable = false;
  }

  initialize() {
    if (!config.ai.openai.apiKey) {
      logger.warn('⚠️ مفتاح OpenAI غير متوفر');
      return;
    }
    this.client = new OpenAI({ apiKey: config.ai.openai.apiKey });
    this.isAvailable = true;
    logger.info('✅ تم تهيئة OpenAI');
  }

  async chat(messages, options = {}) {
    if (!this.isAvailable) throw new Error('OpenAI غير متاح');
    const response = await this.client.chat.completions.create({
      model: options.model || 'gpt-4o-mini',
      messages,
      temperature: options.temperature || config.ai.temperature,
      max_tokens: options.maxTokens || 500,
    });
    return response.choices[0]?.message?.content || '';
  }

  async createEmbedding(text) {
    if (!this.isAvailable) return null;
    const response = await this.client.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return response.data[0]?.embedding || null;
  }

  async createEmbeddings(texts) {
    if (!this.isAvailable) return [];
    const response = await this.client.embeddings.create({
      model: 'text-embedding-3-small',
      input: texts,
    });
    return response.data.map(d => d.embedding);
  }
}

export default new OpenAIProvider();
