/**
 * خدمة OpenAI
 * تتولى التعامل مع Chat, Vision, Whisper, Embeddings
 */

import OpenAI from 'openai';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import fs from 'fs';

class OpenAIService {
  constructor() {
    this.client = null;
    this.isAvailable = false;
  }

  /**
   * تهيئة الخدمة
   */
  initialize() {
    if (!config.openai.apiKey) {
      logger.warn('⚠️ مفتاح OpenAI غير متوفر. الذكاء الاصطناعي معطل.');
      this.isAvailable = false;
      return;
    }

    this.client = new OpenAI({
      apiKey: config.openai.apiKey,
    });

    this.isAvailable = true;
    logger.info('✅ تم تهيئة OpenAI بنجاح');
  }

  /**
   * إرسال رسالة Chat
   */
  async chat(messages, options = {}) {
    if (!this.isAvailable) {
      return 'الذكاء الاصطناعي غير متاح حالياً. تواصل مع الدعم الفني.';
    }

    try {
      const response = await this.client.chat.completions.create({
        model: options.model || 'gpt-4o-mini',
        messages,
        temperature: options.temperature || config.openai.temperature,
        max_tokens: options.maxTokens || 500,
      });

      const content = response.choices[0]?.message?.content || '';
      logger.api('OpenAI Chat', {
        model: options.model || 'gpt-4o-mini',
        tokens: response.usage?.total_tokens || 0,
      });

      return content;
    } catch (error) {
      logger.error('خطأ في OpenAI Chat', { error: error.message });
      throw error;
    }
  }

  /**
   * تحليل صورة (Vision)
   */
  async analyzeImage(imagePath, prompt = 'وصف هذه الصورة باللهجة اليمنية') {
    if (!this.isAvailable) {
      return 'تحليل الصور غير متاح حالياً.';
    }

    try {
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');

      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        max_tokens: 300,
      });

      return response.choices[0]?.message?.content || 'ما قدرت أحلل الصورة.';
    } catch (error) {
      logger.error('خطأ في تحليل الصورة', { error: error.message });
      return 'حدث خطأ أثناء تحليل الصورة.';
    }
  }

  /**
   * تحويل الصوت إلى نص (Whisper)
   */
  async transcribeAudio(audioPath) {
    if (!this.isAvailable) {
      return null;
    }

    try {
      const response = await this.client.audio.transcriptions.create({
        model: 'whisper-1',
        file: fs.createReadStream(audioPath),
        language: 'ar',
      });

      return response.text;
    } catch (error) {
      logger.error('خطأ في تحويل الصوت', { error: error.message });
      return null;
    }
  }

  /**
   * إنشاء Embeddings
   */
  async createEmbedding(text) {
    if (!this.isAvailable) {
      return null;
    }

    try {
      const response = await this.client.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });

      return response.data[0]?.embedding || null;
    } catch (error) {
      logger.error('خطأ في إنشاء Embedding', { error: error.message });
      return null;
    }
  }

  /**
   * إنشاء Embeddings لعدة نصوص
   */
  async createEmbeddings(texts) {
    if (!this.isAvailable) {
      return [];
    }

    try {
      const response = await this.client.embeddings.create({
        model: 'text-embedding-3-small',
        input: texts,
      });

      return response.data.map(d => d.embedding);
    } catch (error) {
      logger.error('خطأ في إنشاء Embeddings', { error: error.message });
      return [];
    }
  }
}

export default new OpenAIService();
