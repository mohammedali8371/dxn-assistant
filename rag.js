/**
 * ملف قاعدة المعرفة (RAG)
 * استخراج النصوص من الملفات وبناء قاعدة بحث محلية
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import config from './config.js';
import { logger, ensureDir } from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ======================== إعدادات RAG ========================
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;
const VECTOR_STORE_PATH = path.join(__dirname, 'vector_store.json');

// ======================== استخراج النصوص ========================

/**
 * استخراج النص من ملف PDF
 */
async function extractPDF(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text || '';
  } catch (error) {
    logger.error('خطأ في قراءة PDF', { file: filePath, error: error.message });
    return '';
  }
}

/**
 * استخراج النص من ملف Word (DOCX)
 */
async function extractWord(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  } catch (error) {
    logger.error('خطأ في قراءة Word', { file: filePath, error: error.message });
    return '';
  }
}

/**
 * استخراج النص من ملف Excel
 */
function extractExcel(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    let text = '';
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      text += XLSX.utils.sheet_to_csv(sheet) + '\n';
    }
    return text;
  } catch (error) {
    logger.error('خطأ في قراءة Excel', { file: filePath, error: error.message });
    return '';
  }
}

/**
 * استخراج النص من ملف نصي TXT
 */
function extractTXT(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    logger.error('خطأ في قراءة TXT', { file: filePath, error: error.message });
    return '';
  }
}

// ======================== تقسيم النصوص ========================

/**
 * تقسيم النص إلى أجزاء (chunks)
 * @param {string} text - النص الكامل
 * @param {number} chunkSize - حجم كل جزء
 * @param {number} overlap - التراكب بين الأجزاء
 * @returns {Array<string>} مصفوفة الأجزاء
 */
function splitTextIntoChunks(text, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  if (!text || text.trim().length === 0) return [];

  const cleanText = text.replace(/\s+/g, ' ').trim();

  if (cleanText.length <= chunkSize) {
    return [cleanText];
  }

  const chunks = [];
  let startIndex = 0;

  while (startIndex < cleanText.length) {
    let endIndex = startIndex + chunkSize;

    // محاولة التوقف عند نهاية جملة
    if (endIndex < cleanText.length) {
      const lastPeriod = cleanText.lastIndexOf('.', endIndex);
      if (lastPeriod > startIndex + chunkSize * 0.5) {
        endIndex = lastPeriod + 1;
      }
    }

    const chunk = cleanText.slice(startIndex, endIndex).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    startIndex = endIndex - overlap;
    if (startIndex >= cleanText.length) break;
  }

  return chunks;
}

// ======================== التضمين المحلي ========================

/**
 * تضمين نص بشكل بسيط (TF-IDF محلي)
 * إذا كان OPENAI_API_KEY متاحاً، يمكن استخدام OpenAI Embeddings
 */
function simpleEmbed(text, dimension = 384) {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  const vector = new Array(dimension).fill(0);

  for (let i = 0; i < words.length; i++) {
    // خوارزمية hash بسيطة لكل كلمة
    let hash = 0;
    for (let j = 0; j < words[i].length; j++) {
      hash = ((hash << 5) - hash) + words[i].charCodeAt(j);
      hash = hash & hash;
    }
    const index = Math.abs(hash) % dimension;
    vector[index] += 1 / (1 + i * 0.1);
  }

  // تطبيع المتجه
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (norm > 0) {
    for (let i = 0; i < vector.length; i++) {
      vector[i] /= norm;
    }
  }

  return vector;
}

/**
 * حساب التشابه الكوسايني بين متجهين
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ======================== إدارة Vector Store ========================

/**
 * تحميل Vector Store من ملف
 */
function loadVectorStore() {
  try {
    if (fs.existsSync(VECTOR_STORE_PATH)) {
      const data = fs.readFileSync(VECTOR_STORE_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    logger.error('خطأ في تحميل Vector Store', { error: error.message });
  }
  return [];
}

/**
 * حفظ Vector Store في ملف
 */
function saveVectorStore(store) {
  try {
    fs.writeFileSync(VECTOR_STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
    logger.info(`✅ تم حفظ ${store.length} قطعة في Vector Store`);
  } catch (error) {
    logger.error('خطأ في حفظ Vector Store', { error: error.message });
  }
}

// ======================== الواجهة الرئيسية ========================

/**
 * بناء قاعدة المعرفة من الملفات الموجودة في مجلد knowledge
 */
export async function buildKnowledgeBase() {
  const knowledgeDir = path.resolve(config.assistant.knowledgeDir);

  if (!fs.existsSync(knowledgeDir)) {
    ensureDir(knowledgeDir);
    logger.warn('مجلد المعرفة فارغ، تم إنشاؤه');
    return;
  }

  const supportedExtensions = ['.pdf', '.docx', '.doc', '.txt', '.xlsx', '.xls'];
  const files = fs.readdirSync(knowledgeDir).filter(file => {
    const ext = path.extname(file).toLowerCase();
    return supportedExtensions.includes(ext);
  });

  if (files.length === 0) {
    logger.info('لا توجد ملفات في مجلد المعرفة');
    return;
  }

  logger.info(`📂 تم العثور على ${files.length} ملف في مجلد المعرفة`);

  const allChunks = [];

  for (const file of files) {
    const filePath = path.join(knowledgeDir, file);
    const ext = path.extname(file).toLowerCase();

    let text = '';
    switch (ext) {
      case '.pdf': text = await extractPDF(filePath); break;
      case '.docx':
      case '.doc': text = await extractWord(filePath); break;
      case '.xlsx':
      case '.xls': text = extractExcel(filePath); break;
      case '.txt': text = extractTXT(filePath); break;
    }

    if (text && text.trim().length > 0) {
      const chunks = splitTextIntoChunks(text);
      for (let i = 0; i < chunks.length; i++) {
        const embedding = simpleEmbed(chunks[i]);
        allChunks.push({
          id: `${file}_${i}`,
          source: file,
          content: chunks[i],
          embedding,
        });
      }
      logger.info(`✅ ${file}: ${chunks.length} قطعة`);
    }
  }

  saveVectorStore(allChunks);
  logger.info(`🎉 تم بناء قاعدة المعرفة: ${allChunks.length} قطعة من ${files.length} ملف`);
}

/**
 * البحث في قاعدة المعرفة
 * @param {string} query - استعلام البحث
 * @returns {Promise<string>} النصوص ذات الصلة
 */
export async function searchKnowledge(query) {
  const store = loadVectorStore();

  if (!store || store.length === 0) {
    return 'لا توجد معلومات في قاعدة المعرفة حالياً.';
  }

  const queryEmbedding = simpleEmbed(query);

  // حساب التشابه لكل قطعة
  const scored = store.map(chunk => ({
    ...chunk,
    score: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));

  // ترتيب حسب التشابه وأخذ أفضل N نتائج
  const topResults = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, config.assistant.ragTopK)
    .filter(r => r.score > 0.05);

  if (topResults.length === 0) {
    return 'لا توجد معلومات ذات صلة.';
  }

  return topResults
    .map((r, i) => `[${i + 1}] ${r.content}`)
    .join('\n\n');
}
