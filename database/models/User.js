/**
 * نموذج المستخدم
 */

import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  userId: { type: Number, required: true, unique: true, index: true },
  firstName: { type: String, default: '' },
  lastName: { type: String, default: '' },
  username: { type: String, default: '' },
  phone: { type: String, default: '' },
  accessHash: { type: String, default: '' },
  lastGreetedAt: { type: Date, default: null },
  lastInteractionAt: { type: Date, default: Date.now },
  messageCount: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
export default User;
