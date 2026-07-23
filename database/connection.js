/**
 * اتصال قاعدة البيانات MongoDB
 */

import mongoose from 'mongoose';
import config from '../config/index.js';
import logger from '../utils/logger.js';

class DatabaseConnection {
  constructor() {
    this.isConnected = false;
  }

  async connect() {
    if (this.isConnected) {
      logger.info('📦 قاعدة البيانات متصلة بالفعل');
      return;
    }

    try {
      await mongoose.connect(config.mongodb.uri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      this.isConnected = true;
      logger.info('✅ تم الاتصال بقاعدة البيانات بنجاح');

      mongoose.connection.on('error', (err) => {
        logger.error('❌ خطأ في اتصال قاعدة البيانات', { error: err.message });
        this.isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('⚠️ انقطع الاتصال بقاعدة البيانات');
        this.isConnected = false;
      });

    } catch (error) {
      logger.error('❌ فشل الاتصال بقاعدة البيانات', { error: error.message });
      throw error;
    }
  }

  async disconnect() {
    try {
      await mongoose.disconnect();
      this.isConnected = false;
      logger.info('📴 تم قطع الاتصال بقاعدة البيانات');
    } catch (error) {
      logger.error('خطأ في قطع الاتصال', { error: error.message });
    }
  }

  getConnectionState() {
    const states = { 0: 'מנותק', 1: 'متصل', 2: 'جاري الاتصال', 3: 'جاري الفصل' };
    return states[mongoose.connection.readyState] || 'غير معروف';
  }
}

export default new DatabaseConnection();
