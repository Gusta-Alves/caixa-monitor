require('dotenv').config();

const fs = require('fs');
const path = require('path');
const winston = require('winston');

const LOGS_DIR = path.resolve(__dirname, '..', 'logs');
fs.mkdirSync(LOGS_DIR, { recursive: true });

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message }) =>
      `${timestamp} [${level.toUpperCase()}] ${message}`
    )
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: path.join(LOGS_DIR, 'app.log') }),
  ],
});

const CAIXA_URL = 'https://venda-imoveis.caixa.gov.br/listaweb/Lista_imoveis_SP.csv';
const ESTADO = 'SP';
const DESCONTO_MINIMO = 50;
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 8 * * *';
const MAX_RETRIES = 3;

module.exports = { logger, CAIXA_URL, ESTADO, DESCONTO_MINIMO, CRON_SCHEDULE, MAX_RETRIES };
