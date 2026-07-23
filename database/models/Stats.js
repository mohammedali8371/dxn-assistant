/**
 * نموذج الإحصائيات
 */

import mongoose from 'mongoose';

const statsSchema = new mongoose.Schema({
  date: { type: String, required: true, unique: true },
  totalMessages: { type: Number, default: 0 },
  textMessages: { type: Number, default: 0 },
  voiceMessages: { type: Number, default: 0 },
  imageMessages: { type: Number, default: 0 },
  fileMessages: { type: Number, default: 0 },
  newUsers: { type: Number, default: 0 },
  totalReplies: { type: Number, default: 0 },
  errors: { type: Number, default: 0 },
  aiTokensUsed: { type: Number, default: 0 },
}, { timestamps: true });

const Stats = mongoose.model('Stats', statsSchema);
export default Stats;
