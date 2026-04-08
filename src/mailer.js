const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const Handlebars = require('handlebars');
const prisma = require('./db');
const { logger, DESCONTO_MINIMO } = require('./config');

const TEMPLATE_PATH = path.resolve(__dirname, '..', 'templates', 'email.hbs');

Handlebars.registerHelper('truncate', function (str, len) {
  if (!str) return '';
  if (str.length <= len) return str;
  return str.substring(0, len) + '...';
});

Handlebars.registerHelper('gt', function (a, b) {
  return a > b;
});

function loadTemplate() {
  const source = fs.readFileSync(TEMPLATE_PATH, 'utf-8');
  return Handlebars.compile(source);
}

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendNewItemsEmail(newItems, stats, user) {
  if (!newItems || newItems.length === 0) {
    logger.info('Nenhum imóvel novo — e-mail não enviado.');
    return;
  }

  const unsubscribeUrl = `${process.env.APP_URL}/api/unsubscribe?token=${user.unsubscribeToken}`;

  const template = loadTemplate();
  const sorted = [...newItems].sort((a, b) => b.desconto - a.desconto);
  const html = template({ newItems: sorted, ...stats, descontoMinimo: DESCONTO_MINIMO, unsubscribeUrl });

  const transporter = createTransport();

  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: user.email || process.env.EMAIL_TO,
    subject: `[Caixa Monitor] ${stats.totalNew} imóvel(is) novo(s) com desconto a partir de ${DESCONTO_MINIMO}% — ${stats.date}`,
    html,
  });

  logger.info(`E-mail enviado para ${user.email}. Message-ID: ${info.messageId}`);
}

async function logAlert(userId, stateCode, itemsSent, status) {
  await prisma.alertLog.create({
    data: { userId, stateCode, itemsSent, status },
  });
}

module.exports = { sendNewItemsEmail, logAlert };
