/**
 * مزود Gemini
 */

import axios from 'axios';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';

class GeminiProvider {
  constructor() {
    this.isAvailable = false;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  }

  initialize() {
    if (!config.ai.gemini.apiKey) {
      logger.warn('⚠️ مفتاح Gemini غير متوفر');
      return;
    }
    this.isAvailable = true;
    logger.info('✅ تم تهيئة Gemini');
  }

  async chat(messages, options = {}) {
    if (!this.isAvailable) throw new Error('Gemini غير متاح');

    const contents = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const systemMessage = messages.find(m => m.role === 'system');
    const model = options.model || 'gemini-1.5-flash';

    const response = await axios.post(
      `${this.baseUrl}/models/${model}:generateContent?key=${config.ai.gemini.apiKey}`,
      {
        contents,
        systemInstruction: systemMessage ? { parts: [{ text: systemMessage.content }] } : undefined,
        generationConfig: {
          temperature: options.temperature || config.ai.temperature,
          maxOutputTokens: options.maxTokens || 500,
        },
      }
    );

    return response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }
}

export default new GeminiProvider();
