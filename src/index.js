require('./config'); // carrega dotenv antes de tudo
const cron = require('node-cron');
const { downloadCSV } = require('./downloader');
const { parseAndFilter } = require('./parser');
const { findNewItems } = require('./comparator');
const { sendNewItemsEmail } = require('./mailer');
const { logger, CRON_SCHEDULE } = require('./config');

function today() {
  return new Date().toLocaleDateString('pt-BR');
}

async function main() {
  logger.info('Iniciando verificação...');

  try {
    const csv = await downloadCSV();

    if (csv === null) {
      logger.error('Site indisponível após 3 tentativas. Próxima tentativa amanhã.');
      return;
    }

    const filtered = parseAndFilter(csv);
    logger.info(`${filtered.length} imóvel(is) com desconto > 40%.`);

    if (process.env.FORCE_TEST_EMAIL === 'true') {
      const sample = filtered.slice(0, 3);
      logger.info('MODO TESTE: enviando e-mail com 3 itens de amostra.');
      await sendNewItemsEmail(sample, { totalFiltered: filtered.length, totalNew: sample.length, date: today() });
      logger.info('MODO TESTE: e-mail de teste enviado.');
      return;
    }

    const { newItems, totalFiltered, totalNew } = await findNewItems(filtered);

    if (totalNew > 0) {
      await sendNewItemsEmail(newItems, { totalFiltered, totalNew, date: today() });
    }

    logger.info(
      `Verificação concluída — filtrados: ${totalFiltered}, novos: ${totalNew}, data: ${today()}.`
    );
  } catch (err) {
    logger.error(`Erro inesperado na execução principal: ${err.message}`);
  }
}

if (process.env.GITHUB_ACTIONS === 'true') {
  main().then(() => process.exit(0));
} else {
  main();

  cron.schedule(CRON_SCHEDULE, () => {
    logger.info('Execução agendada pelo cron iniciada.');
    main();
  });

  logger.info(`Scheduler ativo. Próxima execução: cron(${CRON_SCHEDULE}).`);
}
