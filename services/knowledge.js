/**
 * خدمة المعرفة
 * تستخرج النصوص من الملفات وتقسمها إلى مقاطع
 */

import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { ensureDir } from '../utils/helpers.js';

class KnowledgeService {
  constructor() {
    this.supportedExtensions = ['.pdf', '.docx', '.doc', '.txt', '.xlsx', '.xls', '.md'];
  }

  async extractPDF(filePath) {
    try {
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);
      return data.text || '';
    } catch (error) {
      logger.error('خطأ في PDF', { file: filePath, error: error.message });
      return '';
    }
  }

  async extractWord(filePath) {
    try {
      const buffer = fs.readFileSync(filePath);
      const result = await mammoth.extractRawText({ buffer });
      return result.value || '';
    } catch (error) {
      logger.error('خطأ في Word', { file: filePath, error: error.message });
      return '';
    }
  }

  extractExcel(filePath) {
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
      logger.error('خطأ في Excel', { file: filePath, error: error.message });
      return '';
    }
  }

  extractTXT(filePath) {
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch (error) {
      logger.error('خطأ في TXT', { file: filePath, error: error.message });
      return '';
    }
  }

  async extractText(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.pdf': return await this.extractPDF(filePath);
      case '.docx':
      case '.doc': return await this.extractWord(filePath);
      case '.xlsx':
      case '.xls': return this.extractExcel(filePath);
      case '.txt':
      case '.md': return this.extractTXT(filePath);
      default: return '';
    }
  }

  splitTextIntoChunks(text, chunkSize = null, overlap = null) {
    const size = chunkSize || config.assistant.chunkSize;
    const overlapSize = overlap || config.assistant.chunkOverlap;

    if (!text || text.trim().length === 0) return [];
    const cleanText = text.replace(/\s+/g, ' ').trim();
    if (cleanText.length <= size) return [cleanText];

    const chunks = [];
    let startIndex = 0;

    while (startIndex < cleanText.length) {
      let endIndex = startIndex + size;
      if (endIndex < cleanText.length) {
        const lastPeriod = cleanText.lastIndexOf('.', endIndex);
        if (lastPeriod > startIndex + size * 0.5) {
          endIndex = lastPeriod + 1;
        }
      }
      const chunk = cleanText.slice(startIndex, endIndex).trim();
      if (chunk.length > 0) chunks.push(chunk);
      startIndex = endIndex - overlapSize;
      if (startIndex >= cleanText.length) break;
    }

    return chunks;
  }

  async processFile(filePath) {
    const fileName = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();

    if (!this.supportedExtensions.includes(ext)) return null;

    try {
      const text = await this.extractText(filePath);
      if (!text || text.trim().length === 0) return null;

      const chunks = this.splitTextIntoChunks(text);
      logger.info(`✅ ${fileName}: ${chunks.length} مقطع`);

      return {
        fileName,
        fileType: ext,
        fileSize: fs.statSync(filePath).size,
        chunks: chunks.map((content, index) => ({
          chunkId: `${fileName}_${index}`,
          content,
          source: fileName,
          metadata: { index, totalChunks: chunks.length },
        })),
        totalChunks: chunks.length,
        isProcessed: true,
        processedAt: new Date(),
      };
    } catch (error) {
      logger.error(`خطأ في معالجة ${fileName}`, { error: error.message });
      return null;
    }
  }

  async processAllFiles() {
    const knowledgeDir = config.assistant.knowledgeDir;
    if (!fs.existsSync(knowledgeDir)) {
      ensureDir(knowledgeDir);
      return [];
    }

    const files = fs.readdirSync(knowledgeDir).filter(file => {
      const ext = path.extname(file).toLowerCase();
      return this.supportedExtensions.includes(ext);
    });

    if (files.length === 0) return [];

    logger.info(`📂 تم العثور على ${files.length} ملف`);
    const results = [];

    for (const file of files) {
      const filePath = path.join(knowledgeDir, file);
      const result = await this.processFile(filePath);
      if (result) results.push(result);
    }

    return results;
  }
}

export default new KnowledgeService();
