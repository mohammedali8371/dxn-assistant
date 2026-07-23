/**
 * نظام RAG
 * يبني قاعدة معرفة ويبحث فيها
 */

import config from '../config/index.js';
import logger from '../utils/logger.js';
import aiProviders from './ai-providers/index.js';
import knowledgeService from './knowledge.js';
import { Knowledge } from '../database/index.js';

class RAGService {
  constructor() {
    this.isInitialized = false;
  }

  /**
   * بناء قاعدة المعرفة
   */
  async buildKnowledgeBase() {
    try {
      logger.info('🔨 جاري بناء قاعدة المعرفة...');

      // معالجة جميع الملفات
      const processedFiles = await knowledgeService.processAllFiles();

      if (processedFiles.length === 0) {
        logger.info('لا توجد ملفات للمعالجة');
        this.isInitialized = true;
        return;
      }

      // حفظ في قاعدة البيانات
      for (const fileData of processedFiles) {
        try {
          // إنشاء embeddings للمقاطع
          const contents = fileData.chunks.map(c => c.content);
          let embeddings = [];

          if (aiProviders.providers.openai?.isAvailable) {
            embeddings = await aiProviders.createEmbeddings(contents);
          }

          // حفظ في MongoDB
          await Knowledge.findOneAndUpdate(
            { fileName: fileData.fileName },
            {
              $set: {
                fileType: fileData.fileType,
                fileSize: fileData.fileSize,
                totalChunks: fileData.totalChunks,
                isProcessed: fileData.isProcessed,
                processedAt: fileData.processedAt,
                chunks: fileData.chunks.map((chunk, i) => ({
                  ...chunk,
                  embedding: embeddings[i] || [],
                })),
              },
            },
            { upsert: true }
          );

          logger.info(`💾 تم حفظ ${fileData.fileName}`);
        } catch (error) {
          logger.error(`خطأ في حفظ ${fileData.fileName}`, { error: error.message });
        }
      }

      this.isInitialized = true;
      logger.info('✅ تم بناء قاعدة المعرفة بنجاح');

    } catch (error) {
      logger.error('خطأ في بناء قاعدة المعرفة', { error: error.message });
    }
  }

  /**
   * البحث في قاعدة المعرفة
   */
  async search(query) {
    try {
      // جلب جميع الملفات المعالجة
      const knowledgeDocs = await Knowledge.find({ isProcessed: true });

      if (!knowledgeDocs || knowledgeDocs.length === 0) {
        return 'لا توجد معلومات في قاعدة المعرفة حالياً.';
      }

      // إنشاء embedding للاستعلام
      let queryEmbedding = null;
      if (aiProviders.providers.openai?.isAvailable) {
        queryEmbedding = await aiProviders.createEmbedding(query);
      }

      // البحث عن أفضل المقاطع
      const allChunks = [];
      for (const doc of knowledgeDocs) {
        for (const chunk of doc.chunks) {
          allChunks.push({
            content: chunk.content,
            source: chunk.source,
            score: this.calculateScore(query, chunk.content, queryEmbedding, chunk.embedding),
          });
        }
      }

      // ترتيب و взять أفضل N مقاطع
      const topChunks = allChunks
        .sort((a, b) => b.score - a.score)
        .slice(0, config.assistant.topK)
        .filter(c => c.score > 0.05);

      if (topChunks.length === 0) {
        return 'لا توجد معلومات ذات صلة بالسؤال.';
      }

      return topChunks.map((c, i) => `[${i + 1}] ${c.content}`).join('\n\n');

    } catch (error) {
      logger.error('خطأ في البحث', { error: error.message });
      return '';
    }
  }

  /**
   * حساب درجة التشابه
   */
  calculateScore(query, content, queryEmbedding, contentEmbedding) {
    // درجة التداخل الكلمات
    const queryWords = query.toLowerCase().split(/\s+/).filter(Boolean);
    const contentWords = content.toLowerCase().split(/\s+/).filter(Boolean);
    let wordScore = 0;
    for (const word of queryWords) {
      if (contentWords.some(cw => cw.includes(word) || word.includes(cw))) {
        wordScore += 1;
      }
    }
    wordScore = queryWords.length > 0 ? wordScore / queryWords.length : 0;

    // درجة التشابه بالـ embeddings
    let embeddingScore = 0;
    if (queryEmbedding && contentEmbedding && contentEmbedding.length > 0) {
      embeddingScore = this.cosineSimilarity(queryEmbedding, contentEmbedding);
    }

    // الدمج
    if (embeddingScore > 0) {
      return wordScore * 0.3 + embeddingScore * 0.7;
    }
    return wordScore;
  }

  /**
   * حساب التشابه الكوسايني
   */
  cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    let dotProduct = 0, normA = 0, normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

export default new RAGService();
