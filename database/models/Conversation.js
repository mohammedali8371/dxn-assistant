/**
 * نموذج المحادثة
 */

import mongoose from 'mongoose';
import config from '../../config/index.js';

const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  type: { type: String, enum: ['text', 'voice', 'image', 'file', 'forwarded'], default: 'text' },
  timestamp: { type: Date, default: Date.now },
});

const conversationSchema = new mongoose.Schema({
  userId: { type: Number, required: true, index: true },
  messages: [messageSchema],
  totalMessages: { type: Number, default: 0 },
  lastMessageAt: { type: Date, default: Date.now },
}, { timestamps: true });

conversationSchema.methods.addMessage = async function (role, content, type = 'text') {
  const maxMessages = config.assistant.maxMemory;
  this.messages.push({ role, content, type, timestamp: new Date() });
  if (this.messages.length > maxMessages) {
    this.messages = this.messages.slice(-maxMessages);
  }
  this.totalMessages += 1;
  this.lastMessageAt = new Date();
  await this.save();
};

const Conversation = mongoose.model('Conversation', conversationSchema);
export default Conversation;
