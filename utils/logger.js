/**
 * نظام السجلات باستخدام Winston
 */

import winston from 'winston';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logsDir = config.assistant.logsDir;
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const customFormat = winston.format.printf(({ timestamp, level, message, ...meta }) => {
  const metaStr = Object.keys(meta).length > 0 ? ` | ${JSON.stringify(meta)}` : '';
  return `${timestamp} [${level.toUpperCase()}]: ${message}${metaStr}`;
});

const logger = winston.createLogger({
  level: config.env === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    customFormat
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880,
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5,
    }),
  ],
});

if (config.env !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'HH:mm:ss' }),
      winston.format.printf(({ timestamp, level, message }) => {
        return `${timestamp} ${level}: ${message}`;
      })
    ),
  }));
}

logger.api = (message, meta = {}) => logger.info(message, { ...meta, _type: 'api' });
logger.response = (message, meta = {}) => logger.info(message, { ...meta, _type: 'response' });
logger.system = (message, meta = {}) => logger.info(message, { ...meta, _type: 'system' });

export default logger;
