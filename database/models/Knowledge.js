/**
 * نموذج المعرفة
 */

import mongoose from 'mongoose';

const chunkSchema = new mongoose.Schema({
  chunkId: { type: String, required: true },
  source: { type: String, required: true },
  content: { type: String, required: true },
  embedding: { type: [Number], default: [] },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
});

const knowledgeSchema = new mongoose.Schema({
  fileName: { type: String, required: true, unique: true },
  fileType: { type: String, required: true },
  fileSize: { type: Number, default: 0 },
  totalChunks: { type: Number, default: 0 },
  chunks: [chunkSchema],
  isProcessed: { type: Boolean, default: false },
  processedAt: { type: Date, default: null },
}, { timestamps: true });

const Knowledge = mongoose.model('Knowledge', knowledgeSchema);
export default Knowledge;
