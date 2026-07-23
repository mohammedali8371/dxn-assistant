/**
 * خدمة Telegram MTProto
 */

import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { NewMessage } from 'telegram/events/index.js';
import readline from 'readline';
import config from '../config/index.js';
import { saveSession, loadSession } from '../database/index.js';
import logger from '../utils/logger.js';
import { ensureDir, splitMessage, sleep, downloadMedia } from '../utils/helpers.js';

class TelegramService {
  constructor() {
    this.client = null;
    this.isReady = false;
  }

  async initialize() {
    try {
      ensureDir(config.telegram.sessionsDir);

      const savedSession = await loadSession();
      const session = new StringSession(savedSession || '');

      this.client = new TelegramClient(
        session,
        config.telegram.apiId,
        config.telegram.apiHash,
        {
          connectionRetries: 5,
          retryDelay: 1000,
          autoReconnect: true,
          useWSS: true,
          timeout: 30000,
        }
      );

      logger.info('🔐 جاري الاتصال بتيليجرام...');
      await this.client.connect();

      const isAuthorized = await this.client.isUserAuthorized();

      if (!isAuthorized) {
        logger.info('🔐 الحساب غير مسجل. جاري تسجيل الدخول...');
        await this._login();
      } else {
        logger.info('✅ الحساب مسجل مسبقاً');
      }

      const sessionData = this.client.session.save();
      await saveSession(sessionData);

      this.isReady = true;
      logger.info('✅ تم تهيئة Telegram بنجاح');

    } catch (error) {
      logger.error('❌ خطأ في تهيئة Telegram', { error: error.message });
      throw error;
    }
  }

  async _login() {
    const { Api } = await import('telegram');

    logger.info('📤 جاري إرسال طلب الكود...');
    const sentCode = await this.client.invoke(
      new Api.auth.SendCode({
        phoneNumber: config.telegram.phoneNumber,
        apiId: config.telegram.apiId,
        apiHash: config.telegram.apiHash,
        settings: new Api.CodeSettings(),
      })
    );

    logger.info('📤 تم إرسال الكود. انتظر الرسالة في تيليجرام...');

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const code = await new Promise((resolve) => {
      rl.question('📝 أدخل كود التحقق (5 أرقام): ', (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });

    try {
      await this.client.invoke(
        new Api.auth.SignIn({
          phoneNumber: config.telegram.phoneNumber,
          phoneCodeHash: sentCode.phoneCodeHash,
          phoneCode: code,
        })
      );
      logger.info('✅ تم تسجيل الدخول بنجاح');
    } catch (error) {
      if (error.message && error.message.includes('SESSION_PASSWORD_NEEDED')) {
        logger.info('🔒 المصادقة الثنائية مطلوبة...');
        const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout });
        const password = await new Promise((resolve) => {
          rl2.question('🔑 أدخل كلمة المرور (2FA): ', (answer) => {
            rl2.close();
            resolve(answer.trim());
          });
        });
        await this.client.invoke(
          new Api.auth.CheckPassword({ password })
        );
        logger.info('✅ تم تسجيل الدخول بالتحقق الثنائية بنجاح');
      } else {
        throw error;
      }
    }
  }

  addMessageHandler(handler) {
    if (!this.client) throw new Error('العميل غير مهيأ');
    this.client.addEventHandler(handler, new NewMessage({ incoming: true }));
    logger.info('✅ تمت إضافة معالج الرسائل');
  }

  async sendReply(chatId, text, originalMessage = null) {
    if (!this.client) throw new Error('العميل غير مهيأ');

    const parts = splitMessage(text, 30);

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];

      if (originalMessage && i === 0) {
        try {
          await this.client.sendMessage(chatId, {
            message: part,
            replyTo: originalMessage.id,
          });
          await sleep(1500);
          continue;
        } catch (error) {
          logger.warn('فشلت المحاولة الأولى (replyTo)');
        }
      }

      try {
        await this.client.sendMessage(chatId, { message: part });
        await sleep(1500);
        continue;
      } catch (error) {
        logger.warn('فشلت المحاولة الثانية (عادي)');
      }

      try {
        const entity = await this.client.getInputEntity(chatId);
        await this.client.sendMessage(entity, { message: part });
        await sleep(1500);
      } catch (error) {
        logger.error('فشلت جميع محاولات الإرسال', { chatId });
      }
    }
  }

  async setTyping(chatId) {
    if (!this.client) return;
    try {
      const { Api } = await import('telegram');
      await this.client.invoke(new Api.messages.SetTypingRequest({
        peer: chatId,
        action: new Api.SendMessageTypingAction(),
      }));
    } catch (e) {}
  }

  async downloadMedia(message) {
    if (!this.client) return null;
    return await downloadMedia(this.client, message);
  }

  async disconnect() {
    if (this.client) {
      try {
        const sessionData = this.client.session.save();
        await saveSession(sessionData);
        await this.client.disconnect();
        this.isReady = false;
        logger.info('📴 تم قطع الاتصال بتيليجرام');
      } catch (error) {
        logger.error('خطأ في قطع الاتصال', { error: error.message });
      }
    }
  }

  async getMe() {
    if (!this.client) return null;
    try {
      return await this.client.getMe();
    } catch (error) {
      return null;
    }
  }
}

export default new TelegramService();
