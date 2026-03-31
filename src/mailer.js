const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const Handlebars = require('handlebars');
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

async function sendNewItemsEmail(newItems, stats) {
  if (!newItems || newItems.length === 0) {
    logger.info('Nenhum imóvel novo — e-mail não enviado.');
    return;
  }

  try {
    const template = loadTemplate();
    const sorted = [...newItems].sort((a, b) => b.desconto - a.desconto);
    const html = template({ newItems: sorted, ...stats, descontoMinimo: DESCONTO_MINIMO });

    const transporter = createTransport();
    const recipients = process.env.EMAIL_TO.split(',').map((e) => e.trim()).join(', ');

    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: recipients,
      subject: `[Caixa Monitor] ${stats.totalNew} imóvel(is) novo(s) com desconto a partir de ${DESCONTO_MINIMO}% — ${stats.date}`,
      html,
    });

    logger.info(`E-mail enviado com sucesso. Message-ID: ${info.messageId}`);
  } catch (err) {
    logger.error(`Falha ao enviar e-mail: ${err.message}`);
  }
}

module.exports = { sendNewItemsEmail };
