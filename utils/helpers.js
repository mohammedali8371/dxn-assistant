/**
 * الدوال المساعدة
 */

import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import config from '../config/index.js';
import logger from './logger.js';

export function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export async function downloadMedia(client, message) {
  try {
    if (!message.media) return null;
    const mediaDir = config.assistant.mediaDir;
    ensureDir(mediaDir);

    const buffer = await client.downloadMedia(message);
    if (!buffer) return null;

    const ext = getMediaExtension(message);
    const fileName = `media_${uuidv4()}${ext}`;
    const filePath = path.join(mediaDir, fileName);

    fs.writeFileSync(filePath, buffer);
    logger.info(`تم تنزيل الوسائط: ${filePath}`);
    return filePath;
  } catch (error) {
    logger.error('خطأ في تنزيل الوسائط', { error: error.message });
    return null;
  }
}

export function deleteFile(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    logger.error('خطأ في حذف الملف', { error: error.message });
  }
}

function getMediaExtension(message) {
  if (!message.media) return '.bin';
  const className = message.media.className || '';
  if (className === 'MessageMediaPhoto') return '.jpg';
  if (className === 'MessageMediaDocument') {
    const doc = message.media.document;
    if (doc && doc.mimeType) {
      if (doc.mimeType.includes('video')) return '.mp4';
      if (doc.mimeType.includes('audio') || doc.mimeType.includes('ogg')) return '.ogg';
      if (doc.mimeType.includes('pdf')) return '.pdf';
    }
  }
  return '.bin';
}

export function splitMessage(text, maxWords = 30) {
  if (!text) return [];
  const parts = [];
  const sentences = text.split(/(?<=[.!؟\n])\s*/);
  let currentPart = '';

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;
    const wordsInPart = currentPart.split(/\s+/).filter(Boolean).length;
    const wordsInSentence = trimmed.split(/\s+/).filter(Boolean).length;

    if (wordsInPart + wordsInSentence > maxWords && currentPart) {
      parts.push(currentPart.trim());
      currentPart = trimmed;
    } else {
      currentPart = currentPart ? currentPart + ' ' + trimmed : trimmed;
    }
  }

  if (currentPart.trim()) parts.push(currentPart.trim());
  return parts.length > 0 ? parts : [text];
}

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function isCommand(text) {
  return text && text.startsWith('/');
}
