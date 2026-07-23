/**
 * مزود AI Multi-Search المجاني
 * يستخدم Firebase Auth للحصول على وصول مجاني
 * https://ai-multi-search-backend-321697147922.europe-west6.run.app
 */

import axios from 'axios';
import logger from '../../utils/logger.js';

const FIREBASE_URL = 'https://www.googleapis.com/identitytoolkit/v3/relyingparty/signupNewUser?key=AIzaSyA27E7jUV8osRY7NzwP2fZwGoTkp5gJhZw';
const AI_SEARCH_URL = 'https://ai-multi-search-backend-321697147922.europe-west6.run.app/ask';

class AIMultiSearchProvider {
  constructor() {
    this.isAvailable = false;
    this.authToken = null;
  }

  async initialize() {
    try {
      const response = await axios.post(FIREBASE_URL, {
        returnSecureToken: true,
      });
      this.authToken = response.data.idToken;
      this.isAvailable = true;
      logger.info('✅ تم تهيئة AI Multi-Search (مجاني)');
    } catch (error) {
      logger.warn('⚠️ فشل تهيئة AI Multi-Search', { error: error.message });
    }
  }

  async chat(messages, options = {}) {
    if (!this.isAvailable) throw new Error('AI Multi-Search غير متاح');

    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    const query = lastUserMsg?.content || '';

    const response = await axios.post(
      AI_SEARCH_URL,
      { query },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.authToken}`,
        },
        timeout: 30000,
      }
    );

    return response.data?.response || response.data?.answer || 'لا يوجد رد';
  }
}

export default new AIMultiSearchProvider();
