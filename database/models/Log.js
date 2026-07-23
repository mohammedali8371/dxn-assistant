/**
 * نموذج السجلات
 * يحتفظ بسجل جميع الأحداث والأخطاء
 */

import mongoose from 'mongoose';

const logSchema = new mongoose.Schema({
  level: {
    type: String,
    enum: ['info', 'warn', 'error', 'debug'],
    required: true,
  },
  category: {
    type: String,
    enum: ['message', 'command', 'error', 'system', 'api', 'auth'],
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  userId: {
    type: Number,
    default: null,
  },
}, {
  timestamps: true,
});

// فهرس للتاريخ
logSchema.index({ createdAt: 1 });

const Log = mongoose.model('Log', logSchema);
export default Log;
